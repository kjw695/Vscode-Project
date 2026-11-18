const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const sql = read('supabase/migrations/20261120_organization_schedule_tools.sql').toLowerCase();
const calendar = read('src/admin/Calendar.jsx');
const service = read('src/services/organizationScheduleService.js');

const getFunction = (name) => {
    const start = sql.indexOf('create or replace function public.' + name);
    if (start < 0) return '';
    const end = sql.indexOf('$function$;', start);
    return end < 0 ? sql.slice(start) : sql.slice(start, end);
};
const saveFn = getFunction('save_my_organization_weekly_schedule_v2');
const historyListFn = getFunction('list_my_organization_weekly_schedule_history');
const restoreFn = getFunction('restore_my_organization_weekly_schedule_history');
const templateSaveFn = getFunction('save_my_organization_schedule_template');
const templateListFn = getFunction('list_my_organization_schedule_templates');
const templateDeleteFn = getFunction('delete_my_organization_schedule_template');

const checks = [
    ['history table is company-scoped', sql.includes('create table if not exists public.organization_weekly_schedule_history') && sql.includes('organization_id uuid not null references public.organizations(id)')],
    ['history stores version, schedule, employee details and warnings', sql.includes('version integer not null check(version>0)') && sql.includes('schedule jsonb not null') && sql.includes('employee_details jsonb not null') && sql.includes('warnings jsonb not null')],
    ['history table is RLS-protected with direct access revoked', sql.includes('alter table public.organization_weekly_schedule_history enable row level security') && sql.includes('revoke all privileges on table public.organization_weekly_schedule_history from public,anon,authenticated')],
    ['schedule insert and update trigger captures every saved version', sql.includes('after insert or update on public.organization_weekly_schedules') && sql.includes('execute function public.capture_organization_weekly_schedule_history()')],
    ['history retention is capped at 100 versions per schedule', sql.includes('order by x.created_at desc,x.id desc limit 100')],
    ['versioned save serializes updates and checks expected version', saveFn.includes('pg_advisory_xact_lock') && saveFn.includes('v_row.version<>p_expected_version')],
    ['versioned save verifies the representative account', saveFn.includes('o.owner_id=v_user')],
    ['history listing is company-scoped and representative-only', historyListFn.includes('o.owner_id=v_user') && historyListFn.includes('h.organization_id=v_org')],
    ['history restore checks current version and increments it', restoreFn.includes('v_now.version<>p_expected_version') && restoreFn.includes('version=version+1')],
    ['templates are unique per company, team and name', sql.includes('unique(organization_id,team_id,template_name)')],
    ['template save, list and delete all verify ownership', templateSaveFn.includes('o.owner_id=v_user') && templateListFn.includes('o.owner_id=v_user') && templateDeleteFn.includes('o.owner_id=v_user')],
    ['restore RPC execute is limited to authenticated users', sql.includes('revoke all on function public.restore_my_organization_weekly_schedule_history(uuid,integer) from public,anon') && sql.includes('grant execute on function public.restore_my_organization_weekly_schedule_history(uuid,integer) to authenticated')],
    ['previous-week copy generates a draft only', calendar.includes('handleCopyPreviousWeek') && calendar.includes('setScheduleStatus(\'generated\')') && calendar.includes('아직 저장·확정되지 않았습니다.')],
    ['template and history UI is mounted', calendar.includes('<ScheduleToolsPanel') && calendar.includes('handleApplyScheduleTemplate') && calendar.includes('handleRestoreScheduleHistory')],
    ['organization drafts are stored through versioned save', calendar.includes('saveMyOrganizationWeeklySchedule({') && calendar.includes('expectedVersion: expectedVersion') && calendar.includes('employeeDetails: draftEmployeeDetails')],
    ['service calls the v2 save RPC and exposes history/template actions', service.includes('save_my_organization_weekly_schedule_v2') && service.includes('restore_my_organization_weekly_schedule_history') && service.includes('save_my_organization_schedule_template')]
];

const failures = checks.filter(([, passed]) => !passed);
checks.forEach(([label, passed]) => process.stdout.write((passed ? 'PASS ' : 'FAIL ') + label + '\n'));
if (failures.length) {
    process.stderr.write('\n' + failures.length + ' schedule-tools checks failed.\n');
    process.exitCode = 1;
} else {
    process.stdout.write('\nAll ' + checks.length + ' schedule-tools checks passed.\n');
}
