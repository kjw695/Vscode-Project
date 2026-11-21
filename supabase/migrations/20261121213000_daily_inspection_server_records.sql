-- Daily inspection cloud records.
-- One PNG data URL is stored per signature version; each daily record references a version.
-- Daily records expire two years after their latest server-side completion/update.
-- The most recent saved signature version remains available for reuse.

BEGIN;

CREATE TABLE IF NOT EXISTS public.daily_inspection_signatures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version integer NOT NULL CHECK (version > 0),
    signature_data_url text NOT NULL
        CHECK (
            length(signature_data_url) <= 524288
            AND signature_data_url ~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
        ),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT daily_inspection_signatures_user_version_key UNIQUE (user_id, version),
    CONSTRAINT daily_inspection_signatures_id_user_key UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS public.daily_inspection_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    inspection_date date NOT NULL,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    answers jsonb NOT NULL
        CHECK (
            jsonb_typeof(answers) = 'object'
            AND answers ?& ARRAY[
                'cleanliness', 'lighting', 'wipers', 'cargoBody',
                'tires', 'cargoFixing', 'wheelNuts', 'fluidsAndWarning',
                'seatBelt', 'fireExtinguisher', 'warningTriangle'
            ]::text[]
            AND (answers - ARRAY[
                'cleanliness', 'lighting', 'wipers', 'cargoBody',
                'tires', 'cargoFixing', 'wheelNuts', 'fluidsAndWarning',
                'seatBelt', 'fireExtinguisher', 'warningTriangle'
            ]::text[]) = '{}'::jsonb
        ),
    action_notes text NOT NULL DEFAULT '',
    transport_company_name text NOT NULL,
    driver_name text NOT NULL,
    vehicle_number text NOT NULL,
    correction_reason text NOT NULL DEFAULT '',
    signature_version_id uuid NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT daily_inspection_records_user_date_key UNIQUE (user_id, inspection_date),
    CONSTRAINT daily_inspection_records_signature_owner_fkey
        FOREIGN KEY (signature_version_id, user_id)
        REFERENCES public.daily_inspection_signatures(id, user_id)
        ON DELETE RESTRICT,
    CONSTRAINT daily_inspection_records_company_name_check
        CHECK (length(btrim(transport_company_name)) BETWEEN 1 AND 100),
    CONSTRAINT daily_inspection_records_driver_name_check
        CHECK (length(btrim(driver_name)) BETWEEN 1 AND 60),
    CONSTRAINT daily_inspection_records_vehicle_number_check
        CHECK (length(btrim(vehicle_number)) BETWEEN 1 AND 30)
);

CREATE INDEX IF NOT EXISTS daily_inspection_records_user_date_idx
    ON public.daily_inspection_records(user_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS daily_inspection_records_retention_idx
    ON public.daily_inspection_records(completed_at);

CREATE INDEX IF NOT EXISTS daily_inspection_signatures_user_version_idx
    ON public.daily_inspection_signatures(user_id, version DESC);

ALTER TABLE public.daily_inspection_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_inspection_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.daily_inspection_signatures
    FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.daily_inspection_records
    FROM PUBLIC, anon, authenticated;

-- Explicit grants are required for new public tables on the Supabase Data API.
GRANT SELECT ON TABLE public.daily_inspection_signatures TO authenticated;
GRANT SELECT ON TABLE public.daily_inspection_records TO authenticated;

GRANT INSERT (
    user_id, inspection_date, answers, action_notes, transport_company_name,
    driver_name, vehicle_number, correction_reason, signature_version_id
) ON TABLE public.daily_inspection_records TO authenticated;

GRANT UPDATE (
    user_id, inspection_date, answers, action_notes, transport_company_name,
    driver_name, vehicle_number, correction_reason, signature_version_id
) ON TABLE public.daily_inspection_records TO authenticated;

DROP POLICY IF EXISTS daily_inspection_signatures_select_own
    ON public.daily_inspection_signatures;
CREATE POLICY daily_inspection_signatures_select_own
    ON public.daily_inspection_signatures
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS daily_inspection_records_select_own
    ON public.daily_inspection_records;
CREATE POLICY daily_inspection_records_select_own
    ON public.daily_inspection_records
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS daily_inspection_records_insert_own
    ON public.daily_inspection_records;
CREATE POLICY daily_inspection_records_insert_own
    ON public.daily_inspection_records
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS daily_inspection_records_update_own
    ON public.daily_inspection_records;
CREATE POLICY daily_inspection_records_update_own
    ON public.daily_inspection_records
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.validate_daily_inspection_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_signature_owner uuid;
BEGIN
    IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION '본인 계정의 점검 기록만 저장할 수 있습니다.';
    END IF;

    IF jsonb_typeof(NEW.answers) IS DISTINCT FROM 'object'
       OR EXISTS (
            SELECT 1
            FROM jsonb_each_text(NEW.answers) AS answer(key, value)
            WHERE answer.value NOT IN ('good', 'bad')
       )
       OR NOT (NEW.answers ?& ARRAY[
            'cleanliness', 'lighting', 'wipers', 'cargoBody',
            'tires', 'cargoFixing', 'wheelNuts', 'fluidsAndWarning',
            'seatBelt', 'fireExtinguisher', 'warningTriangle'
       ]::text[]) THEN
        RAISE EXCEPTION '점검 항목 또는 점검 결과가 올바르지 않습니다.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_each_text(NEW.answers) AS answer(key, value)
        WHERE answer.value = 'bad'
    ) AND nullif(btrim(NEW.action_notes), '') IS NULL THEN
        RAISE EXCEPTION '불량 항목이 있으면 조치 기록을 입력해야 합니다.';
    END IF;

    SELECT s.user_id
    INTO v_signature_owner
    FROM public.daily_inspection_signatures s
    WHERE s.id = NEW.signature_version_id;

    IF v_signature_owner IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION '본인에게 저장된 서명만 점검 기록에 사용할 수 있습니다.';
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.revision := 1;
        NEW.created_at := now();
    ELSE
        IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION '본인 점검 기록만 수정할 수 있습니다.';
        END IF;
        -- The daily row is overwritten, not duplicated; retain its original id/date.
        NEW.id := OLD.id;
        NEW.user_id := OLD.user_id;
        NEW.inspection_date := OLD.inspection_date;
        NEW.created_at := OLD.created_at;
        NEW.revision := OLD.revision + 1;
    END IF;

    NEW.completed_at := now();
    NEW.updated_at := now();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS daily_inspection_records_validate
    ON public.daily_inspection_records;
