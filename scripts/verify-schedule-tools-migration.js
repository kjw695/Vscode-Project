const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const sql = read('supabase/migrations/20261120_organization_schedule_tools.sql').replace(/\\s+/g, ' ').toLowerCase();
const calendar = read('src/admin/Calendar.jsx');
const service = read('src/services/organizationScheduleService.js');

const checks = [
  ['schedule history table is company scoped', /create table if not exists public\\.organization_weekly_schedule_history[\\s\\S]*?organization_id uuid not null references public\\.organizations\\(id\\)/.test(sql)],
  ['schedule history snapshots include version and full schedule data', /version integer not null check\\(version>0\\)[\\s\\S]*?schedule jsonb not null[\\s\\S]*?employee_details jsonb not null[\\s\\S]*?warnings jsonb not null/.test(sql)],
  ['schedule history table is protected by RLS and revoked direct access', /alter table public\\.organization_weekly_schedule_history enable row level security/.test(sql) && /revoke all privileges on table public\\.organization_weekly_schedule_history from public,anon,authenticated/.test(sql)],
  ['all schedule inserts and updates are captured', /create trigger organization_weekly_schedule_history_capture after insert or update on public\\.organization_weekly_schedules/.test(sql)],
  ['schedule history retention is 100 versions', /order by x\\.created_at desc,x\\.id desc limit 100/.test(sql)],
  ['versioned save uses transaction advisory lock', /save_my_organization_weekly_schedule_v2[\\s\\S]*?pg_advisory_xact_lock/.test(sql)],
  ['versioned save compares the expected version', /v_row\\.version<>p_expected_version/.test(sql)],
  ['versioned save is owner checked', /save_my_organization_weekly_schedule_v2[\\s\\S]*?o\\.owner_id=v_user/.test(sql)],
  ['history reads are owner checked and organization scoped', /list_my_organization_weekly_schedule_history[\\s\\S]*?o\\.owner_id=v_user[\\s\\S]*?h\\.organization_id=v_org/.test(sql)],
  ['history restore checks version and writes a new version', /restore_my_organization_weekly_schedule_history[\\s\\S]*?v_now\\.version<>p_expected_version[\\s\\S]*?version=version\+1/.test(sql)],
  ['template storage is company/team scoped and unique', /unique\\(organization_id,team_id,template_name\\)/.test(sql)],
  ['template CRUD RPCs verify representative ownership', /save_my_organization_schedule_template[\\s\\S]*?o\\.owner_id=v_user[\\s\\S]*?list_my_organization_schedule_templates[\\s\\S]*?o\\.owner_id=v_user[\\s\\S]*?delete_my_organization_schedule_template[\\s\\S]*?o\\.owner_id=v_user/.test(sql)],
  ['RPC execute is granted to authenticated but revoked from public and anon', /revoke all on function public\\.restore_my_organization_weekly_schedule_history\\(uuid,integer\\) from public,anon/.test(sql) && /grant execute on function public\\.restore_my_organization_weekly_schedule_history\\(uuid,integer\\) to authenticated/.test(sql)],
  ['previous-week copy is a client action', calendar.includes('handleCopyPreviousWeek') && calendar.includes('지난주 근무표를 이번 주 초안으로 복사했습니다.')],
  ['template and history tools are mounted', calendar.includes('<ScheduleToolsPanel') && calendar.includes('handleApplyScheduleTemplate') && calendar.includes('handleRestoreScheduleHistory')],
  ['drafts use shared versioned save and do not auto-confirm', calendar.includes("status: 'draft', schedule: generatedSchedule") && calendar.includes('expectedVersion: expectedVersion') && calendar.includes("setScheduleStatus('saved')")],
  ['service uses v2 optimistic save and exposes history/template RPCs', service.includes('save_my_organization_weekly_schedule_v2') && service.includes('restore_my_organization_weekly_schedule_history') && service.includes('save_my_organization_schedule_template')]
];

const failed = checks.filter(([, passed]) => !passed);
checks.forEach(([label, passed]) => process.stdout.write(`${passed ? 'PASS' : 'FAIL'} ${label}\\n`));
if (failed.length) {
  process.stderr.write(`\\n${failed.length} schedule-tools verification check(s) failed.\\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`\\nAll ${checks.length} schedule-tools verification checks passed.\\n`);
}
