-- Secure direct-request workflow for the existing public.shift_exchanges table.
-- Do NOT run until this file and the app changes have been reviewed and tested.
-- The existing schema stores each user's day-off as an entries row tagged with memo '[휴무]'
-- and/or custom_items containing {"key":"dayOff"}.

BEGIN;

-- Stop safely if legacy duplicate day-off records still exist.
-- Never delete existing user data automatically during migration.
DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.entries e
        WHERE
            COALESCE(e.memo, '') = '[휴무]'
            OR COALESCE(e.custom_items, '[]'::jsonb)
               @> '[{"key":"dayOff"}]'::jsonb
        GROUP BY e.user_id, e.date
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            '중복 휴무 기록이 있습니다. 데이터를 확인하고 정리한 뒤 마이그레이션을 진행해주세요.';
    END IF;
END;
$migration$;

-- Rebuild the unique index using precise day-off criteria.
DROP INDEX IF EXISTS public.entries_unique_day_off_per_user_date_idx;

CREATE UNIQUE INDEX entries_unique_day_off_per_user_date_idx
ON public.entries (user_id, date)
WHERE (
    COALESCE(memo, '') = '[휴무]'
    OR COALESCE(custom_items, '[]'::jsonb)
       @> '[{"key":"dayOff"}]'::jsonb
);
-- Direct REST inserts/updates cannot enforce the full atomic exchange workflow.
-- Creation and response must go through the RPCs defined below.
REVOKE INSERT ON TABLE public.shift_exchanges FROM authenticated;
REVOKE UPDATE ON TABLE public.shift_exchanges FROM authenticated;
REVOKE UPDATE (status) ON TABLE public.shift_exchanges FROM authenticated;
GRANT SELECT, DELETE ON TABLE public.shift_exchanges TO authenticated;

DROP POLICY IF EXISTS "shift_exchanges_same_org_insert" ON public.shift_exchanges;
DROP POLICY IF EXISTS "shift_exchanges_receiver_status_update" ON public.shift_exchanges;

-- Return only eligible exchange recipients for the caller's organization.
DROP FUNCTION IF EXISTS public.list_organization_day_off_members(date);

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
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_source_date IS NULL OR p_target_date IS NULL THEN
        RAISE EXCEPTION '교환할 두 날짜를 모두 선택해주세요.';
    END IF;

    IF p_source_date - EXTRACT(DOW FROM p_source_date)::integer
       <> p_target_date - EXTRACT(DOW FROM p_target_date)::integer THEN
        RAISE EXCEPTION '교환은 같은 주(일~토) 안에서만 가능합니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        RETURN;
    END IF;

    -- The caller must have an actual day-off on the source date.
    IF NOT EXISTS (
        SELECT 1
        FROM public.entries e
        WHERE e.user_id = v_user_id
          AND e.date = p_source_date
          AND (
              COALESCE(e.memo, '') = '[휴무]'
              OR COALESCE(e.custom_items, '[]'::jsonb)
                 @> '[{"key":"dayOff"}]'::jsonb
          )
    ) THEN
        RAISE EXCEPTION '먼저 본인의 등록된 휴무일을 선택해주세요.';
    END IF;

    -- The caller cannot receive a date that is already their day-off.
    IF EXISTS (
        SELECT 1
        FROM public.entries e
        WHERE e.user_id = v_user_id
          AND e.date = p_target_date
          AND (
              COALESCE(e.memo, '') = '[휴무]'
              OR COALESCE(e.custom_items, '[]'::jsonb)
                 @> '[{"key":"dayOff"}]'::jsonb
          )
    ) THEN
        RAISE EXCEPTION '이미 본인의 휴무인 날짜는 교환 대상으로 선택할 수 없습니다.';
    END IF;

    -- Return only coworkers off on the target date who can receive source_date.
    RETURN QUERY
    SELECT
        p.id,
        COALESCE(
            NULLIF(btrim(p.display_name), ''),
            NULLIF(btrim(p.full_name), ''),
            '팀원'
        )::text
    FROM public.profiles p
    WHERE p.organization_id = v_organization_id
      AND p.id <> v_user_id
      AND EXISTS (
          SELECT 1
          FROM public.entries e
          WHERE e.user_id = p.id
            AND e.date = p_target_date
            AND (
                COALESCE(e.memo, '') = '[휴무]'
                OR COALESCE(e.custom_items, '[]'::jsonb)
                   @> '[{"key":"dayOff"}]'::jsonb
            )
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.entries e
          WHERE e.user_id = p.id
            AND e.date = p_source_date
            AND (
                COALESCE(e.memo, '') = '[휴무]'
                OR COALESCE(e.custom_items, '[]'::jsonb)
                   @> '[{"key":"dayOff"}]'::jsonb
            )
      )
    ORDER BY COALESCE(
        NULLIF(btrim(p.display_name), ''),
        NULLIF(btrim(p.full_name), ''),
        '팀원'
    );
END;
$function$;



