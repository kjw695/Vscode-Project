import { supabase } from '../lib/supabaseClient';

// 1. 팀(조직/벤더) 만들기 (팀장용)
export async function createTeam(teamName, userId) {
    const inviteCode = 'ven_' + Math.random().toString(36).substring(2, 8);

    // organizations 테이블에 벤더 정보 삽입
    const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({ 
            name: teamName, 
            invite_code: inviteCode, 
            owner_id: userId 
        })
        .select()
        .single();

    if (orgError) throw orgError;

    // profiles 테이블의 organization_id를 업데이트하여 본인을 팀장으로 소속시킴
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: orgData.id })
        .eq('id', userId);

    if (profileError) throw profileError;

    return orgData;
}

// 2. 초대 코드로 팀 가입하기 (팀원용)
export async function joinTeamByCode(inviteCode, userId) {
    // organizations 테이블에서 초대 코드로 벤더 찾기
    const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('invite_code', inviteCode)
        .single();

    if (orgError || !orgData) {
        throw new Error("유효하지 않거나 만료된 초대 링크입니다.");
    }

    // profiles 테이블의 organization_id를 업데이트하여 팀원으로 소속시킴
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: orgData.id })
        .eq('id', userId);

    if (profileError) throw profileError;

    return { success: true, message: `"${orgData.name}" 팀에 성공적으로 가입되었습니다!`, team: orgData };
}

// 3. 내 소속 벤더 정보 가져오기
export async function fetchMyVendorInfo(userId) {
    // profiles 테이블에서 내 organization_id 확인
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

    if (profileError || !profileData || !profileData.organization_id) {
        return null; // 소속된 팀 없음
    }

    // organizations 테이블에서 해당 벤더 정보 조회
    const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profileData.organization_id)
        .single();

    if (orgError || !orgData) return null;

    // 벤더를 만든 owner_id가 나인지 확인하여 역할 지정
    const role = orgData.owner_id === userId ? 'owner' : 'member';

    return {
        role: role,     
        vendor: orgData   
    };
}
// 4. 팀 삭제하기 (팀장용)
export async function deleteTeam(orgId, userId) {
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: null })
        .eq('organization_id', orgId);

    if (profileError) throw profileError;

    const { error: orgError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId)
        .eq('owner_id', userId);

    if (orgError) throw orgError;

    return true;
}

// 5. 팀 나가기 (팀원용)
export async function leaveTeam(userId) {
    const { error } = await supabase
        .from('profiles')
        .update({ organization_id: null })
        .eq('id', userId);

    if (error) throw error;
    return true;
}

// 6. 내 선호 요일 저장하기
export async function savePreferredDays(userId, daysArray) {
    const { error } = await supabase
        .from('profiles')
        .update({ preferred_days: daysArray })
        .eq('id', userId);

    if (error) throw error;
    return true;
}

// 7. 내 선호 요일 조회하기 (기존 fetchMyVendorInfo에 포함하거나 단독 조회)
export async function fetchPreferredDays(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('preferred_days')
        .eq('id', userId)
        .single();

    if (error) return [];
    return data?.preferred_days || [];
}
