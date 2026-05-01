// src/components/more/LegalInfoView.js

import React from 'react';
import { ChevronLeft, ChevronRight, FileText, Code, Database } from 'lucide-react';

// 각 메뉴 아이템을 위한 재사용 컴포넌트
const MenuItem = ({ icon, text, onClick, isDarkMode }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
    >
        <div className="flex items-center">
            {icon}
            <span className="ml-4 font-medium">{text}</span>
        </div>
        <ChevronRight size={20} className="text-gray-400" />
    </button>
);

// 데이터 출처 등 클릭이 필요 없는 단순 정보 표시용 컴포넌트
const InfoItem = ({ icon, title, description, isDarkMode }) => (
    <div className={`w-full flex flex-col p-4 rounded-lg ${isDarkMode ? 'text-gray-100 bg-gray-800' : 'text-gray-800 bg-gray-50'}`}>
        <div className="flex items-center mb-1">
            {icon}
            <span className="ml-4 font-medium">{title}</span>
        </div>
        <p className={`text-sm ml-10 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {description}
        </p>
    </div>
);

const LegalInfoView = ({ onBack, onNavigate, isDarkMode }) => {
  return (
    <div>
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold ml-4">이용약관 및 법적고지</h2>
      </div>

      <div className="space-y-1 mb-8">
        <MenuItem 
          icon={<FileText size={24} />} 
          text="개인정보 처리방침" 
          onClick={() => onNavigate('privacyPolicy')} 
          isDarkMode={isDarkMode} 
        />
        <MenuItem 
          icon={<Code size={24} />} 
          text="오픈소스 라이선스" 
          onClick={() => onNavigate('openSource')} 
          isDarkMode={isDarkMode} 
        />
      </div>
      <div>
        <h3 className={`text-sm font-bold mb-2 px-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          데이터 제공처 (Data Sources)
        </h3>
        <InfoItem 
            icon={<Database size={24} />}
            title="날씨 데이터"
            description="자료제공: 기상청 (공공데이터포털)"
            isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
};

export default LegalInfoView;