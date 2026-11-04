import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ExtraDayOffRequestsPanel({ teamId, onScheduleUpdated }) {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [notice, setNotice] = useState('');

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
        } catch (error) {
            console.error('추가휴무 요청 처리 실패:', error);
            setErrorMessage(error.message || '요청을 처리하지 못했습니다. 근무표가 변경되었는지 확인해주세요.');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm md:p-5">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-black text-slate-800">추가휴무 승인 요청</h3>
                    <p className="mt-1 text-xs text-slate-500">직원 요청을 승인하면 확정 근무표와 백업 배정에 반영됩니다.</p>
                </div>
                <div className="flex items-center gap-2">
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
