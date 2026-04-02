// src/AdBanner.js
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';

const AdBanner = ({ isVisible, activeTab }) => {
    const isInitialized = useRef(false);

    useEffect(() => {
        if (Capacitor.getPlatform() === 'web') return;

        const toggleFastBanner = async () => {
            try {
                // 1. 앱이 켜지고 딱 한 번! 무조건 광고를 세팅합니다. (탭을 누르지 않았어도 백그라운드에서 다운로드 시작)
                if (!isInitialized.current) {
                    await AdMob.initialize();

                    const adId = Capacitor.getPlatform() === 'android' 
                        ? 'ca-app-pub-9892155087017006/1760220755' 
                        : 'ca-app-pub-3940256099942544/2934735716';

                    // 일단 광고를 붙입니다.
                    await AdMob.showBanner({
                        adId: adId,
                        adSize: BannerAdSize.ADAPTIVE_BANNER,
                        position: BannerAdPosition.TOP_CENTER, 
                        margin: 0, 
                        isTesting: false
                    });

                    isInitialized.current = true;

                    // ✨ 핵심: 만약 현재 탭이 '더보기/검색'이 아니라면, 
                    // 광고가 다운로드 되자마자 0.001초 만에 바로 숨겨버립니다(투명망토).
                    if (!isVisible) {
                        await AdMob.hideBanner().catch((e) => console.warn('배너 숨기기 실패:', e));
                    }
                } 
                // 2. 이미 백그라운드에 광고가 준비되어 있다면 망토만 벗기고 씌웁니다!
                else {
                    if (isVisible) {
                        await AdMob.resumeBanner().catch(() => {}); // 0초 만에 즉시 등장!
                    } else {
                        await AdMob.hideBanner().catch(() => {});   // 0초 만에 즉시 사라짐!
                    }
                }
            } catch (error) {
                console.error('AdMob 로드/전환 실패:', error);
            }
        };

        toggleFastBanner();

    }, [isVisible]);

    useEffect(() => {
        return () => {
            if (Capacitor.getPlatform() !== 'web') {
                AdMob.removeBanner().catch(() => {});
            }
        };
    }, []);

    return null;
};

export default AdBanner;