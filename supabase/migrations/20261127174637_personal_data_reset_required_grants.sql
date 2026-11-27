-- These SECURITY INVOKER RPCs need the underlying table privileges.
-- RLS policies remain responsible for restricting affected rows to auth.uid().
grant delete on table public.daily_inspection_records to authenticated;
grant delete on table public.daily_inspection_signatures to authenticated;
grant delete on table public.camp_return_profiles to authenticated;

-- The settings reset only changes the preferred_days column on the caller's own profile.
grant update (preferred_days) on table public.profiles to authenticated;
