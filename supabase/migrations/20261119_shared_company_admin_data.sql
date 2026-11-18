-- Shared company admin state, delegated administrator seats, and role-gated operations.
-- Existing local data is intentionally NOT copied automatically. The owner imports it
-- from the current device after reviewing it in the app.

BEGIN;

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS included_admin_seats integer NOT NULL DEFAULT 1;

DO $constraint$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organizations_included_admin_seats_nonnegative'
          AND conrelid = 'public.organizations'::regclass
    ) THEN
        ALTER TABLE public.organizations
            ADD CONSTRAINT organizations_included_admin_seats_nonnegative
            CHECK (included_admin_seats >= 0);
    END IF;
END;
$constraint$;

CREATE TABLE IF NOT EXISTS public.organization_admins (
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    granted_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, user_id)
);

ALTER TABLE public.organization_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.organization_admins FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.organization_admin_seat_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    quantity integer NOT NULL CHECK (quantity > 0),
    provider text NOT NULL CHECK (provider IN ('google_play', 'app_store', 'web', 'manual')),
    product_id text NOT NULL,
    order_reference text,
    transaction_reference text,
    amount_krw bigint CHECK (amount_krw IS NULL OR amount_krw >= 0),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
    created_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_admin_seat_purchase_order_uidx
    ON public.organization_admin_seat_purchases(provider, order_reference)
    WHERE order_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS organization_admin_seat_purchase_paid_idx
    ON public.organization_admin_seat_purchases(organization_id, status)
    WHERE status = 'paid';

ALTER TABLE public.organization_admin_seat_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.organization_admin_seat_purchases FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.organization_admin_state (
    organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    regions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(regions) = 'array'),
    teams jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(teams) = 'array'),
    employees jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(employees) = 'array'),
    routes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(routes) = 'array'),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    updated_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_admin_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.organization_admin_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.organization_admin_state TO authenticated;

CREATE OR REPLACE FUNCTION public.is_current_user_organization_admin(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM public.profiles p
            JOIN public.organizations o ON o.id = p.organization_id
            WHERE p.id = auth.uid()
              AND p.organization_id = p_organization_id
              AND (
                  o.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.organization_admins a
                      WHERE a.organization_id = p_organization_id
                        AND a.user_id = auth.uid()
                  )
              )
       );
$function$;

REVOKE ALL ON FUNCTION public.is_current_user_organization_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_organization_admin(uuid) TO authenticated;

CREATE POLICY organization_admin_state_select_for_admins
    ON public.organization_admin_state
    FOR SELECT
    TO authenticated
    USING (public.is_current_user_organization_admin(organization_id));

