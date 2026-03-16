// src/AdBanner.js
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';

const AdBanner = ({ isVisible, activeTab }) => {
    useEffect(() => {
        if (Capacitor.getPlatform() === 'web') return;

        const showFastBanner = async () => {
            try {
                // 1. 기존 광고 지우기
                await AdMob.removeBanner().catch(() => {});

                if (!isVisible) return;

                // 2. 대기 시간(setTimeout) 없이 즉시 광고 초기화 및 호출!
                await AdMob.initialize();

                const adId = Capacitor.getPlatform() === 'android' 
                    ? 'ca-app-pub-3940256099942544/6300978111' 
                    : 'ca-app-pub-3940256099942544/2934735716';

                // 3. 상단에 즉시 띄우기
                await AdMob.showBanner({
                    adId: adId,
                    adSize: BannerAdSize.ADAPTIVE_BANNER,
                    position: BannerAdPosition.TOP_CENTER, 
                    margin: 0, 
                    isTesting: true 
                });

            } catch (error) {
                console.error('AdMob 로드 실패:', error);
            }
        };

        showFastBanner();

        return () => {
            if (Capacitor.getPlatform() !== 'web') {
                AdMob.removeBanner().catch(() => {});
            }
        };
    }, [isVisible, activeTab]); 

    return null;
};

export default AdBanner;