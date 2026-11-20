-- Step 1: versioned backup and restore for shared administrator workspace data.
-- Only regions, teams, employees and routes are captured. Personal delivery
-- ledgers and personal account settings remain outside this backup system.

BEGIN;

CREATE TABLE IF NOT EXISTS public.organization_admin_state_backups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    source_version integer NOT NULL CHECK (source_version > 0),
    backup_type text NOT NULL CHECK (
        backup_type IN ('baseline', 'automatic', 'manual', 'pre_restore')
    ),
    snapshot_data jsonb NOT NULL CHECK (
        jsonb_typeof(snapshot_data) = 'object'
        AND jsonb_typeof(snapshot_data -> 'regions') = 'array'
        AND jsonb_typeof(snapshot_data -> 'teams') = 'array'
        AND jsonb_typeof(snapshot_data -> 'employees') = 'array'
        AND jsonb_typeof(snapshot_data -> 'routes') = 'array'
    ),
    summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(summary) = 'object'),
    description text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_admin_state_backups_history
    ON public.organization_admin_state_backups (organization_id, created_at DESC);

ALTER TABLE public.organization_admin_state_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.organization_admin_state_backups
    FROM PUBLIC, anon, authenticated;

-- The backup table is intentionally not directly exposed to the browser.
-- Access is provided only through authenticated RPCs that verify organization ownership.

