-- Account deletion safeguards and user-owned data cleanup.
-- Company data is protected: account deletion is allowed only after the user
-- has left their organization and any organization ownership has been transferred.

BEGIN;

-- Preserve company-wide audit records while removing the deleted user's identity.
ALTER TABLE public.organization_schedule_change_history
    ALTER COLUMN actor_id DROP NOT NULL;

ALTER TABLE public.organization_weekly_schedules
    ALTER COLUMN created_by DROP NOT NULL,
    ALTER COLUMN updated_by DROP NOT NULL;

-- Keep completed exchange history but anonymize the deleted participant.
ALTER TABLE public.shift_exchanges
    ALTER COLUMN requester_id DROP NOT NULL,
    ALTER COLUMN receiver_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_user_account_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_organization_id uuid;
BEGIN
    -- Never orphan an organization by deleting its current owner.
    PERFORM 1
    FROM public.organizations o
    WHERE o.owner_id = OLD.id
    FOR UPDATE;

    IF FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'ACCOUNT_DELETE_OWNER_TRANSFER_REQUIRED',
            DETAIL = '회사 소유권을 다른 관리자에게 이전한 뒤 회원 탈퇴를 진행해주세요.';
    END IF;

    -- A member must explicitly leave the organization first. This preserves
    -- the existing team removal and schedule handover workflow.
    SELECT p.organization_id
      INTO v_organization_id
    FROM public.profiles p
    WHERE p.id = OLD.id
    FOR UPDATE;

    IF v_organization_id IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'ACCOUNT_DELETE_ORGANIZATION_MEMBER',
            DETAIL = '팀 관리에서 먼저 팀 나가기를 완료한 뒤 회원 탈퇴를 진행해주세요.';
    END IF;

    -- Remove comments and reactions authored by this account, including
    -- records attached to posts that will also be removed below.
    DELETE FROM public.comments c
    WHERE c.user_id = OLD.id
       OR c.post_id IN (
            SELECT p.id
            FROM public.posts p
            WHERE p.user_id = OLD.id
       );

    DELETE FROM public.likes l
    WHERE l.user_id = OLD.id
       OR l.post_id IN (
            SELECT p.id
            FROM public.posts p
            WHERE p.user_id = OLD.id
       );

    DELETE FROM public.posts
    WHERE user_id = OLD.id;

    -- Remove private account records.
    DELETE FROM public.entries WHERE user_id = OLD.id;
    DELETE FROM public.settings WHERE user_id = OLD.id;
    DELETE FROM public.notifications WHERE user_id = OLD.id;

    -- Analysis reports may contain the account email and submitted form URL.
    DELETE FROM public.camp_return_form_reports WHERE user_id = OLD.id;

    -- Pending exchanges cannot remain actionable after a participant leaves.
    DELETE FROM public.shift_exchanges
    WHERE status = 'pending'
      AND (requester_id = OLD.id OR receiver_id = OLD.id);

    -- Retain completed exchange history but remove the account identity.
    UPDATE public.shift_exchanges
       SET requester_id = NULL
     WHERE requester_id = OLD.id;

    UPDATE public.shift_exchanges
       SET receiver_id = NULL
     WHERE receiver_id = OLD.id;

    -- Retain company-wide schedule/audit snapshots while anonymizing actor IDs.
    UPDATE public.organization_admin_state
       SET updated_by = NULL
     WHERE updated_by = OLD.id;

    UPDATE public.organization_admin_state_backups
       SET created_by = NULL
     WHERE created_by = OLD.id;

    UPDATE public.organization_weekly_schedules
       SET created_by = NULL
     WHERE created_by = OLD.id;

    UPDATE public.organization_weekly_schedules
       SET updated_by = NULL
     WHERE updated_by = OLD.id;

    UPDATE public.organization_weekly_schedule_revisions
       SET captured_by = NULL
     WHERE captured_by = OLD.id;

    UPDATE public.organization_schedule_change_history
       SET actor_id = NULL
     WHERE actor_id = OLD.id;

    UPDATE public.organization_extra_day_off_requests
       SET reviewed_by = NULL
     WHERE reviewed_by = OLD.id;

    -- These rows reference auth.users with ON DELETE CASCADE or are explicitly
    -- removed above. Delete the profile to satisfy its NO ACTION foreign key.
    DELETE FROM public.profiles
    WHERE id = OLD.id;

    RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_user_account_deletion()
    FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS before_auth_user_account_deletion
    ON auth.users;

CREATE TRIGGER before_auth_user_account_deletion
BEFORE DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_account_deletion();

COMMIT;
