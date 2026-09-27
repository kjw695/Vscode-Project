// src/components/auth/LoginPage.js
//
// 완전히 새로운 화면입니다. 기존 화면에 영향을 주지 않습니다.
// "더보기 > 계정 관리"에서 진입하는 형태로 연결하는 것을 권장합니다.
// (기존 AccountView.jsx는 그대로 두고, 그 안에 이 화면으로 가는
//  버튼 하나만 추가하는 정도로 연동 가능합니다)

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { migrateLocalDataToServer } from '../../utils/migration';

const LoginPage = ({ onBack, isDarkMode, onMigrationComplete }) => {
    const { signInWithGoogle, signInWithApple, signInWithKakao, isLoggedIn, user } = useAuth();
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
                            구글로 계속하기
                        </button>
                        <button
                            disabled={isProcessing}
                            onClick={() => handleLogin(signInWithApple, '애플')}
                            className="w-full py-3.5 rounded-xl font-bold bg-black text-white shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                        >
                            Apple로 계속하기
                        </button>
                        <button
                            disabled={isProcessing}
                            onClick={() => handleLogin(signInWithKakao, '카카오')}
                            className="w-full py-3.5 rounded-xl font-bold bg-yellow-400 text-gray-900 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                        >
                            카카오로 계속하기 (준비 중)
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