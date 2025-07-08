// src/components/more/DataSettingsView.jsx
// 파일 전체를 아래 코드로 교체해주세요.

import React from 'react';
import { ChevronLeft, Download, Upload } from 'lucide-react';

const DataSettingsView = ({ onBack, isDarkMode, handleExportCsv, handleImportCsv }) => {
  const importInputRef = React.useRef(null);

  const handleImportClick = () => {
    importInputRef.current.click();
  };
  
  return (
    <div className="p-4">
        <div className="flex items-center mb-6">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                <ChevronLeft size={24} />
            </button>
            <h2 className="text-xl font-bold text-center flex-1">데이터 관리 (CSV)</h2>
        </div>

        <div className="space-y-4">
            <button
                onClick={handleExportCsv}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 flex items-center justify-center text-lg shadow-md transition-transform transform hover:scale-105"
            >
                <Download size={20} className="mr-2" /> CSV 백업
            </button>

            <button
                onClick={handleImportClick}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 flex items-center justify-center text-lg shadow-md transition-transform transform hover:scale-105"
            >
                <Upload size={20} className="mr-2" /> CSV 복원
            </button>

            <input
                type="file"
                ref={importInputRef}
                accept=".csv"
                onChange={handleImportCsv}
                className="hidden"
            />
        </div>

        <p className={`text-sm mt-6 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            기존 데이터를 백업하거나, 새로운 기기로 데이터를 옮길 때 사용하세요.
        </p>
    </div>
  );
};

export default DataSettingsView;