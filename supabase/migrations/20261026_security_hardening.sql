-- Security hardening for the delivery management app.
-- Review this migration before applying it to Supabase. It has NOT been run against the live database.
-- Intended branch: security-audit
-- Notes:
--   * Public read access is retained only for the existing public community tables (posts/comments/likes).
--   * Profile membership fields are changed only through SECURITY DEFINER RPCs.
--   * The private schema must NOT be added to Supabase/PostgREST exposed schemas.

BEGIN;

-- 1) Client roles should never need table-level TRUNCATE, REFERENCES, or TRIGGER privileges.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
-- No broad PUBLIC grants were reported by the current privilege audit; revoke only client roles here.
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 2) Re-grant only the table actions used by the app.
-- Anonymous users can read public community content, but cannot mutate any table.
GRANT SELECT ON TABLE public.posts, public.comments, public.likes TO anon;

-- Authenticated user-owned data.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.settings TO authenticated;

-- Public community: public read, authenticated users may create/edit/delete their own rows under RLS.
GRANT SELECT ON TABLE public.posts, public.comments, public.likes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.posts TO authenticated;
GRANT INSERT, DELETE ON TABLE public.comments, public.likes TO authenticated;

-- Notifications are read/updated by the recipient; creation should be server-side.
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (is_read) ON TABLE public.notifications TO authenticated;


-- Profile reads and edits. Membership/role columns are deliberately NOT client-updatable.
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name, full_name, phone_number, birth_date, gender, region, vehicle_number, preferred_days)
    ON TABLE public.profiles TO authenticated;

-- Exchange recipients may update status only; requesters may cancel pending requests by deleting them.
GRANT SELECT, INSERT, DELETE ON TABLE public.shift_exchanges TO authenticated;
GRANT UPDATE (status) ON TABLE public.shift_exchanges TO authenticated;

-- 3) Remove broad profile policies that exposed every row to every role.
DROP POLICY IF EXISTS "profiles 조회" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "본인 profile 수정" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_only" ON public.profiles;

CREATE POLICY "profiles_select_own_only"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY "profiles_update_own_only"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

-- 4) Remove broad organization policies.
-- Direct organization table access is disabled.
-- Organization operations must use protected SECURITY DEFINER RPCs.

DROP POLICY IF EXISTS
    "Allow authenticated users to create organizations"
ON public.organizations;

DROP POLICY IF EXISTS
    "Allow owners to delete organization"
ON public.organizations;

DROP POLICY IF EXISTS
    "Allow owners to update organization"
ON public.organizations;

DROP POLICY IF EXISTS
    "Allow users to view their organization"
ON public.organizations;

DROP POLICY IF EXISTS
    "organizations_select_owner_or_member"
ON public.organizations;

DROP POLICY IF EXISTS
    "organizations_update_owner_only"
ON public.organizations;

DROP POLICY IF EXISTS
    "organizations_owner_select_only"
ON public.organizations;
-- 5) Security-definer membership helper for shift exchanges.
-- Keep the private schema out of the Supabase API's exposed schemas.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.user_belongs_to_organization(
    p_user_id uuid,
    p_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = p_user_id
          AND p.organization_id = p_organization_id
    );
$function$;

