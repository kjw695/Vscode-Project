import React, { useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    ArrowUpRight,
    BarChart3,
    ChevronLeft,
    ChevronRight,
    Layers,
    ListFilter,
    Plus
} from 'lucide-react';
import { calculateData } from '../utils/calculator';
import GoalProgressBar from './GoalProgressBar';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const CATEGORY_BAR_CLASSES = [
    'bg-cyan-500',
    'bg-pink-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-orange-500'
];

const toDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
};

const parseLocalDate = (dateKey) => {
    const parts = String(dateKey || '').split('-').map(Number);
    if (parts.length !== 3 || !parts.every(Number.isFinite)) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2]);
};

const formatCompactManWon = (amount) => {
    const value = Number(amount) || 0;
    if (value <= 0) return '-';
    const man = Math.round((value / 10000) * 10) / 10;
    return (Number.isInteger(man) ? String(man) : man.toFixed(1)) + '만';
};

const formatSummaryWon = (amount) => {
    const value = Number(amount) || 0;
    if (value <= 0) return '0원';
    const man = Math.round((value / 10000) * 10) / 10;
    return (Number.isInteger(man) ? String(man) : man.toFixed(1)) + '만원';
};

const getSelectedVolume = (profit, selectedItems) => {
    const details = profit?.revenueDetails || {};
    return (selectedItems || []).reduce((total, itemName) => {
        return total + (Number(details[itemName]?.count) || 0);
    }, 0);
};

const isDayOffEntry = (entry) => Boolean(
    entry?.isDayOff === true ||
    (typeof entry?.memo === 'string' && entry.memo.includes('휴무')) ||
    (Array.isArray(entry?.customItems) &&
        entry.customItems.some((item) => item?.key === 'dayOff' || item?.key === '휴무'))
);

const getDayVolume = (profit, selectedItems) => getSelectedVolume(profit, selectedItems);

