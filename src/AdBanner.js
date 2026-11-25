// src/AdBanner.js
import { useEffect, useRef, useState } from 'react';
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
    const [showContactFallback, setShowContactFallback] = useState(false);

    useEffect(() => {
        isVisibleRef.current = isVisible;
    }, [isVisible]);

    // Refresh UMP consent first. Initialize Mobile Ads and request a banner
    // only when UMP reports that ads may be requested.
    useEffect(() => {
        if (Capacitor.getPlatform() === 'web') {
            setShowContactFallback(true);
            return undefined;
        }

        let isMounted = true;
        let loadedListener = null;
        let failedListener = null;
        let fallbackTimer = null;
        let bannerLoaded = false;

        const clearFallbackTimer = () => {
            if (fallbackTimer !== null) {
                window.clearTimeout(fallbackTimer);
                fallbackTimer = null;
            }
        };

        const initializeBanner = async () => {
            if (isInitialized.current) return;

            try {
                const canRequestAds = await initializeAdMobWithConsent();
                if (!isMounted) return;

                if (!canRequestAds) {
                    setShowContactFallback(true);
                    return;
                }

                isInitialized.current = true;

                // Register both events before requesting the banner so the
                // first load result is not missed.
                loadedListener = await AdMob.addListener(
                    BannerAdPluginEvents.Loaded,
                    () => {
                        bannerLoaded = true;
                        clearFallbackTimer();
                        setShowContactFallback(false);

                        if (!isVisibleRef.current) {
                            AdMob.hideBanner().catch(() => {});
                        }
                    }
                );

                failedListener = await AdMob.addListener(
                    BannerAdPluginEvents.FailedToLoad,
                    (error) => {
                        clearFallbackTimer();
                        setShowContactFallback(true);
                        console.warn('AdMob 배너 로드 실패:', error);
                    }
                );

                const adId = Capacitor.getPlatform() === 'android'
                    ? 'ca-app-pub-9892155087017006/1760220755'
                    : 'ca-app-pub-3940256099942544/2934735716';

                // Show a contact fallback if no load result arrives.
                // A late successful load event automatically hides it.
                fallbackTimer = window.setTimeout(() => {
                    if (isMounted && !bannerLoaded) {
                        setShowContactFallback(true);
                    }
                }, 10000);

                await AdMob.showBanner({
                    adId,
                    adSize: BannerAdSize.ADAPTIVE_BANNER,
                    position: BannerAdPosition.TOP_CENTER,
                    margin: 0,
                    isTesting: false
                });

                if (!isMounted) {
                    clearFallbackTimer();
                    await AdMob.removeBanner().catch(() => {});
                    return;
                }

                bannerReady.current = true;
                if (!isVisibleRef.current) {
                    await AdMob.hideBanner().catch(() => {});
                }
            } catch (error) {
                clearFallbackTimer();
                if (isMounted) setShowContactFallback(true);
                console.error('AdMob 동의 확인 또는 배너 초기화 실패:', error);
            }
        };

        initializeBanner();

        return () => {
            isMounted = false;
            bannerReady.current = false;
            clearFallbackTimer();
            loadedListener?.remove();
            failedListener?.remove();
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
            if (Capacitor.getPlatform() !== 'web') {
                AdMob.removeBanner().catch(() => {});
            }
        };
    }, []);

    const inquirySubject = encodeURIComponent('[택배메이트] 배너 광고 제휴 문의');
    const inquiryMailto = `mailto:kjw891224@gmail.com?subject=${inquirySubject}`;

    if (!isVisible || !showContactFallback) return null;

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[9998] px-2 pt-1 pointer-events-none"
            aria-label="배너 광고 제휴 문의"
        >
            <div className="mx-auto flex h-9 max-w-[520px] items-center justify-between rounded-lg border border-gray-200 bg-white/95 px-3 shadow-sm pointer-events-auto dark:border-gray-700 dark:bg-gray-800/95">
                <span className="truncate text-[11px] font-semibold text-gray-700 dark:text-gray-100">
                    택배메이트 배너 광고 제휴
                </span>
                <a
                    href={inquiryMailto}
                    className="ml-3 shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white active:bg-blue-700"
                >
                    이메일 문의
                </a>
            </div>
        </div>
    );
};

export default AdBanner;
