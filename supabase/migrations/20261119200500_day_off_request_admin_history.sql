-- Step 3: manager-facing audit history for employee day-off requests.
-- Existing employee-to-employee swap approval and extra-day-off approval workflows
-- continue to run through their current SECURITY DEFINER RPCs.

BEGIN;

CREATE OR REPLACE FUNCTION public.list_my_organization_day_off_request_history(
    p_team_id text DEFAULT NULL,
    p_limit integer DEFAULT 50
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
    v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
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
        RAISE EXCEPTION '회사 대표 계정만 휴무 요청 이력을 조회할 수 있습니다.';
    END IF;

    WITH request_rows AS (
        SELECT
            r.id,
            'extra_day_off'::text AS request_type,
            r.team_id,
            r.team_label,
            r.employee_name AS requester_name,
            NULL::text AS receiver_name,
            r.requested_date::text AS source_date,
            NULL::text AS target_date,
            r.note,
            r.status,
            r.created_at,
            r.reviewed_at AS responded_at
        FROM public.organization_extra_day_off_requests r
        WHERE r.organization_id = v_organization_id
          AND (p_team_id IS NULL OR r.team_id = p_team_id)

        UNION ALL

        SELECT
            x.id,
            'day_off_exchange'::text AS request_type,
            COALESCE(x.schedule_team_id, '') AS team_id,
            COALESCE(s.team_label, x.schedule_team_id, '팀 미확인') AS team_label,
            COALESCE(NULLIF(s.employee_details -> x.requester_id::text ->> 'name', ''), '신청 직원') AS requester_name,
            COALESCE(NULLIF(s.employee_details -> x.receiver_id::text ->> 'name', ''), '상대 직원') AS receiver_name,
            x.source_date::text AS source_date,
            x.target_date::text AS target_date,
            NULL::text AS note,
            COALESCE(x.status, 'pending') AS status,
            x.created_at,
            x.responded_at
        FROM public.shift_exchanges x
        LEFT JOIN public.organization_weekly_schedules s
          ON s.id = x.schedule_id
         AND s.organization_id = v_organization_id
        WHERE x.team_id = v_organization_id
          AND (p_team_id IS NULL OR x.schedule_team_id = p_team_id)
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', entry.id,
                'request_type', entry.request_type,
                'team_id', entry.team_id,
                'team_label', entry.team_label,
                'requester_name', entry.requester_name,
                'receiver_name', entry.receiver_name,
                'source_date', entry.source_date,
                'target_date', entry.target_date,
                'note', entry.note,
                'status', entry.status,
                'created_at', entry.created_at,
                'responded_at', entry.responded_at
            )
            ORDER BY entry.created_at DESC, entry.id DESC
        ),
        '[]'::jsonb
    )
    INTO v_result
    FROM (
        SELECT *
        FROM request_rows
        ORDER BY created_at DESC, id DESC
        LIMIT v_limit
    ) entry;

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_organization_day_off_request_history(text, integer)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_day_off_request_history(text, integer)
    TO authenticated;

COMMIT;
