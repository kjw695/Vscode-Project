import React, { useRef } from 'react';
import { ArrowLeft, Download, Upload, Trash2, Cloud, FileText, AlertTriangle, Save, RefreshCw } from 'lucide-react';

const DataSettingsView = ({ 
    onBack, 
    isDarkMode, 
    handleExportCsv, 
    handleImportCsv, 
    handleDeleteAllData, 
    handleBackupToDrive,
    handleRestoreFromDrive
}) => {
    const fileInputRef = useRef(null);

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    // [추가] 같은 파일을 연속으로 선택해도 반응하도록 초기화
    const onFileInputClick = (e) => {
        e.target.value = null;
    };

    const cardClass = `p-5 rounded-xl shadow-sm border ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
    }`;

    const buttonBaseClass = "w-full py-3.5 px-4 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-95";

    return (
        <div className={`w-full h-full flex flex-col ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>
            
            {/* 상단 헤더 */}
            <div className={`flex items-center p-4 ${isDarkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-200'} sticky top-0 z-10`}>
                <button onClick={onBack} className={`p-2 rounded-full mr-2 ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold">데이터 관리</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* 1. 구글 드라이브 섹션 */}
                <div className={cardClass}>
                    <div className="flex items-center gap-2 mb-4">
                        <Cloud className="text-blue-500" size={20} />
                        <h2 className="text-lg font-bold">클라우드 동기화</h2>
                    </div>
                    <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        구글 드라이브에 데이터를 안전하게 저장하거나, 저장된 데이터를 불러옵니다.
                    </p>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={handleBackupToDrive}
                            className={`${buttonBaseClass} bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30`}
                        >
                            <Save size={18} />
                            구글 드라이브에 백업하기
                        </button>

                        <button 
                            onClick={handleRestoreFromDrive}
                            className={`${buttonBaseClass} ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                        >
                            <RefreshCw size={18} />
                            구글 드라이브에서 복원하기
                        </button>
                    </div>
                </div>

                {/* 2. CSV 파일 관리 섹션 */}
                <div className={cardClass}>
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="text-green-500" size={20} />
                        <h2 className="text-lg font-bold">파일 관리 (CSV)</h2>
                    </div>
                    <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        엑셀 호환 파일(CSV)로 데이터를 내보내거나, 저장된 파일을 불러옵니다.
                    </p>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={handleExportCsv}
                            className={`${buttonBaseClass} ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                        >
                            <Download size={18} />
                            CSV 파일로 백업
                        </button>


                        <input 
                            type="file" 
                            accept="*/*" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onClick={onFileInputClick}
                            onChange={handleImportCsv} 
                        />
                        <button 
                            onClick={handleUploadClick}
                            className={`${buttonBaseClass} ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                        >
                            <Upload size={18} />
                            CSV 파일 복원
                        </button>
                    </div>
                </div>

                {/* 3. 위험 구역 */}
                <div className={`p-5 rounded-xl shadow-sm border ${isDarkMode ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center gap-2 mb-4 text-red-600 dark:text-red-400">
                        <AlertTriangle size={20} />
                        <h2 className="text-lg font-bold">위험 구역</h2>
                    </div>
                    <p className={`text-sm mb-4 ${isDarkMode ? 'text-red-300/70' : 'text-red-600/70'}`}>
                        모든 데이터를 영구적으로 삭제합니다. 삭제된 데이터는 복구할 수 없습니다.
                    </p>
                    <button 
                        onClick={handleDeleteAllData}
                        className={`${buttonBaseClass} bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30`}
                    >
                        <Trash2 size={18} />
                        모든 데이터 초기화
                    </button>
                </div>
                
                <div className={`text-center text-xs mt-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    데이터는 사용자의 기기에만 저장되며,<br/>
                    서버로 자동 전송되지 않습니다.
                </div>
            </div>
        </div>
    );
};

export default DataSettingsView;