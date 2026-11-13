import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowUpRight,
    ArrowRightLeft,
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
const VOLUME_METRICS = [
    { key: 'deliveryCount', label: '배송', shortLabel: '배' },
    { key: 'deliveryInterruptionAmount', label: '중단', shortLabel: '중' },
    { key: 'returnCount', label: '반품', shortLabel: '반' },
    { key: 'freshBagCount', label: '프레시백', shortLabel: '프' }
];
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

const buildChartDays = (startDate, endDate, dailyMap, selectedItems) => {
    const days = [];
    const cursor = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    while (cursor <= end && days.length < 10000) {
        const dateKey = toDateKey(cursor);
        const daily = dailyMap[dateKey] || {};
        days.push({
            date: dateKey,
            day: WEEKDAYS[cursor.getDay()],
            dayNumber: cursor.getDate(),
            weekdayIndex: cursor.getDay(),
            income: Number(daily.totalRevenue) || 0,
            expense: Number(daily.totalExpenses) || 0,
            volume: getDayVolume(daily, selectedItems)
        });
        cursor.setDate(cursor.getDate() + 1);
    }

    return days;
};

const getShiftedDateKey = (dateKey, amount) => {
    const date = parseLocalDate(dateKey);
    date.setDate(date.getDate() + amount);
    return toDateKey(date);
};

