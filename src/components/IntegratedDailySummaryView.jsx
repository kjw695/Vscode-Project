import React, { useMemo } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Phone, ArrowRightLeft } from 'lucide-react';
import { calculateData } from '../utils/calculator';
import GoalProgressBar from './GoalProgressBar';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const toLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatCompactWon = (amount) => {
    const value = Number(amount) || 0;
    const absolute = Math.abs(value);
    if (absolute < 10000) return `${Math.round(value).toLocaleString('ko-KR')}원`;
    const man = Math.round(absolute / 1000) / 10;
    const formatted = man.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
    return `${value < 0 ? '-' : ''}${formatted}만원`;
};

const getSelectedVolume = (profit, selectedItems) => {
    const details = profit?.revenueDetails || {};
    return (selectedItems || []).reduce((total, itemName) => {
        return total + (Number(details[itemName]?.count) || 0);
    }, 0);
};

const getDayOffFlag = (entry) => Boolean(
    (typeof entry?.memo === 'string' && entry.memo.includes('휴무')) ||
    entry?.isDayOff === true ||
    (Array.isArray(entry?.customItems) &&
        entry.customItems.some((item) => item?.key === 'dayOff' || item?.key === '휴무'))
);

const getDeliveryReturnCounts = (dailyEntries, itemLabels) => {
    let delivery = 0;
    let returns = 0;

    dailyEntries.forEach((entry) => {
        const processedKeys = new Set();
        if (Array.isArray(entry.customItems)) {
            entry.customItems.forEach((item) => {
                if (item?.key) processedKeys.add(item.key);
                if (item?.type !== 'income') return;
                const label = String(itemLabels?.[item.key] || item.name || item.key || '');
                const count = Math.max(0, Number(item.count) || 0);

                if (item.key === 'deliveryCount' || (label.includes('배송') && !label.includes('중단'))) {
                    delivery += count;
                } else if (item.key === 'returnCount' || label.includes('반품')) {
                    returns += count;
                }
            });
        }
        if (!processedKeys.has('deliveryCount')) delivery += Math.max(0, Number(entry.deliveryCount) || 0);
        if (!processedKeys.has('returnCount')) returns += Math.max(0, Number(entry.returnCount) || 0);
    });

    return { delivery, returns, total: delivery + returns };
};

