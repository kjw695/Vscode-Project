import { supabase } from '../lib/supabaseClient';

const LOCAL_PREFIX = 'campReturnNumbering:v1';

function localKey(userId, suffix) {
    return `${LOCAL_PREFIX}:${userId || 'guest'}:${suffix}`;
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
    if (!userId) {
        return readLocal(null, 'profile', null);
    }

    const { data, error } = await supabase
        .from('camp_return_profiles')
        .select('default_camp, default_form_id, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function saveCampReturnProfile(userId, { driverId, defaultCamp, defaultFormId = null }) {
    const profile = {
        default_camp: defaultCamp,
        default_form_id: defaultFormId || null
    };

    if (!userId) {
        writeLocal(null, 'profile', profile);
        return profile;
    }

    const { data, error } = await supabase
        .from('camp_return_profiles')
        .upsert({
            user_id: userId,
            ...profile,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select('default_camp, default_form_id')
        .single();

    if (error) throw error;
    return data;
}

export async function fetchCampReturnRecords(userId) {
    if (!userId) {
        return readLocal(null, 'records', []);
    }

    const { data, error } = await supabase
        .from('camp_return_records')
        .select('id, invoice_text, driver_id, quantity, camp, form_key, user_confirmed_at')
        .eq('user_id', userId)
        .order('user_confirmed_at', { ascending: false })
        .limit(500);

    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

export async function addCampReturnRecord(userId, request) {
    const record = {
        invoice_text: String(request.invoiceText || '').trim(),
        driver_id: String(request.driverId || '').trim(),
        quantity: Number(request.quantity),
        camp: request.camp,
        user_confirmed_at: new Date().toISOString()
    };

    if (!userId) {
        const records = readLocal(null, 'records', []);
        const localRecord = {
            ...record,
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        };
        writeLocal(null, 'records', [localRecord, ...records].slice(0, 500));
        return localRecord;
    }

    const { data, error } = await supabase
        .from('camp_return_records')
        .insert({
            user_id: userId,
            ...record,
            form_key: String(request.formKey || 'chungju1_return_numbering_v1')
        })
        .select('id, invoice_text, driver_id, quantity, camp, user_confirmed_at')
        .single();

    if (error) throw error;
    return data;
}


export async function fetchCampReturnForms(userId) {
    if (!userId) return [];

    const { data, error } = await supabase
        .from('camp_return_forms')
        .select('id, camp_name, form_url, form_id, form_title, field_map, questions, analysis_status, is_active, created_at, updated_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

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

    const payload = {
        user_id: userId,
        camp_name: String(form.campName || '').trim(),
        form_url: String(form.formUrl || '').trim(),
        form_id: String(form.formId),
        form_title: String(form.formTitle || ''),
        field_map: form.fieldMap || {},
        questions: Array.isArray(form.questions) ? form.questions : [],
        analysis_status: form.analysisStatus || 'ready',
        is_active: true,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('camp_return_forms')
        .upsert(payload, { onConflict: 'user_id,form_id' })
        .select('id, camp_name, form_url, form_id, form_title, field_map, questions, analysis_status, is_active, created_at, updated_at')
        .single();

    if (error) throw error;
    return data;
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

export async function checkCampReturnFormAdmin() {
    const { data, error } = await supabase.rpc('is_camp_return_form_admin');
    if (error) throw error;
    return data === true;
}

export async function fetchCampReturnFormReports() {
    const { data, error } = await supabase
        .from('camp_return_form_reports')
        .select('id, user_email, camp_name, form_url, form_id, form_title, status, questions, suggested_mapping, error_message, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) throw error;
    return Array.isArray(data) ? data : [];
}
