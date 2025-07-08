// src/components/OpenSourceLicenses.js

import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react'; // 뒤로가기 아이콘 import

// onBack 프롭스를 받도록 수정
function OpenSourceLicenses({ onBack, isDarkMode }) {
  const [licenses, setLicenses] = useState(null);

  useEffect(() => {
    fetch('/licenses.json')
      .then(res => res.json())
      .then(data => {
        setLicenses(data);
      })
      .catch(err => console.error("Could not load licenses:", err));
  }, []);

  return (
    <div className="w-full max-w-4xl">
          <div className="flex items-center mb-6">
            <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-2xl font-bold ml-2">오픈소스 라이선스</h2>
          </div>

      <div className="space-y-4 text-xs">
        {Object.keys(licenses).map(key => (
          <div key={key} className={`p-2 border rounded ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
            <h3 className={`font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{key}</h3>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}><strong>라이선스:</strong> {licenses[key].licenses}</p>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}><strong>저장소:</strong> <a href={licenses[key].repository} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{licenses[key].repository}</a></p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OpenSourceLicenses;