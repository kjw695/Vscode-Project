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

export async function listMyOrganizationScheduleTemplates(teamId) {
    const { data, error } = await supabase.rpc('list_my_organization_schedule_templates', {
        p_team_id: teamId ? String(teamId) : null
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

export async function getMyOrganizationScheduleTemplate(templateId) {
    if (!templateId) throw new Error('불러올 템플릿을 선택해주세요.');
    const { data, error } = await supabase.rpc('get_my_organization_schedule_template', {
        p_template_id: templateId
    });
    if (error) throw error;
    return data || null;
}

export async function saveMyOrganizationScheduleTemplate({
    teamId,
    teamLabel,
    name,
    sourceWeekStart,
    schedule,
    employeeDetails,
    warnings
}) {
    if (!teamId || !name || !sourceWeekStart) {
        throw new Error('팀, 템플릿 이름, 기준 주간을 확인해주세요.');
    }
    const { data, error } = await supabase.rpc('save_my_organization_schedule_template', {
        p_team_id: String(teamId),
        p_team_label: teamLabel || String(teamId),
        p_name: String(name).trim(),
        p_source_week_start: sourceWeekStart,
        p_schedule: schedule || {},
        p_employee_details: employeeDetails || {},
        p_warnings: Array.isArray(warnings) ? warnings : []
    });
    if (error) throw error;
    return data;
}

export async function deleteMyOrganizationScheduleTemplate(templateId) {
    if (!templateId) throw new Error('삭제할 템플릿을 선택해주세요.');
    const { data, error } = await supabase.rpc('delete_my_organization_schedule_template', {
        p_template_id: templateId
    });
    if (error) throw error;
    return Boolean(data);
}

export async function listMyOrganizationWeeklyScheduleRevisions(teamId, weekStart) {
    if (!teamId || !weekStart) throw new Error('팀과 주간을 확인해주세요.');
    const { data, error } = await supabase.rpc('list_my_organization_weekly_schedule_revisions', {
        p_team_id: String(teamId),
        p_week_start: weekStart
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

export async function getMyOrganizationWeeklyScheduleRevision(revisionId) {
    if (!revisionId) throw new Error('조회할 근무표 이력을 선택해주세요.');
    const { data, error } = await supabase.rpc('get_my_organization_weekly_schedule_revision', {
        p_revision_id: revisionId
    });
    if (error) throw error;
    return data || null;
}

export async function restoreMyOrganizationWeeklyScheduleRevision(revisionId) {
    if (!revisionId) throw new Error('복구할 근무표 이력을 선택해주세요.');
    const { data, error } = await supabase.rpc('restore_my_organization_weekly_schedule_revision', {
        p_revision_id: revisionId
    });
    if (error) throw error;
    return data;
}

export async function listMyOrganizationDayOffRequestHistory(teamId, limit = 50) {
    const { data, error } = await supabase.rpc('list_my_organization_day_off_request_history', {
        p_team_id: teamId ? String(teamId) : null,
        p_limit: limit
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
}
