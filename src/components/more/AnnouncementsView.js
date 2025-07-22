// src/components/more/AnnouncementsView.js

import React from 'react';
import { ChevronLeft } from 'lucide-react';

const AnnouncementsView = ({ onBack, isDarkMode }) => {
  return (
    <div>
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold ml-4">공지사항</h2>
      </div>
      <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} text-sm space-y-4`}>
        <p>현재 등록된 공지사항이 없습니다.</p>
      </div>
    </div>
  );
};

export default AnnouncementsView;
