import { useState } from 'react';

// 로컬 스토리지 안전하게 읽기 헬퍼
const getSavedSetting = (key, defaultValue) => {
    try {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            return parsed[key] !== undefined ? parsed[key] : defaultValue;
        }
    } catch (e) {
        console.error("설정 로드 오류", e);
    }
    return defaultValue;
};

export const useDataManager = () => {
    // 1. 동적 지출 데이터 (입력값)
    const [formData, setFormData] = useState({}); 

    // 2. 지출 항목 설정 (초기화 최적화 적용)
    const [expenseConfig, setExpenseConfig] = useState(() => getSavedSetting('expenseConfig', [
        { key: 'penaltyAmount', label: '패널티', isVisible: true },
        { key: 'industrialAccidentCost', label: '산재', isVisible: true },
        { key: 'fuelCost', label: '유류비', isVisible: true },
        { key: 'maintenanceCost', label: '유지보수비', isVisible: true },
        { key: 'vatAmount', label: '부가세', isVisible: true },
        { key: 'incomeTaxAmount', label: '종합소득세', isVisible: true },
        { key: 'taxAccountantFee', label: '세무사 비용', isVisible: true },
    ]));

    // 3. 즐겨찾는 단가
    const [favoriteUnitPrices, setFavoriteUnitPrices] = useState(() => 
        getSavedSetting('favoriteUnitPrices', [700])
    );

    // 4. 월별 집계 기간
    const [monthlyPeriod, setMonthlyPeriod] = useState(() => 
        getSavedSetting('monthlyPeriod', { startDay: 26, endDay: 25 })
    );

    // 5. 목표 금액
    const [goalAmount, setGoalAmount] = useState(() => 
        getSavedSetting('goalAmount', 7000000)
    );

    // ✅ 설정 저장 헬퍼 함수
    const saveSettings = (newSettings) => {
        try {
            const current = JSON.parse(localStorage.getItem('appSettings') || '{}');
            const updated = { ...current, ...newSettings };
            localStorage.setItem('appSettings', JSON.stringify(updated));
            
            // 상태 업데이트
            if (newSettings.expenseConfig) setExpenseConfig(newSettings.expenseConfig);
            if (newSettings.favoriteUnitPrices) setFavoriteUnitPrices(newSettings.favoriteUnitPrices);
            if (newSettings.monthlyPeriod) setMonthlyPeriod(newSettings.monthlyPeriod);
            if (newSettings.goalAmount) setGoalAmount(newSettings.goalAmount);
        } catch (error) {
            console.error("설정 저장 실패:", error);
        }
    };

    return {
        formData, setFormData,
        expenseConfig,
        favoriteUnitPrices,
        monthlyPeriod,
        goalAmount,
        saveSettings
    };
};