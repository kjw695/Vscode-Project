// =====================================================================
// [계산 핵심 엔진] : 오직 '커스텀 항목(customItems)' 기준으로만 작동합니다.
// =====================================================================

export const makeDateString = (year, month, day) => {
    let y = year; let m = month;
    if (m < 1) { m += 12; y -= 1; } else if (m > 12) { m -= 12; y += 1; }
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const getMonthlyDateRange = (year, month, startDay, endDay) => {
    let startStr, endStr;
    if (startDay <= endDay) {
        startStr = makeDateString(year, month, startDay);
        endStr = makeDateString(year, month, endDay);
    } else {
        let prevYear = year; let prevMonth = month - 1;
        if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
        startStr = makeDateString(prevYear, prevMonth, startDay);
        endStr = makeDateString(year, month, endDay);
    }
    return { startStr, endStr };
};

export const isDuplicateEntry = (existing, incoming) => {
    return existing.date === incoming.date && existing.type === incoming.type && JSON.stringify(existing.customItems || []) === JSON.stringify(incoming.customItems || []);
};

export const calculateData = (filteredEntries, itemLabels = {}) => {
    let totalRevenue = 0; let totalExpensesSum = 0; let totalVolume = 0; let totalFreshBag = 0;
    const dailyBreakdown = {}; const rawRevenueMap = {}; const rawExpenseMap = {};
    const revenueDetails = {}; const expenseDetails = {}; const unitPriceBreakdown = {};

    const addToDetails = (map, name, amount, count = 0) => {
        if (!name || amount <= 0) return;
        if (!map[name]) map[name] = { count: 0, amount: 0 };
        map[name].count += count; map[name].amount += amount;
    };

    const addToUnitPriceBreakdown = (unitPrice, name, value, count) => {
        if (!name || value <= 0) return; 
        const key = unitPrice > 0 ? `${unitPrice}원` : '기타'; 
        if (!unitPriceBreakdown[key]) unitPriceBreakdown[key] = { total: 0, items: {} };
        unitPriceBreakdown[key].total += value;
        if (!unitPriceBreakdown[key].items[name]) unitPriceBreakdown[key].items[name] = { count: 0, amount: 0 };
        unitPriceBreakdown[key].items[name].count += (count || 0);
        unitPriceBreakdown[key].items[name].amount += value;
    };

    filteredEntries.forEach(entry => {
        const dateStr = entry.date;
        if (!dailyBreakdown[dateStr]) dailyBreakdown[dateStr] = { revenue: 0, expenses: 0, profit: 0 };

        let dailyRev = 0; let dailyExp = 0;
        const processedKeys = new Set(); // ✨ 중복 방지 메모장 (양쪽 저장 2배 뻥튀기 방지)

        // 1. 커스텀 항목(새로운 방식) 우선 계산
        if (entry.customItems && Array.isArray(entry.customItems)) {
            entry.customItems.forEach(item => {
                if (item.key) processedKeys.add(item.key); // 계산했다고 메모
                const label = itemLabels[item.key] || item.name || item.key;

                if (item.type === 'income') {
                    const amountVal = Number(item.amount) || 0;
                    const countVal = Number(item.count) || 0;
                    const unitPriceVal = Number(item.unitPrice) || 0;
                    let finalItemAmount = amountVal === 0 ? countVal * unitPriceVal : amountVal;

                    if (finalItemAmount > 0) {
                        dailyRev += finalItemAmount; rawRevenueMap[label] = (rawRevenueMap[label] || 0) + finalItemAmount;
                        addToDetails(revenueDetails, label, finalItemAmount, countVal);
                        addToUnitPriceBreakdown(unitPriceVal, label, finalItemAmount, countVal);
                        if (label.includes('배송') || label.includes('반품')) totalVolume += countVal;
                        if (label.includes('프레시백')) totalFreshBag += countVal;
                    }
                } else if (item.type === 'expense') {
                    const amount = Number(item.amount) || 0;
                    if (amount > 0) {
                        dailyExp += amount; rawExpenseMap[label] = (rawExpenseMap[label] || 0) + amount;
                        addToDetails(expenseDetails, label, amount, 1);
                    }
                }
            });
        }

        // 2. 옛날 데이터는 '메모장에 없을 때만' 더함 (중복 완벽 방지)
        const baseUnitPrice = Number(entry.unitPrice) || 0;

        if (!processedKeys.has('deliveryCount') && Number(entry.deliveryCount) > 0) {
            const count = Number(entry.deliveryCount); const amt = baseUnitPrice * count;
            dailyRev += amt; totalVolume += count; const label = itemLabels['deliveryCount'] || '배송';
            rawRevenueMap[label] = (rawRevenueMap[label] || 0) + amt;
            addToDetails(revenueDetails, label, amt, count); addToUnitPriceBreakdown(baseUnitPrice, label, amt, count);
        }
        if (!processedKeys.has('returnCount') && Number(entry.returnCount) > 0) {
            const count = Number(entry.returnCount); const amt = baseUnitPrice * count;
            dailyRev += amt; totalVolume += count; const label = itemLabels['returnCount'] || '반품';
            rawRevenueMap[label] = (rawRevenueMap[label] || 0) + amt;
            addToDetails(revenueDetails, label, amt, count); addToUnitPriceBreakdown(baseUnitPrice, label, amt, count);
        }
        if (!processedKeys.has('deliveryInterruptionAmount') && Number(entry.deliveryInterruptionAmount) > 0) {
            const count = Number(entry.deliveryInterruptionAmount); const amt = baseUnitPrice * count;
            dailyRev += amt; const label = itemLabels['deliveryInterruptionAmount'] || '중단';
            rawRevenueMap[label] = (rawRevenueMap[label] || 0) + amt;
            addToDetails(revenueDetails, label, amt, count); addToUnitPriceBreakdown(baseUnitPrice, label, amt, count);
        }
        if (!processedKeys.has('freshBagCount') && Number(entry.freshBagCount) > 0) {
            const count = Number(entry.freshBagCount); const amt = baseUnitPrice * count;
            dailyRev += amt; totalFreshBag += count; const label = itemLabels['freshBagCount'] || '프레시백';
            rawRevenueMap[label] = (rawRevenueMap[label] || 0) + amt;
            addToDetails(revenueDetails, label, amt, count); addToUnitPriceBreakdown(baseUnitPrice, label, amt, count);
        }

        const legacyExpenseKeys = ['penaltyAmount', 'industrialAccidentCost', 'fuelCost', 'maintenanceCost', 'vatAmount', 'incomeTaxAmount', 'taxAccountantFee'];
        legacyExpenseKeys.forEach(key => {
            if (!processedKeys.has(key) && Number(entry[key]) > 0) {
                const amt = Number(entry[key]); dailyExp += amt; const label = itemLabels[key] || key;
                rawExpenseMap[label] = (rawExpenseMap[label] || 0) + amt; addToDetails(expenseDetails, label, amt, 1);
            }
        });

        dailyBreakdown[dateStr].revenue += dailyRev; dailyBreakdown[dateStr].expenses += dailyExp; dailyBreakdown[dateStr].profit += (dailyRev - dailyExp);
        totalRevenue += dailyRev; totalExpensesSum += dailyExp;
    });

    const netProfit = totalRevenue - totalExpensesSum;
    const totalWorkingDays = Object.keys(dailyBreakdown).filter(d => dailyBreakdown[d].revenue > 0).length;
    const dailyAverageVolume = totalWorkingDays > 0 ? totalVolume / totalWorkingDays : 0;

    return {
        totalRevenue, totalExpenses: totalExpensesSum, netProfit,
        totalVolume, totalFreshBag, totalWorkingDays, dailyAverageVolume,
        revenueDetails, expenseDetails, unitPriceBreakdown,
        revenueDistribution: Object.entries(rawRevenueMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
        expenseDistribution: Object.entries(rawExpenseMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
        dailyBreakdown, 
        unitPriceAnalysis: Object.entries(unitPriceBreakdown).map(([priceKey, data]) => ({ priceLabel: priceKey, totalAmount: data.total, items: Object.entries(data.items).map(([name, info]) => ({ name, count: info.count, amount: info.amount })) })).sort((a, b) => (parseInt(b.priceLabel.replace(/[^0-9]/g, '')) || 0) - (parseInt(a.priceLabel.replace(/[^0-9]/g, '')) || 0))
    };
};