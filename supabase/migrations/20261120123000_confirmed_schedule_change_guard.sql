-- Protect confirmed weekly schedules with reasoned, employee-visible audit records.
-- Extends the existing organization_weekly_schedule_revisions table; no duplicate
-- schedule history or template tables are introduced.

BEGIN;

ALTER TABLE public.organization_weekly_schedule_revisions
    ADD COLUMN IF NOT EXISTS after_snapshot jsonb,
    ADD COLUMN IF NOT EXISTS result_version integer,
    ADD COLUMN IF NOT EXISTS change_type text,
    ADD COLUMN IF NOT EXISTS change_reason text,
    ADD COLUMN IF NOT EXISTS restored_from_revision_id uuid
        REFERENCES public.organization_weekly_schedule_revisions(id) ON DELETE SET NULL;

UPDATE public.organization_weekly_schedule_revisions
SET after_snapshot = COALESCE(after_snapshot, snapshot_data),
    result_version = COALESCE(result_version, source_version),
    change_type = COALESCE(
        change_type,
        CASE WHEN revision_type = 'baseline' THEN 'baseline' ELSE 'updated' END
    );

ALTER TABLE public.organization_weekly_schedule_revisions
    ALTER COLUMN result_version SET NOT NULL,
    ALTER COLUMN change_type SET NOT NULL;

ALTER TABLE public.organization_weekly_schedule_revisions
    DROP CONSTRAINT IF EXISTS organization_weekly_schedule_revisions_change_type_check;

ALTER TABLE public.organization_weekly_schedule_revisions
    ADD CONSTRAINT organization_weekly_schedule_revisions_change_type_check
    CHECK (change_type IN (
        'baseline', 'draft_saved', 'confirmed', 'reopened',
        'admin_changed', 'request_approved', 'restored', 'updated'
    ));

CREATE OR REPLACE FUNCTION public.guard_confirmed_organization_weekly_schedule_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_reason text;
BEGIN
    IF OLD.status = 'confirmed'
       AND (
           OLD.status IS DISTINCT FROM NEW.status
           OR OLD.team_label IS DISTINCT FROM NEW.team_label
           OR OLD.week_end IS DISTINCT FROM NEW.week_end
           OR OLD.schedule IS DISTINCT FROM NEW.schedule
           OR OLD.employee_details IS DISTINCT FROM NEW.employee_details
           OR OLD.warnings IS DISTINCT FROM NEW.warnings
       ) THEN
        v_reason := NULLIF(left(btrim(current_setting('app.schedule_change_reason', true)), 300), '');
    v_requested_change_type := NULLIF(current_setting('app.schedule_change_type', true), '');
        IF v_reason IS NULL THEN
            RAISE EXCEPTION '확정된 근무표를 변경하려면 변경 사유를 입력해주세요.';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_confirmed_organization_weekly_schedule_change()
    FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS organization_weekly_schedule_confirmed_change_guard
    ON public.organization_weekly_schedules;

CREATE TRIGGER organization_weekly_schedule_confirmed_change_guard
BEFORE UPDATE ON public.organization_weekly_schedules
FOR EACH ROW
EXECUTE FUNCTION public.guard_confirmed_organization_weekly_schedule_change();

CREATE OR REPLACE FUNCTION public.capture_organization_weekly_schedule_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_before_snapshot jsonb;
    v_after_snapshot jsonb;
    v_revision_type text;
    v_change_type text;
    v_requested_change_type text;
    v_reason text;
    v_restore_id uuid;
    v_schedule_id uuid;
    v_org_id uuid;
    v_team_id text;
    v_team_label text;
    v_week_start date;
    v_week_end date;
    v_source_version integer;
    v_result_version integer;
    v_status text;
