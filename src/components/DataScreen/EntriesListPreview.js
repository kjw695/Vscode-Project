import React, { useMemo, useState } from 'react';
import {
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Eye,
    MoreHorizontal,
    CalendarDays,
    Pencil,
    Trash2
} from 'lucide-react';
import { calculateData } from '../../utils/calculator';

const safeNumber = (value) => {
    const number = Number(String(value ?? 0).replace(/,/g, '').trim());
    return Number.isFinite(number) ? number : 0;
};

const formatDateLabel = (dateValue) => {
    const parts = String(dateValue || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return String(dateValue || '날짜 확인 필요');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
    });
};

const getItemPriority = (name) => {
    if (name.includes('중단')) return 2;
    if (name.includes('배송')) return 0;
    if (name.includes('반품')) return 1;
    if (name.includes('프레시백')) return 3;
    return 10;
};

const getItemSummary = (stats) => {
    const details = Object.entries(stats?.revenueDetails || {});
    details.sort((a, b) => {
        const priorityDiff = getItemPriority(a[0]) - getItemPriority(b[0]);
        return priorityDiff !== 0 ? priorityDiff : a[0].localeCompare(b[0], 'ko');
    });

    return details
        .filter(([, detail]) => safeNumber(detail.count) > 0 || safeNumber(detail.amount) > 0)
        .map(([name, detail]) => {
            const label = name.includes('중단') ? '중단' : name;
            const count = safeNumber(detail.count);
            if (count > 0) {
                const unit = name.includes('프레시백') ? '개' : '건';
                return label + ' ' + count.toLocaleString() + unit;
            }
            return label + ' ' + safeNumber(detail.amount).toLocaleString() + '원';
        })
        .join(' · ');
};

const AmountPair = ({ stats, compact = false }) => {
    const revenue = safeNumber(stats?.totalRevenue);
    const expenses = safeNumber(stats?.totalExpenses);

    return (
        <div className={'flex shrink-0 items-center justify-end gap-1.5 whitespace-nowrap ' + (compact ? 'text-xs sm:text-[13px]' : 'text-sm')}>
            {revenue > 0 && (
                <span className="font-bold text-red-500">+{revenue.toLocaleString()}원</span>
            )}
            {expenses > 0 && (
                <span className="font-bold text-blue-500">-{expenses.toLocaleString()}원</span>
            )}
            {revenue === 0 && expenses === 0 && (
                <span className="font-semibold text-gray-400">0원</span>
            )}
        </div>
    );
};

