import React from 'react';
import { ChevronLeft, UserX, AlertCircle } from 'lucide-react';

function AccountView({ onBack, isDarkMode }) {
  // auth, handleLinkAccount 등의 props는 로컬 모드에서 사용하지 않으므로 무시합니다.

  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold ml-2">계정 관리</h2>
      </div>

      <div className={`flex flex-col items-center justify-center p-8 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className={`p-4 rounded-full mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <UserX size={48} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
        </div>
        
        <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            로컬 모드로 실행 중
        </h3>
        
        <p className={`text-center mb-6 max-w-md ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            현재 별도의 계정 로그인 없이 기기 내부에 데이터를 저장하고 있습니다. 
            서버에 데이터가 전송되지 않으므로 개인정보 유출 걱정 없이 안전하게 사용할 수 있습니다.
        </p>

        <div className={`flex items-start p-4 rounded-md w-full max-w-md ${isDarkMode ? 'bg-blue-900/30 text-blue-100' : 'bg-blue-50 text-blue-800'}`}>
            <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
                <p className="font-bold mb-1">데이터 관리 주의사항</p>
                <p>
                    앱을 삭제하거나 브라우저 캐시를 정리하면 데이터가 유실될 수 있습니다. 
                    <strong> [더보기 &gt; 데이터]</strong> 메뉴에서 구글 드라이브 백업을 주기적으로 이용해주세요.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}

export default AccountView;