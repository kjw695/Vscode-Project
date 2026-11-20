import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Eye, History, Loader2, Save, Trash2, Undo2, WandSparkles } from 'lucide-react';
import {
    deleteMyOrganizationScheduleTemplate,
    getMyOrganizationScheduleTemplate,
    getMyOrganizationWeeklyScheduleRevision,
    listMyOrganizationScheduleTemplates,
    listMyOrganizationWeeklyScheduleRevisions,
    restoreMyOrganizationWeeklyScheduleRevision,
    saveMyOrganizationScheduleTemplate
} from '../services/organizationScheduleService';

function shiftDate(dateValue, offsetDays) {
    const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return dateValue;
    const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + offsetDays));
    return value.toISOString().slice(0, 10);
}

function getDayOffset(fromDate, toDate) {
    const from = new Date(String(fromDate) + 'T00:00:00.000Z').getTime();
    const to = new Date(String(toDate) + 'T00:00:00.000Z').getTime();
    return Number.isFinite(from) && Number.isFinite(to)
        ? Math.round((to - from) / 86400000)
        : 0;
}

function remapScheduleDates(schedule, sourceWeekStart, targetWeekStart) {
    const offset = getDayOffset(sourceWeekStart, targetWeekStart);
    const next = {};

    Object.entries(schedule || {}).forEach(([key, record]) => {
        const nextKey = /^\d{4}-\d{2}-\d{2}$/.test(key) ? shiftDate(key, offset) : key;
        next[nextKey] = record && typeof record === 'object'
            ? {
                ...record,
                ...(typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
                    ? { date: shiftDate(record.date, offset) }
                    : {})
            }
            : record;
    });

    return next;
}

function remapWarnings(warnings, sourceWeekStart, targetWeekStart) {
    const offset = getDayOffset(sourceWeekStart, targetWeekStart);
    return (Array.isArray(warnings) ? warnings : []).map((warning) =>
        String(warning).replace(/\b\d{4}-\d{2}-\d{2}\b/g, (date) => shiftDate(date, offset))
    );
}

function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '시간 정보 없음';
    return date.toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getScheduleStats(snapshot) {
    const schedule = snapshot?.schedule || {};
    const employeeDetails = snapshot?.employee_details || snapshot?.employeeDetails || {};
    let offCount = 0;
    let backupCount = 0;

    Object.values(schedule).forEach((day) => {
        offCount += Array.isArray(day?.offEmployeeIds)
            ? day.offEmployeeIds.length
            : (Array.isArray(day?.offs) ? day.offs.length : 0);
        backupCount += Array.isArray(day?.subs) ? day.subs.length : 0;
    });

    return {
        days: Object.keys(schedule).length,
        employees: Object.keys(employeeDetails).length,
        offCount,
        backupCount
    };
}

