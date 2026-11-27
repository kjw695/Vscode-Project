import React, { useRef } from 'react';
import { ArrowLeft, Download, Upload, Trash2, Cloud, FileText, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import DataMigrationTool from './DataMigrationTool';

const DataSettingsView = ({ 
    onBack, 
    isDarkMode, 
    handleExportCsv, 
    handleImportCsv, 
    handleResetSettings,
    handleDeleteAllData,
    isLoggedIn = false,
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
                
                <DataMigrationTool isDarkMode={isDarkMode} />

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
                            // ✨ 임시 알림창으로 변경
                            onClick={() => alert('현재 구글 드라이브 백업 기능은 개발(점검) 중입니다. 정식 출시 때 완벽하게 제공될 예정입니다! 🛠️')}
                            className={`${buttonBaseClass} bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30`}
                        >
                            <Save size={18} />
                            구글 드라이브에 백업
                        </button>

                        <button 
                            // ✨ 임시 알림창으로 변경
                            onClick={() => alert('현재 구글 드라이브 복원 기능은 개발(점검) 중입니다. 정식 출시 때 완벽하게 제공될 예정입니다! 🛠️')}
                            className={`${buttonBaseClass} ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                        >
                            <RefreshCw size={18} />
                            구글 드라이브에서 복원
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

                {/* 3. 설정 초기화: 기록과 계정은 보존합니다. */}
                <div className={cardClass}>
                    <div className="flex items-center gap-2 mb-3">
                        <RefreshCw className="text-blue-500" size={20} />
                        <h2 className="text-lg font-bold">설정 초기화</h2>
                    </div>
                    <p className={`text-sm mb-3 leading-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        단가, 수익·지출 항목, 집계 기간, 목표 금액, 보험사, 홈 화면 구성, 선호 휴무일과 테마를 최초 설치 상태로 되돌립니다.
                    </p>
                    <p className={`text-xs mb-4 ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                        배송·수익 기록, 점검표, 계정 정보와 회사 공용 자료는 삭제되지 않습니다.
                    </p>
                    <button
                        type="button"
                        onClick={handleResetSettings}
                        className={`${buttonBaseClass} ${isDarkMode ? 'bg-blue-900/40 text-blue-200 hover:bg-blue-900/60' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'} border ${isDarkMode ? 'border-blue-800' : 'border-blue-200'}`}
                    >
                        <RefreshCw size={18} />
                        설정 초기화
                    </button>
                </div>

                {/* 4. 데이터 삭제: 본인 소유 기록만 삭제합니다. */}
                <div className={`p-5 rounded-xl shadow-sm border ${isDarkMode ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center gap-2 mb-3 text-red-600 dark:text-red-400">
                        <AlertTriangle size={20} />
                        <h2 className="text-lg font-bold">데이터 삭제</h2>
                    </div>
                    <p className={`text-sm mb-3 leading-6 ${isDarkMode ? 'text-red-200/80' : 'text-red-700'}`}>
                        본인의 배송·수익 장부, 일상점검표 기록과 서명, 반품 채번 요청 이력 및 본인이 등록한 채번 양식을 삭제합니다.
                    </p>
                    <p className={`text-xs mb-4 leading-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {isLoggedIn
                            ? '서버에 저장된 본인 기록까지 삭제합니다. 계정·설정·회사 공용 자료와 다른 사람의 기록은 유지됩니다.'
                            : '이 기기에 저장된 본인 기록만 삭제합니다. 로그인 후 서버에 저장된 기록이 있다면 해당 기록은 삭제되지 않습니다.'}
                        {' '}삭제한 기록은 복구할 수 없습니다.
                    </p>
                    <button
                        type="button"
                        onClick={handleDeleteAllData}
                        className={`${buttonBaseClass} bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20`}
                    >
                        <Trash2 size={18} />
                        내 데이터 삭제
                    </button>
                </div>

                <div className={`text-center text-xs mt-8 leading-5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {isLoggedIn
                        ? '로그인 상태에서는 본인 기록이 Supabase 계정에 저장·동기화됩니다.'
                        : '로그아웃 상태에서는 일부 기록이 이 기기에만 저장됩니다.'}
                </div>
            </div>
        </div>
    );
};

export default DataSettingsView;