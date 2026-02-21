//src/
//└── components/
//    └── more/
//        ├── MoreView.jsx         (새 파일 - 더보기 메인 메뉴)
//        ├── AccountView.jsx      (새 파일 - 계정 관리)
//        ├── DataSettingsView.jsx (새 파일 - 데이터 관리)
//        ├── PeriodView.jsx       (새 파일 - 월별 집계 기간)
//        └── UnitPriceView.jsx    (새 파일 - 즐겨찾는 단가)
//        └── ExpenseSettingsView.js (새 파일 -지출 항목 관리 파일)
// src/components/more/MoreView.js
// src/components/more/MoreView.js
import React from 'react';
// ✨ Target 아이콘 추가
import { ChevronRight, User, CircleDollarSign, CalendarDays, Database, HelpCircle, FileText, Sun, Moon, Bell, BookOpen, MessageSquare, CreditCard, Target } from 'lucide-react';

const MenuItem = ({ icon, text, onClick, isDarkMode }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
    >
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
                <MenuItem icon={<CreditCard size={24} />} text="항목 관리" onClick={() => onNavigate('expenseSettings')} isDarkMode={isDarkMode} />
                <MenuItem icon={<CalendarDays size={24} />} text="월별 집계 기간 설정" onClick={() => onNavigate('period')} isDarkMode={isDarkMode} />
                 {/* 👇 목표 금액 설정 메뉴 추가 */}
                <MenuItem icon={<Target size={24} />} text="목표 금액 설정" onClick={() => onNavigate('goal')} isDarkMode={isDarkMode} />
                <MenuItem icon={<Database size={24} />} text="데이터 관리" onClick={() => onNavigate('data')} isDarkMode={isDarkMode} />
            </div>

            <hr className="my-4 border-gray-200 dark:border-gray-700" />
            <p className="px-4 mb-1 text-sm text-gray-500 font-semibold">알림</p>
            <div className="space-y-1">
                <MenuItem icon={<BookOpen size={24} />} text="배송 가이드" onClick={() => onNavigate('userGuide')} isDarkMode={isDarkMode} />
            </div>

            <hr className="my-4 border-gray-200 dark:border-gray-700" />
            <p className="px-4 mb-1 text-sm text-gray-500 font-semibold">이용정보</p>
            <div className="space-y-1">
                <MenuItem icon={<FileText size={24} />} text="이용약관 및 법적고지" onClick={() => onNavigate('legalInfo')} isDarkMode={isDarkMode} />
            </div>
            
            <hr className="my-4 border-gray-200 dark:border-gray-700" />
            <p className="px-4 mb-1 text-sm text-gray-500 font-semibold">문의</p>
            <div className="space-y-1">
                <MenuItem icon={<MessageSquare size={24} />} text="의견 보내기" onClick={() => onNavigate('contact')} isDarkMode={isDarkMode} />
            </div>

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