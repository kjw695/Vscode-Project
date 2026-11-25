# Supabase 운영 DB 백업 절차

최종 확인: 2026-11-25  
대상 프로젝트: `delivery-app` (`rrjoilqlsyilqqtzybps`, 서울 리전)  
현재 요금제: Supabase Free

## 1. 백업 정책

로그인 사용자의 클라우드 동기화 대상 데이터는 Supabase에 저장됩니다. 앱의 Google Drive 백업·복원 기능은 출시 범위에서 제외했습니다. 앱의 CSV 내보내기는 배송 장부 내역용이며 서버 DB 전체 백업을 대체하지 않습니다.

현재 Free 요금제에는 Supabase가 제공하는 자동 일일 DB 백업이 포함되지 않습니다. Supabase 공식 문서는 Free 프로젝트에 Supabase CLI `db dump`로 데이터를 정기 내보내고 별도 위치에 보관하도록 권장합니다.

**운영 권장 주기**
- 주 1회 수동 내보내기
- DB 마이그레이션, RLS·트리거 변경, 계정 삭제 로직 변경 등 운영 DB에 큰 영향을 주는 작업 직전
- 내보낸 파일은 Git 저장소 밖의 암호화된 저장 위치에 보관
- 최근 4주분을 유지하고, 보관기간이 지난 백업은 안전하게 삭제
- 복구 절차는 운영 DB가 아닌 별도 테스트 프로젝트에서 먼저 검증

## 2. 중요한 백업 범위 제한

Supabase CLI의 기본 `db dump`는 Supabase 관리 스키마인 `auth`, `storage` 및 확장 프로그램 관리 스키마를 제외합니다. 따라서 다음 세 파일을 만들더라도 **전체 Supabase 프로젝트를 완전히 복구할 수 있는 백업은 아닙니다.**

| 항목 | CLI 내보내기 포함 여부 |
|---|---|
| 애플리케이션 스키마·테이블·정책·함수 등 | 포함 대상 |
| 애플리케이션 테이블 데이터 | 포함 대상 |
| 사용자 정의 DB 역할 | `--role-only`로 별도 내보내기 |
| Supabase Auth 사용자·OAuth identity | 기본 덤프에서 제외 |
| Supabase Storage 객체 | DB 덤프에 포함되지 않음 |
| Edge Function 배포 파일·환경 변수·OAuth 공급자 설정 | 별도 보관·재설정 필요 |

2026-11-25 점검 당시 이 프로젝트의 Supabase Storage bucket은 0개였습니다. 파일 업로드 기능을 추가하거나 Storage를 사용하기 시작하면 파일 객체의 별도 백업 절차도 마련해야 합니다.

특히 Auth 사용자는 기본 CLI 덤프에 포함되지 않으므로, 이 내보내기만으로 로그인 계정과 사용자 ID까지 복구할 수 있다고 가정하면 안 됩니다. 전체 프로젝트 장애 복구가 출시 운영의 필수 요건이 되면 Supabase 유료 요금제의 자동 백업을 검토하고, Auth·Storage·Edge Functions까지 포함하는 복구 리허설을 별도로 수행해야 합니다.

## 3. Mac mini에서 수동 내보내기

### 사전 준비
1. Mac에 Supabase CLI와 Docker Desktop을 설치합니다.
2. 프로젝트 루트(`Vscode-Project-main`)에서 아래 명령을 한 번 실행해 대상 프로젝트에 연결합니다. 이미 이 프로젝트에 연결되어 있으면 다시 연결할 필요가 없습니다.

```bash
supabase link --project-ref rrjoilqlsyilqqtzybps
```

3. DB 비밀번호를 물으면 Supabase Dashboard의 Database Settings에서 확인한 비밀번호를 입력합니다. 비밀번호나 연결 문자열을 Git에 저장하거나 채팅·로그에 붙여 넣지 마세요.

### 백업 실행

프로젝트 루트에서 실행합니다. 백업은 저장소 밖의 `~/Backups`에 생성하므로 Git에 포함되지 않습니다.

```bash
BACKUP_DIR="$HOME/Backups/supabase/delivery-app/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
```

스키마, 역할, 애플리케이션 데이터를 각각 내보냅니다.

```bash
supabase db dump -f "$BACKUP_DIR/schema.sql"
supabase db dump --role-only -f "$BACKUP_DIR/roles.sql"
supabase db dump --data-only --use-copy -f "$BACKUP_DIR/data.sql"
```

파일 권한과 체크섬을 확인합니다.

```bash
chmod 600 "$BACKUP_DIR"/*.sql
shasum -a 256 "$BACKUP_DIR"/*.sql > "$BACKUP_DIR/SHA256SUMS.txt"
ls -lh "$BACKUP_DIR"
cat "$BACKUP_DIR/SHA256SUMS.txt"
```

세 덤프 명령 중 하나라도 실패하면 해당 백업 세트를 정상 백업으로 취급하지 말고 오류를 해결한 뒤 다시 실행합니다.

## 4. 보관 및 복구 원칙

- SQL 파일에는 계정과 배송·근무 관련 개인정보가 포함될 수 있습니다. FileVault가 켜진 Mac 또는 암호화된 외장 저장장치 등 접근이 제한된 장소에 보관합니다.
- 백업 파일을 GitHub 저장소, 공개 폴더, 일반 메신저에 올리지 않습니다.
- 복구 테스트는 별도의 테스트 프로젝트에서 진행합니다. 운영 프로젝트에 시험용 SQL을 실행하지 않습니다.
- 이 CLI 덤프는 Auth·Storage·Edge Functions·프로젝트 설정을 포함한 완전한 플랫폼 백업이 아닙니다. 새 프로젝트로 복구할 경우 OAuth 공급자·Edge Functions·비밀 환경변수·도메인 등은 별도로 구성해야 합니다.
- Supabase의 백업 정책과 CLI 동작은 변경될 수 있으므로 운영 백업을 수행하기 전에 아래 공식 문서를 다시 확인합니다.

## 5. 공식 문서

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI: db dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

