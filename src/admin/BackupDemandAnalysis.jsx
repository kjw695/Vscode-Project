import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    BarChart3,
    ChevronDown,
    ChevronUp,
    Plus,
    Trash2,
    Truck,
    Users,
    CalendarDays
} from 'lucide-react';
import { useAdminData } from './contexts/DataContext';

const MAX_EXTRA_ROUTES = 30;

function getEmployeeType(employee) {
    const type = String(employee?.type || employee?.employee_type || employee?.employeeType || '').toLowerCase();
    return ['sub', 'substitute', 'backup', '대체', '백업'].includes(type) ? 'sub' : 'base';
}

function getShift(team) {
    const shift = String(team?.shift || team?.workShift || team?.work_shift || '').toLowerCase();
    return shift === 'night' || shift === '야간' ? 'night' : 'day';
}

function getRegion(team) {
    return team?.region || '기본 지역';
}

function normalizePattern(pattern) {
    const value = String(pattern || '주 5일');
    const match = value.match(/[1-6]/);
    const days = match ? Number(match[0]) : 5;
    return (value.includes('격주') ? '격주 ' : '주 ') + days + '일';
}

// 격주 5일/6일은 주간 평균을 각각 5.5일/6.5일로 환산합니다.
function getAverageWorkDays(pattern) {
    const value = normalizePattern(pattern);
    const match = value.match(/[1-6]/);
    const days = match ? Number(match[0]) : 5;
    return days + (value.includes('격주') ? 0.5 : 0);
}

function getPatternLabel(pattern) {
    const value = normalizePattern(pattern);
    const match = value.match(/[1-6]/);
    const days = match ? Number(match[0]) : 5;
    return value.includes('격주') ? '격주 ' + (days + 0.5).toFixed(1) + '일' : '주 ' + days + '일';
}

