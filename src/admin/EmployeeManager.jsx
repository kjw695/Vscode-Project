// src/admin/EmployeeManager.jsx
import React, { useMemo, useState } from 'react';
import { Users, Truck, ArrowLeft, UserPlus, X, Copy, CheckCircle2, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAdminData } from './contexts/DataContext';

const DEFAULT_PATTERN = '주 5일';

export default function EmployeeManager({ onBack }) {
    const { profile } = useAuth();
    const {
        employees = [],
        teams = [],
        routes = [],
        setEmployees,
        updateEmployee,
        assignRoute,
        getEmployeeRouteNames
    } = useAdminData();

    const [activeTab, setActiveTab] = useState('base');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [workDays, setWorkDays] = useState(5);
    const [isBiweekly, setIsBiweekly] = useState(false);
    const [editType, setEditType] = useState('base');
    const [editTeamId, setEditTeamId] = useState(teams[0]?.id || '');
    const [editRouteId, setEditRouteId] = useState('');

    const baseEmployees = employees.filter((employee) => employee.type !== 'sub' && employee.employee_type !== 'substitute');
    const backupEmployees = employees.filter((employee) => employee.type === 'sub' || employee.employee_type === 'substitute');
    const editingNewEmployee = Boolean(selectedEmployee && !selectedEmployee.id);

    const availableRoutes = useMemo(() => routes.filter((route) =>
        String(route.team_id) === String(editTeamId) &&
        (route.assigned_emp_id == null || route.assigned_emp_id === '' ||
            String(route.assigned_emp_id) === String(selectedEmployee?.id))
    ), [routes, editTeamId, selectedEmployee]);

    const handleOpenModal = (employee) => {
        const safeEmployee = {
            ...employee,
            pattern: employee.pattern || employee.work_pattern || DEFAULT_PATTERN,
            type: employee.type || (employee.employee_type === 'substitute' ? 'sub' : 'base')
        };
        setSelectedEmployee(safeEmployee);
        setIsBiweekly(String(safeEmployee.pattern).includes('격주'));
        const match = String(safeEmployee.pattern).match(/[1-6]/);
        setWorkDays(match ? Number(match[0]) : 5);
        setEditType(safeEmployee.type);
        setEditTeamId(safeEmployee.team_id || teams[0]?.id || '');
        const assignedRoute = routes.find((route) => String(route.assigned_emp_id) === String(safeEmployee.id));
        setEditRouteId(assignedRoute ? String(assignedRoute.id) : '');
    };

    const handleOpenAdd = () => {
        setSelectedEmployee({
            id: null,
            name: '',
            type: activeTab,
            team_id: teams[0]?.id || '',
            pattern: DEFAULT_PATTERN,
            target: '',
            active: true
        });
        setWorkDays(5);
        setIsBiweekly(false);
        setEditType(activeTab);
        setEditTeamId(teams[0]?.id || '');
        setEditRouteId('');
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

        const newTeamId = String(formData.get('team_id') || '');
        const newType = String(formData.get('type') || 'base');
        const routeId = String(formData.get('route_id') || '');
        const employeeId = selectedEmployee.id || 'EMP_' + Date.now();
        const finalPattern = (isBiweekly ? '격주 ' : '주 ') + workDays + '일';
        const updatedData = {
            ...selectedEmployee,
            id: employeeId,
            name,
            team_id: newTeamId,
            type: newType,
            pattern: finalPattern,
            active: selectedEmployee.active !== false,
            target: newType === 'sub' ? String(formData.get('target') || '').trim() : ''
        };

        if (editingNewEmployee) {
            setEmployees((previous) => [...previous, updatedData]);
        } else {
            updateEmployee(updatedData);
        }

        // 노선은 저장 시 함께 배정합니다. 백업 직원은 고정 노선을 갖지 않습니다.
        if (newType === 'base' && routeId) {
            assignRoute(routeId, employeeId);
        }

        setActiveTab(newType);
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

    return (
        <div className="flex min-h-screen w-full flex-col bg-gray-50 font-sans text-slate-800">
            <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-3 shadow-sm sm:px-4">
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

            <div className="grid grid-cols-2 border-b border-gray-200 bg-white px-3 sm:px-4">
                <button onClick={() => setActiveTab('base')} className={'border-b-2 py-3 text-sm font-black transition-colors ' + (activeTab === 'base' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500')}>
                    고정 ({baseEmployees.length})
                </button>
                <button onClick={() => setActiveTab('sub')} className={'border-b-2 py-3 text-sm font-black transition-colors ' + (activeTab === 'sub' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500')}>
                    백업 ({backupEmployees.length})
                </button>
            </div>

            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 p-3 pb-24 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-black text-slate-800">{activeTab === 'base' ? '고정 직원' : '백업 직원'}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">직원을 누르면 이름·팀·근무 패턴을 수정할 수 있습니다.</p>
                    </div>
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{activeTab === 'base' ? baseEmployees.length : backupEmployees.length}명</span>
                </div>

                {(activeTab === 'base' ? baseEmployees : backupEmployees).map((employee) => {
                    const teamName = teams.find((team) => String(team.id) === String(employee.team_id))?.name || '미배정';
                    return (
                        <button key={employee.id} type="button" onClick={() => handleOpenModal(employee)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-indigo-300 sm:p-4">
                            <span className="flex min-w-0 items-start gap-2">
                                <span className={'mt-0.5 rounded-lg p-2 ' + (activeTab === 'base' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600')}>
                                    <Users size={17} />
                                </span>
                                <span className="min-w-0">
                                    <span className="flex flex-wrap items-center gap-1 font-bold text-slate-800">
                                        {employee.name}
                                        <span className="text-xs font-medium text-slate-400">· {teamName}</span>
                                        {String(employee.id) === String(profile?.id) && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-black text-green-700">나</span>}
                                    </span>
                                    <span className="mt-1 block truncate text-xs text-slate-500">
                                        {activeTab === 'base'
                                            ? <><Truck size={12} className="mr-1 inline" />노선: {getEmployeeRouteNames(employee.id)}</>
                                            : '백업 가능 노선 설정은 노선 배치에서 선택'}
                                    </span>
                                </span>
                            </span>
                            <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{employee.pattern || employee.work_pattern || DEFAULT_PATTERN}</span>
                        </button>
                    );
                })}

                {(activeTab === 'base' ? baseEmployees : backupEmployees).length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                        등록된 {activeTab === 'base' ? '고정' : '백업'} 직원이 없습니다.
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
                    <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between gap-3 border-b p-4">
                            <h2 className="flex items-center gap-2 font-black">
                                {editingNewEmployee ? <Plus size={18} /> : <Users size={18} />}
                                {editingNewEmployee ? '새 직원 추가' : selectedEmployee.name + ' 설정'}
                            </h2>
                            <button onClick={() => setSelectedEmployee(null)} className="rounded-lg p-1 text-gray-400"><X size={22} /></button>
                        </div>

                        <form onSubmit={handleSaveEmployee} className="space-y-4 overflow-y-auto p-4 sm:p-5">
                            <div>
                                <label className="mb-1 block text-xs font-black text-gray-600">직원 이름</label>
                                <input name="name" required defaultValue={selectedEmployee.name || ''} placeholder="예: 김민수" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 font-semibold outline-none focus:border-indigo-500" />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-black text-gray-600">소속 팀</label>
                                    <select name="team_id" value={editTeamId} onChange={(event) => { setEditTeamId(event.target.value); setEditRouteId(''); }} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold outline-none focus:border-indigo-500">
                                        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-black text-gray-600">구분</label>
                                    <select name="type" value={editType} onChange={(event) => setEditType(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold outline-none focus:border-indigo-500">
                                        <option value="base">고정</option>
                                        <option value="sub">백업</option>
                                    </select>
                                </div>
                            </div>

                            {editType === 'base' && (
                                <div>
                                    <label className="mb-1 block text-xs font-black text-gray-600">담당 노선 바로 배정 (선택)</label>
                                    <select name="route_id" value={editRouteId} onChange={(event) => setEditRouteId(event.target.value)} className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm font-semibold outline-none focus:border-indigo-500">
                                        <option value="">노선 배정 안 함</option>
                                        {availableRoutes.map((route) => <option key={route.id} value={route.id}>{route.name} {route.description ? '· ' + route.description : ''}</option>)}
                                    </select>
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
                                <button type="button" onClick={() => setIsBiweekly((value) => !value)} className={'mt-2 w-full rounded-xl border px-3 py-2.5 text-sm font-bold ' + (isBiweekly ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500')}>
                                    {isBiweekly ? '✓ 격주 패턴 적용' : '격주 패턴 적용'}
                                </button>
                                <p className="mt-2 text-xs text-gray-500">적용 패턴: <strong>{isBiweekly ? '격주 ' : '주 '}{workDays}일</strong></p>
                            </div>

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
