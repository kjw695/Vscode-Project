-- Phase 2: shared weekly schedule templates, copy, version history and restore.
-- Depends on organization_weekly_schedules from 20261101_organization_weekly_schedule_sync.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS public.organization_weekly_schedule_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 schedule_id uuid NOT NULL REFERENCES public.organization_weekly_schedules(id) ON DELETE CASCADE,
 team_id text NOT NULL, team_label text NOT NULL DEFAULT '',
 week_start date NOT NULL, week_end date NOT NULL,
 version integer NOT NULL CHECK(version>0),
 status text NOT NULL CHECK(status IN ('draft','confirmed')),
 schedule jsonb NOT NULL CHECK(jsonb_typeof(schedule)='object'),
 employee_details jsonb NOT NULL CHECK(jsonb_typeof(employee_details)='object'),
 warnings jsonb NOT NULL CHECK(jsonb_typeof(warnings)='array'),
 change_type text NOT NULL DEFAULT 'updated'
   CHECK(change_type IN ('created','draft_saved','confirmed','reopened','updated','restored')),
 restored_from_history_id uuid REFERENCES public.organization_weekly_schedule_history(id) ON DELETE SET NULL,
 changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_weekly_schedule_history_lookup_idx
 ON public.organization_weekly_schedule_history(organization_id,team_id,week_start,created_at DESC);
ALTER TABLE public.organization_weekly_schedule_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.organization_weekly_schedule_history FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.organization_schedule_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 team_id text NOT NULL, team_label text NOT NULL DEFAULT '',
 template_name text NOT NULL CHECK(char_length(template_name) BETWEEN 1 AND 40),
 schedule jsonb NOT NULL CHECK(jsonb_typeof(schedule)='object'),
 warnings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(warnings)='array'),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,team_id,template_name)
);
CREATE INDEX IF NOT EXISTS organization_schedule_templates_team_idx
 ON public.organization_schedule_templates(organization_id,team_id,updated_at DESC);
ALTER TABLE public.organization_schedule_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.organization_schedule_templates FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.capture_organization_weekly_schedule_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
DECLARE v_restore uuid; v_kind text;
BEGIN
 BEGIN
  v_restore := NULLIF(current_setting('app.schedule_restore_history_id',true),'')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN v_restore := NULL;
 END;
 IF v_restore IS NOT NULL THEN v_kind := 'restored';
 ELSIF TG_OP='INSERT' THEN v_kind := CASE WHEN NEW.status='confirmed' THEN 'confirmed' ELSE 'created' END;
 ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='confirmed' THEN v_kind := 'confirmed';
 ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='draft' THEN v_kind := 'reopened';
 ELSIF NEW.status='draft' THEN v_kind := 'draft_saved';
 ELSE v_kind := 'updated';
 END IF;
 INSERT INTO public.organization_weekly_schedule_history(
  organization_id,schedule_id,team_id,team_label,week_start,week_end,version,status,
  schedule,employee_details,warnings,change_type,restored_from_history_id,changed_by
 ) VALUES(
  NEW.organization_id,NEW.id,NEW.team_id,NEW.team_label,NEW.week_start,NEW.week_end,
  NEW.version,NEW.status,NEW.schedule,NEW.employee_details,NEW.warnings,v_kind,v_restore,NEW.updated_by
 );
 DELETE FROM public.organization_weekly_schedule_history h
 WHERE h.schedule_id=NEW.id AND h.id NOT IN(
  SELECT x.id FROM public.organization_weekly_schedule_history x
  WHERE x.schedule_id=NEW.id ORDER BY x.created_at DESC,x.id DESC LIMIT 100
 );
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS organization_weekly_schedule_history_capture ON public.organization_weekly_schedules;
REVOKE ALL ON FUNCTION public.capture_organization_weekly_schedule_history() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER organization_weekly_schedule_history_capture
AFTER INSERT OR UPDATE ON public.organization_weekly_schedules
FOR EACH ROW EXECUTE FUNCTION public.capture_organization_weekly_schedule_history();

