import { useEffect } from 'react';

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

interface GoogleAdProps {
    className?: string;
    slotId?: string; // Optional: User needs to provide this
    format?: 'auto' | 'fluid' | 'rectangle';
}

export default function GoogleAd({ className, slotId, format = 'auto' }: GoogleAdProps) {
    useEffect(() => {
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error("AdSense Error", e);
        }
    }, []);

    // If no slotId is provided, we can't render a specific unit.
    // However, if Auto Ads are enabled, they might appear automatically on page load (interstitials).
    // This component is for IN-PAGE display ads.
    if (!slotId) {
        return (
            <div className={`bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-xs p-4 ${className}`}>
                <p>Google Ad Placeholder (Requires Ad Slot ID)</p>
            </div>
        );
    }

    return (
        <div className={className}>
            <ins className="adsbygoogle"
                style={{ display: 'block' }}
                data-ad-client="ca-pub-2810872681064029"
                data-ad-slot={slotId}
                data-ad-format={format}
                data-full-width-responsive="true"></ins>
        </div>
    );
}
