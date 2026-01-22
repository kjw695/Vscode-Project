// src/components/more/LegalInfoView.js

import React from 'react';
import { ChevronLeft, ChevronRight, FileText, Code } from 'lucide-react';

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

const LegalInfoView = ({ onBack, onNavigate, isDarkMode }) => {
  return (
    <div>
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold ml-4">이용약관 및 법적고지</h2>
      </div>

      <div className="space-y-1">
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
    </div>
  );
};

export default LegalInfoView;