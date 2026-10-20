import React, { useState } from 'react';
import { Check } from 'lucide-react';

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
        const parsed = saved ? JSON.parse(saved) : [];
        // 단일 선택: 기존에 여러 개가 저장되어 있더라도 무조건 첫 번째 값만 가져옵니다.
        // 아무것도 없으면 '일요일(sun)'을 기본값으로 둡니다.
        return parsed.length > 0 ? [parsed[0]] : ['sun'];
    });

    // ✨ 단일 선택 로직: 무조건 새로 클릭한 요일 1개만 배열에 저장합니다.
    const selectDay = (dayId) => {
        setPreferredDays([dayId]);
    };

    const handleSavePreferences = () => {
        localStorage.setItem('preferredDayOffs', JSON.stringify(preferredDays));
        showMessage("✅ 선호 휴무일이 저장되었습니다.\n팀 배치 시 우선 반영됩니다.");
    };

    return (
        <div className="flex flex-col h-full">
            {/* 상단 안내 문구 영역 (기존 문구 유지) */}
            <div className={`py-4 px-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                <h4 className="font-bold text-sm mb-1">선호하는 휴무 요일을 선택하세요</h4>
                <p className="text-[11px] text-gray-500 leading-tight">
                    팀 배정 시 우선 반영되며, 인원이 몰릴 경우 무작위 추첨(경쟁) 시스템이 작동합니다.
                </p>
            </div>

            {/* 요일 선택 세로 리스트 */}
            <div className="flex-1 overflow-y-auto">
                {DAYS_OF_WEEK.map(day => {
                    const isSelected = preferredDays.includes(day.id);
                    return (
                        <button
                            key={day.id}
                            onClick={() => selectDay(day.id)}
                            className={`w-full py-4 px-5 flex items-center justify-between border-b transition-colors
                            ${isDarkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'}`}
                        >
                            {/* 선택 시 글자색 파란색으로 변경 */}
                            <span className={`text-sm font-bold ${isSelected ? 'text-blue-600 dark:text-blue-400' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')}`}>
                                {day.label}
                            </span>
                            
                            {/* 우측 사각형 체크박스 */}
                            <div className={`w-5 h-5 flex items-center justify-center rounded-sm border ${
                                isSelected 
                                ? 'bg-blue-600 border-blue-600 text-white' 
                                : (isDarkMode ? 'border-gray-500 bg-gray-700' : 'border-gray-400 bg-white')
                            }`}>
                                {isSelected && <Check size={14} strokeWidth={3.5} />}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* 하단 확인 버튼 (사진 스타일 반영 - 회색톤) */}
           {/* ✨ 내비게이션 바 바로 위에 둥둥 떠 있도록 고정된 버튼 영역 */}
            <div className="absolute bottom-16 left-0 right-0 px-4 py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-20 border-t border-gray-100 dark:border-gray-800">
                <button 
                    // onClick={handleSave} // 기존에 연결되어 있던 저장 함수 그대로 유지
                    className="w-full py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white shadow-md transition-all active:scale-95"
                >
                    확인
                </button>
            </div>
        </div>
    );
}