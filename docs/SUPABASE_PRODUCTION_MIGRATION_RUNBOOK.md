# Supabase 운영 DB 마이그레이션 적용 및 확인 기록

> 최종 확인: 2026-11-20  
> 프로젝트: `delivery-app` (`rrjoilqlsyilqqtzybps`) · PostgreSQL 17.6 · `ACTIVE_HEALTHY`

## 현재 적용 상태

운영 DB의 마이그레이션 이력과 실제 스키마를 확인했다. 아래 17개 항목이 모두 applied로 기록되어 있다.

| 버전 | 마이그레이션 |
|---|---|
| 20261026090000 | security_hardening |
| 20261027090000 | shift_exchange_rpc |
| 20261029090000 | team_deletion_election |
| 20261030090000 | organization_member_display_names |
| 20261030100000 | profile_username_required |
| 20261101090000 | organization_weekly_schedule_sync |
| 20261101100000 | schedule_day_off_workflows |
| 20261113 | camp_return_numbering_hakcheon_nongso |
| 20261114 | regional_camp_return_forms |
| 20261115 | camp_return_default_mobile_camp |
| 20261116 | camp_return_records_delete_own |
| 20261119193000 | shared_company_admin_data |
| 20261119194500 | admin_data_backup_restore |
| 20261119195500 | weekly_schedule_templates_history |
| 20261119200500 | day_off_request_admin_history |
| 20261120122049 | confirmed_schedule_change_guard |
| 20261120125422 | remove_schedule_template_storage |

이전 2026-11-19 사전 점검에서는 신규 4개가 미적용으로 확인됐지만, 이후 PR #24와 PR #28 병합 후 이들 5개(기존 신규 4개 + 확정 근무표 보호 1개)가 운영 DB에 적용됐다. 예전 사전 점검의 “미적용” 설명과 적용 순서는 현재 상태에 적용하지 않는다.

다음 명령으로 현재 상태를 재확인할 수 있다.

~~~bash
supabase link --project-ref rrjoilqlsyilqqtzybps
supabase migration list --remote
~~~

현재 적용된 이력을 다시 실행하거나 `migration repair`를 반복하지 않는다. 정상 상태라면 로컬 migration 파일과 원격 이력이 일치하고, 아래 dry-run에서 pending migration이 없어야 한다.

~~~bash
supabase db push --dry-run --remote
~~~

## 기존 구버전 마이그레이션 주의사항

아래 SQL은 과거 운영 DB에 반영되어 있던 기능의 이력을 정리한 것이다.

- `20261026090000_security_hardening.sql`: public 스키마 권한을 폭넓게 회수한 뒤 필요한 권한을 다시 부여한다. 신규 테이블 생성 후 재실행하면 새 테이블 권한에도 영향을 줄 수 있다.
- `20261101090000_organization_weekly_schedule_sync.sql`: 회사 연동 시작일 이후의 개인 휴무 전용 entries를 삭제한다. 운영 데이터가 추가된 뒤 재실행하면 실제 사용자 기록이 삭제될 수 있다.

두 파일을 포함해 이미 applied인 마이그레이션은 재실행하지 않는다. 과거 이력 정리가 필요할 때도 실제 DB 스키마와 이력의 차이를 먼저 확인한 뒤 별도 판단한다.

## 확정 근무표 변경 통제 적용 내용

적용 파일: `supabase/migrations/20261120122049_confirmed_schedule_change_guard.sql`

