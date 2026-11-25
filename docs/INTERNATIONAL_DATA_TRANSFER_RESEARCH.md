# 택배메이트 국외 이전 및 외부 처리 조사 기록

- 조사 기준일: 2026-11-25
- 대상: `release/prelaunch-hardening` 브랜치 및 운영 Supabase 프로젝트 `delivery-app` (`rrjoilqlsyilqqtzybps`)
- 목적: 개인정보 처리방침과 Google Play Data safety 신고의 근거 정리
- 상태: 조사 기록. **개인정보 처리방침 최종 공개 승인 문서가 아님.**

## 1. 결론 요약

1. 주 데이터베이스 리전이 서울이라는 사실은 확인됐지만, Supabase 운영 로그·지원 접근·Edge Function의 실행 위치까지 전부 서울이라고 볼 수 없습니다.
2. Supabase Edge Functions 2개가 운영 중이며 앱 호출에는 리전 고정 옵션이 없습니다. 현재 로그에서 개별 함수의 실행 리전은 확인되지 않았습니다.
3. Google AdMob 계약 약관(사용자가 제공한 AdSense Online Terms)은 Google Asia Pacific Pte. Ltd.를 계약 당사자로 표시합니다. 이는 싱가포르 계약 법인을 확인한 것이며, 광고 데이터가 싱가포르 한 곳에만 저장된다는 뜻은 아닙니다.
4. Google Forms는 사용자가 양식을 선택·등록하는 구조입니다. 양식 분석 시 Supabase 함수가 Google 양식 페이지를 가져오고, 채번 요청 시 앱이 개인정보가 포함된 사전 입력 URL을 엽니다. 양식 제출 시 응답은 양식 작성자에게 전달됩니다.
5. 위치 지역명 변환은 Android와 iOS의 네이티브 Geocoder를 호출합니다. Android 백엔드 공급자는 기기·제조사에 따라 달라질 수 있고, iOS 구현은 Apple의 네트워크 기반 Core Location Geocoder를 사용합니다.
6. Firebase Hosting은 공개 홈페이지와 법률 안내를 제공하며 방문자 IP·요청 정보를 글로벌 Google 인프라에서 처리할 수 있습니다.
7. 기상청에는 현재 코드에서 원시 위도·경도를 보내지 않고 앱에서 계산한 격자 좌표(nx, ny)와 예보 기준시각을 보냅니다.

## 2. Supabase

### 운영 프로젝트에서 확인된 사실
- Project: `delivery-app`, ref `rrjoilqlsyilqqtzybps`
- 상태: `ACTIVE_HEALTHY`
- 리전: `ap-northeast-2` (서울)
- 운영 함수:
  - `delete-account`: ACTIVE, version 3, JWT verification enabled
  - `analyze-camp-return-form`: ACTIVE, version 11, JWT verification enabled
- Storage buckets: 조회 결과 0개. 현재 프로젝트에 이용자 업로드 파일을 두는 Supabase Storage bucket은 없음.
- 앱의 두 함수 호출 코드에 region override 옵션이 없음. 추적된 브랜치에서 `supabase/config.toml`도 찾지 못함.

### 계약·하위처리자·처리 지역
- Supabase Data Processing Addendum의 주요 처리자: **Supabase Pte. Ltd.**
- DPA에 기재된 주소: 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513.
- Supabase 공식 Data Residency FAQ는 Supabase Inc.(미국)가 기술지원·운영 서비스에 관여할 수 있고, 글로벌 지원인력이 지원요청 또는 사고 대응 등 필요한 경우 제한적으로 접근할 수 있으며 접근은 기록된다고 설명함.
- 프로젝트 주 리전은 주 데이터베이스/Auth/Storage 원본의 기본 저장 위치를 지정하지만 계정/구성·결제 정보, 지원 처리, 사용량·운영 로그/텔레메트리까지 모두 주 리전에서만 처리된다는 뜻은 아님.
- Supabase는 사용량·운영 로그 및 텔레메트리 일부를 주 리전 밖에서 처리하고 EU 데이터센터에서 로그·텔레메트리를 저장할 수 있다고 설명함.
- Supabase 공통 하위처리자 목록은 여러 벤더와 처리지역을 포함하는 플랫폼 전체 목록이다. 해당 목록에 이름이 있다는 이유만으로 이 프로젝트가 모든 벤더에 데이터를 제공한다고 기재하지 않음. 프로젝트별 실제 사용 벤더는 계정 계약·지원·제품 구성과 대조해야 함.

