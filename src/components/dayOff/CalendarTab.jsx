/* src/
└── components/
  └── dayOff/
       ├── DayOffModal.jsx    (메인 컨테이너: 탭 전환 및 공통 껍데기)
       ├── CalendarTab.jsx    (1탭: 휴무 지정 달력 화면)
    ├── PreferredTab.jsx   (2탭: 선호 휴무일 설정 화면)
       ├── ExchangeTab.jsx    (3탭: 휴무 교환 마켓 메인 화면)
       │
       │   --- 아래는 ExchangeTab.jsx 내부에서만 사용되는 하위 컴포넌트 --- 
       ├── MyExchange.jsx     (3탭 상단 영역: 내 교환 현황 및 등록)
      ├── ExchangeFeed.jsx   (3탭 하단 영역: 팀원들의 휴무 교환 마켓 피드)
      └── RequestModal.jsx   (3탭 기능: 교환 신청 시 띄우는 모달)*/
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDelivery } from '../../contexts/DeliveryContext';
import { supabase } from '../../lib/supabaseClient'; // ✨ Supabase 추가
import Holidays from 'date-holidays';



// ✨ [여기 1] 함수와 인스턴스 선언
const getUserCountryCode = () => {
    try {
        const locale = navigator.language || 'ko-KR'; 
        return locale.split('-')[1] || 'KR'; 
    } catch (e) {
        return 'KR'; 
    }
};

const hd = new Holidays(getUserCountryCode());

const checkIsHoliday = (dateStr) => {
    return hd.isHoliday(new Date(dateStr)) ? true : false;
};


