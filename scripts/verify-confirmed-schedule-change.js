const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const migration = read('supabase/migrations/20261120122049_confirmed_schedule_change_guard.sql').toLowerCase();
const service = read('src/services/organizationScheduleService.js');
const adminCalendar = read('src/admin/Calendar.jsx');
const employeeCalendar = read('src/components/dayOff/CalendarTab.jsx');

const checks = [
    [
        'extends the existing schedule revision table without creating duplicate history tables',
        migration.includes('alter table public.organization_weekly_schedule_revisions') &&
        !migration.includes('create table public.organization_weekly_schedule_history') &&
        !migration.includes('create table public.organization_schedule_templates')
    ],
    [
        'stores before and after snapshots, result version, actor and change reason',
        migration.includes('after_snapshot') &&
        migration.includes('result_version') &&
        migration.includes('change_reason') &&
        migration.includes('captured_by')
    ],
    [
        'installs a database trigger that blocks confirmed changes without a reason',
        migration.includes('guard_confirmed_organization_weekly_schedule_change') &&
        migration.includes('before update on public.organization_weekly_schedules') &&
        migration.includes('확정된 근무표를 변경하려면 변경 사유를 입력해주세요.')
    ],
    [
        'version-aware save checks expected version and requires reason for confirmed edits',
        migration.includes('save_my_organization_weekly_schedule_v2') &&
        migration.includes('v_current.version <> p_expected_version') &&
        migration.includes('v_changed_confirmed and v_reason is null')
    ],
    [
        'legacy save endpoint is still guarded by the database trigger',
        migration.includes('before update on public.organization_weekly_schedules') &&
        migration.includes('app.schedule_change_reason')
    ],
    [
        'reopening and restoring a schedule persist the change reason',
        migration.includes("v_change_type := 'reopened'") &&
        migration.includes('restore_my_organization_weekly_schedule_revision_v2') &&
        migration.includes('p_change_reason')
    ],
    [
        'employee-requested extra day off and swap approvals remain functional under the guard',
        migration.includes('respond_to_extra_day_off_request') &&
        migration.includes('respond_to_shift_exchange') &&
        migration.includes('직원 추가휴무 요청 승인:') &&
        migration.includes('직원 간 휴무 교환 승인:') &&
        migration.includes("set_config('app.schedule_change_type', 'request_approved', true)")
    ],
    [
        'request approvals are separately classified in the existing revision history',
        migration.includes("'request_approved'") &&
        migration.includes('v_requested_change_type = \'request_approved\'')
    ],
    [
        'legacy restore endpoint is no longer executable by authenticated clients',
        migration.includes('revoke all on function public.restore_my_organization_weekly_schedule_revision(uuid)') &&
        migration.includes('from public, anon, authenticated')
    ],
    [
        'employee notice RPC filters by the signed-in employee and relevant schedule revisions',
        migration.includes('list_my_organization_weekly_schedule_change_notices') &&
        migration.includes('r.snapshot_data ->') &&
        migration.includes('r.after_snapshot ->') &&
        migration.includes('v_user_id::text') &&
        migration.includes("'reopened', 'admin_changed', 'restored'")
    ],
    [
        'service saves schedules through the protected version-aware RPC with a reason',
        service.includes('save_my_organization_weekly_schedule_v2') &&
        service.includes('p_expected_version') &&
        service.includes('p_change_reason')
    ],
    [
        'admin asks for a reason and passes the current schedule version',
        adminCalendar.includes('확정된 근무표를 변경합니다.') &&
        adminCalendar.includes('확정 해제 사유를 입력해주세요.') &&
        adminCalendar.includes('expectedVersion: expectedVersion') &&
        adminCalendar.includes('Number(savedRecord?.version || 0)')
    ],
    [
        'employee calendar polls, displays and remembers change notices',
        employeeCalendar.includes('fetchMyOrganizationWeeklyScheduleChangeNotices') &&
        employeeCalendar.includes('확정 근무표 변경 안내') &&
        employeeCalendar.includes('dayoff_schedule_change_seen:')
    ]
];

const failures = checks.filter(([, passed]) => !passed);
checks.forEach(([label, passed]) => process.stdout.write((passed ? 'PASS ' : 'FAIL ') + label + '\n'));

if (failures.length) {
    process.stderr.write('\n' + failures.length + ' confirmed-schedule guard checks failed.\n');
    process.exitCode = 1;
} else {
    process.stdout.write('\nAll ' + checks.length + ' confirmed-schedule guard checks passed.\n');
}
