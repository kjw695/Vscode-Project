-- Manager-confirmed schedule workflows for employee day-off exchanges and extra day-off requests.
-- Run after 20261101_organization_weekly_schedule_sync.sql in the Supabase SQL Editor.

BEGIN;

-- Remove the old trigger that blocked all schedule-era employee exchanges.
DROP TRIGGER IF EXISTS shift_exchanges_schedule_sync_cutoff_guard
    ON public.shift_exchanges;
DROP FUNCTION IF EXISTS public.guard_shift_exchange_before_schedule_sync();

-- Keep legacy rows readable/declinable, but connect new requests to the authoritative schedule.
ALTER TABLE public.shift_exchanges
    ADD COLUMN IF NOT EXISTS schedule_id uuid
        REFERENCES public.organization_weekly_schedules(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS schedule_team_id text,
    ADD COLUMN IF NOT EXISTS schedule_week_start date,
    ADD COLUMN IF NOT EXISTS schedule_version integer,
    ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE INDEX IF NOT EXISTS shift_exchanges_schedule_request_idx
    ON public.shift_exchanges (schedule_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.organization_extra_day_off_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    schedule_id uuid NOT NULL REFERENCES public.organization_weekly_schedules(id) ON DELETE CASCADE,
    team_id text NOT NULL,
    team_label text NOT NULL DEFAULT '',
    week_start date NOT NULL,
    schedule_version integer NOT NULL,
    employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_name text NOT NULL DEFAULT '직원',
    requested_date date NOT NULL,
    note text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES auth.users(id),
    CONSTRAINT organization_extra_day_off_requests_valid_week
        CHECK (requested_date >= week_start AND requested_date <= week_start + 6)
);

CREATE INDEX IF NOT EXISTS organization_extra_day_off_requests_employee_idx
    ON public.organization_extra_day_off_requests (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS organization_extra_day_off_requests_manager_idx
    ON public.organization_extra_day_off_requests (organization_id, team_id, status, created_at DESC);

ALTER TABLE public.organization_extra_day_off_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.organization_extra_day_off_requests
    FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.organization_schedule_change_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    schedule_id uuid NOT NULL REFERENCES public.organization_weekly_schedules(id) ON DELETE CASCADE,
    request_type text NOT NULL
        CHECK (request_type IN ('day_off_exchange', 'extra_day_off')),
    request_id uuid NOT NULL,
    actor_id uuid NOT NULL REFERENCES auth.users(id),
    changed_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
    previous_schedule jsonb NOT NULL,
    new_schedule jsonb NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_schedule_change_history_schedule_idx
    ON public.organization_schedule_change_history (schedule_id, created_at DESC);

ALTER TABLE public.organization_schedule_change_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.organization_schedule_change_history
    FROM PUBLIC, anon, authenticated;

-- Rebuild one day's visible off lists and backup assignments from the current employee roster.
-- Existing compatible assignments are retained first. Missing assignments use a permitted
-- backup only when the saved eligibility snapshot permits it. Legacy snapshots without
-- restriction metadata retain the original unrestricted fallback. Uncovered routes are marked.
CREATE OR REPLACE FUNCTION private.rebuild_organization_schedule_day(
    p_schedule jsonb,
    p_employee_details jsonb,
    p_date date,
    p_off_employee_ids jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_date_key text := p_date::text;
    v_day jsonb;
    v_off_ids text[] := ARRAY[]::text[];
    v_base_off_ids text[] := ARRAY[]::text[];
    v_assigned_sub_ids text[] := ARRAY[]::text[];
    v_offs jsonb := '[]'::jsonb;
    v_sub_offs jsonb := '[]'::jsonb;
    v_assignments jsonb := '[]'::jsonb;
    v_employee record;
    v_assignment jsonb;
    v_backup record;
    v_base_id text;
    v_sub_id text;
    v_target_id text;
    v_shortage_count integer := 0;
BEGIN
    IF jsonb_typeof(p_schedule) <> 'object'
       OR jsonb_typeof(p_employee_details) <> 'object'
       OR jsonb_typeof(p_off_employee_ids) <> 'array' THEN
        RAISE EXCEPTION '근무표 변경 데이터 형식이 올바르지 않습니다.';
    END IF;

    v_day := p_schedule -> v_date_key;
    IF v_day IS NULL OR jsonb_typeof(v_day) <> 'object' THEN
        RAISE EXCEPTION '선택한 날짜의 확정 근무표를 찾을 수 없습니다.';
    END IF;

    SELECT COALESCE(array_agg(DISTINCT item ORDER BY item), ARRAY[]::text[])
    INTO v_off_ids
    FROM jsonb_array_elements_text(p_off_employee_ids) AS x(item);

    FOR v_employee IN
        SELECT e.key AS employee_id, e.value AS detail
        FROM jsonb_each(p_employee_details) AS e
    LOOP
        IF v_employee.employee_id = ANY(v_off_ids) THEN
            IF COALESCE(v_employee.detail ->> 'type', 'base') = 'sub' THEN
                v_sub_offs := v_sub_offs || jsonb_build_array(
                    COALESCE(v_employee.detail ->> 'name', '직원')
                );
            ELSE
                v_base_off_ids := array_append(v_base_off_ids, v_employee.employee_id);
                v_offs := v_offs || jsonb_build_array(
                    COALESCE(v_employee.detail ->> 'name', '직원')
                );
            END IF;
        END IF;
    END LOOP;

    -- Retain still-valid assignments for base employees who remain off.
    FOR v_assignment IN
        SELECT value
        FROM jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(v_day -> 'subs') = 'array' THEN v_day -> 'subs'
                ELSE '[]'::jsonb
            END
        ) AS a(value)
    LOOP
        v_target_id := COALESCE(v_assignment ->> 'targetBaseId', '');
        v_sub_id := COALESCE(v_assignment ->> 'subId', '');
        IF v_target_id = ANY(v_base_off_ids)
           AND v_sub_id <> ''
           AND NOT (v_sub_id = ANY(v_off_ids))
           AND NOT (v_sub_id = ANY(v_assigned_sub_ids))
           AND EXISTS (
               SELECT 1
               FROM jsonb_each(p_employee_details) AS backup_detail(employee_id, detail)
               WHERE backup_detail.employee_id = v_sub_id
                 AND backup_detail.detail ->> 'type' = 'sub'
                 AND CASE
                       WHEN COALESCE((backup_detail.detail ->> 'restrictBaseIds')::boolean, false)
                       THEN COALESCE(backup_detail.detail -> 'allowedBaseIds', '[]'::jsonb)
                            @> jsonb_build_array(v_target_id)
                       ELSE TRUE
                     END
           ) THEN
            v_assignments := v_assignments || jsonb_build_array(v_assignment);
            v_assigned_sub_ids := array_append(v_assigned_sub_ids, v_sub_id);
        END IF;
    END LOOP;

    -- Assign an available backup to every uncovered base employee off that day.
    FOREACH v_base_id IN ARRAY v_base_off_ids LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(v_assignments) AS a(value)
            WHERE a.value ->> 'targetBaseId' = v_base_id
        ) THEN
            SELECT e.key AS employee_id, e.value AS detail
            INTO v_backup
            FROM jsonb_each(p_employee_details) AS e
            WHERE e.value ->> 'type' = 'sub'
              AND NOT (e.key = ANY(v_off_ids))
              AND NOT (e.key = ANY(v_assigned_sub_ids))
              AND CASE
                    WHEN COALESCE((e.value ->> 'restrictBaseIds')::boolean, false)
                    THEN COALESCE(e.value -> 'allowedBaseIds', '[]'::jsonb)
                         @> jsonb_build_array(v_base_id)
                    ELSE TRUE
                  END
            ORDER BY (
                SELECT count(*)
                FROM jsonb_each(p_schedule) AS schedule_day(day_key, day_record)
                CROSS JOIN LATERAL jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof(schedule_day.day_record -> 'subs') = 'array'
                        THEN schedule_day.day_record -> 'subs'
                        ELSE '[]'::jsonb
                    END
                ) AS assigned(value)
                WHERE assigned.value ->> 'subId' = e.key
            ), e.key
            LIMIT 1;

            IF FOUND THEN
                SELECT COALESCE(e.detail ->> 'name', '직원')
                INTO v_target_id
                FROM jsonb_each(p_employee_details) AS e(employee_id, detail)
                WHERE e.employee_id = v_base_id;

                v_assignments := v_assignments || jsonb_build_array(
                    jsonb_build_object(
                        'subId', v_backup.employee_id,
                        'subName', COALESCE(v_backup.detail ->> 'name', '백업'),
                        'targetBaseId', v_base_id,
                        'targetBaseName', COALESCE(v_target_id, '직원'),
                        'routeName', COALESCE(
                            (SELECT e.detail ->> 'route'
                             FROM jsonb_each(p_employee_details) AS e(employee_id, detail)
                             WHERE e.employee_id = v_base_id),
                            '노선 미지정'
                        ),
                        'score', 0
                    )
                );
                v_assigned_sub_ids := array_append(v_assigned_sub_ids, v_backup.employee_id);
            ELSE
                v_shortage_count := v_shortage_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN p_schedule || jsonb_build_object(
        v_date_key,
        v_day || jsonb_build_object(
            'offEmployeeIds', to_jsonb(v_off_ids),
            'offs', v_offs,
            'subOffs', v_sub_offs,
            'subs', v_assignments,
            'status', CASE WHEN v_shortage_count > 0 THEN 'error' ELSE 'ok' END,
            'lastChangedAt', now()
        )
    );