const BluecoinsDailySummaryPreview = ({
    entries = [],
    monthlyProfit = {},
    previousMonthlyProfit = {},
    selectedMonth,
    monthlyEndDay,
    goal = 0,
    selectedInsurance,
    selectedItemsForAverage = ['배송', '반품'],
    itemLabels = {},
    isDarkMode,
    onOpenInsurance,
    currentCalendarDate,
    calendarDays = [],
    calendarMode = 'money',
    onToggleCalendarMode,
    onMonthChange,
    onToday,
    onDateClick,
    onOpenDayOff,
    onSelectedDateChange,
    homeCalendarDesign = 'current',
    homeCalendarVolumeItems = {},
    incomeConfig = []
}) => {
    const dark = Boolean(isDarkMode);
    const [activeReportTab, setActiveReportTab] = useState('categories');
    const [isDayMode, setIsDayMode] = useState(true);
    const chartScrollRef = useRef(null);
    const reportSectionRef = useRef(null);
    const chartAlignmentRequestRef = useRef(null);
    const chartInitialAlignmentRef = useRef(true);
    const [chartVisibleStartIndex, setChartVisibleStartIndex] = useState(0);
    const [chartAlignmentVersion, setChartAlignmentVersion] = useState(0);
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

    useEffect(() => {
        onSelectedDateChange?.(selectedDate);
    }, [selectedDate, onSelectedDateChange]);

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

    const chartDateBounds = useMemo(() => {
        const validDates = [
            ...(Array.isArray(entries) ? entries.map((entry) => entry?.date) : []),
            ...(Array.isArray(calendarDays) ? calendarDays.map((day) => day?.date) : [])
        ]
            .filter((date) => typeof date === 'string' && date.length === 10 && date[4] === '-' && date[7] === '-')
            .sort();

        const firstDate = validDates[0] || selectedDate;
        const lastDate = validDates[validDates.length - 1] || selectedDate;
        return {
            start: getShiftedDateKey(firstDate, -30),
            end: getShiftedDateKey(lastDate, 30)
        };
    }, [entries, calendarDays, selectedDate]);

    const chartDays = useMemo(
        () => buildChartDays(chartDateBounds.start, chartDateBounds.end, dailyMap, selectedItemsForAverage),
        [chartDateBounds.start, chartDateBounds.end, dailyMap, selectedItemsForAverage]
    );

    const currentVolume = getSelectedVolume(monthlyProfit, selectedItemsForAverage);
    const previousVolume = getSelectedVolume(previousMonthlyProfit, selectedItemsForAverage);
    const currentRevenue = Number(monthlyProfit?.totalRevenue) || 0;
    const workingDays = Number(monthlyProfit?.totalWorkingDays) || 0;
    const dailyAverageIncome = workingDays > 0 ? Math.round(currentRevenue / workingDays) : 0;
    const dailyAverageVolume = workingDays > 0 ? Math.round(currentVolume / workingDays) : 0;
    const effectiveTargetDays = Math.max(25, workingDays);
    const remainingWorkDays = Math.max(0, effectiveTargetDays - workingDays);
    const expectedTotalVolume = dailyAverageVolume * effectiveTargetDays;

    // 장부 홈의 예상 급여는 예상 총금액 값에만 적용합니다.
    const salaryRemainingCalendarDays = useMemo(() => {
        if (!selectedMonth || !monthlyEndDay) return 1;
        try {
            const [year, month] = selectedMonth.split('-').map(Number);
            const endDate = new Date(year, month - 1, monthlyEndDay);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            return diffDays > 0 ? diffDays : 1;
        } catch (error) {
            return 1;
        }
    }, [selectedMonth, monthlyEndDay]);

    const salaryFutureHolidays = useMemo(() => {
        if (!Array.isArray(entries) || entries.length === 0) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return entries.filter((entry) => {
            if (!entry || !entry.date || typeof entry.date !== 'string') return false;
            const parts = entry.date.split('-');
            if (parts.length !== 3) return false;

            const [year, month, day] = parts.map(Number);
            const entryDate = new Date(year, month - 1, day);

            const hasHolidayMemo = typeof entry.memo === 'string' && entry.memo.includes('휴무');
            const isDayOffType = entry.isDayOff === true;
            const hasDayOffCustomItem = Array.isArray(entry.customItems) &&
                entry.customItems.some((item) => item?.key === 'dayOff' || item?.key === '휴무');
            return entryDate >= today && (hasHolidayMemo || isDayOffType || hasDayOffCustomItem);
        }).length;
    }, [entries]);

    const salaryRemainingWorkDays = Math.max(0, salaryRemainingCalendarDays - salaryFutureHolidays);
    const expectedTotalIncome = currentRevenue + (dailyAverageIncome * salaryRemainingWorkDays);
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
        const groupedByRound = new Map();
        const transactionVolumeMetrics = VOLUME_METRICS;

        reportEntries.forEach((entry) => {
            const data = calculateData([entry], itemLabels);
            const isExpenseEntry = entry?.type === 'expense' ||
                ((Number(data.totalExpenses) || 0) > 0 && (Number(data.totalRevenue) || 0) <= 0);
            const round = Number(entry?.round) || 0;
            const key = isExpenseEntry ? 'expense' : (round > 0 ? 'round-' + round : 'other');

            if (!groupedByRound.has(key)) {
                groupedByRound.set(key, {
                    key,
                    rowType: isExpenseEntry ? 'expense' : 'round',
                    round,
                    recordCount: 0,
                    dates: new Set(),
                    income: 0,
                    expense: 0,
                    volumeBreakdown: transactionVolumeMetrics.reduce((result, metric) => {
                        result[metric.key] = 0;
                        return result;
                    }, {})
                });
            }

            const row = groupedByRound.get(key);
            row.recordCount += 1;
            if (entry?.date) row.dates.add(entry.date);
            row.income += Number(data.totalRevenue) || 0;
            row.expense += Number(data.totalExpenses) || 0;

            if (!isExpenseEntry) transactionVolumeMetrics.forEach((metric) => {
                const customItemLabels = Array.isArray(entry?.customItems)
                    ? entry.customItems
                        .filter((item) => item?.key === metric.key)
                        .map((item) => itemLabels[item.key] || item.name || item.key)
                    : [];
                const labelCandidates = new Set([
                    itemLabels[metric.key],
                    metric.label,
                    metric.key,
                    ...customItemLabels
                ].filter(Boolean));
                const count = Object.entries(data.revenueDetails || {}).reduce(
                    (total, [name, value]) => (
                        labelCandidates.has(name) ? total + (Number(value?.count) || 0) : total
                    ),
                    0
                );
                row.volumeBreakdown[metric.key] += count;
            });
        });

        return Array.from(groupedByRound.values())
            .map((row) => ({
                ...row,
                dateCount: row.dates.size,
                volume: Object.values(row.volumeBreakdown).reduce((total, count) => total + count, 0)
            }))
            .sort((a, b) => {
                if (a.rowType === 'expense') return 1;
                if (b.rowType === 'expense') return -1;
                if (a.round === 0) return 1;
                if (b.round === 0) return -1;
                return a.round - b.round;
            });
    }, [reportEntries, itemLabels, isDayMode]);

    const transactionTotal = useMemo(() => transactionRows.reduce((total, row) => {
        total.deliveryCount += Number(row.volumeBreakdown?.deliveryCount) || 0;
        total.deliveryInterruptionAmount += Number(row.volumeBreakdown?.deliveryInterruptionAmount) || 0;
        total.returnCount += Number(row.volumeBreakdown?.returnCount) || 0;
        total.freshBagCount += Number(row.volumeBreakdown?.freshBagCount) || 0;
        total.income += Number(row.income) || 0;
        return total;
    }, {
        deliveryCount: 0,
        deliveryInterruptionAmount: 0,
        returnCount: 0,
        freshBagCount: 0,
        income: 0
    }), [transactionRows]);

    const rotationTransactionRows = transactionRows.filter((row) => row.rowType !== 'expense');
    const expenseTotal = transactionRows.reduce((total, row) => (
        total + (row.rowType === 'expense' ? (Number(row.expense) || 0) : 0)
    ), 0);

    const panelClass = dark
        ? 'bg-slate-900 border-slate-800 text-slate-100'
        : 'bg-white border-slate-200 text-slate-900';
    const mutedClass = dark ? 'text-slate-400' : 'text-slate-500';
    const dividerClass = dark ? 'border-slate-800' : 'border-slate-200';
    const selectedTone = calendarMode === 'money'
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-emerald-600 dark:text-emerald-400';

    const selectDateAndAlignChart = (dateKey, behavior = 'auto') => {
        chartAlignmentRequestRef.current = { dateKey, behavior };
        setSelectedDate(dateKey);
        setChartAlignmentVersion((version) => version + 1);
    };

    const shiftSelectedDate = (delta) => {
        selectDateAndAlignChart(getShiftedDateKey(selectedDate, delta), 'smooth');
    };

    const handleChartScroll = (event) => {
        const scrollElement = event.currentTarget;
        const dayWidth = scrollElement.clientWidth / 7;
        if (dayWidth <= 0 || chartDays.length === 0) return;

        const maxStartIndex = Math.max(0, chartDays.length - 7);
        const nextStartIndex = Math.max(
            0,
            Math.min(maxStartIndex, Math.round(scrollElement.scrollLeft / dayWidth))
        );
        const nextSelectedDate = chartDays[Math.min(chartDays.length - 1, nextStartIndex + 6)]?.date;

        setChartVisibleStartIndex((current) => (
            current === nextStartIndex ? current : nextStartIndex
        ));
        if (nextSelectedDate) {
            setSelectedDate((current) => (
                current === nextSelectedDate ? current : nextSelectedDate
            ));
        }
    };

    useEffect(() => {
        const request = chartAlignmentRequestRef.current;
        const targetDate = request?.dateKey || (chartInitialAlignmentRef.current ? selectedDate : null);
        if (!targetDate || !chartScrollRef.current || chartScrollRef.current.clientWidth <= 0) return;

        const firstVisibleDate = getShiftedDateKey(targetDate, -6);
        const startIndex = chartDays.findIndex((day) => day.date === firstVisibleDate);
        if (startIndex < 0) return;

        const dayWidth = chartScrollRef.current.clientWidth / 7;
        const targetScrollLeft = startIndex * dayWidth;
        if (request?.behavior === 'smooth') {
            chartScrollRef.current.scrollTo({
                left: targetScrollLeft,
                behavior: 'smooth'
            });
        } else {
            // 달력에서 날짜를 고르면 중간 날짜를 순서대로 거치지 않고 즉시 해당 주간으로 이동합니다.
            chartScrollRef.current.scrollLeft = targetScrollLeft;
        }
        setChartVisibleStartIndex(startIndex);
        chartAlignmentRequestRef.current = null;
        chartInitialAlignmentRef.current = false;
    }, [selectedDate, chartDays, chartAlignmentVersion]);

    const renderRecentChart = (days) => {
        const visibleDays = days.slice(chartVisibleStartIndex, chartVisibleStartIndex + 7);
        const maxValue = Math.max(
            1,
            ...visibleDays.map((day) => calendarMode === 'money' ? day.income : day.volume)
        );

        return (
            <div
                className="flex w-full items-end"
                style={{ width: (days.length / 7) * 100 + '%' }}
            >
                {days.map((day) => {
                    const value = calendarMode === 'money' ? day.income : day.volume;
                    const barHeight = value > 0 ? Math.max(7, Math.round((value / maxValue) * 58)) : 4;
                    const label = calendarMode === 'money'
                        ? formatCompactManWon(day.income)
                        : (day.volume > 0 ? day.volume.toLocaleString() + '건' : '-');
                    const isSelected = day.date === selectedDate;
                    return (
                        <button
                            key={day.date}
                            data-chart-date={day.date}
                            type="button"
                            onClick={() => setSelectedDate(day.date)}
                            className={'flex min-w-0 flex-col items-center rounded-xl px-0.5 py-1 ' + (
                                isSelected
                                    ? (calendarMode === 'money' ? 'bg-blue-500/10 ring-1 ring-blue-500/70' : 'bg-emerald-500/10 ring-1 ring-emerald-500/70')
                                    : (dark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-200/60')
                            )}
                            style={{ flex: '0 0 ' + (100 / days.length) + '%' }}
                        >
                            <div className="flex h-[76px] w-full flex-col items-center justify-end">
                                <span className={'mb-1 whitespace-nowrap text-[9px] font-black leading-none ' + (isSelected ? selectedTone : mutedClass)}>{label}</span>
                                <div
                                    style={{ height: barHeight + 'px' }}
                                    className={'w-5 rounded-t-lg ' + (
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
        );
    };

    const openCategoryBreakdown = () => {
        setIsDayMode(true);
        setActiveReportTab('categories');
        reportSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const reportTitle = isDayMode
        ? selectedDate + ' 하루 요약'
        : (selectedMonth || '') + ' 장부 기간 전체 요약';

    return (
        <div className="w-full px-2 pb-4">
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
                        <div className="mt-0.5 text-sm font-black tabular-nums text-purple-500">{salaryRemainingWorkDays}일</div>
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

                <div className={'border-t px-2 pt-2 pb-2 ' + dividerClass}>
                    <div className="flex min-w-0 items-center gap-1">
                        <div className={'flex shrink-0 items-center gap-0 rounded-xl p-0.5 ' + (dark ? 'bg-slate-800' : 'bg-slate-100')}>
                            <button
                                type="button"
                                onClick={() => shiftSelectedDate(-1)}
                                className="rounded-lg p-0.5 hover:bg-white/70 dark:hover:bg-slate-700"
                                aria-label="이전 날짜"
                            ><ChevronLeft size={13} /></button>
                            <span className="whitespace-nowrap px-0.5 text-[11px] sm:text-xs font-black">
                                {selectedDate.slice(5).replace('-', '.')} ({WEEKDAYS[parseLocalDate(selectedDate).getDay()]})
                            </span>
                            <button
                                type="button"
                                onClick={() => shiftSelectedDate(1)}
                                className="rounded-lg p-0.5 hover:bg-white/70 dark:hover:bg-slate-700"
                                aria-label="다음 날짜"
                            ><ChevronRight size={13} /></button>
                        </div>
                        <div className={'min-w-0 flex-1 overflow-hidden text-ellipsis rounded-xl px-1 py-1 text-center text-[10px] sm:text-[11px] font-black whitespace-nowrap ' + (
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

                    <style>{'.daily-summary-chart-scroll::-webkit-scrollbar { display: none; }'}</style>
                    <div
                        ref={chartScrollRef}
                        onScroll={handleChartScroll}
                        className={'daily-summary-chart-scroll mt-1 overflow-x-auto overflow-y-hidden rounded-2xl border pt-2 pb-2 ' + (dark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-100 bg-slate-50')}
                        style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            WebkitOverflowScrolling: 'touch',
                            overscrollBehaviorX: 'contain',
                            touchAction: 'pan-x pan-y'
                        }}
                    >
                        {renderRecentChart(chartDays)}
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
                            <p className={'mt-0.5 whitespace-nowrap text-[8px] font-semibold ' + mutedClass}>남은 근무 {salaryRemainingWorkDays}일 반영</p>
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
                            onClick={openCategoryBreakdown}
                            className="inline-flex shrink-0 items-center gap-1 font-black text-blue-600 dark:text-blue-400"
                        ><Plus size={12} /> 내역 열기</button>
                    </div>
                </div>
            </section>

            <section className={'mt-2 overflow-hidden rounded-2xl border shadow-sm ' + panelClass}>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 py-2">
                    <button
                        type="button"
                        onClick={() => onToggleCalendarMode?.(calendarMode === 'money' ? 'volume' : 'money')}
                        className={'justify-self-start rounded-lg border px-2 py-1 text-[10px] font-bold ' + (dark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700')}
                    >
                        <span className="inline-flex items-center gap-1"><ArrowRightLeft size={11} />{calendarMode === 'money' ? '금액' : '물량'}</span>
                    </button>
                    <div className="flex items-center justify-self-center gap-1">
                        <button type="button" onClick={() => onMonthChange?.(-1)} className="rounded-md p-0.5" aria-label="이전 달"><ChevronLeft size={19} /></button>
                        <div className="whitespace-nowrap text-sm font-black">{currentCalendarDate?.getFullYear()}년 {Number(currentCalendarDate?.getMonth()) + 1}월</div>
                        <button type="button" onClick={() => onMonthChange?.(1)} className="rounded-md p-0.5" aria-label="다음 달"><ChevronRight size={19} /></button>
                    </div>
                    <div className="flex w-full max-w-[90px] items-center justify-self-end gap-0.5">
                        <button type="button" onClick={onOpenDayOff} className="rounded-lg border border-indigo-300 px-2 py-1 text-[10px] font-bold text-indigo-500">휴무</button>
                        <button type="button" onClick={onToday} className="rounded-lg border border-amber-300 px-2 py-1 text-[10px] font-bold text-amber-500">오늘</button>
                    </div>
                </div>

                <div className={'grid grid-cols-7 border-y text-center text-[10px] font-black ' + dividerClass}>
                    {WEEKDAYS.map((day, index) => (
                        <div key={day} className={'py-1.5 ' + (index === 0 ? 'text-rose-500' : index === 6 ? 'text-blue-500' : mutedClass)}>{day}</div>
                    ))}
                </div>

                <div className={homeCalendarDesign === 'current'
                    ? 'grid w-full grid-cols-7 border-l ' + dividerClass
                    : 'grid grid-cols-7 gap-x-0 gap-y-0'
                }>
                    {calendarDays.map((dayInfo, index) => {
                        const isCurrentMonth = Boolean(dayInfo?.isCurrentMonth);
                        const isSelected = dayInfo?.date === selectedDate;
                        const isToday = Boolean(dayInfo?.isToday);
                        const isPending = dayInfo?.extraDayOffRequestStatus === 'pending';
                        const isApproved = dayInfo?.extraDayOffRequestStatus === 'approved' || dayInfo?.extraDayOffRequestStatus === 'accepted';
                        const isRejected = dayInfo?.extraDayOffRequestStatus === 'rejected' || dayInfo?.extraDayOffRequestStatus === 'declined';
                        const volumeTotal = Number(dayInfo?.volumeDisplayTotal ?? dayInfo?.volume) || 0;

                        return (
                            <button
                                type="button"
                                key={dayInfo?.date || 'empty-' + index}
                                disabled={!dayInfo?.date}
                                onClick={() => dayInfo?.date && selectDateAndAlignChart(dayInfo.date)}
                                className={(homeCalendarDesign === 'current'
                                    ? 'relative flex h-20 min-w-0 flex-col items-center justify-start border-b border-r p-1 text-left transition-colors ' + dividerClass
                                    : 'relative flex h-[62px] min-w-0 flex-col items-center justify-start rounded-md transition-colors') + ' ' + (
                                    isSelected
                                        ? (dark ? 'bg-blue-900/40 ring-1 ring-inset ring-blue-500' : 'bg-blue-50 ring-1 ring-inset ring-blue-500')
                                        : isToday
                                            ? (dark ? 'bg-green-900/50' : 'bg-green-100')
                                            : dayInfo?.isDayOff
                                                ? (dark ? 'bg-slate-800' : 'bg-slate-100')
                                                : (dark ? 'bg-slate-900' : 'bg-white')
                                ) + (!isCurrentMonth ? ' opacity-40' : '')
                                }
                            >
                                <div className={homeCalendarDesign === 'current'
                                    ? 'relative flex w-full items-center justify-between px-1'
                                    : 'relative flex h-[30px] w-full items-center justify-center'
                                }>
                                    <span className={homeCalendarDesign === 'current'
                                        ? 'text-[clamp(11px,3.8vw,14px)] font-bold ' +
                                            (!isCurrentMonth ? (dark ? 'text-slate-600' : 'text-slate-400') : '') +
                                            (isCurrentMonth && index % 7 === 0 ? ' text-rose-500' : '') +
                                            (isCurrentMonth && index % 7 === 6 ? ' text-blue-500' : '') +
                                            (isToday ? (dark ? ' text-green-200' : ' text-green-800') : '')
                                        : 'flex h-8 w-8 items-center justify-center rounded-full text-[clamp(11px,3.8vw,14px)] font-semibold ' +
                                            (!isCurrentMonth ? (dark ? 'text-slate-600' : 'text-slate-300') : '') +
                                            (isCurrentMonth && index % 7 === 0 ? ' text-rose-500' : '') +
                                            (isCurrentMonth && index % 7 === 6 ? ' text-blue-500' : '') +
                                            (isToday ? ' border-4 border-yellow-400 shadow-sm' : '')
                                    }>{dayInfo?.day || ''}</span>

                                    {isCurrentMonth && dayInfo?.extraDayOffRequestStatus && (
                                        <span className={'absolute top-1 right-1 h-1.5 w-1.5 rounded-full ' + (
                                            isPending ? 'bg-orange-500' : isApproved ? 'bg-blue-500' : isRejected ? 'bg-red-500' : ''
                                        )} />
                                    )}
                                </div>

                                <div className={homeCalendarDesign === 'current'
                                    ? 'mt-1 flex w-full flex-col items-center justify-start gap-y-0.5'
                                    : 'flex w-full flex-col items-center justify-start px-0.5 -mt-0.5'
                                }>
                                    {isCurrentMonth && dayInfo?.isDayOff && (
                                        <span className="whitespace-nowrap text-[clamp(7px,2.35vw,10px)] font-bold leading-tight text-slate-500 dark:text-slate-400">○ 휴무</span>
                                    )}

                                    {calendarMode === 'money' ? (
                                        <>
                                            {isCurrentMonth && volumeTotal > 0 && (
                                                <span className="whitespace-nowrap text-[clamp(7px,2.25vw,10px)] font-bold leading-tight text-slate-600 dark:text-slate-300">{volumeTotal.toLocaleString()}건</span>
                                            )}
                                            {isCurrentMonth && Number(dayInfo?.revenue) > 0 && (
                                                <span className="whitespace-nowrap text-rose-500 text-[clamp(7px,2.25vw,10px)] font-semibold leading-tight">{Number(dayInfo.revenue).toLocaleString()}원</span>
                                            )}
                                            {isCurrentMonth && Number(dayInfo?.expenses) > 0 && (
                                                <span className="whitespace-nowrap text-blue-500 text-[clamp(7px,2.25vw,10px)] font-medium leading-tight">{Number(dayInfo.expenses).toLocaleString()}원</span>
                                            )}
                                        </>
                                    ) : (
                                        <div className={homeCalendarDesign === 'current'
                                            ? 'flex w-full flex-col items-center gap-y-0'
                                            : 'grid w-full grid-cols-2 gap-x-0.5 gap-y-0'
                                        }>
                                            {isCurrentMonth && VOLUME_METRICS.map((metric) => {
                                                if (homeCalendarVolumeItems && homeCalendarVolumeItems[metric.key] === false) return null;
                                                const amount = Number(dayInfo?.volumeBreakdown?.[metric.key] || 0);
                                                if (amount <= 0) return null;
                                                const label = incomeConfig.find((item) => item.key === metric.key)?.label || metric.label;
                                                return (
                                                    <span
                                                        key={metric.key}
                                                        className="min-w-0 whitespace-nowrap text-[clamp(6px,1.9vw,9px)] font-semibold leading-tight text-slate-700 dark:text-slate-300"
                                                        title={label + ' ' + amount + '건'}
                                                    >{homeCalendarDesign === 'classic' ? metric.shortLabel : label} {amount}</span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className={'flex flex-wrap justify-center gap-x-3 gap-y-1 px-1 py-1.5 text-[9px] font-bold ' + mutedClass}>
                    <span><span className="text-slate-400">○</span> 휴무</span>
                    <span><span className="text-orange-500">●</span> 대기</span>
                    <span><span className="text-blue-500">●</span> 승인</span>
                    <span><span className="text-red-500">●</span> 거절</span>
                </div>
            </section>

            <section
                ref={reportSectionRef}
                className={'mt-2 scroll-mt-3 rounded-2xl border p-3 shadow-sm ' + panelClass}
            >
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
                    ><ListFilter size={13} /> 회전별 내역</button>
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
                            <p className={'py-8 text-center text-xs ' + mutedClass}>기록된 회전 내역이 없습니다.</p>
                        ) : (
                            <div className="-mx-1.5 w-[calc(100%+0.75rem)] overflow-x-auto">
                                <table className="w-[328px] min-w-[328px] table-fixed border-collapse text-[10px]">
                                    <colgroup>
                                        <col style={{ width: '40px' }} />
                                        <col style={{ width: '62px' }} />
                                        <col style={{ width: '48px' }} />
                                        <col style={{ width: '48px' }} />
                                        <col style={{ width: '56px' }} />
                                        <col style={{ width: '74px' }} />
                                    </colgroup>
                                    <thead>
                                        <tr className={dark
                                                ? 'border-b border-[#FFD500] bg-[#171717] text-white'
                                                : 'border-b border-[#FFD500] bg-[#202020] text-white'
                                            }>
                                            {['회전', '배송', '중단', '반품', '프레시백', '수익'].map((heading) => (
                                                <th key={heading} className="whitespace-nowrap px-0.5 py-1.5 text-center font-bold">{heading}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rotationTransactionRows.map((row, index) => (
                                            <tr key={row.key} className={dark
                                                ? (index % 2 === 0 ? 'border-b border-slate-800 bg-slate-900' : 'border-b border-slate-800 bg-slate-800/50')
                                                : (index % 2 === 0 ? 'border-b border-slate-100 bg-white' : 'border-b border-slate-100 bg-[#F7F7F7]')
                                            }>
                                                <td className="whitespace-nowrap px-0.5 py-1.5 text-center font-black">
                                                    {row.rowType === 'expense' ? '지출' : (row.round === 0 ? '기타' : row.round + '회전')}
                                                </td>
                                                <td className="whitespace-nowrap px-0.5 py-1.5 text-center tabular-nums">
                                                    {row.rowType === 'expense' ? '' : row.volumeBreakdown.deliveryCount.toLocaleString() + '건'}
                                                </td>
                                                <td className="whitespace-nowrap px-0.5 py-1.5 text-center tabular-nums">
                                                    {row.rowType === 'expense' ? '' : row.volumeBreakdown.deliveryInterruptionAmount.toLocaleString() + '건'}
                                                </td>
                                                <td className="whitespace-nowrap px-0.5 py-1.5 text-center tabular-nums">
                                                    {row.rowType === 'expense' ? '' : row.volumeBreakdown.returnCount.toLocaleString() + '건'}
                                                </td>
                                                <td className="whitespace-nowrap px-0.5 py-1.5 text-center tabular-nums">
                                                    {row.rowType === 'expense' ? '' : row.volumeBreakdown.freshBagCount.toLocaleString() + '건'}
                                                </td>
                                                <td className={'whitespace-nowrap px-0.5 py-1.5 text-right font-black tabular-nums ' + (dark ? 'text-white' : 'text-neutral-900')}>
                                                    {row.rowType === 'expense'
                                                        ? '-' + row.expense.toLocaleString() + '원'
                                                        : row.income.toLocaleString() + '원'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className={dark
                                            ? 'border-t-2 border-[#FFD500] bg-[#2B271B] text-slate-100'
                                            : 'border-t-2 border-[#F2C94C] bg-[#FFF9E8] text-neutral-900'
                                        }>
                                            <td className="whitespace-nowrap px-0.5 py-1.5 text-center font-black">합계</td>
                                            <td className="whitespace-nowrap px-0.5 py-1.5 text-center font-black tabular-nums">
                                                {transactionTotal.deliveryCount.toLocaleString()}건
                                            </td>
                                            <td className="whitespace-nowrap px-0.5 py-1.5 text-center font-black tabular-nums">
                                                {transactionTotal.deliveryInterruptionAmount.toLocaleString()}건
                                            </td>
                                            <td className="whitespace-nowrap px-0.5 py-1.5 text-center font-black tabular-nums">
                                                {transactionTotal.returnCount.toLocaleString()}건
                                            </td>
                                            <td className="whitespace-nowrap px-0.5 py-1.5 text-center font-black tabular-nums">
                                                {transactionTotal.freshBagCount.toLocaleString()}건
                                            </td>
                                            <td className={'whitespace-nowrap px-0.5 py-1.5 text-right font-black tabular-nums ' + (dark ? 'text-white' : 'text-neutral-900')}>
                                                {transactionTotal.income.toLocaleString()}원
                                            </td>
                                        </tr>
                                        {expenseTotal > 0 && (
                                            <tr className={dark
                                                ? 'border-t border-slate-700 bg-slate-900 text-slate-300'
                                                : 'border-t border-slate-200 bg-white text-neutral-700'
                                            }>
                                                <td className="whitespace-nowrap px-0.5 py-1.5 text-center font-black">지출</td>
                                                <td colSpan={4} />
                                                <td className="whitespace-nowrap px-0.5 py-1.5 text-right font-black tabular-nums">
                                                    -{expenseTotal.toLocaleString()}원
                                                </td>
                                            </tr>
                                        )}
                                    </tfoot>
                                </table>
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