### Edge Function의 별도 지역
- Supabase 공식 문서의 기본 동작은 요청자와 가까운 Edge 리전에서 함수 실행. 특정 리전을 고정할 수 있으며 함수 내부 `SB_REGION` 또는 응답 헤더 `x-sb-edge-region`으로 실행 지역을 확인할 수 있음.
- 현재 앱은 `supabase.functions.invoke('analyze-camp-return-form', ...)` 및 `supabase.functions.invoke('delete-account', ...)`를 호출하나 region override를 전달하지 않음.
- 현재 Unified Logs 조회에는 `function_edge_logs` source/함수별 실행 리전 기록이 없었음. 일반 `edge_logs`에서 관찰된 `request.cf.colo=ICN`은 Cloudflare/API Gateway 진입 POP이며, Supabase Function Runtime의 실행 지역 증거가 아님.
- 따라서 함수 요청의 실제 국가를 현재로서는 특정하지 않음. 실제 배포된 함수 로그의 Details/Region 또는 `SB_REGION`을 안전하게 확인해야 함.

### 함수별 데이터 흐름
**analyze-camp-return-form**
- 로그인 JWT를 검증하고 Supabase Auth에서 사용자 식별.
- 사용자가 등록한 `https://docs.google.com/forms/...` 링크를 정규화한 후 Supabase 함수 런타임에서 Google Forms 공개 페이지 HTML을 GET 요청.
- 페이지 제목·문항·질문 ID·선택지·입력 매핑을 파싱.
- 분석 리포트를 Supabase DB에 기록: user_id, user_email, camp_name, form_url, form_id, form_title, status, questions, suggested_mapping, error_message.
- Google Forms GET 요청에 사용자 이메일이나 운송장 값이 포함되는 것은 코드에서 확인되지 않음. 요청 대상은 사용자가 제공한 양식 URL.
- 함수 실행 리전은 고정되지 않아 양식 URL 및 양식 HTML 처리 위치는 서울로 단정하지 않음.

**delete-account**
- 사용자 JWT와 확인 문구를 검증하고 회사 소유권/소속 여부를 확인.
- Supabase Auth Admin API를 통해 계정 삭제 요청, DB 트리거가 개인 데이터 삭제와 회사 공유 이력 익명화 처리.
- 함수 코드상 제3자 Google 서비스로 계정 데이터 전송은 없음. 다만 Edge Function 실행 및 Supabase 내부 처리의 리전은 기본 Edge 실행 위치/서울 DB의 구조를 따름.

### Supabase 운영 로그
운영 Edge/API 로그 샘플에서 요청 IP, 대략적 국가·도시·지역, User-Agent(브라우저·OS), 요청 경로와 시각, Supabase 계정 식별자 등의 로그 속성을 확인함. 이 로그의 정확한 보유기간은 현재 프로젝트 MCP/대시보드에서 확정하지 못했으므로 공개 문구를 구체적 일수로 단정하지 않음.

## 3. Google AdMob

### 계약 당사자
사용자가 제공한 **Google AdSense Online Terms of Service** 제1조는 “We / us / Google”을 **Google Asia Pacific Pte. Ltd.**라고 정의하고, 제16조는 AdMob Publisher Guidelines and Policies를 서비스 특정 약관으로 연결함. Google의 APAC 광고 게시자 도움말도 해당 지역 계약 법인 안내와 부합함.

- 계약 법인 소재지: 싱가포르
- 사용자가 제공한 약관/공개 주소: Mapletree Business City II, 70 Pasir Panjang Road, #03-71, Singapore 117371.
- 주의: 이 정보는 계약 법인 확인이다. 광고 요청별 수신 법인·데이터센터 위치를 싱가포르로 한정하는 근거는 아님. AdMob 계정의 실제 현재 약관 버전과 별도 서비스 약관을 최종 확인해야 함.

