// src/admin/EmployeeManager.jsx
import React, { useMemo, useState } from 'react';
import { Users, Truck, ArrowLeft, UserPlus, X, Copy, CheckCircle2, Plus, Search, ChevronDown } from 'lucide-react';
import BiweeklyPairManager from './BiweeklyPairManager';
import RegionTeamDropdown from './RegionTeamDropdown';
import { useAuth } from '../contexts/AuthContext';
import { useAdminData } from './contexts/DataContext';

const DEFAULT_PATTERN = '주 5일';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const getTeamRegion = (team) => team?.region || '기본 지역';
const getTeamShift = (team) => {
    const shift = String(team?.shift || team?.workShift || team?.work_shift || '').toLowerCase();
    return shift === 'night' || shift === '야간' ? '야간' : '주간';
};
const getTeamLabel = (team) => team ? [getTeamRegion(team), getTeamShift(team), team.name].join(' · ') : '미배정';

export default function EmployeeManager({ onBack }) {
    const { profile } = useAuth();
    const {
        employees = [],
        teams = [],
        routes = [],
        setEmployees,
        setRoutes,
        updateEmployee
    } = useAdminData();

    const [employeeTypeFilter, setEmployeeTypeFilter] = useState('all');
    const [teamFilter, setTeamFilter] = useState('all');
    const [assignmentFilter, setAssignmentFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [workDays, setWorkDays] = useState(5);
    const [isBiweekly, setIsBiweekly] = useState(false);
    const [hasFixedOffDays, setHasFixedOffDays] = useState(false);
    const [fixedOffWeekdays, setFixedOffWeekdays] = useState([]);
    const [fixedOffWeekdaysShortWeek, setFixedOffWeekdaysShortWeek] = useState([]);
    const [fixedOffWeekdaysLongWeek, setFixedOffWeekdaysLongWeek] = useState([]);
    const [editType, setEditType] = useState('base');
    const [editTeamId, setEditTeamId] = useState(teams[0]?.id || '');
    const [editRouteIds, setEditRouteIds] = useState([]);
    const [isRouteListOpen, setIsRouteListOpen] = useState(false);
    const [routeListFilter, setRouteListFilter] = useState('all');
    const [isBiweeklyPairManagerOpen, setIsBiweeklyPairManagerOpen] = useState(false);

    const baseEmployees = employees.filter((employee) => employee.type !== 'sub' && employee.employee_type !== 'substitute');
    const backupEmployees = employees.filter((employee) => employee.type === 'sub' || employee.employee_type === 'substitute');
    const employeeRows = useMemo(() => employees.map((employee) => {
        const type = employee.type === 'sub' || employee.employee_type === 'substitute' ? 'sub' : 'base';
        const assignedRoutes = routes.filter((route) => String(route.assigned_emp_id) === String(employee.id));
        return {
            employee,
            type,
            assignedRoutes,
            teamName: getTeamLabel(teams.find((team) => String(team.id) === String(employee.team_id))),
            isInactive: employee.active === false
        };
    }), [employees, routes, teams]);
    const filteredEmployeeRows = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return employeeRows.filter(({ employee, type, assignedRoutes, isInactive, teamName }) => {
            const isUnassignedBase = type === 'base' && assignedRoutes.length === 0;
            const matchesSearch = !keyword || [employee.name, teamName, ...assignedRoutes.map((route) => route.name)]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword));
            return matchesSearch &&
                (employeeTypeFilter === 'all' || employeeTypeFilter === type) &&
                (teamFilter === 'all' || String(teamFilter) === String(employee.team_id)) &&
                (assignmentFilter === 'all' ||
                    (assignmentFilter === 'unassigned' && isUnassignedBase) ||
                    (assignmentFilter === 'assigned' && type === 'base' && assignedRoutes.length > 0) ||
                    (assignmentFilter === 'backup' && type === 'sub') ||
                    (assignmentFilter === 'inactive' && isInactive));
        });
    }, [employeeRows, search, employeeTypeFilter, teamFilter, assignmentFilter]);
    const unassignedBaseCount = employeeRows.filter(({ type, assignedRoutes, isInactive }) => type === 'base' && !isInactive && assignedRoutes.length === 0).length;
    const editingNewEmployee = Boolean(selectedEmployee && !selectedEmployee.id);
    const unpairedBiweeklyCount = employees.filter((employee) =>
        employee.active !== false &&
        String(employee.pattern || employee.work_pattern || '').includes('격주') &&
        !employee.biweeklyPairId
    ).length;

    const teamRoutes = useMemo(() => routes.filter((route) =>
        String(route.team_id) === String(editTeamId)
    ), [routes, editTeamId]);
    const selectedTeamRoutes = useMemo(() => teamRoutes.filter((route) =>
        editRouteIds.includes(String(route.id))
    ), [teamRoutes, editRouteIds]);
    const teamsByRegion = useMemo(() => teams.reduce((groups, team) => {
        const region = getTeamRegion(team);
        groups[region] = groups[region] || [];
        groups[region].push(team);
        return groups;
    }, {}), [teams]);

    const handleOpenModal = (employee) => {
        const safeEmployee = {
            ...employee,
            pattern: employee.pattern || employee.work_pattern || DEFAULT_PATTERN,
            type: employee.type || (employee.employee_type === 'substitute' ? 'sub' : 'base')
        };
        setSelectedEmployee(safeEmployee);
        setIsBiweekly(String(safeEmployee.pattern).includes('격주'));
        const normalizeWeekdays = (days) => Array.isArray(days)
            ? [...new Set(days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b)
            : [];
        const savedFixedOffWeekdays = normalizeWeekdays(safeEmployee.fixedOffWeekdays);
        const savedFixedOffByWeek = safeEmployee.fixedOffWeekdaysByWeek || {};
        setFixedOffWeekdays(savedFixedOffWeekdays);
        setFixedOffWeekdaysShortWeek(normalizeWeekdays(
            Array.isArray(savedFixedOffByWeek.shortWeek) ? savedFixedOffByWeek.shortWeek : savedFixedOffWeekdays
        ));
        setFixedOffWeekdaysLongWeek(normalizeWeekdays(
            Array.isArray(savedFixedOffByWeek.longWeek) ? savedFixedOffByWeek.longWeek : savedFixedOffWeekdays
        ));
        setHasFixedOffDays(Boolean(safeEmployee.hasFixedOffDays || savedFixedOffWeekdays.length > 0 ||
            normalizeWeekdays(savedFixedOffByWeek.shortWeek).length > 0 ||
            normalizeWeekdays(savedFixedOffByWeek.longWeek).length > 0));
        const match = String(safeEmployee.pattern).match(/[1-6]/);
        setWorkDays(match ? Number(match[0]) : 5);
        setEditType(safeEmployee.type);
        setEditTeamId(safeEmployee.team_id || teams[0]?.id || '');
        const assignedRouteIds = routes
            .filter((route) =>
                String(route.assigned_emp_id) === String(safeEmployee.id) &&
                String(route.team_id) === String(safeEmployee.team_id)
            )
            .map((route) => String(route.id));
        setEditRouteIds(assignedRouteIds);
        setIsRouteListOpen(false);
        setRouteListFilter('all');
    };

    const toggleBiweeklyPattern = () => {
        if (!isBiweekly) {
            // 기존 매주 고정 휴무가 있으면 두 주 모두의 기본값으로 가져옵니다.
            if (fixedOffWeekdays.length > 0) {
                setFixedOffWeekdaysShortWeek((previous) => previous.length ? previous : [...fixedOffWeekdays]);
                setFixedOffWeekdaysLongWeek((previous) => previous.length ? previous : [...fixedOffWeekdays]);
            }
            setIsBiweekly(true);
        } else {
            // 격주를 끄면 두 주에 공통으로 지정된 요일만 매주 고정 휴무로 유지합니다.
            setFixedOffWeekdays(fixedOffWeekdaysShortWeek.filter((day) => fixedOffWeekdaysLongWeek.includes(day)));
            setIsBiweekly(false);
        }
    };

    const handleOpenAdd = () => {
        const defaultType = employeeTypeFilter === 'sub' ? 'sub' : 'base';
        setSelectedEmployee({
            id: null,
            name: '',
            type: defaultType,
            team_id: teams[0]?.id || '',
            pattern: DEFAULT_PATTERN,
            target: '',
            active: true
        });
        setWorkDays(5);
        setIsBiweekly(false);
        setHasFixedOffDays(false);
        setFixedOffWeekdays([]);
        setFixedOffWeekdaysShortWeek([]);
        setFixedOffWeekdaysLongWeek([]);
        setEditType(defaultType);
        setEditTeamId(teams[0]?.id || '');
        setEditRouteIds([]);
        setIsRouteListOpen(false);
        setRouteListFilter('all');
    };

    const handleSaveEmployee = (event) => {
        event.preventDefault();
        if (!selectedEmployee) return;
        const formData = new FormData(event.currentTarget);
        const name = String(formData.get('name') || '').trim();
        if (!name) {
            window.alert('직원 이름을 입력해주세요.');
            return;
        }
        const hasAnyFixedWeekday = isBiweekly
            ? fixedOffWeekdaysShortWeek.length > 0 || fixedOffWeekdaysLongWeek.length > 0
            : fixedOffWeekdays.length > 0;
        if (hasFixedOffDays && !hasAnyFixedWeekday) {
            window.alert('고정 휴무를 사용하려면 쉬는 요일을 하나 이상 선택해주세요.');
            return;
        }

        const newTeamId = String(formData.get('team_id') || '');
        const newType = String(formData.get('type') || 'base');
        const routeIds = newType === 'base' ? [...new Set(editRouteIds.map(String))] : [];
        const employeeId = selectedEmployee.id || 'EMP_' + Date.now();

        const previousPattern = String(selectedEmployee.pattern || selectedEmployee.work_pattern || '');
        // 짝은 근무 일수가 아니라 교대 순서를 연결하므로, 격주를 유지하면 일수가 바뀌어도 짝을 유지합니다.
        const preserveBiweeklyPair = Boolean(
            !editingNewEmployee &&
            selectedEmployee.biweeklyPairId &&
            isBiweekly &&
            previousPattern.includes('격주')
        );
        const pairToClear = !editingNewEmployee && selectedEmployee.biweeklyPairId && !preserveBiweeklyPair
            ? selectedEmployee.biweeklyPairId
            : null;
        const finalPattern = (isBiweekly ? '격주 ' : '주 ') + workDays + '일';
        const updatedData = {
            ...selectedEmployee,
            id: employeeId,
            name,
            team_id: newTeamId,
            type: newType,
            pattern: finalPattern,
            biweeklyPairId: preserveBiweeklyPair ? selectedEmployee.biweeklyPairId : null,
            biweeklyWeekOffset: preserveBiweeklyPair ? (Number(selectedEmployee.biweeklyWeekOffset) === 1 ? 1 : 0) : 0,
            hasFixedOffDays,
            fixedOffWeekdays: hasFixedOffDays && !isBiweekly ? [...fixedOffWeekdays].sort((a, b) => a - b) : [],
            fixedOffWeekdaysByWeek: hasFixedOffDays && isBiweekly ? {
                shortWeek: [...fixedOffWeekdaysShortWeek].sort((a, b) => a - b),
                longWeek: [...fixedOffWeekdaysLongWeek].sort((a, b) => a - b)
            } : null,
            active: selectedEmployee.active !== false,
            vehicle_number: String(formData.get('vehicle_number') || '').trim(),
            target: newType === 'sub' ? String(formData.get('target') || '').trim() : ''
        };

        const selectedRoutesForTeam = routes.filter((route) =>
            routeIds.includes(String(route.id)) &&
            String(route.team_id) === String(newTeamId)
        );
        const conflictingRoutes = selectedRoutesForTeam.filter((route) =>
            route.assigned_emp_id != null &&
            route.assigned_emp_id !== '' &&
            String(route.assigned_emp_id) !== String(employeeId)
        );
        if (conflictingRoutes.length > 0) {
            const conflictDetails = conflictingRoutes.map((route) => {
                const currentDriver = employees.find((employee) =>
                    String(employee.id) === String(route.assigned_emp_id)
                );
                return route.name + ' (' + (currentDriver?.name || '다른 직원') + ')';
            }).join(', ');
            if (!window.confirm(conflictDetails + ' 노선은 다른 직원에게 배정되어 있습니다. 선택한 노선을 이 직원에게 옮길까요?')) return;
        }

        if (editingNewEmployee) {
            setEmployees((previous) => [...previous, updatedData]);
        } else {
            updateEmployee(updatedData);
            if (pairToClear) {
                setEmployees((previous) => previous.map((employee) =>
                    String(employee.biweeklyPairId) === String(pairToClear)
                        ? { ...employee, biweeklyPairId: null, biweeklyWeekOffset: 0 }
                        : employee
                ));
            }
        }

        // 저장 시 이 직원의 노선 배정을 선택 목록과 일치시킵니다.
        // 체크를 해제한 노선은 미배정으로 되돌리고, 다른 직원의 노선은 확인 후 넘깁니다.
        const selectedRouteIdSet = new Set(selectedRoutesForTeam.map((route) => String(route.id)));
        const normalizedEmployeeId = String(employeeId).trim() !== '' && Number.isFinite(Number(employeeId))
            ? Number(employeeId)
            : employeeId;
        setRoutes((previous) => previous.map((route) => {
            const isSelectedForThisTeam =
                newType === 'base' &&
                selectedRouteIdSet.has(String(route.id)) &&
                String(route.team_id) === String(newTeamId);

            if (isSelectedForThisTeam) {
                return { ...route, assigned_emp_id: normalizedEmployeeId };
            }

            const assignedToThisEmployee =
                route.assigned_emp_id != null &&
                String(route.assigned_emp_id) === String(employeeId);
            const belongsToEditedTeam =
                String(route.team_id) === String(newTeamId) ||
                String(route.team_id) === String(selectedEmployee.team_id);

            if (assignedToThisEmployee && (newType === 'sub' || belongsToEditedTeam)) {
                return { ...route, assigned_emp_id: null };
            }
            return route;
        }));

        setSelectedEmployee(null);
    };

    const copyInviteCode = () => {
        const code = profile?.invite_code;
        if (!code) {
            window.alert('등록된 초대 코드가 없습니다.');
            return;
        }
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(code)
                .then(() => window.alert('초대 코드를 복사했습니다.'))
                .catch(() => window.prompt('초대 코드를 복사하세요.', code));
        } else {
            window.prompt('초대 코드를 복사하세요.', code);
        }
    };

    if (isBiweeklyPairManagerOpen) {
        return <BiweeklyPairManager onBack={() => setIsBiweeklyPairManagerOpen(false)} />;
    }

    return (
        <div className="admin-safe-top flex min-h-screen w-full flex-col bg-gray-50 font-sans text-slate-800">
            <header className="admin-sticky-safe-header sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-3 shadow-sm sm:px-4">
                <div className="flex min-w-0 items-center gap-2">
                    <button onClick={onBack} className="rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="관리자 화면으로 돌아가기">
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="truncate text-lg font-black sm:text-xl">직원 관리</h1>
                </div>
                <button onClick={() => setIsInviteModalOpen(true)} className="shrink-0 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">
                    초대 코드
                </button>
            </header>

            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 p-3 pb-24 sm:p-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-black text-slate-800">직원 현황</h2>
                            <p className="mt-0.5 text-xs text-slate-500">팀·직군·노선 배정 상태를 함께 확인하세요.</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700">{employees.length}명</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-slate-50 p-2"><p className="text-lg font-black">{baseEmployees.length}</p><p className="text-[10px] font-bold text-slate-500">고정 직원</p></div>
                        <div className="rounded-xl bg-amber-50 p-2"><p className="text-lg font-black text-amber-700">{backupEmployees.length}</p><p className="text-[10px] font-bold text-amber-700">백업 직원</p></div>
                        <div className="rounded-xl bg-rose-50 p-2"><p className="text-lg font-black text-rose-700">{unassignedBaseCount}</p><p className="text-[10px] font-bold text-rose-700">노선 배정 필요</p></div>
                    </div>
                </section>

                <button
                    type="button"
                    onClick={() => setIsBiweeklyPairManagerOpen(true)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-left transition-colors hover:border-indigo-300 sm:p-4"
                >
                    <span className="flex min-w-0 items-center gap-3">
                        <span className="rounded-xl bg-indigo-600 p-3 text-white"><Users size={22} /></span>
                        <span className="min-w-0">
                            <span className="block text-sm font-black text-indigo-950">격주 짝 관리</span>
                            <span className="mt-1 block text-xs leading-5 text-indigo-700">짝을 맺으면 두 직원의 격주 근무 주기가 서로 반대로 반복됩니다.</span>
                        </span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-white px-2 py-1.5 text-[11px] font-black text-indigo-700">
                        {unpairedBiweeklyCount > 0 ? '미설정 ' + unpairedBiweeklyCount + '명' : '관리하기'}
                    </span>
                </button>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <Search size={16} className="shrink-0 text-slate-400" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="직원·팀·노선 검색" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
                    </label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                        <RegionTeamDropdown
                            teams={teams}
                            value={teamFilter}
                            onChange={setTeamFilter}
                            allLabel="모든 팀"
                            className="min-w-0"
                            buttonClassName="px-2 py-2"
                        />
                        <select value={employeeTypeFilter} onChange={(event) => setEmployeeTypeFilter(event.target.value)} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold outline-none">
                            <option value="all">전체 직군</option><option value="base">고정</option><option value="sub">백업</option>
                        </select>
                        <select value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold outline-none">
                            <option value="all">전체 상태</option><option value="unassigned">배정 필요</option><option value="assigned">배정 완료</option><option value="backup">백업</option><option value="inactive">비활성</option>
                        </select>
                    </div>
                </section>

                <div className="flex items-center justify-between gap-3 px-1">
                    <p className="text-xs font-bold text-slate-500">검색 결과 {filteredEmployeeRows.length}명 · 직원을 누르면 상세 설정을 엽니다.</p>
                </div>

                {filteredEmployeeRows.map(({ employee, type, assignedRoutes, teamName, isInactive }) => {
                    const isUnassignedBase = type === 'base' && assignedRoutes.length === 0;
                    const routeNames = assignedRoutes.length > 0 ? assignedRoutes.map((route) => route.name).join(', ') : '미배정';
                    return (
                        <button key={employee.id} type="button" onClick={() => handleOpenModal(employee)}
                            className={'flex w-full items-center justify-between gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition-colors hover:border-indigo-300 sm:p-4 ' + (isUnassignedBase && !isInactive ? 'border-rose-200' : 'border-gray-200')}>
                            <span className="flex min-w-0 items-start gap-2">
                                <span className={'mt-0.5 rounded-lg p-2 ' + (type === 'base' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600')}>
                                    <Users size={17} />
                                </span>
                                <span className="min-w-0">
                                    <span className="flex flex-wrap items-center gap-1 font-bold text-slate-800">
                                        {employee.name}
                                        <span className="text-xs font-medium text-slate-400">· {teamName}</span>
                                        {String(employee.id) === String(profile?.id) && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-black text-green-700">나</span>}
                                    </span>
                                    <span className="mt-1 block truncate text-xs text-slate-500">
                                        {type === 'base' ? <><Truck size={12} className="mr-1 inline" />노선: {routeNames}</> : '백업 가능 범위: ' + (employee.target || '미설정')}
                                    </span>
                                </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                                <span className={'rounded-lg px-2 py-1 text-[10px] font-black ' + (isInactive ? 'bg-slate-100 text-slate-500' : isUnassignedBase ? 'bg-rose-50 text-rose-700' : type === 'sub' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>{isInactive ? '비활성' : isUnassignedBase ? '배정 필요' : type === 'sub' ? '백업' : '배정 완료'}</span>
                                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{employee.pattern || employee.work_pattern || DEFAULT_PATTERN}</span>
                            </span>
                        </button>
                    );
                })}

                {filteredEmployeeRows.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                        조건에 맞는 직원이 없습니다. 필터를 바꾸거나 직원을 추가하세요.
                    </div>
                )}
            </main>

            <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 p-3 backdrop-blur">
                <div className="mx-auto flex w-full max-w-5xl gap-2">
                    <button onClick={() => setIsInviteModalOpen(true)} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-slate-600">
                        팀원 초대
                    </button>
                    <button onClick={handleOpenAdd} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white hover:bg-indigo-700">
                        <UserPlus size={18} /> 직원 추가
                    </button>
                </div>
            </div>

            {isInviteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
                    <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b p-4">
                            <h2 className="font-black">팀원 초대 코드</h2>
                            <button onClick={() => setIsInviteModalOpen(false)} className="rounded-lg p-1 text-gray-400"><X size={22} /></button>
                        </div>
                        <div className="space-y-4 p-4">
                            <p className="text-sm text-gray-500">앱에 가입할 팀원에게 아래 코드를 전달하세요.</p>
                            <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-100 p-3">
                                <span className="break-all text-lg font-black tracking-widest">{profile?.invite_code || '초대코드 없음'}</span>
                                <button onClick={copyInviteCode} className="shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-600"><Copy size={18} /></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/50 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-3">
                    <div className="flex h-[calc(100dvh-32px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between gap-3 border-b p-4">
                            <h2 className="flex items-center gap-2 font-black">
                                {editingNewEmployee ? <Plus size={18} /> : <Users size={18} />}
                                {editingNewEmployee ? '새 직원 추가' : selectedEmployee.name + ' 설정'}
                            </h2>
                            <button onClick={() => setSelectedEmployee(null)} className="rounded-lg p-1 text-gray-400"><X size={22} /></button>
                        </div>

                        <form onSubmit={handleSaveEmployee} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <div className="min-w-0">
                                    <label className="mb-1 block text-xs font-black text-gray-600">이름</label>
                                    <input name="name" required defaultValue={selectedEmployee.name || ''} placeholder="이름" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-3 text-sm font-semibold outline-none focus:border-indigo-500" />
                                </div>
                                <div>
                                    <label className="mb-1 block truncate text-xs font-black text-gray-600">소속 팀</label>
                                    <RegionTeamDropdown
                                        name="team_id"
                                        teams={teams}
                                        value={editTeamId}
                                        includeAll={false}
                                        size="comfortable"
                                        buttonClassName="rounded-xl bg-gray-50 focus:border-indigo-500"
                                        onChange={(value) => {
                                            setEditTeamId(value);
                                            setEditRouteIds([]);
                                            setIsRouteListOpen(false);
                                            setRouteListFilter('all');
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-black text-gray-600">구분</label>
                                    <select name="type" value={editType} onChange={(event) => setEditType(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-3 text-sm font-semibold outline-none focus:border-indigo-500">
                                        <option value="base">고정</option>
                                        <option value="sub">백업</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-black text-gray-600">차량번호</label>
                                <input name="vehicle_number" defaultValue={selectedEmployee.vehicle_number || selectedEmployee.vehicleNumber || ''} placeholder="예: 12가 3456" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold outline-none focus:border-indigo-500" />
                            </div>

                            {editType === 'base' && (
                                <div>
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <label className="block text-xs font-black text-gray-600">담당 노선 배정</label>
                                        <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">{selectedTeamRoutes.length}개 선택</span>
                                    </div>
                                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                                        {selectedTeamRoutes.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedTeamRoutes.map((route) => (
                                                    <span key={route.id} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-xs font-bold text-indigo-800">
                                                        <Truck size={12} className="shrink-0 text-indigo-500" />
                                                        <span className="break-all">{route.name}</span>
                                                        <button type="button" onClick={() => setEditRouteIds((previous) => previous.filter((id) => String(id) !== String(route.id)))} className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-700" aria-label={route.name + ' 선택 해제'}><X size={13} /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="py-1 text-xs text-slate-500">선택된 노선이 없습니다.</p>
                                        )}
                                        <button type="button" onClick={() => setIsRouteListOpen((value) => !value)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50">
                                            <Plus size={16} /> 노선 {isRouteListOpen ? '목록 닫기' : '선택 / 추가'}
                                            <ChevronDown size={17} className={'transition-transform ' + (isRouteListOpen ? 'rotate-180' : '')} />
                                        </button>
                                    </div>
                                    {isRouteListOpen && (
                                        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                                            <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50 p-1">
                                                {[['all', '전체'], ['assigned', '배정됨'], ['unassigned', '미배정']].map(([value, label]) => <button key={value} type="button" onClick={() => setRouteListFilter(value)} className={'rounded-lg px-2 py-2 text-xs font-bold ' + (routeListFilter === value ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500')}>{label}</button>)}
                                            </div>
                                            <div className="max-h-48 overflow-y-auto p-2">
                                                <button type="button" onClick={() => setEditRouteIds([])} className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50">선택 모두 해제</button>
                                                {teamRoutes.filter((route) => routeListFilter === 'all' || (routeListFilter === 'assigned' ? route.assigned_emp_id != null && route.assigned_emp_id !== '' : route.assigned_emp_id == null || route.assigned_emp_id === '')).map((route) => {
                                                    const selected = editRouteIds.includes(String(route.id));
                                                    const assignedEmployee = employees.find((employee) => String(employee.id) === String(route.assigned_emp_id));
                                                    return (
                                                        <button key={route.id} type="button" onClick={() => setEditRouteIds((previous) => selected ? previous.filter((id) => String(id) !== String(route.id)) : [...previous, String(route.id)])}
                                                            className={'mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold ' + (selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50')}>
                                                            <span className="flex min-w-0 items-center gap-2">
                                                                <span className={'flex h-5 w-5 shrink-0 items-center justify-center rounded border ' + (selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white')}>
                                                                    {selected && <CheckCircle2 size={14} />}
                                                                </span>
                                                                <span className="truncate">{route.name}</span>
                                                            </span>
                                                            <span className={'shrink-0 text-[10px] ' + (!assignedEmployee ? 'text-emerald-600' : String(route.assigned_emp_id) === String(selectedEmployee?.id) ? 'text-indigo-600' : 'text-slate-400')}>
                                                                {!assignedEmployee ? '미배정' : String(route.assigned_emp_id) === String(selectedEmployee?.id) ? '현재 담당' : '담당: ' + assignedEmployee.name}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                                {teamRoutes.filter((route) => routeListFilter === 'all' || (routeListFilter === 'assigned' ? route.assigned_emp_id != null && route.assigned_emp_id !== '' : route.assigned_emp_id == null || route.assigned_emp_id === '')).length === 0 && (
                                                    <p className="px-3 py-5 text-center text-xs text-slate-500">조건에 맞는 노선이 없습니다.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {teamRoutes.length === 0 && <p className="mt-2 text-xs text-amber-700">선택한 팀에 등록된 노선이 없습니다.</p>}
                                    <p className="mt-2 text-[11px] leading-4 text-slate-500">같은 팀의 노선을 여러 개 선택할 수 있습니다. 다른 직원이 담당 중인 노선을 선택하면 저장할 때 확인합니다.</p>
                                </div>
                            )}

                            {editType === 'sub' && (
                                <div>
                                    <label className="mb-1 block text-xs font-black text-amber-700">백업 가능 범위 (선택)</label>
                                    <input name="target" defaultValue={selectedEmployee.target || ''} placeholder="예: 전지역 또는 206a, 206b" className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm outline-none focus:border-amber-500" />
                                </div>
                            )}

                            <div>
                                <label className="mb-2 block text-xs font-black text-gray-600">주간 근무 패턴</label>
                                <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                                    {[1, 2, 3, 4, 5, 6].map((day) => (
                                        <button type="button" key={day} onClick={() => setWorkDays(day)} className={'h-10 flex-1 rounded-lg text-sm font-black ' + (workDays === day ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500')}>
                                            {day}일
                                        </button>
                                    ))}
                                </div>
                                <button type="button" onClick={toggleBiweeklyPattern} className={'mt-2 w-full rounded-xl border px-3 py-2.5 text-sm font-bold ' + (isBiweekly ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500')}>
                                    {isBiweekly ? '✓ 격주 패턴 적용' : '격주 패턴 적용'}
                                </button>
                                <p className="mt-2 text-xs text-gray-500">적용 패턴: <strong>{isBiweekly ? '격주 ' : '주 '}{workDays}일</strong></p>
                                {isBiweekly && workDays === 6 && (
                                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
                                        격주 6일은 한 주 6일 근무, 다른 주는 7일 근무 기준(휴무 0일)이 됩니다. 7일 연속 근무는 허용되지 않으므로 고정 휴무를 지정하거나 근무 패턴을 조정하세요. 자동 근무표 생성 시에도 경고가 표시됩니다.
                                    </div>
                                )}
                            </div>

                            <section className="rounded-xl border border-slate-200 bg-white p-3">
                                <label className="flex cursor-pointer items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        checked={hasFixedOffDays}
                                        onChange={(event) => setHasFixedOffDays(event.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-black text-slate-700">고정 휴무가 있어요</span>
                                </label>
                                {hasFixedOffDays && (
                                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                                        <p className="text-xs leading-5 text-slate-500">
                                            {isBiweekly
                                                ? '격주 두 주의 쉬는 요일을 각각 선택하세요. 선택한 요일은 자동 근무표에서도 해당 주에 고정 휴무로 적용됩니다.'
                                                : '매주 쉬는 요일을 선택하세요. 선택한 요일은 자동 근무표에서도 휴무로 고정됩니다.'}
                                        </p>
                                        {isBiweekly ? (
                                            <>
                                                {[
                                                    { key: 'shortWeek', title: workDays + '일 근무 주', days: fixedOffWeekdaysShortWeek, setter: setFixedOffWeekdaysShortWeek },
                                                    { key: 'longWeek', title: (workDays + 1) + '일 근무 주', days: fixedOffWeekdaysLongWeek, setter: setFixedOffWeekdaysLongWeek }
                                                ].map((week) => (
                                                    <div key={week.key} className="rounded-lg border border-slate-200 bg-white p-2.5">
                                                        <div className="mb-2 flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-slate-700">{week.title}</span>
                                                            <span className="text-[10px] font-bold text-indigo-600">{week.days.length ? WEEKDAYS.filter((_, dayIndex) => week.days.includes(dayIndex)).join(' · ') + ' 휴무' : '고정 요일 없음'}</span>
                                                        </div>
                                                        <div className="grid grid-cols-7 gap-1">
                                                            {WEEKDAYS.map((day, weekdayIndex) => {
                                                                const isSelected = week.days.includes(weekdayIndex);
                                                                return (
                                                                    <button
                                                                        key={day}
                                                                        type="button"
                                                                        aria-pressed={isSelected}
                                                                        onClick={() => {
                                                                            if (isSelected) {
                                                                                week.setter((previous) => previous.filter((value) => value !== weekdayIndex));
                                                                                return;
                                                                            }

                                                                            const weekWorkDays = week.key === 'shortWeek' ? workDays : workDays + 1;
                                                                            const maxFixedOffDays = Math.max(0, 7 - weekWorkDays);
                                                                            if (week.days.length >= maxFixedOffDays) {
                                                                                window.alert(
                                                                                    maxFixedOffDays === 0
                                                                                        ? week.title + '는 7일 근무 주라 휴무가 0일입니다. 고정 휴무를 선택할 수 없습니다.'
                                                                                        : week.title + '는 고정 휴무를 최대 ' + maxFixedOffDays + '일까지만 선택할 수 있습니다.'
                                                                                );
                                                                                return;
                                                                            }

                                                                            week.setter((previous) => [...previous, weekdayIndex].sort((a, b) => a - b));
                                                                        }}
                                                                        className={'min-w-0 rounded-lg border px-1 py-2.5 text-sm font-black transition-colors ' + (
                                                                            isSelected
                                                                                ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                                                                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300'
                                                                        )}
                                                                    >
                                                                        {day}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-7 gap-1">
                                                    {WEEKDAYS.map((day, weekdayIndex) => {
                                                        const isSelected = fixedOffWeekdays.includes(weekdayIndex);
                                                        return (
                                                            <button
                                                                key={day}
                                                                type="button"
                                                                aria-pressed={isSelected}
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        setFixedOffWeekdays((previous) => previous.filter((value) => value !== weekdayIndex));
                                                                        return;
                                                                    }

                                                                    const maxFixedOffDays = Math.max(0, 7 - workDays);
                                                                    if (fixedOffWeekdays.length >= maxFixedOffDays) {
                                                                        window.alert('주 ' + workDays + '일 근무 패턴에서는 고정 휴무를 최대 ' + maxFixedOffDays + '일까지만 선택할 수 있습니다.');
                                                                        return;
                                                                    }

                                                                    setFixedOffWeekdays((previous) => [...previous, weekdayIndex].sort((a, b) => a - b));
                                                                }}
                                                                className={'min-w-0 rounded-lg border px-1 py-2.5 text-sm font-black transition-colors ' + (
                                                                    isSelected
                                                                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                                                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300'
                                                                )}
                                                            >
                                                                {day}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-xs font-bold text-indigo-700">
                                                    {fixedOffWeekdays.length > 0
                                                        ? WEEKDAYS.filter((_, dayIndex) => fixedOffWeekdays.includes(dayIndex)).join(' · ') + '요일 고정 휴무'
                                                        : '쉬는 요일을 선택해주세요.'}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </section>

                            <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 font-black text-white hover:bg-indigo-700">
                                <CheckCircle2 size={19} /> {editingNewEmployee ? '직원 등록' : '변경 사항 저장'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
