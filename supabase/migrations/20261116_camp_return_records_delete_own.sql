-- 채번 요청 기록을 사용자가 직접 삭제할 수 있도록 권한을 추가합니다.
-- 삭제 대상은 본인 계정의 기록으로 제한합니다.

BEGIN;

GRANT DELETE ON TABLE public.camp_return_records TO authenticated;

DROP POLICY IF EXISTS camp_return_records_delete_own ON public.camp_return_records;
CREATE POLICY camp_return_records_delete_own
    ON public.camp_return_records
    FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

COMMENT ON COLUMN public.camp_return_records.user_confirmed_at IS
    '채번 자동 입력 버튼을 눌러 앱에서 요청 기록을 생성한 시각입니다. Google Forms 실제 제출 완료를 의미하지 않습니다.';

COMMIT;
