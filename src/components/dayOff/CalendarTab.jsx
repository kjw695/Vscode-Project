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
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useDelivery } from '../../contexts/DeliveryContext';
import { supabase } from '../../lib/supabaseClient'; // 기존 휴무 교환 RPC
import {
    fetchMyOrganizationWeeklySchedules,
    fetchMyOrganizationScheduleSyncFrom
} from '../../services/organizationScheduleService';
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

const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const isStandaloneDayOffEntry = (entry) => {
    const items = Array.isArray(entry.customItems) ? entry.customItems : [];
    const hasDayOffMarker = entry.memo === '[휴무]' ||
        items.some(item => item?.key === 'dayOff');
    const hasOnlyDayOffItems = items.every(item => item?.key === 'dayOff');

    return entry.type === 'income' &&
        Number(entry.unitPrice ?? 0) === 0 &&
        Number(entry.round ?? 0) === 0 &&
        hasDayOffMarker &&
        hasOnlyDayOffItems;
};

export default function CalendarTab({ 
    isDarkMode, showMessage, monthlyStartDay, monthlyEndDay, selectedMonth, onClose,
    teamId, currentUser, onNavigateToExchange, refreshKey, registerBackHandler
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

    const [extraDayOffDate, setExtraDayOffDate] = useState(null);
    const [extraDayOffNote, setExtraDayOffNote] = useState('');
    const [isSubmittingExtraDayOff, setIsSubmittingExtraDayOff] = useState(false);
    const extraRequestPanelRef = useRef(null);
    const [myExtraDayOffRequests, setMyExtraDayOffRequests] = useState([]);
    const [publishedSchedules, setPublishedSchedules] = useState([]);
    const [isLoadingPublishedSchedules, setIsLoadingPublishedSchedules] = useState(false);
    const [scheduleLoadError, setScheduleLoadError] = useState(false);
    const [scheduleSyncFrom, setScheduleSyncFrom] = useState(null);

    // 신청 사유 입력 시 신청창 전체가 보이도록 스크롤 영역 안에서 위로 올립니다.
    const scrollExtraRequestPanelIntoView = useCallback(() => {
        window.requestAnimationFrame(() => {
            extraRequestPanelRef.current?.scrollIntoView({
                block: 'center',
                inline: 'nearest',
                behavior: 'smooth'
            });
        });
    }, []);

    // Capacitor 키보드 표시 이벤트를 이용해 키보드가 실제로 열린 뒤 신청창 전체를 노출합니다.
    // 일반 브라우저에서도 visualViewport 변경을 보조 신호로 사용합니다.
    useEffect(() => {
        if (!extraDayOffDate) return undefined;

        let isActive = true;
        let keyboardListener = null;
        const viewport = window.visualViewport;

        const revealPanel = () => {
            if (isActive) scrollExtraRequestPanelIntoView();
        };

        if (Capacitor.isNativePlatform()) {
            Keyboard.addListener('keyboardDidShow', revealPanel)
                .then((listener) => {
                    if (isActive) {
                        keyboardListener = listener;
                    } else {
                        listener.remove();
                    }
                })
                .catch((error) => {
                    console.warn('키보드 이벤트를 연결하지 못했습니다:', error);
                });
        }

        viewport?.addEventListener('resize', revealPanel);
        window.addEventListener('resize', revealPanel);

        return () => {
            isActive = false;
            keyboardListener?.remove();
            viewport?.removeEventListener('resize', revealPanel);
            window.removeEventListener('resize', revealPanel);
        };
    }, [extraDayOffDate, scrollExtraRequestPanelIntoView]);

    // 직원 본인의 추가휴무 요청 내역을 조회해 대기 중인 날짜를 달력에 표시합니다.
    const loadMyExtraDayOffRequests = useCallback(async () => {
        if (!teamId || !currentUser?.id) {
            setMyExtraDayOffRequests([]);
            return;
        }

        try {
            const { data, error } = await supabase.rpc('list_my_extra_day_off_requests');
            if (error) throw error;
            setMyExtraDayOffRequests(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('달력의 추가휴무 요청 표시 조회 실패:', error);
        }
    }, [teamId, currentUser?.id]);

    useEffect(() => {
        loadMyExtraDayOffRequests();
        if (!teamId || !currentUser?.id) return undefined;

        const timer = window.setInterval(loadMyExtraDayOffRequests, 15000);
        return () => window.clearInterval(timer);
    }, [loadMyExtraDayOffRequests, teamId, currentUser?.id]);

    const pendingExtraDayOffDates = useMemo(() => (
        new Set(
            myExtraDayOffRequests
                .filter((request) => request.status === 'pending' && request.requested_date)
                .map((request) => String(request.requested_date).slice(0, 10))
        )
    ), [myExtraDayOffRequests]);

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

    const scheduleQueryStart = formatLocalDate(calendarStartDate);
    const scheduleQueryEnd = formatLocalDate(calendarEndDate);

    // 회사 소속 직원은 관리자 확정 근무표만 서버에서 읽습니다.
    // 개인 사용자의 entries 기반 휴무 저장 경로는 이 조회와 분리해 그대로 둡니다.
    useEffect(() => {
        if (!teamId || !currentUser?.id) {
            setPublishedSchedules([]);
            setIsLoadingPublishedSchedules(false);
            setScheduleLoadError(false);
            setScheduleSyncFrom(null);
            return undefined;
        }

        let isActive = true;
        const loadPublishedSchedules = async () => {
            try {
                setIsLoadingPublishedSchedules(true);
                const [rows, syncFrom] = await Promise.all([
                    fetchMyOrganizationWeeklySchedules(
                        scheduleQueryStart,
                        scheduleQueryEnd
                    ),
                    fetchMyOrganizationScheduleSyncFrom()
                ]);
                if (isActive) {
                    setPublishedSchedules(rows);
                    setScheduleSyncFrom(syncFrom);
                    setScheduleLoadError(false);
                }
            } catch (error) {
                console.error('관리자 확정 근무표를 불러오지 못했습니다.', error);
                if (isActive) {
                    setPublishedSchedules([]);
                    setScheduleSyncFrom(null);
                    setScheduleLoadError(true);
                }
            } finally {
                if (isActive) setIsLoadingPublishedSchedules(false);
            }
        };

        loadPublishedSchedules();
        const timer = window.setInterval(loadPublishedSchedules, 15000);

        return () => {
            isActive = false;
            window.clearInterval(timer);
        };
    }, [
        teamId,
        currentUser?.id,
        scheduleQueryStart,
        scheduleQueryEnd,
        refreshKey
    ]);

    // 회사 연동 기준일 이후의 기존 개인 휴무 전용 기록은 실제 취소합니다.
    // 수익 항목이 함께 들어 있는 혼합 기록은 삭제하지 않습니다.
    useEffect(() => {
        if (!teamId || !scheduleSyncFrom || !Array.isArray(entries)) return;

        const staleDayOffEntries = entries.filter((entry) =>
            entry.date >= scheduleSyncFrom && isStandaloneDayOffEntry(entry)
        );

        staleDayOffEntries.forEach((entry) => {
            if (deleteEntry) deleteEntry(entry.id);
        });
    }, [teamId, scheduleSyncFrom, entries, deleteEntry]);

    const myPublishedScheduleByDate = useMemo(() => {
        const result = {};
        const userId = String(currentUser?.id || '');
        if (!teamId || !userId) return result;

        publishedSchedules.forEach((published) => {
            const ownDetails = published.employee_details?.[userId];
            if (!ownDetails) return;

            if (published.status !== 'confirmed') {
                const start = new Date(`${published.week_start}T12:00:00`);
                for (let offset = 0; offset < 7; offset += 1) {
                    const date = new Date(start);
                    date.setDate(start.getDate() + offset);
                    const dateKey = formatLocalDate(date);
                    if (scheduleSyncFrom && dateKey < scheduleSyncFrom) continue;
                    result[dateKey] = {
                        status: 'pending',
                        details: ownDetails,
                        teamLabel: published.team_label
                    };
                }
                return;
            }

            Object.entries(published.schedule || {}).forEach(([dateKey, dayRecord]) => {
                // 연동 기준일 이전은 과거 개인 휴무 및 기존 달력 표시를 그대로 유지합니다.
                if (scheduleSyncFrom && dateKey < scheduleSyncFrom) return;

                let status = ['off', 'backup', 'work', 'pending'].includes(dayRecord?.status)
                    ? dayRecord.status
                    : null;
                let assignment = dayRecord?.assignment || null;

                if (!status) {
                    const offIds = Array.isArray(dayRecord?.offEmployeeIds)
                        ? dayRecord.offEmployeeIds
                        : [];
                    const isOff = offIds.some((item) => {
                        const id = item && typeof item === 'object'
                            ? (item.employeeId || item.employee_id || item.id)
                            : item;
                        return String(id) === userId;
                    });
                    assignment = assignment || (Array.isArray(dayRecord?.subs)
                        ? dayRecord.subs.find((item) => String(item.subId) === userId) || null
                        : null);
                    status = isOff ? 'off' : assignment ? 'backup' : 'work';
                }

                result[dateKey] = {
                    status,
                    assignment,
                    details: ownDetails,
                    teamLabel: published.team_label
                };
            });
        });

        return result;
    }, [publishedSchedules, currentUser?.id, teamId, scheduleSyncFrom]);

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

    // 회사 소속 직원은 관리자 확정 근무표를 기준으로 휴무 교환을 신청합니다.
    const toggleDate = async (dateStr) => {
        if (!teamId) {
            setSelectedDates(prev =>
                prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
            );
            return;
        }

        const isBeforeScheduleSync = Boolean(scheduleSyncFrom && dateStr < scheduleSyncFrom);
        const managerStatus = myPublishedScheduleByDate[dateStr]?.status;

        // 날짜 상태에 따라 동작을 자동 결정합니다.
        // 휴무일을 누르면 교환 흐름, 근무일/백업일을 누르면 추가휴무 요청 흐름입니다.
        if (exchangeStep === 0) {
            if (isBeforeScheduleSync) {
                showMessage('회사 근무표 연동 시작일 이후 날짜를 선택해주세요.');
                return;
            }

            if (managerStatus === 'off') {
                setExtraDayOffDate(null);
                setExtraDayOffNote('');
                setMyOffDate(dateStr);
                setTargetDate(null);
                setAvailableMembers([]);
                return;
            }

            if (['work', 'backup'].includes(managerStatus)) {
                if (dateStr < todayStr) {
                    showMessage('지난 날짜에는 추가휴무를 요청할 수 없습니다.');
                    return;
                }
                setMyOffDate(null);
                setTargetDate(null);
                setAvailableMembers([]);
                setExtraDayOffDate(dateStr);
                return;
            }

            if (managerStatus === 'pending') {
                showMessage('관리자가 근무표를 확정한 후 휴무 신청을 이용할 수 있습니다.');
            } else {
                showMessage('관리자 확정 근무표에 있는 휴무일 또는 근무일을 선택해주세요.');
            }
            return;
        }

        if (exchangeStep === 1) {
            if (isBeforeScheduleSync) {
                showMessage('회사 연동 시작일 이전의 날짜는 교환 대상으로 선택할 수 없습니다.');
                return;
            }
            if (!isSameWeek(dateStr)) {
                showMessage('교환은 같은 주(일~토) 안에서만 가능합니다.');
                return;
            }
            if (dateStr === myOffDate) {
                showMessage('같은 날짜입니다. 다른 날짜를 선택하세요.');
                return;
            }
            if (managerStatus === 'off') {
                showMessage('이미 본인의 휴무인 날짜입니다. 다른 날짜를 선택하세요.');
                return;
            }
            if (!['work', 'backup'].includes(managerStatus)) {
                showMessage('관리자가 근무표를 확정한 날짜만 교환 대상으로 선택할 수 있습니다.');
                return;
            }

            setIsFetchingMembers(true);
            try {
                const { data, error } = await supabase.rpc(
                    'list_organization_day_off_members',
                    {
                        p_source_date: myOffDate,
                        p_target_date: dateStr
                    }
                );
                if (error) throw error;

                const members = (data || []).map(member => ({
                    id: member.member_id,
                    name: member.member_display_name || '팀원'
                }));
                if (members.length === 0) {
                    showMessage('선택한 날짜에 교환할 수 있는 휴무자가 없습니다.');
                    return;
                }

                setTargetDate(dateStr);
                setAvailableMembers(members);
                setExchangeStep(2);
            } catch (error) {
                console.error('휴무 교환 대상 조회 실패:', error);
                showMessage(error.message || '휴무 교환 대상자를 불러오지 못했습니다.');
            } finally {
                setIsFetchingMembers(false);
            }
            return;
        }
    };

    const handleSubmitExchange = async (receiverId) => {
        try {
            const { error } = await supabase.rpc('create_shift_exchange_request', {
                p_receiver_id: receiverId,
                p_source_date: myOffDate,
                p_target_date: targetDate
            });
            if (error) throw error;

            showMessage('휴무 교환 신청을 보냈습니다. 상대 직원이 수락하면 확정 근무표에 반영됩니다.');
            setExchangeStep(0);
            setMyOffDate(null);
            setTargetDate(null);
            setAvailableMembers([]);
            if (onNavigateToExchange) onNavigateToExchange();
        } catch (error) {
            console.error('휴무 교환 신청 실패:', error);
            showMessage(error.message || '휴무 교환 신청 중 오류가 발생했습니다.');
        }
    };

    const handleSubmitExtraDayOff = async () => {
        if (!extraDayOffDate || isSubmittingExtraDayOff) return;
        setIsSubmittingExtraDayOff(true);
        try {
            const { error } = await supabase.rpc('create_extra_day_off_request', {
                p_requested_date: extraDayOffDate,
                p_note: extraDayOffNote.trim() || null
            });
            if (error) throw error;

            showMessage(extraDayOffDate + ' 추가휴무 요청을 관리자에게 보냈습니다. 승인 전까지 근무표는 유지됩니다.');
            await loadMyExtraDayOffRequests();
            setExtraDayOffDate(null);
            setExtraDayOffNote('');
        } catch (error) {
            console.error('달력에서 추가휴무 요청 실패:', error);
            showMessage(error.message || '추가휴무 요청을 보내지 못했습니다.');
        } finally {
            setIsSubmittingExtraDayOff(false);
        }
    };

    // Android 시스템 뒤로가기는 현재 휴무 신청 흐름부터 취소합니다.
    const handleCalendarBack = useCallback(() => {
        if (exchangeStep === 2) {
            setExchangeStep(1);
            setTargetDate(null);
            setAvailableMembers([]);
            return true;
        }

        if (exchangeStep === 1 || myOffDate) {
            setExchangeStep(0);
            setMyOffDate(null);
            setTargetDate(null);
            setAvailableMembers([]);
            return true;
        }

        if (extraDayOffDate) {
            setExtraDayOffDate(null);
            setExtraDayOffNote('');
            return true;
        }

        return false;
    }, [exchangeStep, myOffDate, extraDayOffDate]);

    useEffect(() => {
        if (!teamId || !registerBackHandler) return undefined;
        return registerBackHandler(handleCalendarBack);
    }, [teamId, registerBackHandler, handleCalendarBack]);

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
        
        const isBeforeScheduleSync = Boolean(teamId && scheduleSyncFrom && dateStr < scheduleSyncFrom);
        // 회사 연동 시작일 이후에는 기존 개인 휴무 기록을 선택 상태로도 표시하지 않습니다.
        const isSelected = selectedDates.includes(dateStr) && (!teamId || isBeforeScheduleSync);
        const isMyOffDate = dateStr === myOffDate;
        const isTargetDate = dateStr === targetDate;
        const isExtraDayOffDate = dateStr === extraDayOffDate;
        const isPendingExtraDayOffRequest = pendingExtraDayOffDates.has(dateStr);

        // 4. 선택(터치) 상태 여부 종합 확인
        const isTouched = isSelected || isMyOffDate || isTargetDate || isExtraDayOffDate;

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

        // 집계 기간 이외의 날짜는 흐리게 처리
        if (!inPeriod) {
            dateColor = isDarkMode ? 'text-gray-600' : 'text-gray-400';
        }
        
        // 교환 단계 Dim 처리 (다른 주는 비활성화)
        const inSameWeek = exchangeStep === 1 && isSameWeek(dateStr);
        const isDimmed = exchangeStep === 1 && !inSameWeek && !isMyOffDate;

        // 회사 소속 직원은 관리자 확정 근무표의 본인 일정이 최우선입니다.
        const managerDay = teamId ? myPublishedScheduleByDate[dateStr] : null;
        // 개인 휴무 기록은 개인 모드와 회사 연동 기준일 이전에만 유효합니다.
        const personalIsOff = (!teamId || isBeforeScheduleSync) &&
            (isSelected || Boolean(existingDayOffs[dateStr]));
        const shiftType = managerDay?.details?.shift || '주간';
        const routeName = managerDay?.details?.route || (teamId ? '라우트' : '배송');
        let dayStatus = managerDay?.status || null;
        let dayDescription = routeName;

        if (teamId && isBeforeScheduleSync) {
            // 연동 기준일 전에는 과거 기록을 변경하지 않고 종전 달력 표시를 유지합니다.
            dayStatus = personalIsOff ? 'off' : 'legacy';
            dayDescription = personalIsOff ? '휴무' : '라우트';
        } else if (teamId) {
            if (dayStatus === 'off') {
                dayDescription = '휴무';
            } else if (dayStatus === 'backup') {
                dayDescription = managerDay.assignment?.routeName ||
                    managerDay.assignment?.targetBaseName ||
                    '백업 배정';
            } else if (dayStatus === 'pending') {
                dayDescription = '확정 대기';
            } else if (dayStatus === 'work') {
                dayDescription = routeName;
            } else {
                // 연동 기준일 이후에는 기존 개인 휴무 기록을 표시하지 않습니다.
                // 관리자 일정이 없으면 개인 기록으로 대체하지 않고 미확정 상태로 표시합니다.
                dayStatus = 'unpublished';
                dayDescription = isLoadingPublishedSchedules
                    ? '불러오는 중'
                    : scheduleLoadError
                        ? '조회 실패'
                        : '근무표 미확정';
            }
        } else {
            dayStatus = personalIsOff ? 'off' : 'work';
            dayDescription = personalIsOff ? '휴무' : '배송';
        }

        days.push(
            <div 
                key={dateStr} 
                onClick={() => !isDimmed && toggleDate(dateStr)}
                className={`flex flex-col items-center justify-start p-1 h-20 border-b border-r transition-colors relative
                ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} 
                ${bgClass} 
                ${isDimmed ? 'opacity-20' : ''} 
                ${!inPeriod ? 'bg-opacity-50' : ''}`}
            >
                {/* 같은 주 표시용 연한 초록색 배경 (교환 2단계일 때) */}
                {inSameWeek && !isMyOffDate && !isTargetDate && (
                    <div className="absolute inset-0 bg-green-100 dark:bg-green-900 opacity-20 pointer-events-none" />
                )}

                {/* 날짜 숫자 */}
                <span className={`text-[13px] font-bold ${dateColor}`}>{dayIterator.getDate()}</span>

                {/* 2. 하단 정보 영역: 휴무 vs 근무일 */}
                {inPeriod && (
                    <div className="flex flex-col items-center mt-1 w-full space-y-0.5">
                        {dayStatus === 'off' ? (
                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-0.5">
                                <span className="text-gray-300 dark:text-gray-600">○</span> 휴무
                            </span>
                        ) : dayStatus === 'backup' ? (
                            <>
                                <span className="text-[9px] font-bold px-1.5 py-[2px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 rounded-full mt-0.5">
                                    백업
                                </span>
                                <span className={`text-[10px] font-bold truncate w-full text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>
                                    {dayDescription}
                                </span>
                            </>
                        ) : (dayStatus === 'work' || dayStatus === 'legacy') ? (
                            <>
                                <span className="text-[9px] font-bold px-1.5 py-[2px] bg-[#E5E7FF] text-[#4F46E5] dark:bg-indigo-900/50 dark:text-indigo-300 rounded-full mt-0.5">
                                    {shiftType}
                                </span>
                                <span className={`text-[10px] font-bold truncate w-full text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>
                                    {dayDescription}
                                </span>
                            </>
                        ) : (
                            <span className={`text-[9px] font-bold mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                {dayDescription}
                            </span>
                        )}
                        {isPendingExtraDayOffRequest && (
                            <span
                                className="mt-0.5 text-[8px] font-bold leading-none text-amber-600 dark:text-amber-400"
                                aria-label="추가휴무 관리자 승인 대기 중"
                            >
                                추가휴무 신청중
                            </span>
                        )}
                    </div>
                )}
            </div>
        );

        dayIterator.setDate(dayIterator.getDate() + 1); // 다음 날로 이동
    }

    return (
        <div className="relative flex flex-col min-h-full pb-4">
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
            <div className={`grid grid-cols-7 w-full border-l ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
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
            <div className={extraDayOffDate
                ? "relative z-20 w-full mt-2 py-2"
                : "absolute bottom-16 left-0 right-0 px-4 py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-20 shadow-lg border-t border-gray-100 dark:border-gray-800"
            }>
                {teamId ? (
            <div className="flex flex-col space-y-2">
                {extraDayOffDate ? (
                    <div
                        ref={extraRequestPanelRef}
                        className="mx-4 space-y-2 rounded-xl bg-indigo-50 p-3 shadow-md dark:bg-gray-800"
                        style={{ scrollMarginTop: '24px', scrollMarginBottom: '24px' }}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">추가휴무를 원하는 근무일</p>
                                <p className="mt-0.5 text-[11px] text-gray-500">{extraDayOffDate}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setExtraDayOffDate(null)}
                                className="shrink-0 text-xs text-gray-500 underline"
                            >
                                날짜 해제
                            </button>
                        </div>
                        <textarea
                            value={extraDayOffNote}
                            onFocus={scrollExtraRequestPanelIntoView}
                            onChange={(event) => setExtraDayOffNote(event.target.value)}
                            rows={2}
                            maxLength={300}
                            placeholder="요청 사유 (선택)"
                            className="w-full resize-none rounded-lg border border-indigo-100 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                        <button
                            type="button"
                            onClick={handleSubmitExtraDayOff}
                            disabled={!extraDayOffDate || isSubmittingExtraDayOff}
                            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            {isSubmittingExtraDayOff ? '요청 전송 중...' : '선택한 날짜 추가휴무 요청'}
                        </button>
                        <p className="text-[10px] leading-4 text-gray-500">
                            관리자 승인 전에는 기존 근무표가 유지됩니다.
                        </p>
                    </div>
                ) : (
                    <>
                        {exchangeStep === 0 && !myOffDate && (
                            <div className="rounded-xl bg-gray-50 px-3 py-2 text-center dark:bg-gray-800">
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                    휴무일을 누르면 교환, 근무일을 누르면 추가휴무 신청
                                </p>
                            </div>
                        )}

                        {(myOffDate || exchangeStep > 0) && (
                            <>
                                {exchangeStep === 0 && (
                                    <button
                                        onClick={() => setExchangeStep(1)}
                                        disabled={!myOffDate}
                                        className={'w-full rounded-xl py-3 text-sm font-bold shadow-md transition-all ' + (
                                            myOffDate ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        )}
                                    >
                                        {myOffDate ? myOffDate + ' 휴무 교환하기' : '내 휴무일을 달력에서 선택해주세요'}
                                    </button>
                                )}

                                {exchangeStep === 1 && (
                                    <div className="rounded-xl bg-indigo-50 p-2.5 text-center dark:bg-gray-800">
                                        <p className="mb-1 text-xs font-bold text-indigo-600">어느 날짜로 바꾸시겠어요?</p>
                                        <p className="mb-2 text-[11px] text-gray-500">같은 주(일~토)에서 원하는 날짜에 휴무인 직원이 있어야 교환할 수 있습니다.</p>
                                        <button onClick={() => { setExchangeStep(0); setMyOffDate(null); }} className="text-xs text-gray-400 underline">처음부터 다시하기</button>
                                    </div>
                                )}

                                {exchangeStep === 2 && (
                                    <div className="rounded-xl bg-gray-50 p-3 shadow-inner dark:bg-gray-800">
                                        <div className="mb-2 flex items-center justify-between border-b pb-1.5">
                                            <span className="text-xs font-bold">{targetDate} 휴무자 목록</span>
                                            <button onClick={() => { setExchangeStep(1); setTargetDate(null); }} className="text-xs text-indigo-500">날짜 다시 선택</button>
                                        </div>

                                        {isFetchingMembers ? (
                                            <div className="py-2 text-center text-xs text-gray-500">목록을 불러오는 중...</div>
                                        ) : availableMembers.length === 0 ? (
                                            <div className="py-2 text-center text-xs text-gray-500">해당 날짜에 쉬는 팀원이 없습니다.</div>
                                        ) : (
                                            <div className="max-h-28 space-y-1.5 overflow-y-auto">
                                                {availableMembers.map(member => (
                                                    <div key={member.id} className="flex items-center justify-between rounded bg-white p-1.5 shadow-sm dark:bg-gray-700">
                                                        <span className="text-xs font-bold">{member.name}</span>
                                                        <button
                                                            onClick={() => handleSubmitExchange(member.id)}
                                                            className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white"
                                                        >
                                                            교환 신청
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </>
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