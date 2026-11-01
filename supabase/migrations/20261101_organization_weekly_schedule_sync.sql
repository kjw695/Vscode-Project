-- Share confirmed admin weekly schedules with members without mixing them into delivery entries.
-- Apply this migration in the Supabase SQL Editor after reviewing it.

BEGIN;

-- Schedule synchronization starts on the date this migration is applied.
-- Existing organizations share schedules only from this date onward.
-- New organizations inherit the current date automatically.
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS schedule_sync_from date;

UPDATE public.organizations
SET schedule_sync_from = CURRENT_DATE
WHERE schedule_sync_from IS NULL;

ALTER TABLE public.organizations
    ALTER COLUMN schedule_sync_from SET DEFAULT CURRENT_DATE;

ALTER TABLE public.organizations
    ALTER COLUMN schedule_sync_from SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.organization_weekly_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id text NOT NULL,
    team_label text NOT NULL DEFAULT '',
    week_start date NOT NULL,
    week_end date NOT NULL,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'confirmed')),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    schedule jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(schedule) = 'object'),
    employee_details jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(employee_details) = 'object'),
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(warnings) = 'array'),
    created_by uuid NOT NULL REFERENCES auth.users(id),
    updated_by uuid NOT NULL REFERENCES auth.users(id),
    confirmed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organization_weekly_schedules_valid_week
        CHECK (week_end = week_start + 6),
    CONSTRAINT organization_weekly_schedules_unique_team_week
        UNIQUE (organization_id, team_id, week_start)
);

CREATE INDEX IF NOT EXISTS organization_weekly_schedules_org_week_idx
    ON public.organization_weekly_schedules (organization_id, week_start, week_end);

ALTER TABLE public.organization_weekly_schedules ENABLE ROW LEVEL SECURITY;

-- Clients use the SECURITY DEFINER RPCs below. No direct table access is granted.
REVOKE ALL PRIVILEGES ON TABLE public.organization_weekly_schedules
    FROM PUBLIC, anon, authenticated;

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
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_effective_from date;
    v_saved public.organization_weekly_schedules%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_team_id IS NULL OR btrim(p_team_id) = '' THEN
        RAISE EXCEPTION '팀 정보가 필요합니다.';
    END IF;

    IF p_week_start IS NULL
       OR EXTRACT(DOW FROM p_week_start) <> 0
       OR p_week_end IS DISTINCT FROM p_week_start + 6 THEN
        RAISE EXCEPTION '일요일부터 토요일까지 7일 범위의 근무표만 저장할 수 있습니다.';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('draft', 'confirmed') THEN
        RAISE EXCEPTION '근무표 상태가 올바르지 않습니다.';
    END IF;

    IF p_schedule IS NULL OR jsonb_typeof(p_schedule) <> 'object'
       OR p_employee_details IS NULL OR jsonb_typeof(p_employee_details) <> 'object'
       OR p_warnings IS NULL OR jsonb_typeof(p_warnings) <> 'array' THEN
        RAISE EXCEPTION '근무표 데이터 형식이 올바르지 않습니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사에 소속된 관리자 계정만 공유 근무표를 저장할 수 있습니다.';
    END IF;

    SELECT o.schedule_sync_from
    INTO v_effective_from
    FROM public.organizations o
    WHERE o.id = v_organization_id;

    IF v_effective_from IS NULL OR p_week_end < v_effective_from THEN
        RAISE EXCEPTION '연동 시작일 이전의 근무표는 공유 저장할 수 없습니다. 과거 기록은 기존 데이터로 유지됩니다.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = v_organization_id
          AND o.owner_id = v_user_id
    ) THEN
        RAISE EXCEPTION '공유 근무표 저장 권한이 없습니다. 회사 관리자에게 문의해주세요.';
    END IF;

    IF p_status = 'confirmed' AND p_employee_details = '{}'::jsonb THEN
        RAISE EXCEPTION '직원 정보가 없는 근무표는 확정할 수 없습니다.';
    END IF;

    INSERT INTO public.organization_weekly_schedules (
        organization_id,
        team_id,
        team_label,
        week_start,
        week_end,
        status,
        version,
        schedule,
        employee_details,
        warnings,
        created_by,
        updated_by,
        confirmed_at,
        updated_at
    ) VALUES (
        v_organization_id,
        btrim(p_team_id),
        COALESCE(NULLIF(btrim(p_team_label), ''), btrim(p_team_id)),
        p_week_start,
        p_week_end,
        p_status,
        1,
        p_schedule,
        p_employee_details,
        p_warnings,
        v_user_id,
        v_user_id,
        CASE WHEN p_status = 'confirmed' THEN now() ELSE NULL END,
        now()
    )
    ON CONFLICT (organization_id, team_id, week_start)
    DO UPDATE SET
        team_label = EXCLUDED.team_label,
        week_end = EXCLUDED.week_end,
        status = EXCLUDED.status,
        version = public.organization_weekly_schedules.version + 1,
        schedule = EXCLUDED.schedule,
        employee_details = EXCLUDED.employee_details,
        warnings = EXCLUDED.warnings,
        updated_by = EXCLUDED.updated_by,
        confirmed_at = EXCLUDED.confirmed_at,
        updated_at = now()
    RETURNING * INTO v_saved;

    RETURN jsonb_build_object(
        'id', v_saved.id,
        'team_id', v_saved.team_id,
        'team_label', v_saved.team_label,
        'week_start', v_saved.week_start,
        'week_end', v_saved.week_end,
        'status', v_saved.status,
        'version', v_saved.version,
        'confirmed_at', v_saved.confirmed_at,
        'updated_at', v_saved.updated_at
    );
