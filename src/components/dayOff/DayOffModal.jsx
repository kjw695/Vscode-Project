import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import CalendarTab from './CalendarTab';
import PreferredTab from './PreferredTab';
import ExchangeTab from './ExchangeTab';

export const DayOffModal = ({ 
    isOpen, onClose, isDarkMode, showMessage, 
    monthlyStartDay, monthlyEndDay, selectedMonth,
    currentUser, teamId
}) => {
    // 탭 상태 관리
    const [activeTab, setActiveTab] = useState('calendar');

    // 모달이 열릴 때마다 무조건 '휴무 달력' 탭부터 보이도록 초기화
    useEffect(() => {
        if (isOpen) {
            setActiveTab('calendar');
        }
    }, [isOpen]);

    if (!isOpen) return null;

   return (
        // ✨ fixed 속성들을 지우고 꽉 차는 일반 컨테이너로 변경했습니다.
        <div className={`w-full h-full flex flex-col ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
            <div className="w-full max-w-md mx-auto h-full p-5 flex flex-col overflow-y-auto pb-20"> 

                {/* 상단 타이틀 및 닫기 */}
                <div className="flex justify-between items-center mb-6 pt-2">
                    <h2 className="text-2xl font-black tracking-tight">휴무 관리 센터</h2>
                    <button onClick={onClose} className="p-2 opacity-50 hover:opacity-100 transition-opacity">
                        <X size={28} />
                    </button>
                </div>

                {/* ✨ 팀 소속 사용자에게만 3개의 탭 메뉴 표시 ('휴무 지정' -> '휴무 달력'으로 텍스트 변경) */}
                {teamId && (
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6 text-sm font-bold shrink-0">
                        <button 
                            onClick={() => setActiveTab('calendar')}
                            className={`flex-1 py-3 rounded-lg transition-all ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500'}`}
                        >
                            휴무 달력
                        </button>
                        <button 
                            onClick={() => setActiveTab('preferred')}
                            className={`flex-1 py-3 rounded-lg transition-all ${activeTab === 'preferred' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500'}`}
                        >
                            선호 요일
                        </button>
                        <button 
                            onClick={() => setActiveTab('exchange')}
                            className={`flex-1 py-3 rounded-lg transition-all ${activeTab === 'exchange' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500'}`}
                        >
                            교환 현황
                        </button>
                    </div>
                )}

                {/* 각 탭 컴포넌트 렌더링 */}
                <div className="flex-1 w-full flex flex-col">
                    
                    {/* 개인 사용자(!teamId)이거나 달력 탭일 때 렌더링 */}
                    {(!teamId || activeTab === 'calendar') && (
                        <CalendarTab 
                            isDarkMode={isDarkMode}
                            showMessage={showMessage}
                            monthlyStartDay={monthlyStartDay}
                            monthlyEndDay={monthlyEndDay}
                            selectedMonth={selectedMonth}
                            onClose={onClose}

                            teamId={teamId}
                            currentUser={currentUser}
                            onNavigateToExchange={() => setActiveTab('exchange')}

                        />
                    )}

                    {/* 선호 요일 설정 탭 */}
                    {teamId && activeTab === 'preferred' && (
                        <PreferredTab 
                            isDarkMode={isDarkMode}
                            showMessage={showMessage}
                            currentUser={currentUser}
                            teamId={teamId}
                        />
                    )}

                    {/* 3탭: 휴무 교환 마켓 */}
                    {teamId && activeTab === 'exchange' && (
                        <ExchangeTab 
                            currentUser={currentUser} 
                            teamId={teamId} 
                        />
                    )}
                </div>
            </div>
        </div>
    );
};