export default function ScheduleWorkflowTools({
    organizationId,
    teamId,
    teamLabel,
    weekStart,
    weekEnd,
    schedule,
    employeeDetails,
    warnings,
    status,
    onApplySchedule,
    onCopyPreviousWeek,
    canCopyPreviousWeek,
    copyBusy,
    onRevisionRestored
}) {
    const [templates, setTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [templateBusy, setTemplateBusy] = useState(false);
    const [templateNotice, setTemplateNotice] = useState('');
    const [templateError, setTemplateError] = useState('');

    const [previewOpen, setPreviewOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [revisions, setRevisions] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedRevision, setSelectedRevision] = useState(null);
    const [revisionBusy, setRevisionBusy] = useState(false);
    const [historyError, setHistoryError] = useState('');

    const loadTemplates = useCallback(async () => {
        if (!organizationId || !teamId) {
            setTemplates([]);
            return;
        }
        setTemplatesLoading(true);
        setTemplateError('');
        try {
            const rows = await listMyOrganizationScheduleTemplates(teamId);
            setTemplates(Array.isArray(rows) ? rows : []);
            setSelectedTemplateId((current) =>
                current && rows.some((row) => row.id === current)
                    ? current
                    : (rows[0]?.id || '')
            );
        } catch (error) {
            setTemplateError(error?.message || '근무표 템플릿을 불러오지 못했습니다.');
        } finally {
            setTemplatesLoading(false);
        }
    }, [organizationId, teamId]);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const handleSaveTemplate = async () => {
        const name = templateName.trim();
        if (!name) {
            setTemplateError('템플릿 이름을 입력해주세요.');
            return;
        }
        if (!Object.keys(schedule || {}).length) {
            setTemplateError('먼저 근무표를 생성하거나 불러와주세요.');
            return;
        }

        setTemplateBusy(true);
        setTemplateError('');
        setTemplateNotice('');
        try {
            const saved = await saveMyOrganizationScheduleTemplate({
                teamId,
                teamLabel,
                name,
                sourceWeekStart: weekStart,
                schedule,
                employeeDetails: employeeDetails || {},
                warnings: warnings || []
            });
            setTemplateName('');
            setSelectedTemplateId(saved?.id || '');
            await loadTemplates();
            setTemplateNotice("'" + name + "' 템플릿을 회사 공용으로 저장했습니다.");
        } catch (error) {
            setTemplateError(error?.message || '템플릿 저장에 실패했습니다.');
        } finally {
            setTemplateBusy(false);
        }
    };

    const handleApplyTemplate = async () => {
        if (!selectedTemplateId) return;
        setTemplateBusy(true);
        setTemplateError('');
        setTemplateNotice('');
        try {
            const template = await getMyOrganizationScheduleTemplate(selectedTemplateId);
            if (!template) throw new Error('선택한 템플릿을 찾을 수 없습니다.');
            const sourceWeek = template.source_week_start || weekStart;
            onApplySchedule?.({
                schedule: remapScheduleDates(template.schedule, sourceWeek, weekStart),
                warnings: remapWarnings(template.warnings, sourceWeek, weekStart),
                employeeDetails: template.employee_details || {},
                templateName: template.name
            });
            setTemplateNotice("'" + template.name + "' 템플릿을 현재 주간에 적용했습니다. 직원 구성을 확인한 뒤 임시 저장해주세요.");
        } catch (error) {
            setTemplateError(error?.message || '템플릿을 적용하지 못했습니다.');
        } finally {
            setTemplateBusy(false);
        }
    };

    const handleDeleteTemplate = async () => {
        if (!selectedTemplateId || templateBusy) return;
        const selected = templates.find((row) => row.id === selectedTemplateId);
        if (!window.confirm("'" + (selected?.name || '선택한 템플릿') + "'을 삭제할까요?")) return;

        setTemplateBusy(true);
        setTemplateError('');
        setTemplateNotice('');
        try {
            await deleteMyOrganizationScheduleTemplate(selectedTemplateId);
            setSelectedTemplateId('');
            await loadTemplates();
            setTemplateNotice('템플릿을 삭제했습니다.');
        } catch (error) {
            setTemplateError(error?.message || '템플릿을 삭제하지 못했습니다.');
        } finally {
            setTemplateBusy(false);
        }
    };

    const loadHistory = useCallback(async () => {
        if (!organizationId || !teamId || !weekStart) return;
        setHistoryLoading(true);
        setHistoryError('');
        try {
            const rows = await listMyOrganizationWeeklyScheduleRevisions(teamId, weekStart);
            setRevisions(Array.isArray(rows) ? rows : []);
        } catch (error) {
            setHistoryError(error?.message || '근무표 변경 이력을 불러오지 못했습니다.');
        } finally {
            setHistoryLoading(false);
        }
    }, [organizationId, teamId, weekStart]);

    useEffect(() => {
        if (historyOpen) loadHistory();
    }, [historyOpen, loadHistory]);

    const handlePreviewRevision = async (revisionId) => {
        setHistoryError('');
        try {
            const detail = await getMyOrganizationWeeklyScheduleRevision(revisionId);
            setSelectedRevision(detail);
        } catch (error) {
            setHistoryError(error?.message || '선택한 이력을 불러오지 못했습니다.');
        }
    };

    const handleRestoreRevision = async () => {
        if (!selectedRevision?.id || revisionBusy) return;
        const restoredStatus = selectedRevision.snapshot?.status || selectedRevision.status;
        const warning = restoredStatus === 'confirmed'
            ? '복구하면 선택한 과거 근무표가 다시 직원 앱에 확정 일정으로 공유됩니다.'
            : '복구하면 선택한 과거 임시 근무표로 돌아가며 직원 앱에는 미확정 상태로 표시됩니다.';

        if (!window.confirm(
            '버전 ' + selectedRevision.source_version + '로 복구할까요?\n' +
            warning + '\n현재 근무표는 복구 직전 이력으로 자동 보관됩니다.'
        )) return;

        setRevisionBusy(true);
        setHistoryError('');
        try {
            const restored = await restoreMyOrganizationWeeklyScheduleRevision(selectedRevision.id);
            setSelectedRevision(null);
            onRevisionRestored?.(restored);
            await loadHistory();
        } catch (error) {
            setHistoryError(error?.message || '근무표 복구에 실패했습니다.');
        } finally {
            setRevisionBusy(false);
        }
    };

    const currentStats = getScheduleStats({ schedule, employee_details: employeeDetails });
    const revisionStats = getScheduleStats(selectedRevision?.snapshot);
    const previewRows = Object.entries(schedule || {})
        .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, day]) => ({
            date,
            weekday: ['일', '월', '화', '수', '목', '금', '토'][new Date(date + 'T12:00:00').getDay()],
            offCount: Array.isArray(day?.offEmployeeIds)
                ? day.offEmployeeIds.length
                : (Array.isArray(day?.offs) ? day.offs.length : 0) +
                    (Array.isArray(day?.subOffs) ? day.subOffs.length : 0),
            backupCount: Array.isArray(day?.subs) ? day.subs.length : 0
        }));

    if (!organizationId) {
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">회사 공용 근무표를 연결하면 지난주 복사와 템플릿·변경 이력을 기기 간 공유할 수 있습니다.</p>
                <button
                    type="button"
                    onClick={onCopyPreviousWeek}
                    disabled={!canCopyPreviousWeek || copyBusy}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
                >
                    {copyBusy ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                    지난주 근무표 복사
                </button>
            </section>
        );
    }

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <WandSparkles size={17} className="text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-slate-800">근무표 편의 도구</h3>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setHistoryOpen((current) => !current);
                        setSelectedRevision(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600"
                >
                    <History size={14} />
                    {historyOpen ? '이력 닫기' : '변경 이력'}
                </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">이 팀에 저장된 템플릿</label>
                    <select
                        value={selectedTemplateId}
                        onChange={(event) => setSelectedTemplateId(event.target.value)}
                        disabled={templatesLoading || templates.length === 0}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:bg-slate-50"
                    >
                        <option value="">
                            {templatesLoading ? '불러오는 중...' : templates.length ? '템플릿 선택' : '저장된 템플릿 없음'}
                        </option>
                        {templates.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-end gap-2">
                    <button
                        type="button"
                        onClick={handleApplyTemplate}
                        disabled={!selectedTemplateId || templateBusy}
                        className="flex-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40 sm:flex-none"
                    >
                        불러오기
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteTemplate}
                        disabled={!selectedTemplateId || templateBusy}
                        aria-label="선택한 템플릿 삭제"
                        className="rounded-lg border border-slate-200 p-2.5 text-slate-500 disabled:opacity-40"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                    type="text"
                    value={templateName}
                    maxLength={80}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="현재 근무표를 저장할 템플릿 이름"
                    className="min-w-0 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                />
                <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={templateBusy || !Object.keys(schedule || {}).length}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700 disabled:opacity-40"
                >
                    {templateBusy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    템플릿 저장
                </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    disabled={previewRows.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 disabled:opacity-40"
                >
                    <Eye size={14} />
                    임시 근무표 미리보기
                </button>
                <span className="text-[10px] text-slate-400">
                    {status === 'confirmed' ? '현재 확정본' : status === 'saved' ? '저장된 임시본' : '편집 중 초안'}
                    {' · '}{previewRows.length}일 표시
                </span>
            </div>

            <button
                type="button"
                onClick={onCopyPreviousWeek}
                disabled={!canCopyPreviousWeek || copyBusy}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
                {copyBusy ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                지난주 근무표 복사
            </button>

            {(templateError || templateNotice) && (
                <p className={'mt-2 rounded-lg p-2 text-xs leading-5 ' + (templateError ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>
                    {templateError || templateNotice}
                </p>
            )}

            {previewOpen && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center">
                    <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h4 className="text-sm font-black text-slate-900">주간 근무표 미리보기</h4>
                                <p className="mt-1 text-[11px] text-slate-500">{weekStart} ~ {weekEnd}</p>
                            </div>
                            <button type="button" onClick={() => setPreviewOpen(false)} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500">닫기</button>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-lg bg-slate-50 p-2 text-center">
                                <p className="text-[10px] text-slate-400">직원</p>
                                <p className="mt-1 text-base font-black text-slate-800">{currentStats.employees}명</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-2 text-center">
                                <p className="text-[10px] text-slate-400">휴무 지정</p>
                                <p className="mt-1 text-base font-black text-slate-800">{currentStats.offCount}건</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-2 text-center">
                                <p className="text-[10px] text-slate-400">백업 배정</p>
                                <p className="mt-1 text-base font-black text-slate-800">{currentStats.backupCount}건</p>
                            </div>
                        </div>
                        <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
                            {previewRows.map((row) => (
                                <div key={row.date} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">{row.date} ({row.weekday})</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px]">
                                        <span className="text-rose-600">휴무 {row.offCount}명</span>
                                        <span className="text-indigo-600">백업 {row.backupCount}건</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {(Array.isArray(warnings) && warnings.length > 0) && (
                            <div className="mt-3 rounded-lg bg-amber-50 p-3">
                                <p className="text-xs font-bold text-amber-800">확인할 경고 {warnings.length}건</p>
                                <p className="mt-1 text-[11px] leading-5 text-amber-700">{warnings.slice(0, 3).join(' / ')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {historyOpen && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                            <h4 className="text-xs font-extrabold text-slate-800">현재 주간 근무표 변경 이력</h4>
                            <p className="mt-0.5 text-[10px] text-slate-400">{weekStart} ~ {weekEnd} · 최근 50개</p>
                        </div>
                        <button
                            type="button"
                            onClick={loadHistory}
                            disabled={historyLoading}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-600 disabled:opacity-40"
                        >
                            {historyLoading ? '조회 중' : '새로고침'}
                        </button>
                    </div>

                    {historyError && <p className="mb-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{historyError}</p>}

                    {historyLoading && revisions.length === 0 ? (
                        <p className="py-5 text-center text-xs text-slate-400">이력을 불러오는 중...</p>
                    ) : revisions.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-400">아직 저장된 변경 이력이 없습니다.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {revisions.map((revision) => (
                                <div key={revision.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-700">
                                            버전 {revision.source_version}
                                            <span className="ml-1.5 font-normal text-slate-400">
                                                {revision.status === 'confirmed' ? '확정' : '임시'}
                                            </span>
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-slate-400">{formatDateTime(revision.captured_at)}</p>
                                    </div>
                                    <span className="text-[10px] text-slate-400">{revision.revision_type === 'baseline' ? '기본' : '변경 전'}</span>
                                    <button
                                        type="button"
                                        onClick={() => handlePreviewRevision(revision.id)}
                                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-2 text-[11px] font-bold text-slate-700"
                                    >
                                        <Eye size={13} />
                                        비교
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedRevision && (
                        <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-extrabold text-slate-800">
                                    버전 {selectedRevision.source_version} 미리보기
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setSelectedRevision(null)}
                                    className="text-xs font-bold text-slate-400"
                                >
                                    닫기
                                </button>
                            </div>
                            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                                {[
                                    ['일정', currentStats.days, revisionStats.days],
                                    ['직원', currentStats.employees, revisionStats.employees],
                                    ['휴무 지정', currentStats.offCount, revisionStats.offCount],
                                    ['백업 배정', currentStats.backupCount, revisionStats.backupCount]
                                ].map(([label, current, old]) => (
                                    <div key={label} className="rounded-lg bg-white p-2">
                                        <p className="text-[10px] text-slate-400">{label}</p>
                                        <p className="mt-1 text-xs font-black tabular-nums text-slate-700">
                                            {current} <span className="text-slate-300">→</span> <span className="text-indigo-700">{old}</span>
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-2 text-[10px] leading-4 text-slate-500">
                                복구하면 해당 버전의 임시/확정 상태까지 되돌아갑니다. 현재 버전은 복구 이력으로 자동 보관됩니다.
                            </p>
                            <button
                                type="button"
                                onClick={handleRestoreRevision}
                                disabled={revisionBusy}
                                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white disabled:opacity-40"
                            >
                                {revisionBusy ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
                                이 버전으로 복구
                            </button>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
