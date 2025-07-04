//src/
//└── components/
//    └── more/
//        ├── MoreView.jsx         (새 파일 - 더보기 메인 메뉴)
//        ├── AccountView.jsx      (새 파일 - 계정 관리)
//        ├── DataSettingsView.jsx (새 파일 - 데이터 관리)
//        ├── PeriodView.jsx       (새 파일 - 월별 집계 기간)
//        └── UnitPriceView.jsx    (새 파일 - 즐겨찾는 단가)

import React from 'react';
import { User, Sun, Moon, Star, CalendarDays, Database, ChevronRight } from 'lucide-react';

function MoreView({ onNavigate, isDarkMode, toggleDarkMode }) {
  const menuItems = [
    { id: 'account', icon: <User size={24} />, text: '계정 관리' },
    { id: 'unitPrice', icon: <Star size={24} />, text: '즐겨찾는 단가' },
    { id: 'period', icon: <CalendarDays size={24} />, text: '월별 집계 기간' },
    { id: 'data', icon: <Database size={24} />, text: '데이터 관리' },
  ];

  return (
    <div className="w-full max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">더보기</h2>
      
      {/* 메뉴 리스트 */}
      <div className="space-y-2">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center p-4 rounded-lg transition-colors duration-200 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            <div className={`mr-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              {item.icon}
            </div>
            <span className="flex-grow text-left font-semibold">{item.text}</span>
            <ChevronRight size={20} className="text-gray-400" />
          </button>
        ))}
      </div>

      {/* 야간 모드 토글 */}
      <div className={`w-full flex items-center p-4 rounded-lg mt-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
        <div className={`mr-4 ${isDarkMode ? 'text-yellow-400' : 'text-gray-700'}`}>
          {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
        </div>
        <span className="flex-grow text-left font-semibold">야간 모드</span>
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