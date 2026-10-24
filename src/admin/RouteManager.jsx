// src/admin/RouteManager.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Truck, Plus, Trash2, X, CheckCircle2, ChevronDown, ChevronUp, UserRound, Search } from 'lucide-react';
import { useAdminData } from './contexts/DataContext';
import RegionTeamDropdown from './RegionTeamDropdown';

const getTeamShift = (team) => {
    const shift = String(team?.shift || team?.workShift || team?.work_shift || '').toLowerCase();
    return shift === 'night' || shift === '야간' ? 'night' : 'day';
};
const getShiftLabel = (shift) => shift === 'night' ? '야간' : '주간';

export default function RouteManager({ onBack }) {
    const { routes = [], setRoutes, employees = [], assignRoute, teams = [] } = useAdminData();
    const [selectedTeam, setSelectedTeam] = useState(teams[0]?.id ?? '');
    const [selectedShift, setSelectedShift] = useState(() => getTeamShift(teams[0]));
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [expandedRouteId, setExpandedRouteId] = useState(null);
    const [notice, setNotice] = useState('');
    const [search, setSearch] = useState('');

    const shiftTeams = useMemo(() => teams.filter((team) => getTeamShift(team) === selectedShift), [teams, selectedShift]);

    useEffect(() => {
        if (shiftTeams.some((team) => String(team.id) === String(selectedTeam))) return;
        setSelectedTeam(shiftTeams[0]?.id ?? '');
        setExpandedRouteId(null);
        setSearch('');
    }, [shiftTeams, selectedTeam]);

    const handleShiftChange = (nextShift) => {
        setSelectedShift(nextShift);
        const nextTeams = teams.filter((team) => getTeamShift(team) === nextShift);
        setSelectedTeam(nextTeams[0]?.id ?? '');
        setExpandedRouteId(null);
        setSearch('');
    };

    const filteredRoutes = useMemo(
        () => routes.filter((route) => String(route.team_id) === String(selectedTeam)),
        [routes, selectedTeam]
    );
    const teamEmployees = useMemo(
        () => employees.filter((employee) =>
            employee.active !== false &&
            String(employee.team_id) === String(selectedTeam) &&
            employee.type !== 'sub' &&
            employee.employee_type !== 'substitute'
        ),
        [employees, selectedTeam]
    );
    const visibleRoutes = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return filteredRoutes;
        return filteredRoutes.filter((route) => {
            const assignedEmployee = employees.find((employee) => String(employee.id) === String(route.assigned_emp_id));
            return [route.name, route.description, assignedEmployee?.name]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword));
        });
    }, [filteredRoutes, employees, search]);
    const assignedRouteCount = filteredRoutes.filter((route) => route.assigned_emp_id != null && route.assigned_emp_id !== '').length;

    const handleAssign = (routeId, employeeId) => {
        const targetRoute = routes.find((route) => String(route.id) === String(routeId));
        if (!targetRoute) return;
        const finalEmpId = employeeId === '' ? null : employeeId;
        if (finalEmpId !== null) {
            const assignedElsewhere = routes.filter((route) =>
                String(route.id) !== String(routeId) &&
                String(route.assigned_emp_id) === String(finalEmpId)
            );
            if (assignedElsewhere.length > 0) {
                const routeNames = assignedElsewhere.map((route) => route.name).join(', ');
                if (!window.confirm('이 직원은 이미 ' + routeNames + ' 노선에 배정되어 있습니다. 추가로 배정할까요?')) return;
            }
        }
        assignRoute(routeId, finalEmpId === null ? '' : String(finalEmpId));
        const targetEmployee = employees.find((employee) => String(employee.id) === String(finalEmpId));
        setNotice(finalEmpId === null
            ? targetRoute.name + ' 노선의 배정을 해제했습니다.'
            : targetRoute.name + ' → ' + (targetEmployee?.name || '직원') + ' 배정 완료');
    };

    const handleAddRoute = (event) => {
        event.preventDefault();
        if (!selectedTeam) {
            window.alert('먼저 팀 및 지역 설정에서 선택한 근무조의 팀을 추가해주세요.');
            return;
        }
        const formData = new FormData(event.currentTarget);
        const name = String(formData.get('name') || '').trim();
        if (!name) return;
        const newRoute = {
            id: 'R_' + Date.now(),
            name,
            description: String(formData.get('description') || '').trim(),
            team_id: selectedTeam,
            assigned_emp_id: null
        };
        setRoutes((previous) => [...previous, newRoute]);
        setIsAddModalOpen(false);
        setNotice(name + ' 노선을 추가했습니다.');
    };

    const handleDeleteRoute = (routeId) => {
        const route = routes.find((item) => String(item.id) === String(routeId));
        if (!route || !window.confirm(route.name + ' 노선을 삭제할까요?')) return;
        setRoutes((previous) => previous.filter((item) => String(item.id) !== String(routeId)));
        setNotice(route.name + ' 노선을 삭제했습니다.');
    };

    return (
        <div className="admin-safe-top flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
            <header className="admin-sticky-safe-header sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-3 shadow-sm sm:px-4">
                <div className="flex min-w-0 items-center gap-2">
                    <button onClick={onBack} className="rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="관리자 화면으로 돌아가기"><ArrowLeft size={22} /></button>
                    <div className="min-w-0">
                        <h1 className="truncate text-lg font-black sm:text-xl">노선 배치</h1>
                        <p className="text-xs text-slate-500">전체 배치 현황을 보고 노선을 눌러 담당자를 바꾸세요</p>
                    </div>
                </div>
                <button onClick={() => { if (!selectedTeam) { setNotice(getShiftLabel(selectedShift) + '에 등록된 팀이 없습니다. 팀 및 지역 설정에서 팀을 추가해주세요.'); return; } setIsAddModalOpen(true); }} disabled={!selectedTeam} className={'inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-white ' + (selectedTeam ? 'bg-indigo-600 hover:bg-indigo-700' : 'cursor-not-allowed bg-slate-300')}>
                    <Plus size={16} /> 노선 추가
                </button>
            </header>

            <div className="border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
                <div className="mx-auto w-full max-w-6xl">
                    <label className="mb-1.5 block text-xs font-bold text-slate-500">지역 · 근무조 · 팀</label>
                    <RegionTeamDropdown
                        teams={teams}
                        value={selectedTeam}
                        onChange={(teamId) => { setSelectedTeam(teamId); setExpandedRouteId(null); setSearch(''); }}
                        includeAll={false}
                        includeShift
                        shiftValue={selectedShift}
                        onShiftChange={handleShiftChange}
                        className="w-full max-w-md"
                        size="comfortable"
                    />
                </div>
            </div>

            <main className="mx-auto w-full max-w-6xl flex-1 p-3 pb-6 sm:p-4">
                {notice && (
                    <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                        <span>{notice}</span>
                        <button onClick={() => setNotice('')} className="p-1" aria-label="알림 닫기"><X size={14} /></button>
                    </div>
                )}

                <section className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-black text-slate-800">노선 현황</h2>
                            <p className="mt-0.5 text-xs text-slate-500">카드를 누르면 담당 직원을 바로 변경할 수 있습니다.</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700">{filteredRoutes.length}개</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-slate-50 p-2"><p className="text-lg font-black text-slate-800">{filteredRoutes.length}</p><p className="text-[10px] font-bold text-slate-500">전체 노선</p></div>
                        <div className="rounded-xl bg-emerald-50 p-2"><p className="text-lg font-black text-emerald-700">{assignedRouteCount}</p><p className="text-[10px] font-bold text-emerald-700">배정 완료</p></div>
                        <div className="rounded-xl bg-amber-50 p-2"><p className="text-lg font-black text-amber-700">{filteredRoutes.length - assignedRouteCount}</p><p className="text-[10px] font-bold text-amber-700">배정 필요</p></div>
                    </div>
                    <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <Search size={16} className="shrink-0 text-slate-400" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="노선 또는 직원 이름 검색" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
                    </label>
                </section>

                {!selectedTeam && (
                    <div className="mb-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                        <p className="text-sm font-black text-slate-700">{getShiftLabel(selectedShift)} 팀이 등록되지 않았습니다.</p>
                        <p className="mt-1 text-xs text-slate-500">팀 및 지역 설정에서 이 근무조의 팀을 추가해주세요.</p>
                    </div>
                )}

                {selectedTeam && <div className="grid grid-cols-2 content-start gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {visibleRoutes.map((route) => {
                    const assignedEmployee = employees.find((employee) => String(employee.id) === String(route.assigned_emp_id));
                    const expanded = String(expandedRouteId) === String(route.id);
                    return (
                        <section key={route.id} className={'overflow-hidden rounded-xl border bg-white shadow-sm transition-colors ' + (expanded ? 'col-span-2 border-indigo-300 ring-1 ring-indigo-100 sm:col-span-2 lg:col-span-3 xl:col-span-4' : assignedEmployee ? 'border-slate-200 hover:border-indigo-200' : 'border-amber-200 hover:border-amber-300')}>
                            <div role="button" tabIndex={0}
                                onClick={() => setExpandedRouteId(expanded ? null : route.id)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setExpandedRouteId(expanded ? null : route.id);
                                    }
                                }}
                                className="flex w-full cursor-pointer items-start justify-between gap-2 p-2.5 text-left hover:bg-slate-50 sm:p-3">
                                <span className="flex min-w-0 items-start gap-2">
                                    <span className={'rounded-lg p-1.5 ' + (assignedEmployee ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600')}><Truck size={16} /></span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-black">{route.name}</span>
                                        <span className="mt-0.5 block truncate text-[11px] text-slate-500">{route.description || '구역 설명 없음'}</span>
                                        <span className={'mt-1.5 inline-flex max-w-full truncate rounded-full px-2 py-1 text-[10px] font-bold ' + (assignedEmployee ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                                            {assignedEmployee ? assignedEmployee.name : '배정 필요'}
                                        </span>
                                    </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1 text-slate-400">
                                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    <span onClick={(event) => event.stopPropagation()} className="rounded-lg p-1 hover:bg-red-50 hover:text-red-500">
                                        <button type="button" onClick={() => handleDeleteRoute(route.id)} aria-label={route.name + ' 삭제'}><Trash2 size={16} /></button>
                                    </span>
                                </span>
                            </div>

                            {expanded && (
                                <div className="border-t border-gray-100 bg-slate-50 p-3">
                                    <p className="mb-2 flex items-center gap-1 text-xs font-black text-slate-600"><UserRound size={14} /> 고정 직원 선택 (누르면 바로 배정)</p>
                                    <div className="flex flex-wrap gap-2">
                                        <button onClick={() => handleAssign(route.id, '')} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                                            미배정
                                        </button>
                                        {teamEmployees.map((employee) => (
                                            <button key={employee.id} onClick={() => handleAssign(route.id, employee.id)}
                                                className={'rounded-lg border px-3 py-2 text-xs font-bold ' + (String(route.assigned_emp_id) === String(employee.id) ? 'border-indigo-300 bg-indigo-100 text-indigo-800' : 'border-gray-200 bg-white text-slate-700 hover:border-indigo-300')}>
                                                {employee.name}
                                            </button>
                                        ))}
                                    </div>
                                    {teamEmployees.length === 0 && <p className="mt-2 text-xs text-amber-700">이 팀에 등록된 고정 직원이 없습니다. 직원 관리에서 먼저 추가하세요.</p>}
                                </div>
                            )}
                        </section>
                    );
                })}
                </div>}

                {selectedTeam && visibleRoutes.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-slate-500">
                        {filteredRoutes.length === 0 ? '이 팀에 등록된 노선이 없습니다. 위의 노선 추가를 눌러 등록하세요.' : '검색 조건에 맞는 노선이 없습니다.'}
                    </div>
                )}
            </main>

            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
                    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b p-4">
                            <h2 className="font-black">새 노선 추가</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="rounded-lg p-1 text-gray-400"><X size={22} /></button>
                        </div>
                        <form onSubmit={handleAddRoute} className="space-y-4 p-4">
                            <div>
                                <label className="mb-1 block text-xs font-black text-slate-600">노선 이름</label>
                                <input name="name" required placeholder="예: 206a" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-black text-slate-600">구역 설명 (선택)</label>
                                <input name="description" placeholder="예: 상당구 아파트 단지" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" />
                            </div>
                            <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-black text-white"><CheckCircle2 size={18} /> 노선 등록</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