-- Create a direct request only when both users have the relevant saved day-off entries.
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
    v_receiver_organization_id uuid;
    v_exchange_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_receiver_id IS NULL OR p_source_date IS NULL OR p_target_date IS NULL THEN
        RAISE EXCEPTION '교환 대상과 두 날짜를 모두 확인해주세요.';
    END IF;

    IF p_receiver_id = v_user_id OR p_source_date = p_target_date THEN
        RAISE EXCEPTION '본인 또는 같은 날짜와는 교환할 수 없습니다.';
    END IF;

    -- The app's rule is exchange within the same Sunday-to-Saturday week.
    IF p_source_date - EXTRACT(DOW FROM p_source_date)::integer
       <> p_target_date - EXTRACT(DOW FROM p_target_date)::integer THEN
        RAISE EXCEPTION '교환은 같은 주(일~토) 안에서만 가능합니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    SELECT p.organization_id
    INTO v_receiver_organization_id
    FROM public.profiles p
    WHERE p.id = p_receiver_id;

    IF v_organization_id IS NULL OR v_receiver_organization_id IS DISTINCT FROM v_organization_id THEN
        RAISE EXCEPTION '같은 회사 팀원끼리만 교환할 수 있습니다.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entries e
        WHERE e.user_id = v_user_id
          AND e.date = p_source_date
          AND (COALESCE(e.memo, '') = '[휴무]' OR COALESCE(e.custom_items, '[]'::jsonb) @> '[{"key":"dayOff"}]'::jsonb)
    ) THEN
        RAISE EXCEPTION '내놓을 날짜에 본인의 휴무가 저장되어 있지 않습니다.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entries e
        WHERE e.user_id = p_receiver_id
          AND e.date = p_target_date
          AND (COALESCE(e.memo, '') = '[휴무]' OR COALESCE(e.custom_items, '[]'::jsonb) @> '[{"key":"dayOff"}]'::jsonb)
    ) THEN
        RAISE EXCEPTION '상대방의 희망 날짜 휴무가 더 이상 확인되지 않습니다.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.entries e
        WHERE e.user_id = v_user_id
          AND e.date = p_target_date
          AND (COALESCE(e.memo, '') = '[휴무]' OR COALESCE(e.custom_items, '[]'::jsonb) @> '[{"key":"dayOff"}]'::jsonb)
    ) OR EXISTS (
        SELECT 1 FROM public.entries e
        WHERE e.user_id = p_receiver_id
          AND e.date = p_source_date
          AND (COALESCE(e.memo, '') = '[휴무]' OR COALESCE(e.custom_items, '[]'::jsonb) @> '[{"key":"dayOff"}]'::jsonb)
    ) THEN
        RAISE EXCEPTION '교환 후 중복 휴무가 생길 수 있어 신청할 수 없습니다.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.shift_exchanges s
        WHERE s.requester_id = v_user_id
          AND s.receiver_id = p_receiver_id
          AND s.source_date = p_source_date
          AND s.target_date = p_target_date
          AND s.status = 'pending'
    ) THEN
        RAISE EXCEPTION '같은 교환 신청이 이미 대기 중입니다.';
    END IF;

    INSERT INTO public.shift_exchanges (
        requester_id, receiver_id, team_id, source_date, target_date, status
    ) VALUES (
        v_user_id, p_receiver_id, v_organization_id, p_source_date, p_target_date, 'pending'
    )
    RETURNING id INTO v_exchange_id;

    RETURN v_exchange_id;
END;
$function$;


-- A recipient may decline a request or accept it. Acceptance swaps the two saved day-off dates
-- and changes the request status in the same transaction.
CREATE OR REPLACE FUNCTION public.respond_to_shift_exchange(
    p_exchange_id uuid,
    p_response text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_response text := lower(btrim(COALESCE(p_response, '')));
    v_exchange public.shift_exchanges%ROWTYPE;
    v_user_organization_id uuid;
    v_source_count integer;
    v_target_count integer;
    v_source_entry_id uuid;
    v_target_entry_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF v_response NOT IN ('accepted', 'declined') THEN
        RAISE EXCEPTION '응답은 accepted 또는 declined만 허용됩니다.';
    END IF;

    SELECT s.*
    INTO v_exchange
    FROM public.shift_exchanges s
    WHERE s.id = p_exchange_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '교환 신청을 찾을 수 없습니다.';
    END IF;

    IF v_exchange.receiver_id <> v_user_id OR v_exchange.status <> 'pending' THEN
        RAISE EXCEPTION '이 교환 신청에 응답할 권한이 없거나 이미 처리되었습니다.';
    END IF;

    SELECT p.organization_id
    INTO v_user_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_user_organization_id IS NULL OR v_user_organization_id <> v_exchange.team_id
       OR NOT EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = v_exchange.requester_id
              AND p.organization_id = v_exchange.team_id
       ) THEN
        RAISE EXCEPTION '현재 같은 회사에 소속된 사용자끼리의 신청만 처리할 수 있습니다.';
    END IF;

    IF v_response = 'declined' THEN
        UPDATE public.shift_exchanges
        SET status = 'declined'
        WHERE id = v_exchange.id;
        RETURN;
    END IF;

    -- Lock both users in a consistent order.
