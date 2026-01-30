import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

// 재사용 가능한 통계 카드 컴포넌트들
const CollapsibleStatCard = ({ title, value, valueColor, onToggle, showDetails, children, isDarkMode, t }) => (
    <div className={`px-6 py-4 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'} shadow`}>
        <div className="flex justify-between items-center gap-2 overflow-hidden">
            <span className="font-semibold text-[clamp(1rem,4vw,1.25rem)] flex-shrink-0">{title}</span>
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <span className={`font-bold ${valueColor} text-[clamp(1rem,4.5vw,1.75rem)] whitespace-nowrap text-right w-full overflow-hidden`}>
                    {value.toLocaleString()}
                </span>
                <button onClick={onToggle} className="flex-shrink-0 px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700">
                    {t.details}
                </button>
            </div>
        </div>
        {showDetails && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2 text-sm sm:text-base">
                {children}
            </div>
        )}
    </div>
);

const DetailRow = ({ label, value, comparison }) => (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-1">
        <span className="text-base sm:text-lg font-semibold">{label}</span>
        <span className="text-base sm:text-lg font-bold">{value}</span>
        <div className="w-16 flex justify-center">{comparison}</div>
    </div>
);

const SimpleDetailRow = ({ label, value }) => (
    <div className="grid grid-cols-2 items-center">
        <span className="text-base sm:text-lg font-semibold">{label}</span>
        <span className="text-base sm:text-lg font-bold text-right">{value}</span>
    </div>
);

