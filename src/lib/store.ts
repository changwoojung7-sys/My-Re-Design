import { create } from 'zustand';

interface User {
    id: string;
    email: string;
    nickname: string;
    // Flattened profile columns
    age?: number;
    gender?: string;
    // Subscription
    subscription_tier?: 'free' | 'premium';
    subscription_end_date?: string;
    custom_free_trial_days?: number;
    full_name?: string;
    phone?: string;
    notification_time?: string; // HH:mm format
    // Profile Image
    profile_image_url?: string;
    // Keeping legacy for compatibility if needed, but prefer top-level
    routine_dna?: any;
}

interface Mission {
    id: string;
    user_id?: string;
    content: string;
    is_completed: boolean;
    category: string;
    image_url?: string | null;
    date?: string;
    // Personalization Fields
    reasoning?: string | {
        user_context?: string;
        scientific_basis?: string;
        expected_impact?: string;
    };
    trust_score?: number;
    // Verification & Execution
    proof_text?: string | null;
    proof_type?: string; // 'text' | 'image' | 'video' | 'audio' | 'none'
    verification_type?: string; // 'text' | 'image' | 'checkbox'
    seq?: number;
    details?: any;
}

interface AppState {
    user: User | null;
    missions: Mission[];
    setUser: (user: User | null) => void;
    setMissions: (missions: Mission[]) => void;
    updateMission: (id: string, updates: Partial<Mission>) => void;
    // Language State
    language: 'en' | 'ko' | 'ja' | 'zh';
    setLanguage: (lang: 'en' | 'ko' | 'ja' | 'zh') => void;
}

import { persist } from 'zustand/middleware';

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            user: null, // Initial state: not logged in
            missions: [],
            setUser: (user) => set({ user }),
            setMissions: (missions) => set({ missions }),
            updateMission: (id, updates) =>
                set((state) => ({
                    missions: state.missions.map((m) =>
                        m.id === id ? { ...m, ...updates } : m
                    ),
                })),
            language: 'ko', // Default to Korean as per request
            setLanguage: (language) => set({ language }),
        }),
        {
            name: 'coreloop-storage',
        }
    )
);
