-- 사용자별 마지막 요청 모바일 캠프 선택값을 저장합니다.
-- 기존 default_camp(청주 기본양식용)는 유지하고, 지역 양식의 선택값은 별도 컬럼에 저장합니다.

BEGIN;

ALTER TABLE public.camp_return_profiles
    ADD COLUMN IF NOT EXISTS default_mobile_camp text;

COMMENT ON COLUMN public.camp_return_profiles.default_mobile_camp IS
    '마지막으로 사용한 지역 채번 양식의 요청 모바일 캠프 선택값';

COMMIT;
