# 개인정보 처리방침 공개 전 확인 목록

현재 공개 처리방침 초안은 저장소의 실제 데이터 흐름과 Supabase 운영 설정을 기준으로 작성했습니다. 아래 항목을 확인하기 전에는 Play Console에 최종 URL을 등록하거나 이 페이지를 운영 사이트에 배포하지 않습니다.

## 1차 출시 범위
- [x] 1차 출시 국가는 대한민국으로 제한하기로 결정
- [ ] Google Play 프로덕션 국가/지역에서 대한민국만 남기고 나머지 국가를 최종 제외. 이 변경은 실제 출시 직전에 적용
- [x] 대만 및 기타 해외 국가의 현지화·별도 개인정보 고지는 1차 출시 범위에서 보류
- [x] AdMob UMP 동의 코드는 유지. 배포 국가가 한국으로 제한되어도 Google/Supabase 등 외부 서비스의 글로벌 처리 또는 국외 이전 검토는 별도로 유지



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
- [x] Supabase Edge Functions: `delete-account`와 `analyze-camp-return-form` 모두 ACTIVE, `verify_jwt=true`. 앱 호출에 `FunctionRegion.ApNortheast2`를 지정해 서울(`ap-northeast-2`) 리전을 요청하도록 변경함. 함수 CORS 허용 헤더에 `x-region`을 추가함.
- [x] 2026-11-25 운영 로그에서 `analyze-camp-return-form` 실제 응답의 `x-sb-edge-region=ap-northeast-2` 및 함수 실행 `region=ap-northeast-2` 확인.
- [ ] `delete-account`는 실제 계정 삭제를 실행하지 않아 개별 런타임 리전은 미검증. 실제 이용자 계정을 삭제하는 테스트는 하지 않고, 별도 테스트 계정으로 검증할 때 확인.
- [x] 변경 후 운영 함수 배포 확인: `delete-account` v4 ACTIVE, `analyze-camp-return-form` v14 ACTIVE, 두 함수 모두 `verify_jwt=true` 유지.
- [x] 서울 리전을 고정하면 해당 리전 장애 시 자동으로 다른 리전으로 우회하지 않을 수 있다는 점을 장애 대응 절차에 반영.
- [ ] Supabase 로그의 실제 보유기간, 프로젝트별 글로벌 지원 접근 설정, 계약에 적용되는 전체 하위처리자 목록을 DPA/계정에서 확인. Supabase 공통 하위처리자 명단은 프로젝트별 실제 사용을 의미하지 않음.
- [x] Google Mobile Ads SDK 계약 법인: 사용자가 제공한 AdSense Online Terms 제1조에 Google Asia Pacific Pte. Ltd.라고 명시되어 있고 제16조에 AdMob 서비스별 약관이 연결됨. Google 공식 AdSense 도움말도 APAC 계약 법인이 AdSense·AdMob에 적용될 수 있음을 확인함. 주소: Mapletree Business City II, 70 Pasir Panjang Road, #03-71, Singapore 117371.
- [x] Google Mobile Ads SDK 자동 수집 항목: IP 주소, 앱 실행·탭·광고 영상 시청 등 앱 상호작용, 진단·성능 정보, 기기·계정 식별자. 목적: 광고, 분석/측정, 부정 사용 방지.
- [x] Google 광고 서비스는 글로벌 데이터센터를 운영하고 요청 출처와 가까운 데이터센터를 사용할 수 있다고 공개함. 싱가포르는 계약 법인 소재지이며 유일한 처리 국가는 아님.
- [x] Google 공개 보유 안내: 광고 서버 로그의 IP 일부는 9개월 후, 쿠키 정보는 18개월 후 익명화한다고 안내. 이는 모든 AdMob SDK 데이터의 전체 보유기간이 아니며 보안·사기 방지·법적 필요에 따른 예외가 있음.
- [ ] AdMob 실제 요청의 전체 목적지 국가 및 실제 수령 계열사/수탁자 목록을 Google 계정 약관·광고 서비스 데이터 보호 약관에서 확인. 개별 광고 요청의 실제 데이터센터 국가는 계정 화면에서 확인 불가하므로 현재 공개 페이지는 최종 고지로 사용하지 않음.
- [x] UMP 코드 연동: 설치 버전 `@capacitor-community/admob 7.2.0`의 `requestConsentInfo`, `showConsentForm`, `showPrivacyOptionsForm` API를 확인함. 앱 시작 시 동의 정보를 갱신하고, 동의가 필요하고 양식이 준비된 경우 동의 양식을 표시한 뒤 `canRequestAds`가 true일 때만 AdMob 초기화와 광고 요청을 허용함.
- [x] UMP 개인정보 옵션 진입: Google이 개인정보 옵션 메뉴를 요구하면 앱 내 개인정보 처리방침 화면에 `광고 개인정보 설정` 버튼을 표시하고 UMP 양식을 호출하도록 연결함.
- [x] `AdBanner.js`와 보상형 광고 모두 동일한 동의 확인 함수를 거쳐 광고 요청을 시작하도록 변경함. 배너 광고의 Android 운영 광고 단위는 `isTesting:false` 설정을 유지함.
- [ ] AdMob Console의 Privacy & messaging에서 실제 서비스 지역에 해당하는 개인정보 메시지를 구성·게시하고, 앱 ID 및 메시지 게시 상태를 확인.
- [ ] Android 테스트 기기를 UMP 테스트 기기로 등록하고 EEA/미국 규제 지역 테스트를 진행. 동의 양식 노출, 동의/거부, `canRequestAds`에 따른 광고 요청 차단·허용 및 개인정보 옵션 변경을 검증.
- [ ] 동의 API 실패 시 배너·보상형 광고 요청이 차단되는지 Android 실제 빌드에서 확인.
- [x] 보상형 광고 Android는 운영 광고 단위 ID를 사용하지만 현재 `isTesting: true`이므로 내부 기기 테스트용 상태로 유지. Play 프로덕션 빌드 전 `isTesting: false`로 전환하고 테스트 광고가 아닌 실제 광고 요청임을 재검증해야 함.
- [ ] Google Mobile Ads SDK 버전 및 Android/iOS 실제 빌드별 Data safety 자동 수집 항목을 재확인. iOS 테스트 ID와 Android 운영 광고 ID의 상태를 구분
- [x] Google Forms 흐름(변경 후): Edge Function은 공개 HTML을 분석하고 새 분석 접수 보고서를 생성하지 않음. 사용자가 양식을 저장할 때 링크·form_id·캠프명·제목·문항 구조·자동 입력 매핑만 공용 양식 메타데이터로 Supabase에 저장함. 로그인 사용자 간 동일 form_id는 한 건으로 통합함.
- [x] 구버전 `camp_return_form_reports` 36건은 2026-11-25 운영 DB에서 삭제 완료. 삭제 후 잔여 0건을 재조회로 확인함.
- [x] 개인 채번 이력: 운송장/주문번호·기사 아이디·수량·캠프·요청 시각과 통계는 기기 로컬에 저장하며, 새 버전부터 Supabase에 신규 저장하지 않음.
- [x] 구버전 개인 채번 서버 사본 `camp_return_records` 4건과 `camp_return_profiles` 2건은 2026-11-25 테스트 데이터로 확인되어 모두 삭제함. 삭제 후 두 테이블 모두 잔여 0건을 재조회로 확인함.
- [x] 2026-11-25 운영 DB 점검: 개인 채번 이력 4건, 기본 설정 2건, Google Forms 3건(고유 form_id 2종), 과거 분석 접수 36건을 확인함. 테스트용 개인 채번 이력 4건·기본 설정 2건·분석 접수 36건을 삭제했고, 재조회 결과 각 관련 테이블 잔여 0건임을 확인함. 공용 Google Forms 메타데이터 2건은 유지함.
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
- [x] `src/firebaseConfig.js`에 Firebase Auth/Firestore 초기화 코드는 있으나 현재 저장소의 앱 코드에서 해당 모듈을 import하는 사용 경로는 검색되지 않음. 공개 사이트 Hosting과 앱의 Supabase Auth/OAuth는 별개로 구분함.
- [ ] Google/Apple OAuth 인증 과정에서 인증 제공자에게 전달되는 식별정보·처리 법인·국가·보유기간과 Supabase Auth 연계 구조를 별도로 확인.

