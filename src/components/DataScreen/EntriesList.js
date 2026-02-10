import React, { useState, useMemo } from 'react';
import { Edit, Trash2, ChevronDown, ChevronUp, AlertCircle, Clock, Calendar, Package } from 'lucide-react';

const EntriesList = ({ entries, summary, handleEdit, handleDelete, isDarkMode, onOpenFilter, filterType }) => {
    // 날짜별 펼침 상태 관리
    const [expandedDate, setExpandedDate] = useState(null);
    // 개별 항목(회차) 펼침 상태 관리
    const [expandedId, setExpandedId] = useState(null);
    const [collapsedMonths, setCollapsedMonths] = useState({});

    const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);
    const toggleDateExpand = (date) => setExpandedDate(expandedDate === date ? null : date);
    const toggleMonthCollapse = (month) => setCollapsedMonths(prev => ({ ...prev, [month]: !prev[month] }));

    // 1. 월별 그룹화
    const groupedEntries = useMemo(() => {
        if (!entries || !Array.isArray(entries)) return {};
        return entries.reduce((acc, entry) => {
            if (!entry || !entry.date) return acc;
            const d = new Date(entry.date);
            const key = isNaN(d.getTime()) ? 'Unknown' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(entry);
            return acc;
        }, {});
    }, [entries]);

    const sortedMonths = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

    const safeNum = (val) => {
        if (!val) return 0;
        const num = Number(String(val).replace(/,/g, '').trim());
        return isNaN(num) ? 0 : num;
    };

    const safeFormatDate = (dateStr) => {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? String(dateStr) : date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    };

    // 금융 데이터 계산 함수
    const processFinancials = (entry) => {
        const unitPrice = safeNum(entry.unitPrice);
        const delivery = safeNum(entry.deliveryCount);
        const returns = safeNum(entry.returnCount);
        const interruption = safeNum(entry.deliveryInterruptionAmount);
        const freshBag = safeNum(entry.freshBagCount);

        let totalRevenue = (unitPrice * delivery) + (unitPrice * returns) + (unitPrice * interruption) + (freshBag * 100);
        let totalExpense = 0;
        
        // 항목별 개수 집계용 객체
        const itemCounts = {}; 

        // 1. 기본 항목 집계
        if (delivery > 0) itemCounts['배송'] = (itemCounts['배송'] || 0) + delivery;
        if (returns > 0) itemCounts['반품'] = (itemCounts['반품'] || 0) + returns;
        if (interruption > 0) itemCounts['중단'] = (itemCounts['중단'] || 0) + interruption;
        if (freshBag > 0) itemCounts['프레시백'] = (itemCounts['프레시백'] || 0) + freshBag;

        const revenueGroups = {};
        if (unitPrice > 0) {
            const commonSum = (unitPrice * delivery) + (unitPrice * returns) + (unitPrice * interruption);
            if (commonSum > 0) {
                revenueGroups[unitPrice] = [
                    { label: '배송', val: unitPrice * delivery, count: delivery, unit: '건' },
                    { label: '반품', val: unitPrice * returns, count: returns, unit: '건' },
                    { label: '중단', val: unitPrice * interruption, count: interruption, unit: '건' }
                ].filter(d => d.val > 0);
            }
        }

        if (freshBag > 0) {
            if (!revenueGroups[100]) revenueGroups[100] = [];
            revenueGroups[100].push({ label: '프레시백', val: freshBag * 100, count: freshBag, unit: '개' });
        }

        const expenseDetails = [];
        let extraIncomeCount = 0;
        let extraIncomeTotalCount = 0;

        if (entry.customItems && Array.isArray(entry.customItems)) {
            entry.customItems.forEach(item => {
                const amount = safeNum(item.amount);
                const itemPrice = item.unitPrice ? safeNum(item.unitPrice) : amount;
                const itemCount = item.count ? safeNum(item.count) : 1;
                const finalAmount = item.unitPrice ? (itemPrice * itemCount) : amount;

                if (item.type === 'income') {
                    totalRevenue += finalAmount;
                    extraIncomeCount++;
                    extraIncomeTotalCount += itemCount;
                    
                    // 2. 추가 수입 항목 집계
                    itemCounts[item.name] = (itemCounts[item.name] || 0) + itemCount;

                    if (!revenueGroups[itemPrice]) revenueGroups[itemPrice] = [];
                    revenueGroups[itemPrice].push({ label: item.name, val: finalAmount, count: item.count, unit: '건' });
                } else if (item.type === 'expense') {
                    totalExpense += finalAmount;
                    expenseDetails.push({ label: item.name, val: finalAmount, count: item.count, unit: '건', price: itemPrice });
                }
            });
        }

        return { 
            totalRevenue, 
            totalExpense, 
            revenueGroups,
            expenseDetails: expenseDetails.filter(d => Number(d.val) !== 0),
            totalVolume: delivery + returns + interruption,
            extraIncomeCount,
            extraIncomeTotalCount,
            itemCounts // [추가] 항목별 개수 리턴
        };
    };

    return (
        <div className="w-full space-y-4">
            {summary && (
                <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center py-1">
                        <span className="font-bold text-lg dark:text-gray-200">총 수익</span>
                        <span className="font-bold text-red-500 text-lg">{safeNum(summary.totalRevenue).toLocaleString()}원</span>
                    </div>
                    <hr className="border-gray-200 dark:border-gray-700 my-1"/>
                    <div className="flex justify-between items-center py-1">
                        <span className="font-bold text-lg dark:text-gray-200">총 지출</span>
                        <span className="font-bold text-blue-500 text-lg">{safeNum(summary.totalExpenses).toLocaleString()}원</span>
                    </div>
                </div>
            )}
            
            <div className="flex justify-end px-1">
                <button onClick={onOpenFilter} className="flex items-center text-xs font-semibold text-gray-500">
                    현재 기간: {summary?.filterLabel || (filterType === 'income' ? '수익' : filterType === 'expense' ? '지출' : '전체')}<ChevronDown size={14} className="ml-1" />
                </button>
            </div>

            {(!entries || entries.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <AlertCircle size={48} className={`mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>저장된 데이터가 없습니다.</p>
                </div>
            ) : (
                sortedMonths.map(month => {
                    const monthEntries = groupedEntries[month];
                    const entriesByDate = monthEntries.reduce((acc, entry) => {
                        const dateKey = entry.date;
                        if (!acc[dateKey]) acc[dateKey] = [];
                        acc[dateKey].push(entry);
                        return acc;
                    }, {});

                    const sortedDates = Object.keys(entriesByDate).sort((a, b) => b.localeCompare(a));

                    return (
                        <div key={month} className="mb-4">
                            <div className="flex items-center justify-between mb-2 pl-2 cursor-pointer" onClick={() => toggleMonthCollapse(month)}>
                                <h2 className={`text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {month === 'Unknown' ? "날짜 확인 필요" : `${month.split('-')[0]}년 ${parseInt(month.split('-')[1])}월`}
                                </h2>
                                {collapsedMonths[month] ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                            </div>

                            {!collapsedMonths[month] && (
                                <div className="space-y-3">
                                    {sortedDates.map(date => {
                                        const dailyEntries = entriesByDate[date];
                                        
                                        // 하루 총합 및 항목별 개수 합산 계산
                                        const dailySummary = dailyEntries.reduce((acc, curr) => {
                                            const stats = processFinancials(curr);
                                            
                                            // 항목별 개수 누적
                                            Object.entries(stats.itemCounts).forEach(([key, count]) => {
                                                acc.totalItemCounts[key] = (acc.totalItemCounts[key] || 0) + count;
                                            });

                                            return {
                                                revenue: acc.revenue + stats.totalRevenue,
                                                expense: acc.expense + stats.totalExpense,
                                                volume: acc.volume + stats.totalVolume,
                                                totalItemCounts: acc.totalItemCounts
                                            };
                                        }, { revenue: 0, expense: 0, volume: 0, totalItemCounts: {} });

                                        const dailyNetProfit = dailySummary.revenue - dailySummary.expense;
                                        const isDateExpanded = expandedDate === date;

                                        return (
                                            <div key={date} className="rounded-xl overflow-hidden">
                                                {/* 일자별 헤더 */}
                                                <div 
                                                    onClick={() => toggleDateExpand(date)}
                                                    className={`flex items-center justify-between p-3 cursor-pointer border-b transition-colors 
                                                        ${isDarkMode 
                                                            ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' 
                                                            : 'bg-white border-gray-200 hover:bg-gray-50'
                                                        } 
                                                        ${isDateExpanded ? 'border-b-transparent' : 'rounded-b-xl shadow-sm'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                                                        <span className={`font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                                            {safeFormatDate(date)}
                                                        </span>
                                                        
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold ${dailySummary.revenue - dailySummary.expense >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                            {dailyNetProfit >= 0 ? '+' : ''}{dailyNetProfit.toLocaleString()}원
                                                        </span>
                                                        {isDateExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                                    </div>
                                                </div>

                                                {/* 날짜 펼침 영역 */}
                                                {isDateExpanded && (
                                                    <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                                        
                                                        {/* ✨ [추가된 부분] 항목별 총 개수 요약 바 */}
                                                        <div className={`px-4 py-3 flex flex-wrap gap-2 ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                                                            {Object.entries(dailySummary.totalItemCounts).length > 0 ? (
                                                                Object.entries(dailySummary.totalItemCounts).map(([name, count]) => (
                                                                    <span key={name} className={`text-xs px-2.5 py-1 rounded-md font-bold border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-200 text-gray-600 shadow-sm'}`}>
                                                                        {name} <span className="text-blue-500 ml-0.5">{count}</span>
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-xs text-gray-400">집계된 항목이 없습니다.</span>
                                                            )}
                                                        </div>

                                                        {/* 기존 리스트 (1회전, 2회전...) */}
                                                        <div className={`space-y-3 p-2 pt-0 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                                                            {dailyEntries.map((entry, index) => {
                                                                const { totalRevenue, totalExpense, revenueGroups, expenseDetails, totalVolume, extraIncomeCount, extraIncomeTotalCount } = processFinancials(entry);
                                                                const netProfit = totalRevenue - totalExpense;
                                                                const inputTime = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : null;
                                                                const currentId = entry.id || `${entry.date}-${index}`;
                                                                
                                                                const borderClass = netProfit >= 0 
                                                                    ? (isDarkMode ? 'border-red-900/40' : 'border-red-100') 
                                                                    : (isDarkMode ? 'border-blue-900/40' : 'border-blue-100');

                                                                return (
                                                                    <div key={currentId} className={`rounded-xl border-2 ${borderClass} shadow-sm overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                                                        <div className="p-4 cursor-pointer" onClick={() => toggleExpand(currentId)}>
                                                                            <div className="flex justify-between items-start mb-3">
                                                                                <div className="flex flex-col">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                                                                            {entry.round ? `${entry.round}회전` : '기록'}
                                                                                        </span>
                                                                                        {inputTime && <span className="text-[11px] text-gray-400 flex items-center"><Clock size={12} className="mr-1"/>{inputTime}</span>}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-xs text-gray-400 flex items-center bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                                                                                    {expandedId === currentId ? '닫기' : '상세'} {expandedId === currentId ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex justify-between items-center">
                                                                                <div className={`text-[14px] leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                                    {totalRevenue === 0 && totalExpense > 0 ? (
                                                                                        <>
                                                                                            {expenseDetails.slice(0, 2).map((item, i) => (
                                                                                                <p key={i}>{item.label} : {item.val.toLocaleString()}원</p>
                                                                                            ))}
                                                                                            {expenseDetails.length > 2 && (
                                                                                                <p>기타 지출 {expenseDetails.length - 2}건 : {(totalExpense - expenseDetails.slice(0, 2).reduce((s, i) => s + i.val, 0)).toLocaleString()}원</p>
                                                                                            )}
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <p>총 물량 : {totalVolume}건</p>
                                                                                            <p>프레시백 : {safeNum(entry.freshBagCount)}개</p>
                                                                                            {extraIncomeCount > 0 && (
                                                                                                <p>기타 수익 {extraIncomeCount}건 : {extraIncomeTotalCount}개</p>
                                                                                            )}
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <p className={`font-black text-xl ${netProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                                                        {netProfit >= 0 ? `+${netProfit.toLocaleString()}` : netProfit.toLocaleString()}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {expandedId === currentId && (
                                                                            <div className={`mx-3 mb-3 p-4 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} text-sm space-y-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                                                                {totalRevenue > 0 && (
                                                                                    <div>
                                                                                        <h5 className="font-bold text-red-500 border-b border-red-200 dark:border-red-800 pb-1 mb-2 text-xs uppercase tracking-wider">수익 상세 내역</h5>
                                                                                        {Object.entries(revenueGroups).sort((a,b) => b[0] - a[0]).map(([price, items]) => {
                                                                                            const groupSum = items.reduce((s, item) => s + item.val, 0);
                                                                                            return (
                                                                                                <div key={price} className="mb-4 last:mb-0">
                                                                                                    <div className="flex justify-between items-center bg-red-100/50 dark:bg-red-900/30 p-2 rounded-md mb-2">
                                                                                                        <span className="font-bold text-xs text-red-700 dark:text-red-300">적용단가 : {Number(price).toLocaleString()}원</span>
                                                                                                        <span className="font-bold text-red-700 dark:text-red-300">{groupSum.toLocaleString()}원</span>
                                                                                                    </div>
                                                                                                    <div className="pl-2 space-y-1.5">
                                                                                                        {items.map((item, i) => (
                                                                                                            <div key={i} className="flex justify-between text-[12px] text-gray-600 dark:text-gray-400">
                                                                                                                <span>• {item.label} ({item.count}{item.unit})</span>
                                                                                                                <span className="font-medium">{item.val.toLocaleString()}원</span>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                                
                                                                                {totalExpense > 0 && (
                                                                                    <div>
                                                                                        <h5 className="font-bold text-blue-500 border-b border-blue-200 dark:border-blue-800 pb-1 mb-2 text-xs uppercase tracking-wider">지출 상세 내역</h5>
                                                                                        {expenseDetails.map((item, i) => (
                                                                                            <div key={i} className="flex justify-between py-1.5 text-[12px]">
                                                                                                <span className="text-gray-600 dark:text-gray-400">• {item.label} ({item.count}{item.unit})</span>
                                                                                                <span className="font-bold text-blue-500">{item.val.toLocaleString()} 원</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                                
                                                                                <div className="flex justify-end pt-3 border-t border-gray-200 dark:border-gray-600 space-x-3">
                                                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(entry); }} className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-md text-gray-600 dark:text-gray-200 text-xs font-bold shadow-sm active:scale-95 transition-transform"><Edit size={14} /><span>수정</span></button>
                                                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }} className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-md text-red-500 text-xs font-bold shadow-sm active:scale-95 transition-transform"><Trash2 size={14} /><span>삭제</span></button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default EntriesList;