CREATE TRIGGER daily_inspection_records_validate
    BEFORE INSERT OR UPDATE ON public.daily_inspection_records
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_daily_inspection_record();

-- Save a signature only when it differs from the user's most recent saved version.
-- Calling this repeatedly with the same signature returns the existing version.
CREATE OR REPLACE FUNCTION public.save_my_daily_inspection_signature(
    p_signature_data_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_latest public.daily_inspection_signatures%ROWTYPE;
    v_version integer;
    v_saved public.daily_inspection_signatures%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_signature_data_url IS NULL
       OR length(p_signature_data_url) > 524288
       OR p_signature_data_url !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' THEN
        RAISE EXCEPTION '저장할 서명이 올바르지 않습니다. 다시 서명해주세요.';
    END IF;

    -- Serialize version assignment for the same account.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_user_id::text, 0)
    );

    SELECT *
    INTO v_latest
    FROM public.daily_inspection_signatures
    WHERE user_id = v_user_id
    ORDER BY version DESC
    LIMIT 1;

    IF FOUND AND v_latest.signature_data_url = p_signature_data_url THEN
        RETURN jsonb_build_object(
            'signature_id', v_latest.id,
            'version', v_latest.version,
            'created_at', v_latest.created_at,
            'reused', true
        );
    END IF;

    SELECT COALESCE(MAX(version), 0) + 1
    INTO v_version
    FROM public.daily_inspection_signatures
    WHERE user_id = v_user_id;

    INSERT INTO public.daily_inspection_signatures (
        user_id, version, signature_data_url
    )
    VALUES (v_user_id, v_version, p_signature_data_url)
    RETURNING * INTO v_saved;

    RETURN jsonb_build_object(
        'signature_id', v_saved.id,
        'version', v_saved.version,
        'created_at', v_saved.created_at,
        'reused', false
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_my_daily_inspection_signature(text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_daily_inspection_signature(text)
    TO authenticated;

-- Purge completed records after two years. Keep the latest saved signature for
-- future use; older signature versions are removed only after no retained record
-- references them.
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
    WHERE completed_at < now() - interval '2 years';
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
        'retention_years', 2
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_expired_daily_inspection_records()
    FROM PUBLIC, anon, authenticated;

-- Postgres is UTC in this project. Run at 03:10 Korea Standard Time every day.
SELECT cron.schedule(
    'daily-inspection-retention',
    '10 18 * * *',
    'SELECT public.cleanup_expired_daily_inspection_records();'
);

COMMENT ON TABLE public.daily_inspection_signatures IS
    '사용자별 자필 서명 버전. 같은 이미지 반복 저장을 방지하고 점검 기록에서 버전을 참조합니다.';
COMMENT ON TABLE public.daily_inspection_records IS
    '화물자동차 일상점검표 서버 기록. 마지막 완료/수정 시각 기준 2년 보관 후 자동 삭제됩니다.';
COMMENT ON COLUMN public.daily_inspection_records.signature_version_id IS
    '해당 점검 때 사용한 사용자 서명 버전. 서명 변경 후에도 과거 기록의 서명은 유지됩니다.';

NOTIFY pgrst, 'reload schema';

COMMIT;
