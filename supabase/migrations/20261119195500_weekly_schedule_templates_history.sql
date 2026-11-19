-- Step 2: shared schedule templates and versioned weekly schedule history.
-- Draft and confirmed schedules remain hidden from employee accounts according to
-- the existing list_my_organization_weekly_schedules RPC behavior.

BEGIN;

CREATE TABLE IF NOT EXISTS public.organization_weekly_schedule_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id text NOT NULL,
    team_label text NOT NULL DEFAULT '',
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
    source_week_start date,
    schedule jsonb NOT NULL CHECK (jsonb_typeof(schedule) = 'object'),
    employee_details jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(employee_details) = 'object'),
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(warnings) = 'array'),
    created_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organization_weekly_schedule_templates_unique_name
        UNIQUE (organization_id, team_id, name)
);

CREATE INDEX IF NOT EXISTS organization_weekly_schedule_templates_lookup_idx
    ON public.organization_weekly_schedule_templates
       (organization_id, team_id, updated_at DESC);

ALTER TABLE public.organization_weekly_schedule_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.organization_weekly_schedule_templates
    FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.organization_weekly_schedule_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id uuid NOT NULL
        REFERENCES public.organization_weekly_schedules(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id text NOT NULL,
    team_label text NOT NULL DEFAULT '',
    week_start date NOT NULL,
    week_end date NOT NULL,
    source_version integer NOT NULL CHECK (source_version > 0),
    status text NOT NULL CHECK (status IN ('draft', 'confirmed')),
    snapshot_data jsonb NOT NULL CHECK (
        jsonb_typeof(snapshot_data) = 'object'
        AND jsonb_typeof(snapshot_data -> 'schedule') = 'object'
        AND jsonb_typeof(snapshot_data -> 'employee_details') = 'object'
        AND jsonb_typeof(snapshot_data -> 'warnings') = 'array'
    ),
    revision_type text NOT NULL CHECK (revision_type IN ('baseline', 'update')),
    captured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_weekly_schedule_revisions_history_idx
    ON public.organization_weekly_schedule_revisions
       (organization_id, team_id, week_start, captured_at DESC);

ALTER TABLE public.organization_weekly_schedule_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.organization_weekly_schedule_revisions
    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_organization_weekly_schedule_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_snapshot jsonb;
    v_revision_type text;
    v_schedule_id uuid;
    v_org_id uuid;
    v_team_id text;
    v_team_label text;
    v_week_start date;
    v_week_end date;
    v_version integer;
    v_status text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_revision_type := 'baseline';
        v_schedule_id := NEW.id;
        v_org_id := NEW.organization_id;
        v_team_id := NEW.team_id;
        v_team_label := NEW.team_label;
        v_week_start := NEW.week_start;
        v_week_end := NEW.week_end;
        v_version := NEW.version;
        v_status := NEW.status;
        v_snapshot := jsonb_build_object(
            'schedule', NEW.schedule,
            'employee_details', NEW.employee_details,
            'warnings', NEW.warnings,
            'status', NEW.status,
            'confirmed_at', NEW.confirmed_at
        );
    ELSE
        IF OLD.schedule IS NOT DISTINCT FROM NEW.schedule
           AND OLD.employee_details IS NOT DISTINCT FROM NEW.employee_details
           AND OLD.warnings IS NOT DISTINCT FROM NEW.warnings
           AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
            RETURN NEW;
        END IF;

        v_revision_type := 'update';
        v_schedule_id := OLD.id;
        v_org_id := OLD.organization_id;
        v_team_id := OLD.team_id;
        v_team_label := OLD.team_label;
        v_week_start := OLD.week_start;
        v_week_end := OLD.week_end;
        v_version := OLD.version;
        v_status := OLD.status;
        v_snapshot := jsonb_build_object(
            'schedule', OLD.schedule,
            'employee_details', OLD.employee_details,
            'warnings', OLD.warnings,
            'status', OLD.status,
            'confirmed_at', OLD.confirmed_at
        );
    END IF;

    INSERT INTO public.organization_weekly_schedule_revisions (
        schedule_id, organization_id, team_id, team_label, week_start, week_end,
        source_version, status, snapshot_data, revision_type, captured_by
    )
    VALUES (
        v_schedule_id, v_org_id, v_team_id, v_team_label, v_week_start, v_week_end,
        v_version, v_status, v_snapshot, v_revision_type, auth.uid()
    );

    DELETE FROM public.organization_weekly_schedule_revisions r
    WHERE r.schedule_id = v_schedule_id
      AND (
          r.captured_at < now() - interval '365 days'
          OR r.id IN (
              SELECT history.id
              FROM public.organization_weekly_schedule_revisions history
              WHERE history.schedule_id = v_schedule_id
              ORDER BY history.captured_at DESC, history.id DESC
              OFFSET 100
          )
      );

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_organization_weekly_schedule_revision()
    FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS organization_weekly_schedule_revision_after_insert
    ON public.organization_weekly_schedules;
CREATE TRIGGER organization_weekly_schedule_revision_after_insert
    AFTER INSERT ON public.organization_weekly_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.capture_organization_weekly_schedule_revision();

DROP TRIGGER IF EXISTS organization_weekly_schedule_revision_after_update
    ON public.organization_weekly_schedules;
CREATE TRIGGER organization_weekly_schedule_revision_after_update
    AFTER UPDATE OF schedule, employee_details, warnings, status
    ON public.organization_weekly_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.capture_organization_weekly_schedule_revision();

CREATE OR REPLACE FUNCTION public.list_my_organization_schedule_templates(p_team_id text)
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
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id
      AND o.owner_id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사 대표 계정만 근무표 템플릿을 조회할 수 있습니다.';
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'team_id', t.team_id,
                'team_label', t.team_label,
                'name', t.name,
                'source_week_start', t.source_week_start,
                'updated_at', t.updated_at
            )
            ORDER BY t.updated_at DESC, t.name
        ),
        '[]'::jsonb
    )
    INTO v_result
    FROM public.organization_weekly_schedule_templates t
    WHERE t.organization_id = v_organization_id
      AND (p_team_id IS NULL OR t.team_id = p_team_id);

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_organization_schedule_templates(text)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_schedule_templates(text)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_organization_schedule_template(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_template public.organization_weekly_schedule_templates%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id
      AND o.owner_id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사 대표 계정만 근무표 템플릿을 조회할 수 있습니다.';
    END IF;

    SELECT t.*
    INTO v_template
    FROM public.organization_weekly_schedule_templates t
    WHERE t.id = p_template_id
      AND t.organization_id = v_organization_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '선택한 템플릿을 찾을 수 없습니다.';
    END IF;

    RETURN jsonb_build_object(
        'id', v_template.id,
        'team_id', v_template.team_id,
        'team_label', v_template.team_label,
        'name', v_template.name,
        'source_week_start', v_template.source_week_start,
        'schedule', v_template.schedule,
        'employee_details', v_template.employee_details,
        'warnings', v_template.warnings,
        'updated_at', v_template.updated_at
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_schedule_template(uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_schedule_template(uuid)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.save_my_organization_schedule_template(
    p_team_id text,
    p_team_label text,
    p_name text,
    p_source_week_start date,
    p_schedule jsonb,
    p_employee_details jsonb,
    p_warnings jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_template public.organization_weekly_schedule_templates%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_team_id IS NULL OR btrim(p_team_id) = ''
       OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 80
       OR p_schedule IS NULL OR jsonb_typeof(p_schedule) <> 'object'
       OR p_employee_details IS NULL OR jsonb_typeof(p_employee_details) <> 'object'
       OR p_warnings IS NULL OR jsonb_typeof(p_warnings) <> 'array' THEN
        RAISE EXCEPTION '템플릿 정보가 올바르지 않습니다.';
    END IF;

    IF pg_column_size(p_schedule) + pg_column_size(p_employee_details)
       + pg_column_size(p_warnings) > 300000 THEN
        RAISE EXCEPTION '템플릿 데이터가 허용 크기를 초과했습니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id
      AND o.owner_id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사 대표 계정만 근무표 템플릿을 저장할 수 있습니다.';
    END IF;

    INSERT INTO public.organization_weekly_schedule_templates (
        organization_id, team_id, team_label, name, source_week_start,
        schedule, employee_details, warnings, created_by, updated_at
    )
    VALUES (
        v_organization_id, btrim(p_team_id),
        COALESCE(NULLIF(btrim(p_team_label), ''), btrim(p_team_id)),
        btrim(p_name), p_source_week_start,
        p_schedule, p_employee_details, p_warnings, v_user_id, now()
    )
    ON CONFLICT ON CONSTRAINT organization_weekly_schedule_templates_unique_name
    DO UPDATE SET
        team_label = EXCLUDED.team_label,
        source_week_start = EXCLUDED.source_week_start,
        schedule = EXCLUDED.schedule,
        employee_details = EXCLUDED.employee_details,
        warnings = EXCLUDED.warnings,
        updated_at = now()
    RETURNING * INTO v_template;

    RETURN jsonb_build_object(
        'id', v_template.id,
        'team_id', v_template.team_id,
        'team_label', v_template.team_label,
        'name', v_template.name,
        'source_week_start', v_template.source_week_start,
        'updated_at', v_template.updated_at
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_my_organization_schedule_template(text, text, text, date, jsonb, jsonb, jsonb)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_organization_schedule_template(text, text, text, date, jsonb, jsonb, jsonb)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_organization_schedule_template(p_template_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_deleted integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id
      AND o.owner_id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사 대표 계정만 근무표 템플릿을 삭제할 수 있습니다.';
    END IF;

    DELETE FROM public.organization_weekly_schedule_templates t
    WHERE t.id = p_template_id
      AND t.organization_id = v_organization_id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_my_organization_schedule_template(uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_organization_schedule_template(uuid)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_organization_weekly_schedule_revisions(
    p_team_id text,
    p_week_start date
)
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
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id
      AND o.owner_id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사 대표 계정만 근무표 변경 이력을 조회할 수 있습니다.';
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', r.id,
                'source_version', r.source_version,
                'status', r.status,
                'revision_type', r.revision_type,
                'captured_by', r.captured_by,
                'captured_at', r.captured_at
            )
            ORDER BY r.captured_at DESC, r.id DESC
        ),
        '[]'::jsonb
    )
    INTO v_result
    FROM (
        SELECT history.*
        FROM public.organization_weekly_schedule_revisions history
        WHERE history.organization_id = v_organization_id
          AND history.team_id = p_team_id
          AND history.week_start = p_week_start
        ORDER BY history.captured_at DESC, history.id DESC
        LIMIT 50
    ) r;

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_organization_weekly_schedule_revisions(text, date)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_weekly_schedule_revisions(text, date)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_organization_weekly_schedule_revision(p_revision_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_revision public.organization_weekly_schedule_revisions%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id
      AND o.owner_id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사 대표 계정만 근무표 이력을 조회할 수 있습니다.';
    END IF;

    SELECT r.*
    INTO v_revision
    FROM public.organization_weekly_schedule_revisions r
    WHERE r.id = p_revision_id
      AND r.organization_id = v_organization_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '선택한 근무표 이력을 찾을 수 없습니다.';
    END IF;

    RETURN jsonb_build_object(
        'id', v_revision.id,
        'team_id', v_revision.team_id,
        'team_label', v_revision.team_label,
        'week_start', v_revision.week_start,
        'week_end', v_revision.week_end,
        'source_version', v_revision.source_version,
        'status', v_revision.status,
        'revision_type', v_revision.revision_type,
        'captured_at', v_revision.captured_at,
        'snapshot', v_revision.snapshot_data
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_weekly_schedule_revision(uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_weekly_schedule_revision(uuid)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_my_organization_weekly_schedule_revision(p_revision_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_revision public.organization_weekly_schedule_revisions%ROWTYPE;
    v_current public.organization_weekly_schedules%ROWTYPE;
    v_restored public.organization_weekly_schedules%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id
      AND o.owner_id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사 대표 계정만 근무표를 복구할 수 있습니다.';
    END IF;

    SELECT r.*
    INTO v_revision
    FROM public.organization_weekly_schedule_revisions r
    WHERE r.id = p_revision_id
      AND r.organization_id = v_organization_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '선택한 근무표 이력을 찾을 수 없습니다.';
    END IF;

    SELECT s.*
    INTO v_current
    FROM public.organization_weekly_schedules s
    WHERE s.id = v_revision.schedule_id
      AND s.organization_id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '현재 근무표가 없어 이력을 복구할 수 없습니다.';
    END IF;

    UPDATE public.organization_weekly_schedules
    SET status = v_revision.snapshot_data ->> 'status',
        schedule = v_revision.snapshot_data -> 'schedule',
        employee_details = v_revision.snapshot_data -> 'employee_details',
        warnings = v_revision.snapshot_data -> 'warnings',
        version = v_current.version + 1,
        updated_by = v_user_id,
        confirmed_at = CASE
            WHEN v_revision.snapshot_data ->> 'status' = 'confirmed' THEN now()
            ELSE NULL
        END,
        updated_at = now()
    WHERE id = v_current.id
    RETURNING * INTO v_restored;

    RETURN jsonb_build_object(
        'id', v_restored.id,
        'team_id', v_restored.team_id,
        'team_label', v_restored.team_label,
        'week_start', v_restored.week_start,
        'week_end', v_restored.week_end,
        'status', v_restored.status,
        'version', v_restored.version,
        'confirmed_at', v_restored.confirmed_at,
        'updated_at', v_restored.updated_at,
        'schedule', v_restored.schedule,
        'employee_details', v_restored.employee_details,
        'warnings', v_restored.warnings
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_my_organization_weekly_schedule_revision(uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_my_organization_weekly_schedule_revision(uuid)
    TO authenticated;

COMMIT;
