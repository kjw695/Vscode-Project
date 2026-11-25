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
          택배메이트는 배송 장부, 회사 직원·근무 관리, 일상점검표 및 반품 채번 기능을 제공하기 위해 필요한 개인정보를 처리합니다.
          이 방침은 2026년 11월 25일부터 적용됩니다.
        </p>

        <section>
          <h3 className={sectionTitle}>1. 처리하는 개인정보 항목</h3>
          <ul className={`list-disc list-inside space-y-1 ${bodyText}`}>
            <li><strong>계정·인증:</strong> 이메일 주소, 인증 제공자 식별정보, Supabase 계정 식별자</li>
            <li><strong>프로필:</strong> 이름, 기사 아이디, 연락처, 생년월일, 성별, 지역·캠프, 차량번호 등 사용자가 입력한 정보</li>
            <li><strong>회사·근무 관리:</strong> 회사 및 팀 소속, 직원·노선 정보, 근무표, 휴무·교환·추가휴무 요청, 승인 및 변경 이력</li>
            <li><strong>배송 장부:</strong> 배송일, 배송·반품·중단·프레시백 수량, 단가, 금액, 지출 및 사용자가 입력한 메모</li>
            <li><strong>반품 채번:</strong> 사용자가 등록한 Google Forms 링크·양식 ID·제목·문항 및 입력값 매핑, 운송장/주문번호, 기사 아이디, 수량, 캠프, 요청 시각 및 처리 결과</li>
            <li><strong>일상점검표:</strong> 점검 날짜와 항목별 결과, 불량 조치 내용, 운송업체명, 운전자명, 차량번호, 정정 사유 및 서명 이미지</li>
            <li><strong>위치·기기:</strong> 사용자가 위치 권한을 허용한 경우 현재 위치 좌표 및 기기 위치 서비스로 얻은 지역명, 앱 오류·진단 정보</li>
            <li><strong>광고:</strong> Google Mobile Ads SDK가 광고·측정·부정 사용 방지를 위해 처리할 수 있는 IP 주소, 광고/기기 식별자, 앱 상호작용 및 진단 정보</li>
          </ul>
          <p className={`mt-2 ${bodyText}`}>
            게스트 사용자의 일부 정보는 기기에만 저장될 수 있습니다. 위치정보는 위치 권한을 허용하고 날씨 기능을 이용할 때 처리됩니다.
          </p>
        </section>

        <section>
          <h3 className={sectionTitle}>2. 처리 목적</h3>
          <ul className={`list-disc list-inside space-y-1 ${bodyText}`}>
            <li>계정 인증, 사용자 식별, 계정별 데이터 분리 및 클라우드 동기화</li>
            <li>배송 실적·수익·지출 기록, 통계, CSV 내보내기 및 복원</li>
            <li>회사 구성원·노선·근무표·휴무·교환 요청 관리와 변경 이력 보존</li>
            <li>사용자가 선택한 Google Forms 양식의 문항 분석, 사전 입력 URL 생성 및 반품 채번 요청 이력 관리</li>
            <li>일상점검표의 로컬 임시 저장, 서버 동기화, 서명 재사용 및 기록 관리</li>
            <li>사용자 동의에 따른 현재 지역 날씨 표시</li>
            <li>광고 게재·성과 측정, 서비스 안정성 유지 및 고객 문의 대응</li>
          </ul>
        </section>

        <section>
          <h3 className={sectionTitle}>3. 보관 기간 및 파기</h3>
          <ul className={`list-disc list-inside space-y-1 ${bodyText}`}>
            <li><strong>계정 및 개인 클라우드 데이터:</strong> 서비스 이용 기간 동안 보관하며, 계정 삭제가 완료되면 법령상 보존 의무 등 정당한 보존 사유가 있는 정보를 제외하고 삭제합니다.</li>
            <li><strong>일상점검표 서버 기록:</strong> 마지막 완료 또는 수정 시각을 기준으로 1년이 지나면 자동 삭제됩니다.</li>
            <li><strong>일상점검표 서명:</strong> 최신 서명은 재사용을 위해 보관하며, 이전 서명은 보존 중인 점검 기록에서 참조하는 동안 유지됩니다. 계정 삭제 시 해당 계정의 서명도 삭제됩니다.</li>
            <li><strong>회사 공동 이력:</strong> 다른 직원과 회사의 업무 연속성을 위해 확정 근무표·변경 이력 등은 보존될 수 있으며, 탈퇴한 사용자의 식별자는 가능한 범위에서 익명화합니다.</li>
            <li><strong>기기 내 임시·오프라인 데이터:</strong> 서버 동기화 전까지 기기에 저장됩니다. 앱에서 로그아웃·계정 삭제 절차를 이용하더라도 사용자가 별도로 내보낸 CSV, 공유한 PDF, 외부 양식에 제출한 응답은 해당 저장 위치에서 직접 삭제해야 합니다.</li>
          </ul>
          <p className={`mt-2 ${bodyText}`}>
            법령상 보존 의무 또는 분쟁 처리 등 정당한 사유로 별도 보관하는 정보는 해당 근거와 기간이 확인되는 범위에서 분리 보관한 후 파기합니다.
          </p>
        </section>

        <section>
          <h3 className={sectionTitle}>4. 제3자 서비스 및 처리 위탁</h3>
          <ul className={`list-disc list-inside space-y-1 ${bodyText}`}>
            <li><strong>Supabase:</strong> 로그인 인증, 클라우드 데이터베이스, 사용자 데이터 동기화 및 계정 삭제 처리. 현재 운영 데이터베이스 프로젝트의 리전은 대한민국 서울(ap-northeast-2)입니다.</li>
            <li><strong>Google Mobile Ads SDK (AdMob):</strong> 광고 제공·측정 및 부정 사용 방지. SDK는 IP 주소, 앱 상호작용, 진단 정보 및 기기/광고 식별자를 자동 수집·공유할 수 있습니다.</li>
            <li><strong>기상청 공공데이터포털:</strong> 날씨 정보 제공. 앱은 기기 위치를 기상청 격자 좌표(nx, ny)로 변환해 초단기 실황·단기예보를 직접 요청합니다.</li>
            <li><strong>Android/iOS 운영체제의 네이티브 Geocoder:</strong> 위치 권한을 허용한 경우 좌표에 대응하는 지역명을 얻는 데 사용됩니다. 기기 및 운영체제 제공자의 지오코딩 처리 방식이 적용될 수 있습니다.</li>
            <li><strong>Google Forms 및 양식 작성자:</strong> 사용자가 직접 등록한 양식으로 이동할 때 운송장/주문번호, 기사 아이디, 수량, 캠프 등 사전 입력값이 포함된 URL을 생성합니다. 제출된 응답은 해당 Google Form의 소유자와 Google이 각자의 정책에 따라 처리합니다.</li>
            <li><strong>Firebase Hosting:</strong> 공개 웹페이지와 계정 삭제 안내 페이지를 제공하는 정적 웹 호스팅에 사용됩니다.</li>
          </ul>
          <p className={`mt-2 ${bodyText}`}>
            현재 버전의 데이터 관리 화면에서 Google Drive 백업·복원 버튼은 안내 메시지만 표시하며 실제 Google Drive 전송은 수행하지 않습니다.
          </p>
        </section>

        <section>
          <h3 className={sectionTitle}>5. 국외 이전 관련 안내</h3>
          <p className={bodyText}>
            Supabase 운영 데이터베이스의 설정 리전은 대한민국 서울입니다. 다만 Google 광고·Forms·운영체제 지오코딩 등 외부 서비스는 서비스 구성 및 제공자 정책에 따라 국외에서 개인정보를 처리할 수 있습니다.
            각 제공자의 실제 수령 법인, 이전 국가, 이전 항목·시기·방법, 이용 목적 및 보유 기간은 운영 계정의 계약·제품 설정을 기준으로 확인해 공개 페이지에 구체적으로 고지합니다.
          </p>
        </section>

        <section>
          <h3 className={sectionTitle}>6. 이용자 및 회사 관리자의 권리</h3>
          <p className={bodyText}>
            이용자는 본인의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다. 회사 소속 직원의 프로필 및 근무 정보는 회사의 인사·업무 관리 목적상 회사 관리자에게 표시될 수 있으며, 관리자는 업무상 필요한 범위에서만 해당 정보를 이용해야 합니다.
          </p>
        </section>

        <section>
          <h3 className={sectionTitle}>7. 계정 삭제</h3>
          <p className={bodyText}>
            로그인 사용자는 앱의 더보기 → 계정 관리 화면에서 회원 탈퇴를 진행할 수 있습니다. 회사 소유자는 회사 소유권을 이전하고, 회사 구성원은 조직에서 탈퇴한 뒤 계정 삭제를 진행해야 합니다.
            로그인할 수 없는 경우 아래 공개 안내 페이지에서 이메일 요청 방법을 확인할 수 있습니다.
          </p>
          <a className="text-blue-600 dark:text-blue-400 underline font-semibold" href="/delete-account.html" target="_blank" rel="noreferrer">
            계정 및 개인정보 삭제 요청 안내
          </a>
        </section>

        <section>
          <h3 className={sectionTitle}>8. 개인정보 보호 및 문의</h3>
          <p className={bodyText}>
            개인정보 열람·정정·삭제 및 처리 관련 문의는 아래 이메일로 접수할 수 있습니다.
          </p>
          <p className="mt-2 font-semibold">이메일: kjw891224@gmail.com</p>
        </section>

        <section className="pb-4">
          <h3 className={sectionTitle}>9. 변경 사항</h3>
          <p className={bodyText}>
            개인정보 처리 방식 또는 제공 서비스가 변경되면 이 방침과 공개 페이지를 갱신하고 적용일을 표시합니다.
          </p>
          <a className="block mt-2 text-blue-600 dark:text-blue-400 underline" href="/privacy-policy.html" target="_blank" rel="noreferrer">
            공개 개인정보 처리방침
          </a>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
