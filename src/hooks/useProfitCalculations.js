import { useMemo } from 'react';
import { formatDate } from '../utils';

export const useProfitCalculations = (entries, selectedMonth, selectedYear, monthlyStartDay, monthlyEndDay, userId) => {

    // 월별 수익 계산
    const monthlyProfit = useMemo(() => {
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
        const unitPriceBreakdown = {};
        let totalDeliveryCount = 0, totalReturnCount = 0, totalInterruptionCount = 0;

        filteredEntries.forEach(entry => {
            const unitPrice = entry.unitPrice || 0;
            const deliveryCount = entry.deliveryCount || 0;
            const returnCount = entry.returnCount || 0;
            const deliveryInterruptionAmount = entry.deliveryInterruptionAmount || 0;
            const freshBagCount = entry.freshBagCount || 0;
            const penaltyAmount = entry.penaltyAmount || 0;
            const industrialAccidentCost = entry.industrialAccidentCost || 0;
            const fuelCost = entry.fuelCost || 0;
            const maintenanceCost = entry.maintenanceCost || 0;
            const vatAmount = entry.vatAmount || 0;
            const incomeTaxAmount = entry.incomeTaxAmount || 0;
            const taxAccountantFee = entry.taxAccountantFee || 0;
            if (deliveryCount || returnCount || freshBagCount || deliveryInterruptionAmount || penaltyAmount || industrialAccidentCost || fuelCost || maintenanceCost || vatAmount || incomeTaxAmount || taxAccountantFee) {
                uniqueDatesMonthly.add(entry.date);
            }
            const deliveryInterruptionCalculated = unitPrice * deliveryInterruptionAmount;
            if (!dailyBreakdown[entry.date]) dailyBreakdown[entry.date] = { revenue: 0, expenses: 0 };
            dailyBreakdown[entry.date].revenue += (unitPrice * deliveryCount) + (unitPrice * returnCount) + deliveryInterruptionCalculated + (freshBagCount * 100);
            dailyBreakdown[entry.date].expenses += penaltyAmount + industrialAccidentCost + fuelCost + maintenanceCost + vatAmount + incomeTaxAmount + taxAccountantFee;
            totalDeliveryRevenue += unitPrice * deliveryCount;
            totalReturnRevenue += unitPrice * returnCount;
            totalDeliveryInterruptionRevenue += deliveryInterruptionCalculated;
            totalFreshBagRevenue += freshBagCount * 100;
            totalPenaltyCost += penaltyAmount;
            totalIndustrialAccidentCost += industrialAccidentCost;
            totalFuelCost += fuelCost;
            totalMaintenanceCost += maintenanceCost;
            totalVatAmount += vatAmount;
            totalIncomeTaxAmount += incomeTaxAmount;
            totalTaxAccountantFee += taxAccountantFee;
            totalDeliveryCount += deliveryCount;
            totalReturnCount += returnCount;
            totalInterruptionCount += deliveryInterruptionAmount;
           if (unitPrice > 0) {
    if (!unitPriceBreakdown[unitPrice]) {
        // ✨ 변경점 1: 각 항목별 수익을 저장할 공간 추가
        unitPriceBreakdown[unitPrice] = {
            deliveryCount: 0, deliveryRevenue: 0,
            interruptionCount: 0, interruptionRevenue: 0,
            returnCount: 0, returnRevenue: 0,
            totalRevenue: 0
        };
    }
    
    // ✨ 변경점 2: 각 항목별 수익을 개별적으로 계산
    const deliveryRevenueForEntry = unitPrice * deliveryCount;
    const returnRevenueForEntry = unitPrice * returnCount;
    const interruptionRevenueForEntry = deliveryInterruptionCalculated;

    // ✨ 변경점 3: 계산된 값을 각각 해당하는 곳에 더해줌
    unitPriceBreakdown[unitPrice].deliveryCount += deliveryCount;
    unitPriceBreakdown[unitPrice].deliveryRevenue += deliveryRevenueForEntry;
    unitPriceBreakdown[unitPrice].returnCount += returnCount;
    unitPriceBreakdown[unitPrice].returnRevenue += returnRevenueForEntry;
    unitPriceBreakdown[unitPrice].interruptionCount += deliveryInterruptionAmount;
    unitPriceBreakdown[unitPrice].interruptionRevenue += interruptionRevenueForEntry;
    unitPriceBreakdown[unitPrice].totalRevenue += deliveryRevenueForEntry + returnRevenueForEntry + interruptionRevenueForEntry;
}
        });
        const netProfit = totalDeliveryRevenue + totalReturnRevenue + totalFreshBagRevenue + totalDeliveryInterruptionRevenue - totalPenaltyCost - totalIndustrialAccidentCost - totalFuelCost - totalMaintenanceCost - totalVatAmount - totalIncomeTaxAmount - totalTaxAccountantFee;
        const totalVolume = totalDeliveryCount + totalReturnCount + totalInterruptionCount;
        const totalFreshBag = filteredEntries.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
        const totalWorkingDays = uniqueDatesMonthly.size;
        const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;
        const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;
        return { totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue, totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee, netProfit, periodStartDate, periodEndDate, dailyBreakdown, totalVolume, totalExpensesSum, totalFreshBag, totalWorkingDays, dailyAverageVolume, unitPriceBreakdown, totalDeliveryCount, totalReturnCount, totalInterruptionCount };
    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, userId]);

   // 연간 수익 계산
const yearlyProfit = useMemo(() => {
    const year = parseInt(selectedYear);
    const filteredEntriesForYear = userId ? entries.filter(entry => new Date(entry.date).getFullYear() === year) : [];

    let totalDeliveryRevenue = 0, totalReturnRevenue = 0, totalFreshBagRevenue = 0, totalDeliveryInterruptionRevenue = 0;
    let totalPenaltyCost = 0, totalIndustrialAccidentCost = 0, totalFuelCost = 0, totalMaintenanceCost = 0;
    let totalVatAmount = 0, totalIncomeTaxAmount = 0, totalTaxAccountantFee = 0;
    let totalDeliveryCount = 0, totalReturnCount = 0, totalInterruptionCount = 0;
    
    const monthlyBreakdown = [];
    const uniqueDatesYearly = new Set();
    
    // 연간 전체 데이터에 대해 먼저 모든 합계를 계산합니다.
    filteredEntriesForYear.forEach(entry => {
        if (entry.deliveryCount > 0 || entry.returnCount > 0 || entry.freshBagCount > 0 || entry.deliveryInterruptionAmount > 0 || entry.penaltyAmount > 0 || entry.industrialAccidentCost > 0 || entry.fuelCost > 0 || entry.maintenanceCost > 0 || entry.vatAmount > 0 || entry.incomeTaxAmount > 0 || entry.taxAccountantFee > 0) {
            uniqueDatesYearly.add(entry.date);
        }
        const deliveryInterruptionCalculated = (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0);
        totalDeliveryRevenue += (entry.unitPrice || 0) * (entry.deliveryCount || 0);
        totalReturnRevenue += (entry.unitPrice || 0) * (entry.returnCount || 0);
        totalDeliveryInterruptionRevenue += deliveryInterruptionCalculated;
        totalFreshBagRevenue += (entry.freshBagCount || 0) * 100;
        totalPenaltyCost += (entry.penaltyAmount || 0);
        totalIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
        totalFuelCost += (entry.fuelCost || 0);
        totalMaintenanceCost += (entry.maintenanceCost || 0);
        totalVatAmount += (entry.vatAmount || 0);
        totalIncomeTaxAmount += (entry.incomeTaxAmount || 0);
        totalTaxAccountantFee += (entry.taxAccountantFee || 0);
        totalDeliveryCount += entry.deliveryCount || 0;
        totalReturnCount += entry.returnCount || 0;
        totalInterruptionCount += entry.deliveryInterruptionAmount || 0;
    });

    // 월별 순이익 계산은 그래프를 위해 별도로 계산합니다.
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
        
        const monthNetProfit = filteredEntriesForMonth.reduce((sum, entry) => {
            const revenue = ((entry.unitPrice || 0) * (entry.deliveryCount || 0)) + ((entry.unitPrice || 0) * (entry.returnCount || 0)) + ((entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0)) + ((entry.freshBagCount || 0) * 100);
            const expenses = (entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0);
            return sum + revenue - expenses;
        }, 0);
        
        monthlyBreakdown.push({ month: month, netProfit: monthNetProfit });
    }
    
    const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;
    const netProfit = totalDeliveryRevenue + totalReturnRevenue + totalFreshBagRevenue + totalDeliveryInterruptionRevenue - totalExpensesSum;
    const totalVolume = totalDeliveryCount + totalReturnCount + totalInterruptionCount;
    const totalFreshBag = filteredEntriesForYear.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
    const totalWorkingDays = uniqueDatesYearly.size;
    const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;

    return {
        totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue,
        totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee,
        netProfit, monthlyBreakdown,
        totalVolume, totalExpensesSum, totalFreshBag, totalWorkingDays, dailyAverageVolume,
        totalDeliveryCount, totalReturnCount, totalInterruptionCount
    };
}, [entries, selectedYear, monthlyStartDay, monthlyEndDay, userId]);

   // 누적 수익 계산
