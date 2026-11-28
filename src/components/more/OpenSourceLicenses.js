// src/components/more/OpenSourceLicenses.js

import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';

function OpenSourceLicenses({ onBack, isDarkMode }) {
  const [licenses, setLicenses] = useState(null);

  useEffect(() => {
    fetch('/licenses.json')
      .then(res => {
        if (!res.ok) {
          throw new Error('네트워크 응답이 올바르지 않습니다.');
        }
        return res.json();
      })
      .then(data => {
        setLicenses(data);
      })
      .catch(err => {
        console.error("라이선스 파일을 불러오는 데 실패했습니다:", err);
        setLicenses({});
      });
  }, []);

  const renderContent = () => {
    if (licenses === null) {
      return <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>라이선스 정보를 불러오는 중입니다...</div>;
    }

    if (Object.keys(licenses).length > 0) {
      return Object.keys(licenses).map(key => (
        <div key={key} className={`p-3 border rounded-lg ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{key}</h3>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <strong>라이선스:</strong> {licenses[key].licenses || '정보 확인 필요'}
          </p>
          {licenses[key].licenseUrl && (
            <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <strong>라이선스 링크:</strong>
              <a href={licenses[key].licenseUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-400 hover:underline">
                전문 보기
              </a>
            </p>
          )}
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <strong>{licenses[key].repository ? '저장소:' : '패키지 정보:'}</strong>
            {(licenses[key].repository || licenses[key].packageUrl) ? (
              <a
                href={licenses[key].repository || licenses[key].packageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-blue-400 hover:underline"
              >
                {licenses[key].repository || licenses[key].packageUrl}
              </a>
            ) : (
              <span className="ml-1">정보 없음</span>
            )}
          </p>
          {licenses[key].licenseNote && (
            <p className={`${isDarkMode ? 'text-yellow-300' : 'text-amber-700'}`}>
              <strong>참고:</strong> {licenses[key].licenseNote}
            </p>
          )}
        </div>
      ));
    }

    return <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>표시할 라이선스 정보가 없습니다. (`public/licenses.json` 파일을 확인해주세요)</div>;
  };

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
      <div className="flex items-center mb-4 shrink-0">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>

        <h2 className="text-xl font-bold ml-2">오픈소스 라이선스</h2>
      </div>

      <div className={`flex-1 p-5 rounded-lg overflow-y-auto ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} text-sm leading-relaxed space-y-4`}>
        {renderContent()}
      </div>
    </div>
  );
}

export default OpenSourceLicenses;