const BluecoinsDailySummaryPreview = ({
    entries = [],
    monthlyProfit = {},
    previousMonthlyProfit = {},
    selectedMonth,
    goal = 0,
    selectedInsurance,
    selectedItemsForAverage = ['배송', '반품'],
    itemLabels = {},
    isDarkMode,
    onBack,
    onSwitchPreview,
    onOpenInsurance,
    currentCalendarDate,
    calendarDays = [],
    calendarMode = 'money',
    onToggleCalendarMode,
    onMonthChange,
    onToday,
    onDateClick
}) => {
    const dark = Boolean(isDarkMode);
    const [calendarDisplayStyle, setCalendarDisplayStyle] = useState('both');
    const [activeReportTab, setActiveReportTab] = useState('categories');
    const [isDayMode, setIsDayMode] = useState(true);
    const swipeStartRef = useRef(null);
    const suppressChartClickRef = useRef(false);
    const [swipeDirection, setSwipeDirection] = useState(null);
    const [selectedDate, setSelectedDate] = useState(() => {
        const activeCalendarDates = (Array.isArray(calendarDays) ? calendarDays : [])
            .filter((day) => day?.isCurrentMonth && (Number(day?.revenue) > 0 || Number(day?.expenses) > 0))
            .map((day) => day.date)
            .filter((date) => typeof date === 'string')
            .sort();
        if (activeCalendarDates.length) return activeCalendarDates[activeCalendarDates.length - 1];

        const validDates = (Array.isArray(entries) ? entries : [])
            .map((entry) => entry?.date)
            .filter((date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
            .sort();
        return validDates.length ? validDates[validDates.length - 1] : toDateKey(new Date());
    });

    const dailyMap = useMemo(() => {
        const grouped = {};
        (Array.isArray(entries) ? entries : []).forEach((entry) => {
            if (!entry?.date) return;
            if (!grouped[entry.date]) grouped[entry.date] = [];
            grouped[entry.date].push(entry);
        });
        return Object.keys(grouped).reduce((result, dateKey) => {
            result[dateKey] = calculateData(grouped[dateKey], itemLabels);
            return result;
        }, {});
    }, [entries, itemLabels]);

    const recent7Days = useMemo(() => {
        const base = parseLocalDate(selectedDate);
        return Array.from({ length: 7 }, (_, index) => {
            const date = new Date(base);
            date.setDate(base.getDate() - (6 - index));
            const dateKey = toDateKey(date);
            const daily = dailyMap[dateKey] || {};
            return {
                date: dateKey,
                day: WEEKDAYS[date.getDay()],
                dayNumber: date.getDate(),
                weekdayIndex: date.getDay(),
                income: Number(daily.totalRevenue) || 0,
                expense: Number(daily.totalExpenses) || 0,
                volume: getDayVolume(daily, selectedItemsForAverage)
            };
        });
    }, [selectedDate, dailyMap, selectedItemsForAverage]);

    const currentVolume = getSelectedVolume(monthlyProfit, selectedItemsForAverage);
    const previousVolume = getSelectedVolume(previousMonthlyProfit, selectedItemsForAverage);
    const currentRevenue = Number(monthlyProfit?.totalRevenue) || 0;
    const workingDays = Number(monthlyProfit?.totalWorkingDays) || 0;
    const dailyAverageIncome = workingDays > 0 ? Math.round(currentRevenue / workingDays) : 0;
    const dailyAverageVolume = workingDays > 0 ? Math.round(currentVolume / workingDays) : 0;
    const effectiveTargetDays = Math.max(25, workingDays);
    const remainingWorkDays = Math.max(0, effectiveTargetDays - workingDays);
    const expectedTotalIncome = dailyAverageIncome * effectiveTargetDays;
    const expectedTotalVolume = dailyAverageVolume * effectiveTargetDays;
    const holidayCount = calendarDays.filter((day) => day?.isCurrentMonth && day?.isDayOff).length;
    const totalOffDays = holidayCount;
    const previousIncome = Number(previousMonthlyProfit?.totalRevenue) || 0;
    const incomeDiff = currentRevenue - previousIncome;
    const incomeDiffPct = previousIncome > 0 ? ((incomeDiff / previousIncome) * 100).toFixed(1) : '0.0';
    const volumeDiff = currentVolume - previousVolume;
    const volumeDiffPct = previousVolume > 0 ? ((volumeDiff / previousVolume) * 100).toFixed(1) : '0.0';
    const averageIncomeDiff = dailyAverageIncome - (Number(previousMonthlyProfit?.totalWorkingDays) > 0
        ? Math.round(previousIncome / Number(previousMonthlyProfit.totalWorkingDays))
        : 0);
    const averageVolumeDiff = dailyAverageVolume - (Number(previousMonthlyProfit?.totalWorkingDays) > 0
        ? Math.round(previousVolume / Number(previousMonthlyProfit.totalWorkingDays))
        : 0);
    const maxRecentValue = Math.max(
        1,
        ...recent7Days.map((day) => calendarMode === 'money' ? day.income : day.volume)
    );
    const selectedDayData = dailyMap[selectedDate] || {};
    const selectedDayIncome = Number(selectedDayData.totalRevenue) || 0;
    const selectedDayExpense = Number(selectedDayData.totalExpenses) || 0;
    const selectedDayVolume = getDayVolume(selectedDayData, selectedItemsForAverage);
    const insuranceName = selectedInsurance?.name
        ? selectedInsurance.name.split('(')[0].trim()
        : '보험사 미등록';

    const currentPeriodDates = useMemo(() => {
        return new Set(calendarDays.filter((day) => day?.isCurrentMonth && day?.date).map((day) => day.date));
    }, [calendarDays]);

    const reportEntries = useMemo(() => {
        if (isDayMode) return entries.filter((entry) => entry?.date === selectedDate);
        if (currentPeriodDates.size > 0) {
            return entries.filter((entry) => currentPeriodDates.has(entry?.date));
        }
        return entries.filter((entry) => String(entry?.date || '').startsWith(String(selectedMonth || '')));
    }, [entries, isDayMode, selectedDate, currentPeriodDates, selectedMonth]);

    const reportData = useMemo(
        () => calculateData(reportEntries, itemLabels),
        [reportEntries, itemLabels]
    );

    const categoryRows = useMemo(() => {
        const rows = [];
        Object.entries(reportData.revenueDetails || {}).forEach(([name, value]) => {
            rows.push({ name, type: 'income', amount: Number(value?.amount) || 0, count: Number(value?.count) || 0 });
        });
        Object.entries(reportData.expenseDetails || {}).forEach(([name, value]) => {
            rows.push({ name, type: 'expense', amount: Number(value?.amount) || 0, count: Number(value?.count) || 0 });
        });
        return rows.sort((a, b) => b.amount - a.amount);
    }, [reportData]);

    const unitPriceRows = reportData.unitPriceAnalysis || [];

    const transactionRows = useMemo(() => {
        return reportEntries.map((entry, index) => {
            const data = calculateData([entry], itemLabels);
            const names = Array.isArray(entry?.customItems)
                ? entry.customItems
                    .filter((item) => item?.type === 'income' || item?.type === 'expense')
                    .map((item) => itemLabels[item.key] || item.name || item.key)
                    .filter(Boolean)
                : [];
            return {
                key: entry?.id || entry?.date + '-' + (entry?.round || index),
                date: entry?.date || '',
                round: Number(entry?.round) || 0,
                names,
                income: Number(data.totalRevenue) || 0,
                expense: Number(data.totalExpenses) || 0,
                volume: getDayVolume(data, selectedItemsForAverage),
                memo: entry?.memo || ''
            };
        }).sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return a.round - b.round;
        });
    }, [reportEntries, itemLabels, selectedItemsForAverage]);

    const panelClass = dark
        ? 'bg-slate-900 border-slate-800 text-slate-100'
        : 'bg-white border-slate-200 text-slate-900';
    const mutedClass = dark ? 'text-slate-400' : 'text-slate-500';
    const dividerClass = dark ? 'border-slate-800' : 'border-slate-200';
    const selectedTone = calendarMode === 'money'
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-emerald-600 dark:text-emerald-400';
    const selectedBg = calendarMode === 'money'
        ? 'bg-blue-500/15 ring-blue-500'
        : 'bg-emerald-500/15 ring-emerald-500';

    const shiftSelectedDate = (delta) => {
        const date = parseLocalDate(selectedDate);
        date.setDate(date.getDate() + delta);
        setSelectedDate(toDateKey(date));
    };

    const handleRecent7DaysTouchStart = (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleRecent7DaysTouchEnd = (event) => {
        const start = swipeStartRef.current;
        swipeStartRef.current = null;
        const touch = event.changedTouches?.[0];
        if (!start || !touch) return;

        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;
        if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;

        const direction = deltaX < 0 ? 'next' : 'previous';
        setSwipeDirection(direction);
        suppressChartClickRef.current = true;
        window.setTimeout(() => {
            suppressChartClickRef.current = false;
        }, 350);
        shiftSelectedDate(direction === 'next' ? 1 : -1);
    };

    const reportTitle = isDayMode
        ? selectedDate + ' 하루 요약'
        : (selectedMonth || '') + ' 장부 기간 전체 요약';

    return (
        <div className="w-full px-2 pb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
                <button
                    type="button"
                    onClick={onBack}
                    className={'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold ' + (dark ? 'text-gray-200 hover:bg-gray-800' : 'text-slate-600 hover:bg-slate-100')}
                >
                    <ArrowLeft size={17} /> 기본 홈
                </button>
                <div className={'inline-flex rounded-xl p-0.5 text-[11px] font-bold ' + (dark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <button
                        type="button"
                        onClick={() => onSwitchPreview?.('integrated')}
                        className={'rounded-lg px-2.5 py-1.5 ' + (dark ? 'text-slate-400' : 'text-slate-500')}
                    >통합형</button>
                    <button
                        type="button"
                        className={'rounded-lg px-2.5 py-1.5 ' + (dark ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm')}
                    >장부형</button>
                </div>
                <span className={'text-[11px] font-semibold whitespace-nowrap ' + mutedClass}>
                    {selectedMonth ? selectedMonth.replace('-', '년 ') + '월' : ''}
                </span>
            </div>

            <section className={'overflow-hidden rounded-2xl border shadow-sm ' + panelClass}>
                <div className={'grid grid-cols-4 divide-x ' + dividerClass}>
                    <div className="min-w-0 px-1 py-2 text-center">
                        <div className={'text-[10px] whitespace-nowrap ' + mutedClass}>근무일</div>
                        <div className="mt-0.5 text-sm font-black tabular-nums">{workingDays}일</div>
                    </div>
                    <div className="min-w-0 px-1 py-2 text-center">
                        <div className={'text-[10px] whitespace-nowrap ' + mutedClass}>휴무일</div>
                        <div className="mt-0.5 text-sm font-black tabular-nums text-rose-500">{totalOffDays}일</div>
                    </div>
                    <div className="min-w-0 px-1 py-2 text-center">
                        <div className={'text-[10px] whitespace-nowrap ' + mutedClass}>남은 근무</div>
                        <div className="mt-0.5 text-sm font-black tabular-nums text-purple-500">{remainingWorkDays}일</div>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenInsurance}
                        className={'min-w-0 px-1 py-2 text-center ' + (dark ? 'hover:bg-slate-800' : 'hover:bg-slate-50')}
                    >
                        <div className={'text-[10px] whitespace-nowrap ' + mutedClass}>보험사</div>
                        <div className="mt-0.5 truncate text-[11px] font-black">{insuranceName}</div>
                    </button>
                </div>

                <div className={'border-t px-3 pt-3 pb-3 ' + dividerClass}>
                    <div className="flex min-w-0 items-center gap-1">
                        <div className={'flex shrink-0 items-center gap-0 rounded-xl p-0.5 ' + (dark ? 'bg-slate-800' : 'bg-slate-100')}>
                            <button
                                type="button"
                                onClick={() => shiftSelectedDate(-1)}
                                className="rounded-lg p-0.5 hover:bg-white/70 dark:hover:bg-slate-700"
                                aria-label="이전 날짜"
                            ><ChevronLeft size={13} /></button>
                            <span className="whitespace-nowrap px-0.5 text-[10px] sm:text-[11px] font-black">
                                {selectedDate.slice(5).replace('-', '.')} ({WEEKDAYS[parseLocalDate(selectedDate).getDay()]})
                            </span>
                            <button
                                type="button"
                                onClick={() => shiftSelectedDate(1)}
                                className="rounded-lg p-0.5 hover:bg-white/70 dark:hover:bg-slate-700"
                                aria-label="다음 날짜"
                            ><ChevronRight size={13} /></button>
                        </div>
                        <div className={'min-w-0 flex-1 overflow-hidden text-ellipsis rounded-xl px-1 py-1 text-center text-[8px] sm:text-[9px] font-black whitespace-nowrap ' + (
                            (calendarMode === 'money' ? incomeDiff : volumeDiff) >= 0
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        )}>
                            전월 대비 {calendarMode === 'money'
                                ? ((incomeDiff >= 0 ? '▲' : '▼') + formatCompactManWon(Math.abs(incomeDiff)) + ' (' + incomeDiffPct + '%)')
                                : ((volumeDiff >= 0 ? '▲' : '▼') + Math.abs(volumeDiff).toLocaleString() + '건 (' + volumeDiffPct + '%)')}
                        </div>
                        <div className={'inline-flex shrink-0 whitespace-nowrap rounded-xl p-0.5 text-[10px] font-black ' + (dark ? 'bg-slate-800' : 'bg-slate-100')}>
                            <button
                                type="button"
                                onClick={() => onToggleCalendarMode?.('money')}
                                className={'rounded-lg px-1.5 sm:px-2 py-1 whitespace-nowrap ' + (calendarMode === 'money' ? 'bg-blue-600 text-white' : mutedClass)}
                            >금액</button>
                            <button
                                type="button"
                                onClick={() => onToggleCalendarMode?.('volume')}
                                className={'rounded-lg px-1.5 sm:px-2 py-1 whitespace-nowrap ' + (calendarMode === 'volume' ? 'bg-emerald-600 text-white' : mutedClass)}
                            >물량</button>
                        </div>
                    </div>

                    <style>{'@keyframes bluecoinsRecentSlideFromRight { from { opacity: 0.72; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } } @keyframes bluecoinsRecentSlideFromLeft { from { opacity: 0.72; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }'}</style>
                    <div
                        key={selectedDate}
                        onTouchStart={handleRecent7DaysTouchStart}
                        onTouchEnd={handleRecent7DaysTouchEnd}
                        onTouchCancel={() => { swipeStartRef.current = null; }}
                        style={{
                            touchAction: 'pan-y',
                            animation: swipeDirection === 'next'
                                ? 'bluecoinsRecentSlideFromRight 220ms ease-out'
                                : swipeDirection === 'previous'
                                    ? 'bluecoinsRecentSlideFromLeft 220ms ease-out'
                                    : 'none'
                        }}
                        className={'mt-2 rounded-2xl border px-2 pt-3 pb-2 ' + (dark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-100 bg-slate-50')}
                    >
                        <div className="grid grid-cols-7 items-end gap-1">
                            {recent7Days.map((day) => {
                                const value = calendarMode === 'money' ? day.income : day.volume;
                                const barHeight = value > 0 ? Math.max(7, Math.round((value / maxRecentValue) * 58)) : 4;
                                const label = calendarMode === 'money'
                                    ? formatCompactManWon(day.income)
                                    : (day.volume > 0 ? day.volume.toLocaleString() + '건' : '-');
                                const isSelected = day.date === selectedDate;
                                return (
                                    <button
                                        key={day.date}
                                        type="button"
                                        onClick={() => {
                                            if (suppressChartClickRef.current) return;
                                            setSwipeDirection(null);
                                            setSelectedDate(day.date);
                                        }}
                                        className={'flex min-w-0 flex-col items-center rounded-xl px-0.5 py-1 transition ' + (
                                            isSelected
                                                ? (calendarMode === 'money' ? 'bg-blue-500/10 ring-1 ring-blue-500/70' : 'bg-emerald-500/10 ring-1 ring-emerald-500/70')
                                                : (dark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-200/60')
                                        )}
                                    >
                                        <div className="flex h-[76px] w-full flex-col items-center justify-end">
                                            <span className={'mb-1 whitespace-nowrap text-[9px] font-black leading-none ' + (isSelected ? selectedTone : mutedClass)}>{label}</span>
                                            <div
                                                style={{ height: barHeight + 'px' }}
                                                className={'w-5 rounded-t-lg transition-all ' + (
                                                    value <= 0
                                                        ? (dark ? 'bg-slate-700' : 'bg-slate-200')
                                                        : calendarMode === 'money'
                                                            ? 'bg-blue-500/80'
                                                            : 'bg-emerald-500/80'
                                                )}
                                            />
                                        </div>
                                        <span className={'mt-1 text-[11px] font-black ' + (
                                            isSelected ? selectedTone : day.weekdayIndex === 0 ? 'text-rose-500' : day.weekdayIndex === 6 ? 'text-blue-500' : ''
                                        )}>{day.day}</span>
                                        <span className={'text-[9px] font-bold ' + mutedClass}>{day.dayNumber}일</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className={'mt-2 grid grid-cols-3 rounded-2xl p-2.5 text-center ' + (dark ? 'bg-slate-800/80' : 'bg-slate-100')}>
                        <div className="min-w-0 px-0.5">
                            <p className={'whitespace-nowrap text-[9px] font-bold ' + mutedClass}>{calendarMode === 'money' ? '일 평균 금액' : '일 평균 배송량'}</p>
                            <p className="mt-0.5 whitespace-nowrap text-[12px] font-black">{calendarMode === 'money' ? formatSummaryWon(dailyAverageIncome) : dailyAverageVolume.toLocaleString() + '건'}</p>
                            <p className="mt-0.5 whitespace-nowrap text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                                전월대비 {calendarMode === 'money'
                                    ? ((averageIncomeDiff >= 0 ? '▲' : '▼') + formatCompactManWon(Math.abs(averageIncomeDiff)))
                                    : ((averageVolumeDiff >= 0 ? '▲' : '▼') + Math.abs(averageVolumeDiff) + '건')}
                            </p>
                        </div>
                        <div className={'min-w-0 border-x px-0.5 ' + dividerClass}>
                            <p className={'whitespace-nowrap text-[9px] font-bold ' + mutedClass}>{calendarMode === 'money' ? '총 금액' : '총 배송량'}</p>
                            <p className={'mt-0.5 whitespace-nowrap text-[12px] font-black ' + (calendarMode === 'money' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400')}>
                                {calendarMode === 'money' ? formatSummaryWon(currentRevenue) : currentVolume.toLocaleString() + '건'}
                            </p>
                            <p className="mt-0.5 whitespace-nowrap text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                                전월대비 {calendarMode === 'money'
                                    ? ((incomeDiff >= 0 ? '▲' : '▼') + formatCompactManWon(Math.abs(incomeDiff)))
                                    : ((volumeDiff >= 0 ? '▲' : '▼') + Math.abs(volumeDiff) + '건')}
                            </p>
                        </div>
                        <div className="min-w-0 px-0.5">
                            <p className={'whitespace-nowrap text-[9px] font-bold ' + mutedClass}>{calendarMode === 'money' ? '예상 총금액' : '예상 총배송량'}</p>
                            <p className="mt-0.5 whitespace-nowrap text-[12px] font-black text-amber-600 dark:text-amber-400">
                                {calendarMode === 'money' ? formatSummaryWon(expectedTotalIncome) : expectedTotalVolume.toLocaleString() + '건'}
                            </p>
                            <p className={'mt-0.5 whitespace-nowrap text-[8px] font-semibold ' + mutedClass}>월 {effectiveTargetDays}일 근무 기준</p>
                        </div>
                    </div>

                    <div className={'mt-2 rounded-lg p-2 sm:p-4 shadow-md ' + (dark ? 'bg-gray-800' : 'bg-white')}>
                        <GoalProgressBar
                            current={monthlyProfit?.totalRevenue || 0}
                            goal={goal}
                            isDarkMode={dark}
                            revenueDistribution={monthlyProfit?.revenueDistribution}
                        />
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[10px]">
                        <span className={'min-w-0 truncate ' + mutedClass}>
                            <strong className={dark ? 'text-slate-200' : 'text-slate-800'}>{selectedDate.slice(8)}일 ({WEEKDAYS[parseLocalDate(selectedDate).getDay()]})</strong>
                            {' · 매출 ' + formatSummaryWon(selectedDayIncome) + ' · 물량 ' + selectedDayVolume.toLocaleString() + '건'}
                            {selectedDayExpense > 0 ? ' · 지출 ' + formatCompactManWon(selectedDayExpense) : ''}
                        </span>
                        <button
                            type="button"
                            onClick={() => onDateClick?.(selectedDate)}
                            className="inline-flex shrink-0 items-center gap-1 font-black text-blue-600 dark:text-blue-400"
                        ><Plus size={12} /> 내역 열기</button>
                    </div>
                </div>
            </section>

            <section className={'mt-2 rounded-2xl border p-3 shadow-sm ' + panelClass}>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onMonthChange?.(-1)}
                            className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                            aria-label="이전 장부 기간"
                        ><ChevronLeft size={17} /></button>
                        <h2 className="whitespace-nowrap text-sm font-black">
                            {currentCalendarDate?.getFullYear()}년 {Number(currentCalendarDate?.getMonth()) + 1}월
                        </h2>
                        <button
                            type="button"
                            onClick={() => onMonthChange?.(1)}
                            className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                            aria-label="다음 장부 기간"
                        ><ChevronRight size={17} /></button>
                        <button
                            type="button"
                            onClick={onToday}
                            className={'ml-0.5 rounded-lg px-2 py-1 text-[9px] font-bold ' + (dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600')}
                        >오늘</button>
                    </div>
                    <div className={'inline-flex shrink-0 rounded-xl p-0.5 text-[9px] font-bold ' + (dark ? 'bg-slate-800' : 'bg-slate-100')}>
                        {[
                            { key: 'dots', label: '점' },
                            { key: 'both', label: '점+금액' },
                            { key: 'numbers', label: '금액' }
                        ].map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => setCalendarDisplayStyle(option.key)}
                                className={'rounded-lg px-2 py-1 ' + (calendarDisplayStyle === option.key ? (dark ? 'bg-slate-700 text-white' : 'bg-white text-blue-600 shadow-sm') : mutedClass)}
                            >{option.label}</button>
                        ))}
                    </div>
                </div>

                <div className={'mt-3 grid grid-cols-7 text-center text-[10px] font-black ' + mutedClass}>
                    <span className="text-rose-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) => {
                        const hasActivity = Number(day?.revenue) > 0 || Number(day?.expenses) > 0 || Number(day?.volumeDisplayTotal ?? day?.volume) > 0;
                        const isSelected = day?.date === selectedDate;
                        const isCurrentPeriod = Boolean(day?.isCurrentMonth);
                        const volumeValue = Number(day?.volumeDisplayTotal ?? day?.volume) || 0;
                        const isPending = day?.extraDayOffRequestStatus === 'pending';
                        const isApproved = day?.extraDayOffRequestStatus === 'approved' || day?.extraDayOffRequestStatus === 'accepted';
                        const isRejected = day?.extraDayOffRequestStatus === 'rejected';
                        return (
                            <button
                                key={day?.date || 'blank-' + index}
                                type="button"
                                disabled={!day?.date}
                                onClick={() => day?.date && setSelectedDate(day.date)}
                                className={'relative flex aspect-square min-w-0 flex-col items-center justify-between rounded-xl border p-1 transition ' + (
                                    isSelected
                                        ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                                        : hasActivity && isCurrentPeriod
                                            ? (dark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-100 bg-slate-50')
                                            : 'border-transparent'
                                ) + (!isCurrentPeriod ? ' opacity-40' : '')}
                            >
                                <span className={'text-[10px] font-black ' + (
                                    isSelected ? 'text-blue-500' : index % 7 === 0 ? 'text-rose-500' : index % 7 === 6 ? 'text-blue-500' : ''
                                )}>{day?.day || ''}</span>
                                {calendarDisplayStyle !== 'numbers' && (
                                    <div className="flex min-h-[7px] items-center gap-1">
                                        {Number(day?.revenue) > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                                        {Number(day?.expenses) > 0 && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                                        {day?.isDayOff && <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />}
                                        {isPending && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
                                        {isApproved && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                                        {isRejected && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                                    </div>
                                )}
                                {calendarDisplayStyle !== 'dots' && (
                                    <div className="w-full space-y-0.5 text-center leading-none">
                                        {isCurrentPeriod && Number(day?.revenue) > 0 && (
                                            <span className="block truncate text-[7px] font-bold text-emerald-600 dark:text-emerald-400">+{formatCompactManWon(day.revenue)}</span>
                                        )}
                                        {isCurrentPeriod && Number(day?.expenses) > 0 && (
                                            <span className="block truncate text-[7px] font-bold text-rose-500">-{formatCompactManWon(day.expenses)}</span>
                                        )}
                                        {isCurrentPeriod && calendarMode === 'volume' && volumeValue > 0 && (
                                            <span className="block truncate text-[7px] font-bold text-slate-600 dark:text-slate-300">{volumeValue}건</span>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className={'mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 border-t pt-2 text-[9px] font-bold ' + dividerClass + ' ' + mutedClass}>
                    <span><span className="text-emerald-500">●</span> 수익</span>
                    <span><span className="text-rose-500">●</span> 지출</span>
                    <span><span className="text-slate-400">●</span> 휴무</span>
                    <span><span className="text-orange-500">●</span> 대기</span>
                    <span><span className="text-blue-500">●</span> 승인</span>
                    <span><span className="text-red-500">●</span> 거절</span>
                </div>
            </section>

            <section className={'mt-2 rounded-2xl border p-3 shadow-sm ' + panelClass}>
                <div className={'grid grid-cols-3 rounded-xl p-1 text-[10px] font-black ' + (dark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <button
                        type="button"
                        onClick={() => setActiveReportTab('categories')}
                        className={'flex items-center justify-center gap-1 rounded-lg py-2 ' + (activeReportTab === 'categories' ? (dark ? 'bg-slate-700 text-blue-300' : 'bg-white text-blue-600 shadow-sm') : mutedClass)}
                    ><BarChart3 size={13} /> 항목별 비중</button>
                    <button
                        type="button"
                        onClick={() => setActiveReportTab('unitPrice')}
                        className={'flex items-center justify-center gap-1 rounded-lg py-2 ' + (activeReportTab === 'unitPrice' ? (dark ? 'bg-slate-700 text-blue-300' : 'bg-white text-blue-600 shadow-sm') : mutedClass)}
                    ><Layers size={13} /> 단가별 집계</button>
                    <button
                        type="button"
                        onClick={() => setActiveReportTab('transactions')}
                        className={'flex items-center justify-center gap-1 rounded-lg py-2 ' + (activeReportTab === 'transactions' ? (dark ? 'bg-slate-700 text-blue-300' : 'bg-white text-blue-600 shadow-sm') : mutedClass)}
                    ><ListFilter size={13} /> 회차별 내역</button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 px-1">
                    <div className="min-w-0">
                        <p className={'truncate text-[10px] font-bold ' + mutedClass}>{reportTitle} · {reportEntries.length}개 기록</p>
                        <h3 className="mt-0.5 text-base font-black">
                            순수익 <span className="text-blue-600 dark:text-blue-400">{(Number(reportData.netProfit) || 0).toLocaleString()}원</span>
                        </h3>
                    </div>
                    <div className={'inline-flex shrink-0 rounded-lg p-0.5 text-[9px] font-bold ' + (dark ? 'bg-slate-800' : 'bg-slate-100')}>
                        <button
                            type="button"
                            onClick={() => setIsDayMode(true)}
                            className={'rounded-md px-2 py-1 ' + (isDayMode ? (dark ? 'bg-slate-700 text-white' : 'bg-white text-blue-600 shadow-sm') : mutedClass)}
                        >일</button>
                        <button
                            type="button"
                            onClick={() => setIsDayMode(false)}
                            className={'rounded-md px-2 py-1 ' + (!isDayMode ? (dark ? 'bg-slate-700 text-white' : 'bg-white text-blue-600 shadow-sm') : mutedClass)}
                        >월</button>
                    </div>
                </div>

                <div className="mt-3">
                    {activeReportTab === 'categories' && (
                        categoryRows.length === 0 ? (
                            <p className={'py-8 text-center text-xs ' + mutedClass}>해당 기간에 기록된 데이터가 없습니다.</p>
                        ) : (
                            <div className="space-y-3">
                                {categoryRows.map((category, index) => {
                                    const base = category.type === 'income'
                                        ? Number(reportData.totalRevenue) || 0
                                        : Number(reportData.totalExpenses) || 0;
                                    const percent = base > 0 ? Math.round((category.amount / base) * 100) : 0;
                                    return (
                                        <div key={category.type + '-' + category.name} className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2 text-[10px]">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span className={'max-w-[110px] truncate rounded-md px-2 py-0.5 font-black ' + (
                                                        category.type === 'income'
                                                            ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                                    )}>{category.name}</span>
                                                    <span className={'whitespace-nowrap ' + mutedClass}>{category.count.toLocaleString()}건</span>
                                                </div>
                                                <span className="shrink-0 font-black">
                                                    <span className={category.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}>
                                                        {category.type === 'income' ? '+' : '-'}{category.amount.toLocaleString()}원
                                                    </span>
                                                    <span className={'ml-1 ' + mutedClass}>({percent}%)</span>
                                                </span>
                                            </div>
                                            <div className={'h-2 overflow-hidden rounded-full ' + (dark ? 'bg-slate-800' : 'bg-slate-100')}>
                                                <div
                                                    className={'h-full rounded-full ' + (category.type === 'income' ? CATEGORY_BAR_CLASSES[index % CATEGORY_BAR_CLASSES.length] : 'bg-rose-500')}
                                                    style={{ width: Math.max(percent, 3) + '%' }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}

                    {activeReportTab === 'unitPrice' && (
                        unitPriceRows.length === 0 ? (
                            <p className={'py-8 text-center text-xs ' + mutedClass}>집계할 단가 데이터가 없습니다.</p>
                        ) : (
                            <div className="space-y-2.5">
                                {unitPriceRows.map((unit) => {
                                    const count = (unit.items || []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
                                    const percent = Number(reportData.totalRevenue) > 0
                                        ? Math.round((Number(unit.totalAmount) / Number(reportData.totalRevenue)) * 100)
                                        : 0;
                                    return (
                                        <div key={unit.priceLabel} className={'rounded-xl border p-3 ' + (dark ? 'border-slate-800 bg-slate-800/50' : 'border-slate-200 bg-slate-50')}>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-black text-blue-600 dark:text-blue-400">{unit.priceLabel}</span>
                                                <span className="text-xs font-black">{Number(unit.totalAmount).toLocaleString()}원 ({percent}%)</span>
                                            </div>
                                            <div className={'mt-1.5 flex items-center justify-between gap-2 text-[10px] ' + mutedClass}>
                                                <span className="truncate">총 물량 {count.toLocaleString()}건</span>
                                                <span>{(unit.items || []).length}개 항목</span>
                                            </div>
                                            <div className={'mt-2 h-2 overflow-hidden rounded-full ' + (dark ? 'bg-slate-700' : 'bg-slate-200')}>
                                                <div className="h-full rounded-full bg-blue-500" style={{ width: Math.max(percent, 3) + '%' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}

                    {activeReportTab === 'transactions' && (
                        transactionRows.length === 0 ? (
                            <p className={'py-8 text-center text-xs ' + mutedClass}>기록된 회차 내역이 없습니다.</p>
                        ) : (
                            <div className="space-y-2">
                                {transactionRows.map((row) => (
                                    <div key={row.key} className={'flex items-center justify-between gap-2 rounded-xl border p-2.5 ' + (dark ? 'border-slate-800 bg-slate-800/50' : 'border-slate-200 bg-slate-50')}>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={'rounded-md px-2 py-0.5 text-[9px] font-black ' + (dark ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700')}>
                                                    {row.round === 0 ? '기타' : row.round + '회차'}
                                                </span>
                                                <span className="truncate text-[10px] font-black">{row.names.length ? row.names.join(' · ') : '배송/지출 기록'}</span>
                                            </div>
                                            <p className={'mt-1 truncate text-[9px] ' + mutedClass}>
                                                {row.date}{row.memo ? ' · ' + row.memo : ''}{' · 물량 ' + row.volume.toLocaleString() + '건'}
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            {row.income > 0 && <div className="text-[10px] font-black text-emerald-500">+{row.income.toLocaleString()}원</div>}
                                            {row.expense > 0 && <div className="text-[10px] font-black text-rose-500">-{row.expense.toLocaleString()}원</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>

                <div className={'mt-3 flex items-center justify-between border-t pt-2 ' + dividerClass}>
                    <span className={'text-[9px] ' + mutedClass}>미리보기 화면 · 실제 장부 데이터를 읽기 전용으로 표시</span>
                    <button
                        type="button"
                        onClick={() => onDateClick?.(selectedDate)}
                        className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 dark:text-blue-400"
                    >선택 날짜 내역 보기 <ArrowUpRight size={12} /></button>
                </div>
            </section>
        </div>
    );
};

export default BluecoinsDailySummaryPreview;
