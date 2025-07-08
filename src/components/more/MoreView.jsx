//src/
//└── components/
//    └── more/
//        ├── MoreView.jsx         (새 파일 - 더보기 메인 메뉴)
//        ├── AccountView.jsx      (새 파일 - 계정 관리)
//        ├── DataSettingsView.jsx (새 파일 - 데이터 관리)
//        ├── PeriodView.jsx       (새 파일 - 월별 집계 기간)
//        └── UnitPriceView.jsx    (새 파일 - 즐겨찾는 단가)
// src/components/more/MoreView.js

// src/components/more/MoreView.js

import React from 'react';
import { ChevronRight, User, CircleDollarSign, CalendarDays, Database, HelpCircle, FileText, Code, Sun, Moon } from 'lucide-react';

// 각 메뉴 아이템을 위한 컴포넌트
const MenuItem = ({ icon, text, onClick, isDarkMode }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
    >
        {/* 👇 flex-shrink-0와 overflow-hidden을 추가하여 레이아웃을 고정합니다. */}
        <div className="flex items-center flex-shrink-0 overflow-hidden">
            {icon}
            <span className="ml-4 font-medium whitespace-nowrap">{text}</span>
        </div>
        <ChevronRight size={20} className="text-gray-400" />
    </button>
);

function MoreView({ onNavigate, isDarkMode, toggleDarkMode }) {
    return (
        <div className="w-full max-w-4xl mx-auto">
            <h2 className={`text-2xl font-bold mb-4 px-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>더보기</h2>
            
            <div className="space-y-1">
                <MenuItem icon={<User size={24} />} text="계정 관리" onClick={() => onNavigate('account')} isDarkMode={isDarkMode} />
                <MenuItem icon={<CircleDollarSign size={24} />} text="단가 설정" onClick={() => onNavigate('unitPrice')} isDarkMode={isDarkMode} />
                <MenuItem icon={<CalendarDays size={24} />} text="월별 집계 기간 설정" onClick={() => onNavigate('period')} isDarkMode={isDarkMode} />
                <MenuItem icon={<Database size={24} />} text="데이터 관리" onClick={() => onNavigate('data')} isDarkMode={isDarkMode} />
            </div>

            <div className="mt-6 space-y-1">
                 <MenuItem icon={<HelpCircle size={24} />} text="사용자 가이드" onClick={() => onNavigate('userGuide')} isDarkMode={isDarkMode} />
                 <MenuItem icon={<FileText size={24} />} text="개인정보처리방침" onClick={() => onNavigate('privacyPolicy')} isDarkMode={isDarkMode} />
                 <MenuItem icon={<Code size={24} />} text="오픈소스 라이선스" onClick={() => onNavigate('openSource')} isDarkMode={isDarkMode} />
            </div>

            {/* 다크 모드 토글 */}
            <div className="mt-6 p-4 flex items-center justify-between">
                <div className={`flex items-center ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                    {isDarkMode ? <Moon size={24} /> : <Sun size={24} />}
                    <span className="ml-4 font-medium">다크 모드</span>
                </div>
                <button
                    onClick={toggleDarkMode}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
    );
}

export default MoreView;