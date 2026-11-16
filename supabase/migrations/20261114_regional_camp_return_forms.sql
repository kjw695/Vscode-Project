-- 타지역 Google Forms 링크 등록 및 분석 리포트
-- 기존 청주 채번 입력/전송 설정은 그대로 유지하고, 사용자별 지역 양식만 추가합니다.

BEGIN;

CREATE TABLE IF NOT EXISTS public.camp_return_forms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    camp_name text NOT NULL CHECK (length(trim(camp_name)) BETWEEN 1 AND 80),
    form_url text NOT NULL,
    form_id text NOT NULL,
    form_title text NOT NULL DEFAULT '',
    field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
    questions jsonb NOT NULL DEFAULT '[]'::jsonb,
    analysis_status text NOT NULL DEFAULT 'ready'
        CHECK (analysis_status IN ('ready', 'needs_mapping')),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, form_id)
);

CREATE INDEX IF NOT EXISTS camp_return_forms_user_active_idx
    ON public.camp_return_forms (user_id, is_active, updated_at DESC);

ALTER TABLE public.camp_return_profiles
    ADD COLUMN IF NOT EXISTS default_form_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'camp_return_profiles_default_form_id_fkey'
          AND conrelid = 'public.camp_return_profiles'::regclass
    ) THEN
        ALTER TABLE public.camp_return_profiles
            ADD CONSTRAINT camp_return_profiles_default_form_id_fkey
            FOREIGN KEY (default_form_id)
            REFERENCES public.camp_return_forms(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 지역별 캠프명이 늘어날 수 있으므로 기존 청주 2개 캠프 제한을 제거합니다.
ALTER TABLE public.camp_return_records
    DROP CONSTRAINT IF EXISTS camp_return_records_camp_check;

CREATE TABLE IF NOT EXISTS public.camp_return_form_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email text NOT NULL DEFAULT '',
    camp_name text NOT NULL DEFAULT '',
    form_url text NOT NULL,
    form_id text,
    form_title text NOT NULL DEFAULT '',
    status text NOT NULL CHECK (status IN ('ready', 'needs_mapping', 'error')),
    questions jsonb NOT NULL DEFAULT '[]'::jsonb,
    suggested_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS camp_return_form_reports_created_idx
    ON public.camp_return_form_reports (created_at DESC);

CREATE TABLE IF NOT EXISTS public.camp_return_form_admins (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.camp_return_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_return_form_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_return_form_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS camp_return_forms_select_own ON public.camp_return_forms;
CREATE POLICY camp_return_forms_select_own
    ON public.camp_return_forms FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS camp_return_forms_insert_own ON public.camp_return_forms;
CREATE POLICY camp_return_forms_insert_own
    ON public.camp_return_forms FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS camp_return_forms_update_own ON public.camp_return_forms;
CREATE POLICY camp_return_forms_update_own
    ON public.camp_return_forms FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS camp_return_forms_delete_own ON public.camp_return_forms;
CREATE POLICY camp_return_forms_delete_own
    ON public.camp_return_forms FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- 운영자 목록은 직접 조회할 수 없고, 아래 RPC를 통해서만 본인 권한을 확인합니다.
CREATE OR REPLACE FUNCTION public.is_camp_return_form_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.camp_return_form_admins a
        WHERE a.user_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.is_camp_return_form_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_camp_return_form_admin() TO authenticated;

DROP POLICY IF EXISTS camp_return_form_reports_admin_read ON public.camp_return_form_reports;
CREATE POLICY camp_return_form_reports_admin_read
    ON public.camp_return_form_reports FOR SELECT TO authenticated
    USING (public.is_camp_return_form_admin());

-- 새 테이블의 기본 권한을 먼저 제거하고 필요한 권한만 다시 부여합니다.
REVOKE ALL PRIVILEGES
    ON TABLE public.camp_return_forms, public.camp_return_form_reports
    FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
    ON TABLE public.camp_return_form_admins
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.camp_return_forms
    TO authenticated;

GRANT SELECT
    ON TABLE public.camp_return_form_reports
    TO authenticated;

-- 분석 Edge Function은 service_role로만 접수 리포트를 기록합니다.
GRANT INSERT
    ON TABLE public.camp_return_form_reports
    TO service_role;

-- 초기 운영자: 현재 제공된 Google Forms HTML 상단에 로그인 계정으로 표시된 주소.
-- 앱의 Supabase 로그인 계정도 이 주소와 같을 때 운영자 접수 내역을 볼 수 있습니다.
INSERT INTO public.camp_return_form_admins (user_id)
SELECT id
FROM auth.users
WHERE lower(email) = lower('kjw891224@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

-- 마이그레이션 시점에 계정이 아직 없었던 경우에도 이후 가입 시 운영자 권한을 부여합니다.
CREATE OR REPLACE FUNCTION public.sync_camp_return_form_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF lower(COALESCE(NEW.email, '')) = lower('kjw891224@gmail.com') THEN
        INSERT INTO public.camp_return_form_admins (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_camp_return_form_admin_trigger ON auth.users;
CREATE TRIGGER sync_camp_return_form_admin_trigger
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_camp_return_form_admin();

COMMIT;