CREATE OR REPLACE FUNCTION public.prune_organization_admin_state_backups(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
    DELETE FROM public.organization_admin_state_backups b
    WHERE b.organization_id = p_organization_id
      AND (
          b.created_at < now() - interval '90 days'
          OR b.id IN (
              SELECT history.id
              FROM public.organization_admin_state_backups history
              WHERE history.organization_id = p_organization_id
              ORDER BY history.created_at DESC, history.id DESC
              OFFSET 50
          )
      );
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_organization_admin_state_backups(uuid)
    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_organization_admin_state_backup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_backup_type text;
    v_snapshot jsonb;
    v_summary jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_snapshot := jsonb_build_object(
            'regions', NEW.regions,
            'teams', NEW.teams,
            'employees', NEW.employees,
            'routes', NEW.routes
        );
        v_summary := jsonb_build_object(
            'regions', jsonb_array_length(NEW.regions),
            'teams', jsonb_array_length(NEW.teams),
            'employees', jsonb_array_length(NEW.employees),
            'routes', jsonb_array_length(NEW.routes)
        );

        INSERT INTO public.organization_admin_state_backups (
            organization_id, source_version, backup_type, snapshot_data,
            summary, description, created_by
        )
        VALUES (
            NEW.organization_id, NEW.version, 'baseline', v_snapshot,
            v_summary, '회사 공용 데이터 최초 저장', auth.uid()
        );

        PERFORM public.prune_organization_admin_state_backups(NEW.organization_id);
        RETURN NEW;
    END IF;

    IF OLD.regions IS DISTINCT FROM NEW.regions
       OR OLD.teams IS DISTINCT FROM NEW.teams
       OR OLD.employees IS DISTINCT FROM NEW.employees
       OR OLD.routes IS DISTINCT FROM NEW.routes THEN
        v_backup_type := COALESCE(
            NULLIF(current_setting('app.organization_admin_backup_type', true), ''),
            'automatic'
        );

        IF v_backup_type NOT IN ('automatic', 'pre_restore') THEN
            v_backup_type := 'automatic';
        END IF;

        v_snapshot := jsonb_build_object(
            'regions', OLD.regions,
            'teams', OLD.teams,
            'employees', OLD.employees,
            'routes', OLD.routes
        );
        v_summary := jsonb_build_object(
            'regions', jsonb_array_length(OLD.regions),
            'teams', jsonb_array_length(OLD.teams),
            'employees', jsonb_array_length(OLD.employees),
            'routes', jsonb_array_length(OLD.routes)
        );

        INSERT INTO public.organization_admin_state_backups (
            organization_id, source_version, backup_type, snapshot_data,
            summary, description, created_by
        )
        VALUES (
            OLD.organization_id,
            OLD.version,
            v_backup_type,
            v_snapshot,
            v_summary,
            CASE
                WHEN v_backup_type = 'pre_restore' THEN '백업 복구 직전 자동 보관'
                ELSE '관리자 데이터 변경 전 자동 보관'
            END,
            auth.uid()
        );

        PERFORM public.prune_organization_admin_state_backups(OLD.organization_id);
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_organization_admin_state_backup()
    FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS organization_admin_state_backup_after_insert
    ON public.organization_admin_state;
CREATE TRIGGER organization_admin_state_backup_after_insert
    AFTER INSERT ON public.organization_admin_state
    FOR EACH ROW
    EXECUTE FUNCTION public.capture_organization_admin_state_backup();

DROP TRIGGER IF EXISTS organization_admin_state_backup_after_update
    ON public.organization_admin_state;
CREATE TRIGGER organization_admin_state_backup_after_update
    AFTER UPDATE OF regions, teams, employees, routes
    ON public.organization_admin_state
    FOR EACH ROW
    EXECUTE FUNCTION public.capture_organization_admin_state_backup();

CREATE OR REPLACE FUNCTION public.list_my_organization_admin_backups()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_result jsonb;
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
        RAISE EXCEPTION '회사 대표 계정만 백업 이력을 조회할 수 있습니다.';
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', history.id,
                'source_version', history.source_version,
                'backup_type', history.backup_type,
                'summary', history.summary,
                'description', history.description,
                'created_by', history.created_by,
                'created_at', history.created_at
            )
            ORDER BY history.created_at DESC, history.id DESC
        ),
        '[]'::jsonb
    )
    INTO v_result
    FROM (
        SELECT b.*
        FROM public.organization_admin_state_backups b
        WHERE b.organization_id = v_organization_id
        ORDER BY b.created_at DESC, b.id DESC
        LIMIT 50
    ) history;

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_organization_admin_backups()
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_admin_backups()
    TO authenticated;

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
        RAISE EXCEPTION '선택한 백업을 찾을 수 없습니다.';
    END IF;

    RETURN jsonb_build_object(
        'id', v_backup.id,
        'source_version', v_backup.source_version,
        'backup_type', v_backup.backup_type,
        'summary', v_backup.summary,
        'description', v_backup.description,
        'created_by', v_backup.created_by,
        'created_at', v_backup.created_at,
        'snapshot', v_backup.snapshot_data
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_admin_backup(uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_admin_backup(uuid)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.create_my_organization_admin_backup(p_description text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_state public.organization_admin_state%ROWTYPE;
    v_snapshot jsonb;
    v_summary jsonb;
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
        RAISE EXCEPTION '회사 대표 계정만 수동 백업을 만들 수 있습니다.';
    END IF;

    SELECT s.*
    INTO v_state
    FROM public.organization_admin_state s
    WHERE s.organization_id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '먼저 회사 공용 데이터를 연결해주세요.';
    END IF;

    v_snapshot := jsonb_build_object(
        'regions', v_state.regions,
        'teams', v_state.teams,
        'employees', v_state.employees,
        'routes', v_state.routes
    );
    v_summary := jsonb_build_object(
        'regions', jsonb_array_length(v_state.regions),
        'teams', jsonb_array_length(v_state.teams),
        'employees', jsonb_array_length(v_state.employees),
        'routes', jsonb_array_length(v_state.routes)
    );

    INSERT INTO public.organization_admin_state_backups (
        organization_id, source_version, backup_type, snapshot_data,
        summary, description, created_by
    )
    VALUES (
        v_organization_id,
        v_state.version,
        'manual',
        v_snapshot,
        v_summary,
        COALESCE(NULLIF(LEFT(BTRIM(p_description), 160), ''), '관리자 수동 백업'),
        v_user_id
    )
    RETURNING * INTO v_backup;

    PERFORM public.prune_organization_admin_state_backups(v_organization_id);

    RETURN jsonb_build_object(
        'id', v_backup.id,
        'source_version', v_backup.source_version,
        'backup_type', v_backup.backup_type,
        'summary', v_backup.summary,
        'description', v_backup.description,
        'created_at', v_backup.created_at
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_my_organization_admin_backup(text)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_organization_admin_backup(text)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_my_organization_admin_backup(p_backup_id uuid)
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
        RAISE EXCEPTION '회사 대표 계정만 데이터를 복구할 수 있습니다.';
    END IF;

    SELECT s.*
    INTO v_state
    FROM public.organization_admin_state s
    WHERE s.organization_id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '복구할 회사 공용 데이터가 없습니다.';
    END IF;

    SELECT b.*
    INTO v_backup
    FROM public.organization_admin_state_backups b
    WHERE b.id = p_backup_id
      AND b.organization_id = v_organization_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '선택한 백업을 찾을 수 없습니다.';
    END IF;

    PERFORM set_config('app.organization_admin_backup_type', 'pre_restore', true);

    UPDATE public.organization_admin_state
    SET regions = v_backup.snapshot_data -> 'regions',
        teams = v_backup.snapshot_data -> 'teams',
        employees = v_backup.snapshot_data -> 'employees',
        routes = v_backup.snapshot_data -> 'routes',
        version = v_state.version + 1,
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

REVOKE ALL ON FUNCTION public.restore_my_organization_admin_backup(uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_my_organization_admin_backup(uuid)
    TO authenticated;

COMMIT;