- 기존 `organization_weekly_schedule_revisions` 테이블에 `after_snapshot`, `result_version`, `change_type`, `change_reason`, `restored_from_revision_id`를 추가했다.
- 확정 근무표가 변경될 때 사유가 없으면 DB 트리거가 업데이트를 거부한다. 기존 저장 RPC를 통한 우회도 차단한다.
- 버전 충돌을 확인하는 `save_my_organization_weekly_schedule_v2`를 추가했다.
- 사유 필수·버전 확인 복구 RPC `restore_my_organization_weekly_schedule_revision_v2`를 추가하고 구형 복구 RPC의 authenticated 실행 권한을 회수했다.
- 직원 본인 일정에 맞는 변경 안내 조회 RPC `list_my_organization_weekly_schedule_change_notices`를 추가했다.
- 직원의 추가휴무 승인과 휴무 교환 승인 흐름은 유지했다. 이 승인들은 직원 요청을 근거로 사유를 자동 기록하고, 변경 이력 유형을 `request_approved`로 구분한다.

## 근무표 템플릿 기능 제거

적용 파일: `supabase/migrations/20261120125422_remove_schedule_template_storage.sql`

- 자동 휴무 생성이 핵심 제품 방향으로 확정되어, 반복 일정 템플릿 저장 기능을 제거했다.
- 적용 전 운영 DB의 `organization_weekly_schedule_templates` 행은 0건이었다.
- 템플릿 전용 RPC 4개(`list`, `get`, `save`, `delete`)와 템플릿 테이블만 제거했다.
- 근무표 감사 이력 테이블 `organization_weekly_schedule_revisions`는 유지했다. 확정 근무표 변경 사유, 전후 스냅샷, 직원 변경 안내에 필요하다.

## 운영 DB 적용 후 확인 결과

- `organization_weekly_schedules`: 2개 행 유지
- `organization_weekly_schedule_revisions`: 2개 행 유지, 기존 기준 이력 2개 유지
- `organization_weekly_schedule_templates`: 테이블과 템플릿 전용 RPC 4개 제거 확인 (적용 전 행 0개)
- 새 감사 컬럼 5개 확인
- 확정 근무표 보호 트리거와 기존 이력 캡처 트리거 설치 확인
- 신규 RPC 3개 모두 authenticated 실행 가능, anon 실행 불가
- 구형 복구 RPC는 authenticated 실행 불가
- 근무표·이력 테이블은 RLS enabled이며 authenticated 직접 SELECT/UPDATE 권한 없음
- 변경 사유 없이 확정 근무표 수정 시도 시 DB가 거부하는 동작 확인. 테스트 변경은 트랜잭션 안에서 롤백되어 데이터는 바뀌지 않았다.

## 보안 및 성능 Advisor 참고

Advisor에는 이 변경과 무관하게 기존부터 존재하는 안내도 남아 있다. RLS policy가 없는 테이블 경고는 해당 테이블의 직접 API 권한도 회수되어 있는지 함께 확인해야 하며, SECURITY DEFINER 함수 경고는 함수별 의도된 인증 범위와 내부 권한 검사를 확인해야 한다. 이번 변경의 신규 RPC는 `search_path=pg_catalog, public`으로 고정했고, anon 실행 권한은 부여하지 않았다.

기존 앱 전체의 Auth 보안·기타 public 함수 권한·미사용 인덱스·외래 키 인덱스 안내는 이번 작업 범위에서 변경하지 않았다.

## 남은 실사용 확인

GitHub Actions에서 계정 분리/회귀 테스트, 변경 통제 전용 검사, React 프로덕션 빌드, Capacitor 동기화, Android Debug APK 빌드 및 업로드가 성공했다.

실제 Android 기기에서 대표 계정과 직원 계정으로 다음 동작을 확인하는 작업만 별도로 남아 있다.

1. 대표 계정에서 확정 근무표 수정·확정 해제 시 사유를 입력해야 저장되는지
2. 사유와 변경 이력이 근무표 이력에 표시되는지
3. 직원 계정은 본인 일정에 해당하는 변경 안내만 확인하는지
4. 직원의 추가휴무 요청 승인과 휴무 교환 승인 동작이 기존처럼 유지되는지

안내는 직원이 기존 직원용 달력 화면을 열고 동기화할 때 표시되는 인앱 안내다. 네이티브 푸시 알림(FCM)은 구현하지 않았다.
