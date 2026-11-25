import React, { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  ADMOB_CONSENT_UPDATED_EVENT,
  getAdMobConsentInfo,
  showAdMobPrivacyOptions
} from '../../services/adMobConsentService';

const PrivacyPolicy = ({ onBack, isDarkMode }) => {
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(
    getAdMobConsentInfo()?.privacyOptionsRequirementStatus === 'REQUIRED'
  );
  const [openingPrivacyOptions, setOpeningPrivacyOptions] = useState(false);

  const sectionTitle = "text-lg font-bold mb-2 text-blue-600 dark:text-blue-400";
  const bodyText = "text-gray-700 dark:text-gray-300";

  useEffect(() => {
    const updatePrivacyOptions = (event) => {
      setPrivacyOptionsRequired(
        event.detail?.privacyOptionsRequirementStatus === 'REQUIRED'
      );
    };

    window.addEventListener(ADMOB_CONSENT_UPDATED_EVENT, updatePrivacyOptions);
    const currentInfo = getAdMobConsentInfo();
    setPrivacyOptionsRequired(
      currentInfo?.privacyOptionsRequirementStatus === 'REQUIRED'
    );

    return () => {
      window.removeEventListener(ADMOB_CONSENT_UPDATED_EVENT, updatePrivacyOptions);
    };
  }, []);

  const handleOpenPrivacyOptions = async () => {
    setOpeningPrivacyOptions(true);
    try {
      await showAdMobPrivacyOptions();
    } catch (error) {
      console.error('[PrivacyPolicy] AdMob 개인정보 옵션 화면 열기 실패:', error);
      window.alert('광고 개인정보 설정을 열지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setOpeningPrivacyOptions(false);
    }
  };

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

        {privacyOptionsRequired && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className={bodyText}>
              광고 개인정보 선택을 변경할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={handleOpenPrivacyOptions}
              disabled={openingPrivacyOptions}
              className="mt-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {openingPrivacyOptions ? '여는 중...' : '광고 개인정보 설정'}
            </button>
          </div>
        )}

        <section>
          <h3 className={sectionTitle}>1. 처리하는 개인정보 항목</h3>
          <ul className={`list-disc list-inside space-y-1 ${bodyText}`}>
            <li><strong>계정·인증:</strong> 이메일 주소, 인증 제공자 식별정보, Supabase 계정 식별자</li>
            <li><strong>프로필:</strong> 이름, 기사 아이디, 연락처, 생년월일, 성별, 지역·캠프, 차량번호 등 사용자가 입력한 정보</li>
            <li><strong>회사·근무 관리:</strong> 회사 및 팀 소속, 직원·노선 정보, 근무표, 휴무·교환·추가휴무 요청, 승인 및 변경 이력</li>
            <li><strong>배송 장부:</strong> 배송일, 배송·반품·중단·프레시백 수량, 단가, 금액, 지출 및 사용자가 입력한 메모</li>
            <li><strong>반품 채번 양식 정보:</strong> 로그인 사용자가 등록한 Google Forms 링크·고유 양식 ID·캠프명·제목·문항 구조 및 자동 입력 연결 정보. 개인 채번 이력(운송장/주문번호, 기사 아이디, 수량, 캠프, 요청 시각)은 기기 안에 저장됩니다.</li>
            <li><strong>일상점검표:</strong> 점검 날짜와 항목별 결과, 불량 조치 내용, 운송업체명, 운전자명, 차량번호, 정정 사유 및 서명 이미지</li>
            <li><strong>위치·기기:</strong> 사용자가 위치 권한을 허용한 경우 현재 위치 좌표 및 기기 위치 서비스로 얻은 지역명, 앱 오류·진단 정보</li>
            <li><strong>광고:</strong> Google Mobile Ads SDK가 광고·측정·부정 사용 방지를 위해 자동 수집·공유할 수 있는 IP 주소, 앱 실행·탭·광고 영상 시청 등 앱 상호작용, 진단·성능 정보, 기기·계정 식별자</li>
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
            <li>Google Forms 양식 분석과 로그인 사용자 간 공용 양식 관리, 개인 채번 이력·중복 확인·통계의 기기 내 처리</li>
            <li>일상점검표의 로컬 임시 저장, 서버 동기화, 서명 재사용 및 기록 관리</li>
            <li>사용자 동의에 따른 현재 지역 날씨 표시</li>
            <li>광고 게재·성과 측정, 서비스 안정성 유지 및 고객 문의 대응</li>
          </ul>
        </section>

        <section>
          <h3 className={sectionTitle}>3. 보관 기간 및 파기</h3>
          <ul className={`list-disc list-inside space-y-1 ${bodyText}`}>
            <li><strong>계정 및 개인 클라우드 데이터:</strong> 서비스 이용 기간 동안 보관하며, 계정 삭제가 완료되면 법령상 보존 의무 등 정당한 보존 사유가 있는 정보를 제외하고 삭제합니다.</li>
            <li><strong>일상점검표 서버 기록:</strong> 마지막 완료 또는 수정 시각을 기준으로 2년이 지나면 자동 삭제됩니다.</li>
            <li><strong>일상점검표 서명:</strong> 최신 서명은 재사용을 위해 보관하며, 이전 서명은 보존 중인 점검 기록에서 참조하는 동안 유지됩니다. 계정 삭제 시 해당 계정의 서명도 삭제됩니다.</li>
            <li><strong>회사 공동 이력:</strong> 다른 직원과 회사의 업무 연속성을 위해 확정 근무표·변경 이력 등은 보존될 수 있으며, 탈퇴한 사용자의 식별자는 가능한 범위에서 익명화합니다.</li>
            <li><strong>개인 채번 이력:</strong> 새 버전에서 새로 생성하는 운송장·주문 정보, 기사 아이디, 수량, 캠프, 요청 시각과 통계는 기기에 저장됩니다. 로그인 계정의 탈퇴가 완료되면 해당 계정에 연결된 기기 내 채번 설정·이력도 앱에서 삭제합니다. 게스트 데이터는 계정 탈퇴 대상이 아니므로 기기에서 별도로 관리해야 합니다. 앱 삭제 또는 앱 데이터 초기화 시 기기 내 기록은 사라질 수 있습니다. 기존 버전에 서버에 저장된 이력과 기본 선택 정보는 새 버전 최초 실행 시 기기로 1회 이전하며, 이전 검증 및 별도 서버 정리 전까지 기존 서버 사본이 Supabase에 남아 있을 수 있습니다.</li>
            <li><strong>공용 Google Forms 양식:</strong> 양식 링크·고유 ID·캠프명·제목·문항 구조 및 자동 입력 연결 정보는 로그인 사용자들이 공유할 수 있도록 Supabase에 보관됩니다. 동일한 Google Forms 고유 ID는 한 건으로 관리합니다.</li>
            <li><strong>기기 내 임시·오프라인 데이터:</strong> 앱에서 로그아웃·계정 삭제 절차를 이용하더라도 사용자가 별도로 내보낸 CSV, 공유한 PDF, 외부 양식에 제출한 응답은 해당 저장 위치에서 직접 삭제해야 합니다.</li>
          </ul>
          <p className={`mt-2 ${bodyText}`}>
            법령상 보존 의무 또는 분쟁 처리 등 정당한 사유로 별도 보관하는 정보는 해당 근거와 기간이 확인되는 범위에서 분리 보관한 후 파기합니다.
          </p>
        </section>

        <section>
          <h3 className={sectionTitle}>4. 제3자 서비스 및 처리 위탁</h3>
          <ul className={`list-disc list-inside space-y-1 ${bodyText}`}>
            <li><strong>Supabase:</strong> 로그인 인증, 계정·회사 기능 및 공용 Google Forms 양식 메타데이터의 데이터베이스 처리. 개인 채번 이력은 새 버전부터 새로 저장하지 않습니다. 주 데이터베이스 리전은 대한민국 서울(ap-northeast-2)이며, Supabase Pte. Ltd.(싱가포르)가 주요 처리자입니다. 지원·운영 인력과 운영 로그·텔레메트리는 선택한 리전 밖에서 처리될 수 있습니다.</li>
            <li><strong>Google Mobile Ads SDK (AdMob):</strong> 광고 제공·측정 및 부정 사용 방지. 이 계정의 약관상 계약 법인은 Google Asia Pacific Pte. Ltd.(싱가포르)입니다. SDK는 IP 주소, 앱 실행·탭·광고 영상 시청 등 앱 상호작용, 진단·성능 정보, 기기·계정 식별자를 자동 수집·공유할 수 있습니다.</li>
            <li><strong>기상청 공공데이터포털:</strong> 날씨 정보 제공. 앱은 기기 위치를 기상청 격자 좌표(nx, ny)로 변환해 초단기 실황·단기예보를 직접 요청합니다.</li>
            <li><strong>Android/iOS 네이티브 Geocoder:</strong> Android는 기기에서 제공하는 Geocoder 백엔드(제조사·OS별 제공자가 달라질 수 있음)를 사용하고, iOS 빌드는 Apple Core Location의 네트워크 역지오코딩 기능을 사용할 수 있습니다. 실제 Android 백엔드의 제공자·국가 및 iOS 처리 국가·보유기간은 앱 코드에서 특정되지 않습니다.</li>
            <li><strong>Google Forms 및 양식 작성자:</strong> 사용자가 등록한 양식의 문항을 분석하고, 운송장/주문번호·기사 아이디·수량·캠프 등이 포함된 사전 입력 URL을 엽니다. 양식을 제출하면 응답은 양식 작성자에게 전달되며 저장 국가·보유기간은 작성자의 Google 계정 및 조직 설정에 따릅니다.</li>
            <li><strong>Firebase Hosting:</strong> 공개 웹페이지와 계정 삭제 안내 페이지를 제공하는 정적 웹 호스팅에 사용됩니다.</li>
          </ul>
          <p className={`mt-2 ${bodyText}`}>
            현재 버전의 데이터 관리 화면에서 Google Drive 백업·복원 버튼은 안내 메시지만 표시하며 실제 Google Drive 전송은 수행하지 않습니다.
          </p>
        </section>

        <section>
          <h3 className={sectionTitle}>5. 국외 이전 관련 안내</h3>
          <p className={bodyText}>
            Supabase 운영 주 데이터베이스 리전은 대한민국 서울(ap-northeast-2)입니다. Supabase Pte. Ltd.(싱가포르)가 주요 처리자이며, Supabase 안내에 따르면 지원·운영과 사용량 로그·텔레메트리 일부는 선택한 리전 밖에서 처리될 수 있습니다. 앱은 계정 삭제와 Google Forms 양식 분석을 위해 Supabase Edge Functions를 호출하며, 두 호출 모두 서울(ap-northeast-2) 리전을 지정합니다. 2026년 11월 25일 운영 로그에서 Google Forms 분석 함수의 실제 실행 리전이 서울로 확인되었습니다. 계정 삭제 함수는 실제 계정 삭제를 발생시키는 테스트를 하지 않아 실행 리전이 아직 별도 검증되지 않았습니다. Supabase의 리전 지정 호출은 해당 리전 장애 시 자동으로 다른 리전으로 우회되지 않을 수 있습니다.
            AdMob 계약 약관에 표시된 계약 당사자는 Google Asia Pacific Pte. Ltd.(싱가포르)입니다. 다만 광고 요청은 Google의 글로벌 인프라에서 처리될 수 있으며, 계약 법인의 소재지가 유일한 처리 국가를 의미하지 않습니다. SDK는 IP 주소, 앱 상호작용, 진단·성능 정보, 기기·계정 식별자를 자동 수집·공유할 수 있습니다.
            Google Forms는 사용자가 등록한 양식별로 작성자와 데이터 저장 설정이 달라집니다. 로그인 사용자가 등록한 양식 링크와 캠프명, 자동 입력에 필요한 문항·연결 정보는 다른 로그인 사용자도 조회할 수 있는 공용 양식 메타데이터로 Supabase에 저장됩니다. 분석 시도별 이메일·오류 접수 내역과 새 개인 채번 이력은 Supabase에 저장하지 않습니다. 다만 채번 요청을 열 때 운송장/주문번호·기사 아이디·수량·캠프 값이 사전 입력 URL 매개변수로 Google Forms에 전달될 수 있고, 사용자가 제출하면 해당 양식 작성자가 응답을 받습니다.
            Android Geocoder는 기기·제조사별 백엔드 제공자가 달라질 수 있고, iOS 빌드는 Apple의 네트워크 역지오코딩을 사용할 수 있습니다. 실제 처리 국가와 보유기간은 앱 코드에서 특정되지 않습니다.
            Firebase Hosting의 공개 페이지 방문자 IP 및 요청 정보는 Google의 글로벌 인프라에서 악용 방지·이용량 분석 목적으로 처리될 수 있습니다.
            기상청 요청은 기기에서 계산한 격자 좌표(nx, ny)와 예보 기준 시각을 사용하며, 현재 코드에서는 원시 위도·경도를 기상청 API에 보내지 않습니다.
            Supabase Edge 실행 리전, Supabase 로그 보유기간, Google Forms 양식별 수령자·보유기간, Android Geocoder 실제 백엔드, Google/Firebase의 개별 수령 법인·처리국가 및 이전 거부 방법은 추가 확인이 필요합니다.
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
