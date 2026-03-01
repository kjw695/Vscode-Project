import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Calendar, CreditCard, Tag, FileText, ChevronRight, ChevronUp, ChevronDown, CheckSquare } from 'lucide-react';


// ----------------------------------------------------------------------
// ✨ 세련된 커스텀 달력 컴포넌트 (DataEntryForm에서 가져옴)
// ----------------------------------------------------------------------
const TopSheetCalendar = ({ currentDate, onClose, onSelect, isDarkMode }) => {
    const [viewDate, setViewDate] = useState(new Date(currentDate));
    const [dragY, setDragY] = useState(0); 
    const [touchStart, setTouchStart] = useState(null);
    const [touchStartY, setTouchStartY] = useState(null); 

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, []);

    const getTodayStr = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };
    const todayStr = getTodayStr();

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const handleTouchStart = (e) => {
        e.stopPropagation(); 
        setTouchStart(e.targetTouches[0].clientX);
        setTouchStartY(e.targetTouches[0].clientY);
    };

    const handleTouchMove = (e) => {
        e.stopPropagation(); 
        const currentY = e.targetTouches[0].clientY;
        const diffY = currentY - touchStartY;
        if (diffY < 0) setDragY(diffY);
    };

    const handleTouchEnd = (e) => {
        e.stopPropagation();
        const touchEnd = e.changedTouches[0].clientX;
        const distanceX = touchStart - touchEnd;

        if (Math.abs(distanceX) > 70 && Math.abs(dragY) < 30) {
            if (distanceX > 0) handleNextMonth();
            else handlePrevMonth();
        } 
        else if (dragY < -50) {
            onClose();
        }

        setDragY(0); 
        setTouchStart(null);
        setTouchStartY(null);
    };

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} />);
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isSelected = dateStr === currentDate;
        const isToday = dateStr === todayStr;
        const dayOfWeek = new Date(year, month, day).getDay();

        days.push(
            <button
                key={day}
                type="button"
                onClick={() => onSelect(dateStr)}
                className={`h-12 w-full flex items-center justify-center rounded-xl text-lg font-bold
                    ${isSelected 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : isToday 
                            ? (isDarkMode ? 'bg-blue-900/40 text-blue-400 border-2 border-blue-500' : 'bg-amber-100 text-amber-700 border-2 border-amber-400')
                            : (dayOfWeek === 0 ? 'text-red-500' : (dayOfWeek === 6 ? 'text-blue-500' : (isDarkMode ? 'text-white' : 'text-gray-700')))
                    }`}
            >
                {day}
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div 
                className={`w-full max-w-md p-6 rounded-b-3xl shadow-2xl ${isDarkMode ? 'bg-gray-900' : 'bg-white'} ${dragY === 0 ? 'transition-all duration-300 ease-out' : ''}`} 
                style={{ transform: `translateY(${dragY}px)`, touchAction: 'none' }} 
                onClick={(e) => e.stopPropagation()}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="flex items-center mb-6 relative px-1">
                    <div className="flex items-center justify-center flex-1 space-x-6">
                        <button type="button" onClick={handlePrevMonth} className="p-2 rounded-full active:bg-gray-200 dark:active:bg-gray-700"><ChevronLeft size={24} /></button>
                        <div className="relative font-black text-xl cursor-pointer">
                            {year}년 {month + 1}월
                            <input type="month" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" onChange={(e) => {
                                const [y, m] = e.target.value.split('-');
                                setViewDate(new Date(parseInt(y), parseInt(m) - 1, 1));
                            }}/>
                        </div>
                        <button type="button" onClick={handleNextMonth} className="p-2 rounded-full active:bg-gray-200 dark:active:bg-gray-700"><ChevronRight size={24} /></button>
                    </div>
                    
                    <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setViewDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }} 
                        className={`absolute right-0 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm active:scale-90 transition-transform ${isDarkMode ? 'bg-blue-900/40 text-blue-400 border border-blue-800' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}
                    >
                        오늘
                    </button>
                </div>
                
                <div className="grid grid-cols-7 mb-2 text-center text-xs font-bold uppercase tracking-widest">
                    {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                        <span key={d} className={i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'opacity-40'}>{d}</span>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 mb-4">{days}</div>
                
                <button type="button" onClick={onClose} className={`w-full py-4 rounded-xl font-bold text-lg mb-2 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>닫기</button>
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto opacity-50" />
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// 메인 할부 페이지 컴포넌트
// ----------------------------------------------------------------------
const InstallmentPage = ({ expenseConfig, isDarkMode, onBack, onApply }) => {
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });
    
    const [isCalendarOpen, setIsCalendarOpen] = useState(false); // ✨ 달력 열림 상태 추가
    const [selectedExpense, setSelectedExpense] = useState(expenseConfig?.[0]?.key || '');
    const [monthlyAmount, setMonthlyAmount] = useState('');
    const [months, setMonths] = useState(12);


