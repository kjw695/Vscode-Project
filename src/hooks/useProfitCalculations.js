import { useMemo, useCallback } from 'react';

// [1] 날짜 조립기
const makeDateString = (year, month, day) => {
    let y = year;
    let m = month;
    if (m < 1) { m += 12; y -= 1; } 
    else if (m > 12) { m -= 12; y += 1; }
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const useProfitCalculations = (entries, selectedMonth, selectedYear, monthlyStartDay, monthlyEndDay, userId, itemLabels = {}) => {

    const isKo = typeof navigator !== 'undefined' && navigator.language.includes('ko');

    const calculateData = useCallback((filteredEntries) => {
        let totalRevenue = 0;
        let totalExpensesSum = 0;
        let totalVolume = 0; 
        let totalFreshBag = 0;
        
        const dailyBreakdown = {};
        const rawRevenueMap = {};
        const rawExpenseMap = {};
        
        // [핵심] 단가별 내역을 담을 그릇 (여기에 700원 따로, 100원 따로 담습니다)
        const unitPriceBreakdown = {};

        // [도우미] 단가별 저장 함수
        const addToUnitPriceBreakdown = (unitPrice, name, value, count) => {
            if (!name || value <= 0 || count <= 0) return;
            
            // 데이터에 적힌 단가 그대로 키(Key)로 사용 (예: "700", "100")
            const priceKey = String(unitPrice || 0);
            const itemName = name.trim();

            if (!unitPriceBreakdown[priceKey]) {
                unitPriceBreakdown[priceKey] = { items: {}, totalRevenue: 0 };
            }
            if (!unitPriceBreakdown[priceKey].items[itemName]) {
                unitPriceBreakdown[priceKey].items[itemName] = { count: 0, amount: 0 };
            }

            // 해당 단가 그룹에 쏙 넣기
            unitPriceBreakdown[priceKey].items[itemName].count += count;
            unitPriceBreakdown[priceKey].items[itemName].amount += value;
            unitPriceBreakdown[priceKey].totalRevenue += value;
        };

        const addToTopRanking = (map, name, value, count) => {
            if (!name || value <= 0) return;
            const key = name.trim();
            if (!map[key]) map[key] = { amount: 0, count: 0 };
            map[key].amount += value;
            map[key].count += count;
        };

        const systemKeys = new Set(['id', 'date', 'type', 'round', 'timestamp', 'unitPrice', 'customItems']);
        
        const defaultNames = isKo ? {
            'deliveryCount': '배송', 'returnCount': '반품', 'deliveryInterruptionAmount': '배송중단',
            'freshBagCount': '프레시백', 'penaltyAmount': '패널티', 'industrialAccidentCost': '산재보험',
            'fuelCost': '유류비', 'maintenanceCost': '경정비', 'vatAmount': '부가세',
            'incomeTaxAmount': '소득세', 'taxAccountantFee': '세무기장'
        } : {
            'deliveryCount': 'Delivery', 'returnCount': 'Return', 'deliveryInterruptionAmount': 'Stop',
            'freshBagCount': 'Fresh Bag', 'penaltyAmount': 'Penalty', 'industrialAccidentCost': 'Insurance',
            'fuelCost': 'Fuel', 'maintenanceCost': 'Maintenance', 'vatAmount': 'VAT',
            'incomeTaxAmount': 'Income Tax', 'taxAccountantFee': 'Tax Fee'
        };

        const getDisplayName = (key) => {
            if (itemLabels[key]) return itemLabels[key];
            if (defaultNames[key]) return defaultNames[key];
            return key;
        };

        const uniqueDates = new Set();

        filteredEntries.forEach(entry => {
            if (!entry.date || !entry.type) return;
            uniqueDates.add(entry.date);

            if (!dailyBreakdown[entry.date]) dailyBreakdown[entry.date] = { revenue: 0, expenses: 0 };
            
            // 그날의 '공통 단가' (예: 700원)
            const dailyUnitPrice = Number(entry.unitPrice || 0);

            // 1. 수익(Income) 계산 - 단가별 정리는 '수익'만 합니다.
            if (entry.type === 'income') {
                let rowRevenue = 0;
                
                // (A) 기본 항목들 (배송, 프레시백 등)
                Object.keys(entry).forEach(key => {
                    if (systemKeys.has(key)) return;
                    const rawValue = Number(entry[key] || 0);
                    if (rawValue <= 0) return; 

                    const label = getDisplayName(key);
                    const val = dailyUnitPrice * rawValue;

                    // [데이터 원칙] 기본 항목은 '공통 단가'로 저장된 것이므로 700원 그룹에 넣습니다.
                    addToUnitPriceBreakdown(dailyUnitPrice, label, val, rawValue);
                    addToTopRanking(rawRevenueMap, label, val, rawValue);

                    rowRevenue += val;
                    if (key.toLowerCase().includes('delivery') || key.includes('배송')) totalVolume += rawValue;
                    if (key.toLowerCase().includes('fresh') || key.includes('프레시')) totalFreshBag += rawValue;
                });

                // (B) 개별 항목들 (Custom Items)
                if (entry.customItems && Array.isArray(entry.customItems)) {
                    entry.customItems.forEach(item => {
                        if (item.type === 'income') {
                            // [데이터 원칙] 여기에 100원이라고 적혀 있으면 100원 그룹에 넣습니다.
                            const p = Number(item.unitPrice || item.price || 0);
                            const q = Number(item.quantity || item.qty || 0);
                            
                            if (q > 0) {
                                const val = p * q;
                                const label = item.item || '기타'; 
                                
                                addToUnitPriceBreakdown(p, label, val, q);
                                addToTopRanking(rawRevenueMap, label, val, q);
                                
                                rowRevenue += val;
                                if (item.key === 'freshBagCount' || label.includes('프레시')) totalFreshBag += q;
                            }
                        }
                    });
                }
                totalRevenue += rowRevenue;
                dailyBreakdown[entry.date].revenue += rowRevenue;
            } 
            
            // 2. 지출(Expense) 계산 - 단가별 내역에는 포함하지 않습니다.
            else if (entry.type === 'expense') {
                let rowExpense = 0;
                Object.keys(entry).forEach(key => {
                    if (systemKeys.has(key)) return;
                    const val = Number(entry[key] || 0);
                    if (val <= 0) return;
                    const label = getDisplayName(key);
                    addToTopRanking(rawExpenseMap, label, val, 1);
                    rowExpense += val;
                });
                if (entry.customItems && Array.isArray(entry.customItems)) {
                    entry.customItems.forEach(item => {
                        if (item.type === 'expense') {
                            let val = Number(item.amount || 0);
                            let q = Number(item.quantity || item.qty || 1);
                            if (val === 0) val = Number(item.unitPrice || item.price || 0) * q;
                            if (val > 0) {
                                addToTopRanking(rawExpenseMap, item.item || '기타지출', val, q);
                                rowExpense += val;
                            }
                        }
                    });
                }
                totalExpensesSum += rowExpense;
                dailyBreakdown[entry.date].expenses += rowExpense;
            }
        });

        // 랭킹 정렬
        const processTopRanking = (sourceMap, limit = 6) => {
            const sortedItems = Object.entries(sourceMap).sort(([, dataA], [, dataB]) => dataB.amount - dataA.amount);
            const topItems = sortedItems.slice(0, limit);
            const otherItems = sortedItems.slice(limit);
            const finalDetails = {};
            topItems.forEach(([key, data]) => finalDetails[key] = data);
            if (otherItems.length > 0) {
                const othersData = otherItems.reduce((acc, [, data]) => { acc.amount += data.amount; acc.count += data.count; return acc; }, { amount: 0, count: 0 });
                const otherKey = isKo ? '기타 (그 외)' : 'Others';
                finalDetails[otherKey] = othersData;
            }
            return finalDetails;
        };

        return {
            netProfit: totalRevenue - totalExpensesSum,
            totalRevenue,
            totalExpenses: totalExpensesSum,
            totalVolume,
            totalFreshBag,
            totalWorkingDays: uniqueDates.size,
            dailyBreakdown,
            dailyAverageVolume: uniqueDates.size > 0 ? (totalVolume / uniqueDates.size) : 0,
            revenueDetails: processTopRanking(rawRevenueMap, 6),
            expenseDetails: processTopRanking(rawExpenseMap, 6),
            unitPriceBreakdown // 완성된 단가별 내역
        };
    }, [isKo, itemLabels]); 

    // 날짜 필터링 로직 (변동 없음)
    const monthlyProfit = useMemo(() => {
        if (!selectedMonth) return {};
        const [year, month] = selectedMonth.split('-').map(Number);
        
        let startStr, endStr;
        if (monthlyStartDay <= monthlyEndDay) {
            startStr = makeDateString(year, month, monthlyStartDay);
            endStr = makeDateString(year, month, monthlyEndDay);
        } else {
            startStr = makeDateString(year, month - 1, monthlyStartDay);
            endStr = makeDateString(year, month, monthlyEndDay);
        }

        const filtered = entries.filter(e => e.date >= startStr && e.date <= endStr);
        const stats = calculateData(filtered);
        return { ...stats, periodStartDate: startStr, periodEndDate: endStr };

    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, calculateData]);

    const yearlyProfit = useMemo(() => {
        if (!selectedYear) return {};
        const filtered = entries.filter(e => e.date.startsWith(String(selectedYear)));
        const stats = calculateData(filtered);
        const monthlyBreakdown = [];
        for (let m = 1; m <= 12; m++) {
            const mStr = String(m).padStart(2, '0');
            const targetMonth = `${selectedYear}-${mStr}`;
            const mData = filtered.filter(e => e.date.startsWith(targetMonth));
            const mStats = calculateData(mData);
            monthlyBreakdown.push({ month: m, netProfit: mStats.netProfit, revenue: mStats.totalRevenue, expenses: mStats.totalExpenses });
        }
        return { ...stats, monthlyBreakdown };
    }, [entries, selectedYear, calculateData]);

    const cumulativeProfit = useMemo(() => calculateData(entries), [entries, calculateData]);

    const previousMonthlyProfit = useMemo(() => {
        if (!selectedMonth) return {};
        const [year, month] = selectedMonth.split('-').map(Number);
        let prevYear = year; let prevMonth = month - 1;
        if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
        let startStr, endStr;
        if (monthlyStartDay <= monthlyEndDay) {
            startStr = makeDateString(prevYear, prevMonth, monthlyStartDay);
            endStr = makeDateString(prevYear, prevMonth, monthlyEndDay);
        } else {
            startStr = makeDateString(prevYear, prevMonth - 1, monthlyStartDay);
            endStr = makeDateString(prevYear, prevMonth, monthlyEndDay);
        }
        const filtered = entries.filter(e => e.date >= startStr && e.date <= endStr);
        return calculateData(filtered);
    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, calculateData]);

    return { monthlyProfit, yearlyProfit, cumulativeProfit, previousMonthlyProfit };
};