// src/components/common/BottomNavBar.js
import React from 'react';
import { Home, BarChart2, List, MoreHorizontal } from 'lucide-react';

const BottomNavBar = ({ 
    selectedMainTab, 
    setSelectedMainTab, 
    setActiveContentTab, 
    setActiveDataTab, 
    setFormType, 
    setDate, 
    setEntryToEdit, 
    setFilters, 
    setStatisticsView, 
    setMonthlyStatsSubTab, 
    handleResetToCurrentMonth, // ✨ 새로 넘겨받은 마법의 공구!
    isDarkMode, 
    getTodayLocal 
}) => {

    const baseButtonClass = "flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out";
    const activeClass = isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50';
    const inactiveClass = isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800';

    return (
        <div 
            className={`fixed bottom-0 left-0 right-0 w-full ${isDarkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'} shadow-lg flex justify-around py-2 px-4 pb-[env(safe-area-inset-bottom)] z-50 select-none`}
            style={{ WebkitTouchCallout: 'none' }}
        >
            {/* 1. 데이터 탭 */}
            <button 
                className={`${baseButtonClass} ${selectedMainTab === 'data' ? activeClass : inactiveClass}`} 
                onClick={() => { 
                    setFilters({ period: 'all', startDate: '', endDate: '', type: 'all' });
                    if (selectedMainTab === 'data') {
                        setEntryToEdit(null);      
                        setActiveDataTab('entry'); 
                        setFormType('income');     
                        setDate(getTodayLocal());  
                    } else {
                        setSelectedMainTab('data'); 
                        setActiveContentTab('dataEntry'); 
                        setActiveDataTab('entry'); 
                        setFormType('income');     
                        setEntryToEdit(null);      
                        setDate(getTodayLocal()); 
                    }
                }}
            >
                <List size={24} /> <span>데이터</span>
            </button>

            {/* 2. 통계 탭 */}
            <button 
                className={`${baseButtonClass} ${selectedMainTab === 'statistics' ? activeClass : inactiveClass}`} 
                onClick={() => { 
                    setSelectedMainTab('statistics'); 
                    setActiveContentTab('statistics'); 
                    setStatisticsView('monthly'); 
                    setMonthlyStatsSubTab('overview'); 
                    
                    // ✨ 복잡한 계산 대신, 공구만 딱 실행하면 끝! ✨
                    if (handleResetToCurrentMonth) {
                        handleResetToCurrentMonth(); 
                    }
                }}
            >
                <BarChart2 size={24} /> <span>통계</span>
            </button>

            {/* 3. 홈 탭 */}
            <button 
                className={`${baseButtonClass} ${selectedMainTab === 'home' ? activeClass : inactiveClass}`} 
                onClick={() => { 
                    setSelectedMainTab('home'); 
                    setActiveContentTab('monthlyProfit'); 
                    
                    // ✨ 만약 홈 탭에 갈 때도 현재 달로 돌아가고 싶다면? 여기에 똑같이 넣기만 하면 됩니다!
                    if (handleResetToCurrentMonth) {
                        handleResetToCurrentMonth(); 
                    }
                }}
            >
                <Home size={24} /> <span>홈</span>
            </button>

            {/* 4. 더보기 탭 */}
            <button 
                className={`${baseButtonClass} ${selectedMainTab === 'more' ? activeClass : inactiveClass}`} 
                onClick={() => { 
                    setSelectedMainTab('more'); 
                    setActiveContentTab('adminSettings'); 
                }}
            >
                <MoreHorizontal size={24} /> <span>더보기</span>
            </button>
        </div>
    );
};

export default BottomNavBar;