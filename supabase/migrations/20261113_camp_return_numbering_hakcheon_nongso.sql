-- 개인별 반품 채번 요청 설정 및 확인 기록
-- 1차 적용 범위: 청주1캠프 학천MB / 농소MB
-- 이 기록은 고객이 앱에서 '제출했다고 기록'을 누른 내역이며,
-- 외부 Google Forms의 실제 접수/발급 결과를 검증한 데이터가 아닙니다.

BEGIN;

CREATE TABLE IF NOT EXISTS public.camp_return_profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    driver_id text NOT NULL DEFAULT '',
    default_camp text NOT NULL DEFAULT '학천MB'
        CHECK (default_camp IN ('학천MB', '농소MB')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.camp_return_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    form_key text NOT NULL DEFAULT 'chungju1_return_numbering_v1',
    invoice_text text NOT NULL,
    driver_id text NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    camp text NOT NULL CHECK (camp IN ('학천MB', '농소MB')),
    user_confirmed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS camp_return_records_user_confirmed_idx
    ON public.camp_return_records (user_id, user_confirmed_at DESC);

ALTER TABLE public.camp_return_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_return_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS camp_return_profiles_select_own ON public.camp_return_profiles;
CREATE POLICY camp_return_profiles_select_own
    ON public.camp_return_profiles
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS camp_return_profiles_insert_own ON public.camp_return_profiles;
CREATE POLICY camp_return_profiles_insert_own
    ON public.camp_return_profiles
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS camp_return_profiles_update_own ON public.camp_return_profiles;
CREATE POLICY camp_return_profiles_update_own
    ON public.camp_return_profiles
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS camp_return_records_select_own ON public.camp_return_records;
CREATE POLICY camp_return_records_select_own
    ON public.camp_return_records
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS camp_return_records_insert_own ON public.camp_return_records;
CREATE POLICY camp_return_records_insert_own
    ON public.camp_return_records
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON TABLE public.camp_return_profiles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.camp_return_records TO authenticated;

COMMIT;
