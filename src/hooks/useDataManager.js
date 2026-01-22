import { useState, useEffect } from 'react';

export const useDataManager = () => {
    // 1. 동적 지출 데이터 (입력값)
    const [formData, setFormData] = useState({}); 

    // 2. 지출 항목 설정 (관리 목록)
    const [expenseConfig, setExpenseConfig] = useState([
        { key: 'penaltyAmount', label: '패널티', isVisible: true },
        { key: 'industrialAccidentCost', label: '산재', isVisible: true },
        { key: 'fuelCost', label: '유류비', isVisible: true },
        { key: 'maintenanceCost', label: '유지보수비', isVisible: true },
        { key: 'vatAmount', label: '부가세', isVisible: true },
        { key: 'incomeTaxAmount', label: '종합소득세', isVisible: true },
        { key: 'taxAccountantFee', label: '세무사 비용', isVisible: true },
    ]);

    // 3. 즐겨찾는 단가
    const [favoriteUnitPrices, setFavoriteUnitPrices] = useState([700]);
    // 4. 월별 집계 기간
    const [monthlyPeriod, setMonthlyPeriod] = useState({ startDay: 26, endDay: 25 });
    // 5. 목표 금액
    const [goalAmount, setGoalAmount] = useState(7000000);

    // ✅ 앱 시작 시 저장된 설정 불러오기 (App.js의 useEffect 대체)
    useEffect(() => {
        const loadSettings = () => {
            try {
                const savedSettings = localStorage.getItem('appSettings');
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    if (settings.expenseConfig) setExpenseConfig(settings.expenseConfig);
                    if (settings.favoriteUnitPrices) setFavoriteUnitPrices(settings.favoriteUnitPrices);
                    if (settings.monthlyPeriod) setMonthlyPeriod(settings.monthlyPeriod);
                    if (settings.goalAmount) setGoalAmount(settings.goalAmount);
                }
            } catch (error) {
                console.error("설정 로드 실패:", error);
            }
        };
        loadSettings();
    }, []);

    // ✅ 설정 저장 헬퍼 함수 (App.js 코드를 줄여줌)
    const saveSettings = (newSettings) => {
        const current = JSON.parse(localStorage.getItem('appSettings') || '{}');
        const updated = { ...current, ...newSettings };
        localStorage.setItem('appSettings', JSON.stringify(updated));
        
        // 상태 업데이트
        if (newSettings.expenseConfig) setExpenseConfig(newSettings.expenseConfig);
        if (newSettings.favoriteUnitPrices) setFavoriteUnitPrices(newSettings.favoriteUnitPrices);
        if (newSettings.monthlyPeriod) setMonthlyPeriod(newSettings.monthlyPeriod);
        if (newSettings.goalAmount) setGoalAmount(newSettings.goalAmount);
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