import { useState } from 'react';

const DEFAULT_CONFIG = [
    // 🧱 1줄: 소형 파츠 4개 (x: 0, 1, 2, 3 / y: 0 / w: 1)
    { id: 'workDays', label: '출근일', x: 0, y: 0, w: 1, h: 2, isVisible: true },
    { id: 'avgVolume', label: '평균 물량', x: 1, y: 0, w: 1, h: 2, isVisible: true },
    { id: 'totalVolume', label: '총 물량', x: 2, y: 0, w: 1, h: 2, isVisible: true },
    { id: 'dailyAvg', label: '하루 평균', x: 3, y: 0, w: 1, h: 2, isVisible: true },

    // 💰 2줄: 매출(3칸) + 보험사(1칸) (x: 0, 3 / y: 2)
    { id: 'revenue', label: '이번 달 매출', x: 0, y: 2, w: 3, h: 2, isVisible: true },
    { id: 'insurance', label: '보험사', x: 3, y: 2, w: 1, h: 2, isVisible: true },
    
    // 💡 보관함 (안 보이는 것들)
    { id: 'remainingWorkDays', label: '남은 출근일', x: 0, y: 4, w: 1, h: 2, isVisible: false },
    { id: 'compareLastMonth', label: '전월 대비', x: 1, y: 4, w: 1, h: 2, isVisible: false },
    { id: 'recommended', label: '일일 권장', x: 2, y: 4, w: 1, h: 2, isVisible: false },
    { id: 'estimatedSalary', label: '예상 월급', x: 0, y: 6, w: 3, h: 2, isVisible: false },
    { id: 'monthlyHolidays', label: '한달 휴무', x: 3, y: 6, w: 1, h: 2, isVisible: false },
];

// ✨ 여기서부터 훅(Hook) 함수가 시작됩니다!
export const useDashboardSettings = () => {
    const [dashboardConfig, setDashboardConfig] = useState(() => {
        const saved = localStorage.getItem('dashboardSettings_v2'); 
        
        if (saved) {
            const parsedSaved = JSON.parse(saved);
            let mergedConfig = [...parsedSaved]; 

            DEFAULT_CONFIG.forEach((defaultItem) => {
                const isExist = mergedConfig.find(item => item.id === defaultItem.id);
                if (!isExist) {
                    // ✨ 그리드에서는 중간에 끼워넣기(splice)보다 맨 뒤에 추가(push)하는 것이 레이아웃 꼬임을 방지합니다.
                    mergedConfig.push(defaultItem); 
                }
            });

            // 4. (보너스) 만약 나중에 특정 카드를 아예 삭제했다면, 사용자 데이터에서도 깔끔하게 청소해 줍니다.
            mergedConfig = mergedConfig.filter(item => DEFAULT_CONFIG.find(d => d.id === item.id));

            return mergedConfig;
        }
        
        // ✨ [중요] 저장된 데이터가 없는 '완전 처음' 켰을 때는 기본값을 보여줍니다!
        return DEFAULT_CONFIG;
    });

    const saveDashboardConfig = (newConfig) => {
        setDashboardConfig(newConfig);
        // ✨ 저장 키도 v2로 통일합니다.
        localStorage.setItem('dashboardSettings_v2', JSON.stringify(newConfig));
    };

    return { dashboardConfig, saveDashboardConfig };
};

export default useDashboardSettings;