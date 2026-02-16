import React from 'react';
import { ChevronLeft } from 'lucide-react';

const PrivacyPolicy = ({ onBack, isDarkMode }) => {
  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
      {/* 상단 헤더 */}
      <div className="flex items-center mb-4 shrink-0">
        <button 
          onClick={onBack} 
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold ml-2">개인정보 처리방침</h2>
      </div>

      {/* 본문 내용 (스크롤 가능) */}
      <div className={`flex-1 p-5 rounded-lg overflow-y-auto ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} text-sm leading-relaxed space-y-6`}>
        
        <section>
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">1. 수집하는 개인정보 항목</h3>
          <p>본 앱은 별도의 회원가입 없이 이용 가능하며, 서비스 제공을 위해 다음과 같은 정보를 처리합니다.</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700 dark:text-gray-300">
            <li><strong>기기 내 저장:</strong> 사용자가 입력한 배송 관련 데이터(날짜, 단가, 수량 등)는 사용자의 단말기 내부에만 저장됩니다.</li>
            <li><strong>광고 식별자:</strong> 앱 수익 창출을 위해 Google AdMob을 통해 광고 식별자(ADID) 및 기기 정보를 자동으로 수집할 수 있습니다.</li>
            <li><strong>백업 데이터:</strong> 사용자가 '데이터 백업' 기능을 직접 실행할 경우, 암호화된 데이터 파일이 사용자의 개인 구글 드라이브(Google Drive)에 업로드됩니다.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">2. 개인정보의 수집 및 이용 목적</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
            <li><strong>서비스 이용:</strong> 배송 수익 계산 및 기록 관리 (기기 내 자체 처리)</li>
            <li><strong>광고 게재:</strong> Google AdMob을 통한 맞춤형 광고 제공</li>
            <li><strong>데이터 백업:</strong> 사용자 요청 시 데이터 보관 및 복구</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">3. 개인정보의 보유 및 이용기간</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
            <li><strong>앱 데이터:</strong> 사용자의 기기에만 저장되므로, 앱을 삭제하거나 데이터를 직접 지우면 즉시 소멸됩니다.</li>
            <li><strong>광고 데이터:</strong> Google AdMob의 정책에 따라 일정 기간 보관 후 파기됩니다.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">4. 개인정보의 제3자 제공</h3>
          <p className="mb-2">본 앱은 사용자의 개인정보를 외부 서버에 저장하지 않으나, 다음의 경우에는 제3자의 서비스를 이용합니다.</p>
          
          <div className="mb-3 p-3 bg-gray-200 dark:bg-gray-800 rounded">
            <p className="font-bold mb-1">[Google AdMob]</p>
            <p>- 제공 목적: 앱 내 배너 광고 게재</p>
            <p>- 제공 항목: 광고 식별자(ADID), 기기 정보, 앱 이용 기록</p>
          </div>

          <div className="p-3 bg-gray-200 dark:bg-gray-800 rounded">
            <p className="font-bold mb-1">[Google Drive (사용자 본인 계정)]</p>
            <p>- 제공 목적: 데이터 백업 및 복원</p>
            <p>- 제공 항목: 사용자가 생성한 백업 파일 (개발자는 이 파일에 접근할 수 없습니다.)</p>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">5. 이용자의 권리 및 그 행사방법</h3>
          <p>이용자는 언제든지 앱을 삭제하거나 '데이터 삭제' 메뉴를 통해 기기에 저장된 모든 정보를 파기할 수 있습니다. 또한, 기기 설정에서 광고 추적 제한을 설정하여 맞춤형 광고 수신을 거부할 수 있습니다.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">6. 개인정보 보호책임자</h3>
          <p>앱 이용 중 발생하는 개인정보 관련 문의는 아래로 연락 주시기 바랍니다.</p>
          <p className="mt-1 font-semibold">이메일: zzz695@naver.com</p>
        </section>

        <section className="pb-4">
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">7. 부칙</h3>
          <p>본 개인정보 처리방침은 2026년 2월 11일부터 시행됩니다.</p>
        </section>

      </div>
    </div>
  );
};

export default PrivacyPolicy;