# 미션탭 무료/프리미엄 정책 및 광고 로직 분석

## 전체 흐름 요약

```mermaid
flowchart TD
    A["사용자가 미션탭 진입"] --> B{"구독 상태 확인<br/>(checkStatus)"}
    B -->|프리미엄 구독 활성| C["✅ 모든 기능 사용 가능<br/>미션 3개, 광고 없음"]
    B -->|구독 없음| D{"Trial Phase 판별<br/>(가입일 기준)"}
    D -->|"Phase 1 (1~7일)"| E["✅ 완전 무료<br/>미션 3개, 광고 없음"]
    D -->|"Phase 2 (8~21일)"| F["✅ 미션 3개 제공<br/>리프레시 시 광고 시청 필요"]
    D -->|"Phase 3 (22~30일)"| G["✅ 미션 3개 제공<br/>리프레시 시 광고 시청 필요"]
    D -->|"Phase 4 (31일~)"| H{"Paywall 모드 확인"}
    H -->|"ads 모드"| I["🔒 AdWarning 모달 표시<br/>광고 시청 → 1시간 언락"]
    H -->|"subscription 모드"| J["🔒 PaywallWarning 모달<br/>→ 결제 화면으로 유도"]
```

---

## 1. 무료 사용일수 (Dynamic Trial Phase)

