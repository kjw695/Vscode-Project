// src/admin/pages/RouteManager.jsx
import React, { useState } from 'react';
import { ArrowLeft, Map, Plus, Trash2, MapPin, Users } from 'lucide-react';

export default function RouteManager({ onBack }) {
    // 💡 실제 DB와 연결될 노선 기본 데이터
    const [routes, setRoutes] = useState([
        { id: 1, name: '청주 A구역 (흥덕구)', requiredStaff: 1, difficulty: '상', description: '물량이 많고 아파트 단지가 밀집된 구역' },
        { id: 2, name: '청주 B구역 (서원구)', requiredStaff: 1, difficulty: '중', description: '주택가 위주, 배송 시간 변동성 있음' },
        { id: 3, name: '오창 과학단지', requiredStaff: 2, difficulty: '하', description: '공단 지역으로 배송지 집중도가 높음' }
    ]);

    const [isAdding, setIsAdding] = useState(false);

    const handleAddRoute = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newRoute = {
            id: Date.now(),
            name: formData.get('name'),
            requiredStaff: parseInt(formData.get('requiredStaff'), 10),
            difficulty: formData.get('difficulty'),
            description: formData.get('description')
        };
        setRoutes([...routes, newRoute]);
        setIsAdding(false);
    };

    const handleDelete = (id) => {
        if(window.confirm('이 노선을 정말 삭제하시겠습니까? (배정된 기사들의 노선이 공석 처리될 수 있습니다)')) {
            setRoutes(routes.filter(r => r.id !== id));
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#F2F2F7] font-sans pb-24 overflow-y-auto">
            <header className="bg-white px-5 py-4 flex items-center justify-between shadow-sm border-b shrink-0 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="p-1.5 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="text-lg font-black text-gray-800 flex items-center gap-2">

<Map size={20} className="text-blue-600"/>
노선 및 팀 관리
                    </h1>
                </div>
                <button onClick={() => setIsAdding(!isAdding)} className="bg-blue-50 text-blue-600 p-2 rounded-xl font-bold hover:bg-blue-100 transition-colors">
                    <Plus size={20} />
                </button>
            </header>

            <div className="p-5 max-w-2xl mx-auto w-full space-y-4">
                {isAdding && (
                    <form onSubmit={handleAddRoute} className="bg-white p-5 rounded-2xl shadow-sm border border-blue-200 animate-in fade-in slide-in-from-top-2">
                        <h3 className="font-bold text-blue-800 mb-3 text-sm">새로운 노선 등록</h3>
                        <div className="space-y-3">
                            <input type="text" name="name" required placeholder="노선 이름 (예: 청주 C구역)" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">필수 필요 인원</label>
                                    <input type="number" name="requiredStaff" defaultValue="1" min="1" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">난이도</label>
                                    <select name="difficulty" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500">
                                        <option value="상">상</option>
                                        <option value="중">중</option>
                                        <option value="하">하</option>
                                    </select>
                                </div>
                            </div>
                            <input type="text" name="description" placeholder="노선 특징 및 설명" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500" />
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200">취소</button>
                                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700">등록하기</button>
                            </div>
                        </div>
                    </form>
                )}

                <div className="space-y-3">
                    {routes.map(route => (
                        <div key={route.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 relative group hover:border-blue-100 transition-all">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-black text-gray-800 text-base flex items-center gap-1.5">
                                        <MapPin size={16} className="text-blue-500"/> {route.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">{route.description}</p>
                                </div>
                                <span className={`px-2 py-1 text-[10px] font-black rounded-lg ${
                                    route.difficulty === '상' ? 'bg-red-100 text-red-600' : route.difficulty === '중' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                }`}>
                                    난이도 {route.difficulty}
                                </span>
                            </div>
                            <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-1">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                                    <Users size={14}/> 매일 <span className="text-blue-600">{route.requiredStaff}명</span> 투입 필요
                                </div>
                                <button onClick={() => handleDelete(route.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}