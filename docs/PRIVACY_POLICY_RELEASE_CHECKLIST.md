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

- [ ] Supabase: 프로젝트 DB 리전은 Seoul (`ap-northeast-2`)로 확인됨. Auth, Edge Functions, 지원/로그의 처리 위치 및 공급자 계약의 수탁자 세부정보 확인
- [ ] Google Mobile Ads SDK: 실제 Google 계약 당사자, 광고 요청 데이터 항목, 처리 국가/리전, 보유 기간, 광고 동의/비개인화 설정 확인
- [ ] Google Forms: 양식에 사전 입력되는 운송장/주문번호, 기사 아이디, 수량, 캠프 데이터와 폼 소유자 책임을 명확히 안내. 사용자가 등록한 양식의 작성자별 개인정보 처리방침 및 응답 보유기간을 안내
- [ ] Android/iOS Geocoder: OS별 역지오코딩 서비스 제공자, 위치정보가 외부로 전송되는지, 전송 국가 확인
- [ ] KMA Open API: 기상청에는 원시 위·경도가 아니라 앱에서 계산한 격자좌표(nx, ny) 및 예보 기준시각을 보내는 현재 구조를 확인. 날씨 조회 키는 현재 클라이언트 번들에 포함되므로 서버 중계 이전 후 재발급 계획 유지
- [ ] Firebase Hosting: 공개 정적 페이지 호스팅과 배포 로그의 처리 위치/보유기간 확인

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
