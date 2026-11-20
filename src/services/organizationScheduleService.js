import { supabase } from '../lib/supabaseClient';

export async function fetchMyOrganizationWeeklySchedules(startDate, endDate) {
    if (!startDate || !endDate) {
        throw new Error('근무표 조회 기간이 필요합니다.');
    }

    const { data, error } = await supabase.rpc(
        'list_my_organization_weekly_schedules',
        {
            p_start_date: startDate,
            p_end_date: endDate
        }
    );

    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

export async function saveMyOrganizationWeeklySchedule({
    teamId,
    teamLabel,
    weekStart,
    weekEnd,
    status,
    schedule,
    employeeDetails,
    warnings,
    expectedVersion = 0,
    changeReason = null
}) {
    if (!teamId || !weekStart || !weekEnd) {
        throw new Error('팀과 근무표 기간을 확인해주세요.');
    }

    const { data, error } = await supabase.rpc(
        'save_my_organization_weekly_schedule_v2',
        {
            p_team_id: String(teamId),
            p_team_label: teamLabel || String(teamId),
            p_week_start: weekStart,
            p_week_end: weekEnd,
            p_status: status,
            p_schedule: schedule || {},
            p_employee_details: employeeDetails || {},
            p_warnings: Array.isArray(warnings) ? warnings : [],
            p_expected_version: Number.isInteger(expectedVersion) ? expectedVersion : 0,
            p_change_reason: changeReason ? String(changeReason).trim().slice(0, 300) : null
        }
    );

    if (error) throw error;
    return data;
}

export async function fetchMyOrganizationWeeklyScheduleChangeNotices(startDate, endDate) {
    if (!startDate || !endDate) throw new Error('변경 안내 조회 기간이 필요합니다.');
    const { data, error } = await supabase.rpc('list_my_organization_weekly_schedule_change_notices', {
        p_start_date: startDate,
        p_end_date: endDate
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

export async function fetchMyOrganizationScheduleSyncFrom() {
    const { data, error } = await supabase.rpc(
        'get_my_organization_schedule_sync_from'
    );

    if (error) throw error;
    return data || null;
}

export async function listMyOrganizationDayOffRequestHistory(teamId, limit = 50) {
    const { data, error } = await supabase.rpc('list_my_organization_day_off_request_history', {
        p_team_id: teamId ? String(teamId) : null,
        p_limit: limit
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
}
