-- Change daily inspection retention from two years to one year.
-- Preserve the existing signature-version retention behavior and cron schedule.

BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_expired_daily_inspection_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_deleted_records integer := 0;
    v_deleted_signatures integer := 0;
BEGIN
    DELETE FROM public.daily_inspection_records
    WHERE completed_at < now() - interval '1 year';
    GET DIAGNOSTICS v_deleted_records = ROW_COUNT;

    DELETE FROM public.daily_inspection_signatures s
    WHERE s.version < (
        SELECT COALESCE(MAX(s2.version), s.version)
        FROM public.daily_inspection_signatures s2
        WHERE s2.user_id = s.user_id
    )
      AND NOT EXISTS (
        SELECT 1
        FROM public.daily_inspection_records r
        WHERE r.signature_version_id = s.id
      );
    GET DIAGNOSTICS v_deleted_signatures = ROW_COUNT;

    RETURN jsonb_build_object(
        'deleted_records', v_deleted_records,
        'deleted_signature_versions', v_deleted_signatures,
        'retention_years', 1
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_expired_daily_inspection_records()
    FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.daily_inspection_records IS
    '화물자동차 일상점검표 서버 기록. 마지막 완료/수정 시각 기준 1년 보관 후 자동 삭제됩니다.';

COMMIT;
