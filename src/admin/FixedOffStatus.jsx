import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, CalendarDays, Users, Filter, X } from 'lucide-react';
import { useAdminData } from './contexts/DataContext';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getTeamName(employee, teams) {
    const team = teams.find((item) => String(item.id) === String(employee.team_id));
    return team ? [team.region, team.name].filter(Boolean).join(' · ') : '미배정';
}

function getRoutes(employee, routes) {
    const assigned = routes.filter((route) => String(route.assigned_emp_id) === String(employee.id));
    if (assigned.length) return assigned.map((route) => route.name).join(', ');
    return employee.route || employee.route_name || '미지정';
}

function getPattern(employee) {
    return String(employee.pattern || employee.work_pattern || '주 5일');
}

function getFixedDays(employee, week = 'common') {
    if (!employee.hasFixedOffDays) return [];
    const pattern = getPattern(employee);
    if (pattern.includes('격주')) {
        const byWeek = employee.fixedOffWeekdaysByWeek || {};
        const fallback = Array.isArray(employee.fixedOffWeekdays) ? employee.fixedOffWeekdays : [];
        const days = week === 'long'
            ? (Array.isArray(byWeek.longWeek) ? byWeek.longWeek : fallback)
            : (Array.isArray(byWeek.shortWeek) ? byWeek.shortWeek : fallback);
        return days.filter((day) => Number.isInteger(Number(day)) && Number(day) >= 0 && Number(day) <= 6).map(Number);
    }
    const days = Array.isArray(employee.fixedOffWeekdays) ? employee.fixedOffWeekdays : [];
    return days.filter((day) => Number.isInteger(Number(day)) && Number(day) >= 0 && Number(day) <= 6).map(Number);
}

function hasFixedOffOnDay(employee, dayIndex) {
    if (getPattern(employee).includes('격주')) {
        return getFixedDays(employee, 'short').includes(dayIndex) ||
            getFixedDays(employee, 'long').includes(dayIndex);
    }
    return getFixedDays(employee, 'common').includes(dayIndex);
}

