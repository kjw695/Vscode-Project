import { useMemo, useCallback } from 'react';
import { calculateData, getMonthlyDateRange } from '../utils/calculator';

export const useProfitCalculations = (entries, selectedMonth, selectedYear, monthlyStartDay, monthlyEndDay, userId, itemLabels = {}) => {

    const calculateDataMemoized = useCallback((filteredEntries) => {
        return calculateData(filteredEntries, itemLabels);
    }, [itemLabels]); 

    const monthlyProfit = useMemo(() => {
        if (!selectedMonth) return {};
        const [year, month] = selectedMonth.split('-').map(Number);
        
        const { startStr, endStr } = getMonthlyDateRange(year, month, monthlyStartDay, monthlyEndDay);
        const filtered = entries.filter(e => e.date >= startStr && e.date <= endStr);
        return calculateDataMemoized(filtered);
    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, calculateDataMemoized]);

    const yearlyProfit = useMemo(() => {
        let allYearlyEntries = [];
        const monthlyBreakdown = [];
        const yearNum = parseInt(selectedYear);

        for (let m = 1; m <= 12; m++) {
            // ✨ 핵심 수정: 1~12월을 각각 사용자가 설정한 시작일/종료일 기준으로 추출합니다.
            const { startStr, endStr } = getMonthlyDateRange(yearNum, m, monthlyStartDay, monthlyEndDay);
            const mData = entries.filter(e => e.date >= startStr && e.date <= endStr);
            
            // 1년치 총합을 구하기 위해 데이터를 차곡차곡 모아둡니다.
            allYearlyEntries = allYearlyEntries.concat(mData);

            const mStats = calculateDataMemoized(mData);
            monthlyBreakdown.push({ 
                month: m, 
                netProfit: mStats.netProfit, 
                revenue: mStats.totalRevenue, 
                expenses: mStats.totalExpenses,
                startStr, // 상세 페이지에서 보여줄 시작 날짜
                endStr    // 상세 페이지에서 보여줄 종료 날짜
            });
        }
        
        // ✨ 모아둔 1년 치(12번의 주기) 데이터를 한 번에 계산
        const stats = calculateDataMemoized(allYearlyEntries);
        return { ...stats, monthlyBreakdown };
    }, [entries, selectedYear, monthlyStartDay, monthlyEndDay, calculateDataMemoized]);

    const cumulativeProfit = useMemo(() => calculateDataMemoized(entries), [entries, calculateDataMemoized]);

    const previousMonthlyProfit = useMemo(() => {
        if (!selectedMonth) return {};
        const [year, month] = selectedMonth.split('-').map(Number);
        let prevYear = year; let prevMonth = month - 1;
        if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
        
        const { startStr, endStr } = getMonthlyDateRange(prevYear, prevMonth, monthlyStartDay, monthlyEndDay);
        const filtered = entries.filter(e => e.date >= startStr && e.date <= endStr);
        return calculateDataMemoized(filtered);
    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, calculateDataMemoized]);

    return { monthlyProfit, yearlyProfit, cumulativeProfit, previousMonthlyProfit };
};