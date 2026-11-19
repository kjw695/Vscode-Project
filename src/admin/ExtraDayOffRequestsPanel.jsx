import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ExtraDayOffRequestsPanel({ teamId, onScheduleUpdated }) {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [notice, setNotice] = useState('');
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyRows, setHistoryRows] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const loadRequests = useCallback(async () => {
        if (!teamId) {
            setRequests([]);
            return;
        }
        setIsLoading(true);
        setErrorMessage('');
        try {
            const { data, error } = await supabase.rpc(
                'list_pending_organization_extra_day_off_requests',
                { p_team_id: String(teamId) }
            );
            if (error) throw error;
            setRequests(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('추가휴무 승인 요청 조회 실패:', error);
            setErrorMessage(error.message || '추가휴무 승인 요청을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [teamId]);

    useEffect(() => {
        loadRequests();
        const timer = window.setInterval(loadRequests, 30000);
        return () => window.clearInterval(timer);
    }, [loadRequests]);

    const loadHistory = useCallback(async () => {
        if (!teamId) {
            setHistoryRows([]);
            return;
        }
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase.rpc(
                'list_my_organization_day_off_request_history',
                { p_team_id: String(teamId), p_limit: 50 }
            );
            if (error) throw error;
            setHistoryRows(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('휴무 요청 처리 이력 조회 실패:', error);
            setErrorMessage(error.message || '휴무 요청 처리 이력을 불러오지 못했습니다.');
        } finally {
            setHistoryLoading(false);
        }
    }, [teamId]);

    useEffect(() => {
        if (historyOpen) loadHistory();
    }, [historyOpen, loadHistory]);

    const handleRespond = async (request, response) => {
        const approving = response === 'approved';
        const prompt = approving
            ? request.requested_date + ' / ' + request.employee_name + ' 직원의 추가휴무를 승인할까요?\n승인하면 확정 근무표에 즉시 반영됩니다.'
            : request.employee_name + ' 직원의 추가휴무 요청을 거절할까요?';
        if (!window.confirm(prompt)) return;

        setBusyId(request.id);
        setErrorMessage('');
        setNotice('');
        try {
            const { data, error } = await supabase.rpc('respond_to_extra_day_off_request', {
                p_request_id: request.id,
                p_response: response
            });
            if (error) throw error;
            if (approving) {
                const warning = data?.has_shortage
                    ? ' 승인했지만 백업 인원이 부족합니다. 근무표의 백업 경고를 확인해주세요.'
                    : ' 근무표와 백업 배정을 갱신했습니다.';
                setNotice(request.employee_name + ' 직원의 ' + request.requested_date + ' 추가휴무를 승인했습니다.' + warning);
                if (onScheduleUpdated) onScheduleUpdated(data);
            } else {
                setNotice('추가휴무 요청을 거절했습니다.');
            }
            await loadRequests();
            if (historyOpen) await loadHistory();
        } catch (error) {
            console.error('추가휴무 요청 처리 실패:', error);
            setErrorMessage(error.message || '요청을 처리하지 못했습니다. 근무표가 변경되었는지 확인해주세요.');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-black text-slate-800">추가휴무 승인 요청</h3>
                    <p className="mt-1 text-xs text-slate-500">직원 요청을 승인하면 확정 근무표와 백업 배정에 반영됩니다.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setHistoryOpen((current) => !current)}
                        className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700"
                    >
                        {historyOpen ? '이력 닫기' : '휴무 요청 처리 이력'}
                    </button>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">{requests.length}건</span>
                    <button
                        type="button"
                        onClick={loadRequests}
                        disabled={isLoading}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-50"
                    >
                        {isLoading ? '확인 중' : '새로고침'}
                    </button>
                </div>
            </div>

            {notice && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800" role="status">{notice}</p>}
            {errorMessage && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs leading-5 text-rose-700" role="alert">{errorMessage}</p>}

            {historyOpen && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                            <h4 className="text-xs font-extrabold text-slate-700">휴무 요청 전체 처리 이력</h4>
                            <p className="mt-0.5 text-[10px] text-slate-400">추가휴무 승인·거절과 직원 간 휴무 교환</p>
                        </div>
                        <button
                            type="button"
                            onClick={loadHistory}
                            disabled={historyLoading}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-600 disabled:opacity-50"
                        >
                            {historyLoading ? '조회 중' : '새로고침'}
                        </button>
                    </div>
                    {historyLoading && historyRows.length === 0 ? (
                        <p className="py-4 text-center text-xs text-slate-400">처리 이력을 불러오는 중...</p>
                    ) : historyRows.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-center text-xs text-slate-400">표시할 휴무 요청 이력이 없습니다.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {historyRows.map((row) => {
                                const isExchange = row.request_type === 'day_off_exchange';
                                const statusLabels = {
                                    pending: '대기',
                                    approved: '승인',
                                    accepted: '교환 완료',
                                    declined: '거절',
                                    cancelled: '취소'
                                };
                                const statusTone = row.status === 'approved' || row.status === 'accepted'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : row.status === 'declined' || row.status === 'cancelled'
                                        ? 'bg-slate-200 text-slate-600'
                                        : 'bg-amber-100 text-amber-700';
                                return (
                                    <article key={row.request_type + ':' + row.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white p-2.5">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-800">
                                                {isExchange ? '휴무 교환' : '추가휴무'}
                                                <span className="ml-1.5 font-normal text-slate-400">{row.team_label || ''}</span>
                                            </p>
                                            <p className="mt-1 text-[11px] leading-5 text-slate-600">
                                                {isExchange
                                                    ? (row.requester_name || '신청 직원') + ' → ' + (row.receiver_name || '상대 직원') + ' · ' + row.source_date + ' ↔ ' + row.target_date
                                                    : (row.requester_name || '직원') + ' · ' + row.source_date}
                                            </p>
                                            <p className="mt-0.5 text-[10px] text-slate-400">
                                                {row.responded_at ? new Date(row.responded_at).toLocaleString('ko-KR') : new Date(row.created_at).toLocaleString('ko-KR')}
                                            </p>
                                            {row.note && <p className="mt-1 text-[10px] text-slate-400">사유: {row.note}</p>}
                                        </div>
                                        <span className={'shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ' + statusTone}>
                                            {statusLabels[row.status] || row.status}
                                        </span>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {isLoading && requests.length === 0 ? (
                <p className="py-5 text-center text-sm text-slate-400">요청을 불러오는 중...</p>
            ) : requests.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                    현재 대기 중인 추가휴무 요청이 없습니다.
                </p>
            ) : (
                <div className="mt-3 space-y-2">
                    {requests.map((request) => (
                        <article key={request.id} className="rounded-xl border border-slate-200 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-800">{request.employee_name}</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-600">{request.requested_date} <span className="text-xs font-normal text-slate-400">({request.team_label})</span></p>
                                    {request.note && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">사유: {request.note}</p>}
                                </div>
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">승인 대기</span>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleRespond(request, 'approved')}
                                    disabled={busyId === request.id}
                                    className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                                >
                                    {busyId === request.id ? '처리 중...' : '승인 및 근무표 반영'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRespond(request, 'declined')}
                                    disabled={busyId === request.id}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
                                >
                                    거절
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
