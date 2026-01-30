import React, { useState, useMemo } from 'react';
import { Edit, Trash2, ChevronDown, ChevronUp, AlertCircle, Clock } from 'lucide-react';

const EntriesList = ({ entries, summary, handleEdit, handleDelete, isDarkMode, onOpenFilter, filterType }) => {
    const [expandedId, setExpandedId] = useState(null);
    const [collapsedMonths, setCollapsedMonths] = useState({});

    const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);
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

    const processFinancials = (entry) => {
        const unitPrice = safeNum(entry.unitPrice);
        const delivery = safeNum(entry.deliveryCount);
        const returns = safeNum(entry.returnCount);
        const interruption = safeNum(entry.deliveryInterruptionAmount);
        const freshBag = safeNum(entry.freshBagCount);

        let totalRevenue = (unitPrice * delivery) + (unitPrice * returns) + (unitPrice * interruption) + (freshBag * 100);
        let totalExpense = 0;
        
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
            extraIncomeTotalCount
        };
    };

    return (
        <div className="w-full space-y-4">
            {/* ✨ 해결 2: 데이터 유무와 상관없이 상단 요약/필터는 항상 노출 */}
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
                {/* ✨ 해결 1: summary.filterLabel이 있으면 최우선으로 보여줌 */}
                <button onClick={onOpenFilter} className="flex items-center text-xs font-semibold text-gray-500">
                    현재 기간: {summary?.filterLabel || (filterType === 'income' ? '수익' : filterType === 'expense' ? '지출' : '전체')}<ChevronDown size={14} className="ml-1" />
                </button>
            </div>

            {/* ✨ 해결 2: 데이터가 없을 때의 화면 처리 위치 변경 */}
            {(!entries || entries.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <AlertCircle size={48} className={`mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>저장된 데이터가 없습니다.</p>
                </div>
            ) : (
                sortedMonths.map(month => (
                    <div key={month} className="mb-4">
                        <div className="flex items-center justify-between mb-2 pl-2 cursor-pointer" onClick={() => toggleMonthCollapse(month)}>
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {month === 'Unknown' ? "날짜 확인 필요" : `${month.split('-')[0]}년 ${parseInt(month.split('-')[1])}월`}
                            </h2>
                            {collapsedMonths[month] ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                        </div>

                        {!collapsedMonths[month] && (
                            <div className="space-y-3">
                                {groupedEntries[month].map((entry, index) => {
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
                                                        <span className="font-bold text-base dark:text-gray-100">{safeFormatDate(entry.date)}</span>
                                                        {inputTime && <span className="text-[11px] text-gray-400 flex items-center mt-1"><Clock size={12} className="mr-1"/>{inputTime} 기록됨</span>}
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
                                                        
                                                        {/* 🔥 [추가] 메모가 있으면 보여주는 코드 */}
                                                        {entry.memo && (
                                                            <div className={`text-xs mt-2 pt-1 border-t flex items-start gap-1 ${isDarkMode ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                                                                <span className="opacity-70">└</span>
                                                                <span className="line-clamp-1">{entry.memo}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        
                                                        {/* ✨ 해결 3: 글자 크기를 2xl에서 xl로 한 단계 낮춤 */}
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
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

export default EntriesList;