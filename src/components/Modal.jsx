// src/components/Modal.jsx

import React from 'react';

function Modal({ isOpen, onClose, title, content, isDarkMode }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className={`p-6 rounded-lg shadow-xl max-w-sm w-full text-center ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-800'}`}>
        <p className="text-lg font-semibold mb-4">{title}</p>
        
        {/* 다운로드 링크 등 추가 콘텐츠가 있을 경우 렌더링 */}
        {content && (
          <div className="mb-4">
            {content}
          </div>
        )}

        <button
          onClick={onClose}
          className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          확인
        </button>
      </div>
    </div>
  );
}

export default Modal;