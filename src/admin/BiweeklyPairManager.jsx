import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, Users, Link2, Unlink, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminData } from './contexts/DataContext';

function getPattern(employee) {
    return String(employee.pattern || employee.work_pattern || '주 5일');
}

function getBiweeklyDays(employee) {
    const match = getPattern(employee).match(/[1-6]/);
    return getPattern(employee).includes('격주') ? (match ? Number(match[0]) : 5) : null;
}

function getTeamInfo(employee, teams) {
    return teams.find((item) => String(item.id) === String(employee.team_id)) || null;
}

function getTeamLabel(employee, teams) {
    const team = getTeamInfo(employee, teams);
    return team ? [team.region || '기본 지역', team.name].filter(Boolean).join(' · ') : '지역·팀 미설정';
}

function normalizeTeamValue(value) {
    return String(value || '').trim().toLocaleLowerCase();
}

function hasSameRegionAndTeam(first, second, teams) {
    const firstTeam = getTeamInfo(first, teams);
    const secondTeam = getTeamInfo(second, teams);
    if (!firstTeam || !secondTeam) return false;

    return String(firstTeam.id) === String(secondTeam.id) &&
        normalizeTeamValue(firstTeam.region || '기본 지역') === normalizeTeamValue(secondTeam.region || '기본 지역') &&
        normalizeTeamValue(firstTeam.name) === normalizeTeamValue(secondTeam.name);
}

function getCurrentStableWeekIndex() {
    const now = new Date();
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    sunday.setDate(sunday.getDate() - sunday.getDay());
    const currentSundayUtc = Date.UTC(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());
    const anchorSundayUtc = Date.UTC(1970, 0, 4);
    return Math.floor((currentSundayUtc - anchorSundayUtc) / (7 * 24 * 60 * 60 * 1000));
}

function getWorkDaysForWeek(employee, weekIndex) {
    const days = getBiweeklyDays(employee);
    if (days === null) return days;
    const offset = Number(employee.biweeklyWeekOffset) === 1 ? 1 : 0;
    return Math.abs((weekIndex + offset) % 2) === 0 ? days + 1 : days;
}

function getOffsetForThisWeek(weekIndex, shouldBeLongWeek) {
    const isEvenWeek = Math.abs(weekIndex % 2) === 0;
    if (shouldBeLongWeek) return isEvenWeek ? 0 : 1;
    return isEvenWeek ? 1 : 0;
}

