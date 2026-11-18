import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Check,
    ChevronLeft,
    ChevronRight,
    FileText,
    Loader2
} from 'lucide-react';
import { useDelivery } from '../../contexts/DeliveryContext';
import { calculateData } from '../../utils/calculator';
import { getAppSettingsStorageKey } from '../../utils/accountDataStorage';
import {
    getAvailableGuestEntries,
    getGuestEntryDateKey,
    getGuestEntriesInRange,
    getGuestImportMonthlyPeriodRange,
    getGuestImportYearlyPeriodRange,
    getGuestImportYearMonthRange,
    addGuestEntrySelection,
    removeGuestEntrySelection,
    toggleGuestEntrySelection,
    getGuestEntryTableColumns
} from '../../utils/guestLedgerImport';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const toDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
};

const parseDateKey = (dateKey) => {
    const [year, month, day] = String(dateKey || '').split('-').map(Number);
    return new Date(year, month - 1, day);
};

const formatWon = (value) => (Number(value) || 0).toLocaleString('ko-KR') + '원';

const getEntriesInRange = getGuestEntriesInRange;

function GuestLedgerImportView({ userId, isDarkMode, onBack }) {
    const { importGuestEntries, isDataLoaded } = useDelivery();
    const dark = Boolean(isDarkMode);
    const [guestEntries, setGuestEntries] = useState([]);
    const [selectionMode, setSelectionMode] = useState('individual');
    const [currentCalendarDate, setCurrentCalendarDate] = useState(() => new Date());
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [selectedEntryIds, setSelectedEntryIds] = useState([]);
    const [isImporting, setIsImporting] = useState(false);
    const [notice, setNotice] = useState('');

    const readAccountPeriodSettings = (accountId) => {
        try {
            const settings = JSON.parse(localStorage.getItem(getAppSettingsStorageKey(accountId)) || '{}');
            const configuredStartDay = Number(settings.monthlyPeriod?.startDay);
            const configuredEndDay = Number(settings.monthlyPeriod?.endDay);
            return {
                startDay: Number.isInteger(configuredStartDay) && configuredStartDay >= 1 && configuredStartDay <= 31
                    ? configuredStartDay : 26,
                endDay: Number.isInteger(configuredEndDay) && configuredEndDay >= 1 && configuredEndDay <= 31
                    ? configuredEndDay : 25
            };
        } catch (error) {
            console.warn('[GuestImport] 현재 계정의 집계일 기준을 읽지 못했습니다.', error);
            return { startDay: 26, endDay: 25 };
        }
    };

    const [periodSettings, setPeriodSettings] = useState(() => readAccountPeriodSettings(userId));

    useEffect(() => {
        setPeriodSettings(readAccountPeriodSettings(userId));
    }, [userId]);

    const refreshGuestEntries = () => {
        setGuestEntries(getAvailableGuestEntries(userId));
    };

    useEffect(() => {
        refreshGuestEntries();
        // 현재 표시 월은 앱 홈 달력처럼 오늘이 속한 정산 월을 기준으로 맞춥니다.
        const now = new Date();
        if (now.getDate() > periodSettings.endDay) {
            setCurrentCalendarDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
        }
    }, [userId, periodSettings.endDay]);

    const selectedIds = useMemo(() => new Set(selectedEntryIds.map(String)), [selectedEntryIds]);

    const selectedEntries = useMemo(
        () => guestEntries.filter((entry) => selectedIds.has(String(entry.id))),
        [guestEntries, selectedIds]
    );

    const availableDates = useMemo(() => {
        const counts = {};
        guestEntries.forEach((entry) => {
            const dateKey = getGuestEntryDateKey(entry?.date);
            if (dateKey) counts[dateKey] = (counts[dateKey] || 0) + 1;
        });
        return counts;
    }, [guestEntries]);

    // Declare the selected accounting period before deriving its entry list.
    // Referencing a later const here throws at render time and blanks the screen.
    const monthlyPeriod = useMemo(
        () => getGuestImportMonthlyPeriodRange(currentCalendarDate, periodSettings.startDay, periodSettings.endDay),
        [currentCalendarDate, periodSettings]
    );

    // 월별 모드에서는 특정 날짜만이 아니라 해당 집계 기간 전체 기록을
    // 날짜별로 나누어 아래 목록에 표시합니다.
    const monthlyEntries = useMemo(
        () => getEntriesInRange(guestEntries, monthlyPeriod.startDate, monthlyPeriod.endDate),
        [guestEntries, monthlyPeriod]
    );

    // 표에는 현재 모드의 전체 대상 기록을 계속 표시해 행을 해제해도 다시 선택할 수 있게 합니다.
    const tableEntries = useMemo(() => {
        if (selectionMode === 'individual' || selectionMode === 'month') {
            return monthlyEntries;
        }
        if (selectionMode === 'year') {
            const range = getGuestImportYearlyPeriodRange(
                selectedYear,
                periodSettings.startDay,
                periodSettings.endDay
            );
            return getEntriesInRange(guestEntries, range.startDate, range.endDate);
        }
        return guestEntries;
    }, [selectionMode, monthlyEntries, guestEntries, selectedYear, periodSettings]);
    const tableColumns = useMemo(
        () => getGuestEntryTableColumns(tableEntries),
        [tableEntries]
    );

    const selectedSummary = useMemo(() => calculateData(selectedEntries, {}), [selectedEntries]);
    const selectedDateCount = new Set(selectedEntries.map((entry) => getGuestEntryDateKey(entry.date)).filter(Boolean)).size;

    const calendarDays = useMemo(() => {
        const periodStart = parseDateKey(monthlyPeriod.startDate);
        const periodEnd = parseDateKey(monthlyPeriod.endDate);
        const calendarStart = new Date(periodStart);
        calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());
        const calendarEnd = new Date(periodEnd);
        if (calendarEnd.getDay() !== 6) {
            calendarEnd.setDate(calendarEnd.getDate() + (6 - calendarEnd.getDay()));
        }

        const days = [];
        const cursor = new Date(calendarStart);
        const today = toDateKey(new Date());

        while (cursor <= calendarEnd) {
            const date = toDateKey(cursor);
            days.push({
                date,
                day: cursor.getDate(),
                isCurrentMonth: date >= monthlyPeriod.startDate && date <= monthlyPeriod.endDate,
                isToday: date === today,
                count: availableDates[date] || 0,
                selectedCount: guestEntries.filter((entry) => getGuestEntryDateKey(entry.date) === date && selectedIds.has(String(entry.id))).length
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        return days;
    }, [monthlyPeriod, availableDates, guestEntries, selectedIds]);

    const setSelectedForRange = (startDate, endDate) => {
        const ids = getEntriesInRange(guestEntries, startDate, endDate).map((entry) => String(entry.id));
        setSelectedEntryIds(ids);
        setNotice('');
    };

    const addEntriesForRange = (startDate, endDate) => {
        const ids = getEntriesInRange(guestEntries, startDate, endDate).map((entry) => String(entry.id));
        setSelectedEntryIds((current) => addGuestEntrySelection(current, ids));
        setNotice('');
    };

    const removeEntriesForRange = (startDate, endDate) => {
        const ids = getEntriesInRange(guestEntries, startDate, endDate).map((entry) => String(entry.id));
        setSelectedEntryIds((current) => removeGuestEntrySelection(current, ids));
        setNotice('');
    };

    const toggleEntriesForRange = (startDate, endDate) => {
        const ids = getEntriesInRange(guestEntries, startDate, endDate).map((entry) => String(entry.id));
        setSelectedEntryIds((current) => toggleGuestEntrySelection(current, ids));
        setNotice('');
    };

    const changeMonth = (delta) => {
        const nextMonth = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + delta, 1);
        setCurrentCalendarDate(nextMonth);
        setNotice('');
    };

    const handleModeChange = (mode) => {
        setSelectionMode(mode);
        setNotice('');
        if (mode === 'individual') {
            setSelectedEntryIds([]);
                return;
        }
        if (mode === 'month') {
            const range = getGuestImportMonthlyPeriodRange(currentCalendarDate, periodSettings.startDay, periodSettings.endDay);
            setSelectedForRange(range.startDate, range.endDate);
            return;
        }
        if (mode === 'year') {
            const range = getGuestImportYearlyPeriodRange(selectedYear, periodSettings.startDay, periodSettings.endDay);
            setSelectedForRange(range.startDate, range.endDate);
            return;
        }
        if (mode === 'all') {
            setSelectedEntryIds(guestEntries.map((entry) => String(entry.id)));
            }
    };

    const handleCalendarDayClick = (date) => {
        const dayEntries = guestEntries.filter((entry) => getGuestEntryDateKey(entry.date) === date);
        if (dayEntries.length === 0) return;

        const dayIds = dayEntries.map((entry) => String(entry.id));
        setSelectedEntryIds((current) => toggleGuestEntrySelection(current, dayIds));
        setNotice('');
    };

    const handleEntryToggle = (entryId) => {
        setSelectedEntryIds((current) => toggleGuestEntrySelection(current, [entryId]));
        setNotice('');
    };

    const handleImport = async () => {
        const idsToImport = selectedEntries.map((entry) => String(entry.id));
        if (!userId || idsToImport.length === 0 || isImporting) return;

        const confirmed = window.confirm(`선택한 게스트 장부 ${idsToImport.length.toLocaleString()}건을 현재 계정으로 가져오시겠습니까?`);
        if (!confirmed) return;

        setIsImporting(true);
        setNotice('');
        try {
            const result = await importGuestEntries(idsToImport);
            if (!result?.success) {
                setNotice(result?.message || '게스트 장부를 가져오지 못했습니다.');
                return;
            }
            refreshGuestEntries();
            setSelectedEntryIds([]);
            setNotice(
                result.importedCount > 0
                    ? `장부 ${result.importedCount}건을 현재 계정에 저장했습니다. 서버 동기화는 백그라운드에서 진행되며, 실패한 기록은 미전송 상태로 보관됩니다.`
                    : `선택한 장부 ${result.skippedCount || 0}건은 이미 현재 계정에 가져온 기록입니다.`
            );
        } catch (error) {
            setNotice(error?.message || '가져오기 중 오류가 발생했습니다.');
        } finally {
            setIsImporting(false);
        }
    };

    const modeOptions = [
        { value: 'individual', label: '개별' },
        { value: 'month', label: '월별' },
        { value: 'year', label: '연도별' },
        { value: 'all', label: '전체' }
    ];

    const modeDescription = selectionMode === 'individual'
        ? '달력에서 날짜를 선택하세요. 날짜를 누르면 해당 날짜의 장부가 선택됩니다.'
        : selectionMode === 'month'
            ? '현재 달력의 정산 기간에 해당하는 게스트 장부를 모두 선택합니다.'
            : selectionMode === 'year'
                ? '설정된 집계일 기준으로 계산한 해당 연도의 게스트 장부를 모두 선택합니다.'
                : '기기에 남아 있는 모든 게스트 장부를 선택합니다.';

    const handleYearChange = (delta) => {
        const nextYear = selectedYear + delta;
        setSelectedYear(nextYear);
        const range = getGuestImportYearlyPeriodRange(nextYear, periodSettings.startDay, periodSettings.endDay);
        setSelectedForRange(range.startDate, range.endDate);
    };

    const getEntryColumnValue = (entry, column) => {
        const customItems = Array.isArray(entry.customItems) ? entry.customItems : [];
        const item = customItems.find((candidate) => String(candidate?.key) === column.key);

        if (item) {
            const count = Number(item.count) || 0;
            const itemAmount = Number(item.amount) || count * (Number(item.unitPrice) || 0);
            if (item.type === 'expense' || (count <= 0 && itemAmount > 0)) {
                return { primary: itemAmount > 0 ? formatWon(itemAmount) : '-', secondary: '' };
            }
            return {
                primary: count > 0 ? count.toLocaleString('ko-KR') + '건' : (itemAmount > 0 ? formatWon(itemAmount) : '-'),
                secondary: count > 0 && itemAmount > 0 ? formatWon(itemAmount) : ''
            };
        }

        const legacyValue = Number(entry[column.key]) || 0;
        if (legacyValue <= 0) return { primary: '-', secondary: '' };

        if (column.kind === 'quantity') {
            const amount = legacyValue * (Number(entry.unitPrice) || 0);
            return {
                primary: legacyValue.toLocaleString('ko-KR') + '건',
                secondary: amount > 0 ? formatWon(amount) : ''
            };
        }
        return { primary: formatWon(legacyValue), secondary: '' };
    };

    const getEntryTotalAmount = (entry) => {
        const stats = calculateData([entry], {});
        return entry.type === 'expense' ? stats.totalExpenses : stats.totalRevenue;
    };

    return (
        <div className={'mx-auto flex min-h-full w-full max-w-3xl flex-col ' + (dark ? 'text-slate-100' : 'text-slate-900')}>
            <div className="flex items-center gap-2 border-b px-1 py-3">
                <button type="button" onClick={onBack} className={'rounded-full p-2 ' + (dark ? 'hover:bg-slate-800' : 'hover:bg-slate-100')} aria-label="뒤로">
                    <ArrowLeft size={22} />
                </button>
                <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-black">게스트 장부 가져오기</h2>
                    <p className={'text-xs ' + (dark ? 'text-slate-400' : 'text-slate-500')}>가져올 날짜와 장부를 선택하세요.</p>
                </div>
                <span className={'rounded-full px-2.5 py-1 text-xs font-bold ' + (dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600')}>
                    {guestEntries.length.toLocaleString()}건
                </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-1 py-3 pb-28">
                <div className={'rounded-xl border p-1 ' + (dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50')}>
                    <div className="grid grid-cols-4 gap-1">
                        {modeOptions.map((option) => (
                            <button
                                type="button"
                                key={option.value}
                                onClick={() => handleModeChange(option.value)}
                                className={'rounded-lg px-1 py-2 text-sm font-bold transition-colors ' + (
                                    selectionMode === option.value
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : (dark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-white')
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <p className={'px-1 text-xs ' + (dark ? 'text-slate-400' : 'text-slate-500')}>{modeDescription}</p>

                {guestEntries.length === 0 ? (
                    <div className={'rounded-2xl border px-5 py-12 text-center ' + (dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white')}>
                        <FileText className={'mx-auto mb-3 ' + (dark ? 'text-slate-500' : 'text-slate-400')} size={34} />
                        <p className="font-bold">가져올 게스트 장부가 없습니다.</p>
                        <p className={'mt-1 text-xs ' + (dark ? 'text-slate-400' : 'text-slate-500')}>로그인하지 않은 상태에서 저장한 장부가 여기에 표시됩니다.</p>
                    </div>
                ) : (
                    <>
                        {(selectionMode === 'individual' || selectionMode === 'month') && (
                            <section className={'overflow-hidden rounded-2xl border shadow-sm ' + (dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white')}>
                                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 py-2">
                                    <div className="justify-self-start">
                                        {selectionMode === 'month' && (
                                            <div className="flex shrink-0 flex-nowrap items-center gap-1 whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    disabled={monthlyEntries.length === 0}
                                                    onClick={() => addEntriesForRange(monthlyPeriod.startDate, monthlyPeriod.endDate)}
                                                    className="inline-flex min-w-[48px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-blue-300 px-2.5 py-1.5 text-[11px] leading-none font-bold text-blue-600 disabled:opacity-40"
                                                >
                                                    전체
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={!monthlyEntries.some((entry) => selectedIds.has(String(entry.id)))}
                                                    onClick={() => removeEntriesForRange(monthlyPeriod.startDate, monthlyPeriod.endDate)}
                                                    className={'inline-flex min-w-[48px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] leading-none font-bold disabled:opacity-40 ' + (dark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-600')}
                                                >
                                                    해지
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-self-center gap-1">
                                        <button type="button" onClick={() => changeMonth(-1)} className="rounded-md p-0.5" aria-label="이전 달"><ChevronLeft size={19} /></button>
                                        <div className="whitespace-nowrap text-base font-black">{currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월</div>
                                        <button type="button" onClick={() => changeMonth(1)} className="rounded-md p-0.5" aria-label="다음 달"><ChevronRight size={19} /></button>
                                    </div>
                                    <div className="justify-self-end">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const today = new Date();
                                                const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                                                setCurrentCalendarDate(todayMonth);
                                            }}
                                            className="rounded-lg border border-amber-300 px-2 py-1 text-xs font-bold text-amber-500"
                                        >
                                            오늘
                                        </button>
                                    </div>
                                </div>

                                <div className={'grid grid-cols-7 border-y text-center text-[10px] font-black ' + (dark ? 'border-slate-700' : 'border-slate-200')}>
                                    {WEEKDAYS.map((day, index) => (
                                        <div key={day} className={'py-1.5 ' + (index === 0 ? 'text-rose-500' : index === 6 ? 'text-blue-500' : (dark ? 'text-slate-400' : 'text-slate-500'))}>{day}</div>
                                    ))}
                                </div>

                                <div className={'grid w-full grid-cols-7 border-l ' + (dark ? 'border-slate-700' : 'border-slate-200')}>
                                    {calendarDays.map((dayInfo, index) => {
                                        const isSelected = dayInfo.selectedCount > 0;
                                        return (
                                            <button
                                                type="button"
                                                key={dayInfo.date}
                                                disabled={dayInfo.count === 0}
                                                onClick={() => handleCalendarDayClick(dayInfo.date)}
                                                className={'relative flex h-20 min-w-0 flex-col items-center justify-start border-b border-r p-1 text-left transition-colors ' +
                                                    (dark ? 'border-slate-700 ' : 'border-slate-200 ') +
                                                    (isSelected
                                                        ? (dark ? 'bg-blue-900/40 ring-1 ring-inset ring-blue-500' : 'bg-blue-50 ring-1 ring-inset ring-blue-500')
                                                        : dayInfo.isToday
                                                            ? (dark ? 'bg-green-900/50' : 'bg-green-100')
                                                            : (dark ? 'bg-slate-900' : 'bg-white')) +
                                                    (!dayInfo.isCurrentMonth ? ' opacity-40' : '') +
                                                    (dayInfo.count === 0 ? ' cursor-default' : '')
                                                }
                                            >
                                                <div className="relative flex w-full items-center justify-between px-1">
                                                    <span className={'text-[clamp(11px,3.8vw,14px)] font-bold ' +
                                                        (!dayInfo.isCurrentMonth ? (dark ? 'text-slate-600' : 'text-slate-400') : '') +
                                                        (dayInfo.isCurrentMonth && index % 7 === 0 ? ' text-rose-500' : '') +
                                                        (dayInfo.isCurrentMonth && index % 7 === 6 ? ' text-blue-500' : '') +
                                                        (dayInfo.isToday ? (dark ? ' text-green-200' : ' text-green-800') : '')
                                                    }>{dayInfo.day}</span>
                                                </div>
                                                <div className="mt-1 flex w-full flex-col items-center justify-start gap-y-0.5">
                                                    {dayInfo.count > 0 && (
                                                        <>
                                                            <span className={'whitespace-nowrap text-[clamp(7px,2.35vw,10px)] font-bold leading-tight ' + (isSelected ? 'text-blue-500' : (dark ? 'text-slate-300' : 'text-slate-600'))}>
                                                                {dayInfo.count}건
                                                            </span>
                                                            {dayInfo.selectedCount > 0 && (
                                                                <span className="whitespace-nowrap text-[8px] font-bold text-blue-500">
                                                                    선택 {dayInfo.selectedCount}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {selectionMode === 'month' && (
                                    <div className={'px-3 py-2 text-xs ' + (dark ? 'text-slate-400' : 'text-slate-500')}>
                                        정산 기간: {monthlyPeriod.startDate} ~ {monthlyPeriod.endDate}
                                    </div>
                                )}
                            </section>
                        )}

                        {selectionMode === 'year' && (
                            <section className={'rounded-2xl border p-3 ' + (dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white')}>
                                <div className="flex items-center justify-center gap-5">
                                    <button type="button" onClick={() => handleYearChange(-1)} aria-label="이전 연도"><ChevronLeft size={20} /></button>
                                    <strong className="text-lg">{selectedYear}년</strong>
                                    <button type="button" onClick={() => handleYearChange(1)} aria-label="다음 연도"><ChevronRight size={20} /></button>
                                </div>
                                <button type="button" onClick={() => {
                                    const range = getGuestImportYearlyPeriodRange(selectedYear, periodSettings.startDay, periodSettings.endDay);
                                    setSelectedForRange(range.startDate, range.endDate);
                                }} className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white">
                                    {selectedYear}년 장부 전체 선택
                                </button>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    {Array.from({ length: 12 }, (_, index) => {
                                        const month = String(index + 1).padStart(2, '0');
                                        const monthRange = getGuestImportYearMonthRange(
                                            selectedYear,
                                            index,
                                            periodSettings.startDay,
                                            periodSettings.endDay
                                        );
                                        const monthEntries = getEntriesInRange(guestEntries, monthRange.startDate, monthRange.endDate);
                                        const count = monthEntries.length;
                                        const selectedCount = monthEntries.filter((entry) => selectedIds.has(String(entry.id))).length;
                                        const isFullySelected = count > 0 && selectedCount === count;
                                        const isPartiallySelected = selectedCount > 0 && !isFullySelected;
                                        const monthCardClass = isFullySelected
                                            ? (dark ? 'border-blue-500 bg-blue-950/50 text-blue-200' : 'border-blue-400 bg-blue-50 text-blue-800')
                                            : isPartiallySelected
                                                ? (dark ? 'border-blue-700 bg-blue-950/25 text-blue-200' : 'border-blue-300 bg-blue-50/50 text-blue-700')
                                                : (dark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-800');
                                        return (
                                            <button
                                                type="button"
                                                key={month}
                                                disabled={count === 0}
                                                onClick={() => toggleEntriesForRange(monthRange.startDate, monthRange.endDate)}
                                                aria-pressed={isFullySelected}
                                                className={'min-w-0 rounded-lg border px-2 py-2 text-center transition-colors disabled:cursor-default disabled:opacity-50 ' + monthCardClass}
                                            >
                                                <div className="text-sm font-bold">{index + 1}월</div>
                                                <div className={'text-xs ' + (isFullySelected ? (dark ? 'text-blue-300' : 'text-blue-600') : (dark ? 'text-slate-400' : 'text-slate-500'))}>
                                                    {count}건
                                                </div>
                                                {selectedCount > 0 && (
                                                    <div className={'mt-0.5 text-[10px] font-bold ' + (isFullySelected ? 'text-blue-500' : (dark ? 'text-blue-300' : 'text-blue-600'))}>
                                                        선택 {selectedCount}건
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {selectionMode === 'all' && (
                            <section className={'rounded-2xl border p-4 ' + (dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white')}>
                                <FileText size={28} className="mx-auto mb-2 text-blue-500" />
                                <p className="text-center font-bold">모든 게스트 장부</p>
                                <p className={'mt-1 text-center text-sm ' + (dark ? 'text-slate-400' : 'text-slate-500')}>
                                    {guestEntries.length.toLocaleString()}건의 장부를 한 번에 선택합니다.
                                </p>
                                <button type="button" onClick={() => setSelectedEntryIds(guestEntries.map((entry) => String(entry.id)))} className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white">
                                    전체 장부 선택
                                </button>
                            </section>
                        )}

                        {tableEntries.length > 0 && (
                            <section className={'overflow-hidden rounded-2xl border shadow-sm ' + (dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white')}>
                                <div className="flex items-center justify-between gap-2 px-3 py-3">
                                    <div className="min-w-0">
                                        <h3 className="font-black">
                                            {selectionMode === 'month' ? '정산 기간 장부 상세' : '선택 장부 상세'}
                                        </h3>
                                        <p className={'mt-0.5 text-[11px] ' + (dark ? 'text-slate-400' : 'text-slate-500')}>
                                            {selectionMode === 'month'
                                                ? monthlyPeriod.startDate + ' ~ ' + monthlyPeriod.endDate
                                                : '장부에 실제 입력된 항목을 열로 표시합니다.'}
                                        </p>
                                    </div>
                                    <span className={'shrink-0 text-xs font-bold ' + (dark ? 'text-slate-300' : 'text-slate-600')}>
                                        {tableEntries.filter((entry) => selectedIds.has(String(entry.id))).length + '/' + tableEntries.length + '건 선택'}
                                    </span>
                                </div>
                                <div className="w-full overflow-x-auto">
                                    <table className="min-w-max w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className={dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}>
                                                <th className="border-y px-3 py-2 font-bold">날짜</th>
                                                <th className="border-y px-3 py-2 font-bold">회전</th>
                                                {tableColumns.map((column) => (
                                                    <th key={column.key} className="border-y px-3 py-2 text-right font-bold whitespace-nowrap">
                                                        {column.label}
                                                    </th>
                                                ))}
                                                <th className="border-y px-3 py-2 text-right font-black whitespace-nowrap">금액</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableEntries.map((entry, rowIndex) => {
                                                const checked = selectedIds.has(String(entry.id));
                                                const dateKey = getGuestEntryDateKey(entry.date);
                                                const amount = getEntryTotalAmount(entry);
                                                return (
                                                    <tr
                                                        key={entry.id}
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-pressed={checked}
                                                        aria-label={dateKey + ' 장부 ' + (checked ? '선택됨, 다시 누르면 해제' : '선택하려면 누르기')}
                                                        onClick={() => handleEntryToggle(entry.id)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault();
                                                                handleEntryToggle(entry.id);
                                                            }
                                                        }}
                                                        className={'cursor-pointer transition-colors ' +
                                                            (checked
                                                                ? (dark ? 'bg-blue-900/40 ring-1 ring-inset ring-blue-500 hover:bg-blue-900/55' : 'bg-blue-50 ring-1 ring-inset ring-blue-400 hover:bg-blue-100')
                                                                : (rowIndex % 2 === 0
                                                                    ? (dark ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white hover:bg-blue-50/60')
                                                                    : (dark ? 'bg-slate-800/60 hover:bg-slate-800' : 'bg-slate-50 hover:bg-blue-50/60')))}
                                                    >
                                                        <td className="border-b px-3 py-2 whitespace-nowrap font-medium">
                                                            {dateKey || entry.date || '-'}
                                                        </td>
                                                        <td className="border-b px-3 py-2 whitespace-nowrap">
                                                            {entry.round ? entry.round + '회전' : '기존'}
                                                        </td>
                                                        {tableColumns.map((column) => {
                                                            const cell = getEntryColumnValue(entry, column);
                                                            return (
                                                                <td key={column.key} className="border-b px-3 py-2 text-right whitespace-nowrap">
                                                                    <div className="font-semibold">{cell.primary}</div>
                                                                    {cell.secondary && (
                                                                        <div className={'mt-0.5 text-[10px] ' + (dark ? 'text-slate-400' : 'text-slate-500')}>
                                                                            {cell.secondary}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="border-b px-3 py-2 text-right whitespace-nowrap">
                                                            <div className={'font-black ' + (entry.type === 'expense' ? 'text-blue-500' : 'text-rose-500')}>
                                                                {formatWon(amount)}
                                                            </div>
                                                            <div className={'mt-0.5 text-[10px] ' + (dark ? 'text-slate-400' : 'text-slate-500')}>
                                                                {entry.type === 'expense' ? '지출' : '수익'}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className={'border-t px-3 py-2 text-[10px] ' + (dark ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400')}>
                                    항목 열은 현재 표시된 장부에 실제 존재하는 데이터만 자동으로 구성됩니다. 표는 좌우로 밀어 더 많은 항목을 확인할 수 있습니다.
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>

            <div className={'sticky bottom-0 border-t px-3 py-3 ' + (dark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white')}>
                {selectedEntries.length > 0 && (
                    <div className="mb-2 grid grid-cols-3 gap-2 text-center">
                        <div className={'rounded-lg p-2 ' + (dark ? 'bg-slate-900' : 'bg-slate-50')}>
                            <div className={'text-[10px] ' + (dark ? 'text-slate-400' : 'text-slate-500')}>선택 날짜</div>
                            <div className="text-sm font-black tabular-nums">{selectedDateCount}일</div>
                        </div>
                        <div className={'rounded-lg p-2 ' + (dark ? 'bg-slate-900' : 'bg-slate-50')}>
                            <div className={'text-[10px] ' + (dark ? 'text-slate-400' : 'text-slate-500')}>선택 장부</div>
                            <div className="text-sm font-black tabular-nums">{selectedEntries.length}건</div>
                        </div>
                        <div className={'rounded-lg p-2 ' + (dark ? 'bg-slate-900' : 'bg-slate-50')}>
                            <div className={'text-[10px] ' + (dark ? 'text-slate-400' : 'text-slate-500')}>예상 순수익</div>
                            <div className="text-sm font-black tabular-nums">{formatWon(selectedSummary.netProfit)}</div>
                        </div>
                    </div>
                )}
                {notice && (
                    <div className={'mb-2 rounded-lg px-3 py-2 text-xs ' + (dark ? 'bg-slate-900 text-slate-300' : 'bg-blue-50 text-blue-800')}>
                        {notice}
                    </div>
                )}
                <button
                    type="button"
                    disabled={!userId || selectedEntries.length === 0 || isImporting || !isDataLoaded}
                    onClick={handleImport}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isImporting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    {isImporting ? '가져오는 중...' : `선택한 게스트 장부 ${selectedEntries.length.toLocaleString()}건 가져오기`}
                </button>
                {!isDataLoaded && <p className={'mt-2 text-center text-[11px] ' + (dark ? 'text-slate-500' : 'text-slate-400')}>계정 장부를 불러오는 중입니다.</p>}
            </div>
        </div>
    );
}

export default GuestLedgerImportView;
