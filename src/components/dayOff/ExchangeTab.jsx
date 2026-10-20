import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useDelivery } from '../../contexts/DeliveryContext';

export default function ExchangeTab({ currentUser, teamId, isDarkMode, showMessage }) {
    const { entries } = useDelivery();

    const [sourceDate, setSourceDate] = useState(null);
    const [targetDate, setTargetDate] = useState(null);

    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [selectingType, setSelectingType] = useState(null); 

    // ✨ 대상자 선택 관련 상태 추가
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);

    // 가상의 팀원 데이터 (실제 연동 시 targetDate에 쉬는 사람을 DB에서 불러옴)
    const mockRestingMembers = [
        { id: 'm1', name: '김동료' },
        { id: 'm2', name: '이팀장' }
    ];

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

    const isSameWeek = (date1Str, date2Str) => {
        if (!date1Str || !date2Str) return false;
        const d1 = new Date(date1Str);
        const d2 = new Date(date2Str);
        const sun1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate() - d1.getDay());
        const sun2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate() - d2.getDay());
        return sun1.getTime() === sun2.getTime();
    };

    const handleOpenCalendar = (type) => {
        if (type === 'target' && !sourceDate) {
            if (showMessage) showMessage("하나의 휴무일을 먼저 선택해주세요.");
            return;
        }
        setSelectingType(type);
        setIsCalendarOpen(true);
    };

    const handleDateSelect = (dateStr) => {
        if (selectingType === 'source') {
            if (!existingDayOffs[dateStr]) {
                if (showMessage) showMessage("❌ 본인이 지정한 휴무일만 선택할 수 있습니다.");
                return;
            }
            setSourceDate(dateStr);
            setTargetDate(null); 
        } else if (selectingType === 'target') {
            if (dateStr === sourceDate) {
                if (showMessage) showMessage("❌ 같은 날짜로는 교환할 수 없습니다.");
                return;
            }
            setTargetDate(dateStr);
        }
        setIsCalendarOpen(false);
    };

    // ✨ 다음 버튼 누르면 교환 대상자 선택 모달 띄우기
    const handleNext = () => {
        if (!sourceDate || !targetDate) return;
        setIsMemberModalOpen(true);
    };

    // ✨ 최종 교환 신청 완료 버튼
    const handleSubmitRequest = () => {
        if (!selectedMember) return;
        if (showMessage) showMessage(`✅ ${selectedMember.name}님에게 교환 요청을 보냈습니다.`);
        
        // 상태 초기화
        setIsMemberModalOpen(false);
        setSelectedMember(null);
        setSourceDate(null);
        setTargetDate(null);
    };

    const renderCalendarModal = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());

        const calendarDays = [];
        for (let i = 0; i < 21; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            calendarDays.push({ date: d, dateStr: `${year}-${month}-${day}` });
        }

        const days = calendarDays.map(({ date, dateStr }) => {
            const isMyDayOff = existingDayOffs[dateStr];
            const dayOfWeek = date.getDay();
            const isPastDate = date < today;

            let textColor = 'text-gray-700 dark:text-gray-300';
            if (dayOfWeek === 0) textColor = 'text-red-500';
            else if (dayOfWeek === 6) textColor = 'text-blue-500';

            let isSelectable = true;
            let bgStyle = 'bg-white dark:bg-gray-800';

            if (selectingType === 'source') {
                isSelectable = isMyDayOff && !isPastDate;
                if (isPastDate) {
                    bgStyle = 'opacity-30 cursor-not-allowed grayscale';
                } else if (isMyDayOff) {
                    bgStyle = 'bg-green-50 dark:bg-green-900/40 cursor-pointer hover:bg-green-100';
                } else {
                    bgStyle = 'opacity-30 cursor-not-allowed grayscale';
                }
            } else {
                const inSameWeek = isSameWeek(dateStr, sourceDate);
                isSelectable = inSameWeek && !isPastDate && dateStr !== sourceDate;
                
                if (dateStr === sourceDate) {
                    bgStyle = 'bg-indigo-50 dark:bg-indigo-900/40 opacity-50 cursor-not-allowed';
                } else if (!inSameWeek || isPastDate) {
                    bgStyle = 'opacity-30 cursor-not-allowed grayscale'; 
                } else {
                    bgStyle = 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700';
                }
            }

            const displayDate = date.getDate() === 1 ? `${date.getMonth() + 1}/${date.getDate()}` : date.getDate();

            return (
                <div 
                    key={dateStr}
                    onClick={() => isSelectable && handleDateSelect(dateStr)}
                    className={`flex flex-col items-center justify-center p-2 h-14 border-b border-r border-gray-100 dark:border-gray-700 ${bgStyle}`}
                >
                    <span className={`text-sm font-bold ${textColor}`}>{displayDate}</span>
                    {isMyDayOff && <span className="text-[9px] text-gray-500 mt-0.5">○ 휴무</span>}
                </div>
            );
        });

        return (
            <div className="absolute inset-0 z-[100] bg-black/60 flex flex-col justify-end animate-in fade-in duration-200">
                <div className="bg-white dark:bg-gray-900 w-full rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-300 pb-32">
                    <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                        <h3 className="font-bold text-base">
                            {selectingType === 'source' ? '내 휴무일 선택' : '신규 휴무일 선택'}
                        </h3>
                        <button onClick={() => setIsCalendarOpen(false)} className="p-1 opacity-70 hover:opacity-100">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="flex justify-center items-center p-3 text-sm font-bold text-gray-600 dark:text-gray-400">
                        교환 가능 기간 (이번 주 포함 3주)
                    </div>
                    
                    <div className="grid grid-cols-7 text-center text-xs font-bold py-2 border-y dark:border-gray-700">
                        <div className="text-red-500">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-500">토</div>
                    </div>
                    
                    <div className="grid grid-cols-7 border-l border-gray-100 dark:border-gray-700 content-start">
                        {days}
                    </div>
                </div>
            </div>
        );
    };

    // ✨ 대상자 선택 바텀시트 렌더링
    const renderMemberSelectModal = () => {
        return (
            <div className="absolute inset-0 z-[100] bg-black/60 flex flex-col justify-end animate-in fade-in duration-200">
                <div className="bg-white dark:bg-gray-900 w-full rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-300 pb-16">
                    <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                        <h3 className="font-bold text-base">누구와 교환하시겠어요?</h3>
                        <button onClick={() => setIsMemberModalOpen(false)} className="p-1 opacity-70 hover:opacity-100">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center justify-between">
                        <span>선택한 신규 휴무일: <strong className="text-indigo-600 dark:text-indigo-400 ml-1">{targetDate}</strong></span>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-64 p-4 space-y-2">
                        {mockRestingMembers.length === 0 ? (
                            <div className="text-center text-gray-500 py-6 text-sm">해당 날짜에 쉬는 팀원이 없습니다.</div>
                        ) : (
                            mockRestingMembers.map((member) => (
                                <button
                                    key={member.id}
                                    onClick={() => setSelectedMember(member)}
                                    className={`w-full flex items-center p-4 rounded-xl border transition-all ${
                                        selectedMember?.id === member.id 
                                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 dark:border-indigo-400' 
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${selectedMember?.id === member.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                                        <User size={20} />
                                    </div>
                                    <span className={`font-bold ${selectedMember?.id === member.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-white'}`}>
                                        {member.name}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="p-4 border-t dark:border-gray-700">
                        <button 
                            onClick={handleSubmitRequest}
                            disabled={!selectedMember}
                            className={`w-full py-3.5 rounded-xl font-bold text-[15px] shadow-sm transition-all 
                                ${selectedMember ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95' : 'bg-[#D1D1D6] text-gray-100 dark:bg-gray-800 cursor-not-allowed'}`}
                        >
                            교환 요청하기
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#F2F2F7] dark:bg-gray-950 p-4 relative pb-24">
            
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 mb-5 overflow-hidden">
                <div className="flex justify-between items-center p-4 bg-white dark:bg-gray-900">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">하나의 휴무일을 선택하여 교환하세요</span>
                    <button 
                        onClick={() => handleOpenCalendar('source')}
                        className="active:scale-95 transition-transform"
                    >
                        <CalendarIcon size={24} className="text-[#1E56D0] dark:text-blue-400" />
                    </button>
                </div>
                <div className="h-[1px] w-full bg-gray-100 dark:bg-gray-800"></div>
                <div className="p-4 bg-white dark:bg-gray-900">
                    <span className={`text-base tracking-widest ${sourceDate ? 'text-black dark:text-white font-bold' : 'text-gray-400'}`}>
                        {sourceDate ? sourceDate.replace(/-/g, ' / ') : '- / -- / ----'}
                    </span>
                </div>
            </div>

            <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-opacity ${sourceDate ? 'opacity-100' : 'opacity-70'}`}>
                <div className="flex justify-between items-center p-4 bg-white dark:bg-gray-900">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">신규 휴무일을 선택하세요</span>
                    <button 
                        onClick={() => handleOpenCalendar('target')}
                        disabled={!sourceDate}
                        className="active:scale-95 transition-transform"
                    >
                        <CalendarIcon size={24} className={sourceDate ? "text-[#1E56D0] dark:text-blue-400" : "text-gray-300 dark:text-gray-600"} />
                    </button>
                </div>
                <div className="h-[1px] w-full bg-gray-100 dark:bg-gray-800"></div>
                <div className="p-4 bg-white dark:bg-gray-900">
                    <span className={`text-base tracking-widest ${targetDate ? 'text-black dark:text-white font-bold' : 'text-gray-400'}`}>
                        {targetDate ? targetDate.replace(/-/g, ' / ') : '- / -- / ----'}
                    </span>
                </div>
            </div>

            <div className="absolute bottom-16 left-0 right-0 px-4 z-10">
                <button 
                    onClick={handleNext}
                    disabled={!sourceDate || !targetDate}
                    className={`w-full py-3.5 rounded-xl font-bold text-[15px] shadow-sm transition-all 
                        ${(sourceDate && targetDate) ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95' : 'bg-[#D1D1D6] text-gray-100 dark:bg-gray-800 cursor-not-allowed'}`}
                >
                    다음
                </button>
            </div>

            {isCalendarOpen && renderCalendarModal()}
            {/* ✨ 대상자 선택 모달 추가 */}
            {isMemberModalOpen && renderMemberSelectModal()}
        </div>
    );
}