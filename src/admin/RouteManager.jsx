// src/admin/RouteManager.jsx
import React, { useState } from 'react';
import { Map, ArrowLeft, Truck, Plus, Trash2, X, CheckCircle2 } from 'lucide-react';
import { useAdminData } from './contexts/DataContext';

export default function RouteManager({ onBack }) {
    const { routes, setRoutes, employees, assignRoute, teams } = useAdminData();
    
    const [selectedTeam, setSelectedTeam] = useState(teams && teams.length > 0 ? teams[0].id : 'T1');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const filteredRoutes = routes.filter(r => r.team_id === selectedTeam);
    const teamEmployees = employees.filter(e => e.team_id === selectedTeam && e.type === 'base');

    const handleAssign = (routeId, empId) => {
        const finalEmpId = empId === "" ? null : (isNaN(Number(empId)) ? empId : Number(empId));
        const targetRoute = routes.find(r => r.id === routeId);

        // 중복 배차 경고 검증
        let duplicateMsg = "";
        if (finalEmpId !== null) {
            const existingRoutes = routes.filter(r => r.id !== routeId && String(r.assigned_emp_id) === String(finalEmpId));
            if (existingRoutes.length > 0) {
                const routeNames = existingRoutes.map(r => r.name).join(', ');
                duplicateMsg = `\n\n⚠️ [중복 배차 알림]\n해당 기사님은 이미 다른 노선(${routeNames})을 맡고 있습니다.`;
            }
        }

        assignRoute(routeId, empId);

        if (finalEmpId === null) {
            alert(`🗑️ [${targetRoute.name}] 노선이 공석으로 변경되었습니다.`);
        } else {
            const targetEmp = employees.find(e => String(e.id) === String(finalEmpId));
            alert(`✅ [${targetRoute.name}] 노선 ➡️ [${targetEmp?.name}] 기사님 배정 완료!${duplicateMsg}`);
        }
    };

    const handleAddRoute = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newRoute = {
            id: 'R_' + Date.now(),
            name: formData.get('name'),
            description: formData.get('description'),
            team_id: selectedTeam,
            assigned_emp_id: null
        };
        setRoutes([...routes, newRoute]);
        setIsAddModalOpen(false);
    };

    const handleDeleteRoute = (routeId) => {
        if (window.confirm('정말 이 노선을 삭제하시겠습니까?')) {
            setRoutes(routes.filter(r => r.id !== routeId));
        }
    };

    return (
        <div className="w-full h-full min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className="bg-white px-4 py-3 flex items-center shadow-sm relative z-10">
                <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="ml-2 text-xl font-black text-gray-800">노선 및 배치 관리</h1>
            </header>

            <div className="flex bg-white border-b px-4 pt-2 gap-2 overflow-x-auto">
                {teams.map(team => (
                    <button key={team.id} onClick={() => setSelectedTeam(team.id)} className={`px-4 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${selectedTeam === team.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'}`}>
                        {team.name}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {filteredRoutes.map(route => (
                    <div key={route.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-gray-800 flex items-center gap-1.5"><Truck size={16} className="text-blue-500"/> {route.name}</h3>
                                <p className="text-xs text-gray-400 mt-0.5">{route.description || '설명 없음'}</p>
                            </div>
                            <button onClick={() => handleDeleteRoute(route.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                        </div>

                        <div className="bg-gray-50 p-2.5 rounded-lg flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500">담당 기사 배정</span>
                            <select value={route.assigned_emp_id || ""} onChange={(e) => handleAssign(route.id, e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-800 outline-none focus:border-blue-500">
                                <option value="">공석 (미배정)</option>
                                {teamEmployees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.pattern})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={() => setIsAddModalOpen(true)} className="fixed bottom-6 right-6 px-5 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                <Plus size={24} /><span className="font-bold pr-1">새 노선 추가</span>
            </button>

            {/* 노선 추가 팝업 */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
                        <div className="p-5 flex justify-between items-center border-b">
                            <h2 className="font-bold text-lg">새 노선 등록</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleAddRoute} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">노선 이름 (코드)</label>
                                <input type="text" name="name" required placeholder="예: 206a" className="w-full bg-gray-50 border rounded-xl px-4 py-3 outline-none focus:border-indigo-500 font-medium"/>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">구역 설명</label>
                                <input type="text" name="description" placeholder="예: 상당구 아파트 단지" className="w-full bg-gray-50 border rounded-xl px-4 py-3 outline-none focus:border-indigo-500 font-medium"/>
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 flex justify-center items-center gap-2 mt-2">
                                <CheckCircle2 size={20}/> 등록 완료
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}