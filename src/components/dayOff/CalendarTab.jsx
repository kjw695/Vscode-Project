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

    // ✨ 특정 날짜가 myOffDate와 같은 주(일~토)인지 확인하는 함수
    const isSameWeek = (targetStr) => {
        if (!myOffDate) return false;
        const myDate = new Date(myOffDate);
        const tDate = new Date(targetStr);
        
        const sunday = new Date(myDate);
        sunday.setDate(sunday.getDate() - sunday.getDay()); // 일요일
        const saturday = new Date(sunday);
        saturday.setDate(saturday.getDate() + 6); // 토요일
        
        return tDate >= sunday && tDate <= saturday;
    };

    // ✨ 날짜 클릭 로직 (팀 소속 시 교환 프로세스로 작동)
    const toggleDate = async (dateStr) => {
        if (!teamId) {
            // 팀이 없는 개인이면 기존처럼 휴무 등록/삭제
            setSelectedDates(prev => 
                prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
            );
            return;
        }

        // [팀원] 교환 프로세스 1단계: 내 휴무 선택
        if (exchangeStep === 0) {
            if (!existingDayOffs[dateStr]) {
                showMessage("❌ 본인의 휴무일만 선택할 수 있습니다.");
                return;
            }
            setMyOffDate(dateStr);
            return;
        }

        // [팀원] 교환 프로세스 2단계: 바꿀 날짜 선택
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
            setExchangeStep(2); // 3단계(팀원 조회)로 넘어감
            
            // 데이터베이스에서 해당 날짜를 휴무로 가진 팀원 조회 (예시 로직)
            setIsFetchingMembers(true);
            try {
                // 실제 구현 시: 해당 날짜(targetDate)에 휴무(entries)가 있는 팀원을 조회하는 로직 필요
                // 임시로 가짜 데이터 세팅 (추후 백엔드 연결 필요)
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

    // ✨ 최종 교환 신청 보내기
    const handleSubmitExchange = async (receiverId) => {
        try {
            // DB의 shift_exchanges 테이블에 저장
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
            if (onNavigateToExchange) onNavigateToExchange(); // 교환 현황 탭으로 자동 이동
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

    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(<div key={`empty-${i}`} className="w-full h-9" />);

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
        
        // 상태별 UI 스타일링 (내 휴무, 타겟 날짜, 같은 주 하이라이트)
        const isMyOffDate = dateStr === myOffDate;
        const isTargetDate = dateStr === targetDate;
        const inSameWeek = exchangeStep === 1 && isSameWeek(dateStr);
        const isDimmed = exchangeStep === 1 && !inSameWeek;

        let textColor = isDarkMode ? 'text-gray-300' : 'text-gray-700';
        if (dayOfWeek === 0) textColor = 'text-red-500';
        else if (dayOfWeek === 6) textColor = 'text-blue-500';
        if (isDimmed) textColor = 'text-gray-200 opacity-30'; // 선택 불가능한 날짜 흐리게

        const bgClass = isDarkMode ? 'bg-gray-800' : 'bg-gray-100';

        days.push(
            <div key={dateStr} className="w-full flex items-center justify-center h-9 relative">
                {/* 같은 주 표시용 배경 (교환 2단계일 때) */}
                {inSameWeek && !isMyOffDate && (
                    <div className="absolute inset-0 bg-green-100 dark:bg-green-900 opacity-30 rounded" />
                )}
                
                <button 
                    onClick={() => toggleDate(dateStr)}
                    disabled={isDimmed} // 비활성화
                    style={{ WebkitAppearance: 'none' }} 
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold p-0 m-0 leading-none transition-all relative z-10
                    ${isSelected ? 'bg-indigo-600 text-white shadow-md' : `${bgClass}${textColor}`}
                    ${isToday ? 'border-[2px] border-yellow-400' : ''} 
                    ${isMyOffDate ? 'ring-4 ring-indigo-300 scale-110' : ''}
                    ${isTargetDate ? 'ring-4 ring-green-300 bg-green-500 text-white scale-110' : ''}
                    `}
                >
                    {currentDate.getDate()}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* 달력 헤더 생략 (기존과 동일) */}
            <div className="flex items-center justify-between mb-3 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 rounded-xl">
                <button onClick={() => setCurrentViewDate(new Date(year, month - 1, 1, 12, 0, 0))} className="p-1"><ChevronLeft size={18}/></button>
                <div className="flex flex-col items-center">
                    <span className="font-black text-sm">{year}년 {month + 1}월</span>
                    <span className="text-[9px] text-gray-400">({sDay}일~{eDay}일 집계)</span>
                </div>
                <button onClick={() => setCurrentViewDate(new Date(year, month + 1, 1, 12, 0, 0))} className="p-1"><ChevronRight size={18}/></button>
            </div>
            
            <div className="grid grid-cols-7 mb-1 text-center text-[11px] font-black uppercase w-full">
                <div className="text-red-500">일</div><div className="text-gray-500">월</div><div className="text-gray-500">화</div>
                <div className="text-gray-500">수</div><div className="text-gray-500">목</div><div className="text-gray-500">금</div><div className="text-blue-500">토</div>
            </div>
            
            <div className="grid grid-cols-7 gap-y-1 w-full mb-4">
                {days}
            </div>
            
            {/* ✨ 하단 컨트롤 패널 */}
            <div className="mt-auto">
                {teamId ? (
                    <div className="flex flex-col space-y-2">
                        {exchangeStep === 0 && (
                            <button 
                                onClick={() => setExchangeStep(1)} 
                                disabled={!myOffDate}
                                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${myOffDate ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-400'}`}
                            >
                                {myOffDate ? `${myOffDate} 휴무 교환하기` : '내 휴무를 먼저 선택해주세요'}
                            </button>
                        )}

                        {exchangeStep === 1 && (
                            <div className="text-center p-3 bg-indigo-50 dark:bg-gray-800 rounded-xl">
                                <p className="text-sm font-bold text-indigo-600 mb-2">어느 날짜로 바꾸시겠어요?</p>
                                <p className="text-xs text-gray-500 mb-3">초록색으로 표시된 같은 주(일~토)만 선택 가능합니다.</p>
                                <button onClick={() => { setExchangeStep(0); setMyOffDate(null); }} className="text-xs text-gray-400 underline">처음부터 다시하기</button>
                            </div>
                        )}

                        {exchangeStep === 2 && (
                            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                <div className="flex justify-between items-center mb-4 border-b pb-2">
                                    <span className="text-sm font-bold">{targetDate} 휴무자 목록</span>
                                    <button onClick={() => { setExchangeStep(1); setTargetDate(null); }} className="text-xs text-indigo-500">날짜 다시 선택</button>
                                </div>
                                
                                {isFetchingMembers ? (
                                    <div className="text-center text-sm text-gray-500 py-4">목록을 불러오는 중...</div>
                                ) : availableMembers.length === 0 ? (
                                    <div className="text-center text-sm text-gray-500 py-4">해당 날짜에 쉬는 팀원이 없습니다.</div>
                                ) : (
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {availableMembers.map(member => (
                                            <div key={member.id} className="flex justify-between items-center p-2 bg-white dark:bg-gray-700 rounded shadow-sm">
                                                <span className="text-sm font-bold">{member.name}</span>
                                                <button 
                                                    onClick={() => handleSubmitExchange(member.id)}
                                                    className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg"
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
                    // 개인 사용자(팀 없음)의 휴무 저장 버튼
                    <button 
                        onClick={handleProcessSave} 
                        disabled={!hasChanges}
                        className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all ${hasChanges ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}
                    >
                        {toAdd.length > 0 || toRemove.length > 0 ? '변경사항 저장하기' : '변경사항 없음'}
                    </button>
                )}
            </div>
        </div>
    );
}