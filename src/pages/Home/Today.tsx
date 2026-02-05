import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { generateMissions, generateFunPlayMission } from '../../lib/openai';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, Flame, Sparkles, Camera, PenTool, Mic, Video, X, ListTodo, ArrowRight, Lightbulb, BarChart, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '../../lib/i18n';
import Paywall from './Paywall';
import PaywallWarning from './PaywallWarning';
import AdWarning from './AdWarning';
import RewardAd from '../../components/ads/RewardAd';

export default function Today() {
    const { user, missions, setMissions } = useStore();
    const { language, t } = useLanguage();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // Upload/Verify State
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [verifyMode, setVerifyMode] = useState<'media' | 'text'>('media');
    const [textInput, setTextInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helpers: Consistent Local Date String
    const formatLocalYMD = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // New State
    // Default to Today in local time
    const [selectedDate, setSelectedDate] = useState<string>(formatLocalYMD(new Date()));

    const [userGoals, setUserGoals] = useState<any[]>([]);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [draftMissions, setDraftMissions] = useState<any[]>([]);
    const [refreshCount, setRefreshCount] = useState(0);
    const [showChallengeComplete, setShowChallengeComplete] = useState(false);

    // Derived State
    const selectedGoal = userGoals.find(g => g.id === selectedGoalId);

    // Initial Fetch
    useEffect(() => {
        if (user) initData();
    }, [user]);

    // Rerun fetch when Date or Goal changes
    useEffect(() => {
        if (user && selectedGoalId) {
            // Load refresh count from local storage
            const key = `refresh_${user.id}_${selectedGoalId}_${selectedDate}`;
            const saved = localStorage.getItem(key);
            setRefreshCount(saved ? parseInt(saved) : 0);

            // Check Ad Cooldown (1 Hour)
            const adKey = `ad_unlocked_${user.id}_${selectedGoalId}_${selectedDate}`;
            const adTimestamp = localStorage.getItem(adKey);
            if (adTimestamp) {
                const diff = Date.now() - parseInt(adTimestamp);
                if (diff < 60 * 60 * 1000) { // 1 Hour
                    setIsAdUnlocked(true);
                } else {
                    setIsAdUnlocked(false);
                }
            } else {
                setIsAdUnlocked(false);
            }

            fetchMissions();
        }
    }, [selectedDate, selectedGoalId]);

    const initData = async () => {
        setLoading(true);

        // Allow specific reviewer account to see demo data for AdSense/AppStore review
        const isDemoOrReviewer = user?.id === 'demo123' || user?.email === 'reviewer@coreloop.com';

        if (isDemoOrReviewer) {
            // Mock Goals for Demo User
            const mockGoals = [
                { id: 'demo-body', user_id: 'demo123', category: 'body_wellness', seq: 1, target_text: 'Healthy Body', created_at: new Date().toISOString() },
                { id: 'demo-growth', user_id: 'demo123', category: 'growth_career', seq: 1, target_text: 'Career Growth', created_at: new Date().toISOString() }
            ];
            setUserGoals(mockGoals);
            setSelectedGoalId(mockGoals[0].id);
            setLoading(false);
            return;
        }

        // 1. Fetch Goals
        const { data: goals } = await supabase
            .from('user_goals')
            .select('*')
            .eq('user_id', user!.id)
            .order('seq', { ascending: false });

        if (!goals || goals.length === 0) {
            setLoading(false);
            return;
        }

        // Filter out completed goals (Handle NULL as active)
        const rawActiveGoals = goals.filter(g => g.is_completed !== true);

        if (rawActiveGoals.length === 0) {
            setUserGoals([]);
            setLoading(false);
            return;
        }

        // 🚨 Filter: Keep ONLY the latest goal (highest seq) per category
        const latestGoalsMap = new Map();
        rawActiveGoals.forEach(g => {
            const existing = latestGoalsMap.get(g.category);
            // If new one has higher seq, replace. If same seq (shouldn't happen often), use created_at
            if (!existing || g.seq > existing.seq || (g.seq === existing.seq && new Date(g.created_at) > new Date(existing.created_at))) {
                latestGoalsMap.set(g.category, g);
            }
        });

        // Convert map back to array
        const activeGoals = Array.from(latestGoalsMap.values());

        // 2. Fetch Active Subscriptions to Prioritize
        const { data: subs } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user!.id)
            .eq('status', 'active')
            .gte('end_date', new Date().toISOString());

        // Sort Goals: Subscribed (Active) First, then by Seq
        const sortedGoals = [...activeGoals].sort((a, b) => {
            const isASub = subs?.some(s => s.type === 'all' || (s.type === 'mission' && s.target_id === a.category));
            const isBSub = subs?.some(s => s.type === 'all' || (s.type === 'mission' && s.target_id === b.category));

            if (isASub && !isBSub) return -1;
            if (!isASub && isBSub) return 1;
            return b.seq - a.seq; // Fallback to original seq order
        });

        setUserGoals(sortedGoals);
        // Default select the first one (which should be a subscribed one if exists)
        if (sortedGoals.length > 0) {
            const currentIsValid = selectedGoalId && sortedGoals.find(g => g.id === selectedGoalId);
            if (!currentIsValid) {
                setSelectedGoalId(sortedGoals[0].id);
            }
        }
        setLoading(false);
    };

    const fetchMissions = async () => {
        if (!selectedGoalId) return;

        try {
            setLoading(true);
            setDraftMissions([]);
            setVerifyingId(null); // Clear any active verification

            // Demo User Mock Missions
            const isDemoOrReviewer = user?.id === 'demo123' || user?.email === 'reviewer@coreloop.com';

            if (isDemoOrReviewer) {
                const today = formatLocalYMD(new Date());
                if (selectedDate === today && selectedGoal?.category === 'body_wellness') {
                    const mockMissions = [
                        {
                            id: 'demo-m1', user_id: 'demo123', category: 'body_wellness',
                            content: language === 'ko' ? '물 2L 마시기' : 'Drink 2L Water',
                            is_completed: false, date: today, verification_type: 'image'
                        }
                    ];
                    setMissions(mockMissions);
                } else {
                    setMissions([]);
                    // Allow generating drafts for Demo
                    if (selectedDate >= today) {
                        await generateDraftPlan();
                    }
                }
                return;
            }

            // Note: 'date' column in DB is likely type DATE or TEXT (YYYY-MM-DD). 
            // Passing the local YYYY-MM-DD string is correct for matching.
            const { data: existing, error: fetchError } = await supabase
                .from('missions')
                .select('*')
                .eq('user_id', user!.id)
                .eq('date', selectedDate)
                .order('created_at');

            if (fetchError) throw fetchError;

            // Filter by category and SEQUENCE client-side to ensure match
            const goalCategory = selectedGoal?.category.toLowerCase();
            const goalSeq = selectedGoal?.seq || 1;
            // const isVirtual = selectedGoalId === 'funplay-virtual'; // Removed

            const relevantMissions = existing?.filter(m =>
                m.category.toLowerCase() === goalCategory &&
                (m.seq === goalSeq || (!m.seq && goalSeq === 1)) // Handle legacy data (null seq = 1)
            ) || [];

            // 🚨 Auto-Correct Virtual Goal Sequence REMOVED

            if (relevantMissions.length > 0) {
                // Logic for Mission Counts based on Trial Phase
                // Funplay or Subscribed: 3 Missions
                // Phase 1, 2: 3 Missions
                // Phase 3: 1 Mission
                // Phase 4: 0 Mission (Locked by Paywall view, but if bypassed, limit to 0 or 1?)
                const isFunplay = selectedGoal?.category === 'funplay';

                let limit = 3;
                if (!isFunplay && !hasActiveSubscription && trialPhase === 3) {
                    limit = 1;
                }

                // FILTER LOGIC:
                // ALWAYS show missions that are already COMPLETED, regardless of limit.
                // THEN fill remaining slots with incomplete missions up to limit.

                // 1. Separate completed and incomplete
                const completedMissions = relevantMissions.filter(m => m.is_completed);
                const incompleteMissions = relevantMissions.filter(m => !m.is_completed);

                const showList = [...completedMissions];
                const remainingSlots = Math.max(0, limit - showList.length);

                if (remainingSlots > 0) {
                    showList.push(...incompleteMissions.slice(0, remainingSlots));
                }

                // Sort by seq or created_at to maintain order? created_at usually.
                showList.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                setMissions(showList);
            } else {
                setMissions([]);
                // Logic for Draft Generation:
                const today = formatLocalYMD(new Date());
                // Allow generation if selected date is Today or Future
                if (selectedDate >= today) {
                    await generateDraftPlan();
                }
            }
        } catch (err) {
            console.error("fetchMissions Error:", err);
            // Ensure we don't end up in infinite loading. 
            // Potentially Set empty missions so user sees Empty State?
            setMissions([]);
        } finally {
            setLoading(false);
        }
    };

    const generateDraftPlan = async () => {
        // 1. Fetch recent missions for exclusion logic
        let exclusionList: string[] = [];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysStr = formatLocalYMD(sevenDaysAgo);

        const { data: recentMissions } = await supabase
            .from('missions')
            .select('category, content')
            .eq('user_id', user!.id)
            .gte('date', sevenDaysStr);

        if (recentMissions) {
            const exceptions = ['body_wellness']; // Daily routines might repeat
            exclusionList = recentMissions
                .filter(m => !exceptions.includes(m.category.toLowerCase()))
                .map(m => m.content);
        }

        let newMissions: any[] = [];

        // BRANCH: FunPlay Logic
        if (selectedGoal?.category === 'funplay') {
            // Generate 1 Mission for FunPlay
            const details = selectedGoal.details || {};
            const funplayMission = await generateFunPlayMission(
                user,
                language,
                exclusionList,
                {
                    difficulty: details.difficulty || 'easy',
                    time_limit: details.time_limit || 30,
                    mood: details.mood || 'fun',
                    place: 'unknown'
                }
            );
            // Wrap in array
            newMissions = [funplayMission];

        } else {
            // Standard Generation (3 Missions)
            newMissions = await generateMissions(user, language, exclusionList, selectedGoal);

            // Filter for CURRENT selected category just in case AI returns mixed
            const currentCategoryMissions = newMissions.filter(m => m.category.toLowerCase() === selectedGoal?.category.toLowerCase());

            // Phase 3 Limit check involved here too
            let limit = 3;
            // Note: trialPhase state is available here
            if (!hasActiveSubscription && trialPhase === 3) {
                limit = 1;
            }

            newMissions = currentCategoryMissions.slice(0, limit);
        }

        const mapped = newMissions.map((m: any, i: number) => ({
            id: `draft-${i}`,
            user_id: user!.id,
            content: m.content,
            category: m.category,
            verification_type: m.verification_type || 'checkbox', // Default to checkbox for Re:Play if unspecified
            reasoning: m.reasoning,
            trust_score: m.trust_score,
            date: selectedDate,
            is_completed: false,
            seq: selectedGoal?.seq || 1,
            details: m.details // if AI returns extra details
        }));
        setDraftMissions(mapped);
    };

    const [pendingRefresh, setPendingRefresh] = useState(false);

    const handleRefresh = async () => {
        if (refreshCount >= 3) return;

        // Forced Ad Logic for Refresh (Ignore Free Trial)
        // If not premium/subscribed, MUST watch ad to refresh
        if (user?.subscription_tier !== 'premium' && !hasActiveSubscription) {
            setPendingRefresh(true);
            setShowRewardAd(true);
            return;
        }

        executeRefresh();
    };

    const executeRefresh = async () => {
        setLoading(true);
        await generateDraftPlan();

        const newCount = refreshCount + 1;
        setRefreshCount(newCount);
        const key = `refresh_${user!.id}_${selectedGoalId}_${selectedDate}`;
        localStorage.setItem(key, newCount.toString());
        setLoading(false);
    };

    const confirmPlan = async () => {
        if (user?.id === 'demo123') return alert(t.demoLimit);
        setLoading(true);
        const missionsToInsert = draftMissions.map(({ id, ...rest }) => rest);
        const { data, error } = await supabase.from('missions').insert(missionsToInsert).select();

        if (error) {
            console.error("Mission Insert Error:", error);
            alert(`Failed to save missions: ${error.message}`);
        }

        if (!error && data) {
            setMissions(data);
            setDraftMissions([]);
        }
        setLoading(false);
    };

    // --- Verification Logic ---

    const openVerify = (mission: any) => {
        if (verifyingId === mission.id) {
            setVerifyingId(null); // Toggle off
        } else {
            setVerifyingId(mission.id);
            // Default mode based on mission type
            // If already completed, pre-fill logic
            if (mission.is_completed) {
                setVerifyMode(mission.proof_type === 'text' ? 'text' : 'media');
                if (mission.proof_type === 'text') {
                    setTextInput(mission.proof_text || '');
                }
            } else {
                setVerifyMode(mission.verification_type === 'text' ? 'text' : 'media');
                setTextInput('');
            }
        }
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (user?.id === 'demo123') return alert(t.demoLimit);
        const file = event.target.files?.[0];
        if (!file || !verifyingId) return;

        try {
            // 0. Cleanup old file if exists
            const currentMission = missions.find(m => m.id === verifyingId);
            if (currentMission?.image_url) {
                try {
                    // Extract path from Public URL
                    const urlParts = currentMission.image_url.split('mission-proofs/');
                    if (urlParts.length > 1) {
                        const oldPath = decodeURIComponent(urlParts[1]);
                        console.log("Deleting old proof:", oldPath);
                        await supabase.storage.from('mission-proofs').remove([oldPath]);
                    }
                } catch (delError) {
                    console.error("Failed to delete old proof:", delError);
                }
            }

            const fileName = `${user!.id}/${verifyingId}_${Date.now()}`;
            const { error } = await supabase.storage.from('mission-proofs').upload(fileName, file);
            if (error) throw error;
            const publicUrl = supabase.storage.from('mission-proofs').getPublicUrl(fileName).data.publicUrl;

            // Determine type
            let type = 'image';
            if (file.type.startsWith('video')) type = 'video';
            if (file.type.startsWith('audio')) type = 'audio';

            await supabase.from('missions').update({
                is_completed: true,
                image_url: publicUrl, // Storing Media URL here
                proof_type: type,
                // proof_text: null // ❌ DO NOT CLEAR TEXT
            }).eq('id', verifyingId);

            const updated = missions.map(m => m.id === verifyingId ? {
                ...m,
                is_completed: true,
                image_url: publicUrl,
                proof_type: type
                // proof_text: null
            } : m);
            setMissions(updated);
            // setVerifyingId(null); // Keep open to allow mixed verification if needed, or close? User asked to allow both. Let's keep close for UX consistency, or maybe not? 
            // Actually, if I upload photo, I might want to add text right away. But usually "Upload" is an action. 
            // Let's keep it close for now as per original behavior, user can re-open to add text if they want.
            // Wait, "사진등록 후 텍스트를 입력하면" implies sequential actions.
            setVerifyingId(null);


            const isFinished = checkChallengeCompletion(updated);
            if (isFinished) {
                setShowChallengeComplete(true);
                triggerBigConfetti();
            } else {
                triggerConfetti();
            }
        } catch (err) {
            // @ts-ignore
            alert(`Upload failed: ${err.message}`);
        }
    };

    const handleTextSubmit = async () => {
        if (user?.id === 'demo123') return alert(t.demoLimit);
        if (!textInput.trim() || !verifyingId) return;

        try {
            await supabase.from('missions').update({
                is_completed: true,
                proof_text: textInput,
                proof_type: 'text',
                // image_url: null // ❌ DO NOT CLEAR URL
            }).eq('id', verifyingId);

            const updated = missions.map(m => m.id === verifyingId ? {
                ...m,
                is_completed: true,
                proof_text: textInput,
                proof_type: 'text',
                // image_url: null
            } : m);
            setMissions(updated);
            setVerifyingId(null); // Close verification area on success

            const isFinished = checkChallengeCompletion(updated);
            if (isFinished) {
                setShowChallengeComplete(true);
                triggerBigConfetti();
            } else {
                triggerConfetti();
            }
        } catch (err) {
            console.error(err);
            alert('Failed to save text.');
        }
    };

    const handleDeleteMedia = async () => {
        if (!verifyingId) return;
        const currentMission = missions.find(m => m.id === verifyingId);
        if (!currentMission?.image_url) return;

        if (!window.confirm(t.deleteConfirm || "Delete this image/video?")) return;

        try {
            // 1. Delete from Storage
            const urlParts = currentMission.image_url.split('mission-proofs/');
            if (urlParts.length > 1) {
                const oldPath = decodeURIComponent(urlParts[1]);
                await supabase.storage.from('mission-proofs').remove([oldPath]);
            }

            // 2. Update DB (Clear image_url, reset proof_type if text is present)
            const newProofType = currentMission.proof_text ? 'text' : 'none'; // Or keep 'text' if text exists

            await supabase.from('missions').update({
                image_url: null,
                proof_type: newProofType
            }).eq('id', verifyingId);

            // 3. Update Local State
            const updated = missions.map(m => m.id === verifyingId ? {
                ...m,
                image_url: null,
                proof_type: newProofType
            } : m);
            setMissions(updated);
            // If no text and no image, maybe mark incomplet? No, user manual uncheck required usually, 
            // but if they delete proof, maybe it's still 'done' if they consider it done? 
            // Requirement says: "사진인증 기록은 삭제하지 않는다." -> "인증 수정시 사진 삭제기능 제공"
            // Usually if I delete the ONLY proof, it might revert to incomplete, but let's stick to just deleting the media.

        } catch (err) {
            console.error("Failed to delete media:", err);
            alert("Failed to delete media.");
        }
    };

    const triggerFileClick = () => fileInputRef.current?.click();

    const triggerConfetti = () => {
        confetti({ particleCount: 150, spread: 80, colors: ['#8b5cf6', '#ec4899', '#ffffff'] });
    };

    const triggerBigConfetti = () => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    };

    const checkChallengeCompletion = (currentMissions: any[]) => {
        if (!selectedGoal) return false;

        // 1. Check if it's the LAST DAY
        const durationMonths = selectedGoal.duration_months || 1;
        let totalDays = 0;
        if (durationMonths < 1) {
            totalDays = durationMonths === 0.25 ? 7 : durationMonths === 0.5 ? 14 : Math.round(durationMonths * 30);
        } else {
            totalDays = durationMonths * 30;
        }

        const currentDay = getSelectedDayNum();

        // Allow completion on or after the last day (in case they verify late)
        if (currentDay < totalDays) return false;

        // 2. Check if all missions for today are completed
        const allCompleted = currentMissions.every(m => m.is_completed);

        return allCompleted;
    };

    // --- Date Helpers ---
    const getDateOptions = () => {
        if (!selectedGoal) return [];
        const start = new Date(selectedGoal.created_at);
        start.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const list = [];
        let current = new Date(start);
        let count = 0;
        while (current.getTime() <= tomorrow.getTime() && count < 365) {
            const val = formatLocalYMD(current);
            const diffMs = current.getTime() - start.getTime();
            const dayNum = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

            let label = `${t.day} ${dayNum}`;
            if (current.getTime() === today.getTime()) label += ` (${t.today})`;
            else if (current.getTime() === tomorrow.getTime()) label += ` (${t.tomorrow})`;
            else label += ` (${current.getMonth() + 1}/${current.getDate()})`;

            list.push({ value: val, label });
            current.setDate(current.getDate() + 1);
            count++;
        }
        return list.reverse();
    };

    const dateOptions = getDateOptions();

    const getSelectedDayNum = () => {
        if (!selectedGoal) return 1;
        const start = new Date(selectedGoal.created_at);
        start.setHours(0, 0, 0, 0);
        const [y, m, d] = selectedDate.split('-').map(Number);
        const current = new Date(y, m - 1, d);
        const diffMs = current.getTime() - start.getTime();
        return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
    };

    const isPreview = missions.length === 0 && draftMissions.length > 0;
    const isPastEmpty = missions.length === 0 && draftMissions.length === 0 && selectedDate < formatLocalYMD(new Date());
    const activeList = isPreview ? draftMissions : missions;

    // --- Monetization & 3-Stage Trial Logic ---
    const currentDayNum = getSelectedDayNum();

    // Trial Phases (Days since signup)
    // 0~7: Phase 1 (Free, Unlimited)
    // 8~21: Phase 2 (Value Recognition - Ads for History/Refresh, 3 missions)
    // 22~30: Phase 3 (Decision - 1 Mission Limit, Ads for History/Refresh)
    // 31+: Phase 4 (Paywall Active)

    const [accountAgeDays, setAccountAgeDays] = useState<number>(0);
    const [trialPhase, setTrialPhase] = useState<1 | 2 | 3 | 4>(1);

    const [paywallMode, setPaywallMode] = useState<'subscription' | 'ads'>('subscription');
    const [isAdUnlocked, setIsAdUnlocked] = useState(false); // Session-based Unlock
    const [showRewardAd, setShowRewardAd] = useState(false);
    const [adSlotId, setAdSlotId] = useState<string | undefined>(undefined);
    const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
    const [checkingSubs, setCheckingSubs] = useState(true);

    // Initial Check
    useEffect(() => {
        const checkStatus = async () => {
            setCheckingSubs(true);

            // 1. Calculate Trial Phase (Based on SELECTED GOAL)
            let startDate = new Date();
            if (selectedGoal?.created_at) {
                startDate = new Date(selectedGoal.created_at);
            } else if (user) {
                // Fallback (e.g. no goal selected yet, or loading)
                const { data: profile } = await supabase.from('profiles').select('created_at').eq('id', user.id).single();
                if (profile?.created_at) {
                    startDate = new Date(profile.created_at);
                }
            }

            // Calculate Days
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setAccountAgeDays(diffDays);

            // Determine Phase
            if (diffDays <= 7) setTrialPhase(1);
            else if (diffDays <= 21) setTrialPhase(2);
            else if (diffDays <= 30) setTrialPhase(3);
            else setTrialPhase(4);

            // 2. Fetch Settings
            const { data: slotData } = await supabase.from('admin_settings').select('value').eq('key', 'ad_slot_id').single();
            if (slotData?.value) setAdSlotId(slotData.value);

            const { data: modeData } = await supabase.from('admin_settings').select('value').eq('key', 'paywall_mode').single();
            if (modeData?.value) setPaywallMode(modeData.value as 'subscription' | 'ads');

            // 3. Check Subscription
            if (user) {
                const { data: subData } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'active');

                let hasSub = false;
                if (subData && subData.length > 0) {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);

                    const active = subData.find(s => {
                        const sStart = new Date(s.start_date);
                        sStart.setHours(0, 0, 0, 0);
                        const sEnd = new Date(s.end_date);
                        sEnd.setHours(23, 59, 59, 999);

                        if (sStart > now || sEnd < now) return false;

                        // Check Type/Target
                        if (s.type === 'all') return true;

                        const targetMatch = s.target_id && selectedGoal?.category && s.target_id.toLowerCase() === selectedGoal.category.toLowerCase();
                        return s.type === 'mission' && targetMatch;
                    });

                    if (active) hasSub = true;
                }
                setHasActiveSubscription(hasSub);
            }
            setCheckingSubs(false);
        };
        checkStatus();
    }, [user, selectedGoal?.category]);

    // Paywall Active Condition
    const isFunplay = selectedGoal?.category === 'funplay';
    const hasConfirmedMissions = missions.length > 0;

    const isPaywallActive = !loading && !checkingSubs && !hasActiveSubscription && !isFunplay && trialPhase === 4 && !isAdUnlocked && !hasConfirmedMissions;

    useEffect(() => {
        console.log('[Paywall Debug]', {
            currentDayNum,
            isPaywallActive,
            tier: user?.subscription_tier,
            hasActiveSubscription,
            isAdUnlocked,
            hasConfirmedMissions,
            loading
        });
    }, [currentDayNum, isPaywallActive, user, hasActiveSubscription, isAdUnlocked, hasConfirmedMissions, loading]);

    const [paywallStep, setPaywallStep] = useState<'none' | 'warning' | 'payment'>('none');

    // Reset step when selection changes
    useEffect(() => {
        // Safety: If subscription is active, FORCE close the paywall
        if (hasActiveSubscription) {
            setPaywallStep('none');
        } else if (isPaywallActive) {
            setPaywallStep('warning');
        } else {
            setPaywallStep('none');
        }
    }, [selectedGoalId, isPaywallActive, hasActiveSubscription]);

    const handlePaywallCancel = async () => {
        // Smart Fallback: Find any goal that is currently viewable
        // Viewable = Active Subscription OR Funplay OR (Trial Phase < 4)

        // Since trialPhase is global (based on account age), if it is < 4, actually ALL goals are viewable (except logic phase 4).
        // BUT isPaywallActive is true ONLY if trialPhase === 4.
        // So if we are here, trialPhase IS likely 4 (unless state de-sync).

        // We need to find a goal that has Subscription OR is Funplay.
        setLoading(true);
        const { data: subs } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user!.id)
            .eq('status', 'active')
            .gte('end_date', new Date().toISOString());

        const safeGoal = userGoals.find(g => {
            // 1. Funplay is always safe
            if (g.category === 'funplay') return true;

            // 2. Check Subscription Coverage
            const isSubscribed = subs?.some(s =>
                s.type === 'all' ||
                (s.type === 'mission' && s.target_id === g.category)
            );
            if (isSubscribed) return true;

            return false;
        });

        setLoading(false);

        if (safeGoal && safeGoal.id !== selectedGoalId) {
            setSelectedGoalId(safeGoal.id);
            setPaywallStep('none'); // Ensure paywall closes
        } else {
            // If NO safe goal whatsoever, then we must go to dashboard
            window.location.href = '/dashboard';
        }
    };

    const handleAdReward = () => {
        setIsAdUnlocked(true);
        setShowRewardAd(false);
        setPaywallStep('none');

        // Save Cooldown (1 Hour) - session unlock
        const key = `ad_unlocked_${user!.id}_${selectedGoalId}_${selectedDate}`;
        localStorage.setItem(key, Date.now().toString());

        // EXECUTE PENDING ACTION
        if (pendingRefresh) {
            setPendingRefresh(false);
            executeRefresh();
        }
    };

    return (
        <div className="w-full flex-1 min-h-0 flex flex-col pt-6 pb-32 relative">
            {isPaywallActive && paywallStep === 'warning' && (
                paywallMode === 'ads' ? (
                    <AdWarning
                        currentDay={currentDayNum}
                        onWatchAd={() => setShowRewardAd(true)}
                        onSubscribe={() => setPaywallStep('payment')}
                        onClose={handlePaywallCancel}
                    />
                ) : (
                    <PaywallWarning
                        onConfirm={() => {
                            if (user?.id === 'demo123') return alert(t.demoPaymentLimit);
                            setPaywallStep('payment');
                        }}
                        onCancel={handlePaywallCancel}
                    />
                )
            )}

            <AnimatePresence>
                {showRewardAd && (
                    <RewardAd
                        onReward={handleAdReward}
                        onClose={() => setShowRewardAd(false)}
                        adSlotId={adSlotId}
                    />
                )}
            </AnimatePresence>
            {isPaywallActive && paywallStep === 'payment' && (
                <Paywall onClose={handlePaywallCancel} />
            )}

            {/* Challenge Complete Modal */}
            <AnimatePresence>
                {showChallengeComplete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.5, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center relative overflow-hidden shadow-2xl"
                        >
                            {/* Glow Effect */}
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />

                            <div className="relative z-10">
                                <motion.div
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        rotate: [0, 10, -10, 0]
                                    }}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                    className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg shadow-orange-500/30"
                                >
                                    <Sparkles size={40} className="text-white" />
                                </motion.div>

                                <h2 className="text-3xl font-bold text-white mb-2">Loop Closed!</h2>
                                <p className="text-slate-400 mb-8">
                                    Congratulations! You've successfully completed the <span className="text-primary font-bold">{selectedGoal?.category ? t[selectedGoal.category as keyof typeof t] : 'Challenge'}</span>.
                                </p>

                                <button
                                    onClick={async () => {
                                        if (selectedGoal?.id) {
                                            // 1. Update DB
                                            await supabase
                                                .from('user_goals')
                                                .update({ is_completed: true, completed_at: new Date() })
                                                .eq('id', selectedGoal.id);

                                            // 2. Update Local State (Remove from list immediately)
                                            setUserGoals(prev => prev.filter(g => g.id !== selectedGoal.id));
                                            setSelectedGoalId(null); // Reset selection
                                        }
                                        setShowChallengeComplete(false);
                                    }}
                                    className="w-full py-4 bg-gradient-to-r from-primary to-accent rounded-xl text-black font-bold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
                                >
                                    Awesome!
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*,audio/*"
                onChange={handleFileSelect}
            />

            {/* Header Area (Fixed) */}
            <div className="px-5 shrink-0">
                {/* Apps Title */}
                <div className="flex justify-between items-center mb-2">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent flex items-center gap-2">
                            <ListTodo size={24} className="text-accent" />
                            Mission
                            {/* Trial Phase Badge (Visible only to Free Users up to 30 Days) */}
                            {!hasActiveSubscription && currentDayNum <= 30 && (
                                <span className="text-[10px] bg-white/10 backdrop-blur-md text-white/70 px-2 py-0.5 border border-white/10 rounded-full font-medium ml-1">
                                    D:{accountAgeDays}/P:{trialPhase}
                                </span>
                            )}
                        </h1>
                        {/* Sequence Badge */}
                        {selectedGoal?.seq && selectedGoal.seq > 1 && (
                            <span className="text-[10px] font-bold bg-white/10 text-accent px-2 py-0.5 rounded-full mt-1 inline-block">
                                Challenge #{selectedGoal.seq}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-end mb-2 px-1">
                    <div>
                        {selectedGoal?.created_at && (
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                                Started {new Date(selectedGoal.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                            </p>
                        )}
                    </div>
                    <div>
                        <p className="text-xs text-primary font-bold tracking-wide uppercase">
                            {new Date(selectedDate.replace(/-/g, '/')).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                        </p>
                    </div>
                </div>

                {userGoals.length > 0 ? (
                    <div className="relative">
                        <select
                            value={selectedGoalId || ''}
                            onChange={(e) => setSelectedGoalId(e.target.value)}
                            className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold text-xs rounded-2xl px-5 py-2.5 appearance-none outline-none border border-white/10 focus:border-primary shadow-lg transition-all"
                        >
                            {userGoals.map(g => {
                                const enLabel = g.category.charAt(0).toUpperCase() + g.category.slice(1);
                                const koLabel = t[g.category as keyof typeof t] || g.category;
                                return (
                                    <option key={g.id} value={g.id} className="bg-slate-800 text-white">
                                        {`✔ [${enLabel}] ${koLabel}`} {g.target_text ? `- ${g.target_text}` : ''}
                                    </option>
                                );
                            })}
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                    </div>
                ) : (
                    <h1 className="text-2xl font-bold text-white mb-2 text-center">Today's Loop</h1>
                )}
            </div>

            {/* Streak/Goal Info */}
            {selectedGoal && (
                <div className="mb-4 mt-3 shrink-0 grid grid-cols-2 gap-2.5 px-5">
                    <div className="relative bg-white/5 rounded-xl px-3 border border-white/5 flex flex-row items-center justify-center gap-2 overflow-hidden h-12">
                        <div className="absolute inset-0 opacity-0 z-10">
                            <select
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full h-full cursor-pointer bg-slate-800 text-white"
                            >
                                {dateOptions.map(opt => (
                                    <option key={opt.value} value={opt.value} className="bg-slate-800 text-white">{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="text-primary pointer-events-none shrink-0"><Flame size={22} /></div>
                        <div className="text-left pointer-events-none flex items-center gap-2 min-w-0">
                            <span className="text-sm text-slate-400 font-bold whitespace-nowrap">{t.inProgress}</span>
                            <span className="text-lg font-bold text-white whitespace-nowrap">Day {getSelectedDayNum()}</span>
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-xl px-3 border border-white/5 flex flex-row items-center justify-center gap-2 h-12">
                        <div className="text-accent shrink-0"><CheckCircle size={22} /></div>
                        <div className="text-left flex items-center gap-2 min-w-0">
                            <h2 className="text-sm font-bold text-slate-400 whitespace-nowrap">
                                {t.missionOverview}
                            </h2>
                            <span className="text-lg font-bold text-white whitespace-nowrap">{missions.filter(m => m.is_completed).length}/{missions.length}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* PREVIEW BANNER */}
            {isPreview && (
                <div className="mb-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 px-5 shrink-0">
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <Sparkles size={20} className="text-primary animate-pulse" />
                            <div>
                                <p className="text-sm font-bold text-white">{t.newMissionProposal}</p>
                                <p className="text-[10px] text-slate-400">{t.reviewCarefully}</p>
                            </div>
                        </div>
                        <button
                            onClick={confirmPlan}
                            className="bg-primary text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 z-10"
                        >
                            {t.confirmAndStart}
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshCount >= 3 || loading}
                            className="bg-primary/20 border border-primary/30 text-xs font-bold text-primary hover:bg-primary/30 hover:text-white hover:border-primary/50 transition-all flex items-center gap-2 px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed z-10 shadow-sm"
                        >
                            {t.changeMissions?.replace('{n}', (3 - refreshCount).toString())} ↻
                        </button>
                    </div>
                </div>
            )}

            {isPastEmpty && (
                <div className="mb-4 p-4 text-center rounded-xl border border-dashed border-slate-700 mx-5 shrink-0">
                    <p className="text-slate-500 text-sm">No record for this day.</p>
                </div>
            )}

            {/* Mission List (Scrollable) */}
            <div className="space-y-3 flex-1 overflow-y-auto min-h-0 px-5 pb-24 no-scrollbar overscroll-y-contain relative">
                {/* Loading Overlay */}
                {loading && (
                    <div className="absolute inset-0 z-10 bg-slate-950/50 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-300">
                        <Sparkles className="mx-auto mb-3 text-primary animate-pulse" size={28} />
                        <p className="text-sm text-slate-400 font-medium animate-pulse">Designing your loop...</p>
                    </div>
                )}

                {(
                    <AnimatePresence>
                        {activeList.map((mission) => {
                            const isBeingVerified = verifyingId === mission.id;

                            return (
                                <motion.div
                                    key={mission.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`relative rounded-2xl border transition-all shadow-md overflow-hidden ${isPreview ? 'bg-white/5 border-dashed border-slate-600 opacity-90 p-4' :
                                        mission.is_completed ? 'bg-slate-900/40 border-slate-800/50 p-4' : 'bg-gradient-to-br from-white/10 to-white/5 border-white/10'
                                        }`}
                                >
                                    {/* Main Card Content */}
                                    <div className={`${!isPreview && !mission.is_completed && !isBeingVerified ? 'p-4' : ''}`}>
                                        <div className="flex items-start gap-4">
                                            {/* Check Icon */}
                                            <button
                                                onClick={() => !isPreview && openVerify(mission)}
                                                disabled={isPreview}
                                                className={`mt-1 shrink-0 transition-all ${isPreview ? 'text-slate-600 cursor-default' :
                                                    mission.is_completed ? 'text-green-500 hover:text-green-400' : 'text-slate-500 hover:text-white'
                                                    }`}
                                            >
                                                {mission.is_completed ? <CheckCircle size={26} /> : <Circle size={26} />}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                {/* Header Row */}
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5">
                                                        {mission.category}
                                                    </span>

                                                    {/* Action Button (Verify/Check) */}
                                                    {!isPreview && !mission.is_completed && !isBeingVerified && (
                                                        <div
                                                            onClick={() => openVerify(mission)}
                                                            className="flex items-center gap-1.5 text-[10px] font-bold text-primary cursor-pointer hover:bg-primary/20 transition-all bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg shadow-sm"
                                                        >
                                                            {mission.verification_type === 'text' ? <PenTool size={14} /> : <Camera size={14} />}
                                                            <span>{t.verify}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <h3 className="text-sm font-bold text-white mb-1 leading-snug">
                                                    {mission.content}
                                                </h3>

                                                {/* PERSONALIZATION & INSIGHT UI */}
                                                {!mission.is_completed && mission.reasoning && (
                                                    <div className="mt-2 space-y-2">
                                                        {/* 1. Decision Support via Trust Score */}
                                                        {mission.trust_score && (
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-accent"
                                                                        style={{ width: `${mission.trust_score}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-accent font-bold">{mission.trust_score}% Match</span>
                                                            </div>
                                                        )}

                                                        {/* 2. Insight Badge (Why?) - Expandable or inline context */}
                                                        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
                                                            <div className="flex items-start gap-2">
                                                                <Lightbulb size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                                                                <div className="space-y-1.5">
                                                                    {/* User Context (Source) */}
                                                                    {mission.reasoning.user_context && (
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <span className="text-[10px] text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded border border-white/5 flex items-center gap-1">
                                                                                <BarChart size={10} />
                                                                                Source
                                                                            </span>
                                                                            <p className="text-xs text-slate-300 leading-snug">
                                                                                "{mission.reasoning.user_context}"
                                                                            </p>
                                                                        </div>
                                                                    )}

                                                                    {/* Impact / Prediction */}
                                                                    {mission.reasoning.expected_impact && (
                                                                        <p className="text-xs text-primary font-medium">
                                                                            ✨ {mission.reasoning.expected_impact}
                                                                        </p>
                                                                    )}

                                                                    {/* Scientific Basis (Double Check) */}
                                                                    {mission.reasoning.scientific_basis && (
                                                                        <div className="pt-1.5 mt-1.5 border-t border-white/5 flex items-start gap-1.5">
                                                                            <ShieldCheck size={12} className="text-blue-400 mt-0.5 shrink-0" />
                                                                            <p className="text-[10px] text-slate-400 leading-tight">
                                                                                {mission.reasoning.scientific_basis}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* COMPLETED PROOF DISPLAY */}
                                                {mission.is_completed && !isBeingVerified && (
                                                    <div className="mt-3 relative group space-y-3">
                                                        {/* 1. Text Proof */}
                                                        {mission.proof_text && (
                                                            <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 text-sm text-slate-300 italic">
                                                                " {mission.proof_text} "
                                                            </div>
                                                        )}

                                                        {/* 2. Media Proof */}
                                                        {mission.image_url && (
                                                            <div>
                                                                {mission.proof_type === 'video' || mission.image_url.endsWith('.mp4') ? (
                                                                    <video src={mission.image_url} controls className="w-full h-32 object-cover rounded-xl border border-white/10" />
                                                                ) : mission.proof_type === 'audio' || mission.image_url.endsWith('.mp3') ? (
                                                                    <audio src={mission.image_url} controls className="w-full mt-2" />
                                                                ) : (
                                                                    <img src={mission.image_url} alt="Proof" className="w-full h-32 object-cover rounded-xl border border-white/10" />
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Edit Overlay (Visible on Hover/Touch) - Covers entire area? Or just append button? 
                                                            Let's make it a floating action button or cover the media if exists.
                                                            To avoid covering text, let's just make the whole container clickable or add an explicit Edit button.
                                                            The original design had an overlay. Let's keep a subtle overlay if media exists, or just a button if only text.
                                                        */}
                                                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <div className="bg-slate-900/90 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/10 pointer-events-auto cursor-pointer shadow-xl" onClick={() => openVerify(mission)}>
                                                                <PenTool size={12} />
                                                                {t.edit || 'Edit'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* VERIFICATION AREA (Expandable) */}
                                    <AnimatePresence>
                                        {isBeingVerified && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="bg-black/40 border-t border-white/5"
                                            >
                                                <div className="p-4">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setVerifyMode('media')}
                                                                className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${verifyMode === 'media' ? 'bg-white text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                                            >
                                                                <Camera size={14} /> Photo/Video/Voice
                                                            </button>
                                                            <button
                                                                onClick={() => setVerifyMode('text')}
                                                                className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${verifyMode === 'text' ? 'bg-white text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                                            >
                                                                <PenTool size={14} /> Text
                                                            </button>
                                                        </div>
                                                        <button onClick={() => setVerifyingId(null)} className="text-slate-500 hover:text-white">
                                                            <X size={18} />
                                                        </button>
                                                    </div>

                                                    {verifyMode === 'text' ? (
                                                        <div className="space-y-3">
                                                            <textarea
                                                                value={textInput}
                                                                onChange={(e) => setTextInput(e.target.value)}
                                                                placeholder="Type your reflection or notes here..."
                                                                className="w-full h-24 bg-slate-900/80 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none resize-none"
                                                            />
                                                            <button
                                                                onClick={handleTextSubmit}
                                                                disabled={!textInput.trim()}
                                                                className="w-full py-3 bg-primary text-black font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50"
                                                            >
                                                                Complete Mission
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="relative group">
                                                            {/* If media exists, show preview with delete button */}
                                                            {mission.image_url ? (
                                                                <div className="relative">
                                                                    {mission.proof_type === 'video' ? (
                                                                        <video src={mission.image_url || undefined} controls className="w-full h-48 object-cover rounded-xl border border-white/10" />
                                                                    ) : mission.proof_type === 'audio' ? (
                                                                        <div className="w-full h-24 bg-slate-800 rounded-xl flex items-center justify-center border border-white/10">
                                                                            <audio src={mission.image_url || undefined} controls className="w-full px-4" />
                                                                        </div>
                                                                    ) : (
                                                                        <img src={mission.image_url || undefined} alt="Proof" className="w-full h-48 object-cover rounded-xl border border-white/10" />
                                                                    )}

                                                                    {/* Change/Delete Actions */}
                                                                    <div className="absolute top-2 right-2 flex gap-2">
                                                                        <button
                                                                            onClick={triggerFileClick}
                                                                            className="p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors backdrop-blur-sm"
                                                                            title="Replace"
                                                                        >
                                                                            <Camera size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={handleDeleteMedia}
                                                                            className="p-2 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-colors backdrop-blur-sm"
                                                                            title="Delete"
                                                                        >
                                                                            <X size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    onClick={triggerFileClick}
                                                                    className="border-2 border-dashed border-white/20 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all group"
                                                                >
                                                                    <div className="flex gap-4 mb-2 text-slate-400 group-hover:text-primary transition-colors">
                                                                        <Camera size={24} />
                                                                        <Video size={24} />
                                                                        <Mic size={24} />
                                                                    </div>
                                                                    <p className="text-sm font-medium text-slate-300">Tap to upload</p>
                                                                    <p className="text-[10px] text-slate-500">Photo, Video, or Audio</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}

                {/* Empty State (Cheering Message) */}
                {!loading && !isPreview && !isPastEmpty && activeList.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full min-h-[40vh] text-center px-10 animate-in fade-in slide-in-from-bottom-4">
                        <div className="w-24 h-24 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-primary/10 relative">
                            <Sparkles size={40} className="text-primary animate-pulse" />
                            <div className="absolute inset-0 border border-white/10 rounded-full animate-[spin_10s_linear_infinite]" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">
                            {userGoals.length === 0 ? t.emptyStateTitle : t.readyToStart}
                        </h3>
                        <p className="text-slate-400 mb-8 leading-relaxed whitespace-pre-wrap">
                            {userGoals.length === 0 ? t.emptyStateDesc : "Press the button to generate your daily missions!"}
                        </p>

                        {userGoals.length === 0 ? (
                            <button
                                onClick={() => navigate('/mypage')}
                                className="bg-white text-black font-bold px-8 py-4 rounded-2xl hover:bg-slate-200 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                            >
                                {t.createGoal} <ArrowRight size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={handleRefresh}
                                className="bg-primary text-black font-bold px-8 py-4 rounded-2xl hover:bg-primary/90 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                            >
                                {t.generateNewMissions} <Sparkles size={18} />
                            </button>
                        )}
                    </div>
                )}

                {/* Loop Closed Celebration */}
                {!loading && !isPreview && activeList.length > 0 && activeList.every(m => m.is_completed) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-6 p-4 bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-2xl text-center shrink-0"
                    >
                        <p className="text-white font-bold text-sm">✨ Loop Closed!</p>
                    </motion.div>
                )}
            </div>
        </div >
    );
}
