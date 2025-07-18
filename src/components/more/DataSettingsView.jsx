// src/components/more/DataSettingsView.jsx

import React from 'react';
import { ChevronLeft, Download, Upload, Trash2 } from 'lucide-react';

const DataSettingsView = ({ onBack, isDarkMode, handleExportCsv, handleImportCsv, handleDeleteAllData }) => {
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
            <h2 className="text-xl font-bold text-center flex-1">데이터 관리</h2>
        </div>

        <div className="space-y-4">
            <button
                onClick={handleExportCsv}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 flex items-center justify-center text-lg shadow-md"
            >
                <Download size={20} className="mr-2" /> CSV 백업
            </button>
            <button
                onClick={handleImportClick}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 flex items-center justify-center text-lg shadow-md"
            >
                <Upload size={20} className="mr-2" /> CSV 복원
            </button>
            <input
                type="file"
                ref={importInputRef}
                accept=".csv, text/csv"
                onChange={(e) => { 
                    handleImportCsv(e); 
                    // 파일 선택 후 같은 파일을 다시 선택할 수 있도록 입력 값을 초기화합니다.
                    if(e.target) e.target.value = null; 
                }}
                className="hidden"
            />
        </div>

        {/* 데이터 삭제 섹션 */}
        <div className="mt-8 pt-6 border-t border-red-500/30">
            <button
                onClick={handleDeleteAllData}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 flex items-center justify-center text-lg shadow-md"
            >
                <Trash2 size={20} className="mr-2" /> 모든 데이터 삭제
            </button>
            <p className="text-sm mt-3 text-center text-red-500/90">
                주의: 이 작업은 되돌릴 수 없습니다. 삭제 전 반드시 백업을 진행해주세요.
            </p>
        </div>
    </div>
  );
};

export default DataSettingsView;