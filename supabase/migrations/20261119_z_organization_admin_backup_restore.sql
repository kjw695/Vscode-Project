-- Phase 1: administrator workspace backup and restore.
-- This migration depends on 20261119_shared_company_admin_data.sql.
-- Backups are immutable snapshots of the complete regions/teams/employees/routes
-- document. No production database is changed until this migration is applied.

BEGIN;

CREATE TABLE IF NOT EXISTS public.organization_admin_state_backups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,
    source_version integer NOT NULL CHECK (source_version > 0),
    backup_type text NOT NULL
        CHECK (backup_type IN ('auto_save', 'manual', 'pre_restore')),
    snapshot jsonb NOT NULL
        CHECK (jsonb_typeof(snapshot) = 'object'),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    restored_from_backup_id uuid
        REFERENCES public.organization_admin_state_backups(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_admin_state_backups_org_created
    ON public.organization_admin_state_backups (organization_id, created_at DESC);

ALTER TABLE public.organization_admin_state_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.organization_admin_state_backups
    FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS organization_admin_state_backups_select_for_owner
    ON public.organization_admin_state_backups;
CREATE POLICY organization_admin_state_backups_select_for_owner
    ON public.organization_admin_state_backups
    FOR SELECT
    TO authenticated
    USING (public.is_current_user_organization_owner(organization_id));

-- Replace the existing save RPC so the previous complete state is copied inside
-- the same transaction before each versioned update.
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

    INSERT INTO public.organization_admin_state_backups (
        organization_id,
        source_version,
        backup_type,
        snapshot,
        created_by
    )
    VALUES (
        v_organization_id,
        v_state.version,
        'auto_save',
        jsonb_build_object(
            'regions', v_state.regions,
            'teams', v_state.teams,
            'employees', v_state.employees,
            'routes', v_state.routes
        ),
        v_user_id
    );

    -- Retain the newest 100 automatic/pre-restore snapshots per company.
    -- Manual snapshots are never removed by this automatic retention rule.
    DELETE FROM public.organization_admin_state_backups b
    WHERE b.organization_id = v_organization_id
      AND b.backup_type IN ('auto_save', 'pre_restore')
      AND b.id NOT IN (
          SELECT recent.id
          FROM public.organization_admin_state_backups recent
          WHERE recent.organization_id = v_organization_id
            AND recent.backup_type IN ('auto_save', 'pre_restore')
          ORDER BY recent.created_at DESC, recent.id DESC
          LIMIT 100
      );

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

CREATE OR REPLACE FUNCTION public.create_my_organization_admin_backup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_state public.organization_admin_state%ROWTYPE;
    v_backup public.organization_admin_state_backups%ROWTYPE;
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
        RAISE EXCEPTION '회사 대표 계정만 백업을 생성할 수 있습니다.';
    END IF;

    SELECT s.*
    INTO v_state
    FROM public.organization_admin_state s
    WHERE s.organization_id = v_organization_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '백업할 회사 공용 데이터가 없습니다.';
    END IF;

    INSERT INTO public.organization_admin_state_backups (
        organization_id, source_version, backup_type, snapshot, created_by
    )
    VALUES (
        v_organization_id,
        v_state.version,
        'manual',
        jsonb_build_object(
            'regions', v_state.regions,
            'teams', v_state.teams,
            'employees', v_state.employees,
            'routes', v_state.routes
        ),
        v_user_id
    )
    RETURNING * INTO v_backup;

    RETURN jsonb_build_object(
        'id', v_backup.id,
        'source_version', v_backup.source_version,
        'backup_type', v_backup.backup_type,
        'created_at', v_backup.created_at
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_my_organization_admin_backup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_organization_admin_backup() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_organization_admin_backups(p_limit integer DEFAULT 50)
RETURNS TABLE (
    id uuid,
    source_version integer,
    backup_type text,
    created_at timestamptz,
    created_by uuid,
    restored_from_backup_id uuid,
    regions_count integer,
    teams_count integer,
    employees_count integer,
    routes_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
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
        RAISE EXCEPTION '회사 대표 계정만 백업 목록을 조회할 수 있습니다.';
    END IF;

    RETURN QUERY
    SELECT
        b.id,
        b.source_version,
        b.backup_type,
        b.created_at,
        b.created_by,
        b.restored_from_backup_id,
        COALESCE(jsonb_array_length(b.snapshot -> 'regions'), 0),
        COALESCE(jsonb_array_length(b.snapshot -> 'teams'), 0),
        COALESCE(jsonb_array_length(b.snapshot -> 'employees'), 0),
        COALESCE(jsonb_array_length(b.snapshot -> 'routes'), 0)
    FROM public.organization_admin_state_backups b
    WHERE b.organization_id = v_organization_id
    ORDER BY b.created_at DESC, b.id DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_organization_admin_backups(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_admin_backups(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_organization_admin_backup(p_backup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_backup public.organization_admin_state_backups%ROWTYPE;
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
        RAISE EXCEPTION '회사 대표 계정만 백업 내용을 조회할 수 있습니다.';
    END IF;

    SELECT b.*
    INTO v_backup
    FROM public.organization_admin_state_backups b
    WHERE b.id = p_backup_id
      AND b.organization_id = v_organization_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '해당 백업을 찾을 수 없습니다.';
    END IF;

    RETURN jsonb_build_object(
        'id', v_backup.id,
        'source_version', v_backup.source_version,
        'backup_type', v_backup.backup_type,
        'created_at', v_backup.created_at,
        'created_by', v_backup.created_by,
        'restored_from_backup_id', v_backup.restored_from_backup_id,
        'snapshot', v_backup.snapshot
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_admin_backup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_admin_backup(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_my_organization_admin_backup(
    p_backup_id uuid,
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
    v_backup public.organization_admin_state_backups%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_backup_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1 THEN
        RAISE EXCEPTION '복구 요청 정보가 올바르지 않습니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL
       OR NOT public.is_current_user_organization_owner(v_organization_id) THEN
        RAISE EXCEPTION '회사 대표 계정만 데이터를 복구할 수 있습니다.';
    END IF;

    SELECT s.*
    INTO v_state
    FROM public.organization_admin_state s
    WHERE s.organization_id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND OR v_state.version <> p_expected_version THEN
        RAISE EXCEPTION '현재 데이터가 다른 기기에서 변경되었습니다. 최신 데이터를 다시 불러온 뒤 복구를 다시 시도해주세요.'
            USING ERRCODE = '40001';
    END IF;

    SELECT b.*
    INTO v_backup
    FROM public.organization_admin_state_backups b
    WHERE b.id = p_backup_id
      AND b.organization_id = v_organization_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '해당 백업을 찾을 수 없거나 다른 회사의 백업입니다.';
    END IF;

    -- Preserve the state being replaced so the restore can itself be undone.
    INSERT INTO public.organization_admin_state_backups (
        organization_id,
        source_version,
        backup_type,
        snapshot,
        created_by,
        restored_from_backup_id
    )
    VALUES (
        v_organization_id,
        v_state.version,
        'pre_restore',
        jsonb_build_object(
            'regions', v_state.regions,
            'teams', v_state.teams,
            'employees', v_state.employees,
            'routes', v_state.routes
        ),
        v_user_id,
        p_backup_id
    );

    UPDATE public.organization_admin_state
    SET regions = COALESCE(v_backup.snapshot -> 'regions', '[]'::jsonb),
        teams = COALESCE(v_backup.snapshot -> 'teams', '[]'::jsonb),
        employees = COALESCE(v_backup.snapshot -> 'employees', '[]'::jsonb),
        routes = COALESCE(v_backup.snapshot -> 'routes', '[]'::jsonb),
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
        'updated_at', v_state.updated_at,
        'restored_from_backup_id', p_backup_id
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_my_organization_admin_backup(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_my_organization_admin_backup(uuid, integer) TO authenticated;

COMMIT;