CREATE OR REPLACE FUNCTION public.save_my_organization_weekly_schedule_v2(
 p_team_id text,p_team_label text,p_week_start date,p_week_end date,p_status text,
 p_schedule jsonb,p_employee_details jsonb,p_warnings jsonb,p_expected_version integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
DECLARE v_user uuid:=auth.uid(); v_org uuid; v_from date; v_row public.organization_weekly_schedules%ROWTYPE;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
 IF p_team_id IS NULL OR btrim(p_team_id)='' OR p_week_start IS NULL OR
    EXTRACT(DOW FROM p_week_start)<>0 OR p_week_end IS DISTINCT FROM p_week_start+6 THEN
  RAISE EXCEPTION '팀 정보와 일요일부터 토요일까지의 7일 근무표를 확인해주세요.';
 END IF;
 IF p_status NOT IN ('draft','confirmed') OR jsonb_typeof(p_schedule) IS DISTINCT FROM 'object' OR
    jsonb_typeof(p_employee_details) IS DISTINCT FROM 'object' OR jsonb_typeof(p_warnings) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION '근무표 데이터 형식이 올바르지 않습니다.';
 END IF;
 IF p_expected_version IS NULL OR p_expected_version<0 THEN RAISE EXCEPTION '근무표 버전 정보가 올바르지 않습니다.'; END IF;
 IF pg_column_size(p_schedule)+pg_column_size(p_employee_details)+pg_column_size(p_warnings)>800000 THEN
  RAISE EXCEPTION '근무표 데이터가 허용 크기(약 800KB)를 초과했습니다.';
 END IF;
 SELECT p.organization_id INTO v_org FROM public.profiles p WHERE p.id=v_user;
 IF v_org IS NULL THEN RAISE EXCEPTION '회사 소속 관리자 계정만 근무표를 저장할 수 있습니다.'; END IF;
 SELECT o.schedule_sync_from INTO v_from FROM public.organizations o WHERE o.id=v_org;
 IF v_from IS NULL OR p_week_end<v_from THEN RAISE EXCEPTION '연동 시작일 이전의 근무표는 공유 저장할 수 없습니다.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=v_org AND o.owner_id=v_user) THEN
  RAISE EXCEPTION '회사 대표 계정만 근무표를 저장할 수 있습니다.';
 END IF;
 IF p_status='confirmed' AND p_employee_details='{}'::jsonb THEN RAISE EXCEPTION '직원 정보가 없는 근무표는 확정할 수 없습니다.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(v_org::text||':'||btrim(p_team_id)||':'||p_week_start::text));
 SELECT s.* INTO v_row FROM public.organization_weekly_schedules s
 WHERE s.organization_id=v_org AND s.team_id=btrim(p_team_id) AND s.week_start=p_week_start FOR UPDATE;
 IF NOT FOUND THEN
  IF p_expected_version<>0 THEN RAISE EXCEPTION '근무표가 다른 기기에서 변경되었습니다. 최신 근무표를 다시 불러와주세요.' USING ERRCODE='40001'; END IF;
  INSERT INTO public.organization_weekly_schedules(
   organization_id,team_id,team_label,week_start,week_end,status,version,schedule,
   employee_details,warnings,created_by,updated_by,confirmed_at,updated_at
  ) VALUES(
   v_org,btrim(p_team_id),COALESCE(NULLIF(btrim(p_team_label),''),btrim(p_team_id)),
   p_week_start,p_week_end,p_status,1,p_schedule,p_employee_details,p_warnings,v_user,v_user,
   CASE WHEN p_status='confirmed' THEN now() ELSE NULL END,now()
  ) RETURNING * INTO v_row;
 ELSE
  IF v_row.version<>p_expected_version THEN RAISE EXCEPTION '근무표가 다른 기기에서 변경되었습니다. 최신 근무표를 다시 불러와주세요.' USING ERRCODE='40001'; END IF;
  UPDATE public.organization_weekly_schedules SET
   team_label=COALESCE(NULLIF(btrim(p_team_label),''),btrim(p_team_id)),week_end=p_week_end,status=p_status,
   version=version+1,schedule=p_schedule,employee_details=p_employee_details,warnings=p_warnings,
   updated_by=v_user,confirmed_at=CASE WHEN p_status='confirmed' THEN now() ELSE NULL END,updated_at=now()
  WHERE id=v_row.id RETURNING * INTO v_row;
 END IF;
 RETURN jsonb_build_object(
  'id',v_row.id,'team_id',v_row.team_id,'team_label',v_row.team_label,'week_start',v_row.week_start,
  'week_end',v_row.week_end,'status',v_row.status,'version',v_row.version,'confirmed_at',v_row.confirmed_at,
  'updated_at',v_row.updated_at,'schedule',v_row.schedule,'employee_details',v_row.employee_details,'warnings',v_row.warnings
 );
END;
$function$;
REVOKE ALL ON FUNCTION public.save_my_organization_weekly_schedule_v2(text,text,date,date,text,jsonb,jsonb,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_my_organization_weekly_schedule_v2(text,text,date,date,text,jsonb,jsonb,jsonb,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_organization_weekly_schedule_history(p_team_id text,p_week_start date,p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid,schedule_id uuid,team_id text,team_label text,week_start date,version integer,status text,change_type text,created_at timestamptz,changed_by uuid,employees_count integer,warnings_count integer,restored_from_history_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
DECLARE v_user uuid:=auth.uid(); v_org uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
 SELECT p.organization_id INTO v_org FROM public.profiles p WHERE p.id=v_user;
 IF v_org IS NULL OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=v_org AND o.owner_id=v_user) THEN
  RAISE EXCEPTION '회사 대표 계정만 근무표 변경 이력을 조회할 수 있습니다.';
 END IF;
 RETURN QUERY SELECT h.id,h.schedule_id,h.team_id,h.team_label,h.week_start,h.version,h.status,h.change_type,h.created_at,h.changed_by,
  (SELECT count(*)::integer FROM jsonb_object_keys(h.employee_details)),jsonb_array_length(h.warnings),h.restored_from_history_id
 FROM public.organization_weekly_schedule_history h
 WHERE h.organization_id=v_org AND h.team_id=p_team_id AND h.week_start=p_week_start
 ORDER BY h.created_at DESC,h.id DESC LIMIT GREATEST(1,LEAST(COALESCE(p_limit,50),100));
END;
$function$;
REVOKE ALL ON FUNCTION public.list_my_organization_weekly_schedule_history(text,date,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_weekly_schedule_history(text,date,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_organization_weekly_schedule_history(p_history_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
DECLARE v_user uuid:=auth.uid(); v_org uuid; v_row public.organization_weekly_schedule_history%ROWTYPE;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
 SELECT p.organization_id INTO v_org FROM public.profiles p WHERE p.id=v_user;
 IF v_org IS NULL OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=v_org AND o.owner_id=v_user) THEN
  RAISE EXCEPTION '회사 대표 계정만 근무표 이력을 조회할 수 있습니다.';
 END IF;
 SELECT h.* INTO v_row FROM public.organization_weekly_schedule_history h WHERE h.id=p_history_id AND h.organization_id=v_org;
 IF NOT FOUND THEN RAISE EXCEPTION '해당 근무표 이력을 찾을 수 없습니다.'; END IF;
 RETURN jsonb_build_object('id',v_row.id,'schedule_id',v_row.schedule_id,'team_id',v_row.team_id,'team_label',v_row.team_label,
  'week_start',v_row.week_start,'week_end',v_row.week_end,'version',v_row.version,'status',v_row.status,
  'change_type',v_row.change_type,'created_at',v_row.created_at,'schedule',v_row.schedule,
  'employee_details',v_row.employee_details,'warnings',v_row.warnings,'restored_from_history_id',v_row.restored_from_history_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_my_organization_weekly_schedule_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_weekly_schedule_history(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_my_organization_weekly_schedule_history(p_history_id uuid,p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
DECLARE v_user uuid:=auth.uid(); v_org uuid; v_now public.organization_weekly_schedules%ROWTYPE; v_old public.organization_weekly_schedule_history%ROWTYPE;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
 IF p_history_id IS NULL OR p_expected_version IS NULL OR p_expected_version<1 THEN RAISE EXCEPTION '복구 요청 정보가 올바르지 않습니다.'; END IF;
 SELECT p.organization_id INTO v_org FROM public.profiles p WHERE p.id=v_user;
 IF v_org IS NULL OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=v_org AND o.owner_id=v_user) THEN
  RAISE EXCEPTION '회사 대표 계정만 근무표를 복구할 수 있습니다.';
 END IF;
 SELECT h.* INTO v_old FROM public.organization_weekly_schedule_history h WHERE h.id=p_history_id AND h.organization_id=v_org;
 IF NOT FOUND THEN RAISE EXCEPTION '선택한 이력이 현재 회사에 속하지 않습니다.'; END IF;
 SELECT s.* INTO v_now FROM public.organization_weekly_schedules s WHERE s.id=v_old.schedule_id AND s.organization_id=v_org FOR UPDATE;
 IF NOT FOUND OR v_now.version<>p_expected_version THEN
  RAISE EXCEPTION '현재 근무표가 다른 기기에서 변경되었습니다. 최신 근무표를 다시 불러와주세요.' USING ERRCODE='40001';
 END IF;
 PERFORM set_config('app.schedule_restore_history_id',p_history_id::text,true);
 UPDATE public.organization_weekly_schedules SET status=v_old.status,team_label=v_old.team_label,week_end=v_old.week_end,
  schedule=v_old.schedule,employee_details=v_old.employee_details,warnings=v_old.warnings,version=version+1,updated_by=v_user,
  confirmed_at=CASE WHEN v_old.status='confirmed' THEN now() ELSE NULL END,updated_at=now()
 WHERE id=v_now.id RETURNING * INTO v_now;
 RETURN jsonb_build_object('id',v_now.id,'team_id',v_now.team_id,'team_label',v_now.team_label,'week_start',v_now.week_start,
  'week_end',v_now.week_end,'status',v_now.status,'version',v_now.version,'confirmed_at',v_now.confirmed_at,
  'updated_at',v_now.updated_at,'schedule',v_now.schedule,'employee_details',v_now.employee_details,
  'warnings',v_now.warnings,'restored_from_history_id',p_history_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.restore_my_organization_weekly_schedule_history(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.restore_my_organization_weekly_schedule_history(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_my_organization_schedule_template(p_team_id text,p_team_label text,p_template_name text,p_schedule jsonb,p_warnings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
DECLARE v_user uuid:=auth.uid(); v_org uuid; v_row public.organization_schedule_templates%ROWTYPE;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
 SELECT p.organization_id INTO v_org FROM public.profiles p WHERE p.id=v_user;
 IF v_org IS NULL OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=v_org AND o.owner_id=v_user) THEN
  RAISE EXCEPTION '회사 대표 계정만 근무표 템플릿을 관리할 수 있습니다.';
 END IF;
 IF p_team_id IS NULL OR btrim(p_team_id)='' OR char_length(btrim(COALESCE(p_template_name,''))) NOT BETWEEN 1 AND 40
   OR jsonb_typeof(p_schedule) IS DISTINCT FROM 'object' OR jsonb_typeof(p_warnings) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION '팀, 템플릿 이름 또는 근무표 데이터 형식이 올바르지 않습니다.';
 END IF;
 INSERT INTO public.organization_schedule_templates(organization_id,team_id,team_label,template_name,schedule,warnings,created_by,updated_by)
 VALUES(v_org,btrim(p_team_id),COALESCE(NULLIF(btrim(p_team_label),''),btrim(p_team_id)),btrim(p_template_name),p_schedule,p_warnings,v_user,v_user)
 ON CONFLICT(organization_id,team_id,template_name) DO UPDATE SET team_label=EXCLUDED.team_label,schedule=EXCLUDED.schedule,
  warnings=EXCLUDED.warnings,updated_by=EXCLUDED.updated_by,updated_at=now()
 RETURNING * INTO v_row;
 RETURN jsonb_build_object('id',v_row.id,'team_id',v_row.team_id,'team_label',v_row.team_label,
  'template_name',v_row.template_name,'created_at',v_row.created_at,'updated_at',v_row.updated_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.save_my_organization_schedule_template(text,text,text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_my_organization_schedule_template(text,text,text,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_organization_schedule_templates(p_team_id text)
RETURNS TABLE(id uuid,team_id text,team_label text,template_name text,created_at timestamptz,updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
DECLARE v_user uuid:=auth.uid(); v_org uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
 SELECT p.organization_id INTO v_org FROM public.profiles p WHERE p.id=v_user;
 IF v_org IS NULL OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=v_org AND o.owner_id=v_user) THEN
  RAISE EXCEPTION '회사 대표 계정만 근무표 템플릿을 조회할 수 있습니다.';
 END IF;
 RETURN QUERY SELECT t.id,t.team_id,t.team_label,t.template_name,t.created_at,t.updated_at
 FROM public.organization_schedule_templates t WHERE t.organization_id=v_org AND t.team_id=p_team_id
 ORDER BY t.updated_at DESC,t.template_name;
END;
$function$;
REVOKE ALL ON FUNCTION public.list_my_organization_schedule_templates(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_my_organization_schedule_templates(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_organization_schedule_template(p_template_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
DECLARE v_user uuid:=auth.uid(); v_org uuid; v_row public.organization_schedule_templates%ROWTYPE;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
 SELECT p.organization_id INTO v_org FROM public.profiles p WHERE p.id=v_user;
 IF v_org IS NULL OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=v_org AND o.owner_id=v_user) THEN
  RAISE EXCEPTION '회사 대표 계정만 근무표 템플릿을 불러올 수 있습니다.';
 END IF;
 SELECT t.* INTO v_row FROM public.organization_schedule_templates t WHERE t.id=p_template_id AND t.organization_id=v_org;
 IF NOT FOUND THEN RAISE EXCEPTION '해당 템플릿을 찾을 수 없습니다.'; END IF;
 RETURN jsonb_build_object('id',v_row.id,'team_id',v_row.team_id,'team_label',v_row.team_label,'template_name',v_row.template_name,
  'schedule',v_row.schedule,'warnings',v_row.warnings,'updated_at',v_row.updated_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_my_organization_schedule_template(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_schedule_template(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_organization_schedule_template(p_template_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $function$
DECLARE v_user uuid:=auth.uid(); v_org uuid; v_count integer;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
 SELECT p.organization_id INTO v_org FROM public.profiles p WHERE p.id=v_user;
 IF v_org IS NULL OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=v_org AND o.owner_id=v_user) THEN
  RAISE EXCEPTION '회사 대표 계정만 근무표 템플릿을 삭제할 수 있습니다.';
 END IF;
 DELETE FROM public.organization_schedule_templates WHERE id=p_template_id AND organization_id=v_org;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count=1;
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_my_organization_schedule_template(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_my_organization_schedule_template(uuid) TO authenticated;

COMMIT;