## 보관 기간 및 삭제
- [x] 일상점검표 서버 기록 보관기간은 기존 결정대로 1년. 운영 DB의 `cleanup_expired_daily_inspection_records()`가 1년 초과 기록을 삭제하고, `daily-inspection-retention` cron이 매일 실행 중인 것을 확인.
- [x] 최신 서명 버전은 재사용을 위해 유지하고, 이전 서명은 보존 중인 점검 기록이 참조하는 동안 유지하는 기준을 정책에 반영.
- [ ] 회사 공유 근무표/이력 익명화와 개인정보 삭제 이후 남는 회사 데이터 범위를 확인
- [ ] 사용자 CSV/PDF 내보내기 및 외부 Google Forms 제출 데이터는 앱 계정 삭제만으로 외부 저장본까지 지워지지 않는다는 점을 명시
- [ ] 게스트/오프라인 로컬 데이터가 계정 삭제와 앱 삭제에서 어떻게 처리되는지 실제 기기에서 검증
- [x] 계정 삭제 DB trigger가 `auth.users` 삭제 전 회사 소유권·소속을 재검사하고, 개인 계정 데이터는 삭제하며 회사 공유 이력의 작성자 식별자는 NULL로 익명화하는 것을 운영 DB 함수 정의로 확인. 일상점검표 기록·서명과 개인 채번 기록은 `auth.users` 참조 FK의 ON DELETE CASCADE로 삭제되며, 공유 Google Forms 메타데이터는 작성자 ID를 NULL로 바꾸어 공유 목록에 남을 수 있음.
- [x] 앱 계정 삭제 화면에서 해당 로그인 계정의 `campReturnNumbering:v1:{userId}:` 로컬 설정·이력도 삭제하도록 작업 브랜치에 수정함. 게스트/다른 계정 키는 범위에서 제외함. 실제 기기 삭제 검증은 빌드 후 수행.

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

