import React from 'react';
import { ChevronLeft, Download, Upload, Trash2 } from 'lucide-react';
// dataHandlers에서 importDataFromCsv 함수를 직접 불러옵니다.
import { exportDataAsCsv, importDataFromCsv } from '../../utils/dataHandlers';

// App.js로부터 받아야 할 props 목록이 늘어났습니다.
const DataSettingsView = ({ 
    onBack, 
    isDarkMode, 
    onResetClick,
    db,
    appId,
    userId,
    showMessage,
    setIsLoading,
    setModalContent
}) => {
  const importInputRef = React.useRef(null);

  const handleExportClick = () => {
    if (!userId) return showMessage("데이터를 내보내려면 로그인이 필요합니다.");
    exportDataAsCsv(db, appId, userId, showMessage);
  };

  const handleImportTrigger = () => {
    if (!userId) return showMessage("데이터를 가져오려면 로그인이 필요합니다.");
    importInputRef.current.click();
  };
  
  // 파일이 선택되었을 때 실행될 실제 이벤트 핸들러입니다.
  const handleFileSelected = (event) => {
    importDataFromCsv(event, db, appId, userId, showMessage, setIsLoading, setModalContent);
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
                onClick={handleExportClick}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 flex items-center justify-center text-lg shadow-md"
            >
                <Download size={20} className="mr-2" /> CSV 백업
            </button>

            <button
                onClick={handleImportTrigger}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 flex items-center justify-center text-lg shadow-md"
            >
                <Upload size={20} className="mr-2" /> CSV 복원
            </button>

            <input
                type="file"
                ref={importInputRef}
                accept="*"
                onChange={handleFileSelected} // 새로 만든 핸들러를 연결합니다.
                className="hidden"
            />
        </div>

        <div className="mt-8 pt-4 border-t border-gray-300 dark:border-gray-600">
            <h3 className="text-lg font-semibold text-red-500 mb-3 text-center">위험 구역</h3>
            <button
                onClick={onResetClick}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 flex items-center justify-center text-lg shadow-md"
            >
                <Trash2 size={20} className="mr-2" /> 데이터 전체 삭제
            </button>
            <p className={`text-xs mt-2 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                주의: 이 작업은 되돌릴 수 없습니다.
            </p>
        </div>
    </div>
  );
};

export default DataSettingsView;