### 앱에서 관찰한 SDK 동작
- Android 앱은 시작 시 AdMob SDK 초기화, 실제 배너 광고 단위 ID 및 `isTesting: false` 구성으로 배너 요청.
- 광고가 화면에 보이지 않는다고 SDK 초기화/요청에 따른 정보 처리가 없다고 단정할 수 없음.
- 앱 코드상 reward 광고 요청은 `isTesting: true`; iOS 설정에는 Google 테스트 앱 ID/테스트 광고 ID가 확인됨. 실제 iOS 출시 여부는 별도 확인.
- Google Mobile Ads SDK의 자동 수집/공유 가능 항목: IP 주소, 앱 상호작용(앱 실행, 탭, 동영상 조회), 진단·성능 정보, 기기·계정 식별자.
- 목적: 광고 표시·성과 측정·분석·부정 사용 방지.
- Google 광고 서비스는 글로벌 데이터센터를 사용하고 요청 출처와 가까운 시설에서 트래픽을 처리할 수 있음. 실제 요청의 모든 국가/관련 법인 전체 목록은 이 프로젝트 코드나 AdMob 화면만으로 확인되지 않음.
- Google의 공개 보유 안내는 광고 서버 로그의 IP 일부 9개월 후 익명화, 쿠키 18개월 후 익명화를 설명함. 이 기간을 모든 SDK 데이터 범주의 전체 보유기간으로 쓰면 안 됨.

## 4. Google Forms

### 실제 데이터 흐름
- 앱에 기본 Google Forms URL이 있고, 로그인 사용자는 개인/회사 지역 양식을 등록할 수 있음.
- Supabase Edge Function은 등록한 `docs.google.com/forms` 페이지 HTML을 읽어 제목·질문·entry ID·선택지를 분석함. 분석 결과 및 사용자가 등록한 양식 메타데이터/매핑을 Supabase DB에 저장.
- 채번 요청을 열 때 앱은 Google Forms 사전 입력 URL을 만듦. 포함될 수 있는 값:
  - 채번 요청 유형
  - 운송장번호 또는 주문번호
  - 기사 아이디
  - 채번 수량
  - 캠프 및 선택 양식에서 연결한 추가 필드
- 앱은 채번 요청 기록을 먼저 Supabase에 저장하고 브라우저/인앱 브라우저에서 URL을 엶. 사용자가 설문 내용을 확인한 후 직접 제출.
- 제출 시 해당 Google Form 작성자가 응답을 받음.
- 양식 작성자와 Google 계정(개인/Workspace), 조직의 저장 지역 설정, 문항/응답 보유 정책이 양식마다 다를 수 있음. 양식의 실제 소유자, 국가, 응답 보유기간은 앱 차원에서 고정·통제되지 않음.

## 5. Android/iOS Native Geocoder

### Android
- 앱 의존성 및 lockfile: `cordova-plugin-nativegeocoder 3.5.1`.
- 플러그인 Android 구현은 `android.location.Geocoder.getFromLocation(latitude, longitude, maxResults)`를 호출.
- 플러그인 README는 Android Geocoder가 별도 backend service에 의존할 수 있다고 명시함. Android OS/제조사/Google Play Services 구성에 따라 백엔드 사업자가 달라질 수 있음.
- 앱 소스에서 실제 백엔드 제공자나 서버 국가를 식별할 수 없음. Google이라고 고정 기재하지 않음.

### iOS
- 플러그인 iOS 구현은 Apple Core Location의 `CLGeocoder.reverseGeocodeLocation`을 호출.
- 이 기능은 네트워크 기반이며 좌표를 Apple 지오코딩 서비스에 보낼 수 있음.
- Apple의 해당 기능의 실제 처리 국가·보유기간은 확인한 공개 개발자 문서만으로 특정 불가. iOS 앱의 실제 스토어 배포 여부도 별도 확인.