REVOKE ALL ON FUNCTION private.user_belongs_to_organization(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.user_belongs_to_organization(uuid, uuid) TO authenticated;

-- 6) Server-side organization membership operations. The caller's user id is always auth.uid().
CREATE OR REPLACE FUNCTION public.create_organization_for_current_user(p_team_name text)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_org uuid;
    v_invite_code text;
    v_org public.organizations%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF nullif(btrim(p_team_name), '') IS NULL THEN
        RAISE EXCEPTION '회사 이름을 입력해주세요.';
    END IF;

    SELECT p.organization_id INTO v_current_org
    FROM public.profiles p
    WHERE p.id = v_user_id;

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
    VALUES (btrim(p_team_name), v_invite_code, v_user_id)
    RETURNING * INTO v_org;

    INSERT INTO public.profiles (id, organization_id)
    VALUES (v_user_id, v_org.id)
    ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

    RETURN v_org;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_organization_by_invite_code(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_org uuid;
    v_org public.organizations%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF nullif(btrim(p_invite_code), '') IS NULL THEN
        RAISE EXCEPTION '초대 코드를 입력해주세요.';
    END IF;

    SELECT * INTO v_org
    FROM public.organizations o
    WHERE o.invite_code = btrim(p_invite_code)
    LIMIT 1;

    IF v_org.id IS NULL THEN
        RAISE EXCEPTION '유효하지 않거나 만료된 초대 링크입니다.';
    END IF;

    SELECT p.organization_id INTO v_current_org
    FROM public.profiles p
    WHERE p.id = v_user_id;

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

-- Return current organization metadata without exposing its invite code to ordinary members.
CREATE OR REPLACE FUNCTION public.get_my_organization_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_org_id uuid;
    v_org public.organizations%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id INTO v_org_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_org_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_org
    FROM public.organizations o
    WHERE o.id = v_org_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

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

-- Safe replacement for cross-member profile lookups: return only the current organization's member id and display name.
-- Use this RPC instead of granting SELECT access to every column in profiles.
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
    SELECT p.id, COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.full_name), ''), '팀원')::text
    FROM public.profiles p
    WHERE p.organization_id = v_org_id
    ORDER BY COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.full_name), ''), '팀원');
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_organization_for_current_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_org_id uuid;
    v_owner_id uuid;
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

    SELECT o.owner_id INTO v_owner_id
    FROM public.organizations o
    WHERE o.id = v_org_id;

    IF v_owner_id = v_user_id THEN
        RAISE EXCEPTION '회사 소유자는 회사를 먼저 삭제하거나 소유권을 이전해야 합니다.';
    END IF;

    UPDATE public.profiles
    SET organization_id = NULL
    WHERE id = v_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_organization_for_current_user(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = p_organization_id
          AND o.owner_id = v_user_id
    ) THEN
        RAISE EXCEPTION '이 회사를 삭제할 권한이 없습니다.';
    END IF;

    DELETE FROM public.shift_exchanges
    WHERE team_id = p_organization_id;

    UPDATE public.posts
    SET organization_id = NULL
    WHERE organization_id = p_organization_id;

    UPDATE public.profiles
    SET organization_id = NULL
    WHERE organization_id = p_organization_id;

    DELETE FROM public.organizations
    WHERE id = p_organization_id
      AND owner_id = v_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_info() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_info() TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_organization_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_members() TO authenticated;

REVOKE ALL ON FUNCTION public.create_organization_for_current_user(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_organization_by_invite_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_organization_for_current_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_organization_for_current_user(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_organization_for_current_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_organization_by_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_organization_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_organization_for_current_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "본인 entries만" ON public.entries;
DROP POLICY IF EXISTS "entries_owner_only" ON public.entries;

CREATE POLICY "entries_owner_only"
ON public.entries
FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));


DROP POLICY IF EXISTS "본인 settings만" ON public.settings;
DROP POLICY IF EXISTS "settings_owner_only" ON public.settings;

CREATE POLICY "settings_owner_only"
ON public.settings
FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));


DROP POLICY IF EXISTS "본인 알림만" ON public.notifications;
DROP POLICY IF EXISTS "본인 알림 수정" ON public.notifications;
DROP POLICY IF EXISTS "notifications_owner_read" ON public.notifications;
DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;

CREATE POLICY "notifications_owner_read"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "notifications_owner_update"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

ALTER TABLE public.shift_exchanges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_exchanges_participant_read" ON public.shift_exchanges;
DROP POLICY IF EXISTS "shift_exchanges_same_org_insert" ON public.shift_exchanges;
DROP POLICY IF EXISTS "shift_exchanges_receiver_status_update" ON public.shift_exchanges;
DROP POLICY IF EXISTS "shift_exchanges_requester_cancel" ON public.shift_exchanges;

CREATE POLICY "shift_exchanges_participant_read"
ON public.shift_exchanges
FOR SELECT
TO authenticated
USING (
    (requester_id = (SELECT auth.uid()) OR receiver_id = (SELECT auth.uid()))
    AND private.user_belongs_to_organization((SELECT auth.uid()), team_id)
);

CREATE POLICY "shift_exchanges_same_org_insert"
ON public.shift_exchanges
FOR INSERT
TO authenticated
WITH CHECK (
    requester_id = (SELECT auth.uid())
    AND private.user_belongs_to_organization(requester_id, team_id)
    AND private.user_belongs_to_organization(receiver_id, team_id)
);

CREATE POLICY "shift_exchanges_receiver_status_update"
ON public.shift_exchanges
FOR UPDATE
TO authenticated
USING (
    receiver_id = (SELECT auth.uid())
    AND private.user_belongs_to_organization((SELECT auth.uid()), team_id)
)
WITH CHECK (
    receiver_id = (SELECT auth.uid())
    AND private.user_belongs_to_organization((SELECT auth.uid()), team_id)
);

CREATE POLICY "shift_exchanges_requester_cancel"
ON public.shift_exchanges
FOR DELETE
TO authenticated
USING (
    requester_id = (SELECT auth.uid())
    AND status = 'pending'
    AND private.user_belongs_to_organization((SELECT auth.uid()), team_id)
);

-- Remove the remaining broad or duplicate notification/profile/organization policies above.
-- Existing public SELECT policies for posts/comments/likes intentionally remain.
-- Run tests for login, profile editing, team creation/join/leave/delete, community, notifications,
-- and shift exchange flows before deploying to production.

COMMIT;
