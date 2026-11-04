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
    warnings
}) {
    if (!teamId || !weekStart || !weekEnd) {
        throw new Error('팀과 근무표 기간을 확인해주세요.');
    }

    const { data, error } = await supabase.rpc(
        'save_my_organization_weekly_schedule',
        {
            p_team_id: String(teamId),
            p_team_label: teamLabel || String(teamId),
            p_week_start: weekStart,
            p_week_end: weekEnd,
            p_status: status,
            p_schedule: schedule || {},
            p_employee_details: employeeDetails || {},
            p_warnings: Array.isArray(warnings) ? warnings : []
        }
    );

    if (error) throw error;
    return data;
}

export async function fetchMyOrganizationScheduleSyncFrom() {
    const { data, error } = await supabase.rpc(
        'get_my_organization_schedule_sync_from'
    );

    if (error) throw error;
    return data || null;
}
