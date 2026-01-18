export { };

// Define the Android Native Interface
declare global {
    interface Window {
        Android: {
            showRewardedAd: (adUnitId: string) => void;
        };
    }
}

// Rewarded Ad Unit IDs
export const ADMOB_UNITS = {
    // TEST UNIT ID for Android Rewarded Video
    // Use this for development and testing
    REWARDED_TEST: 'ca-app-pub-3940256099942544/5224354917',

    // Real Production ID (Should be replaced with config or env variable later)
    REWARDED_PROD: 'ca-app-pub-2810872681064029/7646925189'
};

/**
 * Triggers the Native Android AdMob Rewarded Ad
 * @param adUnitId The Ad Unit ID to load and show
 * @returns boolean true if native bridge was found and called, false otherwise.
 */
export const showNativeRewardedAd = (adUnitId: string = ADMOB_UNITS.REWARDED_TEST): boolean => {
    if (window.Android && window.Android.showRewardedAd) {
        console.log(`[AdMob] Calling Native Bridge with ID: ${adUnitId}`);
        window.Android.showRewardedAd(adUnitId);
        return true;
    }

    console.log('[AdMob] Native Bridge not found (Running in Browser Mode)');
    return false;
};
