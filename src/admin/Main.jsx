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
    const {
        employees,
        regions,
        teams,
        routes,
        scope,
        syncStatus,
        organizationRole,
        hasLegacyLocalData,
        initializeSharedState,
        reloadSharedState
    } = useAdminData();
    const [sharedSetupBusy, setSharedSetupBusy] = useState(false);

    const handleInitializeSharedState = async (importLegacy) => {
        const message = importLegacy
            ? '이 기기의 기존 지역·팀·직원·노선 설정을 회사 공용 데이터로 한 번만 이전합니다. 이전 후에는 모든 회사 관리자가 같은 데이터를 사용합니다. 진행할까요?'
            : '빈 회사 공용 데이터로 시작합니다. 이 기기의 기존 설정은 삭제하지 않고 남겨둡니다. 진행할까요?';
        if (!window.confirm(message)) return;

        try {
            setSharedSetupBusy(true);
            await initializeSharedState(importLegacy);
        } catch (error) {
            window.alert(error?.message || '회사 공용 데이터 연결에 실패했습니다.');
        } finally {
            setSharedSetupBusy(false);
        }
    };

    const handleReloadSharedState = async () => {
        if (!window.confirm('현재 기기에서 저장하지 못한 변경 사항은 적용되지 않습니다. 최신 회사 공용 데이터를 다시 불러올까요?')) return;
        try {
            setSharedSetupBusy(true);
            await reloadSharedState();
        } catch (error) {
            window.alert(error?.message || '최신 회사 공용 데이터를 불러오지 못했습니다.');
        } finally {
            setSharedSetupBusy(false);
        }
    };

    if (scope === 'resolving' || syncStatus === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 text-center">
                <div>
                    <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                    <p className="text-sm font-bold text-slate-700">회사 관리자 권한과 공용 데이터를 확인하고 있습니다.</p>
                </div>
            </div>
        );
    }

    if (syncStatus === 'unauthorized') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <ShieldCheck className="mx-auto mb-3 text-slate-400" size={32} />
                    <h2 className="text-lg font-black text-slate-800">관리자 권한이 필요합니다.</h2>
                    <p className="mt-2 text-sm text-slate-500">회사 대표 관리자에게 일반 관리자 권한을 요청해주세요.</p>
                    <button onClick={onBack} className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white">돌아가기</button>
                </div>
            </div>
        );
    }

    if (syncStatus === 'awaiting_owner' || syncStatus === 'needs_migration') {
        const isOwner = organizationRole === 'owner';
        return (
            <div className="min-h-screen bg-slate-50 px-4 py-8">
                <div className="mx-auto max-w-xl">
                    <div className="mb-5 flex items-center gap-3">
                        <ShieldCheck className="text-indigo-600" size={28} />
                        <div>
                            <h1 className="text-xl font-black text-slate-900">회사 공용 관리자 데이터</h1>
                            <p className="text-xs text-slate-500">첫 연결을 완료하면 모든 관리자가 같은 설정을 사용합니다.</p>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                        {isOwner ? (
                            <>
                                <h2 className="text-base font-black text-slate-800">기존 관리자 설정을 이전할까요?</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    지금까지 이 기기에 저장된 지역·팀·직원·노선 설정을 회사 공용 데이터로 옮깁니다.
                                    다른 회사나 다른 기기의 데이터는 자동으로 합치지 않습니다.
                                </p>
                                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                                    {[
                                        ['지역', regions.length],
                                        ['팀', teams.length],
                                        ['직원', employees.length],
                                        ['노선', routes.length]
                                    ].map(([label, count]) => (
                                        <div key={label} className="rounded-xl bg-slate-50 p-3">
                                            <p className="text-xs text-slate-500">{label}</p>
                                            <p className="mt-1 text-lg font-black tabular-nums text-slate-800">{count}</p>
                                        </div>
                                    ))}
                                </div>
                                {!hasLegacyLocalData && (
                                    <p className="mt-3 text-xs text-amber-700">이 기기에서 이전할 기존 설정이 확인되지 않았습니다.</p>
                                )}
                                <button
                                    type="button"
                                    disabled={sharedSetupBusy}
                                    onClick={() => handleInitializeSharedState(true)}
                                    className="mt-5 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white disabled:opacity-50"
                                >
                                    {sharedSetupBusy ? '연결 중...' : '현재 기기의 기존 설정 이전'}
                                </button>
                                <button
                                    type="button"
                                    disabled={sharedSetupBusy}
                                    onClick={() => handleInitializeSharedState(false)}
                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 disabled:opacity-50"
                                >
                                    빈 데이터로 시작
                                </button>
                                <p className="mt-3 text-[11px] leading-5 text-slate-400">
                                    기존 로컬 설정은 이전이 성공해도 기기에서 바로 삭제하지 않습니다. 공용 데이터가 정상인지 확인한 뒤 정리할 수 있습니다.
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-base font-black text-slate-800">대표 관리자의 최초 연결이 필요합니다.</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    회사 공용 설정이 아직 만들어지지 않았습니다. 대표 관리자가 기존 설정 이전 또는 빈 데이터 시작을 완료하면 이 화면에서 자동으로 연결됩니다.
                                </p>
                                <button onClick={onBack} className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white">돌아가기</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (syncStatus === 'conflict' || syncStatus === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
                    <AlertCircle className="mx-auto mb-3 text-amber-500" size={32} />
                    <h2 className="text-lg font-black text-slate-800">
                        {syncStatus === 'conflict' ? '다른 관리자의 변경이 먼저 저장되었습니다.' : '회사 공용 데이터 연결에 실패했습니다.'}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        {syncStatus === 'conflict'
                            ? '이 기기의 변경 사항은 덮어쓰지 않고 보류했습니다. 최신 데이터를 다시 불러온 뒤 필요한 수정 사항을 다시 적용해주세요.'
                            : '네트워크 연결과 회사 관리자 권한을 확인한 뒤 다시 불러와주세요.'}
                    </p>
                    <button
                        type="button"
                        disabled={sharedSetupBusy}
                        onClick={handleReloadSharedState}
                        className="mt-5 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                        {sharedSetupBusy ? '불러오는 중...' : '최신 공용 데이터 다시 불러오기'}
                    </button>
                    <button onClick={onBack} className="mt-2 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700">돌아가기</button>
                </div>
            </div>
        );
    }

    // 🔀 화면 전환 라우팅
    if (currentView === 'employee') return <EmployeeManager onBack={() => setCurrentView('main')} />;
    if (currentView === 'route') return <RouteManager onBack={() => setCurrentView('main')} />;
    if (currentView === 'schedule') return <Calendar onBack={() => setCurrentView('main')} />; 
    if (currentView === 'settings') return <AdminSettings onBack={() => setCurrentView('main')} />;
    if (currentView === 'fixedOff') return <FixedOffStatus onBack={() => setCurrentView('main')} />;
    if (currentView === 'backupDemand') return <BackupDemandAnalysis onBack={() => setCurrentView('main')} />;

    return (
        <div className="admin-safe-top w-full h-full min-h-screen bg-gray-100 p-5 flex flex-col font-sans">
            {scope === 'shared' && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs">
                    <span className="font-bold text-emerald-700">회사 공용 데이터 연결됨</span>
                    <span className="text-slate-500">{syncStatus === 'saving' ? '저장 중...' : `버전 ${sharedVersion || 1}`}</span>
                </div>
            )}
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