BEGIN
    v_reason := NULLIF(left(btrim(current_setting('app.schedule_change_reason', true)), 300), '');

    BEGIN
        v_restore_id := NULLIF(current_setting('app.schedule_restore_revision_id', true), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        v_restore_id := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        v_revision_type := 'baseline';
        v_change_type := CASE WHEN NEW.status = 'confirmed' THEN 'confirmed' ELSE 'baseline' END;
        v_schedule_id := NEW.id;
        v_org_id := NEW.organization_id;
        v_team_id := NEW.team_id;
        v_team_label := NEW.team_label;
        v_week_start := NEW.week_start;
        v_week_end := NEW.week_end;
        v_source_version := NEW.version;
        v_result_version := NEW.version;
        v_status := NEW.status;
        v_after_snapshot := jsonb_build_object(
            'schedule', NEW.schedule,
            'employee_details', NEW.employee_details,
            'warnings', NEW.warnings,
            'status', NEW.status,
            'confirmed_at', NEW.confirmed_at
        );
        v_before_snapshot := v_after_snapshot;
    ELSE
        IF OLD.schedule IS NOT DISTINCT FROM NEW.schedule
           AND OLD.employee_details IS NOT DISTINCT FROM NEW.employee_details
           AND OLD.warnings IS NOT DISTINCT FROM NEW.warnings
           AND OLD.status IS NOT DISTINCT FROM NEW.status
           AND OLD.team_label IS NOT DISTINCT FROM NEW.team_label
           AND OLD.week_end IS NOT DISTINCT FROM NEW.week_end THEN
            RETURN NEW;
        END IF;

        v_revision_type := 'update';
        v_schedule_id := OLD.id;
        v_org_id := OLD.organization_id;
        v_team_id := OLD.team_id;
        v_team_label := OLD.team_label;
        v_week_start := OLD.week_start;
        v_week_end := OLD.week_end;
        v_source_version := OLD.version;
        v_result_version := NEW.version;
        v_status := OLD.status;

        v_before_snapshot := jsonb_build_object(
            'schedule', OLD.schedule,
            'employee_details', OLD.employee_details,
            'warnings', OLD.warnings,
            'status', OLD.status,
            'confirmed_at', OLD.confirmed_at
        );
        v_after_snapshot := jsonb_build_object(
            'schedule', NEW.schedule,
            'employee_details', NEW.employee_details,
            'warnings', NEW.warnings,
            'status', NEW.status,
            'confirmed_at', NEW.confirmed_at
        );

        IF v_restore_id IS NOT NULL THEN
            v_change_type := 'restored';
        ELSIF v_requested_change_type = 'request_approved' THEN
            v_change_type := 'request_approved';
        ELSIF OLD.status = 'confirmed' AND NEW.status = 'draft' THEN
            v_change_type := 'reopened';
        ELSIF OLD.status = 'confirmed' AND v_reason IS NOT NULL THEN
            v_change_type := 'admin_changed';
        ELSIF OLD.status = 'draft' AND NEW.status = 'confirmed' AND v_reason IS NOT NULL THEN
            v_change_type := 'admin_changed';
        ELSIF OLD.status = 'draft' AND NEW.status = 'confirmed' THEN
            v_change_type := 'confirmed';
        ELSIF NEW.status = 'draft' THEN
            v_change_type := 'draft_saved';
        ELSE
            v_change_type := 'updated';
        END IF;
    END IF;

    INSERT INTO public.organization_weekly_schedule_revisions (
        schedule_id, organization_id, team_id, team_label, week_start, week_end,
        source_version, status, snapshot_data, after_snapshot, revision_type,
        result_version, change_type, change_reason, restored_from_revision_id,
        captured_by
    ) VALUES (
        v_schedule_id, v_org_id, v_team_id, v_team_label, v_week_start, v_week_end,
        v_source_version, v_status, v_before_snapshot, v_after_snapshot, v_revision_type,
        v_result_version, v_change_type, v_reason, v_restore_id, NEW.updated_by
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

-- Version-aware save endpoint. The old endpoint remains callable for older clients,
-- but the trigger above blocks any confirmed-schedule mutation without a reason.
CREATE OR REPLACE FUNCTION public.save_my_organization_weekly_schedule_v2(
    p_team_id text,
    p_team_label text,
    p_week_start date,
    p_week_end date,
    p_status text,
    p_schedule jsonb,
    p_employee_details jsonb,
    p_warnings jsonb,
    p_expected_version integer,
    p_change_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_sync_from date;
    v_current public.organization_weekly_schedules%ROWTYPE;
    v_reason text := NULLIF(left(btrim(COALESCE(p_change_reason, '')), 300), '');
    v_changed_confirmed boolean := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_team_id IS NULL OR btrim(p_team_id) = ''
       OR p_week_start IS NULL
       OR EXTRACT(DOW FROM p_week_start) <> 0
       OR p_week_end IS DISTINCT FROM p_week_start + 6 THEN
        RAISE EXCEPTION '팀 정보와 일요일부터 토요일까지의 7일 근무표를 확인해주세요.';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('draft', 'confirmed')
       OR jsonb_typeof(p_schedule) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_employee_details) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_warnings) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION '근무표 데이터 형식이 올바르지 않습니다.';
    END IF;

    IF p_expected_version IS NULL OR p_expected_version < 0 THEN
        RAISE EXCEPTION '근무표 버전 정보가 올바르지 않습니다.';
    END IF;

    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = v_organization_id
          AND o.owner_id = v_user_id
    ) THEN
        RAISE EXCEPTION '회사 대표 계정만 근무표를 저장할 수 있습니다.';
    END IF;

    SELECT o.schedule_sync_from INTO v_sync_from
    FROM public.organizations o
    WHERE o.id = v_organization_id;

    IF v_sync_from IS NULL OR p_week_end < v_sync_from THEN
        RAISE EXCEPTION '연동 시작일 이전의 근무표는 공유 저장할 수 없습니다.';
    END IF;

    IF p_status = 'confirmed' AND p_employee_details = '{}'::jsonb THEN
        RAISE EXCEPTION '직원 정보가 없는 근무표는 확정할 수 없습니다.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(
        v_organization_id::text || ':' || btrim(p_team_id) || ':' || p_week_start::text
    ));

    SELECT s.* INTO v_current
    FROM public.organization_weekly_schedules s
    WHERE s.organization_id = v_organization_id
      AND s.team_id = btrim(p_team_id)
      AND s.week_start = p_week_start
    FOR UPDATE;

    IF NOT FOUND THEN
        IF p_expected_version <> 0 THEN
            RAISE EXCEPTION '근무표가 다른 기기에서 변경되었습니다. 최신 근무표를 다시 불러와주세요.'
                USING ERRCODE = '40001';
        END IF;
    ELSE
        IF v_current.version <> p_expected_version THEN
            RAISE EXCEPTION '근무표가 다른 기기에서 변경되었습니다. 최신 근무표를 다시 불러와주세요.'
                USING ERRCODE = '40001';
        END IF;

        v_changed_confirmed := v_current.status = 'confirmed' AND (
            v_current.status IS DISTINCT FROM p_status
            OR v_current.team_label IS DISTINCT FROM COALESCE(NULLIF(btrim(p_team_label), ''), btrim(p_team_id))
            OR v_current.week_end IS DISTINCT FROM p_week_end
            OR v_current.schedule IS DISTINCT FROM p_schedule
            OR v_current.employee_details IS DISTINCT FROM p_employee_details
            OR v_current.warnings IS DISTINCT FROM p_warnings
        );

        IF v_changed_confirmed AND v_reason IS NULL THEN
            RAISE EXCEPTION '확정된 근무표를 변경하려면 변경 사유를 입력해주세요.';
        END IF;

        -- Carry the reason from a recorded reopen to the final confirmation.
        IF v_current.status = 'draft' AND p_status = 'confirmed' AND v_reason IS NULL THEN
            SELECT r.change_reason INTO v_reason
            FROM public.organization_weekly_schedule_revisions r
            WHERE r.schedule_id = v_current.id
              AND r.change_reason IS NOT NULL
              AND r.change_type IN ('reopened', 'admin_changed', 'restored')
            ORDER BY r.result_version DESC, r.captured_at DESC
            LIMIT 1;
        END IF;
    END IF;

    PERFORM set_config('app.schedule_change_reason', COALESCE(v_reason, ''), true);

    RETURN public.save_my_organization_weekly_schedule(
        p_team_id, p_team_label, p_week_start, p_week_end, p_status,
        p_schedule, p_employee_details, p_warnings
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_my_organization_weekly_schedule_v2(
    text, text, date, date, text, jsonb, jsonb, jsonb, integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_organization_weekly_schedule_v2(
    text, text, date, date, text, jsonb, jsonb, jsonb, integer, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_my_organization_weekly_schedule_revision_v2(
    p_revision_id uuid,
    p_expected_version integer,
    p_change_reason text
)
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
    v_reason text := NULLIF(left(btrim(COALESCE(p_change_reason, '')), 300), '');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;
    IF p_revision_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1 THEN
        RAISE EXCEPTION '복구 요청 정보가 올바르지 않습니다.';
    END IF;
    IF v_reason IS NULL THEN
        RAISE EXCEPTION '이전 근무표를 복구하려면 변경 사유를 입력해주세요.';
    END IF;

    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = v_organization_id AND o.owner_id = v_user_id
    ) THEN
        RAISE EXCEPTION '회사 대표 계정만 근무표를 복구할 수 있습니다.';
    END IF;

    SELECT r.* INTO v_revision
    FROM public.organization_weekly_schedule_revisions r
    WHERE r.id = p_revision_id
      AND r.organization_id = v_organization_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '선택한 근무표 이력을 찾을 수 없습니다.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(
        v_organization_id::text || ':' || v_revision.team_id || ':' || v_revision.week_start::text
    ));

    SELECT s.* INTO v_current
    FROM public.organization_weekly_schedules s
    WHERE s.id = v_revision.schedule_id
      AND s.organization_id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND OR v_current.version <> p_expected_version THEN
        RAISE EXCEPTION '현재 근무표가 다른 기기에서 변경되었습니다. 최신 근무표를 다시 불러와주세요.'
            USING ERRCODE = '40001';
    END IF;

    PERFORM set_config('app.schedule_restore_revision_id', p_revision_id::text, true);
    PERFORM set_config('app.schedule_change_reason', v_reason, true);

    UPDATE public.organization_weekly_schedules
    SET status = v_revision.snapshot_data ->> 'status',
        team_label = v_revision.team_label,
        week_end = v_revision.week_end,
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

