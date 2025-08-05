import React, { useState, useMemo } from 'react';
import { Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const EntriesList = ({ entries, summary, handleEdit, handleDelete, isDarkMode, onOpenFilter, filterType }) => {
    const [expandedId, setExpandedId] = useState(null);
    const [collapsedMonths, setCollapsedMonths] = useState({});

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const toggleMonthCollapse = (month) => {
        setCollapsedMonths(prev => ({ ...prev, [month]: !prev[month] }));
    };

    const groupedEntries = useMemo(() => {
        if (!entries) return {};
        return entries.reduce((acc, entry) => {
            const month = entry.date.slice(0, 7);
            if (!acc[month]) acc[month] = [];
            acc[month].push(entry);
            return acc;
        }, {});
    }, [entries]);

    const sortedMonths = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

    return (
        <div className="w-full space-y-4">
            {/* 수익 / 지출 요약 카드 */}
            <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                {summary.totalRevenue > 0 && (
                    <div className="flex justify-between items-center py-1">
                        {/* ✨ 변경점: 글자 크기를 키우고 더 진하게 만들었습니다. */}
                        <span className="font-bold text-lg text-black dark:text-gray-200">수익</span>
                        <span className="font-bold text-red-500 text-lg">{summary.totalRevenue.toLocaleString()}원</span>
                    </div>
                )}
                {summary.totalRevenue > 0 && summary.totalExpenses > 0 && (
                    <hr className="border-gray-200 dark:border-gray-700 my-1"/>
                )}
                {summary.totalExpenses > 0 && (
                    <div className="flex justify-between items-center py-1">
                         {/* ✨ 변경점: 글자 크기를 키우고 더 진하게 만들었습니다. */}
                        <span className="font-bold text-lg text-black dark:text-gray-200">지출</span>
                        <span className="font-bold text-blue-500 text-lg">{summary.totalExpenses.toLocaleString()}원</span>
                    </div>
                )}
            </div>
            
            {/* 필터 버튼 UI */}
            <div className="flex justify-end items-center">
                <button 
                    onClick={onOpenFilter} 
                    className={`flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}
                >
                    현재 기간: {summary.filterLabel}
                    <ChevronDown size={16} className="ml-2" />
                </button>
            </div>

            {/* 월별 그룹 목록 */}
            {sortedMonths.length > 0 ? sortedMonths.map(month => {
                const [year, monthNum] = month.split('-');
                const isCollapsed = collapsedMonths[month];
                return (
                    <div key={month}>
                        <div 
                            className="flex items-center justify-between mb-2 pl-2 cursor-pointer"
                            onClick={() => toggleMonthCollapse(month)}
                        >
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {`${parseInt(year, 10)}년 ${parseInt(monthNum, 10)}월`}
                            </h2>
                            {isCollapsed ? <ChevronDown size={20} className="text-gray-500 dark:text-gray-400" /> : <ChevronUp size={20} className="text-gray-500 dark:text-gray-400" />}
                        </div>

                        {!isCollapsed && (
                            <div className={`rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
                                {groupedEntries[month].map((entry, index) => {
                                    const dailyRevenue = (entry.unitPrice * entry.deliveryCount) + (entry.unitPrice * entry.returnCount) + (entry.unitPrice * (entry.deliveryInterruptionAmount || 0)) + ((entry.freshBagCount || 0) * 100);
                                    const dailyExpenses = (entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0);
                                    const netProfit = summary.entryNetProfit[entry.id] || 0;
                                    const totalVolume = (entry.deliveryCount || 0) + (entry.returnCount || 0) + (entry.deliveryInterruptionAmount || 0);
                                    
                                    return (
                                        <div key={entry.id} className={`${index < groupedEntries[month].length - 1 ? (isDarkMode ? 'border-b border-gray-700' : 'border-b border-gray-200') : ''}`}>
                                            <div className="p-4 flex flex-col">
                                                <div className="flex justify-between items-start cursor-pointer" onClick={() => toggleExpand(entry.id)}>
                                                    <span className="font-semibold text-sm">{new Date(entry.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
                                                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                                        상세 {expandedId === entry.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-end mt-2">
                                                    <div>
                                                        {filterType !== 'expense' && dailyRevenue > 0 && (
                                                            <>
                                                                {/* ✨ 변경점: 글자색을 더 진하게 만들었습니다. */}
                                                                <p className="text-sm text-black dark:text-gray-200">총 물량: <span className="font-bold">{totalVolume}</span> 건</p>
                                                            <p className="text-sm text-black dark:text-gray-200">프레시백: <span className="font-bold">{entry.freshBagCount || 0}</span> 개</p>
                                                            </>
                                                        )}
                                                        {filterType !== 'income' && dailyExpenses > 0 && (
                                                            <p className="text-sm text-gray-800 dark:text-gray-200">지출: <span className="font-bold">{dailyExpenses.toLocaleString()}</span> 원</p>
                                                        )}
                                                    </div>
                                                    <p className={`font-bold text-xl ${filterType === 'expense' || netProfit < 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                                        {filterType === 'income' && `+${dailyRevenue.toLocaleString()}`}
                                                        {filterType === 'expense' && `-${dailyExpenses.toLocaleString()}`}
                                                        {filterType === 'all' && (netProfit >= 0 ? `+${netProfit.toLocaleString()}` : netProfit.toLocaleString())}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {expandedId === entry.id && (
                                                <>
                                                    <div className="bg-gray-50 dark:bg-gray-700 p-3 mx-2 mb-2 rounded-md text-sm space-y-2">
                                                        {dailyRevenue > 0 && (
                                                            <>
                                                                <p><strong>적용 단가:</strong> <span className="font-mono">{entry.unitPrice.toLocaleString()}</span> 원</p>
                                                                <hr className="border-gray-200 dark:border-gray-600" />
                                                                <h5 className="font-bold pt-1">수익 상세</h5>
                                                                <p>• 배송: <strong>{entry.deliveryCount || 0}</strong> 건</p>
                                                                <p>• 반품: <strong>{entry.returnCount || 0}</strong> 건</p>
                                                                <p>• 배송중단: <strong>{entry.deliveryInterruptionAmount || 0}</strong> 건</p>
                                                                <p>• 프레시백: <strong>{entry.freshBagCount || 0}</strong> 개</p>
                                                            </>
                                                        )}
                                                        {dailyExpenses > 0 && (
                                                            <>
                                                                {dailyRevenue > 0 && <hr className="border-gray-200 dark:border-gray-600" />}
                                                                <h5 className="font-bold pt-1">지출 상세</h5>
                                                                {entry.penaltyAmount > 0 && <p>• 패널티: <strong>{entry.penaltyAmount.toLocaleString()}</strong> 원</p>}
                                                                {entry.industrialAccidentCost > 0 && <p>• 산재: <strong>{entry.industrialAccidentCost.toLocaleString()}</strong> 원</p>}
                                                                {entry.fuelCost > 0 && <p>• 유류비: <strong>{entry.fuelCost.toLocaleString()}</strong> 원</p>}
                                                                {entry.maintenanceCost > 0 && <p>• 유지보수비: <strong>{entry.maintenanceCost.toLocaleString()}</strong> 원</p>}
                                                                {entry.vatAmount > 0 && <p>• 부가세: <strong>{entry.vatAmount.toLocaleString()}</strong> 원</p>}
                                                                {entry.incomeTaxAmount > 0 && <p>• 종합소득세: <strong>{entry.incomeTaxAmount.toLocaleString()}</strong> 원</p>}
                                                                {entry.taxAccountantFee > 0 && <p>• 세무사 비용: <strong>{entry.taxAccountantFee.toLocaleString()}</strong> 원</p>}
                                                            </>
                                                        )}
                                                        <div className="flex justify-end pt-2">
                                                            <button onClick={() => handleEdit(entry)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"><Edit size={18} className="text-gray-500" /></button>
                                                            <button onClick={() => handleDelete(entry.id)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"><Trash2 size={18} className="text-red-500" /></button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            }) : (
                <div className="text-center py-10">
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>해당 조건의 데이터가 없습니다.</p>
                </div>
            )}
        </div>
    );
};

export default EntriesList;