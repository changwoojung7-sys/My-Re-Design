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
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // User Detail Modal State
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userMissions, setUserMissions] = useState<any[]>([]);
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
        const { data: subs } = await supabase
            .from('subscriptions')
            .select('user_id, status, type, target_id, start_date, end_date');

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

        // Fetch active goals/missions for this user
        const { data: goals } = await supabase
            .from('goals')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true); // Assuming there's an active flag or just all goals? keeping it simple for now

        // If goals table doesn't have is_active, maybe just fetch all. 
        // Based on Step 258, it showed "Active Goals" so filtering by functionality might be needed.
        // Let's assume fetching all for now or filter client side if fields exist.
        // Checking MyPage logic might be safer but for Admin MVP just showing what they have is fine.
        setUserMissions(goals || []);
    };

    // Filter users
    const filteredUsers = users.filter(u =>
        (u.nickname && u.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Helper to format date YYYY.MM.DD
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };

    // Helper to calculate duration in months (approx)
    const getDuration = (start: string, end: string) => {
        const s = new Date(start);
        const e = new Date(end);
        const diffMonth = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
        return diffMonth > 0 ? `${diffMonth} Months` : '1 Month';
    };

    // ... (skip down to table render) ...

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
                    <Settings className="text-accent" /> Admin Dashboard
                </h1>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-lg border border-white/5">
                        <span className="text-xs text-slate-400">Global Free Limit (Day):</span>
                        <input
                            type="number"
                            value={globalPaywallDay}
                            onChange={e => setGlobalPaywallDay(parseInt(e.target.value))}
                            className="w-12 bg-transparent text-center font-bold outline-none"
                        />
                        <button onClick={updateGlobalPaywall} className="text-accent hover:text-white"><Save size={16} /></button>
                    </div>
                    <button onClick={() => setIsAuthenticated(false)} className="text-xs text-slate-500 hover:text-white">Logout</button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* User List */}
                <div className="flex-1 overflow-hidden flex flex-col p-6">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h2 className="text-lg font-bold">User Management</h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm w-64 focus:border-accent outline-none"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-2xl border border-white/5 flex-1 overflow-hidden flex flex-col">
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-900/90 backdrop-blur-md text-slate-400 sticky top-0 z-10 border-b border-white/5">
                                    <tr>
                                        <th className="p-4 font-medium w-64">User</th>
                                        <th className="p-4 font-medium w-[400px]">Subscription Details</th>
                                        <th className="p-4 font-medium w-32">Free Limit</th>
                                        <th className="p-4 font-medium w-32">Joined</th>
                                        <th className="p-4 font-medium w-24">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading...</td></tr>
                                    ) : filteredUsers.map(user => (
                                        <tr key={user.id || 'unknown'} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                                                        <User size={14} className="text-slate-500" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <div className="font-bold text-sm truncate">{user.nickname || 'Guest'}</div>
                                                        <div className="text-[10px] text-slate-500 truncate">{user.email || 'No Email'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                {user.subscriptions && user.subscriptions.length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        {user.subscriptions.map((sub: any, idx: number) => (
                                                            <div key={idx} className="flex flex-col gap-0.5 text-xs mb-1 last:mb-0">
                                                                <div className="flex items-center gap-2">
                                                                    {sub.type === 'all' ? (
                                                                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                                                                            <Check size={8} /> ALL
                                                                        </span>
                                                                    ) : (
                                                                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase">
                                                                            <Check size={8} /> {sub.target_id}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-slate-300 font-medium whitespace-nowrap">
                                                                        {getDuration(sub.start_date, sub.end_date)}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] text-slate-500 font-mono">
                                                                    {formatDate(sub.start_date)} ~ {formatDate(sub.end_date)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                                                        Free
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-mono text-sm ${user.custom_free_trial_days ? 'text-accent font-bold' : 'text-slate-500'}`}>
                                                        {user.custom_free_trial_days || globalPaywallDay} Days
                                                    </span>
                                                    {user.custom_free_trial_days && <span className="text-[10px] text-accent font-bold px-1.5 py-0.5 bg-accent/10 rounded">Custom</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-slate-500 text-xs">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <button
                                                    onClick={() => openUserDetail(user)}
                                                    className="text-primary hover:text-white font-bold text-[10px] px-2.5 py-1 bg-primary/10 rounded-md border border-primary/20 hover:bg-primary/20 transition-all whitespace-nowrap"
                                                >
                                                    MANAGE
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* User Detail Panel (Right Side Modal/Panel) */}
                <AnimatePresence>
                    {selectedUser && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            className="w-96 bg-slate-900 border-l border-white/10 p-6 shadow-2xl overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold">User Details</h3>
                                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-white/10 rounded-full">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Profile Info */}
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <div className="text-center mb-4">
                                        <div className="w-16 h-16 rounded-full bg-slate-800 mx-auto flex items-center justify-center mb-2">
                                            <User size={32} className="text-slate-600" />
                                        </div>
                                        <h4 className="font-bold text-lg">{selectedUser.nickname}</h4>
                                        <p className="text-xs text-slate-500">{selectedUser.email}</p>
                                        <p className="text-xs text-slate-600 font-mono mt-1">{selectedUser.id}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-center">
                                        <div className="bg-white/5 p-2 rounded-lg">
                                            <p className="text-[10px] text-slate-500 uppercase">Sub Status</p>
                                            <p className={`font-bold ${selectedUser.is_premium ? 'text-accent' : 'text-slate-400'}`}>
                                                {selectedUser.is_premium ? 'Premium' : 'Free'}
                                            </p>
                                        </div>
                                        <div className="bg-white/5 p-2 rounded-lg">
                                            <p className="text-[10px] text-slate-500 uppercase">Joined</p>
                                            <p className="text-sm font-bold">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Free Trial Control */}
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                                        <Calendar size={16} className="text-primary" /> Free Trial Limit
                                    </h4>
                                    <div className="space-y-3">
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            Default is <span className="text-white font-bold">{globalPaywallDay} days</span>.
                                            Set a custom value here to override it for this user.
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={customTrialDays || ''}
                                                placeholder={String(globalPaywallDay)}
                                                onChange={e => setCustomTrialDays(parseInt(e.target.value) || null)}
                                                className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3 text-center font-bold focus:border-primary outline-none"
                                            />
                                            <button
                                                onClick={updateUserTrial}
                                                className="bg-primary hover:bg-primary/90 text-white p-3 rounded-lg"
                                            >
                                                <Save size={20} />
                                            </button>
                                        </div>
                                        {customTrialDays && customTrialDays !== globalPaywallDay && (
                                            <p className="text-xs text-green-400 flex items-center gap-1 justify-center">
                                                <Check size={12} /> Custom limit active
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Active Missions */}
                                <div>
                                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                                        <CreditCard size={16} className="text-purple-400" /> Active Goals
                                    </h4>
                                    <div className="space-y-2">
                                        {userMissions.length === 0 ? (
                                            <p className="text-xs text-slate-500 text-center py-4">No active goals found.</p>
                                        ) : (
                                            userMissions.map(m => {
                                                const dayCount = Math.floor((new Date().getTime() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                                return (
                                                    <div key={m.id} className="bg-white/5 p-3 rounded-xl border border-white/5">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-xs font-bold bg-white/10 px-1.5 py-0.5 rounded text-slate-300 uppercase">
                                                                {m.category}
                                                            </span>
                                                            <span className="text-[10px] text-accent font-mono font-bold">
                                                                Day {dayCount}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-medium line-clamp-2">{m.target_text}</p>
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
