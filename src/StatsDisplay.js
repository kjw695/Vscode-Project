import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

// 재사용 가능한 통계 카드 컴포넌트들
const CollapsibleStatCard = ({ title, value, valueColor, onToggle, showDetails, children, isDarkMode }) => (
    <div className={`px-6 py-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
        <div className="flex justify-between items-center gap-2 overflow-hidden">
            <span className="font-semibold text-[clamp(1rem,4vw,1.25rem)] flex-shrink-0">{title}</span>
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <span className={`font-bold ${valueColor} text-[clamp(1rem,4.5vw,1.75rem)] whitespace-nowrap text-right w-full overflow-hidden`}>
                    {value.toLocaleString()}
                </span>
                <button
                    onClick={onToggle}
                    className="flex-shrink-0 px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700"
                >
                    상세
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
        <div className="w-16 flex justify-center">
            {comparison}
        </div>
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
    yearlyPeriod,      // App.js로부터 props를 받습니다.
    cumulativePeriod   // App.js로부터 props를 받습니다.
}) {
    const [showRevenueDetails, setShowRevenueDetails] = useState(false);
    const [showExpensesDetails, setShowExpensesDetails] = useState(false);

    if (!monthlyProfit || !yearlyProfit || !cumulativeProfit || !previousMonthlyProfit) {
        return (
            <div className="flex items-center justify-center h-64">
                <p>통계 데이터를 불러오는 중입니다...</p>
            </div>
        );
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

        if (diff === 0) {
            return (
                <span className={`flex items-center text-xs ml-2 text-gray-500`}>
                    -
                </span>
            );
        }

        const colorClass = diff > 0 ? 'text-red-500' : 'text-blue-500';
        const arrow = diff > 0 ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />;
        return (
            <span className={`${colorClass} flex items-center text-xs ml-2`}>
                {Math.abs(Math.round(diff)).toLocaleString()}
                {arrow}
            </span>
        );
    };

    const currentProfitData = statisticsView === 'monthly' ? monthlyProfit : (statisticsView === 'yearly' ? yearlyProfit : cumulativeProfit);
    const isMonthly = statisticsView === 'monthly';

    const StatsCard = ({ profitData }) => {
        const revenue = profitData.totalDeliveryRevenue + profitData.totalReturnRevenue + profitData.totalFreshBagRevenue + profitData.totalDeliveryInterruptionRevenue;
        const expenses = profitData.totalExpensesSum;

        return (
            <div className="space-y-3">
                {/* 순이익 카드 */}
                <div className={`px-6 py-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                    <p className={`text-base text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {isMonthly ? '월 순이익' : statisticsView === 'yearly' ? '연간 순이익' : '누적 순이익'}
                    </p>
                    <div className={`text-center font-extrabold my-1 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>
                        <span className="block text-[clamp(1.75rem,6vw,2.75rem)]">{profitData.netProfit.toLocaleString()}</span>
                    </div>
                </div>

                <CollapsibleStatCard
                    title="총 매출"
                    value={revenue}
                    valueColor="text-red-500"
                    onToggle={() => toggleDetails('revenue')}
                    showDetails={showRevenueDetails}
                    isDarkMode={isDarkMode}
                >
                    <p><strong>배송 수익:</strong> {profitData.totalDeliveryRevenue.toLocaleString()}</p>
                    <p><strong>반품 수익:</strong> {profitData.totalReturnRevenue.toLocaleString()}</p>
                    <p><strong>배송중단 수익:</strong> {profitData.totalDeliveryInterruptionRevenue.toLocaleString()}</p>
                    <p><strong>프레시백 수익:</strong> {profitData.totalFreshBagRevenue.toLocaleString()}</p>
                </CollapsibleStatCard>

                <CollapsibleStatCard
                    title="총 지출"
                    value={expenses}
                    valueColor="text-blue-500"
                    onToggle={() => toggleDetails('expenses')}
                    showDetails={showExpensesDetails}
                    isDarkMode={isDarkMode}
                >
                    <p><strong>패널티 비용:</strong> {profitData.totalPenaltyCost.toLocaleString()}</p>
                    <p><strong>산재 비용:</strong> {profitData.totalIndustrialAccidentCost.toLocaleString()}</p>
                    <p><strong>유류비:</strong> {profitData.totalFuelCost.toLocaleString()}</p>
                    <p><strong>유지보수비:</strong> {profitData.totalMaintenanceCost.toLocaleString()}</p>
                    <p><strong>부가세:</strong> {profitData.totalVatAmount.toLocaleString()}</p>
                    <p><strong>종합소득세:</strong> {profitData.totalIncomeTaxAmount.toLocaleString()}</p>
                    <p><strong>세무사 비용:</strong> {profitData.totalTaxAccountantFee.toLocaleString()}</p>
                </CollapsibleStatCard>

                {/* 상세 정보 카드 */}
                <div className={`px-6 py-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                    <div className="space-y-3">
                        {isMonthly ? (
                            <>
                                <DetailRow
                                    label="총 근무일"
                                    value={`${profitData.totalWorkingDays.toLocaleString()} 일`}
                                    comparison={renderComparison(profitData.totalWorkingDays, previousMonthlyProfit.totalWorkingDays)}
                                />
                                <DetailRow
                                    label="총 물량"
                                    value={`${profitData.totalVolume.toLocaleString()} 건`}
                                    comparison={renderComparison(profitData.totalVolume, previousMonthlyProfit.totalVolume)}
                                />
                                <DetailRow
                                    label="총 프레시백"
                                    value={`${profitData.totalFreshBag.toLocaleString()} 개`}
                                    comparison={renderComparison(profitData.totalFreshBag, previousMonthlyProfit.totalFreshBag)}
                                />
                                <DetailRow
                                    label="일 평균 물량"
                                    value={`${Math.round(profitData.dailyAverageVolume)} 건`}
                                    comparison={renderComparison(Math.round(profitData.dailyAverageVolume), Math.round(previousMonthlyProfit.dailyAverageVolume))}
                                />
                            </>
                        ) : (
                            <>
                                <SimpleDetailRow label="총 근무일" value={`${profitData.totalWorkingDays.toLocaleString()} 일`} />
                                <SimpleDetailRow label="총 물량" value={`${profitData.totalVolume.toLocaleString()} 건`} />
                                <SimpleDetailRow label="총 프레시백" value={`${profitData.totalFreshBag.toLocaleString()} 개`} />
                                <SimpleDetailRow label="일 평균 물량" value={`${Math.round(profitData.dailyAverageVolume)} 건`} />
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };


    return (
        <div className={`w-full max-w-lg mx-auto p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-stone-100'}`}>
            <div className="flex justify-center border-b mb-4">
                <button
                    onClick={() => setStatisticsView('monthly')}
                    className={`py-2 px-4 font-semibold ${statisticsView === 'monthly' ? (isDarkMode ? 'border-yellow-400 text-yellow-400' : 'border-yellow-500 text-yellow-600') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}
                >
                    월간
                </button>
                <button
                    onClick={() => setStatisticsView('yearly')}
                    className={`py-2 px-4 font-semibold ${statisticsView === 'yearly' ? (isDarkMode ? 'border-yellow-400 text-yellow-400' : 'border-yellow-500 text-yellow-600') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}
                >
                    연간
                </button>
                <button
                    onClick={() => setStatisticsView('cumulative')}
                    className={`py-2 px-4 font-semibold ${statisticsView === 'cumulative' ? (isDarkMode ? 'border-yellow-400 text-yellow-400' : 'border-yellow-500 text-yellow-600') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}
                >
                    누적
                </button>
            </div>

            <h3 className={`text-xl sm:text-2xl font-bold text-center mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                {isMonthly && ( <div className="flex items-center justify-center space-x-2 sm:space-x-4"><button onClick={() => handleMonthChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowLeft size={20} /></button><span className="font-bold text-xl sm:text-2xl">{currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월</span><button onClick={() => handleMonthChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowRight size={20} /></button></div>)}
                {statisticsView === 'yearly' && ( <div className="flex items-center justify-center space-x-2 sm:space-x-4"><button onClick={() => setSelectedYear(String(parseInt(selectedYear) - 1))} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowLeft size={20} /></button><span className="font-bold text-xl sm:text-2xl">{selectedYear}년 통계</span><button onClick={() => setSelectedYear(String(parseInt(selectedYear) + 1))} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowRight size={20} /></button></div>)}
                {statisticsView === 'cumulative' && `누적 통계`}
            </h3>
            
            {/* ✨ 변경점: props로 받은 기간 정보를 사용하여 날짜를 표시합니다. */}
            {statisticsView === 'monthly' && monthlyProfit.periodStartDate && (
                <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    집계 기간: {new Date(monthlyProfit.periodStartDate).toLocaleDateString('ko-KR')} ~ {new Date(monthlyProfit.periodEndDate).toLocaleDateString('ko-KR')}
                </p>
            )}
            {statisticsView === 'yearly' && yearlyPeriod && (
                <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    집계 기간: {yearlyPeriod.startDate} ~ {yearlyPeriod.endDate}
                </p>
            )}
            {statisticsView === 'cumulative' && cumulativePeriod && (
                <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    집계 기간: {cumulativePeriod.startDate} ~ {cumulativePeriod.endDate}
                </p>
            )}
            
            <StatsCard profitData={currentProfitData} />

            {statisticsView === 'yearly' && (
                 <div className="mt-6">
                      <h3 className={`text-lg font-bold mb-3 mt-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>월별 상세 내역</h3>
                      <div className="overflow-x-auto"><table className={`min-w-full rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}><thead><tr className={`${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-600'} uppercase text-sm`}><th className="py-3 px-6 text-left">월</th><th className="py-3 px-6 text-left">순이익</th></tr></thead><tbody className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>{yearlyProfit.monthlyBreakdown.map(monthData => ( <tr key={monthData.month} className={`${isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-100'} border-b`}><td className="py-3 px-6 text-left">{monthData.month}월</td><td className="py-3 px-6 text-left">{monthData.netProfit.toLocaleString()}</td></tr>))}</tbody></table></div>
                 </div>
            )}
        </div>
    );
}

export default StatsDisplay;