import { useEffect, useState } from 'react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, Share2, User, Trophy, Heart, MessageCircle, Send, Trash2, X, Users, Plus, Check } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import HistoryDetail from '../History/HistoryDetail';

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

    useEffect(() => {
        if (user) {
            fetchGroups();
            fetchFriends();
        }
    }, [user]);

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
                            <div className="flex justify-between items-start mb-2">
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
