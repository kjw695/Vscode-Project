// src/admin/Main.jsx
import React, { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useAuth } from '../contexts/AuthContext';
import { Users, Calendar as CalendarIcon, Settings, LogOut, ShieldCheck, AlertCircle, Map, CalendarDays, BarChart3 } from 'lucide-react';
import EmployeeManager from './EmployeeManager'; 
import Calendar from './Calendar'; 
import AdminSettings from './Settings';
import RouteManager from './RouteManager';
import FixedOffStatus from './FixedOffStatus';
import BackupDemandAnalysis from './BackupDemandAnalysis';
import { DataProvider, useAdminData } from './contexts/DataContext';

// 👑 자식 컴포넌트들을 감싸는 메인 대시보드 껍데기 (✨ onBack 추가)
function AdminDashboard({ onBack }) {
    const { profile } = useAuth();
    const [currentView, setCurrentView] = useState('main');

    // Android 시스템 뒤로가기도 관리자 화면에서 한 단계씩 이동하게 합니다.
    useEffect(() => {
        let active = true;
        let listenerHandle = null;
        CapacitorApp.addListener('backButton', () => {
            // 설정 화면에서 편집창/팀 추가 입력창이 열려 있으면 먼저 그 창만 닫습니다.
            if (typeof window !== 'undefined' && window.__adminSettingsHasOverlay) {
                window.dispatchEvent(new Event('admin-settings-back'));
                return;
            }
            if (currentView !== 'main') {
                setCurrentView('main');
            } else if (onBack) {
                onBack();
            }
        }).then((handle) => {
            if (!active) {
                handle.remove();
                return;
            }
            listenerHandle = handle;
        }).catch(() => {
            // 웹 브라우저 미리보기에는 네이티브 뒤로가기 이벤트가 없습니다.
        });

        return () => {
            active = false;
            if (listenerHandle) listenerHandle.remove();
        };
    }, [currentView, onBack]); 
    
    // ✨ 통제소에서 필요한 데이터와 통계치를 한 줄로 가져옵니다!
    const { employees } = useAdminData();

    // 🔀 화면 전환 라우팅
    if (currentView === 'employee') return <EmployeeManager onBack={() => setCurrentView('main')} />;
    if (currentView === 'route') return <RouteManager onBack={() => setCurrentView('main')} />;
    if (currentView === 'schedule') return <Calendar onBack={() => setCurrentView('main')} />; 
    if (currentView === 'settings') return <AdminSettings onBack={() => setCurrentView('main')} />;
    if (currentView === 'fixedOff') return <FixedOffStatus onBack={() => setCurrentView('main')} />;
    if (currentView === 'backupDemand') return <BackupDemandAnalysis onBack={() => setCurrentView('main')} />;

    return (
        <div className="admin-safe-top w-full h-full min-h-screen bg-gray-100 p-5 flex flex-col font-sans">
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
                {/* ✨ signOut 대신 onBack 연결 (팀 관리 화면으로 복귀) */}
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

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button onClick={() => setCurrentView('schedule')} className="h-full min-w-0 w-full p-3 sm:p-4 bg-indigo-600 text-white rounded-2xl shadow-md flex items-center justify-between hover:bg-indigo-700 transition-colors">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <div className="shrink-0 p-2 sm:p-3 bg-white/20 rounded-xl"><CalendarIcon size={24} /></div>
                        <div className="min-w-0 flex-1 text-left">
                            <h2 className="break-words text-sm font-bold leading-tight sm:text-base lg:text-lg">근무표 관리</h2>
                            <p className="mt-1 whitespace-nowrap text-[clamp(7px,2.2vw,10px)] leading-4 text-indigo-100 sm:text-xs">주간·월간 근무표 관리</p>
                        </div>
                    </div>
                </button>

                <button onClick={() => setCurrentView('backupDemand')} className="h-full min-w-0 w-full p-3 sm:p-4 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-emerald-300 transition-colors">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <div className="shrink-0 p-2 sm:p-3 bg-emerald-50 text-emerald-600 rounded-xl"><BarChart3 size={24} /></div>
                        <div className="min-w-0 flex-1 text-left">
                            <h2 className="break-words text-sm font-bold leading-tight sm:text-base lg:text-lg">백업 수요 분석</h2>
                            <p className="mt-1 whitespace-nowrap text-[clamp(7px,2.2vw,10px)] leading-4 text-gray-500 sm:text-xs">부족량 계산</p>
                        </div>
                    </div>
                </button>

                <button onClick={() => setCurrentView('route')} className="h-full min-w-0 w-full p-3 sm:p-4 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-blue-300 transition-colors">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <div className="shrink-0 p-2 sm:p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <Map size={24} />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <h2 className="break-words text-sm font-bold leading-tight sm:text-base lg:text-lg">노선 배치</h2>
                            <p className="mt-1 whitespace-nowrap text-[clamp(7px,2.2vw,10px)] leading-4 text-gray-500 sm:text-xs">노선 관리</p>
                        </div>
                    </div>
                </button>

                <button onClick={() => setCurrentView('employee')} className="h-full min-w-0 w-full p-3 sm:p-4 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-indigo-300 transition-colors">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <div className="shrink-0 p-2 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={24} /></div>
                        <div className="min-w-0 flex-1 text-left">
                            <h2 className="break-words text-sm font-bold leading-tight sm:text-base lg:text-lg">직원 관리</h2>
                            <p className="mt-1 whitespace-nowrap text-[clamp(7px,2.2vw,10px)] leading-4 text-gray-500 sm:text-xs">직원 등록 및 수정</p>
                        </div>
                    </div>
                </button>

                <button onClick={() => setCurrentView('fixedOff')} className="h-full min-w-0 w-full p-3 sm:p-4 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-emerald-300 transition-colors">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <div className="shrink-0 p-2 sm:p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CalendarDays size={24} /></div>
                        <div className="min-w-0 flex-1 text-left">
                            <h2 className="break-words text-sm font-bold leading-tight sm:text-base lg:text-lg">고정 휴무 현황</h2>
                            <p className="mt-1 whitespace-nowrap text-[clamp(7px,2.2vw,10px)] leading-4 text-gray-500 sm:text-xs">요일별 휴무 확인</p>
                        </div>
                    </div>
                </button>

                <button onClick={() => setCurrentView('settings')} className="h-full min-w-0 w-full p-3 sm:p-4 bg-white text-gray-800 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-indigo-300 transition-colors">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <div className="shrink-0 p-2 sm:p-3 bg-gray-100 text-gray-600 rounded-xl"><Settings size={24} /></div>
                        <div className="min-w-0 flex-1 text-left">
                            <h2 className="break-words text-sm font-bold leading-tight sm:text-base lg:text-lg">팀 및 지역 설정</h2>
                            <p className="mt-1 whitespace-nowrap text-[clamp(7px,2.2vw,10px)] leading-4 text-gray-500 sm:text-xs">조직 관리</p>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
}

// ✨ 최상단 DataProvider로 감싸고 App.js에서 받은 onBack을 전달합니다.
export default function Main({ onBack }) {
    return (
        <DataProvider>
            <AdminDashboard onBack={onBack} />
        </DataProvider>
    );
}