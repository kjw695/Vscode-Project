// src/admin/pages/EmployeeManager.jsx
import React, { useState } from 'react';
import { Users, Truck, ArrowLeft, UserPlus, X, Copy, CheckCircle2, Phone, MapPin, Route, Trash2, PauseCircle, PlayCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminData } from '../contexts/DataContext';

export default function EmployeeManager({ onBack }) {
    const { profile } = useAuth();
    const { employees, teams, updateEmployee, getEmployeeRouteNames } = useAdminData();
    
    const [activeTab, setActiveTab] = useState('base'); 
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [workDays, setWorkDays] = useState(5); 
    const [isBiweekly, setIsBiweekly] = useState(false);
    const [editType, setEditType] = useState('base'); 

    // 휴직 상태가 아닌 활성 직원들만 리스트에 노출하거나, 휴직 상태를 시각적으로 구분할 수 있습니다.
    const baseEmployees = employees.filter(e => e.type === 'base');
    const subEmployees = employees.filter(e => e.type === 'sub');

    const handleOpenModal = (emp) => {
        setSelectedEmployee(emp);
        setIsBiweekly(emp.pattern ? emp.pattern.includes('격주') : false);
        const match = emp.pattern ? emp.pattern.match(/\d/) : null;
        setWorkDays(match ? parseInt(match[0], 10) : 5);
        setEditType(emp.type || 'base');
    };

    const handleSaveEmployee = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const finalPattern = `${isBiweekly ? '격주' : '주'} ${workDays}일`;
        
        const newTeamId = formData.get('team_id');
        const newType = formData.get('type');
        const oldTeamId = selectedEmployee.team_id;
        
        const updatedData = {
            ...selectedEmployee,
            team_id: newTeamId,
            type: newType,
            pattern: finalPattern,
            target: newType === 'sub' ? formData.get('target' ) : '',
            phone: formData.get('phone'),
            route: formData.get('route'),
            region: formData.get('region')
        };

        updateEmployee(updatedData);

        if ((oldTeamId && oldTeamId !== newTeamId) || newType === 'sub') {
            if (oldTeamId !== newTeamId) {
                alert(`⚠️ 소속 지역이 변경되어 기존에 쥐고 있던 노선이 모두 자동 해제(공석) 처리되었습니다.`);
            } else if (newType === 'sub') {
                alert(`⚠️ 역할이 '대체 투입'으로 변경되어 기존 고정 노선이 자동 해제(공석) 처리되었습니다.`);
            }
        }

        setSelectedEmployee(null);
    };

    // ✨ 휴직 상태 토글 함수 (status를 'leave' 또는 'active'로 변경하여 스케줄 엔진 배치에서 제외)
    const handleToggleLeave = () => {
        if (!selectedEmployee) return;
        const currentStatus = selectedEmployee.status || 'active';
        const nextStatus = currentStatus === 'leave' ? 'active' : 'leave';

        const updatedData = {
            ...selectedEmployee,
            status: nextStatus
        };

        updateEmployee(updatedData);
        setSelectedEmployee(null);
        alert(nextStatus === 'leave' ? '해당 직원이 [휴직] 상태로 전환되어 스케줄 자동 배치에서 제외됩니다.' : '직원이 [근무 중] 상태로 복귀했습니다.');
    };

    // ✨ 직원 삭제 함수 (로컬스토리지나 데이터 훅을 통해 완전 삭제 처리)
    const handleDeleteEmployee = () => {
        if (!selectedEmployee) return;
        if (window.confirm(`정말 "${selectedEmployee.name}" 직원의 정보를 삭제하시겠습니까?`)) {
            // DataContext에 삭제 메서드가 있다면 호출하거나, 로컬 저장소 배열에서 필터링 후 업데이트
            const savedEmployees = JSON.parse(localStorage.getItem('admin_employees') || '[]');
            const filtered = savedEmployees.filter(e => e.id !== selectedEmployee.id);
            localStorage.setItem('admin_employees', JSON.stringify(filtered));
            
            setSelectedEmployee(null);
            window.location.reload(); // 새로고침하여 반영
        }
    };

    return (
        <div className="w-full h-full min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className="bg-white px-4 py-3 flex items-center shadow-sm relative z-10">
                <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="ml-2 text-xl font-black text-gray-800">직원 및 근무 패턴 관리</h1>
            </header>

            <div className="flex bg-white border-b px-4 mt-1">
                <button onClick={() => setActiveTab('base')} className={`flex-1 py-3 text-center font-bold border-b-2 transition-colors ${activeTab === 'base' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
                    고정 배송 ({baseEmployees.length})
                </button>
                <button onClick={() => setActiveTab('sub')} className={`flex-1 py-3 text-center font-bold border-b-2 transition-colors ${activeTab === 'sub' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500'}`}>
                    대체 투입 ({subEmployees.length})
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {(activeTab === 'base' ? baseEmployees : subEmployees).map(emp => {
                    const teamName = teams.find(t => t.id === emp.team_id)?.name || '미배정';
                    const isLeave = emp.status === 'leave';

                    return (
                        <div key={emp.id} onClick={() => handleOpenModal(emp)} className={`bg-white p-4 rounded-xl shadow-sm border flex flex-col gap-2 cursor-pointer transition-colors ${isLeave ? 'opacity-60 bg-gray-100 border-gray-200' : activeTab === 'base' ? 'hover:border-indigo-300 border-gray-100' : 'hover:border-amber-300 border-gray-100'}`}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-gray-800 flex items-center gap-1">
                                        <Users size={16} className={activeTab === 'base' ? "text-indigo-500" : "text-amber-500"}/> 
                                        {emp.name}
                                        {isLeave && <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] rounded-md font-bold">휴직중</span>}
                                        <span className="ml-1 text-xs text-gray-400 font-normal">({teamName})</span>
                                        {emp.id === profile?.id && <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-md font-black">나</span>}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                        {activeTab === 'base' ? (
                                            <><Truck size={14} /> 노선: {getEmployeeRouteNames(emp.id)}</>
                                        ) : (
                                            <>대체: {emp.target || '지정 안됨'}</>
                                        )}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-bold rounded-lg whitespace-nowrap ${activeTab === 'base' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                                    {emp.pattern}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                                <div className="flex items-center gap-1">
                                    <Phone size={12} className="text-gray-400" />
                                    <span className="truncate">{emp.phone || '연락처 없음'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Route size={12} className="text-gray-400" />
                                    <span className="truncate">노선: {emp.route || '미지정'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <MapPin size={12} className="text-gray-400" />
                                    <span className="truncate">지역: {emp.region || '미지정'}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <button onClick={() => setIsInviteModalOpen(true)} className="fixed bottom-6 right-6 px-5 h-14 bg-gray-900 text-white rounded-full shadow-xl flex items-center gap-2 hover:scale-105 transition-transform">
                <UserPlus size={22} /><span className="font-bold pr-1">팀원 초대</span>
            </button>

            {isInviteModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
                        <div className="p-5 flex justify-between items-center border-b">
                            <h2 className="font-bold text-lg">새로운 팀원 초대</h2>
                            <button onClick={() => setIsInviteModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                        </div>
                        <div className="p-5 flex flex-col items-center">
                            <p className="text-sm text-gray-500 text-center mb-4">아래 코드를 복사하여 팀원에게 전달하세요.</p>
                            <div className="bg-gray-100 px-6 py-4 rounded-xl w-full flex justify-between items-center mb-4">
                                <span className="font-black text-2xl tracking-widest text-gray-800">{profile?.invite_code || '초대코드 없음'}</span>
                                <button className="text-indigo-600 p-2 bg-indigo-50 rounded-lg hover:bg-indigo-100"><Copy size={20} /></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedEmployee && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 flex justify-between items-center border-b">
                            <h2 className="font-bold text-lg flex items-center gap-2"><Users size={20} className="text-gray-400"/> {selectedEmployee.name} 설정</h2>
                            <button onClick={() => setSelectedEmployee(null)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                        </div>
                        
                        <form onSubmit={handleSaveEmployee} className="p-5 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">소속 지역</label>
                                <select name="team_id" defaultValue={selectedEmployee.team_id || (teams[0]?.id || '')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-indigo-500 text-sm">
                                    {teams.map(team => (<option key={team.id} value={team.id}>{team.name}</option>))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">역할 (필수)</label>
                                    <select name="type" value={editType} onChange={(e) => setEditType(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 font-medium outline-none focus:border-indigo-500 text-sm">
                                        <option value="base">고정 배송</option>
                                        <option value="sub">대체 투입</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">연락처</label>
                                    <input type="text" name="phone" defaultValue={selectedEmployee.phone || ''} placeholder="010-0000-0000" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 font-medium outline-none focus:border-indigo-500 text-sm" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">라우트 (노선)</label>
                                    <input type="text" name="route" defaultValue={selectedEmployee.route || ''} placeholder="예: A-1구역" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 font-medium outline-none focus:border-indigo-500 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">지역 (권역)</label>
                                    <input type="text" name="region" defaultValue={selectedEmployee.region || ''} placeholder="예: 서울 강남" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 font-medium outline-none focus:border-indigo-500 text-sm" />
                                </div>
                            </div>

                            {editType === 'sub' && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                    <label className="block text-xs font-bold text-amber-700 mb-1.5">대체 투입 담당 구역/역할</label>
                                    <input type="text" name="target" defaultValue={selectedEmployee.target || ''} placeholder="예: 청주 전지역 백업" className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-amber-500 text-sm"/>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2">근무 패턴 설정</label>
                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between bg-gray-100 p-1 rounded-xl">
                                        {[1, 2, 3, 4, 5, 6].map(day => (
                                            <button type="button" key={day} onClick={() => setWorkDays(day)} className={`flex-1 h-10 rounded-lg font-black text-sm transition-all ${workDays === day ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-gray-500 hover:bg-gray-200'}`}>
                                                {day}일
                                            </button>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => setIsBiweekly(!isBiweekly)} className={`w-full py-3 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2 ${isBiweekly ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white text-gray-500 border-gray-300'}`}>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isBiweekly ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                                            {isBiweekly && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                        </div>
                                        이 패턴을 '격주'로 적용하기
                                    </button>
                                </div>
                                <div className="mt-3 text-center">
                                    <span className="text-xs text-gray-500">최종 적용 패턴: </span>
                                    <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{isBiweekly ? `격주 ${workDays}일` : `주 ${workDays}일`} 근무</span>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2 mt-2">
                                <CheckCircle2 size={20}/> 변경 사항 저장
                            </button>
                        </form>

                        {/* ✨ 모달 하단 휴직 처리 및 삭제 버튼 영역 */}
                        <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/50">
                            <button 
                                type="button" 
                                onClick={handleToggleLeave}
                                className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                                    selectedEmployee.status === 'leave' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                            >
                                {selectedEmployee.status === 'leave' ? <><PlayCircle size={15}/> 복직 처리</> : <><PauseCircle size={15}/> 휴직 처리 (배치제외)</>}
                            </button>

                            <button 
                                type="button" 
                                onClick={handleDeleteEmployee}
                                className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold border border-red-200 transition-all flex items-center gap-1"
                            >
                                <Trash2 size={15} /> 삭제하기
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}