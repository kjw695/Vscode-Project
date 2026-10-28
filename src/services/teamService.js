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

// Read the members of the signed-in user's current organization.
// The RPC only returns member IDs and display names for that organization.
export async function fetchMyOrganizationMembers() {
    const { data, error } = await supabase.rpc('list_my_organization_members');
    if (error) throw error;

    return (Array.isArray(data) ? data : [])
        .map((row) => {
            const memberId = String(row.member_id || '').trim();
            if (!memberId) return null;

            const rawName = String(row.member_display_name || '').trim();
            const name = !rawName || rawName === '팀원'
                ? '팀원 ' + memberId.slice(0, 4).toUpperCase()
                : rawName;

            return { id: memberId, name };
        })
        .filter(Boolean);
}

// Backward-compatible name: this now starts the 7-day grace period instead of deleting immediately.
export async function deleteTeam() {
    return requestTeamDeletion();
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



// Start a 7-day deletion grace period. The server derives auth.uid().
export async function requestTeamDeletion() {
    const { data, error } = await supabase.rpc('request_organization_deletion');
    if (error) throw error;
    return data;
}

// Cancel the active deletion request (owner only).
export async function cancelTeamDeletion() {
    const { data, error } = await supabase.rpc('cancel_organization_deletion');
    if (error) throw error;
    return data;
}

// Read the current team's deletion countdown and election state.
export async function fetchTeamDeletionState() {
    const { data, error } = await supabase.rpc('get_my_organization_deletion_state');
    if (error) throw error;
    return data;
}

// A member may volunteer as a candidate during the 7-day period.
export async function registerTeamLeaderCandidate() {
    const { data, error } = await supabase.rpc('register_organization_deletion_candidate');
    if (error) throw error;
    return data;
}

// Submit one vote. The server validates eligibility and may transfer ownership atomically.
export async function voteForTeamLeader(candidateUserId) {
    const { data, error } = await supabase.rpc(
        'vote_for_organization_deletion_candidate',
        { p_candidate_id: candidateUserId }
    );
    if (error) throw error;
    return data;
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