REVOKE ALL ON FUNCTION public.restore_my_organization_weekly_schedule_revision_v2(uuid, integer, text)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_my_organization_weekly_schedule_revision_v2(uuid, integer, text)
    TO authenticated;

-- Disable the legacy restore endpoint that has neither a reason nor a version check.
REVOKE ALL ON FUNCTION public.restore_my_organization_weekly_schedule_revision(uuid)
    FROM PUBLIC, anon, authenticated;

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

    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id AND o.owner_id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사 대표 계정만 근무표 변경 이력을 조회할 수 있습니다.';
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', r.id,
                'source_version', r.source_version,
                'result_version', r.result_version,
                'status', r.status,
                'revision_type', r.revision_type,
                'change_type', r.change_type,
                'change_reason', r.change_reason,
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

    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id AND o.owner_id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사 대표 계정만 근무표 이력을 조회할 수 있습니다.';
    END IF;

    SELECT r.* INTO v_revision
    FROM public.organization_weekly_schedule_revisions r
    WHERE r.id = p_revision_id AND r.organization_id = v_organization_id;

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
        'result_version', v_revision.result_version,
        'status', v_revision.status,
        'revision_type', v_revision.revision_type,
        'change_type', v_revision.change_type,
        'change_reason', v_revision.change_reason,
        'captured_by', v_revision.captured_by,
        'captured_at', v_revision.captured_at,
        'snapshot', v_revision.snapshot_data,
        'after_snapshot', v_revision.after_snapshot,
        'restored_from_revision_id', v_revision.restored_from_revision_id
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_weekly_schedule_revision(uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_weekly_schedule_revision(uuid)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_organization_weekly_schedule_change_notices(
    p_start_date date,
    p_end_date date
)
RETURNS TABLE (
    schedule_id uuid,
    team_id text,
    team_label text,
    week_start date,
    week_end date,
    version integer,
    change_type text,
    change_reason text,
    changed_at timestamptz
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
    IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
        RAISE EXCEPTION '조회 기간이 올바르지 않습니다.';
    END IF;

    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT DISTINCT ON (r.schedule_id)
        r.schedule_id,
        r.team_id,
        r.team_label,
        r.week_start,
        r.week_end,
        r.result_version,
        r.change_type,
        r.change_reason,
        r.captured_at
    FROM public.organization_weekly_schedule_revisions r
    WHERE r.organization_id = v_organization_id
      AND r.week_start <= p_end_date
      AND r.week_end >= GREATEST(p_start_date, CURRENT_DATE)
      AND r.week_end >= CURRENT_DATE
      AND r.change_type IN ('reopened', 'admin_changed', 'restored')
      AND r.change_reason IS NOT NULL
      AND (
          COALESCE(r.snapshot_data -> 'employee_details', '{}'::jsonb) ? v_user_id::text
          OR COALESCE(r.after_snapshot -> 'employee_details', '{}'::jsonb) ? v_user_id::text
      )
    ORDER BY r.schedule_id, r.result_version DESC, r.captured_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_organization_weekly_schedule_change_notices(date, date)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_weekly_schedule_change_notices(date, date)
    TO authenticated;


-- Preserve the existing employee-request approval workflows under the new guard.
-- Their explicit request record supplies the audit reason; they are not free-form manager edits.
CREATE OR REPLACE FUNCTION public.respond_to_shift_exchange(
    p_exchange_id uuid,
    p_response text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_response text := lower(btrim(COALESCE(p_response, '')));
    v_exchange public.shift_exchanges%ROWTYPE;
    v_organization_id uuid;
    v_schedule public.organization_weekly_schedules%ROWTYPE;
    v_previous_schedule jsonb;
    v_next_schedule jsonb;
    v_source_day jsonb;
    v_target_day jsonb;
    v_source_off_ids jsonb;
    v_target_off_ids jsonb;
    v_source_shortage boolean := false;
    v_target_shortage boolean := false;
    v_warnings jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;
    IF v_response NOT IN ('accepted', 'declined') THEN
        RAISE EXCEPTION '응답은 accepted 또는 declined만 허용됩니다.';
    END IF;

    SELECT x.* INTO v_exchange
    FROM public.shift_exchanges x
    WHERE x.id = p_exchange_id
    FOR UPDATE;

    IF NOT FOUND OR v_exchange.receiver_id <> v_user_id OR v_exchange.status <> 'pending' THEN
        RAISE EXCEPTION '이 교환 신청에 응답할 권한이 없거나 이미 처리되었습니다.';
    END IF;

    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL OR v_organization_id <> v_exchange.team_id
       OR NOT EXISTS (
           SELECT 1 FROM public.profiles p
           WHERE p.id = v_exchange.requester_id
             AND p.organization_id = v_exchange.team_id
       ) THEN
        RAISE EXCEPTION '현재 같은 회사에 소속된 직원끼리의 신청만 처리할 수 있습니다.';
    END IF;

    IF v_response = 'declined' THEN
        UPDATE public.shift_exchanges
        SET status = 'declined', responded_at = now()
        WHERE id = v_exchange.id;
        RETURN jsonb_build_object('status', 'declined');
    END IF;

    IF v_exchange.schedule_id IS NULL THEN
        RAISE EXCEPTION '이 신청은 이전 개인 휴무 방식으로 생성되어 관리자 근무표와 연결할 수 없습니다. 다시 신청해주세요.';
    END IF;

    SELECT s.* INTO v_schedule
    FROM public.organization_weekly_schedules s
    WHERE s.id = v_exchange.schedule_id
      AND s.organization_id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND OR v_schedule.status <> 'confirmed' THEN
        RAISE EXCEPTION '관리자 확정 근무표가 변경되었거나 확정 해제되었습니다. 최신 근무표에서 다시 신청해주세요.';
    END IF;

    v_source_day := v_schedule.schedule -> v_exchange.source_date::text;
    v_target_day := v_schedule.schedule -> v_exchange.target_date::text;

    IF v_source_day IS NULL OR v_target_day IS NULL
       OR NOT COALESCE(v_source_day -> 'offEmployeeIds', '[]'::jsonb)
          @> jsonb_build_array(v_exchange.requester_id::text)
       OR NOT COALESCE(v_target_day -> 'offEmployeeIds', '[]'::jsonb)
          @> jsonb_build_array(v_exchange.receiver_id::text)
       OR COALESCE(v_target_day -> 'offEmployeeIds', '[]'::jsonb)
          @> jsonb_build_array(v_exchange.requester_id::text)
       OR COALESCE(v_source_day -> 'offEmployeeIds', '[]'::jsonb)
          @> jsonb_build_array(v_exchange.receiver_id::text) THEN
        RAISE EXCEPTION '신청 이후 휴무 배정이 변경되었습니다. 최신 달력에서 다시 신청해주세요.';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(employee_id) ORDER BY employee_id), '[]'::jsonb)
    INTO v_source_off_ids
    FROM (
        SELECT DISTINCT item AS employee_id
        FROM jsonb_array_elements_text(COALESCE(v_source_day -> 'offEmployeeIds', '[]'::jsonb)) AS x(item)
        WHERE item <> v_exchange.requester_id::text
        UNION
        SELECT v_exchange.receiver_id::text
    ) AS ids;

    SELECT COALESCE(jsonb_agg(to_jsonb(employee_id) ORDER BY employee_id), '[]'::jsonb)
    INTO v_target_off_ids
    FROM (
        SELECT DISTINCT item AS employee_id
        FROM jsonb_array_elements_text(COALESCE(v_target_day -> 'offEmployeeIds', '[]'::jsonb)) AS x(item)
        WHERE item <> v_exchange.receiver_id::text
        UNION
        SELECT v_exchange.requester_id::text
    ) AS ids;

    v_previous_schedule := v_schedule.schedule;
    v_next_schedule := private.rebuild_organization_schedule_day(
        v_schedule.schedule, v_schedule.employee_details, v_exchange.source_date, v_source_off_ids
    );
    v_next_schedule := private.rebuild_organization_schedule_day(
        v_next_schedule, v_schedule.employee_details, v_exchange.target_date, v_target_off_ids
    );

    v_source_shortage := (v_next_schedule -> v_exchange.source_date::text ->> 'status') = 'error';
    v_target_shortage := (v_next_schedule -> v_exchange.target_date::text ->> 'status') = 'error';

    SELECT COALESCE(jsonb_agg(w.value ORDER BY w.ordinality), '[]'::jsonb)
    INTO v_warnings
    FROM jsonb_array_elements(COALESCE(v_schedule.warnings, '[]'::jsonb))
         WITH ORDINALITY AS w(value, ordinality)
    WHERE NOT (
        COALESCE(w.value #>> '{}', '') LIKE
            '[백업 인원 확인 필요] ' || v_exchange.source_date::text || ':%'
        OR COALESCE(w.value #>> '{}', '') LIKE
            '[백업 인원 확인 필요] ' || v_exchange.target_date::text || ':%'
    );

    IF v_source_shortage THEN
        v_warnings := v_warnings || jsonb_build_array(
            '[백업 인원 확인 필요] ' || v_exchange.source_date::text || ': 휴무 교환 후 백업 배정이 부족합니다.'
        );
    END IF;
    IF v_target_shortage THEN
        v_warnings := v_warnings || jsonb_build_array(
            '[백업 인원 확인 필요] ' || v_exchange.target_date::text || ': 휴무 교환 후 백업 배정이 부족합니다.'
        );
    END IF;

    PERFORM set_config(
        'app.schedule_change_reason',
        left(
            '직원 간 휴무 교환 승인: ' ||
            COALESCE(v_schedule.employee_details -> v_exchange.requester_id::text ->> 'name', '직원') ||
            ' / ' || v_exchange.source_date::text ||
            ' ↔ ' ||
            COALESCE(v_schedule.employee_details -> v_exchange.receiver_id::text ->> 'name', '직원') ||
            ' / ' || v_exchange.target_date::text,
            300
        ),
        true
    );
    PERFORM set_config('app.schedule_change_type', 'request_approved', true);

    UPDATE public.organization_weekly_schedules
    SET schedule = v_next_schedule,
        warnings = v_warnings,
        version = version + 1,
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = v_schedule.id;

    INSERT INTO public.organization_schedule_change_history (
        organization_id, schedule_id, request_type, request_id, actor_id,
        changed_dates, previous_schedule, new_schedule, details
    ) VALUES (
        v_organization_id, v_schedule.id, 'day_off_exchange', v_exchange.id, v_user_id,
        jsonb_build_array(v_exchange.source_date::text, v_exchange.target_date::text),
        v_previous_schedule, v_next_schedule,
        jsonb_build_object(
            'requester_id', v_exchange.requester_id,
            'receiver_id', v_exchange.receiver_id,
            'source_date', v_exchange.source_date,
            'target_date', v_exchange.target_date
        )
    );

    UPDATE public.shift_exchanges
    SET status = 'accepted', responded_at = now()
    WHERE id = v_exchange.id;

    RETURN jsonb_build_object(
        'status', 'accepted',
        'schedule_id', v_schedule.id,
        'schedule_team_id', v_schedule.team_id,
        'week_start', v_schedule.week_start,
        'schedule', v_next_schedule,
        'warnings', v_warnings,
        'version', v_schedule.version + 1,
        'has_shortage', (v_source_shortage OR v_target_shortage)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_extra_day_off_request(
    p_request_id uuid,
    p_response text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_response text := lower(btrim(COALESCE(p_response, '')));
    v_request public.organization_extra_day_off_requests%ROWTYPE;
    v_organization_id uuid;
    v_schedule public.organization_weekly_schedules%ROWTYPE;
    v_day jsonb;
    v_previous_schedule jsonb;
    v_next_schedule jsonb;
    v_off_ids jsonb;
    v_warnings jsonb;
    v_has_shortage boolean := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;
    IF v_response NOT IN ('approved', 'declined') THEN
        RAISE EXCEPTION '응답은 approved 또는 declined만 허용됩니다.';
    END IF;

    SELECT r.* INTO v_request
    FROM public.organization_extra_day_off_requests r
    WHERE r.id = p_request_id
    FOR UPDATE;

    IF NOT FOUND OR v_request.status <> 'pending' THEN
        RAISE EXCEPTION '대기 중인 추가휴무 요청을 찾지 못했습니다.';
    END IF;

    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id
      AND o.owner_id = v_user_id;

    IF v_organization_id IS NULL OR v_organization_id <> v_request.organization_id THEN
        RAISE EXCEPTION '이 회사의 추가휴무 요청을 처리할 권한이 없습니다.';
    END IF;

    IF v_response = 'declined' THEN
        UPDATE public.organization_extra_day_off_requests
        SET status = 'declined', reviewed_at = now(), reviewed_by = v_user_id
        WHERE id = v_request.id;
        RETURN jsonb_build_object('status', 'declined');
    END IF;

    SELECT s.* INTO v_schedule
    FROM public.organization_weekly_schedules s
    WHERE s.id = v_request.schedule_id
      AND s.organization_id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND OR v_schedule.status <> 'confirmed' THEN
        RAISE EXCEPTION '해당 주의 관리자 근무표가 확정 상태가 아닙니다. 근무표를 다시 확인해주세요.';
    END IF;
    IF NOT (v_schedule.employee_details ? v_request.employee_id::text) THEN
        RAISE EXCEPTION '요청한 직원이 현재 근무표에 없습니다.';
    END IF;

    v_day := v_schedule.schedule -> v_request.requested_date::text;
    IF v_day IS NULL THEN
        RAISE EXCEPTION '요청 날짜의 근무표가 없습니다.';
    END IF;
    IF COALESCE(v_day -> 'offEmployeeIds', '[]'::jsonb)
       @> jsonb_build_array(v_request.employee_id::text) THEN
        RAISE EXCEPTION '요청 이후 해당 직원의 휴무가 이미 변경되었습니다. 근무표를 다시 확인해주세요.';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(employee_id) ORDER BY employee_id), '[]'::jsonb)
    INTO v_off_ids
    FROM (
        SELECT DISTINCT item AS employee_id
        FROM jsonb_array_elements_text(COALESCE(v_day -> 'offEmployeeIds', '[]'::jsonb)) AS x(item)
        UNION
        SELECT v_request.employee_id::text
    ) AS ids;

    v_previous_schedule := v_schedule.schedule;
    v_next_schedule := private.rebuild_organization_schedule_day(
        v_schedule.schedule,
        v_schedule.employee_details,
        v_request.requested_date,
        v_off_ids
    );

    v_has_shortage := (v_next_schedule -> v_request.requested_date::text ->> 'status') = 'error';

    SELECT COALESCE(jsonb_agg(w.value ORDER BY w.ordinality), '[]'::jsonb)
    INTO v_warnings
    FROM jsonb_array_elements(COALESCE(v_schedule.warnings, '[]'::jsonb))
         WITH ORDINALITY AS w(value, ordinality)
    WHERE COALESCE(w.value #>> '{}', '') NOT LIKE
        '[백업 인원 확인 필요] ' || v_request.requested_date::text || ':%';

    IF v_has_shortage THEN
        v_warnings := v_warnings || jsonb_build_array(
            '[백업 인원 확인 필요] ' || v_request.requested_date::text ||
            ': 추가휴무 승인 후 백업 배정이 부족합니다. 대체 인력 또는 일정 조정이 필요합니다.'
        );
    END IF;

    PERFORM set_config(
        'app.schedule_change_reason',
        left(
            '직원 추가휴무 요청 승인: ' || v_request.employee_name ||
            ' / ' || v_request.requested_date::text ||
            CASE
                WHEN NULLIF(btrim(v_request.note), '') IS NOT NULL
                    THEN ' - ' || btrim(v_request.note)
                ELSE ''
            END,
            300
        ),
        true
    );
    PERFORM set_config('app.schedule_change_type', 'request_approved', true);

    UPDATE public.organization_weekly_schedules
    SET schedule = v_next_schedule,
        warnings = v_warnings,
        version = version + 1,
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = v_schedule.id;

    INSERT INTO public.organization_schedule_change_history (
        organization_id, schedule_id, request_type, request_id, actor_id,
        changed_dates, previous_schedule, new_schedule, details
    ) VALUES (
        v_organization_id, v_schedule.id, 'extra_day_off', v_request.id, v_user_id,
        jsonb_build_array(v_request.requested_date::text),
        v_previous_schedule, v_next_schedule,
        jsonb_build_object(
            'employee_id', v_request.employee_id,
            'employee_name', v_request.employee_name,
            'requested_date', v_request.requested_date,
            'note', v_request.note
        )
    );

    UPDATE public.organization_extra_day_off_requests
    SET status = 'approved', reviewed_at = now(), reviewed_by = v_user_id
    WHERE id = v_request.id;

    RETURN jsonb_build_object(
        'status', 'approved',
        'schedule_id', v_schedule.id,
        'team_id', v_schedule.team_id,
        'week_start', v_schedule.week_start,
        'schedule', v_next_schedule,
        'warnings', v_warnings,
        'version', v_schedule.version + 1,
        'has_shortage', v_has_shortage
    );
END;
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
