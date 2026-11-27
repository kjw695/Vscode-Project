-- Allow authenticated users to delete only their own daily inspection rows.
-- Row ownership remains enforced by the policies below.
drop policy if exists daily_inspection_records_delete_own on public.daily_inspection_records;
create policy daily_inspection_records_delete_own
on public.daily_inspection_records
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists daily_inspection_signatures_delete_own on public.daily_inspection_signatures;
create policy daily_inspection_signatures_delete_own
on public.daily_inspection_signatures
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.delete_my_personal_data()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
    v_user_id uuid := auth.uid();
    v_inspection_records integer := 0;
    v_inspection_signatures integer := 0;
    v_camp_return_records integer := 0;
    v_camp_return_forms integer := 0;
    v_entries integer := 0;
begin
    if v_user_id is null then
        raise exception using
            errcode = '28000',
            message = 'Authentication required';
    end if;

    -- Delete inspection records before signatures because records reference signature versions.
    delete from public.daily_inspection_records
    where user_id = v_user_id;
    get diagnostics v_inspection_records = row_count;

    delete from public.daily_inspection_signatures
    where user_id = v_user_id;
    get diagnostics v_inspection_signatures = row_count;

    delete from public.camp_return_records
    where user_id = v_user_id;
    get diagnostics v_camp_return_records = row_count;

    delete from public.camp_return_forms
    where user_id = v_user_id;
    get diagnostics v_camp_return_forms = row_count;

    delete from public.entries
    where user_id = v_user_id;
    get diagnostics v_entries = row_count;

    return jsonb_build_object(
        'daily_inspection_records', v_inspection_records,
        'daily_inspection_signatures', v_inspection_signatures,
        'camp_return_records', v_camp_return_records,
        'camp_return_forms', v_camp_return_forms,
        'entries', v_entries
    );
end;
$function$;

revoke all on function public.delete_my_personal_data() from public;
revoke all on function public.delete_my_personal_data() from anon;
grant execute on function public.delete_my_personal_data() to authenticated;
