// src/components/more/PrivacyPolicy.js
import React from 'react';
import { ChevronLeft } from 'lucide-react';

const PrivacyPolicy = ({ onBack, isDarkMode }) => {
  return (
    <div>
      {/* 👇👇👇 빠져있던 뒤로가기 버튼과 제목 UI 👇👇👇 */}
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold ml-4">개인정보 처리방침</h2>
      </div>

      {/* 👇 사용자님의 기존 내용은 이 div 안으로 옮겼습니다. */}
      <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} text-sm space-y-4 h-[calc(100vh-250px)] overflow-y-auto`}>
        <section>
            <h3 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">개인정보 처리방침</h3>
            <div className="text-sm space-y-2">
              <p><strong>1. 수집하는 개인정보 항목</strong><br/>본 앱은 Firebase 인증을 통해 익명 식별자(UID)를 수집하며, 사용자가 소셜 로그인을 선택할 경우 해당 서비스의 이메일 주소, 이름 등 기본 프로필 정보를 수집할 수 있습니다. 또한, 사용자가 직접 입력하는 배송 관련 데이터(날짜, 단가, 수량 등)를 저장합니다.</p>
              <p><strong>2. 개인정보의 수집 및 이용 목적</strong><br/>수집된 정보는 서비스 제공, 데이터 동기화, 사용자 식별 및 통계 분석을 위해 사용됩니다.</p>
              <p><strong>3. 개인정보의 보유 및 이용기간</strong><br/>사용자가 회원 탈퇴를 하거나 데이터 삭제를 요청할 경우 지체 없이 파기합니다.</p>
              {/* 👇 이 아래 부분은 제안드렸던 상세 내용입니다. 필요 없으시면 지우셔도 됩니다. */}
              <div>
                <p className="font-semibold">4. 개인정보의 제3자 제공</p>
                <p>앱은 다음과 같이 개인정보를 제3자에게 제공하고 있습니다.</p>
                <ul className="list-disc list-inside pl-2">
                  <li><strong>제공받는 자:</strong> Google Firebase</li>
                  <li><strong>제공 목적:</strong> 데이터의 안전한 저장 및 관리, 사용자 인증</li>
                  <li><strong>제공 항목:</strong> 익명 UID, 소셜 로그인 정보, 사용자가 입력한 모든 데이터</li>
                </ul>
              </div>
              
              <div>
                <p className="font-semibold">5. 이용자의 권리 및 그 행사방법</p>
                <p>이용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며, 계정 삭제를 요청할 수도 있습니다. 데이터의 수정 및 삭제는 앱 내 '더보기' 탭의 '데이터 관리' 메뉴를 통해 직접 수행할 수 있습니다.</p>
              </div>
              
              <div>
                <p className="font-semibold">6. 개인정보 보호책임자</p>
                <p>앱의 개인정보 처리에 관한 문의는 아래 연락처로 하실 수 있습니다.</p>
                <p>이메일: [zzz695@naver.com]</p>
              </div>

              <div>
                <p className="font-semibold">7. 개인정보 처리방침 변경에 관한 사항</p>
                <p>본 개인정보 처리방침의 내용 추가, 삭제 및 수정이 있을 경우, 앱 내 공지사항을 통해 고지할 것입니다.</p>
              </div>
              
              <p className="text-xs text-gray-500 pt-4">시행 일자: 2025년 7월 23일</p>
            </div>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;