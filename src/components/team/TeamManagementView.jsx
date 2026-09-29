import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, PlusCircle, LogIn, Copy, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createTeam, joinTeamByCode, fetchMyVendorInfo, deleteTeam, leaveTeam } from '../../services/teamService';

export default function TeamManagementView({ onBack, isDarkMode, showMessage }) {
    const { user: currentUser } = useAuth();

    const [vendorInfo, setVendorInfo] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    const [teamNameInput, setTeamNameInput] = useState('');
    const [inviteCodeInput, setInviteCodeInput] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const loadVendor = async () => {
            if (!currentUser) return;
            try {
                setLoading(true);
                const info = await fetchMyVendorInfo(currentUser.id);
                if (info) {
                    setVendorInfo(info.vendor);
                    setRole(info.role);
                }
            } catch (e) {
                console.error("벤더 정보 로드 실패:", e);
            } finally {
                setLoading(false);
            }
        };
        loadVendor();
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
        if (!inviteCodeInput.trim()) {
            alert("초대 코드를 입력해주세요.");
            return;
        }
        try {
            setLoading(true);
            const res = await joinTeamByCode(inviteCodeInput.trim(), currentUser.id);
            setVendorInfo(res.team);
            setRole('member');
            if (showMessage) showMessage(res.message);
            setInviteCodeInput('');
        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

   const handleCopyCode = (code) => {
        navigator.clipboard.writeText(`${window.location.origin}/?code=${code}`);
        setCopied(true);
        if (showMessage) showMessage("📋 초대 링크가 복사되었습니다!");
        setTimeout(() => setCopied(false), 2000);
    };

    // 팀 삭제 핸들러 (팀장용)
    const handleDeleteTeam = async () => {
        if (!window.confirm("정말 팀을 삭제하시겠습니까? 모든 팀원의 소속이 해제됩니다.")) return;
        try {
            setLoading(true);
            await deleteTeam(vendorInfo.id, currentUser.id);
            setVendorInfo(null);
            setRole(null);
            if (showMessage) showMessage("🗑️ 팀이 삭제되었습니다.");
        } catch (e) {
            alert("팀 삭제 실패: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // 팀 나가기 핸들러 (팀원용)
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

                            {role === 'owner' && (
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <p className="text-xs font-bold mb-2">팀원 초대 링크</p>
                                    <div className="flex items-center space-x-2">
                                        <input 
                                            type="text" 
                                            readOnly 
                                            value={`${window.location.origin}/?code=${vendorInfo.invite_code}`}
                                            className={`w-full px-3 py-2 rounded-xl text-xs border ${isDarkMode ? 'bg-gray-900 border-gray-700 text-gray-300' : 'bg-white border-gray-300'}`}
                                        />
                                        <button 
                                            onClick={() => handleCopyCode(vendorInfo.invite_code)}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0"
                                        >
                                            {copied ? <Check size={14} /> : <Copy size={14} />}
                                            <span>{copied ? '복사됨' : '복사'}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* ✨ 팀장: 팀 삭제 / 팀원: 팀 나가기 버튼 추가 */}
                            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                {role === 'owner' ? (
                                    <button 
                                        onClick={handleDeleteTeam}
                                        className="w-full py-2.5 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 rounded-xl text-xs font-bold border border-red-200 dark:border-red-900 transition-all active:scale-95"
                                    >
                                        🗑️ 팀 삭제하기 (팀장 전용)
                                    </button>
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