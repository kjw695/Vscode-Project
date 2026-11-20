-- Harden auth-related SECURITY DEFINER functions.
-- Trigger-only functions must not be callable as public PostgREST RPC endpoints.
-- The admin predicate remains executable by authenticated users because an RLS
-- policy uses it to restrict access to camp-return analysis reports.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_camp_return_form_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
    IF lower(COALESCE(NEW.email, '')) = lower('kjw891224@gmail.com') THEN
        INSERT INTO public.camp_return_form_admins (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_camp_return_form_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.camp_return_form_admins a
        WHERE a.user_id = (SELECT auth.uid())
    );
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user()
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_camp_return_form_admin()
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_camp_return_form_admin()
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_camp_return_form_admin()
    TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
