import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronDown } from 'lucide-react';

/**
 * 지역별로 팀을 묶어 보여주는 공통 관리자 드롭다운.
 * 선택된 항목은 "청주 1팀"처럼 지역과 팀 이름을 함께 표시합니다.
 * 팝업은 portal로 렌더링해 스크롤 가능한 모달 안에서도 잘리지 않게 합니다.
 */
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
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState(null);
    const dropdownRef = useRef(null);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    const regionGroups = useMemo(() => {
        const groups = new Map();
        teams.forEach((team) => {
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
    }, [teams]);

    const selectedTeam = teams.find((team) => String(team.id) === String(value));
    const selectedLabel = includeAll && String(value) === String(allValue)
        ? allLabel
        : selectedTeam
            ? [selectedTeam.region || '기본 지역', selectedTeam.name || '이름 없는 팀'].join(' ')
            : '';

    useEffect(() => {
        if (!isOpen) {
            setMenuPosition(null);
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
                                        <span className="min-w-0 break-words">{team.name || '이름 없는 팀'}</span>
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