CREATE OR REPLACE FUNCTION public.get_my_organization_admin_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_state public.organization_admin_state%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL
       OR NOT public.is_current_user_organization_admin(v_organization_id) THEN
        RAISE EXCEPTION '회사 관리자만 공용 운영 데이터를 조회할 수 있습니다.';
    END IF;

    SELECT s.*
    INTO v_state
    FROM public.organization_admin_state s
    WHERE s.organization_id = v_organization_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'organization_id', v_state.organization_id,
        'regions', v_state.regions,
        'teams', v_state.teams,
        'employees', v_state.employees,
        'routes', v_state.routes,
        'version', v_state.version,
        'updated_by', v_state.updated_by,
        'updated_at', v_state.updated_at
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_admin_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_admin_state() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_my_organization_admin_state(
    p_regions jsonb,
    p_teams jsonb,
    p_employees jsonb,
    p_routes jsonb,
    p_expected_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_state public.organization_admin_state%ROWTYPE;
    v_inserted integer := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_expected_version IS NULL OR p_expected_version < 0 THEN
        RAISE EXCEPTION '공용 데이터 버전이 올바르지 않습니다.';
    END IF;

    IF jsonb_typeof(p_regions) IS DISTINCT FROM 'array'
       OR jsonb_typeof(p_teams) IS DISTINCT FROM 'array'
       OR jsonb_typeof(p_employees) IS DISTINCT FROM 'array'
       OR jsonb_typeof(p_routes) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION '회사 운영 데이터 형식이 올바르지 않습니다.';
    END IF;

    IF pg_column_size(p_regions) + pg_column_size(p_teams)
       + pg_column_size(p_employees) + pg_column_size(p_routes) > 800000 THEN
        RAISE EXCEPTION '회사 운영 데이터가 허용 크기(약 4MB)를 초과했습니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL
       OR NOT public.is_current_user_organization_admin(v_organization_id) THEN
        RAISE EXCEPTION '회사 관리자만 공용 운영 데이터를 수정할 수 있습니다.';
    END IF;

    -- Only the owner may initialize shared state. Delegated admins may edit it afterwards.
    IF p_expected_version = 0
       AND NOT EXISTS (
            SELECT 1
            FROM public.organizations o
            WHERE o.id = v_organization_id
              AND o.owner_id = v_user_id
       ) THEN
        RAISE EXCEPTION '회사 대표 관리자가 최초 공용 데이터를 연결해야 합니다.';
    END IF;

    INSERT INTO public.organization_admin_state (
        organization_id, regions, teams, employees, routes, version, updated_by
    )
    VALUES (
        v_organization_id, p_regions, p_teams, p_employees, p_routes, 1, v_user_id
    )
    ON CONFLICT (organization_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted = 1 THEN
        SELECT s.*
        INTO v_state
        FROM public.organization_admin_state s
        WHERE s.organization_id = v_organization_id;

        RETURN jsonb_build_object(
            'organization_id', v_state.organization_id,
            'regions', v_state.regions,
            'teams', v_state.teams,
            'employees', v_state.employees,
            'routes', v_state.routes,
            'version', v_state.version,
            'updated_by', v_state.updated_by,
            'updated_at', v_state.updated_at
        );
    END IF;

    SELECT s.*
    INTO v_state
    FROM public.organization_admin_state s
    WHERE s.organization_id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND OR v_state.version <> p_expected_version THEN
        RAISE EXCEPTION '공용 데이터가 다른 관리자에 의해 변경되었습니다. 최신 데이터를 다시 불러왔습니다. 변경 사항을 확인한 뒤 다시 시도해주세요.'
            USING ERRCODE = '40001';
    END IF;

    UPDATE public.organization_admin_state
    SET regions = p_regions,
        teams = p_teams,
        employees = p_employees,
        routes = p_routes,
        version = version + 1,
        updated_by = v_user_id,
        updated_at = now()
    WHERE organization_id = v_organization_id
    RETURNING * INTO v_state;

    RETURN jsonb_build_object(
        'organization_id', v_state.organization_id,
        'regions', v_state.regions,
        'teams', v_state.teams,
        'employees', v_state.employees,
        'routes', v_state.routes,
        'version', v_state.version,
        'updated_by', v_state.updated_by,
        'updated_at', v_state.updated_at
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_my_organization_admin_state(jsonb, jsonb, jsonb, jsonb, integer)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_organization_admin_state(jsonb, jsonb, jsonb, jsonb, integer)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_organization_admin_management()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_owner_id uuid;
    v_included_seats integer;
    v_purchased_seats integer := 0;
    v_used_seats integer := 0;
    v_members jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id, o.owner_id, o.included_admin_seats
    INTO v_organization_id, v_owner_id, v_included_seats
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL OR v_owner_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION '대표 관리자만 일반 관리자와 관리자 정원을 관리할 수 있습니다.';
    END IF;

    SELECT COALESCE(sum(s.quantity), 0)::integer
    INTO v_purchased_seats
    FROM public.organization_admin_seat_purchases s
    WHERE s.organization_id = v_organization_id
      AND s.status = 'paid';

    SELECT count(*)::integer
    INTO v_used_seats
    FROM public.organization_admins a
    WHERE a.organization_id = v_organization_id;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'user_id', p.id,
                'display_name', COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.full_name), ''), '이름 미등록'),
                'is_admin', (a.user_id IS NOT NULL)
            )
            ORDER BY COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.full_name), ''), '이름 미등록'), p.id
        ),
        '[]'::jsonb
    )
    INTO v_members
    FROM public.profiles p
    LEFT JOIN public.organization_admins a
      ON a.organization_id = v_organization_id
     AND a.user_id = p.id
    WHERE p.organization_id = v_organization_id
      AND p.id <> v_owner_id;

    RETURN jsonb_build_object(
        'members', v_members,
        'used_admin_seats', v_used_seats,
        'included_admin_seats', v_included_seats,
        'purchased_admin_seats', v_purchased_seats,
        'total_admin_seats', v_included_seats + v_purchased_seats,
        'remaining_admin_seats', GREATEST(v_included_seats + v_purchased_seats - v_used_seats, 0)
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_admin_management() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_admin_management() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_organization_admin_role(
    p_member_id uuid,
    p_make_admin boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_owner_id uuid;
    v_included_seats integer;
    v_purchased_seats integer := 0;
    v_used_seats integer := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;
    IF p_member_id IS NULL OR p_make_admin IS NULL THEN
        RAISE EXCEPTION '관리자 지정 정보를 확인해주세요.';
    END IF;

    SELECT p.organization_id, o.owner_id, o.included_admin_seats
    INTO v_organization_id, v_owner_id, v_included_seats
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id
    FOR UPDATE OF o;

    IF v_organization_id IS NULL OR v_owner_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION '대표 관리자만 일반 관리자 지정 권한이 있습니다.';
    END IF;

    IF p_member_id = v_owner_id OR NOT EXISTS (
        SELECT 1 FROM public.profiles m
        WHERE m.id = p_member_id
          AND m.organization_id = v_organization_id
    ) THEN
        RAISE EXCEPTION '현재 회사에 소속된 직원을 선택해주세요.';
    END IF;

    IF NOT p_make_admin THEN
        DELETE FROM public.organization_admins
        WHERE organization_id = v_organization_id
          AND user_id = p_member_id;

        RETURN jsonb_build_object('is_admin', false);
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.organization_admins a
        WHERE a.organization_id = v_organization_id
          AND a.user_id = p_member_id
    ) THEN
        RETURN jsonb_build_object('is_admin', true, 'already_admin', true);
    END IF;

    SELECT COALESCE(sum(s.quantity), 0)::integer
    INTO v_purchased_seats
    FROM public.organization_admin_seat_purchases s
    WHERE s.organization_id = v_organization_id
      AND s.status = 'paid';

    SELECT count(*)::integer
    INTO v_used_seats
    FROM public.organization_admins a
    WHERE a.organization_id = v_organization_id;

    IF v_used_seats >= v_included_seats + v_purchased_seats THEN
        RAISE EXCEPTION '일반 관리자 정원이 부족합니다. 추가 관리자 정원을 구매한 뒤 다시 지정해주세요.';
    END IF;

    INSERT INTO public.organization_admins (organization_id, user_id, granted_by)
    VALUES (v_organization_id, p_member_id, v_user_id);

    RETURN jsonb_build_object('is_admin', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_my_organization_admin_role(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_organization_admin_role(uuid, boolean) TO authenticated;

-- When an account leaves or changes companies, its former administrator assignment is revoked.
CREATE OR REPLACE FUNCTION public.remove_organization_admin_on_profile_org_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
    IF OLD.organization_id IS DISTINCT FROM NEW.organization_id
       AND OLD.organization_id IS NOT NULL THEN
        DELETE FROM public.organization_admins
        WHERE organization_id = OLD.organization_id
          AND user_id = OLD.id;
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_organization_admin_on_profile_org_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_revoke_admin_role_on_org_change ON public.profiles;
CREATE TRIGGER profiles_revoke_admin_role_on_org_change
AFTER UPDATE OF organization_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.remove_organization_admin_on_profile_org_change();

-- Include the current organization's role in the existing company-info RPC.
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
    v_role text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id
    INTO v_org_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_org_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT *
    INTO v_org
    FROM public.organizations o
    WHERE o.id = v_org_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_role := CASE
        WHEN v_org.owner_id = v_user_id THEN 'owner'
        WHEN EXISTS (
            SELECT 1 FROM public.organization_admins a
            WHERE a.organization_id = v_org.id
              AND a.user_id = v_user_id
        ) THEN 'admin'
        ELSE 'member'
    END;

    RETURN jsonb_build_object(
        'id', v_org.id,
        'name', v_org.name,
        'owner_id', v_org.owner_id,
        'organization_role', v_role,
        'invite_code',
            CASE
                WHEN v_org.owner_id = v_user_id
                THEN v_org.invite_code
                ELSE NULL
            END,
        'assignment_deadline_day', v_org.assignment_deadline_day,
        'assignment_deadline_time', v_org.assignment_deadline_time
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_info() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_info() TO authenticated;

-- General administrators can read and edit complete company schedules, just like the owner.
DO $migration$
DECLARE
    v_definition text;
    v_original text;
BEGIN
    SELECT pg_get_functiondef(
        'public.save_my_organization_weekly_schedule(text,text,date,date,text,jsonb,jsonb,jsonb)'::regprocedure
    ) INTO v_definition;
    v_original := v_definition;
    v_definition := replace(
        v_definition,
        'AND o.owner_id = v_user_id',
        'AND public.is_current_user_organization_admin(o.id)'
    );
    IF v_definition = v_original THEN
        RAISE EXCEPTION 'save_my_organization_weekly_schedule 권한 조건을 찾지 못했습니다.';
    END IF;
    EXECUTE v_definition;

    SELECT pg_get_functiondef(
        'public.list_my_organization_weekly_schedules(date,date)'::regprocedure
    ) INTO v_definition;
    v_original := v_definition;
    v_definition := replace(v_definition, 'v_is_owner', 'v_is_admin');
    v_definition := replace(
        v_definition,
        'AND o.owner_id = v_user_id',
        'AND public.is_current_user_organization_admin(o.id)'
    );
    IF v_definition = v_original
       OR position('v_is_owner' in v_definition) > 0
       OR position('o.owner_id = v_user_id' in v_definition) > 0
       OR position('public.is_current_user_organization_admin(o.id)' in v_definition) = 0 THEN
        RAISE EXCEPTION 'list_my_organization_weekly_schedules 권한 조건을 변경하지 못했습니다.';
    END IF;
    EXECUTE v_definition;

    SELECT pg_get_functiondef(
        'public.list_pending_organization_extra_day_off_requests(text)'::regprocedure
    ) INTO v_definition;
    v_original := v_definition;
    v_definition := replace(
        v_definition,
        'AND o.owner_id = v_user_id;',
        'AND public.is_current_user_organization_admin(o.id);'
    );
    IF v_definition = v_original THEN
        RAISE EXCEPTION 'list_pending_organization_extra_day_off_requests 권한 조건을 찾지 못했습니다.';
    END IF;
    EXECUTE v_definition;

    SELECT pg_get_functiondef(
        'public.respond_to_extra_day_off_request(uuid,text)'::regprocedure
    ) INTO v_definition;
    v_original := v_definition;
    v_definition := replace(
        v_definition,
        'AND o.owner_id = v_user_id;',
        'AND public.is_current_user_organization_admin(o.id);'
    );
    IF v_definition = v_original THEN
        RAISE EXCEPTION 'respond_to_extra_day_off_request 권한 조건을 찾지 못했습니다.';
    END IF;
    EXECUTE v_definition;
END;
$migration$;

-- Realtime publishes only the shared-state row; row visibility is still controlled by RLS.
DO $publication$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'organization_admin_state'
       ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_admin_state;
    END IF;
END;
$publication$;

COMMIT;
