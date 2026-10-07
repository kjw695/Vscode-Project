// src/admin/Settings.jsx
import React, { useState } from 'react';
import { ArrowLeft, Settings as SettingsIcon, Save, RefreshCw, Plus, Trash2, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from './contexts/DataContext';

export default function Settings({ onBack }) {
    const { profile } = useAuth();
    const { teams, setTeams } = useData();
    const [newTeamName, setNewTeamName] = useState('');

    const handleAddTeam = (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const newTeam = { id: `T${Date.now()}`, name: newTeamName.trim() };
    
    // teams가 배열이 아닐 경우(데이터 로딩 전 등)를 대비해 안전하게 처리합니다.
    setTeams([...(Array.isArray(teams) ? teams : []), newTeam]);
    setNewTeamName('');
};

    const handleDeleteTeam = (id) => {
        if (teams.length <= 1) {
            alert('⚠️ 최소 1개의 팀은 유지되어야 합니다.');
            return;
        }
        if (window.confirm('이 지역을 정말 삭제하시겠습니까?')) {
            setTeams(teams.filter(t => t.id !== id));
        }
    };

    const handleRegenerateCode = () => {
        alert("이 기능은 DB(Supabase) 업데이트 로직이 연결된 후 작동합니다.");
    };

    const handleSaveAll = () => {
        alert("✅ 모든 설정이 안전하게 저장되었습니다. (DataContext가 실시간 동기화 중입니다)");
    };

    return (
        <div className="w-full h-full min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className="bg-white px-4 py-3 flex items-center shadow-sm relative z-10">
                <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="ml-2 text-xl font-black text-gray-800 flex items-center gap-2">
                    <SettingsIcon size={22} className="text-gray-600" /> 팀 및 지역 설정
                </h1>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-24">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="font-bold text-gray-800 mb-4">DB 연동 기본 정보</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">팀 이름</label>
                            <input type="text" value={profile?.team_name || '팀 이름 없음'} disabled className="w-full bg-gray-100 text-gray-600 border border-gray-200 rounded-xl px-4 py-3 font-medium outline-none cursor-not-allowed"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">관리자</label>
                            <input type="text" value={profile?.full_name || '관리자'} disabled className="w-full bg-gray-100 text-gray-500 border border-gray-200 rounded-xl px-4 py-3 font-medium cursor-not-allowed"/>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <MapPin size={18} className="text-indigo-600"/> 관리 구역(지역) 설정
                    </h2>
                    <form onSubmit={handleAddTeam} className="flex gap-2 mb-4">
                        <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="예: 천안팀, 서울지부" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 font-medium outline-none focus:border-indigo-500"/>
                        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1 hover:bg-indigo-700 whitespace-nowrap">
                            <Plus size={18} /> 추가
                        </button>
                    </form>
                    <div className="space-y-2">
                        {teams?.map(team => (
                            <div key={team.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="font-bold text-gray-700">{team.name}</span>
                                <button type="button" onClick={() => handleDeleteTeam(team.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-bold text-gray-800">팀 초대 코드 관리</h2>
                        <button onClick={handleRegenerateCode} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                            <RefreshCw size={12}/> 재발급
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">현재 작동 중인 DB 연동 초대 코드입니다.</p>
                    <div className="bg-gray-100 px-4 py-3 rounded-xl w-full text-center">
                        <span className="font-black text-xl tracking-widest text-gray-800">{profile?.invite_code || '초대코드 없음'}</span>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
                <button onClick={handleSaveAll} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2">
                    <Save size={20}/> 모든 설정 저장
                </button>
            </div>
        </div>
    );
}