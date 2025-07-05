import React, { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import ProfitHeatmap from './components/ProfitHeatmap';

function StatsDisplay({
    statisticsView,
    setStatisticsView,
    selectedYear,
    setSelectedYear,
    currentCalendarDate,
    handleMonthChange, // App.js로부터 이 함수를 전달받아야 합니다.
    monthlyProfit,
    yearlyProfit,
    cumulativeProfit,
    previousMonthlyProfit,
    isDarkMode,
    showMessage
}) {
    // 상세 내역 표시 여부를 관리하는 상태
    const [showRevenueDetails, setShowRevenueDetails] = useState(false);
    const [showExpensesDetails, setShowExpensesDetails] = useState(false);

    const toggleDetails = (type) => {
        if (type === 'revenue') {
            setShowRevenueDetails(prev => !prev);
            setShowExpensesDetails(false); // 다른 상세내역은 닫기
        } else if (type === 'expenses') {
            setShowExpensesDetails(prev => !prev);
            setShowRevenueDetails(false); // 다른 상세내역은 닫기
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

    // UI 컴포넌트 분리
    const StatsCard = ({ profitData }) => (
        <div className="space-y-3">
            {/* 순이익 카드 */}
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                <p className={`text-sm text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{isMonthly ? '월 순이익' : (statisticsView === 'yearly' ? '연간 순이익' : '누적 순이익')}</p>
                <p className={`text-4xl font-extrabold text-center my-1 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>{profitData.netProfit.toLocaleString()} 원</p>
            </div>
            
            {/* 매출 카드 */}
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleDetails('revenue')}>
                    <span className="font-semibold">총 매출</span>
                    <div className="flex items-center"><span className="font-bold text-red-500">{totalRevenue.toLocaleString()} 원</span><button className="ml-2 text-xs py-1 px-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700">{showRevenueDetails ? '닫기' : '상세'}</button></div>
                </div>
                {showRevenueDetails && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-1 text-sm"><p><strong>배송 수익:</strong> {profitData.totalDeliveryRevenue.toLocaleString()} 원</p><p><strong>반품 수익:</strong> {profitData.totalReturnRevenue.toLocaleString()} 원</p><p><strong>배송중단 수익:</strong> {profitData.totalDeliveryInterruptionRevenue.toLocaleString()} 원</p><p><strong>프레시백 수익:</strong> {profitData.totalFreshBagRevenue.toLocaleString()} 원</p></div>)}
            </div>

            {/* 지출 카드 */}
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleDetails('expenses')}>
                    <span className="font-semibold">총 지출</span>
                    <div className="flex items-center"><span className="font-bold text-blue-500">{profitData.totalExpensesSum.toLocaleString()} 원</span><button className="ml-2 text-xs py-1 px-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700">{showExpensesDetails ? '닫기' : '상세'}</button></div>
                </div>
                {showExpensesDetails && (<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-1 text-sm"><p><strong>패널티 비용:</strong> {profitData.totalPenaltyCost.toLocaleString()} 원</p><p><strong>산재 비용:</strong> {profitData.totalIndustrialAccidentCost.toLocaleString()} 원</p><p><strong>유류비:</strong> {profitData.totalFuelCost.toLocaleString()} 원</p><p><strong>유지보수비:</strong> {profitData.totalMaintenanceCost.toLocaleString()} 원</p><p><strong>부가세:</strong> {profitData.totalVatAmount.toLocaleString()} 원</p><p><strong>종합소득세:</strong> {profitData.totalIncomeTaxAmount.toLocaleString()} 원</p><p><strong>세무사 비용:</strong> {profitData.totalTaxAccountantFee.toLocaleString()} 원</p></div>)}
            </div>

            {/* 상세 정보 카드 */}
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">총 근무일</span>
                        <div className="flex items-baseline justify-end">
                            <span className="text-sm font-bold">{profitData.totalWorkingDays.toLocaleString()} 일</span>
                            {isMonthly && renderComparison(profitData.totalWorkingDays, previousMonthlyProfit.totalWorkingDays)}
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">총 물량</span>
                        <div className="flex items-baseline justify-end">
                            <span className="text-sm font-bold">{profitData.totalVolume.toLocaleString()} 건</span>
                            {isMonthly && renderComparison(profitData.totalVolume, previousMonthlyProfit.totalVolume)}
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">총 프레시백</span>
                        <div className="flex items-baseline justify-end">
                            <span className="text-sm font-bold">{profitData.totalFreshBag.toLocaleString()} 개</span>
                            {isMonthly && renderComparison(profitData.totalFreshBag, previousMonthlyProfit.totalFreshBag)}
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">일 평균 물량</span>
                        <div className="flex items-baseline justify-end">
                            <span className="text-sm font-bold">{Math.round(profitData.dailyAverageVolume)} 건</span>
                            {isMonthly && renderComparison(Math.round(profitData.dailyAverageVolume), Math.round(previousMonthlyProfit.dailyAverageVolume))}
                        </div>
                    </div>
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
                {isMonthly && (
                    <div className="flex items-center justify-center space-x-4">
                        <button onClick={() => handleMonthChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowLeft size={20} /></button>
                        <span className="font-bold text-xl">{currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월</span>
                        <button onClick={() => handleMonthChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowRight size={20} /></button>
                    </div>
                )}
                {statisticsView === 'yearly' && (
                    <div className="flex items-center justify-center space-x-4">
                        <button onClick={() => setSelectedYear(String(parseInt(selectedYear) - 1))} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowLeft size={20} /></button>
                        <span className="font-bold text-xl">{selectedYear}년 통계</span>
                        <button onClick={() => setSelectedYear(String(parseInt(selectedYear) + 1))} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowRight size={20} /></button>
                    </div>
                )}
                {statisticsView === 'cumulative' && `누적 통계`}
            </h3>
            
            {isMonthly && (<p className={`text-xs text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>집계 기간: {monthlyProfit.periodStartDate ? new Date(monthlyProfit.periodStartDate).toLocaleDateString('ko-KR') : ''} ~ {monthlyProfit.periodEndDate ? new Date(monthlyProfit.periodEndDate).toLocaleDateString('ko-KR') : ''}</p>)}
            
            <StatsCard profitData={currentProfitData} />

            {statisticsView === 'yearly' && (
                 <div className="mt-6">
                     <h3 className={`text-lg font-bold mb-3 mt-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>월별 상세 내역</h3>
                    <div className="overflow-x-auto"><table className={`min-w-full rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}><thead><tr className={`${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-600'} uppercase text-sm`}><th className="py-3 px-6 text-left">월</th><th className="py-3 px-6 text-left">순이익</th></tr></thead><tbody className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>{yearlyProfit.monthlyBreakdown.map(monthData => ( <tr key={monthData.month} className={`${isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-100'} border-b`}><td className="py-3 px-6 text-left">{monthData.month}월</td><td className="py-3 px-6 text-left">{monthData.netProfit.toLocaleString()} 원</td></tr>))}</tbody></table></div>
                </div>
            )}
        </div>
    );
}

export default StatsDisplay;