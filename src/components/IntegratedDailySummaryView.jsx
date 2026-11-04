import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Phone } from 'lucide-react';
import { calculateData } from '../utils/calculator';

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

    if (absolute < 10000) {
        return `${Math.round(value).toLocaleString('ko-KR')}원`;
    }

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

const getDayOffFlag = (entry) => {
    return Boolean(
        (typeof entry?.memo === 'string' && entry.memo.includes('휴무')) ||
        entry?.isDayOff === true ||
        (Array.isArray(entry?.customItems) &&
            entry.customItems.some((item) => item?.key === 'dayOff' || item?.key === '휴무'))
    );
};

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

        // 구형 입력 데이터는 같은 항목이 customItems에 있지 않을 때만 합산합니다.
        if (!processedKeys.has('deliveryCount')) {
            delivery += Math.max(0, Number(entry.deliveryCount) || 0);
        }
        if (!processedKeys.has('returnCount')) {
            returns += Math.max(0, Number(entry.returnCount) || 0);
        }
    });

    return { delivery, returns, total: delivery + returns };
};

const getPercentChange = (current, previous) => {
    const currentValue = Number(current) || 0;
    const previousValue = Number(previous) || 0;

    if (previousValue === 0) return currentValue === 0 ? '—' : '신규';
    const percent = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
    const sign = percent > 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}%`;
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
    isDarkMode,
    onBack,
    onOpenInsurance
}) => {
    const [chartMode, setChartMode] = useState('money');

    const dailyChart = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Array.from({ length: 7 }, (_, index) => {
            const date = new Date(today);
            date.setDate(today.getDate() - (6 - index));
            const dateKey = toLocalDateKey(date);
            const dayEntries = entries.filter((entry) => entry?.date === dateKey);
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
        const yearMonth = String(selectedMonth || '').split('-').map(Number);
        const endDay = Number(monthlyEndDay) || 25;
        const endDate = yearMonth.length === 2 && yearMonth[0] && yearMonth[1]
            ? new Date(yearMonth[0], yearMonth[1] - 1, endDay)
            : new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const remainingCalendarDays = Math.ceil((endDate.getTime() - today.getTime()) / 86400000) + 1;
        const safeRemainingCalendarDays = remainingCalendarDays > 0 ? remainingCalendarDays : 1;

        const futureHolidayDates = new Set(
            entries
                .filter((entry) => {
                    if (!entry?.date || !getDayOffFlag(entry)) return false;
                    return entry.date >= toLocalDateKey(today);
                })
                .map((entry) => entry.date)
        );
        const remainingWorkDays = Math.max(0, safeRemainingCalendarDays - futureHolidayDates.size);

        const estimatedSalary = currentRevenue + (dailyAverageRevenue * remainingWorkDays);
        const estimatedTotalVolume = currentVolume + (dailyAverageVolume * remainingWorkDays);
        const remainingGoal = Math.max(0, (Number(goal) || 0) - currentRevenue);
        const recommendedDailyIncome = Math.round(remainingGoal / safeRemainingCalendarDays);

        let holidayCount = 0;
        if (selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDay = Number(monthlyStartDay) || 26;
            const endPeriodDay = Number(monthlyEndDay) || 25;
            let startDate;
            let endPeriodDate;

            if (startDay > endPeriodDay) {
                startDate = new Date(year, month - 2, startDay);
                endPeriodDate = new Date(year, month - 1, endPeriodDay, 23, 59, 59);
            } else {
                startDate = new Date(year, month - 1, startDay);
                endPeriodDate = new Date(year, month - 1, endPeriodDay, 23, 59, 59);
            }

            const holidayDates = new Set(
                entries
                    .filter((entry) => {
                        if (!entry?.date || !getDayOffFlag(entry)) return false;
                        const entryDate = new Date(`${entry.date}T12:00:00`);
                        return entryDate >= startDate && entryDate <= endPeriodDate;
                    })
                    .map((entry) => entry.date)
            );
            holidayCount = holidayDates.size;
        }

        const comparisonValue = chartMode === 'money'
            ? getPercentChange(currentRevenue, previousRevenue)
            : getPercentChange(currentVolume, previousVolume);
        const comparisonNumeric = chartMode === 'money'
            ? currentRevenue - previousRevenue
            : currentVolume - previousVolume;

        return {
            workingDays,
            holidayCount,
            remainingWorkDays,
            currentRevenue,
            currentVolume,
            dailyAverageRevenue,
            dailyAverageVolume,
            estimatedSalary,
            estimatedTotalVolume,
            recommendedDailyIncome,
            comparisonValue,
            comparisonNumeric
        };
    }, [
        monthlyProfit,
        previousMonthlyProfit,
        selectedItemsForAverage,
        selectedMonth,
        monthlyEndDay,
        monthlyStartDay,
        entries,
        goal,
        chartMode
    ]);

    const maxRevenue = Math.max(0, ...dailyChart.map((day) => day.revenue));
    const maxVolume = Math.max(0, ...dailyChart.map((day) => day.total));
    const dark = Boolean(isDarkMode);
    const panelClass = dark
        ? 'bg-gray-800 border-gray-700 text-gray-100'
        : 'bg-white border-slate-200 text-slate-800';
    const mutedClass = dark ? 'text-gray-400' : 'text-slate-500';
    const borderClass = dark ? 'border-gray-700' : 'border-slate-200';
    const insuranceName = selectedInsurance?.name
        ? selectedInsurance.name.split('(')[0].trim()
        : '';

    const comparisonColor = periodSummary.comparisonNumeric > 0
        ? (dark ? 'text-emerald-400' : 'text-emerald-700')
        : periodSummary.comparisonNumeric < 0
            ? (dark ? 'text-blue-400' : 'text-blue-700')
            : mutedClass;

    const statItems = chartMode === 'money'
        ? [
            {
                label: '일 평균 매출',
                value: formatCompactWon(periodSummary.dailyAverageRevenue),
                subLabel: `권장 일수입 ${formatCompactWon(periodSummary.recommendedDailyIncome)}`
            },
            { label: '총 매출', value: formatCompactWon(periodSummary.currentRevenue) },
            { label: '예상 급여', value: formatCompactWon(periodSummary.estimatedSalary) },
            { label: '전월 대비', value: periodSummary.comparisonValue, valueClass: comparisonColor }
        ]
        : [
            { label: '일 평균 배송량', value: `${periodSummary.dailyAverageVolume.toLocaleString()}건` },
            { label: '총 배송량', value: `${periodSummary.currentVolume.toLocaleString()}건` },
            { label: '예상 총 배송량', value: `${Math.round(periodSummary.estimatedTotalVolume).toLocaleString()}건` },
            { label: '전월 대비', value: periodSummary.comparisonValue, valueClass: comparisonColor }
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
                                onClick={() => setChartMode('money')}
                                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${chartMode === 'money' ? (dark ? 'bg-gray-700 text-white shadow' : 'bg-white text-slate-800 shadow-sm') : mutedClass}`}
                            >
                                금액
                            </button>
                            <button
                                type="button"
                                onClick={() => setChartMode('volume')}
                                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${chartMode === 'volume' ? (dark ? 'bg-gray-700 text-white shadow' : 'bg-white text-slate-800 shadow-sm') : mutedClass}`}
                            >
                                물량
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {dailyChart.map((day) => {
                            const activeValue = chartMode === 'money' ? day.revenue : day.total;
                            const maxValue = chartMode === 'money' ? maxRevenue : maxVolume;
                            const barHeight = activeValue > 0
                                ? chartMode === 'money'
                                    ? Math.max(13, (activeValue / (maxValue || 1)) * 78)
                                    : Math.max(52, (activeValue / (maxValue || 1)) * 84)
                                : 3;

                            return (
                                <div key={day.dateKey} className="min-w-0 flex flex-col items-center">
                                    <div className={`h-4 w-full flex items-end justify-center overflow-hidden whitespace-nowrap font-semibold tabular-nums ${dark ? 'text-gray-200' : 'text-slate-700'}`}
                                         style={{ fontSize: 'clamp(6px, 2.05vw, 8px)' }}>
                                        {activeValue > 0
                                            ? chartMode === 'money'
                                                ? formatCompactWon(day.revenue)
                                                : `${day.total.toLocaleString()}건`
                                            : '—'}
                                    </div>
                                    <div className="h-[88px] w-full flex items-end justify-center">
                                        <div
                                            className={`w-full rounded-t-md flex flex-col items-center justify-center overflow-hidden ${dark ? 'bg-blue-500/75' : 'bg-[#718FB5]'}`}
                                            style={{ height: `${Math.min(barHeight, 88)}px` }}
                                        >
                                            {chartMode === 'volume' && activeValue > 0 && (
                                                <div className="w-full text-center leading-[1.2] text-white whitespace-nowrap font-medium"
                                                     style={{ fontSize: 'clamp(5px, 1.7vw, 7px)' }}>
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
                                    <div className={`mt-0.5 whitespace-nowrap font-bold tabular-nums leading-tight ${item.valueClass || ''}`}
                                         style={{ fontSize: 'clamp(9px, 2.8vw, 12px)' }}>
                                        {item.value}
                                    </div>
                                    {item.subLabel && (
                                        <div className={`mt-0.5 whitespace-nowrap text-[8px] leading-tight ${mutedClass}`}>
                                            {item.subLabel}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
            <div className={`mt-1.5 px-1 text-[9px] ${mutedClass}`}>
                최근 7일 차트와 선택한 정산 기간의 월간 통계를 함께 표시합니다.
            </div>
        </div>
    );
};

export default IntegratedDailySummaryView;
