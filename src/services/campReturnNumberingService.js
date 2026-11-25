import { supabase } from '../lib/supabaseClient';

const LOCAL_PREFIX = 'campReturnNumbering:v1';

export const CHUNGJU_DEFAULT_FORM = {
    id: 'chungju_default',
    camp_name: '청주 기본 양식',
    form_title: '청주1캠프 반품 송장 발행 / 채번 요청',
    form_id: '1FAIpQLSd8kBLT6B5iGSTLuG5yyMCbuCJ5l1e5qYpEqbUdtbtCSwUZqg',
    form_url: 'https://docs.google.com/forms/d/e/1FAIpQLSd8kBLT6B5iGSTLuG5yyMCbuCJ5l1e5qYpEqbUdtbtCSwUZqg/viewform'
};

function localKey(userId, suffix) {
    return `${LOCAL_PREFIX}:${userId || 'guest'}:${suffix}`;
}

const legacyMigrationPromises = new Map();

function sortCampReturnRecords(records) {
    return (Array.isArray(records) ? [...records] : []).sort((a, b) =>
        new Date(b.user_confirmed_at || b.created_at || 0).getTime() -
        new Date(a.user_confirmed_at || a.created_at || 0).getTime()
    );
}

async function runLegacyMigration(userId, marker, migrate) {
    if (readLocal(userId, marker, false) === true) return;
    const lockKey = `${userId}:${marker}`;
    if (legacyMigrationPromises.has(lockKey)) return legacyMigrationPromises.get(lockKey);

    const pending = (async () => {
        await migrate();
        writeLocal(userId, marker, true);
    })().finally(() => legacyMigrationPromises.delete(lockKey));

    legacyMigrationPromises.set(lockKey, pending);
    return pending;
}

function readLocal(userId, suffix, fallback) {
    try {
        const raw = localStorage.getItem(localKey(userId, suffix));
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        console.warn('[CampReturnNumbering] 로컬 데이터 읽기 실패:', error);
        return fallback;
    }
}

function writeLocal(userId, suffix, value) {
    localStorage.setItem(localKey(userId, suffix), JSON.stringify(value));
}

export function fetchGuestDriverId() {
    return String(readLocal(null, 'driverId', '') || '').trim();
}

export function saveGuestDriverId(driverId) {
    const value = String(driverId ?? '');
    if (value) {
        writeLocal(null, 'driverId', value);
    } else {
        localStorage.removeItem(localKey(null, 'driverId'));
    }
}

export function isChungjuDefaultFormHidden(userId) {
    return readLocal(userId || null, 'chungjuDefaultFormHidden', false) === true;
}

export function hideChungjuDefaultForm(userId) {
    writeLocal(userId || null, 'chungjuDefaultFormHidden', true);
}

export async function fetchAccountDriverId(userId) {
    if (!userId) return '';

    const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;
    return String(data?.username || '').trim();
}


export async function fetchCampReturnProfile(userId) {
    if (!userId) return readLocal(null, 'profile', null);

    const cachedProfile = readLocal(userId, 'profile', null);
    if (readLocal(userId, 'legacyProfileMigrated', false) === true) return cachedProfile;

    try {
        await runLegacyMigration(userId, 'legacyProfileMigrated', async () => {
            const { data, error } = await supabase
                .from('camp_return_profiles')
                .select('default_camp, default_form_id, default_mobile_camp, updated_at')
                .eq('user_id', userId)
                .maybeSingle();
            if (error) throw error;

            const legacyProfile = data ? {
                default_camp: data.default_camp || '학천MB',
                default_form_id: data.default_form_id || null,
                default_mobile_camp: data.default_mobile_camp || null
            } : null;

            const mergedProfile = cachedProfile
                ? { ...(legacyProfile || {}), ...cachedProfile }
                : legacyProfile;

            if (mergedProfile) writeLocal(userId, 'profile', mergedProfile);
        });
    } catch (error) {
        if (!cachedProfile) throw error;
        console.warn('[CampReturnNumbering] 기존 양식 선택 정보의 로컬 이전을 다음 조회로 미룹니다:', error);
        return cachedProfile;
    }

    return readLocal(userId, 'profile', null);
}


export async function saveCampReturnProfile(userId, {
    defaultCamp,
    defaultFormId = null,
    defaultMobileCamp = null
}) {
    const profile = {
        default_camp: defaultCamp,
        default_form_id: defaultFormId || null,
        default_mobile_camp: defaultMobileCamp ? String(defaultMobileCamp).trim() : null
    };
    writeLocal(userId || null, 'profile', profile);
    if (userId) writeLocal(userId, 'legacyProfileMigrated', true);
    return profile;
}


export async function fetchCampReturnRecords(userId) {
    if (!userId) return sortCampReturnRecords(readLocal(null, 'records', []));

    try {
        await runLegacyMigration(userId, 'legacyRecordsMigrated', async () => {
            const { data, error } = await supabase
                .from('camp_return_records')
                .select('id, invoice_text, driver_id, quantity, camp, form_key, user_confirmed_at, created_at')
                .eq('user_id', userId)
                .order('user_confirmed_at', { ascending: false })
                .limit(500);
            if (error) throw error;

            const localRecords = readLocal(userId, 'records', []);
            const merged = new Map();
            [...(Array.isArray(data) ? data : []), ...(Array.isArray(localRecords) ? localRecords : [])]
                .forEach(record => {
                    const key = record?.id ? String(record.id) : JSON.stringify(record);
                    merged.set(key, record);
                });
            writeLocal(userId, 'records', sortCampReturnRecords(Array.from(merged.values())).slice(0, 500));
        });
    } catch (error) {
        const existingLocalRecords = readLocal(userId, 'records', []);
        if (!Array.isArray(existingLocalRecords) || existingLocalRecords.length === 0) throw error;
        console.warn('[CampReturnNumbering] 기존 기록의 서버 이전을 다음 조회로 미룹니다:', error);
    }

    return sortCampReturnRecords(readLocal(userId, 'records', []));
}


