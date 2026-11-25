// src/AdBanner.js
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import {
    AdMob,
    BannerAdSize,
    BannerAdPosition,
    BannerAdPluginEvents
} from '@capacitor-community/admob';
import { initializeAdMobWithConsent } from './services/adMobConsentService';

const AdBanner = ({ isVisible, activeTab }) => {
    const isInitialized = useRef(false);
    const bannerReady = useRef(false);
    const isVisibleRef = useRef(isVisible);

    useEffect(() => {
        isVisibleRef.current = isVisible;
    }, [isVisible]);

    // Refresh UMP consent first. Initialize Mobile Ads and request a banner
    // only when UMP reports that ads may be requested.
    useEffect(() => {
        if (Capacitor.getPlatform() === 'web') return undefined;

        let isMounted = true;
        let loadedListener = null;

        const initializeBanner = async () => {
            if (isInitialized.current) return;

            try {
                const canRequestAds = await initializeAdMobWithConsent();
                if (!isMounted || !canRequestAds) return;

                isInitialized.current = true;

                loadedListener = await AdMob.addListener(
                    BannerAdPluginEvents.Loaded,
                    () => {
                        if (!isVisibleRef.current) {
                            AdMob.hideBanner().catch(() => {});
                        }
                    }
                );

                const adId = Capacitor.getPlatform() === 'android'
                    ? 'ca-app-pub-9892155087017006/1760220755'
                    : 'ca-app-pub-3940256099942544/2934735716';

                await AdMob.showBanner({
                    adId,
                    adSize: BannerAdSize.ADAPTIVE_BANNER,
                    position: BannerAdPosition.TOP_CENTER,
                    margin: 0,
                    isTesting: false
                });

                if (!isMounted) {
                    await AdMob.removeBanner().catch(() => {});
                    return;
                }

                bannerReady.current = true;
                if (!isVisibleRef.current) {
                    await AdMob.hideBanner().catch(() => {});
                }
            } catch (error) {
                console.error('AdMob 동의 확인 또는 배너 초기화 실패:', error);
            }
        };

        initializeBanner();

        return () => {
            isMounted = false;
            bannerReady.current = false;
            loadedListener?.remove();
        };
    }, []);

    // Toggle an initialized banner when the user changes tabs.
    useEffect(() => {
        if (Capacitor.getPlatform() === 'web' || !bannerReady.current) return;

        const toggleVisibility = async () => {
            try {
                if (isVisible) {
                    await AdMob.resumeBanner().catch(() => {});
                } else {
                    await AdMob.hideBanner().catch(() => {});
                }
            } catch (error) {
                console.warn('AdMob 배너 표시 상태 변경 실패:', error);
            }
        };

        toggleVisibility();
    }, [isVisible]);

    useEffect(() => {
        return () => {
            if (Capacitor.getPlatform() !== 'web' && bannerReady.current) {
                AdMob.removeBanner().catch(() => {});
            }
        };
    }, []);

    return null;
};

export default AdBanner;
