import React from 'react';
import { AlertTriangle } from 'lucide-react';

const MessageModal = ({ isOpen, content, type, onConfirm, onClose, isDarkMode }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-[9999] p-4">
            <div className={`p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-in zoom-in duration-200 ${
                isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'
            }`}>
                {/* 확인창일 때만 경고 아이콘 표시 */}
                {type === 'confirm' && (
                    <div className="flex justify-center mb-4 text-red-500">
                        <AlertTriangle size={48} />
                    </div>
                )}

                <p className="text-lg font-bold mb-6 whitespace-pre-wrap leading-relaxed">
                    {content}
                </p>

                <div className="flex justify-center gap-3">
                    {type === 'confirm' ? (
                        <>
                            <button 
                                onClick={onClose} 
                                className={`flex-1 py-3 rounded-xl font-bold transition-colors ${
                                    isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            >
                                취소
                            </button>
                            <button 
                                onClick={() => { onConfirm(); onClose(); }} 
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                            >
                                {content.includes('종료') ? '종료' : '확인'}
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={onClose} 
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                        >
                            확인
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageModal;