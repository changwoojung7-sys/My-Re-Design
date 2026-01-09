import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { Trash2, Save, LogOut, ChevronDown, Settings, X, Mail, Phone, Lock, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type GoalCategory = 'health' | 'learning' | 'achievement' | 'self_esteem' | 'other';

interface UserGoal {
    id?: string;
    category: GoalCategory;
    target_text: string;
    duration_months: number;
    details: any;
    created_at?: string;
}

import { useLanguage } from '../../lib/i18n';

export default function MyPage() {
    const { user, setUser, setMissions } = useStore();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Settings Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsData, setSettingsData] = useState({
        loginId: '',
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
    const [selectedCategory, setSelectedCategory] = useState<GoalCategory>('health');
    const [goals, setGoals] = useState<Record<GoalCategory, UserGoal>>({
        health: { category: 'health', target_text: '', duration_months: 1, details: { height: '', weight: '' } },
        learning: { category: 'learning', target_text: '', duration_months: 3, details: { subject: '', current_level: '', target_level: '' } },
        achievement: { category: 'achievement', target_text: '', duration_months: 6, details: { project_name: '', milestones: '' } },
        self_esteem: { category: 'self_esteem', target_text: '', duration_months: 1, details: { current_state: '', desired_state: '', daily_focus: '' } },
        other: { category: 'other', target_text: '', duration_months: 1, details: { description: '' } }
    });

    useEffect(() => {
        if (user) {
            fetchUserGoals();
        }
    }, [user]);

    const fetchUserGoals = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('user_goals')
            .select('*')
            .eq('user_id', user.id);

        if (data) {
            const newGoals = { ...goals };
            data.forEach((g: any) => {
                if (g.category && newGoals[g.category as GoalCategory]) {
                    newGoals[g.category as GoalCategory] = g;
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
            const isPhone = authUser.email?.endsWith('@phone.coreloop.com') || false;
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
                    nickname: settingsData.nickname,
                    age: settingsData.age,
                    gender: settingsData.gender,
                    // We can also save phone_number here if we want to sync it from backupPhone
                    phone_number: settingsData.isPhoneAuth ? settingsData.loginId.replace(/-/g, '') : settingsData.backupPhone.replace(/-/g, ''), // Ensure DB has the primary/backup phone
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
                nickname: settingsData.nickname,
                age: settingsData.age,
                gender: settingsData.gender
            });

            setIsSettingsOpen(false);
            alert('Settings updated!');
        } catch (err) {
            console.error(err);
            alert('Failed to update settings.');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordUpdate = async () => {
        if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
            alert('Please fill in all password fields.');
            return;
        }
        if (passwordData.new !== passwordData.confirm) {
            alert('New passwords do not match.');
            return;
        }
        if (passwordData.new.length < 6) {
            alert('Password must be at least 6 characters.');
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
                alert('Current password is incorrect.');
                setLoading(false);
                return;
            }

            // 2. Update to New Password
            const { error: updateError } = await supabase.auth.updateUser({
                password: passwordData.new
            });

            if (updateError) throw updateError;

            alert('Password updated successfully!');
            setPasswordData({ current: '', new: '', confirm: '' });
            setIsPasswordExpanded(false);

        } catch (error: any) {
            console.error('Password update error:', error);
            alert(error.message || 'Failed to update password.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setMissions([]);
        navigate('/login');
    };

    const handleSaveMainGoal = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Upsert Current Category Goal
            const currentGoal = goals[selectedCategory];
            const goalData = {
                user_id: user.id,
                category: selectedCategory,
                target_text: currentGoal.target_text,
                duration_months: currentGoal.duration_months,
                details: currentGoal.details,
                updated_at: new Date()
            };

            const { error: goalError } = await supabase
                .from('user_goals')
                .upsert(goalData, { onConflict: 'user_id,category' });

            if (goalError) throw goalError;

            await fetchUserGoals();
            setIsEditing(false);
            alert('Design saved successfully!');
        } catch (error) {
            console.error('Error saving goal:', error);
            alert('Failed to save goal!');
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

    if (!user) return null;

    const currentGoal = goals[selectedCategory];
    const hasGoal = (cat: GoalCategory) => !!goals[cat].id;

    const handleDeleteGoal = async () => {
        if (!currentGoal.id) return;

        // 1. Strong Confirmation
        const isConfirmed = window.confirm("Are you sure you want to delete this plan?");
        if (!isConfirmed) return;

        const isDoubleConfirmed = window.confirm("WARNING: This will permanently delete all your progress, daily missions, and social interactions (likes/comments) for this goal. \n\nThis action cannot be undone. Do you really want to proceed?");
        if (!isDoubleConfirmed) return;

        setLoading(true);
        try {
            // 2. Delete Goal (Cascade triggers for Likes/Comments)
            const { error: goalError } = await supabase
                .from('user_goals')
                .delete()
                .eq('id', currentGoal.id);

            if (goalError) throw goalError;

            // 3. Delete Related Missions (Cleanup)
            // Missions are likely linked by user_id and category
            const { error: missionError } = await supabase
                .from('missions')
                .delete()
                .eq('user_id', user.id)
                .eq('category', selectedCategory);

            if (missionError) {
                console.warn("Mission cleanup warning:", missionError);
                // We don't stop execution here, as the main goal is gone.
            }

            alert("Plan deleted successfully.");

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
            alert(`Failed to delete plan: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full p-6 pt-10 pb-24 overflow-y-auto relative">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    My Re Design
                </h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenSettings}
                        className="p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
                    >
                        <Settings size={20} />
                    </button>
                    <button
                        onClick={handleLogout}
                        className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {/* Profile Header (Read Only / Quick View) */}
            < div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-6" >
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-primary/20">
                        {user.nickname?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {user.nickname}
                        </h2>
                        <div className="flex gap-2 text-sm text-slate-400 mt-1">
                            <span>{user.age} years • {user.gender}</span>
                        </div>
                    </div>
                </div>

                {/* Category Selector */}
                <div className="relative mb-6 z-10">
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">{t.focusArea}</label>
                    <div className="relative">
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as GoalCategory)}
                            className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary font-bold capitalize"
                        >
                            {Object.keys(goals).map(cat => (
                                <option key={cat} value={cat} className="bg-slate-800 text-white capitalize">
                                    {(hasGoal(cat as GoalCategory) ? '✔ ' : '') + t[cat as GoalCategory]}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                    </div>
                </div>

                {/* Dynamic Form Area */}
                <div className="bg-black/20 rounded-2xl p-5 border border-white/5">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold capitalize text-primary">{t[selectedCategory as GoalCategory]} {t.plan}</h3>
                        <div className="flex items-center gap-2">
                            {currentGoal.created_at && (
                                <span className="text-[10px] text-slate-500">
                                    {t.started}: {new Date(currentGoal.created_at).toLocaleDateString()}
                                </span>
                            )}
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className={`text-xs px-2 py-1 rounded-lg transition-colors font-bold ${isEditing ? 'bg-primary text-black' : 'text-primary hover:bg-primary/10'}`}
                            >
                                {isEditing ? t.editing : t.viewOnly}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Main Goal Input */}
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">{t.mainGoal}</label>
                            <input
                                type="text"
                                disabled={!isEditing}
                                value={currentGoal.target_text}
                                onChange={e => updateGoal('target_text', e.target.value)}
                                placeholder={t.whatToAchieve}
                                className="w-full bg-white/5 rounded-lg px-3 py-3 text-sm focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 transition-all"
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
                                        className="w-full bg-white/5 rounded-lg px-3 py-3 text-sm focus:ring-1 focus:ring-primary outline-none disabled:opacity-50"
                                    >
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
                            {selectedCategory === 'health' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">{t.height}</label>
                                        <input type="number" disabled={!isEditing} value={currentGoal.details.height || ''} onChange={e => updateGoal('height', e.target.value, true)} className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">{t.weight}</label>
                                        <input type="number" disabled={!isEditing} value={currentGoal.details.weight || ''} onChange={e => updateGoal('weight', e.target.value, true)} className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50" />
                                    </div>
                                </div>
                            )}

                            {selectedCategory === 'learning' && (
                                <div className="space-y-3">
                                    <input type="text" disabled={!isEditing} value={currentGoal.details.subject || ''} onChange={e => updateGoal('subject', e.target.value, true)} placeholder={t.subject} className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50" />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="text" disabled={!isEditing} value={currentGoal.details.current_level || ''} onChange={e => updateGoal('current_level', e.target.value, true)} placeholder={t.currentLevel} className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50" />
                                        <input type="text" disabled={!isEditing} value={currentGoal.details.target_level || ''} onChange={e => updateGoal('target_level', e.target.value, true)} placeholder={t.targetLevel} className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50" />
                                    </div>
                                </div>
                            )}
                            {/* (Other categories similar structure - maintained implicitly by preserving logic if I copy paste fully, but here I'm replacing, so I must include all) */}
                            {selectedCategory === 'achievement' && (
                                <div className="space-y-3">
                                    <input type="text" disabled={!isEditing} value={currentGoal.details.project_name || ''} onChange={e => updateGoal('project_name', e.target.value, true)} placeholder={t.projectName} className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50" />
                                    <textarea disabled={!isEditing} value={currentGoal.details.milestones || ''} onChange={e => updateGoal('milestones', e.target.value, true)} placeholder={t.milestones} className="w-full h-16 bg-white/5 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50 resize-none" />
                                </div>
                            )}
                            {selectedCategory === 'self_esteem' && (
                                <div className="space-y-3">
                                    <input type="text" disabled={!isEditing} value={currentGoal.details.current_state || ''} onChange={e => updateGoal('current_state', e.target.value, true)} placeholder={t.currentState} className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50" />
                                    <input type="text" disabled={!isEditing} value={currentGoal.details.desired_state || ''} onChange={e => updateGoal('desired_state', e.target.value, true)} placeholder={t.desiredState} className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50" />
                                </div>
                            )}
                            {selectedCategory === 'other' && (
                                <textarea disabled={!isEditing} value={currentGoal.details.description || ''} onChange={e => updateGoal('description', e.target.value, true)} placeholder={t.description} className="w-full h-24 bg-white/5 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50 resize-none" />
                            )}
                        </div>
                    </div>
                </div>
            </div >

            {isEditing && (
                <div className="space-y-4 mb-10">
                    <button
                        onClick={handleSaveMainGoal}
                        disabled={loading}
                        className="w-full bg-primary text-black font-bold py-4 rounded-2xl shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                    >
                        <Save size={20} />
                        {loading ? t.saving : t.saveDesign}
                    </button>

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
            )}

            {/* SETTINGS MODAL */}
            <AnimatePresence>
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
                            className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl my-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Settings size={20} className="text-primary" /> {t.accountSettings}
                                </h2>
                                <button onClick={() => setIsSettingsOpen(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20">
                                    <X size={20} className="text-white" />
                                </button>
                            </div>

                            <div className="space-y-5">
                                {/* Login Info */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2">{t.loginId}</label>
                                    <div className="flex items-center gap-3 bg-black/40 p-4 rounded-xl border border-white/5">
                                        {settingsData.isPhoneAuth ? <Phone size={20} className="text-slate-400" /> : <Mail size={20} className="text-slate-400" />}
                                        <div>
                                            <p className="font-mono text-lg text-white font-bold">{settingsData.loginId}</p>
                                            <p className="text-[10px] text-slate-500">{settingsData.isPhoneAuth ? (t.phone + ' ' + t.verify) : t.emailAuth}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Personal Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1">{t.nickname}</label>
                                        <input
                                            type="text"
                                            value={settingsData.nickname}
                                            onChange={e => setSettingsData({ ...settingsData, nickname: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1">{t.age}</label>
                                        <input
                                            type="number"
                                            value={settingsData.age}
                                            onChange={e => setSettingsData({ ...settingsData, age: Number(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1">{t.gender}</label>
                                        <select
                                            value={settingsData.gender}
                                            onChange={e => setSettingsData({ ...settingsData, gender: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none"
                                        >
                                            <option value="male" className="bg-slate-800">Male</option>
                                            <option value="female" className="bg-slate-800">Female</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Backup Contact */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2">
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
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-primary"
                                                />
                                                <Mail size={18} className="absolute left-4 top-3.5 text-slate-500" />
                                            </>
                                        ) : (
                                            <>
                                                <input
                                                    type="tel"
                                                    value={settingsData.backupPhone}
                                                    onChange={e => setSettingsData({ ...settingsData, backupPhone: e.target.value })}
                                                    placeholder={t.addRecoveryPhone}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-primary"
                                                />
                                                <Phone size={18} className="absolute left-4 top-3.5 text-slate-500" />
                                            </>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveSettings}
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98]"
                                >
                                    {loading ? t.saving : t.saveChanges}
                                </button>

                                <div className="h-px bg-white/10 my-4" />

                                {/* Security Section */}
                                <div className=" pt-2">
                                    <button
                                        onClick={() => setIsPasswordExpanded(!isPasswordExpanded)}
                                        className="w-full flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Lock size={20} className="text-slate-400" />
                                            <span className="font-bold text-slate-300">{t.security} / {t.password}</span>
                                        </div>
                                        <ChevronRight size={20} className={`text-slate-500 transition-transform ${isPasswordExpanded ? 'rotate-90' : ''}`} />
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

                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
