import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDelivery } from '../../contexts/DeliveryContext';

export default function AdditionalOffTab({ currentUser, teamId, isDarkMode, showMessage }) {
    const { entries } = useDelivery();

    const [selectedDate, setSelectedDate] = useState(null);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // 장부에서 내 휴무일 목록 추출 (이 날짜들은 신청 불가)
    const existingDayOffs = useMemo(() => {
        const map = {};
        if (entries && Array.isArray(entries)) {
            entries.forEach(entry => {
                const hasDayOffMemo = entry.memo && entry.memo.includes('휴무');
                const hasDayOffItem = entry.customItems && entry.customItems.some(i => i.key === 'dayOff');
                if (hasDayOffMemo || hasDayOffItem) {
                    map[entry.date] = true;
                }
            });
        }
        return map;
    }, [entries]);

    const handleDateSelect = (dateStr) => {
        if (existingDayOffs[dateStr]) {
            if (showMessage) showMessage("❌ 이미 휴무로 지정된 날짜입니다.");
            return;
        }
        setSelectedDate(dateStr);
        setIsCalendarOpen(false);
    };

    const handleRequest = () => {
        if (!selectedDate) return;
        if (showMessage) showMessage(`✅ ${selectedDate} 추가 휴무 신청이 관리자에게 전송되었습니다.`);
        // TODO: Supabase 등 백엔드에 신청 내역(상태: '대기중') 저장 로직 추가
    };

    const renderCalendarModal = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        // 앞쪽 빈 칸
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>);
        }
        
        // 날짜 렌더링
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const targetDateObj = new Date(year, month, d);
            
            const isMyDayOff = existingDayOffs[dateStr];
            const isPastDate = targetDateObj < today;
            const dayOfWeek = targetDateObj.getDay();

            let textColor = 'text-gray-700 dark:text-gray-300';
            if (dayOfWeek === 0) textColor = 'text-red-500';
            else if (dayOfWeek === 6) textColor = 'text-blue-500';

            // ✨ 근무 예정인 미래의 날짜만 선택 가능하도록 제한
            const isSelectable = !isPastDate && !isMyDayOff;
            
            let bgStyle = '';
            if (isPastDate) {
                bgStyle = 'opacity-30 cursor-not-allowed grayscale'; // 과거
            } else if (isMyDayOff) {
                bgStyle = 'bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'; // 이미 휴무인 날
            } else {
                bgStyle = 'bg-white dark:bg-gray-800 cursor-pointer hover:bg-indigo-50 dark:hover:bg-gray-700'; // 선택 가능(근무일)
            }

            if (selectedDate === dateStr) {
                bgStyle = 'bg-indigo-100 dark:bg-indigo-900/60 border-indigo-500'; // 내가 방금 선택한 날
            }

            days.push(
                <div 
                    key={dateStr}
                    onClick={() => isSelectable && handleDateSelect(dateStr)}
                    className={`flex flex-col items-center justify-center p-2 h-14 border-b border-r border-gray-100 dark:border-gray-700 ${bgStyle}`}
                >
                    <span className={`text-sm font-bold ${textColor}`}>{d}</span>
                    {isMyDayOff && <span className="text-[9px] text-gray-400 mt-0.5">휴무</span>}
                </div>
            );
        }

        return (
            <div className="absolute inset-0 z-[100] bg-black/60 flex flex-col justify-end animate-in fade-in duration-200">
                <div className="bg-white dark:bg-gray-900 w-full rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-300 pb-32">
                    <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                        <h3 className="font-bold text-base">추가 휴무일 선택</h3>
                        <button onClick={() => setIsCalendarOpen(false)} className="p-1 opacity-70 hover:opacity-100">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="flex justify-between items-center p-4">
                        <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1"><ChevronLeft size={24}/></button>
                        <span className="font-bold text-lg">{year}년 {month + 1}월</span>
                        <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1"><ChevronRight size={24}/></button>
                    </div>
                    
                    <div className="grid grid-cols-7 text-center text-xs font-bold py-2 border-y dark:border-gray-700">
                        <div className="text-red-500">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-500">토</div>
                    </div>
                    
                    <div className="grid grid-cols-7 border-l border-gray-100 dark:border-gray-700 content-start overflow-y-auto max-h-64">
                        {days}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#F2F2F7] dark:bg-gray-950 p-4 relative pb-24">
            
            <div className="mb-4 text-sm font-bold text-gray-600 dark:text-gray-400 px-1">
                관리자에게 승인을 요청할 날짜를 선택해주세요.
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 mb-5 overflow-hidden">
                <div className="flex justify-between items-center p-4 bg-white dark:bg-gray-900">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">추가 휴무일 선택</span>
                    <button 
                        onClick={() => setIsCalendarOpen(true)}
                        className="active:scale-95 transition-transform"
                    >
                        <CalendarIcon size={24} className="text-[#1E56D0] dark:text-blue-400" />
                    </button>
                </div>
                <div className="h-[1px] w-full bg-gray-100 dark:bg-gray-800"></div>
                <div className="p-4 bg-white dark:bg-gray-900">
                    <span className={`text-base tracking-widest ${selectedDate ? 'text-black dark:text-white font-bold' : 'text-gray-400'}`}>
                        {selectedDate ? selectedDate.replace(/-/g, ' / ') : '- / -- / ----'}
                    </span>
                </div>
            </div>

            {/* 하단 내비게이션 바 위에 고정되는 신청 버튼 */}
            <div className="absolute bottom-16 left-0 right-0 px-4 z-10">
                <button 
                    onClick={handleRequest}
                    disabled={!selectedDate}
                    className={`w-full py-3.5 rounded-xl font-bold text-[15px] shadow-sm transition-all 
                        ${selectedDate ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95' : 'bg-[#D1D1D6] text-gray-100 dark:bg-gray-800 cursor-not-allowed'}`}
                >
                    신청하기
                </button>
            </div>

            {isCalendarOpen && renderCalendarModal()}
        </div>
    );
}