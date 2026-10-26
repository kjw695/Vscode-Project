import { supabase } from '../lib/supabaseClient';

// Membership changes must go through server-side SECURITY DEFINER RPCs.
// Do not trust a user id supplied by the client: the database uses auth.uid().

export async function createTeam(teamName) {
    const { data, error } = await supabase.rpc(
        'create_organization_for_current_user',
        { p_team_name: teamName }
    );

    if (error) throw error;
    if (!data?.id) {
        throw new Error('회사를 생성했지만 서버에서 회사 정보를 반환하지 않았습니다.');
    }

    return data;
}

export async function joinTeamByCode(inviteCode) {
    const { data, error } = await supabase.rpc(
        'join_organization_by_invite_code',
        { p_invite_code: inviteCode }
    );

    if (error) throw error;
    if (!data?.id) {
        throw new Error('회사 가입에 성공했지만 회사 정보를 반환하지 않았습니다.');
    }

    return {
        success: true,
        message: `"${data.name}" 팀에 성공적으로 가입되었습니다!`,
        team: data
    };
}

// Load the current user's organization. RLS limits the profile row to auth.uid(),
// and the organization policy allows only its owner or current members to read it.
export async function fetchMyVendorInfo(userId) {
    // The server returns only the current user's organization. Members do not receive the invite code.
    const { data: orgData, error } = await supabase.rpc('get_my_organization_info');

    if (error || !orgData) {
        return null;
    }

    const role = orgData.owner_id === userId ? 'owner' : 'member';

    return {
        role,
        vendor: orgData
    };
}
export async function deleteTeam(orgId) {
    const { error } = await supabase.rpc(
        'delete_organization_for_current_user',
        { p_organization_id: orgId }
    );

    if (error) throw error;
    return true;
}

export async function leaveTeam() {
    const { error } = await supabase.rpc('leave_organization_for_current_user');

    if (error) throw error;
    return true;
}

export async function savePreferredDays(userId, daysArray) {
    const { error } = await supabase
        .from('profiles')
        .update({ preferred_days: daysArray })
        .eq('id', userId);

    if (error) throw error;
    return true;
}

export async function fetchPreferredDays(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('preferred_days')
        .eq('id', userId)
        .single();

    if (error) return [];
    return data?.preferred_days || [];
}
