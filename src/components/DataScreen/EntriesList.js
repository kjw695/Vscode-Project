import React, { useState, useMemo } from 'react';
import { Edit, Trash2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

const EntriesList = ({ entries, summary, handleEdit, handleDelete, isDarkMode, onOpenFilter, filterType }) => {
    const [expandedId, setExpandedId] = useState(null);
    const [collapsedMonths, setCollapsedMonths] = useState({});

    const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);
    const toggleMonthCollapse = (month) => setCollapsedMonths(prev => ({ ...prev, [month]: !prev[month] }));

    // 1. 데이터 그룹화 (안전장치 포함)
    const groupedEntries = useMemo(() => {
        if (!entries || !Array.isArray(entries)) return {};
        return entries.reduce((acc, entry) => {
            if (!entry || !entry.date) return acc;
            try {
                const dateStr = String(entry.date);
                const month = dateStr.length >= 7 ? dateStr.slice(0, 7) : 'Unknown';
                if (!acc[month]) acc[month] = [];
                acc[month].push(entry);
            } catch { /* 무시 */ }
            return acc;
        }, {});
    }, [entries]);

    const sortedMonths = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

    // 헬퍼 함수
    const safeFormatDate = (dateStr) => {
        try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? String(dateStr) : date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
        } catch { return String(dateStr); }
    };
    const safeNum = (val) => {
        const num = Number(String(val).replace(/,/g, '').trim());
        return isNaN(num) ? 0 : num;
    };

    // ✨ [핵심] 동적 지출 항목 자동 계산기
    // 사용자가 '식대'를 추가했든 '비품'을 추가했든, 여기서 알아서 찾아서 계산합니다.
    const calculateDynamicExpenses = (entry) => {
        // 수익 관련 필드와 기본 필드는 제외하고 나머지를 '지출'로 간주
        const excludeKeys = ['id', 'date', 'timestamp', 'unitPrice', 'deliveryCount', 'returnCount', 'deliveryInterruptionAmount', 'freshBagCount'];
        
        let total = 0;
        const details = [];

        Object.keys(entry).forEach(key => {
            if (!excludeKeys.includes(key)) {
                const val = safeNum(entry[key]);
                if (val > 0) { // 0보다 큰 값만 지출로 집계
                    total += val;
                    // key(변수명)를 한글 라벨로 변환하여 보여주기
                    let label = key;
                    if (key === 'penaltyAmount') label = '패널티';
                    else if (key === 'industrialAccidentCost') label = '산재';
                    else if (key === 'fuelCost') label = '유류비';
                    else if (key === 'maintenanceCost') label = '유지보수비';
                    else if (key === 'vatAmount') label = '부가세';
                    else if (key === 'incomeTaxAmount') label = '종합소득세';
                    else if (key === 'taxAccountantFee') label = '세무사 비용';
                    
                    details.push({ label, amount: val });
                }
            }
        });
        return { total, details };
    };

    if (!entries || entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <AlertCircle size={48} className={`mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>저장된 데이터가 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            {/* 요약 카드 */}
            {summary && (
                <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    {(summary.totalRevenue || 0) > 0 && (
                        <div className="flex justify-between items-center py-1">
                            <span className="font-bold text-lg text-black dark:text-gray-200">수익</span>
                            <span className="font-bold text-red-500 text-lg">{safeNum(summary.totalRevenue).toLocaleString()}원</span>
                        </div>
                    )}
                    {(summary.totalRevenue || 0) > 0 && (summary.totalExpenses || 0) > 0 && <hr className="border-gray-200 dark:border-gray-700 my-1"/>}
                    {(summary.totalExpenses || 0) > 0 && (
                        <div className="flex justify-between items-center py-1">
                            <span className="font-bold text-lg text-black dark:text-gray-200">지출</span>
                            <span className="font-bold text-blue-500 text-lg">{safeNum(summary.totalExpenses).toLocaleString()}원</span>
                        </div>
                    )}
                </div>
            )}
            
            <div className="flex justify-end items-center">
                <button onClick={onOpenFilter} className={`flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    현재 기간: {summary?.filterLabel || '전체'}<ChevronDown size={16} className="ml-2" />
                </button>
            </div>

            {sortedMonths.map(month => {
                const displayMonth = month === 'Unknown' ? "날짜 확인 필요" : `${parseInt(month.split('-')[0])}년 ${parseInt(month.split('-')[1])}월`;
                const isCollapsed = collapsedMonths[month];

                return (
                    <div key={month}>
                        <div className="flex items-center justify-between mb-2 pl-2 cursor-pointer" onClick={() => toggleMonthCollapse(month)}>
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{displayMonth}</h2>
                            {isCollapsed ? <ChevronDown size={20} className="text-gray-500 dark:text-gray-400" /> : <ChevronUp size={20} className="text-gray-500 dark:text-gray-400" />}
                        </div>

                        {!isCollapsed && (
                            <div className={`rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
                                {groupedEntries[month].map((entry, index) => {
                                    // 수익 계산
                                    const unitPrice = safeNum(entry.unitPrice);
                                    const dailyRevenue = (unitPrice * safeNum(entry.deliveryCount)) + (unitPrice * safeNum(entry.returnCount)) + (unitPrice * safeNum(entry.deliveryInterruptionAmount)) + (safeNum(entry.freshBagCount) * 100);
                                    
                                    // ✨ 동적 지출 계산 (여기가 핵심 변경 사항)
                                    const { total: dailyExpenses, details: expenseDetails } = calculateDynamicExpenses(entry);
                                    
                                    // 순수익 (summary 값이 없으면 직접 계산)
                                    const netProfit = summary?.entryNetProfit?.[entry.id] ?? (dailyRevenue - dailyExpenses);
                                    const totalVolume = safeNum(entry.deliveryCount) + safeNum(entry.returnCount) + safeNum(entry.deliveryInterruptionAmount);
                                    
                                    return (
                                        <div key={entry.id || index} className={`${index < groupedEntries[month].length - 1 ? (isDarkMode ? 'border-b border-gray-700' : 'border-b border-gray-200') : ''}`}>
                                            <div className="p-4 flex flex-col">
                                                <div className="flex justify-between items-start cursor-pointer" onClick={() => toggleExpand(entry.id)}>
                                                    <span className="font-semibold text-sm">{safeFormatDate(entry.date)}</span>
                                                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">상세 {expandedId === entry.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                                                </div>
                                                <div className="flex justify-between items-end mt-2">
                                                    <div>
                                                        {filterType !== 'expense' && dailyRevenue > 0 && (
                                                            <><p className="text-sm text-black dark:text-gray-200">총 물량: <span className="font-bold">{totalVolume}</span> 건</p><p className="text-sm text-black dark:text-gray-200">프레시백: <span className="font-bold">{safeNum(entry.freshBagCount)}</span> 개</p></>
                                                        )}
                                                        {filterType !== 'income' && dailyExpenses > 0 && (
                                                            <p className="text-sm text-gray-800 dark:text-gray-200">지출: <span className="font-bold">{dailyExpenses.toLocaleString()}</span> 원</p>
                                                        )}
                                                    </div>
                                                    <p className={`font-bold text-xl ${filterType === 'expense' || netProfit < 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                                        {filterType === 'income' ? `+${dailyRevenue.toLocaleString()}` : filterType === 'expense' ? `-${dailyExpenses.toLocaleString()}` : (netProfit >= 0 ? `+${netProfit.toLocaleString()}` : netProfit.toLocaleString())}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {expandedId === entry.id && (
                                                <div className="bg-gray-50 dark:bg-gray-700 p-3 mx-2 mb-2 rounded-md text-sm space-y-2">
                                                    {dailyRevenue > 0 && (
                                                        <>
                                                            <p><strong>적용 단가:</strong> <span className="font-mono">{unitPrice.toLocaleString()}</span> 원</p>
                                                            <hr className="border-gray-200 dark:border-gray-600" />
                                                            <h5 className="font-bold pt-1">수익 상세</h5>
                                                            <p>• 배송: <strong>{safeNum(entry.deliveryCount)}</strong> 건</p>
                                                            <p>• 반품: <strong>{safeNum(entry.returnCount)}</strong> 건</p>
                                                            <p>• 배송중단: <strong>{safeNum(entry.deliveryInterruptionAmount)}</strong> 건</p>
                                                            <p>• 프레시백: <strong>{safeNum(entry.freshBagCount)}</strong> 개</p>
                                                        </>
                                                    )}
                                                    {dailyExpenses > 0 && (
                                                        <>
                                                            {dailyRevenue > 0 && <hr className="border-gray-200 dark:border-gray-600" />}
                                                            <h5 className="font-bold pt-1">지출 상세</h5>
                                                            {/* ✨ 반복문으로 모든 지출 항목 표시 (추가된 항목 포함) */}
                                                            {expenseDetails.map((exp, idx) => (
                                                                <p key={idx}>• {exp.label}: <strong>{exp.amount.toLocaleString()}</strong> 원</p>
                                                            ))}
                                                        </>
                                                    )}
                                                    <div className="flex justify-end pt-2">
                                                        <button onClick={() => handleEdit(entry)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"><Edit size={18} className="text-gray-500" /></button>
                                                        <button onClick={() => handleDelete(entry.id)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"><Trash2 size={18} className="text-red-500" /></button>
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
            })}
        </div>
    );
};

export default EntriesList;