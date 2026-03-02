import React, { useState, useMemo } from 'react';
import { Edit, Trash2, ChevronDown, ChevronUp, AlertCircle, Clock, Calendar, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

const EntriesList = ({ entries, summary, handleEdit, handleDelete, isDarkMode, onOpenFilter, filterType }) => {
    const [expandedDate, setExpandedDate] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [collapsedMonths, setCollapsedMonths] = useState({});

    const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);
    const toggleDateExpand = (date) => setExpandedDate(expandedDate === date ? null : date);
    const toggleMonthCollapse = (month) => setCollapsedMonths(prev => ({ ...prev, [month]: !prev[month] }));

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

    // ✨ 할부 0원 문제 완벽 해결 & 똑똑한 계산 로직
    const processFinancials = (entry) => {
        const unitPrice = safeNum(entry.unitPrice);
        const delivery = safeNum(entry.deliveryCount);
        const returns = safeNum(entry.returnCount);
        const interruption = safeNum(entry.deliveryInterruptionAmount);
        const freshBag = safeNum(entry.freshBagCount);

        const legacyKeysList = ['deliveryCount', 'returnCount', 'deliveryInterruptionAmount', 'freshBagCount'];
        const overriddenKeys = {};
        if (entry.customItems && Array.isArray(entry.customItems)) {
            entry.customItems.forEach(item => {
                if (item.type === 'income' && legacyKeysList.includes(item.key)) {
                    overriddenKeys[item.key] = true;
                }
            });
        }

        let totalRevenue = 0;
        let totalExpense = 0;
        const revenueGroups = {};
        const itemCounts = {}; 

        if (delivery > 0) {
            itemCounts['배송'] = (itemCounts['배송'] || 0) + delivery;
            if (!overriddenKeys['deliveryCount']) {
                totalRevenue += unitPrice * delivery;
                if (!revenueGroups[unitPrice]) revenueGroups[unitPrice] = [];
                revenueGroups[unitPrice].push({ label: '배송', val: unitPrice * delivery, count: delivery, unit: '건' });
            }
        }
        if (returns > 0) {
            itemCounts['반품'] = (itemCounts['반품'] || 0) + returns;
            if (!overriddenKeys['returnCount']) {
                totalRevenue += unitPrice * returns;
                if (!revenueGroups[unitPrice]) revenueGroups[unitPrice] = [];
                revenueGroups[unitPrice].push({ label: '반품', val: unitPrice * returns, count: returns, unit: '건' });
            }
        }
        if (interruption > 0) {
            itemCounts['중단'] = (itemCounts['중단'] || 0) + interruption;
            if (!overriddenKeys['deliveryInterruptionAmount']) {
                totalRevenue += unitPrice * interruption;
                if (!revenueGroups[unitPrice]) revenueGroups[unitPrice] = [];
                revenueGroups[unitPrice].push({ label: '중단', val: unitPrice * interruption, count: interruption, unit: '건' });
            }
        }
        if (freshBag > 0) {
            itemCounts['프레시백'] = (itemCounts['프레시백'] || 0) + freshBag;
            if (!overriddenKeys['freshBagCount']) {
                totalRevenue += unitPrice * freshBag;
                if (!revenueGroups[unitPrice]) revenueGroups[unitPrice] = [];
                revenueGroups[unitPrice].push({ label: '프레시백', val: unitPrice * freshBag, count: freshBag, unit: '개' });
            }
        }

        const expenseDetails = [];
        const expenseTotals = {};
        let extraIncomeCount = 0;
        let extraIncomeTotalCount = 0;

        if (entry.customItems && Array.isArray(entry.customItems)) {
            entry.customItems.forEach(item => {
                const amount = safeNum(item.amount);
                const itemPrice = item.unitPrice !== undefined ? safeNum(item.unitPrice) : amount;
                const itemCount = item.count ? safeNum(item.count) : 1;
                
                // ✨ 지출일 때는 단가 무시하고 무조건 총 금액(amount) 사용! (할부 0원 버그 해결)
                const finalAmount = item.type === 'expense' 
                    ? amount 
                    : (item.unitPrice !== undefined ? (itemPrice * itemCount) : amount);

                if (item.type === 'income') {
                    totalRevenue += finalAmount;
                    if (legacyKeysList.includes(item.key)) {
                        if (!revenueGroups[itemPrice]) revenueGroups[itemPrice] = [];
                        revenueGroups[itemPrice].push({ label: item.name, val: finalAmount, count: itemCount, unit: item.key === 'freshBagCount' ? '개' : '건' });
                    } else {
                        extraIncomeCount++;
                        extraIncomeTotalCount += itemCount;
                        itemCounts[item.name] = (itemCounts[item.name] || 0) + itemCount;
                        if (!revenueGroups[itemPrice]) revenueGroups[itemPrice] = [];
                        revenueGroups[itemPrice].push({ label: item.name, val: finalAmount, count: itemCount, unit: '건' });
                    }
                } else if (item.type === 'expense') {
                    totalExpense += finalAmount;
                    expenseDetails.push({ label: item.name, val: finalAmount, count: itemCount, unit: '건', price: itemPrice });
               expenseTotals[item.name] = (expenseTotals[item.name] || 0) + finalAmount;
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
            itemCounts,
            expenseTotals
        };
    };

    // ✨ 공통으로 사용되는 개별 카드(항목) 렌더링 UI
    const renderEntryCard = ({ entry, index, stats, netProfit }) => {
        const { totalRevenue, totalExpense, revenueGroups, expenseDetails, totalVolume, extraIncomeCount, extraIncomeTotalCount } = stats;
        const inputTime = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : null;
        const currentId = entry.id || `${entry.date}-${index}`;
        
        // 지출인지 수익인지 판단해서 테두리 색상 결정
        const isExpenseCard = totalExpense > 0 && totalRevenue === 0;
        const borderClass = !isExpenseCard 
            ? (isDarkMode ? 'border-red-900/40' : 'border-red-100') 
            : (isDarkMode ? 'border-blue-900/40' : 'border-blue-100');

        return (
            <div key={currentId} className={`rounded-xl border-2 ${borderClass} shadow-sm overflow-hidden transition-all ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="p-4 cursor-pointer" onClick={() => toggleExpand(currentId)}>
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                    {entry.round ? `${entry.round}회전` : (isExpenseCard ? '지출' : '기록')}
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
                            {isExpenseCard ? (
                                <>
                                    {expenseDetails.slice(0, 2).map((item, i) => (
                                        <p key={i}>{item.label} : {item.val.toLocaleString()}원</p>
                                    ))}
                                    {expenseDetails.length > 2 && (
                                        <p className="text-gray-400">외 {expenseDetails.length - 2}건 추가 지출</p>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p>총 물량 : {totalVolume}건</p>
                                    <p>프레시백 : {safeNum(entry.freshBagCount)}개</p>
                                    {extraIncomeCount > 0 && <p>기타 수익 {extraIncomeCount}건 : {extraIncomeTotalCount}개</p>}
                                </>
                            )}
                        </div>
                        <div className="text-right">
                            <p className={`font-black text-xl ${!isExpenseCard ? 'text-red-500' : 'text-blue-500'}`}>
                                {!isExpenseCard ? `+${netProfit.toLocaleString()}` : netProfit.toLocaleString()}
                            </p>
                        </div>
                    </div>
                    
                    {entry.memo && (
                        <div className={`mt-3 p-3 rounded-lg border ${isDarkMode ? 'bg-yellow-900/20 border-yellow-800/50' : 'bg-yellow-50 border-yellow-200'}`}>
                            <span className={`text-xs font-bold block mb-1 ${isDarkMode ? 'text-yellow-500' : 'text-yellow-700'}`}>📝 메모</span>
                            <p className={`text-[13px] whitespace-pre-wrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{entry.memo}</p>
                        </div>
                    )}
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
                                        <span className="text-gray-600 dark:text-gray-400">• {item.label}</span>
                                        <span className="font-bold text-blue-500">{item.val.toLocaleString()} 원</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex justify-end pt-3 mt-3 border-t border-gray-200 dark:border-gray-600 space-x-3">
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(entry); }} className="flex items-center space-x-1 px-3 py-1.5 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-md text-gray-600 dark:text-gray-200 text-xs font-bold shadow-sm active:scale-95 transition-transform"><Edit size={14} /><span>수정</span></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }} className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-md text-red-500 text-xs font-bold shadow-sm active:scale-95 transition-transform"><Trash2 size={14} /><span>삭제</span></button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full space-y-4 pb-32">
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
                                        
                                        const dailySummary = dailyEntries.reduce((acc, curr) => {
                                            const stats = processFinancials(curr);
                                            Object.entries(stats.itemCounts).forEach(([key, count]) => {
                                                acc.totalItemCounts[key] = (acc.totalItemCounts[key] || 0) + count;
                                            });
                                            // ✨ 하루치 지출 요약 누적하기
                                            Object.entries(stats.expenseTotals || {}).forEach(([key, amount]) => {
                                                acc.totalExpenseTotals[key] = (acc.totalExpenseTotals[key] || 0) + amount;
                                            });
                                            return {
                                                revenue: acc.revenue + stats.totalRevenue,
                                                expense: acc.expense + stats.totalExpense,
                                                volume: acc.volume + stats.totalVolume,
                                                totalItemCounts: acc.totalItemCounts,
                                                totalExpenseTotals: acc.totalExpenseTotals // ✨ 누적된 지출 반환
                                            };
                                        }, { revenue: 0, expense: 0, volume: 0, totalItemCounts: {}, totalExpenseTotals: {} });

                                        const dailyNetProfit = dailySummary.revenue - dailySummary.expense;
                                        const isDateExpanded = expandedDate === date;

                                        // ✨ 핵심 분리 로직: 하루치 데이터를 '수익'과 '지출'로 나눕니다.
                                        const incomeList = [];
                                        const expenseList = [];

                                        dailyEntries.forEach((entry, index) => {
                                            const stats = processFinancials(entry);
                                            const netProfit = stats.totalRevenue - stats.totalExpense;
                                            const entryData = { entry, index, stats, netProfit };
                                            
                                            // 지출만 있는 내역은 지출 리스트로 분류
                                            if (stats.totalExpense > 0 && stats.totalRevenue === 0) {
                                                expenseList.push(entryData);
                                            } else {
                                                incomeList.push(entryData);
                                            }
                                        });

                                        return (
                                            <div key={date} className="rounded-xl overflow-hidden shadow-sm">
                                                <div 
                                                    onClick={() => toggleDateExpand(date)}
                                                    className={`cursor-pointer transition-colors border-b
                                                        ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-200 hover:bg-gray-50'} 
                                                        ${isDateExpanded ? 'border-b-transparent' : 'rounded-b-xl'}
                                                    `}
                                                >
                                                    <div className="flex items-center justify-between p-3">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                                                            <span className={`font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                                                {safeFormatDate(date)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-bold ${dailyNetProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                                {dailyNetProfit >= 0 ? '+' : ''}{dailyNetProfit.toLocaleString()}원
                                                            </span>
                                                            {isDateExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                                        </div>
                                                    </div>
<div className="px-4 pb-3 flex flex-wrap gap-2">
                                                        {Object.entries(dailySummary.totalItemCounts).length > 0 || Object.entries(dailySummary.totalExpenseTotals).length > 0 ? (
                                                            <>
                                                                {/* 수익(물량 등) 태그 */}
                                                                {Object.entries(dailySummary.totalItemCounts).map(([name, count]) => (
                                                                    <span key={name} className={`text-xs px-2.5 py-1 rounded-md font-bold border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-200 text-gray-600 shadow-sm'}`}>
                                                                        {name} <span className="text-blue-500 ml-0.5">{count}</span>
                                                                    </span>
                                                                ))}
                                                                {/* ✨ 지출 전용 파란색 요약 태그 */}
                                                                {Object.entries(dailySummary.totalExpenseTotals).map(([name, amount]) => (
                                                                    <span key={`exp-${name}`} className={`text-xs px-2.5 py-1 rounded-md font-bold border ${isDarkMode ? 'bg-blue-900/30 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'}`}>
                                                                        {name} <span className="text-blue-600 dark:text-blue-400 ml-0.5">{amount.toLocaleString()}원</span>
                                                                    </span>
                                                                ))}
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">집계된 항목이 없습니다.</span>
                                                        )}
                                                    </div>
                                                    
                                                    
                                                </div>

                                                {/* ✨ 날짜를 눌렀을 때 나타나는 [수익/지출 분리] 영역 */}
                                                {isDateExpanded && (
                                                    <div className={`border-t ${isDarkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-100 bg-gray-50/50'}`}>
                                                        <div className="p-3 space-y-5">
                                                            
                                                            {/* 수익 섹션 */}
                                                            {incomeList.length > 0 && (
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center gap-1.5 ml-1">
                                                                        <div className="w-1.5 h-4 bg-red-500 rounded-full"></div>
                                                                        <span className={`text-sm font-black ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>수익 내역</span>
                                                                        <span className="text-xs font-bold text-red-500 ml-auto bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                                                                            +{incomeList.reduce((sum, item) => sum + item.netProfit, 0).toLocaleString()}원
                                                                        </span>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        {incomeList.map(item => renderEntryCard(item))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* 수익과 지출 사이에 얇은 선 추가 (둘 다 있을 경우만) */}
                                                            {incomeList.length > 0 && expenseList.length > 0 && (
                                                                <hr className={`border-dashed ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`} />
                                                            )}

                                                            {/* 지출 섹션 */}
                                                            {expenseList.length > 0 && (
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center gap-1.5 ml-1">
                                                                        <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                                                                        <span className={`text-sm font-black ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>지출 내역</span>
                                                                        <span className="text-xs font-bold text-blue-500 ml-auto bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                                                                            {expenseList.reduce((sum, item) => sum + item.netProfit, 0).toLocaleString()}원
                                                                        </span>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        {expenseList.map(item => renderEntryCard(item))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
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