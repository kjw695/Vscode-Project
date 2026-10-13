import React, { useState, useEffect } from 'react';
import { X, Menu, Settings, RefreshCw, ArrowLeft } from 'lucide-react';
import CalendarTab from './CalendarTab';
import PreferredTab from './PreferredTab';
import ExchangeTab from './ExchangeTab';

export const DayOffModal = ({ 
    isOpen, onClose, isDarkMode, showMessage, 
    monthlyStartDay, monthlyEndDay, selectedMonth,
    currentUser, teamId
}) => {
    // ✨ 화면 모드 상태: 'main'(나의 스케줄 달력) | 'settings'(휴무 설정)
    const [viewMode, setViewMode] = useState('main');
    
    // ✨ 설정 화면 내 탭 상태: 'preferred'(근무스케줄), 'exchange'(휴무일 교환하기), 'alternative'(대체휴일 교환)
    const [settingTab, setSettingTab] = useState('preferred');

    // ✨ 새로고침 로딩 상태 추가
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 모달이 열릴 때마다 '나의 스케줄' 기본 화면으로 초기화
    useEffect(() => {
        if (isOpen) {
            setViewMode('main');
            setSettingTab('preferred');
            setIsRefreshing(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
       <div className={`absolute inset-0 z-50 w-full h-full flex flex-col overflow-hidden ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
            <div className="w-full max-w-md mx-auto h-full flex flex-col relative overflow-hidden">

                {viewMode === 'main' ? (
                    /* ----------------------------------------------------
                        1. 나의 스케줄 (메인 달력 화면) 
                    ---------------------------------------------------- */
                    <>
                        {/* 상단 타이틀 및 아이콘 영역 */}
                        {/* 상단 타이틀 및 아이콘 영역 (위쪽 패딩을 줄이고 아래쪽 패딩을 늘려 아래로 자연스럽게 정렬) */}
                        <div className={`shrink-0 flex justify-between items-center px-5 pt-7 pb-3 shadow-sm z-10 ${isDarkMode ? 'bg-blue-800 text-white' : 'bg-[#1E56D0] text-white'}`}>
                            {/* 왼쪽: 햄버거 메뉴 + 타이틀 */}
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => showMessage("휴무 관련 사이드메뉴가 열릴 예정입니다.")} 
                                    className="opacity-90 hover:opacity-100 transition-opacity active:scale-95"
                                >
                                    <Menu size={26} />
                                </button>
                                <h2 className="text-[19px] font-bold tracking-tight">나의 스케줄</h2>
                            </div>

                            {/* 오른쪽 아이콘들 */}
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setViewMode('settings')} 
                                    className="opacity-90 hover:opacity-100 transition-opacity active:scale-95"
                                >
                                    <Settings size={22} />
                                </button>
                                <button 
                                    onClick={() => {
                                        if (isRefreshing) return;
                                        setIsRefreshing(true);
                                        setTimeout(() => {
                                            setIsRefreshing(false);
                                        }, 1000);
                                    }} 
                                    className="opacity-90 hover:opacity-100 transition-opacity active:scale-95"
                                >
                                    <RefreshCw size={22} className={isRefreshing ? 'animate-spin' : ''} />
                                </button>
                                <button onClick={onClose} className="opacity-90 hover:opacity-100 transition-opacity ml-1 active:scale-95">
                                    <X size={26} />
                                </button>
                            </div>
                        </div>

                        {/* 달력 탭 렌더링 */}
                        <div className="flex-1 w-full overflow-y-auto p-4 pb-48 relative">
                            <CalendarTab 
                                isDarkMode={isDarkMode}
                                showMessage={showMessage}
                                monthlyStartDay={monthlyStartDay}
                                monthlyEndDay={monthlyEndDay}
                                selectedMonth={selectedMonth}
                                onClose={onClose}
                                teamId={teamId}
                                currentUser={currentUser}
                                onNavigateToExchange={() => {
                                    setViewMode('settings');
                                    setSettingTab('exchange');
                                }}
                            />
                        </div>
                    </>
                ) : (
                    /* ----------------------------------------------------
                        2. 휴무 설정 (톱니바퀴 눌렀을 때 나오는 화면) 
                    ---------------------------------------------------- */
                    <>
                       {/* 설정 화면 헤더 */}
                        <div className={`shrink-0 flex items-center px-4 pt-7 pb-3 z-10 ${isDarkMode ? 'bg-blue-800 text-white' : 'bg-[#1E56D0] text-white'}`}>
                            <button 
                                onClick={() => setViewMode('main')}
                                className="mr-3 opacity-90 hover:opacity-100 transition-opacity active:scale-95"
                            >
                                <ArrowLeft size={24} />
                            </button>
                            <h2 className="text-[19px] font-bold tracking-tight">휴무 설정</h2>
                        </div>

                        {/* 설정 화면 3개의 탭 (사진 스타일 반영: 텍스트 아래 파란색 줄) */}
                        <div className={`shrink-0 flex border-b text-[13px] font-bold z-10 ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                            <button 
                                onClick={() => setSettingTab('preferred')}
                                className={`flex-1 py-3.5 text-center transition-all border-b-[3px] whitespace-nowrap px-1 ${settingTab === 'preferred' ? 'border-[#1E56D0] text-[#1E56D0] dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500'}`}
                            >
                                근무스케줄
                            </button>
                            <button 
                                onClick={() => setSettingTab('exchange')}
                                className={`flex-1 py-3.5 text-center transition-all border-b-[3px] whitespace-nowrap px-1 ${settingTab === 'exchange' ? 'border-[#1E56D0] text-[#1E56D0] dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500'}`}
                            >
                                휴무일 교환하기
                            </button>
                            <button 
                                onClick={() => setSettingTab('alternative')}
                                className={`flex-1 py-3.5 text-center transition-all border-b-[3px] whitespace-nowrap px-1 ${settingTab === 'alternative' ? 'border-[#1E56D0] text-[#1E56D0] dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500'}`}
                            >
                                대체휴일(관) 교환
                            </button>
                        </div>

                        {/* 탭 내용 영역 */}
                       {/* 탭 내용 영역 */}
                        <div className="flex-1 w-full relative overflow-hidden bg-white dark:bg-gray-900">
                            <div className="absolute inset-0 overflow-y-auto flex flex-col pb-48">
                                {settingTab === 'preferred' && (
                                    <PreferredTab
                                        isDarkMode={isDarkMode}
                                        showMessage={showMessage}
                                        currentUser={currentUser}
                                        teamId={teamId}
                                    />
                                )}
                                {settingTab === 'exchange' && (
                                    <ExchangeTab 
                                        currentUser={currentUser} 
                                        teamId={teamId} 
                                    />
                                )}
                                {settingTab === 'alternative' && (
                                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm mt-20">
                                        대체휴일 교환 기능은 준비 중입니다.
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
};