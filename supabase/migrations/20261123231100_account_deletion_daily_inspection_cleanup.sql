-- Account deletion cleanup for daily inspection records and signature versions.
-- Daily records must be removed before their referenced signatures because the
-- composite signature FK intentionally uses ON DELETE RESTRICT.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_user_account_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_organization_id uuid;
BEGIN
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

  SELECT p.organization_id INTO v_organization_id
  FROM public.profiles p
  WHERE p.id = OLD.id
  FOR UPDATE;

  IF v_organization_id IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'ACCOUNT_DELETE_ORGANIZATION_MEMBER',
      DETAIL = '팀 관리에서 먼저 팀 나가기를 완료한 뒤 회원 탈퇴를 진행해주세요.';
  END IF;

  DELETE FROM public.comments c
  WHERE c.user_id = OLD.id
     OR c.post_id IN (SELECT p.id FROM public.posts p WHERE p.user_id = OLD.id);

  DELETE FROM public.likes l
  WHERE l.user_id = OLD.id
     OR l.post_id IN (SELECT p.id FROM public.posts p WHERE p.user_id = OLD.id);

  DELETE FROM public.posts WHERE user_id = OLD.id;
  DELETE FROM public.entries WHERE user_id = OLD.id;
  DELETE FROM public.settings WHERE user_id = OLD.id;
  DELETE FROM public.notifications WHERE user_id = OLD.id;
  DELETE FROM public.camp_return_form_reports WHERE user_id = OLD.id;

  -- Daily inspection records reference signature versions with ON DELETE RESTRICT.
  -- Delete child records first, then the account's reusable signature versions.
  DELETE FROM public.daily_inspection_records
  WHERE user_id = OLD.id;

  DELETE FROM public.daily_inspection_signatures
  WHERE user_id = OLD.id;

  DELETE FROM public.shift_exchanges
  WHERE status = 'pending'
    AND (requester_id = OLD.id OR receiver_id = OLD.id);

  UPDATE public.shift_exchanges SET requester_id = NULL WHERE requester_id = OLD.id;
  UPDATE public.shift_exchanges SET receiver_id = NULL WHERE receiver_id = OLD.id;

  UPDATE public.organization_admin_state SET updated_by = NULL WHERE updated_by = OLD.id;
  UPDATE public.organization_admin_state_backups SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE public.organization_weekly_schedules SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE public.organization_weekly_schedules SET updated_by = NULL WHERE updated_by = OLD.id;
  UPDATE public.organization_weekly_schedule_revisions SET captured_by = NULL WHERE captured_by = OLD.id;
  UPDATE public.organization_schedule_change_history SET actor_id = NULL WHERE actor_id = OLD.id;
  UPDATE public.organization_extra_day_off_requests SET reviewed_by = NULL WHERE reviewed_by = OLD.id;

  -- Preserve organization deletion history but remove direct account identifiers.
  UPDATE public.organization_deletion_requests
     SET requested_by = NULL
   WHERE requested_by = OLD.id;

  UPDATE public.organization_deletion_requests
     SET transferred_to = NULL
   WHERE transferred_to = OLD.id;

  UPDATE public.organization_deletion_election_members
     SET voted_for_user_id = NULL,
         voted_at = NULL
   WHERE voted_for_user_id = OLD.id;

  DELETE FROM public.organization_deletion_election_members
  WHERE user_id = OLD.id;

  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_user_account_deletion()
  FROM PUBLIC, anon, authenticated;

COMMIT;
