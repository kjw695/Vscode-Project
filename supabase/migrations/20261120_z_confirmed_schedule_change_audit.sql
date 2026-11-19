-- Require reasons for manager edits to confirmed schedules and expose employee-facing change notices.
-- Depends on 20261120_organization_schedule_tools.sql.

BEGIN;

ALTER TABLE public.organization_weekly_schedule_history
  ADD COLUMN IF NOT EXISTS change_reason text;

ALTER TABLE public.organization_weekly_schedule_history
  DROP CONSTRAINT IF EXISTS organization_weekly_schedule_history_change_type_check;

ALTER TABLE public.organization_weekly_schedule_history
  ADD CONSTRAINT organization_weekly_schedule_history_change_type_check
  CHECK (change_type IN ('created','draft_saved','confirmed','reopened','updated','restored','admin_changed'));

CREATE OR REPLACE FUNCTION public.capture_organization_weekly_schedule_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_restore uuid;
  v_kind text;
  v_reason text;
BEGIN
  BEGIN
    v_restore := NULLIF(current_setting('app.schedule_restore_history_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_restore := NULL;
  END;

  v_reason := NULLIF(left(btrim(current_setting('app.schedule_change_reason', true)), 300), '');

  IF v_restore IS NOT NULL THEN
    v_kind := 'restored';
  ELSIF TG_OP = 'INSERT' THEN
    v_kind := CASE WHEN NEW.status = 'confirmed' THEN 'confirmed' ELSE 'created' END;
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'confirmed' THEN
    v_kind := CASE WHEN v_reason IS NOT NULL THEN 'admin_changed' ELSE 'confirmed' END;
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'draft' THEN
    v_kind := 'reopened';
  ELSIF v_reason IS NOT NULL THEN
    v_kind := 'admin_changed';
  ELSIF NEW.status = 'draft' THEN
    v_kind := 'draft_saved';
  ELSE
    v_kind := 'updated';
  END IF;

  INSERT INTO public.organization_weekly_schedule_history (
    organization_id, schedule_id, team_id, team_label, week_start, week_end,
    version, status, schedule, employee_details, warnings, change_type,
    restored_from_history_id, changed_by, change_reason
  ) VALUES (
    NEW.organization_id, NEW.id, NEW.team_id, NEW.team_label, NEW.week_start, NEW.week_end,
    NEW.version, NEW.status, NEW.schedule, NEW.employee_details, NEW.warnings, v_kind,
    v_restore, NEW.updated_by, v_reason
  );

  DELETE FROM public.organization_weekly_schedule_history h
  WHERE h.schedule_id = NEW.id
    AND h.id NOT IN (
      SELECT x.id
      FROM public.organization_weekly_schedule_history x
      WHERE x.schedule_id = NEW.id
      ORDER BY x.created_at DESC, x.id DESC
      LIMIT 100
    );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_organization_weekly_schedule_history()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_my_organization_weekly_schedule_v3(
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
  v_user uuid := auth.uid();
  v_org uuid;
  v_sync_from date;
  v_row public.organization_weekly_schedules%ROWTYPE;
  v_reason text := NULLIF(left(btrim(COALESCE(p_change_reason, '')), 300), '');
  v_changes_confirmed boolean := false;
BEGIN
  IF v_user IS NULL THEN
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

  IF pg_column_size(p_schedule) + pg_column_size(p_employee_details) + pg_column_size(p_warnings) > 800000 THEN
    RAISE EXCEPTION '근무표 데이터가 허용 크기(약 800KB)를 초과했습니다.';
  END IF;

  SELECT p.organization_id INTO v_org
  FROM public.profiles p
  WHERE p.id = v_user;

  IF v_org IS NULL THEN
    RAISE EXCEPTION '회사 소속 관리자 계정만 근무표를 저장할 수 있습니다.';
  END IF;

  SELECT o.schedule_sync_from INTO v_sync_from
  FROM public.organizations o
  WHERE o.id = v_org;

  IF v_sync_from IS NULL OR p_week_end < v_sync_from THEN
    RAISE EXCEPTION '연동 시작일 이전의 근무표는 공유 저장할 수 없습니다.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = v_org AND o.owner_id = v_user
  ) THEN
    RAISE EXCEPTION '회사 대표 계정만 근무표를 저장할 수 있습니다.';
  END IF;

  IF p_status = 'confirmed' AND p_employee_details = '{}'::jsonb THEN
    RAISE EXCEPTION '직원 정보가 없는 근무표는 확정할 수 없습니다.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_org::text || ':' || btrim(p_team_id) || ':' || p_week_start::text));

  SELECT s.* INTO v_row
  FROM public.organization_weekly_schedules s
  WHERE s.organization_id = v_org
    AND s.team_id = btrim(p_team_id)
    AND s.week_start = p_week_start
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_version <> 0 THEN
      RAISE EXCEPTION '근무표가 다른 기기에서 변경되었습니다. 최신 근무표를 다시 불러와주세요.'
        USING ERRCODE = '40001';
    END IF;

    INSERT INTO public.organization_weekly_schedules (
      organization_id, team_id, team_label, week_start, week_end,
      status, version, schedule, employee_details, warnings,
      created_by, updated_by, confirmed_at, updated_at
    ) VALUES (
      v_org, btrim(p_team_id),
      COALESCE(NULLIF(btrim(p_team_label), ''), btrim(p_team_id)),
      p_week_start, p_week_end, p_status, 1, p_schedule,
      p_employee_details, p_warnings, v_user, v_user,
      CASE WHEN p_status = 'confirmed' THEN now() ELSE NULL END,
      now()
    )
    RETURNING * INTO v_row;
  ELSE
    IF v_row.version <> p_expected_version THEN
      RAISE EXCEPTION '근무표가 다른 기기에서 변경되었습니다. 최신 근무표를 다시 불러와주세요.'
        USING ERRCODE = '40001';
    END IF;

    v_changes_confirmed := v_row.status = 'confirmed' AND (
      v_row.status IS DISTINCT FROM p_status
      OR v_row.team_label IS DISTINCT FROM COALESCE(NULLIF(btrim(p_team_label), ''), btrim(p_team_id))
      OR v_row.schedule IS DISTINCT FROM p_schedule
      OR v_row.employee_details IS DISTINCT FROM p_employee_details
      OR v_row.warnings IS DISTINCT FROM p_warnings
    );

    IF v_changes_confirmed AND v_reason IS NULL THEN
      RAISE EXCEPTION '확정된 근무표를 변경하려면 변경 사유를 입력해주세요.';
    END IF;

    PERFORM set_config('app.schedule_change_reason', COALESCE(v_reason, ''), true);

    UPDATE public.organization_weekly_schedules
    SET team_label = COALESCE(NULLIF(btrim(p_team_label), ''), btrim(p_team_id)),
        week_end = p_week_end,
        status = p_status,
        version = version + 1,
        schedule = p_schedule,
        employee_details = p_employee_details,
        warnings = p_warnings,
        updated_by = v_user,
        confirmed_at = CASE WHEN p_status = 'confirmed' THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'team_id', v_row.team_id,
    'team_label', v_row.team_label,
    'week_start', v_row.week_start,
    'week_end', v_row.week_end,
    'status', v_row.status,
    'version', v_row.version,
    'confirmed_at', v_row.confirmed_at,
    'updated_at', v_row.updated_at,
    'schedule', v_row.schedule,
    'employee_details', v_row.employee_details,
    'warnings', v_row.warnings
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_my_organization_weekly_schedule_v3(text,text,date,date,text,jsonb,jsonb,jsonb,integer,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_organization_weekly_schedule_v3(text,text,date,date,text,jsonb,jsonb,jsonb,integer,text)
  TO authenticated;

-- Keep older clients from bypassing the new reason requirement.
CREATE OR REPLACE FUNCTION public.save_my_organization_weekly_schedule_v2(
  p_team_id text,
  p_team_label text,
  p_week_start date,
  p_week_end date,
  p_status text,
  p_schedule jsonb,
  p_employee_details jsonb,
  p_warnings jsonb,
  p_expected_version integer
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT public.save_my_organization_weekly_schedule_v3(
    p_team_id, p_team_label, p_week_start, p_week_end, p_status,
    p_schedule, p_employee_details, p_warnings, p_expected_version, NULL
  );
$function$;

REVOKE ALL ON FUNCTION public.save_my_organization_weekly_schedule_v2(text,text,date,date,text,jsonb,jsonb,jsonb,integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_organization_weekly_schedule_v2(text,text,date,date,text,jsonb,jsonb,jsonb,integer)
  TO authenticated;

-- The legacy RPC has no version argument. Preserve draft saves, but never let it overwrite a confirmed row.
CREATE OR REPLACE FUNCTION public.save_my_organization_weekly_schedule(
  p_team_id text,
  p_team_label text,
  p_week_start date,
  p_week_end date,
  p_status text,
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
  v_user uuid := auth.uid();
  v_org uuid;
  v_expected_version integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT p.organization_id INTO v_org
  FROM public.profiles p
  WHERE p.id = v_user;

  IF v_org IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = v_org AND o.owner_id = v_user
  ) THEN
    RAISE EXCEPTION '회사 대표 계정만 근무표를 저장할 수 있습니다.';
  END IF;

  SELECT s.version INTO v_expected_version
  FROM public.organization_weekly_schedules s
  WHERE s.organization_id = v_org
    AND s.team_id = btrim(p_team_id)
    AND s.week_start = p_week_start;

  v_expected_version := COALESCE(v_expected_version, 0);

  RETURN public.save_my_organization_weekly_schedule_v3(
    p_team_id, p_team_label, p_week_start, p_week_end, p_status,
    p_schedule, p_employee_details, p_warnings, v_expected_version, NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_my_organization_weekly_schedule(text,text,date,date,text,jsonb,jsonb,jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_organization_weekly_schedule(text,text,date,date,text,jsonb,jsonb,jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_my_organization_weekly_schedule_history_v2(
  p_history_id uuid,
  p_expected_version integer,
  p_change_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_current public.organization_weekly_schedules%ROWTYPE;
  v_history public.organization_weekly_schedule_history%ROWTYPE;
  v_reason text := NULLIF(left(btrim(COALESCE(p_change_reason, '')), 300), '');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF p_history_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION '복구 요청 정보가 올바르지 않습니다.';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION '이전 근무표를 복구하려면 변경 사유를 입력해주세요.';
  END IF;

  SELECT p.organization_id INTO v_org
  FROM public.profiles p
  WHERE p.id = v_user;

  IF v_org IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = v_org AND o.owner_id = v_user
  ) THEN
    RAISE EXCEPTION '회사 대표 계정만 근무표를 복구할 수 있습니다.';
  END IF;

  SELECT h.* INTO v_history
  FROM public.organization_weekly_schedule_history h
  WHERE h.id = p_history_id AND h.organization_id = v_org;

  IF NOT FOUND THEN
    RAISE EXCEPTION '선택한 이력이 현재 회사에 속하지 않습니다.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_org::text || ':' || v_history.team_id || ':' || v_history.week_start::text));

  SELECT s.* INTO v_current
  FROM public.organization_weekly_schedules s
  WHERE s.id = v_history.schedule_id
    AND s.organization_id = v_org
  FOR UPDATE;

  IF NOT FOUND OR v_current.version <> p_expected_version THEN
    RAISE EXCEPTION '현재 근무표가 다른 기기에서 변경되었습니다. 최신 근무표를 다시 불러와주세요.'
      USING ERRCODE = '40001';
  END IF;

  PERFORM set_config('app.schedule_restore_history_id', p_history_id::text, true);
  PERFORM set_config('app.schedule_change_reason', v_reason, true);

  UPDATE public.organization_weekly_schedules
  SET status = v_history.status,
      team_label = v_history.team_label,
      week_end = v_history.week_end,
      schedule = v_history.schedule,
      employee_details = v_history.employee_details,
      warnings = v_history.warnings,
      version = version + 1,
      updated_by = v_user,
      confirmed_at = CASE WHEN v_history.status = 'confirmed' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = v_current.id
  RETURNING * INTO v_current;

  RETURN jsonb_build_object(
    'id', v_current.id,
    'team_id', v_current.team_id,
    'team_label', v_current.team_label,
    'week_start', v_current.week_start,
    'week_end', v_current.week_end,
    'status', v_current.status,
    'version', v_current.version,
    'confirmed_at', v_current.confirmed_at,
    'updated_at', v_current.updated_at,
    'schedule', v_current.schedule,
    'employee_details', v_current.employee_details,
    'warnings', v_current.warnings,
    'restored_from_history_id', p_history_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_my_organization_weekly_schedule_history_v2(uuid,integer,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_my_organization_weekly_schedule_history_v2(uuid,integer,text)
  TO authenticated;

-- Disable the old restore endpoint, which has no reason argument.
REVOKE ALL ON FUNCTION public.restore_my_organization_weekly_schedule_history(uuid,integer)
  FROM PUBLIC, anon, authenticated;

-- Expose only the latest relevant change for schedules that included this employee.
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
  v_user uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION '조회 기간이 올바르지 않습니다.';
  END IF;

  SELECT p.organization_id INTO v_org
  FROM public.profiles p
  WHERE p.id = v_user;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (h.schedule_id)
    h.schedule_id,
    h.team_id,
    h.team_label,
    h.week_start,
    h.week_end,
    h.version,
    h.change_type,
    h.change_reason,
    h.created_at
  FROM public.organization_weekly_schedule_history h
  WHERE h.organization_id = v_org
    AND h.week_start <= p_end_date
    AND h.week_end >= GREATEST(p_start_date, CURRENT_DATE)
    AND h.week_end >= CURRENT_DATE
    AND h.change_type IN ('reopened', 'admin_changed', 'restored')
    AND h.employee_details ? v_user::text
  ORDER BY h.schedule_id, h.version DESC, h.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_organization_weekly_schedule_change_notices(date,date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_weekly_schedule_change_notices(date,date)
  TO authenticated;

-- Add the reason to administrator-visible history entries.
DROP FUNCTION IF EXISTS public.list_my_organization_weekly_schedule_history(text,date,integer);

CREATE FUNCTION public.list_my_organization_weekly_schedule_history(
  p_team_id text,
  p_week_start date,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  schedule_id uuid,
  team_id text,
  team_label text,
  week_start date,
  version integer,
  status text,
  change_type text,
  created_at timestamptz,
  changed_by uuid,
  employees_count integer,
  warnings_count integer,
  restored_from_history_id uuid,
  change_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT p.organization_id INTO v_org
  FROM public.profiles p
  WHERE p.id = v_user;

  IF v_org IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = v_org AND o.owner_id = v_user
  ) THEN
    RAISE EXCEPTION '회사 대표 계정만 근무표 변경 이력을 조회할 수 있습니다.';
  END IF;

  RETURN QUERY
  SELECT h.id, h.schedule_id, h.team_id, h.team_label, h.week_start,
    h.version, h.status, h.change_type, h.created_at, h.changed_by,
    (SELECT count(*)::integer FROM jsonb_object_keys(h.employee_details)),
    jsonb_array_length(h.warnings), h.restored_from_history_id, h.change_reason
  FROM public.organization_weekly_schedule_history h
  WHERE h.organization_id = v_org
    AND h.team_id = p_team_id
    AND h.week_start = p_week_start
  ORDER BY h.created_at DESC, h.id DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_organization_weekly_schedule_history(text,date,integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_weekly_schedule_history(text,date,integer)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
