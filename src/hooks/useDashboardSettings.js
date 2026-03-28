import { useState } from 'react';

// ✨ 앞으로 새로운 카드를 만들고 싶다면, 이 배열에 한 줄만 추가하시면 됩니다! (다른 코드는 손댈 필요 없음)
const DEFAULT_CONFIG = [
    { id: 'workDays', label: '출근일', isVisible: true },
    { id: 'totalVolume', label: '총 물량', isVisible: true }, 
    { id: 'avgVolume', label: '평균 물량', isVisible: true },
    { id: 'dailyAvg', label: '하루 평균', isVisible: true },
    { id: 'recommended', label: '일일 권장', isVisible: false },
];

export const useDashboardSettings = () => {
    const [dashboardConfig, setDashboardConfig] = useState(() => {
        const saved = localStorage.getItem('dashboardSettings');
        if (saved) {
            const parsedSaved = JSON.parse(saved);

            // ✨ [핵심] 마법의 자동 병합(Merge) 시스템
            let mergedConfig = [...parsedSaved]; // 1. 기존 사용자의 옛날 저장 데이터를 가져옵니다.

            // 2. 우리가 새로 정의한 DEFAULT_CONFIG를 하나씩 돌면서 검사합니다.
            DEFAULT_CONFIG.forEach((defaultItem, index) => {
                const isExist = mergedConfig.find(item => item.id === defaultItem.id);
                
                // 3. 어? 옛날 데이터에 없는 새로운 카드(예: 총 물량)를 발견했네?!
                if (!isExist) {
                    // 그러면 원래 있어야 할 기본 위치(index)에 알아서 예쁘게 끼워 넣어줍니다!
                    mergedConfig.splice(index, 0, defaultItem);
                }
            });

            // 4. (보너스) 만약 나중에 특정 카드를 아예 삭제했다면, 사용자 데이터에서도 깔끔하게 청소해 줍니다.
            mergedConfig = mergedConfig.filter(item => DEFAULT_CONFIG.find(d => d.id === item.id));

            return mergedConfig;
        }
        return DEFAULT_CONFIG;
    });

    const saveDashboardConfig = (newConfig) => {
        setDashboardConfig(newConfig);
        localStorage.setItem('dashboardSettings', JSON.stringify(newConfig));
    };

    return { dashboardConfig, saveDashboardConfig };
};

export default useDashboardSettings;