function extractInvoiceIdentifiers(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const trackingNumber = text.match(/운송장\s*번호\s*[:：]?\s*([0-9]+)/i)?.[1] || '';
    const orderNumber = text.match(/주문\s*번호\s*[:：]?\s*([0-9]+)/i)?.[1] || '';
    return { trackingNumber, orderNumber };
}

function invoiceIdentifiersMatch(candidate, target) {
    const existing = extractInvoiceIdentifiers(candidate);
    const hasTracking = Boolean(target?.trackingNumber);
    const hasOrder = Boolean(target?.orderNumber);
    if (!hasTracking && !hasOrder) return false;
    return (!hasTracking || existing.trackingNumber === target.trackingNumber) &&
        (!hasOrder || existing.orderNumber === target.orderNumber);
}

export async function findCampReturnDuplicateRecord(userId, invoiceIdentifiers) {
    if (!invoiceIdentifiers?.trackingNumber && !invoiceIdentifiers?.orderNumber) return null;
    const records = await fetchCampReturnRecords(userId);
    return records.find(record =>
        invoiceIdentifiersMatch(record.invoice_text, invoiceIdentifiers)
    ) || null;
}


export async function addCampReturnRecord(userId, request) {
    await fetchCampReturnRecords(userId);
    const now = new Date().toISOString();
    const localRecord = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        invoice_text: String(request.invoiceText || '').trim(),
        driver_id: String(request.driverId || '').trim(),
        quantity: Number(request.quantity),
        camp: String(request.camp || ''),
        form_key: String(request.formKey || 'chungju1_return_numbering_v1'),
        user_confirmed_at: now,
        created_at: now
    };
    const records = readLocal(userId || null, 'records', []);
    writeLocal(userId || null, 'records', [localRecord, ...records].slice(0, 500));
    return localRecord;
}


export async function deleteCampReturnRecord(userId, recordId) {
    if (!recordId) throw new Error('삭제할 채번 기록을 찾을 수 없습니다.');
    const records = await fetchCampReturnRecords(userId);
    writeLocal(userId || null, 'records', records.filter(record => String(record.id) !== String(recordId)));
}


export async function fetchCampReturnForms(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
        .from('camp_return_forms')
        .select('id, user_id, camp_name, form_url, form_id, form_title, field_map, questions, analysis_status, is_active, created_at, updated_at')
        .eq('is_active', true)
        .order('camp_name', { ascending: true });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

export async function analyzeCampReturnForm(formUrl, campName = '') {
    const { data, error } = await supabase.functions.invoke('analyze-camp-return-form', {
        body: { formUrl, ...(campName ? { campName } : {}) }
    });

    if (error) {
        // FunctionsHttpError.context is the actual HTTP Response returned by the Edge Function.
        // Read its JSON body so users see the analyzer's real validation / parsing error.
        let serverMessage = '';
        try {
            const response = error.context;
            if (response && typeof response.json === 'function') {
                const errorBody = await response.json();
                serverMessage = String(errorBody?.error || errorBody?.message || '').trim();
            }
        } catch (readError) {
            console.warn('[CampReturnNumbering] Edge Function 오류 응답 읽기 실패:', readError);
        }

        throw new Error(
            serverMessage ||
            error.message ||
            'Google Forms 분석 요청에 실패했습니다. Supabase Edge Function 로그를 확인해주세요.'
        );
    }

    if (!data?.success) {
        throw new Error(data?.error || '양식 분석에 실패했습니다.');
    }
    return data;
}


export async function saveCampReturnForm(userId, form) {
    if (!userId) throw new Error('로그인 후 캠프 양식을 등록할 수 있습니다.');
    if (!form?.formId) throw new Error('분석된 Google Forms ID가 없습니다.');

    const formId = String(form.formId).trim();
    const selectFields = 'id, user_id, camp_name, form_url, form_id, form_title, field_map, questions, analysis_status, is_active, created_at, updated_at';
    const { data: existing, error: lookupError } = await supabase
        .from('camp_return_forms')
        .select(selectFields)
        .eq('form_id', formId)
        .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return existing;

    const payload = {
        user_id: userId,
        camp_name: String(form.campName || '').trim(),
        form_url: String(form.formUrl || '').trim(),
        form_id: formId,
        form_title: String(form.formTitle || ''),
        field_map: form.fieldMap || {},
        questions: Array.isArray(form.questions) ? form.questions : [],
        analysis_status: form.analysisStatus || 'ready',
        is_active: true,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('camp_return_forms')
        .insert(payload)
        .select(selectFields)
        .single();
    if (!error) return data;

    if (error.code === '23505') {
        const { data: duplicate, error: duplicateLookupError } = await supabase
            .from('camp_return_forms')
            .select(selectFields)
            .eq('form_id', formId)
            .maybeSingle();
        if (!duplicateLookupError && duplicate) return duplicate;
    }
    throw error;
}

export async function deleteCampReturnForm(userId, formId) {
    if (!userId) throw new Error('로그인이 필요합니다.');

    const { error } = await supabase
        .from('camp_return_forms')
        .delete()
        .eq('id', formId)
        .eq('user_id', userId);

    if (error) throw error;
}

