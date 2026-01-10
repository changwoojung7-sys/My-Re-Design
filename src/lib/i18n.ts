import { useState, useEffect } from 'react';

type Language = 'en' | 'ko';

export const translations = {
    en: {
        // My Page
        focusArea: "Focus Area",
        plan: "Plan",
        started: "Started",
        viewOnly: "View Only",
        editing: "Editing",
        mainGoal: "Main Goal",
        duration: "Duration",
        month: "Month",
        months: "Months",
        saveDesign: "Save Design",
        saving: "Saving...",
        deletePlan: "Delete Plan",
        // Categories
        health: "Health",
        growth: "Growth",
        mindset: "Mindset",
        career: "Career",
        social: "Social",
        vitality: "Vitality",
        // Form Labels
        height: "Height (cm)",
        weight: "Weight (kg)",
        growthTopic: "Topic (e.g. Reading, Coding)",
        currentLevel: "Current Level",
        targetLevel: "Target Level",
        projectName: "Project Name",
        kpi: "Key Outcome (KPI)",
        currentMood: "Current Mood / State",
        affirmation: "Daily Affirmation",
        socialPeople: "Person to connect with",
        socialActivity: "Activity (e.g. Call, Meet)",
        vitalityHobby: "Hobby / Interest",
        vitalityRoutine: "Routine to build",
        description: "Details...",
        whatToAchieve: "What do you want to achieve?",

        // Today (Mission)
        missionOverview: "Mission Overview",
        generateNewMissions: "Generate New Missions",
        generating: "Generating...",
        complete: "Complete",
        verify: "Verify",
        inProgress: "In Progress",

        // Growth (Dashboard)
        // growth: "Growth", // Duplicated
        totalMissions: "Total Missions",
        successRate: "Success Rate",
        currentStreak: "Current Streak",
        aiCoach: "AI Coach",

        // Friends
        addFriend: "Add Friend",
        searchPlaceholder: "Phone or Email",
        readyToStart: "Ready to start...",
        missions: "Missions",
        progress: "Progress",

        // Subscription
        paywallTitle: "Unlock Your Potential",
        paywallSubtitle: "Continue your journey with CoreLoop Premium",
        paywallWarningTitle: "Free Trial Ended",
        paywallWarningDesc1: "Missions are free up to Day 4.",
        paywallWarningDesc2: "From Day 5, a subscription is required to continue.",
        maybeLater: "Maybe Later",
        subscribe: "Subscribe",
        freeTrialEnded: "Your All free trial has ended.",
        subscribeNow: "Subscribe Now",
        plan1Month: "1 Month",
        plan3Months: "3 Months",
        plan6Months: "6 Months",
        plan12Months: "12 Months",
        savePercent: "Save",
        price1Month: "₩4,900",
        price3Months: "₩12,900",
        price6Months: "₩19,900",
        price12Months: "₩29,900",
        restorePurchase: "Restore Purchase",
        manageSubscription: "Manage Subscription",
        subscriptionStatus: "Subscription Status",
        currentPlan: "Current Plan",
        expiresOn: "Expires On",
        cancelSubscription: "Cancel Subscription",
        active: "Active",
        expired: "Expired",
        terms: "Terms",
        privacy: "Privacy",
        challengeCount: "Challenge {n}",

        // Date Helpers
        day: "Day",
        today: "Today",
        tomorrow: "Tomorrow",

        // Dashboard specific
        analysisTarget: "Analysis Target",
        performanceTrend: "Performance Trend",
        week: "Week",
        month_label: "Month",
        overall: "Overall",

        // Login & Onboarding
        appTitle: "My Re Design", // Brand name usually not translated, but consistent key
        appSubtitle: "Reconnect your daily rhythm.",
        myLoopSubtitle: "Small challenges that awaken your daily life",
        login: "Login",
        loginId: "LOGIN ID",
        email: "Email",
        phone: "Phone",
        password: "Password",
        noAccount: "Don't have an account?",
        createAccount: "Create a new account",
        guestLogin: "Enter as Guest (MVP Demo)",

        // Account Settings
        accountSettings: "Account Settings",
        emailAuth: "Email Authentication",
        nickname: "NICKNAME",
        age: "AGE",
        gender: "GENDER",
        backupPhone: "BACKUP PHONE",
        backupEmail: "BACKUP EMAIL",
        addRecoveryEmail: "Add recovery email",
        addRecoveryPhone: "Add recovery phone",
        changePassword: "Change Password",
        currentPassword: "Current Password",
        newPassword: "New Password",
        confirmNewPassword: "Confirm New Password",
        updatePassword: "Update Password",
        saveChanges: "Save Changes",
        security: "SECURITY",

        // Friend History Notification
        accessRequests: "Access Requests",
        allCaughtUp: "All caught up!",
        noPendingRequests: "No pending requests.",
        activeAccess: "Active Access (Friends)",
        noActiveAccess: "No active access granted.",
        revoke: "Revoke",
        wantsToViewHistory: "{category} history requested by",
        history: "history",
        approve: "Approve",
        reject: "Reject",
        approved: "Approved",
        rejected: "Rejected",
        pending: "Pending",
        sharePrompt: "Share missions with friends, family, and colleagues!",
        unknownUser: "Unknown User",
        unknownCategory: "Unknown",
        historyAccessLog: "History Access Log",
    },
    ko: {
        // My Page
        focusArea: "집중 영역",
        plan: "계획",
        started: "시작일",
        viewOnly: "조회 모드",
        editing: "수정 모드",
        mainGoal: "최종 목표",
        duration: "기간",
        month: "개월",
        months: "개월",
        saveDesign: "설계 저장",
        saving: "저장 중...",
        deletePlan: "계획 삭제",
        // Categories
        health: "건강",
        growth: "성장",
        mindset: "마인드",
        career: "커리어",
        social: "소셜",
        vitality: "일상",
        // Form Labels
        height: "키 (cm)",
        weight: "몸무게 (kg)",
        growthTopic: "주제 (예: 독서, 코딩)",
        currentLevel: "현재 수준",
        targetLevel: "목표 수준",
        projectName: "프로젝트명",
        kpi: "핵심 성과 (KPI)",
        currentMood: "현재 기분/상태",
        affirmation: "나에게 해줄 말 (확언)",
        socialPeople: "함께할 사람 (연락 대상)",
        socialActivity: "활동 (예: 전화, 만남)",
        vitalityHobby: "취미 / 관심사",
        vitalityRoutine: "만들고 싶은 루틴",
        description: "상세 내용...",
        whatToAchieve: "무엇을 이루고 싶으신가요?",

        // Today (Mission)
        missionOverview: "미션 개요",
        generateNewMissions: "새 미션 생성",
        generating: "생성 중...",
        complete: "완료",
        verify: "인증하기",
        inProgress: "진행 중",

        // Growth (Dashboard)
        // growth: "성장", // Duplicated
        totalMissions: "총 미션",
        successRate: "성공률",
        currentStreak: "연속 달성",
        aiCoach: "AI 코치",

        // Friends
        addFriend: "친구 추가",
        searchPlaceholder: "전화번호 또는 이메일",
        readyToStart: "시작 준비 중...",
        missions: "미션",
        progress: "진행도",

        // Subscription
        paywallTitle: "잠재력을 깨우세요",
        paywallSubtitle: "CoreLoop 프리미엄으로 여정을 계속하세요",
        paywallWarningTitle: "무료 체험 종료",
        paywallWarningDesc1: "미션은 4일차까지 무료로 제공됩니다.",
        paywallWarningDesc2: "5일차부터는 구독을 통해 여정을 계속할 수 있습니다.",
        maybeLater: "다음에 하기",
        subscribe: "구독하기",
        freeTrialEnded: "모두 무료 체험이 종료되었습니다.",
        subscribeNow: "구독하기",
        plan1Month: "1개월",
        plan3Months: "3개월",
        plan6Months: "6개월",
        plan12Months: "12개월",
        savePercent: "절약",
        price1Month: "₩4,900",
        price3Months: "₩12,900",
        price6Months: "₩19,900",
        price12Months: "₩29,900",
        restorePurchase: "구매 복원",
        manageSubscription: "구독 관리",
        subscriptionStatus: "구독 상태",
        currentPlan: "현재 플랜",
        expiresOn: "만료일",
        cancelSubscription: "구독 취소",
        active: "활성",
        expired: "만료됨",
        terms: "이용약관",
        privacy: "개인정보처리방침",
        challengeCount: "{n}차 도전",

        // Date Helpers
        day: "일차",
        today: "오늘",
        tomorrow: "내일",

        // Dashboard specific
        analysisTarget: "분석 대상",
        performanceTrend: "수행 추이",
        week: "주간",
        month_label: "월간", // using month_label to avoid conflict with 'month' (month duration)
        overall: "전체",

        // Login & Onboarding
        appTitle: "My Re Design",
        appSubtitle: "일상의 리듬을 다시 찾으세요.",
        myLoopSubtitle: "나의 일상을 깨우는 작은 도전들",
        login: "로그인",
        loginId: "로그인 ID",
        email: "이메일",
        phone: "휴대전화",
        password: "비밀번호",
        noAccount: "계정이 없으신가요?",
        createAccount: "새 계정 만들기",
        guestLogin: "게스트로 입장 (MVP 데모)",

        // Account Settings
        accountSettings: "계정 설정",
        emailAuth: "이메일 인증",
        nickname: "닉네임",
        age: "나이",
        gender: "성별",
        backupPhone: "비상 연락처",
        backupEmail: "비상 이메일",
        addRecoveryEmail: "복구 이메일 추가",
        addRecoveryPhone: "복구 전화번호 추가",
        changePassword: "비밀번호 변경",
        currentPassword: "현재 비밀번호",
        newPassword: "새 비밀번호",
        confirmNewPassword: "새 비밀번호 확인",
        updatePassword: "비밀번호 변경하기",
        saveChanges: "변경사항 저장",
        security: "보안",

        // Friend History Notification
        accessRequests: "요청 알림",
        allCaughtUp: "새로운 알림이 없습니다!",
        noPendingRequests: "대기 중인 요청이 없습니다.",
        activeAccess: "활성 권한 (친구)",
        noActiveAccess: "부여된 권한이 없습니다.",
        revoke: "철회",
        wantsToViewHistory: "님이 회원님의",
        history: "기록을 보고 싶어합니다.",
        approve: "수락",
        reject: "거절",
        approved: "승인됨",
        rejected: "거절됨",
        pending: "대기 중",
        sharePrompt: "친구.가족.동료들과 미션을 함께하면서 공유해 보세요!",
        unknownUser: "알 수 없는 사용자",
        unknownCategory: "알 수 없음",
        historyAccessLog: "히스토리 접근 로그",
    }
};

export function useLanguage() {
    const [language, setLanguage] = useState<Language>('en');

    useEffect(() => {
        const browserLang = navigator.language.split('-')[0];
        if (browserLang === 'ko') {
            setLanguage('ko');
        } else {
            setLanguage('en');
        }
    }, []);

    return {
        language,
        t: translations[language],
        isKo: language === 'ko'
    };
}
