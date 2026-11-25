-- 개인 채번 기록을 기기 저장으로 전환하고 Google Forms 양식을 form_id 기준으로 공용화합니다.
-- 기존 개인 이력은 앱 첫 실행에서 기기로 이전할 수 있도록 검증 기간 동안 유지합니다.
-- 이 마이그레이션은 개인 채번 이력을 삭제하지 않습니다.

BEGIN;

CREATE TEMP TABLE camp_return_form_dedup_map ON COMMIT DROP AS
SELECT
    id AS duplicate_id,
    FIRST_VALUE(id) OVER (
        PARTITION BY form_id
        ORDER BY created_at ASC, id ASC
    ) AS canonical_id,
    ROW_NUMBER() OVER (
        PARTITION BY form_id
        ORDER BY created_at ASC, id ASC
    ) AS form_rank
FROM public.camp_return_forms;

UPDATE public.camp_return_profiles AS profile
SET default_form_id = dedup.canonical_id
FROM camp_return_form_dedup_map AS dedup
WHERE profile.default_form_id = dedup.duplicate_id
  AND dedup.form_rank > 1;

DELETE FROM public.camp_return_forms AS form
USING camp_return_form_dedup_map AS dedup
WHERE form.id = dedup.duplicate_id
  AND dedup.form_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS camp_return_forms_form_id_unique_idx
    ON public.camp_return_forms (form_id);

ALTER TABLE public.camp_return_forms
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.camp_return_forms
    DROP CONSTRAINT IF EXISTS camp_return_forms_user_id_fkey;

ALTER TABLE public.camp_return_forms
    ADD CONSTRAINT camp_return_forms_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

DROP POLICY IF EXISTS camp_return_forms_select_own ON public.camp_return_forms;
DROP POLICY IF EXISTS camp_return_forms_select_authenticated ON public.camp_return_forms;

CREATE POLICY camp_return_forms_select_authenticated
    ON public.camp_return_forms
    FOR SELECT TO authenticated
    USING (true);

COMMENT ON TABLE public.camp_return_forms IS
    '로그인 사용자가 함께 사용하는 Google Forms 양식 메타데이터. form_id는 전체 사용자 기준으로 고유합니다.';

COMMENT ON COLUMN public.camp_return_forms.user_id IS
    '최초 등록자. 공용 양식의 수정/삭제 권한 확인에 사용하며 계정 삭제 시 NULL이 됩니다.';

ALTER TABLE public.camp_return_profiles
    DROP COLUMN IF EXISTS driver_id;

COMMENT ON TABLE public.camp_return_records IS
    '레거시 채번 이력 보관용. 신규 앱은 개인 기록을 기기 로컬에 저장하며, 이전 검증 뒤 별도 정리합니다.';

COMMIT;