END;
$function$;

REVOKE ALL ON FUNCTION private.rebuild_organization_schedule_day(jsonb, jsonb, date, jsonb)
    FROM PUBLIC, anon, authenticated;

-- Employee A can select only their own confirmed day off and a coworker B who is off
-- on the requested date in the same team/week.
CREATE OR REPLACE FUNCTION public.list_organization_day_off_members(
    p_source_date date,
    p_target_date date
)
RETURNS TABLE(member_id uuid, member_display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_effective_from date;
    v_week_start date;
    v_schedule public.organization_weekly_schedules%ROWTYPE;
    v_source_day jsonb;
    v_target_day jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;
    IF p_source_date IS NULL OR p_target_date IS NULL OR p_source_date = p_target_date THEN
        RAISE EXCEPTION '교환할 날짜를 확인해주세요.';
    END IF;
    IF p_source_date - EXTRACT(DOW FROM p_source_date)::integer
       <> p_target_date - EXTRACT(DOW FROM p_target_date)::integer THEN
        RAISE EXCEPTION '교환은 같은 주(일~토) 안에서만 가능합니다.';
    END IF;

    SELECT p.organization_id, o.schedule_sync_from
    INTO v_organization_id, v_effective_from
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL OR p_source_date < v_effective_from
       OR p_target_date < v_effective_from THEN
        RAISE EXCEPTION '회사 연동 시작일 이후의 관리자 확정 근무표에서만 교환할 수 있습니다.';
    END IF;

    v_week_start := p_source_date - EXTRACT(DOW FROM p_source_date)::integer;

    SELECT s.*
    INTO v_schedule
    FROM public.organization_weekly_schedules s
    WHERE s.organization_id = v_organization_id
      AND s.week_start = v_week_start
      AND s.status = 'confirmed'
      AND s.employee_details ? v_user_id::text
      AND s.schedule ? p_source_date::text
      AND s.schedule ? p_target_date::text
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION '해당 주의 관리자 확정 근무표가 없거나 직원 정보가 연결되지 않았습니다.';
    END IF;

    v_source_day := v_schedule.schedule -> p_source_date::text;
    v_target_day := v_schedule.schedule -> p_target_date::text;

    IF NOT COALESCE(v_source_day -> 'offEmployeeIds', '[]'::jsonb)
        @> jsonb_build_array(v_user_id::text) THEN
        RAISE EXCEPTION '내가 휴무로 확정된 날짜만 교환 대상으로 선택할 수 있습니다.';
    END IF;

    IF COALESCE(v_target_day -> 'offEmployeeIds', '[]'::jsonb)
        @> jsonb_build_array(v_user_id::text) THEN
        RAISE EXCEPTION '이미 본인의 휴무인 날짜는 교환 대상으로 선택할 수 없습니다.';
    END IF;

    RETURN QUERY
    SELECT e.key::uuid,
           COALESCE(NULLIF(btrim(e.value ->> 'name'), ''), '팀원')::text
    FROM jsonb_each(v_schedule.employee_details) AS e
    WHERE e.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND e.key <> v_user_id::text
      AND COALESCE(v_target_day -> 'offEmployeeIds', '[]'::jsonb)
          @> jsonb_build_array(e.key)
      AND NOT (
          COALESCE(v_source_day -> 'offEmployeeIds', '[]'::jsonb)
          @> jsonb_build_array(e.key)
      )
    ORDER BY COALESCE(NULLIF(btrim(e.value ->> 'name'), ''), '팀원');
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_shift_exchange_request(
    p_receiver_id uuid,
    p_source_date date,
    p_target_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_effective_from date;
    v_week_start date;
    v_schedule public.organization_weekly_schedules%ROWTYPE;
    v_source_day jsonb;
    v_target_day jsonb;
    v_exchange_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;
    IF p_receiver_id IS NULL OR p_source_date IS NULL OR p_target_date IS NULL
       OR p_receiver_id = v_user_id OR p_source_date = p_target_date THEN
        RAISE EXCEPTION '교환 대상과 날짜를 확인해주세요.';
    END IF;
    IF p_source_date - EXTRACT(DOW FROM p_source_date)::integer
       <> p_target_date - EXTRACT(DOW FROM p_target_date)::integer THEN
        RAISE EXCEPTION '교환은 같은 주(일~토) 안에서만 가능합니다.';
    END IF;

    SELECT p.organization_id, o.schedule_sync_from
    INTO v_organization_id, v_effective_from
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL OR p_source_date < v_effective_from
       OR p_target_date < v_effective_from THEN
        RAISE EXCEPTION '회사 연동 시작일 이후의 관리자 확정 근무표에서만 교환할 수 있습니다.';
    END IF;

    v_week_start := p_source_date - EXTRACT(DOW FROM p_source_date)::integer;

    SELECT s.*
    INTO v_schedule
    FROM public.organization_weekly_schedules s
    WHERE s.organization_id = v_organization_id
      AND s.week_start = v_week_start
      AND s.status = 'confirmed'
      AND s.employee_details ? v_user_id::text
      AND s.employee_details ? p_receiver_id::text
      AND s.schedule ? p_source_date::text
      AND s.schedule ? p_target_date::text
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '두 직원이 포함된 해당 주의 확정 근무표를 찾을 수 없습니다.';
    END IF;

    v_source_day := v_schedule.schedule -> p_source_date::text;
    v_target_day := v_schedule.schedule -> p_target_date::text;

    IF NOT COALESCE(v_source_day -> 'offEmployeeIds', '[]'::jsonb)
       @> jsonb_build_array(v_user_id::text) THEN
        RAISE EXCEPTION '내가 휴무로 확정된 날짜만 교환 신청할 수 있습니다.';
    END IF;
    IF NOT COALESCE(v_target_day -> 'offEmployeeIds', '[]'::jsonb)
       @> jsonb_build_array(p_receiver_id::text) THEN
        RAISE EXCEPTION '상대 직원의 희망 날짜 휴무가 확정 근무표에 없습니다.';
    END IF;
    IF COALESCE(v_target_day -> 'offEmployeeIds', '[]'::jsonb)
       @> jsonb_build_array(v_user_id::text)
       OR COALESCE(v_source_day -> 'offEmployeeIds', '[]'::jsonb)
       @> jsonb_build_array(p_receiver_id::text) THEN
        RAISE EXCEPTION '현재 휴무 배정이 변경되어 교환 신청을 할 수 없습니다.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.shift_exchanges x
        WHERE x.requester_id = v_user_id
          AND x.receiver_id = p_receiver_id
          AND x.source_date = p_source_date
          AND x.target_date = p_target_date
          AND x.status = 'pending'
    ) THEN
        RAISE EXCEPTION '같은 교환 신청이 이미 대기 중입니다.';
    END IF;

    INSERT INTO public.shift_exchanges (
        requester_id, receiver_id, team_id, source_date, target_date, status,
        schedule_id, schedule_team_id, schedule_week_start, schedule_version
    ) VALUES (
        v_user_id, p_receiver_id, v_organization_id, p_source_date, p_target_date, 'pending',
        v_schedule.id, v_schedule.team_id, v_schedule.week_start, v_schedule.version
    )
    RETURNING id INTO v_exchange_id;

    RETURN v_exchange_id;
END;
$function$;

-- The prior RPC returned void; drop it before changing its return type to jsonb.
DROP FUNCTION IF EXISTS public.respond_to_shift_exchange(uuid, text);

-- Only the named recipient can accept/reject. Acceptance updates both day records and the
-- schedule version atomically; a stale request is rejected if the two days no longer match.
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
    v_warnings := COALESCE(v_schedule.warnings, '[]'::jsonb);

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

-- Employee creates an additional day-off request for a currently scheduled work day.
CREATE OR REPLACE FUNCTION public.create_extra_day_off_request(
    p_requested_date date,
    p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_effective_from date;
    v_week_start date;
    v_schedule public.organization_weekly_schedules%ROWTYPE;
    v_day jsonb;
    v_request_id uuid;
    v_employee_name text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;
    IF p_requested_date IS NULL THEN
        RAISE EXCEPTION '추가휴무를 요청할 날짜를 선택해주세요.';
    END IF;

    SELECT p.organization_id, o.schedule_sync_from
    INTO v_organization_id, v_effective_from
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사 팀에 가입한 직원 계정에서만 요청할 수 있습니다.';
    END IF;
    IF p_requested_date < v_effective_from THEN
        RAISE EXCEPTION '회사 근무표 연동 시작일 이후 날짜만 요청할 수 있습니다.';
    END IF;

    v_week_start := p_requested_date - EXTRACT(DOW FROM p_requested_date)::integer;

    SELECT s.* INTO v_schedule
    FROM public.organization_weekly_schedules s
    WHERE s.organization_id = v_organization_id
      AND s.week_start = v_week_start
      AND s.status = 'confirmed'
      AND s.employee_details ? v_user_id::text
      AND s.schedule ? p_requested_date::text
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '선택한 날짜에 관리자 확정 근무표가 없습니다.';
    END IF;

    v_day := v_schedule.schedule -> p_requested_date::text;
    IF COALESCE(v_day -> 'offEmployeeIds', '[]'::jsonb)
       @> jsonb_build_array(v_user_id::text) THEN
        RAISE EXCEPTION '이미 휴무로 확정된 날짜입니다. 근무일을 선택해주세요.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.organization_extra_day_off_requests r
        WHERE r.employee_id = v_user_id
          AND r.requested_date = p_requested_date
          AND r.status = 'pending'
    ) THEN
        RAISE EXCEPTION '해당 날짜의 추가휴무 요청이 이미 대기 중입니다.';
    END IF;

    v_employee_name := COALESCE(
        NULLIF(btrim(v_schedule.employee_details -> v_user_id::text ->> 'name'), ''),
        '직원'
    );

    INSERT INTO public.organization_extra_day_off_requests (
        organization_id, schedule_id, team_id, team_label, week_start,
        schedule_version, employee_id, employee_name, requested_date, note
    ) VALUES (
        v_organization_id, v_schedule.id, v_schedule.team_id, v_schedule.team_label,
        v_schedule.week_start, v_schedule.version, v_user_id, v_employee_name,
        p_requested_date, NULLIF(btrim(COALESCE(p_note, '')), '')
    )
    RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_my_extra_day_off_requests()
RETURNS TABLE(
    id uuid,
    requested_date date,
    note text,
    status text,
    created_at timestamptz,
    reviewed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
    SELECT r.id, r.requested_date, r.note, r.status, r.created_at, r.reviewed_at
    FROM public.organization_extra_day_off_requests r
    WHERE r.employee_id = auth.uid()
    ORDER BY r.created_at DESC
    LIMIT 50;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_my_extra_day_off_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
    UPDATE public.organization_extra_day_off_requests
    SET status = 'cancelled'
    WHERE id = p_request_id
      AND employee_id = auth.uid()
      AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION '취소할 수 있는 대기 중인 추가휴무 요청을 찾지 못했습니다.';
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_pending_organization_extra_day_off_requests(
    p_team_id text DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    team_id text,
    team_label text,
    week_start date,
    employee_id uuid,
    employee_name text,
    requested_date date,
    note text,
    status text,
    created_at timestamptz,
    schedule_version integer
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
    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = v_user_id
      AND o.owner_id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '회사 관리자만 직원의 추가휴무 요청을 확인할 수 있습니다.';
    END IF;

    RETURN QUERY
    SELECT r.id, r.team_id, r.team_label, r.week_start,
           r.employee_id, r.employee_name, r.requested_date, r.note,
           r.status, r.created_at, r.schedule_version
    FROM public.organization_extra_day_off_requests r
    WHERE r.organization_id = v_organization_id
      AND r.status = 'pending'
      AND (p_team_id IS NULL OR r.team_id = p_team_id)
    ORDER BY r.created_at ASC;
END;
$function$;

-- The organization owner approves/rejects. Approval updates the confirmed schedule atomically.
-- If no permitted backup remains, the off day is still applied and the returned warning flags
-- the date for manager follow-up rather than blocking approval.
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
    v_warnings := COALESCE(v_schedule.warnings, '[]'::jsonb);
    IF v_has_shortage THEN
        v_warnings := v_warnings || jsonb_build_array(
            '[백업 인원 확인 필요] ' || v_request.requested_date::text ||
            ': 추가휴무 승인 후 백업 배정이 부족합니다. 대체 인력 또는 일정 조정이 필요합니다.'
        );
    END IF;

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

-- Requests are created/responded to through SECURITY DEFINER RPCs only.
REVOKE INSERT, UPDATE ON TABLE public.shift_exchanges FROM authenticated;
GRANT SELECT, DELETE ON TABLE public.shift_exchanges TO authenticated;

REVOKE ALL ON FUNCTION public.list_organization_day_off_members(date, date)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_organization_day_off_members(date, date)
    TO authenticated;

REVOKE ALL ON FUNCTION public.create_shift_exchange_request(uuid, date, date)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_shift_exchange_request(uuid, date, date)
    TO authenticated;

REVOKE ALL ON FUNCTION public.respond_to_shift_exchange(uuid, text)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_shift_exchange(uuid, text)
    TO authenticated;

REVOKE ALL ON FUNCTION public.create_extra_day_off_request(date, text)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_extra_day_off_request(date, text)
    TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_extra_day_off_requests()
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_extra_day_off_requests()
    TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_my_extra_day_off_request(uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_extra_day_off_request(uuid)
    TO authenticated;

REVOKE ALL ON FUNCTION public.list_pending_organization_extra_day_off_requests(text)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_organization_extra_day_off_requests(text)
    TO authenticated;

REVOKE ALL ON FUNCTION public.respond_to_extra_day_off_request(uuid, text)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_extra_day_off_request(uuid, text)
    TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
