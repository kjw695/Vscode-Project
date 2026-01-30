import React, { useRef } from 'react';
import { ChevronLeft, Download, Upload, Trash2, Cloud, RefreshCcw } from 'lucide-react';

const DataSettingsView = ({ 
    onBack, 
    isDarkMode, 
    handleExportCsv, 
    handleImportCsv, 
    handleDeleteAllData, 
    handleBackupToCloud, 
    onRestoreCloudData 
}) => {

  const importInputRef = useRef(null);

  const handleImportClick = () => {
    importInputRef.current.click();
  };

  const handleRestoreClick = () => {
    if (window.confirm("구글 드라이브에서 최신 백업 데이터를 가져올까요?\n현재 기기의 데이터는 백업본으로 덮어씌워집니다.")) {
        // App.js에서 전달받은 복원 함수 실행
        onRestoreCloudData();
    }
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
            {/* 구글 드라이브 백업/복원 섹션 */}
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 mb-6 border border-blue-100 dark:border-blue-800">
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">☁️ 클라우드 백업 (Google Drive)</h3>
                <div className="space-y-3">
                    <button
                        onClick={handleBackupToCloud} 
                        className="w-full bg-[#4285F4] text-white py-3 px-4 rounded-md hover:bg-[#357ae8] flex items-center justify-center text-lg shadow-sm transition-colors"
                    >
                        <Cloud size={20} className="mr-2" /> 구글 드라이브에 백업
                    </button>

                    <button
                        onClick={handleRestoreClick}
                        className="w-full bg-white text-[#4285F4] border border-[#4285F4] py-3 px-4 rounded-md hover:bg-blue-50 dark:bg-transparent dark:hover:bg-blue-900/30 flex items-center justify-center text-lg shadow-sm transition-colors"
                    >
                        <RefreshCcw size={20} className="mr-2" /> 구글 드라이브에서 복원
                    </button>
                </div>
            </div>

            <hr className="border-gray-200 dark:border-gray-700 my-6" />

            {/* CSV 파일 관리 섹션 */}
            <h3 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>📂 파일 관리 (CSV)</h3>
            <div className="space-y-3">
                <button
                    onClick={handleExportCsv}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 flex items-center justify-center text-lg shadow-md transition-colors"
                >
                    <Download size={20} className="mr-2" /> CSV 파일로 저장
                </button>
                
                <button
                    onClick={handleImportClick}
                    className="w-full bg-teal-600 text-white py-3 px-4 rounded-md hover:bg-teal-700 flex items-center justify-center text-lg shadow-md transition-colors"
                >
                    <Upload size={20} className="mr-2" /> CSV 파일 불러오기
                </button>
                
                <input
                    type="file"
                    ref={importInputRef}
                    accept=".csv, text/csv"
                    onChange={(e) => { 
                        handleImportCsv(e); 
                        if(e.target) e.target.value = null; 
                    }}
                    className="hidden"
                />
            </div>
        </div>

        {/* 데이터 삭제 섹션 */}
        <div className="mt-10 pt-6 border-t border-red-200 dark:border-red-900/50">
            <button
                onClick={handleDeleteAllData}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 flex items-center justify-center text-lg shadow-md transition-colors"
            >
                <Trash2 size={20} className="mr-2" /> 모든 데이터 삭제
            </button>
            <p className="text-xs mt-3 text-center text-red-500/80">
                주의: 기기에 저장된 모든 데이터가 즉시 삭제되며 복구할 수 없습니다.
            </p>
        </div>
    </div>
  );
};

export default DataSettingsView;