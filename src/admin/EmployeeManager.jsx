import React, { useState } from 'react';

const WORK_PATTERNS = [
  { value: 'weekly-1', label: '주1일' },
  { value: 'weekly-2', label: '주2일' },
  { value: 'weekly-3', label: '주3일' },
  { value: 'weekly-4', label: '주4일' },
  { value: 'weekly-5', label: '주5일' },
  { value: 'weekly-6', label: '주6일' },
  { value: 'biweekly', label: '격주' },
];

const emptyForm = { name: '', role: 'base', teamId: '', pattern: 'weekly-5', target: '' };

const EmployeeManager = ({ employees, teams, workRules, substitutePermissions, onEmployeesChange, onWorkRulesChange, onSubstitutePermissionsChange }) => {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const saveEmployee = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const employeeId = editingId || 'emp-' + Date.now();
    const existing = employees.find((item) => item.id === employeeId);
    const employee = {
      id: employeeId, name: form.name.trim(), role: form.role,
      teamId: form.teamId || teams[0]?.id || '', active: true,
      joinedAt: existing?.joinedAt || new Date().toISOString().slice(0, 10),
      target: form.target.trim(),
    };
    onEmployeesChange(editingId ? employees.map((item) => item.id === editingId ? { ...item, ...employee } : item) : [...employees, employee]);
    const nextRule = {
      employeeId, pattern: form.pattern,
      weeklyWorkDays: form.pattern === 'biweekly' ? [5, 6] : [Number(form.pattern.replace('weekly-', ''))],
      preferredRestDays: workRules.find((r) => r.employeeId === employeeId)?.preferredRestDays || [],
      restPriority: workRules.find((r) => r.employeeId === employeeId)?.restPriority || {},
    };
    const hasRule = workRules.some((r) => r.employeeId === employeeId);
    onWorkRulesChange(hasRule ? workRules.map((r) => r.employeeId === employeeId ? nextRule : r) : [...workRules, nextRule]);
    if (form.role === 'sub') {
      const targets = form.target.split(',').map((value) => value.trim()).filter(Boolean);
      onSubstitutePermissionsChange({ ...substitutePermissions, [employeeId]: targets });
    }
    setForm(emptyForm); setEditingId(null);
  };

  const editEmployee = (employee) => {
    const rule = workRules.find((item) => item.employeeId === employee.id);
    setEditingId(employee.id);
    setForm({ name: employee.name, role: employee.role, teamId: employee.teamId || '', pattern: rule?.pattern || 'weekly-5', target: employee.target || '' });
  };

  const toggleActive = (employeeId) => onEmployeesChange(employees.map((employee) => employee.id === employeeId ? { ...employee, active: !employee.active } : employee));

  return (
    <section className="space-y-4">
      <div><h2 className="text-xl font-bold">직원관리</h2><p className="text-sm text-gray-500">고정기사와 대체기사의 근무패턴을 주1일부터 주6일, 격주까지 설정합니다.</p></div>
      <form onSubmit={saveEmployee} className="grid gap-3 rounded-xl border p-4 md:grid-cols-6">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="이름" className="rounded-lg border px-3 py-2" required />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border px-3 py-2"><option value="base">고정기사</option><option value="sub">대체기사</option></select>
        <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })} className="rounded-lg border px-3 py-2"><option value="">조 선택</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
        <select value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className="rounded-lg border px-3 py-2">{WORK_PATTERNS.map((pattern) => <option key={pattern.value} value={pattern.value}>{pattern.label}</option>)}</select>
        <input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder={form.role === 'sub' ? '대체 가능 노선 A,B' : '고정 노선'} className="rounded-lg border px-3 py-2" />
        <button type="submit" className="rounded-lg bg-black px-4 py-2 font-semibold text-white">{editingId ? '수정' : '직원 추가'}</button>
      </form>
      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-5 border-b bg-gray-50 p-3 text-sm font-semibold"><span>이름</span><span>구분</span><span>조</span><span>근무패턴</span><span>관리</span></div>
        {employees.map((employee) => {
          const rule = workRules.find((item) => item.employeeId === employee.id);
          const pattern = WORK_PATTERNS.find((item) => item.value === rule?.pattern)?.label || '미설정';
          return <div key={employee.id} className="grid grid-cols-5 items-center border-b p-3 text-sm last:border-b-0"><span className={employee.active ? '' : 'text-gray-400'}>{employee.name}</span><span>{employee.role === 'base' ? '고정' : '대체'}</span><span>{teams.find((team) => team.id === employee.teamId)?.name || '-'}</span><span>{pattern}</span><span className="flex gap-2"><button type="button" onClick={() => editEmployee(employee)} className="rounded border px-2 py-1">수정</button><button type="button" onClick={() => toggleActive(employee.id)} className="rounded border px-2 py-1">{employee.active ? '퇴사/비활성' : '재활성'}</button></span></div>;
        })}
      </div>
    </section>
  );
};

export default EmployeeManager;