export default function FixedOffStatus({ onBack }) {
    const { employees = [], teams = [], routes = [] } = useAdminData();
    const [search, setSearch] = useState('');
    const [teamFilter, setTeamFilter] = useState('all');
    const [selectedWeekday, setSelectedWeekday] = useState(null);

    const activeEmployees = useMemo(
        () => employees.filter((employee) => employee.active !== false),
        [employees]
    );
    const fixedEmployees = useMemo(() => activeEmployees.filter((employee) =>
        employee.hasFixedOffDays && (
            getFixedDays(employee, 'short').length > 0 ||
            getFixedDays(employee, 'long').length > 0 ||
            getFixedDays(employee, 'common').length > 0
        )
    ), [activeEmployees]);

    const counts = useMemo(() => WEEKDAYS.map((day, index) => ({
        day,
        index,
        count: fixedEmployees.filter((employee) => hasFixedOffOnDay(employee, index)).length
    })), [fixedEmployees]);

    const filtered = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return fixedEmployees.filter((employee) => {
            const teamName = getTeamName(employee, teams);
            const routesText = getRoutes(employee, routes);
            const matchesSearch = !keyword ||
                [employee.name, teamName, routesText].some((value) => String(value).toLowerCase().includes(keyword));
            const matchesTeam = teamFilter === 'all' || String(employee.team_id) === String(teamFilter);
            const matchesWeekday = selectedWeekday === null || hasFixedOffOnDay(employee, selectedWeekday);
            return matchesSearch && matchesTeam && matchesWeekday;
        }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
    }, [fixedEmployees, search, teamFilter, selectedWeekday, teams, routes]);

    return (
        <div className="admin-safe-top flex min-h-screen w-full flex-col bg-gray-50 font-sans text-slate-800">
            <header className="admin-sticky-safe-header sticky top-0 z-20 flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-3 shadow-sm sm:px-4">
                <button onClick={onBack} className="rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="관리자 센터로 돌아가기">
                    <ArrowLeft size={22} />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-lg font-black sm:text-xl">고정 휴무 현황</h1>
                    <p className="text-xs text-gray-500">요일을 누르면 해당 요일에 쉬는 직원만 볼 수 있습니다.</p>
                </div>
                <CalendarDays className="shrink-0 text-emerald-600" size={23} />
            </header>

            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-3 pb-8 sm:gap-5 sm:p-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <h2 className="text-sm font-black">요일별 고정 휴무 인원</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-500">격주 직원은 두 주 중 해당 요일이 고정 휴무인 경우 한 명으로 집계합니다.</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{fixedEmployees.length}명</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {counts.map(({ day, index, count }) => {
                            const isSelected = selectedWeekday === index;
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => setSelectedWeekday((previous) => previous === index ? null : index)}
                                    className={'min-w-0 rounded-lg border px-0.5 py-2 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 sm:rounded-xl sm:px-2 sm:py-3 ' + (
                                        isSelected
                                            ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400'
                                            : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/60'
                                    )}
                                >
                                    <span className={'block text-xs font-black sm:text-sm ' + (isSelected ? 'text-emerald-700' : 'text-slate-500')}>{day}</span>
                                    <span className={'mt-1 block text-base font-black leading-5 sm:text-xl ' + (isSelected ? 'text-emerald-700' : 'text-slate-800')}>{count}</span>
                                    <span className="block text-[9px] leading-3 text-slate-500 sm:text-[11px]">명</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">요일 카드를 다시 누르면 전체 직원 목록으로 돌아옵니다.</p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Users size={18} className="shrink-0 text-indigo-600" />
                        <h2 className="text-sm font-black">
                            {selectedWeekday === null ? '직원별 고정 휴무' : WEEKDAYS[selectedWeekday] + '요일 고정 휴무 직원'}
                        </h2>
                        <span className="ml-auto shrink-0 text-xs font-bold text-slate-500">{filtered.length}명</span>
                        {selectedWeekday !== null && (
                            <button
                                type="button"
                                onClick={() => setSelectedWeekday(null)}
                                className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                            >
                                <X size={12} /> 전체
                            </button>
                        )}
                    </div>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <Search size={16} className="shrink-0 text-slate-400" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="직원·팀·노선 검색" className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                    </label>
                    <label className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-2">
                        <Filter size={14} className="shrink-0 text-slate-400" />
                        <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none">
                            <option value="all">전체 팀</option>
                            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                        </select>
                    </label>
                </section>

                {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
                        <CalendarDays size={30} className="mx-auto text-slate-300" />
                        <p className="mt-3 text-sm font-bold text-slate-700">
                            {selectedWeekday === null ? '표시할 고정 휴무 직원이 없습니다.' : WEEKDAYS[selectedWeekday] + '요일에 고정 휴무가 설정된 직원이 없습니다.'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">직원관리에서 고정 휴무를 설정하면 여기에 표시됩니다.</p>
                    </div>
                ) : filtered.map((employee) => {
                    const isBiweekly = getPattern(employee).includes('격주');
                    const commonDays = getFixedDays(employee, 'common');
                    const shortDays = getFixedDays(employee, 'short');
                    const longDays = getFixedDays(employee, 'long');
                    return (
                        <article key={employee.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="truncate font-black text-slate-800">{employee.name || '이름 미등록'}</h3>
                                    <p className="mt-1 truncate text-xs text-slate-500">{getTeamName(employee, teams)} · {getRoutes(employee, routes)}</p>
                                    <p className="mt-1 text-[11px] font-bold text-indigo-600">{getPattern(employee)}</p>
                                </div>
                                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">고정 휴무</span>
                            </div>
                            {isBiweekly ? (
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-xl bg-indigo-50 p-3">
                                        <p className="text-xs font-black text-indigo-700">{getPattern(employee).replace('격주 ', '')}일 근무 주</p>
                                        <p className="mt-2 text-sm font-bold text-slate-700">{shortDays.length ? shortDays.map((day) => WEEKDAYS[day]).join(' · ') + '요일' : '설정 없음'}</p>
                                    </div>
                                    <div className="rounded-xl bg-violet-50 p-3">
                                        <p className="text-xs font-black text-violet-700">{Number((getPattern(employee).match(/[1-6]/) || [5])[0]) + 1}일 근무 주</p>
                                        <p className="mt-2 text-sm font-bold text-slate-700">{longDays.length ? longDays.map((day) => WEEKDAYS[day]).join(' · ') + '요일' : '설정 없음'}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {commonDays.length ? commonDays.map((day) => <span key={day} className={'rounded-full px-3 py-1.5 text-xs font-black ' + (selectedWeekday === day ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-50 text-indigo-700')}>{WEEKDAYS[day]}요일</span>) : <span className="text-xs text-slate-400">고정 요일 없음</span>}
                                </div>
                            )}
                        </article>
                    );
                })}
            </main>
        </div>
    );
}
