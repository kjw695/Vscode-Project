//기간/종류 선택 팝업창의 디자인과 내용을 담을 파일입니다.

// src/components/DataScreen/FilterModal.js

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'; // ✨ 새로고침 아이콘 추가

const FilterModal = ({ isOpen, onClose, onApply, initialFilters, isDarkMode, entries }) => {
    const [filters, setFilters] = useState(initialFilters);
    const [showCalendar, setShowCalendar] = useState(null); 

    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    const toYYYYMMDD = (date) => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // ✨ 장부 데이터 범위를 정확히 계산
    const dataRange = useMemo(() => {
        if (!entries || entries.length === 0) {
            const today = toYYYYMMDD(new Date());
            return { start: today, end: today };
        }
        const sortedDates = entries.map(e => e.date).filter(Boolean).sort();
        return { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] };
    }, [entries]);

    // ✨ [해결] 새로고침 로직: 모든 설정을 처음 상태(전체)로 초기화
    const handleReset = () => {
        const range = dataRange;
        setFilters({
            period: 'all',
            startDate: range.start,
            endDate: range.end,
            type: 'all',
            label: '전체'
        });
    };

    useEffect(() => {
        if (isOpen) {
            let updated = { ...initialFilters };
            if (updated.period === 'all') {
                updated.startDate = dataRange.start;
                updated.endDate = dataRange.end;
                updated.label = "전체";
            }
            setFilters(updated);
        }
    }, [isOpen, initialFilters, dataRange]);

    if (!isOpen) return null;

    const handlePeriodClick = (period) => {
        const newFilters = { ...filters, period: period };
        let startDate, endDate, label;
        const today = new Date();

        switch (period) {
            case 'all':
                startDate = new Date(dataRange.start); 
                endDate = new Date(dataRange.end);
                label = "전체";
                break;
            case '1m':
                endDate = today;
                startDate = new Date(); startDate.setMonth(today.getMonth() - 1);
                label = "최근 1개월";
                break;
            case '3m':
                endDate = today;
                startDate = new Date(); startDate.setMonth(today.getMonth() - 3);
                label = "최근 3개월";
                break;
            case '6m':
                endDate = today;
                startDate = new Date(); startDate.setMonth(today.getMonth() - 6);
                label = "최근 6개월";
                break;
            case 'thisYear':
                startDate = new Date(currentYear, 0, 1);
                endDate = new Date(currentYear, 11, 31);
                label = `${currentYear}년`;
                break;
            case 'lastYear':
                startDate = new Date(lastYear, 0, 1);
                endDate = new Date(lastYear, 11, 31);
                label = `${lastYear}년`;
                break;
            case 'custom':
                setFilters({ ...newFilters, label: '직접 입력' });
                return;
            default: return; 
        }
        newFilters.startDate = toYYYYMMDD(startDate);
        newFilters.endDate = toYYYYMMDD(endDate);
        newFilters.label = label;
        setFilters(newFilters);
    };

    const CalendarPopup = ({ type, currentVal, onSelect, onCancel }) => {
        const date = new Date(currentVal || new Date());
        const [viewDate, setViewDate] = useState(date);
        const [touchStart, setTouchStart] = useState(null);
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        const handleTouchStart = (e) => setTouchStart(e.targetTouches[0].clientX);
        const handleTouchEnd = (e) => {
            if (!touchStart) return;
            const touchEnd = e.changedTouches[0].clientX;
            if (touchStart - touchEnd > 70) setViewDate(new Date(year, month + 1, 1));
            if (touchStart - touchEnd < -70) setViewDate(new Date(year, month - 1, 1));
        };

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);

        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
                <div className={`w-full max-w-[320px] rounded-3xl p-6 shadow-2xl ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`} onClick={e => e.stopPropagation()} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                    <div className="flex justify-between items-center mb-6 px-2">
                        <button onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft /></button>
                        <div className="relative font-bold text-xl cursor-pointer">
                            {year}년 {month + 1}월
                            <input type="month" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" onChange={(e) => {
                                const [y, m] = e.target.value.split('-');
                                setViewDate(new Date(parseInt(y), parseInt(m) - 1, 1));
                            }}/>
                        </div>
                        <button onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                        {['일','월','화','수','목','금','토'].map((d, i) => (
                            <span key={d} className={`text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{d}</span>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                        {days.map((d, i) => (
                            <div key={i} onClick={() => d && onSelect(toYYYYMMDD(new Date(year, month, d)))} 
                                 className={`py-2 text-sm rounded-lg cursor-pointer ${d === date.getDate() && month === date.getMonth() && year === date.getFullYear() ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} ${i % 7 === 0 ? 'text-red-500' : i % 7 === 6 ? 'text-blue-500' : ''}`}>
                                {d}
                            </div>
                        ))}
                    </div>
                    <button onClick={onCancel} className={`w-full mt-6 py-4 rounded-xl font-bold ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>닫기</button>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-end z-50" onClick={onClose}>
            <div className={`w-full max-w-md p-6 rounded-t-2xl shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} pb-[calc(1.5rem+env(safe-area-inset-bottom))]`} onClick={e => e.stopPropagation()}>
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center space-x-2">
                            <p className={`font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>조회기간</p>
                            {/* ✨ [해결] '전체' 버튼을 파란 원 위치로 이동 */}
                            <button 
                                onClick={() => handlePeriodClick('all')} 
                                className={`py-1 px-3 rounded-lg text-xs font-bold transition-colors ${filters.period === 'all' ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500')}`}
                            >
                                전체
                            </button>
                        </div>
                        {/* ✨ [해결] 기존 전체 자리에 새로고침 버튼 추가 */}
                        <button 
                            onClick={handleReset} 
                            className={`flex items-center py-1 px-2 rounded-lg text-xs font-bold border transition-all active:scale-95 ${isDarkMode ? 'border-gray-600 text-gray-400 bg-gray-700/50' : 'border-gray-200 text-gray-500 bg-gray-50'}`}
                        >
                            <RotateCcw size={12} className="mr-1" /> 새로고침
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        {['1m', '3m', '6m', 'custom'].map(p => (
                            <button key={p} onClick={() => handlePeriodClick(p)} className={`py-2 rounded-lg text-sm ${filters.period === p ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200 text-gray-600')}`}>
                                {p === '1m' && '최근 1개월'} {p === '3m' && '최근 3개월'} {p === '6m' && '최근 6개월'} {p === 'custom' && '직접 입력'}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between">
                            <label className="shrink-0 font-semibold text-sm">시작일</label>
                            <div className="flex items-center space-x-2">
                                <div onClick={() => setShowCalendar('start')} className={`p-2 rounded-lg text-sm text-right w-44 flex justify-between items-center cursor-pointer border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>
                                    <span>{filters.startDate ? filters.startDate.replace(/-/g, '. ') + '.' : '날짜 선택'}</span>
                                    <ChevronDown size={14} className="text-gray-400" />
                                </div>
                                <span className="text-sm">부터</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="shrink-0 font-semibold text-sm">종료일</label>
                            <div className="flex items-center space-x-2">
                                <div onClick={() => setShowCalendar('end')} className={`p-2 rounded-lg text-sm text-right w-44 flex justify-between items-center cursor-pointer border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>
                                    <span>{filters.endDate ? filters.endDate.replace(/-/g, '. ') + '.' : '날짜 선택'}</span>
                                    <ChevronDown size={14} className="text-gray-400" />
                                </div>
                                <span className="text-sm">까지</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <p className={`font-bold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>거래구분</p>
                    <div className="grid grid-cols-3 gap-3">
                        {['all', 'income', 'expense'].map(t => (
                            <button key={t} onClick={() => setFilters({...filters, type: t})} className={`py-2 rounded-lg text-sm ${filters.type === t ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200 text-gray-600')}`}>
                                {t === 'all' ? '전체' : t === 'income' ? '수익' : '지출'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-8">
                    <p className={`font-bold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>최근 연도별</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handlePeriodClick('thisYear')} className={`py-2 rounded-lg text-sm ${filters.period === 'thisYear' ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200 text-gray-600')}`}>{currentYear}년</button>
                        <button onClick={() => handlePeriodClick('lastYear')} className={`py-2 rounded-lg text-sm ${filters.period === 'lastYear' ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200 text-gray-600')}`}>{lastYear}년</button>
                    </div>
                </div>

                <div className="flex space-x-4">
                    <button onClick={onClose} className={`w-1/3 py-3 rounded-lg font-semibold ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200 text-gray-600'}`}>취소</button>
                    <button onClick={() => onApply(filters)} className="w-2/3 py-3 rounded-lg font-semibold bg-blue-600 text-white shadow-lg active:scale-95 transition-transform">거래내역 보기</button>
                </div>
            </div>

            {showCalendar && (
                <CalendarPopup 
                    type={showCalendar}
                    currentVal={showCalendar === 'start' ? filters.startDate : filters.endDate}
                    onSelect={(val) => {
                        setFilters({ ...filters, [showCalendar === 'start' ? 'startDate' : 'endDate']: val, period: 'custom', label: '직접 입력' });
                        setShowCalendar(null);
                    }}
                    onCancel={() => setShowCalendar(null)}
                />
            )}
        </div>
    );
};

export default FilterModal;