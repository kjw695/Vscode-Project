// src/components/auth/LoginPage.js
//
// 완전히 새로운 화면입니다. 기존 화면에 영향을 주지 않습니다.
// "더보기 > 계정 관리"에서 진입하는 형태로 연결하는 것을 권장합니다.
// (기존 AccountView.jsx는 그대로 두고, 그 안에 이 화면으로 가는
//  버튼 하나만 추가하는 정도로 연동 가능합니다)

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage = ({ onBack, isDarkMode, onMigrationComplete }) => {
    const { signInWithGoogle, signInWithKakao, isLoggedIn, user } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

   const handleLogin = async (providerFn, providerName) => {
        setErrorMessage('');
        setIsProcessing(true);
        setStatusMessage(`${providerName} 로그인 중...`);

        try {
            await providerFn();
            // ✨ 수정: 인앱 브라우저 팝업이 열린 직후에는 로딩 상태를 다시 풀어줍니다.
            // 로그인을 취소하고 창을 닫아도 무한 로딩에 빠지지 않게 됩니다.
            // 로그인을 성공하면 AuthContext의 새로고침 로직이 앱을 리셋하므로 깔끔하게 처리됩니다.
            setIsProcessing(false);
            setStatusMessage('');
        } catch (err) {
            setErrorMessage(`로그인 실패: ${err.message}`);
            setIsProcessing(false);
            setStatusMessage('');
        }
    };
    return (
        <div className={`w-full h-full flex flex-col p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
            <div className="flex items-center mb-8">
                <button onClick={onBack} className={`p-2 -ml-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                    ←
                </button>
                <h2 className="text-xl font-bold ml-2">로그인</h2>
            </div>

            <div className="flex-1 flex flex-col">
                <p className={`text-sm mb-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    로그인하면 다른 기기에서도 같은 데이터를 보고,<br />
                    회사 휴무표·게시판 기능을 사용할 수 있어요.<br />
                    <span className="font-semibold">로그인하지 않아도 기존처럼 계속 사용할 수 있습니다.</span>
                </p>

                {isLoggedIn ? (
                    <div className={`p-4 rounded-xl mb-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <p className="font-bold">로그인됨: {user?.email}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <button
                            disabled={isProcessing}
                            onClick={() => handleLogin(signInWithGoogle, '구글')}
                            className="w-full py-3.5 rounded-xl font-bold bg-white border border-gray-300 text-gray-700 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <svg viewBox="0 0 48 48" className="w-5 h-5 shrink-0" aria-hidden="true">
                                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"></path>
                                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                                    <path fill="none" d="M0 0h48v48H0z"></path>
                                </svg>
                                <span>구글로 계속하기</span>
                            </span>
                        </button>
                        <button
                            disabled={isProcessing}
                            onClick={() => window.alert('Apple 로그인은 준비 중입니다.')}
                            className="w-full py-3.5 rounded-xl font-bold bg-black text-white shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <svg viewBox="0 0 384 512" fill="currentColor" className="w-5 h-5 shrink-0" aria-hidden="true">
                                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                                </svg>
                                <span>Apple로 계속하기</span>
                            </span>
                        </button>
                        <button
                            disabled={isProcessing}
                            onClick={() => handleLogin(signInWithKakao, '카카오')}
                            className="w-full py-3.5 rounded-xl font-bold bg-yellow-400 text-gray-900 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0" aria-hidden="true">
                                    <path d="M12 2.5C6.2 2.5 1.5 6.3 1.5 11c0 3.1 2 5.8 5.1 7.2l-.9 3.1c-.1.5.4.8.8.5l4.1-2.3c.4.1.9.1 1.4.1 5.8 0 10.5-3.8 10.5-8.5S17.8 2.5 12 2.5Z"/>
                                </svg>
                                <span>카카오로 계속하기</span>
                            </span>
                        </button>
                    </div>
                )}

                {statusMessage && (
                    <p className="text-center text-sm mt-4 text-blue-500">{statusMessage}</p>
                )}
                {errorMessage && (
                    <p className="text-center text-sm mt-4 text-red-500">{errorMessage}</p>
                )}
            </div>
        </div>
    );
};

export default LoginPage;