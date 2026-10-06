import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

const DAYS_OF_WEEK = [
    { id: 'sun', label: '일요일' },
    { id: 'mon', label: '월요일' },
    { id: 'tue', label: '화요일' },
    { id: 'wed', label: '수요일' },
    { id: 'thu', label: '목요일' },
    { id: 'fri', label: '금요일' },
    { id: 'sat', label: '토요일' },
    
];

export default function PreferredTab({ isDarkMode, showMessage }) {
    const [preferredDays, setPreferredDays] = useState(() => {
        const saved = localStorage.getItem('preferredDayOffs');
        return saved ? JSON.parse(saved) : ['sat', 'sun']; // 기본 주말 선호 예시
    });

    const toggleDay = (dayId) => {
        setPreferredDays(prev => 
            prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
        );
    };

    const handleSavePreferences = () => {
        localStorage.setItem('preferredDayOffs', JSON.stringify(preferredDays));
        showMessage("✅ 선호 휴무일이 저장되었습니다.\n팀 배치 시 우선 반영됩니다.");
    };

    return (
        <div className="flex flex-col space-y-4 py-2">
            <div className="flex items-center gap-2 px-1">
                <Star size={18} className="text-amber-400" />
                <h4 className="font-bold text-sm">선호하는 휴무 요일을 선택하세요</h4>
            </div>
            <p className="text-[11px] text-gray-400 px-1 leading-tight">
                팀 배정 시 우선 반영되며, 인원이 몰릴 경우 무작위 추첨(경쟁) 시스템이 작동합니다.
            </p>

            <div className="grid grid-cols-2 gap-2 my-2">
                {DAYS_OF_WEEK.map(day => {
                    const isSelected = preferredDays.includes(day.id);
                    return (
                        <button
                            key={day.id}
                            onClick={() => toggleDay(day.id)}
                            className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-between transition-all border
                            ${isSelected 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                : (isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700')
                            }`}
                        >
                            <span>{day.label}</span>
                            <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${isSelected ? 'border-white bg-white text-indigo-600' : 'border-gray-400'}`}>
                                {isSelected ? '✓' : ''}
                            </span>
                        </button>
                    );
                })}
            </div>

            <button 
                onClick={handleSavePreferences}
                className="w-full py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white shadow-md active:scale-95 transition-all mt-2"
            >
                선호 요일 저장하기
            </button>
        </div>
    );
}