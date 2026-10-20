/* 관리자페이지 구조
src/admin/
 ├── Main.jsx                    # 👑 [메인 컨테이너] 전역 상태 관리 및 레이아웃 (헤더, 사이드바 포함)
 │
 ├── components/                 # 🧩 [공통 UI 부품] 여러 페이지에서 재사용할 작은 조각들
 │    ├── AdminHeader.jsx        # 🔔 상단 바 (새로운 결재 요청 알림 종 모양 아이콘 위치)
 │    ├── AdminSidebar.jsx       # 탭 이동을 담당할 왼쪽 메뉴 바
 │    └── ConfirmModal.jsx       # 승인/반려, 삭제 시 띄울 공통 경고 모달창
 │
 ├── pages/                      # 📺 [메뉴별 큼직한 화면들] 기존 파일들을 여기로 이동!
 │    ├── CalendarManager.jsx    # 📅 자동 배치 엔진 가동 및 달력 UI
 │    ├── EmployeeManager.jsx    # 👥 직원 목록, 역할, 근무 패턴(선호요일 등) 설정
 │    ├── RouteManager.jsx       # 🗺️ 노선 추가/삭제 및 배정
 │    ├── SettingsManager.jsx    # ⚙️ 지역 추가/삭제, 팀 이름, 초대코드 설정
 │    └── ApprovalManager.jsx    # ✨ [신규 추가!] 팀원들의 '추가 휴무' 및 '교환' 요청을 보고 승인/반려하는 결재 대시보드
 │
 └── utils/                      # ⚙️ [로직 및 데이터]
      ├── schedulingEngine.js    # 배치 알고리즘 (0시 자동 스케줄링 핵심 엔진)
      └── tempInitData.js        # 가상 데이터 (DB 연동 시 삭제)
      */
// src/admin/Calendar.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Save, RefreshCw, CalendarDays, X, Users } from 'lucide-react';
import { generateMonthlySchedule } from './utils/schedulingEngine'; 
import { useAdminData } from './contexts/DataContext';

