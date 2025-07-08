// src/components/PrivacyPolicy.js

import React from 'react';
import { ChevronLeft } from 'lucide-react'; // 뒤로가기 아이콘 import

// onBack 프롭스를 받도록 수정
function PrivacyPolicy({ onBack, isDarkMode }) {
  return (
    <div className="w-full max-w-4xl">
          <div className="flex items-center mb-6">
            <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-2xl font-bold ml-2">개인정보처리방침</h2>
          </div>

      <div className={`${isDarkMode ? 'text-gray-200' : 'text-gray-700'} space-y-4 text-sm`}>
        {/* 기존 개인정보처리방침 내용... */}
        <p><strong>1. 수집하는 개인정보의 항목 및 수집방법</strong><br />
        본 앱은 회원가입 및 서비스 이용 과정에서 다음과 같은 개인정보를 수집할 수 있습니다.<br />
        - 소셜 로그인 시: 이메일 주소, 프로필 사진 등 소셜 계정 제공자가 전달하는 정보<br />
        - 사용자가 직접 입력하는 정보: 수익/지출 내역 (날짜, 단가, 수량 등)</p>

        <p><strong>2. 개인정보의 수집 및 이용목적</strong><br />
        본 앱은 수집한 개인정보를 다음의 목적을 위해 활용합니다.<br />
        - 서비스 제공에 관한 계약 이행 및 서비스 제공에 따른 요금정산<br />
        - 회원 관리: 회원제 서비스 이용에 따른 본인확인, 개인 식별, 불량회원의 부정 이용 방지와 비인가 사용 방지</p>

        <p><strong>3. 개인정보의 보유 및 이용기간</strong><br />
        이용자의 개인정보는 원칙적으로 개인정보의 수집 및 이용목적이 달성되면 지체 없이 파기합니다. 단, 다음의 정보에 대해서는 아래의 이유로 명시한 기간 동안 보존합니다.<br />
        - 보존 항목: 로그인 정보, 서비스 이용 기록<br />
        - 보존 근거: 불량 이용자의 재가입 방지, 명예훼손 등 권리침해 분쟁 및 수사협조<br />
        - 보존 기간: 회원 탈퇴 시까지</p>
      </div>
    </div>
  );
}

export default PrivacyPolicy;