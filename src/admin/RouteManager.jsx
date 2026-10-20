// src/admin/RouteManager.jsx
import React, { useMemo, useState } from 'react';
import { Map, ArrowLeft, Truck, Plus, Trash2, X, CheckCircle2, ChevronDown, ChevronUp, UserRound } from 'lucide-react';
import { useAdminData } from './contexts/DataContext';

export default function RouteManager({ onBack }) {
    const { routes = [], setRoutes, employees = [], assignRoute, teams = [] } = useAdminData();
    const [selectedTeam, setSelectedTeam] = useState(teams[0]?.id || 'T1');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [expandedRouteId, setExpandedRouteId] = useState(null);
    const [notice, setNotice] = useState('');

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
        <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
            <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-3 shadow-sm sm:px-4">
                <div className="flex min-w-0 items-center gap-2">
                    <button onClick={onBack} className="rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="관리자 화면으로 돌아가기"><ArrowLeft size={22} /></button>
                    <div className="min-w-0">
                        <h1 className="truncate text-lg font-black sm:text-xl">노선 배치</h1>
                        <p className="text-xs text-slate-500">노선을 누른 뒤 직원을 선택해 즉시 배정</p>
                    </div>
                </div>
                <button onClick={() => setIsAddModalOpen(true)} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white">
                    <Plus size={16} /> 노선 추가
                </button>
            </header>

            <div className="flex gap-2 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2 sm:px-4">
                {teams.map((team) => (
                    <button key={team.id} onClick={() => { setSelectedTeam(team.id); setExpandedRouteId(null); }}
                        className={'shrink-0 rounded-lg px-3 py-2 text-xs font-black ' + (String(selectedTeam) === String(team.id) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50')}>
                        {team.name}
                    </button>
                ))}
            </div>

            <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 content-start gap-3 p-3 pb-6 sm:p-4 md:grid-cols-2 xl:grid-cols-3">
                {notice && (
                    <div className="col-span-full flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                        <span>{notice}</span>
                        <button onClick={() => setNotice('')} className="p-1" aria-label="알림 닫기"><X size={14} /></button>
                    </div>
                )}

                {filteredRoutes.map((route) => {
                    const assignedEmployee = employees.find((employee) => String(employee.id) === String(route.assigned_emp_id));
                    const expanded = String(expandedRouteId) === String(route.id);
                    return (
                        <section key={route.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                            <button type="button" onClick={() => setExpandedRouteId(expanded ? null : route.id)}
                                className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50 sm:p-4">
                                <span className="flex min-w-0 items-start gap-2">
                                    <span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Truck size={17} /></span>
                                    <span className="min-w-0">
                                        <span className="block truncate font-black">{route.name}</span>
                                        <span className="mt-0.5 block truncate text-xs text-slate-500">{route.description || '구역 설명 없음'}</span>
                                        <span className={'mt-1.5 inline-flex rounded-full px-2 py-1 text-[11px] font-bold ' + (assignedEmployee ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                                            {assignedEmployee ? '고정 · ' + assignedEmployee.name : '미배정'}
                                        </span>
                                    </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2 text-slate-400">
                                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    <span onClick={(event) => event.stopPropagation()} className="rounded-lg p-1 hover:bg-red-50 hover:text-red-500">
                                        <button type="button" onClick={() => handleDeleteRoute(route.id)} aria-label={route.name + ' 삭제'}><Trash2 size={16} /></button>
                                    </span>
                                </span>
                            </button>

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

                {filteredRoutes.length === 0 && (
                    <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-slate-500">
                        이 팀에 등록된 노선이 없습니다. 위의 노선 추가를 눌러 등록하세요.
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
