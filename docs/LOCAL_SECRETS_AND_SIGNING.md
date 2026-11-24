# 로컬 환경변수 및 Android 서명 설정

이 문서는 저장소에 비밀값을 저장하지 않고 개발·정식 서명 환경을 구성하는 방법을 설명합니다.

## 1. React 환경변수

1. 저장소 루트에서 `.env.example`을 `.env`로 복사합니다.
2. Firebase 프로젝트, Supabase 프로젝트, 기상청 API에서 발급된 본인 프로젝트 값을 입력합니다.
3. `.env`는 커밋하지 않습니다. `.gitignore`가 로컬 환경 파일을 제외합니다.

macOS / Linux:

```sh
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 중요: 클라이언트 환경변수의 한계

Create React App은 `REACT_APP_*` 변수를 빌드 결과물에 삽입합니다. 따라서 `.env`에 넣었다고 해서 앱에 포함된 값이 비밀로 유지되는 것은 아닙니다.

- Firebase 웹 API 키는 클라이언트 설정값입니다. Google Cloud에서 사용 API와 앱/웹 도메인 제한을 설정하세요.
- Supabase anon/publishable 키는 클라이언트용 키입니다. 데이터 접근은 RLS 정책으로 보호해야 합니다. `service_role` 키는 앱이나 `.env`에 절대 넣지 마세요.
- 기상청 서비스 키는 앱 패키지에서 추출될 수 있습니다. 새 키를 발급하고 제공기관에서 사용량·호출 제한을 설정하세요. 비밀 유지가 필수라면 Supabase Edge Function 등 서버 측 중계로 이전해야 합니다.
- OAuth 비밀키, Firebase Admin 키, Supabase service-role 키, 서명 비밀번호 등 서버·운영 비밀정보는 `REACT_APP_*` 변수로 관리하지 마세요.

## 2. Android 정식 서명 정보

Android Release 서명 비밀번호와 키 별칭은 저장소의 `android/gradle.properties`에 기록하지 않습니다.

macOS에서는 사용자 전용 Gradle 설정 파일을 사용합니다.

```text
~/.gradle/gradle.properties
```

파일에 다음 항목을 추가하고 실제 값으로 교체합니다.

```properties
MYAPP_RELEASE_STORE_FILE=/absolute/path/to/your-upload-key.keystore
MYAPP_RELEASE_KEY_ALIAS=YOUR_KEY_ALIAS
MYAPP_RELEASE_STORE_PASSWORD=YOUR_STORE_PASSWORD
MYAPP_RELEASE_KEY_PASSWORD=YOUR_KEY_PASSWORD
```

- `MYAPP_RELEASE_STORE_FILE`에는 실제 키 저장소의 절대 경로를 지정하는 것을 권장합니다.
- 이 파일과 keystore를 Git 저장소에 커밋하지 마세요.
- 사용자 전용 Gradle 설정은 로컬 Release 빌드에서 읽힙니다. Debug 실행에는 정식 서명 자격 증명이 필요하지 않습니다.
- 비밀번호를 채팅, 이슈, 로그, 명령행 인수에 붙여넣지 마세요.

## 3. 이미 저장소 이력에 올라간 자격 증명

파일을 삭제해도 기존 Git 커밋에서 값이 사라지는 것은 아닙니다. 과거 커밋에 기록된 것으로 확인된 기상청 서비스 키와 Android 서명 비밀번호는 노출된 것으로 간주하고 교체 또는 재설정해야 합니다.

Android 서명은 앱 업데이트 호환성과 연결됩니다. Google Play App Signing 사용 여부와 현재 업로드 키 상태를 확인하기 전에 새 keystore를 임의로 만들지 마세요. 업로드 키가 노출된 경우에는 Play Console의 업로드 키 재설정 절차를 사용하고, 기존 키를 계속 유지할지 결정한 뒤 진행합니다.

Git 이력에서 비밀정보를 제거하는 작업은 열린 PR과 모든 clone에 영향을 줄 수 있으므로, 키 교체를 먼저 완료하고 별도 계획을 세워 진행합니다.