// 휴무 일정은 별도 캘린더/휴무관리 영역의 정보이므로 이 데이터 목록에는 합치지 않습니다.
const EntriesListPreview = ({
    entries = [],
    summary,
    isDarkMode,
    onBack,
    onOpenFilter,
    filterType,
    itemLabels = {},
    handleEdit,
    handleDelete
}) => {
    const [expandedDate, setExpandedDate] = useState(null);
    const [collapsedMonths, setCollapsedMonths] = useState({});
    const [openActionGroup, setOpenActionGroup] = useState(null);

    const groupedMonths = useMemo(() => {
        const result = {};
        (Array.isArray(entries) ? entries : []).forEach((entry) => {
            if (!entry || !entry.date) return;
            const monthKey = String(entry.date).slice(0, 7);
            if (!result[monthKey]) result[monthKey] = [];
            result[monthKey].push(entry);
        });
        return result;
    }, [entries]);

    const sortedMonths = Object.keys(groupedMonths).sort((a, b) => b.localeCompare(a));

    const toggleMonth = (month) => {
        setCollapsedMonths((previous) => ({
            ...previous,
            [month]: !previous[month]
        }));
    };

    const toggleDate = (date) => {
        setExpandedDate((previous) => previous === date ? null : date);
        setOpenActionGroup(null);
    };

    const getRoundGroups = (dailyEntries) => {
        const grouped = {};
        dailyEntries.forEach((entry) => {
            const numericRound = safeNumber(entry.round);
            const key = numericRound > 0 ? String(numericRound) : 'none';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(entry);
        });

        return Object.keys(grouped)
            .sort((a, b) => {
                if (a === 'none') return 1;
                if (b === 'none') return -1;
                return Number(a) - Number(b);
            })
            .map((key) => ({
                key,
                label: key === 'none' ? '회전 미지정' : key + '회전',
                entries: grouped[key]
            }));
    };

    const getFilterLabel = () => {
        if (summary?.filterLabel) return summary.filterLabel;
        if (filterType === 'income') return '수익';
        if (filterType === 'expense') return '지출';
        return '전체';
    };

    const panelClass = isDarkMode
        ? 'border-gray-700 bg-gray-800 text-gray-100'
        : 'border-gray-200 bg-white text-gray-800';

    const mutedTextClass = isDarkMode ? 'text-gray-400' : 'text-gray-500';

    return (
        <div className="w-full space-y-4 pb-32">
            <div className={'sticky top-0 z-20 -mx-1 flex items-center gap-2 border-b px-1 py-2 ' + (isDarkMode ? 'border-gray-700 bg-[#111827]' : 'border-gray-100 bg-white')}>
                <button
                    type="button"
                    onClick={onBack}
                    className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' + (isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700')}
                    aria-label="기존 데이터 화면으로 돌아가기"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <h2 className="truncate text-sm font-bold">데이터 화면 미리보기</h2>
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">임시</span>
                    </div>
                    <p className={'text-[11px] ' + mutedTextClass}>기존 기록을 새 목록 형태로 표시합니다</p>
                </div>
                <button
                    type="button"
                    onClick={onOpenFilter}
                    className={'flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold ' + (isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600')}
                >
                    {getFilterLabel()}
                    <ChevronDown size={13} />
                </button>
            </div>

            {summary && (
                <div className={'rounded-xl border px-4 py-3.5 ' + panelClass}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">전체 합계</span>
                        <AmountPair stats={summary} />
                    </div>
                    <div className={'text-[11px] ' + mutedTextClass}>
                        수익과 지출은 기존 계산 결과를 그대로 표시합니다
                    </div>
                </div>
            )}

            {sortedMonths.length === 0 ? (
                <div className={'flex flex-col items-center justify-center rounded-xl border py-16 text-center ' + panelClass}>
                    <Eye size={32} className={'mb-3 ' + mutedTextClass} />
                    <p className="text-sm font-semibold">저장된 데이터가 없습니다.</p>
                </div>
            ) : (
                <div className="space-y-5">
                    {sortedMonths.map((month) => {
                        const monthEntries = groupedMonths[month];
                        const monthStats = calculateData(monthEntries, itemLabels);
                        const datesMap = {};

                        monthEntries.forEach((entry) => {
                            if (!datesMap[entry.date]) datesMap[entry.date] = [];
                            datesMap[entry.date].push(entry);
                        });

                        const sortedDates = Object.keys(datesMap).sort((a, b) => b.localeCompare(a));
                        const isMonthCollapsed = Boolean(collapsedMonths[month]);
                        const monthLabel = month === 'Unknown'
                            ? '날짜 확인 필요'
                            : Number(month.slice(5, 7)) + '월';

                        return (
                            <section key={month} className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => toggleMonth(month)}
                                    className={'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left ' + panelClass}
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        {isMonthCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                                        <span className="truncate text-sm font-extrabold">
                                            {month === 'Unknown' ? monthLabel : month.slice(0, 4) + '년 ' + monthLabel}
                                        </span>
                                    </div>
                                    <AmountPair stats={monthStats} compact />
                                </button>

                                {!isMonthCollapsed && (
                                    <div className="space-y-3">
                                        {sortedDates.map((date) => {
                                            const dailyEntries = datesMap[date];
                                            const dailyStats = calculateData(dailyEntries, itemLabels);
                                            const volumeSummary = getItemSummary(dailyStats);
                                            const isDateExpanded = expandedDate === date;
                                            const roundGroups = getRoundGroups(dailyEntries);

                                            return (
                                                <section key={date} className={'overflow-visible rounded-xl border ' + (isDarkMode ? 'border-gray-700 bg-gray-800/70' : 'border-gray-200 bg-white')}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleDate(date)}
                                                        className={'flex w-full items-center justify-between gap-3 rounded-t-xl px-4 py-3.5 text-left ' + (isDarkMode ? 'hover:bg-gray-700/60' : 'hover:bg-gray-50')}
                                                    >
                                                        <span className="flex min-w-0 items-center gap-2">
                                                            <CalendarDays size={15} className={'shrink-0 ' + mutedTextClass} />
                                                            <span className="truncate text-sm font-bold">{formatDateLabel(date)}</span>
                                                        </span>
                                                        <span className="flex shrink-0 items-center gap-1.5">
                                                            <AmountPair stats={dailyStats} compact />
                                                            {isDateExpanded
                                                                ? <ChevronUp size={16} className={mutedTextClass} />
                                                                : <ChevronDown size={16} className={mutedTextClass} />}
                                                        </span>
                                                    </button>

                                                    <div className={'px-4 pb-3 text-xs leading-5 ' + mutedTextClass}>
                                                        {volumeSummary || '수량 항목 없음'}
                                                    </div>

                                                    {isDateExpanded && (
                                                        <div className={'border-t px-3 py-1.5 ' + (isDarkMode ? 'border-gray-700' : 'border-gray-100')}>
                                                            {roundGroups.map((group) => {
                                                                const roundStats = calculateData(group.entries, itemLabels);
                                                                const itemSummary = getItemSummary(roundStats);
                                                                const actionKey = date + '-' + group.key;
                                                                const isMenuOpen = openActionGroup === actionKey;
                                                                const memos = group.entries.filter((entry) => String(entry.memo || '').trim());

                                                                return (
                                                                    <div key={actionKey} className={'relative border-b py-3 last:border-b-0 ' + (isDarkMode ? 'border-gray-700' : 'border-gray-100')}>
                                                                        <div className="flex min-w-0 items-center gap-3">
                                                                            <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                                                                                <span className={'shrink-0 text-xs font-extrabold ' + (isDarkMode ? 'text-gray-200' : 'text-gray-700')}>
                                                                                    {group.label}
                                                                                </span>
                                                                                <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                                                                    <span className={mutedTextClass}>
                                                                                        {itemSummary || '수량 정보 없음'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <AmountPair stats={roundStats} compact />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setOpenActionGroup(isMenuOpen ? null : actionKey)}
                                                                                className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-md ' + (isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100')}
                                                                                aria-label="회전 기록 관리"
                                                                            >
                                                                                <MoreHorizontal size={16} />
                                                                            </button>
                                                                        </div>

                                                                        {memos.map((entry, memoIndex) => (
                                                                            <div
                                                                                key={(entry.id || actionKey) + '-memo-' + memoIndex}
                                                                                className={'mt-2 pl-1 text-xs leading-5 whitespace-pre-wrap break-words ' + (isDarkMode ? 'text-amber-300' : 'text-amber-700')}
                                                                            >
                                                                                메모: {String(entry.memo).trim()}
                                                                            </div>
                                                                        ))}

                                                                        {isMenuOpen && (
                                                                            <div className={'absolute right-1 top-full z-30 mt-1 w-52 rounded-lg border p-2 shadow-xl ' + (isDarkMode ? 'border-gray-600 bg-gray-900' : 'border-gray-200 bg-white')}>
                                                                                {group.entries.map((entry, entryIndex) => {
                                                                                    const recordStats = calculateData([entry], itemLabels);
                                                                                    const recordLabel = recordStats.totalExpenses > 0 && recordStats.totalRevenue === 0
                                                                                        ? '지출 기록'
                                                                                        : '수익 기록';
                                                                                    return (
                                                                                        <div key={entry.id || actionKey + '-entry-' + entryIndex} className="flex items-center justify-between gap-2 py-1.5">
                                                                                            <span className={'min-w-0 truncate text-xs ' + mutedTextClass}>
                                                                                                {recordLabel} {entryIndex + 1}
                                                                                            </span>
                                                                                            <div className="flex shrink-0 items-center gap-1">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        setOpenActionGroup(null);
                                                                                                        onBack();
                                                                                                        handleEdit(entry);
                                                                                                    }}
                                                                                                    className={'flex h-7 w-7 items-center justify-center rounded ' + (isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100')}
                                                                                                    aria-label="기록 수정"
                                                                                                >
                                                                                                    <Pencil size={13} />
                                                                                                </button>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        setOpenActionGroup(null);
                                                                                                        handleDelete(entry.id);
                                                                                                    }}
                                                                                                    className="flex h-7 w-7 items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                                                    aria-label="기록 삭제"
                                                                                                >
                                                                                                    <Trash2 size={13} />
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </section>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default EntriesListPreview;
