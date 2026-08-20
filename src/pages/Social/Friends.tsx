import { useEffect, useState } from 'react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, Share2, User, Trophy, Heart, MessageCircle, Send, Trash2, X, Users, Plus, Check, Swords } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import HistoryDetail from '../History/HistoryDetail';
import BuddyChallengeModal from '../../components/social/BuddyChallengeModal';

export default function Friends() {
    const { user } = useStore();
    const { t } = useLanguage();
    const [friends, setFriends] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [foundUsers, setFoundUsers] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);


    // Friends & Groups State
    const [groups, setGroups] = useState<any[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
    const [friendGroupMap, setFriendGroupMap] = useState<Record<string, string[]>>({}); // friend_id -> group_ids (Array)
    const [missionFilter, setMissionFilter] = useState<'active' | 'completed'>('active');

    // Modals
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [pendingFriend, setPendingFriend] = useState<any>(null); // User waiting to be added OR edited
    const [showAddToGroupModal, setShowAddToGroupModal] = useState(false);

    // Group Management State
    const [editingGroup, setEditingGroup] = useState<any>(null); // For rename/delete
    const [showEditGroupModal, setShowEditGroupModal] = useState(false);

    // Social State
    const [likesMap, setLikesMap] = useState<Record<string, { count: number, isLiked: boolean }>>({});
    const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
    const [permissionsMap, setPermissionsMap] = useState<Record<string, string>>({}); // goal_id -> status
    const [showCommentsId, setShowCommentsId] = useState<string | null>(null);
    const [commentInput, setCommentInput] = useState('');
    const [viewingGoal, setViewingGoal] = useState<any | null>(null);

    // Buddy Challenge
    const [isBuddyModalOpen, setIsBuddyModalOpen] = useState(false);
    const [selectedBuddy, setSelectedBuddy] = useState<any | null>(null);
    const [buddyChallenges, setBuddyChallenges] = useState<any[]>([]);

    // Buddy Challenge Logs (일일 인증)
    const [buddyLogs, setBuddyLogs] = useState<Record<string, any[]>>({}); // challengeId -> logs[]
    const [verifyingBuddyId, setVerifyingBuddyId] = useState<string | null>(null); // challengeId
    const [buddyProofText, setBuddyProofText] = useState('');
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null); // 히스토리 펼친 챌린지 ID
    const [uploadingBuddy, setUploadingBuddy] = useState(false);

    useEffect(() => {
        if (user) {
            fetchGroups();
            fetchFriends();
            fetchBuddyChallenges();
        }
    }, [user]);

    const fetchBuddyChallenges = async () => {
        if (!user || user.id === 'demo123') return;
        try {
            const { data } = await supabase
                .from('buddy_challenges')
                .select('*')
                .or(`creator_id.eq.${user.id},partner_id.eq.${user.id}`)
                .order('created_at', { ascending: false });

            const dismissedKey = `dismissed_buddy_challenges_${user.id}`;
            const dismissedIds: string[] = JSON.parse(localStorage.getItem(dismissedKey) || '[]');

            if (data && data.length > 0) {
                const filteredData = data.filter(c => !dismissedIds.includes(c.id));
                const allUserIds = Array.from(new Set(filteredData.flatMap(c => [c.creator_id, c.partner_id])));
                const { data: userProfiles } = await supabase.from('profiles').select('id, nickname, profile_image_url').in('id', allUserIds);
                const userMap = new Map((userProfiles || []).map(p => [p.id, p]));

                const enriched = filteredData.map(c => ({
                    ...c,
                    creator: userMap.get(c.creator_id) || { nickname: '친구' },
                    partner: userMap.get(c.partner_id) || { nickname: '친구' },
                    isIncoming: c.partner_id === user.id && c.status === 'pending'
                }));
                setBuddyChallenges(enriched);

                // active 챌린지 로그 자동 로드
                const activeChallengeIds = filteredData.filter(c => c.status === 'active').map(c => c.id);
                if (activeChallengeIds.length > 0) {
                    fetchBuddyLogs(activeChallengeIds);
                }
            } else {
                setBuddyChallenges([]);
            }
        } catch (e) {
            console.error('Failed to fetch buddy challenges:', e);
        }
    };

    const fetchBuddyLogs = async (challengeIds: string[]) => {
        if (!user || challengeIds.length === 0) return;
        try {
            const { data } = await supabase
                .from('buddy_challenge_logs')
                .select('*')
                .in('buddy_challenge_id', challengeIds)
                .order('log_date', { ascending: false });
            if (data) {
                const logsMap: Record<string, any[]> = {};
                challengeIds.forEach(id => { logsMap[id] = []; });
                data.forEach(log => {
                    if (!logsMap[log.buddy_challenge_id]) logsMap[log.buddy_challenge_id] = [];
                    logsMap[log.buddy_challenge_id].push(log);
                });
                setBuddyLogs(prev => ({ ...prev, ...logsMap }));
            }
        } catch (e) { console.error('Failed to fetch buddy logs:', e); }
    };

    const getTodayStr = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    };
    const getMyTodayLog = (challengeId: string) => {
        const logs = buddyLogs[challengeId] || [];
        return logs.find(l => l.user_id === user?.id && l.log_date === getTodayStr());
    };
    const getPartnerTodayLog = (challengeId: string, partnerId: string) => {
        const logs = buddyLogs[challengeId] || [];
        return logs.find(l => l.user_id === partnerId && l.log_date === getTodayStr());
    };

    const submitBuddyProofText = async (challengeId: string) => {
        if (!buddyProofText.trim() || !user) return;
        const myLog = getMyTodayLog(challengeId);
        try {
            if (myLog) {
                const { error } = await supabase
                    .from('buddy_challenge_logs')
                    .update({
                        is_completed: true,
                        proof_text: buddyProofText.trim(),
                        proof_type: 'text',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', myLog.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('buddy_challenge_logs')
                    .insert({
                        buddy_challenge_id: challengeId,
                        user_id: user.id,
                        log_date: getTodayStr(),
                        is_completed: true,
                        proof_text: buddyProofText.trim(),
                        proof_type: 'text'
                    });
                if (error) throw error;
            }
            alert('오늘의 대결 미션 인증이 완료되었습니다! 🔥');
            setBuddyProofText('');
            setVerifyingBuddyId(null);
            await fetchBuddyLogs([challengeId]);
        } catch (e: any) {
            console.error('submitBuddyProofText error:', e);
            alert(`인증 저장 실패: ${e.message}`);
        }
    };

    const submitBuddyProofImage = async (challengeId: string, file: File) => {
        if (!user) return;
        setUploadingBuddy(true);
        const myLog = getMyTodayLog(challengeId);
        try {
            const fileName = `${user.id}/buddy_${challengeId}_${getTodayStr()}_${Date.now()}`;
            const { error: upErr } = await supabase.storage.from('mission-proofs').upload(fileName, file);
            if (upErr) throw upErr;
            const publicUrl = supabase.storage.from('mission-proofs').getPublicUrl(fileName).data.publicUrl;
            const proofType = file.type.startsWith('video') ? 'video' : 'image';
            if (myLog) {
                const { error } = await supabase
                    .from('buddy_challenge_logs')
                    .update({
                        is_completed: true,
                        image_url: publicUrl,
                        proof_type: proofType,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', myLog.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('buddy_challenge_logs')
                    .insert({
                        buddy_challenge_id: challengeId,
                        user_id: user.id,
                        log_date: getTodayStr(),
                        is_completed: true,
                        image_url: publicUrl,
                        proof_type: proofType
                    });
                if (error) throw error;
            }
            alert('오늘의 대결 미션 사진 인증이 완료되었습니다! 📸🔥');
            setVerifyingBuddyId(null);
            await fetchBuddyLogs([challengeId]);
        } catch (e: any) {
            console.error('submitBuddyProofImage error:', e);
            alert(`사진 업로드 실패: ${e.message}`);
        } finally {
            setUploadingBuddy(false);
        }
    };

    const acceptBuddyChallenge = async (challengeId: string) => {
        try {
            const { error } = await supabase.from('buddy_challenges').update({ status: 'active' }).eq('id', challengeId);
            if (error) throw error;
            alert('버디 챌린지를 수락했습니다! 함께 목표를 달성해보세요! 🔥');
            fetchBuddyChallenges();
        } catch (e) {
            alert('수락 처리 중 오류가 발생했습니다.');
        }
    };

    const declineBuddyChallenge = async (challengeId: string) => {
        if (!window.confirm('버디 챌린지 요청을 거절하시겠습니까?')) return;
        try {
            await supabase.from('buddy_challenges').update({ status: 'cancelled' }).eq('id', challengeId);
            await supabase.from('buddy_challenges').delete().eq('id', challengeId);
            
            const dismissedKey = `dismissed_buddy_challenges_${user?.id}`;
            const existingDismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
            if (!existingDismissed.includes(challengeId)) {
                existingDismissed.push(challengeId);
                localStorage.setItem(dismissedKey, JSON.stringify(existingDismissed));
            }

            setBuddyChallenges(prev => prev.filter(c => c.id !== challengeId));
            fetchBuddyChallenges();
        } catch (e) {
            alert('거절 처리 중 오류가 발생했습니다.');
        }
    };

    const [nudgedMap, setNudgedMap] = useState<Record<string, boolean>>({});
    const [incomingNudgeToast, setIncomingNudgeToast] = useState<string | null>(null);
    const [incomingCancelRequest, setIncomingCancelRequest] = useState<any | null>(null);

    const nudgeBuddy = async (challengeId: string, partnerId: string, partnerName: string) => {
        try {
            // optimistic update
            setNudgedMap(prev => ({ ...prev, [challengeId]: true }));
            
            // 실제 구현이 필요한 경우 Supabase에 저장하거나 Notification 전송
            // 현재는 넛지 버튼 상태 업데이트용 함수
            console.log(`Nudged ${partnerName} (${partnerId}) for challenge ${challengeId}`);
        } catch (e) {
            console.error('Nudge failed', e);
        }
    };

    useEffect(() => {
        if (!user) return;
        // 1. Check if there is an incoming nudge for me
        const nudgeKey = `buddy_nudge_received_${user.id}`;
        const nudgeData = localStorage.getItem(nudgeKey);
        if (nudgeData) {
            try {
                const parsed = JSON.parse(nudgeData);
                if (Date.now() - parsed.time < 3600000) {
                    setIncomingNudgeToast(`${parsed.sender_name || '친구'}님이 "오늘 미션 잊지 말고 같이 완수하자! 🔥" 넛지(찌르기)를 보냈습니다!`);
                    localStorage.removeItem(nudgeKey);
                }
            } catch (e) {}
        }

        // 2. Check if there is an incoming challenge cancellation request for me
        const cancelKey = `buddy_cancel_req_${user.id}`;
        const cancelData = localStorage.getItem(cancelKey);
        if (cancelData) {
            try {
                const parsed = JSON.parse(cancelData);
                setIncomingCancelRequest(parsed);
            } catch (e) {}
        }
    }, [user]);

    // 1. Cancel pending request (Creator can cancel unilaterally before partner accepts)
    const cancelPendingRequest = async (challengeId: string) => {
        if (!window.confirm('보낸 챌린지 요청을 취소하시겠습니까?')) return;
        try {
            await supabase.from('buddy_challenges').delete().eq('id', challengeId);
            await supabase.from('buddy_challenges').update({ status: 'cancelled' }).eq('id', challengeId);
            
            const dismissedKey = `dismissed_buddy_challenges_${user?.id}`;
            const existingDismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
            if (!existingDismissed.includes(challengeId)) {
                existingDismissed.push(challengeId);
                localStorage.setItem(dismissedKey, JSON.stringify(existingDismissed));
            }

            setBuddyChallenges(prev => prev.filter(c => c.id !== challengeId));
            alert('챌린지 요청이 취소되었습니다.');
            fetchBuddyChallenges();
        } catch (e) {
            alert('요청 취소 중 오류가 발생했습니다.');
        }
    };

    const [myCancelRequestedMap, setMyCancelRequestedMap] = useState<Record<string, boolean>>({});

    // 2. Request mutual cancellation for an ACTIVE challenge
    const requestMutualCancellation = async (challengeId: string, partnerId: string, challengeName: string) => {
        if (!window.confirm(`상대방에게 "${challengeName || '1:1 버디 챌린지'}" 중단 요청을 보내시겠습니까?\n\n상대방이 [동의]해야 챌린지가 안전하게 종료됩니다.`)) return;
        try {
            const cancelKey = `buddy_cancel_req_${partnerId}`;
            localStorage.setItem(cancelKey, JSON.stringify({
                challenge_id: challengeId,
                requester_id: user?.id,
                requester_name: (user as any)?.nickname || user?.email || '친구',
                challenge_name: challengeName || '1:1 버디 챌린지',
                time: Date.now()
            }));

            setMyCancelRequestedMap(prev => ({ ...prev, [challengeId]: true }));
            alert('상대방에게 중단 요청을 전송했습니다. 상대방이 동의하면 챌린지가 종료됩니다.');
        } catch (e: any) {
            console.error('Request cancellation error:', e);
            alert('중단 요청 중 오류가 발생했습니다.');
        }
    };

    // 3. Partner Agrees to cancel active challenge
    const agreeCancelChallenge = async (challengeId: string) => {
        try {
            await supabase.from('buddy_challenges').update({ status: 'cancelled' }).eq('id', challengeId);
            await supabase.from('buddy_challenges').delete().eq('id', challengeId);
            
            const dismissedKey = `dismissed_buddy_challenges_${user?.id}`;
            const existingDismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
            if (!existingDismissed.includes(challengeId)) {
                existingDismissed.push(challengeId);
                localStorage.setItem(dismissedKey, JSON.stringify(existingDismissed));
            }

            setBuddyChallenges(prev => prev.filter(c => c.id !== challengeId));
            if (user) localStorage.removeItem(`buddy_cancel_req_${user.id}`);
            setIncomingCancelRequest(null);
            alert('상호 동의하여 버디 챌린지가 종료되었습니다.');
            fetchBuddyChallenges();
        } catch (e) {
            alert('종료 처리 중 오류가 발생했습니다.');
        }
    };

    // 4. Partner Rejects cancellation request
    const rejectCancelChallenge = () => {
        if (user) localStorage.removeItem(`buddy_cancel_req_${user.id}`);
        setIncomingCancelRequest(null);
        alert('중단 요청을 거절하였습니다. 챌린지를 계속 진행합니다! 🔥');
    };

    const fetchGroups = async () => {
        const { data } = await supabase.from('friend_groups').select('*').eq('user_id', user!.id).order('created_at');
        setGroups(data || []);
    };

    const createGroup = async () => {
        if (!newGroupName.trim()) return;
        const { error } = await supabase.from('friend_groups').insert({ user_id: user!.id, name: newGroupName.trim() });
        if (error) alert("Failed to create group");
        else {
            setNewGroupName('');
            setShowGroupModal(false);
            fetchGroups();
            if (pendingFriend) {
                setShowAddToGroupModal(true);
            }
        }
    };

    const updateGroup = async (groupId: string, newName: string) => {
        if (!newName.trim()) return;
        const { error } = await supabase.from('friend_groups').update({ name: newName.trim() }).eq('id', groupId);
        if (error) alert("Failed to update group");
        else {
            setEditingGroup(null);
            setShowEditGroupModal(false);
            fetchGroups();
        }
    };

    const deleteGroup = async (groupId: string) => {
        if (!window.confirm("Are you sure you want to delete this group? Friends will stay in your list.")) return;
        const { error } = await supabase.from('friend_groups').delete().eq('id', groupId);
        if (error) alert("Failed to delete group");
        else {
            if (selectedGroupId === groupId) setSelectedGroupId('all');
            setEditingGroup(null);
            setShowEditGroupModal(false);
            fetchGroups();
            // Refresh friends to update their group maps locally if needed (though map uses IDs so it's fine)
            // But good to refetch friends to clear stale group links in display if any
            fetchFriends();
        }
    };

    const fetchFriends = async () => {
        try {
            // 1. Get Friendships
            const { data: friendships } = await supabase
                .from('friends')
                .select('user_id, friend_id')
                .or(`user_id.eq.${user!.id},friend_id.eq.${user!.id}`);

            if (!friendships || friendships.length === 0) {
                setFriends([]);
                return;
            }

            // 2. Extract Friend IDs
            const friendIds = friendships.map(f =>
                f.user_id === user!.id ? f.friend_id : f.user_id
            );

            // 3. Fetch Profiles
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .in('id', friendIds);

            // 4. Fetch Goals (Active)
            const { data: goals } = await supabase
                .from('user_goals')
                .select('*')
                .in('user_id', friendIds)
                .order('updated_at', { ascending: false });

            // 5. Fetch Missions (for stats)
            const { data: missions } = await supabase
                .from('missions')
                .select('user_id, category, is_completed')
                .in('user_id', friendIds);

            // Fetch Group Memberships
            const { data: groupMembers } = await supabase
                .from('friend_group_members')
                .select('group_id, member_id')
                .in('member_id', friendIds);

            const groupMap: Record<string, string[]> = {};
            if (groupMembers) {
                groupMembers.forEach((m: any) => {
                    if (!groupMap[m.member_id]) {
                        groupMap[m.member_id] = [];
                    }
                    groupMap[m.member_id].push(m.group_id);
                });
            }
            setFriendGroupMap(groupMap);

            // 6. Fetch Likes & Comments
            const goalIds = goals?.map(g => g.id) || [];

            const { data: likesData } = await supabase
                .from('goal_likes')
                .select('goal_id, user_id')
                .in('goal_id', goalIds);

            const { data: commentsData } = await supabase
                .from('goal_comments')
                .select('id, goal_id, user_id, content, created_at, profiles:user_id(nickname)')
                .in('goal_id', goalIds)
                .order('created_at', { ascending: true });

            // 7. Fetch Permissions (Requests by ME)
            const { data: permissionsData } = await supabase
                .from('friend_history_permissions')
                .select('goal_id, status')
                .eq('requester_id', user!.id)
                .in('goal_id', goalIds);

            // Process Permissions
            const newPermissionsMap: Record<string, string> = {};
            permissionsData?.forEach(p => {
                newPermissionsMap[p.goal_id] = p.status;
            });
            setPermissionsMap(newPermissionsMap);

            // Process Likes
            const newLikesMap: Record<string, { count: number, isLiked: boolean }> = {};
            goals?.forEach(g => {
                const goalLikes = likesData?.filter(l => l.goal_id === g.id) || [];
                newLikesMap[g.id] = {
                    count: goalLikes.length,
                    isLiked: goalLikes.some(l => l.user_id === user!.id)
                };
            });
            setLikesMap(newLikesMap);

            // Process Comments
            const newCommentsMap: Record<string, any[]> = {};
            goals?.forEach(g => {
                newCommentsMap[g.id] = commentsData?.filter(c => c.goal_id === g.id) || [];
            });
            setCommentsMap(newCommentsMap);

            // 7. Build Friend Objects (One item per GOAL)
            const enrichedList: any[] = [];

            profiles?.forEach(p => {
                const userGoals = goals?.filter(g => g.user_id === p.id) || [];

                if (userGoals.length === 0) {
                    enrichedList.push({
                        uniqueKey: p.id,
                        id: p.id,
                        name: p.nickname || p.email?.split('@')[0] || 'Unknown',
                        profileImageUrl: p.profile_image_url, // Added
                        userGoal: null,
                        hasGoal: false,
                        targetText: "Ready to start...",
                        stats: null
                    });
                } else {
                    userGoals.forEach(goal => {
                        const start = new Date(goal.created_at);
                        const now = new Date();
                        const diffTime = Math.abs(now.getTime() - start.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const durationMonths = goal.duration_months || 1;
                        const totalDays = durationMonths * 30;

                        const userMissions = missions?.filter(m => m.user_id === p.id) || [];
                        const goalMissions = userMissions.filter(m =>
                            m.category && goal.category &&
                            m.category.toLowerCase().trim() === goal.category.toLowerCase().trim()
                        );

                        const verifiedCount = goalMissions.filter(m =>
                            m.is_completed === true || m.is_completed === 'true'
                        ).length;

                        const totalMissionCount = goalMissions.length;
                        const completionRate = totalMissionCount > 0
                            ? Math.round((verifiedCount / totalMissionCount) * 100)
                            : 0;

                        enrichedList.push({
                            uniqueKey: `${p.id}-${goal.id}`,
                            id: p.id,
                            name: p.nickname || p.email?.split('@')[0] || 'Unknown',
                            profileImageUrl: p.profile_image_url, // Added
                            userGoal: goal,
                            hasGoal: true,
                            targetText: goal.target_text ? `[${goal.category.toUpperCase()}] ${goal.target_text}` : goal.category,
                            daysInfo: `${diffDays} / ${totalDays} Days`,
                            verifiedCount: verifiedCount,
                            completionRate: completionRate,
                            goalsTotalDays: diffDays,
                            isExpired: diffDays > totalDays // Added expiration check
                        });
                    });
                }
            });

            // 8. Sorting / Ranking Logic
            enrichedList.sort((a, b) => {
                if (!a.hasGoal) return 1;
                if (!b.hasGoal) return -1;

                // Sort Active first, then by completion rate
                if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;

                if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
                if (b.goalsTotalDays !== a.goalsTotalDays) return b.goalsTotalDays - a.goalsTotalDays;
                return b.verifiedCount - a.verifiedCount;
            });

            // Add Ranking
            const rankedList = enrichedList.map((item, index) => ({
                ...item,
                rank: item.hasGoal && !item.isExpired ? index + 1 : null // Only rank active goals
            }));

            setFriends(rankedList);
        } catch (error) {
            console.error('Error fetching friends:', error);
        }
    };

    // Filter Logic
    const filteredFriends = friends.filter(friend => {
        // Group Filter
        if (selectedGroupId !== 'all') {
            const friendGroups = friendGroupMap[friend.id] || [];
            if (!friendGroups.includes(selectedGroupId)) return false;
        }

        // Mission Filter
        // 'Active' means Goal is in progress (not expired).
        // 'Completed' means Goal is finished (expired).
        const isCompleted = friend.hasGoal && friend.isExpired;

        if (missionFilter === 'completed') return isCompleted;
        // In Active tab, show Active Goals + Friends without goals
        return !isCompleted;
    });    // But if they typed "010...", we usually want to search for the E.164 format too?
    // Actually, the SQL now does %term%, so "0101234..." might fail if DB has "+8210..."
    // So we should send BOTH or rely on the SQL to handle it.
    // Let's send the raw digit string for the SQL to fuzzy match,
    // OR convert 010 to +82 as primary.

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setFoundUsers([]);

        let searchTerm = searchQuery.trim();

        // Phone Number Normalization
        // Remove hyphens/spaces
        const rawInput = searchTerm.replace(/[^0-9a-zA-Z@.]/g, '');
        // For fuzzy search, we might NOT want to force +82 if they are typing "4561"
        // But if they typed "010...", we usually want to search for the E.164 format too?
        // Actually, the SQL now does %term%, so "0101234..." might fail if DB has "+8210..."
        // So we should send BOTH or rely on the SQL to handle it.
        // Let's send the raw digit string for the SQL to fuzzy match,
        // OR convert 010 to +82 as primary.

        // Re-thinking: User wants "22171125" (no 010) to match.
        // And "4561" to match.
        // So we should probably just send the raw input (digits only) and let SQL %like% handle it?
        // BUT if they type "010-1234-5678", we want to find "+821012345678".
        // The previous logic converted 010 -> +82.
        // If I type "4561", it is NOT 010 start. So it sends "4561". SQL does %4561%. Correct.
        // If I type "01012345678", I convert to "+821012345678". SQL does %+8210...%. Correct.

        // KEEP logic for 010 conversion, but if it doesn't start with 010, treat as partial.

        const isEmail = rawInput.includes('@');
        const isPhone = /^[0-9]+$/.test(rawInput.replace(/-/g, ''));

        if (!isEmail && (isPhone || rawInput.startsWith('010'))) {
            let cleanPhone = rawInput.replace(/-/g, '');
            if (cleanPhone.startsWith('010')) {
                cleanPhone = '+82' + cleanPhone.substring(1);
            }
            searchTerm = cleanPhone;
        }

        try {
            // Use the secure RPC for search to handle RLS and auth.users lookup
            const { data, error } = await supabase.rpc('search_user_by_email_or_phone', {
                search_term: searchTerm
            });

            if (error) throw error;

            const results = Array.isArray(data) ? data : (data ? [data] : []);

            // Check if found self
            const foundSelf = results.find((u: any) => u.id === user?.id);

            // Filter self and demo
            const valid = results.filter((u: any) => u.id !== user?.id && u.id !== 'demo123');

            if (valid.length > 0) {
                setFoundUsers(valid);
            } else {
                if (foundSelf) alert("검색 결과가 본인입니다.");
                else alert("User not found.");
            }
        } catch (err) {
            console.error(err);
            alert("Error searching user.");
        }
        setSearching(false);
    };


    const addFriend = (targetUser: any) => {
        if (user?.id === 'demo123') return alert(t.demoLimit);
        if (!targetUser || !user) return;

        if (groups.length === 0) {
            // Prompt to create group first
            if (window.confirm("친구 그룹을 만들어 정리해보세요! 그룹을 먼저 만드시겠습니까?")) {
                setPendingFriend(targetUser);
                setShowGroupModal(true);
                return;
            }
        } else {
            // Show selection modal
            setPendingFriend(targetUser);
            setShowAddToGroupModal(true);
            return;
        }

        // Direct add if no group interaction desired
        executeAddFriend(targetUser, null);
    };

    const executeAddFriend = async (targetUser: any, groupId: string | null) => {
        try {
            // 1. Add Friendship
            const { error } = await supabase.from('friends').insert({
                user_id: user!.id,
                friend_id: targetUser.id,
                status: 'accepted'
            });
            if (error) {
                // @ts-ignore
                if (error.code === '23505') {
                    // Already friends, but maybe adding to group?
                    // Continue to group add logic if groupId exists
                } else {
                    throw error;
                }
            }

            // 2. Add to Group if selected
            if (groupId) {
                const { error: groupError } = await supabase.from('friend_group_members').insert({
                    group_id: groupId,
                    member_id: targetUser.id
                });
                if (groupError) console.error("Failed to add to group:", groupError);
            }

            alert(`Added ${targetUser.nickname || 'Friend'}!`);
            // Clean up
            setFoundUsers(prev => prev.filter(u => u.id !== targetUser.id));
            if (foundUsers.length <= 1) setSearchQuery('');
            setPendingFriend(null);
            setShowAddToGroupModal(false);
            fetchFriends();
        } catch (err) {
            console.error(err);
            alert("Failed to add friend.");
        }
    };

    const toggleLike = async (goalId: string) => {
        const current = likesMap[goalId];
        const isLiked = current?.isLiked;

        // Optimistic UI Update
        setLikesMap(prev => ({
            ...prev,
            [goalId]: {
                count: isLiked ? prev[goalId].count - 1 : prev[goalId].count + 1,
                isLiked: !isLiked
            }
        }));

        let error;
        if (isLiked) {
            const { error: delError } = await supabase.from('goal_likes').delete().match({ goal_id: goalId, user_id: user!.id });
            error = delError;
        } else {
            const { error: insError } = await supabase.from('goal_likes').insert({ goal_id: goalId, user_id: user!.id });
            error = insError;
        }

        if (error) {
            console.error("Like Error:", error);
            // Revert
            setLikesMap(prev => ({
                ...prev,
                [goalId]: {
                    count: isLiked ? prev[goalId].count + 1 : prev[goalId].count - 1,
                    isLiked: isLiked
                }
            }));
            alert("Could not update like status.");
        }
    };

    const handleComment = (goalId: string) => {
        setShowCommentsId(goalId);
        setCommentInput('');
    }

    const postComment = async () => {
        if (!commentInput.trim() || !showCommentsId) return;

        const goalId = showCommentsId;
        const tempId = Date.now().toString();

        // Optimistic
        const newComment = {
            id: tempId,
            goal_id: goalId,
            user_id: user!.id,
            content: commentInput,
            created_at: new Date().toISOString(),
            profiles: { nickname: user!.nickname || 'Me' }
        };

        setCommentsMap(prev => ({
            ...prev,
            [goalId]: [...(prev[goalId] || []), newComment]
        }));
        setCommentInput('');

        const { data, error } = await supabase
            .from('goal_comments')
            .insert({ goal_id: goalId, user_id: user!.id, content: newComment.content })
            .select('*, profiles:user_id(nickname)')
            .single();

        if (error) {
            console.error("Comment Save Error:", error);
            alert(`Failed to save comment: ${error.message}`);
            // Revert optimistic update
            setCommentsMap(prev => ({
                ...prev,
                [goalId]: prev[goalId].filter(c => c.id !== tempId)
            }));
            return;
        }

        if (data) {
            // Replace mock with real
            setCommentsMap(prev => ({
                ...prev,
                [goalId]: prev[goalId].map(c => c.id === tempId ? data : c)
            }));
        }
    };

    const deleteComment = async (commentId: string, goalId: string) => {
        setCommentsMap(prev => ({
            ...prev,
            [goalId]: prev[goalId].filter(c => c.id !== commentId)
        }));
        await supabase.from('goal_comments').delete().eq('id', commentId);
    };

    const handleRequestHistory = async (targetUserId: string, goalId: string) => {
        // Find the goal's seq from our local friends list (which has userGoal)
        const friend = friends.find(f => f.userGoal?.id === goalId);
        const seq = friend?.userGoal?.seq || 1;

        const { error } = await supabase
            .from('friend_history_permissions')
            .insert({
                requester_id: user!.id,
                target_user_id: targetUserId,
                goal_id: goalId,
                seq: seq, // Explicitly save seq
                status: 'pending'
            });

        if (error) {
            alert("Failed to request access.");
            console.error(error);
        } else {
            alert("Request sent!");
            setPermissionsMap(prev => ({ ...prev, [goalId]: 'pending' }));
        }
    };

    const handleViewHistory = (goalId: string) => {
        // Find the full goal object from our friends list or goals list
        // Since we have friends list enriched with userGoal, we can find it there
        const friend = friends.find(f => f.userGoal?.id === goalId);
        if (friend && friend.userGoal) {
            setViewingGoal(friend.userGoal);
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: t.shareTitle,
            text: t.shareText,
            url: window.location.origin,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error("Error sharing:", err);
            }
        } else {
            // Fallback: Copy to clipboard
            try {
                await navigator.clipboard.writeText(`${t.shareText}\n${shareData.url}`);
                alert("Invite link copied to clipboard!");
            } catch (err) {
                alert("Failed to copy link.");
            }
        }
    };


    return (
        <div className="w-full flex-1 min-h-0 flex flex-col px-5 pt-6 pb-32">
            <div className="flex justify-between items-center mb-2 shrink-0">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent flex items-center gap-2">
                    <Users size={24} className="text-accent" />
                    Friends
                </h1>
                <div className="bg-white/5 px-4 py-2 rounded-full flex items-center gap-2 border border-white/5">
                    <Users size={14} className="text-accent" />
                    <span className="text-xs font-bold text-white shadow-sm">{friends.length}</span>
                </div>
            </div>

            {/* Groups & Filters */}
            <div className="mb-4 space-y-3 shrink-0">
                {/* Groups - Wrapped for Mobile */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setSelectedGroupId('all')}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${selectedGroupId === 'all' ? 'bg-white text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                        All
                    </button>
                    {groups.map(g => (
                        <div key={g.id} className="relative group">
                            <button
                                onClick={() => setSelectedGroupId(g.id)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors flex items-center gap-2 ${selectedGroupId === g.id ? 'bg-white text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                            >
                                {g.name}
                            </button>
                            {/* Manage Group Button */}
                            {selectedGroupId === g.id && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingGroup(g);
                                        setShowEditGroupModal(true);
                                    }}
                                    className="absolute -top-2 -right-1 w-4 h-4 bg-slate-700 text-white rounded-full flex items-center justify-center shadow-md border border-white/10 hover:bg-slate-600 z-10"
                                    title="그룹 설정"
                                    aria-label="그룹 설정"
                                >
                                    <span className="text-[8px]">⚙️</span>
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        onClick={() => setShowGroupModal(true)}
                        className="px-2 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center gap-1 hover:bg-primary/30"
                    >
                        <Plus size={10} /> New
                    </button>
                </div>

                {/* Mission Status Tabs - Smaller & Korean */}
                <div className="flex items-center gap-2">
                    <div className="flex p-0.5 bg-slate-900 rounded-lg border border-white/5">
                        <button
                            onClick={() => setMissionFilter('active')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${missionFilter === 'active' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            진행중
                        </button>
                        <button
                            onClick={() => setMissionFilter('completed')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${missionFilter === 'completed' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            완료
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Section - Compact One Line */}
            <div className="bg-slate-900/50 p-2 rounded-xl border border-white/5 mb-4 shrink-0 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                    <UserPlus size={14} className="text-slate-400" />
                </div>
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder={t.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 text-white placeholder:text-slate-600"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={searching}
                    title="검색"
                    className="w-8 h-8 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
                >
                    <Search size={14} />
                </button>
            </div>

            {/* Search Results List */}
            {foundUsers.length > 0 && (
                <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-1">
                    <p className="text-xs text-slate-400 pl-1 mb-2">Found {foundUsers.length} users</p>
                    {foundUsers.map(u => (
                        <div key={u.id} className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                                    {u.profile_image_url ? (
                                        <img src={u.profile_image_url} alt={u.nickname} className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={20} className="text-slate-300" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{u.nickname || 'Unknown User'}</p>
                                    <p className="text-[10px] text-slate-400">
                                        {u.email ? u.email : 'Phone User'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => addFriend(u)}
                                className="bg-primary text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90"
                            >
                                Add
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ⚔️ INCOMING BUDDY CHALLENGE REQUESTS */}
            {buddyChallenges.filter(c => c.isIncoming).length > 0 && (
                <div className="mb-4 space-y-2 animate-in fade-in slide-in-from-top-2 shrink-0">
                    <div className="flex items-center gap-1.5 px-1">
                        <span className="text-sm">⚔️</span>
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">도착한 버디 챌린지 요청</h3>
                        <span className="text-[10px] bg-accent/20 text-accent font-bold px-1.5 py-0.2 rounded-full">
                            {buddyChallenges.filter(c => c.isIncoming).length}
                        </span>
                    </div>
                    {buddyChallenges.filter(c => c.isIncoming).map((challenge) => (
                        <div key={challenge.id} className="p-3.5 bg-gradient-to-r from-purple-900/40 to-slate-900/60 rounded-2xl border border-primary/40 shadow-lg flex flex-col gap-2.5">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                        ⚔️
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">
                                            <span className="text-primary">{challenge.creator?.nickname || '친구'}</span>님의 1:1 챌린지 요청!
                                        </p>
                                        <p className="text-[11px] text-slate-300">
                                            {challenge.challenge_name || `[${challenge.goal_category}] 7일 습관 달성 대결`}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                                    {challenge.goal_category}
                                </span>
                            </div>
                            <div className="flex gap-2 pt-1 border-t border-white/5">
                                <button
                                    onClick={() => acceptBuddyChallenge(challenge.id)}
                                    className="flex-1 py-2 bg-primary hover:bg-primary/90 text-black text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 shadow"
                                >
                                    <span>수락하기 🔥</span>
                                </button>
                                <button
                                    onClick={() => declineBuddyChallenge(challenge.id)}
                                    className="py-2 px-4 bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold rounded-xl transition-all"
                                >
                                    거절
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ⚔️ OUTGOING BUDDY CHALLENGE REQUESTS (Waiting for partner) */}
            {buddyChallenges.filter(c => c.creator_id === user?.id && c.status === 'pending').length > 0 && (
                <div className="mb-4 space-y-2 shrink-0">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm">⏳</span>
                            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">내가 보낸 챌린지 요청 (수락 대기중)</h3>
                        </div>
                    </div>
                    {buddyChallenges.filter(c => c.creator_id === user?.id && c.status === 'pending').map((challenge) => (
                        <div key={challenge.id} className="p-3 bg-slate-900/70 rounded-2xl border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="text-base">⚔️</span>
                                <div>
                                    <p className="text-xs font-bold text-white">
                                        <span className="text-accent">{challenge.partner?.nickname || '친구'}</span>님에게 신청함
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                        {challenge.challenge_name || challenge.goal_category}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => cancelPendingRequest(challenge.id)}
                                className="py-1.5 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[11px] font-bold rounded-xl transition-all"
                            >
                                요청 취소
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ⚔️ ACTIVE BUDDY CHALLENGES */}
            {buddyChallenges.filter(c => c.status === 'active').length > 0 && (
                <div className="mb-4 space-y-2 shrink-0">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm">🔥</span>
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">진행 중인 버디 챌린지</h3>
                        </div>
                    </div>
                    {/* 📢 Incoming Mutual Cancellation Request Banner */}
                    {incomingCancelRequest && (
                        <div className="p-3.5 bg-gradient-to-r from-red-950/80 to-slate-900 border border-red-500/40 rounded-2xl shadow-xl space-y-2 animate-in fade-in">
                            <div className="flex items-center gap-2">
                                <span className="text-base">📢</span>
                                <div>
                                    <p className="text-xs font-bold text-white">
                                        <span className="text-red-400">{incomingCancelRequest.requester_name}</span>님이 챌린지 중단을 요청했습니다.
                                    </p>
                                    <p className="text-[10px] text-slate-300">"{incomingCancelRequest.challenge_name}" 챌린지를 종료하시겠습니까?</p>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={() => agreeCancelChallenge(incomingCancelRequest.challenge_id)}
                                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold rounded-xl transition-all shadow"
                                >
                                    동의하여 챌린지 종료
                                </button>
                                <button
                                    onClick={rejectCancelChallenge}
                                    className="py-1.5 px-3 bg-white/10 hover:bg-white/20 text-slate-300 text-[11px] font-bold rounded-xl transition-all"
                                >
                                    계속 대결하기
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 🔔 Incoming Nudge Toast Banner */}
                    {incomingNudgeToast && (
                        <div className="p-3 bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border border-yellow-500/40 rounded-2xl flex items-center justify-between shadow-lg animate-bounce">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🔔</span>
                                <p className="text-xs font-bold text-yellow-300">{incomingNudgeToast}</p>
                            </div>
                            <button
                                onClick={() => setIncomingNudgeToast(null)}
                                className="text-xs text-slate-400 hover:text-white px-2 py-1"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {buddyChallenges.filter(c => c.status === 'active').map((challenge) => {
                        const isCreator = challenge.creator_id === user?.id;
                        const partnerId = isCreator ? challenge.partner_id : challenge.creator_id;
                        const partnerProfile = isCreator ? challenge.partner : challenge.creator;
                        const isNudged = !!nudgedMap[challenge.id];
                        const isCancelRequested = !!myCancelRequestedMap[challenge.id];

                        return (
                            <div key={challenge.id} className="p-3.5 bg-slate-900/90 rounded-2xl border border-primary/20 shadow-lg flex flex-col gap-2.5">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                            <span className="text-primary font-extrabold">나</span> 
                                            <span className="text-[10px] text-slate-400">VS</span> 
                                            <span className="text-accent font-extrabold">{partnerProfile?.nickname || '친구'}</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                                            ({challenge.challenge_name || challenge.goal_category})
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => nudgeBuddy(challenge.id, partnerId, partnerProfile?.nickname || '친구')}
                                            disabled={isNudged}
                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-sm ${
                                                isNudged 
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                                    : 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 active:scale-95'
                                            }`}
                                            title="친구에게 미션 응원 찌르기"
                                        >
                                            <span>{isNudged ? '✅ 완료' : '🔔 넛지'}</span>
                                        </button>
                                        <button
                                            onClick={() => requestMutualCancellation(challenge.id, partnerId, challenge.challenge_name)}
                                            disabled={isCancelRequested}
                                            className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
                                                isCancelRequested
                                                    ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 cursor-not-allowed'
                                                    : 'text-slate-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10'
                                            }`}
                                            title={isCancelRequested ? '상대방의 중단 동의를 기다리는 중입니다' : '상대방에게 중단 요청 전송'}
                                        >
                                            {isCancelRequested ? '중단 대기중 ⏳' : '중단'}
                                        </button>
                                    </div>
                                </div>

                                {/* VS Progress Bar - 실제 로그 기반 */}
                                {(() => {
                                    const logs = buddyLogs[challenge.id] || [];
                                    const myCount = logs.filter(l => l.user_id === user?.id && l.is_completed).length;
                                    const partnerCount = logs.filter(l => l.user_id === partnerId && l.is_completed).length;
                                    const total = Math.max(myCount + partnerCount, 1);
                                    const myPct = Math.round((myCount / total) * 100);
                                    const partnerPct = 100 - myPct;
                                    const myToday = getMyTodayLog(challenge.id);
                                    const partnerToday = getPartnerTodayLog(challenge.id, partnerId);
                                    return (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] font-bold px-0.5">
                                                <span className={myToday?.is_completed ? 'text-emerald-400' : 'text-primary'}>
                                                    나: {myCount}일 완료 {myToday?.is_completed ? '✅' : '🔥'}
                                                </span>
                                                <span className={partnerToday?.is_completed ? 'text-emerald-400' : 'text-accent'}>
                                                    {partnerProfile?.nickname || '친구'}: {partnerCount}일 완료 {partnerToday?.is_completed ? '✅' : '⚡'}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex p-0.5 border border-white/5">
                                                <div className="bg-gradient-to-r from-primary to-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${myPct}%` }} />
                                                <div className="bg-gradient-to-r from-accent to-purple-400 h-full rounded-full transition-all duration-500 ml-auto" style={{ width: `${partnerPct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* 오늘 인증 섹션 */}
                                {(() => {
                                    const myToday = getMyTodayLog(challenge.id);
                                    const isVerifying = verifyingBuddyId === challenge.id;
                                    const challengeTitle = challenge.challenge_name?.replace(/\s*\[1일 \d회\]/, '').trim() || challenge.goal_category;
                                    return (
                                        <div className="border-t border-white/5 pt-2 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-white">📅 오늘 인증
                                                    <span className="text-[10px] font-normal text-slate-400 ml-1 truncate">({challengeTitle})</span>
                                                </span>
                                                {myToday?.is_completed ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-bold text-emerald-400">✅ 오늘 완료!</span>
                                                        <button onClick={() => setVerifyingBuddyId(isVerifying ? null : challenge.id)}
                                                            className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors">
                                                            {isVerifying ? '닫기' : '수정'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setVerifyingBuddyId(isVerifying ? null : challenge.id)}
                                                        className="text-[11px] font-bold px-3 py-1 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all active:scale-95">
                                                        {isVerifying ? '닫기' : '인증하기 📸'}
                                                    </button>
                                                )}
                                            </div>
                                            {isVerifying && (
                                                <div className="space-y-2 bg-slate-800/60 p-3 rounded-xl border border-white/5">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="file" accept="image/*,video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) submitBuddyProofImage(challenge.id, f); }} />
                                                        <div className={`flex-1 py-2 rounded-lg text-center text-xs font-bold border ${uploadingBuddy ? 'bg-slate-700 text-slate-400 border-slate-600' : 'bg-primary/15 hover:bg-primary/25 text-primary border-primary/30'}`}>
                                                            {uploadingBuddy ? '업로드 중...' : '📸 사진/동영상으로 인증'}
                                                        </div>
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <input type="text" value={buddyProofText} onChange={e => setBuddyProofText(e.target.value)}
                                                            placeholder="또는 텍스트로 인증 입력..."
                                                            className="flex-1 bg-slate-700/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-primary/50"
                                                            onKeyDown={e => e.key === 'Enter' && submitBuddyProofText(challenge.id)} />
                                                        <button onClick={() => submitBuddyProofText(challenge.id)}
                                                            className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold rounded-lg border border-primary/30">전송</button>
                                                    </div>
                                                </div>
                                            )}
                                            <button onClick={() => {
                                                const next = expandedHistoryId === challenge.id ? null : challenge.id;
                                                setExpandedHistoryId(next);
                                                if (next) fetchBuddyLogs([challenge.id]);
                                            }}
                                                className="w-full text-[10px] text-slate-400 hover:text-white flex items-center justify-center gap-1 py-1 rounded-lg hover:bg-white/5 transition-all">
                                                {expandedHistoryId === challenge.id ? '▲ 인증 히스토리 닫기' : '▼ 인증 히스토리 보기'}
                                            </button>
                                            {expandedHistoryId === challenge.id && (
                                                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                                    {(buddyLogs[challenge.id] || []).length === 0 ? (
                                                        <p className="text-[10px] text-slate-500 text-center py-3">아직 인증 기록이 없습니다.</p>
                                                    ) : (() => {
                                                        const logs = buddyLogs[challenge.id] || [];
                                                        const dateMap: Record<string, {me?: any; partner?: any}> = {};
                                                        logs.forEach(l => {
                                                            if (!dateMap[l.log_date]) dateMap[l.log_date] = {};
                                                            if (l.user_id === user?.id) dateMap[l.log_date].me = l;
                                                            else dateMap[l.log_date].partner = l;
                                                        });
                                                        return Object.entries(dateMap).sort(([a],[b]) => b.localeCompare(a)).map(([date, entry]) => (
                                                            <div key={date} className="bg-slate-800/50 rounded-xl p-2.5 border border-white/5">
                                                                <div className="text-[10px] font-bold text-slate-400 mb-1.5">{date}</div>
                                                                <div className="flex gap-3">
                                                                    <div className="flex-1">
                                                                        <span className="text-[9px] text-primary font-bold block mb-1">나</span>
                                                                        {entry.me?.is_completed ? (
                                                                            entry.me.image_url ? (
                                                                                <a href={entry.me.image_url} target="_blank" rel="noreferrer">
                                                                                    <img src={entry.me.image_url} alt="인증" className="w-full h-20 object-cover rounded-lg hover:opacity-90 transition-opacity" />
                                                                                </a>
                                                                            ) : (
                                                                                <div className="p-2 bg-emerald-900/30 rounded-lg flex items-center justify-center border border-emerald-500/20">
                                                                                    <span className="text-[10px] text-emerald-400 font-medium break-all">💬 {entry.me.proof_text || '완료'}</span>
                                                                                </div>
                                                                            )
                                                                        ) : <div className="h-10 bg-slate-700/30 rounded-lg flex items-center justify-center"><span className="text-[9px] text-slate-500">미완료</span></div>}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <span className="text-[9px] text-accent font-bold block mb-1">{partnerProfile?.nickname || '친구'}</span>
                                                                        {entry.partner?.is_completed ? (
                                                                            entry.partner.image_url ? (
                                                                                <a href={entry.partner.image_url} target="_blank" rel="noreferrer">
                                                                                    <img src={entry.partner.image_url} alt="인증" className="w-full h-20 object-cover rounded-lg hover:opacity-90 transition-opacity" />
                                                                                </a>
                                                                            ) : (
                                                                                <div className="p-2 bg-emerald-900/30 rounded-lg flex items-center justify-center border border-emerald-500/20">
                                                                                    <span className="text-[10px] text-emerald-400 font-medium break-all">💬 {entry.partner.proof_text || '완료'}</span>
                                                                                </div>
                                                                            )
                                                                        ) : <div className="h-10 bg-slate-700/30 rounded-lg flex items-center justify-center"><span className="text-[9px] text-slate-500">미완료</span></div>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 🏆 COMPLETED / PAST BUDDY CHALLENGES (Visible when filter is 'completed') */}
            {missionFilter === 'completed' && buddyChallenges.filter(c => c.status === 'completed' || c.status === 'cancelled').length > 0 && (
                <div className="mb-4 space-y-2 shrink-0">
                    <div className="flex items-center gap-1.5 px-1">
                        <span className="text-sm">🏆</span>
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">완료된 버디 챌린지 히스토리</h3>
                    </div>
                    {buddyChallenges.filter(c => c.status === 'completed' || c.status === 'cancelled').map((challenge) => {
                        const isCreator = challenge.creator_id === user?.id;
                        const partnerProfile = isCreator ? challenge.partner : challenge.creator;
                        const isCancelled = challenge.status === 'cancelled';
                        return (
                            <div key={challenge.id} className="p-3 bg-slate-900/60 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${isCancelled ? 'bg-slate-800 text-slate-500' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {isCancelled ? '⏹️' : '🏆'}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-white">
                                            {challenge.challenge_name || challenge.goal_category} (vs {partnerProfile?.nickname || '친구'})
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            {challenge.start_date} ~ {challenge.end_date || '종료'} · {isCancelled ? '상호 중단' : '완주 성공!'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isCancelled ? 'bg-slate-800 text-slate-400' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                                    {isCancelled ? '종료됨' : '완주 100%'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Friend List */}
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1 no-scrollbar">
                {filteredFriends.length === 0 ? (
                    <div className="text-center py-10 opacity-50">
                        <p className="text-sm">No friends found.</p>
                        <p className="text-xs">Try changing filters or add a friend!</p>
                    </div>
                ) : (
                    filteredFriends.map((friend) => (
                        <div key={friend.uniqueKey} className="p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 p-0.5 shadow-lg shadow-primary/20 shrink-0 relative">
                                        <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                                            {friend.profileImageUrl ? (
                                                <img src={friend.profileImageUrl} alt={friend.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="font-bold text-lg text-white">{friend.name.charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-white text-lg leading-tight">{friend.name}</h3>
                                            {/* Show Group Badge with Edit Option */}
                                            <button
                                                onClick={() => {
                                                    setPendingFriend({ id: friend.id, nickname: friend.name }); // Reuse pendingFriend as target for editing
                                                    setShowAddToGroupModal(true); // Reuse AddToGroup modal for editing
                                                }}
                                                className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[10px] text-slate-400 flex items-center gap-1 transition-colors"
                                            >
                                                {friendGroupMap[friend.id] && friendGroupMap[friend.id].length > 0 ? (
                                                    // Map group IDs to names
                                                    <span>
                                                        {friendGroupMap[friend.id].map(gid => groups.find(g => g.id === gid)?.name).filter(Boolean).join(', ')}
                                                    </span>
                                                ) : (
                                                    <span>No Group</span>
                                                )}
                                                <span className="text-[8px] opacity-50">✎</span>
                                            </button>
                                        </div>
                                        <p className="text-sm text-slate-400 mt-0.5">{friend.targetText}</p>
                                    </div>
                                </div>

                                {/* ⚔️ 대결 상태 버튼: 대결 중이면 '대결 중', 아니면 '대결 신청' */}
                                {(() => {
                                    const activeChallenge = buddyChallenges.find(c =>
                                        c.status === 'active' &&
                                        (c.creator_id === friend.id || c.partner_id === friend.id)
                                    );
                                    const pendingChallenge = buddyChallenges.find(c =>
                                        c.status === 'pending' &&
                                        (c.creator_id === friend.id || c.partner_id === friend.id)
                                    );
                                    if (activeChallenge) {
                                        return (
                                            <div className="px-3 py-1.5 bg-gradient-to-r from-emerald-700/60 to-green-600/60 text-emerald-300 font-extrabold text-xs rounded-xl border border-emerald-500/40 flex items-center gap-1.5 shrink-0">
                                                <Swords size={13} className="text-emerald-300 stroke-[2.5]" />
                                                <span>대결 중 ⚔️</span>
                                            </div>
                                        );
                                    }
                                    if (pendingChallenge) {
                                        return (
                                            <div className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 font-bold text-xs rounded-xl border border-yellow-500/30 flex items-center gap-1.5 shrink-0">
                                                <span>수낙 대기 중 ⏳</span>
                                            </div>
                                        );
                                    }
                                    return (
                                        <button
                                            onClick={() => {
                                                setSelectedBuddy(friend);
                                                setIsBuddyModalOpen(true);
                                            }}
                                            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-primary text-black font-extrabold text-xs rounded-xl shadow-lg shadow-purple-900/40 hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 border border-white/20 shrink-0"
                                            title="1:1 버디 챌린지 신청"
                                        >
                                            <Swords size={14} className="text-black stroke-[2.5]" />
                                            <span>대결 신청 🔥</span>
                                        </button>
                                    );
                                })()} 
                            </div>

                            {/* Stats & Rank */}
                            {friend.hasGoal && (
                                <div className="flex items-center gap-4 mt-2">
                                    {/* Rank Badge */}
                                    {friend.rank && friend.rank <= 3 && (
                                        <div className={`
                                            flex items-center justify-center w-8 h-8 rounded-full font-bold text-white shadow-lg border border-white/10 shrink-0
                                            ${friend.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                                                friend.rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-500' :
                                                    'bg-gradient-to-br from-amber-600 to-amber-800'}
                                        `}>
                                            {friend.rank}
                                        </div>
                                    )}
                                    {friend.rank && friend.rank > 3 && (
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-slate-500 bg-slate-800 border border-white/5 shrink-0">
                                            {friend.rank}
                                        </div>
                                    )}

                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            {/* Left: Stats & Goal */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Trophy size={14} className="text-primary" />
                                                    <span className="text-xs font-medium text-slate-300">{friend.verifiedCount} Missions</span>
                                                </div>
                                                <p className="text-sm text-slate-300">
                                                    <span className="text-primary font-bold">
                                                        {t[friend.goalCategory as keyof typeof t] || friend.goalCategory}
                                                    </span>
                                                    {friend.goalTarget ? ` - ${friend.goalTarget}` : ''}
                                                    {friend.seq && friend.seq > 1 && (
                                                        <span className="text-[10px] text-accent ml-1 font-bold">
                                                            ({t.challengeCount.replace('{n}', friend.seq)})
                                                        </span>
                                                    )}
                                                </p>
                                            </div>

                                            {/* Right: Rate */}
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-400 block">Success Rate</span>
                                                <span className="text-sm font-bold text-white">{friend.completionRate}%</span>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                                            <div
                                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
                                                style={{ width: `${friend.completionRate}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                🗓️ Progress
                                            </span>
                                            <span className="text-[10px] text-white font-bold">{friend.daysInfo}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Activity & Action Row (Combined) */}
                            {friend.hasGoal && (
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    {/* Left: Social Actions */}
                                    <div className="flex items-center gap-3 shrink-0">
                                        <button
                                            onClick={() => toggleLike(friend.userGoal.id)}
                                            className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-pink-500 group"
                                            title="좋아요"
                                            aria-label="좋아요"
                                        >
                                            <Heart
                                                size={16}
                                                className={likesMap[friend.userGoal.id]?.isLiked ? "fill-pink-500 text-pink-500" : "text-slate-400 group-hover:text-pink-500"}
                                            />
                                            <span className={likesMap[friend.userGoal.id]?.isLiked ? "text-pink-500" : "text-slate-400"}>
                                                {likesMap[friend.userGoal.id]?.count || 0}
                                            </span>
                                        </button>

                                        <button
                                            onClick={() => handleComment(friend.userGoal.id)}
                                            className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-blue-400 group"
                                            title="댓글"
                                            aria-label="댓글"
                                        >
                                            <MessageCircle size={16} className="text-slate-400 group-hover:text-blue-400" />
                                            <span className="text-slate-400">
                                                {commentsMap[friend.userGoal.id]?.length || 0}
                                            </span>
                                        </button>
                                    </div>

                                    {/* Right: History Button */}
                                    <div className="flex-1 min-w-0">
                                        {permissionsMap[friend.userGoal.id] === 'approved' ? (
                                            <button
                                                onClick={() => handleViewHistory(friend.userGoal.id)}
                                                className="w-full bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis px-2"
                                            >
                                                <Trophy size={14} className="shrink-0" /> {t.viewMissionHistory}
                                            </button>
                                        ) : permissionsMap[friend.userGoal.id] === 'pending' ? (
                                            <button
                                                disabled
                                                className="w-full bg-slate-800 text-slate-500 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed px-2"
                                            >
                                                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shrink-0" /> {t.requestPending}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleRequestHistory(friend.id, friend.userGoal.id)}
                                                className="w-full bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 px-2"
                                            >
                                                <span className="shrink-0">🔒</span> {t.requestMissionHistory}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Comments Modal / Bottom Sheet */}
            <AnimatePresence>
                {showCommentsId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end"
                        onClick={() => setShowCommentsId(null)}
                    >
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            className="bg-slate-900 border-t border-white/10 rounded-t-3xl w-full max-h-[80vh] flex flex-col overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900 shrink-0">
                                <h3 className="font-bold text-white">Comments</h3>
                                <button onClick={() => setShowCommentsId(null)} className="p-2 text-slate-400 hover:text-white" title="댓글 닫기" aria-label="댓글 닫기">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {commentsMap[showCommentsId]?.length === 0 ? (
                                    <p className="text-center text-slate-500 text-sm py-10">No comments yet. Be the first!</p>
                                ) : (
                                    commentsMap[showCommentsId]?.map(comment => (
                                        <div key={comment.id} className="group flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                                                {comment.profiles?.nickname?.[0] || '?'}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-sm font-bold text-white">{comment.profiles?.nickname}</span>
                                                    <span className="text-[10px] text-slate-500">{new Date(comment.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-slate-300 mt-0.5">{comment.content}</p>
                                            </div>
                                            {comment.user_id === user?.id && (
                                                <button
                                                    onClick={() => deleteComment(comment.id, showCommentsId)}
                                                    className="opacity-0 group-hover:opacity-100 text-red-500 p-2"
                                                    title="댓글 삭제"
                                                    aria-label="댓글 삭제"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Input */}
                            <div className="p-4 bg-slate-900 border-t border-white/5 shrink-0 mb-24">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={commentInput}
                                        onChange={e => setCommentInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && postComment()}
                                        placeholder="Add a comment..."
                                        className="flex-1 bg-slate-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary outline-none"
                                    />
                                    <button
                                        onClick={postComment}
                                        disabled={!commentInput.trim()}
                                        title="댓글 전송"
                                        aria-label="댓글 전송"
                                        className="p-3 bg-primary text-black rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>



            {/* Friend History Modal */}
            <AnimatePresence>
                {viewingGoal && (
                    <HistoryDetail
                        goal={viewingGoal}
                        onClose={() => setViewingGoal(null)}
                    />
                )}
            </AnimatePresence>

            <BuddyChallengeModal
                isOpen={isBuddyModalOpen}
                onClose={() => setIsBuddyModalOpen(false)}
                partner={selectedBuddy}
            />

            <div className="mt-4 text-center shrink-0">
                <button
                    onClick={handleShare}
                    className="flex items-center justify-center gap-2 mx-auto text-primary text-sm font-bold hover:underline"
                >
                    <Share2 size={16} />
                    <span>{t.shareInviteLink}</span>
                </button>
            </div>

            {/* Create Group Modal */}
            <AnimatePresence>
                {showGroupModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowGroupModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-white mb-4">Create Friend Group</h3>
                            <input
                                type="text"
                                placeholder="Group Name (e.g. Family)"
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white mb-4 focus:ring-1 focus:ring-primary outline-none"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowGroupModal(false)}
                                    className="flex-1 py-3 rounded-xl font-bold bg-white/5 text-slate-400 hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createGroup}
                                    disabled={!newGroupName.trim()}
                                    className="flex-1 py-3 rounded-xl font-bold bg-primary text-black hover:bg-primary/90 disabled:opacity-50"
                                >
                                    Create
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Group Modal */}
            <AnimatePresence>
                {showEditGroupModal && editingGroup && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowEditGroupModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-white mb-4">Manage Group: {editingGroup.name}</h3>
                            <input
                                type="text"
                                placeholder="New Name"
                                defaultValue={editingGroup.name}
                                id="groupNewName"
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white mb-4 focus:ring-1 focus:ring-primary outline-none"
                            />
                            <div className="flex gap-2 mb-2">
                                <button
                                    onClick={() => updateGroup(editingGroup.id, (document.getElementById('groupNewName') as HTMLInputElement).value)}
                                    className="flex-1 py-3 rounded-xl font-bold bg-primary text-black hover:bg-primary/90"
                                >
                                    Rename
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => deleteGroup(editingGroup.id)}
                                    className="flex-1 py-3 rounded-xl font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                >
                                    Delete Group
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add To/Edit Group Modal */}
            <AnimatePresence>
                {showAddToGroupModal && pendingFriend && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowAddToGroupModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-white mb-2">
                                {friends.some(f => f.id === pendingFriend.id) ? `Manage ${pendingFriend.nickname}` : `Add ${pendingFriend.nickname}`}
                            </h3>
                            <p className="text-sm text-slate-400 mb-4">
                                {friends.some(f => f.id === pendingFriend.id) ? "Select groups for this friend." : "Select a group to add this friend to."}
                            </p>

                            <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
                                {groups.map(g => {
                                    const isAlreadyFriend = friends.some(f => f.id === pendingFriend.id);
                                    const isMember = friendGroupMap[pendingFriend.id]?.includes(g.id);

                                    return (
                                        <button
                                            key={g.id}
                                            onClick={async () => {
                                                if (isAlreadyFriend) {
                                                    // EDIT MODE: Toggle Logic
                                                    if (isMember) {
                                                        await supabase.from('friend_group_members').delete().match({ group_id: g.id, member_id: pendingFriend.id });
                                                    } else {
                                                        await supabase.from('friend_group_members').insert({ group_id: g.id, member_id: pendingFriend.id });
                                                    }
                                                    await fetchFriends();
                                                } else {
                                                    // ADD MODE: Add Friend + Group immediately
                                                    executeAddFriend(pendingFriend, g.id);
                                                }
                                            }}
                                            className={`w-full p-3 rounded-xl border flex items-center justify-between group transition-colors ${isMember
                                                ? 'bg-primary/10 border-primary text-white'
                                                : isAlreadyFriend
                                                    ? 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10' // Edit mode inactive
                                                    : 'bg-white/5 hover:bg-primary/20 hover:border-primary/50 border-transparent text-slate-400 hover:text-white' // Add mode hover effect
                                                }`}
                                        >
                                            <span className="font-bold">{g.name}</span>
                                            {isMember && <Check size={16} className="text-primary" />}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => {
                                        setShowAddToGroupModal(false);
                                        setShowGroupModal(true);
                                    }}
                                    className="w-full p-3 rounded-xl border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-white/50 flex items-center justify-center gap-2 mt-2"
                                >
                                    <Plus size={14} /> Create New Group
                                </button>
                            </div>

                            {/* Logic for Bottom Button */}
                            {friends.some(f => f.id === pendingFriend.id) ? (
                                <button
                                    onClick={() => setShowAddToGroupModal(false)}
                                    className="w-full py-3 rounded-xl font-bold bg-white/5 text-slate-300 hover:bg-white/10"
                                >
                                    Done
                                </button>
                            ) : (
                                <button
                                    onClick={() => executeAddFriend(pendingFriend, null)}
                                    className="w-full py-3 rounded-xl font-bold bg-white/5 text-slate-300 hover:bg-white/10"
                                >
                                    Skip Group (Just Add)
                                </button>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );

}
