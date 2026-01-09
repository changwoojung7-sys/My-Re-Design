import { useEffect, useState } from 'react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, Phone, Share2, User, Mail, Calendar, Trophy, Heart, MessageCircle, Send, Trash2, X, Users } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';

export default function Friends() {
    const { user } = useStore();
    const { t } = useLanguage();
    const [friends, setFriends] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [foundUser, setFoundUser] = useState<any | null>(null);
    const [searching, setSearching] = useState(false);

    // Social State
    const [likesMap, setLikesMap] = useState<Record<string, { count: number, isLiked: boolean }>>({});
    const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
    const [showCommentsId, setShowCommentsId] = useState<string | null>(null);
    const [commentInput, setCommentInput] = useState('');

    useEffect(() => {
        if (user) fetchFriends();
    }, [user]);

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
                            userGoal: goal,
                            hasGoal: true,
                            targetText: goal.target_text ? `[${goal.category.toUpperCase()}] ${goal.target_text}` : goal.category,
                            daysInfo: `${diffDays} / ${totalDays} Days`,
                            verifiedCount: verifiedCount,
                            completionRate: completionRate,
                            goalsTotalDays: diffDays
                        });
                    });
                }
            });

            // 8. Sorting / Ranking Logic
            enrichedList.sort((a, b) => {
                if (!a.hasGoal) return 1;
                if (!b.hasGoal) return -1;

                if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
                if (b.goalsTotalDays !== a.goalsTotalDays) return b.goalsTotalDays - a.goalsTotalDays;
                return b.verifiedCount - a.verifiedCount;
            });

            // Add Ranking
            const rankedList = enrichedList.map((item, index) => ({
                ...item,
                rank: item.hasGoal ? index + 1 : null
            }));

            setFriends(rankedList);
        } catch (error) {
            console.error('Error fetching friends:', error);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setFoundUser(null);

        try {
            let query = supabase.from('profiles').select('*').neq('id', user!.id);

            if (searchQuery.includes('@')) {
                query = query.eq('email', searchQuery);
            } else {
                query = query.eq('phone_number', searchQuery.replace(/-/g, ''));
            }

            const { data } = await query.maybeSingle();

            if (data) {
                setFoundUser(data);
            } else {
                alert("User not found.");
            }
        } catch (err) {
            alert("Error searching user.");
        }
        setSearching(false);
    };

    const addFriend = async () => {
        if (!foundUser || !user) return;
        try {
            const { error } = await supabase.from('friends').insert({
                user_id: user.id,
                friend_id: foundUser.id,
                status: 'accepted'
            });
            if (error) throw error;

            alert(`Added ${foundUser.nickname || 'Friend'}!`);
            setFoundUser(null);
            setSearchQuery('');
            fetchFriends();
        } catch (err) {
            // @ts-ignore
            if (err.code === '23505') alert("Already friends!");
            else alert("Failed to add friend.");
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

    return (
        <div className="w-full flex-1 min-h-0 flex flex-col p-6 pt-10 pb-20">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">Friends</h1>
                <div className="bg-white/5 px-4 py-2 rounded-full flex items-center gap-2 border border-white/5">
                    <Users size={14} className="text-accent" />
                    <span className="text-xs font-bold text-white shadow-sm">{friends.length}</span>
                </div>
            </div>

            {/* Search Section */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-white/10 mb-8 shadow-lg shrink-0">
                <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
                    <UserPlus size={16} /> {t.addFriend}
                </h3>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder={t.searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary text-white"
                        />
                        {searchQuery.includes('@') ? (
                            <Mail className="absolute left-3 top-3.5 text-slate-500" size={16} />
                        ) : (
                            <Phone className="absolute left-3 top-3.5 text-slate-500" size={16} />
                        )}
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={searching}
                        className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-4 py-3 transition-colors"
                    >
                        <Search size={20} />
                    </button>
                </div>

                {/* Search Result */}
                {foundUser && (
                    <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                                <User size={20} className="text-slate-300" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">{foundUser.nickname || 'Unknown User'}</p>
                                <p className="text-[10px] text-slate-400">
                                    {foundUser.email ? 'Found via Email' : 'Found User'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={addFriend}
                            className="bg-primary text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90"
                        >
                            Add
                        </button>
                    </div>
                )}
            </div>

            {/* Friend List */}
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1 custom-scrollbar">
                {friends.length === 0 ? (
                    <div className="text-center py-10 opacity-50">
                        <p className="text-sm">No friends yet.</p>
                        <p className="text-xs">Add a friend via phone or email!</p>
                    </div>
                ) : (
                    friends.map((friend) => (
                        <div key={friend.uniqueKey} className="p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-primary/20 shrink-0">
                                        {friend.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg leading-tight">{friend.name}</h3>
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
                                        <div className="flex justify-between items-end mb-1">
                                            <div className="flex items-center gap-2">
                                                <Trophy size={14} className="text-primary" />
                                                <span className="text-xs font-medium text-slate-300">{friend.verifiedCount} Missions</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-400 block">Success Rate</span>
                                                <span className="text-sm font-bold text-white">{friend.completionRate}%</span>
                                            </div>

                                        </div>

                                        {/* Progress Bar */}
                                        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
                                                style={{ width: `${friend.completionRate}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between mt-1">
                                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                🗓️ Progress
                                            </span>
                                            <span className="text-[10px] text-white font-bold">{friend.daysInfo}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Social Actions */}
                            {friend.hasGoal && (
                                <div className="mt-3 pt-3 border-t border-white/5 flex gap-4">
                                    <button
                                        onClick={() => toggleLike(friend.userGoal.id)}
                                        className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-pink-500 group"
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
                                    >
                                        <MessageCircle size={16} className="text-slate-400 group-hover:text-blue-400" />
                                        <span className="text-slate-400">
                                            {commentsMap[friend.userGoal.id]?.length || 0}
                                        </span>
                                    </button>
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
                                <button onClick={() => setShowCommentsId(null)} className="p-2 text-slate-400 hover:text-white">
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
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Input */}
                            <div className="p-4 bg-slate-900 border-t border-white/5 shrink-0 mb-4">
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

            <div className="mt-4 text-center shrink-0">
                <button className="flex items-center justify-center gap-2 mx-auto text-primary text-sm font-bold hover:underline">
                    <Share2 size={16} />
                    <span>Share Invite Link</span>
                </button>
            </div>
        </div>
    );
}
