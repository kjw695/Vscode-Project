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

export async function fetchCampReturnProfile(userId) {
    if (!userId) {
        return readLocal(null, 'profile', null);
    }

    const { data, error } = await supabase
        .from('camp_return_profiles')
        .select('driver_id, default_camp')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function saveCampReturnProfile(userId, { driverId, defaultCamp }) {
    const profile = {
        driver_id: String(driverId || '').trim(),
        default_camp: defaultCamp
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
        .select('driver_id, default_camp')
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
        .select('id, invoice_text, driver_id, quantity, camp, user_confirmed_at')
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
            form_key: 'chungju1_return_numbering_v1'
        })
        .select('id, invoice_text, driver_id, quantity, camp, user_confirmed_at')
        .single();

    if (error) throw error;
    return data;
}