## Supabase 보안 점검 (2026-11-25)
- [x] public 스키마 테이블 24개 모두 RLS 활성화 상태 확인.
- [x] RLS 정책이 없는 내부 테이블 9개(camp_return_form_admins, 회사 삭제/근무표/백업 관련 테이블)는 anon·authenticated 권한이 없고 postgres·service_role만 테이블 권한을 보유함을 확인. 현재 앱 클라이언트의 직접 Data API 접근은 차단되고 RPC/트리거 경로로만 사용.
- [x] authenticated 실행 권한이 있는 SECURITY DEFINER 함수 37개를 조회: 모두 함수 본문에서 auth.uid()를 참조하며 anon 실행 권한은 확인되지 않음. 이는 정적 확인이며, 다른 회사 ID·직원 ID를 이용한 부정 접근 시나리오의 실계정 테스트는 별도 필요.
- [ ] Supabase Auth의 Leaked Password Protection은 현재 Free 요금제에서 사용할 수 없음(공식 문서상 Pro 이상 기능). 요금제 변경 여부를 결정한 뒤 활성화 검토.
- [ ] Performance Advisor의 미인덱스 외래키 22건 및 RLS 정책 초기화 재평가 경고 7건은 트래픽이 늘기 전 실제 주요 쿼리와 함께 우선순위를 정해 최적화. 경고만으로 인덱스나 정책을 일괄 변경하지 않음.
