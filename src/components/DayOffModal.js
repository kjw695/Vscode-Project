import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
// ✨ 주방장(Context)에게 직접 데이터를 달라고 요청하는 부품을 가져옵니다!
import { useDelivery } from '../contexts/DeliveryContext';

export const DayOffModal = ({ 
    isOpen, onClose, isDarkMode, showMessage, 
    monthlyStartDay, monthlyEndDay, selectedMonth 
}) => {
    // 🚨 디버그 1: 부모(App.js)가 넘겨준 값을 팝업이 열릴 때마다 확인합니다!
    useEffect(() => {
        if (isOpen) {
            console.log(`\n--- 🔍 [DayOffModal 추적 시작] ---`);
            console.log(`1. 부모가 넘겨준 selectedMonth: ${selectedMonth}`);
            console.log(`2. 현재 팝업의 currentViewDate: ${currentViewDate.toLocaleDateString()}`);
            console.log(`-----------------------------------\n`);
        }
    }, [isOpen, selectedMonth]);

    // ✨ App.js에서 받는 대신, 여기서 직접 장부(entries)와 삭제버튼(deleteEntry), 저장버튼(saveEntry)을 꺼내옵니다!
    const { entries, saveEntry, deleteEntry } = useDelivery();

    // ✨ 구조적 해결: 팝업이 처음 생길 때 'new Date()'를 쓰지 않고 홈 화면의 'selectedMonth'를 즉시 반영합니다.
    const [currentViewDate, setCurrentViewDate] = useState(() => {
        if (selectedMonth) {
            const [y, m] = selectedMonth.split('-').map(Number);
            return new Date(y, m - 1, 1, 12, 0, 0); 
        }
        return new Date();
    });

    const [selectedDates, setSelectedDates] = useState([]);

    // ✨ 핵심 연결: 팝업이 열릴 때마다 부모(홈 화면)가 보고 있는 그 달로 강제 싱크를 맞춥니다.
    useEffect(() => {
        if (isOpen && selectedMonth) {
            const [y, m] = selectedMonth.split('-').map(Number);
            setCurrentViewDate(new Date(y, m - 1, 1, 12, 0, 0));
        }
    }, [isOpen, selectedMonth]);

    const todayStr = useMemo(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }, []);

    // 1. 기존에 등록된 휴무일 찾아내기
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

    // 2. 모달이 열릴 때, 이미 등록된 휴무일들을 달력에 미리 선택(파란색)해 둠
    useEffect(() => {
        if (isOpen) {
            setSelectedDates(Object.keys(existingDayOffs));
        }
    }, [isOpen, existingDayOffs]);

    if (!isOpen) return null;

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const sDay = Number(monthlyStartDay) || 26;
    const eDay = Number(monthlyEndDay) || 25;

    let periodStartDate, periodEndDate;
    if (sDay > eDay) {
        // ✨ 집계일 기준(26~25) 달력 그리기 로직
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

    // 3. 추가할 날짜와 취소할 날짜 분류하기
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

        const addMsg = toAdd.length > 0 ? `${toAdd.length}일 추가` : '';
        const rmMsg = toRemove.length > 0 ? `${toRemove.length}일 취소` : '';
        const finalMsg = [addMsg, rmMsg].filter(Boolean).join(', ');

        showMessage(`✅ 휴무 업데이트 (${finalMsg})`);
        onClose();
    };

    let btnText = '변경사항 없음';
    if (toAdd.length > 0 && toRemove.length > 0) btnText = `${toAdd.length}일 추가, ${toRemove.length}일 취소`;
    else if (toAdd.length > 0) btnText = `${toAdd.length}일 휴무 등록하기`;
    else if (toRemove.length > 0) btnText = `${toRemove.length}일 휴무 취소하기`;

    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
        days.push(<div key={`empty-${i}`} className="w-full h-10" />);
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
            <div key={dateStr} className="w-full flex items-center justify-center h-10">
                <button 
                    onClick={() => toggleDate(dateStr)}
                    style={{ WebkitAppearance: 'none' }} 
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold p-0 m-0 leading-none transition-all
                    ${isSelected ? 'bg-indigo-600 text-white shadow-md scale-105' : `${bgClass} ${textColor}`}
                    ${isToday ? 'border-[3px] border-yellow-400' : 'border border-transparent'} 
                    `}
                >
                    {currentDate.getDate()}
                </button>
            </div>
        );
    }

    // 🚨 디버그 2: 화면을 그리기 직전에 어떤 달을 기준으로 그리는지 확인합니다.
    console.log(`🚨 팝업이 화면을 그리기 직전! 달력의 연월: ${year}년 ${month + 1}월`);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
            <div className={`w-full max-w-[320px] p-5 rounded-3xl shadow-2xl flex flex-col ${isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white'}`}>
                
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-xl font-black whitespace-nowrap tracking-tight">휴무 관리</h3>
                    <button onClick={onClose} className="p-2 text-xl font-black opacity-40 hover:opacity-100"><X size={20} /></button>
                </div>
                
               <div className="flex items-center justify-between mb-5 bg-gray-50 dark:bg-gray-800 p-2 rounded-2xl">
                    <button onClick={() => setCurrentViewDate(new Date(year, month - 1, 1, 12, 0, 0))} className="px-4 py-1 font-bold text-lg"><ChevronLeft size={20}/></button>
                    <div className="flex flex-col items-center">
                        <span className="font-black whitespace-nowrap text-base">{year}년 {month + 1}월</span>
                        <span className="text-[10px] text-gray-400 font-normal whitespace-nowrap tracking-tighter">({sDay}일~{eDay}일)</span>
                    </div>
                    <button onClick={() => setCurrentViewDate(new Date(year, month + 1, 1, 12, 0, 0))} className="px-4 py-1 font-bold text-lg"><ChevronRight size={20}/></button>
                </div>
                
                <div className="grid grid-cols-7 mb-2 text-center text-[12px] font-black uppercase w-full">
                    <div className="text-red-500 w-full">일</div>
                    <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>월</div>
                    <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>화</div>
                    <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>수</div>
                    <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>목</div>
                    <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>금</div>
                    <div className="text-blue-500 w-full">토</div>
                </div>
                
                <div className="grid grid-cols-7 gap-y-2 w-full mb-6">
                    {days}
                </div>
                
                <button 
                    onClick={handleProcessSave} 
                    disabled={!hasChanges}
                    className={`w-full py-3.5 rounded-2xl font-bold shadow-md transition-all whitespace-nowrap
                    ${hasChanges ? 'bg-indigo-600 text-white active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                    `}
                >
                    {btnText}
                </button>
            </div>
        </div>
    );
};