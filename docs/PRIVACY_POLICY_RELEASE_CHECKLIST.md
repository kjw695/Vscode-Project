# 개인정보 처리방침 공개 전 확인 목록

현재 공개 처리방침 초안은 저장소의 실제 데이터 흐름과 Supabase 운영 설정을 기준으로 작성했습니다. 아래 항목을 확인하기 전에는 Play Console에 최종 URL을 등록하거나 이 페이지를 운영 사이트에 배포하지 않습니다.

## 운영자 정보 및 문의처
- [ ] 개인정보처리자(개인/사업자/법인)의 공식 명칭을 확인하고 페이지에 표시
- [ ] 개인정보 보호책임자의 성명 또는 개인정보 보호업무·고충처리 담당 부서의 명칭 확인
- [x] 현재 문의 채널은 `kjw891224@gmail.com` 이메일만 사용. 개인 휴대전화 번호는 공개하지 않고 유료 인터넷전화도 가입하지 않기로 결정
- [ ] 해당 이메일을 정기적으로 확인하고 개인정보 열람·정정·삭제·처리정지 요청을 실제로 접수·처리할 수 있는지 확인
- [ ] 개인정보보호위원회 2026년 4월 작성지침은 전화번호와 이메일을 함께 표시하는 방식을 권장하므로, 현재 이메일 단독 문의처가 운영자 상황에 맞는지 공개 전에 최종 확인. 전화 문의가 필요해지면 개인 번호 대신 별도 업무용 번호 검토

## 국외 이전 / 외부 제공자
실제 운영 계정·계약·제품 설정을 확인해 각 서비스별 수령 법인, 국가, 이전되는 항목, 시기·방법, 이용 목적, 보유·이용 기간, 이전 거부 방법 및 거부 효과를 확인합니다. 추정으로 국가·법인을 기재하지 않습니다.

