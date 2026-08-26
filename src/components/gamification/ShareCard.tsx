import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import { X, Share2, Download } from 'lucide-react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';

interface ShareCardProps {
    isOpen: boolean;
    onClose: () => void;
    missions: any[];
    date: string;
}

export default function ShareCard({ isOpen, onClose, missions, date }: ShareCardProps) {
    const { user } = useStore();
    const cardRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    const completedMissions = missions.filter(m => m.is_completed);
    
    // Filter missions that have either a photo (excluding video/audio) OR text proof
    const validProofs = completedMissions.filter(m => {
        const hasValidImage = m.image_url && m.proof_type !== 'video' && m.proof_type !== 'audio' && !m.image_url.endsWith('.mp4');
        const hasText = !!m.proof_text;
        return hasValidImage || hasText;
    }).sort((a, b) => {
        // Sort by created_at descending (most recent first)
        const dateA = new Date(a.created_at || date).getTime();
        const dateB = new Date(b.created_at || date).getTime();
        return dateB - dateA;
    });

            // Take top 4 most recent records
    const recentProofs = validProofs.slice(0, 4);

    // Get the most recent date from valid proofs, or fallback to the provided date
    const displayDate = recentProofs.length > 0 && recentProofs[0].created_at
        ? recentProofs[0].created_at
        : date;

    const completionRate = missions.length > 0 ? Math.round((completedMissions.length / missions.length) * 100) : 0;

    const handleDownloadOnly = async () => {
        if (!cardRef.current) return;
        setIsExporting(true);
        try {
            const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 3, cacheBust: true });
            download(dataUrl, `myredesign_${date.replace(/-/g, '')}.png`);
            if (user) {
                await supabase.from('share_cards').insert({
                    user_id: user.id,
                    card_type: 'daily_summary',
                    platform: 'download'
                });
            }
            alert('사진이 기기에 저장되었습니다!');
        } catch (err: any) {
            console.error('Failed to generate image', err);
            alert("저장하는 중 문제가 발생했습니다.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleShare = async () => {
        if (!cardRef.current) return;
        setIsExporting(true);
        try {
            // Instagram Story requires a high-quality image. pixelRatio 3 provides great crispness on modern phones.
            const dataUrl = await toPng(cardRef.current, { 
                quality: 1, 
                pixelRatio: 3, 
                cacheBust: true,
            });
            
            // Check native share API
            if (navigator.share && navigator.canShare) {
                try {
                    const response = await fetch(dataUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `myredesign_${date.replace(/-/g, '')}.png`, { type: 'image/png' });
                    
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'MyReDesign Daily',
                            text: '오늘의 성장을 기록했어요! #MyReDesign'
                        });
                    } else {
                        throw new Error('File sharing not supported');
                    }
                } catch (shareError: any) {
                    if (shareError.name !== 'AbortError') {
                        console.warn('Native sharing failed, falling back to download:', shareError);
                        download(dataUrl, `myredesign_${date.replace(/-/g, '')}.png`);
                        alert('기기 환경에서 앱 공유를 지원하지 않아 이미지로 저장되었습니다.\n갤러리에서 직접 공유해 보세요!');
                    }
                }
            } else {
                // Fallback to download if Web Share API is not supported (e.g. PC browser)
                download(dataUrl, `myredesign_${date.replace(/-/g, '')}.png`);
                alert('기기 환경에서 앱 공유를 지원하지 않아 이미지로 저장되었습니다.\n갤러리에서 직접 공유해 보세요!');
            }
            
            // Log sharing event to DB
            if (user) {
                await supabase.from('share_cards').insert({
                    user_id: user.id,
                    card_type: 'daily_summary',
                    platform: 'native_share'
                });
            }
        } catch (err: any) {
            console.error('Failed to share/generate image', err);
            alert("공유하기를 처리하는 중 문제가 발생했습니다.");
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    // Helper for random polaroid rotation
    const getRotation = (index: number) => {
        const rotations = ['-rotate-3', 'rotate-2', '-rotate-6', 'rotate-4', '-rotate-2'];
        return rotations[index % rotations.length];
    };

    // Use a fresh pastel-themed background if we have proofs to show, else dark mode
    const cardBgClass = recentProofs.length > 0
        ? "bg-gradient-to-br from-[#c1d3e8] via-[#a3c2d1] to-[#c7e0d3] border-4 border-white shadow-[inset_0_0_20px_rgba(255,255,255,0.5)]"
        : "bg-gradient-to-br from-slate-900 via-slate-800 to-black border-4 border-slate-800";

    const textColorClass = recentProofs.length > 0 ? "text-slate-800" : "text-white";
    const subTextColorClass = recentProofs.length > 0 ? "text-slate-600" : "text-slate-400";
    const containerClass = recentProofs.length > 0 ? "bg-white/40 border-white/40" : "bg-white/10 border-white/10";

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative w-full max-w-[320px] flex flex-col items-center"
                >
                    <button 
                        onClick={onClose} 
                        className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white bg-white/10 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>

                    {/* 9:16 Aspect Ratio Card */}
                    <div 
                        ref={cardRef}
                        className={`w-[300px] h-[533px] rounded-[32px] overflow-hidden relative shadow-2xl flex flex-col p-6 ${cardBgClass}`}
                    >
                        {/* Background Effects for dark mode only */}
                        {recentProofs.length === 0 && (
                            <>
                                <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent opacity-50 pointer-events-none" />
                                <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[100%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/20 via-transparent to-transparent opacity-50 pointer-events-none" />
                            </>
                        )}

                        {/* Content */}
                        <div className="relative z-10 flex-1 flex flex-col">
                            {/* Header */}
                            <div className="flex justify-between items-center mb-5">
                                <span className={`font-black text-xl tracking-tighter ${textColorClass}`}>MyReDesign</span>
                                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold shadow-sm backdrop-blur-md ${recentProofs.length > 0 ? 'bg-white/60 text-slate-700' : 'bg-white/20 text-white'}`}>
                                    {new Date(displayDate.replace(/-/g, '/')).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                </span>
                            </div>

                            {/* User Info & Stats Compact */}
                            <div className={`flex items-center justify-between mb-5 p-3 rounded-2xl backdrop-blur-md border shadow-sm ${containerClass}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent p-0.5 shadow-md">
                                        <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center font-bold text-white text-base">
                                            {user?.nickname?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className={`font-bold text-sm leading-tight ${textColorClass}`}>{user?.nickname || 'User'}</h2>
                                        <p className="text-primary font-bold text-[10px]">Level {user?.current_level || 1} {user?.level_title}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[9px] font-bold block mb-0.5 ${subTextColorClass}`}>달성률</span>
                                    <div className="flex items-end justify-end gap-0.5">
                                        <span className={`text-xl font-black leading-none ${textColorClass}`}>{completionRate}</span>
                                        <span className="text-[10px] font-bold text-primary mb-0.5">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Missions / Photos Area */}
                            <div className="flex-1 flex flex-col justify-center">
                                {recentProofs.length > 0 ? (
                                    /* Polaroid Collage Layout */
                                    <div className="flex flex-wrap justify-center items-center gap-2 -mt-2 relative">
                                        {/* Background tape decorations */}
                                        <div className="absolute -top-4 right-4 w-12 h-4 bg-white/40 rotate-12 backdrop-blur-sm shadow-sm z-0" />
                                        
                                        {recentProofs.map((m, i) => {
                                            const hasImage = m.image_url && m.proof_type !== 'video' && m.proof_type !== 'audio' && !m.image_url.endsWith('.mp4');
                                            
                                            return (
                                                <div 
                                                    key={i} 
                                                    className={`bg-white p-1.5 pb-4 shadow-xl rounded-[4px] relative flex flex-col ${getRotation(i)} ${recentProofs.length === 1 ? 'w-52 h-64' : recentProofs.length === 2 ? 'w-32 h-44' : 'w-[108px] h-36'} transition-transform`}
                                                >
                                                    {/* Polaroid Tape */}
                                                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-3 bg-white/70 backdrop-blur-md shadow-sm -rotate-2 z-10 opacity-80" />
                                                    
                                                    {/* Media & Text area */}
                                                    <div className="flex-1 min-h-0 bg-slate-50 border border-slate-100 flex flex-col justify-center overflow-hidden relative">
                                                        {hasImage ? (
                                                            <>
                                                                <img 
                                                                    src={m.image_url} 
                                                                    crossOrigin="anonymous" 
                                                                    className="w-full h-full object-cover"
                                                                    alt="Verification"
                                                                />
                                                                {m.proof_text && (
                                                                    <div className="absolute bottom-0 inset-x-0 bg-white/85 backdrop-blur-sm p-1 border-t border-white/50">
                                                                        <p className={`text-slate-800 font-medium italic text-center line-clamp-2 ${recentProofs.length > 2 ? 'text-[7px]' : 'text-[9px]'}`}>"{m.proof_text}"</p>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center p-2 bg-gradient-to-br from-slate-50 to-blue-50/30">
                                                                <p className={`text-slate-700 font-medium italic text-center leading-snug ${recentProofs.length > 2 ? 'text-[8px] line-clamp-4' : 'text-xs line-clamp-5'}`}>"{m.proof_text}"</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Footer (Date & Title) */}
                                                    <div className="mt-1.5 shrink-0 flex flex-col items-center gap-0.5">
                                                        <span className={`font-black text-slate-400 uppercase tracking-tighter ${recentProofs.length > 2 ? 'text-[6px]' : 'text-[8px]'}`}>
                                                            {new Date(m.created_at || date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                                                        </span>
                                                        <p className={`font-bold text-slate-700 text-center line-clamp-2 break-all px-1 w-full leading-tight ${recentProofs.length > 2 ? 'text-[7px]' : 'text-[9px]'}`}>
                                                            {m.content || m.category}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    /* Standard Text List Layout */
                                    <div className="h-full flex flex-col">
                                        <h3 className={`text-xs font-bold mb-3 uppercase tracking-widest ${subTextColorClass}`}>오늘의 성장 기록</h3>
                                        <div className="space-y-3">
                                            {missions.slice(0, 5).map((m, i) => (
                                                <div key={i} className="flex items-start gap-2">
                                                    <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] shadow-sm ${m.is_completed ? 'bg-primary text-white shadow-primary/30' : 'bg-slate-700/50 text-transparent'}`}>
                                                        ✓
                                                    </div>
                                                    <p className={`text-[11px] font-bold leading-snug line-clamp-2 ${m.is_completed ? textColorClass : subTextColorClass}`}>
                                                        {m.content}
                                                    </p>
                                                </div>
                                            ))}
                                            {missions.length > 5 && (
                                                <div className={`text-[10px] font-bold ml-6 mt-1 ${subTextColorClass}`}>
                                                    + {missions.length - 5} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer / Branding */}
                            <div className={`mt-auto text-center pt-3 border-t ${recentProofs.length > 0 ? 'border-white/40' : 'border-white/10'}`}>
                                <p className={`text-[9px] font-bold tracking-widest uppercase ${subTextColorClass}`}>Design Your Best Life</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 w-full flex gap-3">
                        <button 
                            onClick={handleShare}
                            disabled={isExporting}
                            className="flex-1 py-4 bg-white text-black font-extrabold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors active:scale-95 disabled:opacity-50 shadow-xl shadow-black/20"
                        >
                            {isExporting ? '준비 중...' : (
                                <>
                                    <Share2 size={18} className="stroke-[2.5]" />
                                    앱으로 공유
                                </>
                            )}
                        </button>
                        <button 
                            onClick={handleDownloadOnly}
                            disabled={isExporting}
                            className="flex-1 py-4 bg-slate-800 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-700 border border-white/20 transition-colors active:scale-95 disabled:opacity-50 shadow-xl shadow-black/20"
                        >
                            {isExporting ? '준비 중...' : (
                                <>
                                    <Download size={18} className="stroke-[2.5]" />
                                    기기에 저장
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
