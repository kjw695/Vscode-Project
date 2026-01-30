import React, { useState } from 'react';
import { ChevronLeft, Mail } from 'lucide-react';

const ContactView = ({ onBack, isDarkMode }) => {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(null);

  // 개발자의 이메일 주소를 입력하세요.
  const developerEmail = "kjw891224@gmail.com"; 

  const placeholders = {
    error: "언제, 어떤 상황에서 오류가 발생했는지 알려주시면 큰 도움이 됩니다.\n\n예시)\n- 화면 : 데이터 탭\n- 내용 : 7월 15일자 데이터를 수정하려고 하니 앱이 멈춥니다.",
    suggestion: "앱에 추가되었으면 하는 기능이나, 더 편리해질 수 있는 아이디어를 자유롭게 알려주세요.\n\n예시)\n- 어떤기능이 있으면 좋겠어요.",
    etc: "내용을 입력해 주세요."
  };

  const handleSendEmail = () => {
    if (!category) {
      alert('문의 유형을 선택해주세요.');
      return;
    }
    if (message.trim() === '') {
      alert('문의 내용을 입력해주세요.');
      return;
    }

    const subject = `[배송 수익 관리 앱 문의] ${category === 'error' ? '오류 신고' : category === 'suggestion' ? '기능 제안' : '기타 문의'}`;
    const body = `문의 유형: ${category}\n\n내용:\n${message}`;
    
    // 이메일 앱 호출 (mailto 스키마 사용)
    const mailtoLink = `mailto:${developerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
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
          앱 사용 중 불편한 점이나 개선 아이디어가 있다면 언제든지 의견을 보내주세요.
        </p>
        
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={category ? placeholders[category] : "먼저 문의 유형을 선택해주세요..."}
          className={`w-full h-48 p-3 border rounded-lg resize-none placeholder:text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 placeholder:text-gray-400' : 'bg-gray-50 border-gray-300 placeholder:text-gray-500'}`}
          disabled={!category}
        />
        
        <button
          onClick={handleSendEmail}
          className="w-full mt-4 py-3 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 flex justify-center items-center gap-2"
          disabled={!category || !message.trim()}
        >
          <Mail size={18} />
          이메일로 보내기
        </button>
        
        <p className={`mt-2 text-xs text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            * 서버 없이 운영되므로 기본 이메일 앱이 실행됩니다.
        </p>
      </div>
    </div>
  );
};

export default ContactView;