import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronDown, Sun, Moon, Search, X } from 'lucide-react';

/**
 * 지역별로 팀을 묶고, 필요한 화면에서는 근무조별 팀 선택을 제공합니다.
 * 선택 항목에는 지역·주간/야간·팀 이름을 표시합니다.
 * 팝업은 portal로 렌더링해 모달이나 스크롤 영역에 잘리지 않게 합니다.
 */
const getTeamShift = (team) => {
    const shift = String(team?.shift || team?.workShift || team?.work_shift || '').toLowerCase();
    return shift === 'night' || shift === '야간' ? 'night' : 'day';
};
const getShiftLabel = (shift) => shift === 'night' ? '야간' : '주간';

export default function RegionTeamDropdown({
    teams = [],
    value = 'all',
    onChange,
    allLabel = '모든 팀',
    allValue = 'all',
    includeAll = true,
    name,
    className = '',
    buttonClassName = '',
    size = 'compact',
    disabled = false,
    includeShift = false,
    shiftValue = 'day',
    onShiftChange,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    const visibleTeams = useMemo(() => {
        const shiftTeams = includeShift
            ? teams.filter((team) => getTeamShift(team) === shiftValue)
            : teams;
        const keyword = searchQuery.trim().toLocaleLowerCase();
        if (!keyword) return shiftTeams;
        return shiftTeams.filter((team) => [
            team.region || '기본 지역',
            team.name || '이름 없는 팀',
            getShiftLabel(getTeamShift(team))
        ].some((value) => String(value).toLocaleLowerCase().includes(keyword)));
    }, [teams, includeShift, shiftValue, searchQuery]);

    const regionGroups = useMemo(() => {
        const groups = new Map();
        visibleTeams.forEach((team) => {
            const regionName = String(team.region || '기본 지역').trim() || '기본 지역';
            if (!groups.has(regionName)) groups.set(regionName, []);
            groups.get(regionName).push(team);
        });

        return Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b, 'ko'))
            .map(([regionName, regionTeams]) => ({
                regionName,
                teams: regionTeams.sort((a, b) =>
                    String(a.name || '').localeCompare(String(b.name || ''), 'ko')
                ),
            }));
    }, [visibleTeams]);

    const selectedTeam = teams.find((team) => String(team.id) === String(value));
    const selectedLabel = includeAll && String(value) === String(allValue)
        ? allLabel
        : selectedTeam
            ? [selectedTeam.region || '기본 지역', getShiftLabel(getTeamShift(selectedTeam)), selectedTeam.name || '이름 없는 팀'].join(' · ')
            : (includeShift ? getShiftLabel(shiftValue) + ' 팀이 없습니다' : '');

    useEffect(() => {
        if (!isOpen) {
            setMenuPosition(null);
            setSearchQuery((previous) => previous ? '' : previous);
            return undefined;
        }

        const updateMenuPosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;

            const viewportPadding = 8;
            const maxAllowedWidth = Math.max(160, window.innerWidth - viewportPadding * 2);
            const width = Math.min(Math.max(rect.width, 200), maxAllowedWidth);
            const left = Math.max(
                viewportPadding,
                Math.min(rect.left, window.innerWidth - width - viewportPadding)
            );
            const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
            const spaceAbove = rect.top - viewportPadding;
            const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
            const availableSpace = openAbove ? spaceAbove : spaceBelow;
            const maxHeight = Math.max(96, Math.min(288, availableSpace));
            const top = openAbove
                ? Math.max(viewportPadding, rect.top - maxHeight - 4)
                : rect.bottom + 4;

            setMenuPosition({ top, left, width, maxHeight });
        };

        const handleOutsideClick = (event) => {
            const clickedTrigger = dropdownRef.current?.contains(event.target);
            const clickedMenu = menuRef.current?.contains(event.target);
            if (!clickedTrigger && !clickedMenu) setIsOpen(false);
        };
        const handleEscape = (event) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        updateMenuPosition();
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [isOpen]);

    const choose = (nextValue) => {
        if (onChange) onChange(String(nextValue));
        setSearchQuery('');
        setIsOpen(false);
    };

    const buttonSize = size === 'comfortable'
        ? 'px-2.5 py-3 text-sm'
        : 'px-2.5 py-2.5 text-xs';

    return (
        <div ref={dropdownRef} className={'relative min-w-0 ' + className}>
            {name && <input type="hidden" name={name} value={value ?? ''} />}
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((previous) => !previous)}
                className={'flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white text-left font-bold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 ' + buttonSize + ' ' + buttonClassName}
            >
                <span className="min-w-0 flex-1 truncate">
                    {selectedLabel || '팀을 선택하세요'}
                </span>
                <ChevronDown size={16} className={'shrink-0 text-slate-500 transition-transform ' + (isOpen ? 'rotate-180' : '')} />
            </button>

            {isOpen && menuPosition && createPortal(
                <div
                    ref={menuRef}
                    role="listbox"
                    aria-label="지역 및 팀 선택"
                    style={{
                        position: 'fixed',
                        top: menuPosition.top,
                        left: menuPosition.left,
                        width: menuPosition.width,
                        maxHeight: menuPosition.maxHeight,
                    }}
                    className="z-[100] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                >
                    {includeShift && (
                        <div className="border-b border-slate-100 px-3 py-3">
                            <div className="mb-2 text-xs font-black text-slate-500">근무조 선택</div>
                            <div className="grid grid-cols-2 gap-2">
                                {['day', 'night'].map((shift) => {
                                    const active = shiftValue === shift;
                                    const ShiftIcon = shift === 'night' ? Moon : Sun;
                                    return (
                                        <button
                                            key={shift}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => { if (!active && onShiftChange) onShiftChange(shift); }}
                                            className={'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold transition-colors ' + (active ? (shift === 'night' ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-indigo-300 bg-indigo-50 text-indigo-800') : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
                                        >
                                            <ShiftIcon size={16} /> {getShiftLabel(shift)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="border-b border-slate-100 bg-white px-3 py-2.5">
                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 focus-within:border-indigo-300 focus-within:bg-white">
                            <Search size={15} className="shrink-0 text-slate-400" />
                            <input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="지역 또는 팀 검색"
                                aria-label="지역 또는 팀 검색"
                                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                            />
                            {searchQuery && (
                                <button type="button" onClick={() => setSearchQuery('')} className="rounded p-0.5 text-slate-400 hover:bg-slate-200" aria-label="검색어 지우기">
                                    <X size={14} />
                                </button>
                            )}
                        </label>
                    </div>

                    {includeAll && (
                        <button
                            type="button"
                            role="option"
                            aria-selected={String(value) === String(allValue)}
                            onClick={() => choose(allValue)}
                            className={'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-indigo-50 ' + (String(value) === String(allValue) ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-700')}
                        >
                            <span>{allLabel}</span>
                            {String(value) === String(allValue) && <CheckCircle2 size={15} className="shrink-0" />}
                        </button>
                    )}

                    {regionGroups.length === 0 && (
                        <div className="px-4 py-5 text-center text-sm text-slate-500">
                            {searchQuery.trim()
                                ? '검색 결과가 없습니다.'
                                : includeShift
                                    ? getShiftLabel(shiftValue) + '에 등록된 팀이 없습니다.'
                                    : '등록된 팀이 없습니다.'}
                        </div>
                    )}

                    {regionGroups.map(({ regionName, teams: regionTeams }) => (
                        <div key={regionName}>
                            <div className="border-y border-slate-100 bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">
                                {regionName}
                            </div>
                            {regionTeams.map((team) => {
                                const isSelected = String(value) === String(team.id);
                                return (
                                    <button
                                        key={team.id}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => choose(team.id)}
                                        className={'flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-indigo-50 ' + (isSelected ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-700')}
                                    >
                                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 break-words">
                                            <span>{team.name || '이름 없는 팀'}</span>
                                            {!includeShift && <span className={'rounded-md px-1.5 py-0.5 text-[10px] font-bold ' + (getTeamShift(team) === 'night' ? 'bg-teal-50 text-teal-700' : 'bg-indigo-50 text-indigo-700')}>{getShiftLabel(getTeamShift(team))}</span>}
                                        </span>
                                        {isSelected && <CheckCircle2 size={15} className="shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}
