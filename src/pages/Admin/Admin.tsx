import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, User, Calendar, Save, Search, X, Check, CreditCard, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Hardcoded Credentials (MVP)
const ADMIN_ID = 'grangge';
const ADMIN_PASS = 'wolsong74!';

export default function Admin() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [credentials, setCredentials] = useState({ id: '', password: '' });

    // Admin Data State
    const [globalPaywallDay, setGlobalPaywallDay] = useState(5);
    const [users, setUsers] = useState<any[]>([]);
    const [deletedUsers, setDeletedUsers] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'active' | 'deleted'>('active');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // User Detail Modal State
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userMissions, setUserMissions] = useState<any[]>([]);
    const [userPayments, setUserPayments] = useState<any[]>([]);
    const [customTrialDays, setCustomTrialDays] = useState<number | null>(null);

    useEffect(() => {
        if (isAuthenticated) {
            fetchGlobalSettings();
            fetchUsers();
        }
    }, [isAuthenticated]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (credentials.id === ADMIN_ID && credentials.password === ADMIN_PASS) {
            setIsAuthenticated(true);
        } else {
            alert('Invalid credentials');
        }
    };

    const fetchGlobalSettings = async () => {
        const { data } = await supabase.from('admin_settings').select('value').eq('key', 'paywall_start_day').single();
        if (data) setGlobalPaywallDay(parseInt(data.value));
    };

    const fetchUsers = async () => {
        setLoading(true);
        // Fetch profiles
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, nickname, created_at, custom_free_trial_days')
            .order('created_at', { ascending: false });

        // Fetch ALL subscriptions
        const { data: rawSubs } = await supabase
            .from('subscriptions')
            .select('user_id, status, type, target_id, start_date, end_date');

        // Fetch Cancelled Payments for Consistency Check
        const { data: cancelledPayments } = await supabase
            .from('payments')
            .select('user_id, coverage_start_date, coverage_end_date')
            .eq('status', 'cancelled');

        const subs = rawSubs?.filter(s => {
            // Filter out explicitly cancelled subscriptions from DB
            if (s.status === 'cancelled') return false;

            if (!cancelledPayments) return true;
            // Exclude if matches a cancelled payment (Double check for consistency)
            return !cancelledPayments.some(p =>
                p.user_id === s.user_id &&
                p.coverage_start_date === s.start_date &&
                p.coverage_end_date === s.end_date
            );
        });

        // Fetch Deleted Users
        const { data: deleted } = await supabase
            .from('deleted_users')
            .select('*')
            .order('deleted_at', { ascending: false });

        if (deleted) {
            setDeletedUsers(deleted);
        }

        if (profiles) {
            const enriched = profiles.map(p => {
                // Case-insensitive comparison just in case
                const userSubs = subs?.filter(s => s.user_id?.toLowerCase() === p.id?.toLowerCase()) || [];
                // Sort so 'all' comes first, then by date
                userSubs.sort((a: any, _b: any) => (a.type === 'all' ? -1 : 1));

                return {
                    ...p,
                    is_premium: userSubs.length > 0,
                    subscriptions: userSubs
                };
            });
            setUsers(enriched);
        }
        setLoading(false);
    };

    const updateGlobalPaywall = async () => {
        const { error } = await supabase
            .from('admin_settings')
            .upsert({ key: 'paywall_start_day', value: String(globalPaywallDay) });

        if (error) alert('Error updating global settings');
        else alert('Global settings updated!');
    };

    const updateUserTrial = async () => {
        if (!selectedUser) return;
        const { error } = await supabase
            .from('profiles')
            .update({ custom_free_trial_days: customTrialDays })
            .eq('id', selectedUser.id);

        if (error) {
            alert('Failed to update user trial limit');
        } else {
            alert('User trial limit updated!');
            // Update local state
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, custom_free_trial_days: customTrialDays } : u));
            setSelectedUser({ ...selectedUser, custom_free_trial_days: customTrialDays });
        }
    };

    const openUserDetail = async (user: any) => {
        setSelectedUser(user);
        setCustomTrialDays(user.custom_free_trial_days);

        // Fetch user_goals (Plans/Missions)
        const { data: goals } = await supabase
            .from('user_goals')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        // Fetch payments
        const { data: payments } = await supabase
            .from('payments')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        setUserMissions(goals || []);
        setUserPayments(payments || []);
    };

    // Filter users
    const filteredUsers = users.filter(u =>
        (u.nickname && u.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredDeletedUsers = deletedUsers.filter(u =>
        (u.nickname && u.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.original_user_id && u.original_user_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );



    // Helper to calculate duration in months (approx)
    const getDuration = (start: string, end: string) => {
        const s = new Date(start);
        const e = new Date(end);
        const diffMonth = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
        return diffMonth > 0 ? `${diffMonth} Months` : '1 Month';
    };

    const cancelPayment = async (id: string) => {
        if (!confirm('정말 이 결제를 취소하시겠습니까? 기록은 유지되지만 취소 상태로 변경됩니다.')) return;

        // 1. Get Payment Info needed to find subscription
        const { data: payment } = await supabase
            .from('payments')
            .select('coverage_start_date, coverage_end_date')
            .eq('id', id)
            .single();

        // 2. Cancel Payment
        const { error } = await supabase.from('payments').update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
        }).eq('id', id);

        if (error) {
            alert('취소 실패: ' + error.message);
        } else {
            // 3. Cancel corresponding subscription
            if (payment?.coverage_start_date && payment?.coverage_end_date && selectedUser) {
                await supabase
                    .from('subscriptions')
                    .update({ status: 'cancelled' })
                    .eq('user_id', selectedUser.id)
                    .eq('start_date', payment.coverage_start_date)
                    .eq('end_date', payment.coverage_end_date);
            }

            alert('결제가 취소되었습니다. (구독 정보 업데이트 완료)');
            if (selectedUser) openUserDetail(selectedUser);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="h-screen w-full bg-slate-950 flex items-center justify-center">
                <form onSubmit={handleLogin} className="w-96 bg-slate-900 p-8 rounded-2xl border border-white/10 shadow-xl">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                            <Lock size={32} className="text-accent" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-center mb-6 text-white">Admin Access</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1 uppercase font-bold">Admin ID</label>
                            <input
                                type="text"
                                value={credentials.id}
                                onChange={e => setCredentials({ ...credentials, id: e.target.value })}
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-accent outline-none"
                                placeholder="Enter admin ID"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1 uppercase font-bold">Password</label>
                            <input
                                type="password"
                                value={credentials.password}
                                onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-accent outline-none"
                                placeholder="Enter password"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 rounded-lg transition-colors mt-2"
                        >
                            Login Dashboard
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-slate-950 text-white overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Settings className="text-accent" /> 관리자 대시보드
                </h1>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-lg border border-white/5">
                        <span className="text-xs text-slate-400">전역 무료 체험(일):</span>
                        <input
                            type="number"
                            value={globalPaywallDay}
                            onChange={e => setGlobalPaywallDay(parseInt(e.target.value))}
                            className="w-12 bg-transparent text-center font-bold outline-none"
                        />
                        <button onClick={updateGlobalPaywall} className="text-accent hover:text-white"><Save size={16} /></button>
                    </div>
                    <button onClick={() => setIsAuthenticated(false)} className="text-xs text-slate-500 hover:text-white">로그아웃</button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* User List */}
                <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-6">
                    {/* Header Controls */}
                    <div className="flex flex-col gap-4 mb-4 shrink-0">
                        <h2 className="text-2xl font-bold">회원 관리 (User Management)</h2>

                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full">
                            <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="이름 또는 이메일 검색..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full sm:w-64 bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm focus:border-accent outline-none focus:bg-white/10 transition-colors"
                                />
                            </div>

                            <div className="flex bg-black/40 p-1 rounded-lg border border-white/10 w-full sm:w-auto">
                                <button
                                    onClick={() => setViewMode('active')}
                                    className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'active' ? 'bg-primary text-black' : 'text-slate-400 hover:text-white'}`}
                                >
                                    정상 회원 (Active)
                                </button>
                                <button
                                    onClick={() => setViewMode('deleted')}
                                    className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'deleted' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    탈퇴 회원 (Deleted)
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-2xl border border-white/5 flex-1 overflow-hidden flex flex-col shadow-xl relative">
                        {/* Column Headers (Optional, mostly for desktop, or just hide for card view) */}
                        <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-bold text-slate-500 bg-slate-900/50 sticky top-0 z-10">
                            <div className="col-span-4">User Details</div>
                            <div className="col-span-4">Subscription</div>
                            <div className="col-span-2">Joined</div>
                            <div className="col-span-2 text-right">Action</div>
                        </div>

                        <div className="overflow-y-auto flex-1 p-2 pb-24 no-scrollbar">
                            {loading ? (
                                <div className="text-center py-10 text-slate-500">로딩중...</div>
                            ) : viewMode === 'active' ? (
                                filteredUsers.map(user => (
                                    <div key={user.id || 'unknown'} className="bg-white/5 rounded-xl p-4 mb-2 border border-white/5 flex flex-col gap-3">
                                        {/* Row 1: Who + Main Status */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                                                    <User size={16} className="text-slate-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-sm text-white truncate flex items-center gap-2">
                                                        {user.nickname || 'Guest'}
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${user.custom_free_trial_days ? 'bg-accent/10 text-accent' : 'bg-slate-700 text-slate-400'}`}>
                                                            {user.custom_free_trial_days || globalPaywallDay}일
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 truncate">{user.email || 'No Email'}</div>
                                                </div>
                                            </div>
                                            {/* Action Button (Top Right for easy access) */}
                                            <button
                                                onClick={() => openUserDetail(user)}
                                                className="shrink-0 bg-primary/10 text-primary border border-primary/20 rounded-lg p-2 hover:bg-primary/20 transition-colors"
                                            >
                                                <Settings size={16} />
                                            </button>
                                        </div>

                                        {/* Row 2: Sub Details + Date */}
                                        <div className="flex justify-between items-end border-t border-white/5 pt-2 mt-1">
                                            <div className="flex-1 min-w-0 mr-2">
                                                {user.subscriptions && user.subscriptions.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {user.subscriptions.map((sub: any, idx: number) => (
                                                            <span key={idx} className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/5 text-slate-300 px-1.5 py-0.5 rounded border border-white/10 whitespace-nowrap">
                                                                <span className={sub.type === 'all' ? "text-purple-400" : "text-emerald-400"}>
                                                                    {sub.type === 'all' ? '전체' : sub.target_id}
                                                                </span>
                                                                <span className="text-slate-600">|</span>
                                                                {getDuration(sub.start_date, sub.end_date)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-500">구독 없음</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-600 whitespace-nowrap">
                                                가입일 {new Date(user.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                filteredDeletedUsers.map(user => (
                                    <div key={user.id} className="bg-red-500/5 rounded-xl p-4 mb-2 border border-red-500/10 flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-red-900/20 flex items-center justify-center shrink-0">
                                                    <User size={14} className="text-red-500" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-slate-300">{user.nickname || 'Unknown'}</div>
                                                    <div className="text-[10px] text-slate-500">{user.email}</div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                                                삭제일: {new Date(user.deleted_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-600 font-mono pl-11">
                                            ID: {user.original_user_id}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* User Detail Panel (Right Side Modal/Panel) - Only for Active */}
                <AnimatePresence>
                    {selectedUser && viewMode === 'active' && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            className="w-96 bg-slate-900 border-l border-white/10 p-6 shadow-2xl flex flex-col h-full"
                        >
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <h3 className="text-lg font-bold">회원 상세 정보</h3>
                                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-white/10 rounded-full">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 pb-20 no-scrollbar">
                                {/* Profile Info */}
                                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border-2 border-white/10">
                                            <User size={24} className="text-slate-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-base text-white truncate">{selectedUser.nickname}</h4>
                                            <p className="text-[10px] text-slate-500 truncate">{selectedUser.email}</p>
                                            <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate max-w-[200px]">{selectedUser.id}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-center">
                                        <div className="bg-white/5 p-2 rounded-lg">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">구독 상태</p>
                                            <p className={`font-bold text-sm ${selectedUser.is_premium ? 'text-accent' : 'text-slate-400'}`}>
                                                {selectedUser.is_premium ? 'Premium' : 'Free'}
                                            </p>
                                        </div>
                                        <div className="bg-white/5 p-2 rounded-lg">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">가입일</p>
                                            <p className="text-sm font-bold text-white">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Free Trial Control */}
                                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                    <h4 className="font-bold text-xs mb-2 flex items-center gap-2 text-white">
                                        <Calendar size={14} className="text-primary" /> 무료 체험 기간 설정
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={customTrialDays || ''}
                                                placeholder={String(globalPaywallDay)}
                                                onChange={e => setCustomTrialDays(parseInt(e.target.value) || null)}
                                                className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2 text-center font-bold text-sm focus:border-primary outline-none text-white h-9"
                                            />
                                            <button
                                                onClick={updateUserTrial}
                                                className="bg-primary hover:bg-primary/90 text-white w-9 h-9 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20"
                                            >
                                                <Save size={16} />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-tight">
                                            기본 <span className="text-slate-300 font-bold">{globalPaywallDay}일</span>.
                                            {customTrialDays && customTrialDays !== globalPaywallDay && (
                                                <span className="text-green-400 ml-1 font-bold">
                                                    (사용자 지정 {customTrialDays}일 적용 중)
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Active Missions */}
                                <div className="flex flex-col flex-1 min-h-[300px] bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                                    <div className="p-3 border-b border-white/5 bg-white/5">
                                        <h4 className="font-bold text-xs flex items-center gap-2 text-white">
                                            <CreditCard size={14} className="text-purple-400" /> 미션 내역 (History)
                                        </h4>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 no-scrollbar space-y-2">
                                        {userMissions.length === 0 ? (
                                            <p className="text-xs text-slate-500 text-center py-10">미션 내역이 없습니다.</p>
                                        ) : (
                                            userMissions.map(m => {
                                                const dayCount = Math.floor((new Date().getTime() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                                return (
                                                    <div key={m.id} className="bg-white/5 p-2.5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded uppercase">
                                                                {m.category || '기타'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 font-mono">
                                                                {new Date(m.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-bold text-white line-clamp-2 mt-0.5">{m.target_text || '목표 없음'}</p>
                                                        <div className="flex justify-between items-center mt-1.5">
                                                            <span className="text-[10px] text-accent font-bold">
                                                                D+{dayCount}
                                                            </span>
                                                            {/* m.seq 체크 */}
                                                            {m.seq && <span className="text-[10px] text-slate-600">Challenge #{m.seq}</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Subscription History */}
                                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                    <h4 className="font-bold text-xs mb-2 flex items-center gap-2 text-white">
                                        <Check size={14} className="text-emerald-400" /> 구독 정보 (Subscription)
                                    </h4>
                                    <div className="space-y-2">
                                        {(!selectedUser.subscriptions || selectedUser.subscriptions.length === 0) ? (
                                            <p className="text-[10px] text-slate-500 text-center py-2">구독 내역이 없습니다.</p>
                                        ) : (
                                            selectedUser.subscriptions.map((sub: any, idx: number) => (
                                                <div key={idx} className="bg-white/5 p-2 rounded-lg border border-white/5 flex justify-between items-center">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${sub.type === 'all' ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                                                {sub.type === 'all' ? '전체 플랜' : sub.target_id}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 font-mono mt-1">
                                                            {new Date(sub.start_date).toLocaleDateString()} ~ {new Date(sub.end_date).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] text-white font-bold">{getDuration(sub.start_date, sub.end_date)}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Payment History */}
                                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                    <h4 className="font-bold text-xs mb-2 flex items-center gap-2 text-white">
                                        <CreditCard size={14} className="text-blue-400" /> 결제 내역 (Payment)
                                    </h4>
                                    <div className="space-y-2">
                                        {userPayments.length === 0 ? (
                                            <p className="text-[10px] text-slate-500 text-center py-2">결제 내역이 없습니다.</p>
                                        ) : (
                                            userPayments.map((pay: any, idx: number) => {
                                                const isCancelled = pay.status === 'cancelled' || !!pay.cancelled_at;
                                                return (
                                                    <div key={idx} className="bg-white/5 p-2 rounded-lg border border-white/5 flex justify-between items-center">
                                                        <div>
                                                            <p className={`text-xs font-bold uppercase ${isCancelled ? 'text-slate-500 line-through' : 'text-white'}`}>
                                                                {pay.item_name || 'Premium Plan'}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                                {new Date(pay.created_at).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            {isCancelled ? (
                                                                <div className="text-[10px] text-red-400 font-bold text-right">
                                                                    취소됨<br />
                                                                    <span className="font-mono text-[9px] text-slate-500">
                                                                        {new Date(pay.cancelled_at).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <span className="text-xs font-bold text-accent">${pay.amount}</span>
                                                                    <button
                                                                        onClick={() => cancelPayment(pay.id)}
                                                                        className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 hover:bg-red-500/30"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
