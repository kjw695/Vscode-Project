import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Building2,
    Check,
    FileSpreadsheet,
    Info,
    Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAdminData } from './contexts/DataContext';
import { fetchMyVendorInfo } from '../services/teamService';
import {
    fetchMyOrganizationExcelSettings,
    saveMyOrganizationExcelSettings
} from '../services/organizationExcelSettingsService';

const DAY_ROTATIONS = ['1회전', '2회전'];
const NIGHT_ROTATIONS = ['D1', 'D2', 'F3'];

function getTeamShift(team) {
    const shift = String(team?.shift || team?.workShift || team?.work_shift || '').toLowerCase();
    return shift === 'night' || shift === '야간' ? 'night' : 'day';
}

function getShiftLabel(team) {
    return getTeamShift(team) === 'night' ? '야간' : '주간';
}

function getEmployeeTypeLabel(employee) {
    return employee.type === 'sub' || employee.employee_type === 'substitute' ? '백업' : '고정';
}

function getAccountUsername(employee) {
    return String(employee.accountUsername || employee.username || '').trim();
}

export default function ExcelScheduleSettings({ onBack }) {
    const { user } = useAuth();
    const { teams = [], setTeams, employees = [], setEmployees, memberSyncStatus } = useAdminData();
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingBusinessNumber, setIsSavingBusinessNumber] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [businessNumber, setBusinessNumber] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState(() => teams[0]?.id ?? '');
    const [notice, setNotice] = useState('');
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        if (teams.length > 0 && !teams.some((team) => String(team.id) === String(selectedTeamId))) {
            setSelectedTeamId(teams[0].id);
        }
    }, [teams, selectedTeamId]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            if (!user?.id) {
                setLoadError('로그인한 회사 관리자 계정을 확인할 수 없습니다.');
                setIsLoading(false);
                return;
            }
            try {
                const vendorInfo = await fetchMyVendorInfo(user.id);
                if (!active) return;
                const owner = vendorInfo?.role === 'owner';
                setIsOwner(owner);
                if (!owner) {
                    setLoadError('사업자등록번호는 회사 소유자 계정에서만 등록할 수 있습니다.');
                    setIsLoading(false);
                    return;
                }
                const settings = await fetchMyOrganizationExcelSettings();
                if (!active) return;
                setBusinessNumber(String(settings?.business_registration_number || '').replace(/[^0-9]/g, ''));
                setLoadError('');
            } catch (error) {
                console.error('엑셀 근무표 설정을 불러오지 못했습니다.', error);
                if (active) setLoadError(error?.message || '회사 설정을 불러오지 못했습니다. Supabase 설정을 확인해주세요.');
            } finally {
                if (active) setIsLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [user?.id]);

    const selectedTeam = useMemo(
        () => teams.find((team) => String(team.id) === String(selectedTeamId)) || null,
        [teams, selectedTeamId]
    );
    const teamEmployees = useMemo(
        () => employees.filter((employee) =>
            String(employee.team_id) === String(selectedTeamId) &&
            employee.active !== false
        ),
        [employees, selectedTeamId]
    );
    const availableRotations = selectedTeam && getTeamShift(selectedTeam) === 'night'
        ? NIGHT_ROTATIONS
        : DAY_ROTATIONS;

    const handleSaveBusinessNumber = async () => {
        const normalized = businessNumber.replace(/[^0-9]/g, '');
        if (normalized.length !== 10) {
            window.alert('사업자등록번호 숫자 10자리를 입력해주세요.');
            return;
        }
        setIsSavingBusinessNumber(true);
        try {
            await saveMyOrganizationExcelSettings(normalized);
            setBusinessNumber(normalized);
            setNotice('사업자등록번호를 회사 설정에 저장했습니다.');
        } catch (error) {
            console.error('사업자등록번호 저장 실패:', error);
            window.alert(error?.message || '사업자등록번호를 저장하지 못했습니다.');
        } finally {
            setIsSavingBusinessNumber(false);
        }
    };

    const updateCampName = (value) => {
        if (!selectedTeam) return;
        setTeams((previous) => previous.map((team) =>
            String(team.id) === String(selectedTeam.id)
                ? { ...team, excelCampName: value }
                : team
        ));
    };

    const toggleRotation = (employeeId, rotation) => {
        setEmployees((previous) => previous.map((employee) => {
            if (String(employee.id) !== String(employeeId)) return employee;
            const current = Array.isArray(employee.excelRotations) ? employee.excelRotations : [];
            const nextSet = new Set(current);
            if (nextSet.has(rotation)) nextSet.delete(rotation);
            else nextSet.add(rotation);
            const next = availableRotations.filter((item) => nextSet.has(item));
            return { ...employee, excelRotations: next };
        }));
        setNotice('직원별 회전 설정을 저장했습니다.');
    };

    const updateManualLoginId = (employeeId, value) => {
        setEmployees((previous) => previous.map((employee) =>
            String(employee.id) === String(employeeId)
                ? { ...employee, exportLoginId: value.trim() }
                : employee
        ));
    };

    if (isLoading) {
        return (
            <div className="admin-safe-top flex min-h-screen items-center justify-center bg-slate-50 p-6 text-sm font-semibold text-slate-500">
                엑셀 근무표 설정을 불러오는 중입니다…
            </div>
        );
    }

    return (
        <div className="admin-safe-top flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
            <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
                <button onClick={onBack} className="rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="근무표로 돌아가기">
                    <ArrowLeft size={22} />
                </button>
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2 text-lg font-black">
                        <FileSpreadsheet size={20} className="text-emerald-600" />
                        엑셀 근무표 설정
                    </h1>
                    <p className="mt-0.5 text-xs text-slate-500">회사 정보와 직원별 업로드 항목을 관리합니다.</p>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 p-3 pb-8 sm:p-5">
                {loadError && (
                    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                        {loadError}
                    </section>
                )}

                {!isOwner ? (
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
                        <Building2 className="mx-auto text-slate-400" size={28} />
                        <h2 className="mt-2 font-black">회사 소유자 권한이 필요합니다.</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-500">사업자등록번호는 회사 공통 정보이므로 회사 소유자 계정에서 설정할 수 있습니다.</p>
                        <button onClick={onBack} className="mt-4 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white">근무표로 돌아가기</button>
                    </section>
                ) : (
                    <>
                        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <h2 className="flex items-center gap-2 font-black">
                                <Building2 size={18} className="text-indigo-600" />
                                회사 정보
                            </h2>
                            <label className="mt-4 block text-xs font-bold text-slate-600">사업자등록번호</label>
                            <div className="mt-1 flex gap-2">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={businessNumber}
                                    onChange={(event) => setBusinessNumber(event.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                                    placeholder="숫자 10자리"
                                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold tracking-wider outline-none focus:border-indigo-500"
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveBusinessNumber}
                                    disabled={isSavingBusinessNumber || businessNumber.length !== 10}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-4"
                                >
                                    <Check size={16} /> {isSavingBusinessNumber ? '저장 중' : '저장'}
                                </button>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-500">회사에 한 번 저장하면 모든 직원의 엑셀 행에 자동으로 입력됩니다.</p>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <h2 className="font-black">팀별 캠프명</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-500">기본값은 팀의 지역명입니다. 업로드 양식에 표시할 캠프명으로 수정할 수 있습니다.</p>
                            <label className="mt-4 block text-xs font-bold text-slate-600">팀 선택</label>
                            <select
                                value={selectedTeamId}
                                onChange={(event) => setSelectedTeamId(event.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-indigo-500"
                            >
                                {teams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {(team.region || '기본 지역') + ' · ' + getShiftLabel(team) + ' · ' + (team.name || '팀')}
                                    </option>
                                ))}
                            </select>
                            {selectedTeam && (
                                <div className="mt-3">
                                    <label className="block text-xs font-bold text-slate-600">엑셀 캠프명</label>
                                    <input
                                        value={selectedTeam.excelCampName ?? selectedTeam.campName ?? selectedTeam.region ?? selectedTeam.name ?? ''}
                                        onChange={(event) => updateCampName(event.target.value)}
                                        placeholder="예: 청주1"
                                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-indigo-500"
                                    />
                                    <p className="mt-1 text-[11px] text-emerald-700">변경 내용은 이 기기에 자동 저장됩니다.</p>
                                </div>
                            )}
                            {teams.length === 0 && <p className="mt-3 text-xs text-amber-700">먼저 팀 및 지역 설정에서 팀을 등록해주세요.</p>}
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="flex items-center gap-2 font-black">
                                    <Users size={18} className="text-indigo-600" />
                                    직원별 아이디 · 회전
                                </h2>
                                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{teamEmployees.length}명</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">출근으로 내보낼 직원에게 회전을 선택하세요. 여러 회전은 선택한 순서대로 쉼표로 연결됩니다.</p>
                            {!selectedTeam && <p className="mt-3 text-sm text-slate-500">팀을 먼저 등록해주세요.</p>}
                            <div className="mt-3 space-y-2">
                                {teamEmployees.map((employee) => {
                                    const accountUsername = getAccountUsername(employee);
                                    const loginId = accountUsername || employee.exportLoginId || '';
                                    const selectedRotations = Array.isArray(employee.excelRotations) ? employee.excelRotations : [];
                                    return (
                                        <article key={employee.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-black text-slate-800">{employee.name || '이름 미등록'}</p>
                                                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{loginId || '업로드 아이디 미등록'}</p>
                                                </div>
                                                <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-slate-500">{getEmployeeTypeLabel(employee)}</span>
                                            </div>
                                            {!accountUsername && (
                                                <label className="mt-2 block text-[11px] font-bold text-slate-600">
                                                    업로드 아이디
                                                    <input
                                                        value={employee.exportLoginId || ''}
                                                        onChange={(event) => updateManualLoginId(employee.id, event.target.value)}
                                                        placeholder="실제 업로드용 아이디"
                                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium outline-none focus:border-indigo-500"
                                                    />
                                                </label>
                                            )}
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {availableRotations.map((rotation) => {
                                                    const checked = selectedRotations.includes(rotation);
                                                    return (
                                                        <label key={rotation} className={'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold ' + (checked ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500')}>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleRotation(employee.id, rotation)}
                                                                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                                                            />
                                                            {rotation}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </article>
                                    );
                                })}
                                {selectedTeam && teamEmployees.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">이 팀에 등록된 직원이 없습니다.</div>
                                )}
                            </div>
                            <div className="mt-3 flex items-start gap-2 rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-800">
                                <Info size={16} className="mt-0.5 shrink-0" />
                                <p>여러 업무라우트는 노선 배치 정보를 자동으로 읽어 <strong>915A,915B,915C</strong>처럼 한 셀에 쉼표로 저장합니다. 라우트는 기존 노선 배치에서 관리합니다.</p>
                            </div>
                            <p className="mt-2 text-[11px] text-emerald-700">회전·업로드 아이디 변경은 자동 저장됩니다. {memberSyncStatus === 'loading' ? '앱 계정 아이디를 동기화하고 있습니다.' : ''}</p>
                        </section>

                        {notice && (
                            <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800">
                                <Check size={15} /> {notice}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
