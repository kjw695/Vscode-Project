import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    AlertCircle,
    Clock3,
    Database,
    Eye,
    RefreshCw,
    RotateCcw,
    Save,
    ShieldCheck
} from 'lucide-react';
import {
    createMyOrganizationAdminBackup,
    fetchMyOrganizationAdminBackup,
    fetchMyOrganizationAdminBackups,
    restoreMyOrganizationAdminBackup
} from '../services/teamService';

const CATEGORY_LABELS = [
    ['regions', '지역'],
    ['teams', '팀'],
    ['employees', '직원'],
    ['routes', '노선']
];

const BACKUP_TYPE_LABELS = {
    baseline: '최초 저장',
    automatic: '자동 백업',
    manual: '수동 백업',
    pre_restore: '복구 직전 백업'
};

const getCount = (source, key) => (
    Array.isArray(source?.[key]) ? source[key].length : 0
);

const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '시간 정보 없음';
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export default function AdminDataBackup({ onBack, currentData, onRestored }) {
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [previewLoadingId, setPreviewLoadingId] = useState(null);
    const [preview, setPreview] = useState(null);
    const [restoreBusy, setRestoreBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const refreshBackups = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError('');

        try {
            const rows = await fetchMyOrganizationAdminBackups();
            setBackups(Array.isArray(rows) ? rows : []);
        } catch (loadError) {
            setError(loadError?.message || '백업 이력을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        refreshBackups();
    }, [refreshBackups]);

    const currentCounts = useMemo(() => ({
        regions: getCount(currentData, 'regions'),
        teams: getCount(currentData, 'teams'),
        employees: getCount(currentData, 'employees'),
        routes: getCount(currentData, 'routes')
    }), [currentData]);

    const handleCreateBackup = async () => {
        if (creating) return;
        setCreating(true);
        setError('');
        setNotice('');

        try {
            await createMyOrganizationAdminBackup('관리자 수동 백업');
            await refreshBackups(true);
            setNotice('현재 회사 관리자 데이터를 백업했습니다.');
        } catch (createError) {
            setError(createError?.message || '수동 백업을 만들지 못했습니다.');
        } finally {
            setCreating(false);
        }
    };

    const handlePreview = async (backup) => {
        setPreviewLoadingId(backup.id);
        setError('');
        setNotice('');

        try {
            const detail = await fetchMyOrganizationAdminBackup(backup.id);
            if (!detail?.snapshot) {
                throw new Error('선택한 백업의 데이터를 찾을 수 없습니다.');
            }
            setPreview(detail);
        } catch (previewError) {
            setError(previewError?.message || '백업 미리보기를 불러오지 못했습니다.');
        } finally {
            setPreviewLoadingId(null);
        }
    };

    const handleRestore = async () => {
        if (!preview?.id || restoreBusy) return;

        const confirmed = window.confirm(
            '선택한 백업으로 회사 관리자 데이터를 복구할까요?\n현재 데이터는 복구 직전 백업으로 먼저 보관됩니다.'
        );
        if (!confirmed) return;

        setRestoreBusy(true);
        setError('');
        setNotice('');

        try {
            await restoreMyOrganizationAdminBackup(preview.id);
            setPreview(null);
            window.alert('복구가 완료됐습니다. 복구 직전 데이터도 별도 백업으로 보관했습니다.');
            if (typeof onRestored === 'function') {
                await onRestored();
            }
            await refreshBackups(true);
        } catch (restoreError) {
            setError(restoreError?.message || '데이터 복구에 실패했습니다.');
        } finally {
            setRestoreBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 px-4 pb-8 pt-4 sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
                <header className="mb-5 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="관리자 센터로 돌아가기"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl font-black text-slate-900">데이터 백업·복구</h1>
                        <p className="mt-1 text-xs text-slate-500">회사 관리자 운영 데이터의 변경 이력을 보관합니다.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => refreshBackups(true)}
                        disabled={refreshing || loading}
                        aria-label="백업 목록 새로고침"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-50"
                    >
                        <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </header>

                <section className="mb-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <ShieldCheck size={23} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-sm font-extrabold text-slate-900">자동 백업이 활성화되어 있습니다.</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                지역·팀·직원·노선 데이터가 변경되면 이전 버전을 자동으로 보관합니다.
                                최근 50개 또는 90일 이내의 백업을 유지합니다.
                            </p>
                            <p className="mt-2 text-[11px] text-slate-400">
                                직원 개인 배송기록과 개인 계정 설정은 이 백업에 포함되지 않습니다.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleCreateBackup}
                        disabled={creating || loading}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                        <Save size={17} />
                        {creating ? '백업 저장 중...' : '현재 데이터 지금 백업'}
                    </button>
                </section>

                {error && (
                    <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {notice && (
                    <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                        {notice}
                    </div>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Clock3 size={18} className="text-slate-500" />
                            <h2 className="text-sm font-extrabold text-slate-900">백업 이력</h2>
                        </div>
                        <span className="text-[11px] text-slate-400">{backups.length}개 보관 중</span>
                    </div>

                    {loading ? (
                        <div className="py-10 text-center text-sm text-slate-400">백업 이력을 불러오는 중...</div>
                    ) : backups.length === 0 ? (
                        <div className="rounded-xl bg-slate-50 px-4 py-8 text-center">
                            <Database size={26} className="mx-auto mb-2 text-slate-300" />
                            <p className="text-sm font-bold text-slate-600">아직 백업 이력이 없습니다.</p>
                            <p className="mt-1 text-xs text-slate-400">회사 공용 데이터가 처음 저장되면 자동 백업이 생성됩니다.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {backups.map((backup) => (
                                <div key={backup.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                        <Database size={17} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800">
                                                {BACKUP_TYPE_LABELS[backup.backup_type] || '백업'}
                                            </span>
                                            <span className="text-[10px] text-slate-400">버전 {backup.source_version}</span>
                                        </div>
                                        <p className="mt-1 truncate text-[11px] text-slate-500">
                                            {backup.description || formatDate(backup.created_at)}
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-slate-400">{formatDate(backup.created_at)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handlePreview(backup)}
                                        disabled={previewLoadingId === backup.id}
                                        className="flex shrink-0 items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 disabled:opacity-50"
                                    >
                                        <Eye size={14} />
                                        {previewLoadingId === backup.id ? '확인 중' : '미리보기'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {preview && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center">
                        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-black text-slate-900">복구 전 미리보기</h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {BACKUP_TYPE_LABELS[preview.backup_type] || '백업'} · {formatDate(preview.created_at)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPreview(null)}
                                    disabled={restoreBusy}
                                    className="rounded-lg px-2 py-1 text-sm font-bold text-slate-500"
                                >
                                    닫기
                                </button>
                            </div>

                            <div className="mt-4 rounded-xl bg-slate-50 p-3">
                                <p className="text-xs font-bold text-slate-700">현재 데이터와 선택한 백업 비교</p>
                                <div className="mt-3 grid grid-cols-[1fr_1fr_1fr] gap-2 text-center">
                                    <div />
                                    <div className="text-[10px] font-bold text-slate-500">현재</div>
                                    <div className="text-[10px] font-bold text-indigo-600">복구 후</div>
                                    {CATEGORY_LABELS.map(([key, label]) => (
                                        <React.Fragment key={key}>
                                            <div className="py-2 text-left text-xs font-semibold text-slate-600">{label}</div>
                                            <div className="rounded-lg bg-white py-2 text-sm font-black tabular-nums text-slate-800">
                                                {currentCounts[key]}
                                            </div>
                                            <div className="rounded-lg bg-indigo-50 py-2 text-sm font-black tabular-nums text-indigo-700">
                                                {getCount(preview.snapshot, key)}
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs font-bold text-amber-800">복구 시 변경되는 내용</p>
                                <p className="mt-1 text-xs leading-5 text-amber-700">
                                    선택한 시점의 지역·팀·직원·노선 데이터로 교체됩니다.
                                    현재 데이터는 복구 직전 백업으로 자동 보관되며, 복구 후에도 다시 되돌릴 수 있습니다.
                                </p>
                            </div>

                            <div className="mt-4 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPreview(null)}
                                    disabled={restoreBusy}
                                    className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 disabled:opacity-50"
                                >
                                    취소
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRestore}
                                    disabled={restoreBusy}
                                    className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white disabled:opacity-50"
                                >
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <RotateCcw size={16} />
                                        {restoreBusy ? '복구 중...' : '이 백업으로 복구'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
