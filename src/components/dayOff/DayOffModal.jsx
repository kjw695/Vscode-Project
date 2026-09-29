import React, { useState } from 'react';
import { X } from 'lucide-react';
import CalendarTab from './CalendarTab';
import PreferredTab from './PreferredTab';
import ExchangeTab from './ExchangeTab';

export const DayOffModal = ({ 
    isOpen, onClose, isDarkMode, showMessage, 
    monthlyStartDay, monthlyEndDay, selectedMonth 
}) => {
    const [activeTab, setActiveTab] = useState('calendar');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
            <div className={`w-full max-w-[340px] p-5 rounded-3xl shadow-2xl flex flex-col ${isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white'}`}>
                
                {/* 상단 타이틀 및 닫기 */}
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-black tracking-tight">휴무 관리 센터</h3>
                    <button onClick={onClose} className="p-1.5 opacity-40 hover:opacity-100"><X size={18} /></button>
                </div>

                {/* 상단 탭 메뉴 */}
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4 text-xs font-bold">
                    <button 
                        onClick={() => setActiveTab('calendar')}
                        className={`flex-1 py-2 rounded-lg transition-all ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500'}`}
                    >
                        휴무 지정
                    </button>
                    <button 
                        onClick={() => setActiveTab('preferred')}
                        className={`flex-1 py-2 rounded-lg transition-all ${activeTab === 'preferred' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500'}`}
                    >
                        선호 요일
                    </button>
                    <button 
                        onClick={() => setActiveTab('exchange')}
                        className={`flex-1 py-2 rounded-lg transition-all ${activeTab === 'exchange' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500'}`}
                    >
                        교환 마켓
                    </button>
                </div>

                {/* 각 탭 컴포넌트 렌더링 */}
                {activeTab === 'calendar' && (
                    <CalendarTab 
                        isDarkMode={isDarkMode}
                        showMessage={showMessage}
                        monthlyStartDay={monthlyStartDay}
                        monthlyEndDay={monthlyEndDay}
                        selectedMonth={selectedMonth}
                        onClose={onClose}
                    />
                )}

                {activeTab === 'preferred' && (
                    <PreferredTab 
                        isDarkMode={isDarkMode}
                        showMessage={showMessage}
                    />
                )}

                {activeTab === 'exchange' && (
                    <ExchangeTab 
                        isDarkMode={isDarkMode}
                    />
                )}
            </div>
        </div>
    );
};