function formatDays(value) {
    const rounded = Math.round((Number(value) || 0) * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function getDefaultBackupPattern(backups) {
    if (!backups.length) return '주 5일';

    const counts = new Map();
    backups.forEach((employee) => {
        const pattern = normalizePattern(employee.pattern || employee.work_pattern || '주 5일');
        counts.set(pattern, (counts.get(pattern) || 0) + 1);
    });

    return Array.from(counts.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return getAverageWorkDays(a[0]) - getAverageWorkDays(b[0]);
    })[0][0];
}

function getRouteNames(employee, routes, teamId) {
    const assigned = routes.filter((route) =>
        String(route.team_id) === String(teamId) &&
        String(route.assigned_emp_id) === String(employee.id)
    ).map((route) => route.name).filter(Boolean);
    if (assigned.length > 0) return Array.from(new Set(assigned));

    const legacyRoute = employee.route || employee.routeName || employee.route_name;
    if (legacyRoute && String(legacyRoute).trim() && String(legacyRoute).trim() !== '미지정') {
        return [String(legacyRoute).trim()];
    }
    return [];
}

function PatternChooser({ value, onSelect }) {
    const selectedPattern = normalizePattern(value);
    const match = selectedPattern.match(/[1-6]/);
    const selectedDays = match ? Number(match[0]) : 5;
    const isBiweeklySelected = selectedPattern.includes('격주');
    const daysOptions = [1, 2, 3, 4, 5, 6];

    const selectPatternType = (isBiweekly) => {
        onSelect((isBiweekly ? '격주 ' : '주 ') + selectedDays + '일');
    };

    const selectDays = (days) => {
        onSelect((isBiweeklySelected ? '격주 ' : '주 ') + days + '일');
    };

    return (
        <div data-pattern-picker="true" className="rounded-xl border border-slate-200 bg-white p-2 sm:p-3">
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                <button
                    type="button"
                    aria-pressed={!isBiweeklySelected}
                    onClick={() => selectPatternType(false)}
                    className={'rounded-lg px-3 py-2 text-sm font-bold transition-colors ' + (
                        !isBiweeklySelected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    )}
                >
                    일반
                </button>
                <button
                    type="button"
                    aria-pressed={isBiweeklySelected}
                    onClick={() => selectPatternType(true)}
                    className={'rounded-lg px-3 py-2 text-sm font-bold transition-colors ' + (
                        isBiweeklySelected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    )}
                >
                    격주
                </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
                {daysOptions.map((days) => {
                    const isSelected = days === selectedDays;
                    const label = isBiweeklySelected ? (days + 0.5).toFixed(1) + '일' : days + '일';
                    return (
                        <button
                            key={(isBiweeklySelected ? 'biweekly-' : 'regular-') + days}
                            type="button"
                            onClick={() => selectDays(days)}
                            aria-pressed={isSelected}
                            className={'flex min-h-12 items-center justify-center rounded-xl border-2 px-2 py-2 text-sm font-medium transition-colors ' + (
                                isSelected
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200'
                            )}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
export default function BackupDemandAnalysis({ onBack }) {
    const { employees = [], teams = [], routes = [] } = useAdminData();
    const [selectedRegion, setSelectedRegion] = useState(() => getRegion(teams[0]));
    const [selectedShift, setSelectedShift] = useState(() => getShift(teams[0]));
    const [selectedTeamId, setSelectedTeamId] = useState(() => teams[0]?.id || '');
    const [plannedRoutes, setPlannedRoutes] = useState([]);
    const [patternOverrides, setPatternOverrides] = useState({});
    const [openPatternEditor, setOpenPatternEditor] = useState(null);
    const [newRoutesExpanded, setNewRoutesExpanded] = useState(true);
    const [existingEmployeesExpanded, setExistingEmployeesExpanded] = useState(false);

    useEffect(() => {
        if (!openPatternEditor) return;

        const handleOutsidePointerDown = (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest('[data-pattern-picker="true"]')) return;
            if (target.closest('[data-pattern-trigger="true"]')) return;
            setOpenPatternEditor(null);
        };

        document.addEventListener('pointerdown', handleOutsidePointerDown);
        return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
    }, [openPatternEditor]);

    const regions = useMemo(() =>
        Array.from(new Set(teams.map(getRegion))).sort((a, b) => a.localeCompare(b, 'ko')),
    [teams]);

    const filteredTeams = useMemo(() => teams.filter((team) =>
        getRegion(team) === selectedRegion && getShift(team) === selectedShift
    ).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko')),
    [teams, selectedRegion, selectedShift]);

    useEffect(() => {
        if (!filteredTeams.some((team) => String(team.id) === String(selectedTeamId))) {
            setSelectedTeamId(filteredTeams[0]?.id || '');
        }
    }, [filteredTeams, selectedTeamId]);

    const teamEmployees = useMemo(() => employees.filter((employee) =>
        employee.active !== false && String(employee.team_id) === String(selectedTeamId)
    ), [employees, selectedTeamId]);

    const employeeRows = useMemo(() => teamEmployees
        .filter((employee) => getEmployeeType(employee) === 'base')
        .map((employee) => {
            const routeNames = getRouteNames(employee, routes, selectedTeamId);
            return {
                ...employee,
                routeNames,
                routeLabel: routeNames.length > 0 ? routeNames.join(', ') : '노선 미배정',
                isCounted: routeNames.length > 0
            };
        })
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko')),
    [teamEmployees, routes, selectedTeamId]);

    // 휴무 보충 수요는 노선 수가 아니라 실제 고정 직원 수로 계산합니다.
    // 근무 패턴 변경은 이 분석 화면의 가상 계산에만 적용하고 직원 정보를 저장하지 않습니다.
    const fixedEmployeeRows = useMemo(() => employeeRows
        .filter((employee) => employee.isCounted)
        .map((employee) => {
            const id = String(employee.id);
            const originalPattern = employee.pattern || employee.work_pattern || '주 5일';
            return {
                id,
                name: employee.name || '이름 미등록',
                routeName: employee.routeNames.join(', '),
                routeNames: employee.routeNames,
                originalPattern,
                pattern: patternOverrides[id] || originalPattern
            };
        }),
    [employeeRows, patternOverrides]);

    // 노선 개수 표시는 유지하되, 휴무 보충 일수 계산에는 중복 적용하지 않습니다.
    const fixedRouteCount = useMemo(() => employeeRows
        .filter((employee) => employee.isCounted)
        .reduce((count, employee) => count + employee.routeNames.length, 0),
    [employeeRows]);

    const currentBackups = useMemo(() => teamEmployees
        .filter((employee) => getEmployeeType(employee) === 'sub'),
    [teamEmployees]);

    const backupPattern = useMemo(
        () => getDefaultBackupPattern(currentBackups),
        [currentBackups]
    );

    const fixedOffDays = useMemo(() => fixedEmployeeRows.reduce(
        (sum, route) => sum + (7 - getAverageWorkDays(route.pattern)),
        0
    ), [fixedEmployeeRows]);

    const currentBackupWorkDays = useMemo(() => currentBackups.reduce(
        (sum, employee) => sum + getAverageWorkDays(employee.pattern || employee.work_pattern || '주 5일'),
        0
    ), [currentBackups]);

    const extraOffDays = useMemo(() => plannedRoutes.reduce(
        (sum, route) => sum + (7 - getAverageWorkDays(route.pattern)),
        0
    ), [plannedRoutes]);

    // 현재 인원과 추가 인원의 전체 휴무일수에서 현재 백업 근무일수를 제외해 부족 일수를 계산합니다.
    const totalOffDays = fixedOffDays + extraOffDays;
    const requiredExtraBackupWorkDays = Math.max(0, totalOffDays - currentBackupWorkDays);
    const recommendedPattern = '주 5일';
    const recommendedPatternDays = 5;
    const recommendedHires = requiredExtraBackupWorkDays > 0
        ? Math.ceil(requiredExtraBackupWorkDays / recommendedPatternDays)
        : 0;

    const addRoute = () => {
        setPlannedRoutes((current) => {
            if (current.length >= MAX_EXTRA_ROUTES) return current;
            return current.concat({
                id: 'planned-route-' + Date.now() + '-' + current.length,
                pattern: '주 5일'
            });
        });
        setNewRoutesExpanded(true);
    };

    const updateRoutePattern = (routeId, pattern) => {
        setPlannedRoutes((current) => current.map((route) =>
            route.id === routeId ? { ...route, pattern } : route
        ));
    };

    const removeRoute = (routeId) => {
        setPlannedRoutes((current) => current.filter((route) => route.id !== routeId));
    };




    return (
        <div className="admin-safe-top flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
            <header className="admin-sticky-safe-header sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
                <button onClick={onBack} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label="관리자 센터로 돌아가기">
                    <ArrowLeft size={22} />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-lg font-black sm:text-xl">백업 수요 분석</h1>
                    <p className="mt-0.5 text-xs text-slate-500">노선 유지에 필요한 백업 인원 계산</p>
                </div>
                <span className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><BarChart3 size={21} /></span>
            </header>

            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 p-3 pb-28 sm:gap-4 sm:p-4 sm:pb-28">
                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3">
                        <h2 className="text-sm font-black">분석 범위</h2>
                        <p className="mt-0.5 text-xs text-slate-500">지역과 근무조, 팀을 선택하세요.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <label className="block min-w-0">
                            <span className="mb-1 block text-xs font-bold text-slate-500">지역</span>
                            <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm outline-none focus:border-indigo-400 sm:rounded-xl sm:px-3 sm:py-3">
                                {regions.map((region) => <option key={region} value={region}>{region}</option>)}
                            </select>
                        </label>
                        <label className="block min-w-0">
                            <span className="mb-1 block text-xs font-bold text-slate-500">근무조</span>
                            <select value={selectedShift} onChange={(event) => setSelectedShift(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm outline-none focus:border-indigo-400 sm:rounded-xl sm:px-3 sm:py-3">
                                <option value="day">주간</option>
                                <option value="night">야간</option>
                            </select>
                        </label>
                        <label className="block min-w-0">
                            <span className="mb-1 block text-xs font-bold text-slate-500">팀</span>
                            <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm outline-none focus:border-indigo-400 sm:rounded-xl sm:px-3 sm:py-3" disabled={filteredTeams.length === 0}>
                                {filteredTeams.length === 0 && <option value="">등록된 팀 없음</option>}
                                {filteredTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                            </select>
                        </label>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3">
                        <h2 className="text-sm font-black">고정 직원 근무 패턴</h2>
                        <p className="mt-0.5 text-xs text-slate-500">신규 노선은 한 개씩 추가하고, 근무 패턴을 각각 선택합니다.</p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                        <button type="button" onClick={() => setNewRoutesExpanded((open) => !open)} className="flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-3 text-left hover:bg-slate-100">
                            <span className="flex min-w-0 items-center gap-2">
                                <Truck size={17} className="shrink-0 text-indigo-600" />
                                <span className="text-sm font-black">신규 노선</span>
                                <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-bold text-indigo-700">{plannedRoutes.length}개</span>
                            </span>
                            {newRoutesExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {newRoutesExpanded && (
                            <div className="space-y-2 p-3">
                                {plannedRoutes.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">아직 추가된 노선이 없습니다. 아래 ‘노선 추가’를 눌러 시작하세요.</p>
                                ) : plannedRoutes.map((route, index) => {
                                    const editorKey = 'new:' + route.id;
                                    const isEditorOpen = openPatternEditor === editorKey;
                                    return (
                                        <div key={route.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                            <div className="flex min-w-0 items-center gap-2 p-2">
                                                <span className="w-14 shrink-0 text-sm font-black text-slate-800">예정{index + 1}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenPatternEditor(isEditorOpen ? null : editorKey)}
                                                    aria-expanded={isEditorOpen}
                                                    data-pattern-trigger="true"
                                                    aria-label={'예정' + (index + 1) + ' 근무 패턴 선택'}
                                                    className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:border-indigo-300"
                                                >
                                                    <span>{getPatternLabel(route.pattern)}</span>
                                                    {isEditorOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                                <button type="button" onClick={() => { removeRoute(route.id); setOpenPatternEditor((current) => current === editorKey ? null : current); }} aria-label={'예정' + (index + 1) + ' 삭제'} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                                                    <Trash2 size={17} />
                                                </button>
                                            </div>
                                            {isEditorOpen && (
                                                <div className="border-t border-slate-100 p-2">
                                                    <PatternChooser value={route.pattern} onSelect={(pattern) => { updateRoutePattern(route.id, pattern); }} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <p className="text-[11px] text-slate-500">짝 관리를 통해 격주짝을 맞춰보세요</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                        <button type="button" onClick={() => setExistingEmployeesExpanded((open) => !open)} className="flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-3 text-left hover:bg-slate-100">
                            <span className="flex min-w-0 items-center gap-2">
                                <Users size={17} className="shrink-0 text-slate-600" />
                                <span className="text-sm font-black">기존 고정 직원</span>
                                <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-xs font-bold text-slate-700">{fixedEmployeeRows.length}명</span>
                            </span>
                            {existingEmployeesExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {existingEmployeesExpanded && (
                            <div className="space-y-1.5 p-3">
                                {fixedEmployeeRows.length === 0 ? (
                                    <p className="px-2 py-4 text-center text-xs text-slate-400">선택한 팀에 노선이 배정된 고정 직원이 없습니다.</p>
                                ) : fixedEmployeeRows.map((employee) => {
                                    const editorKey = 'employee:' + employee.id;
                                    const isEditorOpen = openPatternEditor === editorKey;
                                    const isModified = normalizePattern(employee.pattern) !== normalizePattern(employee.originalPattern);
                                    return (
                                        <div key={employee.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                            <div className="flex min-w-0 items-center gap-2 p-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-xs font-bold text-slate-800">{employee.name}{isModified && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-black text-amber-800">임시 변경</span>}</p>
                                                    <p className="truncate text-[11px] text-slate-500">{employee.routeName}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenPatternEditor(isEditorOpen ? null : editorKey)}
                                                    aria-expanded={isEditorOpen}
                                                    data-pattern-trigger="true"
                                                    aria-label={employee.name + ' 근무 패턴 선택'}
                                                    className="flex shrink-0 items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-bold text-slate-700 hover:border-indigo-300 sm:px-3"
                                                >
                                                    <span>{getPatternLabel(employee.pattern)}</span>
                                                    {isEditorOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                                {isModified && (
                                                    <button type="button" onClick={() => setPatternOverrides((current) => { const next = { ...current }; delete next[employee.id]; return next; })} className="shrink-0 rounded-md px-1 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100" aria-label={employee.name + ' 원래 패턴으로 되돌리기'}>
                                                        원복
                                                    </button>
                                                )}
                                            </div>
                                            {isEditorOpen && (
                                                <div className="border-t border-slate-100 p-2">
                                                    <PatternChooser
                                                        value={employee.pattern}
                                                        onSelect={(pattern) => {
                                                            setPatternOverrides((current) => ({ ...current, [employee.id]: pattern }));
                                                        }}
                                                    />
                                                    <p className="mt-2 text-center text-[10px] text-slate-400">분석용 임시 변경이며 실제 직원 설정은 저장하지 않습니다.</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3 text-center">
                        <h2 className="text-sm font-black">백업 수요 요약</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="overflow-hidden rounded-xl border border-blue-200 bg-white">
                            <div className="bg-blue-50 px-3 py-2 text-center">
                                <span className="text-xs font-black text-blue-800">현재 운영</span>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-blue-100">
                                <div className="p-3 text-center">
                                    <p className="text-[11px] font-medium text-slate-500">현재 인원</p>
                                    <p className="mt-1 text-lg font-black tabular-nums text-slate-800">{fixedEmployeeRows.length}<span className="ml-0.5 text-xs font-bold">명</span></p>
                                </div>
                                <div className="p-3 text-center">
                                    <p className="text-[11px] font-medium text-slate-500">휴무</p>
                                    <p className="mt-1 text-lg font-black tabular-nums text-slate-800">{formatDays(fixedOffDays)}<span className="ml-0.5 text-xs font-bold">일/주</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white">
                            <div className="bg-emerald-50 px-3 py-2 text-center">
                                <span className="text-xs font-black text-emerald-800">추가 인원</span>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-emerald-100">
                                <div className="p-3 text-center">
                                    <p className="text-[11px] font-medium text-slate-500">추가 인원</p>
                                    <p className="mt-1 text-lg font-black tabular-nums text-slate-800">{plannedRoutes.length}<span className="ml-0.5 text-xs font-bold">명</span></p>
                                </div>
                                <div className="p-3 text-center">
                                    <p className="text-[11px] font-medium text-slate-500">추가 휴무</p>
                                    <p className="mt-1 text-lg font-black tabular-nums text-slate-800">{formatDays(extraOffDays)}<span className="ml-0.5 text-xs font-bold">일/주</span></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-xl border border-teal-200 bg-teal-50/40">
                        <div className="bg-teal-50 px-3 py-2 text-center">
                            <span className="text-xs font-black text-teal-800">합계 (현재 + 추가)</span>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-teal-100">
                            <div className="p-3 text-center">
                                <p className="text-[11px] font-medium text-slate-500">전체 인원</p>
                                <p className="mt-1 text-xl font-black tabular-nums text-slate-800">{fixedEmployeeRows.length + plannedRoutes.length}<span className="ml-0.5 text-xs font-bold">명</span></p>
                            </div>
                            <div className="p-3 text-center">
                                <p className="text-[11px] font-medium text-slate-500">전체 휴무</p>
                                <p className="mt-1 text-xl font-black tabular-nums text-slate-800">{formatDays(totalOffDays)}<span className="ml-0.5 text-xs font-bold">일/주</span></p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80">
                        <div className="px-3 py-2 text-center">
                            <span className="text-xs font-black text-slate-700">백업 현황</span>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-slate-200">
                            <div className="p-3 text-center">
                                <p className="text-[11px] font-medium text-slate-500">현재 백업</p>
                                <p className="mt-1 text-lg font-black tabular-nums text-slate-800">{currentBackups.length}<span className="ml-0.5 text-xs font-bold">명</span></p>
                            </div>
                            <div className="p-3 text-center">
                                <p className="text-[11px] font-medium text-slate-500">백업 근무</p>
                                <p className="mt-1 text-lg font-black tabular-nums text-slate-800">{formatDays(currentBackupWorkDays)}<span className="ml-0.5 text-xs font-bold">일/주</span></p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-xl border border-violet-300 bg-violet-50/60 p-3 text-center">
                        <p className="text-xs font-black text-violet-800">부족 일수 및 추가 채용 추천</p>
                        <p className="mt-2 text-[11px] text-slate-600">
                            전체 휴무 {formatDays(totalOffDays)}일/주 − 현재 백업 근무 {formatDays(currentBackupWorkDays)}일/주
                        </p>
                        {requiredExtraBackupWorkDays > 0 ? (
                            <>
                                <p className="mt-1 text-sm font-bold text-violet-700">부족 {formatDays(requiredExtraBackupWorkDays)}일/주</p>
                                <div className="my-3 border-t border-violet-200" />
                                <p className="text-xl font-black leading-7 text-violet-900">
                                    주 5일 백업 {recommendedHires}명 추가
                                </p>
                            </>
                        ) : (
                            <p className="mt-2 text-sm font-bold text-slate-700">
                                현재 백업 근무일수로 수요를 충당할 수 있습니다.
                            </p>
                        )}
                    </div>
                    <p className="mt-3 text-center text-[10px] leading-4 text-slate-400">
                        격주 근무는 평균 근무일수(예: 5.5일)로 계산합니다.
                    </p>
                </section>
                <p className="px-1 text-[11px] leading-5 text-slate-400">
                    근무 패턴 변경은 이 화면의 예상 계산에만 반영하며, 실제 직원 정보에는 저장하지 않습니다.
                </p>
            </main>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-4px_14px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5 sm:px-4" style={{ paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))' }}>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-800">노선 추가 시뮬레이션</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">한 번에 한 개씩 · 패턴별 자동 계산</p>
                    </div>
                    <button type="button" onClick={addRoute} disabled={plannedRoutes.length >= MAX_EXTRA_ROUTES} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                        <Plus size={18} />
                        노선 추가
                    </button>
                </div>
            </div>
        </div>
    );
}