export default function BiweeklyPairManager({ onBack }) {
    const { employees = [], teams = [], setEmployees } = useAdminData();
    const [selectedIds, setSelectedIds] = useState([]);
    const [search, setSearch] = useState('');
    const [teamFilter, setTeamFilter] = useState('all');
    const [expandedPairId, setExpandedPairId] = useState(null);

    const activeBiweeklyEmployees = useMemo(() => employees.filter((employee) =>
        employee.active !== false && getBiweeklyDays(employee) !== null
    ), [employees]);

    const unpairedEmployees = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return activeBiweeklyEmployees.filter((employee) => {
            if (employee.biweeklyPairId) return false;
            const teamLabel = getTeamLabel(employee, teams);
            const matchesSearch = !keyword ||
                [employee.name, teamLabel, getPattern(employee)].some((value) => String(value || '').toLowerCase().includes(keyword));
            const matchesTeam = teamFilter === 'all' || String(employee.team_id) === String(teamFilter);
            return matchesSearch && matchesTeam;
        }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
    }, [activeBiweeklyEmployees, search, teamFilter, teams]);

    const pairGroups = useMemo(() => {
        const groups = new Map();
        employees.filter((employee) => employee.biweeklyPairId).forEach((employee) => {
            const pairId = String(employee.biweeklyPairId);
            if (!groups.has(pairId)) groups.set(pairId, []);
            groups.get(pairId).push(employee);
        });
        return Array.from(groups, ([id, members]) => ({ id, members }))
            .sort((a, b) => String(a.members[0]?.name || '').localeCompare(String(b.members[0]?.name || ''), 'ko'));
    }, [employees]);

    const selectedEmployees = selectedIds
        .map((id) => activeBiweeklyEmployees.find((employee) => String(employee.id) === String(id)))
        .filter(Boolean);
    const selectedPatternDays = selectedEmployees.length ? getBiweeklyDays(selectedEmployees[0]) : null;
    const canCreatePair = selectedEmployees.length === 2 &&
        hasSameRegionAndTeam(selectedEmployees[0], selectedEmployees[1], teams);

    const handleSelectEmployee = (employee) => {
        const id = String(employee.id);
        if (selectedIds.includes(id)) {
            setSelectedIds((previous) => previous.filter((selectedId) => selectedId !== id));
            return;
        }
        if (selectedIds.length >= 2) {
            window.alert('한 번에 두 명씩 선택해주세요.');
            return;
        }
        if (!getTeamInfo(employee, teams)) {
            window.alert('먼저 팀 및 지역 설정에서 이 직원의 지역과 팀을 지정해주세요.');
            return;
        }
        if (selectedEmployees.length === 1 &&
            !hasSameRegionAndTeam(selectedEmployees[0], employee, teams)) {
            window.alert('같은 지역 · 같은 팀에 소속된 직원끼리만 격주 짝을 만들 수 있습니다.');
            return;
        }
        setSelectedIds((previous) => [...previous, id]);
    };

    const handleCreatePair = () => {
        if (selectedEmployees.length !== 2) {
            window.alert('격주 근무 직원 두 명을 선택해주세요.');
            return;
        }
        if (!hasSameRegionAndTeam(selectedEmployees[0], selectedEmployees[1], teams)) {
            window.alert('같은 지역 · 같은 팀에 소속된 직원끼리만 격주 짝을 만들 수 있습니다.');
            return;
        }
        const [first, second] = selectedEmployees;
        const currentWeekIndex = getCurrentStableWeekIndex();
        // 짝은 근무일 수를 맞추는 기능이 아니라, 각자의 격주 순서만 반대로 설정합니다.
        // 첫 번째 선택 직원은 이번 주 짧은 근무 주, 두 번째 직원은 긴 근무 주로 시작합니다.
        const firstOffset = getOffsetForThisWeek(currentWeekIndex, false);
        const secondOffset = getOffsetForThisWeek(currentWeekIndex, true);
        const pairId = 'BIWEEKLY_' + Date.now() + '_' + String(first.id) + '_' + String(second.id);
        setEmployees((previous) => previous.map((employee) => {
            if (String(employee.id) === String(first.id)) {
                return { ...employee, biweeklyPairId: pairId, biweeklyWeekOffset: firstOffset };
            }
            if (String(employee.id) === String(second.id)) {
                return { ...employee, biweeklyPairId: pairId, biweeklyWeekOffset: secondOffset };
            }
            return employee;
        }));
        setSelectedIds([]);
        const firstWithOffset = { ...first, biweeklyWeekOffset: firstOffset };
        const secondWithOffset = { ...second, biweeklyWeekOffset: secondOffset };
        const firstThisWeek = getWorkDaysForWeek(firstWithOffset, currentWeekIndex);
        const secondThisWeek = getWorkDaysForWeek(secondWithOffset, currentWeekIndex);
        const firstNextWeek = getWorkDaysForWeek(firstWithOffset, currentWeekIndex + 1);
        const secondNextWeek = getWorkDaysForWeek(secondWithOffset, currentWeekIndex + 1);
        window.alert(
            first.name + '님: 이번 주 ' + firstThisWeek + '일 → 다음 주 ' + firstNextWeek + '일\n' +
            second.name + '님: 이번 주 ' + secondThisWeek + '일 → 다음 주 ' + secondNextWeek + '일\n' +
            '설정한 주기는 매주 자동으로 번갈아 적용됩니다.' +
            (Math.max(firstThisWeek, secondThisWeek, firstNextWeek, secondNextWeek) >= 7
                ? '\n주의: 7일 근무 주가 포함되어 자동 근무표에 경고가 표시됩니다.'
                : '')
        );
    };

    const handleSwapOrder = (pairId, members) => {
        if (members.length !== 2) {
            window.alert('짝에 연결된 직원 정보가 두 명인지 확인해주세요.');
            return;
        }
        if (!hasSameRegionAndTeam(members[0], members[1], teams)) {
            window.alert('이 짝은 지역 또는 팀이 서로 다릅니다. 짝을 해제한 뒤 같은 지역 · 같은 팀으로 다시 설정해주세요.');
            return;
        }
        const names = members.map((employee) => employee.name || '이름 미등록').join(' · ');
        if (!window.confirm(
            names + '의 격주 순서를 서로 바꿀까요? 이번 주와 다음 주의 근무 순서가 반대로 바뀌며, 고정 휴무·노선·팀·근무 일수는 그대로 유지됩니다.'
        )) return;

        setEmployees((previous) => previous.map((employee) => {
            if (String(employee.biweeklyPairId) !== String(pairId)) return employee;
            const currentOffset = Number(employee.biweeklyWeekOffset) === 1 ? 1 : 0;
            return { ...employee, biweeklyWeekOffset: currentOffset === 1 ? 0 : 1 };
        }));
    };

    const handleUnpair = (pairId, members) => {
        const names = members.map((employee) => employee.name || '이름 미등록').join(' · ');
        if (!window.confirm(names + '의 격주 짝을 해제할까요? 두 직원은 각각 기본 격주 주기로 돌아갑니다.')) return;
        setEmployees((previous) => previous.map((employee) =>
            String(employee.biweeklyPairId) === String(pairId)
                ? { ...employee, biweeklyPairId: null, biweeklyWeekOffset: 0 }
                : employee
        ));
    };

    const currentWeekIndex = getCurrentStableWeekIndex();

    return (
        <div className="admin-safe-top flex min-h-screen w-full flex-col bg-gray-50 font-sans text-slate-800">
            <header className="admin-sticky-safe-header sticky top-0 z-20 flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-3 shadow-sm sm:px-4">
                <button onClick={onBack} className="rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="직원 관리로 돌아가기">
                    <ArrowLeft size={22} />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-lg font-black sm:text-xl">격주 짝 관리</h1>
                    <p className="text-xs text-gray-500">짝을 맺으면 두 직원의 근무 주기가 서로 반대로 반복됩니다.</p>
                </div>
                <Users className="shrink-0 text-indigo-600" size={23} />
            </header>

            <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-3 pb-8 sm:p-4">
                <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3 sm:p-4">
                    <h2 className="text-sm font-black text-indigo-950">짝 만드는 방법</h2>
                    <p className="mt-1 text-xs leading-5 text-indigo-800">
                        근무일 수와 직군은 달라도 되지만, 같은 지역 · 같은 팀의 격주 직원 두 명을 선택해야 합니다. 첫 번째 직원은 이번 주 짧은 근무 주, 두 번째 직원은 긴 근무 주로 시작하고 다음 주에는 서로 바뀝니다.
                    </p>
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/80 p-2.5 text-xs font-bold text-indigo-900">
                        <CheckCircle2 size={16} className="shrink-0" />
                        고정 휴무 요일과 노선 배정은 변경하지 않습니다.
                    </div>
                </section>

                {selectedEmployees.some((employee) => getBiweeklyDays(employee) === 6) && (
                    <section className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                        <AlertCircle size={17} className="mt-0.5 shrink-0" />
                        격주 6일은 한 주에 7일 근무 기준이 발생합니다. 7일 연속 근무는 허용되지 않으므로 근무 패턴을 확인하세요.
                    </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <h2 className="text-sm font-black">격주 짝이 없는 직원</h2>
                        <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{unpairedEmployees.length}명</span>
                    </div>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <Search size={16} className="shrink-0 text-slate-400" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="직원·팀·근무 패턴 검색" className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                    </label>
                    <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold outline-none">
                        <option value="all">모든 팀</option>
                        {teams.map((team) => <option key={team.id} value={team.id}>{[team.region, team.name].filter(Boolean).join(' · ')}</option>)}
                    </select>

                    <div className="mt-3 space-y-2">
                        {unpairedEmployees.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                                {activeBiweeklyEmployees.length === 0 ? '등록된 격주 근무 직원이 없습니다.' : '조건에 맞는 짝 없는 직원이 없습니다.'}
                            </div>
                        ) : unpairedEmployees.map((employee) => {
                            const isSelected = selectedIds.includes(String(employee.id));
                            const patternDays = getBiweeklyDays(employee);
                            const selectedTeamMismatch = selectedEmployees.length === 1 &&
                                !hasSameRegionAndTeam(selectedEmployees[0], employee, teams);
                            const thisWeekDays = getWorkDaysForWeek(employee, currentWeekIndex);
                            return (
                                <button
                                    key={employee.id}
                                    type="button"
                                    onClick={() => handleSelectEmployee(employee)}
                                    aria-pressed={isSelected}
                                    className={'flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ' + (
                                        isSelected
                                            ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300'
                                            : selectedTeamMismatch
                                                ? 'border-slate-100 bg-slate-50 opacity-60'
                                                : 'border-slate-200 bg-white hover:border-indigo-300'
                                    )}
                                >
                                    <span className="flex min-w-0 items-center gap-3">
                                        <span className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ' + (isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white')}>
                                            {isSelected && <CheckCircle2 size={14} />}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-black text-slate-800">{employee.name || '이름 미등록'}</span>
                                            <span className="mt-0.5 block truncate text-xs text-slate-500">{getTeamLabel(employee, teams)} · {getPattern(employee)}</span>
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-right">
                                        <span className="block text-xs font-black text-indigo-700">이번 주 {thisWeekDays}일</span>
                                        <span className="mt-0.5 block text-[10px] text-slate-500">{thisWeekDays === patternDays ? '짧은 근무 주' : '긴 근무 주'}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="sticky bottom-3 mt-4 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
                        <button
                            type="button"
                            disabled={!canCreatePair}
                            onClick={handleCreatePair}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                        >
                            <Link2 size={17} />
                            {selectedIds.length === 2 ? '선택한 직원 짝 맺기' : '격주 직원 두 명을 선택하세요'}
                        </button>
                        {selectedEmployees.length === 1 && (
                            <p className="mt-2 text-center text-[11px] text-slate-500">
                                근무 패턴과 직군은 달라도 되지만, 같은 지역 · 같은 팀에 소속된 격주 직원 한 명을 더 선택하세요.
                            </p>
                        )}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-black">현재 설정된 짝</h2>
                            <p className="mt-1 text-xs text-slate-500">지역 · 팀은 한 번만 표시하고, 근무일은 접힌 상태에서도 확인할 수 있습니다.</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{pairGroups.length}쌍</span>
                    </div>
                    {pairGroups.length === 0 ? (
                        <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">아직 설정된 격주 짝이 없습니다.</p>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-slate-200 divide-y divide-slate-200">
                            {pairGroups.map(({ id, members }) => {
                                const first = members[0];
                                const second = members[1];
                                const isExpanded = expandedPairId === id;
                                const scopeMatches = members.length === 2 && hasSameRegionAndTeam(first, second, teams);
                                const firstThisWeek = getWorkDaysForWeek(first, currentWeekIndex);
                                const firstNextWeek = getWorkDaysForWeek(first, currentWeekIndex + 1);
                                const secondThisWeek = second ? getWorkDaysForWeek(second, currentWeekIndex) : null;
                                const secondNextWeek = second ? getWorkDaysForWeek(second, currentWeekIndex + 1) : null;
                                return (
                                    <div key={id} className="bg-white">
                                        <button
                                            type="button"
                                            aria-expanded={isExpanded}
                                            onClick={() => setExpandedPairId((previous) => previous === id ? null : id)}
                                            className="w-full p-3 text-left transition-colors hover:bg-slate-50 sm:p-4"
                                        >
                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                <span className={'truncate text-xs font-black ' + (scopeMatches ? 'text-slate-500' : 'text-amber-700')}>
                                                    {scopeMatches ? getTeamLabel(first, teams) : '지역 · 팀 확인 필요'}
                                                </span>
                                                {isExpanded
                                                    ? <ChevronUp size={18} className="shrink-0 text-slate-500" />
                                                    : <ChevronDown size={18} className="shrink-0 text-slate-500" />}
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <div className="min-w-0 rounded-lg bg-indigo-50 px-3 py-2">
                                                    <p className="truncate text-sm font-black text-slate-800">
                                                        {first?.name || '이름 미등록'}{first?.active === false ? ' · 비활성' : ''}
                                                    </p>
                                                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs font-bold text-indigo-700">
                                                        <span>이번 주 {firstThisWeek}일</span><span className="text-indigo-300">→</span><span>다음 주 {firstNextWeek}일</span>
                                                    </p>
                                                </div>
                                                {second ? (
                                                    <div className="min-w-0 rounded-lg bg-violet-50 px-3 py-2">
                                                        <p className="truncate text-sm font-black text-slate-800">
                                                            {second.name || '이름 미등록'}{second.active === false ? ' · 비활성' : ''}
                                                        </p>
                                                        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs font-bold text-violet-700">
                                                            <span>이번 주 {secondThisWeek}일</span><span className="text-violet-300">→</span><span>다음 주 {secondNextWeek}일</span>
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                                                        연결된 직원이 한 명뿐입니다.
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                        {isExpanded && (
                                            <div className="border-t border-slate-100 bg-slate-50 p-3 sm:p-4">
                                                {!scopeMatches && (
                                                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                                                        이 짝은 현재의 같은 지역 · 같은 팀 규칙과 맞지 않습니다. 기존 설정을 자동으로 해제하지는 않았습니다. 아래에서 짝을 해제한 후 올바른 지역과 팀으로 다시 설정해주세요.
                                                        <div className="mt-2 space-y-1 font-bold">
                                                            {members.map((employee) => (
                                                                <p key={employee.id}>{employee.name || '이름 미등록'} · {getTeamLabel(employee, teams)}</p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <button
                                                        type="button"
                                                        disabled={!scopeMatches}
                                                        onClick={() => handleSwapOrder(id, members)}
                                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <RefreshCw size={15} /> 순서 바꾸기
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUnpair(id, members)}
                                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                                    >
                                                        <Unlink size={15} /> 짝 해제
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
