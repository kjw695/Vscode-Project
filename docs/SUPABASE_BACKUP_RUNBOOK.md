# Supabase 운영 DB 백업 및 복구 절차

최종 확인: 2026-11-25  
대상 프로젝트: `delivery-app` (`rrjoilqlsyilqqtzybps`, 서울 리전 `ap-northeast-2`)  
현재 요금제: Supabase Free  
기준 CLI: Supabase CLI v3

## 1. 백업 정책

로그인 사용자의 클라우드 동기화 데이터는 Supabase에 저장됩니다. 앱의 Google Drive 백업·복원 기능은 출시 범위에서 제외했습니다. 앱의 CSV 내보내기는 배송 장부 내역용이며 서버 DB 전체 백업을 대체하지 않습니다.

현재 Free 요금제에는 Supabase가 제공하는 자동 일일 DB 백업이 포함되지 않습니다. Supabase는 Free 프로젝트에 Supabase CLI `db dump`를 이용한 수동 내보내기와 별도 위치 보관을 권장합니다.

**운영 권장 주기**
- 주 1회 수동 백업
- 운영 DB 마이그레이션, RLS·트리거 변경, 계정 삭제 로직 변경 등 영향이 큰 작업 직전
- 백업 파일은 Git 저장소 밖의 암호화된 저장 위치에 보관
- 최근 4주분을 기본 보관하되, 업무상 필요한 보관기간과 개인정보 최소 보관 원칙을 함께 검토
- 분기별로 별도 테스트 프로젝트에서 복구 절차를 점검

## 2. 백업 범위와 한계

Supabase CLI의 기본 `db dump`는 Supabase 관리 스키마인 `auth`, `storage` 및 확장 프로그램 관리 스키마를 제외합니다. 기본 스키마 덤프에는 테이블·정책·함수 등 DB 구조가 포함되지만 테이블 데이터와 사용자 정의 역할은 별도 옵션으로 내보내야 합니다.

| 항목 | CLI 내보내기 범위 |
|---|---|
| 애플리케이션 스키마·테이블·정책·함수·트리거 등 | `schema.sql` |
| 애플리케이션 테이블 데이터 | `data.sql` |
| 사용자 정의 DB 역할 | `roles.sql` |
| Supabase Auth 사용자·OAuth identity | 기본 덤프에서 제외 |
| Supabase Storage 파일 객체 | DB 덤프에 포함되지 않음 |
| Edge Function 소스·비밀 환경변수·OAuth 공급자 설정·프로젝트 설정 | 별도 보관·재설정 필요 |

2026-11-25 점검 당시 이 프로젝트의 Supabase Storage bucket은 0개였습니다. 추후 Storage 업로드 기능을 도입하면 DB 덤프와 별도로 파일 객체 백업도 마련해야 합니다.

**중요:** 이 세 SQL 파일만으로는 로그인 계정(Auth 사용자와 OAuth identity)까지 복구되지 않습니다. 따라서 애플리케이션 DB 구조·데이터의 논리 백업이지, 전체 Supabase 프로젝트를 완전 복구하는 백업은 아닙니다. Auth 사용자 ID를 참조하는 행이 남아 있어도 해당 로그인 사용자가 새 프로젝트에 자동 생성되는 것은 아닙니다. 전체 서비스 장애 복구가 필수 요건이 되면 Auth·Storage·Edge Functions·프로젝트 설정을 포함한 별도 복구 설계와 유료 백업 옵션을 검토해야 합니다.

## 3. Mac mini에서 운영 DB 수동 백업

### 사전 확인

1. Mac에 Supabase CLI v3와 Docker Desktop이 설치되어 있어야 합니다.
2. 터미널에서 CLI 버전을 확인합니다.

```bash
supabase --version
supabase db dump --help
```

3. Supabase CLI에 로그인되어 있지 않으면 `supabase login`으로 인증합니다.
4. 아래 명령은 프로젝트 참조값을 직접 지정합니다. 현재 CLI v3는 DB 명령을 기본적으로 로컬 DB에 실행하므로, **`--remote=rrjoilqlsyilqqtzybps`가 빠지면 운영 DB 백업이 아닙니다.** `--remote` 뒤의 프로젝트 참조값은 등호(`=`)를 붙여 전달합니다.
5. 데이터베이스 비밀번호는 Supabase Dashboard의 Database Settings에서 확인합니다. 비밀번호·연결 문자열을 Git, 채팅, 스크린샷 또는 로그에 기록하지 않습니다.

### 백업 실행

프로젝트 폴더 안이 아닌 사용자 홈 디렉터리의 `~/Backups`에 저장합니다.

```bash
PROJECT_REF="rrjoilqlsyilqqtzybps"
BACKUP_DIR="$HOME/Backups/supabase/delivery-app/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
```

