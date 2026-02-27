// =====================================================================
// [계산 핵심 엔진] : 오직 '커스텀 항목(customItems)' 기준으로만 작동합니다.
// =====================================================================

export const makeDateString = (year, month, day) => {
    let y = year;
    let m = month;
    if (m < 1) { m += 12; y -= 1; } 
    else if (m > 12) { m -= 12; y += 1; }
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const getMonthlyDateRange = (year, month, startDay, endDay) => {
    let startStr, endStr;
    if (startDay <= endDay) {
        startStr = makeDateString(year, month, startDay);
        endStr = makeDateString(year, month, endDay);
    } else {
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
        startStr = makeDateString(prevYear, prevMonth, startDay);
        endStr = makeDateString(year, month, endDay);
    }
    return { startStr, endStr };
};

// 중복 검사: 이제 고정 필드가 없으므로, 날짜/타입 및 커스텀 항목의 내용이 똑같은지 검사합니다.
export const isDuplicateEntry = (existing, incoming) => {
    return existing.date === incoming.date &&
           existing.type === incoming.type &&
           JSON.stringify(existing.customItems || []) === JSON.stringify(incoming.customItems || []);
};

// [핵심] 오직 customItems만 순회하며 수익/지출을 계산합니다.
export const calculateData = (filteredEntries, itemLabels = {}) => {
    let totalRevenue = 0;
    let totalExpensesSum = 0;
    let totalVolume = 0; 
    let totalFreshBag = 0;
    
    const dailyBreakdown = {};
    const rawRevenueMap = {}; 
    const rawExpenseMap = {};
    const revenueDetails = {}; 
    const expenseDetails = {};
    const unitPriceBreakdown = {};

    const addToDetails = (map, name, amount, count = 0) => {
        if (!name || amount <= 0) return;
        if (!map[name]) map[name] = { count: 0, amount: 0 };
        map[name].count += count;
        map[name].amount += amount;
    };

    const addToUnitPriceBreakdown = (unitPrice, name, value, count) => {
        if (!name || value <= 0) return; 
        const key = unitPrice > 0 ? `${unitPrice}원` : '기타'; 
        
        if (!unitPriceBreakdown[key]) {
            unitPriceBreakdown[key] = { total: 0, items: {} };
        }
        unitPriceBreakdown[key].total += value;
        if (!unitPriceBreakdown[key].items[name]) {
            unitPriceBreakdown[key].items[name] = { count: 0, amount: 0 };
        }
        unitPriceBreakdown[key].items[name].count += (count || 0);
        unitPriceBreakdown[key].items[name].amount += value;
    };

    filteredEntries.forEach(entry => {
        const dateStr = entry.date;
        if (!dailyBreakdown[dateStr]) {
            dailyBreakdown[dateStr] = { revenue: 0, expenses: 0, profit: 0 };
        }

        let dailyRev = 0;
        let dailyExp = 0;

        // 1. 과거 데이터(Legacy) 호환 로직: 고정 필드값 읽기
        const legacyDelivery = (Number(entry.unitPrice) || 0) * (Number(entry.deliveryCount) || 0);
        const legacyReturn = (Number(entry.unitPrice) || 0) * (Number(entry.returnCount) || 0);
        const legacyInterruption = (Number(entry.unitPrice) || 0) * (Number(entry.deliveryInterruptionAmount) || 0);
        const legacyFreshBag = (Number(entry.unitPrice) || 0) * (Number(entry.freshBagCount) || 0);
        
        const legacyRevenue = legacyDelivery + legacyReturn + legacyInterruption + legacyFreshBag;
        
        if (legacyRevenue > 0) {
            dailyRev += legacyRevenue;
            totalVolume += (Number(entry.deliveryCount) || 0) + (Number(entry.returnCount) || 0);
            totalFreshBag += (Number(entry.freshBagCount) || 0);
        }

        const legacyExpenses = 
            (Number(entry.penaltyAmount) || 0) + (Number(entry.industrialAccidentCost) || 0) +
            (Number(entry.fuelCost) || 0) + (Number(entry.maintenanceCost) || 0) +
            (Number(entry.vatAmount) || 0) + (Number(entry.incomeTaxAmount) || 0) +
            (Number(entry.taxAccountantFee) || 0);
        
        dailyExp += legacyExpenses;

        // 2. 커스텀 항목 계산 (신규 데이터 및 하이브리드 처리)
        if (entry.customItems && Array.isArray(entry.customItems)) {
            entry.customItems.forEach(item => {
                const label = itemLabels[item.key] || item.name || item.key;

                if (item.type === 'income') {
                    const amountVal = Number(item.amount) || 0;
                    const countVal = Number(item.count) || 0;
                    const unitPriceVal = Number(item.unitPrice) || 0;
                    
                    // ✨ amount가 0이면 단가*개수로 계산하여 과거/신규 데이터 모두 대응
                    let finalItemAmount = amountVal;
                    if (finalItemAmount === 0) {
                        finalItemAmount = countVal * unitPriceVal;
                    }

                    if (finalItemAmount > 0) {
                        dailyRev += finalItemAmount;
                        rawRevenueMap[label] = (rawRevenueMap[label] || 0) + finalItemAmount;
                        addToDetails(revenueDetails, label, finalItemAmount, countVal);
                        addToUnitPriceBreakdown(unitPriceVal, label, finalItemAmount, countVal);

                        if (label.includes('배송') || label.includes('반품')) totalVolume += countVal;
                        if (label.includes('프레시백')) totalFreshBag += countVal;
                    }
                } else if (item.type === 'expense') {
                    const amount = Number(item.amount) || 0;
                    if (amount > 0) {
                        dailyExp += amount;
                        rawExpenseMap[label] = (rawExpenseMap[label] || 0) + amount;
                        addToDetails(expenseDetails, label, amount, 1);
                    }
                }
            });
        }

        dailyBreakdown[dateStr].revenue += dailyRev;
        dailyBreakdown[dateStr].expenses += dailyExp;
        dailyBreakdown[dateStr].profit += (dailyRev - dailyExp);

        totalRevenue += dailyRev;
        totalExpensesSum += dailyExp;
    });

    const netProfit = totalRevenue - totalExpensesSum;
    const totalWorkingDays = Object.keys(dailyBreakdown).filter(d => dailyBreakdown[d].revenue > 0).length;
    const dailyAverageVolume = totalWorkingDays > 0 ? totalVolume / totalWorkingDays : 0;

    const revenueDistribution = Object.entries(rawRevenueMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const expenseDistribution = Object.entries(rawExpenseMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const unitPriceAnalysis = Object.entries(unitPriceBreakdown)
        .map(([priceKey, data]) => ({
            priceLabel: priceKey,
            totalAmount: data.total,
            items: Object.entries(data.items).map(([name, info]) => ({
                name, count: info.count, amount: info.amount
            })).sort((a, b) => b.amount - a.amount)
        }))
        .sort((a, b) => {
            const priceA = parseInt(a.priceLabel.replace(/[^0-9]/g, '')) || 0;
            const priceB = parseInt(b.priceLabel.replace(/[^0-9]/g, '')) || 0;
            return priceB - priceA;
        });

    return {
        totalRevenue, totalExpenses: totalExpensesSum, netProfit,
        totalVolume, totalFreshBag, totalWorkingDays, dailyAverageVolume,
        revenueDetails, expenseDetails, unitPriceBreakdown,
        revenueDistribution, expenseDistribution, dailyBreakdown, unitPriceAnalysis
    };
};