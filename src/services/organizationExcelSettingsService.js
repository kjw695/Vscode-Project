import { supabase } from '../lib/supabaseClient';

export async function fetchMyOrganizationExcelSettings() {
    const { data, error } = await supabase.rpc('get_my_organization_excel_settings');
    if (error) throw error;
    return data || {};
}

export async function saveMyOrganizationExcelSettings(businessRegistrationNumber) {
    const normalized = String(businessRegistrationNumber || '').replace(/[^0-9]/g, '');
    if (normalized.length !== 10) {
        throw new Error('사업자등록번호 숫자 10자리를 입력해주세요.');
    }

    const { data, error } = await supabase.rpc('update_my_organization_excel_settings', {
        p_business_registration_number: normalized
    });
    if (error) throw error;
    return data || {};
}
