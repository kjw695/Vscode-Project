import React from 'react';
import { Info, ArrowUp, ArrowDown } from 'lucide-react';

function StatsDisplay({
    statisticsView,
    selectedYear,
    currentCalendarDate,
    monthlyProfit,
    yearlyProfit,
    cumulativeProfit,
    previousMonthlyProfit, // 이전 달 데이터 추가
    isDarkMode,
    showMessage,
    monthlyStatsSubTab,
    setMonthlyStatsSubTab,
    setSelectedYear // 연도 변경을 위해 추가 (App.js에서 받아옴)
}) {
    const renderComparison = (currentValue, previousValue, isCurrency = false) => {
        if (previousValue === 0 && currentValue === 0) {
            return <span className="text-gray-500">-</span>;
        }
        if (previousValue === 0) {
            return (
                <span className="text-red-500 flex items-center text-xs sm:text-sm">
                    {currentValue.toLocaleString()} {isCurrency ? '원' : ''} <ArrowUp size={14} className="ml-1" />
                </span>
            );
        }
        const diff = currentValue - previousValue;
        const colorClass = diff > 0 ? 'text-red-500' : (diff < 0 ? 'text-blue-500' : 'text-gray-500');
        const arrow = diff > 0 ? <ArrowUp size={14} className="ml-1" /> : (diff < 0 ? <ArrowDown size={14} className="ml-1" /> : null);

        return (
            <span className={`${colorClass} flex items-center text-xs sm:text-sm`}>
                {Math.abs(diff).toLocaleString()} {isCurrency ? '원' : ''} {arrow}
            </span>
        );
    };

    const currentProfitData =
        statisticsView === 'monthly' ? monthlyProfit :
        statisticsView === 'yearly' ? yearlyProfit :
        cumulativeProfit;

    return (
        <div className={`p-6 rounded-lg shadow-md w-full max-w-4xl mb-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold text-center mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                {statisticsView === 'monthly' && `${currentCalendarDate.getFullYear()}년 ${currentCalendarDate.getMonth() + 1}월 통계`}
                {statisticsView === 'yearly' && `연간 통계 (${selectedYear}년)`}
                {statisticsView === 'cumulative' && `누적 통계`}
            </h3>

            {statisticsView === 'monthly' && (
                <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    집계 기간: {monthlyProfit.periodStartDate ? new Date(monthlyProfit.periodStartDate).toLocaleDateString('ko-KR') : ''} ~ {monthlyProfit.periodEndDate ? new Date(monthlyProfit.periodEndDate).toLocaleDateString('ko-KR') : ''}
                </p>
            )}
            {/* StatsDisplay 내부의 연도 선택 input 필드 제거됨 */}
            {/* 이전에 이 부분이 삭제되어야 한다고 안내드렸습니다. */}


            {statisticsView === 'monthly' && (
                <div className="flex justify-center mb-6 p-1 rounded-full bg-gray-200 dark:bg-gray-700">
                    <button
                        onClick={() => setMonthlyStatsSubTab('overview')}
                        className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition duration-150 ease-in-out
                            ${monthlyStatsSubTab === 'overview' ? 'bg-yellow-400 text-gray-900 shadow' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}
                        `}
                    >
                        월간 통계
                    </button>
                    <button
                        onClick={() => setMonthlyStatsSubTab('revenue')}
                        className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition duration-150 ease-in-out
                            ${monthlyStatsSubTab === 'revenue' ? 'bg-yellow-400 text-gray-900 shadow' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}
                        `}
                    >
                        매출
                    </button>
                    <button
                        onClick={() => setMonthlyStatsSubTab('expenses')}
                        className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition duration-150 ease-in-out
                            ${monthlyStatsSubTab === 'expenses' ? 'bg-yellow-400 text-gray-900 shadow' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}
                        `}
                    >
                        지출
                    </button>
                </div>
            )}

            {/* 통계 상세 내용 */}
         
            {statisticsView === 'monthly' && monthlyStatsSubTab === 'overview' && (
                <div className="space-y-6">
                    {/* 순이익 카드 */}
                    <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                        <p className={`text-sm text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>월 순이익</p>
                        <p className={`text-4xl font-extrabold text-center my-2 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>
                            {currentProfitData.netProfit.toLocaleString()} 원
                        </p>
                        <p className={`text-xs text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <span className="text-red-500">총매출 {(currentProfitData.totalDeliveryRevenue + currentProfitData.totalReturnRevenue + currentProfitData.totalFreshBagRevenue + currentProfitData.totalDeliveryInterruptionRevenue).toLocaleString()}원</span>
                            <span> - </span>
                            <span className="text-blue-500">총지출 {currentProfitData.totalExpensesSum.toLocaleString()}원</span>
                        </p>
                    </div>

                    {/* 상세 통계 리스트 카드 */}
                    <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} shadow`}>
                        <div className="space-y-4">
                            {/* 총 근무일 */}
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">총 근무일</span>
                                <div className="text-right">
                                    <span className="font-bold">{currentProfitData.totalWorkingDays.toLocaleString()} 일</span>
                                    <div className="h-4">{renderComparison(currentProfitData.totalWorkingDays, previousMonthlyProfit.totalWorkingDays)}</div>
                                </div>
                            </div>
                            {/* 총 물량 */}
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">총 물량</span>
                                <div className="text-right">
                                    <span className="font-bold">{currentProfitData.totalVolume.toLocaleString()} 건</span>
                                    <div className="h-4">{renderComparison(currentProfitData.totalVolume, previousMonthlyProfit.totalVolume)}</div>
                                </div>
                            </div>
                            {/* 총 프레시백 */}
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">총 프레시백</span>
                                <div className="text-right">
                                    <span className="font-bold">{currentProfitData.totalFreshBag.toLocaleString()} 개</span>
                                    <div className="h-4">{renderComparison(currentProfitData.totalFreshBag, previousMonthlyProfit.totalFreshBag)}</div>
                                </div>
                            </div>
                        {/* 일 평균 물량 */}
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">일 평균 물량</span>
                                <div className="text-right">
                                    <span className="font-bold">{Math.round(currentProfitData.dailyAverageVolume)} 건</span>
                                    <div className="h-4">{renderComparison(Math.round(currentProfitData.dailyAverageVolume), Math.round(previousMonthlyProfit.dailyAverageVolume))}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {statisticsView === 'monthly' && monthlyStatsSubTab === 'revenue' && (
                <div className="space-y-2 text-sm sm:text-base">
                    <p><strong>총 배송 수익:</strong> <span className="text-red-500">{currentProfitData.totalDeliveryRevenue.toLocaleString()} 원</span></p>
                    <p><strong>총 반품 수익:</strong> <span className="text-red-500">{currentProfitData.totalReturnRevenue.toLocaleString()} 원</span></p>
                    <p><strong>총 배송중단 수익:</strong> <span className="text-red-500">{currentProfitData.totalDeliveryInterruptionRevenue.toLocaleString()} 원</span></p>
                    <p><strong>총 프레시백 수익:</strong> <span className="text-red-500">{currentProfitData.totalFreshBagRevenue.toLocaleString()} 원</span></p>
                    <p className="font-bold text-lg mt-4">총 수익: <span className="text-red-500">{(currentProfitData.totalDeliveryRevenue + currentProfitData.totalReturnRevenue + currentProfitData.totalFreshBagRevenue + currentProfitData.totalDeliveryInterruptionRevenue).toLocaleString()} 원</span></p>
                </div>
            )}

            {statisticsView === 'monthly' && monthlyStatsSubTab === 'expenses' && (
                <div className="space-y-2 text-sm sm:text-base">
                    <p><strong>총 패널티 비용:</strong> <span className="text-blue-500">{currentProfitData.totalPenaltyCost.toLocaleString()} 원</span></p>
                    <p><strong>총 산재 비용:</strong> <span className="text-blue-500">{currentProfitData.totalIndustrialAccidentCost.toLocaleString()} 원</span></p>
                    <p><strong>총 유류비:</strong> <span className="text-blue-500">{currentProfitData.totalFuelCost.toLocaleString()} 원</span></p>
                    <p><strong>총 유지보수비:</strong> <span className="text-blue-500">{currentProfitData.totalMaintenanceCost.toLocaleString()} 원</span></p>
                    <p><strong>총 부가세:</strong> <span className="text-blue-500">{currentProfitData.totalVatAmount.toLocaleString()} 원</span></p>
                    <p><strong>총 종합소득세:</strong> <span className="text-blue-500">{currentProfitData.totalIncomeTaxAmount.toLocaleString()} 원</span></p>
                    <p><strong>총 세무사 비용:</strong> <span className="text-blue-500">{currentProfitData.totalTaxAccountantFee.toLocaleString()} 원</span></p>
                    <p className="font-bold text-lg mt-4">총 지출: <span className="text-blue-500">{currentProfitData.totalExpensesSum.toLocaleString()} 원</span></p>
                </div>
            )}

            {(statisticsView === 'yearly' || statisticsView === 'cumulative') && (
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    <div className={`p-4 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <p className="text-lg font-semibold mb-2">
                            총 근무일: {currentProfitData.totalWorkingDays.toLocaleString()} 일
                            <span className="ml-2 cursor-pointer" onClick={() => showMessage("해당 기간 동안 매출이 발생한 고유한 날짜의 수입니다.")}>
                                <Info size={16} className="inline-block text-blue-400" />
                            </span>
                        </p>
                        <p className="text-lg font-semibold mb-2">
                            총 물량: {currentProfitData.totalVolume.toLocaleString()} 건
                            <span className="ml-2 cursor-pointer" onClick={() => showMessage("배송 완료 수량과 반품 수량의 합계입니다. 배송 중단은 물량에 포함되지 않고 수익으로 계산됩니다.")}>
                                <Info size={16} className="inline-block text-blue-400" />
                            </span>
                        </p>
                        <p className="text-lg font-semibold mb-2">
                            총 프레시백: {currentProfitData.totalFreshBag.toLocaleString()} 개
                            <span className="ml-2 cursor-pointer" onClick={() => showMessage("해당 기간 동안 수거한 프레시백의 총 수량입니다.")}>
                                <Info size={16} className="inline-block text-blue-400" />
                            </span>
                        </p>
                        <p className="text-lg font-semibold mb-2">
                            일평균 물량: {currentProfitData.dailyAverageVolume.toFixed(2).toLocaleString()} 건
                            <span className="ml-2 cursor-pointer" onClick={() => showMessage("총 물량을 총 근무일로 나눈 값입니다.")}>
                                <Info size={16} className="inline-block text-blue-400" />
                            </span>
                        </p>
                    </div>
                    <div className={`p-4 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <p className="text-lg font-semibold">총 수익: <span className="text-red-500">{(currentProfitData.totalDeliveryRevenue + currentProfitData.totalReturnRevenue + currentProfitData.totalFreshBagRevenue + currentProfitData.totalDeliveryInterruptionRevenue).toLocaleString()} 원</span></p>
                    </div>
                    <div className={`p-4 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <p className="text-lg font-semibold">총 지출: <span className="text-blue-500">{currentProfitData.totalExpensesSum.toLocaleString()} 원</span></p>
                    </div>
                    <p className="md:col-span-2 text-lg font-semibold">
                        <strong>
                            {statisticsView === 'yearly' ? '연간 순이익:' : '누적 순이익:'}
                        </strong> {currentProfitData.netProfit.toLocaleString()} 원
                    </p>
                </div>
            )}

            {statisticsView === 'yearly' && (
                <>
                    <h3 className={`text-xl font-bold mb-4 mt-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                        월별 상세 내역 ({selectedYear}년)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className={`min-w-full rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            <thead>
                                <tr className={`${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-600'} uppercase text-sm leading-normal`}>
                                    <th className="py-3 px-6 text-left">월</th>
                                    <th className="py-3 px-6 text-left">순이익</th>
                                </tr>
                            </thead>
                            <tbody className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm font-light`}>
                                {yearlyProfit.monthlyBreakdown.map(monthData => (
                                    <tr key={monthData.month} className={`${isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-100'} border-b`}>
                                        <td className="py-3 px-6 text-left">{monthData.month}월</td>
                                        <td className="py-3 px-6 text-left">{monthData.netProfit.toLocaleString()} 원</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

export default StatsDisplay;