const [memo, setMemo] = useState('');

    // ✨ 요일 지정 관련 상태 추가
    const [isCustomDays, setIsCustomDays] = useState(false);
    const [selectedDays, setSelectedDays] = useState([]); // [0(일), 1(월), ..., 6(토)]

    // ✨ 날짜 계산 로직 업그레이드 (n개월 동안 해당 요일이 몇 번 있는지 색출!)
    const calculateDates = (startStr, durationMonths) => {
        const dates = [];
        const start = new Date(startStr);

        if (isCustomDays) {
            if (selectedDays.length === 0) return []; 
            const endDate = new Date(start);
            endDate.setMonth(endDate.getMonth() + durationMonths);
            let d = new Date(start);
            let maxSafe = 4000;

            while (d < endDate && maxSafe > 0) {
                if (selectedDays.includes(d.getDay())) {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    dates.push(`${y}-${m}-${day}`);
                }
                d.setDate(d.getDate() + 1); 
                maxSafe--;
            }
        } else {
            const startDay = start.getDate();
            for (let i = 0; i < durationMonths; i++) {
                const d = new Date(start.getFullYear(), start.getMonth() + i, startDay);
                const expectedMonth = (start.getMonth() + i) % 12;
                if (d.getMonth() !== expectedMonth) d.setDate(0); 
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                dates.push(`${y}-${m}-${day}`);
            }
        }
        return dates;
    };

    const previewDates = useMemo(() => {
        if (!startDate || Number(months) < 1) return [];
        return calculateDates(startDate, Number(months));
    }, [startDate, months, isCustomDays, selectedDays]);

    const totalAmount = useMemo(() => {
        if (isCustomDays) return (Number(monthlyAmount) || 0) * previewDates.length;
        return (Number(monthlyAmount) || 0) * (Number(months) || 0);
    }, [monthlyAmount, months, isCustomDays, previewDates.length]);

    const handleSubmit = () => {
        if (!selectedExpense) return alert('지출 항목을 선택해주세요.');
        if (!monthlyAmount || Number(monthlyAmount) <= 0) return alert('결제할 금액을 입력해주세요.');
        if (!months || Number(months) < 1) return alert('기간은 1개월 이상이어야 합니다.');
        if (isCustomDays && selectedDays.length === 0) return alert('반복할 요일을 하나 이상 선택해주세요.');

        const dates = previewDates; 
        const groupId = `installment-${Date.now()}`; 

        const entriesToSave = dates.map((dateStr, index) => {
            return {
                type: 'expense',
                date: dateStr,
                customItems: [{
                    type: 'expense',
                    key: selectedExpense,
                    name: expenseConfig.find(e => e.key === selectedExpense)?.label || selectedExpense,
                    amount: Number(monthlyAmount),
                    count: 1,
                    unitPrice: 0
                }],
                memo: memo ? `${memo} (${index + 1}/${dates.length}회차)` : `${isCustomDays ? '정기결제' : '할부'} (${index + 1}/${dates.length}회차)`,
                groupId: groupId 
            };
        });

        onApply(entriesToSave); 
    };

    const toggleDay = (dayIndex) => {
        setSelectedDays(prev => prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex].sort());
    };

    const getSummaryCycleText = () => {
        if (isCustomDays) {
            if (selectedDays.length === 0) return <span className="text-red-500">요일 미선택</span>;
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            return `매주 ${selectedDays.map(d => dayNames[d]).join(', ')}요일`;
        }
        return `매월 ${new Date(startDate).getDate()}일`;
    };

   const inputClasses = `w-full p-3 rounded-lg border text-lg ${
        isDarkMode ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
    } outline-none transition-colors`;

    // ✨ 날짜를 보기 좋게 포맷팅하고 요일까지 자동으로 붙여줍니다 (예: 2026. 03. 20. (금))
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const displayDate = `${startDate.split('-').join('. ')}. (${dayNames[new Date(startDate).getDay()]})`;

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>

            {/* ✨ 커스텀 모달 달력 */}
            {isCalendarOpen && (
                <TopSheetCalendar 
                    currentDate={startDate} 
                    onClose={() => setIsCalendarOpen(false)} 
                    onSelect={(newDate) => { setStartDate(newDate); setIsCalendarOpen(false); }}
                    isDarkMode={isDarkMode}
                />
            )}

           {/* 상단 헤더 */}
            {/* ✨ items-center 를 items-end 로 변경하고, px-4 pb-3 pt-10 으로 위쪽 여백을 넉넉히 줍니다. */}
            <div className={`flex items-end justify-between px-4 pb-3 pt-10 shadow-sm ${isDarkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-200'}`}>
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <ChevronLeft size={24} />
                </button>
                {/* ✨ 글씨가 버튼과 자연스럽게 바닥 라인이 맞도록 mb-1 추가 */}
                <h2 className="text-xl font-bold mb-1">고정 지출 / 할부 등록</h2>
                <div className="w-10"></div>
            </div>

            {/* 입력 폼 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
             {/* 1 & 2. 항목 선택과 결제 시작일을 한 줄(Grid)로 반반 배치 */}
                <div className="grid grid-cols-2 gap-3">
                    {/* 왼쪽: 지출 항목 선택 */}
                    <div className="space-y-2">
                        {/* ✨ 라벨(제목) 글자 및 아이콘 크기 확대 */}
                        <label className="flex items-center text-base sm:text-lg font-bold text-gray-500 dark:text-gray-400 tracking-tighter">
                            <Tag size={18} className="mr-1 flex-shrink-0"/> 지출 항목
                        </label>
                        {/* ✨ 항목 이름 글자 크기 2단계 확대 (text-lg sm:text-xl) */}
                        <select value={selectedExpense} onChange={(e) => setSelectedExpense(e.target.value)} className={`${inputClasses} h-[50px] !py-0 pl-4 pr-2 sm:pl-5 sm:pr-3 text-lg sm:text-xl font-bold`}>
                            {expenseConfig.map(item => (
                                <option key={item.key} value={item.key}>{item.label}</option>
                            ))}
                        </select>
                    </div>

