-- A user may remove only their own camp-return profile.
drop policy if exists camp_return_profiles_delete_own on public.camp_return_profiles;
create policy camp_return_profiles_delete_own
on public.camp_return_profiles
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.reset_my_app_settings()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
    v_user_id uuid := auth.uid();
    v_settings integer := 0;
    v_camp_profile integer := 0;
begin
    if v_user_id is null then
        raise exception using
            errcode = '28000',
            message = 'Authentication required';
    end if;

    delete from public.settings
    where user_id = v_user_id;
    get diagnostics v_settings = row_count;

    delete from public.camp_return_profiles
    where user_id = v_user_id;
    get diagnostics v_camp_profile = row_count;

    update public.profiles
    set preferred_days = '[]'::jsonb
    where id = v_user_id;

    return jsonb_build_object(
        'settings_rows_reset', v_settings,
        'camp_return_profile_reset', v_camp_profile,
        'preferred_days_reset', true
    );
end;
$function$;

revoke all on function public.reset_my_app_settings() from public;
revoke all on function public.reset_my_app_settings() from anon;
grant execute on function public.reset_my_app_settings() to authenticated;
