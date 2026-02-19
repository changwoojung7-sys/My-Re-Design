import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, User, Calendar, Save, Search, X, Check, CreditCard, Settings, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Hardcoded Credentials (MVP)
const ADMIN_ID = 'grangge';
const ADMIN_PASS = 'wolsong74!';

export default function Admin() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [credentials, setCredentials] = useState({ id: '', password: '' });

    // Admin Data State
    const [globalPaywallDay, setGlobalPaywallDay] = useState(5);
    const [paywallMode, setPaywallMode] = useState<'subscription' | 'ads'>('subscription');
    const [paymentMode, setPaymentMode] = useState<'test' | 'real'>('test');
    const [adSlotId, setAdSlotId] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [deletedUsers] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'active' | 'deleted'>('active');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Detailed View State
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [customTrialDays, setCustomTrialDays] = useState<number | null>(null);
    const [userMissions, setUserMissions] = useState<any[]>([]);
    const [userPayments, setUserPayments] = useState<any[]>([]);

    // Password Reset State
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Data Fetching
    const fetchUsers = async () => {
        setLoading(true);
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching users:', error);
            setLoading(false);
            return;
        }

        // Fetch subscriptions for all fetched users to enrich the list
        const userIds = profiles.map(p => p.id);
        const { data: subs } = await supabase
            .from('subscriptions')
            .select('*')
            .in('user_id', userIds)
            .order('created_at', { ascending: false });

        // Join subscriptions to users
        const enrichedUsers = profiles.map(user => ({
            ...user,
            subscriptions: subs?.filter(s => s.user_id === user.id) || []
        }));

        setUsers(enrichedUsers);
        setLoading(false);
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (credentials.id === ADMIN_ID && credentials.password === ADMIN_PASS) {
            setIsAuthenticated(true);
            fetchGlobalSettings();
            fetchUsers();
        } else {
            alert('Admin Login Failed: Invalid Credentials');
        }
    };

    const handlePasswordReset = async () => {
        if (!selectedUser || !newPassword) return;
        if (newPassword !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        const { error } = await supabase.auth.admin.updateUserById(
            selectedUser.id,
            { password: newPassword }
        );

        if (error) {
            alert('Password reset failed: ' + error.message);
        } else {
            alert('Password updated successfully');
            setShowPasswordReset(false);
            setNewPassword('');
            setConfirmPassword('');
        }
    };

    const fetchGlobalSettings = async () => {
        const { data: dayData } = await supabase.from('admin_settings').select('value').eq('key', 'paywall_start_day').single();
        if (dayData) setGlobalPaywallDay(parseInt(dayData.value));

        const { data: modeData } = await supabase.from('admin_settings').select('value').eq('key', 'paywall_mode').single();
        if (modeData) setPaywallMode(modeData.value as 'subscription' | 'ads');

        const { data: slotData } = await supabase.from('admin_settings').select('value').eq('key', 'ad_slot_id').single();
        if (slotData) setAdSlotId(slotData.value);

        const { data: payModeData } = await supabase.from('admin_settings').select('value').eq('key', 'payment_mode').single();
        if (payModeData) setPaymentMode(payModeData.value as 'test' | 'real');
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchUsers();
            fetchGlobalSettings();
        }
    }, [isAuthenticated]);

    const updateGlobalPaywall = async () => {
        const { error: errorDay } = await supabase
            .from('admin_settings')
            .upsert({ key: 'paywall_start_day', value: String(globalPaywallDay) });

        const { error: errorMode } = await supabase
            .from('admin_settings')
            .upsert({ key: 'paywall_mode', value: paywallMode });

        const { error: errorSlot } = await supabase
            .from('admin_settings')
            .upsert({ key: 'ad_slot_id', value: adSlotId });

        const { error: errorPayMode } = await supabase
            .from('admin_settings')
            .upsert({ key: 'payment_mode', value: paymentMode });

        if (errorDay || errorMode || errorSlot || errorPayMode) alert('Error updating global settings');
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
        // Fetch fresh data first to ensure sync
        const { data: freshUser } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const { data: freshSubs } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });

        // Calculate enriched fields
        const enrichedUser = {
            ...freshUser,
            // Fallback to existing user data if fresh fetch fails (though unlikely)
            nickname: freshUser?.nickname || user.nickname,
            email: freshUser?.email || user.email,
            subscriptions: freshSubs || [],
            is_premium: freshSubs?.some((s: any) => s.type === 'all' && s.status === 'active'),
            active_plan: freshSubs?.find((s: any) => s.status === 'active' && s.type !== 'all')?.target_id
        };

        setSelectedUser(enrichedUser);
        setCustomTrialDays(enrichedUser.custom_free_trial_days);

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

    const cancelPayment = async (id: string, imp_uid?: string, merchant_uid?: string, isForce: boolean = false) => {
        const confirmMsg = isForce
            ? '⚠️ [강제 취소] \nPG사 연동 없이 DB에서만 취소 처리하시겠습니까?\n(실제 결제가 안 된 건을 정리할 때 사용하세요)'
            : '정말 이 결제를 취소하시겠습니까?';

        if (!confirm(confirmMsg)) return;

        try {
            // Call Edge Function for Secure Cancellation
            const { data, error } = await supabase.functions.invoke('cancel-payment', {
                body: {
                    imp_uid: imp_uid,
                    merchant_uid: merchant_uid,
                    payment_id: id,
                    reason: isForce ? 'Force Cancelled by Admin' : 'Admin cancelled payment via Dashboard',
                    action: isForce ? 'force_cancel' : 'cancel'
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            alert('결제가 취소되었습니다. (구독 정보 및 회원 등급 업데이트 완료)');
            await fetchUsers(); // Refresh main list
            if (selectedUser) openUserDetail(selectedUser); // Refresh modal with fresh data
        } catch (error: any) {
            console.error('Cancellation error:', error);
            alert('취소 실패: ' + error.message);
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
            <div className="p-4 border-b border-white/10 flex flex-col xl:flex-row justify-between items-center bg-slate-900 gap-4">
                {/* Title */}
                <div className="flex w-full xl:w-auto justify-start items-center">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Settings className="text-accent" /> 관리자 대시보드
                    </h1>
                </div>

                {/* Controls Area */}
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 w-full xl:w-auto">

                    {/* Settings Group */}
                    <div className="flex flex-wrap items-center justify-center gap-2 bg-black/20 p-2 rounded-xl border border-white/5 shadow-inner">
                        {/* Trial Days Input */}
                        <div className="flex flex-col items-center justify-center bg-white/5 px-3 py-1 rounded-lg border border-white/5 hover:border-white/10 transition-colors h-14 min-w-[80px]">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">전역 무료 체험</span>
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    value={globalPaywallDay}
                                    onChange={e => setGlobalPaywallDay(parseInt(e.target.value))}
                                    className="w-8 bg-transparent text-center font-bold text-sm text-white outline-none appearance-none"
                                />
                                <span className="text-[10px] text-slate-500 font-bold">일</span>
                            </div>
                        </div>

                        <div className="hidden sm:block w-px h-6 bg-white/10 mx-1"></div>

                        {/* Mode Toggle */}
                        <div className="flex flex-col items-center justify-center bg-white/5 px-3 py-1 rounded-lg border border-white/5 hover:border-white/10 transition-colors h-14 w-[140px]">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Paywall Mode</span>
                            <select
                                value={paywallMode}
                                onChange={(e) => setPaywallMode(e.target.value as 'subscription' | 'ads')}
                                className="bg-transparent text-xs font-bold text-accent outline-none cursor-pointer text-center w-full"
                            >
                                <option value="subscription" className="bg-slate-900 text-white">구독 유도 (Sub)</option>
                                <option value="ads" className="bg-slate-900 text-white">광고 보기 (Ads)</option>
                            </select>
                        </div>

                        <div className="hidden sm:block w-px h-6 bg-white/10 mx-1"></div>

                        {/* Payment Mode Toggle */}
                        <div className="flex flex-col items-center justify-center bg-white/5 px-3 py-1 rounded-lg border border-white/5 hover:border-white/10 transition-colors h-14 w-[140px]">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Payment Mode</span>
                            <select
                                value={paymentMode}
                                onChange={(e) => setPaymentMode(e.target.value as 'test' | 'real')}
                                className={`bg-transparent text-xs font-bold outline-none cursor-pointer text-center w-full ${paymentMode === 'real' ? 'text-red-400' : 'text-emerald-400'}`}
                            >
                                <option value="test" className="bg-slate-900 text-emerald-400">테스트 (Test)</option>
                                <option value="real" className="bg-slate-900 text-red-400">실연동 (Real)</option>
                            </select>
                        </div>

                        <div className="hidden sm:block w-px h-6 bg-white/10 mx-1"></div>

                        {/* Ad Slot ID Input */}
                        <div className="flex flex-col items-center justify-center bg-white/5 px-3 py-1 rounded-lg border border-white/5 hover:border-white/10 transition-colors h-14">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Ad Slot ID</span>
                            <input
                                type="text"
                                value={adSlotId}
                                onChange={e => setAdSlotId(e.target.value)}
                                placeholder="e.g. 1234567890"
                                className="w-24 bg-transparent text-center font-bold text-xs text-white outline-none placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    {/* Actions Group (Save & Logout) */}
                    <div className="flex items-center gap-2 ml-2">
                        {/* Unified Save Button */}
                        <button
                            onClick={updateGlobalPaywall}
                            className="bg-primary hover:bg-primary/90 text-black p-2 rounded-lg transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 h-9 w-9 flex items-center justify-center border border-primary/50"
                            title="Save Changes"
                        >
                            <Save size={16} strokeWidth={2.5} />
                        </button>

                        <div className="w-px h-6 bg-white/10 mx-1"></div>

                        {/* Logout Button */}
                        <button
                            onClick={() => setIsAuthenticated(false)}
                            className="text-[10px] font-bold text-slate-500 hover:text-white px-3 h-9 border border-white/5 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap bg-black/20"
                        >
                            LOGOUT
                        </button>
                    </div>
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
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!confirm(`${user.nickname} 님의 비밀번호 초기화 모드를 활성화하시겠습니까?\n\n활성화되면 사용자가 로그인 시 새 비밀번호를 바로 설정할 수 있습니다.`)) return;

                                                        const { error } = await supabase.rpc('admin_set_force_reset', {
                                                            target_user_id: user.id,
                                                            enable: true
                                                        });

                                                        if (error) alert('설정 실패: ' + error.message);
                                                        else alert('초기화 모드가 활성화되었습니다. 사용자에게 로그인을 시도하여 비밀번호를 재설정하라고 안내해주세요.');
                                                    }}
                                                    className="shrink-0 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg p-2 hover:bg-yellow-500/20 transition-colors"
                                                    title="비밀번호 초기화 모드 설정"
                                                >
                                                    <Lock size={16} />
                                                </button>
                                                <button
                                                    onClick={() => openUserDetail(user)}
                                                    className="shrink-0 bg-primary/10 text-primary border border-primary/20 rounded-lg p-2 hover:bg-primary/20 transition-colors"
                                                >
                                                    <Settings size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Row 2: Sub Details + Date */}
                                        <div className="flex justify-between items-end border-t border-white/5 pt-2 mt-1">
                                            <div className="flex-1 min-w-0 mr-2">
                                                {user.subscriptions && user.subscriptions.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {user.subscriptions.filter((s: any) => s.status === 'active').map((sub: any, idx: number) => (
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

                                    {/* Password Reset Section */}
                                    <div className="mt-2 pt-2 border-t border-white/5">
                                        <button
                                            onClick={() => setShowPasswordReset(!showPasswordReset)}
                                            className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                                        >
                                            <Lock size={12} /> {showPasswordReset ? '비밀번호 재설정 닫기' : '비밀번호 재설정'}
                                        </button>

                                        {showPasswordReset && (
                                            <div className="mt-2 space-y-2 bg-black/20 p-2 rounded-lg animate-in slide-in-from-top-2">
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={e => setNewPassword(e.target.value)}
                                                    placeholder="새 비밀번호"
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-accent placeholder:text-slate-600"
                                                />
                                                <input
                                                    type="password"
                                                    value={confirmPassword}
                                                    onChange={e => setConfirmPassword(e.target.value)}
                                                    placeholder="새 비밀번호 확인"
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-accent placeholder:text-slate-600"
                                                />
                                                <button
                                                    onClick={handlePasswordReset}
                                                    disabled={!newPassword || !confirmPassword}
                                                    className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold py-2 rounded-lg transition-colors border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    비밀번호 변경하기
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-center">
                                        <div className="bg-white/5 p-2 rounded-lg">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">구독 상태</p>
                                            <p className={`font-bold text-sm ${selectedUser.is_premium ? 'text-accent' : selectedUser.active_plan ? 'text-primary' : 'text-slate-400'}`}>
                                                {selectedUser.is_premium ? 'Premium (All)' : selectedUser.active_plan ? `Mission (${selectedUser.active_plan})` : 'Free'}
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
                                                const daysPassed = Math.floor((new Date().getTime() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24)) + 1;

                                                // Calculate Duration
                                                // Funplay defaults to 0.25 (1 week) if not set, or uses stored duration_months
                                                // Other goals default to 1 month
                                                const durationMonths = m.duration_months || (m.category === 'funplay' ? 0.25 : 1);
                                                let totalDays = 0;
                                                if (durationMonths < 1) {
                                                    totalDays = durationMonths === 0.25 ? 7 : durationMonths === 0.5 ? 14 : Math.round(durationMonths * 30);
                                                } else {
                                                    totalDays = durationMonths * 30;
                                                }

                                                const isExpired = daysPassed > totalDays;
                                                const isCompleted = m.is_completed;
                                                const isEnded = isExpired || isCompleted;

                                                const endDate = new Date(m.created_at);
                                                endDate.setDate(endDate.getDate() + totalDays);

                                                return (
                                                    <div key={m.id} className={`p-2.5 rounded-lg border transition-colors ${isEnded ? 'bg-black/40 border-white/5 opacity-70' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${isEnded ? 'bg-slate-700 text-slate-400' : 'bg-purple-500/20 text-purple-300'}`}>
                                                                {m.category || '기타'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 font-mono">
                                                                {new Date(m.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <p className={`text-xs font-bold line-clamp-2 mt-0.5 ${isEnded ? 'text-slate-400' : 'text-white'}`}>{m.target_text || '목표 없음'}</p>
                                                        <div className="flex justify-between items-center mt-1.5">
                                                            {isEnded ? (
                                                                <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                                                                    {isCompleted ? <span className="text-emerald-400">성공</span> : '종료됨'}
                                                                    <span className="font-mono font-normal">({endDate.toLocaleDateString()})</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-accent font-bold">
                                                                    D+{daysPassed} <span className="text-slate-500 font-mono font-normal">/ {totalDays}일</span>
                                                                </span>
                                                            )}
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
                                                <div key={idx} className="bg-white/5 p-2 rounded-lg border border-white/5 flex justify-between items-center group">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${sub.type === 'all' ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                                                {sub.type === 'all' ? '전체 플랜' : sub.target_id}
                                                            </span>
                                                            {sub.status === 'cancelled' && <span className="text-[9px] text-red-400 font-bold">(취소됨)</span>}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 font-mono mt-1">
                                                            {new Date(sub.start_date).toLocaleDateString()} ~ {new Date(sub.end_date).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-white font-bold">{getDuration(sub.start_date, sub.end_date)}</span>
                                                        {sub.status !== 'cancelled' && (
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm('이 구독 정보를 "영구적으로 삭제" 하시겠습니까? \n(DB에서 완전히 제거되며 복구할 수 없습니다)')) {
                                                                        const { data, error } = await supabase.functions.invoke('cancel-payment', {
                                                                            body: {
                                                                                action: 'delete_subscription',
                                                                                subscription_id: sub.id
                                                                            }
                                                                        });

                                                                        if (error || data?.error) {
                                                                            alert('삭제 실패: ' + (error?.message || data?.error));
                                                                        } else {
                                                                            alert('구독 정보가 영구 삭제되었습니다.');
                                                                            openUserDetail(selectedUser);
                                                                        }
                                                                    }
                                                                }}
                                                                className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-all"
                                                                title="강제 삭제"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
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
                                                const isPaid = pay.status === 'paid';

                                                return (
                                                    <div key={idx} className="bg-white/5 p-2 rounded-lg border border-white/5 flex justify-between items-center">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${isPaid ? 'bg-emerald-500/10 text-emerald-400' :
                                                                    isCancelled ? 'bg-red-500/10 text-red-400' :
                                                                        'bg-yellow-500/10 text-yellow-400'
                                                                    }`}>
                                                                    {pay.status || 'Unknown'}
                                                                </span>
                                                            </div>
                                                            <p className={`text-xs font-bold uppercase ${isCancelled ? 'text-slate-500 line-through' : 'text-white'}`}>
                                                                {/* Display more descriptive name based on Plan Type */}
                                                                {pay.plan_type === 'all_1mo' ? 'Premium (1 Month)' :
                                                                    pay.plan_type === 'all_3mo' ? 'Premium (3 Months)' :
                                                                        pay.plan_type === 'all_6mo' ? 'Premium (6 Months)' :
                                                                            pay.plan_type?.startsWith('mission') ? `Mission (${pay.target_id})` :
                                                                                pay.item_name || 'Plan'}
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
                                                                    <span className="text-xs font-bold text-accent">₩{Number(pay.amount).toLocaleString()}</span>
                                                                    <div className="flex gap-1">
                                                                        <button
                                                                            onClick={() => cancelPayment(pay.id, pay.imp_uid, pay.merchant_uid, false)}
                                                                            className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 hover:bg-red-500/20"
                                                                        >
                                                                            취소
                                                                        </button>
                                                                        <button
                                                                            onClick={() => cancelPayment(pay.id, pay.imp_uid, pay.merchant_uid, true)}
                                                                            className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600 hover:bg-slate-600"
                                                                            title="강제 취소 (DB만 업데이트)"
                                                                        >
                                                                            강제
                                                                        </button>
                                                                    </div>
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


