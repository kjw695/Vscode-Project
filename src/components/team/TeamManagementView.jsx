import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, PlusCircle, LogIn, Copy, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createTeam, joinTeamByCode, fetchMyVendorInfo, leaveTeam, requestTeamDeletion, cancelTeamDeletion, fetchTeamDeletionState, registerTeamLeaderCandidate, voteForTeamLeader } from '../../services/teamService';

const formatDeletionCountdown = (scheduledAt, nowMs) => {
    const deadline = Date.parse(scheduledAt || '');
    if (!Number.isFinite(deadline)) return '남은 시간 확인 중';

    const secondsLeft = Math.max(0, Math.floor((deadline - nowMs) / 1000));
    if (secondsLeft <= 0) return '삭제 처리 중';

    // Round up to the next minute so the display never shows 0분 with time remaining.
    const totalMinutesLeft = Math.ceil(secondsLeft / 60);
    const days = Math.floor(totalMinutesLeft / 1440);
    const hours = Math.floor((totalMinutesLeft % 1440) / 60);
    const minutes = totalMinutesLeft % 60;

    return `${days}일 ${hours}시간 ${minutes}분`;
};

const formatDeletionDeadline = (scheduledAt) => {
    const deadline = new Date(scheduledAt);
    if (Number.isNaN(deadline.getTime())) return '예정 시각 확인 중';

    return deadline.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// ✨ props에 onGoToAdmin 추가
export default function TeamManagementView({ onBack, isDarkMode, showMessage, onGoToAdmin, onGoToAccount }) {
    const { user: currentUser } = useAuth();

    const [vendorInfo, setVendorInfo] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    const [teamNameInput, setTeamNameInput] = useState('');
    const [inviteCodeInput, setInviteCodeInput] = useState('');
    const [copied, setCopied] = useState(false);
    const [deletionState, setDeletionState] = useState(null);
    const [clockNow, setClockNow] = useState(Date.now());
    const [actionLoading, setActionLoading] = useState(false);
// 초대 링크로 전달받은 코드를 가입 입력창에 자동으로 채웁니다.
// 실제 팀 가입은 사용자가 가입 버튼을 눌렀을 때만 진행합니다.
useEffect(() => {
    const applyInviteCode = (rawCode) => {
        const code = String(rawCode || '').trim();

        if (!code) return;

        setInviteCodeInput(code);

        // 입력창에 반영했으므로 임시 저장된 초대 코드를 정리합니다.
        try {
            const pendingCode = localStorage.getItem('pendingInviteCode');

            if (pendingCode === code) {
                localStorage.removeItem('pendingInviteCode');
            }
        } catch (error) {
            console.warn('[Invite] 임시 초대 코드 정리 실패:', error);
        }
    };

    // 앱을 열기 전에 전달받아 저장해 둔 초대 코드 확인
    try {
        const pendingCode = localStorage.getItem('pendingInviteCode');

        if (pendingCode) {
            applyInviteCode(pendingCode);
        }
    } catch (error) {
        console.warn('[Invite] 임시 초대 코드 확인 실패:', error);
    }

    // 화면이 열린 뒤 초대 링크 이벤트를 받는 경우도 처리
    const handleInviteLink = (event) => {
        const code = event.detail?.code;

        if (code) {
            applyInviteCode(code);
        }
    };

    window.addEventListener(
        'deliverytracker:invite-link',
        handleInviteLink
    );

    return () => {
        window.removeEventListener(
            'deliverytracker:invite-link',
            handleInviteLink
        );
    };
}, []);
    useEffect(() => {
        const loadVendor = async () => {
            if (!currentUser) {
                setVendorInfo(null);
                setRole(null);
                setDeletionState(null);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const info = await fetchMyVendorInfo(currentUser.id);
                setVendorInfo(info?.vendor ?? null);
                setRole(info?.role ?? null);

                try {
                    const state = await fetchTeamDeletionState();
                    setDeletionState(state?.active ? state : null);
                } catch (stateError) {
                    // A missing migration should not hide the user's existing team details.
                    console.warn("팀 삭제 상태를 불러오지 못했습니다:", stateError);
                    setDeletionState(null);
                }
            } catch (e) {
                console.error("벤더 정보 로드 실패:", e);
            } finally {
                setLoading(false);
            }
        };
        loadVendor();
    }, [currentUser]);

    // Show countdown changes every second while a deletion request is active.
    useEffect(() => {
        if (!deletionState?.active) return undefined;

        const timer = window.setInterval(() => {
            setClockNow(Date.now());
        }, 1000);

        return () => window.clearInterval(timer);
    }, [deletionState?.active]);

    // Refresh the election on this screen so other members see new votes or a transfer.
    useEffect(() => {
        if (!currentUser) return undefined;

        const refreshFromServer = async () => {
            try {
                const [info, state] = await Promise.all([
                    fetchMyVendorInfo(currentUser.id),
                    fetchTeamDeletionState()
                ]);

                setVendorInfo(info?.vendor ?? null);
                setRole(info?.role ?? null);
                setDeletionState(state?.active ? state : null);
            } catch (error) {
                console.warn("팀 삭제/투표 상태 갱신 실패:", error);
            }
        };

        const timer = window.setInterval(refreshFromServer, 15000);
        return () => window.clearInterval(timer);
    }, [currentUser]);

    const handleCreateTeam = async () => {
        if (!teamNameInput.trim()) {
            alert("팀(벤더) 이름을 입력해주세요.");
            return;
        }
        try {
            setLoading(true);
            const newTeam = await createTeam(teamNameInput.trim(), currentUser.id);
            setVendorInfo(newTeam);
            setRole('owner');
            if (showMessage) showMessage(`✅ "${newTeam.name}" 팀이 생성되었습니다!`);
            setTeamNameInput('');
        } catch (e) {
            alert("팀 생성 실패: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinTeam = async () => {
        const inviteCode = inviteCodeInput.trim();
        if (!inviteCode) {
            alert("초대 코드를 입력해주세요.");
            return;
        }
        try {
            setLoading(true);
            const res = await joinTeamByCode(inviteCode, currentUser.id);
            setVendorInfo(res.team);
            setRole('member');
            if (showMessage) showMessage(res.message);
            setInviteCodeInput('');
        } catch (e) {
            const errorMessage = String(e?.message || '');
            if (/팀 가입 전에 내 정보에서/.test(errorMessage)) {
                // Keep the invite code while routing the user to the required profile form.
                try {
                    localStorage.setItem('pendingInviteCode', inviteCode);
                    localStorage.setItem('returnToTeamAfterProfile', 'true');
                } catch (storageError) {
                    console.warn('[Invite] 가입 전 초대 코드 보존 실패:', storageError);
                }

                window.alert(
                    '팀 가입 전에 내 정보에서 이름과 아이디를 먼저 등록해주세요.\n확인을 누르면 내 정보 수정 화면으로 이동합니다.'
                );
                if (onGoToAccount) {
                    onGoToAccount();
                }
                return;
            }
            alert(errorMessage || '팀 가입에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

const handleCopyCode = async (code) => {
    const inviteCode = String(code || '').trim();

    if (!inviteCode) {
        window.alert('등록된 초대 코드가 없습니다.');
        return;
    }

    try {
        if (!navigator.clipboard?.writeText) {
            window.prompt('초대 코드를 복사하세요.', inviteCode);
            return;
        }

        await navigator.clipboard.writeText(inviteCode);

        setCopied(true);

        if (showMessage) {
            showMessage('📋 초대 코드가 복사되었습니다!');
        }

        setTimeout(() => setCopied(false), 2000);
    } catch (error) {
        window.prompt('초대 코드를 복사하세요.', inviteCode);
    }
};
    const refreshTeamState = async () => {
        if (!currentUser) return;

        const info = await fetchMyVendorInfo(currentUser.id);
        setVendorInfo(info?.vendor ?? null);
        setRole(info?.role ?? null);

        const state = await fetchTeamDeletionState();
        setDeletionState(state?.active ? state : null);
    };

    const handleRequestTeamDeletion = async () => {
        const confirmed = window.confirm(
            "팀 삭제를 신청할까요? 신청 후 7일 동안은 취소할 수 있습니다.\n" +
            "팀원 투표로 새 팀장이 선출되면 팀 삭제가 취소되고 팀은 유지됩니다."
        );
        if (!confirmed) return;

        try {
            setActionLoading(true);
            await requestTeamDeletion();
            await refreshTeamState();
            if (showMessage) {
                showMessage("🕒 팀 삭제 신청이 접수되었습니다. 7일 유예 기간이 시작되었습니다.");
            }
        } catch (error) {
            window.alert("팀 삭제 신청 실패: " + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancelTeamDeletion = async () => {
        if (!window.confirm("팀 삭제 신청을 취소하고 팀을 계속 운영할까요?")) return;

        try {
            setActionLoading(true);
            await cancelTeamDeletion();
            await refreshTeamState();
            if (showMessage) showMessage("✅ 팀 삭제 신청이 취소되었습니다.");
        } catch (error) {
            window.alert("삭제 신청 취소 실패: " + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRegisterTeamLeaderCandidate = async () => {
        if (!window.confirm("새 팀장 후보로 등록할까요? 등록 후 팀원들이 투표할 수 있습니다.")) return;

        try {
            setActionLoading(true);
            const state = await registerTeamLeaderCandidate();
            setDeletionState(state?.active ? state : null);
            if (showMessage) showMessage("✅ 팀장 후보로 등록되었습니다.");
        } catch (error) {
            window.alert("후보 등록 실패: " + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleVoteForTeamLeader = async (candidateUserId) => {
        if (!window.confirm("이 후보에게 투표할까요? 투표는 한 번만 할 수 있습니다.")) return;

        try {
            setActionLoading(true);
            const result = await voteForTeamLeader(candidateUserId);

            if (result?.transferred) {
                await refreshTeamState();
                if (showMessage) {
                    showMessage(`🎉 ${result.winner_display_name || '새 팀원'}님이 새 팀장으로 선출되었습니다. 팀은 유지됩니다.`);
                }
            } else if (result?.active) {
                setDeletionState(result);
                if (showMessage) showMessage("✅ 투표가 저장되었습니다.");
            } else {
                await refreshTeamState();
                if (showMessage) showMessage("투표 처리가 완료되었습니다.");
            }
        } catch (error) {
            window.alert("투표 실패: " + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeaveTeam = async () => {
        if (!window.confirm("정말 팀을 나가시겠습니까?")) return;
        try {
            setLoading(true);
            await leaveTeam(currentUser.id);
            setVendorInfo(null);
            setRole(null);
            if (showMessage) showMessage("👋 팀을 나왔습니다.");
        } catch (e) {
            alert("팀 나가기 실패: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`w-full max-w-4xl mx-auto p-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="text-2xl font-bold ml-2">팀 및 벤더 관리</h2>
            </div>

            {loading ? (
                <div className="py-20 text-center text-gray-400">불러오는 중...</div>
            ) : (
                <div className="space-y-6">
                    {vendorInfo ? (
                        <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-indigo-50/50 border-indigo-100'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                    <Users className="text-indigo-600" size={22} />
                                    <h3 className="font-black text-lg">{vendorInfo.name}</h3>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {role === 'owner' ? '팀장 (Owner)' : '팀원 (Member)'}
                                </span>
                            </div>

                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                                소속된 팀의 휴무 관리, 선호 요일 배치 및 교환 마켓 기능을 이용할 수 있습니다.
                            </div>

                            {deletionState?.active && (
                                <div className={`mt-4 p-4 rounded-2xl border ${isDarkMode ? 'bg-amber-950/30 border-amber-900' : 'bg-amber-50 border-amber-200'}`}>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="font-black text-sm">팀 삭제 신청 진행 중</p>
                                            <span className="text-xs font-bold text-amber-600 dark:text-amber-300">
                                                삭제 대기
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-300">
                                            최종 삭제까지 남은 시간
                                        </p>
                                        <p className="text-xl font-black text-amber-700 dark:text-amber-300">
                                            {formatDeletionCountdown(deletionState.scheduled_at, clockNow)}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            삭제 예정: {formatDeletionDeadline(deletionState.scheduled_at)}
                                        </p>
                                        {deletionState.failure_reason && (
                                            <p className="text-xs font-medium text-red-600 dark:text-red-300">
                                                최종 삭제 처리에서 문제가 발생했습니다. 관리자 확인이 필요하며, 처리가 완료될 때까지 팀 데이터는 유지됩니다.
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-900 space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-bold">팀장 선출 투표</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                참여 {deletionState.votes_cast || 0} / {deletionState.electorate_count || 0}명
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-300">
                                            투표 참여자가 전체 대상자의 과반수를 넘고, 후보 한 명이 유효 투표의 과반수를 얻으면 즉시 팀장 권한을 이전하고 팀 삭제를 취소합니다.
                                        </p>

                                        {role !== 'owner' &&
                                            !deletionState.my_is_candidate &&
                                            (deletionState.votes_cast || 0) === 0 && (
                                                <button
                                                    type="button"
                                                    disabled={actionLoading}
                                                    onClick={handleRegisterTeamLeaderCandidate}
                                                    className="w-full py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
                                                >
                                                    {actionLoading ? '처리 중...' : '팀장 후보로 등록하기'}
                                                </button>
                                            )}

                                        {role !== 'owner' &&
                                            !deletionState.my_is_candidate &&
                                            (deletionState.votes_cast || 0) > 0 && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    투표가 시작되어 후보 등록이 마감되었습니다.
                                                </p>
                                            )}

                                        {role !== 'owner' && deletionState.my_is_candidate && (
                                            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300">
                                                ✓ 팀장 후보로 등록되어 있습니다.
                                            </p>
                                        )}

                                        {(!deletionState.candidates || deletionState.candidates.length === 0) ? (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                아직 후보가 없습니다. 팀장을 맡을 팀원이 후보로 등록할 수 있습니다.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {deletionState.candidates.map((candidate) => (
                                                    <div
                                                        key={candidate.user_id}
                                                        className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-white/70 dark:bg-gray-900/50"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold break-words">{candidate.display_name}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                득표 {candidate.vote_count || 0}표
                                                            </p>
                                                        </div>

                                                        {deletionState.my_vote_for_user_id === candidate.user_id ? (
                                                            <span className="shrink-0 text-xs font-bold text-green-600 dark:text-green-400">
                                                                내 투표
                                                            </span>
                                                        ) : role !== 'owner' &&
                                                            !deletionState.my_vote_for_user_id ? (
                                                            <button
                                                                type="button"
                                                                disabled={actionLoading}
                                                                onClick={() => handleVoteForTeamLeader(candidate.user_id)}
                                                                className="shrink-0 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
                                                            >
                                                                투표하기
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {role === 'owner' && (
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={handleCancelTeamDeletion}
                                                className="w-full py-2.5 rounded-xl border border-red-300 text-red-600 dark:border-red-900 dark:text-red-300 text-xs font-bold disabled:opacity-50"
                                            >
                                                {actionLoading ? '처리 중...' : '팀 삭제 신청 취소'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                          {role === 'owner' && (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs font-bold mb-2">팀원 초대 코드</p>

        <div className="flex items-center space-x-2">
            <input
                type="text"
                readOnly
                value={vendorInfo?.invite_code || ''}
                placeholder="초대코드 없음"
                className={`min-w-0 flex-1 px-3 py-2 rounded-xl text-xs border ${
                    isDarkMode
                        ? 'bg-gray-900 border-gray-700 text-gray-300'
                        : 'bg-white border-gray-300'
                }`}
            />

            <button
                type="button"
                onClick={() => handleCopyCode(vendorInfo?.invite_code)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0"
            >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? '복사됨' : '복사'}</span>
            </button>
        </div>
    </div>
)}

                            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                {role === 'owner' ? (
                                    <div className="flex flex-col space-y-3">
                                        <button
                                            onClick={onGoToAdmin}
                                            className="w-full py-2.5 bg-gray-900 text-white dark:bg-gray-700 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                                        >
                                            ⚙️ 관리자센터 열기
                                        </button>

                                        {!deletionState?.active && (
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={handleRequestTeamDeletion}
                                                className="w-full py-2.5 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 rounded-xl text-xs font-bold border border-red-200 dark:border-red-900 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                {actionLoading ? '처리 중...' : '🗑️ 팀 삭제 신청 (7일 유예)'}
                                            </button>
                                        )}
                                    </div>
                                ) : deletionState?.active ? (
                                    <div className="space-y-2">
                                        <p className="text-xs text-amber-700 dark:text-amber-300">
                                            팀장 선출 및 삭제 유예 기간에는 팀원 변경을 잠시 제한합니다.
                                        </p>
                                        <button
                                            type="button"
                                            disabled
                                            className="w-full py-2.5 bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded-xl text-xs font-bold"
                                        >
                                            👋 팀 나가기 (일시 제한)
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleLeaveTeam}
                                        className="w-full py-2.5 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 rounded-xl text-xs font-bold border border-red-200 dark:border-red-900 transition-all active:scale-95"
                                    >
                                        👋 팀 나가기
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                <div className="flex items-center space-x-2 mb-3">
                                    <PlusCircle className="text-indigo-600" size={20} />
                                    <h4 className="font-bold text-base">새 팀(벤더) 만들기</h4>
                                </div>
                                <p className="text-xs text-gray-400 mb-4">팀을 직접 만들고 팀원들을 초대하여 휴무 조율을 시작하세요.</p>
                                <input 
                                    type="text"
                                    placeholder="팀 이름 입력 (예: 서울 1캠프 A조)"
                                    value={teamNameInput}
                                    onChange={(e) => setTeamNameInput(e.target.value)}
                                    className={`w-full px-3 py-2.5 rounded-xl text-xs border mb-3 ${isDarkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-300'}`}
                                />
                                <button 
                                    onClick={handleCreateTeam}
                                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md"
                                >
                                    팀 생성하기
                                </button>
                            </div>

                            <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                <div className="flex items-center space-x-2 mb-3">
                                    <LogIn className="text-indigo-600" size={20} />
                                    <h4 className="font-bold text-base">초대 코드로 가입하기</h4>
                                </div>
                                <p className="text-xs text-gray-400 mb-4">팀장에게 전달받은 초대 코드를 입력하여 팀에 합류하세요.</p>
                                <input 
                                    type="text"
                                    placeholder="초대 코드 입력 (ven_xxxxxx)"
                                    value={inviteCodeInput}
                                    onChange={(e) => setInviteCodeInput(e.target.value)}
                                    className={`w-full px-3 py-2.5 rounded-xl text-xs border mb-3 ${isDarkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-300'}`}
                                />
                                <button 
                                    onClick={handleJoinTeam}
                                    className="w-full py-2.5 bg-gray-800 dark:bg-gray-700 text-white rounded-xl text-xs font-bold shadow-md"
                                >
                                    팀 가입하기
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}