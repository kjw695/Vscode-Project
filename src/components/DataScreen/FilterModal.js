//기간/종류 선택 팝업창의 디자인과 내용을 담을 파일입니다.
// src/components/DataScreen/FilterModal.js

import React, { useState, useEffect } from 'react';

const FilterModal = ({ isOpen, onClose, onApply, initialFilters, isDarkMode }) => {
    const [filters, setFilters] = useState(initialFilters);

    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    useEffect(() => {
        // 모달이 열릴 때마다 전달받은 초기 필터 값으로 상태를 재설정합니다.
        setFilters(initialFilters);
    }, [isOpen, initialFilters]);

    if (!isOpen) return null;

    /**
     * Date 객체를 'YYYY-MM-DD' 형식의 문자열로 변환하는 헬퍼 함수입니다.
     * toISOString()의 시간대 변환 문제를 해결합니다.
     * @param {Date} date - 변환할 Date 객체
     * @returns {string} 'YYYY-MM-DD' 형식의 문자열
     */
    const toYYYYMMDD = (date) => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    /**
     * 기간 버튼 클릭을 처리하는 함수입니다.
     */
    const handlePeriodClick = (period) => {
        const newFilters = { ...filters, period: period };
        let startDate, endDate;

        switch (period) {
            case '1m':
                endDate = new Date();
                startDate = new Date();
                startDate.setMonth(endDate.getMonth() - 1);
                break;
            case '3m':
                endDate = new Date();
                startDate = new Date();
                startDate.setMonth(endDate.getMonth() - 3);
                break;
            case '6m':
                endDate = new Date();
                startDate = new Date();
                startDate.setMonth(endDate.getMonth() - 6);
                break;
            case 'thisYear':
                startDate = new Date(currentYear, 0, 1); // 올해 1월 1일
                endDate = new Date(currentYear, 11, 31); // 올해 12월 31일
                break;
            case 'lastYear':
                startDate = new Date(lastYear, 0, 1); // 작년 1월 1일
                endDate = new Date(lastYear, 11, 31); // 작년 12월 31일
                break;
            case 'all':
                startDate = null; // '전체' 선택 시 날짜를 비웁니다.
                endDate = null;
                break;
            case 'custom':
                // '직접 입력'은 기간(period) 상태만 변경하고 날짜는 직접 입력받습니다.
                setFilters(newFilters);
                return;
            default:
                return; 
        }

        // 계산된 날짜를 YYYY-MM-DD 형식의 문자열로 변환합니다.
        newFilters.startDate = toYYYYMMDD(startDate);
        newFilters.endDate = toYYYYMMDD(endDate);

        setFilters(newFilters);
    };
    
    // input type="date"에 맞는 날짜 형식을 반환하는 함수
    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        return dateString.slice(0, 10);
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
                    {/* 날짜 선택 창 */}
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
