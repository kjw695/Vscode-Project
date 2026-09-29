//src/
//└── components/
//    └── dayOff/
//        ├── DayOffModal.jsx    (메인 컨테이너: 탭 전환 및 공통 껍데기)
   //     ├── CalendarTab.jsx    (1탭: 휴무 지정 달력 화면)
   //     ├── PreferredTab.jsx   (2탭: 선호 휴무일 설정 화면)
   //     └── ExchangeTab.jsx    (3탭: 휴무 교환 마켓 화면)

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDelivery } from '../../contexts/DeliveryContext';

export default function CalendarTab({ isDarkMode, showMessage, monthlyStartDay, monthlyEndDay, selectedMonth, onClose }) {
    const { entries, saveEntry, deleteEntry } = useDelivery();

    const [currentViewDate, setCurrentViewDate] = useState(() => {
        if (selectedMonth) {
            const [y, m] = selectedMonth.split('-').map(Number);
            return new Date(y, m - 1, 1, 12, 0, 0); 
        }
        return new Date();
    });

    const [selectedDates, setSelectedDates] = useState([]);

    useEffect(() => {
        if (selectedMonth) {
            const [y, m] = selectedMonth.split('-').map(Number);
            setCurrentViewDate(new Date(y, m - 1, 1, 12, 0, 0));
        }
    }, [selectedMonth]);

    const todayStr = useMemo(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }, []);

    const existingDayOffs = useMemo(() => {
        const map = {};
        if (entries && Array.isArray(entries)) {
            entries.forEach(entry => {
                const hasDayOffMemo = entry.memo && entry.memo.includes('휴무');
                const hasDayOffItem = entry.customItems && entry.customItems.some(i => i.key === 'dayOff');
                if (hasDayOffMemo || hasDayOffItem) {
                    map[entry.date] = entry.id; 
                }
            });
        }
        return map;
    }, [entries]);

    useEffect(() => {
        setSelectedDates(Object.keys(existingDayOffs));
    }, [existingDayOffs]);

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const sDay = Number(monthlyStartDay) || 26;
    const eDay = Number(monthlyEndDay) || 25;

    let periodStartDate, periodEndDate;
    if (sDay > eDay) {
        periodStartDate = new Date(year, month - 1, sDay, 12, 0, 0);
        periodEndDate = new Date(year, month, eDay, 12, 0, 0);
    } else {
        periodStartDate = new Date(year, month, sDay, 12, 0, 0);
        periodEndDate = new Date(year, month, eDay, 12, 0, 0);
    }

    const firstDayOfWeek = periodStartDate.getDay();
    const daysInPeriod = Math.round((periodEndDate - periodStartDate) / (1000 * 60 * 60 * 24)) + 1;

    const toggleDate = (dateStr) => {
        setSelectedDates(prev => 
            prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
        );
    };

    const toAdd = selectedDates.filter(date => !existingDayOffs[date]);
    const toRemove = Object.keys(existingDayOffs).filter(date => !selectedDates.includes(date));
    const hasChanges = toAdd.length > 0 || toRemove.length > 0;

    const handleProcessSave = () => {
        if (!hasChanges) return;
        
        toAdd.forEach(dateStr => {
            saveEntry({
                type: 'income',
                date: dateStr,
                memo: '[휴무]', 
                round: 0,
                customItems: [{ key: 'dayOff', name: '휴무', amount: 0, count: 1, type: 'income', unitPrice: 0 }]
            });
        });

        toRemove.forEach(dateStr => {
            if (deleteEntry) { 
                deleteEntry(existingDayOffs[dateStr]);
            }
        });

        showMessage(`✅ 휴무 업데이트 완료`);
        onClose();
    };

    let btnText = '변경사항 없음';
    if (toAdd.length > 0 && toRemove.length > 0) btnText = `${toAdd.length}일 추가, ${toRemove.length}일 취소`;
    else if (toAdd.length > 0) btnText = `${toAdd.length}일 휴무 등록하기`;
    else if (toRemove.length > 0) btnText = `${toRemove.length}일 휴무 취소하기`;

    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
        days.push(<div key={`empty-${i}`} className="w-full h-9" />);
    }

    for (let i = 0; i < daysInPeriod; i++) {
        const currentDate = new Date(periodStartDate);
        currentDate.setDate(currentDate.getDate() + i);
        
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        
        const isSelected = selectedDates.includes(dateStr);
        const dayOfWeek = currentDate.getDay();
        const isToday = dateStr === todayStr;

        let textColor = isDarkMode ? 'text-gray-300' : 'text-gray-700';
        if (dayOfWeek === 0) textColor = 'text-red-500';
        else if (dayOfWeek === 6) textColor = 'text-blue-500';

        const bgClass = isDarkMode ? 'bg-gray-800' : 'bg-gray-100';

        days.push(
            <div key={dateStr} className="w-full flex items-center justify-center h-9">
                <button 
                    onClick={() => toggleDate(dateStr)}
                    style={{ WebkitAppearance: 'none' }} 
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold p-0 m-0 leading-none transition-all
                    ${isSelected ? 'bg-indigo-600 text-white shadow-md scale-105' : `${bgClass}${textColor}`}
                    ${isToday ? 'border-[2px] border-yellow-400' : 'border border-transparent'} 
                    `}
                >
                    {currentDate.getDate()}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 rounded-xl">
                <button onClick={() => setCurrentViewDate(new Date(year, month - 1, 1, 12, 0, 0))} className="p-1"><ChevronLeft size={18}/></button>
                <div className="flex flex-col items-center">
                    <span className="font-black text-sm">{year}년 {month + 1}월</span>
                    <span className="text-[9px] text-gray-400">({sDay}일~{eDay}일 집계)</span>
                </div>
                <button onClick={() => setCurrentViewDate(new Date(year, month + 1, 1, 12, 0, 0))} className="p-1"><ChevronRight size={18}/></button>
            </div>
            
            <div className="grid grid-cols-7 mb-1 text-center text-[11px] font-black uppercase w-full">
                <div className="text-red-500">일</div>
                <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>월</div>
                <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>화</div>
                <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>수</div>
                <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>목</div>
                <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>금</div>
                <div className="text-blue-500">토</div>
            </div>
            
            <div className="grid grid-cols-7 gap-y-1 w-full mb-4">
                {days}
            </div>
            
            <button 
                onClick={handleProcessSave} 
                disabled={!hasChanges}
                className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all
                ${hasChanges ? 'bg-indigo-600 text-white active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                `}
            >
                {btnText}
            </button>
        </div>
    );
}