[Today.tsx](file:///c:/calamusAppBuild/MyReDesign_App/src/pages/Home/Today.tsx) 에서 구현됩니다.

기존에 하드코딩되었던 4단계(Phase 1~4) 방식은 폐기되었습니다. 이제는 사용자의 개별 설정(`custom_free_trial_days`) 또는 글로벌 설정(`globalPaywallDay`)을 통해 동적으로 무료 제공 기한이 결정됩니다.

| 상태 | 기준 | 미션 수 | 광고 | 설명 |
|-------|------|---------|------|------|
| **무료 기간 내** | 가입일 기준 경과일수 <= 무료 지정일수 | 3개 | 리프레시 시만 | 기간 한정 완전 무료 |
| **무료 기간 만료** | 가입일 기준 경과일수 > 무료 지정일수 | **0개 (잠금)** | ⚠️ Paywall 활성 | 구독 또는 광고 시청 필수 |

> [!IMPORTANT]
> 경과 일수는 **사용자 가입일 또는 목표의 `created_at`** 기준으로 계산됩니다.
> 예외적으로 **FunPlay** 목표는 이 기간에 구애받지 않고 **항상 무료**로 이용 가능합니다.

```typescript
const { data: paywallDayData } = await supabase.from('admin_settings').select('value').eq('key', 'paywall_start_day').single();
const globalPaywallDay = paywallDayData?.value ? parseInt(paywallDayData.value, 10) : 5;

// 사용자에 개별 지정된 무료 이용 가능 일수가 있으면 우선 적용, 없으면 글로벌 기본값 적용
const userFreeDays = user?.custom_free_trial_days ?? globalPaywallDay;

// 경과일수(diffDays)가 무료 이용 가능 일수(userFreeDays)를 넘었는지 확인
setIsTrialExpired(diffDays > userFreeDays);
```

---

## 2. 구독 확인 로직 (checkStatus)

[Today.tsx L136~166](file:///c:/calamusAppBuild/MyReDesign_App/src/pages/Home/Today.tsx#L136-L166)

`subscriptions` 테이블에서 현재 유효한 구독을 확인합니다:

| 조건 | 결과 |
|------|------|
| `type = 'all'` + 날짜 범위 내 | ✅ **모든 카테고리** 접근 가능 |
| `type = 'mission'` + `target_id` 매칭 | ✅ **해당 카테고리만** 접근 가능 |
| 해당 없음 | ❌ Trial Phase에 따라 제한 |

---

## 3. Paywall 활성화 조건

[Today.tsx L772](file:///c:/calamusAppBuild/MyReDesign_App/src/pages/Home/Today.tsx#L772)

```typescript
const isPaywallActive = !loading 
    && !checkingSubs 
    && !hasActiveSubscription   // 구독 없음
    && !isFunplay               // FunPlay가 아님 (FunPlay는 항상 무료)
    && trialPhase === 4         // 31일 이상 경과
    && !isAdUnlocked            // 광고 시청 언락 안 됨
    && !hasConfirmedMissions;   // 이미 확인된 미션 없음
```

**모든 조건이 충족되면** → `paywallStep = 'warning'` 설정 → 모달 표시

---

## 4. Paywall 모드 분기 (ads vs subscription)

[Today.tsx L860~890](file:///c:/calamusAppBuild/MyReDesign_App/src/pages/Home/Today.tsx#L860-L890)

`admin_settings` 테이블의 `paywall_mode` 값에 따라 분기:

### 4-1. 광고 모드 (`ads`)

```
AdWarning 모달 → "광고 시청" 클릭 → RewardAd 표시 → 시청 완료 → 1시간 언락
                → "프리미엄 가입" 클릭 → Paywall 결제 화면
```

### 4-2. 구독 모드 (`subscription`)

```
PaywallWarning 모달 → "확인" 클릭 → Paywall 결제 화면
                    → "취소" 클릭 → FunPlay 또는 구독된 다른 목표로 이동
```

---

## 5. 광고 시청 후 언락 로직

[Today.tsx L842~856](file:///c:/calamusAppBuild/MyReDesign_App/src/pages/Home/Today.tsx#L842-L856)

```typescript
const handleAdReward = () => {
    setIsAdUnlocked(true);
    // 1시간 쿨다운 저장 (localStorage)
    const key = `ad_unlocked_${user.id}_${selectedGoalId}_${selectedDate}`;
    localStorage.setItem(key, Date.now().toString());
    // 대기 중이던 리프레시 실행
    if (pendingRefresh) executeRefresh();
};
```

| 항목 | 값 |
|------|-----|
| 유효 시간 | **1시간** |
| 저장 위치 | `localStorage` (세션 기반) |
| Key 형식 | `ad_unlocked_{userId}_{goalId}_{date}` |
| 적용 범위 | 해당 목표 + 해당 날짜에만 적용 |

---

## 6. 미션 리프레시 광고 강제

[Today.tsx L453~476](file:///c:/calamusAppBuild/MyReDesign_App/src/pages/Home/Today.tsx#L453-L476)

```typescript
const handleRefresh = async () => {
    if (refreshCount >= 3) return; // 일일 3회 제한

    // 무료 사용자 → 광고 먼저 시청
    if (user?.subscription_tier !== 'premium' && !hasActiveSubscription) {
        setPendingRefresh(true);
        setShowRewardAd(true);  // 광고 표시
        return;
    }
    // 프리미엄 → 바로 실행
    executeRefresh();
};
```

| 사용자 유형 | 리프레시 동작 |
|-------------|---------------|
| **프리미엄 구독자** | 바로 리프레시 (일일 3회) |
| **무료 사용자** | 광고 시청 후 리프레시 (일일 3회) |

---

## 7. FunPlay 예외 정책

- **FunPlay 카테고리는 항상 무료**입니다
- Paywall이 활성화되어도 FunPlay 목표는 잠기지 않음 (`!isFunplay` 조건)
- Paywall 취소 시 FunPlay 목표가 있으면 자동으로 이동됨

---

## 8. 미션 수 제한 로직

[Today.tsx L350~372](file:///c:/calamusAppBuild/MyReDesign_App/src/pages/Home/Today.tsx#L350-L372)

```typescript
let limit = 3;
// 완료된 미션은 항상 표시 + 남은 슬롯에 미완료 미션 채움
const completedMissions = relevantMissions.filter(m => m.is_completed);
const incompleteMissions = relevantMissions.filter(m => !m.is_completed);
const showList = [...completedMissions];
const remainingSlots = Math.max(0, limit - showList.length);
showList.push(...incompleteMissions.slice(0, remainingSlots));
```

> [!NOTE]
> 이전에는 Phase 3에서 미션 1개로 제한했었으나, **현재는 Phase 1~3 모두 3개로 통일**되어 있습니다. Phase 4에서는 Paywall이 먼저 차단하므로 미션 자체가 표시되지 않습니다.

---

## 요약 다이어그램

```mermaid
stateDiagram-v2
    [*] --> Phase1: 가입 1~7일
    Phase1 --> Phase2: 8일째
    Phase2 --> Phase3: 22일째
    Phase3 --> Phase4: 31일째

    state Phase1 {
        [*] --> 미션3개_무료
    }
    state Phase2 {
        [*] --> 미션3개_리프레시광고
    }
    state Phase3 {
        [*] --> 미션3개_리프레시광고2
    }
    state Phase4 {
        [*] --> Paywall_Check
        Paywall_Check --> AdWarning: ads 모드
        Paywall_Check --> PaywallWarning: subscription 모드
        AdWarning --> 1시간_언락: 광고 시청
        PaywallWarning --> 결제: 구독 결제
        1시간_언락 --> 미션3개_사용
    }
```