const cumulativeProfit = useMemo(() => {
    const entriesForCumulative = userId ? entries : [];
    let totalDeliveryRevenue = 0, totalReturnRevenue = 0, totalFreshBagRevenue = 0, totalDeliveryInterruptionRevenue = 0;
    let totalPenaltyCost = 0, totalIndustrialAccidentCost = 0, totalFuelCost = 0, totalMaintenanceCost = 0;
    let totalVatAmount = 0, totalIncomeTaxAmount = 0, totalTaxAccountantFee = 0;
    let totalDeliveryCount = 0, totalReturnCount = 0, totalInterruptionCount = 0;
    const uniqueDatesCumulative = new Set();
    
    entriesForCumulative.forEach(entry => {
        if (entry.deliveryCount > 0 || entry.returnCount > 0 || entry.freshBagCount > 0 || entry.deliveryInterruptionAmount > 0 || entry.penaltyAmount > 0 || entry.industrialAccidentCost > 0 || entry.fuelCost > 0 || entry.maintenanceCost > 0 || entry.vatAmount > 0 || entry.incomeTaxAmount > 0 || entry.taxAccountantFee > 0) {
            uniqueDatesCumulative.add(entry.date);
        }
        const deliveryInterruptionCalculated = (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0);
        totalDeliveryRevenue += (entry.unitPrice || 0) * (entry.deliveryCount || 0);
        totalReturnRevenue += (entry.unitPrice || 0) * (entry.returnCount || 0);
        totalDeliveryInterruptionRevenue += deliveryInterruptionCalculated;
        totalFreshBagRevenue += (entry.freshBagCount || 0) * 100;
        totalPenaltyCost += (entry.penaltyAmount || 0);
        totalIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
        totalFuelCost += (entry.fuelCost || 0);
        totalMaintenanceCost += (entry.maintenanceCost || 0);
        totalVatAmount += (entry.vatAmount || 0);
        totalIncomeTaxAmount += (entry.incomeTaxAmount || 0);
        totalTaxAccountantFee += (entry.taxAccountantFee || 0);
        totalDeliveryCount += entry.deliveryCount || 0;
        totalReturnCount += entry.returnCount || 0;
        totalInterruptionCount += entry.deliveryInterruptionAmount || 0;
    });

    const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;
    const netProfit = totalDeliveryRevenue + totalReturnRevenue + totalFreshBagRevenue + totalDeliveryInterruptionRevenue - totalExpensesSum;
    const totalWorkingDays = uniqueDatesCumulative.size;
    const totalVolume = totalDeliveryCount + totalReturnCount + totalInterruptionCount;
    const totalFreshBag = entriesForCumulative.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
    const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;

    return {
        totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue,
        totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee,
        netProfit, totalWorkingDays, totalVolume, totalFreshBag, dailyAverageVolume, totalExpensesSum,
        totalDeliveryCount, totalReturnCount, totalInterruptionCount
    };
}, [entries, userId]);

    // 이전 달 수익 계산
    const previousMonthlyProfit = useMemo(() => {
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
        let totalDeliveryCount = 0, totalReturnCount = 0, totalInterruptionCount = 0;

        filteredEntries.forEach(entry => {
            const deliveryInterruptionCalculated = (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0);
            totalDeliveryRevenue += (entry.unitPrice || 0) * (entry.deliveryCount || 0);
            totalReturnRevenue += (entry.unitPrice || 0) * (entry.returnCount || 0);
            totalDeliveryInterruptionRevenue += deliveryInterruptionCalculated;
            totalFreshBagRevenue += (entry.freshBagCount || 0) * 100;
            totalPenaltyCost += (entry.penaltyAmount || 0);
            totalIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
            totalFuelCost += (entry.fuelCost || 0);
            totalMaintenanceCost += (entry.maintenanceCost || 0);
            totalVatAmount += (entry.vatAmount || 0);
            totalIncomeTaxAmount += (entry.incomeTaxAmount || 0);
            totalTaxAccountantFee += (entry.taxAccountantFee || 0);
            totalDeliveryCount += entry.deliveryCount || 0;
            totalReturnCount += entry.returnCount || 0;
            totalInterruptionCount += entry.deliveryInterruptionAmount || 0;
        });
        
        const netProfit = totalDeliveryRevenue + totalReturnRevenue + totalFreshBagRevenue + totalDeliveryInterruptionRevenue - totalPenaltyCost - totalIndustrialAccidentCost - totalFuelCost - totalMaintenanceCost - totalVatAmount - totalIncomeTaxAmount - totalTaxAccountantFee;
        const totalVolume = totalDeliveryCount + totalReturnCount + totalInterruptionCount;
        const totalFreshBag = filteredEntries.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
        const totalWorkingDays = filteredEntries.reduce((acc, entry) => acc.add(entry.date), new Set()).size;
        const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;
        const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;

        return { totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue, totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee, netProfit, totalVolume, totalFreshBag, totalWorkingDays, dailyAverageVolume, totalExpensesSum, totalDeliveryCount, totalReturnCount, totalInterruptionCount };
    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, userId]);
    
    return {
        monthlyProfit,
        yearlyProfit,
        cumulativeProfit,
        previousMonthlyProfit,
    };
};