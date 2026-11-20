# Supabase 운영 DB 마이그레이션 사전 점검 및 적용 절차

> 2026-11-19 기준 읽기 전용 운영 DB 점검 결과를 기록한다. 이 문서는 SQL을 직접 실행하지 않는다.

## 확인한 운영 상태

프로젝트: delivery-app (rrjoilqlsyilqqtzybps), PostgreSQL 17.6, ACTIVE_HEALTHY.

운영 DB 마이그레이션 이력은 현재 다음 4개만 기록되어 있다.

- 20261113
- 20261114
- 20261115
- 20261116

그러나 저장소에는 아래 7개 구버전 기능이 이미 운영 DB에 반영된 것으로 보이는 객체가 존재한다. 예시로 확인한 객체:
- 계정/권한 보안 강화: profiles/entries/settings/notifications/shift_exchanges RLS 정책과 최소 권한 GRANT
- 직원 휴무 교환: 중복 휴무 방지 인덱스, shift-exchange RPC, 직접 INSERT/UPDATE 차단
- 업체 삭제/대표 변경: 삭제 요청·투표 테이블, 관련 함수, 분 단위 Cron 작업
- 사용자명: profiles.username, 형식 CHECK, unique index, 멤버 표시이름 RPC
- 주간 근무표 연동: organizations.schedule_sync_from, organization_weekly_schedules, 직원 휴무 RPC 및 기존 개인 휴무 연동 차단 로직
- 추가 휴무/교환: organization_extra_day_off_requests, organization_schedule_change_history, 승인·교환 RPC

다만 이 검사는 스키마·인덱스·정책·함수 시그니처와 권한의 존재를 확인한 것으로, 구버전 SQL 전체와 운영 함수 정의를 바이트 단위로 대조한 것은 아니다. 따라서 아래 repair 명령 전에 실제 운영 스키마를 백업하고, 각 migration 기능의 최종 상태를 한 번 더 확인해야 한다.

## 중요한 재실행 금지 항목

1. 20261026090000_security_hardening.sql은 public 스키마의 모든 테이블에 대해 anon/authenticated 권한을 일괄 회수한 뒤 일부 테이블만 다시 부여한다. 이 파일을 신규 테이블 생성 후 다시 실행하면 그 후 생성된 테이블 권한도 바뀔 수 있다.
2. 20261101090000_organization_weekly_schedule_sync.sql은 회사 연동 시작일 이후의 개인 휴무 전용 entries를 삭제한다. 운영 데이터가 추가된 이후 재실행하면 새 데이터가 삭제될 위험이 있다.
3. 따라서 아래 7개 구버전은 SQL 재실행 대상이 아니라, 현재 스키마 반영이 확인된 뒤 migration history에만 applied로 맞추는 대상이다.
4. supabase db push --include-all은 사용하지 않는다.

## 고유한 14자리 migration timestamp

기존 파일 중 8자리 버전이 중복된 날짜(20261030, 20261101)가 있고, 신규 공유 데이터 마이그레이션의 8자리 버전(20261119)이 같은 날짜의 14자리 마이그레이션과 섞여 있었다. CLI 로컬 파일명 정렬과 원격 버전 문자열 정렬이 달라질 수 있으므로 모두 고유한 14자리 timestamp로 정리했다.

| 이전 버전 | 정리한 버전 | 파일 |
|---|---|---|
| 20261026 | 20261026090000 | security_hardening |
| 20261027 | 20261027090000 | shift_exchange_rpc |
| 20261029 | 20261029090000 | team_deletion_election |
| 20261030 | 20261030090000 | organization_member_display_names |
| 20261030 | 20261030100000 | profile_username_required |
| 20261101 | 20261101090000 | organization_weekly_schedule_sync |
| 20261101 | 20261101100000 | schedule_day_off_workflows |
| 20261119 | 20261119193000 | shared_company_admin_data |

The remote history versions 20261113–20261116 remain unchanged. The four new migrations must be applied after those entries in this order:

1. 20261119193000_shared_company_admin_data.sql
2. 20261119194500_admin_data_backup_restore.sql
3. 20261119195500_weekly_schedule_templates_history.sql
4. 20261119200500_day_off_request_admin_history.sql

## 권장 실행 순서 (운영 DB 변경 전 백업 필수)

Run these from the repository root after linking the correct project:

~~~bash
supabase link --project-ref rrjoilqlsyilqqtzybps
supabase migration list --remote
~~~

먼저 7개 구버전의 전체 SQL 효과가 현재 운영 DB에 이미 적용됐는지 검토한다. 모든 효과가 확인된 경우에만 history-only repair를 실행한다. 이 명령은 SQL을 실행하지 않고 migration tracking row만 기록한다.

~~~bash
supabase migration repair 20261026090000 20261027090000 20261029090000 20261030090000 20261030100000 20261101090000 20261101100000 --status applied --remote
supabase migration list --remote
~~~

그다음 dry-run을 실행한다. 결과에 아래 신규 4개만 pending으로 나와야 한다. 이전 마이그레이션이 pending으로 나오거나 예상과 다른 항목이 나오면 중단한다.

~~~bash
supabase db push --dry-run --remote
~~~

dry-run 결과가 정확히 일치하고 운영 백업이 확인된 이후에만 아래 명령으로 새 4개를 적용한다.

~~~bash
supabase db push --remote
~~~

## 신규 적용 후 검증

- migration history에 20261119193000, 20261119194500, 20261119195500, 20261119200500이 applied로 기록되었는지 확인한다.
- organization_admin_state에는 대표만 SELECT 가능한 RLS 정책이 생성되었는지 확인한다.
- organization_admin_state_backups, organization_weekly_schedule_templates, organization_weekly_schedule_revisions는 RLS enabled 및 anon/authenticated 직접 권한 없음인지 확인한다. 해당 데이터는 대표 검증을 하는 RPC만 사용한다.
- organization_admin_state 변경 트리거가 자동 백업을 만들고, 수동 백업/복구 RPC가 회사 ID 범위로 제한되는지 확인한다.
- 기존 organization_weekly_schedules 2개 행에 baseline revision 2개가 생성되었는지 확인한다.
- 직원용 list_my_organization_weekly_schedules는 기존과 같이 직원에게 confirmed schedule만 상세 제공하고 draft는 미확정 상태만 제공하는지 확인한다.
- 휴무 이력 RPC는 현재 조직의 요청만 반환하는지 확인한다.
- 실제 앱에서 대표 계정 백업·복구, 템플릿 저장/불러오기, 지난주 복사, 임시저장/확정, 직원 화면의 미확정/확정 근무표, 휴무 요청 이력을 점검한다.

## 현재 미적용 상태

이 사전 점검 시점에는 신규 migration을 운영 DB에 적용하지 않았다. PR 병합, 앱 배포도 별도 단계다.
