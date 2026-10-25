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
    CalendarDays,
    UserRound
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

export default function BackupDemandAnalysis({ onBack }) {
    const { employees = [], teams = [], routes = [] } = useAdminData();
    const [selectedRegion, setSelectedRegion] = useState(() => getRegion(teams[0]));
    const [selectedShift, setSelectedShift] = useState(() => getShift(teams[0]));
    const [selectedTeamId, setSelectedTeamId] = useState(() => teams[0]?.id || '');
    const [plannedRoutes, setPlannedRoutes] = useState([]);
    const [newRoutesExpanded, setNewRoutesExpanded] = useState(true);
    const [existingEmployeesExpanded, setExistingEmployeesExpanded] = useState(false);

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

    // 실제 배정된 노선을 직원별 근무 패턴으로 펼쳐, 노선마다 필요한 휴무 보충 일수를 계산합니다.
    const fixedRouteRows = useMemo(() => employeeRows
        .filter((employee) => employee.isCounted)
        .flatMap((employee) => employee.routeNames.map((routeName, index) => ({
            id: String(employee.id) + '-' + String(index) + '-' + routeName,
            name: employee.name || '이름 미등록',
            routeName,
            pattern: employee.pattern || employee.work_pattern || '주 5일'
        }))),
    [employeeRows]);

    const currentBackups = useMemo(() => teamEmployees
        .filter((employee) => getEmployeeType(employee) === 'sub'),
    [teamEmployees]);

    const backupPattern = useMemo(
        () => getDefaultBackupPattern(currentBackups),
        [currentBackups]
    );

    const fixedOffDays = useMemo(() => fixedRouteRows.reduce(
        (sum, route) => sum + (7 - getAverageWorkDays(route.pattern)),
        0
    ), [fixedRouteRows]);

    const currentBackupWorkDays = useMemo(() => currentBackups.reduce(
        (sum, employee) => sum + getAverageWorkDays(employee.pattern || employee.work_pattern || '주 5일'),
        0
    ), [currentBackups]);

    const extraOffDays = useMemo(() => plannedRoutes.reduce(
        (sum, route) => sum + (7 - getAverageWorkDays(route.pattern)),
        0
    ), [plannedRoutes]);

    const backupPatternDays = getAverageWorkDays(backupPattern);
    const recommendedHires = extraOffDays > 0
        ? Math.ceil(extraOffDays / backupPatternDays)
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

    const patternOptions = [
        { value: '주 5일', label: '주 5일' },
        { value: '주 6일', label: '주 6일' },
        { value: '격주 5일', label: '격주 5.5일' },
        { value: '격주 6일', label: '격주 6.5일' }
    ];

    const hasNoRoutes = fixedRouteRows.length === 0 && plannedRoutes.length === 0;

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
                                ) : plannedRoutes.map((route, index) => (
                                    <div key={route.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                                        <span className="w-14 shrink-0 text-sm font-black text-slate-800">예정{index + 1}</span>
                                        <select value={route.pattern} onChange={(event) => updateRoutePattern(route.id, event.target.value)} aria-label={'예정' + (index + 1) + ' 근무 패턴'} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-indigo-400">
                                            {patternOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </select>
                                        <button type="button" onClick={() => removeRoute(route.id)} aria-label={'예정' + (index + 1) + ' 삭제'} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                                            <Trash2 size={17} />
                                        </button>
                                    </div>
                                ))}
                                <p className="text-[11px] text-slate-500">격주 패턴은 평균 근무일수로 환산해 휴무 보충 일수를 계산합니다. 결과는 변경 즉시 갱신됩니다.</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                        <button type="button" onClick={() => setExistingEmployeesExpanded((open) => !open)} className="flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-3 text-left hover:bg-slate-100">
                            <span className="flex min-w-0 items-center gap-2">
                                <Users size={17} className="shrink-0 text-slate-600" />
                                <span className="text-sm font-black">기존 고정 직원</span>
                                <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-xs font-bold text-slate-700">{fixedRouteRows.length}개 노선</span>
                            </span>
                            {existingEmployeesExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {existingEmployeesExpanded && (
                            <div className="space-y-1.5 p-3">
                                {fixedRouteRows.length === 0 ? (
                                    <p className="px-2 py-4 text-center text-xs text-slate-400">선택한 팀에 노선이 배정된 고정 직원이 없습니다.</p>
                                ) : fixedRouteRows.map((route) => (
                                    <div key={route.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-bold text-slate-800">{route.name}</p>
                                            <p className="truncate text-[11px] text-slate-500">{route.routeName}</p>
                                        </div>
                                        <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-slate-700">{getPatternLabel(route.pattern)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <CalendarDays size={18} className="text-indigo-600" />
                        <h2 className="text-sm font-black">백업 수요 요약</h2>
                    </div>

                    <div className="space-y-2">
                        <div className="rounded-xl border border-slate-200 p-3">
                            <p className="text-xs font-bold text-slate-500">고정 노선</p>
                            <p className="mt-1 text-sm font-black leading-6">
                                고정 노선 {fixedRouteRows.length}개 · 휴무 보충 {formatDays(fixedOffDays)}일/주
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                                현재 백업 {currentBackups.length}명 · 주 {formatDays(currentBackupWorkDays)}일 근무 가능
                            </p>
                        </div>

                        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                            <p className="text-xs font-bold text-indigo-700">추가 노선</p>
                            <p className="mt-1 text-sm font-black leading-6">
                                추가 노선 {plannedRoutes.length}개 · 휴무 보충 {formatDays(extraOffDays)}일/주
                            </p>
                            {plannedRoutes.length > 0 ? (
                                <p className="mt-1 text-xs text-slate-600">
                                    {getPatternLabel(backupPattern)} 백업 기준 · {formatDays(extraOffDays)}일 ÷ {formatDays(backupPatternDays)}일
                                </p>
                            ) : (
                                <p className="mt-1 text-xs text-slate-500">노선을 추가하면 필요한 백업 인원을 계산합니다.</p>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-900 p-4 text-white">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <UserRound size={16} />
                            추가 채용 안내
                        </div>
                        {plannedRoutes.length > 0 ? (
                            <>
                                <p className="mt-2 text-xl font-black leading-7">
                                    {getPatternLabel(backupPattern)} 백업 {recommendedHires}명 추가
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-300">
                                    추가 노선의 주간 휴무 보충 일수를 기준으로 계산한 예상 인원입니다.
                                </p>
                            </>
                        ) : (
                            <p className="mt-2 text-sm font-bold text-white">노선을 추가하면 필요한 추가 인원이 표시됩니다.</p>
                        )}
                    </div>

                    {hasNoRoutes && (
                        <p className="mt-3 text-xs leading-5 text-slate-500">
                            고정 노선이 없는 상태입니다. 신규 노선을 추가하면 예상 백업 근무일수와 채용 인원을 계산합니다.
                        </p>
                    )}
                </section>
                <p className="px-1 text-[11px] leading-5 text-slate-400">
                    격주 5일은 주 평균 5.5일 근무, 격주 6일은 주 평균 6.5일 근무로 계산합니다. 기존 직원과 백업의 등록된 근무 패턴은 변경하지 않습니다.
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
