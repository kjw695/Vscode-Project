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
        const stats = calculateDataMemoized(entries.filter(e => e.date.startsWith(selectedYear)));
        const monthlyBreakdown = [];
        for (let m = 1; m <= 12; m++) {
            const mStr = String(m).padStart(2, '0');
            const targetMonth = `${selectedYear}-${mStr}`;
            const mData = entries.filter(e => e.date.startsWith(targetMonth));
            const mStats = calculateDataMemoized(mData);
            monthlyBreakdown.push({ month: m, netProfit: mStats.netProfit, revenue: mStats.totalRevenue, expenses: mStats.totalExpenses });
        }
        return { ...stats, monthlyBreakdown };
    }, [entries, selectedYear, calculateDataMemoized]);

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