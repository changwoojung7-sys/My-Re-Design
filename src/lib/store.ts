import { create } from 'zustand';

interface User {
    id: string;
    email: string;
    nickname: string;
    // Flattened profile columns
    age?: number;
    gender?: string;
    goal_health?: string;
    goal_learning?: string;
    goal_achievement?: string;
    goal_self_esteem?: string;
    goal_other?: string;
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
}

interface AppState {
    user: User | null;
    missions: Mission[];
    setUser: (user: User | null) => void;
    setMissions: (missions: Mission[]) => void;
    updateMission: (id: string, updates: Partial<Mission>) => void;
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
        }),
        {
            name: 'coreloop-storage',
        }
    )
);
