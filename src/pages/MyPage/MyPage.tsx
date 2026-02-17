import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { Trash2, Save, LogOut, ChevronDown, Settings, X, Mail, Phone, Lock, ChevronRight, CreditCard, Sparkles, Camera, Bell, Globe, HelpCircle, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import SubscriptionManager from './SubscriptionManager';
import UserGuide from '../../components/common/UserGuide';
import { deleteFilesFromStorage } from '../../lib/storageHelper';
import { notificationManager } from '../../lib/notificationManager';

export type GoalCategory = 'body_wellness' | 'growth_career' | 'mind_connection' | 'funplay';

interface UserGoal {
    id?: string;
    category: GoalCategory;
    target_text: string;
    duration_months: number;
    details: any;
    created_at?: string;
    seq?: number;
}

import { useLanguage } from '../../lib/i18n';


const INITIAL_GOALS: Record<GoalCategory, UserGoal> = {
    body_wellness: { category: 'body_wellness', target_text: '', duration_months: 1, details: { height: '', weight: '', hobby: '', routine: '' }, seq: 1 },
    growth_career: { category: 'growth_career', target_text: '', duration_months: 3, details: { topic: '', current_level: '', target_level: '' }, seq: 1 },
    mind_connection: { category: 'mind_connection', target_text: '', duration_months: 1, details: { current_mood: '', affirmation: '', people: '', activity_type: '' }, seq: 1 },
    funplay: { category: 'funplay', target_text: '', duration_months: 1, details: { difficulty: 'easy', time_limit: 30, mood: 'fun', avoid_tags: '' }, seq: 1 }
};

export default function MyPage() {
    const { user, setUser, setMissions } = useStore();
    const { t, language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        const hasSeen = localStorage.getItem('has_seen_guide');
        if (!hasSeen) {
            setShowGuide(true);
        }
    }, []);

    // Settings Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSubManagerOpen, setIsSubManagerOpen] = useState(false);
    const [settingsData, setSettingsData] = useState({
        loginId: '',
        fullName: '',
        nickname: '',
        age: 25,
        gender: 'female',
        backupPhone: '',
        backupEmail: '',
        isPhoneAuth: false
    });

    // Password Update State
    const [isPasswordExpanded, setIsPasswordExpanded] = useState(false);
    const [passwordData, setPasswordData] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    // UI State
    const [selectedCategory, setSelectedCategory] = useState<GoalCategory>('body_wellness');
    const [goals, setGoals] = useState<Record<GoalCategory, UserGoal>>(JSON.parse(JSON.stringify(INITIAL_GOALS)));
    const [goalViewMode, setGoalViewMode] = useState<'active' | 'completed'>('active');
    const [allGoals, setAllGoals] = useState<any[]>([]);
    const [selectedCompletedGoal, setSelectedCompletedGoal] = useState<any | null>(null);
    const [completedEditMode, setCompletedEditMode] = useState(false);
    const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

    // Request Approval State
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
    const [showRequestsModal, setShowRequestsModal] = useState(false);
    const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

    // Subscription State
    // Paywall States
    const [globalPaywallDay, setGlobalPaywallDay] = useState(5);
    const [activeSubscriptions, setActiveSubscriptions] = useState<any[]>([]);

    // Account Deletion Verification State
    const [showDeleteVerify, setShowDeleteVerify] = useState(false);
    const [verifyCodeInput, setVerifyCodeInput] = useState('');
    const [verifyTimer, setVerifyTimer] = useState(0);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [notificationTime, setNotificationTime] = useState('09:00');


    // Verification Timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (verifyTimer > 0) {
            interval = setInterval(() => setVerifyTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [verifyTimer]);

    useEffect(() => {
        // Fetch Subscriptions & Paywall Settings
        const fetchData = async () => {
            if (!user) return;

            // 1. Subscriptions
            const { data: subs } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .gte('end_date', new Date().toISOString());

            if (subs) setActiveSubscriptions(subs);

            // 2. Global Paywall Setting
            const { data: adminData } = await supabase.from('admin_settings').select('value').eq('key', 'paywall_start_day').single();
            if (adminData?.value) setGlobalPaywallDay(parseInt(adminData.value));

            // 3. Sync Profile Data (Standardize across devices)
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileData) {
                // Merge DB profile data into local user store
                // Preserve email from auth if not present in profile (usually profile doesn't have email)
                setUser({
                    ...user,
                    ...profileData,
                    email: user.email // Ensure email is not lost/overwritten if profile doesn't have it
                });
            }
        };

        if (user) {
            fetchUserGoals();
            fetchIncomingRequests();
            fetchData();
        }
    }, [user?.id, isSubManagerOpen]); // Re-fetch when sub manager closes, but NOT on every user object update (prevents loop)

    // Helper to check if a category is unlocked
    const isCategoryUnlocked = (category: string) => {
        // 1. Check if user has explicit subscription
        const hasAllAccess = activeSubscriptions.some(s => s.type === 'all');
        const hasMissionAccess = activeSubscriptions.some(s => s.type === 'mission' && s.target_id === category);
        if (hasAllAccess || hasMissionAccess) return true;

        // 2. Check Free Trial Logic (Day Count)
        const g = goals[category as GoalCategory];
        if (!g.created_at) return true; // Not started yet -> Unlocked (can edit)

        const start = new Date(g.created_at);
        const now = new Date();
        const diffMs = now.getTime() - start.getTime();
        const dayCount = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

        // Priority: User Custom > Global Default
        // If limit is 10, Day 10 is free. Day 11 is locked.
        // So Locked if Day > Limit.
        const limit = user?.custom_free_trial_days ?? globalPaywallDay;

        return dayCount <= limit;
    };


    const fetchIncomingRequests = async () => {
        if (!user) return;

        // 1. Fetch Requests directly (no joins to avoid RLS/Schema issues)
        const { data: reqs, error } = await supabase
            .from('friend_history_permissions')
            .select('id, requester_id, goal_id, created_at, status')
            .eq('target_user_id', user.id)
            .in('status', ['pending', 'approved'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching requests:", error);
            return;
        }

        if (!reqs || reqs.length === 0) {
            setIncomingRequests([]);
            return;
        }

        // 2. Fetch Requesters (Profiles)
        const requesterIds = [...new Set(reqs.map(r => r.requester_id))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, nickname')
            .in('id', requesterIds);

        const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) || []);

        // 3. Fetch Goals (for category info)
        const goalIds = [...new Set(reqs.map(r => r.goal_id))];
        const { data: goalsData } = await supabase
            .from('user_goals')
            .select('id, category, target_text, seq')
            .in('id', goalIds);

        const goalMap = Object.fromEntries(goalsData?.map(g => [g.id, g]) || []);

        // 4. Merge
        const enrichedReqs = reqs.map(r => ({
            ...r,
            requester: profileMap[r.requester_id] || { nickname: t.unknownUser },
            goal: goalMap[r.goal_id] || { category: t.unknownCategory, target_text: '', seq: 1 }
        }));

        setIncomingRequests(enrichedReqs);
    };

    const handleApproveRequest = async (id: string) => {
        // 1. Visual Feedback First
        setApprovingIds(prev => new Set(prev).add(id));

        // 2. Perform DB Update
        const { error } = await supabase
            .from('friend_history_permissions')
            .update({ status: 'approved' })
            .eq('id', id);

        if (error) {
            console.error(error);
            alert(t.alertApproveFail);
            setApprovingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } else {
            // 3. Delay slightly to show the "Approved" state, then move
            setTimeout(() => {
                setIncomingRequests(prev => prev.map(r =>
                    r.id === id ? { ...r, status: 'approved' } : r
                ));
                setApprovingIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                // Force sync with DB to ensure persistence
                fetchIncomingRequests();
            }, 1000); // 1 second delay
        }
    };

    const handleRejectRequest = async (id: string) => {
        const { error } = await supabase
            .from('friend_history_permissions')
            .delete()
            .eq('id', id);

        if (!error) {
            setIncomingRequests(prev => prev.filter(r => r.id !== id));
        }
    };

    const fetchUserGoals = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('user_goals')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (data) {
            // Store all goals for completed view
            setAllGoals(data);

            const newGoals = JSON.parse(JSON.stringify(INITIAL_GOALS));
            const maxSeqMap: Record<string, number> = {};

            // Find max seq for each category (active view)
            data.forEach((g: any) => {
                const cat = g.category;
                const seq = g.seq || 1;
                if (!maxSeqMap[cat] || seq > maxSeqMap[cat]) {
                    maxSeqMap[cat] = seq;
                    if (newGoals[cat as GoalCategory]) {
                        newGoals[cat as GoalCategory] = g;
                    }
                }
            });
            setGoals(newGoals);
        }
    };



    const handleOpenSettings = async () => {
        setLoading(true);
        // Fetch fresh auth data
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (authUser) {
            const isPhone = authUser.email?.endsWith('@phone.coreloop.com') || authUser.email?.endsWith('@myredesign.com') || false;
            let loginId = authUser.email || '';

            if (isPhone) {
                // Extract phone from fake email or metadata
                loginId = authUser.user_metadata?.phone_number || loginId.split('@')[0];
                // Format phone if needed
                if (loginId.length === 11 && !loginId.includes('-')) {
                    loginId = loginId.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
                }
            }

            setSettingsData({
                loginId,
                fullName: user?.full_name || '',
                nickname: user?.nickname || '',
                age: user?.age || 25,
                gender: user?.gender || 'female',
                backupPhone: authUser.user_metadata?.phone_number || '', // If email auth, this handles backup
                backupEmail: authUser.user_metadata?.real_email || '', // If phone auth, this handles backup
                isPhoneAuth: isPhone
            });
            // Reset password state
            setPasswordData({ current: '', new: '', confirm: '' });
            setIsPasswordExpanded(false);

            // Notification State
            setNotificationTime(user?.notification_time || '09:00');

            setIsSettingsOpen(true);
        }
        setLoading(false);
    };

    const handleSaveSettings = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // 1. Update Profile (DB)
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: settingsData.fullName,
                    nickname: settingsData.nickname,
                    age: settingsData.age,
                    gender: settingsData.gender,
                    // We can also save phone_number here if we want to sync it from backupPhone
                    phone_number: settingsData.isPhoneAuth ? settingsData.loginId.replace(/-/g, '') : settingsData.backupPhone.replace(/-/g, ''), // Ensure DB has the primary/backup phone
                    notification_time: notificationTime,
                    updated_at: new Date()
                })
                .eq('id', user.id);
            if (profileError) throw profileError;

            // 2. Update Auth Metadata
            const metaUpdate: any = {
                nickname: settingsData.nickname, // Keep metadata in sync
            };

            if (settingsData.isPhoneAuth) {
                metaUpdate.real_email = settingsData.backupEmail;
            } else {
                metaUpdate.phone_number = settingsData.backupPhone.replace(/-/g, '');
            }

            const { error: authError } = await supabase.auth.updateUser({
                data: metaUpdate
            });
            if (authError) throw authError;

            // 3. Update Local Store
            setUser({
                ...user,
                full_name: settingsData.fullName,
                nickname: settingsData.nickname,
                age: settingsData.age,
                gender: settingsData.gender,
                notification_time: notificationTime
            });

            // 4. Schedule Notification
            if (notificationTime) {
                const [hour, minute] = notificationTime.split(':').map(Number);
                await notificationManager.requestPermissions();
                await notificationManager.scheduleDailyNotification(hour, minute);
            } else {
                await notificationManager.cancelNotifications();
            }

            setIsSettingsOpen(false);
            alert(t.alertSettingsUpdated);
        } catch (err: any) {
            console.error(err);

            // Handle Unique Constraint Violation (Duplicate Phone Number)
            if (err.code === '23505' && err.message?.includes('profiles_phone_number_key')) {
                try {
                    // Retry updating WITHOUT phone_number
                    const { error: retryError } = await supabase
                        .from('profiles')
                        .update({
                            nickname: settingsData.nickname,
                            age: settingsData.age,
                            gender: settingsData.gender,
                            updated_at: new Date()
                        })
                        .eq('id', user.id);

                    if (retryError) throw retryError;

                    // Update Local Store (partial)
                    setUser({
                        ...user,
                        full_name: settingsData.fullName,
                        nickname: settingsData.nickname,
                        age: settingsData.age,
                        gender: settingsData.gender
                    });

                    setIsSettingsOpen(false);
                    alert("Settings saved, but phone number could not be linked because it is already used by another account.");
                } catch (retryErr) {
                    alert("Failed to update settings. Please try again.");
                }
            } else {
                alert(t.alertSettingsFail);
            }
        } finally {
            setLoading(false);
        }
    };



    const handleProfileImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        setLoading(true);
        try {
            const fileExt = file.name.split('.').pop();
            // Use user.id as root folder to comply with likely RLS policy (auth.uid() = folder[1])
            const fileName = `${user.id}/avatar_${Date.now()}.${fileExt}`;

            // Upload to 'mission-proofs' bucket (re-using existing bucket to avoid creation steps)
            const { error: uploadError } = await supabase.storage
                .from('mission-proofs')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('mission-proofs')
                .getPublicUrl(fileName);

            // Update DB immediately
            const { error: dbError } = await supabase
                .from('profiles')
                .update({ profile_image_url: publicUrl })
                .eq('id', user.id);

            if (dbError) throw dbError;

            // Update Local State
            setUser({ ...user, profile_image_url: publicUrl });
            alert(t.alertProfileImgUpdated);

        } catch (error) {
            console.error('Error uploading avatar:', error);
            alert(t.alertProfileImgFail);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordUpdate = async () => {
        if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
            alert(t.alertFillPassword);
            return;
        }
        if (passwordData.new !== passwordData.confirm) {
            alert(t.alertPasswordMismatch);
            return;
        }
        if (passwordData.new.length < 6) {
            alert(t.alertPasswordLength);
            return;
        }

        setLoading(true);
        try {
            // 1. Verify Current Password via Re-authentication
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser || !authUser.email) throw new Error("User not found");

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: authUser.email,
                password: passwordData.current
            });

            if (signInError) {
                alert(t.alertPasswordIncorrect);
                setLoading(false);
                return;
            }

            // 2. Update to New Password
            const { error: updateError } = await supabase.auth.updateUser({
                password: passwordData.new
            });

            if (updateError) throw updateError;

            alert(t.alertPasswordUpdated);
            setPasswordData({ current: '', new: '', confirm: '' });
            setIsPasswordExpanded(false);

        } catch (error: any) {
            console.error('Password update error:', error);
            alert(t.alertPasswordUpdateFail || error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Account Deletion Verification Handlers ---
    const handleSendDeleteVerification = async () => {
        if (!user || !user.email) {
            alert(t.alertNoEmail);
            setShowDeleteVerify(false);
            return;
        }
        setVerifyLoading(true);
        try {
            // Confirm we have a valid user session
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) throw new Error("No authenticated user found.");

            // Force Email Verification
            // Note: If user is logged in via Phone, they might not have a confirmed email?
            // But requirement says "Email is mandatory". So we assume user.email is valid.
            const { error } = await supabase.auth.signInWithOtp({
                email: user.email
            });

            if (error) throw error;

            setVerifyTimer(60);
            alert(t.alertCodeSent);
        } catch (err: any) {
            console.error(err);
            alert(err.message);
            setShowDeleteVerify(false); // Reset on error
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleVerifyAndDelete = async () => {
        if (!verifyCodeInput) return;
        setVerifyLoading(true);

        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) throw new Error("No user.");

            // Verify OTP (Email)
            const { error: verifyError } = await supabase.auth.verifyOtp({
                email: user?.email!, // We checked user.email existence in send step
                token: verifyCodeInput,
                type: 'email'
            });

            if (verifyError) throw verifyError;

            // If success, proceed to delete
            const confirmFinal = window.confirm(t.deleteAccountConfirm2 || "Are you sure? This is irreversible.");
            if (!confirmFinal) return;

            // -------------------------------------------------------------
            // NEW: Clean up Storage Files BEFORE deleting DB records
            // -------------------------------------------------------------
            // 1. Fetch all mission images/videos for this user
            const { data: userMissions } = await supabase
                .from('missions')
                .select('image_url')
                .eq('user_id', user!.id)
                .not('image_url', 'is', null);

            // 2. Get profile image
            const profileImage = user!.profile_image_url;

            // 3. Collect all URLs
            const allUrlsToDelete = [
                ...(userMissions?.map(m => m.image_url) || []),
                profileImage
            ];

            // 4. Delete files
            if (allUrlsToDelete.length > 0) {
                await deleteFilesFromStorage(allUrlsToDelete);
            }
            // -------------------------------------------------------------


            // Call RPC
            const { error: rpcError } = await supabase.rpc('delete_account');
            if (rpcError) throw rpcError;

            alert(t.accountDeleted);
            await supabase.auth.signOut();
            window.location.href = '/login';

        } catch (err: any) {
            console.error(err);
            alert(t.deleteAccountFailed?.replace('{error}', err.message) || err.message);
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setMissions([]);
        navigate('/login');
    };

    const isGoalExpired = () => {
        if (!currentGoal.created_at) return false;

        const start = new Date(currentGoal.created_at);
        start.setHours(0, 0, 0, 0); // Normalize to midnight

        let totalDays = 0;

        if (currentGoal.duration_months < 1) {
            // Week handling: 0.25 = 1 week (7 days), 0.5 = 2 weeks (14 days)
            totalDays = currentGoal.duration_months === 0.25 ? 7 :
                currentGoal.duration_months === 0.5 ? 14 :
                    Math.round(currentGoal.duration_months * 30);
        } else {
            totalDays = currentGoal.duration_months * 30;
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize to midnight

        const diffMs = now.getTime() - start.getTime();
        const daysPassed = Math.round(diffMs / (1000 * 60 * 60 * 24));

        console.log(`[MyPage Expiry Check] Category: ${currentGoal.category}, DaysPassed: ${daysPassed}, TotalDays: ${totalDays}, Expired: ${daysPassed >= totalDays}`);

        return daysPassed >= totalDays;
    };

    const handleSaveMainGoal = async (isNewChallenge = false) => {
        if (!user) return;
        setLoading(true);
        try {
            // Logic:
            // 1. If isNewChallenge=true, we insert a NEW row with seq = current.seq + 1
            // 2. If isNewChallenge=false, we upsert/update the CURRENT row (same ID or specific seq)

            const current = goals[selectedCategory];
            const nextSeq = (current.seq || 1) + (isNewChallenge ? 1 : 0);

            // Prepare Data
            const goalData: any = {
                user_id: user.id,
                category: selectedCategory,
                target_text: current.target_text,
                duration_months: current.duration_months,
                details: current.details,
                seq: nextSeq,
                updated_at: new Date()
            };

            // If it's an EDIT of an existing goal, keep the ID (upsert)
            // If it's a NEW challenge, we DON'T send ID, so it auto-generates
            if (!isNewChallenge && current.id) {
                goalData.id = current.id;
            }

            const { error: goalError } = await supabase
                .from('user_goals')
                .upsert(goalData, { onConflict: 'id' }); // Use ID for upserting specific row

            // Note: If we just insert, onConflict might be tricky if we had a unique constraint on (user_id, category).
            // But we changed logic to allow multiple. So simple INSERT is fine for new challenge.
            // Wait, supabase upsert without onConflict usually works if primary key is present.
            // If isNewChallenge is true, 'id' is undefined, so it inserts.

            if (goalError) throw goalError;

            await fetchUserGoals();
            setIsEditing(false);
            alert(isNewChallenge ? t.alertNextChallenge : t.alertDesignSaved);
        } catch (error) {
            console.error('Error saving goal:', error);
            alert(t.alertSaveGoalFail);
        } finally {
            setLoading(false);
        }
    };

    const updateGoal = (field: string, value: any, isDetail = false) => {
        setGoals(prev => ({
            ...prev,
            [selectedCategory]: {
                ...prev[selectedCategory],
                ...(isDetail
                    ? { details: { ...prev[selectedCategory].details, [field]: value } }
                    : { [field]: value }
                )
            }
        }));
    };

    // Helper: check if a goal is expired
    const isGoalItemExpired = (g: any) => {
        if (!g.created_at) return false;
        const start = new Date(g.created_at);
        start.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let totalDays = 0;
        if (g.duration_months < 1) {
            totalDays = g.duration_months === 0.25 ? 7 : g.duration_months === 0.5 ? 14 : Math.round(g.duration_months * 30);
        } else {
            totalDays = (g.duration_months || 1) * 30;
        }
        const diffMs = now.getTime() - start.getTime();
        const daysPassed = Math.round(diffMs / (1000 * 60 * 60 * 24));
        return daysPassed >= totalDays;
    };

    // Computed: completed goals (expired or explicitly completed)
    const completedGoals = allGoals.filter(g => isGoalItemExpired(g) || g.is_completed === true);

    // Handler: delete a completed goal and its associated data
    const handleDeleteCompletedGoal = async (goalToDelete: any) => {
        if (!goalToDelete?.id) return;
        const confirmed = window.confirm('이 완료된 목표와 관련된 모든 미션 데이터를 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.');
        if (!confirmed) return;

        setDeletingGoalId(goalToDelete.id);
        try {
            // Delete associated data
            await supabase.from('friend_history_permissions').delete().eq('goal_id', goalToDelete.id);
            await supabase.from('goal_likes').delete().eq('goal_id', goalToDelete.id);
            await supabase.from('goal_comments').delete().eq('goal_id', goalToDelete.id);

            // Delete mission storage files
            const { data: goalMissions } = await supabase
                .from('missions')
                .select('image_url')
                .eq('user_id', user!.id)
                .eq('category', goalToDelete.category)
                .eq('seq', goalToDelete.seq || 1)
                .not('image_url', 'is', null);

            const urlsToDelete = goalMissions?.map((m: any) => m.image_url) || [];
            if (urlsToDelete.length > 0) {
                await deleteFilesFromStorage(urlsToDelete);
            }

            // Delete missions
            await supabase.from('missions').delete()
                .eq('user_id', user!.id)
                .eq('category', goalToDelete.category)
                .eq('seq', goalToDelete.seq || 1);

            // Delete the goal itself
            await supabase.from('user_goals').delete().eq('id', goalToDelete.id);

            // Refresh
            if (selectedCompletedGoal?.id === goalToDelete.id) {
                setSelectedCompletedGoal(null);
            }
            await fetchUserGoals();
            alert('삭제되었습니다.');
        } catch (err) {
            console.error('Delete completed goal error:', err);
            alert('삭제에 실패했습니다.');
        } finally {
            setDeletingGoalId(null);
        }
    };

    if (!user) return null;

    const currentGoal = goalViewMode === 'completed' && selectedCompletedGoal ? selectedCompletedGoal : goals[selectedCategory];
    const hasGoal = (cat: GoalCategory) => !!goals[cat].id;

    const handleDeleteGoal = async () => {
        if (!currentGoal.id) return;

        // 1. Strong Confirmation
        const isConfirmed = window.confirm(t.confirmDeletePlan);
        if (!isConfirmed) return;

        const isDoubleConfirmed = window.confirm(t.confirmDeletePlanWarning);
        if (!isDoubleConfirmed) return;

        setLoading(true);
        try {
            // 2. Explicitly Delete All Associated Data (Reverse Order of Dependencies)

            // A. Friend Permissions (Requests tied to this specific goal)
            await supabase.from('friend_history_permissions').delete().eq('goal_id', currentGoal.id);

            // B. Social Interactions (Likes/Comments tied to this goal)
            await supabase.from('goal_likes').delete().eq('goal_id', currentGoal.id);
            await supabase.from('goal_comments').delete().eq('goal_id', currentGoal.id);

            // C. Missions (Daily Logs for this category)
            // Missions are loosely coupled by category. To fully reset History/Growth stats for this slot,
            // we must delete all missions associated with this category for the user.

            // -----------------------------------------------------------------
            // NEW: Clean up storage files for these missions
            // -----------------------------------------------------------------
            const { data: goalMissions } = await supabase
                .from('missions')
                .select('image_url')
                .eq('user_id', user.id)
                .eq('category', selectedCategory)
                .eq('seq', currentGoal.seq || 1)
                .not('image_url', 'is', null);

            const urlsToDelete = goalMissions?.map(m => m.image_url) || [];
            if (urlsToDelete.length > 0) {
                await deleteFilesFromStorage(urlsToDelete);
            }
            // -----------------------------------------------------------------


            const { error: missionError } = await supabase
                .from('missions')
                .delete()
                .eq('user_id', user.id)
                .eq('category', selectedCategory)
                .eq('seq', currentGoal.seq || 1); // Delete specific sequence

            if (missionError) throw missionError;

            // D. The Goal Itself
            const { error: goalError } = await supabase
                .from('user_goals')
                .delete()
                .eq('id', currentGoal.id)
                .eq('seq', currentGoal.seq || 1);

            if (goalError) throw goalError;

            alert(t.alertPlanDeleted);

            // 4. Reset Local State
            setGoals(prev => ({
                ...prev,
                [selectedCategory]: {
                    id: '',
                    user_id: user.id,
                    category: selectedCategory,
                    target_text: '',
                    duration_months: 1,
                    details: {},
                    created_at: '',
                }
            }));
            setIsEditing(false);

        } catch (error: any) {
            console.error("Delete Error:", error);
            alert(t.alertDeletePlanFail?.replace('{error}', error.message) || error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col p-6 pt-6 pb-32 relative overflow-hidden">
            <div className="flex flex-col items-start mb-2 shrink-0">
                {/* Title Row with Icons */}
                <div className="flex items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-3">
                        <img src="/reme_icon.png" alt="Logo" className="w-9 h-9 rounded-2xl shadow-lg shadow-primary/20" />
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent shrink-0">
                            My Re Design
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">

                        {/* Help / Guide Button */}


                        {/* Notification Bell */}
                        <button
                            onClick={() => setShowRequestsModal(true)}
                            className="p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors relative"
                        >
                            <Bell size={18} />
                            {incomingRequests.some(r => r.status === 'pending') && (
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-900 animate-pulse" />
                            )}
                        </button>

                        <button
                            onClick={handleOpenSettings}
                            className="p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
                        >
                            <Settings size={18} />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>

                {/* Subtitles below */}
                <div className="mt-1 flex items-end justify-between w-full">
                    <div className="flex-1 min-w-0 mr-2">
                        <p className="text-xs font-medium text-slate-400 whitespace-nowrap">{t.myLoopSubtitle}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">{t.sharePrompt}</p>
                    </div>

                    {/* Help Button Moved Here */}
                    <button
                        onClick={() => setShowGuide(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 hover:text-white transition-colors border border-white/5"
                    >
                        <HelpCircle size={14} className="text-yellow-400" />
                        <span className="text-[10px] font-bold">Guide</span>
                    </button>
                </div>
            </div>

            {/* User Guide Overlay */}
            <AnimatePresence>
                {showGuide && <UserGuide onClose={() => setShowGuide(false)} />}
            </AnimatePresence>

            {/* Notification Bell */}
            <div className="absolute top-10 right-20 mr-12 sm:mr-0 z-10">
                {/* Adjusted position to be near other icons, actually let's put it IN the flex container above */}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar relative min-h-0">
                {/* Profile Header (Read Only / Quick View) */}
                <div className="relative bg-white/5 border border-white/10 rounded-3xl p-6 mb-6 mt-1">
                    <button
                        onClick={() => {
                            if (user.id === 'demo123') return alert(t.demoPaymentLimit);
                            setIsSubManagerOpen(true);
                        }}
                        className="absolute top-6 right-6 p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2"
                    >
                        <CreditCard size={20} className="text-accent" />
                        <span className="text-xs font-bold hidden sm:inline">{t.manageSubscription}</span>
                    </button>
                    {/* ... Profile Info ... */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent p-1 relative">
                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                                {user.profile_image_url ? (
                                    <img src={user.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-2xl font-bold text-white shadow-lg">{user.nickname?.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {user.nickname}
                            </h2>
                            {/* Account Display */}
                            <div className="flex flex-col text-sm text-slate-400 mt-1">
                                <span>{user.email}</span>
                                <span className="text-xs text-slate-500 mt-0.5">{user.age} years · {user.gender}</span>
                            </div>
                        </div>
                    </div>

                    {/* Category Selector */}
                    <div className="relative mb-6 z-10">
                        {/* Label + Status Toggle Row */}
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">{t.focusArea}</label>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => { setGoalViewMode('active'); setCompletedEditMode(false); setSelectedCompletedGoal(null); }}
                                    className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${goalViewMode === 'active'
                                        ? 'bg-primary text-black border-primary'
                                        : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30'
                                        }`}
                                >
                                    진행중인 미션
                                </button>
                                <button
                                    onClick={() => { setGoalViewMode('completed'); setIsEditing(false); }}
                                    className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${goalViewMode === 'completed'
                                        ? 'bg-secondary text-white border-secondary'
                                        : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30'
                                        }`}
                                >
                                    완료된 미션 {completedGoals.length > 0 ? `(${completedGoals.length})` : ''}
                                </button>
                            </div>
                        </div>

                        {/* Dropdown - Active Mode */}
                        {goalViewMode === 'active' && (
                            <div className="relative">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value as GoalCategory)}
                                    className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary font-bold capitalize"
                                >
                                    {Object.keys(goals).map(cat => {
                                        const g = goals[cat as GoalCategory];
                                        const has = hasGoal(cat as GoalCategory);
                                        const seqLabel = (has && g.seq && g.seq > 1) ? ` (${t.challengeCount.replace('{n}', String(g.seq))})` : '';
                                        const isExpired = has ? isGoalItemExpired(g) : false;
                                        const prefix = has ? (isExpired ? '⏰ ' : '✔ ') : '';

                                        return (
                                            <option key={cat} value={cat} className="bg-slate-800 text-white capitalize">
                                                {prefix + `[${cat.charAt(0).toUpperCase() + cat.slice(1)}] ` + t[cat as GoalCategory] + seqLabel + (isExpired ? ` - ${t.expired || 'Expired'}` : '')}
                                            </option>
                                        );
                                    })}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                            </div>
                        )}

                        {/* Dropdown - Completed Mode */}
                        {goalViewMode === 'completed' && (
                            <div>
                                {/* Edit Mode Toggle */}
                                <div className="flex justify-end mb-2">
                                    <button
                                        onClick={() => setCompletedEditMode(!completedEditMode)}
                                        className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${completedEditMode
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            : 'bg-white/10 text-slate-400 hover:bg-white/20'
                                            }`}
                                    >
                                        <Pencil size={10} />
                                        {completedEditMode ? '완료' : '수정'}
                                    </button>
                                </div>

                                {completedGoals.length === 0 ? (
                                    <div className="text-center py-6 text-slate-500 text-sm">
                                        완료된 미션이 없습니다.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                                        {completedGoals.map((cg: any) => {
                                            const catLabel = t[cg.category as GoalCategory] || cg.category;
                                            const startDate = cg.created_at ? new Date(cg.created_at).toLocaleDateString() : '';
                                            const isSelected = selectedCompletedGoal?.id === cg.id;
                                            const isDeleting = deletingGoalId === cg.id;

                                            return (
                                                <motion.div
                                                    key={cg.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${isSelected
                                                        ? 'bg-secondary/10 border-secondary/30'
                                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                        } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                                                    onClick={() => !completedEditMode && setSelectedCompletedGoal(cg)}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase bg-white/5 px-1.5 py-0.5 rounded">
                                                                {cg.category}
                                                            </span>
                                                            {cg.seq && cg.seq > 1 && (
                                                                <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                                                    #{cg.seq}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm font-bold text-white truncate">
                                                            {cg.target_text || catLabel}
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                                            {startDate} ~ | {catLabel}
                                                        </p>
                                                    </div>

                                                    {completedEditMode ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteCompletedGoal(cg); }}
                                                            disabled={isDeleting}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-[10px] font-bold transition-all shrink-0"
                                                        >
                                                            <Trash2 size={12} />
                                                            {isDeleting ? '삭제중...' : '삭제'}
                                                        </button>
                                                    ) : (
                                                        <ChevronRight size={16} className="text-slate-500 shrink-0" />
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Dynamic Form Area - Show in active mode, OR when a completed goal is selected */}
                    {(goalViewMode === 'active' || selectedCompletedGoal) && (
                        <div className="bg-black/20 rounded-2xl p-3 border border-white/5 relative overflow-hidden">
                            {/* Lock Overlay */}
                            {!isCategoryUnlocked(selectedCategory) && (
                                <div className="absolute inset-0 z-20 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
                                    <Lock size={48} className="text-slate-500 mb-4" />
                                    <h3 className="text-xl font-bold text-white mb-2">{t[selectedCategory as GoalCategory]} {t.locked}</h3>
                                    <p className="text-sm text-slate-400 mb-6 max-w-xs">{t.subscribeToUnlock || "Subscribe to unlock this mission category and start your journey."}</p>
                                    <button
                                        onClick={() => setIsSubManagerOpen(true)}
                                        className="bg-accent text-black font-bold py-3 px-8 rounded-xl hover:bg-accent/90 transition-colors flex items-center gap-2 mb-3"
                                    >
                                        <Sparkles size={18} />
                                        {t.unlockNow || "Unlock Now"}
                                    </button>
                                    {/* Allow Deletion even if Locked */}
                                    <button
                                        onClick={handleDeleteGoal}
                                        className="text-xs text-red-500 font-bold hover:text-red-400 transition-colors flex items-center gap-1 opacity-80 hover:opacity-100"
                                    >
                                        <Trash2 size={14} />
                                        {t.deletePlan || "Delete Plan"}
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold capitalize text-primary flex items-center gap-2">
                                    {t[selectedCategory as GoalCategory]} {t.plan}
                                    {/* Show next seq (#3) if expired and editing, else show current seq */}
                                    {isEditing && isGoalExpired() ? (
                                        <span className="text-[10px] bg-accent/20 px-2 py-0.5 rounded-full text-accent">#{(currentGoal.seq || 1) + 1}</span>
                                    ) : currentGoal.seq && currentGoal.seq > 1 && (
                                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white">#{currentGoal.seq}</span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {currentGoal.created_at && !isGoalExpired() && (
                                        <span className="text-[10px] text-slate-500">
                                            {t.started}: {new Date(currentGoal.created_at).toLocaleDateString()}
                                        </span>
                                    )}
                                    {isGoalExpired() && (
                                        <span className="text-[10px] text-amber-400 font-bold">
                                            ⏰ {t.expired || 'Expired'}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => {
                                            const willEdit = !isEditing;
                                            setIsEditing(willEdit);
                                            // If entering edit mode on expired goal, reset form for new challenge
                                            if (willEdit && isGoalExpired()) {
                                                setGoals(prev => ({
                                                    ...prev,
                                                    [selectedCategory]: {
                                                        ...INITIAL_GOALS[selectedCategory as GoalCategory],
                                                        seq: (currentGoal.seq || 1) + 1, // Increment sequence
                                                        category: selectedCategory,
                                                    }
                                                }));
                                            }
                                        }}
                                        className={`text-xs px-2 py-1 rounded-lg transition-colors font-bold ${isEditing ? 'bg-primary text-black' : 'text-primary hover:bg-primary/10'}`}
                                    >
                                        {isEditing ? t.editing : t.viewOnly}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* Main Goal Input */}
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">{t.mainGoal}</label>
                                    <textarea
                                        disabled={!isEditing}
                                        value={currentGoal.target_text}
                                        onChange={e => updateGoal('target_text', e.target.value)}
                                        placeholder={
                                            selectedCategory === 'mind_connection'
                                                ? "무엇을 이루고 싶으신가요?\n예: 우울감 극복, 자존감 회복, 부모님과 가까워지기 등"
                                                : selectedCategory === 'growth_career'
                                                    ? "이루고 싶은 성장은 무엇인가요?\n예: 영어 회화 마스터, 승진, 자격증 취득 등"
                                                    : selectedCategory === 'body_wellness'
                                                        ? "무엇을 이루고 싶으신가요?\n예: 5kg 감량, 규칙적인 생활 습관 만들기 등"
                                                        : t.whatToAchieve
                                        }
                                        className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 transition-all resize-none h-12"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div>
                                            <label className="text-xs text-slate-400 block mb-1">{t.duration}</label>
                                            <select
                                                disabled={!isEditing}
                                                value={currentGoal.duration_months}
                                                onChange={e => updateGoal('duration_months', Number(e.target.value))}
                                                className="w-full bg-white/5 rounded-lg px-2 py-2 text-xs focus:ring-1 focus:ring-primary outline-none disabled:opacity-50"
                                            >
                                                <option value={0.25} className="bg-slate-800 text-white">{t.oneWeek}</option>
                                                <option value={0.5} className="bg-slate-800 text-white">{t.twoWeeks}</option>
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                    <option key={m} value={m} className="bg-slate-800 text-white">{m} {m > 1 ? t.months : t.month}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Details Section */}
                                <div className="pt-4 border-t border-white/5 space-y-4">
                                    {/* ... Reusing previous logic, simplified for brevity but fully functional ... */}
                                    {selectedCategory === 'body_wellness' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-slate-400 block mb-1">{t.currentStatusGoal}</label>
                                                <textarea
                                                    disabled={!isEditing}
                                                    value={currentGoal.details.current_status || ''}
                                                    onChange={e => updateGoal('current_status', e.target.value, true)}
                                                    placeholder={t.healthPlaceholder}
                                                    className="w-full h-12 bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50 resize-none"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">{t.height}</label>
                                                    <input type="number" disabled={!isEditing} value={currentGoal.details.height || ''} onChange={e => updateGoal('height', e.target.value, true)} className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">{t.weight}</label>
                                                    <input type="number" disabled={!isEditing} value={currentGoal.details.weight || ''} onChange={e => updateGoal('weight', e.target.value, true)} className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400 block mb-1">{t.hobby}</label>
                                                <textarea
                                                    disabled={!isEditing}
                                                    value={currentGoal.details.hobby || ''}
                                                    onChange={e => updateGoal('hobby', e.target.value, true)}
                                                    placeholder="취미나 루틴을 입력해주세요."
                                                    className="w-full h-12 bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50 resize-none"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {selectedCategory === 'growth_career' && (
                                        <div className="space-y-2">
                                            <input type="text" disabled={!isEditing} value={currentGoal.details.topic || ''} onChange={e => updateGoal('topic', e.target.value, true)} placeholder={t.growthTopic} className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50" />
                                            <input type="text" disabled={!isEditing} value={currentGoal.details.current_level || ''} onChange={e => updateGoal('current_level', e.target.value, true)} placeholder={t.currentLevel} className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50" />
                                            <input type="text" disabled={!isEditing} value={currentGoal.details.target_level || ''} onChange={e => updateGoal('target_level', e.target.value, true)} placeholder={t.targetLevel} className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50" />
                                        </div>
                                    )}

                                    {selectedCategory === 'mind_connection' && (
                                        <div className="space-y-2">
                                            <input type="text" disabled={!isEditing} value={currentGoal.details.current_mood || ''} onChange={e => updateGoal('current_mood', e.target.value, true)} placeholder={t.currentMood} className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50" />
                                            <textarea
                                                disabled={!isEditing}
                                                value={currentGoal.details.affirmation || ''}
                                                onChange={e => updateGoal('affirmation', e.target.value, true)}
                                                placeholder={"나에게 해줄 말 (확언)"}
                                                className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50 resize-none h-12"
                                            />
                                            <input type="text" disabled={!isEditing} value={currentGoal.details.people || ''} onChange={e => updateGoal('people', e.target.value, true)} placeholder={t.socialActivity} className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50" />
                                        </div>
                                    )}

                                    {selectedCategory === 'funplay' && (
                                        <div className="space-y-3">
                                            <div className="p-3 bg-accent/10 rounded-xl border border-accent/20">
                                                <p className="text-xs text-accent font-bold mb-1">FunPlay Mode</p>
                                                <p className="text-[10px] text-slate-300">30초 안에 실행할 수 있는 미션 게임! 지금 바로 시작해보세요.</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">{t.funplayDifficulty}</label>
                                                    <select
                                                        disabled={!isEditing}
                                                        value={currentGoal.details.difficulty}
                                                        onChange={e => updateGoal('difficulty', e.target.value, true)}
                                                        className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50"
                                                    >
                                                        <option value="easy" className="bg-slate-800">{t.funplayEasy}</option>
                                                        <option value="normal" className="bg-slate-800">{t.funplayNormal}</option>
                                                        <option value="hard" className="bg-slate-800">{t.funplayHard}</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">{t.funplayMood}</label>
                                                    <select
                                                        disabled={!isEditing}
                                                        value={currentGoal.details.mood}
                                                        onChange={e => updateGoal('mood', e.target.value, true)}
                                                        className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs outline-none disabled:opacity-50"
                                                    >
                                                        <option value="fun" className="bg-slate-800">{t.funplayFun}</option>
                                                        <option value="calm" className="bg-slate-800">{t.funplayCalm}</option>
                                                        <option value="focus" className="bg-slate-800">{t.funplayFocus}</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div >
                    )}
                </div >

                {isEditing && (
                    <div className="space-y-4 mb-10">
                        {isGoalExpired() ? (
                            <button
                                onClick={() => handleSaveMainGoal(true)}
                                disabled={loading}
                                className="w-full bg-accent text-black font-bold py-4 rounded-2xl shadow-lg hover:bg-accent/90 transition-all flex items-center justify-center gap-2"
                            >
                                <Sparkles size={20} />
                                Start Challenge #{(currentGoal.seq || 1) + 1}
                            </button>
                        ) : (
                            <button
                                onClick={() => handleSaveMainGoal(false)}
                                disabled={loading}
                                className="w-full bg-primary text-black font-bold py-4 rounded-2xl shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                            >
                                <Save size={20} />
                                {loading ? t.saving : t.saveDesign}
                            </button>
                        )}

                        {currentGoal.id && (
                            <button
                                onClick={handleDeleteGoal}
                                disabled={loading}
                                className="w-full bg-red-500/10 text-red-500 font-bold py-3 rounded-2xl hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 size={20} />
                                {t.deletePlan}
                            </button>
                        )}
                    </div>
                )
                }
            </div>

            {/* SETTINGS MODAL */}
            <AnimatePresence>
                {isSubManagerOpen && (
                    <SubscriptionManager
                        onClose={() => setIsSubManagerOpen(false)}
                        initialCategory={selectedCategory}
                    />
                )}
                {isSettingsOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl my-auto max-h-[85vh] flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Settings size={20} className="text-primary" /> {t.accountSettings}
                                </h2>
                                <button onClick={() => setIsSettingsOpen(false)} className="bg-white/10 p-2 rounded-full text-white hover:bg-white/20">
                                    <X size={20} />
                                </button>
                            </div>


                            {/* Profile Image & Language Selector Row */}
                            <div className="flex items-center mb-1 relative">
                                {/* Left: Language Selector */}
                                <div className="absolute left-0 top-0 flex flex-col items-start pt-2 z-10">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                        <Globe size={14} /> {t.language || "Language"}
                                    </label>
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value as any)}
                                        className="w-28 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary appearance-none cursor-pointer hover:bg-white/10 transition-colors"
                                    >
                                        <option value="ko" className="bg-slate-800">한국어</option>
                                        <option value="en" className="bg-slate-800">English</option>
                                        <option value="ja" className="bg-slate-800">日本語</option>
                                        <option value="zh" className="bg-slate-800">中文</option>
                                        <option value="es" className="bg-slate-800">Español</option>
                                        <option value="fr" className="bg-slate-800">Français</option>
                                        <option value="de" className="bg-slate-800">Deutsch</option>
                                        <option value="ru" className="bg-slate-800">Русский</option>
                                    </select>
                                </div>

                                {/* Center: Profile Image */}
                                <div className="w-full flex justify-center">
                                    <div className="flex flex-col items-center">
                                        <div className="relative w-24 h-24 rounded-full bg-slate-800 border-2 border-white/10 group cursor-pointer overflow-hidden shadow-2xl shadow-black/50">
                                            {user?.profile_image_url ? (
                                                <img src={user.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                    <span className="text-3xl font-bold text-slate-700">{user?.nickname?.charAt(0).toUpperCase()}</span>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Camera size={24} className="text-white" />
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={handleProfileImageUpload}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-2 font-medium">Change Photo</p>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto pr-1 -mr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                                <div className="space-y-4 pt-4 pb-20">
                                    {/* Login Info */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1">{t.loginId}</label>
                                        <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                                            {settingsData.isPhoneAuth ? <Phone size={16} className="text-slate-400" /> : <Mail size={16} className="text-slate-400" />}
                                            <div>
                                                <p className="font-mono text-sm text-white font-bold">{settingsData.loginId}</p>
                                                <p className="text-[10px] text-slate-500">{settingsData.isPhoneAuth ? (t.phone + ' ' + t.verify) : t.emailAuth}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Personal Info (Compact Grid) */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1">{t.fullName}</label>
                                            <input
                                                type="text"
                                                value={settingsData.fullName}
                                                onChange={e => setSettingsData({ ...settingsData, fullName: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1">{t.nickname}</label>
                                            <input
                                                type="text"
                                                value={settingsData.nickname}
                                                onChange={e => setSettingsData({ ...settingsData, nickname: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1">{t.age}</label>
                                            <input
                                                type="number"
                                                value={settingsData.age}
                                                onChange={e => setSettingsData({ ...settingsData, age: Number(e.target.value) })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1">{t.gender}</label>
                                            <select
                                                value={settingsData.gender}
                                                onChange={e => setSettingsData({ ...settingsData, gender: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary appearance-none"
                                            >
                                                <option value="male" className="bg-slate-800">Male</option>
                                                <option value="female" className="bg-slate-800">Female</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Daily Notification */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1">{t.dailyNotification}</label>
                                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                            <Bell size={16} className="text-primary" />
                                            <div className="flex-1">
                                                <p className="font-bold text-white text-sm">{t.notificationTime}</p>
                                            </div>
                                            <input
                                                type="time"
                                                value={notificationTime}
                                                onChange={(e) => setNotificationTime(e.target.value)}
                                                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <button
                                            onClick={async () => {
                                                const success = await notificationManager.scheduleDailyNotification(
                                                    new Date().getHours(),
                                                    new Date().getMinutes() + 1
                                                );
                                                if (success) alert('Test notification scheduled for 1 minute from now!');
                                            }}
                                            className="text-[10px] text-slate-500 mt-1 hover:text-white underline"
                                        >
                                            {t.testNotification} (Set 1 min later)
                                        </button>
                                    </div>

                                    <div className="h-px bg-white/10 my-1" />

                                    {/* Backup Contact */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1">
                                            {settingsData.isPhoneAuth ? t.backupEmail : t.backupPhone}
                                        </label>
                                        <div className="relative">
                                            {settingsData.isPhoneAuth ? (
                                                <>
                                                    <input
                                                        type="email"
                                                        value={settingsData.backupEmail}
                                                        onChange={e => setSettingsData({ ...settingsData, backupEmail: e.target.value })}
                                                        placeholder={t.addRecoveryEmail}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                                    />
                                                    <Mail size={14} className="absolute left-3 top-2.5 text-slate-500" />
                                                </>
                                            ) : (
                                                <>
                                                    <input
                                                        type="tel"
                                                        value={settingsData.backupPhone}
                                                        onChange={e => setSettingsData({ ...settingsData, backupPhone: e.target.value })}
                                                        placeholder={t.addRecoveryPhone}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                                    />
                                                    <Phone size={14} className="absolute left-3 top-2.5 text-slate-500" />
                                                </>
                                            )}
                                        </div>
                                    </div>



                                    <button
                                        onClick={handleSaveSettings}
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-2 rounded-xl shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98] mt-1 text-sm"
                                    >
                                        {loading ? t.saving : t.saveChanges}
                                    </button>

                                    <div className="h-px bg-white/10 my-1" />

                                    {/* Security Section */}
                                    <div>
                                        <button
                                            onClick={() => setIsPasswordExpanded(!isPasswordExpanded)}
                                            className="w-full flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Lock size={16} className="text-slate-400" />
                                                <span className="font-bold text-slate-300 text-xs">{t.security} / {t.password}</span>
                                            </div>
                                            <ChevronRight size={16} className={`text-slate-500 transition-transform ${isPasswordExpanded ? 'rotate-90' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {isPasswordExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden bg-black/20 rounded-xl"
                                                >
                                                    <div className="p-4 space-y-3">
                                                        <h3 className="text-sm font-bold text-white mb-2">{t.changePassword}</h3>
                                                        <input
                                                            type="password"
                                                            placeholder={t.currentPassword}
                                                            value={passwordData.current}
                                                            onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                                        />
                                                        <input
                                                            type="password"
                                                            placeholder={t.newPassword}
                                                            value={passwordData.new}
                                                            onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                                        />
                                                        <input
                                                            type="password"
                                                            placeholder={t.confirmNewPassword}
                                                            value={passwordData.confirm}
                                                            onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                                        />
                                                        <button
                                                            onClick={handlePasswordUpdate}
                                                            disabled={loading}
                                                            className="w-full bg-white/10 text-white font-bold py-3 rounded-lg hover:bg-white/20 transition-all text-sm"
                                                        >
                                                            {t.updatePassword}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}

                                        </AnimatePresence>
                                    </div>

                                    <div className="h-px bg-white/10 my-1" />

                                    {/* Dang Zone (Delete Account) */}
                                    <div>
                                        {!showDeleteVerify ? (
                                            <button
                                                onClick={() => {
                                                    setShowDeleteVerify(true);
                                                    handleSendDeleteVerification();
                                                }}
                                                className="w-full flex items-center justify-between p-2.5 bg-red-500/10 rounded-xl border border-red-500/10 hover:bg-red-500/20 transition-colors text-red-500"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Trash2 size={16} />
                                                    <span className="font-bold text-xs">{t.deleteAccount}</span>
                                                </div>
                                            </button>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-3"
                                            >
                                                <div className="flex justify-between items-center text-red-500 mb-2">
                                                    <span className="text-sm font-bold flex items-center gap-2">
                                                        <Lock size={14} />
                                                        {t.verifyIdentity}
                                                    </span>
                                                    <button onClick={() => setShowDeleteVerify(false)} className="bg-red-500/10 p-1 rounded-full hover:bg-red-500/20"><X size={14} /></button>
                                                </div>

                                                <p className="text-xs text-slate-400">
                                                    {t.verificationRequired}
                                                </p>

                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={verifyCodeInput}
                                                        onChange={(e) => setVerifyCodeInput(e.target.value)}
                                                        placeholder={t.verifyCode}
                                                        className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 text-center tracking-widest"
                                                        maxLength={6}
                                                    />
                                                    <button
                                                        onClick={handleVerifyAndDelete}
                                                        disabled={verifyLoading || verifyCodeInput.length < 6}
                                                        className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-600 disabled:opacity-50"
                                                    >
                                                        {verifyLoading ? "..." : t.verifyAuth}
                                                    </button>
                                                </div>
                                                {verifyTimer > 0 && (
                                                    <p className="text-xs text-center text-slate-500">
                                                        Resend in {verifyTimer}s
                                                    </p>
                                                )}
                                            </motion.div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Requests Modal */}
            <AnimatePresence>
                {showRequestsModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowRequestsModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <Bell size={18} className="text-yellow-400" />
                                    {t.accessRequests}
                                </h3>
                                <button onClick={() => setShowRequestsModal(false)} className="text-slate-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-6">
                                {/* Pending Requests Section */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        {t.pending}
                                    </h4>
                                    {incomingRequests.filter(r => r.status === 'pending').length === 0 ? (
                                        <p className="text-xs text-slate-600 text-center py-2">{t.noPendingRequests}</p>
                                    ) : (
                                        incomingRequests.filter(r => r.status === 'pending').map(req => (
                                            <div key={req.id} className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-white">
                                                            {req.requester?.nickname || t.unknownUser}
                                                        </p>
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            {t.wantsToViewHistory.replace('{category}', t[req.goal?.category as keyof typeof t] || req.goal?.category)}
                                                            {req.goal?.seq && req.goal?.seq > 1 && <span className="text-primary ml-1">#{req.goal.seq}</span>}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] text-slate-500">
                                                        {new Date(req.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleApproveRequest(req.id)}
                                                        disabled={approvingIds.has(req.id)}
                                                        className={`flex-1 text-xs font-bold py-2 rounded-xl transition-colors ${approvingIds.has(req.id)
                                                            ? "bg-green-500 text-white cursor-default"
                                                            : "bg-primary text-black hover:bg-primary/90"
                                                            }`}
                                                    >
                                                        {approvingIds.has(req.id) ? t.approved : t.approve}
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectRequest(req.id)}
                                                        className="flex-1 bg-white/5 text-slate-400 text-xs font-bold py-2 rounded-xl hover:bg-white/10 transition-colors"
                                                    >
                                                        {t.reject}
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Active (Approved) Access Section */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        {t.activeAccess}
                                    </h4>
                                    {incomingRequests.filter(r => r.status === 'approved').length === 0 ? (
                                        <p className="text-xs text-slate-600 text-center py-2">{t.noActiveAccess}</p>
                                    ) : (
                                        incomingRequests.filter(r => r.status === 'approved').map(req => (
                                            <div key={req.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 opacity-80">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div>
                                                        <p className="text-sm font-bold text-white">
                                                            {req.requester?.nickname || t.unknownUser}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">
                                                            {t[req.goal?.category as keyof typeof t] || req.goal?.category}
                                                            {req.goal?.seq && req.goal?.seq > 1 && <span className="ml-1">#{req.goal.seq}</span>}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRejectRequest(req.id)}
                                                        className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 bg-red-500/10 rounded-lg transition-colors border border-red-500/20"
                                                    >
                                                        {t.revoke}
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isSubManagerOpen && <SubscriptionManager onClose={() => setIsSubManagerOpen(false)} initialCategory={selectedCategory} />}
            </AnimatePresence>
        </div >
    );
}
