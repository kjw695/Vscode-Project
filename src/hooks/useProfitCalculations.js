// src/hooks/useProfitCalculations.js

import { useCallback, useMemo } from 'react';
import { formatDate } from '../utils'; // 유틸리티 함수도 그대로 사용합니다.

// 계산 로직을 담당하는 커스텀 훅
export const useProfitCalculations = (entries, selectedMonth, selectedYear, monthlyStartDay, monthlyEndDay, userId) => {

    // 월별 수익 계산
    const calculateMonthlyProfit = useCallback(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const periodEndDate = new Date(year, month - 1, monthlyEndDay);
        let periodStartDate;
        if (monthlyStartDay <= monthlyEndDay) {
            periodStartDate = new Date(year, month - 1, monthlyStartDay);
        } else {
            periodStartDate = new Date(year, month - 2, monthlyStartDay);
        }
        const formattedPeriodStartDate = formatDate(periodStartDate);
        const formattedPeriodEndDate = formatDate(periodEndDate);

        const filteredEntries = userId ? entries.filter(entry => entry.date >= formattedPeriodStartDate && entry.date <= formattedPeriodEndDate) : [];

        let totalDeliveryRevenue = 0, totalReturnRevenue = 0, totalFreshBagRevenue = 0, totalDeliveryInterruptionRevenue = 0;
        let totalPenaltyCost = 0, totalIndustrialAccidentCost = 0, totalFuelCost = 0, totalMaintenanceCost = 0;
        let totalVatAmount = 0, totalIncomeTaxAmount = 0, totalTaxAccountantFee = 0;
        const dailyBreakdown = {};
        const uniqueDatesMonthly = new Set();

        filteredEntries.forEach(entry => {
            if (entry.deliveryCount > 0 || entry.returnCount > 0 || entry.freshBagCount > 0 || entry.deliveryInterruptionAmount > 0 || entry.penaltyAmount > 0 || entry.industrialAccidentCost > 0 || entry.fuelCost > 0 || entry.maintenanceCost > 0 || entry.vatAmount > 0 || entry.incomeTaxAmount > 0 || entry.taxAccountantFee > 0) {
                uniqueDatesMonthly.add(entry.date);
            }
            const deliveryInterruptionCalculated = (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0);
            const dailyRevenue = (entry.unitPrice * entry.deliveryCount) + (entry.unitPrice * entry.returnCount) + deliveryInterruptionCalculated + ((entry.freshBagCount || 0) * 100);
            const dailyExpenses = (entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0);
            
            if (!dailyBreakdown[entry.date]) dailyBreakdown[entry.date] = { revenue: 0, expenses: 0 };
            dailyBreakdown[entry.date].revenue += dailyRevenue;
            dailyBreakdown[entry.date].expenses += dailyExpenses;

            totalDeliveryRevenue += entry.unitPrice * entry.deliveryCount;
            totalReturnRevenue += entry.unitPrice * entry.returnCount;
            totalDeliveryInterruptionRevenue += deliveryInterruptionCalculated;
            totalFreshBagRevenue += (entry.freshBagCount || 0) * 100;
            totalPenaltyCost += (entry.penaltyAmount || 0);
            totalIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
            totalFuelCost += (entry.fuelCost || 0);
            totalMaintenanceCost += (entry.maintenanceCost || 0);
            totalVatAmount += (entry.vatAmount || 0);
            totalIncomeTaxAmount += (entry.incomeTaxAmount || 0);
            totalTaxAccountantFee += (entry.taxAccountantFee || 0);
        });
        
        const netProfit = totalDeliveryRevenue + totalReturnRevenue + totalFreshBagRevenue + totalDeliveryInterruptionRevenue - totalPenaltyCost - totalIndustrialAccidentCost - totalFuelCost - totalMaintenanceCost - totalVatAmount - totalIncomeTaxAmount - totalTaxAccountantFee;
        const totalVolume = filteredEntries.reduce((sum, entry) => sum + (entry.deliveryCount || 0) + (entry.returnCount || 0) + (entry.deliveryInterruptionAmount || 0), 0);
        const totalFreshBag = filteredEntries.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
        const totalWorkingDays = uniqueDatesMonthly.size;
        const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;
        const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;

        return {
            totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue,
            totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee,
            netProfit, periodStartDate, periodEndDate, dailyBreakdown,
            totalVolume, totalExpensesSum, totalFreshBag, totalWorkingDays, dailyAverageVolume
        };
    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, userId]);

    // 연간 수익 계산
    const calculateYearlyProfit = useCallback(() => {
        const year = parseInt(selectedYear);
        
        // ✨ 변경점: 사용자가 설정한 집계 기간을 기준으로 연간 시작일과 종료일을 계산합니다.
        let yearlyStartDate, yearlyEndDate;
        if (monthlyStartDay > monthlyEndDay) {
            // 기간이 해를 넘기는 경우 (예: 26일 ~ 25일)
            yearlyStartDate = new Date(year - 1, 11, monthlyStartDay);
            yearlyEndDate = new Date(year, 11, monthlyEndDay);
        } else {
            // 기간이 같은 달 안에 있는 경우 (예: 1일 ~ 31일)
            yearlyStartDate = new Date(year, 0, 1);
            yearlyEndDate = new Date(year, 11, 31);
        }
        
        const formattedYearlyStartDate = formatDate(yearlyStartDate);
        const formattedYearlyEndDate = formatDate(yearlyEndDate);

        // ✨ 변경점: 달력 기준이 아닌, 계산된 연간 집계 기간으로 데이터를 필터링합니다.
        const filteredEntriesForYear = userId ? entries.filter(entry => entry.date >= formattedYearlyStartDate && entry.date <= formattedYearlyEndDate) : [];
        
        let totalDeliveryRevenue = 0, totalReturnRevenue = 0, totalFreshBagRevenue = 0, totalDeliveryInterruptionRevenue = 0;
        let totalPenaltyCost = 0, totalIndustrialAccidentCost = 0, totalFuelCost = 0, totalMaintenanceCost = 0;
        let totalVatAmount = 0, totalIncomeTaxAmount = 0, totalTaxAccountantFee = 0;
        const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, netProfit: 0 }));
        const uniqueDatesYearly = new Set();
        
        filteredEntriesForYear.forEach(entry => {
            uniqueDatesYearly.add(entry.date);
            const deliveryInterruptionCalculated = (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0);
            totalDeliveryRevenue += entry.unitPrice * entry.deliveryCount;
            totalReturnRevenue += entry.unitPrice * entry.returnCount;
            totalDeliveryInterruptionRevenue += deliveryInterruptionCalculated;
            totalFreshBagRevenue += (entry.freshBagCount || 0) * 100;
            totalPenaltyCost += (entry.penaltyAmount || 0);
            totalIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
            totalFuelCost += (entry.fuelCost || 0);
            totalMaintenanceCost += (entry.maintenanceCost || 0);
            totalVatAmount += (entry.vatAmount || 0);
            totalIncomeTaxAmount += (entry.incomeTaxAmount || 0);
            totalTaxAccountantFee += (entry.taxAccountantFee || 0);

            // 월별 상세 내역 계산
            const entryMonth = new Date(entry.date).getMonth(); // 0 = 1월, 11 = 12월
            const entryNetProfit = (entry.unitPrice * entry.deliveryCount) + (entry.unitPrice * entry.returnCount) + deliveryInterruptionCalculated + ((entry.freshBagCount || 0) * 100) - ((entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0));
            monthlyBreakdown[entryMonth].netProfit += entryNetProfit;
        });
        
        const netProfit = totalDeliveryRevenue + totalReturnRevenue + totalFreshBagRevenue + totalDeliveryInterruptionRevenue - totalPenaltyCost - totalIndustrialAccidentCost - totalFuelCost - totalMaintenanceCost - totalVatAmount - totalIncomeTaxAmount - totalTaxAccountantFee;
        const totalVolume = filteredEntriesForYear.reduce((sum, entry) => sum + (entry.deliveryCount || 0) + (entry.returnCount || 0), 0);
        const totalFreshBag = filteredEntriesForYear.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
        const totalWorkingDays = uniqueDatesYearly.size;
        const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;
        const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;

        return {
            totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue,
            totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee,
            netProfit, monthlyBreakdown,
            totalVolume, totalExpensesSum, totalFreshBag, totalWorkingDays, dailyAverageVolume,
            periodStartDate: yearlyStartDate, // ✨ 변경점: 계산된 기간을 반환 객체에 추가
            periodEndDate: yearlyEndDate      // ✨ 변경점: 계산된 기간을 반환 객체에 추가
        };
    }, [entries, selectedYear, monthlyStartDay, monthlyEndDay, userId]);

    // 누적 수익 계산
    const calculateCumulativeProfit = useCallback(() => {
        const entriesForCumulative = userId ? entries : [];
        if (entriesForCumulative.length === 0) {
            return { netProfit: 0, totalWorkingDays: 0, totalVolume: 0, totalFreshBag: 0, dailyAverageVolume: 0, totalExpensesSum: 0, totalDeliveryRevenue: 0, totalReturnRevenue: 0, totalFreshBagRevenue: 0, totalDeliveryInterruptionRevenue: 0, totalPenaltyCost: 0, totalIndustrialAccidentCost: 0, totalFuelCost: 0, totalMaintenanceCost: 0, totalVatAmount: 0, totalIncomeTaxAmount: 0, totalTaxAccountantFee: 0, periodStartDate: null, periodEndDate: null };
        }

        let totalDeliveryRevenue = 0, totalReturnRevenue = 0, totalFreshBagRevenue = 0, totalDeliveryInterruptionRevenue = 0;
        let totalPenaltyCost = 0, totalIndustrialAccidentCost = 0, totalFuelCost = 0, totalMaintenanceCost = 0;
        let totalVatAmount = 0, totalIncomeTaxAmount = 0, totalTaxAccountantFee = 0;
        const uniqueDatesCumulative = new Set();
        
        entriesForCumulative.forEach(entry => {
            if (entry.deliveryCount > 0 || entry.returnCount > 0 || entry.freshBagCount > 0 || entry.deliveryInterruptionAmount > 0 || entry.penaltyAmount > 0 || entry.industrialAccidentCost > 0 || entry.fuelCost > 0 || entry.maintenanceCost > 0 || entry.vatAmount > 0 || entry.incomeTaxAmount > 0 || entry.taxAccountantFee > 0) {
                uniqueDatesCumulative.add(entry.date);
            }
            const deliveryInterruptionCalculated = (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0);
            totalDeliveryRevenue += entry.unitPrice * entry.deliveryCount;
            totalReturnRevenue += entry.unitPrice * entry.returnCount;
            totalDeliveryInterruptionRevenue += deliveryInterruptionCalculated;
            totalFreshBagRevenue += (entry.freshBagCount || 0) * 100;
            totalPenaltyCost += (entry.penaltyAmount || 0);
            totalIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
            totalFuelCost += (entry.fuelCost || 0);
            totalMaintenanceCost += (entry.maintenanceCost || 0);
            totalVatAmount += (entry.vatAmount || 0);
            totalIncomeTaxAmount += (entry.incomeTaxAmount || 0);
            totalTaxAccountantFee += (entry.taxAccountantFee || 0);
        });

        const netProfit = totalDeliveryRevenue + totalReturnRevenue + totalFreshBagRevenue + totalDeliveryInterruptionRevenue - totalPenaltyCost - totalIndustrialAccidentCost - totalFuelCost - totalMaintenanceCost - totalVatAmount - totalIncomeTaxAmount - totalTaxAccountantFee;
        const totalWorkingDays = uniqueDatesCumulative.size;
        const totalVolume = entriesForCumulative.reduce((sum, entry) => sum + (entry.deliveryCount || 0) + (entry.returnCount || 0), 0);
        const totalFreshBag = entriesForCumulative.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
        const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;
        const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;
        
        // ✨ 변경점: 누적 기간을 계산합니다.
        const dates = entriesForCumulative.map(e => new Date(e.date));
        const minDate = new Date(Math.min.apply(null, dates));
        const maxDate = new Date(Math.max.apply(null, dates));

        return {
            totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue,
            totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee,
            netProfit, totalWorkingDays, totalVolume, totalFreshBag, dailyAverageVolume, totalExpensesSum,
            periodStartDate: minDate, // ✨ 변경점: 계산된 기간을 반환 객체에 추가
            periodEndDate: maxDate    // ✨ 변경점: 계산된 기간을 반환 객체에 추가
        };
    }, [entries, userId]);

    // 이전 달 수익 계산
    const calculatePreviousMonthlyProfit = useCallback(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        let prevMonth = month - 1, prevYear = year;
        if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }

        const prevPeriodEndDate = new Date(prevYear, prevMonth - 1, monthlyEndDay);
        let prevPeriodStartDate;
        if (monthlyStartDay <= monthlyEndDay) {
            prevPeriodStartDate = new Date(prevYear, prevMonth - 1, monthlyStartDay);
        } else {
            prevPeriodStartDate = new Date(prevYear, prevMonth - 2, monthlyStartDay);
        }

        const formattedPrevPeriodStartDate = formatDate(prevPeriodStartDate);
        const formattedPrevPeriodEndDate = formatDate(prevPeriodEndDate);
        const filteredEntries = userId ? entries.filter(entry => entry.date >= formattedPrevPeriodStartDate && entry.date <= formattedPrevPeriodEndDate) : [];

        let totalDeliveryRevenue = 0, totalReturnRevenue = 0, totalFreshBagRevenue = 0, totalDeliveryInterruptionRevenue = 0;
        let totalPenaltyCost = 0, totalIndustrialAccidentCost = 0, totalFuelCost = 0, totalMaintenanceCost = 0;
        let totalVatAmount = 0, totalIncomeTaxAmount = 0, totalTaxAccountantFee = 0;
        const uniqueDatesPrevMonth = new Set();

        filteredEntries.forEach(entry => {
             if (entry.deliveryCount > 0 || entry.returnCount > 0 || entry.freshBagCount > 0 || entry.deliveryInterruptionAmount > 0 || entry.penaltyAmount > 0 || entry.industrialAccidentCost > 0 || entry.fuelCost > 0 || entry.maintenanceCost > 0 || entry.vatAmount > 0 || entry.incomeTaxAmount > 0 || entry.taxAccountantFee > 0) {
                uniqueDatesPrevMonth.add(entry.date);
            }
            const deliveryInterruptionCalculated = (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0);
            totalDeliveryRevenue += entry.unitPrice * entry.deliveryCount;
            totalReturnRevenue += entry.unitPrice * entry.returnCount;
            totalDeliveryInterruptionRevenue += deliveryInterruptionCalculated;
            totalFreshBagRevenue += (entry.freshBagCount || 0) * 100;
            totalPenaltyCost += (entry.penaltyAmount || 0);
            totalIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
            totalFuelCost += (entry.fuelCost || 0);
            totalMaintenanceCost += (entry.maintenanceCost || 0);
            totalVatAmount += (entry.vatAmount || 0);
            totalIncomeTaxAmount += (entry.incomeTaxAmount || 0);
            totalTaxAccountantFee += (entry.taxAccountantFee || 0);
        });
        
        const netProfit = totalDeliveryRevenue + totalReturnRevenue + totalFreshBagRevenue + totalDeliveryInterruptionRevenue - totalPenaltyCost - totalIndustrialAccidentCost - totalFuelCost - totalMaintenanceCost - totalVatAmount - totalIncomeTaxAmount - totalTaxAccountantFee;
       const totalVolume = filteredEntries.reduce((sum, entry) => sum + (entry.deliveryCount || 0) + (entry.returnCount || 0) + (entry.deliveryInterruptionAmount || 0), 0);
        const totalFreshBag = filteredEntries.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
        const totalWorkingDays = uniqueDatesPrevMonth.size;
        const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;
        const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;

        return {
            totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue,
            totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee,
            netProfit, totalVolume, totalFreshBag, totalWorkingDays, dailyAverageVolume, totalExpensesSum
        };
    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, userId]);
    
    // ✨ 변경점: useMemo를 사용하여 계산 함수들이 필요할 때만 다시 실행되도록 최적화합니다.
    const monthlyProfit = useMemo(() => calculateMonthlyProfit(), [calculateMonthlyProfit]);
    const yearlyProfit = useMemo(() => calculateYearlyProfit(), [calculateYearlyProfit]);
    const cumulativeProfit = useMemo(() => calculateCumulativeProfit(), [calculateCumulativeProfit]);
    const previousMonthlyProfit = useMemo(() => calculatePreviousMonthlyProfit(), [calculatePreviousMonthlyProfit]);

    return {
        monthlyProfit,
        yearlyProfit,
        cumulativeProfit,
        previousMonthlyProfit,
    };
};
