import { AdMob, type RewardAdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Rewarded Ad Unit IDs
export const ADMOB_UNITS = {
    // TEST UNIT ID for Android Rewarded Video
    REWARDED_TEST: 'ca-app-pub-3940256099942544/5224354917',

    // Real Production ID
    REWARDED_PROD: 'ca-app-pub-2810872681064029/3958830106'
};

export const initializeAdMob = async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        await AdMob.initialize({
            initializeForTesting: false,
        });
        console.log('[AdMob] Initialized');
    } catch (e) {
        console.error('[AdMob] Failed to initialize', e);
    }
};

/**
 * Triggers the Native AdMob Rewarded Ad
 * @param adUnitId The Ad Unit ID to load and show
 */
export const showNativeRewardedAd = async (adUnitId: string = ADMOB_UNITS.REWARDED_TEST): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[AdMob] Not native platform (Running in Browser Mode)');
        return false;
    }

    try {
        const options: RewardAdOptions = {
            adId: adUnitId,
            // isTesting: true, // simplified for now, let initialize handle it
        };

        console.log(`[AdMob] Preparing Ad: ${adUnitId}`);
        await AdMob.prepareRewardVideoAd(options);

        console.log(`[AdMob] Showing Ad`);
        await AdMob.showRewardVideoAd();
        return true;
    } catch (e) {
        console.error('[AdMob] Failed to show native ad', e);
        return false;
    }
};