function StatsDisplay({ 
    statisticsView, 
    setStatisticsView, 
    selectedYear, 
    setSelectedYear, 
    currentCalendarDate, 
    handleMonthChange, 
    monthlyProfit, 
    yearlyProfit, 
    cumulativeProfit, 
    previousMonthlyProfit, 
    isDarkMode, 
    yearlyPeriod, 
    cumulativePeriod 
}) {
    const [showRevenueDetails, setShowRevenueDetails] = useState(false);
    const [showExpensesDetails, setShowExpensesDetails] = useState(false);

    // 🔥 [원칙 준수] 시스템 언어 감지
    const isKo = useMemo(() => navigator.language.toLowerCase().includes('ko'), []);
    const t = {
        loading: isKo ? "통계 데이터를 불러오는 중입니다..." : "Loading stats...",
        monthlyProfit: isKo ? "월 순이익" : "Net Profit (Month)",
        yearlyProfit: isKo ? "연간 순이익" : "Net Profit (Year)",
        cumulativeProfit: isKo ? "누적 순이익" : "Net Profit (Total)",
        totalRevenue: isKo ? "총 매출" : "Total Revenue",
        totalExpense: isKo ? "총 지출" : "Total Expense",
        details: isKo ? "상세" : "Details",
        item: isKo ? "항목" : "Item",
        count: isKo ? "건수" : "Count",
        revenue: isKo ? "수익" : "Revenue",
        delivery: isKo ? "배송" : "Delivery",
        return: isKo ? "반품" : "Return",
        stop: isKo ? "중단" : "Stop",
        freshbag: isKo ? "프레시백" : "Fresh Bag",
        otherRevenue: isKo ? "기타 수익" : "Other Revenue",
        otherExpense: isKo ? "기타 지출" : "Other Expenses",
        penalty: isKo ? "패널티 비용" : "Penalty",
        accident: isKo ? "산재 비용" : "Ind. Accident",
        fuel: isKo ? "유류비" : "Fuel Cost",
        maintenance: isKo ? "유지보수비" : "Maintenance",
        vat: isKo ? "부가세" : "VAT",
        tax: isKo ? "종합소득세" : "Income Tax",
        accountant: isKo ? "세무사 비용" : "Accountant Fee",
        totalDays: isKo ? "총 근무일" : "Total Days",
        totalVolume: isKo ? "총 물량" : "Total Volume",
        totalFreshbag: isKo ? "총 프레시백" : "Total Fresh Bags",
        dailyAvg: isKo ? "일 평균 물량" : "Daily Avg Vol.",
        unit: isKo ? "건" : "",
        piece: isKo ? "개" : "pcs",
        day: isKo ? "일" : "d",
        monthly: isKo ? "월간" : "Monthly",
        yearly: isKo ? "연간" : "Yearly",
        cumulative: isKo ? "누적" : "Cumulative",
        yearStat: isKo ? "년 통계" : " Stats",
        cumulativeStat: isKo ? "누적 통계" : "Cumulative Stats",
        period: isKo ? "집계 기간" : "Period",
        monthlyDetail: isKo ? "월별 상세 내역" : "Monthly Details",
        month: isKo ? "월" : "Month",
        profit: isKo ? "순이익" : "Net Profit",
        unitPriceList: isKo ? "단가별 매출 내역" : "Revenue by Unit Price",
        unitPrice: isKo ? "단가" : "Unit Price",
        totalAmount: isKo ? "총 금액" : "Total Amount"
    };

    if (!monthlyProfit || !yearlyProfit || !cumulativeProfit || !previousMonthlyProfit) {
        return (<div className="flex items-center justify-center h-64"><p>{t.loading}</p></div>);
    }

    const toggleDetails = (type) => {
        if (type === 'revenue') {
            setShowRevenueDetails(prev => !prev);
            setShowExpensesDetails(false);
        } else if (type === 'expenses') {
            setShowExpensesDetails(prev => !prev);
            setShowRevenueDetails(false);
        }
    };
    
    const renderComparison = (currentValue, previousValue) => {
        if (previousValue === undefined || currentValue === undefined) return null;
        const diff = currentValue - previousValue;
        if (diff === 0) return (<span className={`flex items-center text-xs ml-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>-</span>);
        const colorClass = diff > 0 ? 'text-red-500' : 'text-blue-500';
        const arrow = diff > 0 ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />;
        return (<span className={`${colorClass} flex items-center text-xs ml-2`}>{Math.abs(Math.round(diff)).toLocaleString()}{arrow}</span>);
    };

    const currentProfitData = statisticsView === 'monthly' ? monthlyProfit : (statisticsView === 'yearly' ? yearlyProfit : cumulativeProfit);
    const isMonthly = statisticsView === 'monthly';

    const StatsCard = ({ profitData }) => {
        // 🔥 [개선] 하드코딩된 합계 대신, useProfitCalculations에서 계산된 'totalRevenue'(커스텀 포함) 사용
        const totalRevenue = profitData.totalRevenue || (
            (profitData.totalDeliveryRevenue || 0) + 
            (profitData.totalReturnRevenue || 0) + 
            (profitData.totalFreshBagRevenue || 0) + 
            (profitData.totalDeliveryInterruptionRevenue || 0)
        );

        // 기존 항목들의 합계 (기타 수익 계산용)
        const legacyRevenueSum = (profitData.totalDeliveryRevenue || 0) + (profitData.totalReturnRevenue || 0) + (profitData.totalFreshBagRevenue || 0) + (profitData.totalDeliveryInterruptionRevenue || 0);
        const otherRevenue = totalRevenue - legacyRevenueSum;

        // 🔥 [개선] 지출도 동일하게 처리
        const totalExpenses = profitData.totalExpensesSum || 0;
        const legacyExpenseSum = (profitData.totalPenaltyCost || 0) + (profitData.totalIndustrialAccidentCost || 0) + (profitData.totalFuelCost || 0) + (profitData.totalMaintenanceCost || 0) + (profitData.totalVatAmount || 0) + (profitData.totalIncomeTaxAmount || 0) + (profitData.totalTaxAccountantFee || 0);
        const otherExpense = totalExpenses - legacyExpenseSum;

        return (
            <div className="space-y-3">
                <div className={`px-6 py-4 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'} shadow`}>
                    <p className={`text-base text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {isMonthly ? t.monthlyProfit : statisticsView === 'yearly' ? t.yearlyProfit : t.cumulativeProfit}
                    </p>
                    <div className={`text-center font-extrabold my-1 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>
                        <span className="block text-[clamp(1.75rem,6vw,2.75rem)]">{(profitData.netProfit || 0).toLocaleString()}</span>
                    </div>
                </div>

                <CollapsibleStatCard
                    title={t.totalRevenue}
                    value={totalRevenue}
                    valueColor="text-red-500"
                    onToggle={() => toggleDetails('revenue')}
                    showDetails={showRevenueDetails}
                    isDarkMode={isDarkMode}
                    t={t}
                >
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs font-semibold border-b border-gray-200 dark:border-gray-600 pb-1">
                            <span>{t.item}</span>
                            <span className="text-right">{t.count}</span>
                            <div className="w-28 text-right"><span>{t.revenue}</span></div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm sm:text-base">
                            <span className="whitespace-nowrap">{t.delivery}</span>
                            <span className="text-right whitespace-nowrap">{(profitData.totalDeliveryCount || 0).toLocaleString()} {t.unit}</span>
                            <div className="w-28 text-right"><span className="font-bold whitespace-nowrap">{(profitData.totalDeliveryRevenue || 0).toLocaleString()} 원</span></div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm sm:text-base">
                            <span className="whitespace-nowrap">{t.return}</span>
                            <span className="text-right whitespace-nowrap">{(profitData.totalReturnCount || 0).toLocaleString()} {t.unit}</span>
                            <div className="w-28 text-right"><span className="font-bold whitespace-nowrap">{(profitData.totalReturnRevenue || 0).toLocaleString()} 원</span></div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm sm:text-base">
                            <span className="whitespace-nowrap">{t.stop}</span>
                            <span className="text-right whitespace-nowrap">{(profitData.totalInterruptionCount || 0).toLocaleString()} {t.unit}</span>
                            <div className="w-28 text-right"><span className="font-bold whitespace-nowrap">{(profitData.totalDeliveryInterruptionRevenue || 0).toLocaleString()} 원</span></div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm sm:text-base">
                            <span className="whitespace-nowrap">{t.freshbag}</span>
                            <span className="text-right whitespace-nowrap">{(profitData.totalFreshBag || 0).toLocaleString()} {t.piece}</span>
                            <div className="w-28 text-right"><span className="font-bold whitespace-nowrap">{(profitData.totalFreshBagRevenue || 0).toLocaleString()} 원</span></div>
                        </div>
                        {/* 🔥 [개선] 기타(커스텀) 수익 표시 */}
                        {otherRevenue > 0 && (
                            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm sm:text-base text-blue-600 dark:text-blue-400">
                                <span className="whitespace-nowrap font-bold">{t.otherRevenue}</span>
                                <span className="text-right whitespace-nowrap">-</span>
                                <div className="w-28 text-right"><span className="font-bold whitespace-nowrap">{otherRevenue.toLocaleString()} 원</span></div>
                            </div>
                        )}
                    </div>
                </CollapsibleStatCard>

                <CollapsibleStatCard
                    title={t.totalExpense}
                    value={totalExpenses}
                    valueColor="text-blue-500"
                    onToggle={() => toggleDetails('expenses')}
                    showDetails={showExpensesDetails}
                    isDarkMode={isDarkMode}
                    t={t}
                >
                    <div className="space-y-1">
                        <div className="flex justify-between"><strong>{t.penalty}:</strong> <span>{(profitData.totalPenaltyCost || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><strong>{t.accident}:</strong> <span>{(profitData.totalIndustrialAccidentCost || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><strong>{t.fuel}:</strong> <span>{(profitData.totalFuelCost || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><strong>{t.maintenance}:</strong> <span>{(profitData.totalMaintenanceCost || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><strong>{t.vat}:</strong> <span>{(profitData.totalVatAmount || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><strong>{t.tax}:</strong> <span>{(profitData.totalIncomeTaxAmount || 0).toLocaleString()}</span></div>
                        <div className="flex justify-between"><strong>{t.accountant}:</strong> <span>{(profitData.totalTaxAccountantFee || 0).toLocaleString()}</span></div>
                        {/* 🔥 [개선] 기타(커스텀) 지출 표시 */}
                        {otherExpense > 0 && (
                            <div className="flex justify-between text-red-500 font-bold border-t border-gray-200 dark:border-gray-600 pt-1 mt-1">
                                <strong>{t.otherExpense}:</strong> <span>{otherExpense.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </CollapsibleStatCard>

                <div className={`px-6 py-4 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'} shadow`}>
                    <div className="space-y-3">
                        {isMonthly ? (
                            <>
                                <DetailRow label={t.totalDays} value={`${(profitData.totalWorkingDays || 0).toLocaleString()} ${t.day}`} comparison={renderComparison(profitData.totalWorkingDays, previousMonthlyProfit.totalWorkingDays)} />
                                <DetailRow label={t.totalVolume} value={`${(profitData.totalVolume || 0).toLocaleString()} ${t.unit}`} comparison={renderComparison(profitData.totalVolume, previousMonthlyProfit.totalVolume)} />
                                <DetailRow label={t.totalFreshbag} value={`${(profitData.totalFreshBag || 0).toLocaleString()} ${t.piece}`} comparison={renderComparison(profitData.totalFreshBag, previousMonthlyProfit.totalFreshBag)} />
                                <DetailRow label={t.dailyAvg} value={`${Math.round(profitData.dailyAverageVolume || 0)} ${t.unit}`} comparison={renderComparison(Math.round(profitData.dailyAverageVolume || 0), Math.round(previousMonthlyProfit.dailyAverageVolume || 0))} />
                            </>
                        ) : (
                            <>
                                <SimpleDetailRow label={t.totalDays} value={`${(profitData.totalWorkingDays || 0).toLocaleString()} ${t.day}`} />
                                <SimpleDetailRow label={t.totalVolume} value={`${(profitData.totalVolume || 0).toLocaleString()} ${t.unit}`} />
                                <SimpleDetailRow label={t.totalFreshbag} value={`${(profitData.totalFreshBag || 0).toLocaleString()} ${t.piece}`} />
                                <SimpleDetailRow label={t.dailyAvg} value={`${Math.round(profitData.dailyAverageVolume || 0)} ${t.unit}`} />
                            </>
                        )}
                    </div>
                </div>

                {statisticsView === 'monthly' && monthlyProfit.unitPriceBreakdown && Object.keys(monthlyProfit.unitPriceBreakdown).length > 0 && (
                    <div className="mt-4">
                        <h3 className={`text-lg font-bold mb-3 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                            {t.unitPriceList}
                        </h3>
                        <div className="space-y-3">
                            {Object.entries(monthlyProfit.unitPriceBreakdown)
                                .sort(([priceA], [priceB]) => priceB - priceA)
                                .map(([unitPrice, data]) => (
                                    <div key={unitPrice} className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'}`}>
                                        <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-200 dark:border-gray-600">
                                            <span className="text-sm font-semibold">{t.unitPrice}</span>
                                            <span className="font-bold text-lg">{Number(unitPrice).toLocaleString()}원</span>
                                        </div>
                                        
                                        <div className="space-y-1 text-sm">
                                            <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-4">
                                                <span className="font-medium">{t.delivery}</span>
                                                <span className="text-right">{(data.deliveryCount || 0).toLocaleString()} {t.unit}</span>
                                                <span className="text-right font-semibold">{(data.deliveryRevenue || 0).toLocaleString()} 원</span>
                                            </div>
                                            <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-4">
                                                <span className="font-medium">{t.return}</span>
                                                <span className="text-right">{(data.returnCount || 0).toLocaleString()} {t.unit}</span>
                                                <span className="text-right font-semibold">{(data.returnRevenue || 0).toLocaleString()} 원</span>
                                            </div>
                                            <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-4">
                                                <span className="font-medium">{t.stop}</span>
                                                <span className="text-right">{(data.interruptionCount || 0).toLocaleString()} {t.unit}</span>
                                                <span className="text-right font-semibold">{(data.interruptionRevenue || 0).toLocaleString()} 원</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200 dark:border-gray-600">
                                            <span className="font-semibold">{t.totalAmount}</span>
                                            <span className={`font-bold text-lg ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                                {(data.totalRevenue || 0).toLocaleString()}원
                                            </span>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`w-full max-w-lg mx-auto p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-stone-100'}`}>
            <div className="flex justify-center border-b mb-4">
                <button onClick={() => setStatisticsView('monthly')} className={`py-2 px-4 font-semibold ${statisticsView === 'monthly' ? (isDarkMode ? 'border-yellow-400 text-yellow-400' : 'border-yellow-500 text-yellow-600') : (isDarkMode ? 'border-transparent text-gray-300' : 'border-transparent text-gray-500')} border-b-2`}>{t.monthly}</button>
                <button onClick={() => setStatisticsView('yearly')} className={`py-2 px-4 font-semibold ${statisticsView === 'yearly' ? (isDarkMode ? 'border-yellow-400 text-yellow-400' : 'border-yellow-500 text-yellow-600') : (isDarkMode ? 'border-transparent text-gray-300' : 'border-transparent text-gray-500')} border-b-2`}>{t.yearly}</button>
                <button onClick={() => setStatisticsView('cumulative')} className={`py-2 px-4 font-semibold ${statisticsView === 'cumulative' ? (isDarkMode ? 'border-yellow-400 text-yellow-400' : 'border-yellow-500 text-yellow-600') : (isDarkMode ? 'border-transparent text-gray-300' : 'border-transparent text-gray-500')} border-b-2`}>{t.cumulative}</button>
            </div>
            <h3 className={`text-xl sm:text-2xl font-bold text-center mb-1 ${isDarkMode ? 'text-gray-200' : 'text-black'}`}>
                {isMonthly && ( <div className="flex items-center justify-center space-x-2 sm:space-x-4"><button onClick={() => handleMonthChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowLeft size={20} /></button><span className="font-bold text-xl sm:text-2xl">{currentCalendarDate.getFullYear()}{isKo ? "년 " : "."}{currentCalendarDate.getMonth() + 1}{isKo ? "월" : ""}</span><button onClick={() => handleMonthChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowRight size={20} /></button></div>)}
                {statisticsView === 'yearly' && ( <div className="flex items-center justify-center space-x-2 sm:space-x-4"><button onClick={() => setSelectedYear(String(parseInt(selectedYear) - 1))} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowLeft size={20} /></button><span className="font-bold text-xl sm:text-2xl">{selectedYear}{t.yearStat}</span><button onClick={() => setSelectedYear(String(parseInt(selectedYear) + 1))} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowRight size={20} /></button></div>)}
                {statisticsView === 'cumulative' && t.cumulativeStat}
            </h3>
            {statisticsView === 'monthly' && monthlyProfit.periodStartDate && ( <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t.period}: {new Date(monthlyProfit.periodStartDate).toLocaleDateString('ko-KR')} ~ {new Date(monthlyProfit.periodEndDate).toLocaleDateString('ko-KR')}</p>)}
            {statisticsView === 'yearly' && yearlyPeriod && ( <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t.period}: {yearlyPeriod.startDate} ~ {yearlyPeriod.endDate}</p>)}
            {statisticsView === 'cumulative' && cumulativePeriod && ( <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t.period}: {cumulativePeriod.startDate} ~ {cumulativePeriod.endDate}</p>)}
            
            <StatsCard profitData={currentProfitData} />

            {statisticsView === 'yearly' && (
                <div className="mt-6">
                     <h3 className={`text-lg font-bold mb-3 mt-6 ${isDarkMode ? 'text-gray-200' : 'text-black'}`}>{t.monthlyDetail}</h3>
                     <div className="overflow-x-auto"><table className={`min-w-full rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}><thead><tr className={`${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-600'} uppercase text-sm`}><th className="py-3 px-6 text-left">{t.month}</th><th className="py-3 px-6 text-left">{t.profit}</th></tr></thead><tbody className={`${isDarkMode ? 'text-gray-200' : 'text-black'} text-sm`}>{yearlyProfit.monthlyBreakdown.map(monthData => ( <tr key={monthData.month} className={`${isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-100'} border-b`}><td className="py-3 px-6 text-left">{monthData.month}{t.month}</td><td className="py-3 px-6 text-left">{monthData.netProfit.toLocaleString()}</td></tr>))}</tbody></table></div>
                </div>
            )}
        </div>
    );
}

export default StatsDisplay;