import React from 'react';
import { ChevronLeft } from 'lucide-react';

const PrivacyPolicy = ({ onBack, isDarkMode }) => {
  const sectionTitle = "text-lg font-bold mb-2 text-blue-600 dark:text-blue-400";
  const bodyText = "text-gray-700 dark:text-gray-300";

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
      <div className="flex items-center mb-4 shrink-0">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="뒤로">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold ml-2">개인정보 처리방침</h2>
      </div>

      <div className={`flex-1 p-5 rounded-lg overflow-y-auto ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} text-sm leading-relaxed space-y-6`}>
        <p className={bodyText}>
          택배메이트는 배송 수익·장부 관리와 회사 직원·근무표 관리 기능을 제공하기 위해 개인정보를 처리합니다.
          이 방침은 2026년 11월 21일부터 적용됩니다.
        </p>

        <section>
          <h3 className={sectionTitle}>1. 처리하는 개인정보 항목</h3>
          <ul className={`list-disc list-inside space-y-1 ${bodyText}`}>
            <li><strong>계정·인증:</strong> 이메일 주소, 인증 제공자 식별정보, 계정 식별자</li>
            <li><strong>프로필:</strong> 이름, 기사 아이디, 연락처, 생년월일, 성별, 지역, 차량번호 등 사용자가 입력한 정보</li>
            <li><strong>회사·근무 관리:</strong> 회사 및 팀 소속, 직원·노선 정보, 근무표, 휴무·교환·추가휴무 요청과 처리 이력</li>
            <li><strong>배송 장부:</strong> 배송일, 배송·반품·중단·프레시백 수량, 단가, 금액 및 사용자가 입력한 메모</li>
            <li><strong>반품 채번:</strong> 사용자가 등록한 캠프 양식 링크, 요청 정보 및 처리 결과</li>
            <li><strong>기기·위치:</strong> 앱 오류·진단 정보, 사용자가 권한을 허용한 경우 현재 위치 좌표 또는 지역명. 위치는 날씨·지역 표시 기능에 사용됩니다.</li>
            <li><strong>광고:</strong> Google AdMob이 광고 제공 및 측정을 위해 처리할 수 있는 광고 식별자와 기기 정보</li>
          </ul>
          <p className={`mt-2 ${bodyText}`}>입력하지 않은 항목은 수집하지 않으며, 기능에 따라 처리 항목이 달라질 수 있습니다.</p>
        </section>

        <section>
          <h3 className={sectionTitle}>2. 처리 목적</h3>
          <ul className={`list-disc list-inside space-y-1 ${bodyText}`}>
            <li>계정 인증, 사용자 식별, 계정 간 데이터 분리 및 동기화</li>
            <li>배송 실적·수익·지출 기록, 통계 및 백업 제공</li>
            <li>회사 구성원·노선·근무표·휴무 요청 관리와 변경 이력 보존</li>
            <li>반품 채번 양식 등록과 요청 처리</li>
            <li>날씨·지역 정보 표시, 앱 안정성 개선 및 고객 문의 대응</li>
            <li>광고 게재 및 광고 성과 측정</li>
          </ul>
        </section>

        <section>
          <h3 className={sectionTitle}>3. 보관 및 파기</h3>
          <p className={bodyText}>
            계정 및 클라우드 데이터는 서비스 이용 기간 동안 보관합니다. 계정 삭제가 완료되면 법령상 보존 의무가 있거나
            분쟁 처리 등 정당한 사유로 보관이 필요한 정보를 제외하고 관련 계정 데이터를 삭제합니다.
            기기에 저장된 데이터와 사용자가 별도로 내려받거나 외부 저장소에 보관한 백업은 계정 삭제만으로 자동 삭제되지 않을 수 있으므로
            사용자가 별도로 삭제해야 합니다.
          </p>
        </section>

        <section>
          <h3 className={sectionTitle}>4. 처리 위탁 및 제3자 서비스</h3>
          <ul className={`list-disc list-inside space-y-1 ${bodyText}`}>
            <li><strong>Supabase:</strong> 계정 인증, 클라우드 데이터베이스 및 동기화</li>
            <li><strong>Google Firebase:</strong> 웹 서비스 호스팅 등 앱 제공에 필요한 인프라</li>
            <li><strong>Google AdMob:</strong> 광고 게재 및 측정</li>
            <li><strong>기상청 공공데이터:</strong> 날씨 정보 제공</li>
            <li><strong>Kakao Local API:</strong> 위치 좌표를 행정구역 정보로 변환하는 기능(해당 기능 사용 시)</li>
            <li><strong>Google Forms:</strong> 사용자가 등록한 외부 캠프 양식으로 요청을 전달하는 기능(해당 기능 사용 시)</li>
          </ul>
          <p className={`mt-2 ${bodyText}`}>
            각 서비스 제공자의 개인정보 처리 및 국외 이전 여부는 해당 제공자의 약관과 개인정보 처리방침에 따릅니다.
            서비스별 실제 처리 지역·보관 기간은 제공자 설정과 계약을 확인해 별도로 고지합니다.
          </p>
        </section>

        <section>
          <h3 className={sectionTitle}>5. 이용자 및 회사 관리자의 권리</h3>
          <p className={bodyText}>
            이용자는 본인의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다.
            회사 소속 직원의 프로필 및 근무 정보는 회사의 인사·업무 관리 목적으로 회사 관리자에게 제공될 수 있습니다.
            회사 관리자는 업무상 필요한 범위에서만 해당 정보를 이용해야 합니다.
          </p>
        </section>

        <section>
          <h3 className={sectionTitle}>6. 계정 삭제</h3>
          <p className={bodyText}>
            로그인 사용자는 앱의 계정 관리 화면에서 계정 삭제 절차를 확인하거나 아래 외부 페이지에서 삭제를 요청할 수 있습니다.
            회사 소유자 또는 구성원으로 등록된 계정은 회사 소유권 이전·조직 탈퇴 등 필요한 절차가 먼저 완료되어야 할 수 있습니다.
          </p>
          <a className="text-blue-600 dark:text-blue-400 underline font-semibold" href="/delete-account.html" target="_blank" rel="noreferrer">
            계정 및 개인정보 삭제 요청 안내
          </a>
        </section>

        <section>
          <h3 className={sectionTitle}>7. 개인정보 보호 및 문의</h3>
          <p className={bodyText}>
            개인정보 관련 문의, 열람·정정·삭제 요청은 아래 연락처로 접수할 수 있습니다.
          </p>
          <p className="mt-2 font-semibold">이메일: zzz695@naver.com</p>
        </section>

        <section className="pb-4">
          <h3 className={sectionTitle}>8. 변경 사항</h3>
          <p className={bodyText}>
            법령, 서비스 기능 또는 개인정보 처리 방식이 변경되면 이 방침을 갱신하고 앱 또는 공개 페이지를 통해 안내합니다.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
