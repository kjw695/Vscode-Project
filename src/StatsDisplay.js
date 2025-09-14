import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Info } from 'lucide-react';

// 재사용 가능한 통계 카드 컴포넌트들
const CollapsibleStatCard = ({ title, value, valueColor, onToggle, showDetails, children, isDarkMode }) => (
    <div className={`px-6 py-4 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'} shadow`}>
        <div className="flex justify-between items-center gap-2 overflow-hidden">
            <span className="font-semibold text-[clamp(1rem,4vw,1.25rem)] flex-shrink-0">{title}</span>
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <span className={`font-bold ${valueColor} text-[clamp(1rem,4.5vw,1.75rem)] whitespace-nowrap text-right w-full overflow-hidden`}>{value.toLocaleString()}</span>
                <button onClick={onToggle} className="flex-shrink-0 px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700">상세</button>
            </div>
        </div>
        {showDetails && (<div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2 text-sm sm:text-base">{children}</div>)}
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

function StatsDisplay({ statisticsView, setStatisticsView, selectedYear, setSelectedYear, currentCalendarDate, handleMonthChange, monthlyProfit, yearlyProfit, cumulativeProfit, previousMonthlyProfit, isDarkMode, yearlyPeriod, cumulativePeriod }) {
    const [showRevenueDetails, setShowRevenueDetails] = useState(false);
    const [showExpensesDetails, setShowExpensesDetails] = useState(false);

    if (!monthlyProfit || !yearlyProfit || !cumulativeProfit || !previousMonthlyProfit) {
        return (<div className="flex items-center justify-center h-64"><p>통계 데이터를 불러오는 중입니다...</p></div>);
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
        const revenue = (profitData.totalDeliveryRevenue || 0) + (profitData.totalReturnRevenue || 0) + (profitData.totalFreshBagRevenue || 0) + (profitData.totalDeliveryInterruptionRevenue || 0);
        const expenses = profitData.totalExpensesSum || 0;

        return (
            <div className="space-y-3">
                <div className={`px-6 py-4 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'} shadow`}>
                    <p className={`text-base text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{isMonthly ? '월 순이익' : statisticsView === 'yearly' ? '연간 순이익' : '누적 순이익'}</p>
                    <div className={`text-center font-extrabold my-1 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}><span className="block text-[clamp(1.75rem,6vw,2.75rem)]">{(profitData.netProfit || 0).toLocaleString()}</span></div>
                </div>

                <CollapsibleStatCard
                    title="총 매출"
                    value={revenue}
                    valueColor="text-red-500"
                    onToggle={() => toggleDetails('revenue')}
                    showDetails={showRevenueDetails}
                    isDarkMode={isDarkMode}
                >
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs font-semibold border-b border-gray-200 dark:border-gray-600 pb-1">
                            <span>항목</span>
                            <span className="text-right">건수</span>
                            <div className="w-28 text-right"><span>수익</span></div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm sm:text-base">
                            <span className="whitespace-nowrap">배송</span>
                            <span className="text-right whitespace-nowrap">{(profitData.totalDeliveryCount || 0).toLocaleString()} 건</span>
                            <div className="w-28 text-right"><span className="font-bold whitespace-nowrap">{(profitData.totalDeliveryRevenue || 0).toLocaleString()} 원</span></div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm sm:text-base">
                            <span className="whitespace-nowrap">반품</span>
                            <span className="text-right whitespace-nowrap">{(profitData.totalReturnCount || 0).toLocaleString()} 건</span>
                            <div className="w-28 text-right"><span className="font-bold whitespace-nowrap">{(profitData.totalReturnRevenue || 0).toLocaleString()} 원</span></div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm sm:text-base">
                            <span className="whitespace-nowrap">중단</span>
                            <span className="text-right whitespace-nowrap">{(profitData.totalInterruptionCount || 0).toLocaleString()} 건</span>
                            <div className="w-28 text-right"><span className="font-bold whitespace-nowrap">{(profitData.totalDeliveryInterruptionRevenue || 0).toLocaleString()} 원</span></div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm sm:text-base">
                            <span className="whitespace-nowrap">프레시백</span>
                            <span className="text-right whitespace-nowrap">{(profitData.totalFreshBag || 0).toLocaleString()} 개</span>
                            <div className="w-28 text-right"><span className="font-bold whitespace-nowrap">{(profitData.totalFreshBagRevenue || 0).toLocaleString()} 원</span></div>
                        </div>
                    </div>
                </CollapsibleStatCard>

                <CollapsibleStatCard
                    title="총 지출"
                    value={expenses}
                    valueColor="text-blue-500"
                    onToggle={() => toggleDetails('expenses')}
                    showDetails={showExpensesDetails}
                    isDarkMode={isDarkMode}
                >
                    <p><strong>패널티 비용:</strong> {(profitData.totalPenaltyCost || 0).toLocaleString()}</p>
                    <p><strong>산재 비용:</strong> {(profitData.totalIndustrialAccidentCost || 0).toLocaleString()}</p>
                    <p><strong>유류비:</strong> {(profitData.totalFuelCost || 0).toLocaleString()}</p>
                    <p><strong>유지보수비:</strong> {(profitData.totalMaintenanceCost || 0).toLocaleString()}</p>
                    <p><strong>부가세:</strong> {(profitData.totalVatAmount || 0).toLocaleString()}</p>
                    <p><strong>종합소득세:</strong> {(profitData.totalIncomeTaxAmount || 0).toLocaleString()}</p>
                    <p><strong>세무사 비용:</strong> {(profitData.totalTaxAccountantFee || 0).toLocaleString()}</p>
                </CollapsibleStatCard>

                <div className={`px-6 py-4 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'} shadow`}>
                    <div className="space-y-3">
                        {isMonthly ? (
                            <>
                                <DetailRow label="총 근무일" value={`${(profitData.totalWorkingDays || 0).toLocaleString()} 일`} comparison={renderComparison(profitData.totalWorkingDays, previousMonthlyProfit.totalWorkingDays)} />
                                <DetailRow label="총 물량" value={`${(profitData.totalVolume || 0).toLocaleString()} 건`} comparison={renderComparison(profitData.totalVolume, previousMonthlyProfit.totalVolume)} />
                                <DetailRow label="총 프레시백" value={`${(profitData.totalFreshBag || 0).toLocaleString()} 개`} comparison={renderComparison(profitData.totalFreshBag, previousMonthlyProfit.totalFreshBag)} />
                                <DetailRow label="일 평균 물량" value={`${Math.round(profitData.dailyAverageVolume || 0)} 건`} comparison={renderComparison(Math.round(profitData.dailyAverageVolume || 0), Math.round(previousMonthlyProfit.dailyAverageVolume || 0))} />
                            </>
                        ) : (
                            <>
                                <SimpleDetailRow label="총 근무일" value={`${(profitData.totalWorkingDays || 0).toLocaleString()} 일`} />
                                <SimpleDetailRow label="총 물량" value={`${(profitData.totalVolume || 0).toLocaleString()} 건`} />
                                <SimpleDetailRow label="총 프레시백" value={`${(profitData.totalFreshBag || 0).toLocaleString()} 개`} />
                                <SimpleDetailRow label="일 평균 물량" value={`${Math.round(profitData.dailyAverageVolume || 0)} 건`} />
                            </>
                        )}
                    </div>
                </div>

                {statisticsView === 'monthly' && monthlyProfit.unitPriceBreakdown && Object.keys(monthlyProfit.unitPriceBreakdown).length > 0 && (
    <div className="mt-4">
        {/* 1. 제목 색상을 연보라색으로 변경 */}
        <h3 className={`text-lg font-bold mb-3 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
            단가별 매출 내역
        </h3>
        <div className="space-y-3">
            {Object.entries(monthlyProfit.unitPriceBreakdown)
                .sort(([priceA], [priceB]) => priceB - priceA)
                .map(([unitPrice, data]) => (
                    <div key={unitPrice} className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'}`}>
                        {/* 카드 헤더: 단가 */}
                        <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-200 dark:border-gray-600">
                            <span className="text-sm font-semibold">단가</span>
                            <span className="font-bold text-lg">{Number(unitPrice).toLocaleString()}원</span>
                        </div>
                        
                        {/* 2. 배송/반품/중단 행의 구조를 통일하여 틀 깨짐 해결 */}
                        <div className="space-y-1 text-sm">
        <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-4">
            <span className="font-medium">배송</span>
            <span className="text-right">{(data.deliveryCount || 0).toLocaleString()} 건</span>
            <span className="text-right font-semibold">{(data.deliveryRevenue || 0).toLocaleString()} 원</span>
        </div>
        <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-4">
            <span className="font-medium">반품</span>
            <span className="text-right">{(data.returnCount || 0).toLocaleString()} 건</span>
            <span className="text-right font-semibold">{(data.returnRevenue || 0).toLocaleString()} 원</span>
        </div>
        <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-4">
            <span className="font-medium">중단</span>
            <span className="text-right">{(data.interruptionCount || 0).toLocaleString()} 건</span>
            <span className="text-right font-semibold">{(data.interruptionRevenue || 0).toLocaleString()} 원</span>
        </div>
    </div>

                        {/* 카드 푸터: 총 금액 */}
                        <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200 dark:border-gray-600">
                            <span className="font-semibold">총 금액</span>
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
                <button onClick={() => setStatisticsView('monthly')} className={`py-2 px-4 font-semibold ${statisticsView === 'monthly' ? (isDarkMode ? 'border-yellow-400 text-yellow-400' : 'border-yellow-500 text-yellow-600') : (isDarkMode ? 'border-transparent text-gray-300' : 'border-transparent text-gray-500')} border-b-2`}>월간</button>
                <button onClick={() => setStatisticsView('yearly')} className={`py-2 px-4 font-semibold ${statisticsView === 'yearly' ? (isDarkMode ? 'border-yellow-400 text-yellow-400' : 'border-yellow-500 text-yellow-600') : (isDarkMode ? 'border-transparent text-gray-300' : 'border-transparent text-gray-500')} border-b-2`}>연간</button>
                <button onClick={() => setStatisticsView('cumulative')} className={`py-2 px-4 font-semibold ${statisticsView === 'cumulative' ? (isDarkMode ? 'border-yellow-400 text-yellow-400' : 'border-yellow-500 text-yellow-600') : (isDarkMode ? 'border-transparent text-gray-300' : 'border-transparent text-gray-500')} border-b-2`}>누적</button>
            </div>
            <h3 className={`text-xl sm:text-2xl font-bold text-center mb-1 ${isDarkMode ? 'text-gray-200' : 'text-black'}`}>
                {isMonthly && ( <div className="flex items-center justify-center space-x-2 sm:space-x-4"><button onClick={() => handleMonthChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowLeft size={20} /></button><span className="font-bold text-xl sm:text-2xl">{currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월</span><button onClick={() => handleMonthChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowRight size={20} /></button></div>)}
                {statisticsView === 'yearly' && ( <div className="flex items-center justify-center space-x-2 sm:space-x-4"><button onClick={() => setSelectedYear(String(parseInt(selectedYear) - 1))} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowLeft size={20} /></button><span className="font-bold text-xl sm:text-2xl">{selectedYear}년 통계</span><button onClick={() => setSelectedYear(String(parseInt(selectedYear) + 1))} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ArrowRight size={20} /></button></div>)}
                {statisticsView === 'cumulative' && `누적 통계`}
            </h3>
            {statisticsView === 'monthly' && monthlyProfit.periodStartDate && ( <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>집계 기간: {new Date(monthlyProfit.periodStartDate).toLocaleDateString('ko-KR')} ~ {new Date(monthlyProfit.periodEndDate).toLocaleDateString('ko-KR')}</p>)}
            {statisticsView === 'yearly' && yearlyPeriod && ( <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>집계 기간: {yearlyPeriod.startDate} ~ {yearlyPeriod.endDate}</p>)}
            {statisticsView === 'cumulative' && cumulativePeriod && ( <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>집계 기간: {cumulativePeriod.startDate} ~ {cumulativePeriod.endDate}</p>)}
            
            <StatsCard profitData={currentProfitData} />

            {statisticsView === 'yearly' && (
                <div className="mt-6">
                     <h3 className={`text-lg font-bold mb-3 mt-6 ${isDarkMode ? 'text-gray-200' : 'text-black'}`}>월별 상세 내역</h3>
                     <div className="overflow-x-auto"><table className={`min-w-full rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}><thead><tr className={`${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-600'} uppercase text-sm`}><th className="py-3 px-6 text-left">월</th><th className="py-3 px-6 text-left">순이익</th></tr></thead><tbody className={`${isDarkMode ? 'text-gray-200' : 'text-black'} text-sm`}>{yearlyProfit.monthlyBreakdown.map(monthData => ( <tr key={monthData.month} className={`${isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-100'} border-b`}><td className="py-3 px-6 text-left">{monthData.month}월</td><td className="py-3 px-6 text-left">{monthData.netProfit.toLocaleString()}</td></tr>))}</tbody></table></div>
                </div>
            )}
        </div>
    );
}

export default StatsDisplay;