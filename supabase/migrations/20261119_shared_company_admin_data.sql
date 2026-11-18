-- Company-shared administrator workspace.
-- Existing local data is intentionally NOT copied automatically. The current
-- organization owner chooses whether to import this device's existing settings.
-- Existing employee and organization role behavior remains unchanged.

BEGIN;

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

CREATE OR REPLACE FUNCTION public.is_current_user_organization_owner(p_organization_id uuid)
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
              AND o.owner_id = auth.uid()
       );
$function$;

REVOKE ALL ON FUNCTION public.is_current_user_organization_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_organization_owner(uuid) TO authenticated;

DROP POLICY IF EXISTS organization_admin_state_select_for_admins
    ON public.organization_admin_state;
DROP POLICY IF EXISTS organization_admin_state_select_for_owner
    ON public.organization_admin_state;
CREATE POLICY organization_admin_state_select_for_owner
    ON public.organization_admin_state
    FOR SELECT
    TO authenticated
    USING (public.is_current_user_organization_owner(organization_id));

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
       OR NOT public.is_current_user_organization_owner(v_organization_id) THEN
        RAISE EXCEPTION '회사 관리자 계정만 공용 운영 데이터를 조회할 수 있습니다.';
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
        RAISE EXCEPTION '회사 운영 데이터가 허용 크기(약 800KB)를 초과했습니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL
       OR NOT public.is_current_user_organization_owner(v_organization_id) THEN
        RAISE EXCEPTION '회사 관리자 계정만 공용 운영 데이터를 수정할 수 있습니다.';
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
        RAISE EXCEPTION '공용 데이터가 다른 기기에서 변경되었습니다. 최신 데이터를 다시 불러온 뒤 다시 시도해주세요.'
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

-- Publish only the shared row. RLS continues to restrict row visibility.
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
