// src/hooks/useAdReward.js
import { AdMob } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export const useAdReward = ({ 
    showConfirmation, 
    showMessage, 
    setIsLoading, 
    setLoadingMessage, 
    setStatisticsView 
}) => {
    
    // ⏳ 1. 10분 쿨다운 체크 함수
    const checkAdCooldown = (tabName) => {
        const lastWatched = localStorage.getItem(`ad_cooldown_${tabName}`);
        if (!lastWatched) return false; 
        
        const now = new Date().getTime();
        const diffInMinutes = (now - parseInt(lastWatched, 10)) / (1000 * 60);
        
        return diffInMinutes < 10; 
    };

    // ⏳ 2. 광고 시청 완료 후 시간 저장 함수
    const setAdCooldown = (tabName) => {
        localStorage.setItem(`ad_cooldown_${tabName}`, new Date().getTime().toString());
    };

    // 📺 3. 연간/누적 탭을 누를 때 실행될 핵심 함수
    const handleProtectedTabClick = async (targetTab) => { 
        const isExempt = checkAdCooldown(targetTab); 
        const tabTitle = targetTab === 'yearly' ? '연간' : '누적';

        if (isExempt) {
            // 10분이 지나지 않았다면 광고 없이 바로 화면 이동!
            setStatisticsView(targetTab);
        } else {
            // 10분이 지났거나 처음 누르는 거라면 경고 팝업 띄우기
            showConfirmation(
                `${tabTitle} 통계를 확인하려면 짧은 광고 시청이 필요합니다.\n(1회 시청 시 10분간 무료 패스권 지급! 🎫)`,
                async () => {
                    try {
                        setIsLoading(true);
                        setLoadingMessage('광고를 준비 중입니다...');

                        // 웹(브라우저) 환경에서는 애드몹이 작동하지 않으므로 바로 넘겨주는 안전장치
                        if (Capacitor.getPlatform() === 'web') {
                            setIsLoading(false);
                            console.log("웹 환경: 광고가 스킵되고 바로 이동합니다.");
                            setAdCooldown(targetTab);
                            setStatisticsView(targetTab);
                            return;
                        }

                        // 보상형 광고 로드 (테스트 ID 적용)
                        await AdMob.prepareRewardVideoAd({
                            adId: Capacitor.getPlatform() === 'android' 
                                ? 'ca-app-pub-3940256099942544/5224354917'  
                                : 'ca-app-pub-3940256099942544/1712480198', 
                            isTesting: true 
                        });

                        setIsLoading(false); 
                        await AdMob.showRewardVideoAd(); 

                        // 광고 시청이 무사히 끝나면
                        setAdCooldown(targetTab); 
                        setStatisticsView(targetTab); 

                    } catch (error) {
                        console.error('광고 실행 실패:', error);
                        setIsLoading(false);
                        showMessage("광고를 불러올 수 없습니다. 인터넷 연결을 확인해주세요.");
                    }
                }
            );
        }
    };

    // 밖에서 쓸 수 있게 함수를 반환합니다.
    return { handleProtectedTabClick };
};