//통계
import React, { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

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
    isDarkMode
}) {
    const [showRevenueDetails, setShowRevenueDetails] = useState(false);
    const [showExpensesDetails, setShowExpensesDetails] = useState(false);
    
    const today = new Date();
    const isCurrentRealMonth = currentCalendarDate.getFullYear() === today.getFullYear() &&
                             currentCalendarDate.getMonth() === today.getMonth();

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
        if (previousValue === 0 && currentValue === 0) return null;
        const diff = currentValue - previousValue;
        if (diff === 0) return null;
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
    const totalRevenue = currentProfitData.totalDeliveryRevenue + currentProfitData.totalReturnRevenue + currentProfitData.totalFreshBagRevenue + currentProfitData.totalDeliveryInterruptionRevenue;
    const isMonthly = statisticsView === 'monthly';

    const StatsCard = ({ profitData }) => (
        <div className="space-y-3">
            {/* 순이익 카드 */}
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                <p className={`text-sm text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{isMonthly ? '월 순이익' : (statisticsView === 'yearly' ? '연간 순이익' : '누적 순이익')}</p>
                <div className={`text-center font-extrabold my-1 whitespace-nowrap ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>
                    <span className="text-3xl sm:text-4xl">{profitData.netProfit.toLocaleString()}</span>
                </div>
            </div>
            
            {/* 매출 카드 */}
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                <div className="flex justify-between items-center">
                    <span className="font-semibold flex-shrink-0">총 매출</span>
                    <div className="flex items-center ml-2 min-w-0">
                        <div className="flex items-baseline flex-shrink min-w-0 text-right" style={{ wordBreak: 'keep-all' }}>
                            <span className="font-bold text-red-500 text-base sm:text-lg">{totalRevenue.toLocaleString()}</span>
                        </div>
                        <button onClick={() => toggleDetails('revenue')} className="flex-shrink-0 ml-2 text-xs py-1 px-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700">{showRevenueDetails ? '닫기' : '상세'}</button>
                    </div>
                </div>
                {showRevenueDetails && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-1 text-sm"><p><strong>배송 수익:</strong> {profitData.totalDeliveryRevenue.toLocaleString()}</p><p><strong>반품 수익:</strong> {profitData.totalReturnRevenue.toLocaleString()}</p><p><strong>배송중단 수익:</strong> {profitData.totalDeliveryInterruptionRevenue.toLocaleString()}</p><p><strong>프레시백 수익:</strong> {profitData.totalFreshBagRevenue.toLocaleString()}</p></div>)}
            </div>

            {/* 지출 카드 */}
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                <div className="flex justify-between items-center">
                    <span className="font-semibold flex-shrink-0">총 지출</span>
                    <div className="flex items-center ml-2">
                        <span className="font-bold text-blue-500 text-base sm:text-lg">{profitData.totalExpensesSum.toLocaleString()}</span>
                        <button onClick={() => toggleDetails('expenses')} className="ml-2 text-xs py-1 px-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700">{showExpensesDetails ? '닫기' : '상세'}</button>
                    </div>
                </div>
                {showExpensesDetails && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-1 text-sm"><p><strong>패널티 비용:</strong> {profitData.totalPenaltyCost.toLocaleString()}</p><p><strong>산재 비용:</strong> {profitData.totalIndustrialAccidentCost.toLocaleString()}</p><p><strong>유류비:</strong> {profitData.totalFuelCost.toLocaleString()}</p><p><strong>유지보수비:</strong> {profitData.totalMaintenanceCost.toLocaleString()}</p><p><strong>부가세:</strong> {profitData.totalVatAmount.toLocaleString()}</p><p><strong>종합소득세:</strong> {profitData.totalIncomeTaxAmount.toLocaleString()}</p><p><strong>세무사 비용:</strong> {profitData.totalTaxAccountantFee.toLocaleString()}</p></div>)}
            </div>

            {/* 상세 정보 카드 */}
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                <div className="space-y-4">
                    <div className="flex justify-between items-center"><span className="text-sm font-semibold">총 근무일</span><div className="flex items-baseline justify-end"><span className="text-sm font-bold">{profitData.totalWorkingDays.toLocaleString()} 일</span>{isMonthly && !isCurrentRealMonth && renderComparison(profitData.totalWorkingDays, previousMonthlyProfit.totalWorkingDays)}</div></div>
                    <div className="flex justify-between items-center"><span className="text-sm font-semibold">총 물량</span><div className="flex items-baseline justify-end"><span className="text-sm font-bold">{profitData.totalVolume.toLocaleString()} 건</span>{isMonthly && !isCurrentRealMonth && renderComparison(profitData.totalVolume, previousMonthlyProfit.totalVolume)}</div></div>
                    <div className="flex justify-between items-center"><span className="text-sm font-semibold">총 프레시백</span><div className="flex items-baseline justify-end"><span className="text-sm font-bold">{profitData.totalFreshBag.toLocaleString()} 개</span>{isMonthly && !isCurrentRealMonth && renderComparison(profitData.totalFreshBag, previousMonthlyProfit.totalFreshBag)}</div></div>
                    <div className="flex justify-between items-center"><span className="text-sm font-semibold">일 평균 물량</span><div className="flex items-baseline justify-end"><span className="text-sm font-bold">{Math.round(profitData.dailyAverageVolume)} 건</span>{isMonthly && !isCurrentRealMonth && renderComparison(Math.round(profitData.dailyAverageVolume), Math.round(previousMonthlyProfit.dailyAverageVolume))}</div></div>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`p-4 rounded-lg w-full max-w-4xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex justify-center mb-4 p-1 rounded-full bg-gray-200 dark:bg-gray-900">
                <button onClick={() => setStatisticsView('monthly')} className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-colors ${statisticsView === 'monthly' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>월간</button>
                <button onClick={() => setStatisticsView('yearly')} className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-colors ${statisticsView === 'yearly' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>연간</button>
                <button onClick={() => setStatisticsView('cumulative')} className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-colors ${statisticsView === 'cumulative' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>누적</button>
            </div>

            <h3 className={`text-xl font-bold text-center mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                {isMonthly && ( <div className="flex items-center justify-center space-x-4"><button onClick={() => handleMonthChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowLeft size={20} /></button><span className="font-bold text-xl">{currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월</span><button onClick={() => handleMonthChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowRight size={20} /></button></div>)}
                {statisticsView === 'yearly' && ( <div className="flex items-center justify-center space-x-4"><button onClick={() => setSelectedYear(String(parseInt(selectedYear) - 1))} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowLeft size={20} /></button><span className="font-bold text-xl">{selectedYear}년 통계</span><button onClick={() => setSelectedYear(String(parseInt(selectedYear) + 1))} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowRight size={20} /></button></div>)}
                {statisticsView === 'cumulative' && `누적 통계`}
            </h3>
            
            {isMonthly && (<p className={`text-xs text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>집계 기간: {monthlyProfit.periodStartDate ? new Date(monthlyProfit.periodStartDate).toLocaleDateString('ko-KR') : ''} ~ {monthlyProfit.periodEndDate ? new Date(monthlyProfit.periodEndDate).toLocaleDateString('ko-KR') : ''}</p>)}
            
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