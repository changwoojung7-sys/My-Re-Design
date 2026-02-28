import { useEffect, useState } from 'react';
import { Download, X, Share as ShareIcon, PlusSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // iOS Detection
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

        if (isIosDevice && !isStandalone) {
            setIsIOS(true);
            // Delay slightly for better UX
            setTimeout(() => setIsVisible(true), 3000);
        }

        // Android/Desktop Detection
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Check if already installed (Standard)
        if (isStandalone) {
            setIsVisible(false);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        }
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-6 left-6 right-6 z-50 flex justify-center pointer-events-none"
            >
                <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 max-w-sm w-full pointer-events-auto">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
                                <img src="/reme_icon.png" alt="Icon" className="w-8 h-8 object-contain" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-sm">Install My Re Design</h3>
                                <p className="text-xs text-slate-400">Add to home screen for quick access</p>
                            </div>
                        </div>
                        <button onClick={() => setIsVisible(false)} aria-label="설치 안내 닫기" className="text-slate-400 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content based on OS */}
                    {isIOS ? (
                        <div className="bg-white/5 rounded-xl p-3 text-xs text-slate-300 space-y-2">
                            <p className="flex items-center gap-2">
                                1. Tap the <ShareIcon size={14} className="text-blue-400" /> <b>Share</b> button below.
                            </p>
                            <p className="flex items-center gap-2">
                                2. Select <PlusSquare size={14} className="text-white" /> <b>Add to Home Screen</b>.
                            </p>
                        </div>
                    ) : (
                        <div className="flex justify-end">
                            <button
                                onClick={handleInstallClick}
                                className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 w-full justify-center"
                            >
                                <Download size={14} />
                                Install App
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
