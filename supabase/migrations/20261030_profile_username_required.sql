-- Require a profile name and unique username before creating or joining a team.
-- Username is a user-chosen account identifier; it does not replace Google/Apple sign-in.
BEGIN;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_normalized_unique
    ON public.profiles (lower(btrim(username)))
    WHERE username IS NOT NULL AND btrim(username) <> '';

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_username_format_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_username_format_check
    CHECK (
        username IS NULL
        OR btrim(username) = ''
        OR (username = lower(btrim(username)) AND username ~ '^[a-z0-9_]{3,20}$')
    );

GRANT UPDATE (username) ON TABLE public.profiles TO authenticated;

-- Return current-company members with a display name from profile or OAuth metadata.
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
        )::text AS member_display_name
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.organization_id = v_org_id
    ORDER BY 2, p.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_organization_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_members() TO authenticated;

-- Team creation requires the account owner to complete their own name and username.
CREATE OR REPLACE FUNCTION public.create_organization_for_current_user(p_team_name text)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_org uuid;
    v_username text;
    v_full_name text;
    v_invite_code text;
    v_org public.organizations%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF NULLIF(BTRIM(p_team_name), '') IS NULL THEN
        RAISE EXCEPTION '회사 이름을 입력해주세요.';
    END IF;

    SELECT p.organization_id, p.username, p.full_name
    INTO v_current_org, v_username, v_full_name
    FROM public.profiles p
    WHERE p.id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '팀을 만들기 전에 내 정보에서 이름과 아이디를 저장해주세요.';
    END IF;

    IF NULLIF(BTRIM(v_full_name), '') IS NULL THEN
        RAISE EXCEPTION '팀을 만들기 전에 내 정보에서 이름을 입력해주세요.';
    END IF;

    IF v_username IS NULL OR v_username !~ '^[a-z0-9_]{3,20}$' THEN
        RAISE EXCEPTION '팀을 만들기 전에 내 정보에서 영문 소문자·숫자·밑줄(_) 3~20자의 아이디를 등록해주세요.';
    END IF;

    IF v_current_org IS NOT NULL THEN
        RAISE EXCEPTION '이미 회사에 소속되어 있습니다. 먼저 기존 소속을 정리해주세요.';
    END IF;

    LOOP
        v_invite_code := 'ven_' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.organizations o WHERE o.invite_code = v_invite_code
        );
    END LOOP;

    INSERT INTO public.organizations (name, invite_code, owner_id)
    VALUES (BTRIM(p_team_name), v_invite_code, v_user_id)
    RETURNING * INTO v_org;

    INSERT INTO public.profiles (id, organization_id)
    VALUES (v_user_id, v_org.id)
    ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

    RETURN v_org;
END;
$function$;

-- Team joining also requires a saved name and username, enforced on the server.
CREATE OR REPLACE FUNCTION public.join_organization_by_invite_code(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_org uuid;
    v_username text;
    v_full_name text;
    v_org_id uuid;
    v_org public.organizations%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF NULLIF(BTRIM(p_invite_code), '') IS NULL THEN
        RAISE EXCEPTION '초대 코드를 입력해주세요.';
    END IF;

    SELECT o.id INTO v_org_id
    FROM public.organizations o
    WHERE o.invite_code = BTRIM(p_invite_code)
    LIMIT 1;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION '유효하지 않거나 만료된 초대 링크입니다.';
    END IF;

    SELECT o.* INTO v_org
    FROM public.organizations o
    WHERE o.id = v_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '팀 정보를 찾을 수 없습니다.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.organization_deletion_requests r
        WHERE r.organization_id = v_org.id
          AND r.status = 'pending'
    ) THEN
        RAISE EXCEPTION '이 팀은 삭제 유예 및 팀장 선출 중이므로 지금은 가입할 수 없습니다.';
    END IF;

    SELECT p.organization_id, p.username, p.full_name
    INTO v_current_org, v_username, v_full_name
    FROM public.profiles p
    WHERE p.id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '팀 가입 전에 내 정보에서 이름과 아이디를 저장해주세요.';
    END IF;

    IF NULLIF(BTRIM(v_full_name), '') IS NULL THEN
        RAISE EXCEPTION '팀 가입 전에 내 정보에서 이름을 입력해주세요.';
    END IF;

    IF v_username IS NULL OR v_username !~ '^[a-z0-9_]{3,20}$' THEN
        RAISE EXCEPTION '팀 가입 전에 내 정보에서 영문 소문자·숫자·밑줄(_) 3~20자의 아이디를 등록해주세요.';
    END IF;

    IF v_current_org IS NOT NULL AND v_current_org <> v_org.id THEN
        RAISE EXCEPTION '이미 다른 회사에 소속되어 있습니다. 먼저 기존 소속에서 나가주세요.';
    END IF;

    INSERT INTO public.profiles (id, organization_id)
    VALUES (v_user_id, v_org.id)
    ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

    RETURN jsonb_build_object(
        'id', v_org.id,
        'name', v_org.name,
        'owner_id', v_org.owner_id,
        'invite_code', CASE WHEN v_org.owner_id = v_user_id THEN v_org.invite_code ELSE NULL END,
        'assignment_deadline_day', v_org.assignment_deadline_day,
        'assignment_deadline_time', v_org.assignment_deadline_time
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_organization_for_current_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_for_current_user(text) TO authenticated;

REVOKE ALL ON FUNCTION public.join_organization_by_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_organization_by_invite_code(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
