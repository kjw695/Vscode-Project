// src/components/more/ContactView.js

import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

// 👇 onBack과 isDarkMode 외에, onSend prop을 새로 받습니다.
const ContactView = ({ onBack, onSend, isDarkMode }) => {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(null);

  const placeholders = {
    error: "언제, 어떤 상황에서 오류가 발생했는지 알려주시면 큰 도움이 됩니다.\n\n예시)\n- 화면 : 데이터 탭\n- 내용 : 7월 15일자 데이터를 수정하려고 하니 앱이 멈춥니다.",
    suggestion: "앱에 추가되었으면 하는 기능이나, 더 편리해질 수 있는 아이디어를 자유롭게 알려주세요.\n\n예시)\n- 어떤기능이 있으면 좋겠어요.",
    etc: "내용을 입력해 주세요."
  };

  const handleSubmit = () => {
    if (!category) {
      alert('문의 유형을 선택해주세요.');
      return;
    }
    if (message.trim() === '') {
      alert('문의 내용을 입력해주세요.');
      return;
    }
    // 👇 App.js로부터 받은 onSend 함수를 호출하여 데이터를 전달합니다.
    onSend(category, message);
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold ml-4">의견 보내기</h2>
      </div>

      <div className="p-4">
        <h3 className={`text-md font-semibold mb-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
          어떤 문의인가요?
        </h3>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
            <button 
                onClick={() => setCategory('error')}
                className={`py-2 rounded-lg text-sm font-semibold ${category === 'error' ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200')}`}
            >
                오류 신고
            </button>
            <button 
                onClick={() => setCategory('suggestion')}
                className={`py-2 rounded-lg text-sm font-semibold ${category === 'suggestion' ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200')}`}
            >
                개선 요청
            </button>
            <button 
                onClick={() => setCategory('etc')}
                className={`py-2 rounded-lg text-sm font-semibold ${category === 'etc' ? 'bg-purple-500 text-white' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200')}`}
            >
                기타 문의
            </button>
        </div>

        <p className={`mb-4 text-[11px] leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          앱 사용 중 불편한 점이나 개선 아이디어가 있다면 언제든지 의견을 보내주세요. 더 나은 앱을 만드는 데 큰 도움이 됩니다.
        </p>
        
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={category ? placeholders[category] : "먼저 문의 유형을 선택해주세요..."}
          className={`w-full h-48 p-3 border rounded-lg resize-none placeholder:text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 placeholder:text-gray-400' : 'bg-gray-50 border-gray-300 placeholder:text-gray-500'}`}
          disabled={!category}
        />
        <button
          onClick={handleSubmit}
          className="w-full mt-4 py-3 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
          disabled={!category || !message.trim()}
        >
          보내기
        </button>
      </div>
    </div>
  );
};

export default ContactView;