- [x] Supabase 프로젝트 주 리전: 대한민국 서울(`ap-northeast-2`), 운영 DB 프로젝트 ACTIVE_HEALTHY 확인. Supabase 안내에 따르면 DB/Auth/Storage 원본은 선택 리전에 기본 저장됨.
- [x] 현재 프로젝트 Storage bucket: 0개 확인. Supabase Storage에 이용자 업로드 파일을 저장하는 흐름은 현재 없음.
- [x] Supabase 주요 처리자: Supabase Pte. Ltd. (싱가포르), DPA 주소 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513.
- [x] Supabase 안내상 미국 계열사 Supabase Inc.는 기술지원·운영에 관여할 수 있으며, 글로벌 지원인력의 접근은 지원요청/사고 대응 등 필요한 경우 제한되고 기록됨.
- [x] Supabase 운영 로그·사용량 텔레메트리는 주 DB 리전 밖에서 처리될 수 있고 Supabase는 로그·텔레메트리의 EU 데이터센터 저장을 안내함. DB 리전이 모든 운영정보의 처리 위치를 의미하지 않음.
- [x] Supabase Edge Functions: 운영 함수 `delete-account`(v3)와 `analyze-camp-return-form`(v11)가 ACTIVE, verify_jwt=true. 앱 호출에 region 지정이 없고 프로젝트 설정에 고정 region 확인 불가.
- [ ] Supabase Edge Functions의 실제 호출별 `SB_REGION` / `x-sb-edge-region`을 Dashboard Function Logs에서 확인. 현재 Unified Logs에 function invocation region source가 없고 Edge Gateway의 `ICN`는 Cloudflare/API 진입 POP이므로 함수 실행 지역의 증거가 아님.
- [ ] Supabase 로그의 실제 보유기간, 프로젝트별 글로벌 지원 접근 설정, 계약에 적용되는 전체 하위처리자 목록을 DPA/계정에서 확인. Supabase 공통 하위처리자 명단은 프로젝트별 실제 사용을 의미하지 않음.
- [x] Google Mobile Ads SDK 계약 법인: 사용자가 제공한 AdSense Online Terms 제1조에 Google Asia Pacific Pte. Ltd.라고 명시되어 있고 제16조에 AdMob 서비스별 약관이 연결됨. Google 공식 AdSense 도움말도 APAC 계약 법인이 AdSense·AdMob에 적용될 수 있음을 확인함. 주소: Mapletree Business City II, 70 Pasir Panjang Road, #03-71, Singapore 117371.
- [x] Google Mobile Ads SDK 자동 수집 항목: IP 주소, 앱 실행·탭·광고 영상 시청 등 앱 상호작용, 진단·성능 정보, 기기·계정 식별자. 목적: 광고, 분석/측정, 부정 사용 방지.
- [x] Google 광고 서비스는 글로벌 데이터센터를 운영하고 요청 출처와 가까운 데이터센터를 사용할 수 있다고 공개함. 싱가포르는 계약 법인 소재지이며 유일한 처리 국가는 아님.
- [x] Google 공개 보유 안내: 광고 서버 로그의 IP 일부는 9개월 후, 쿠키 정보는 18개월 후 익명화한다고 안내. 이는 모든 AdMob SDK 데이터의 전체 보유기간이 아니며 보안·사기 방지·법적 필요에 따른 예외가 있음.
- [ ] AdMob 실제 요청의 전체 목적지 국가 및 실제 수령 계열사/수탁자 목록을 Google 계정 약관·광고 서비스 데이터 보호 약관에서 확인. 개별 광고 요청의 실제 데이터센터 국가는 계정 화면에서 확인 불가하므로 현재 공개 페이지는 최종 고지로 사용하지 않음.
- [ ] AdMob UMP 동의 메시지/광고 개인정보 설정이 실제 앱에 구현되어 있는지 확인하고, 광고 개인화 거부·제한 광고의 이용자 선택 및 거부 효과를 정리.
- [ ] Google Mobile Ads SDK 버전 및 Android/iOS 실제 빌드별 Data safety 자동 수집 항목을 재확인. iOS 테스트 ID와 Android 운영 광고 ID의 상태를 구분
- [x] Google Forms 흐름: Edge Function이 `docs.google.com/forms` 공개 HTML을 가져와 양식 제목·문항·ID를 분석하고 결과(사용자 이메일/ID, 캠프, 양식 URL/ID/제목, 질문·매핑·상태)를 Supabase DB에 저장함.
- [x] Google Forms 사전 입력: 사용자가 채번 URL을 열 때 운송장/주문번호, 기사 아이디, 수량, 캠프 및 선택된 양식의 매핑된 값이 `entry.*` 쿼리 매개변수로 전달됨. 사용자가 확인 후 제출해야 양식 작성자가 응답을 받음.
- [ ] 등록된 각 Google Form의 소유자/수령자, 개인·Workspace 계정 유형, 데이터 저장 리전, 응답 보유기간 및 삭제 요청 방법 확인. 사용자가 임의 등록하는 양식이므로 하나의 고정 국가·보유기간으로 통합 고지할 수 없음.
- [x] Geocoder 구현: package-lock은 `cordova-plugin-nativegeocoder 3.5.1`을 고정. Android는 Android `Geocoder.getFromLocation`, iOS는 `CLGeocoder.reverseGeocodeLocation` 호출.
- [x] Geocoder 네트워크 성격: 플러그인 README는 Android Geocoder가 별도 backend service가 필요할 수 있다고 설명하고, iOS 구현은 Apple Core Location 네트워크 역지오코딩을 사용함.
- [ ] Android 기기/제조사별 Geocoder 실제 백엔드 사업자·처리국가 확인. 앱 코드/플러그인만으로는 고정 제공자 또는 국가를 식별할 수 없음.
- [ ] iOS 앱을 실제 배포하는지 확인하고, 배포한다면 Apple geocoding 서비스의 관련 처리지역·보유기간·이전 거부 가능 여부를 Apple 문서/계정 조건에서 확인.
- [ ] KMA Open API: 기상청에는 원시 위·경도가 아니라 앱에서 계산한 격자좌표(nx, ny) 및 예보 기준시각을 보내는 현재 구조를 확인. 날씨 조회 키는 현재 클라이언트 번들에 포함되므로 서버 중계 이전 후 재발급 계획 유지
- [x] Firebase Hosting 처리: 공개 사이트 방문자의 IP 주소와 요청 정보가 악용 방지·이용량 분석에 처리될 수 있으며, Firebase 공식 문서는 IP 관련 로그 보유를 수개월로 설명함.
- [x] Firebase Hosting 리전: 특정 국가 리전 선택형이 아닌 Google 글로벌 인프라 서비스로 문서화됨. 데이터는 Google 또는 대리인이 시설을 운영하는 국가에서 처리될 수 있음.
- [ ] 현재 Firebase 계정의 구체적인 계약 법인·Firebase DPA 적용 관계, 요청 로그의 실제 retention 설정 및 수령자 목록을 Firebase Console/약관에서 확인.

