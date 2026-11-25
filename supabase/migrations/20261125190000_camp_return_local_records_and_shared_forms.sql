-- 개인 채번 이력은 기기 저장으로 전환하고 Google Forms 메타데이터는 로그인 사용자 간 공유합니다.
-- 기존 개인 이력·기본 설정은 새 앱 첫 실행에서 1회 로컬 이전할 수 있도록 보존합니다.
-- 과거 분석 접수에는 이메일과 양식 링크가 포함되어 있으므로 별도 삭제 승인 전까지 보존합니다.

BEGIN;

CREATE TEMP TABLE camp_return_form_dedup_map ON COMMIT DROP AS
SELECT
    id AS duplicate_id,
    FIRST_VALUE(id) OVER (
        PARTITION BY form_id
        ORDER BY
            CASE WHEN analysis_status = 'ready' THEN 0 ELSE 1 END,
            created_at ASC,
            id ASC
    ) AS canonical_id,
    ROW_NUMBER() OVER (
        PARTITION BY form_id
        ORDER BY
            CASE WHEN analysis_status = 'ready' THEN 0 ELSE 1 END,
            created_at ASC,
            id ASC
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

-- Existing INSERT / UPDATE / DELETE policies still restrict changes to the registrant.
ALTER TABLE public.camp_return_profiles
    DROP COLUMN IF EXISTS driver_id;

-- Historical analysis reports are retained for now; the new analyzer no longer creates reports.
COMMENT ON TABLE public.camp_return_forms IS
    'Shared Google Forms metadata for signed-in app users. form_id is unique across all users.';

COMMENT ON COLUMN public.camp_return_forms.user_id IS
    'Original registrant; used for update/delete authorization and set NULL when that account is deleted.';

COMMENT ON TABLE public.camp_return_records IS
    'Legacy personal numbering history. New app versions store history locally; retain only until first-run migration is verified.';

COMMENT ON TABLE public.camp_return_profiles IS
    'Legacy personal form preferences. New app versions store preferences locally; retain until first-run migration is verified.';

COMMIT;
