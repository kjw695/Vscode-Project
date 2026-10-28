-- Team deletion grace period and member-elected ownership transfer.
-- Apply only after reviewing against the live Supabase schema.
-- The client is never allowed to delete organizations directly. All state changes use RPCs.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE TABLE IF NOT EXISTS public.organization_deletion_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    organization_name_snapshot text NOT NULL,
    requested_by uuid NOT NULL,
    requested_at timestamptz NOT NULL,
    scheduled_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'cancelled', 'transferred', 'completed')),
    transferred_to uuid,
    finalized_at timestamptz,
    failure_reason text,
    CONSTRAINT organization_deletion_requests_valid_window
        CHECK (scheduled_at > requested_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_deletion_one_pending_per_team
    ON public.organization_deletion_requests (organization_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS organization_deletion_due_requests
    ON public.organization_deletion_requests (scheduled_at)
    WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.organization_deletion_election_members (
    request_id uuid NOT NULL
        REFERENCES public.organization_deletion_requests(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    display_name_snapshot text NOT NULL,
    is_candidate boolean NOT NULL DEFAULT false,
    candidate_opted_at timestamptz,
    voted_for_user_id uuid,
    voted_at timestamptz,
    PRIMARY KEY (request_id, user_id),
    CONSTRAINT organization_deletion_no_self_vote
        CHECK (voted_for_user_id IS NULL OR voted_for_user_id <> user_id),
    CONSTRAINT organization_deletion_candidate_timestamp
        CHECK (
            (is_candidate AND candidate_opted_at IS NOT NULL)
            OR (NOT is_candidate AND candidate_opted_at IS NULL)
        ),
    CONSTRAINT organization_deletion_vote_timestamp
        CHECK (
            (voted_for_user_id IS NULL AND voted_at IS NULL)
            OR (voted_for_user_id IS NOT NULL AND voted_at IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS organization_deletion_candidates
    ON public.organization_deletion_election_members (request_id, user_id)
    WHERE is_candidate = true;

CREATE INDEX IF NOT EXISTS organization_deletion_votes
    ON public.organization_deletion_election_members (request_id, voted_for_user_id)
    WHERE voted_for_user_id IS NOT NULL;

ALTER TABLE public.organization_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_deletion_election_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.organization_deletion_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.organization_deletion_election_members FROM PUBLIC, anon, authenticated;

-- Return only the current user's team's active deletion/election state.
CREATE OR REPLACE FUNCTION public.get_my_organization_deletion_state()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_organization_name text;
    v_owner_id uuid;
    v_request public.organization_deletion_requests%ROWTYPE;
    v_electorate_count integer := 0;
    v_votes_cast integer := 0;
    v_candidates jsonb := '[]'::jsonb;
    v_my_is_candidate boolean := false;
    v_my_vote_for uuid;
    v_is_eligible_voter boolean := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        RETURN jsonb_build_object('active', false, 'is_owner', false);
    END IF;

    SELECT o.name, o.owner_id
    INTO v_organization_name, v_owner_id
    FROM public.organizations o
    WHERE o.id = v_organization_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('active', false, 'is_owner', false);
    END IF;

    SELECT r.*
    INTO v_request
    FROM public.organization_deletion_requests r
    WHERE r.organization_id = v_organization_id
      AND r.status = 'pending'
    ORDER BY r.requested_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'active', false,
            'is_owner', v_owner_id = v_user_id,
            'organization_id', v_organization_id
        );
    END IF;

    SELECT
        count(*)::integer,
        count(*) FILTER (WHERE m.voted_for_user_id IS NOT NULL)::integer
    INTO v_electorate_count, v_votes_cast
    FROM public.organization_deletion_election_members m
    WHERE m.request_id = v_request.id;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'user_id', candidate.user_id,
                'display_name', candidate.display_name_snapshot,
                'vote_count', candidate.vote_count
            )
            ORDER BY candidate.display_name_snapshot
        ),
        '[]'::jsonb
    )
    INTO v_candidates
    FROM (
        SELECT
            c.user_id,
            c.display_name_snapshot,
            count(v.user_id)::integer AS vote_count
        FROM public.organization_deletion_election_members c
        LEFT JOIN public.organization_deletion_election_members v
          ON v.request_id = c.request_id
         AND v.voted_for_user_id = c.user_id
        WHERE c.request_id = v_request.id
          AND c.is_candidate = true
        GROUP BY c.user_id, c.display_name_snapshot
    ) candidate;

    SELECT
        COALESCE(m.is_candidate, false),
        m.voted_for_user_id,
        (m.user_id IS NOT NULL)
    INTO v_my_is_candidate, v_my_vote_for, v_is_eligible_voter
    FROM (SELECT v_user_id AS user_id) caller
    LEFT JOIN public.organization_deletion_election_members m
      ON m.request_id = v_request.id
     AND m.user_id = caller.user_id;

    RETURN jsonb_build_object(
        'active', true,
        'request_id', v_request.id,
        'organization_id', v_organization_id,
        'organization_name', v_organization_name,
        'owner_id', v_owner_id,
        'is_owner', v_owner_id = v_user_id,
        'requested_at', v_request.requested_at,
        'scheduled_at', v_request.scheduled_at,
        'remaining_seconds', GREATEST(
            0,
            floor(extract(epoch FROM (v_request.scheduled_at - clock_timestamp())))::bigint
        ),
        'electorate_count', v_electorate_count,
        'votes_cast', v_votes_cast,
        'candidates', v_candidates,
        'failure_reason', v_request.failure_reason,
        'my_is_candidate', COALESCE(v_my_is_candidate, false),
        'my_vote_for_user_id', v_my_vote_for,
        'is_eligible_voter', COALESCE(v_is_eligible_voter, false)
    );
END;
$function$;

-- The owner begins the grace period. The eligible electorate is snapshotted at this moment.
CREATE OR REPLACE FUNCTION public.request_organization_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_owner_id uuid;
    v_organization_name text;
    v_now timestamptz;
    v_request_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id
    INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '삭제할 팀에 소속되어 있지 않습니다.';
    END IF;

    -- Joining/leaving operations also lock this row, keeping the electorate stable.
    SELECT o.owner_id, o.name
    INTO v_owner_id, v_organization_name
    FROM public.organizations o
    WHERE o.id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND OR v_owner_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION '팀장만 팀 삭제를 신청할 수 있습니다.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.organization_deletion_requests r
        WHERE r.organization_id = v_organization_id
          AND r.status = 'pending'
    ) THEN
        RAISE EXCEPTION '이미 팀 삭제 신청이 진행 중입니다.';
    END IF;

    v_now := clock_timestamp();

    INSERT INTO public.organization_deletion_requests (
        organization_id,
        organization_name_snapshot,
        requested_by,
        requested_at,
        scheduled_at,
        status
    )
    VALUES (
        v_organization_id,
        v_organization_name,
        v_user_id,
        v_now,
        v_now + interval '7 days',
        'pending'
    )
    RETURNING id INTO v_request_id;

    INSERT INTO public.organization_deletion_election_members (
        request_id,
        user_id,
        display_name_snapshot
    )
    SELECT
        v_request_id,
        p.id,
        COALESCE(
            NULLIF(btrim(p.display_name), ''),
            NULLIF(btrim(p.full_name), ''),
            '팀원'
        )
    FROM public.profiles p
    WHERE p.organization_id = v_organization_id
      AND p.id <> v_owner_id;

    RETURN public.get_my_organization_deletion_state();
END;
$function$;

-- Only the current owner can cancel a pending request.
CREATE OR REPLACE FUNCTION public.cancel_organization_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_owner_id uuid;
    v_request public.organization_deletion_requests%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '현재 소속된 팀이 없습니다.';
    END IF;

    SELECT r.* INTO v_request
    FROM public.organization_deletion_requests r
    WHERE r.organization_id = v_organization_id
      AND r.status = 'pending'
    ORDER BY r.requested_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '취소할 팀 삭제 신청이 없습니다.';
    END IF;

    SELECT o.owner_id INTO v_owner_id
    FROM public.organizations o
    WHERE o.id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND OR v_owner_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION '현재 팀장만 삭제 신청을 취소할 수 있습니다.';
    END IF;

    UPDATE public.organization_deletion_requests
    SET status = 'cancelled',
        finalized_at = clock_timestamp(),
        failure_reason = NULL
    WHERE id = v_request.id;

    DELETE FROM public.organization_deletion_election_members
    WHERE request_id = v_request.id;

    RETURN jsonb_build_object('active', false, 'cancelled', true);
END;
$function$;

-- Any eligible member may volunteer; registration alone does not transfer ownership.
CREATE OR REPLACE FUNCTION public.register_organization_deletion_candidate()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_owner_id uuid;
    v_request public.organization_deletion_requests%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '현재 소속된 팀이 없습니다.';
    END IF;

    SELECT r.* INTO v_request
    FROM public.organization_deletion_requests r
    WHERE r.organization_id = v_organization_id
      AND r.status = 'pending'
    ORDER BY r.requested_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND OR v_request.scheduled_at <= clock_timestamp() THEN
        RAISE EXCEPTION '후보 등록 기간이 끝났거나 진행 중인 선출이 없습니다.';
    END IF;

    SELECT o.owner_id INTO v_owner_id
    FROM public.organizations o
    WHERE o.id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND OR v_owner_id = v_user_id THEN
        RAISE EXCEPTION '현재 팀장은 후보로 등록할 수 없습니다.';
    END IF;

    UPDATE public.organization_deletion_election_members
    SET is_candidate = true,
        candidate_opted_at = clock_timestamp()
    WHERE request_id = v_request.id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '삭제 신청 시점의 투표 대상 팀원만 후보로 등록할 수 있습니다.';
    END IF;

    RETURN public.get_my_organization_deletion_state();
END;
$function$;

-- A vote is immutable. If turnout exceeds half of the snapshotted electorate and a candidate
-- receives more than half of all valid votes, transfer ownership and cancel deletion atomically.
CREATE OR REPLACE FUNCTION public.vote_for_organization_deletion_candidate(
    p_candidate_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_owner_id uuid;
    v_request public.organization_deletion_requests%ROWTYPE;
    v_existing_vote uuid;
    v_electorate_count integer := 0;
    v_votes_cast integer := 0;
    v_winner_id uuid;
    v_winner_name text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_candidate_id IS NULL OR p_candidate_id = v_user_id THEN
        RAISE EXCEPTION '본인이 아닌 팀장 후보를 선택해주세요.';
    END IF;

    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION '현재 소속된 팀이 없습니다.';
    END IF;

    -- Voting and the scheduled finalizer lock the request before the organization.
    SELECT r.* INTO v_request
    FROM public.organization_deletion_requests r
    WHERE r.organization_id = v_organization_id
      AND r.status = 'pending'
    ORDER BY r.requested_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND OR v_request.scheduled_at <= clock_timestamp() THEN
        RAISE EXCEPTION '투표 기간이 끝났거나 진행 중인 선출이 없습니다.';
    END IF;

    SELECT o.owner_id INTO v_owner_id
    FROM public.organizations o
    WHERE o.id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND OR v_owner_id = v_user_id THEN
        RAISE EXCEPTION '현재 팀장은 이 선거에 투표할 수 없습니다.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.organization_deletion_election_members m
        WHERE m.request_id = v_request.id
          AND m.user_id = p_candidate_id
          AND m.is_candidate = true
    ) THEN
        RAISE EXCEPTION '유효한 팀장 후보를 선택해주세요.';
    END IF;

    SELECT m.voted_for_user_id
    INTO v_existing_vote
    FROM public.organization_deletion_election_members m
    WHERE m.request_id = v_request.id
      AND m.user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '삭제 신청 시점의 투표 대상 팀원만 투표할 수 있습니다.';
    END IF;

    IF v_existing_vote IS NOT NULL THEN
        RAISE EXCEPTION '이미 투표했습니다. 한 사람당 한 표만 가능합니다.';
    END IF;

    UPDATE public.organization_deletion_election_members
    SET voted_for_user_id = p_candidate_id,
        voted_at = clock_timestamp()
    WHERE request_id = v_request.id
      AND user_id = v_user_id
      AND voted_for_user_id IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION '투표가 이미 처리되었습니다. 화면을 새로고침해주세요.';
    END IF;

    SELECT
        count(*)::integer,
        count(*) FILTER (WHERE m.voted_for_user_id IS NOT NULL)::integer
    INTO v_electorate_count, v_votes_cast
    FROM public.organization_deletion_election_members m
    WHERE m.request_id = v_request.id;

    IF v_electorate_count > 0 AND v_votes_cast * 2 > v_electorate_count THEN
        SELECT c.user_id, c.display_name_snapshot
        INTO v_winner_id, v_winner_name
        FROM public.organization_deletion_election_members c
        JOIN public.organization_deletion_election_members voter
          ON voter.request_id = c.request_id
         AND voter.voted_for_user_id = c.user_id
        WHERE c.request_id = v_request.id
          AND c.is_candidate = true
        GROUP BY c.user_id, c.display_name_snapshot
        HAVING count(*) * 2 > v_votes_cast
        ORDER BY count(*) DESC
        LIMIT 1;

        IF v_winner_id IS NOT NULL THEN
            UPDATE public.organizations
            SET owner_id = v_winner_id
            WHERE id = v_organization_id
              AND owner_id = v_owner_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION '팀장 권한이 변경되었습니다. 화면을 새로고침해주세요.';
            END IF;

            UPDATE public.organization_deletion_requests
            SET status = 'transferred',
                transferred_to = v_winner_id,
                finalized_at = clock_timestamp(),
                failure_reason = NULL
            WHERE id = v_request.id;

            DELETE FROM public.organization_deletion_election_members
            WHERE request_id = v_request.id;

            RETURN jsonb_build_object(
                'active', false,
                'transferred', true,
                'new_owner_id', v_winner_id,
                'winner_display_name', v_winner_name,
                'message', '새 팀장이 선출되어 팀 삭제 신청이 취소되었습니다.'
            );
        END IF;
    END IF;

    RETURN public.get_my_organization_deletion_state();
END;
$function$;

-- Runs once per minute. Only due requests that have not elected a new owner are deleted.
CREATE OR REPLACE FUNCTION public.process_due_organization_deletions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_request record;
    v_owner_id uuid;
    v_electorate_count integer;
    v_votes_cast integer;
    v_winner_id uuid;
    v_winner_name text;
    v_processed integer := 0;
BEGIN
    FOR v_request IN
        SELECT r.id, r.organization_id
        FROM public.organization_deletion_requests r
        WHERE r.status = 'pending'
          AND r.scheduled_at <= clock_timestamp()
        ORDER BY r.scheduled_at
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            SELECT o.owner_id INTO v_owner_id
            FROM public.organizations o
            WHERE o.id = v_request.organization_id
            FOR UPDATE;

            IF NOT FOUND THEN
                UPDATE public.organization_deletion_requests
                SET status = 'completed',
                    finalized_at = clock_timestamp(),
                    failure_reason = '조직 정보를 찾을 수 없어 삭제 신청을 완료 처리했습니다.'
                WHERE id = v_request.id;

                DELETE FROM public.organization_deletion_election_members
                WHERE request_id = v_request.id;

                v_processed := v_processed + 1;
                CONTINUE;
            END IF;

            SELECT
                count(*)::integer,
                count(*) FILTER (WHERE m.voted_for_user_id IS NOT NULL)::integer
            INTO v_electorate_count, v_votes_cast
            FROM public.organization_deletion_election_members m
            WHERE m.request_id = v_request.id;

            IF v_electorate_count > 0 AND v_votes_cast * 2 > v_electorate_count THEN
                SELECT c.user_id, c.display_name_snapshot
                INTO v_winner_id, v_winner_name
                FROM public.organization_deletion_election_members c
                JOIN public.organization_deletion_election_members voter
                  ON voter.request_id = c.request_id
                 AND voter.voted_for_user_id = c.user_id
                WHERE c.request_id = v_request.id
                  AND c.is_candidate = true
                GROUP BY c.user_id, c.display_name_snapshot
                HAVING count(*) * 2 > v_votes_cast
                ORDER BY count(*) DESC
                LIMIT 1;

                IF v_winner_id IS NOT NULL THEN
                    UPDATE public.organizations
                    SET owner_id = v_winner_id
                    WHERE id = v_request.organization_id
                      AND owner_id = v_owner_id;

                    IF NOT FOUND THEN
                        RAISE EXCEPTION '팀장 권한이 변경되어 자동 선출을 처리할 수 없습니다.';
                    END IF;

                    UPDATE public.organization_deletion_requests
                    SET status = 'transferred',
                        transferred_to = v_winner_id,
                        finalized_at = clock_timestamp(),
                        failure_reason = NULL
                    WHERE id = v_request.id;

                    DELETE FROM public.organization_deletion_election_members
                    WHERE request_id = v_request.id;

                    v_processed := v_processed + 1;
                    CONTINUE;
                END IF;
            END IF;

            DELETE FROM public.shift_exchanges
            WHERE team_id = v_request.organization_id;

            UPDATE public.posts
            SET organization_id = NULL
            WHERE organization_id = v_request.organization_id;

            UPDATE public.profiles
            SET organization_id = NULL
            WHERE organization_id = v_request.organization_id;

            DELETE FROM public.organizations
            WHERE id = v_request.organization_id;

            UPDATE public.organization_deletion_requests
            SET status = 'completed',
                finalized_at = clock_timestamp(),
                failure_reason = NULL
            WHERE id = v_request.id;

            DELETE FROM public.organization_deletion_election_members
            WHERE request_id = v_request.id;

            v_processed := v_processed + 1;
        EXCEPTION
            WHEN OTHERS THEN
                UPDATE public.organization_deletion_requests
                SET failure_reason = left(SQLERRM, 1000)
                WHERE id = v_request.id
                  AND status = 'pending';
        END;
    END LOOP;

    RETURN v_processed;
END;
$function$;

-- Prevent an old installed client from immediately deleting a team through the legacy RPC.
CREATE OR REPLACE FUNCTION public.delete_organization_for_current_user(
    p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_owner_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT o.owner_id INTO v_owner_id
    FROM public.organizations o
    WHERE o.id = p_organization_id;

    IF NOT FOUND OR v_owner_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION '이 팀을 삭제할 권한이 없습니다.';
    END IF;

    RAISE EXCEPTION '즉시 삭제 기능은 중단되었습니다. 앱을 업데이트한 뒤 7일 삭제 신청 기능을 이용해주세요.';
END;
$function$;

-- Block new members and voluntary departures while the electorate is fixed.
CREATE OR REPLACE FUNCTION public.join_organization_by_invite_code(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_org uuid;
    v_org_id uuid;
    v_org public.organizations%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF nullif(btrim(p_invite_code), '') IS NULL THEN
        RAISE EXCEPTION '초대 코드를 입력해주세요.';
    END IF;

    SELECT o.id INTO v_org_id
    FROM public.organizations o
    WHERE o.invite_code = btrim(p_invite_code)
    LIMIT 1;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION '유효하지 않거나 만료된 초대 링크입니다.';
    END IF;

    SELECT o.* INTO v_org
    FROM public.organizations o
    WHERE o.id = v_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '팀 정보를 찾을 수 없습니다.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.organization_deletion_requests r
        WHERE r.organization_id = v_org.id
          AND r.status = 'pending'
    ) THEN
        RAISE EXCEPTION '이 팀은 삭제 유예 및 팀장 선출 중이므로 지금은 가입할 수 없습니다.';
    END IF;

    SELECT p.organization_id INTO v_current_org
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_current_org IS NOT NULL AND v_current_org <> v_org.id THEN
        RAISE EXCEPTION '이미 다른 회사에 소속되어 있습니다. 먼저 기존 소속에서 나가주세요.';
    END IF;

    INSERT INTO public.profiles (id, organization_id)
    VALUES (v_user_id, v_org.id)
    ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

    RETURN jsonb_build_object(
        'id', v_org.id,
        'name', v_org.name,
        'owner_id', v_org.owner_id,
        'invite_code', CASE WHEN v_org.owner_id = v_user_id THEN v_org.invite_code ELSE NULL END,
        'assignment_deadline_day', v_org.assignment_deadline_day,
        'assignment_deadline_time', v_org.assignment_deadline_time
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_organization_for_current_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_owner_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    SELECT p.organization_id INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        RETURN;
    END IF;

    PERFORM 1
    FROM public.organizations o
    WHERE o.id = v_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '팀 정보를 찾을 수 없습니다.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.organization_deletion_requests r
        WHERE r.organization_id = v_organization_id
          AND r.status = 'pending'
    ) THEN
        RAISE EXCEPTION '팀장 선출 및 삭제 유예 기간에는 팀 나가기를 잠시 사용할 수 없습니다.';
    END IF;

    SELECT o.owner_id INTO v_owner_id
    FROM public.organizations o
    WHERE o.id = v_organization_id;

    IF v_owner_id = v_user_id THEN
        RAISE EXCEPTION '팀장은 팀 삭제 신청 또는 팀장 권한 이전 후에 나갈 수 있습니다.';
    END IF;

    UPDATE public.profiles
    SET organization_id = NULL
    WHERE id = v_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_organization_deletion_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_organization_deletion() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_organization_deletion() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_organization_deletion_candidate() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vote_for_organization_deletion_candidate(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_due_organization_deletions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_organization_for_current_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_organization_by_invite_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_organization_for_current_user() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_organization_deletion_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_organization_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_organization_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_organization_deletion_candidate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_for_organization_deletion_candidate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_organization_for_current_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_organization_by_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_organization_for_current_user() TO authenticated;

-- Recreate the named job idempotently. It processes due deletions every minute.
DO $cron$
DECLARE
    v_job_id bigint;
BEGIN
    SELECT j.jobid
    INTO v_job_id
    FROM cron.job j
    WHERE j.jobname = 'process-due-organization-deletions'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
        PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
        'process-due-organization-deletions',
        '* * * * *',
        'SELECT public.process_due_organization_deletions();'
    );
END;
$cron$;

NOTIFY pgrst, 'reload schema';
COMMIT;