const IntegratedDailySummaryView = ({
    entries = [],
    monthlyProfit = {},
    previousMonthlyProfit = {},
    selectedMonth,
    monthlyEndDay,
    monthlyStartDay,
    goal = 0,
    selectedInsurance,
    selectedItemsForAverage = ['배송', '반품'],
    itemLabels = {},
    incomeConfig = [],
    isDarkMode,
    onBack,
    onOpenInsurance,
    currentCalendarDate,
    calendarDays = [],
    calendarMode = 'money',
    onToggleCalendarMode,
    onMonthChange,
    onToday,
    onDateClick,
    onOpenDayOff,
    homeCalendarDesign = 'current',
    homeCalendarVolumeItems = {}
}) => {
    const dailyChart = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Array.from({ length: 7 }, (_, index) => {
            const date = new Date(today);
            date.setDate(today.getDate() - (6 - index));
            const dateKey = toLocalDateKey(date);
            const dayEntries = entries.filter((entry) => entry?.date === dateKey && entry.type === 'income');
            const dayProfit = calculateData(dayEntries, itemLabels);
            const counts = getDeliveryReturnCounts(dayEntries, itemLabels);
            return {
                dateKey,
                day: DAY_LABELS[date.getDay()],
                revenue: Number(dayProfit.totalRevenue) || 0,
                ...counts
            };
        });
    }, [entries, itemLabels]);

    const periodSummary = useMemo(() => {
        const currentRevenue = Number(monthlyProfit?.totalRevenue) || 0;
        const previousRevenue = Number(previousMonthlyProfit?.totalRevenue) || 0;
        const workingDays = Number(monthlyProfit?.totalWorkingDays) || 0;
        const currentVolume = getSelectedVolume(monthlyProfit, selectedItemsForAverage);
        const previousVolume = getSelectedVolume(previousMonthlyProfit, selectedItemsForAverage);
        const dailyAverageRevenue = workingDays > 0 ? Math.round(currentRevenue / workingDays) : 0;
        const dailyAverageVolume = workingDays > 0 ? Math.round(currentVolume / workingDays) : 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [year, month] = String(selectedMonth || '').split('-').map(Number);
        const endDay = Number(monthlyEndDay) || 25;
        const endDate = year && month
            ? new Date(year, month - 1, endDay)
            : new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const remainingCalendarDays = Math.ceil((endDate.getTime() - today.getTime()) / 86400000) + 1;
        const safeRemainingCalendarDays = remainingCalendarDays > 0 ? remainingCalendarDays : 1;

        const futureHolidayDates = new Set(
            entries
                .filter((entry) => entry?.date && entry.date >= toLocalDateKey(today) && getDayOffFlag(entry))
                .map((entry) => entry.date)
        );
        const remainingWorkDays = Math.max(0, safeRemainingCalendarDays - futureHolidayDates.size);
        const estimatedSalary = currentRevenue + (dailyAverageRevenue * remainingWorkDays);
        const estimatedTotalVolume = currentVolume + (dailyAverageVolume * remainingWorkDays);
        const remainingGoal = Math.max(0, (Number(goal) || 0) - currentRevenue);
        const recommendedDailyIncome = Math.round(remainingGoal / safeRemainingCalendarDays);

        const holidayDates = new Set(
            calendarDays
                .filter((day) => day?.isCurrentMonth && day?.isDayOff)
                .map((day) => day.date)
        );

        return {
            workingDays,
            holidayCount: holidayDates.size,
            remainingWorkDays,
            currentRevenue,
            currentVolume,
            dailyAverageRevenue,
            dailyAverageVolume,
            estimatedSalary,
            estimatedTotalVolume,
            recommendedDailyIncome,
            comparisonValue: calendarMode === 'money'
                ? currentRevenue - previousRevenue
                : currentVolume - previousVolume
        };
    }, [
        monthlyProfit,
        previousMonthlyProfit,
        selectedItemsForAverage,
        selectedMonth,
        monthlyEndDay,
        entries,
        goal,
        calendarMode,
        calendarDays
    ]);

    const maxRevenue = Math.max(0, ...dailyChart.map((day) => day.revenue));
    const maxVolume = Math.max(0, ...dailyChart.map((day) => day.total));
    const dark = Boolean(isDarkMode);
    const panelClass = dark ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-slate-200 text-slate-800';
    const mutedClass = dark ? 'text-gray-400' : 'text-slate-500';
    const borderClass = dark ? 'border-gray-700' : 'border-slate-200';
    const insuranceName = selectedInsurance?.name ? selectedInsurance.name.split('(')[0].trim() : '';
    const comparisonColor = periodSummary.comparisonValue > 0
        ? (dark ? 'text-emerald-400' : 'text-emerald-700')
        : periodSummary.comparisonValue < 0
            ? (dark ? 'text-blue-400' : 'text-blue-700')
            : mutedClass;

    const statItems = calendarMode === 'money'
        ? [
            {
                label: '일 평균 매출',
                value: formatCompactWon(periodSummary.dailyAverageRevenue),
                subLabel: `권장 일수입 ${formatCompactWon(periodSummary.recommendedDailyIncome)}`
            },
            { label: '총 매출', value: formatCompactWon(periodSummary.currentRevenue) },
            { label: '예상 급여', value: formatCompactWon(periodSummary.estimatedSalary) },
            {
                label: '전월 대비',
                value: periodSummary.comparisonValue > 0
                    ? `+${formatCompactWon(periodSummary.comparisonValue)}`
                    : formatCompactWon(periodSummary.comparisonValue),
                valueClass: comparisonColor
            }
        ]
        : [
            { label: '일 평균 배송량', value: `${periodSummary.dailyAverageVolume.toLocaleString()}건` },
            { label: '총 배송량', value: `${periodSummary.currentVolume.toLocaleString()}건` },
            { label: '예상 총 배송량', value: `${Math.round(periodSummary.estimatedTotalVolume).toLocaleString()}건` },
            {
                label: '전월 대비',
                value: periodSummary.comparisonValue > 0
                    ? `+${periodSummary.comparisonValue.toLocaleString()}건`
                    : `${periodSummary.comparisonValue.toLocaleString()}건`,
                valueClass: comparisonColor
            }
        ];

    const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
    const volumeMetricList = [
        { key: 'deliveryCount', label: '배송', shortLabel: '배' },
        { key: 'deliveryInterruptionAmount', label: '중단', shortLabel: '중' },
        { key: 'returnCount', label: '반품', shortLabel: '반' },
        { key: 'freshBagCount', label: '프레시백', shortLabel: '프' }
    ];

    return (
        <div className="w-full px-2 pb-3">
            <div className="flex items-center justify-between mb-2">
                <button
                    type="button"
                    onClick={onBack}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold ${dark ? 'text-gray-200 hover:bg-gray-800' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    <ArrowLeft size={17} />
                    기본 홈
                </button>
                <span className={`text-xs font-medium ${mutedClass}`}>
                    {selectedMonth ? selectedMonth.replace('-', '년 ') + '월' : ''}
                </span>
            </div>

            <section className={`rounded-2xl border shadow-sm overflow-hidden ${panelClass}`}>
                <div className={`grid grid-cols-4 divide-x ${borderClass}`}>
                    <div className="min-w-0 px-1.5 py-2">
                        <div className={`text-[10px] whitespace-nowrap ${mutedClass}`}>근무일</div>
                        <div className="mt-0.5 text-sm font-bold tabular-nums">{periodSummary.workingDays}일</div>
                    </div>
                    <div className="min-w-0 px-1.5 py-2">
                        <div className={`text-[10px] whitespace-nowrap ${mutedClass}`}>휴무일</div>
                        <div className="mt-0.5 text-sm font-bold tabular-nums">{periodSummary.holidayCount}일</div>
                    </div>
                    <div className="min-w-0 px-1.5 py-2">
                        <div className={`text-[10px] whitespace-nowrap ${mutedClass}`}>남은 근무</div>
                        <div className="mt-0.5 text-sm font-bold tabular-nums">{periodSummary.remainingWorkDays}일</div>
                    </div>
                    <div className="min-w-0 px-1 py-2">
                        <div className={`text-[10px] whitespace-nowrap ${mutedClass}`}>보험사</div>
                        {selectedInsurance?.phone ? (
                            <a
                                href={`tel:${String(selectedInsurance.phone).replace(/[^0-9+]/g, '')}`}
                                onClick={(event) => event.stopPropagation()}
                                className="mt-0.5 flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap min-w-0"
                            >
                                <Phone size={11} className="shrink-0" />
                                <span className="truncate">{insuranceName || '전화'}</span>
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); onOpenInsurance?.(); }}
                                className="mt-0.5 text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap"
                            >
                                {insuranceName || '등록'}
                            </button>
                        )}
                    </div>
                </div>

                <div className={`border-t px-2.5 pt-2.5 pb-2 ${borderClass}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                            <div className="text-sm font-bold">일일 요약</div>
                            <div className={`text-[10px] ${mutedClass}`}>최근 7일 실적</div>
                        </div>
                        <div className={`inline-flex rounded-lg p-0.5 ${dark ? 'bg-gray-900' : 'bg-slate-100'}`}>
                            <button
                                type="button"
                                onClick={() => onToggleCalendarMode?.('money')}
                                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${calendarMode === 'money' ? (dark ? 'bg-gray-700 text-white shadow' : 'bg-white text-slate-800 shadow-sm') : mutedClass}`}
                            >금액</button>
                            <button
                                type="button"
                                onClick={() => onToggleCalendarMode?.('volume')}
                                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${calendarMode === 'volume' ? (dark ? 'bg-gray-700 text-white shadow' : 'bg-white text-slate-800 shadow-sm') : mutedClass}`}
                            >물량</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {dailyChart.map((day) => {
                            const activeValue = calendarMode === 'money' ? day.revenue : day.total;
                            const maxValue = calendarMode === 'money' ? maxRevenue : maxVolume;
                            const barHeight = activeValue > 0
                                ? calendarMode === 'money'
                                    ? Math.max(13, (activeValue / (maxValue || 1)) * 78)
                                    : Math.max(52, (activeValue / (maxValue || 1)) * 84)
                                : 3;

                            return (
                                <div key={day.dateKey} className="min-w-0 flex flex-col items-center">
                                    <div
                                        className={`h-4 w-full flex items-end justify-center overflow-hidden whitespace-nowrap font-semibold tabular-nums ${dark ? 'text-gray-200' : 'text-slate-700'}`}
                                        style={{ fontSize: 'clamp(6px, 2.05vw, 8px)' }}
                                    >
                                        {activeValue > 0
                                            ? calendarMode === 'money'
                                                ? formatCompactWon(day.revenue)
                                                : `${day.total.toLocaleString()}건`
                                            : '—'}
                                    </div>
                                    <div className="h-[88px] w-full flex items-end justify-center">
                                        <div
                                            className={`w-full rounded-t-md flex flex-col items-center justify-center overflow-hidden ${dark ? 'bg-blue-500/75' : 'bg-[#718FB5]'}`}
                                            style={{ height: `${Math.min(barHeight, 88)}px` }}
                                        >
                                            {calendarMode === 'volume' && activeValue > 0 && (
                                                <div
                                                    className="w-full text-center leading-[1.2] text-white whitespace-nowrap font-medium"
                                                    style={{ fontSize: 'clamp(5px, 1.7vw, 7px)' }}
                                                >
                                                    <div>배송 {day.delivery}</div>
                                                    <div>반품 {day.returns}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className={`mt-1 text-[10px] font-medium ${mutedClass}`}>{day.day}</div>
                                </div>
                            );
                        })}
                    </div>

                    <div className={`mt-2 border-t pt-1.5 ${borderClass}`}>
                        <div className="grid grid-cols-4 gap-0">
                            {statItems.map((item, index) => (
                                <div
                                    key={item.label}
                                    className={`min-w-0 px-1.5 ${index < 3 ? `border-r ${borderClass}` : ''}`}
                                >
                                    <div className={`text-[9px] leading-tight min-h-[22px] ${mutedClass}`}>{item.label}</div>
                                    <div
                                        className={`mt-0.5 whitespace-nowrap font-bold tabular-nums leading-tight ${item.valueClass || ''}`}
                                        style={{ fontSize: 'clamp(9px, 2.8vw, 12px)' }}
                                    >
                                        {item.value}
                                    </div>
                                    {item.subLabel && <div className={`mt-0.5 whitespace-nowrap text-[8px] leading-tight ${mutedClass}`}>{item.subLabel}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <div className={`mt-2 rounded-lg p-2 sm:p-4 shadow-md ${dark ? 'bg-gray-800' : 'bg-white'}`}>
                <GoalProgressBar
                    current={monthlyProfit?.totalRevenue || 0}
                    goal={goal}
                    isDarkMode={dark}
                    revenueDistribution={monthlyProfit?.revenueDistribution}
                    selectedItemsForAverage={selectedItemsForAverage}
                    incomeConfig={incomeConfig}
                />
            </div>

            <section className={`mt-2 overflow-hidden rounded-xl border ${panelClass}`}>
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-1 px-2 py-2">
                    <button
                        type="button"
                        onClick={() => onToggleCalendarMode?.(calendarMode === 'money' ? 'volume' : 'money')}
                        className={`justify-self-start rounded-lg border px-2 py-1 text-[10px] font-bold ${dark ? 'border-gray-600 bg-gray-700 text-gray-200' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                    >
                        <span className="inline-flex items-center gap-1"><ArrowRightLeft size={11}/>{calendarMode === 'money' ? '금액' : '물량'}</span>
                    </button>
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={() => onMonthChange?.(-1)} className="p-0.5"><ChevronLeft size={19}/></button>
                        <div className="whitespace-nowrap text-sm font-black">{currentCalendarDate?.getFullYear()}년 {Number(currentCalendarDate?.getMonth()) + 1}월</div>
                        <button type="button" onClick={() => onMonthChange?.(1)} className="p-0.5"><ChevronRight size={19}/></button>
                    </div>
                    <div className="flex items-center gap-1 justify-self-end">
                        <button type="button" onClick={onOpenDayOff} className="rounded-lg border border-indigo-300 px-2 py-1 text-[10px] font-bold text-indigo-500">휴무</button>
                        <button type="button" onClick={onToday} className="rounded-lg border border-amber-300 px-2 py-1 text-[10px] font-bold text-amber-500">오늘</button>
                    </div>
                </div>

                <div className="grid grid-cols-7 border-y text-center text-[10px] font-black">
                    {dayLabels.map((day, index) => (
                        <div
                            key={day}
                            className={`py-1.5 ${index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : mutedClass} ${dark ? 'border-gray-700' : 'border-slate-200'}`}
                        >{day}</div>
                    ))}
                </div>

                <div className={homeCalendarDesign === 'current'
                    ? `grid grid-cols-7 w-full border-l ${borderClass}`
                    : 'grid grid-cols-7 gap-x-0 gap-y-0'
                }>
                    {calendarDays.map((dayInfo, index) => (
                        <button
                            type="button"
                            key={dayInfo.date}
                            onClick={() => onDateClick?.(dayInfo.date)}
                            className={homeCalendarDesign === 'current'
                                ? `relative min-w-0 flex flex-col items-center justify-start p-1 h-20 border-b border-r text-left transition-colors ${borderClass}
                                    ${dayInfo.isToday
                                        ? (dark ? 'bg-green-900/60' : 'bg-green-100')
                                        : dayInfo.isDayOff
                                            ? (dark ? 'bg-gray-700/60' : 'bg-gray-100')
                                            : (dark ? 'bg-gray-800' : 'bg-white')}`
                                : `relative min-w-0 flex flex-col items-center justify-start h-[55px] rounded-md transition-colors
                                    ${dayInfo.isDayOff ? (dark ? 'bg-gray-700/60' : 'bg-gray-200') : (dark ? 'bg-gray-800' : 'bg-white')}`
                            }
                        >
                            <div className={homeCalendarDesign === 'current'
                                ? 'relative flex w-full items-center justify-between px-1'
                                : 'relative flex h-[30px] w-full items-center justify-center'
                            }>
                                <span className={homeCalendarDesign === 'current'
                                    ? `text-[clamp(9px,3.6vw,13px)] font-bold
                                        ${!dayInfo.isCurrentMonth ? (dark ? 'text-gray-600' : 'text-gray-400') : ''}
                                        ${dayInfo.isCurrentMonth && index % 7 === 0 ? 'text-red-500' : ''}
                                        ${dayInfo.isCurrentMonth && index % 7 === 6 ? 'text-blue-500' : ''}
                                        ${dayInfo.isToday ? (dark ? 'text-green-200' : 'text-green-800') : ''}`
                                    : `flex items-center justify-center w-8 h-8 rounded-full text-[clamp(10px,3.8vw,14px)] font-semibold
                                        ${!dayInfo.isCurrentMonth ? (dark ? 'text-gray-600' : 'text-gray-300') : ''}
                                        ${dayInfo.isCurrentMonth && index % 7 === 0 ? 'text-red-500' : ''}
                                        ${dayInfo.isCurrentMonth && index % 7 === 6 ? 'text-blue-500' : ''}
                                        ${dayInfo.isToday ? 'border-4 border-yellow-400 shadow-sm' : ''}`
                                }>{dayInfo.day}</span>

                                {dayInfo.isCurrentMonth && dayInfo.extraDayOffRequestStatus && (
                                    <span className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${
                                        dayInfo.extraDayOffRequestStatus === 'pending' ? 'bg-orange-500'
                                        : dayInfo.extraDayOffRequestStatus === 'approved' ? 'bg-blue-500'
                                        : dayInfo.extraDayOffRequestStatus === 'declined' ? 'bg-red-500' : ''
                                    }`} />
                                )}
                            </div>

                            <div className={homeCalendarDesign === 'current'
                                ? 'flex flex-col items-center justify-start mt-1 w-full space-y-0.5'
                                : 'flex flex-col items-center justify-start w-full px-0.5 -mt-0.5 space-y-0'
                            }>
                                {dayInfo.isCurrentMonth && dayInfo.isDayOff && (
                                    <span className={homeCalendarDesign === 'current'
                                        ? 'whitespace-nowrap text-[clamp(6px,2.4vw,10px)] font-bold leading-[10px] text-gray-500 dark:text-gray-400'
                                        : 'whitespace-nowrap text-[clamp(5px,1.9vw,7px)] font-bold leading-[8px] text-indigo-500 dark:text-indigo-400'
                                    }>○ 휴무</span>
                                )}

                                {calendarMode === 'money' ? (
                                    <>
                                        {dayInfo.isCurrentMonth && dayInfo.volumeDisplayTotal > 0 && (
                                            <span className={homeCalendarDesign === 'current'
                                                ? 'whitespace-nowrap text-[clamp(6px,2.2vw,9px)] font-bold leading-tight text-gray-600 dark:text-gray-300'
                                                : 'whitespace-nowrap text-[clamp(5px,1.8vw,8px)] font-bold leading-[9px] text-gray-600 dark:text-gray-300'
                                            }>{dayInfo.volumeDisplayTotal.toLocaleString()}건</span>
                                        )}
                                        {dayInfo.isCurrentMonth && dayInfo.revenue > 0 && (
                                            <span className={homeCalendarDesign === 'current'
                                                ? 'whitespace-nowrap text-red-500 text-[clamp(6px,2.2vw,9px)] font-semibold leading-tight'
                                                : 'whitespace-nowrap text-red-500 text-[clamp(5px,1.8vw,8px)] font-semibold leading-[9px]'
                                            }>{dayInfo.revenue.toLocaleString()}원</span>
                                        )}
                                        {dayInfo.isCurrentMonth && dayInfo.expenses > 0 && (
                                            <span className={homeCalendarDesign === 'current'
                                                ? 'whitespace-nowrap text-blue-500 text-[clamp(6px,2.2vw,9px)] font-medium leading-tight'
                                                : 'whitespace-nowrap text-blue-500 text-[clamp(5px,1.8vw,8px)] font-medium leading-[9px]'
                                            }>{dayInfo.expenses.toLocaleString()}원</span>
                                        )}
                                    </>
                                ) : (
                                    <div className={homeCalendarDesign === 'current'
                                        ? 'flex flex-col items-center gap-y-0 w-full'
                                        : 'grid grid-cols-2 gap-x-0.5 gap-y-0 w-full'
                                    }>
                                        {dayInfo.isCurrentMonth && volumeMetricList.map((metric) => {
                                            if (homeCalendarVolumeItems && homeCalendarVolumeItems[metric.key] === false) return null;
                                            const amount = Number(dayInfo.volumeBreakdown?.[metric.key] || 0);
                                            if (amount <= 0) return null;
                                            const label = incomeConfig.find((item) => item.key === metric.key)?.label || metric.label;
                                            return (
                                                <span
                                                    key={metric.key}
                                                    className={homeCalendarDesign === 'current'
                                                        ? 'min-w-0 whitespace-nowrap text-[clamp(5px,1.55vw,8px)] font-semibold leading-[9px] text-gray-700 dark:text-gray-300'
                                                        : 'min-w-0 whitespace-nowrap text-[clamp(5px,1.35vw,7px)] font-semibold leading-[8px] text-gray-700 dark:text-gray-300'
                                                    }
                                                    title={`${label} ${amount}건`}
                                                >{homeCalendarDesign === 'classic' ? metric.shortLabel : label} {amount}</span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>

                <div className={`flex flex-wrap justify-center gap-x-3 gap-y-1 px-1 py-1 text-[9px] font-bold ${mutedClass}`}>
                    <span><span className="text-gray-400">○</span> 휴무</span>
                    <span><span className="text-orange-500">●</span> 대기</span>
                    <span><span className="text-blue-500">●</span> 승인</span>
                    <span><span className="text-red-500">●</span> 거절</span>
                </div>
            </section>
        </div>
    );
};

export default IntegratedDailySummaryView;
