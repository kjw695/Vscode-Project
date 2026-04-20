// src/AdBanner.js
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
// ✨ [추가] BannerAdPluginEvents 를 수입해 옵니다! (스파이 역할)
import { AdMob, BannerAdSize, BannerAdPosition, BannerAdPluginEvents } from '@capacitor-community/admob';

const AdBanner = ({ isVisible, activeTab }) => {
    const isInitialized = useRef(false);
    const isVisibleRef = useRef(isVisible); // 👈 현재 사장님이 허락했는지(탭 상태) 기억하는 메모장

    // 탭이 바뀔 때마다 메모장에 최신 상태를 적어둡니다.
    useEffect(() => {
        isVisibleRef.current = isVisible;
    }, [isVisible]);

    // 🌟 1. 앱 켜질 때 딱 한 번 실행: 몰래 다운로드 시작 & 스파이 심기
    useEffect(() => {
        if (Capacitor.getPlatform() === 'web') return;

        let loadedListener = null;

        const initFastBanner = async () => {
            if (isInitialized.current) return;
            isInitialized.current = true;

            try {
                await AdMob.initialize();

                // 🕵️‍♂️ [핵심 스파이] 구글에서 광고가 '도착'하는 정확한 순간을 포착!!
                loadedListener = await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
                    // 광고가 도착해서 막 화면에 뜨려고 하는데, 메모장을 보니 지금 홈 화면이네?!
                    if (!isVisibleRef.current) {
                        AdMob.hideBanner().catch(() => {}); // 묻지도 따지지도 않고 그 즉시 투명 망토 씌움!
                    }
                });

                const adId = Capacitor.getPlatform() === 'android' 
                    ? 'ca-app-pub-9892155087017006/1760220755' 
                    : 'ca-app-pub-3940256099942544/2934735716';

                // 앱이 켜지자마자 백그라운드에서 광고 다운로드를 시작합니다 (대표님 원래 아이디어!)
                await AdMob.showBanner({
                    adId: adId,
                    adSize: BannerAdSize.ADAPTIVE_BANNER,
                    position: BannerAdPosition.TOP_CENTER, 
                    margin: 0, 
                    isTesting: false
                });

            } catch (error) {
                console.error('AdMob 로드 실패:', error);
            }
        };

        initFastBanner();

        return () => {
            if (loadedListener) loadedListener.remove(); // 퇴근할 때 스파이도 같이 퇴근
        };
    }, []); 

    // 🌟 2. 탭이 바뀔 때마다 실행: 이미 받아둔 광고에 망토만 씌우고 벗기기 (0.01초 컷!)
    useEffect(() => {
        if (Capacitor.getPlatform() === 'web') return;

        const toggleVisibility = async () => {
            try {
                if (isVisible) {
                    await AdMob.resumeBanner().catch(() => {}); // 허락 떨어지면 즉시 짠!
                } else {
                    await AdMob.hideBanner().catch(() => {});   // 안 되면 즉시 휙!
                }
            } catch (error) {}
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

    return null;
};

export default AdBanner;