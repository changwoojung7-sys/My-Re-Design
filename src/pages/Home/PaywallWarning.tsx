import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';

interface PaywallWarningProps {
    onConfirm: () => void;
    onCancel: () => void;
}

export default function PaywallWarning({ onConfirm, onCancel }: PaywallWarningProps) {
    const { t } = useLanguage();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-xs bg-slate-900 border border-white/10 rounded-2xl p-6 text-center shadow-2xl"
            >
                <div className="w-14 h-14 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={28} className="text-accent" />
                </div>

                <h2 className="text-xl font-bold text-white mb-2">
                    {t.paywallWarningTitle}
                </h2>

                <div className="text-sm text-slate-300 space-y-2 mb-6 text-left bg-white/5 p-4 rounded-xl">
                    <p>• {t.paywallWarningDesc1}</p>
                    <p>• {t.paywallWarningDesc2}</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-slate-800 text-slate-400 hover:bg-slate-700 transition"
                    >
                        {t.maybeLater}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-primary text-black hover:bg-primary/90 transition shadow-lg shadow-primary/20"
                    >
                        {t.subscribe}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
