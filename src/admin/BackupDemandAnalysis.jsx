import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    BarChart3,
    CheckCircle2,
    AlertCircle,
    Search,
    TrendingDown,
    Users
} from 'lucide-react';
import { useAdminData } from './contexts/DataContext';
import { generateWeeklySchedule } from './utils/schedulingEngine';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const BACKUP_PATTERNS = ['주 5일', '주 6일', '격주 5일', '격주 6일'];
const MAX_EXTRA_BACKUPS = 30;

function getEmployeeType(employee) {
    const type = String(employee?.type || employee?.employee_type || employee?.employeeType || '').toLowerCase();
    return ['sub', 'substitute', 'backup', '대체', '백업'].includes(type) ? 'sub' : 'base';
}

function getShift(team) {
    const shift = String(team?.shift || team?.workShift || team?.work_shift || '').toLowerCase();
    return shift === 'night' || shift === '야간' ? 'night' : 'day';
}

function getShiftLabel(shift) {
    return shift === 'night' ? '야간' : '주간';
}

function getRegion(team) {
    return team?.region || '기본 지역';
}

function getSundayString(dateValue) {
    const date = dateValue ? new Date(dateValue + 'T12:00:00') : new Date();
    date.setDate(date.getDate() - date.getDay());
    return formatDate(date);
}

function formatDate(date) {
    return String(date.getFullYear()) + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
}

function addDays(dateValue, amount) {
    const date = new Date(dateValue + 'T12:00:00');
    date.setDate(date.getDate() + amount);
    return formatDate(date);
}

function getPatternLabel(pattern) {
    const value = String(pattern || '주 5일');
    const match = value.match(/[1-6]/);
    const days = match ? Number(match[0]) : 5;
    return value.includes('격주') ? '격주 ' + days + '/' + Math.min(7, days + 1) + '회' : '주 ' + days + '회';
}

function removeFixedOffs(employee) {
    return {
        ...employee,
        fixedOffWeekdays: [],
        fixedOffWeekdaysByWeek: null,
        hasFixedOffDays: false
    };
}

