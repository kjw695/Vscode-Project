//기간/종류 선택 팝업창의 디자인과 내용을 담을 파일입니다.
// src/components/DataScreen/FilterModal.js

import React, { useState, useEffect } from 'react';

const FilterModal = ({ isOpen, onClose, onApply, initialFilters, isDarkMode }) => {
    const [filters, setFilters] = useState(initialFilters);

    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    useEffect(() => {
        setFilters(initialFilters);
    }, [isOpen, initialFilters]);

    if (!isOpen) return null;

    const handlePeriodClick = (period) => {
        const endDate = new Date();
        let startDate = new Date();
        let tempFilters = { ...filters, period: period };

        if (period === '1m') startDate.setMonth(endDate.getMonth() - 1);
        else if (period === '3m') startDate.setMonth(endDate.getMonth() - 3);
        else if (period === '6m') startDate.setMonth(endDate.getMonth() - 6);
        else if (period === 'thisYear') startDate = new Date(currentYear, 0, 1);
        else if (period === 'lastYear') {
            startDate = new Date(lastYear, 0, 1);
            endDate = new Date(lastYear, 11, 31);
        } else if (period === 'all') {
            tempFilters.startDate = '';
            tempFilters.endDate = '';
        } else if (period === 'custom') {
            // '직접 입력' 버튼을 누르면 기간(period) 상태만 변경하고 함수 종료
            setFilters(tempFilters);
            return;
        }

        // '직접 입력' 외 버튼 클릭 시 계산된 날짜를 상태에 저장
        tempFilters.startDate = startDate.toISOString().slice(0, 10);
        tempFilters.endDate = endDate.toISOString().slice(0, 10);
        setFilters(tempFilters);
    };
    
    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toISOString().slice(0, 10);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-end z-50" onClick={onClose}>
            <div 
                className={`w-full max-w-md p-6 rounded-t-2xl shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} pb-[calc(1.5rem+env(safe-area-inset-bottom))]`} 
                onClick={e => e.stopPropagation()}
            >
                {/* 조회 기간 */}
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <p className={`font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>조회기간</p>
                        <button onClick={() => handlePeriodClick('all')} className={`py-1 px-4 rounded-lg text-sm ${filters.period === 'all' ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200')}`}>전체</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        {['1m', '3m', '6m', 'custom'].map(p => (
                            <button key={p} onClick={() => handlePeriodClick(p)} className={`py-2 rounded-lg text-sm ${filters.period === p ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200')}`}>
                                {p === '1m' && '최근 1개월'}
                                {p === '3m' && '최근 3개월'}
                                {p === '6m' && '최근 6개월'}
                                {p === 'custom' && '직접 입력'}
                            </button>
                        ))}
                    </div>
                    {/* 날짜 선택 창 (항상 보이도록 수정) */}
                    <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between">
                            <label className="shrink-0 font-semibold">시작일</label>
                            <div className="flex items-center space-x-2">
                                <input 
                                    type="date" 
                                    value={formatDateForInput(filters.startDate)} 
                                    onChange={e => setFilters({...filters, startDate: e.target.value, period: 'custom'})} 
                                    className={`p-2 rounded-lg text-sm text-right w-40 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} 
                                />
                                <span>부터</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="shrink-0 font-semibold">종료일</label>
                            <div className="flex items-center space-x-2">
                                <input 
                                    type="date" 
                                    value={formatDateForInput(filters.endDate)} 
                                    onChange={e => setFilters({...filters, endDate: e.target.value, period: 'custom'})} 
                                    className={`p-2 rounded-lg text-sm text-right w-40 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} 
                                />
                                <span>까지</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* 거래 구분 */}
                <div className="mb-6">
                    <p className={`font-bold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>거래구분</p>
                    <div className="grid grid-cols-3 gap-3">
                        {['all', 'income', 'expense'].map(t => (
                            <button key={t} onClick={() => setFilters({...filters, type: t})} className={`py-2 rounded-lg text-sm ${filters.type === t ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200')}`}>
                                {t === 'all' && '전체'}
                                {t === 'income' && '수익'}
                                {t === 'expense' && '지출'}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* 최근 연도별 */}
                <div className="mb-8">
                    <p className={`font-bold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>최근 연도별</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handlePeriodClick('thisYear')} className={`py-2 rounded-lg text-sm ${filters.period === 'thisYear' ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200')}`}>{currentYear}년</button>
                        <button onClick={() => handlePeriodClick('lastYear')} className={`py-2 rounded-lg text-sm ${filters.period === 'lastYear' ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200')}`}>{lastYear}년</button>
                    </div>
                </div>
                
                {/* 하단 버튼 */}
                <div className="flex space-x-4">
                    <button onClick={onClose} className={`w-1/3 py-3 rounded-lg font-semibold ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>취소</button>
                    <button onClick={() => onApply(filters)} className="w-2/3 py-3 rounded-lg font-semibold bg-blue-600 text-white">거래내역 보기</button>
                </div>
            </div>
        </div>
    );
};

export default FilterModal;