// src/components/more/OpenSourceLicenses.js

import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';

function OpenSourceLicenses({ onBack, isDarkMode }) {
  const [licenses, setLicenses] = useState(null); // 초기값을 null로 설정하여 로딩 상태 구분

  useEffect(() => {
    // public 폴더의 licenses.json 파일을 fetch로 불러옵니다.
    fetch('/licenses.json')
      .then(res => {
        if (!res.ok) {
          throw new Error('네트워크 응답이 올바르지 않습니다.');
        }
        return res.json();
      })
      .then(data => {
        setLicenses(data); // 성공 시 데이터 저장
      })
      .catch(err => {
        console.error("라이선스 파일을 불러오는 데 실패했습니다:", err);
        setLicenses({}); // 오류 발생 시 빈 객체로 설정하여 "정보 없음"을 표시
      });
  }, []); // 컴포넌트가 처음 마운트될 때 한 번만 실행

  const renderContent = () => {
    // 1. 로딩 중일 때 (데이터가 아직 null일 때)
    if (licenses === null) {
      return <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>라이선스 정보를 불러오는 중입니다...</div>;
    }

    // 2. 로딩이 끝났고, 데이터가 있을 때
    if (Object.keys(licenses).length > 0) {
      return Object.keys(licenses).map(key => (
        <div key={key} className={`p-3 border rounded-lg ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{key}</h3>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <strong>라이선스:</strong> {licenses[key].licenses}
          </p>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <strong>저장소:</strong>
            <a href={licenses[key].repository} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-400 hover:underline">
              {licenses[key].repository || '정보 없음'}
            </a>
          </p>
        </div>
      ));
    }

    // 3. 로딩이 끝났지만, 데이터가 없거나 에러가 발생했을 때
    return <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>표시할 라이선스 정보가 없습니다. (`public/licenses.json` 파일을 확인해주세요)</div>;
  };

  return (
<div className="w-full max-w-4xl">
          <div className="flex items-center mb-6">
            <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-2xl font-bold ml-2">개인정보처리방침</h2>
          </div>


      <div className="space-y-4 text-xs h-[calc(100vh-250px)] overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}

export default OpenSourceLicenses;