import React, { useCallback, useEffect, useState } from 'react';
import {
    ArrowLeft,
    Archive,
    AlertTriangle,
    Clock3,
    Eye,
    Loader2,
    RefreshCw,
    RotateCcw,
    Save
} from 'lucide-react';
import { useAdminData } from './contexts/DataContext';
import {
    createMyOrganizationAdminBackup,
    fetchMyOrganizationAdminBackup,
    fetchMyOrganizationAdminBackups,
    restoreMyOrganizationAdminBackup
} from '../services/teamService';

const formatDate = (value) => {
    if (!value) return '시간 정보 없음';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '시간 정보 없음';
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const backupTypeLabel = (type) => {
    if (type === 'manual') return '수동 백업';
    if (type === 'pre_restore') return '복구 직전 자동 백업';
    return '자동 저장 전 백업';
};

const countLabel = (value) => Number(value || 0).toLocaleString('ko-KR');

export default function BackupRestoreView({ onBack }) {
    const {
        organizationRole,
        syncStatus,
        sharedVersion,
        regions,
        teams,
        employees,
        routes,
        reloadSharedState
    } = useAdminData();

    const [backups, setBackups] = useState([]);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const loadBackups = useCallback(async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            const result = await fetchMyOrganizationAdminBackups(50);
            setBackups(result);
        } catch (error) {
            setErrorMessage(error?.message || '백업 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (organizationRole === 'owner' && syncStatus === 'ready') {
            loadBackups();
        } else if (organizationRole !== 'owner') {
            setLoading(false);
        }
    }, [loadBackups, organizationRole, syncStatus]);

    const handleCreateBackup = async () => {
        setBusy(true);
        setErrorMessage('');
        try {
            await createMyOrganizationAdminBackup();
            await loadBackups();
        } catch (error) {
            setErrorMessage(error?.message || '수동 백업을 생성하지 못했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const handlePreview = async (backupId) => {
        setBusy(true);
        setErrorMessage('');
        try {
            const result = await fetchMyOrganizationAdminBackup(backupId);
            setPreview(result);
        } catch (error) {
            setErrorMessage(error?.message || '백업 내용을 불러오지 못했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const handleRestore = async (backup) => {
        const message = [
            '선택한 백업 시점의 회사 운영 데이터로 복구합니다.',
            '현재 저장된 데이터도 복구 직전 백업으로 먼저 보관됩니다.',
            '복구를 진행할까요?'
        ].join('\n');
        if (!window.confirm(message)) return;

        setBusy(true);
        setErrorMessage('');
        try {
            await restoreMyOrganizationAdminBackup(backup.id, sharedVersion);
            await reloadSharedState();
            await loadBackups();
            setPreview(null);
            window.alert('선택한 백업으로 복구했습니다. 복구 직전 데이터도 백업 목록에 보관했습니다.');
        } catch (error) {
            setErrorMessage(error?.message || '백업 복구에 실패했습니다. 최신 데이터를 확인해주세요.');
            if (String(error?.code || '') === '40001') {
                await reloadSharedState().catch(() => {});
            }
        } finally {
            setBusy(false);
        }
    };

    const currentCounts = [
        ['지역', regions.length],
        ['팀', teams.length],
        ['직원', employees.length],
        ['노선', routes.length]
    ];

    const snapshot = preview?.snapshot || {};
    const previewCounts = [
        ['지역', Array.isArray(snapshot.regions) ? snapshot.regions.length : 0],
        ['팀', Array.isArray(snapshot.teams) ? snapshot.teams.length : 0],
        ['직원', Array.isArray(snapshot.employees) ? snapshot.employees.length : 0],
        ['노선', Array.isArray(snapshot.routes) ? snapshot.routes.length : 0]
    ];

    if (organizationRole !== 'owner') {
        return (
            <div className="min-h-screen bg-slate-50 p-5">
                <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-600">
                    <ArrowLeft size={18} /> 관리자 센터
                </button>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-600">
                    대표 계정으로 로그인한 경우에만 회사 데이터 백업과 복구를 사용할 수 있습니다.
                </div>
            </div>
        );
    }

    return (
        <div className="admin-safe-top min-h-screen bg-slate-50 p-4 pb-8 font-sans sm:p-5">
            <div className="mx-auto w-full max-w-3xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <button type="button" onClick={onBack} className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-slate-700">
                        <ArrowLeft size={18} /> 관리자 센터
                    </button>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                        현재 버전 {sharedVersion || 1}
                    </span>
                </div>

                <div className="mb-4">
                    <h1 className="flex items-center gap-2 text-xl font-black text-slate-900">
                        <Archive className="text-amber-600" size={24} />
                        데이터 백업·복구
                    </h1>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
                        지역·팀·직원·노선 데이터를 같은 시점으로 백업하고 이전 상태로 복구합니다.
                    </p>
                </div>

                <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-black text-slate-800">현재 회사 데이터</h2>
                        <span className="text-xs text-slate-400">{syncStatus === 'saving' ? '저장 중...' : '저장 완료'}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {currentCounts.map(([label, value]) => (
                            <div key={label} className="min-w-0 rounded-xl bg-slate-50 px-2 py-3 text-center">
                                <p className="text-xs text-slate-500">{label}</p>
                                <p className="mt-1 text-lg font-black tabular-nums text-slate-900">{countLabel(value)}</p>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={handleCreateBackup}
                        disabled={busy || syncStatus !== 'ready'}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                        지금 수동 백업 저장
                    </button>
                    <p className="mt-2 text-[11px] leading-4 text-slate-400">
                        변경 사항을 저장할 때 이전 상태가 자동으로 보관됩니다. 수동 백업은 원하는 시점을 별도로 남길 때 사용하세요.
                    </p>
                </section>

                {preview && (
                    <section className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-black text-slate-900">백업 미리보기</h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    {formatDate(preview.created_at)} · 버전 {preview.source_version}
                                </p>
                            </div>
                            <button type="button" onClick={() => setPreview(null)} className="rounded-lg p-1 text-slate-500" aria-label="미리보기 닫기">×</button>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-2">
                            {previewCounts.map(([label, value]) => (
                                <div key={label} className="rounded-xl bg-white px-2 py-3 text-center">
                                    <p className="text-xs text-slate-500">{label}</p>
                                    <p className="mt-1 text-lg font-black tabular-nums text-slate-900">{countLabel(value)}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-black text-slate-800">백업 이력</h2>
                            <p className="mt-1 text-xs text-slate-400">자동 백업 최근 100건 · 수동 백업은 별도 보관</p>
                        </div>
                        <button
                            type="button"
                            onClick={loadBackups}
                            disabled={loading || busy}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-600 disabled:opacity-50"
                        >
                            <RefreshCw size={14} /> 새로고침
                        </button>
                    </div>

                    {errorMessage && (
                        <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
                            <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                            <Loader2 className="animate-spin" size={18} /> 백업 이력을 불러오는 중
                        </div>
                    ) : backups.length === 0 ? (
                        <div className="py-10 text-center">
                            <Clock3 className="mx-auto mb-2 text-slate-300" size={28} />
                            <p className="text-sm font-bold text-slate-600">저장된 백업이 없습니다.</p>
                            <p className="mt-1 text-xs text-slate-400">첫 수동 백업을 만들거나 데이터를 수정하면 백업 이력이 쌓입니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {backups.map((backup) => (
                                <article key={backup.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800">{backupTypeLabel(backup.backup_type)}</p>
                                            <p className="mt-1 text-xs text-slate-500">{formatDate(backup.created_at)} · 버전 {backup.source_version}</p>
                                        </div>
                                        <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-500">
                                            직원 {countLabel(backup.employees_count)}명
                                        </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-[11px] text-slate-400">
                                            지역 {countLabel(backup.regions_count)} · 팀 {countLabel(backup.teams_count)} · 노선 {countLabel(backup.routes_count)}
                                        </p>
                                        <div className="flex shrink-0 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handlePreview(backup.id)}
                                                disabled={busy}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 disabled:opacity-50"
                                            >
                                                <Eye size={14} /> 미리보기
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRestore(backup)}
                                                disabled={busy || syncStatus !== 'ready'}
                                                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-bold text-white disabled:opacity-50"
                                            >
                                                <RotateCcw size={14} /> 복구
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