{/* 오른쪽: 첫 결제일 */}
                    <div className="space-y-2">
                        <label className="flex items-center text-base sm:text-lg font-bold text-gray-500 dark:text-gray-400 tracking-tighter">
                            <Calendar size={18} className="mr-1 flex-shrink-0"/> 첫 결제일
                        </label>
                        <button 
                            type="button"
                            onClick={() => setIsCalendarOpen(true)}
                            // ✨ 수정 1: pl-4 -> px-2 로 변경하여 날짜 앞의 불필요한 빈 공간을 싹 삭제했습니다!
                            className={`${inputClasses} h-[50px] !py-0 px-2 pr-9 sm:px-3 flex items-center justify-start relative`}
                        >
                            {/* ✨ 수정 2: whitespace-nowrap 추가로 무조건 한 줄 고정, 폰트 크기 살짝 최적화 */}
                            <span className="font-bold text-lg sm:text-lg tracking-tighter whitespace-nowrap">{displayDate}</span>
                            <Calendar size={20} className="text-gray-400 absolute right-2" />
                        </button>
                    </div>
                </div>


               
            {/* 3 & 4. 결제 금액과 할부 기간을 반반(1:1) 비율로 나란히 배치 */}
                <div className="grid grid-cols-2 gap-3">
                    {/* 왼쪽: 매월 결제액 */}
                    <div className="space-y-2">
                        <label className="flex items-center text-base sm:text-lg font-bold text-gray-500 dark:text-gray-400 tracking-tighter">
                            <CreditCard size={18} className="mr-1 flex-shrink-0"/> 매월 결제액
                        </label>
                        <div>
                            <div className="relative">
                                <input type="number" inputMode="numeric" pattern="[0-9]*" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} placeholder="0" className={`${inputClasses} h-[50px] !py-0 pl-2 pr-8 sm:pr-10 text-right font-bold text-lg sm:text-xl`} />
                                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold text-base sm:text-lg">원</span>
                            </div>
                            <div className="h-5 text-right text-sm font-bold mt-1 pr-4 text-blue-600 dark:text-blue-400 tracking-tighter">
                                {monthlyAmount && Number(monthlyAmount) > 0 ? `${Number(monthlyAmount).toLocaleString()} 원` : '\u00A0'}
                            </div>
                        </div>
                    </div>

                  {/* 오른쪽: 할부 기간 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center text-base sm:text-lg font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap tracking-tighter">
                                <Calendar size={18} className="mr-1 flex-shrink-0"/> 기간
                            </label>
                            <label className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-blue-600 dark:text-blue-400 cursor-pointer select-none">
                                <input 
                                    type="checkbox" checked={isCustomDays} onChange={(e) => setIsCustomDays(e.target.checked)} 
                                    className="w-4 h-4 sm:w-5 sm:h-5 accent-blue-600 rounded cursor-pointer" 
                                />
                                요일 지정
                            </label>
                        </div>
                        <div>
                            {/* ✨ onContextMenu 밎 -webkit-touch-callout 추가: 
                                박스 전체를 길게 눌렀을 때 뜨는 시스템 팝업을 차단합니다. */}
                            <div 
                                className="relative select-none [-webkit-touch-callout:none]"
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                {/* ✨ input 자체에도 복사 방지 코드 완벽 적용 */}
                                <input 
                                    type="number" 
                                    inputMode="numeric" 
                                    pattern="[0-9]*" 
                                    value={months} 
                                    onChange={(e) => setMonths(e.target.value)} 
                                    min="1" max="120" 
                                    className={`${inputClasses} h-[50px] !py-0 px-2 pr-[75px] sm:pr-[80px] text-right font-bold text-lg sm:text-xl select-none [-webkit-touch-callout:none]`} 
                                    onContextMenu={(e) => e.preventDefault()}
                                />
                                
                                <span className="absolute right-[36px] sm:right-[40px] top-1/2 transform -translate-y-1/2 text-gray-500 font-bold text-base sm:text-lg pointer-events-none select-none">개월</span>
                                
                                <div className="absolute right-1 top-1 bottom-1 flex flex-col items-center justify-center gap-0.5 select-none touch-manipulation">
                                    <button 
                                        type="button" 
                                        onPointerDown={(e) => e.preventDefault()} 
                                        onClick={() => setMonths(prev => String(Math.min(120, (Number(prev) || 0) + 1)))}
                                        className="flex items-center justify-center w-7 h-[21px] rounded bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 active:scale-90 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-blue-900 transition-colors select-none"
                                    >
                                        <ChevronUp size={16} strokeWidth={3} />
                                    </button>
                                    <button 
                                        type="button" 
                                        onPointerDown={(e) => e.preventDefault()} 
                                        onClick={() => setMonths(prev => String(Math.max(1, (Number(prev) || 0) - 1)))}
                                        className="flex items-center justify-center w-7 h-[21px] rounded bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 active:scale-90 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-blue-900 transition-colors select-none"
                                    >
                                        <ChevronDown size={16} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                            
                            {/* 하단 1, 3, 6 빠른 선택 버튼 */}
                            <div className="h-5 flex gap-1 mt-1 justify-end items-start">
                                {[1, 3, 6].map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setMonths(m.toString())}
                                        className={`flex-1 py-0.5 text-[11px] font-bold border rounded shadow-sm transition-colors ${
                                            Number(months) === m 
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                                        }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
{/* ✨ 요일 지정 체크 시 나타나는 패널 */}
                    {isCustomDays && (
                        <div className="col-span-2 p-3 mt-1 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 animate-in fade-in slide-in-from-top-2">
                            <label className="block text-xs font-bold text-blue-800 dark:text-blue-300 mb-2 text-center">결제할 요일을 모두 선택해주세요</label>
                            <div className="flex justify-between gap-1">
                                {['일', '월', '화', '수', '목', '금', '토'].map((dayStr, idx) => (
                                    <button
                                        key={idx} type="button" onClick={() => toggleDay(idx)}
                                        className={`flex-1 aspect-square rounded-full font-bold text-sm sm:text-base flex items-center justify-center transition-colors shadow-sm ${
                                            selectedDays.includes(idx) ? 'bg-blue-600 text-white' : (isDarkMode ? 'bg-gray-800 text-gray-400 border border-gray-700' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100')
                                        } ${idx === 0 ? (selectedDays.includes(idx) ? '' : 'text-red-500 dark:text-red-400') : idx === 6 ? (selectedDays.includes(idx) ? '' : 'text-blue-500 dark:text-blue-400') : ''}`}
                                    >
                                        {dayStr}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* 5. 메모 */}
                <div className="space-y-2">
                    <label className="flex items-center text-sm font-bold text-gray-500 dark:text-gray-400">
                        <FileText size={16} className="mr-1"/> 메모 내용 (선택)
                    </label>
                    <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예) 차량 대출금 , 자동차보험 12개월 할부" className={inputClasses} />
                </div>
{/* 요약 카드 */}
                <div className={`p-4 rounded-xl mt-4 ${isDarkMode ? 'bg-blue-900/30 border border-blue-800' : 'bg-blue-50 border border-blue-100'}`}>
                    <h3 className={`font-bold mb-3 flex items-center gap-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-800'}`}>
                        <CheckSquare size={18} /> 결제 일정 요약
                    </h3>
                    <div className="space-y-2 text-sm sm:text-base">
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">결제 주기</span>
                            <span className="font-semibold text-right">
                                {getSummaryCycleText()} 
                                {!isCustomDays && <span className="text-xs text-gray-400 font-normal ml-1">(말일 자동조절)</span>}
                            </span>
                        </div>
                        <div className="flex justify-between items-start mt-2">
                            <span className="text-gray-500 dark:text-gray-400">진행 기간</span>
                            {/* ✨ 텍스트가 한 줄로 유지되도록 수정했습니다 */}
                            <span className="font-semibold text-right leading-snug whitespace-nowrap">
                                {previewDates.length > 0 ? (
                                    <>
                                        {/* ✨ <br className="sm:hidden"/>를 제거하여 날짜를 한 줄로 이어줍니다 */}
                                        {previewDates[0]} ~ {previewDates[previewDates.length - 1]}
                                        {isCustomDays && <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">(총 {previewDates.length}회 결제 예정)</div>}
                                    </>
                                ) : '-'}
                            </span>
                        </div>
                        <div className="flex justify-between pt-3 mt-1 border-t border-blue-200 dark:border-blue-800">
                            <span className="text-gray-500 dark:text-gray-400">총 지출 예정액</span>
                            <span className="font-bold text-lg text-red-500">{totalAmount.toLocaleString()}원</span>
                        </div>
                    </div>
                </div>

                {/* 여백 확보 */}
                <div className="h-2"></div>
            </div>

       {/* 하단 고정 버튼 */}
            <div className={`p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex gap-3 z-[110] ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
                <button 
                    type="button"
                    onClick={onBack}
                    className={`w-1/3 py-4 rounded-xl font-bold text-lg transition-colors shadow-sm border ${
                        isDarkMode ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                    }`}
                >
                    취소
                </button>
                <button 
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
                >
                    {months}개월 동안 {isCustomDays ? '지정일 결제' : '할부'}
                </button>
            </div>
        </div>
    );
};

export default InstallmentPage;