END;
$function$;

-- The return shape includes effective_from. Drop an earlier draft version safely
-- before recreating it because PostgreSQL cannot change a TABLE function's return type.
DROP FUNCTION IF EXISTS public.list_my_organization_weekly_schedules(date, date);

CREATE OR REPLACE FUNCTION public.list_my_organization_weekly_schedules(
    p_start_date date,
    p_end_date date
)
RETURNS TABLE (
    id uuid,
    team_id text,
    team_label text,
    week_start date,
    week_end date,
    effective_from date,
    status text,
    version integer,
    confirmed_at timestamptz,
    updated_at timestamptz,
    schedule jsonb,
    employee_details jsonb,
    warnings jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_effective_from date;
    v_is_owner boolean := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
        RAISE EXCEPTION '조회 기간이 올바르지 않습니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        RETURN;
    END IF;

    SELECT o.schedule_sync_from
    INTO v_effective_from
    FROM public.organizations o
    WHERE o.id = v_organization_id;

    IF v_effective_from IS NULL THEN
        RETURN;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = v_organization_id
          AND o.owner_id = v_user_id
    )
    INTO v_is_owner;

    RETURN QUERY
    SELECT
        s.id,
        s.team_id,
        s.team_label,
        s.week_start,
        s.week_end,
        v_effective_from AS effective_from,
        s.status,
        s.version,
        s.confirmed_at,
        s.updated_at,
        CASE
            WHEN v_is_owner THEN s.schedule
            WHEN s.status = 'confirmed' THEN (
                SELECT COALESCE(
                    jsonb_object_agg(
                        day_row.day_key,
                        jsonb_build_object(
                            'date', day_row.day_record ->> 'date',
                            'status', CASE
                                WHEN EXISTS (
                                    SELECT 1
                                    FROM jsonb_array_elements(
                                        CASE
                                            WHEN jsonb_typeof(day_row.day_record -> 'offEmployeeIds') = 'array'
                                                THEN day_row.day_record -> 'offEmployeeIds'
                                            ELSE '[]'::jsonb
                                        END
                                    ) AS off_item(value)
                                    WHERE COALESCE(
                                        off_item.value ->> 'employeeId',
                                        off_item.value ->> 'employee_id',
                                        off_item.value ->> 'id',
                                        off_item.value #>> '{}'
                                    ) = v_user_id::text
                                ) THEN 'off'
                                WHEN EXISTS (
                                    SELECT 1
                                    FROM jsonb_array_elements(
                                        CASE
                                            WHEN jsonb_typeof(day_row.day_record -> 'subs') = 'array'
                                                THEN day_row.day_record -> 'subs'
                                            ELSE '[]'::jsonb
                                        END
                                    ) AS sub_item(value)
                                    WHERE sub_item.value ->> 'subId' = v_user_id::text
                                ) THEN 'backup'
                                ELSE 'work'
                            END,
                            'assignment', (
                                SELECT sub_item.value
                                FROM jsonb_array_elements(
                                    CASE
                                        WHEN jsonb_typeof(day_row.day_record -> 'subs') = 'array'
                                            THEN day_row.day_record -> 'subs'
                                        ELSE '[]'::jsonb
                                    END
                                ) AS sub_item(value)
                                WHERE sub_item.value ->> 'subId' = v_user_id::text
                                LIMIT 1
                            )
                        )
                    ),
                    '{}'::jsonb
                )
                FROM jsonb_each(s.schedule) AS day_row(day_key, day_record)
            )
            ELSE '{}'::jsonb
        END AS schedule,
        CASE
            WHEN v_is_owner THEN s.employee_details
            WHEN s.status = 'confirmed' THEN jsonb_build_object(
                v_user_id::text,
                s.employee_details -> v_user_id::text
            )
            ELSE jsonb_build_object(
                v_user_id::text,
                jsonb_build_object('pending', true)
            )
        END AS employee_details,
        CASE WHEN v_is_owner THEN s.warnings ELSE '[]'::jsonb END AS warnings
    FROM public.organization_weekly_schedules s
    WHERE s.organization_id = v_organization_id
      AND s.week_start <= p_end_date
      AND s.week_end >= GREATEST(p_start_date, v_effective_from)
      AND (
          v_is_owner
          OR s.employee_details ? v_user_id::text
      )
    ORDER BY s.week_start, s.team_label;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_organization_schedule_sync_from()
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_effective_from date;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT o.schedule_sync_from
    INTO v_effective_from
    FROM public.profiles p
    JOIN public.organizations o
      ON o.id = p.organization_id
    WHERE p.id = v_user_id;

    RETURN v_effective_from;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_schedule_sync_from()
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_schedule_sync_from()
    TO authenticated;

