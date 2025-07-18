// src/hooks/useProfitCalculations.js

import { useCallback } from 'react';
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
        const totalVolume = filteredEntries.reduce((sum, entry) => sum + (entry.deliveryCount || 0) + (entry.returnCount || 0), 0);
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
        const filteredEntriesForYear = userId ? entries.filter(entry => new Date(entry.date).getFullYear() === year) : [];

        // ... (이하 calculateYearlyProfit 함수의 나머지 내용은 App.js의 것과 동일하게 유지) ...
        let totalDeliveryRevenue = 0, totalReturnRevenue = 0, totalFreshBagRevenue = 0, totalDeliveryInterruptionRevenue = 0;
        let totalPenaltyCost = 0, totalIndustrialAccidentCost = 0, totalFuelCost = 0, totalMaintenanceCost = 0;
        let totalVatAmount = 0, totalIncomeTaxAmount = 0, totalTaxAccountantFee = 0;
        let yearlyNetProfit = 0;
        const monthlyBreakdown = [];
        const uniqueDatesYearly = new Set();
        
        for (let month = 1; month <= 12; month++) {
            const periodEndDate = new Date(year, month - 1, monthlyEndDay);
            let periodStartDate;
            if (monthlyStartDay <= monthlyEndDay) {
                periodStartDate = new Date(year, month - 1, monthlyStartDay);
            } else {
                periodStartDate = new Date(year, month - 2, monthlyStartDay);
            }

            const formattedPeriodStartDate = formatDate(periodStartDate);
            const formattedPeriodEndDate = formatDate(periodEndDate);

            const filteredEntriesForMonth = filteredEntriesForYear.filter(entry => entry.date >= formattedPeriodStartDate && entry.date <= formattedPeriodEndDate);

            let monthNetProfit = 0, monthDeliveryRevenue = 0, monthReturnRevenue = 0, monthFreshBagRevenue = 0, monthDeliveryInterruptionRevenue = 0;
            let monthPenaltyCost = 0, monthIndustrialAccidentCost = 0, monthFuelCost = 0, monthMaintenanceCost = 0;
            let monthVatAmount = 0, monthIncomeTaxAmount = 0, monthTaxAccountantFee = 0;

            filteredEntriesForMonth.forEach(entry => {
                if (entry.deliveryCount > 0 || entry.returnCount > 0 || entry.freshBagCount > 0 || entry.deliveryInterruptionAmount > 0 || entry.penaltyAmount > 0 || entry.industrialAccidentCost > 0 || entry.fuelCost > 0 || entry.maintenanceCost > 0 || entry.vatAmount > 0 || entry.incomeTaxAmount > 0 || entry.taxAccountantFee > 0) {
                    uniqueDatesYearly.add(entry.date);
                }
                monthDeliveryRevenue += entry.unitPrice * entry.deliveryCount;
                monthReturnRevenue += entry.unitPrice * entry.returnCount;
                monthDeliveryInterruptionRevenue += (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0);
                monthFreshBagRevenue += (entry.freshBagCount || 0) * 100;
                monthPenaltyCost += (entry.penaltyAmount || 0);
                monthIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
                monthFuelCost += (entry.fuelCost || 0);
                monthMaintenanceCost += (entry.maintenanceCost || 0);
                monthVatAmount += (entry.vatAmount || 0);
                monthIncomeTaxAmount += (entry.incomeTaxAmount || 0);
                monthTaxAccountantFee += (entry.taxAccountantFee || 0);
            });

            monthNetProfit = monthDeliveryRevenue + monthReturnRevenue + monthFreshBagRevenue + monthDeliveryInterruptionRevenue - monthPenaltyCost - monthIndustrialAccidentCost - monthFuelCost - monthMaintenanceCost - monthVatAmount - monthIncomeTaxAmount - monthTaxAccountantFee;
            yearlyNetProfit += monthNetProfit;

            totalDeliveryRevenue += monthDeliveryRevenue;
            totalReturnRevenue += monthReturnRevenue;
            totalFreshBagRevenue += monthFreshBagRevenue;
            totalDeliveryInterruptionRevenue += monthDeliveryInterruptionRevenue;
            totalPenaltyCost += monthPenaltyCost;
            totalIndustrialAccidentCost += monthIndustrialAccidentCost;
            totalFuelCost += monthFuelCost;
            totalMaintenanceCost += monthMaintenanceCost;
            totalVatAmount += monthVatAmount;
            totalIncomeTaxAmount += monthIncomeTaxAmount;
            totalTaxAccountantFee += monthTaxAccountantFee;
            
            monthlyBreakdown.push({ month: month, netProfit: monthNetProfit });
        }
        
        const totalVolume = filteredEntriesForYear.reduce((sum, entry) => sum + (entry.deliveryCount || 0) + (entry.returnCount || 0), 0);
        const totalFreshBag = filteredEntriesForYear.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
        const totalWorkingDays = uniqueDatesYearly.size;
        const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;
        const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;

        return {
            totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue,
            totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee,
            netProfit: yearlyNetProfit, monthlyBreakdown,
            totalVolume, totalExpensesSum, totalFreshBag, totalWorkingDays, dailyAverageVolume
        };
    }, [entries, selectedYear, monthlyStartDay, monthlyEndDay, userId]);

    // 누적 수익 계산
    const calculateCumulativeProfit = useCallback(() => {
        const entriesForCumulative = userId ? entries : [];
        // ... (이하 calculateCumulativeProfit 함수의 나머지 내용은 App.js의 것과 동일하게 유지) ...
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

        return {
            totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue,
            totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee,
            netProfit, totalWorkingDays, totalVolume, totalFreshBag, dailyAverageVolume, totalExpensesSum
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

        // ... (이하 calculatePreviousMonthlyProfit 함수의 나머지 내용은 App.js의 것과 동일하게 유지) ...
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
        const totalVolume = filteredEntries.reduce((sum, entry) => sum + (entry.deliveryCount || 0) + (entry.returnCount || 0), 0);
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
    
    // 계산 함수들을 호출하고 그 결과를 반환
    const monthlyProfit = calculateMonthlyProfit();
    const yearlyProfit = calculateYearlyProfit();
    const cumulativeProfit = calculateCumulativeProfit();
    const previousMonthlyProfit = calculatePreviousMonthlyProfit();

    return {
        monthlyProfit,
        yearlyProfit,
        cumulativeProfit,
        previousMonthlyProfit,
    };
};