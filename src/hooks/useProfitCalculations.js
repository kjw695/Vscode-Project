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
        const rawRevenueMap = {}; // 차트용 데이터 (홈 화면 그래프)
        const rawExpenseMap = {};
        const revenueDetails = {}; // 상세 내역용 데이터
        const expenseDetails = {};
        
        // [핵심] 단가별 내역을 담을 그릇
        const unitPriceBreakdown = {};

        // [도우미] 상세 내역 저장 함수
        const addToDetails = (map, name, amount, count = 0) => {
            if (!name || amount <= 0) return;
            if (!map[name]) map[name] = { count: 0, amount: 0 };
            map[name].count += count;
            map[name].amount += amount;
        };

        // [도우미] 단가별 저장 함수
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

            // 1. 기본 항목(Legacy) 계산
            const deliveryIncome = (entry.unitPrice || 0) * (entry.deliveryCount || 0);
            const returnIncome = (entry.unitPrice || 0) * (entry.returnCount || 0);
            const interruptionIncome = (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0); 
            const freshBagIncome = (entry.unitPrice || 0) * (entry.freshBagCount || 0);
            
            const basicRevenue = deliveryIncome + returnIncome + interruptionIncome + freshBagIncome;

            // ▼▼▼ [수정됨] 기본 항목 집계 시 rawRevenueMap(차트용) 업데이트 추가 ▼▼▼
            // 이 부분이 빠져있어서 홈 화면 차트가 0%로 나왔던 것입니다.

            if (entry.deliveryCount > 0) {
                totalVolume += entry.deliveryCount;
                const label = itemLabels['deliveryCount'] || '배송';
                
                addToUnitPriceBreakdown(entry.unitPrice, label, deliveryIncome, entry.deliveryCount);
                addToDetails(revenueDetails, label, deliveryIncome, entry.deliveryCount);
                
                // [필수 추가] 차트 데이터에 반영
                rawRevenueMap[label] = (rawRevenueMap[label] || 0) + deliveryIncome;
            }
            if (entry.returnCount > 0) {
                totalVolume += entry.returnCount;
                const label = itemLabels['returnCount'] || '반품';

                addToUnitPriceBreakdown(entry.unitPrice, label, returnIncome, entry.returnCount);
                addToDetails(revenueDetails, label, returnIncome, entry.returnCount);

                // [필수 추가] 차트 데이터에 반영
                rawRevenueMap[label] = (rawRevenueMap[label] || 0) + returnIncome;
            }
            if (entry.deliveryInterruptionAmount > 0) {
                const label = itemLabels['deliveryInterruptionAmount'] || '중단';

                addToUnitPriceBreakdown(entry.unitPrice, label, interruptionIncome, entry.deliveryInterruptionAmount);
                addToDetails(revenueDetails, label, interruptionIncome, entry.deliveryInterruptionAmount);

                // [필수 추가] 차트 데이터에 반영
                rawRevenueMap[label] = (rawRevenueMap[label] || 0) + interruptionIncome;
            }
            if (entry.freshBagCount > 0) {
                totalFreshBag += entry.freshBagCount;
                const label = itemLabels['freshBagCount'] || '프레시백';

                addToUnitPriceBreakdown(entry.unitPrice, label, freshBagIncome, entry.freshBagCount);
                addToDetails(revenueDetails, label, freshBagIncome, entry.freshBagCount);

                // [필수 추가] 차트 데이터에 반영
                rawRevenueMap[label] = (rawRevenueMap[label] || 0) + freshBagIncome;
            }

            // 2. 커스텀 항목(Custom Items) 계산
            let customRevenue = 0;
            let customExpenses = 0;

            if (entry.customItems && Array.isArray(entry.customItems)) {
                entry.customItems.forEach(item => {
                    const label = itemLabels[item.key] || item.name || item.key;

                    if (item.type === 'income') {
                        const amountVal = Number(item.amount) || 0;
                        const calcVal = (Number(item.count) || 0) * (Number(item.unitPrice) || 0);
                        const finalAmount = amountVal + calcVal;

                        if (finalAmount > 0) {
                            customRevenue += finalAmount;
                            
                            // 차트용 데이터 저장
                            if (!rawRevenueMap[label]) rawRevenueMap[label] = 0;
                            rawRevenueMap[label] += finalAmount;

                            // 상세 내역 저장
                            addToDetails(revenueDetails, label, finalAmount, item.count);

                            // 단가별 내역 저장
                            addToUnitPriceBreakdown(item.unitPrice, label, finalAmount, item.count);
                        }
                    } else if (item.type === 'expense') {
                        const amount = Number(item.amount) || 0;
                        if (amount > 0) {
                            customExpenses += amount;
                            
                            // 지출 상세 저장
                            addToDetails(expenseDetails, label, amount, 1);

                            // 지출 차트용 데이터 저장
                            if (!rawExpenseMap[label]) rawExpenseMap[label] = 0;
                            rawExpenseMap[label] += amount;
                        }
                    }
                });
            }

            // 3. 기본 지출 항목
            const basicExpensesList = [
                { key: 'penaltyAmount', val: entry.penaltyAmount },
                { key: 'industrialAccidentCost', val: entry.industrialAccidentCost },
                { key: 'fuelCost', val: entry.fuelCost },
                { key: 'maintenanceCost', val: entry.maintenanceCost },
                { key: 'vatAmount', val: entry.vatAmount },
                { key: 'incomeTaxAmount', val: entry.incomeTaxAmount },
                { key: 'taxAccountantFee', val: entry.taxAccountantFee }
            ];

            let basicExpenses = 0;
            basicExpensesList.forEach(exp => {
                const val = Number(exp.val) || 0;
                if (val > 0) {
                    basicExpenses += val;
                    const label = itemLabels[exp.key] || exp.key; 

                    addToDetails(expenseDetails, label, val, 1);

                    if (!rawExpenseMap[label]) rawExpenseMap[label] = 0;
                    rawExpenseMap[label] += val;
                }
            });

            // 합계 누적
            const dailyRev = basicRevenue + customRevenue;
            const dailyExp = basicExpenses + customExpenses;

            dailyBreakdown[dateStr].revenue += dailyRev;
            dailyBreakdown[dateStr].expenses += dailyExp;
            dailyBreakdown[dateStr].profit += (dailyRev - dailyExp);

            totalRevenue += dailyRev;
            totalExpensesSum += dailyExp;
        });

        const netProfit = totalRevenue - totalExpensesSum;
        const totalWorkingDays = Object.keys(dailyBreakdown).filter(d => dailyBreakdown[d].revenue > 0).length;
        const dailyAverageVolume = totalWorkingDays > 0 ? totalVolume / totalWorkingDays : 0;

        // 차트용 배열 변환 (rawRevenueMap 사용)
        const revenueDistribution = Object.entries(rawRevenueMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const expenseDistribution = Object.entries(rawExpenseMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // 단가별 분석 데이터 정렬
        const unitPriceAnalysis = Object.entries(unitPriceBreakdown)
            .map(([priceKey, data]) => ({
                priceLabel: priceKey,
                totalAmount: data.total,
                items: Object.entries(data.items).map(([name, info]) => ({
                    name,
                    count: info.count,
                    amount: info.amount
                })).sort((a, b) => b.amount - a.amount)
            }))
            .sort((a, b) => {
                const priceA = parseInt(a.priceLabel.replace(/[^0-9]/g, '')) || 0;
                const priceB = parseInt(b.priceLabel.replace(/[^0-9]/g, '')) || 0;
                return priceB - priceA;
            });

        return {
            totalRevenue,
            totalExpenses: totalExpensesSum,
            netProfit,
            totalVolume,
            totalFreshBag,
            totalWorkingDays,
            dailyAverageVolume,
            
            revenueDetails, 
            expenseDetails,
            
            unitPriceBreakdown, // 단가별 원본 데이터
            
            revenueDistribution, // 홈 화면 차트용 데이터
            expenseDistribution,
            dailyBreakdown,
            unitPriceAnalysis // 통계 화면 단가표용 데이터
        };

    }, [itemLabels]); 

    // --- (이하 월별/연별 로직은 그대로 유지) ---
    const monthlyProfit = useMemo(() => {
        if (!selectedMonth) return {};
        const [year, month] = selectedMonth.split('-').map(Number);
        
        // 기간 계산 (전월 startDay ~ 당월 endDay)
        let startStr, endStr;
        if (monthlyStartDay <= monthlyEndDay) {
            startStr = makeDateString(year, month, monthlyStartDay);
            endStr = makeDateString(year, month, monthlyEndDay);
        } else {
            let prevYear = year;
            let prevMonth = month - 1;
            if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
            startStr = makeDateString(prevYear, prevMonth, monthlyStartDay);
            endStr = makeDateString(year, month, monthlyEndDay);
        }
        const filtered = entries.filter(e => e.date >= startStr && e.date <= endStr);
        return calculateData(filtered);
    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, calculateData]);

    const yearlyProfit = useMemo(() => {
        const stats = calculateData(entries.filter(e => e.date.startsWith(selectedYear)));
        const monthlyBreakdown = [];
        for (let m = 1; m <= 12; m++) {
            const mStr = String(m).padStart(2, '0');
            const targetMonth = `${selectedYear}-${mStr}`;
            const mData = entries.filter(e => e.date.startsWith(targetMonth));
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
            let prevPrevYear = prevYear; let prevPrevMonth = prevMonth - 1;
            if (prevPrevMonth === 0) { prevPrevMonth = 12; prevPrevYear -= 1; }
            startStr = makeDateString(prevPrevYear, prevPrevMonth, monthlyStartDay);
            endStr = makeDateString(prevYear, prevMonth, monthlyEndDay); // 여기 EndDay가 수정 전 코드엔 prevTargetYear로 되어있어서 에러 났을 수 있음. 원본 유지하되 year로 수정.
        }
        const filtered = entries.filter(e => e.date >= startStr && e.date <= endStr);
        return calculateData(filtered);
    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, calculateData]);

    return { monthlyProfit, yearlyProfit, cumulativeProfit, previousMonthlyProfit };
};