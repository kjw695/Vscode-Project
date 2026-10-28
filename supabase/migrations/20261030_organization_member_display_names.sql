-- Prefer profile names, then OAuth-provided names for organization members.
-- Apply in Supabase SQL Editor after pulling this branch.
BEGIN;

CREATE OR REPLACE FUNCTION public.list_my_organization_members()
RETURNS TABLE(member_id uuid, member_display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_org_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id
    INTO v_org_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_org_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        COALESCE(
            NULLIF(BTRIM(p.display_name), ''),
            NULLIF(BTRIM(p.full_name), ''),
            NULLIF(BTRIM(u.raw_user_meta_data ->> 'full_name'), ''),
            NULLIF(BTRIM(u.raw_user_meta_data ->> 'name'), ''),
            NULLIF(
                BTRIM(CONCAT_WS(
                    ' ',
                    NULLIF(BTRIM(u.raw_user_meta_data ->> 'given_name'), ''),
                    NULLIF(BTRIM(u.raw_user_meta_data ->> 'family_name'), '')
                )),
                ''
            ),
            NULLIF(BTRIM(u.raw_user_meta_data ->> 'preferred_username'), ''),
            NULLIF(BTRIM(u.raw_user_meta_data ->> 'nickname'), ''),
            NULLIF(BTRIM(u.raw_user_meta_data ->> 'user_name'), ''),
            '이름 미등록'
        )::text AS member_display_name
    FROM public.profiles p
    LEFT JOIN auth.users u
        ON u.id = p.id
    WHERE p.organization_id = v_org_id
    ORDER BY member_display_name, p.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_organization_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_members() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