export default function CalendarTab({ 
    isDarkMode, showMessage, monthlyStartDay, monthlyEndDay, selectedMonth, onClose,
    teamId, currentUser, onNavigateToExchange 
}) {
    const { entries, saveEntry, deleteEntry } = useDelivery();

    // 달력 렌더링용 날짜 상태
    const [currentViewDate, setCurrentViewDate] = useState(() => {
        if (selectedMonth) {
            const [y, m] = selectedMonth.split('-').map(Number);
            return new Date(y, m - 1, 1, 12, 0, 0); 
        }
        return new Date();
    });

    const [selectedDates, setSelectedDates] = useState([]);
    
    // ✨ 교환 프로세스 전용 상태들
    const [exchangeStep, setExchangeStep] = useState(0); 
    // 0: 내 휴무 선택 대기, 1: 바꿀 날짜(타겟) 선택 대기, 2: 대상자 선택 대기
    const [myOffDate, setMyOffDate] = useState(null);     // 내가 포기할 내 휴무
    const [targetDate, setTargetDate] = useState(null);   // 내가 받고 싶은 날짜
    const [availableMembers, setAvailableMembers] = useState([]); // 해당 날짜 휴무자 목록
    const [isFetchingMembers, setIsFetchingMembers] = useState(false);

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

    // 집계 기간 계산
    let periodStartDate, periodEndDate;
    if (sDay > eDay) {
        periodStartDate = new Date(year, month - 1, sDay, 12, 0, 0);
        periodEndDate = new Date(year, month, eDay, 12, 0, 0);
    } else {
        periodStartDate = new Date(year, month, sDay, 12, 0, 0);
        periodEndDate = new Date(year, month, eDay, 12, 0, 0);
    }

    // ✨ 1. 달력 칸 그리기: 빈칸을 그리지 않고 일요일부터 토요일까지 풀(Full)로 채우기 위한 날짜 계산
    const calendarStartDate = new Date(periodStartDate);
    calendarStartDate.setDate(calendarStartDate.getDate() - calendarStartDate.getDay()); // 시작주의 일요일

    const calendarEndDate = new Date(periodEndDate);
    if (calendarEndDate.getDay() !== 6) {
        calendarEndDate.setDate(calendarEndDate.getDate() + (6 - calendarEndDate.getDay())); // 마지막 주의 토요일
    }

    // ✨ 특정 날짜가 myOffDate와 같은 주(일~토)인지 확인하는 함수
    const isSameWeek = (targetStr) => {
        if (!myOffDate) return false;
        const myDate = new Date(myOffDate);
        const tDate = new Date(targetStr);
        
        const sunday = new Date(myDate);
        sunday.setDate(sunday.getDate() - sunday.getDay()); 
        const saturday = new Date(sunday);
        saturday.setDate(saturday.getDate() + 6); 
        
        return tDate >= sunday && tDate <= saturday;
    };

    // ✨ 날짜 클릭 로직
    const toggleDate = async (dateStr) => {
        if (!teamId) {
            setSelectedDates(prev => 
                prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
            );
            return;
        }

        if (exchangeStep === 0) {
            if (!existingDayOffs[dateStr]) {
                showMessage("❌ 본인의 휴무일만 선택할 수 있습니다.");
                return;
            }
            setMyOffDate(dateStr);
            return;
        }

        if (exchangeStep === 1) {
            if (dateStr === myOffDate) {
                showMessage("❌ 같은 날짜입니다. 다른 날짜를 선택하세요.");
                return;
            }
            if (!isSameWeek(dateStr)) {
                showMessage("❌ 교환은 같은 주(일~토) 안에서만 가능합니다.");
                return;
            }
            
            setTargetDate(dateStr);
            setExchangeStep(2); 
            
            setIsFetchingMembers(true);
            try {
                // TODO: 추후 관리자 센터 연동 시 실제 해당 날짜 휴무자 로드
                setAvailableMembers([
                    { id: 'user_1', name: '김동료' },
                    { id: 'user_2', name: '이팀장' }
                ]);
            } catch (error) {
                console.error(error);
                showMessage("❌ 팀원 정보를 불러오지 못했습니다.");
            } finally {
                setIsFetchingMembers(false);
            }
            return;
        }
    };

    const handleSubmitExchange = async (receiverId) => {
        try {
            const { error } = await supabase.from('shift_exchanges').insert({
                requester_id: currentUser.id,
                receiver_id: receiverId,
                team_id: teamId,
                source_date: myOffDate,
                target_date: targetDate,
                status: 'pending'
            });

            if (error) throw error;

            showMessage("✅ 교환 신청이 완료되었습니다.");
            if (onNavigateToExchange) onNavigateToExchange(); 
        } catch (error) {
            console.error(error);
            showMessage("❌ 신청 중 오류가 발생했습니다.");
        }
    };

    const toAdd = selectedDates.filter(date => !existingDayOffs[date]);
    const toRemove = Object.keys(existingDayOffs).filter(date => !selectedDates.includes(date));
    const hasChanges = toAdd.length > 0 || toRemove.length > 0;

    const handleProcessSave = () => {
        if (!hasChanges) return;
        toAdd.forEach(dateStr => {
            saveEntry({
                type: 'income', date: dateStr, memo: '[휴무]', round: 0,
                customItems: [{ key: 'dayOff', name: '휴무', amount: 0, count: 1, type: 'income', unitPrice: 0 }]
            });
        });
        toRemove.forEach(dateStr => {
            if (deleteEntry) deleteEntry(existingDayOffs[dateStr]);
        });
        showMessage(`✅ 휴무 업데이트 완료`);
        onClose();
    };

    // ✨ 달력 렌더링 배열 생성
    const days = [];
    let dayIterator = new Date(calendarStartDate);

    while (dayIterator <= calendarEndDate) {
        const y = dayIterator.getFullYear();
        const m = String(dayIterator.getMonth() + 1).padStart(2, '0');
        const d = String(dayIterator.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        
        const dayOfWeek = dayIterator.getDay();
        const isToday = dateStr === todayStr;
        const inPeriod = dayIterator >= periodStartDate && dayIterator <= periodEndDate; // 집계 기간 내 여부
        
        const isSelected = selectedDates.includes(dateStr); // 개인모드 선택
        const isMyOffDate = dateStr === myOffDate;
        const isTargetDate = dateStr === targetDate;
        
        // 4. 선택(터치) 상태 여부 종합 확인
        const isTouched = isSelected || isMyOffDate || isTargetDate;

        // 4. 오늘/선택 시 배경색 (A방식: 칸 전체 색칠)
        let bgClass = isDarkMode ? 'bg-gray-800' : 'bg-white';
        if (isToday) {
            bgClass = isDarkMode ? 'bg-green-900/60' : 'bg-green-100';  // 오늘 날짜 연한 노랑
        } else if (isTouched) {
            bgClass = isDarkMode ? 'bg-orange-900/60' : 'bg-orange-100'; // 선택 시 연한 주황
        }

     // ✨ 일요일 또는 공휴일일 때만 빨간색 적용
        const isHoliday = checkIsHoliday(dateStr);

        let dateColor = isDarkMode ? 'text-gray-300' : 'text-gray-700';
        
        if (dayOfWeek === 0 || isHoliday) {
            dateColor = 'text-red-500';
        } else if (dayOfWeek === 6) {
            dateColor = 'text-blue-500';
        }

        // ✨ 1. 과거 날짜인지, 집계 기간 밖인지 통합 체크
        const isPastDate = dateStr < todayStr;
        const isOutOfScope = !inPeriod || isPastDate;

        // 집계 기간 밖이거나 지난 날짜는 글씨를 흐리게
        if (isOutOfScope) {
            dateColor = isDarkMode ? 'text-gray-600' : 'text-gray-400';
        }
        
        // 교환 단계 Dim 처리 (다른 주는 비활성화)
        const inSameWeek = exchangeStep === 1 && isSameWeek(dateStr);
        const isDimmed = exchangeStep === 1 && !inSameWeek && !isMyOffDate;

        // 근무일 표시 데이터 (추후 관리자 센터 연동)
        const shiftType = '주간'; 
        const routeName = teamId ? '라우트' : '배송';

       days.push(
            <div 
                key={dateStr} 
                onClick={() => !isDimmed && toggleDate(dateStr)}
                // ✨ justify-center를 제거하여 날짜 숫자가 항상 칸의 맨 위에 일자로 고정되도록 수정 (여백 p-1 추가)
                className={`flex flex-col items-center pt-3 pb-1 px-1 h-full w-full border-b border-r transition-colors relative
                ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} 
                ${bgClass} 
                ${isDimmed ? 'opacity-20' : ''} 
                ${isOutOfScope ? 'opacity-40 grayscale-[30%]' : ''}`} 
            >
                {/* 같은 주 표시용 연한 초록색 배경 (교환 2단계일 때) */}
                {inSameWeek && !isMyOffDate && !isTargetDate && (
                    <div className="absolute inset-0 bg-green-100 dark:bg-green-900 opacity-20 pointer-events-none" />
                )}

                {/* ✨ 날짜 숫자 (상단에 찰싹 붙어서 일렬로 고정됨) */}
                <span className={`text-[13px] font-bold ${dateColor}`}>{dayIterator.getDate()}</span>

                {/* ✨ 내용물 래퍼: 남은 공간(flex-1)을 모두 차지하고, 그 안에서 내용물만 중앙(justify-center) 정렬 */}
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                    {isSelected || existingDayOffs[dateStr] ? (
                        // 휴무일 표시: ○ 휴무
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                            <span className="text-gray-300 dark:text-gray-600">○</span> 휴무
                        </span>
                    ) : (
                        // 근무일 표시: 주간/야간 배지 + 라우트명
                        <>
                            <span className="text-[9px] font-bold px-1.5 py-[2px] bg-[#E5E7FF] text-[#4F46E5] dark:bg-indigo-900/50 dark:text-indigo-300 rounded-full mb-0.5">
                                {shiftType}
                            </span>
                            <span className={`text-[10px] font-bold truncate w-full text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>
                                {routeName}
                            </span>
                        </>
                    )}
                </div>
            </div>
        );

        dayIterator.setDate(dayIterator.getDate() + 1); // 다음 날로 이동
    }

    return (
        <div className="flex flex-col h-full pb-4">
            {/* 달력 헤더 (상단 여백 최소화) */}
            <div className="flex items-center justify-between mb-1 px-1 py-1">
                <button 
                    onClick={() => setCurrentViewDate(new Date(year, month - 1, 1, 12, 0, 0))} 
                    className="p-1.5 opacity-80 hover:opacity-100 transition-opacity active:scale-95"
                >
                    <ChevronLeft size={22}/>
                </button>
                <div className="flex items-center justify-center">
                    <span className="font-black text-base tracking-tight">{year}년 {month + 1}월</span>
                </div>
                <button 
                    onClick={() => setCurrentViewDate(new Date(year, month + 1, 1, 12, 0, 0))} 
                    className="p-1.5 opacity-80 hover:opacity-100 transition-opacity active:scale-95"
                >
                    <ChevronRight size={22}/>
                </button>
            </div>
            
            {/* 요일 헤더 */}
            <div className={`grid grid-cols-7 mb-0 text-center text-[11px] font-black uppercase w-full py-1.5 border-y ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                <div className="text-red-500">일</div><div className="text-gray-500">월</div><div className="text-gray-500">화</div>
                <div className="text-gray-500">수</div><div className="text-gray-500">목</div><div className="text-gray-500">금</div><div className="text-blue-500">토</div>
            </div>
            
            {/* 달력 그리드 박스 */}
            <div className={`grid grid-cols-7 flex-1 auto-rows-fr w-full border-t border-l ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                {days}
            </div>

            {/* 하단 안내 범례 (Legend) */}
            <div className={`flex flex-wrap gap-4 px-2 py-2 text-[11px] font-bold mt-1
                ${isDarkMode ? 'text-gray-400 border-gray-700' : 'text-gray-600 border-gray-200'}
            `}>
                <div className="flex items-center gap-1"><span className="text-green-500">●</span> 휴가</div>
                <div className="flex items-center gap-1"><span className="text-gray-300 dark:text-gray-500">○</span> 휴무</div>
                <div className="flex items-center gap-1"><span className="text-red-500">■</span> 승인필요</div>
            </div>
            
            {/* ✨ 하단 내비게이션 바 위에 항상 떠 있는 플로팅 컨트롤 패널 */}
            <div className="absolute bottom-16 left-0 right-0 px-4 py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-20 shadow-lg border-t border-gray-100 dark:border-gray-800">
                {teamId ? (
                    <div className="flex flex-col space-y-2">
                        {exchangeStep === 0 && (
                            <button 
                                onClick={() => setExchangeStep(1)} 
                                disabled={!myOffDate}
                                className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-md ${myOffDate ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                            >
                                {myOffDate ? `${myOffDate} 휴무 교환하기` : '내 휴무일을 먼저 선택해주세요'}
                            </button>
                        )}

                        {exchangeStep === 1 && (
                            <div className="text-center p-2.5 bg-indigo-50 dark:bg-gray-800 rounded-xl">
                                <p className="text-xs font-bold text-indigo-600 mb-1">어느 날짜로 바꾸시겠어요?</p>
                                <p className="text-[11px] text-gray-500 mb-2">초록색으로 표시된 같은 주(일~토)만 선택 가능합니다.</p>
                                <button onClick={() => { setExchangeStep(0); setMyOffDate(null); }} className="text-xs text-gray-400 underline">처음부터 다시하기</button>
                            </div>
                        )}

                        {exchangeStep === 2 && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl shadow-inner">
                                <div className="flex justify-between items-center mb-2 border-b pb-1.5">
                                    <span className="text-xs font-bold">{targetDate} 휴무자 목록</span>
                                    <button onClick={() => { setExchangeStep(1); setTargetDate(null); }} className="text-xs text-indigo-500">날짜 다시 선택</button>
                                </div>
                                
                                {isFetchingMembers ? (
                                    <div className="text-center text-xs text-gray-500 py-2">목록을 불러오는 중...</div>
                                ) : availableMembers.length === 0 ? (
                                    <div className="text-center text-xs text-gray-500 py-2">해당 날짜에 쉬는 팀원이 없습니다.</div>
                                ) : (
                                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                        {availableMembers.map(member => (
                                            <div key={member.id} className="flex justify-between items-center p-1.5 bg-white dark:bg-gray-700 rounded shadow-sm">
                                                <span className="text-xs font-bold">{member.name}</span>
                                                <button 
                                                    onClick={() => handleSubmitExchange(member.id)}
                                                    className="px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded-lg"
                                                >
                                                    교환 신청
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <button 
                        onClick={handleProcessSave} 
                        disabled={!hasChanges}
                        className={`w-full py-3 rounded-lg font-bold text-sm shadow-md transition-all ${hasChanges ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-500'}`}
                    >
                        {toAdd.length > 0 || toRemove.length > 0 ? '변경사항 저장하기' : '변경사항 없음'}
                    </button>
                )}
            </div>
        </div>
    );
}