## 6. Firebase Hosting
- 공개 홈페이지, 개인정보 처리방침, 계정 삭제 안내 페이지의 정적 호스팅에 사용.
- Firebase 안내상 Hosting 방문자의 IP 주소 및 요청 정보는 악용 방지·이용량 분석에 처리될 수 있고 IP 관련 로그는 수개월 보유될 수 있음.
- Hosting은 고정 국가 리전 선택형이 아닌 Google 글로벌 인프라를 사용하므로 Google 또는 대리인의 시설이 있는 국가에서 처리될 수 있음.
- Firebase 서비스 약관에는 Firebase Data Processing and Security Terms가 적용될 수 있음. 이 Firebase 계정의 정확한 계약 법인/계정별 조건은 Firebase Console의 약관에서 추가 확인 필요.

## 7. 기상청 공공데이터포털
- 앱에서 위치 권한으로 기기 좌표(lat/lon)를 얻음.
- 원시 위도·경도는 앱 내부에서 기상청 격자 좌표(nx, ny)로 계산함.
- 현재 KMA API 요청 URL에 포함되는 위치 항목은 nx, ny 및 예보 기준일시이며, 원시 위도·경도는 요청 파라미터에서 확인되지 않음.
- KMA는 대한민국 공공데이터 API. API 요청에는 네트워크 IP와 서비스 요청 정보가 노출될 수 있음.
- 현재 API key는 React `REACT_APP_KMA_API_KEY` 사용 구조라 클라이언트 번들에 포함될 수 있음. 이는 국외이전 정보와 별개인 보안 작업으로, Edge Function 서버 중계 및 키 교체는 staged rollout 이후 수행.

## 8. Supabase Storage / Google Drive
- 현재 Supabase Storage bucket 0개로 확인. 현 앱 흐름에서 Supabase Storage 사용자 파일 보관/글로벌 Storage CDN 전송은 사용하지 않음.
- 데이터 관리 화면의 Google Drive backup/restore 버튼은 개발 중 안내만 보여 실제 Google Drive 전송을 수행하지 않음. helper code가 존재한다는 이유로 활성 전송으로 고지하지 않음.

## 9. 공개 전 남은 확인사항
- Supabase Function Dashboard에서 두 함수의 실제 호출별 execution region 확인. 가능하면 추후 서버 로그에 `SB_REGION`만 남기도록 개선하되 개인 정보나 인증값을 로그로 남기지 않음.
- Supabase 로그/텔레메트리 보유기간, 프로젝트/계정 계약에서 지정한 실제 subprocessor 목록 및 국가 확인.
- AdMob 현재 계약 약관/정확한 수령 법인, 광고 목적지 국가, UMP/개인정보 거부 기능의 실제 구현과 거부 효과 확인.
- 사용자가 등록한 모든 Google Form의 소유자/응답 수신자/저장 국가/보유기간/삭제 요청 경로 확인 또는 등록 양식 UI에 운영자 확인 책임을 명확히 안내.
- Android Geocoder actual backend/vendor and country on representative Samsung device(s); iOS release 여부와 Apple processing/retention details 확인.
- Firebase 계정의 계약 주체와 Firebase Hosting logs retention 설정 확인.
- 개인정보 국외 이전 고지에 필요한 이전 국가·수령자·항목·시기/방법·목적·보유기간·거부 방법 및 거부 효과가 확인된 후에만 페이지를 최종 공개하고 Play Console에 등록.

## 10. Sources checked
- Supabase Data Residency & Transfers FAQ: https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq
- Supabase DPA: https://supabase.com/legal/dpa
- Supabase Edge Function regional invocation: https://supabase.com/docs/guides/functions/regional-invocation
- Supabase subprocessors: https://supabase.com/legal/subprocessors
- Firebase privacy & security: https://firebase.google.com/support/privacy
- Firebase Hosting terms: https://firebase.google.com/terms
- Google AdMob / AdSense terms and Google privacy/retention pages: https://support.google.com/adsense/answer/48182 and https://policies.google.com/technologies/retention
- Android Geocoder: https://developer.android.com/reference/android/location/Geocoder
- Apple CLGeocoder: https://developer.apple.com/documentation/corelocation/clgeocoder
- Native Geocoder plugin 3.5.1 source: https://github.com/sebastianbaar/cordova-plugin-nativegeocoder/tree/master
