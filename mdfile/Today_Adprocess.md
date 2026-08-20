# TODAY 미션탭 무료/프리미엄 정책 및 광고 로직 분석

## 전체 흐름 요약

```mermaid
flowchart TD
    A["사용자가 TODAY 미션탭 진입"] --> B{"구독 상태 확인<br/>(checkStatus)"}
    B -->|프리미엄 Pro 구독 활성| C["✅ 모든 기능 무제한 이용<br/>미션 3개, 광고 0회, 무비 플레이 즉시 재생"]
    B -->|구독 없음 (무료 유저)| D{"목표 시작일(created_at) 기준<br/>Trial Day 계산"}
    D -->|"무료 적응기간 (Day 1~7)"| E["✅ 100% 완전 무료<br/>일일 3개 미션 수행, 미션 3회 변경 (광고 없음)"]
    D -->|"체험 기간 만료 (Day 8~)"| H{"Paywall 모드 분기 (admin_settings)"}
    H -->|"ads 모드 (기본)"| I["🔒 락인 / AdWarning 모달<br/>보상형 광고 1회 시청 시 1시간 언락"]
    H -->|"subscription 모드"| J["🔒 PaywallWarning 모달<br/>→ Pro 구독 결제 화면으로 유도"]
```

---

## 1. 무료 사용일수 (Dynamic Trial Phase)

[Today.tsx](file:///c:/calamusAppBuild/MyReDesign_App/src/pages/Home/Today.tsx) 에서 구현됩니다.

기존의 복잡한 30일 다단계(Phase 1~4) 방식 대신, **목표 시작일(`selectedGoal.created_at`) 기준 7일 무료 체험(Day 1 ~ Day 7)** 규칙으로 단순화 및 표준화되었습니다.

| 상태 | 기준 | 미션 수 | 미션 변경 (Refresh) | 광고 노출 | 설명 |
|-------|------|---------|---------------------|-----------|------|
| **무료 적응기간** | 목표 생성일 기준 1~7일차 (`diffDays <= 7`) | 3개 | 하루 3회 무료 | **광고 없음** | 복귀 유저가 새 목표를 생성해도 Day 1부터 7일간 완전 무료 |
| **체험기간 만료** | 목표 생성일 기준 8일차 이상 (`diffDays > 7`) | 0개 (잠금) / 언락 시 3개 | 광고 시청 후 변경 | ⚠️ Paywall / 보상형 광고 | Pro 구독 또는 광고 시청(1시간 언락) 필수 |
| **Pro 프리미엄** | `plan_type` = pro_monthly/pro_yearly | 3개 (전 카테고리) | 하루 3회 즉시 변경 | **광고 없음** | 모든 카테고리 무제한 + 히스토리 릴스 무제한 재생 |

> [!IMPORTANT]
> * **목표별 독립 계산**: 복귀 유저가 새로운 목표를 세우면 해당 목표의 `created_at` 기준 Day 1로 계산되어 7일간의 무료 체험이 정상 제공됩니다.
> * **개별 설정 지원**: 사용자의 `custom_free_trial_days` 컬럼 또는 관리자 설정(`paywall_start_day`)으로 체험 기간을 유연하게 조정할 수 있습니다.

```typescript
// 현재 선택된 활성 목표의 시작일(created_at)을 기준으로 경과 일수 계산
let startDate = new Date();
if (selectedGoal?.created_at) {
    startDate = new Date(selectedGoal.created_at);
} else if (user) {
    const { data: profile } = await supabase.from('profiles').select('created_at').eq('id', user.id).single();
    if (profile?.created_at) startDate = new Date(profile.created_at);
}

const now = new Date();
const diffTime = Math.abs(now.getTime() - startDate.getTime());
const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
setAccountAgeDays(diffDays);

const userFreeDays = user?.custom_free_trial_days ?? globalPaywallDay; // 기본 7일
setIsTrialExpired(diffDays > userFreeDays);
```

---

## 2. 미션 리프레시 (미션 변경 & 컨디션 변경) 규칙

[Today.tsx](file:///c:/calamusAppBuild/MyReDesign_App/src/pages/Home/Today.tsx)

* **컨디션 변경 & 미션 변경 공통 적용**: 오늘의 컨디션(1~5) 이모티콘을 탭하거나 '미션 변경' 버튼을 누르면 AI가 당일 컨디션에 맞춰 미션을 재구성하며, **일일 3회 한도 내에서 1회씩 차감**됩니다.
* **DB 및 로컬 영구 동기화**: `mission_generations` 테이블에 즉시 카운트가 업데이트되어 다른 탭 이동 후 복귀 시에도 정확한 잔여 횟수가 유지됩니다.
* **애니메이션 동기화**: 새로고침 시작 즉시 이전 카드가 비워지고 로딩 화면이 표시되어 화면 잔류 버그가 발생하지 않습니다.

```typescript
const handleRefresh = async (customCondition?: number) => {
    // 1. 데모 유저: 로컬 스토리지 기준 일일 3회 제한
    if (user?.id === 'demo123') {
        const today = formatLocalYMD(new Date());
        const count = parseInt(localStorage.getItem(`demo_refresh_count_${today}`) || '0', 10);
        if (count >= 3) {
            alert('체험용 AI 미션 생성은 하루 3회로 제한됩니다. 계속 이용하시려면 회원가입을 해주세요!');
            return;
        }
        localStorage.setItem(`demo_refresh_count_${today}`, String(count + 1));
        executeRefresh(customCondition);
        return;
    }

    if (refreshCount >= 3) {
        alert('오늘의 미션 변경 횟수(3회)를 모두 사용하셨습니다.');
        return;
    }

    const isInitialGeneration = missions.length === 0 && draftMissions.length === 0;

    // 2. 무료 적응기간(Day 1~7)이 지난 무료 사용자(Day 8+)만 광고 시청 요구
    if (!hasActiveSubscription && isTrialExpired && !isInitialGeneration) {
        setPendingRefresh(true);
        setShowRewardAd(true);
        return;
    }

    // 3. Pro 구독자 및 무료 체험(Day 1~7) 유저는 광고 없이 즉시 미션 변경 실행
    executeRefresh(customCondition);
};
```

---

## 3. 히스토리 탭 무비 플레이 (Play Movie) 정책

[HistoryDetail.tsx](file:///c:/calamusAppBuild/MyReDesign_App/src/pages/History/HistoryDetail.tsx)

과거 인증 사진/비디오를 모아 숏폼 릴스 영상으로 재생하는 기능은 고부하 미디어 스트리밍 리소스를 사용하므로 다음과 같이 동작합니다:

| 사용자 상태 | 무비 플레이 (Play Movie) 동작 |
|-------------|----------------------------|
| **Pro 구독자** | **광고 없이 즉시 고화질 릴스 재생** |
| **비구독자 및 무료 체험 유저** | **보상형 광고(Reward Ad) 1회 시청 완료 후 재생** |

---

## 4. 광고 시청 후 1시간 언락 메커니즘

[Today.tsx](file:///c:/calamusAppBuild/MyReDesign_App/src/pages/Home/Today.tsx)

* **언락 유지 시간**: 시청 완료 시점부터 **1시간**
* **저장소**: `localStorage` (`ad_unlocked_{userId}_{goalId}_{date}`)
* **이벤트 처리**: 시청 중 이탈/취소(`Dismissed`) 시에는 리워드가 지급되지 않으며, 시청 완료(`Rewarded`) 이벤트 수신 시에만 1시간 언락 및 미션 갱신이 진행됩니다.