REVOKE ALL ON FUNCTION public.save_my_organization_weekly_schedule(
    text, text, date, date, text, jsonb, jsonb, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_organization_weekly_schedule(
    text, text, date, date, text, jsonb, jsonb, jsonb
) TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_organization_weekly_schedules(date, date)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_weekly_schedules(date, date)
    TO authenticated;

-- The legacy exchange RPCs use personal entries. After schedule synchronization
-- starts, those old entries must not create or complete exchanges that conflict
-- with the administrator's authoritative weekly schedule.
CREATE OR REPLACE FUNCTION public.guard_shift_exchange_before_schedule_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_effective_from date;
BEGIN
    -- New requests are blocked; an old pending request may still be declined.
    -- Accepting an exchange after the cutoff is blocked as well.
    IF TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND NEW.status = 'accepted') THEN
        SELECT o.schedule_sync_from
        INTO v_effective_from
        FROM public.organizations o
        WHERE o.id = NEW.team_id;

        IF v_effective_from IS NOT NULL
           AND (
               NEW.source_date >= v_effective_from
               OR NEW.target_date >= v_effective_from
           ) THEN
            RAISE EXCEPTION
                '회사 근무표 연동 시작일 이후 날짜는 관리자 근무표로 관리되므로 직원 간 휴무 교환을 할 수 없습니다.';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS shift_exchanges_schedule_sync_cutoff_guard
    ON public.shift_exchanges;

CREATE TRIGGER shift_exchanges_schedule_sync_cutoff_guard
BEFORE INSERT OR UPDATE OF status
ON public.shift_exchanges
FOR EACH ROW
EXECUTE FUNCTION public.guard_shift_exchange_before_schedule_sync();

REVOKE ALL ON FUNCTION public.guard_shift_exchange_before_schedule_sync()
    FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
