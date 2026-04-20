// src/components/more/UserGuideView.js

import React from 'react';
import { ChevronLeft } from 'lucide-react';

function UserGuideView({ onBack, isDarkMode }) {
  return (
    <div className={`p-6 rounded-lg w-full max-w-4xl mb-6`}>
      <div className="flex items-center mb-6">
        <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
          <ChevronLeft size={24} />
        </button>
        <h2 className={`text-2xl font-bold ml-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
          사용자 가이드
        </h2>
      </div>
      <div className={`${isDarkMode ? 'text-gray-200' : 'text-gray-700'} space-y-4`}>
        <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>1. 데이터 입력</h3>
        <p>
          매일의 배송 관련 데이터를 입력하는 섹션입니다.
          <ul>
            <li><strong>날짜:</strong> 데이터 입력 날짜를 선택합니다.</li>
            <li><strong>단가:</strong> 배송 건당 단가를 입력합니다.</li>
            <li><strong>배송:</strong> 해당 날짜의 배송 완료 건수를 입력합니다.</li>
            <li><strong>반품:</strong> 해당 날짜의 반품 건수를 입력합니다. (수익으로 계산됩니다)</li>
            <li><strong>중단:</strong> 배송 중단으로 인한 수익 금액을 입력합니다.</li>
            <li><strong>프레시백:</strong> 수거한 프레시백 수량을 입력합니다. (개당 100원으로 계산)</li>
            <li><strong>지출 비용 입력:</strong> 버튼을 클릭하여 패널티, 산재, 유류비, 유지보수비, 부가세, 종합소득세, 세무사 비용을 추가로 입력할 수 있습니다.</li>
          </ul>
          입력 후 '저장' 또는 '수정' 버튼을 클릭하여 저장합니다.
        </p>
        <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>2. 월별 수익 (홈)</h3>
        <p>
          '홈' 탭에서 접근할 수 있으며, 선택한 월의 총 배송 수익, 반품 수익, 프레시백 수익, 배송중단 수익, 그리고 각종 비용을 집계하여 월별 순이익을 보여줍니다. 집계 기간은 '관리자 설정'에서 변경할 수 있습니다.
        </p>
        {/* ... 여기에 나머지 가이드 내용을 계속 추가 ... */}
      </div>
    </div>
  );
}

export default UserGuideView;