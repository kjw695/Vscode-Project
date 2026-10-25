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
    const [isBiweeklySelected, setIsBiweeklySelected] = useState(selectedPattern.includes('격주'));
    // 격주 6일은 한 주가 7일 근무가 되므로 선택지에서 제외합니다.
    const daysOptions = isBiweeklySelected ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6];

    const selectPatternType = (isBiweekly) => {
        // Switching tabs only changes the visible options; keep the picker open.
        setIsBiweeklySelected(isBiweekly);
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

    // 단 한 주의 환산 수요만 계산합니다. 격주 근무는 실제 근무일 환산값에 0.5를 더합니다.
    const fixedOffDays = useMemo(() => fixedEmployeeRows.reduce(
        (sum, employee) => sum + (7 - getAverageWorkDays(employee.pattern)),
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

    const totalOffDays = fixedOffDays + extraOffDays;
    const requiredExtraBackupWorkDays = Math.max(0, totalOffDays - currentBackupWorkDays);

    // 한 주의 부족량 그대로 실제 추천 패턴 값과 비교합니다. 0.5일 단위 계산에 별도 배율은 쓰지 않습니다.
    const recommendationPatterns = [
        { label: '주 3일', days: 3, preferred: false, regularFive: false },
        { label: '주 4일', days: 4, preferred: false, regularFive: false },
        { label: '주 5일', days: 5, preferred: true, regularFive: true },
        { label: '주 6일', days: 6, preferred: false, regularFive: false },
        { label: '격주 3일', days: 3.5, preferred: false, regularFive: false },
        { label: '격주 4일', days: 4.5, preferred: false, regularFive: false },
        { label: '격주 5일', days: 5.5, preferred: true, regularFive: false }
    ];

    const targetDays = requiredExtraBackupWorkDays;
    const maxDays = targetDays + 6;
    const dayKey = (value) => Number(value).toFixed(1);
    const bestForDays = new Map();
    bestForDays.set(dayKey(0), {
        hires: 0,
        preferredCount: 0,
        regularFiveCount: 0,
        counts: Array(recommendationPatterns.length).fill(0)
    });

    // 각 패턴의 실제 환산 일수를 그대로 더합니다. 초과가 가장 적은 조합을 우선 찾습니다.
    for (let suppliedDays = 0; suppliedDays <= maxDays; suppliedDays = Number((suppliedDays + 0.5).toFixed(1))) {
        const current = bestForDays.get(dayKey(suppliedDays));
        if (!current) continue;

        recommendationPatterns.forEach((pattern, index) => {
            const nextDays = Number((suppliedDays + pattern.days).toFixed(1));
            if (nextDays > maxDays) return;

            const candidate = {
                hires: current.hires + 1,
                preferredCount: current.preferredCount + (pattern.preferred ? 1 : 0),
                regularFiveCount: current.regularFiveCount + (pattern.regularFive ? 1 : 0),
                counts: current.counts.map((count, countIndex) => count + (countIndex === index ? 1 : 0))
            };
            const key = dayKey(nextDays);
            const existing = bestForDays.get(key);
            if (
                !existing ||
                candidate.hires < existing.hires ||
                (candidate.hires === existing.hires && candidate.preferredCount > existing.preferredCount) ||
                (candidate.hires === existing.hires && candidate.preferredCount === existing.preferredCount && candidate.regularFiveCount > existing.regularFiveCount)
            ) {
                bestForDays.set(key, candidate);
            }
        });
    }

    let recommendedSuppliedDays = -1;
    for (let suppliedDays = targetDays; suppliedDays <= maxDays; suppliedDays = Number((suppliedDays + 0.5).toFixed(1))) {
        if (!bestForDays.has(dayKey(suppliedDays))) continue;
        recommendedSuppliedDays = suppliedDays;
        break;
    }

    const bestRecommendation = recommendedSuppliedDays >= 0
        ? bestForDays.get(dayKey(recommendedSuppliedDays))
        : null;
    const recommendedPattern = bestRecommendation && bestRecommendation.hires > 0
        ? recommendationPatterns
            .map((pattern, index) => bestRecommendation.counts[index] > 0
                ? pattern.label + ' ' + bestRecommendation.counts[index] + '명'
                : '')
            .filter(Boolean)
            .join(' + ')
        : '초과 0일로 충원 가능한 조합 없음';
    const recommendedHires = bestRecommendation?.hires || 0;
    const recommendedExcessDays = Math.max(0, Number((recommendedSuppliedDays - requiredExtraBackupWorkDays).toFixed(1)));

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
                        <h2 className="text-sm font-black">인원 구성</h2>
                        <p className="mt-0.5 text-xs text-slate-500">신규 인원과 기존 인원의 근무 패턴을 설정하세요.</p>
                    </div>

                    <div id="new-personnel-section" className="scroll-mt-3 overflow-hidden rounded-xl border border-slate-200">
                        <div className="flex items-stretch gap-2 bg-slate-50 p-2">
                            <button type="button" onClick={() => setNewRoutesExpanded((open) => !open)} className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-100">
                                <span className="flex min-w-0 items-center gap-2">
                                    <Truck size={17} className="shrink-0 text-indigo-600" />
                                    <span className="truncate text-sm font-black">신규 인원</span>
                                    <span className="shrink-0 rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-bold text-indigo-700">{plannedRoutes.length}명</span>
                                </span>
                                {newRoutesExpanded ? <ChevronUp size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
                            </button>
                            <button type="button" onClick={addRoute} disabled={plannedRoutes.length >= MAX_EXTRA_ROUTES} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-2 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-3 sm:text-sm">
                                <Plus size={16} />
                                추가
                            </button>
                        </div>
                        {newRoutesExpanded && (
                            <div className="space-y-2 p-3">
                                {plannedRoutes.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">아직 추가된 인원이 없습니다. 오른쪽 ‘추가’를 눌러 시작하세요.</p>
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
                                                    <PatternChooser value={route.pattern} onSelect={(pattern) => { updateRoutePattern(route.id, pattern); setOpenPatternEditor(null); }} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <p className="text-[11px] text-slate-500">짝 관리를 통해 격주짝을 맞춰보세요</p>
                            </div>
                        )}
                    </div>

                    <div id="existing-personnel-section" className="mt-2 scroll-mt-3 overflow-hidden rounded-xl border border-slate-200">
                        <button type="button" onClick={() => setExistingEmployeesExpanded((open) => !open)} className="flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-3 text-left hover:bg-slate-100">
                            <span className="flex min-w-0 items-center gap-2">
                                <Users size={17} className="shrink-0 text-slate-600" />
                                <span className="text-sm font-black">기존 인원</span>
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
                                                            setOpenPatternEditor(null);
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

                <section id="demand-prediction-section" className="min-w-0 scroll-mt-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4">
                    <div className="mb-2 flex items-center justify-center gap-2 sm:mb-3">
                        <Users size={22} className="shrink-0 text-indigo-600 sm:h-7 sm:w-7" />
                        <h2 className="text-lg font-black text-slate-800 sm:text-2xl">백업 수요 요약</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div className="min-w-0 overflow-hidden rounded-xl border border-blue-200 bg-white">
                            <div className="flex items-center justify-center gap-1.5 bg-blue-50 px-1.5 py-2 sm:gap-2 sm:px-3">
                                <Truck size={18} className="shrink-0 text-blue-600 sm:h-6 sm:w-6" />
                                <span className="text-sm font-black text-blue-800 sm:text-base">현재 운영</span>
                            </div>
                            <div className="grid min-w-0 grid-cols-2 divide-x divide-blue-100">
                                <div className="min-w-0 p-2 text-center sm:p-3">
                                    <p className="text-xs font-medium text-slate-600 sm:text-sm">현재 인원</p>
                                    <p className="mt-1 text-xl font-black tabular-nums text-slate-800 sm:text-2xl">{fixedEmployeeRows.length}<span className="ml-0.5 text-xs font-bold sm:text-sm">명</span></p>
                                </div>
                                <div className="min-w-0 p-2 text-center sm:p-3">
                                    <p className="text-xs font-medium text-slate-600 sm:text-sm">휴무</p>
                                    <p className="mt-1 flex min-w-0 items-baseline justify-center gap-0.5 whitespace-nowrap text-[clamp(1rem,5vw,1.25rem)] font-black leading-none tabular-nums text-slate-800 sm:text-2xl">{formatDays(fixedOffDays)}<span className="shrink-0 text-[clamp(0.625rem,2.8vw,0.875rem)] font-bold sm:text-sm">일/주</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="min-w-0 overflow-hidden rounded-xl border border-emerald-200 bg-white">
                            <div className="flex items-center justify-center gap-1.5 bg-emerald-50 px-1.5 py-2 sm:gap-2 sm:px-3">
                                <Plus size={19} className="shrink-0 text-emerald-600 sm:h-6 sm:w-6" />
                                <span className="text-sm font-black text-emerald-800 sm:text-base">추가 인원</span>
                            </div>
                            <div className="grid min-w-0 grid-cols-2 divide-x divide-emerald-100">
                                <div className="min-w-0 p-2 text-center sm:p-3">
                                    <p className="text-xs font-medium text-slate-600 sm:text-sm">추가 인원</p>
                                    <p className="mt-1 text-xl font-black tabular-nums text-slate-800 sm:text-2xl">{plannedRoutes.length}<span className="ml-0.5 text-xs font-bold sm:text-sm">명</span></p>
                                </div>
                                <div className="min-w-0 p-2 text-center sm:p-3">
                                    <p className="text-xs font-medium text-slate-600 sm:text-sm">추가 휴무</p>
                                    <p className="mt-1 flex min-w-0 items-baseline justify-center gap-0.5 whitespace-nowrap text-[clamp(1rem,5vw,1.25rem)] font-black leading-none tabular-nums text-slate-800 sm:text-2xl">{formatDays(extraOffDays)}<span className="shrink-0 text-[clamp(0.625rem,2.8vw,0.875rem)] font-bold sm:text-sm">일/주</span></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 overflow-hidden rounded-xl border border-teal-200 bg-teal-50/50 sm:mt-3">
                        <div className="flex items-center justify-center gap-1.5 bg-teal-50 px-3 py-2">
                            <CalendarDays size={18} className="shrink-0 text-teal-700 sm:h-6 sm:w-6" />
                            <span className="text-sm font-black text-teal-800 sm:text-base">합계 (현재 + 추가)</span>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-teal-200">
                            <div className="min-w-0 p-2 text-center sm:p-3">
                                <p className="text-xs font-medium text-slate-600 sm:text-sm">전체 인원</p>
                                <p className="mt-1 text-2xl font-black tabular-nums text-slate-800 sm:text-3xl">{fixedEmployeeRows.length + plannedRoutes.length}<span className="ml-0.5 text-xs font-bold sm:text-sm">명</span></p>
                            </div>
                            <div className="min-w-0 p-2 text-center sm:p-3">
                                <p className="text-xs font-medium text-slate-600 sm:text-sm">전체 휴무</p>
                                <p className="mt-1 flex min-w-0 items-baseline justify-center gap-0.5 whitespace-nowrap text-[clamp(1rem,5vw,1.5rem)] font-black leading-none tabular-nums text-slate-800 sm:text-3xl">{formatDays(totalOffDays)}<span className="shrink-0 text-[clamp(0.625rem,2.8vw,0.875rem)] font-bold sm:text-sm">일/주</span></p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 sm:mt-3">
                        <div className="flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4">
                            <Users size={19} className="shrink-0 text-slate-600 sm:h-6 sm:w-6" />
                            <span className="text-sm font-black text-slate-800 sm:text-base">백업 현황</span>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-slate-200">
                            <div className="min-w-0 p-2 text-center sm:p-3">
                                <p className="text-xs font-medium text-slate-600 sm:text-sm">현재 백업</p>
                                <p className="mt-1 text-xl font-black tabular-nums text-slate-800 sm:text-2xl">{currentBackups.length}<span className="ml-0.5 text-xs font-bold sm:text-sm">명</span></p>
                            </div>
                            <div className="min-w-0 p-2 text-center sm:p-3">
                                <p className="text-xs font-medium text-slate-600 sm:text-sm">백업 근무</p>
                                <p className="mt-1 flex min-w-0 items-baseline justify-center gap-0.5 whitespace-nowrap text-[clamp(1rem,5vw,1.25rem)] font-black leading-none tabular-nums text-slate-800 sm:text-2xl">{formatDays(currentBackupWorkDays)}<span className="shrink-0 text-[clamp(0.625rem,2.8vw,0.875rem)] font-bold sm:text-sm">일/주</span></p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 overflow-hidden rounded-xl border border-violet-300 bg-violet-50/60 p-2 text-center sm:mt-3 sm:p-4">
                        <div className="flex items-center justify-center gap-1.5">
                            <BarChart3 size={18} className="shrink-0 text-violet-700 sm:h-6 sm:w-6" />
                            <p className="text-sm font-black text-violet-800 sm:text-base">부족 일수 및 추가 채용 추천</p>
                        </div>
                        <p className="mt-2 text-xs text-slate-600 sm:text-sm">
                            전체 휴무 {formatDays(totalOffDays)}일 − 현재 백업 근무 {formatDays(currentBackupWorkDays)}일
                        </p>
                        {requiredExtraBackupWorkDays > 0 ? (
                            <>
                                <p className="mt-1 text-xl font-black text-violet-700 sm:text-2xl">부족 {formatDays(requiredExtraBackupWorkDays)}일</p>
                                <div className="my-2 border-t border-violet-200 sm:my-3" />
                                <div className="mx-auto flex w-full max-w-full flex-wrap items-center justify-center gap-1.5">
                                    {(recommendedHires > 0 ? recommendedPattern + ' 추가' : '초과 0일로 충원 가능한 조합 없음').split(' + ').map((item, index) => (
                                        <React.Fragment key={item + '-' + index}>
                                            {index > 0 && <span className="px-0.5 text-sm font-black text-violet-700 sm:text-lg">+</span>}
                                            <span className="inline-flex max-w-full items-center whitespace-nowrap rounded-lg border border-violet-200 bg-white/80 px-2 py-1 text-[clamp(0.7rem,3.6vw,1.5rem)] font-black leading-tight text-violet-900 sm:px-3 sm:py-1.5 sm:text-2xl">
                                                {item}
                                            </span>
                                        </React.Fragment>
                                    ))}
                                </div>
                                <p className="mt-1 text-xs font-medium text-violet-700 sm:text-sm">
                                    추가 충원 {formatDays(recommendedSuppliedDays)}일 · 초과 {formatDays(recommendedExcessDays)}일
                                </p>
                            </>
                        ) : (
                            <p className="mt-2 text-sm font-bold text-slate-700">
                                현재 백업 근무일수로 필요한 수요를 충당할 수 있습니다.
                            </p>
                        )}
                    </div>
                </section>
                <p className="px-1 text-[11px] leading-5 text-slate-400">
                    근무 패턴 변경은 이 화면의 예상 계산에만 반영하며, 실제 직원 정보에는 저장하지 않습니다.
                </p>
            </main>

            <nav aria-label="수요 분석 바로가기" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-4px_14px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="mx-auto grid max-w-5xl grid-cols-3 gap-1 px-2 pt-2 sm:gap-2 sm:px-4" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
                    <button type="button" onClick={() => document.getElementById('new-personnel-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-indigo-700 transition-colors hover:bg-indigo-50">
                        <Truck size={18} className="shrink-0" />
                        <span className="whitespace-nowrap text-[clamp(0.65rem,2.8vw,0.875rem)] font-black">신규 인원</span>
                    </button>
                    <button type="button" onClick={() => document.getElementById('existing-personnel-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-slate-700 transition-colors hover:bg-slate-100">
                        <Users size={18} className="shrink-0" />
                        <span className="whitespace-nowrap text-[clamp(0.65rem,2.8vw,0.875rem)] font-black">기존 인원</span>
                    </button>
                    <button type="button" onClick={() => document.getElementById('demand-prediction-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-slate-700 transition-colors hover:bg-slate-100">
                        <BarChart3 size={18} className="shrink-0" />
                        <span className="whitespace-nowrap text-[clamp(0.65rem,2.8vw,0.875rem)] font-black">수요 예측</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}
