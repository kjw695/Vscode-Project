// src/admin/Main.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Calendar as CalendarIcon, Settings, LogOut, ShieldCheck, AlertCircle, Map } from 'lucide-react';
import EmployeeManager from './EmployeeManager'; 
import Calendar from './Calendar'; 
import AdminSettings from './Settings';
import RouteManager from './RouteManager';
import { DataProvider, useAdminData } from './contexts/DataContext';

// 👑 자식 컴포넌트들을 감싸는 메인 대시보드 껍데기
function AdminDashboard() {
    const { signOut, profile } = useAuth();
    const [currentView, setCurrentView] = useState('main'); 
    
    // ✨ 통제소에서 필요한 데이터와 통계치를 한 줄로 가져옵니다!
    const { employees } = useAdminData();

    // 🔀 화면 전환 라우팅
    if (currentView === 'employee') return <EmployeeManager onBack={() => setCurrentView('main')} />;
    if (currentView === 'route') return <RouteManager onBack={() => setCurrentView('main')} />;
    if (currentView === 'schedule') return <Calendar onBack={() => setCurrentView('main')} />; 
    if (currentView === 'settings') return <AdminSettings onBack={() => setCurrentView('main')} />;

    return (
        <div className="w-full h-full min-h-screen bg-gray-100 p-5 flex flex-col font-sans">
            <div className="flex justify-between items-center mb-6 mt-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <ShieldCheck className="text-indigo-600" size={28}/> 
                        관리자 센터
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        환영합니다, <span className="font-bold text-indigo-600">{profile?.full_name || '관리자'}</span>님!
                    </p>
                </div>
                <button onClick={signOut} className="p-2 bg-white rounded-full shadow-sm text-red-500 hover:bg-red-50">
                    <LogOut size={20} />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <Users size={16} /> <span className="text-xs font-bold">등록된 팀원</span>
                    </div>
                    <div className="text-2xl font-black text-gray-800">{employees.length}<span className="text-sm font-medium text-gray-500 ml-1">명</span></div>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-red-50">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <AlertCircle size={16} /> <span className="text-xs font-bold">이번달 인력부족</span>
                    </div>
                    <div className="text-2xl font-black text-red-500">0<span className="text-sm font-medium text-red-400 ml-1">건</span></div>
                </div>
            </div>

            <div className="space-y-4">
                <button onClick={() => setCurrentView('schedule')} className="w-full p-5 bg-indigo-600 text-white rounded-2xl shadow-md flex items-center justify-between hover:bg-indigo-700 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl"><CalendarIcon size={24} /></div>
                        <div className="text-left">
                            <h2 className="font-bold text-lg">월간 스케줄 상황판</h2>
                            <p className="text-xs text-indigo-100 mt-1">휴무 확인 및 자동 배치 엔진 가동</p>
                        </div>
                    </div>
                </button>

                <button onClick={() => setCurrentView('route')} className="w-full p-5 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-blue-300 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <Map size={24} />
                        </div>
                        <div className="text-left">
                            <h2 className="font-bold text-lg">노선 및 배치 관리</h2>
                            <p className="text-xs text-gray-500 mt-1">노선 추가, 구역 설명 작성, 고정 기사 배정</p>
                        </div>
                    </div>
                </button>

                <button onClick={() => setCurrentView('employee')} className="w-full p-5 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-indigo-300 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={24} /></div>
                        <div className="text-left">
                            <h2 className="font-bold text-lg">직원 및 근무 패턴 관리</h2>
                            <p className="text-xs text-gray-500 mt-1">초대코드 발급, 주 1~6일 및 격주 패턴 설정</p>
                        </div>
                    </div>
                </button>

                <button onClick={() => setCurrentView('settings')} className="w-full p-5 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-indigo-300 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gray-100 text-gray-600 rounded-xl"><Settings size={24} /></div>
                        <div className="text-left">
                            <h2 className="font-bold text-lg">팀 및 지역 설정</h2>
                            <p className="text-xs text-gray-500 mt-1">관리 지역 추가/삭제, 팀 기본 정보 확인</p>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
}

// ✨ 최상단 로 감싸서 하위 모든 화면이 데이터를 공유하게 만듭니다.
export default function Main() {
    return (
        <DataProvider>
            <AdminDashboard />
        </DataProvider>
    );
}