PERFORM 1
FROM public.profiles p
WHERE p.id IN (
    v_exchange.requester_id,
    v_exchange.receiver_id
)
ORDER BY p.id
FOR UPDATE;

-- Lock existing day-off records before validating them.
PERFORM 1
FROM public.entries e
WHERE (
    (
        e.user_id = v_exchange.requester_id
        AND e.date IN (
            v_exchange.source_date,
            v_exchange.target_date
        )
    )
    OR
    (
        e.user_id = v_exchange.receiver_id
        AND e.date IN (
            v_exchange.source_date,
            v_exchange.target_date
        )
    )
)
AND (
    COALESCE(e.memo, '') = '[휴무]'
    OR COALESCE(e.custom_items, '[]'::jsonb)
       @> '[{"key":"dayOff"}]'::jsonb
)
ORDER BY e.user_id, e.id
FOR UPDATE;

-- Confirm exactly one day-off record exists for each exchanged date.
SELECT count(*)
INTO v_source_count
FROM public.entries e
WHERE e.user_id = v_exchange.requester_id
  AND e.date = v_exchange.source_date
  AND (
      COALESCE(e.memo, '') = '[휴무]'
      OR COALESCE(e.custom_items, '[]'::jsonb)
         @> '[{"key":"dayOff"}]'::jsonb
  );

SELECT count(*)
INTO v_target_count
FROM public.entries e
WHERE e.user_id = v_exchange.receiver_id
  AND e.date = v_exchange.target_date
  AND (
      COALESCE(e.memo, '') = '[휴무]'
      OR COALESCE(e.custom_items, '[]'::jsonb)
         @> '[{"key":"dayOff"}]'::jsonb
  );

IF v_source_count <> 1 OR v_target_count <> 1 THEN
    RAISE EXCEPTION
        '두 사람의 해당 날짜 휴무가 각각 하나씩 저장되어 있어야 교환할 수 있습니다.';
END IF;

-- Prevent duplicate day-offs after the swap.
IF EXISTS (
    SELECT 1
    FROM public.entries e
    WHERE e.user_id = v_exchange.requester_id
      AND e.date = v_exchange.target_date
      AND (
          COALESCE(e.memo, '') = '[휴무]'
          OR COALESCE(e.custom_items, '[]'::jsonb)
             @> '[{"key":"dayOff"}]'::jsonb
      )
) OR EXISTS (
    SELECT 1
    FROM public.entries e
    WHERE e.user_id = v_exchange.receiver_id
      AND e.date = v_exchange.source_date
      AND (
          COALESCE(e.memo, '') = '[휴무]'
          OR COALESCE(e.custom_items, '[]'::jsonb)
             @> '[{"key":"dayOff"}]'::jsonb
      )
) THEN
    RAISE EXCEPTION
        '휴무 날짜가 변경되어 중복 휴무가 생길 수 있습니다. 최신 달력을 확인해주세요.';
END IF;

-- Retrieve the validated, locked entry IDs.
SELECT e.id
INTO v_source_entry_id
FROM public.entries e
WHERE e.user_id = v_exchange.requester_id
  AND e.date = v_exchange.source_date
  AND (
      COALESCE(e.memo, '') = '[휴무]'
      OR COALESCE(e.custom_items, '[]'::jsonb)
         @> '[{"key":"dayOff"}]'::jsonb
  )
ORDER BY e.id
LIMIT 1;

SELECT e.id
INTO v_target_entry_id
FROM public.entries e
WHERE e.user_id = v_exchange.receiver_id
  AND e.date = v_exchange.target_date
  AND (
      COALESCE(e.memo, '') = '[휴무]'
      OR COALESCE(e.custom_items, '[]'::jsonb)
         @> '[{"key":"dayOff"}]'::jsonb
  )
ORDER BY e.id
LIMIT 1;

IF v_source_entry_id IS NULL OR v_target_entry_id IS NULL THEN
    RAISE EXCEPTION
        '교환할 휴무 기록이 변경되었습니다. 최신 달력을 확인해주세요.';
END IF;

    UPDATE public.entries
    SET date = v_exchange.target_date
    WHERE id = v_source_entry_id AND user_id = v_exchange.requester_id;

    UPDATE public.entries
    SET date = v_exchange.source_date
    WHERE id = v_target_entry_id AND user_id = v_exchange.receiver_id;

    UPDATE public.shift_exchanges
    SET status = 'accepted'
    WHERE id = v_exchange.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_organization_day_off_members(date, date)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_organization_day_off_members(date, date)
TO authenticated;

REVOKE ALL ON FUNCTION public.create_shift_exchange_request(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_shift_exchange_request(uuid, date, date) TO authenticated;

REVOKE ALL ON FUNCTION public.respond_to_shift_exchange(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_shift_exchange(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
