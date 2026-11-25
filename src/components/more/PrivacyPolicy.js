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
          <p>일부 기능은 로그인 없이 이용할 수 있으며, 계정·회사 관리 및 공용 양식 기능은 로그인 후 제공합니다. 앱은 기능에 따라 정보를 기기 안에서 처리하거나 외부 서비스에 저장·전송합니다.</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700 dark:text-gray-300">
            <li><strong>기기 내 배송 기록:</strong> 사용자가 입력한 배송 관련 데이터(날짜, 단가, 수량 등)는 사용자의 단말기 내부에 저장됩니다.</li>
            <li><strong>채번 기록(기기 내 저장):</strong> 운송장·주문 정보, 기사 아이디, 채번 수량, 캠프 및 요청 시각은 채번 이력과 통계 제공을 위해 기기에 저장됩니다. 새 버전에서는 해당 개인 채번 이력을 Supabase에 새로 저장하지 않습니다.</li>
            <li><strong>Google Forms 양식 메타데이터(Supabase):</strong> 등록된 양식의 링크, Google Forms 고유 ID, 캠프명, 문항 구조 및 자동 입력 연결 정보가 공용 양식 관리 기능을 위해 저장됩니다.</li>
            <li><strong>계정·회사 기능(Supabase):</strong> 로그인 계정 및 프로필 정보와 회사·직원·근무표 등 해당 기능을 제공하는 데 필요한 정보가 저장됩니다.</li>
            <li><strong>광고 식별자:</strong> 앱 수익 창출을 위해 Google AdMob을 통해 광고 식별자(ADID) 및 기기 정보를 자동으로 수집할 수 있습니다.</li>
            <li><strong>백업 데이터:</strong> 사용자가 '데이터 백업' 기능을 직접 실행할 경우, 암호화된 데이터 파일이 사용자의 개인 구글 드라이브(Google Drive)에 업로드됩니다.</li>
            <li><strong>위치 정보:</strong> 사용자의 현재 위치 기반 지역명(동네 이름) 제공을 위해 위치 정보를 처리합니다. (서버에 저장되지 않고 기기에서만 사용됨)</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">2. 개인정보의 수집 및 이용 목적</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
            <li><strong>서비스 이용:</strong> 배송 수익 계산 및 개인 채번 이력 관리 (기기 내 처리)</li>
            <li><strong>계정·회사 기능 제공:</strong> 로그인, 회사·직원 관리 및 근무표 동기화</li>
            <li><strong>공용 양식 관리:</strong> Google Forms 링크와 캠프명, 자동 입력에 필요한 양식 구조 및 연결 정보 관리</li>
            <li><strong>광고 게재:</strong> Google AdMob을 통한 맞춤형 광고 제공</li>
            <li><strong>데이터 백업:</strong> 사용자 요청 시 데이터 보관 및 복구</li>
            <li><strong>위치 정보 이용:</strong> 카카오 로컬 API를 활용하여 현재 사용자의 위치(지역명)를 화면에 표시하기 위해 사용합니다.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">3. 개인정보의 보유 및 이용기간</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
            <li><strong>기기 내 채번·배송 기록:</strong> 사용자의 기기에 저장되며, 앱 삭제 또는 앱 데이터 초기화 시 사라질 수 있습니다.</li>
            <li><strong>공용 Google Forms 양식:</strong> 양식이 삭제될 때까지 Supabase에 보관되며, 여러 로그인 사용자가 함께 조회할 수 있습니다.</li>
            <li><strong>기존 버전의 채번 기록:</strong> 과거 버전에서 서버에 저장된 기록은 새 버전 최초 실행 시 기기로 이전됩니다. 이전 결과를 확인하고 서버의 과거 사본을 정리하기 전까지는 서버에 남아 있을 수 있습니다.</li>
            <li><strong>계정·회사 기능 데이터:</strong> 계정 및 관련 회사 기능이 유지되는 동안 보관되며, 계정 삭제 또는 해당 기능의 삭제 절차에 따라 처리됩니다.</li>
            <li><strong>광고 데이터:</strong> Google AdMob의 정책에 따라 일정 기간 보관 후 파기됩니다.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">4. 개인정보의 제3자 제공</h3>
          <p className="mb-2">앱 기능 제공을 위해 아래 외부 서비스를 이용합니다. 개인 채번 이력의 새 기록은 Supabase에 저장하지 않지만, 계정·회사 기능과 공용 양식 메타데이터는 Supabase에서 처리합니다.</p>
          
          <div className="mb-3 p-3 bg-gray-200 dark:bg-gray-800 rounded">
            <p className="font-bold mb-1">[Supabase]</p>
            <p>- 제공 목적: 로그인·계정 관리, 회사·직원·근무표 기능, Google Forms 공용 양식 관리</p>
            <p>- 제공 항목: 계정·프로필 및 회사 기능 데이터, Google Forms 링크·고유 ID·캠프명·문항 구조·자동 입력 연결 정보</p>
            <p>- 참고: 운송장·주문 정보와 개인 채번 이력은 새 버전에서 Supabase에 신규 저장하지 않습니다.</p>
          </div>

          <div className="mb-3 p-3 bg-gray-200 dark:bg-gray-800 rounded">
            <p className="font-bold mb-1">[Google Forms]</p>
            <p>- 제공 목적: 사용자가 선택한 반품 채번 양식의 자동 입력 및 제출</p>
            <p>- 제공 항목: 자동 입력 링크를 열 때 운송장·주문 정보, 기사 아이디, 수량, 캠프가 URL 매개변수로 전달될 수 있습니다.</p>
            <p>- 참고: 앱은 Google Forms의 실제 제출 완료 여부를 확인하지 않습니다. 사용자가 양식 내용을 확인한 뒤 직접 제출해야 하며, 제출된 응답은 해당 양식의 운영자와 Google의 처리 기준을 따릅니다.</p>
          </div>

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
          
          <div className="p-3 bg-gray-200 dark:bg-gray-800 rounded mt-3">
            <p className="font-bold mb-1">[Kakao (카카오 로컬 API)]</p>
            <p>- 제공 목적: 위도/경도 좌표를 행정구역동(지역명)으로 변환</p>
            <p>- 제공 항목: 위치 좌표 정보 (서버에 저장되지 않고 변환 즉시 폐기됩니다.)</p>
          </div>
        </section>  

       
        <section>
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">5. 이용자의 권리 및 그 행사방법</h3>
          <p>이용자는 '데이터 삭제' 메뉴 또는 앱 삭제·데이터 초기화를 통해 기기에 저장된 기록을 파기할 수 있습니다. 계정·회사 기능 정보는 앱의 계정 삭제 절차를 이용할 수 있으며, 공용 양식은 등록·삭제 권한이 있는 사용자가 양식 관리 화면에서 삭제할 수 있습니다. 광고 추적 제한은 기기 설정에서 변경할 수 있습니다.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">6. 개인정보 보호책임자</h3>
          <p>앱 이용 중 발생하는 개인정보 관련 문의는 아래로 연락 주시기 바랍니다.</p>
          <p className="mt-1 font-semibold">이메일: zzz695@naver.com</p>
        </section>

        <section className="pb-4">
          <h3 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">7. 부칙</h3>
          <p>본 처리방침은 2026년 11월 25일부터 시행됩니다.</p>
        </section>

      </div>
    </div>
  );
};

export default PrivacyPolicy;