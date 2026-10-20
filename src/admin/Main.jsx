// src/admin/Main.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Calendar as CalendarIcon, Settings, LogOut, ShieldCheck, AlertCircle, Map, Bell, FileSignature } from 'lucide-react';

import EmployeeManager from './pages/EmployeeManager';
import Calendar from './Calendar'; 
import AdminSettings from './Settings';
import RouteManager from './RouteManager';
import ApprovalManager from './pages/ApprovalManager';
import NoticeManager from './pages/NoticeManager'; 

import { DataProvider, useAdminData } from './contexts/DataContext';

function AdminDashboard({ onBack }) {
    const { profile } = useAuth();
    const [currentView, setCurrentView] = useState('main'); 
    
    const { employees } = useAdminData();
    const pendingApprovalCount = 2; // 테스트용 대기 건수

    // 🔀 딱 요청하신 6가지 메뉴만 라우팅
    if (currentView === 'schedule') return <Calendar onBack={() => setCurrentView('main')} />; 
    if (currentView === 'approval') return <ApprovalManager onBack={() => setCurrentView('main')} />;
    if (currentView === 'route') return <RouteManager onBack={() => setCurrentView('main')} />;
    if (currentView === 'employee') return <EmployeeManager onBack={() => setCurrentView('main')} />;
    if (currentView === 'notice') return <NoticeManager onBack={() => setCurrentView('main')} />;
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
                <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm text-red-500 hover:bg-red-50">
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
                {/* 1. 월간 스케줄 상황판 (근무표) */}
                <button onClick={() => setCurrentView('schedule')} className="w-full p-4 sm:p-5 bg-indigo-600 text-white rounded-2xl shadow-md flex items-center justify-between gap-2 hover:bg-indigo-700 transition-colors text-left overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 sm:p-3 bg-white/20 rounded-xl shrink-0"><CalendarIcon size={22} /></div>
                        <div className="text-left min-w-0">
                            <h2 className="font-bold text-[17px] sm:text-lg">월간 스케줄 상황판</h2>
                            <p className="text-[10.5px] sm:text-[11px] text-indigo-100 mt-0.5 sm:mt-1 whitespace-nowrap tracking-tighter">
                                휴무 확인 및 자동 배치 엔진 가동
                            </p>
                        </div>
                    </div>
                </button>

                {/* 2. 요청 결재 관리 */}
                <button onClick={() => setCurrentView('approval')} className="w-full p-4 sm:p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-md flex items-center justify-between gap-2 hover:opacity-95 transition-all text-left overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 sm:p-3 bg-white/20 rounded-xl shrink-0"><FileSignature size={22} /></div>
                        <div className="text-left min-w-0">
                            <h2 className="font-bold text-[17px] sm:text-lg">요청 결재 관리함</h2>
                            <p className="text-[10.5px] sm:text-[11px] text-blue-100 mt-0.5 sm:mt-1 whitespace-nowrap tracking-tighter">
                                팀원들의 휴무 교환 및 추가 휴무 승인/반려
                            </p>
                        </div>
                    </div>
                    {pendingApprovalCount > 0 && (
                        <span className="shrink-0 bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                            {pendingApprovalCount}건
                        </span>
                    )}
                </button>

                {/* 3. 노선 및 팀 관리 */}
                <button onClick={() => setCurrentView('route')} className="w-full p-4 sm:p-5 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-2 hover:border-blue-300 transition-colors text-left overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                            <Map size={22} />
                        </div>
                        <div className="text-left min-w-0">
                            <h2 className="font-bold text-[17px] sm:text-lg">노선 및 팀 관리</h2>
                            <p className="text-[10.5px] sm:text-[11px] text-gray-500 mt-0.5 sm:mt-1 whitespace-nowrap tracking-tighter">
                                노선 추가, 구역 설명 작성, 고정 기사 배정
                            </p>
                        </div>
                    </div>
                </button>

                {/* 4. 직원 관리 */}
                <button onClick={() => setCurrentView('employee')} className="w-full p-4 sm:p-5 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-2 hover:border-indigo-300 transition-colors text-left overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0"><Users size={22} /></div>
                        <div className="text-left min-w-0">
                            <h2 className="font-bold text-[17px] sm:text-lg">직원 및 근무 패턴 관리</h2>
                            <p className="text-[10.5px] sm:text-[11px] text-gray-500 mt-0.5 sm:mt-1 whitespace-nowrap tracking-tighter">
                                직원 등록, 역할 분리 및 휴무 패턴 설정
                            </p>
                        </div>
                    </div>
                </button>

                {/* 5. 공지사항 및 알림 관리 */}
                <button onClick={() => setCurrentView('notice')} className="w-full p-4 sm:p-5 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-2 hover:border-amber-300 transition-colors text-left overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                            <Bell size={22} />
                        </div>
                        <div className="text-left min-w-0">
                            <h2 className="font-bold text-[17px] sm:text-lg">공지사항 및 알림 관리</h2>
                            <p className="text-[10.5px] sm:text-[11px] text-gray-500 mt-0.5 sm:mt-1 whitespace-nowrap tracking-tighter">
                                중요 공지 등록 및 푸시 알림 발송
                            </p>
                        </div>
                    </div>
                </button>

                {/* 6. 시스템 설정 */}
                <button onClick={() => setCurrentView('settings')} className="w-full p-4 sm:p-5 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-2 hover:border-gray-400 transition-colors text-left overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 sm:p-3 bg-gray-100 text-gray-600 rounded-xl shrink-0"><Settings size={22} /></div>
                        <div className="text-left min-w-0">
                            <h2 className="font-bold text-[17px] sm:text-lg">시스템 설정</h2>
                            <p className="text-[10.5px] sm:text-[11px] text-gray-500 mt-0.5 sm:mt-1 whitespace-nowrap tracking-tighter">
                                관리자 권한 및 근무 공통 규칙 설정
                            </p>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
}

export default function Main({ onBack }) {
    return (
        <DataProvider>
            <AdminDashboard onBack={onBack} />
        </DataProvider>
    );
}