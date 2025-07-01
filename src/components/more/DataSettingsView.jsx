import React from 'react';
import { ChevronLeft, Download, Upload } from 'lucide-react';

function DataSettingsView({ onBack, isDarkMode, handleBackupData, handleRestoreData, handleExportCsv, handleImportCsv }) {
  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold ml-2">데이터 관리</h2>
      </div>

      <div className="space-y-6">
        {/* JSON 백업/복원 */}
        <div>
          <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>백업 및 복원 (JSON)</h3>
          <button onClick={handleBackupData} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 flex items-center justify-center mb-4">
            <Download size={20} className="mr-2" /> 데이터 백업 (JSON)
          </button>
          <div>
            <label htmlFor="restoreFile" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              데이터 복원 (JSON 파일 선택):
            </label>
            <input type="file" id="restoreFile" accept=".json" onChange={handleRestoreData} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>
        </div>

        {/* CSV 내보내기/가져오기 */}
        <div>
          <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>내보내기/가져오기 (CSV)</h3>
          <button onClick={handleExportCsv} className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 flex items-center justify-center mb-4">
            <Download size={20} className="mr-2" /> 데이터 내보내기 (CSV)
          </button>
          <div>
            <label htmlFor="importCsvFile" className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              데이터 가져오기 (CSV 파일 선택):
            </label>
            <input type="file" id="importCsvFile" accept=".csv" onChange={handleImportCsv} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
             <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                * Excel 파일 직접 가져오기는 지원되지 않습니다. Excel에서 CSV 형식으로 저장 후 사용해주세요.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataSettingsView;
