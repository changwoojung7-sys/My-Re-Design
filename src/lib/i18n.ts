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
        learning: "Learning",
        achievement: "Achievement",
        self_esteem: "Self Esteem",
        other: "Other",
        // Form Labels
        height: "Height (cm)",
        weight: "Weight (kg)",
        subject: "Subject",
        currentLevel: "Current Level",
        targetLevel: "Target Level",
        projectName: "Project Name",
        milestones: "Milestones",
        currentState: "Current State",
        desiredState: "Desired State",
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
        growth: "Growth",
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
        learning: "학습",
        achievement: "성취",
        self_esteem: "자존감",
        other: "기타",
        // Form Labels
        height: "키 (cm)",
        weight: "몸무게 (kg)",
        subject: "주제/과목",
        currentLevel: "현재 수준",
        targetLevel: "목표 수준",
        projectName: "프로젝트명",
        milestones: "주요 마일스톤",
        currentState: "현재 상태",
        desiredState: "바라는 모습",
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
        growth: "성장",
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