DB 비밀번호를 화면에 표시하지 않고 입력합니다. Mac 기본 셸인 zsh 기준입니다.

```bash
read -s "DB_PASSWORD?Supabase DB password: "
echo
```

아래 세 명령을 순서대로 실행합니다. 각 명령이 실패하면 다음 명령으로 넘어가지 말고 오류부터 확인합니다. 출력에 표시되는 Target 프로젝트가 `rrjoilqlsyilqqtzybps`인지 확인합니다.

```bash
supabase db dump --remote="$PROJECT_REF" --password "$DB_PASSWORD" --file "$BACKUP_DIR/roles.sql" --role-only

supabase db dump --remote="$PROJECT_REF" --password "$DB_PASSWORD" --file "$BACKUP_DIR/schema.sql"

supabase db dump --remote="$PROJECT_REF" --password "$DB_PASSWORD" --file "$BACKUP_DIR/data.sql" --use-copy --data-only --exclude "storage.buckets_vectors" --exclude "storage.vector_indexes"
```

명령 실행이 끝나면 비밀번호 변수를 지웁니다.

```bash
unset DB_PASSWORD
```

### 결과 확인

세 파일이 모두 생성되고 크기가 0보다 큰지 확인합니다. 체크섬도 함께 저장합니다.

```bash
for file in roles.sql schema.sql data.sql; do
  test -s "$BACKUP_DIR/$file" || { echo "백업 파일 누락 또는 비어 있음: $file"; exit 1; }
done

chmod 600 "$BACKUP_DIR"/*.sql
shasum -a 256 "$BACKUP_DIR"/*.sql > "$BACKUP_DIR/SHA256SUMS.txt"
ls -lh "$BACKUP_DIR"
cat "$BACKUP_DIR/SHA256SUMS.txt"
```

세 덤프 명령 중 하나라도 실패하거나 파일이 없거나 비어 있으면 해당 세트를 정상 백업으로 취급하지 않습니다. 오류를 해결한 뒤 새로운 백업 폴더에서 세 파일을 다시 생성합니다.

## 4. 보관 및 보안

- SQL 덤프에는 배송·근무·프로필 등 개인정보가 포함될 수 있습니다. FileVault가 활성화된 Mac 또는 암호화된 외장 저장장치 등 접근이 제한된 저장 위치에 보관합니다.
- FileVault 상태는 `fdesetup status`로 확인합니다. 암호화되지 않은 공용·공유 폴더에는 백업을 보관하지 않습니다.
- 백업 파일은 GitHub 저장소, 공개 클라우드 링크, 일반 메신저 또는 이메일에 업로드하지 않습니다.
- 백업 폴더 접근 권한은 본인으로 제한하고, 보관기간이 지난 사본은 저장장치의 암호화·관리 방식에 맞게 안전하게 폐기합니다.
- 백업 파일과 체크섬은 같은 디렉터리에 보관합니다. 체크섬은 파일 변경·손상 여부를 확인하는 용도이며 암호화나 접근 통제를 대신하지 않습니다.

## 5. 복구 원칙과 테스트

복구는 운영 DB에 바로 실행하지 않습니다. 별도 테스트 프로젝트를 만든 뒤 그 프로젝트의 연결 정보로만 복구 리허설을 수행합니다. 새 프로젝트 생성에는 별도 요금이 발생할 수 있으므로 비용을 확인한 후 진행합니다.

Supabase 공식 CLI 복구 가이드는 새 프로젝트에 사용자 정의 역할, 스키마, 데이터를 순서대로 복원하는 방법을 안내합니다. 실제 복구 시에는 새 프로젝트의 Database Settings에서 연결 문자열을 확인하고, 공식 가이드의 권한 설정 및 `psql` 복구 순서를 따릅니다.

**복구 리허설에서 확인할 항목**
- SQL 파일 세 개가 모두 정상적으로 읽히는지
- 스키마, RLS 정책, 함수, 트리거 및 인덱스가 의도대로 복원되는지
- 데이터 행 수와 주요 테이블 간 관계가 일치하는지
- Auth 사용자·OAuth identity가 복원되지 않는 한계를 확인했는지
- Edge Functions, 환경변수, OAuth 공급자, Realtime Publication 등 DB 덤프 밖의 설정을 별도로 재구성했는지
- 복구한 테스트 DB에서 앱의 로그인·핵심 화면·읽기/쓰기 흐름을 점검했는지

Auth 사용자가 포함되지 않으므로 빈 테스트 프로젝트로 수행하는 복구 리허설은 **DB 스키마·데이터 복원 검증**이며, 실제 사용자 로그인을 포함한 완전한 서비스 재해복구 검증이 아닙니다.

## 6. 공식 문서

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI: db dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI v3 마이그레이션 안내](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3)
