// src/components/more/OpenSourceLicenses.js

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeOpenSourceLicenses = registerPlugin('OpenSourceLicenses');

function OpenSourceLicenses({ onBack, isDarkMode }) {
  const [licenses, setLicenses] = useState(null);
  const [isOpeningAndroidLicenses, setIsOpeningAndroidLicenses] = useState(false);
  const [androidLicenseError, setAndroidLicenseError] = useState('');
  const isAndroid = Capacitor.getPlatform() === 'android';

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

  const openAndroidLicenses = async () => {
    if (!isAndroid || isOpeningAndroidLicenses) return;

    setIsOpeningAndroidLicenses(true);
    setAndroidLicenseError('');

    try {
      await NativeOpenSourceLicenses.open();
    } catch (error) {
      console.error('Android 오픈소스 라이선스 화면을 여는 데 실패했습니다:', error);
      setAndroidLicenseError('Android 라이선스 정보를 열지 못했습니다. 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.');
    } finally {
      setIsOpeningAndroidLicenses(false);
    }
  };

  const renderContent = () => {
    if (licenses === null) {
      return <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>라이선스 정보를 불러오는 중입니다...</div>;
    }

    if (Object.keys(licenses).length > 0) {
      return Object.keys(licenses).map(key => (
        <div key={key} className={`p-3 border rounded-lg ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{key}</h3>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <strong>라이선스:</strong> {licenses[key].licenses}
          </p>
          {licenses[key].licenseUrl && (
            <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <strong>라이선스 링크:</strong>
              <a href={licenses[key].licenseUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-400 hover:underline">
                정보 보기
              </a>
            </p>
          )}
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <strong>저장소:</strong>
            {licenses[key].repository ? (
              <a href={licenses[key].repository} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-400 hover:underline">
                {licenses[key].repository}
              </a>
            ) : (
              <span className="ml-1">정보 없음</span>
            )}
          </p>
        </div>
      ));
    }

    return <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>표시할 라이선스 정보가 없습니다. (`public/licenses.json` 파일을 확인해주세요)</div>;
  };

  return (
    // 기존 개인정보 처리방침과 동일한 화면 구조 유지
    <div className={`flex flex-col h-full ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
      
      {/* 상단 헤더 */}
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
        {isAndroid && (
          <section className={`p-3 border rounded-lg ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Smartphone size={18} />
              <h3 className="font-bold">Android 앱에 포함된 라이선스</h3>
            </div>
            <p className={`mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              현재 Android 앱에 포함된 네이티브 라이브러리와 라이선스 전문을 확인할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={openAndroidLicenses}
              disabled={isOpeningAndroidLicenses}
              className={`w-full flex items-center justify-between rounded-lg px-3 py-3 font-medium transition-colors disabled:opacity-60 ${isDarkMode ? 'bg-gray-700 text-gray-100 hover:bg-gray-600' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
            >
              <span>{isOpeningAndroidLicenses ? '불러오는 중...' : 'Android 라이선스 보기'}</span>
              <ChevronRight size={18} />
            </button>
            {androidLicenseError && (
              <p className="mt-2 text-sm text-red-500" role="alert">{androidLicenseError}</p>
            )}
          </section>
        )}

        {renderContent()}
      </div>
    </div>
  );
}

export default OpenSourceLicenses;