## 보관 기간 및 삭제
- [ ] 일상점검표 서버 기록의 1년 보관기간을 UI·정책·실제 cleanup cron과 일치시킴
- [ ] 최신 재사용 서명 및 기록에 참조된 이전 서명의 보관·삭제 기준을 사용자에게 명확히 안내
- [ ] 회사 공유 근무표/이력 익명화와 개인정보 삭제 이후 남는 회사 데이터 범위를 확인
- [ ] 사용자 CSV/PDF 내보내기 및 외부 Google Forms 제출 데이터는 앱 계정 삭제만으로 외부 저장본까지 지워지지 않는다는 점을 명시
- [ ] 게스트/오프라인 로컬 데이터가 계정 삭제와 앱 삭제에서 어떻게 처리되는지 실제 기기에서 검증

## 앱 스토어 및 실제 공개
- [ ] 개인정보 처리방침 페이지의 최종 URL을 Firebase Hosting에 배포
- [ ] 앱 내 법적고지 화면과 공개 페이지의 내용/시행일을 일치
- [ ] Google Play Console의 개인정보 처리방침 URL과 Data safety 설문을 실제 SDK·데이터 흐름에 맞춰 갱신
- [ ] AdMob Data safety 최신 SDK 안내와 앱의 실제 AdMob 구성 대조
- [ ] 계정 삭제 안내 페이지의 이메일, 앱 메뉴 경로, 삭제 범위가 실제 빌드와 일치하는지 재확인

## 코드와 실제 사용 상태의 구분
- Google Drive backup/restore helper code exists, but current DataSettingsView buttons only show a development notice. The current UI does not perform Google Drive backup/restore; do not disclose it as an active transfer until enabled.
- KMA requests currently originate in the client using `REACT_APP_KMA_API_KEY`; migration to a Supabase Edge Function and key rotation must happen after a staged app rollout.
- No direct Kakao Local API request was found in the current weather hook; it uses the Cordova native geocoder plugin. Do not list Kakao Local as an active location processor unless another current code path is verified.


## 성인 전용(만 18세 이상) 설정
- [ ] Google Play Console에서 타겟 연령을 **18세 이상만** 선택하고, 동일 화면의 **Restrict minor access(미성년자 접근 제한)** 옵션을 활성화
- [ ] Play Console 저장 후 타겟 연령 변경 심사 상태와 스토어 표시를 확인
- [ ] 앱 최초 실행 시 성인 연령 확인 화면이 계정 로그인, 게스트 기능, Supabase 세션 초기화 및 AdMob SDK 초기화보다 먼저 표시되는지 확인
- [ ] 만 18세 미만 생년월일은 앱 진입을 차단하고, 만 18세 이상 생년월일은 진행되는지 확인(생일 당일 포함)
- [ ] 연령 확인에 입력한 날짜가 서버·로그·분석 도구로 전송되지 않고, 성인 확인 완료 여부만 기기에 저장되는지 확인
- [ ] 앱 재실행·로그아웃·게스트 사용에서도 연령 확인이 유지되는지 확인하고, 앱 데이터 초기화·재설치 후에는 다시 확인되는지 검증
- [ ] 계정 프로필의 선택 생년월일 저장 기능과 연령 확인 입력값을 혼동하지 않도록 개인정보 처리방침 및 Data safety 답변을 대조
- [ ] Play Store 소개·스크린샷·광고 문구가 성인 배송기사 전용 앱이라는 타겟과 일치하는지 검토
