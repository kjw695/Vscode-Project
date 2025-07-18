// src/components/more/AccountView.js

import React from 'react';
import { ChevronLeft } from 'lucide-react';

function AccountView({ onBack, isDarkMode, auth, handleLinkAccount, handleLogout, googleProvider, kakaoProvider, naverProvider }) {
  const currentUser = auth.currentUser;

  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold ml-2">계정 관리</h2>
      </div>

      {!currentUser ? (
        <div className="text-center text-gray-500">로그인 정보를 불러오는 중입니다...</div>
      ) : currentUser.isAnonymous ? (
        <div className="text-center mb-4">
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            데이터를 안전하게 저장하고 다른 기기에서 사용하려면<br/>아래 계정 중 하나를 연결해주세요.
          </p>
          <div className="flex flex-col items-center space-y-3">
            <button onClick={() => handleLinkAccount(kakaoProvider)} className="bg-[#FEE500] text-[#191919] font-bold py-2 px-4 rounded-md shadow-md w-64 text-center">
              카카오
            </button>
            <button onClick={() => handleLinkAccount(naverProvider)} className="bg-[#03C75A] text-white font-bold py-2 px-4 rounded-md shadow-md w-64 text-center">
              네이버
            </button>
            <button onClick={() => handleLinkAccount(googleProvider)} className="bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 font-bold py-2 px-4 rounded-md shadow-md w-64 flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 18 18"><path d="M16.51 8.25H9.45v3h4.03c-.16 1.01-.66 1.85-1.47 2.44v2.02h2.6c1.52-1.4 2.39-3.48 2.39-5.96 0-.57-.05-1.12-.15-1.66z" fill="#4285F4"></path><path d="M9.45 18c2.27 0 4.18-.75 5.58-2.03l-2.6-2.02c-.75.5-1.72.79-2.98.79-2.27 0-4.18-1.53-4.87-3.58H1.9v2.1C3.38 16.31 6.2 18 9.45 18z" fill="#34A853"></path><path d="M4.58 10.84c-.12-.35-.19-.72-.19-1.11s.07-.76.19-1.11V6.51H1.9C1.34 7.66 1 8.99 1 10.33s.34 2.67 1.9 3.82l2.68-2.31z" fill="#FBBC05"></path><path d="M9.45 3.64c1.24 0 2.35.43 3.23 1.25l2.25-2.25C13.63.88 11.71 0 9.45 0 6.2 0 3.38 1.69 1.9 4.18l2.68 2.31C5.27 4.76 7.18 3.64 9.45 3.64z" fill="#EA4335"></path></svg>
              Google
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center mb-4">
          <p className={`text-sm mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {currentUser.photoURL && <img src={currentUser.photoURL} alt="profile" className="w-12 h-12 rounded-full mx-auto mb-2" />}
            {currentUser.displayName || currentUser.email} 계정으로 로그인되어 있습니다.
          </p>
          <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md shadow-md">
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

export default AccountView;