export default function Calendar({ onBack }) {
    const [year, setYear] = useState(2026);
    const [month, setMonth] = useState(10); 
    
    const [schedules, setSchedules] = useState(() => {
        const saved = localStorage.getItem('admin_schedules');
        return saved ? JSON.parse(saved) : [];
    });

    const weekSliderRef = useRef(null);

    // ✨ 날짜 클릭 시 상세 정보를 보여주기 위한 상태
    const [selectedDateDetails, setSelectedDateDetails] = useState(null);

   useEffect(() => {
        localStorage.setItem('admin_schedules', JSON.stringify(schedules));
    }, [schedules]);

    // ✨ 수정: 직원 및 근무 패턴 관리 화면에서 등록/수정한 실제 직원 데이터를 가져옵니다.
    const { employees } = useAdminData();

    const visualWeeks = useMemo(() => {
        const firstDay = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
        
        const days = [];
        for (let i = firstDay - 1; i >= 0; i--) {
            const y = month === 1 ? year - 1 : year;
            const m = month === 1 ? 12 : month - 1;
            const d = daysInPrevMonth - i;
            days.push({ year: y, month: m, day: d, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ year, month, day: i, dateStr: `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`, isCurrentMonth: true });
        }
        const remainingDays = (7 - (days.length % 7)) % 7;
        for (let i = 1; i <= remainingDays; i++) {
            const y = month === 12 ? year + 1 : year;
            const m = month === 12 ? 1 : month + 1;
            const d = i;
            days.push({ year: y, month: m, day: d, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
        }
        const weeks = [];
        for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
        return weeks;
    }, [year, month]);

    const [selectedWeeks, setSelectedWeeks] = useState([]);
    const toggleWeek = (idx) => {
        if (selectedWeeks.includes(idx)) {
            setSelectedWeeks([]);
        } else {
            setSelectedWeeks([idx]);

            // ✨ 5주차(인덱스 4 이상이거나 마지막 주차)를 누르면 다음 달로 넘어가게 설정할 수도 있습니다.
            if (idx >= 4 && idx >= visualWeeks.length - 1) {
                if (window.confirm("마지막 주차입니다. 다음 달로 넘어가시겠습니까?")) {
                    if (month === 12) {
                        setYear(y => y + 1);
                        setMonth(1);
                    } else {
                        setMonth(m => m + 1);
                    }
                    setSelectedWeeks([0]); // 다음 달 1주차 선택 상태로 초기화
                    return;
                }
            }
        }
    };

const handleRunEngine = () => {
        if (selectedWeeks.length === 0) return;

        // ✨ 선택한 주차의 날짜들에 이미 생성된 스케줄이 있는지 검사
        const targetDates = selectedWeeks.flatMap(wIdx => visualWeeks[wIdx].map(d => d.dateStr));
        const hasExisting = schedules.some(s => targetDates.includes(s.date));

        if (hasExisting) {
            const confirmRecreate = window.confirm("이미 스케줄이 있습니다. 재생성하겠습니까?");
            if (!confirmRecreate) return; // 취소 누르면 중단
        }

        // 기존에 전달하던 schedules 데이터(기존 스케줄 정보)를 엔진에 함께 넘겨 겹침 방지
        const newSchedules = generateMonthlySchedule(visualWeeks, employees, selectedWeeks, schedules);
        const preservedSchedules = schedules.filter(s => !targetDates.includes(s.date));

        setSchedules([...preservedSchedules, ...newSchedules]);

        const maxSelected = Math.max(...selectedWeeks);
        const nextWeekIdx = maxSelected + 1;
        
        if (nextWeekIdx < visualWeeks.length) {
            setSelectedWeeks([nextWeekIdx]);
            setTimeout(() => {
                if (weekSliderRef.current) {
                    weekSliderRef.current.scrollTo({ left: nextWeekIdx * 80, behavior: 'smooth' });
                }
            }, 100);
        } else {
            setSelectedWeeks([0]); 
            if (month === 12) {
                setYear(y => y + 1);
                setMonth(1);
            } else {
                setMonth(m => m + 1);
            }
            setTimeout(() => {
                if (weekSliderRef.current) {
                    weekSliderRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                }
            }, 100);
        }
    };

      

  const handleReset = () => {
        if (selectedWeeks.length === 0) return;
        
        const weekLabels = selectedWeeks.map(w => w + 1).join(', ');
        if(window.confirm(`${weekLabels}주차의 스케줄을 초기화하시겠습니까?`)) {
            const datesToClear = selectedWeeks.flatMap(wIdx => visualWeeks[wIdx].map(d => d.dateStr));
            const preservedSchedules = schedules.filter(s => !datesToClear.includes(s.date));
            setSchedules(preservedSchedules);
            setSelectedWeeks([]); // ✨ 초기화 성공 시 선택된 주차 버튼의 파란불(선택 상태)도 꺼지도록 추가
        }
    };

    return (
       <div className="flex flex-col h-full bg-[#F2F2F7] dark:bg-gray-950 px-0 pt-4 pb-2 overflow-y-auto relative">
            
            {/* 1. 상단 타이틀 영역 (여백 대폭 축소 mb-6 -> mb-3) */}
            <div className="flex items-center gap-2 mb-2 mt-1 shrink-0 px-3">
                {onBack && (
                    <button onClick={onBack} className="p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-sm hover:bg-gray-50 transition-colors shrink-0">
                        <ArrowLeft size={18} />
                    </button>
                )}
                <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex-1">월간 스케줄 상황판</h1>
            </div>

            {/* 2. 월 이동 및 배포 버튼 (압축된 카드형) */}
           <div className="flex flex-col bg-white dark:bg-gray-900 px-3 py-2 rounded-none shadow-sm border-y border-gray-100 mb-2 gap-2 shrink-0">
                <div className="flex items-center justify-between w-full">
                    <button onClick={() => setMonth(m => m === 1 ? 12 : m - 1)} className="p-2 text-gray-400 hover:text-indigo-600 font-bold">&lt;</button>
                    <h2 className="text-xl font-black">{year}년 {month}월</h2>
                    <button onClick={() => setMonth(m => m === 12 ? 1 : m + 1)} className="p-2 text-gray-400 hover:text-indigo-600 font-bold">&gt;</button>
                </div>
                
                {/* 스케줄 전체 배포 (생성 완료 후 진행하는 최종 단계 시각적 구분) */}
                <button className={`w-full py-2.5 rounded-lg font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 ${schedules.length > 0 ? 'bg-[#1E56D0] hover:bg-blue-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                    <Save size={16}/> 스케줄 전체 배포
                </button>
            </div>

            {/* 3. 주차 선택 및 조작 영역 (사진과 동일하게 1열 주차, 2열 조작버튼으로 완벽 분리) */}
            <div className="flex flex-col gap-2 mb-2 bg-white dark:bg-gray-900 px-3 py-2 rounded-none border-y border-gray-100 shadow-sm shrink-0">
                <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5"><CalendarDays size={14}/> 주차 선택</span>
                
                {/* 1열: 주차 가로 슬라이드 (flex-1로 화면 꽉 차게 균등 분할) */}
                <div 
                    ref={weekSliderRef}
                    className="flex items-center gap-2 w-full overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
                    style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                >
                    {visualWeeks.map((_, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => toggleWeek(idx)}
                            className={`flex-1 min-w-[64px] py-2 text-[12px] font-black rounded-xl transition-all border ${
                                selectedWeeks.includes(idx) 
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {idx + 1}주차
                        </button>
                    ))}
                </div>
                
                {/* 2열: 작업 버튼 (초기화 / 생성) 1:2 비율 혹은 반반 */}
                <div className="grid grid-cols-2 gap-2 w-full">
                    <button 
                        onClick={handleReset}
                        disabled={selectedWeeks.length === 0}
                        className={`py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all border ${
                            selectedWeeks.length > 0 
                            ? 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300' 
                            : 'bg-white text-gray-300 border-gray-100 cursor-not-allowed'
                        }`}
                    >
                        <RefreshCw size={14} className={selectedWeeks.length > 0 ? "text-gray-500" : ""} /> 초기화
                    </button>
                    <button 
                        onClick={handleRunEngine}
                        disabled={selectedWeeks.length === 0}
                        // 사진처럼 검정/어두운 톤이나 파란 톤 유지 (디자인 통일성을 위해 그라데이션 유지)
                        className={`py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                            selectedWeeks.length > 0 
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md hover:opacity-90' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        <Play size={14} className={selectedWeeks.length > 0 ? "fill-white" : ""} /> 선택 주차 생성
                    </button>
                </div>
            </div>

           {/* ✨ 달력 그리드 (전체 다 보여주는 대신, 3주치(21일)만 세로로 고정 노출하여 공간 확보) */}
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-none shadow-sm border-y border-gray-100 overflow-hidden flex flex-col min-h-[360px]">
                <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 shrink-0">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                        <div key={day} className={`py-1 text-center text-[10px] font-black ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                            {day}
                        </div>
                    ))}
                </div>

       <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
                    {(() => {
                        let startWeek = 0; // 기본 1~3주차 뷰 (0번 인덱스 시작)

                        if (selectedWeeks.length > 0) {
                            const selected = selectedWeeks[0]; // 단일 선택된 주차 인덱스 (0부토 시작: 0=1주차, 1=2주차, 2=3주차...)

                            if (selected === 0 || selected === 1) {
                                // ✨ 1주차, 2주차 선택 시: 화면 안 움직이고 고정 (1~3주차 뷰)
                                startWeek = 0;
                            } else {
                                // ✨ 3주차, 4주차, 5주차 선택 시: 해당 주차가 화면의 '중앙(2번째 칸)'에 오도록 뷰를 맞춥니다.
                                // 이렇게 하면 선택한 주차 밑에 다음 주차(또는 다음 달 주차)가 자연스럽게 3번째 칸에 보입니다!
                                startWeek = selected - 1;
                            }

                            // ✨ 5주차가 존재하고 5주차를 선택했을 때의 처리 (다음 달로 자동 전환 예외 처리)
                            if (selected >= 4 && visualWeeks.length <= 5) {
                                // 만약 마지막 주차(5주차 등)라면 다음 달로 넘기는 트리거를 줄 수도 있습니다.
                            }
                        }

                        if (startWeek < 0) startWeek = 0;
                        if (startWeek > visualWeeks.length - 3) {
                            startWeek = Math.max(0, visualWeeks.length - 3);
                        }

                        const targetWeeksSlice = visualWeeks.slice(startWeek, startWeek + 3);

                        return targetWeeksSlice.flat().map((dayObj, flatIdx) => {
                            // 원래 전체 주차에서의 실제 주차 인덱스 계산
                            const actualWeekIdx = startWeek + Math.floor(flatIdx / 7);
                            
                            const dayOffs = schedules.filter(s => s.date === dayObj.dateStr);
                            const isCurrentMonth = dayObj.isCurrentMonth;
                            const isSelectedWeek = selectedWeeks.includes(actualWeekIdx);

                            let bgClass = isCurrentMonth ? 'bg-white' : 'bg-gray-50/50';
                            if (isSelectedWeek) bgClass = 'bg-indigo-50/60';

                            const visibleOffs = dayOffs.slice(0, 4);
                            const hiddenCount = dayOffs.length - 4;

                            return (
                                <div 
                                    key={dayObj.dateStr} 
                                    onClick={() => dayOffs.length > 0 && setSelectedDateDetails({ dayObj, dayOffs })}
                                    className={`border-r border-b border-gray-100 px-0.5 py-0.5 flex flex-col relative transition-all duration-300 hover:bg-gray-50 ${bgClass} ${dayOffs.length > 0 ? 'cursor-pointer active:bg-gray-100' : ''}`}
                                >
                                    <span className={`text-[9.5px] font-bold mb-0.5 text-center transition-colors ${(flatIdx % 7) === 0 ? 'text-red-500' : (flatIdx % 7) === 6 ? 'text-blue-500' : 'text-gray-700'} ${!isCurrentMonth ? 'opacity-40' : ''} ${isSelectedWeek ? 'text-indigo-900' : ''}`}>
                                        {(!isCurrentMonth || dayObj.day === 1) ? `${dayObj.month}/${dayObj.day}` : dayObj.day}
                                    </span>
                                    
                                    <div className="flex flex-col gap-0 mt-0">
                                        {visibleOffs.map((off, i) => {
    // ✨ 해당 직원이 대체 투입(백업) 인원인지 판별 (roleType 또는 employees 목록 대조)
    const isSubstitute = off.roleType === '백업' || off.roleType === 'sub';

    return (
        <div key={i} className={`text-center py-[2px] mb-[1px] px-0 rounded text-[8.5px] font-bold w-full leading-none whitespace-nowrap tracking-tighter ${
            isSubstitute 
                ? 'bg-blue-600 text-white border border-blue-700 shadow-sm' // 🔵 대체 투입 인원은 진한 파란색 뱃지
                : off.type === '고정휴무' 
                    ? 'bg-blue-50 text-blue-700 border border-blue-100/50' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'
        } ${!isCurrentMonth ? 'opacity-70' : ''}`}>
            {off.employeeName.substring(0, 3)}
        </div>
    );
})}
                                        {hiddenCount > 0 && (
                                            <div className="text-center text-[8px] font-black text-gray-400 mt-0">
                                                +{hiddenCount}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            {/* ✨ 날짜 클릭 시 나타나는 상세 명단 팝업 */}
            {selectedDateDetails && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-xs shadow-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-lg flex items-center gap-2">
                                <CalendarDays size={18} className="text-indigo-600"/>
                                {selectedDateDetails.dayObj.month}월 {selectedDateDetails.dayObj.day}일 휴무자
                            </h3>
                            <button onClick={() => setSelectedDateDetails(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
                        </div>
                        
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {selectedDateDetails.dayOffs.map((off, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm">
                                            <Users size={14} />
                                        </div>
                                        <span className="font-bold text-gray-800">{off.employeeName}</span>
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${off.type === '고정휴무' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {off.type}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setSelectedDateDetails(null)} className="w-full mt-4 py-2.5 bg-gray-900 text-white font-bold rounded-xl">확인</button>
                    </div>
                </div>
            )}
        </div>
    );
}