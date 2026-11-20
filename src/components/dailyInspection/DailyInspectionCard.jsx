import React from 'react';

const DailyInspectionCard = ({
    isDarkMode,
    scheduleStatus = 'work',
    isComplete = false,
    onClick
}) => {
    const isOff = scheduleStatus === 'off';
    const isPending = scheduleStatus === 'pending';
    const shouldPulse = !isOff && !isPending && !isComplete;

    const statusLabel = isOff
        ? '휴무'
        : isPending
            ? '근무표 미확정'
            : isComplete
                ? '완료'
                : '미완료';

    const statusColor = isOff
        ? (isDarkMode ? 'text-slate-400' : 'text-slate-500')
        : isPending
            ? (isDarkMode ? 'text-amber-300' : 'text-amber-600')
            : isComplete
                ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')
                : (isDarkMode ? 'text-amber-300' : 'text-amber-600');

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`일상점검표 ${statusLabel}`}
            className={`min-w-0 w-full h-full px-1 py-2 text-center rounded-lg transition-colors ${ 
                isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
            } ${shouldPulse ? 'animate-pulse ring-1 ring-amber-400/70 bg-amber-400/10' : ''}`}
        >
            <div className="text-xs whitespace-nowrap font-semibold text-slate-500 dark:text-slate-400">
                일상점검표
            </div>
            <div className={`mt-0.5 truncate text-[clamp(11px,3.2vw,15px)] font-black ${statusColor}`}>
                {statusLabel}
            </div>
        </button>
    );
};

export default DailyInspectionCard;
