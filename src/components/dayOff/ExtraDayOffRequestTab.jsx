import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { fetchMyOrganizationWeeklySchedules } from '../../services/organizationScheduleService';

function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

const STATUS_LABELS = {
    pending: '관리자 승인 대기',
    approved: '승인 완료',
    declined: '거절됨',
    cancelled: '취소됨'
};

function statusClass(status) {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'declined' || status === 'cancelled') return 'bg-slate-100 text-slate-600';
    return 'bg-amber-100 text-amber-800';
}

export default function ExtraDayOffRequestTab({ currentUser, teamId }) {
    const today = useMemo(() => formatLocalDate(new Date()), []);
    const [requestedDate, setRequestedDate] = useState(() => {
        const next = new Date();
        next.setDate(next.getDate() + 1);
        return formatLocalDate(next);
    });
    const [note, setNote] = useState('');
    const [dayStatus, setDayStatus] = useState(null);
    const [isCheckingDate, setIsCheckingDate] = useState(false);
    const [requests, setRequests] = useState([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [notice, setNotice] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const loadRequests = useCallback(async () => {
        if (!currentUser?.id || !teamId) {
            setRequests([]);
            return;
        }
        setIsLoadingRequests(true);
        setErrorMessage('');
        try {
            const { data, error } = await supabase.rpc('list_my_extra_day_off_requests');
            if (error) throw error;
            setRequests(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('추가휴무 요청 내역 조회 실패:', error);
            setErrorMessage(error.message || '추가휴무 요청 내역을 불러오지 못했습니다.');
        } finally {
            setIsLoadingRequests(false);
        }
    }, [currentUser?.id, teamId]);

    useEffect(() => {
        loadRequests();
        const interval = window.setInterval(loadRequests, 30000);
        return () => window.clearInterval(interval);
    }, [loadRequests]);

    useEffect(() => {
        if (!teamId || !currentUser?.id || !requestedDate) {
            setDayStatus(null);
            return undefined;
        }

        let active = true;
        setIsCheckingDate(true);
        setDayStatus(null);

        fetchMyOrganizationWeeklySchedules(requestedDate, requestedDate)
            .then((rows) => {
                if (!active) return;
                const scheduleRow = (rows || []).find((row) =>
                    row.status === 'confirmed' && row.schedule &&
                    Object.prototype.hasOwnProperty.call(row.schedule, requestedDate)
                );
                if (!scheduleRow) {
                    setDayStatus({ status: 'unpublished' });
                    return;
                }
                setDayStatus({
                    status: scheduleRow.schedule[requestedDate]?.status || 'unpublished',
                    teamLabel: scheduleRow.team_label
                });
            })
            .catch((error) => {
                console.error('추가휴무 날짜 확인 실패:', error);
                if (active) setDayStatus({ status: 'error' });
            })
            .finally(() => {
                if (active) setIsCheckingDate(false);
            });

        return () => {
            active = false;
        };
    }, [teamId, currentUser?.id, requestedDate]);

    const canRequest = dayStatus && ['work', 'backup'].includes(dayStatus.status);

    const handleSubmit = async () => {
        if (!canRequest || isSubmitting) return;
        setIsSubmitting(true);
        setNotice('');
        setErrorMessage('');
        try {
            const { error } = await supabase.rpc('create_extra_day_off_request', {
                p_requested_date: requestedDate,
                p_note: note.trim() || null
            });
            if (error) throw error;
            setNotice(requestedDate + ' 추가휴무 요청을 관리자에게 보냈습니다.');
            setNote('');
            await loadRequests();
        } catch (error) {
            console.error('추가휴무 요청 실패:', error);
            setErrorMessage(error.message || '추가휴무 요청을 보내지 못했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = async (requestId) => {
        if (!window.confirm('이 추가휴무 요청을 취소할까요?')) return;
        setBusyId(requestId);
        setNotice('');
        setErrorMessage('');
        try {
            const { error } = await supabase.rpc('cancel_my_extra_day_off_request', {
                p_request_id: requestId
            });
            if (error) throw error;
            setNotice('추가휴무 요청을 취소했습니다.');
            await loadRequests();
        } catch (error) {
            console.error('추가휴무 요청 취소 실패:', error);
            setErrorMessage(error.message || '요청을 취소하지 못했습니다.');
        } finally {
            setBusyId(null);
        }
    };

    if (!teamId) {
        return (
            <div className="p-4 text-sm text-gray-500">
                추가휴무 요청은 회사 팀에 가입한 직원 계정에서 사용할 수 있습니다.
            </div>
        );
    }

    const selectedStatusLabel = isCheckingDate
        ? '근무표 확인 중...'
        : !dayStatus
            ? '날짜를 선택해주세요.'
            : dayStatus.status === 'work'
                ? '근무일'
                : dayStatus.status === 'backup'
                    ? '백업근무일'
                    : dayStatus.status === 'off'
                        ? '이미 확정된 휴무'
                        : dayStatus.status === 'error'
                            ? '근무표 조회 실패'
                            : '관리자 확정 근무표 없음';

    return (
        <div className="space-y-5 p-4">
            <section>
                <h2 className="text-xl font-bold">추가휴무 요청</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                    확정 근무표에서 근무 또는 백업근무로 배정된 날짜를 선택해 요청하세요.
                    관리자 승인 전까지 근무표는 바뀌지 않습니다.
                </p>
            </section>

            {notice && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
                    {notice}
                </div>
            )}
            {errorMessage && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
                    {errorMessage}
                </div>
            )}

            <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <label className="block text-sm font-bold" htmlFor="extra-day-off-date">
                    추가휴무를 원하는 날짜
                </label>
                <input
                    id="extra-day-off-date"
                    type="date"
                    min={today}
                    value={requestedDate}
                    onChange={(event) => setRequestedDate(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2.5 text-sm dark:bg-gray-800">
                    <span className="text-gray-500">확정 근무표 상태</span>
                    <span className={'font-bold ' + (
                        canRequest ? 'text-emerald-700 dark:text-emerald-300' :
                        dayStatus?.status === 'off' ? 'text-rose-600' : 'text-gray-500'
                    )}>
                        {selectedStatusLabel}
                    </span>
                </div>
                <label className="mt-4 block text-sm font-bold" htmlFor="extra-day-off-note">
                    요청 사유 <span className="font-normal text-gray-400">(선택)</span>
                </label>
                <textarea
                    id="extra-day-off-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="관리자에게 전달할 내용이 있으면 입력하세요."
                    className="mt-2 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-800"
                />
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canRequest || isSubmitting || isCheckingDate}
                    className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {isSubmitting ? '요청 전송 중...' : '추가휴무 요청 보내기'}
                </button>
                <p className="mt-2 text-[11px] leading-5 text-gray-400">
                    요청이 승인되면 해당 날짜가 휴무로 변경되고 백업 배정이 다시 계산됩니다.
                    백업이 부족하면 관리자에게 확인 경고가 표시됩니다.
                </p>
            </section>

            <section>
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-bold">내 추가휴무 요청 내역</h3>
                    <button
                        type="button"
                        onClick={loadRequests}
                        disabled={isLoadingRequests}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold dark:border-gray-600"
                    >
                        {isLoadingRequests ? '확인 중...' : '새로고침'}
                    </button>
                </div>
                {isLoadingRequests && requests.length === 0 ? (
                    <p className="py-3 text-sm text-gray-500">요청 내역을 불러오는 중...</p>
                ) : requests.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                        추가휴무 요청 내역이 없습니다.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {requests.map((request) => (
                            <article key={request.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold">{request.requested_date}</span>
                                    <span className={'rounded-full px-2 py-1 text-[11px] font-bold ' + statusClass(request.status)}>
                                        {STATUS_LABELS[request.status] || request.status}
                                    </span>
                                </div>
                                {request.note && <p className="mt-2 whitespace-pre-wrap text-xs text-gray-500">{request.note}</p>}
                                {request.status === 'pending' && (
                                    <button
                                        type="button"
                                        onClick={() => handleCancel(request.id)}
                                        disabled={busyId === request.id}
                                        className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold dark:border-gray-600"
                                    >
                                        {busyId === request.id ? '취소 중...' : '요청 취소'}
                                    </button>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
