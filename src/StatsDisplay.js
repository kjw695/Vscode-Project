import React, { useState, useMemo, useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import SwipeableView from './components/common/SwipeableView';

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
    cumulativePeriod,
    setSelectedMonth,        
    setCurrentCalendarDate
}) {
    const [showRevenueDetails, setShowRevenueDetails] = useState(false);
    const [showExpensesDetails, setShowExpensesDetails] = useState(false);
    const [analysisTab, setAnalysisTab] = useState('unitPrice');

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
        expense: isKo ? "지출" : "Expense",
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
        totalDays: isKo ? "총 근무일" : "Total Days",
        totalVolume: isKo ? "총 물량" : "Total Volume",
        totalFreshbag: isKo ? "총 프레시백" : "Total Fresh Bags",
        dailyAvg: isKo ? "일 평균 물량" : "Daily Avg Vol.",
        unitPriceList: isKo ? "단가별 매출 내역" : "Revenue by Unit Price",
        roundList: isKo ? "회차별 매출 내역" : "Revenue by Round",
        swipeHint: isKo ? "💡 좌우로 밀어서 내역을 전환하세요" : "💡 Swipe to toggle view",
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

    const handlePrev = () => statisticsView === 'monthly' ? handleMonthChange(-1) : setSelectedYear(String(parseInt(selectedYear) - 1));
    const handleNext = () => statisticsView === 'monthly' ? handleMonthChange(1) : setSelectedYear(String(parseInt(selectedYear) + 1));
    const animationKey = statisticsView === 'monthly' ? currentCalendarDate.toISOString() : (statisticsView === 'yearly' ? selectedYear : 'cumulative');
    
    const StatsCard = ({ profitData }) => {
        const swipeX = useRef(0);
        const revenueRows = profitData.revenueDetails ? Object.entries(profitData.revenueDetails) : [];
        const expenseRows = profitData.expenseDetails ? Object.entries(profitData.expenseDetails) : [];

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

                <CollapsibleStatCard title={t.totalRevenue} value={profitData.totalRevenue || 0} valueColor="text-red-500" onToggle={() => toggleDetails('revenue')} showDetails={showRevenueDetails} isDarkMode={isDarkMode} t={t}>
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs font-semibold border-b border-gray-200 dark:border-gray-600 pb-1">
                            <span>{t.item}</span><span className="text-right">{t.count}</span><div className="w-28 text-right"><span>{t.revenue}</span></div>
                        </div>
                        {revenueRows.map(([name, data]) => (
                            <div key={name} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm sm:text-base">
                                <span className="whitespace-nowrap overflow-hidden text-ellipsis">{name}</span>
                                <span className="text-right">{(data.count || 0).toLocaleString()} {t.unit}</span>
                                <div className="w-28 text-right font-bold">{(data.amount || 0).toLocaleString()} 원</div>
                            </div>
                        ))}
                    </div>
                </CollapsibleStatCard>

                <CollapsibleStatCard title={t.totalExpense} value={profitData.totalExpenses || 0} valueColor="text-blue-500" onToggle={() => toggleDetails('expenses')} showDetails={showExpensesDetails} isDarkMode={isDarkMode} t={t}>
                    <div className="space-y-2">
                         <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs font-semibold border-b border-gray-200 dark:border-gray-600 pb-1">
                            <span>{t.item}</span><span className="text-right">{t.count}</span><div className="w-28 text-right"><span>{t.expense}</span></div>
                        </div>
                        {expenseRows.map(([name, data]) => (
                            <div key={name} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-sm sm:text-base">
                                <span className="whitespace-nowrap overflow-hidden text-ellipsis">{name}</span>
                                <span className="text-right">{(data.count || 0).toLocaleString()} {t.unit}</span>
                                <div className="w-28 text-right font-bold">{(data.amount || 0).toLocaleString()} 원</div>
                            </div>
                        ))}
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

                {isMonthly && (
                    <div 
                        className="mt-6 select-none"
                        onTouchStart={(e) => { e.stopPropagation(); swipeX.current = e.touches[0].clientX; }}
                        onTouchEnd={(e) => {
                            e.stopPropagation();
                            const diff = swipeX.current - e.changedTouches[0].clientX;
                            if (Math.abs(diff) > 50) setAnalysisTab(prev => prev === 'unitPrice' ? 'round' : 'unitPrice');
                        }}
                    >
                        <div className="flex justify-between items-center mb-3 px-1">
                            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                                {analysisTab === 'unitPrice' ? t.unitPriceList : t.roundList}
                            </h3>
                            <div className="flex gap-1.5 mr-1">
                                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${analysisTab === 'unitPrice' ? 'bg-purple-500 w-4' : 'bg-gray-300'}`} />
                                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${analysisTab === 'round' ? 'bg-purple-500 w-4' : 'bg-gray-300'}`} />
                            </div>
                        </div>

                        <div className={`flex p-1 rounded-xl mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setAnalysisTab('unitPrice'); }}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                                    analysisTab === 'unitPrice' 
                                    ? (isDarkMode ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-purple-600 shadow-sm') 
                                    : 'text-gray-500'
                                }`}
                            >
                                {t.unitPrice}
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setAnalysisTab('round'); }}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                                    analysisTab === 'round' 
                                    ? (isDarkMode ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-purple-600 shadow-sm') 
                                    : 'text-gray-500'
                                }`}
                            >
                                회차별
                            </button>
                        </div>

                        <div className="min-h-[150px]">
                            {analysisTab === 'unitPrice' ? (
                                <div className="space-y-3">
                                    {profitData.unitPriceAnalysis?.map((data, index) => (
                                        <div key={index} className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'}`}>
                                            <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-200 dark:border-gray-600">
                                                <span className="text-sm font-semibold">{t.unitPrice}</span>
                                                <span className="font-bold text-lg">{data.priceLabel}</span>
                                            </div>
                                            <div className="space-y-1 text-sm">
                                                {data.items.map((item, idx) => (
                                                    <div key={idx} className="grid grid-cols-[3fr_2fr_3fr] items-center gap-x-4">
                                                        <span className="font-medium">{item.name}</span>
                                                        <span className="text-right">{(item.count || 0).toLocaleString()} {t.unit}</span>
                                                        <span className="text-right font-semibold">{(item.amount || 0).toLocaleString()} 원</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200 dark:border-gray-600">
                                                <span className="font-semibold">{t.totalAmount}</span>
                                                <span className={`font-bold text-lg ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                                    {(data.totalAmount || 0).toLocaleString()}원
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {profitData.roundBreakdown && Object.entries(profitData.roundBreakdown).length > 0 ? (
                                        Object.entries(profitData.roundBreakdown)
                                            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                                            .map(([round, data]) => (
                                                <div key={round} className={`p-4 rounded-lg shadow flex justify-between items-center ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'}`}>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">ROUND</span>
                                                        <span className="font-black text-xl">{round === '0' ? '기타' : `${round}회전`}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-bold text-gray-500 mb-1">{(data.volume || 0).toLocaleString()}건</div>
                                                        <div className={`font-black text-2xl ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>
                                                            {(data.revenue || 0).toLocaleString()}원
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                    ) : (
                                        <div className="text-center py-10 text-gray-500 font-bold">회차 정보가 없습니다.</div>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-center text-[10px] text-gray-400 mt-4 italic">{t.swipeHint}</p>
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
            <SwipeableView 
                onSwipeLeft={handleNext} 
                onSwipeRight={handlePrev} 
                swipeDisabled={statisticsView === 'cumulative'} 
                animationKey={animationKey}
            >
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
                         <div className="space-y-3 pb-4">
                             {yearlyProfit.monthlyBreakdown.map(monthData => (
                                 <div 
                                     key={monthData.month} 
                                     onClick={() => {
                                        if (setSelectedMonth && setCurrentCalendarDate) {
                                            const newMonthStr = `${selectedYear}-${String(monthData.month).padStart(2, '0')}`;
                                            setSelectedMonth(newMonthStr);
                                            setCurrentCalendarDate(new Date(parseInt(selectedYear), monthData.month - 1, 1));
                                            setStatisticsView('monthly');
                                        }
                                     }}
                                     className={`p-3 sm:p-4 rounded-xl flex items-center justify-between shadow-sm border cursor-pointer transition-all active:scale-95 ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                 >
                                     <div className="w-12 sm:w-16 font-extrabold text-xl sm:text-2xl text-center flex-shrink-0">
                                         {monthData.month}<span className="text-sm sm:text-base font-medium">{t.month}</span>
                                     </div>
                                     <div className="flex-1 flex flex-col justify-center px-3 border-r border-gray-200 dark:border-gray-700 mr-3 pr-3 text-right overflow-hidden space-y-1">
                                         <span className="text-sm sm:text-base text-red-500 dark:text-red-400 font-semibold truncate">수익: {(monthData.revenue || 0).toLocaleString()}</span>
                                         <span className="text-sm sm:text-base text-blue-500 dark:text-blue-400 font-semibold truncate">지출: {(monthData.expenses || 0).toLocaleString()}</span>
                                     </div>
                                     <div className="w-24 sm:w-28 text-right flex flex-col justify-center flex-shrink-0">
                                         <span className="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">{t.profit}</span>
                                         <span className={`font-black text-[clamp(1rem,4vw,1.25rem)] tracking-tight ${monthData.netProfit >= 0 ? (isDarkMode ? 'text-yellow-300' : 'text-yellow-600') : 'text-red-500'}`}>
                                             {(monthData.netProfit || 0).toLocaleString()}
                                         </span>
                                     </div>
                                 </div>
                             ))}
                         </div>
                    </div>
                )}
            </SwipeableView> 
        </div>
    );
}

export default StatsDisplay;