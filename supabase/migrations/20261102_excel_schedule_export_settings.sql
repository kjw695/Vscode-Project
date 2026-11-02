-- Company-level business registration number and login IDs for Excel schedule export.
-- Apply this migration in Supabase SQL Editor after reviewing it.
BEGIN;

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS business_registration_number text NOT NULL DEFAULT '';

-- Extend the existing safe current-organization member RPC with the login username.
-- The username is returned only for members of the caller's own organization.
CREATE OR REPLACE FUNCTION public.list_my_organization_members_with_username()
RETURNS TABLE(
    member_id uuid,
    member_display_name text,
    member_username text
)
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

    SELECT p.organization_id INTO v_org_id
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
        )::text AS member_display_name,
        COALESCE(NULLIF(BTRIM(p.username), ''), '')::text AS member_username
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.organization_id = v_org_id
    ORDER BY 2, p.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_organization_members_with_username() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_members_with_username() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_organization_excel_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_org public.organizations%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT o.* INTO v_org
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '소속 회사를 찾을 수 없습니다.';
    END IF;
    IF v_org.owner_id <> v_user_id THEN
        RAISE EXCEPTION '회사 소유자만 엑셀 회사 설정을 확인할 수 있습니다.';
    END IF;

    RETURN jsonb_build_object(
        'organization_id', v_org.id,
        'business_registration_number', COALESCE(v_org.business_registration_number, '')
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_my_organization_excel_settings(
    p_business_registration_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_org_id uuid;
    v_owner_id uuid;
    v_number text := regexp_replace(COALESCE(p_business_registration_number, ''), '[^0-9]', '', 'g');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;
    IF length(v_number) <> 10 THEN
        RAISE EXCEPTION '사업자등록번호는 숫자 10자리여야 합니다.';
    END IF;

    SELECT p.organization_id INTO v_org_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    SELECT o.owner_id INTO v_owner_id
    FROM public.organizations o
    WHERE o.id = v_org_id
    FOR UPDATE;

    IF v_org_id IS NULL OR v_owner_id IS NULL THEN
        RAISE EXCEPTION '소속 회사를 찾을 수 없습니다.';
    END IF;
    IF v_owner_id <> v_user_id THEN
        RAISE EXCEPTION '회사 소유자만 사업자등록번호를 수정할 수 있습니다.';
    END IF;

    UPDATE public.organizations
    SET business_registration_number = v_number
    WHERE id = v_org_id;

    RETURN jsonb_build_object(
        'organization_id', v_org_id,
        'business_registration_number', v_number
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_excel_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_excel_settings() TO authenticated;

REVOKE ALL ON FUNCTION public.update_my_organization_excel_settings(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_organization_excel_settings(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