function includesEmployeeId(ids, employeeId) {
    return (ids || []).some((item) => {
        const id = item && typeof item === 'object'
            ? (item.employeeId || item.employee_id || item.id)
            : item;
        return String(id) === String(employeeId);
    });
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

/**
 * This screen intentionally ignores fixed weekday settings.
 * It estimates the minimum added backup workforce by repeatedly simulating
 * two consecutive weeks with the current scheduling engine.
 */
function simulateCoverage({
    teamId,
    baseEmployees,
    currentBackups,
    extraBackupCount,
    extraBackupPattern,
    extraRouteCount,
    extraRoutePattern,
    weekStart
}) {
    const simulatedBases = baseEmployees.map((employee) => removeFixedOffs({
        ...employee,
        type: 'base',
        employee_type: 'base'
    }));

    for (let index = 0; index < extraRouteCount; index += 1) {
        simulatedBases.push(removeFixedOffs({
            id: '__analysis_route_' + String(index + 1),
            name: '가정 노선 ' + String(index + 1),
            route: '가정 노선 ' + String(index + 1),
            type: 'base',
            employee_type: 'base',
            team_id: teamId,
            pattern: extraRoutePattern,
            active: true
        }));
    }

    const simulatedBackups = currentBackups.map((employee) => removeFixedOffs({
        ...employee,
        type: 'sub',
        employee_type: 'substitute'
    }));

    for (let index = 0; index < extraBackupCount; index += 1) {
        simulatedBackups.push(removeFixedOffs({
            id: '__analysis_backup_' + String(index + 1),
            name: '가정 백업 ' + String(index + 1),
            type: 'sub',
            employee_type: 'substitute',
            team_id: teamId,
            pattern: extraBackupPattern,
            target: '',
            active: true,
            biweeklyWeekOffset: index % 2
        }));
    }

    const allEmployees = simulatedBases.concat(simulatedBackups);
    const schedule = {};
    const warnings = [];

    try {
        [0, 7].forEach((offset) => {
            const result = generateWeeklySchedule({
                weekStart: addDays(weekStart, offset),
                employees: allEmployees,
                substitutePermissions: [],
                fixedDaysOff: [],
                substituteWorkHistory: []
            });
            Object.assign(schedule, result.schedule || {});
            warnings.push(...(result.warnings || []));
        });
    } catch (error) {
        return {
            extraBackupCount,
            schedule: {},
            dailyRows: [],
            totalRequired: 0,
            totalCovered: 0,
            shortageCount: 0,
            isFeasible: false,
            error: error.message || '시뮬레이션 중 오류가 발생했습니다.'
        };
    }

    const dailyRows = Object.keys(schedule).sort().map((dateKey) => {
        const record = schedule[dateKey] || {};
        const offIds = Array.isArray(record.offEmployeeIds) ? record.offEmployeeIds : [];
        const needed = simulatedBases.filter((employee) => includesEmployeeId(offIds, employee.id)).length;
        const assigned = Array.isArray(record.subs) ? record.subs.length : 0;
        const shortage = Math.max(0, needed - assigned);
        return {
            date: dateKey,
            weekday: WEEKDAYS[new Date(dateKey + 'T12:00:00').getDay()],
            needed,
            assigned: Math.min(needed, assigned),
            shortage
        };
    });

    const totalRequired = dailyRows.reduce((sum, row) => sum + row.needed, 0);
    const totalCovered = dailyRows.reduce((sum, row) => sum + row.assigned, 0);
    const shortageCount = dailyRows.reduce((sum, row) => sum + row.shortage, 0);
    return {
        extraBackupCount,
        schedule,
        dailyRows,
        totalRequired,
        totalCovered,
        shortageCount,
        isFeasible: shortageCount === 0 && !warnings.some((warning) => String(warning).startsWith('[백업 인원 확인 필요]')),
        error: ''
    };
}

export default function BackupDemandAnalysis({ onBack }) {
    const { employees = [], teams = [], routes = [] } = useAdminData();
    const [selectedRegion, setSelectedRegion] = useState(() => getRegion(teams[0]));
    const [selectedShift, setSelectedShift] = useState(() => getShift(teams[0]));
    const [selectedTeamId, setSelectedTeamId] = useState(() => teams[0]?.id || '');
    const [weekStart, setWeekStart] = useState(() => getSundayString(formatDate(new Date())));
    const [backupPattern, setBackupPattern] = useState('주 6일');
    const [extraRouteCount, setExtraRouteCount] = useState(0);
    const [extraRoutePattern, setExtraRoutePattern] = useState('주 6일');
    const [search, setSearch] = useState('');

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

    const selectedTeam = teams.find((team) => String(team.id) === String(selectedTeamId)) || null;

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

    const assignedBaseEmployees = useMemo(() => employeeRows
        .filter((employee) => employee.isCounted)
        .map((employee) => ({
            ...employee,
            route: employee.routeLabel
        })),
    [employeeRows]);

    const currentBackups = useMemo(() => teamEmployees
        .filter((employee) => getEmployeeType(employee) === 'sub'),
    [teamEmployees]);

    const filteredEmployeeRows = useMemo(() => {
        const keyword = search.trim().toLocaleLowerCase();
        if (!keyword) return employeeRows;
        return employeeRows.filter((employee) =>
            [employee.name, employee.routeLabel, getPatternLabel(employee.pattern || employee.work_pattern)]
                .some((value) => String(value || '').toLocaleLowerCase().includes(keyword))
        );
    }, [employeeRows, search]);

    const analysis = useMemo(() => {
        if (!selectedTeamId) return null;

        const maxExtraBackups = Math.min(MAX_EXTRA_BACKUPS, Math.max(8, assignedBaseEmployees.length));
        const scenarios = [];
        let minimumExtraBackups = null;

        for (let count = 0; count <= maxExtraBackups; count += 1) {
            const scenario = simulateCoverage({
                teamId: selectedTeamId,
                baseEmployees: assignedBaseEmployees,
                currentBackups,
                extraBackupCount: count,
                extraBackupPattern: backupPattern,
                extraRouteCount: Number(extraRouteCount),
                extraRoutePattern,
                weekStart
            });
            scenarios.push(scenario);
            if (scenario.isFeasible) {
                minimumExtraBackups = count;
                break;
            }
        }

        const currentScenario = scenarios[0] || null;
        return {
            currentScenario,
            scenarios,
            minimumExtraBackups,
            maxExtraBackups,
            totalBackupCount: minimumExtraBackups == null
                ? null
                : currentBackups.length + minimumExtraBackups
        };
    }, [
        selectedTeamId,
        assignedBaseEmployees,
        currentBackups,
        backupPattern,
        extraRouteCount,
        extraRoutePattern,
        weekStart
    ]);

    const visibleScenarios = useMemo(() => {
        if (!analysis) return [];
        const first = analysis.scenarios.slice(0, 6);
        const minimum = analysis.scenarios.find((scenario) =>
            scenario.extraBackupCount === analysis.minimumExtraBackups
        );
        if (minimum && !first.some((scenario) => scenario.extraBackupCount === minimum.extraBackupCount)) {
            first.push(minimum);
        }
        return first;
    }, [analysis]);

    const weekOneRows = analysis?.currentScenario?.dailyRows.slice(0, 7) || [];
    const weekTwoRows = analysis?.currentScenario?.dailyRows.slice(7, 14) || [];
    const noAssignedRoutes = Boolean(selectedTeamId) && assignedBaseEmployees.length === 0;
    const totalCurrentBackupCount = currentBackups.length;
    const minimumExtraBackups = analysis?.minimumExtraBackups;
    const totalBackupCount = analysis?.totalBackupCount;

    return (
        <div className="admin-safe-top flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
            <header className="admin-sticky-safe-header sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
                <button onClick={onBack} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label="관리자 센터로 돌아가기">
                    <ArrowLeft size={22} />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-lg font-black sm:text-xl">백업 수요 분석</h1>
                    <p className="mt-0.5 text-xs text-slate-500">고정 휴무 없이 근무 패턴에 맞춰 계산</p>
                </div>
                <span className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><BarChart3 size={21} /></span>
            </header>

            <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 p-3 pb-8 sm:gap-4 sm:p-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-black">분석 범위</h2>
                            <p className="mt-0.5 text-xs text-slate-500">팀별로 필요한 백업 인원은 따로 계산합니다.</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">2주 기준</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="block min-w-0">
                            <span className="mb-1 block text-xs font-bold text-slate-500">지역</span>
                            <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400">
                                {regions.map((region) => <option key={region} value={region}>{region}</option>)}
                            </select>
                        </label>
                        <label className="block min-w-0">
                            <span className="mb-1 block text-xs font-bold text-slate-500">근무조</span>
                            <select value={selectedShift} onChange={(event) => setSelectedShift(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400">
                                <option value="day">주간</option>
                                <option value="night">야간</option>
                            </select>
                        </label>
                        <label className="block min-w-0">
                            <span className="mb-1 block text-xs font-bold text-slate-500">팀</span>
                            <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400" disabled={filteredTeams.length === 0}>
                                {filteredTeams.length === 0 && <option value="">등록된 팀 없음</option>}
                                {filteredTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                            </select>
                        </label>
                        <label className="block min-w-0">
                            <span className="mb-1 block text-xs font-bold text-slate-500">분석 시작 주</span>
                            <input type="date" value={weekStart} onChange={(event) => setWeekStart(getSundayString(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400" />
                        </label>
                    </div>
                    <p className="mt-3 flex items-start gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs leading-5 text-indigo-800">
                        <AlertCircle size={15} className="mt-0.5 shrink-0" />
                        <span>고정 휴무 요일과 날짜별 고정 휴무는 모두 무시합니다. 직원별 주간·격주 근무 횟수는 유지하고, 2주 동안 휴무 요일을 자동 배치해 비교합니다.</span>
                    </p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3">
                        <h2 className="text-sm font-black">노선 추가 시뮬레이션</h2>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">실제 노선이나 직원 정보는 변경하지 않습니다. 가상 노선을 추가해 백업 수요 변화만 계산합니다.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1 block text-xs font-bold text-slate-500">추가할 노선 수</span>
                            <select value={extraRouteCount} onChange={(event) => setExtraRouteCount(Number(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400">
                                {[0, 1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count === 0 ? '추가 없음' : count + '개'}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-bold text-slate-500">추가 노선의 근무 패턴</span>
                            <select value={extraRoutePattern} onChange={(event) => setExtraRoutePattern(event.target.value)} disabled={extraRouteCount === 0} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400">
                                {['주 5일', '주 6일', '격주 5일', '격주 6일'].map((pattern) => <option key={pattern} value={pattern}>{getPatternLabel(pattern)}</option>)}
                            </select>
                        </label>
                    </div>
                    <label className="mt-3 block">
                        <span className="mb-1 block text-xs font-bold text-slate-500">추가 백업 인력의 근무 패턴</span>
                        <select value={backupPattern} onChange={(event) => setBackupPattern(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400 sm:max-w-sm">
                            {BACKUP_PATTERNS.map((pattern) => <option key={pattern} value={pattern}>{getPatternLabel(pattern)}</option>)}
                        </select>
                    </label>
                </section>

                <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Users size={15} />현재 백업 직원</div>
                        <div className="mt-2 text-2xl font-black">{selectedTeamId ? totalCurrentBackupCount + '명' : '—'}</div>
                        <p className="mt-1 text-[11px] text-slate-400">선택 팀의 활성 백업</p>
                    </div>
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-700"><CheckCircle2 size={15} />최소 필요 백업(예상)</div>
                        <div className="mt-2 text-2xl font-black text-indigo-800">{!selectedTeamId || noAssignedRoutes || totalBackupCount == null ? '—' : totalBackupCount + '명'}</div>
                        <p className="mt-1 text-[11px] text-indigo-700">현재 인원 + 추가 필요 인원</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><TrendingDown size={15} />현재 인원 기준 부족</div>
                        <div className="mt-2 text-2xl font-black">{!analysis || noAssignedRoutes ? '—' : String(analysis.currentScenario?.shortageCount || 0) + '회'}</div>
                        <p className="mt-1 text-[11px] text-slate-400">2주 동안 배정하지 못하는 노선 근무</p>
                    </div>
                </section>

                {noAssignedRoutes && (
                    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                        이 팀에는 노선이 배정된 활성 고정 직원이 없습니다. 노선 배정 후 백업 수요를 계산할 수 있습니다.
                    </section>
                )}

                {selectedTeamId && !noAssignedRoutes && analysis && (
                    <>
                        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <h2 className="text-sm font-black">2주간 요일별 백업 수요</h2>
                                    <p className="mt-0.5 text-xs text-slate-500">휴무는 자동 분산한 가상 근무표 기준입니다.</p>
                                </div>
                                <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">2주 필요 {analysis.currentScenario?.totalRequired || 0}회</span>
                            </div>
                            {[weekOneRows, weekTwoRows].map((weekRows, weekIndex) => (
                                <div key={weekIndex} className={weekIndex === 0 ? 'mb-4' : ''}>
                                    <h3 className="mb-2 text-xs font-black text-slate-600">{weekIndex === 0 ? '1주 차' : '2주 차'} · {weekRows[0]?.date || '날짜 없음'} ~ {weekRows[6]?.date || '날짜 없음'}</h3>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                                        {weekRows.map((row) => (
                                            <div key={row.date} className={'rounded-xl border p-2.5 ' + (row.shortage > 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50')}>
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-xs font-black">{row.weekday}</span>
                                                    <span className="text-[10px] text-slate-500">{row.date.slice(5)}</span>
                                                </div>
                                                <div className="mt-2 text-[11px] leading-5 text-slate-600">필요 {row.needed}명</div>
                                                <div className="text-[11px] leading-5 text-slate-600">배정 {row.assigned}명</div>
                                                <div className={'mt-1 text-xs font-black ' + (row.shortage > 0 ? 'text-rose-700' : 'text-emerald-700')}>부족 {row.shortage}명</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                            <div className="mb-3">
                                <h2 className="text-sm font-black">백업 인원 비교</h2>
                                <p className="mt-0.5 text-xs leading-5 text-slate-500">기존 백업 직원은 근무 패턴을 유지하고 고정 휴무만 제외합니다. 추가 인원은 위에서 선택한 근무 패턴을 적용합니다.</p>
                            </div>
                            <div className="space-y-2">
                                {visibleScenarios.map((scenario) => {
                                    const total = currentBackups.length + scenario.extraBackupCount;
                                    const isMinimum = scenario.extraBackupCount === minimumExtraBackups;
                                    return (
                                        <div key={scenario.extraBackupCount} className={'flex items-center justify-between gap-3 rounded-xl border p-3 ' + (isMinimum ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white')}>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-black">{scenario.extraBackupCount === 0 ? '추가 채용 없음' : '백업 +' + scenario.extraBackupCount + '명'}</span>
                                                    {isMinimum && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-800">최소 충족</span>}
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500">총 백업 {total}명 · 부족 {scenario.shortageCount}회 / 2주</p>
                                            </div>
                                            <span className={'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-black ' + (scenario.isFeasible ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700')}>
                                                {scenario.isFeasible ? '충족 가능' : '부족'}
                                            </span>
                                        </div>
                                    );
                                })}
                                {minimumExtraBackups == null && (
                                    <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-800">
                                        추가 백업을 최대 {analysis.maxExtraBackups}명까지 가정해도 현재 조건으로는 전체 노선을 커버하지 못했습니다. 특정 백업의 담당 제한이나 근무 패턴을 확인해야 합니다.
                                    </p>
                                )}
                            </div>
                            <p className="mt-3 text-[11px] leading-5 text-slate-400">
                                결과는 현재 자동 배정 알고리즘으로 2주를 시뮬레이션한 예상치입니다. 전역 최적해를 증명하는 계산은 아니며, 실제 근무표를 변경하지 않습니다.
                            </p>
                        </section>
                    </>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-black">고정 직원 근무 패턴</h2>
                            <p className="mt-0.5 text-xs text-slate-500">이름 · 노선 · 주간/격주 근무 횟수</p>
                        </div>
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{employeeRows.length}명</span>
                    </div>
                    <label className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                        <Search size={16} className="text-slate-400" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름 또는 노선 검색" className="w-full min-w-0 bg-transparent text-sm outline-none" />
                    </label>
                    {filteredEmployeeRows.length > 0 ? (
                        <div className="space-y-1.5">
                            {filteredEmployeeRows.map((employee) => (
                                <div key={employee.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xs font-black text-indigo-700">
                                        {String(employee.name || '?').slice(0, 1)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="break-keep text-sm font-black text-slate-800">{employee.name}</span>
                                            {employee.isCounted
                                                ? <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">계산 포함</span>
                                                : <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">노선 미배정</span>}
                                        </div>
                                        <p className="mt-0.5 break-words text-xs text-slate-600">{employee.routeLabel}</p>
                                    </div>
                                    <span className="shrink-0 rounded-lg bg-white px-2 py-1.5 text-[11px] font-black text-slate-700">{getPatternLabel(employee.pattern || employee.work_pattern)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">선택한 조건에 해당하는 직원이 없습니다.</p>
                    )}
                </section>

                <p className="px-1 text-[11px] leading-5 text-slate-400">
                    분석은 선택한 팀의 활성 고정 직원에게 노선이 배정된 경우를 기준으로 계산합니다. 노선 미배정 직원은 목록에 표시하지만 수요 계산에서는 제외합니다. 기존 직원의 정보나 고정 휴무 설정은 수정하지 않습니다.
                </p>
            </main>
        </div>
    );
}
