import React, { useState, useEffect } from 'react';
import { X, Menu, Settings, RefreshCw, ArrowLeft, Bell } from 'lucide-react';
import CalendarTab from './CalendarTab';
import PreferredTab from './PreferredTab';
import ExchangeTab from './ExchangeTab';
import AdditionalOffTab from './AdditionalOffTab'; // 
import ApprovalTab from './ApprovalTab';


export const DayOffModal = ({ 
    isOpen, onClose, isDarkMode, showMessage, 
    monthlyStartDay, monthlyEndDay, selectedMonth,
    currentUser, teamId
}) => {
    // 화면 모드 상태: 'main'(나의 스케줄 달력) | 'settings'(휴무 설정)
    const [viewMode, setViewMode] = useState('main');
    
    // 설정 화면 내 탭 상태: 'preferred'(근무스케줄), 'exchange'(휴무일 교환하기), 'additional'(추가 휴무 신청)
    const [settingTab, setSettingTab] = useState('preferred');

    // 새로고침 로딩 상태
    const [isRefreshing, setIsRefreshing] = useState(false);

   // ✨ 사이드 메뉴 모달 상태 추가
    const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

    // ✨ 알림(종 아이콘) 팝업 상태 추가
    const [isNotiOpen, setIsNotiOpen] = useState(false);
    const hasUnread = true; // (임시) 읽지 않은 알림이 있다고 가정

    // 모달이 열릴 때마다 '나의 스케줄' 기본 화면으로 초기화
    useEffect(() => {
        if (isOpen) {
            setViewMode('main');
            setSettingTab('preferred');
            setIsRefreshing(false);
            setIsSideMenuOpen(false); // 메뉴 닫힌 상태로 초기화
            setIsNotiOpen(false); // ✨ 모달 열릴 때 알림창도 닫힌 상태로 초기화
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
       <div className={`absolute inset-0 z-50 w-full h-full flex flex-col overflow-hidden ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
            <div className="w-full max-w-md mx-auto h-full flex flex-col relative overflow-hidden">

                {viewMode === 'main' ? (
                    <>
                        {/* 상단 타이틀 및 아이콘 영역 (✨ relative와 z-20을 추가해 팝업이 전체 헤더 폭 안에서 맞춰지도록 함) */}
                        <div className={`relative shrink-0 flex justify-between items-center px-5 pt-7 pb-3 shadow-sm z-20 ${isDarkMode ? 'bg-blue-800 text-white' : 'bg-[#1E56D0] text-white'}`}>
                            {/* 왼쪽: 햄버거 메뉴 + 타이틀 */}
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setIsSideMenuOpen(true)} // ✨ 사이드 메뉴 열기 기능 연결
                                    className="opacity-90 hover:opacity-100 transition-opacity active:scale-95"
                                >
                                    <Menu size={26} />
                                </button>
                                <h2 className="text-[19px] font-bold tracking-tight">나의 스케줄</h2>
                            </div>

                          {/* 오른쪽: 알림 + 톱니바퀴 + 새로고침 + 닫기 */}
                            <div className="flex items-center gap-3">
                                {/* ✨ 알림 종 아이콘 (감싸고 있던 div.relative 삭제) */}
                                <button 
                                    onClick={() => setIsNotiOpen(!isNotiOpen)} 
                                    className="opacity-90 hover:opacity-100 active:scale-95 relative mt-1"
                                >
                                    <Bell size={22} />
                                    {hasUnread && (
                                        <span className="absolute -top-0.5 -right-0.5 bg-red-500 w-2.5 h-2.5 rounded-full border-2 border-[#1E56D0] dark:border-blue-800"></span>
                                    )}
                                </button>

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

                            {/* ✨ 알림 팝업 드롭다운 위치 변경: 아이콘 안쪽이 아닌 헤더 전체 영역 안으로 분리 */}
                            {isNotiOpen && (
                                <div className="absolute top-[100%] right-4 mt-2 w-[calc(100%-32px)] max-w-[320px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2">
                                    <div className="p-3 border-b dark:border-gray-700 font-bold text-sm text-gray-800 dark:text-gray-200 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                                        <span>최근 알림</span>
                                        <button onClick={() => setIsNotiOpen(false)}><X size={16} className="text-gray-400"/></button>
                                    </div>
                                    <div className="flex flex-col">
                                        <button 
                                            onClick={() => {
                                                setIsNotiOpen(false);
                                                setViewMode('approval'); // 클릭 시 요청 결재 화면으로 즉시 이동
                                            }}
                                            className="p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                                        >
                                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mb-1">휴무 교환 요청</p>
                                            <p className="text-[13px] text-gray-800 dark:text-gray-200 leading-snug">김동료님이 휴무 교환을 요청했습니다. 확인해주세요!</p>
                                            <p className="text-[10px] text-gray-400 mt-2">10.13 14:30 (2시간 전)</p>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 달력 탭 렌더링 */}
                        <div className="flex-1 w-full flex flex-col p-2 pb-20 relative overflow-hidden">
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

                        {/* 설정 화면 3개의 탭 */}
                        <div className={`shrink-0 flex border-b text-[13px] font-bold z-10 ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                            <button 
                                onClick={() => setSettingTab('preferred')}
                                className={`flex-1 py-3.5 text-center transition-all border-b-[3px] whitespace-nowrap px-1 ${settingTab === 'preferred' ? 'border-[#1E56D0] text-[#1E56D0] dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500'}`}
                            >
                                선호요일
                            </button>
                            <button 
                                onClick={() => setSettingTab('exchange')}
                                className={`flex-1 py-3.5 text-center transition-all border-b-[3px] whitespace-nowrap px-1 ${settingTab === 'exchange' ? 'border-[#1E56D0] text-[#1E56D0] dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500'}`}
                            >
                                휴무일 교환하기
                            </button>
                            <button 
                                onClick={() => setSettingTab('additional')}
                                className={`flex-1 py-3.5 text-center transition-all border-b-[3px] whitespace-nowrap px-1 ${settingTab === 'additional' ? 'border-[#1E56D0] text-[#1E56D0] dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500'}`}
                            >
                                추가 휴무신청
                            </button>
                        </div>

                        {/* 탭 내용 영역 */}
                       <div className="flex-1 w-full relative bg-white dark:bg-gray-900">
                            <div className="absolute inset-0 flex flex-col h-full">
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
                                        isDarkMode={isDarkMode}
                                        showMessage={showMessage}
                                    />
                                )}
                                {settingTab === 'additional' && (
                                    <AdditionalOffTab 
                                        currentUser={currentUser} 
                                        teamId={teamId}
                                        isDarkMode={isDarkMode}
                                        showMessage={showMessage}
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* ✨ 3️⃣ 새로운 "요청 결재" 화면 연결 추가 */}
                {viewMode === 'approval' && (
                    <ApprovalTab 
                        onBack={() => setViewMode('main')}
                        isDarkMode={isDarkMode}
                        showMessage={showMessage}
                    />
                )}

                {/* ✨ 사이드 메뉴 (Drawer) 렌더링 영역 */}
                {isSideMenuOpen && (
                    <div className="absolute inset-0 z-[100] flex">
                        {/* 뒷배경 어둡게 처리 (클릭 시 닫힘) */}
                        <div 
                            className="absolute inset-0 bg-black/50 transition-opacity"
                            onClick={() => setIsSideMenuOpen(false)}
                        ></div>
                        
                        {/* 왼쪽에서 슬라이드 되어 나오는 메뉴 패널 */}
                        <div className={`relative w-[70%] max-w-[280px] h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
                            <div className={`flex items-center justify-between px-5 pt-8 pb-5 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
                                <h3 className="font-bold text-lg">메뉴</h3>
                                <button onClick={() => setIsSideMenuOpen(false)} className="p-1 opacity-80 hover:opacity-100">
                                    <X size={24} />
                                </button>
                            </div>
                            
                            {/* 사이드 메뉴 항목들 */}
                            <div className="flex flex-col py-2">
                                <button 
                                    className="px-5 py-4 text-left font-semibold text-[15px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    onClick={() => {
                                        setIsSideMenuOpen(false);
                                        setViewMode('settings');
                                        setSettingTab('preferred');
                                    }}
                                >
                                    선호요일
                                </button>
                                <button 
                                    className="px-5 py-4 text-left font-semibold text-[15px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    onClick={() => {
                                        setIsSideMenuOpen(false);
                                        setViewMode('settings');
                                        setSettingTab('exchange');
                                    }}
                                >
                                    휴무일 교환하기
                                </button>
                                <button 
                                    className="px-5 py-4 text-left font-semibold text-[15px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    onClick={() => {
                                        setIsSideMenuOpen(false);
                                        setViewMode('settings');
                                        setSettingTab('additional');
                                    }}
                                >
                                    추가 휴무신청
                                </button>
                                
                               {/* 구분선 */}
                                <div className={`my-2 mx-4 h-[1px] ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}></div>

                                {/* ✨ "요청 결재" 버튼 기능 활성화 및 준비중 딱지 제거 */}
                                <button 
                                    className="px-5 py-4 text-left font-semibold text-[15px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    onClick={() => {
                                        setIsSideMenuOpen(false);
                                        setViewMode('approval'); // approval 모드로 화면 전환
                                    }}
                                >
                                    요청 결재
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};