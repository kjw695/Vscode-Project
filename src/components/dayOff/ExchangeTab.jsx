import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import MyExchange from './MyExchange';
import ExchangeFeed from './ExchangeFeed';

export default function ExchangeTab({ currentUser, teamId }) {
    const [exchanges, setExchanges] = useState([]);
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [notice, setNotice] = useState('');

    const memberNames = useMemo(() => {
        const names = {};
        members.forEach((member) => {
            names[member.member_id] = member.member_display_name || '팀원';
        });
        if (currentUser?.id && !names[currentUser.id]) {
            names[currentUser.id] = currentUser.user_metadata?.full_name || '나';
        }
        return names;
    }, [members, currentUser]);

    const loadData = useCallback(async () => {
        if (!currentUser?.id || !teamId) {
            setExchanges([]);
            setMembers([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setErrorMessage('');
        try {
            const { data: exchangeData, error: exchangeError } = await supabase
                .from('shift_exchanges')
                .select('id, requester_id, receiver_id, team_id, source_date, target_date, status, created_at')
                .eq('team_id', teamId)
                .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
                .order('created_at', { ascending: false });

            if (exchangeError) throw exchangeError;
            setExchanges(exchangeData || []);

            const { data: memberData, error: memberError } = await supabase.rpc('list_my_organization_members');
            if (memberError) {
                console.warn('팀원 이름 조회 실패:', memberError.message);
                setMembers([]);
            } else {
                setMembers(memberData || []);
            }
        } catch (error) {
            console.error('휴무 교환 내역 조회 실패:', error);
            setErrorMessage('교환 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, teamId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRespond = async (exchangeId, response) => {
        const isAccepting = response === 'accepted';
        const prompt = isAccepting
            ? '수락하면 두 사람의 등록된 휴무 날짜가 실제로 교환됩니다. 진행할까요?'
            : '이 휴무 교환 신청을 거절할까요?';
        if (!window.confirm(prompt)) return;

        setBusyId(exchangeId);
        setErrorMessage('');
        setNotice('');
        try {
            const { error } = await supabase.rpc('respond_to_shift_exchange', {
                p_exchange_id: exchangeId,
                p_response: response
            });
            if (error) throw error;
            setNotice(isAccepting ? '휴무 날짜 교환이 완료되었습니다.' : '교환 신청을 거절했습니다.');
            await loadData();
        } catch (error) {
            console.error('교환 응답 처리 실패:', error);
            setErrorMessage(error.message || '요청을 처리하지 못했습니다. 휴무 날짜와 회사 소속을 확인해 주세요.');
        } finally {
            setBusyId(null);
        }
    };

    const handleCancel = async (exchangeId) => {
        if (!window.confirm('이 대기 중인 교환 신청을 취소할까요?')) return;

        setBusyId(exchangeId);
        setErrorMessage('');
        setNotice('');
        try {
            const { error } = await supabase
                .from('shift_exchanges')
                .delete()
                .eq('id', exchangeId)
                .eq('requester_id', currentUser.id)
                .eq('status', 'pending');
            if (error) throw error;
            setNotice('교환 신청을 취소했습니다.');
            await loadData();
        } catch (error) {
            console.error('교환 신청 취소 실패:', error);
            setErrorMessage(error.message || '신청을 취소하지 못했습니다.');
        } finally {
            setBusyId(null);
        }
    };

    if (!teamId) {
        return (
            <div className="p-4 text-sm text-gray-500">
                휴무 교환 기능은 회사 팀에 가입한 계정에서 사용할 수 있습니다.
            </div>
        );
    }

    const outgoingRequests = exchanges.filter((item) => item.requester_id === currentUser?.id);
    const incomingRequests = exchanges.filter((item) => item.receiver_id === currentUser?.id);

    return (
        <div className="space-y-6 p-4">
            <div>
                <h2 className="text-xl font-bold mb-1">휴무 교환</h2>
                <p className="text-xs text-gray-500">달력에서 상대방이 실제로 등록한 휴무를 선택해 신청할 수 있습니다.</p>
            </div>

            {notice && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">
                    {notice}
                </div>
            )}
            {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                    {errorMessage}
                </div>
            )}

            <ExchangeFeed
                currentUser={currentUser}
                marketFeeds={incomingRequests}
                loading={isLoading}
                busyId={busyId}
                memberNames={memberNames}
                onRespond={handleRespond}
            />

            <div className="border-t border-gray-200 dark:border-gray-700" />

            <MyExchange
                currentUser={currentUser}
                myPosts={outgoingRequests}
                loading={isLoading}
                busyId={busyId}
                memberNames={memberNames}
                onCancel={handleCancel}
            />

            <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-600"
            >
                {isLoading ? '불러오는 중...' : '교환 내역 새로고침'}
            </button>
        </div>
    );
}
