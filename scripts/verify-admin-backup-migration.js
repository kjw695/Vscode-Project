const fs = require('fs');
const path = require('path');

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261119_z_organization_admin_backup_restore.sql'
);
const sql = fs.readFileSync(migrationPath, 'utf8').replace(/\s+/g, ' ').toLowerCase();

const checks = [
    ['backup table is company-scoped', /create table if not exists public\.organization_admin_state_backups[\s\S]*?organization_id uuid not null references public\.organizations\(id\)/.test(sql)],
    ['backup snapshots are JSON objects', /snapshot jsonb not null check \(jsonb_typeof\(snapshot\) = 'object'\)/.test(sql)],
    ['backup table has RLS enabled', /alter table public\.organization_admin_state_backups enable row level security/.test(sql)],
    ['direct client table privileges are revoked', /revoke all privileges on table public\.organization_admin_state_backups from public, anon, authenticated/.test(sql)],
    ['automatic snapshot is inserted before state update', sql.indexOf("'auto_save'") >= 0 && sql.indexOf("insert into public.organization_admin_state_backups") < sql.indexOf("update public.organization_admin_state set regions = p_regions")],
    ['automatic retention is capped at 100', /limit 100/.test(sql)],
    ['manual backup RPC is owner-checked', /create or replace function public\.create_my_organization_admin_backup\(\)[\s\S]*?is_current_user_organization_owner\(v_organization_id\)/.test(sql)],
    ['backup list RPC limits results', /list_my_organization_admin_backups\(p_limit integer default 50\)[\s\S]*?limit greatest\(1, least\(coalesce\(p_limit, 50\), 100\)\)/.test(sql)],
    ['backup detail lookup is organization-scoped', /where b\.id = p_backup_id and b\.organization_id = v_organization_id/.test(sql)],
    ['restore checks optimistic version', /restore_my_organization_admin_backup\([\s\S]*?v_state\.version <> p_expected_version/.test(sql)],
    ['restore saves the current state first', /'pre_restore'[\s\S]*?update public\.organization_admin_state set regions = coalesce\(v_backup\.snapshot/.test(sql)],
    ['restore increments the shared version', /version = version \+ 1/.test(sql)],
    ['RPC execute is not granted to anon', /revoke all on function public\.restore_my_organization_admin_backup\(uuid, integer\) from public, anon/.test(sql)],
    ['authenticated users are explicitly granted backup RPC access', /grant execute on function public\.list_my_organization_admin_backups\(integer\) to authenticated/.test(sql)]
];

const failed = checks.filter(([, passed]) => !passed);
checks.forEach(([label, passed]) => {
    process.stdout.write(`${passed ? 'PASS' : 'FAIL'} ${label}\n`);
});

if (failed.length) {
    process.stderr.write(`\n${failed.length} backup migration check(s) failed.\n`);
    process.exitCode = 1;
} else {
    process.stdout.write(`\nAll ${checks.length} backup migration checks passed.\n`);
}
