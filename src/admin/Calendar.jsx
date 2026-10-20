// src/admin/Calendar.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
    ArrowLeft,
    Calendar as CalendarIcon,
    Play,
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Search,
    Save,
    LockKeyhole,
    Users,
    Truck,
    CalendarDays,
    RotateCcw,
    Download
} from 'lucide-react';
import { generateWeeklySchedule } from './utils/schedulingEngine';
import { useAdminData } from './contexts/DataContext';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function pad2(value) {
    return String(value).padStart(2, '0');
}

function formatDate(date) {
    return String(date.getFullYear()) + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function getSunday(date) {
    const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    value.setDate(value.getDate() - value.getDay());
    return value;
}

function getWeekDates(date) {
    const sunday = getSunday(date);
    return Array.from({ length: 7 }, function (_, index) {
        const day = new Date(sunday);
        day.setDate(sunday.getDate() + index);
        return day;
    });
}

function getEmployeeType(employee) {
    const type = String(employee.type || employee.employee_type || employee.employeeType || '').toLowerCase();
    return ['sub', 'substitute', 'backup', '대체', '백업'].includes(type) ? 'sub' : 'base';
}

function getEmployeeRoute(employee, routes) {
    const assignedRoutes = routes.filter(function (route) {
        return String(route.assigned_emp_id) === String(employee.id);
    });
    if (assignedRoutes.length > 0) {
        return assignedRoutes.map(function (route) { return route.name; }).join(', ');
    }
    if (getEmployeeType(employee) === 'sub') return '백업';
    return employee.route || employee.routeName || employee.route_name || '미지정';
}

function getDayRecord(schedule, date, year, month) {
    if (!schedule) return null;

    const dateKey = formatDate(date);
    const dateKeyRecord = schedule[dateKey];
    if (dateKeyRecord && dateKeyRecord.date === dateKey) return dateKeyRecord;

    // 이전 버전에서 저장한 월간 일정(일자 숫자 키)도 읽을 수 있게 유지합니다.
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month) return null;
    const legacyRecord = schedule[date.getDate()];
    return legacyRecord && legacyRecord.date === dateKey ? legacyRecord : null;
}

function isOffRecord(record, employee) {
    if (!record) return false;

    const idList = Array.isArray(record.offEmployeeIds) ? record.offEmployeeIds : [];
    if (Array.isArray(record.offEmployeeIds)) {
        return idList.some(function (item) {
            const id = item && typeof item === 'object'
                ? (item.employeeId || item.employee_id || item.id)
                : item;
            return String(id) === String(employee.id);
        });
    }

    const names = []
        .concat(Array.isArray(record.offs) ? record.offs : [])
        .concat(Array.isArray(record.subOffs) ? record.subOffs : []);
    return names.some(function (item) {
        if (item && typeof item === 'object') {
            const id = item.employeeId || item.employee_id || item.id;
            const name = item.name || item.employeeName;
            return (id != null && String(id) === String(employee.id)) ||
                (name != null && String(name) === String(employee.name));
        }
        return String(item) === String(employee.id) || String(item) === String(employee.name);
    });
}

function getAssignment(record, employee) {
    if (!record || !Array.isArray(record.subs)) return null;
    return record.subs.find(function (assignment) {
        return String(assignment.subId) === String(employee.id);
    }) || null;
}

function getCellStatus(employee, date, schedule, year, month) {
    const record = getDayRecord(schedule, date, year, month);
    const isOutsideMonth = date.getFullYear() !== year || date.getMonth() + 1 !== month;
    if (isOutsideMonth && !record) return { status: 'outside', record: null, assignment: null };
    if (!record) return { status: 'pending', record: null, assignment: null };
    if (isOffRecord(record, employee)) {
        return { status: 'off', record: record, assignment: null };
    }
    const assignment = getAssignment(record, employee);
    if (assignment) {
        return { status: 'backup', record: record, assignment: assignment };
    }
    return { status: 'work', record: record, assignment: null };
}

function getRecordOffCount(record) {
    if (!record) return 0;
    if (Array.isArray(record.offEmployeeIds)) return record.offEmployeeIds.length;
    return (Array.isArray(record.offs) ? record.offs.length : 0) +
        (Array.isArray(record.subOffs) ? record.subOffs.length : 0);
}

function getStatusLabel(status) {
    if (status === 'confirmed') return '확정';
    if (status === 'saved') return '임시';
    if (status === 'generated') return '초안 생성';
    if (status === 'processing') return '생성 중';
    return '초안 없음';
}

export default function Calendar({ onBack }) {
    const {
        employees = [],
        teams = [],
        routes = [],
        substitutePermissions = [],
        fixedDaysOff = [],
        substituteWorkHistory = []
    } = useAdminData();

    const [currentDate, setCurrentDate] = useState(function () { return new Date(); });
    const [selectedDay, setSelectedDay] = useState(function () { return new Date().getDate(); });
    const [selectedTeam, setSelectedTeam] = useState(teams && teams.length > 0 ? teams[0].id : 'T1');
    const [view, setView] = useState('weekly');
    const [search, setSearch] = useState('');
    const [employeeTypeFilter, setEmployeeTypeFilter] = useState('all');
    const [scheduleStatus, setScheduleStatus] = useState('ready');
    const [generatedSchedule, setGeneratedSchedule] = useState({});
    const [warnings, setWarnings] = useState([]);
    const [savedRecord, setSavedRecord] = useState(null);
    const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
    const [collapsedTeams, setCollapsedTeams] = useState(function () {
        try { return JSON.parse(localStorage.getItem('admin_schedule_collapsed_teams') || '{}'); }
        catch (error) { return {}; }
    });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthKey = String(year) + '-' + pad2(month);
    const weekStartKey = formatDate(getSunday(currentDate));
    const weekDates = useMemo(function () {
        const parts = weekStartKey.split('-').map(Number);
        return getWeekDates(new Date(parts[0], parts[1] - 1, parts[2]));
    }, [weekStartKey]);
    const scheduleKey = 'my_schedule_' + String(selectedTeam) + '_' + weekStartKey;
    const isSelectedTeamCollapsed = Boolean(collapsedTeams[String(selectedTeam)]);
    const toggleSelectedTeamSchedule = function () {
        setCollapsedTeams(function (previous) {
            const next = Object.assign({}, previous, { [String(selectedTeam)]: !previous[String(selectedTeam)] });
            try { localStorage.setItem('admin_schedule_collapsed_teams', JSON.stringify(next)); }
            catch (error) { console.warn('팀별 접힘 상태를 저장하지 못했습니다.', error); }
            return next;
        });
    };

    useEffect(function () {
        if (teams.length > 0 && !teams.some(function (team) { return String(team.id) === String(selectedTeam); })) {
            setSelectedTeam(teams[0].id);
        }
    }, [teams, selectedTeam]);

    useEffect(function () {
        try {
            const raw = localStorage.getItem(scheduleKey);
            if (raw) {
                const record = JSON.parse(raw);
                setSavedRecord(record);
                setGeneratedSchedule(record.schedule || {});
                setWarnings(record.warnings || []);
                setScheduleStatus(record.status === 'confirmed' ? 'confirmed' : 'saved');
                return;
            }

            // 이전 버전의 월간 저장 자료가 있다면 현재 선택한 주에 해당하는 날짜만 가져옵니다.
            const legacyKey = 'my_schedule_' + String(selectedTeam) + '_' + monthKey;
            const legacyRaw = localStorage.getItem(legacyKey);
            if (legacyRaw) {
                const legacyRecord = JSON.parse(legacyRaw);
                const migratedWeek = {};
                weekDates.forEach(function (date) {
                    if (date.getFullYear() !== year || date.getMonth() + 1 !== month) return;
                    const oldDayRecord = legacyRecord.schedule && legacyRecord.schedule[date.getDate()];
                    if (oldDayRecord && oldDayRecord.date === formatDate(date)) {
                        migratedWeek[formatDate(date)] = oldDayRecord;
                    }
                });
                if (Object.keys(migratedWeek).length > 0) {
                    setGeneratedSchedule(migratedWeek);
                    const migratedWarnings = (legacyRecord.warnings || []).filter(function (warning) {
                        return weekDates.some(function (date) {
                            return String(warning).indexOf(formatDate(date)) >= 0;
                        });
                    });
                    setWarnings(migratedWarnings);
                    setSavedRecord(null);
                    setScheduleStatus('generated');
                    return;
                }
            }

            setGeneratedSchedule({});
            setWarnings([]);
            setSavedRecord(null);
            setScheduleStatus('ready');
        } catch (error) {
            console.error('저장된 근무표를 불러오지 못했습니다.', error);
            setGeneratedSchedule({});
            setWarnings([]);
            setSavedRecord(null);
            setScheduleStatus('ready');
        }
    }, [scheduleKey, monthKey, weekDates, year, month, selectedTeam]);

    const activeTeamEmployees = useMemo(function () {
        return employees.filter(function (employee) {
            return employee.active !== false && String(employee.team_id) === String(selectedTeam);
        });
    }, [employees, selectedTeam]);

    const teamRoutes = useMemo(function () {
        return routes.filter(function (route) {
            return String(route.team_id) === String(selectedTeam);
        });
    }, [routes, selectedTeam]);

    const unassignedRoutes = teamRoutes.filter(function (route) {
        return route.assigned_emp_id == null || route.assigned_emp_id === '';
    });

    const calendarDays = useMemo(function () {
        const firstDayOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
        const daysInMonth = new Date(year, month, 0).getDate();
        const days = [];
        for (let index = 0; index < firstDayOffset; index += 1) days.push(null);
        for (let day = 1; day <= daysInMonth; day += 1) days.push(day);
        return days;
    }, [year, month]);

    const monthSchedule = useMemo(function () {
        const combined = {};
        try {
            // 이전 월간 자료는 달력에 유지하고, 새 주간 저장 자료가 있으면 최신 값이 우선합니다.
            const legacyKey = 'my_schedule_' + String(selectedTeam) + '_' + monthKey;
            const legacyRaw = localStorage.getItem(legacyKey);
            if (legacyRaw) {
                const legacyRecord = JSON.parse(legacyRaw);
                Object.keys(legacyRecord.schedule || {}).forEach(function (dayKey) {
                    const record = legacyRecord.schedule[dayKey];
                    if (record && record.date) combined[record.date] = record;
                });
            }

            const scanDate = getSunday(new Date(year, month - 1, 1));
            const lastDate = new Date(year, month - 1, new Date(year, month, 0).getDate());
            while (scanDate <= lastDate) {
                const weeklyKey = 'my_schedule_' + String(selectedTeam) + '_' + formatDate(scanDate);
                const weeklyRaw = localStorage.getItem(weeklyKey);
                if (weeklyRaw) {
                    const weeklyRecord = JSON.parse(weeklyRaw);
                    Object.assign(combined, weeklyRecord.schedule || {});
                }
                scanDate.setDate(scanDate.getDate() + 7);
            }
        } catch (error) {
            console.error('월간 휴무 분포를 불러오지 못했습니다.', error);
        }

        // 현재 보고 있는 주의 미저장 초안도 월간 달력에 바로 반영합니다.
        Object.assign(combined, generatedSchedule || {});
        return combined;
    }, [selectedTeam, year, month, monthKey, generatedSchedule, scheduleStatus, savedRecord]);

    const currentRecord = getDayRecord(generatedSchedule, currentDate, year, month);
    const selectedDate = new Date(year, month - 1, Math.min(selectedDay, new Date(year, month, 0).getDate()));
    const selectedRecord = getDayRecord(monthSchedule, selectedDate, year, month);
    const isScheduleGenerated = Object.keys(generatedSchedule).length > 0;

    const filteredEmployees = useMemo(function () {
        const normalisedSearch = search.trim().toLowerCase();
        return activeTeamEmployees.filter(function (employee) {
            const matchesName = !normalisedSearch ||
                String(employee.name || '').toLowerCase().includes(normalisedSearch) ||
                getEmployeeRoute(employee, routes).toLowerCase().includes(normalisedSearch);
            const type = getEmployeeType(employee);
            const matchesType = employeeTypeFilter === 'all' || employeeTypeFilter === type;
            return matchesName && matchesType;
        });
    }, [activeTeamEmployees, search, routes, employeeTypeFilter]);

    const selectedOffEmployees = activeTeamEmployees.filter(function (employee) {
        return isOffRecord(selectedRecord, employee);
    });

    const selectedAssignments = selectedRecord && Array.isArray(selectedRecord.subs) ? selectedRecord.subs : [];
    const selectedAssignmentNames = selectedAssignments.map(function (assignment) { return assignment.targetBaseName || assignment.routeName || assignment.subName; }).filter(Boolean);

    const handleMonthChange = function (offset) {
        const nextDate = new Date(year, currentDate.getMonth() + offset, 1);
        setCurrentDate(nextDate);
        setSelectedDay(1);
    };

    const handleWeekChange = function (offset) {
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + (offset * 7));
        setCurrentDate(nextDate);
        setSelectedDay(nextDate.getDate());
    };

    const handleTeamChange = function (teamId) {
        setSelectedTeam(teamId);
        setSearch('');
        setEmployeeTypeFilter('all');
    };

    const handleStartAutoSchedule = function () {
        setWarningsAcknowledged(false);
        if (activeTeamEmployees.length === 0) {
            window.alert('선택한 팀에 등록된 직원이 없습니다.');
            return;
        }
        if (scheduleStatus === 'confirmed' && !window.confirm('이미 확정된 근무표입니다. 새 초안을 생성하면 현재 화면의 일정이 새 초안으로 바뀝니다. 계속할까요?')) {
            return;
        }

        setScheduleStatus('processing');
        try {
            const teamEmployeesWithRoutes = activeTeamEmployees.map(function (employee) {
                return Object.assign({}, employee, {
                    route: getEmployeeRoute(employee, routes)
                });
            });
            const result = generateWeeklySchedule({
                weekStart: formatDate(weekDates[0]),
                employees: teamEmployeesWithRoutes,
                substitutePermissions: substitutePermissions || [],
                fixedDaysOff: fixedDaysOff || [],
                substituteWorkHistory: substituteWorkHistory || []
            });

            setGeneratedSchedule(result.schedule || {});
            setWarnings(result.warnings || []);
            setWarningsAcknowledged(false);
            setScheduleStatus('generated');
            setSavedRecord(null);
        } catch (error) {
            console.error('자동 근무표 생성에 실패했습니다.', error);
            setScheduleStatus('ready');
            window.alert('근무표 생성 중 오류가 발생했습니다. 직원의 근무 패턴과 팀 설정을 확인해주세요.');
        }
    };

    const handleSaveDraft = function () {
        if (!isScheduleGenerated) {
            window.alert('먼저 자동 생성으로 근무표 초안을 만들어주세요.');
            return;
        }

        const record = {
            teamId: selectedTeam,
            year: year,
            month: month,
            weekStart: formatDate(weekDates[0]),
            weekEnd: formatDate(weekDates[6]),
            status: 'draft',
            version: (savedRecord && savedRecord.version ? savedRecord.version : 0) + 1,
            updatedAt: new Date().toISOString(),
            confirmedAt: null,
            schedule: generatedSchedule,
            warnings: warnings
        };

        try {
            localStorage.setItem(scheduleKey, JSON.stringify(record));
            setSavedRecord(record);
            setScheduleStatus('saved');
            window.alert('근무표 초안을 이 기기의 브라우저 저장소에 저장했습니다.');
        } catch (error) {
            console.error('근무표 저장에 실패했습니다.', error);
            window.alert('근무표를 저장하지 못했습니다. 브라우저 저장 공간을 확인해주세요.');
        }
    };

    const handleConfirmSchedule = function () {
        if (!isScheduleGenerated || (scheduleStatus !== 'saved' && scheduleStatus !== 'confirmed')) {
            window.alert('근무표를 먼저 생성한 뒤 임시 저장해주세요.');
            return;
        }
        if (warnings.length > 0 && !warningsAcknowledged) {
            window.alert('경고 내용을 확인하고 아래 확인란에 체크한 뒤 근무표를 확정해주세요.');
            return;
        }
        if (!window.confirm('선택한 팀의 ' + formatDate(weekDates[0]) + ' ~ ' + formatDate(weekDates[6]) + ' 주간 근무표를 확정할까요?')) return;

        const record = {
            teamId: selectedTeam,
            year: year,
            month: month,
            weekStart: formatDate(weekDates[0]),
            weekEnd: formatDate(weekDates[6]),
            status: 'confirmed',
            version: (savedRecord && savedRecord.version ? savedRecord.version : 0) + 1,
            updatedAt: new Date().toISOString(),
            confirmedAt: new Date().toISOString(),
            schedule: generatedSchedule,
            warnings: warnings
        };

        try {
            localStorage.setItem(scheduleKey, JSON.stringify(record));
            setSavedRecord(record);
            setScheduleStatus('confirmed');
            window.alert('근무표를 확정했습니다. 현재 버전은 이 기기의 브라우저에 저장되어 있습니다.');
        } catch (error) {
            console.error('확정에 실패했습니다.', error);
            window.alert('근무표 확정 내용을 저장하지 못했습니다.');
        }
    };

    const handleReopenDraft = function () {
        if (!window.confirm('확정 상태를 해제하고 다시 초안으로 편집할 수 있도록 변경할까요?')) return;
        const record = {
            teamId: selectedTeam,
            year: year,
            month: month,
            weekStart: formatDate(weekDates[0]),
            weekEnd: formatDate(weekDates[6]),
            status: 'draft',
            version: (savedRecord && savedRecord.version ? savedRecord.version : 0) + 1,
            updatedAt: new Date().toISOString(),
            confirmedAt: null,
            schedule: generatedSchedule,
            warnings: warnings
        };
        try {
            localStorage.setItem(scheduleKey, JSON.stringify(record));
            setSavedRecord(record);
            setScheduleStatus('saved');
        } catch (error) {
            console.error('근무표 상태 변경에 실패했습니다.', error);
            window.alert('확정 상태를 변경하지 못했습니다.');
        }
    };

    const handleToggleOff = function (employee, date) {
        if (!isScheduleGenerated) {
            window.alert('먼저 자동 생성으로 근무표를 만든 뒤, 날짜 칸을 눌러 휴무를 지정해주세요.');
            return;
        }
        const dateKey = formatDate(date);
        const oldRecord = generatedSchedule[dateKey];
        if (!oldRecord) {
            window.alert('선택한 날짜의 일정이 없습니다. 해당 주를 다시 생성해주세요.');
            return;
        }

        const oldOffIds = Array.isArray(oldRecord.offEmployeeIds) ? oldRecord.offEmployeeIds.slice() : [];
        const wasOff = oldOffIds.some(function (id) { return String(id) === String(employee.id); });
        const currentStatus = wasOff ? '휴무' : '근무';
        const nextStatus = wasOff ? '근무' : '휴무';
        if (!window.confirm(employee.name + ' ' + currentStatus + '를 ' + nextStatus + '로 변경하시겠습니까?')) return;
        if (scheduleStatus === 'confirmed' && !window.confirm('확정된 근무표를 수정하면 초안 상태로 바뀝니다. 계속할까요?')) return;
        const nextOffIds = wasOff
            ? oldOffIds.filter(function (id) { return String(id) !== String(employee.id); })
            : oldOffIds.concat([employee.id]);

        const baseOffEmployees = activeTeamEmployees.filter(function (item) {
            return getEmployeeType(item) === 'base' && nextOffIds.some(function (id) { return String(id) === String(item.id); });
        });
        const backupEmployees = activeTeamEmployees.filter(function (item) {
            return getEmployeeType(item) === 'sub';
        });
        const nextAssignments = [];
        const coverageWarnings = [];

        baseOffEmployees.forEach(function (baseEmployee) {
            const existing = (oldRecord.subs || []).find(function (assignment) {
                return String(assignment.targetBaseId) === String(baseEmployee.id);
            });
            const existingBackup = existing && backupEmployees.find(function (backup) {
                return String(backup.id) === String(existing.subId);
            });
            const existingBackupUsable = existingBackup &&
                !nextOffIds.some(function (id) { return String(id) === String(existingBackup.id); }) &&
                !nextAssignments.some(function (assignment) { return String(assignment.subId) === String(existingBackup.id); });

            if (existingBackupUsable) {
                nextAssignments.push(existing);
                return;
            }

            const candidates = backupEmployees.filter(function (backup) {
                if (nextOffIds.some(function (id) { return String(id) === String(backup.id); })) return false;
                if (nextAssignments.some(function (assignment) { return String(assignment.subId) === String(backup.id); })) return false;

                const rulesForBackup = substitutePermissions.filter(function (permission) {
                    return String(permission.substitute_employee_id) === String(backup.id);
                });
                if (rulesForBackup.length > 0) {
                    return rulesForBackup.some(function (permission) {
                        return String(permission.base_employee_id) === String(baseEmployee.id);
                    });
                }

                const target = String(backup.target || '').trim().toLowerCase();
                if (!target) return true;
                if (['전지역', '전체', '모든', '백업', '대체', '팀 전체', 'all'].some(function (word) { return target.includes(word); })) return true;
                const routeName = getEmployeeRoute(baseEmployee, routes).toLowerCase();
                return target.includes(String(baseEmployee.name || '').toLowerCase()) ||
                    (routeName && routeName !== '미지정' && target.includes(routeName));
            });

            if (candidates.length > 0) {
                const chosen = candidates[0];
                nextAssignments.push({
                    subId: chosen.id,
                    subName: chosen.name,
                    targetBaseId: baseEmployee.id,
                    targetBaseName: baseEmployee.name,
                    routeName: getEmployeeRoute(baseEmployee, routes)
                });
            } else {
                coverageWarnings.push(
                    '[백업 인원 확인 필요] ' + dateKey + ': ' + baseEmployee.name +
                    ' 휴무가 지정됐지만 근무 가능한 백업이 없습니다. 백업 인원을 확인하거나 휴무일을 변경하세요.'
                );
            }
        });

        const updatedRecord = {
            ...oldRecord,
            date: dateKey,
            offEmployeeIds: nextOffIds,
            offs: activeTeamEmployees.filter(function (item) {
                return getEmployeeType(item) === 'base' && nextOffIds.some(function (id) { return String(id) === String(item.id); });
            }).map(function (item) { return item.name; }),
            subOffs: backupEmployees.filter(function (item) {
                return nextOffIds.some(function (id) { return String(id) === String(item.id); });
            }).map(function (item) { return item.name; }),
            subs: nextAssignments,
            status: coverageWarnings.length > 0 ? 'error' : 'ok'
        };

        const nextSchedule = { ...generatedSchedule, [dateKey]: updatedRecord };
        setWarningsAcknowledged(false);
        setGeneratedSchedule(nextSchedule);
        const allCoverageWarnings = [];
        Object.keys(nextSchedule).forEach(function (scheduledDate) {
            const scheduledRecord = nextSchedule[scheduledDate];
            const scheduledOffIds = Array.isArray(scheduledRecord.offEmployeeIds) ? scheduledRecord.offEmployeeIds : [];
            activeTeamEmployees.filter(function (item) {
                return getEmployeeType(item) === 'base' &&
                    scheduledOffIds.some(function (id) { return String(id) === String(item.id); });
            }).forEach(function (baseEmployee) {
                const hasBackup = (scheduledRecord.subs || []).some(function (assignment) {
                    return String(assignment.targetBaseId) === String(baseEmployee.id);
                });
                if (!hasBackup) {
                    allCoverageWarnings.push(
                        '[백업 인원 확인 필요] ' + scheduledDate + ': ' + baseEmployee.name +
                        ' 휴무가 지정됐지만 근무 가능한 백업이 없습니다. 백업 인원을 확인하거나 휴무일을 변경하세요.'
                    );
                }
            });
        });
        setWarnings(function (previousWarnings) {
            const otherWarnings = previousWarnings.filter(function (warning) {
                return !String(warning).startsWith('[인력 부족]') &&
                    !String(warning).startsWith('[백업 인원 확인 필요]');
            });
            return Array.from(new Set(otherWarnings.concat(allCoverageWarnings)));
        });
        setScheduleStatus('generated');
        setSavedRecord(null);
    };

    const handleDownloadScheduleImage = async function () {
        if (!isScheduleGenerated) { window.alert('먼저 자동 생성으로 주간 근무표를 만들어주세요.'); return; }
        try {
            const rows = filteredEmployees;
            const ratio = 2;
            const padding = 28;
            const nameWidth = Math.max(112, Math.min(190, rows.reduce(function (max, employee) { return Math.max(max, String(employee.name || '').length * 17 + 30); }, 0)));
            const routeWidth = 148;
            const dayWidth = 104;
            const titleHeight = 98;
            const headerHeight = 58;
            const rowHeight = 54;
            const legendHeight = 62;
            const width = padding * 2 + nameWidth + routeWidth + dayWidth * weekDates.length;
            const height = padding * 2 + titleHeight + headerHeight + rowHeight * rows.length + legendHeight;
            const canvas = document.createElement('canvas');
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('이미지 캔버스를 사용할 수 없습니다.');
            ctx.scale(ratio, ratio);
            ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, width, height);
            const roundRect = function (x, y, w, h, radius, fill, stroke) {
                ctx.beginPath();
                ctx.moveTo(x + radius, y); ctx.arcTo(x + w, y, x + w, y + h, radius);
                ctx.arcTo(x + w, y + h, x, y + h, radius); ctx.arcTo(x, y + h, x, y, radius);
                ctx.arcTo(x, y, x + w, y, radius); ctx.closePath();
                if (fill) { ctx.fillStyle = fill; ctx.fill(); }
                if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
            };
            const teamName = (teams.find(function (team) { return String(team.id) === String(selectedTeam); }) || {}).name || '팀';
            roundRect(padding, padding, width - padding * 2, titleHeight + headerHeight + rowHeight * rows.length + legendHeight - 6, 18, '#ffffff', '#e2e8f0');
            ctx.textAlign = 'center'; ctx.fillStyle = '#172033'; ctx.font = 'bold 25px sans-serif';
            ctx.fillText(teamName + ' 주간 근무표', width / 2, padding + 34);
            ctx.fillStyle = '#64748b'; ctx.font = '15px sans-serif';
            ctx.fillText(formatDate(weekDates[0]) + ' ~ ' + formatDate(weekDates[6]), width / 2, padding + 61);
            ctx.fillStyle = '#94a3b8'; ctx.font = '12px sans-serif';
            ctx.fillText('고정 근무 · 휴무 · 백업 배정', width / 2, padding + 82);
            const tableX = padding;
            const tableY = padding + titleHeight;
            const tableWidth = nameWidth + routeWidth + dayWidth * weekDates.length;
            ctx.fillStyle = '#f1f5f9'; ctx.fillRect(tableX, tableY, tableWidth, headerHeight);
            ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
            ctx.fillStyle = '#334155'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('이름', tableX + nameWidth / 2, tableY + 33);
            ctx.fillText('노선', tableX + nameWidth + routeWidth / 2, tableY + 33);
            weekDates.forEach(function (date, index) {
                const x = tableX + nameWidth + routeWidth + index * dayWidth;
                ctx.fillStyle = '#334155'; ctx.font = 'bold 13px sans-serif';
                ctx.fillText(WEEKDAYS[date.getDay()] + '요일', x + dayWidth / 2, tableY + 23);
                ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif';
                ctx.fillText((date.getMonth() + 1) + '/' + date.getDate(), x + dayWidth / 2, tableY + 42);
            });
            rows.forEach(function (employee, rowIndex) {
                const y = tableY + headerHeight + rowIndex * rowHeight;
                const isBackupEmployee = !routes.some(function (route) { return String(route.assigned_emp_id) === String(employee.id); });
                ctx.fillStyle = isBackupEmployee ? '#fffbeb' : '#ffffff';
                ctx.fillRect(tableX, y, tableWidth, rowHeight);
                ctx.strokeStyle = '#e2e8f0'; ctx.strokeRect(tableX, y, tableWidth, rowHeight);
                ctx.fillStyle = '#172033'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(String(employee.name || ''), tableX + nameWidth / 2, y + 32);
                ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif';
                const routeLabel = getEmployeeRoute(employee, routes);
                ctx.fillText(routeLabel.length > 16 ? routeLabel.slice(0, 15) + '…' : routeLabel, tableX + nameWidth + routeWidth / 2, y + 32);
                weekDates.forEach(function (date, index) {
                    const x = tableX + nameWidth + routeWidth + index * dayWidth;
                    ctx.fillStyle = isBackupEmployee ? '#fffbeb' : '#ffffff'; ctx.fillRect(x, y, dayWidth, rowHeight);
                    ctx.strokeStyle = '#e2e8f0'; ctx.strokeRect(x, y, dayWidth, rowHeight);
                    const info = getCellStatus(employee, date, generatedSchedule, year, month);
                    const label = info.status === 'off' ? '휴무' : info.status === 'backup' ? ((info.assignment && info.assignment.targetBaseName) || '백업') : info.status === 'work' ? '근무' : info.status === 'outside' ? '—' : '미생성';
                    const badgeFill = info.status === 'off' ? '#ffe4e6' : info.status === 'backup' ? '#fef3c7' : info.status === 'work' ? '#d1fae5' : '#f1f5f9';
                    const badgeStroke = info.status === 'off' ? '#fecdd3' : info.status === 'backup' ? '#fde68a' : info.status === 'work' ? '#a7f3d0' : '#e2e8f0';
                    const badgeText = info.status === 'off' ? '#be123c' : info.status === 'backup' ? '#92400e' : info.status === 'work' ? '#047857' : '#64748b';
                    roundRect(x + 7, y + 9, dayWidth - 14, rowHeight - 18, 8, badgeFill, badgeStroke);
                    ctx.fillStyle = info.status === 'backup' ? '#111827' : badgeText; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText(label.length > 10 ? label.slice(0, 9) + '…' : label, x + dayWidth / 2, y + 32);
                });
            });
            const legendY = tableY + headerHeight + rowHeight * rows.length + 27;
            ctx.textAlign = 'left'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#475569';
            const legend = [{ label: '근무', fill: '#d1fae5', x: padding + 10 }, { label: '휴무', fill: '#ffe4e6', x: padding + 105 }, { label: '백업근무', fill: '#fef3c7', x: padding + 200 }];
            legend.forEach(function (item) {
                roundRect(item.x, legendY - 10, 14, 14, 4, item.fill, '#e2e8f0');
                ctx.fillStyle = '#475569'; ctx.fillText(item.label, item.x + 21, legendY + 2);
            });
            ctx.textAlign = 'right'; ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif';
            ctx.fillText('표시 ' + rows.length + '명 / 전체 ' + activeTeamEmployees.length + '명', width - padding - 8, legendY + 2);
            const dataUrl = canvas.toDataURL('image/png');
            const fileName = '근무표-' + formatDate(weekDates[0]) + '.png';
            if (Capacitor.isNativePlatform()) {
                const saved = await Filesystem.writeFile({ path: fileName, data: dataUrl.split(',')[1], directory: Directory.Documents, recursive: true });
                await Share.share({ title: '주간 근무표 이미지', text: fileName, url: saved.uri, dialogTitle: '근무표 이미지 저장 또는 공유' });
            } else {
                const link = document.createElement('a');
                link.href = dataUrl; link.download = fileName; link.style.display = 'none';
                document.body.appendChild(link); link.click(); link.remove();
            }
        } catch (error) {
            console.error('근무표 이미지 저장에 실패했습니다.', error);
            window.alert('근무표 이미지 저장에 실패했습니다. 기기 저장 권한과 저장 공간을 확인해주세요.');
        }
    };

    const renderStatusCell = function (employee, date) {
        const info = getCellStatus(employee, date, generatedSchedule, year, month);
        if (info.status === 'outside') {
            return <span className="text-xs text-gray-300">—</span>;
        }

        const label = info.status === 'pending'
            ? '미생성'
            : info.status === 'off'
                ? '휴무'
                : info.status === 'backup'
                    ? ((info.assignment && info.assignment.targetBaseName) || '백업')
                    : '근무';
        const title = info.status === 'off' ? '누르면 근무로 변경' : '누르면 휴무 지정';
        const isBackupEmployee = !routes.some(function (route) { return String(route.assigned_emp_id) === String(employee.id); });
        const colorClass = info.status === 'off'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : info.status === 'backup'
                ? 'border-amber-200 bg-amber-50 text-slate-900'
                : info.status === 'work'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-400';

        return (
            <button
                type="button"
                onClick={function () { handleToggleOff(employee, date); }}
                title={title}
                className={'inline-flex min-w-[34px] max-w-full items-center justify-center rounded-md border px-0.5 py-1 text-[8px] font-black leading-tight transition hover:brightness-95 md:min-w-[62px] md:px-2 md:py-1.5 md:text-[11px] ' + colorClass}
            >
                <span className="md:hidden">{label === '백업근무' ? '백업' : label === '미생성' ? '미정' : label}</span>
                <span className="hidden md:inline">{label}</span>
            </button>
        );
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
            <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-6">
                <div className="flex min-w-0 items-center gap-2">
                    <button onClick={onBack} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label="관리자 센터로 돌아가기">
                        <ArrowLeft size={22} />
                    </button>
                    <div className="min-w-0">
                        <h1 className="flex items-center gap-2 text-lg font-black md:text-xl">
                            <CalendarIcon size={22} className="shrink-0 text-indigo-600" />
                            <span className="truncate">근무표 관리</span>
                        </h1>
                        <p className="mt-0.5 text-xs text-slate-500">주간 배정 확인 · 월간 휴무 분포</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={'rounded-full px-3 py-1 text-xs font-bold ' + (
                        scheduleStatus === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : scheduleStatus === 'saved'
                                ? 'bg-indigo-100 text-indigo-700'
                                : scheduleStatus === 'generated'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                    )}>
                        {getStatusLabel(scheduleStatus)}
                    </span>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-2 p-2 sm:gap-4 sm:p-3 md:gap-5 md:p-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <div className="flex flex-col items-center gap-4 lg:flex-row lg:justify-center">
                        <div>
                            <div className="flex items-center gap-2">
                                <button onClick={function () { handleMonthChange(-1); }} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="이전 달">
                                    <ChevronLeft size={18} />
                                </button>
                                <h2 className="text-lg font-black md:text-xl">{year}년 {month}월</h2>
                                <button onClick={function () { handleMonthChange(1); }} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="다음 달">
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                주간 범위: {formatDate(weekDates[0])} ~ {formatDate(weekDates[6])}
                            </p>
                        </div>
                        <div className="sticky top-[72px] z-30 grid w-full grid-cols-3 items-stretch gap-1.5 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-md backdrop-blur sm:flex sm:flex-wrap sm:justify-center sm:gap-2">
                            <button
                                onClick={handleStartAutoSchedule}
                                disabled={scheduleStatus === 'processing' || activeTeamEmployees.length === 0}
                                className="inline-flex min-w-0 items-center justify-center gap-1 rounded-xl bg-indigo-600 px-2 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
                            >
                                {scheduleStatus === 'processing' ? <RotateCcw size={17} className="animate-spin" /> : <Play size={17} />}
                                자동 생성
                            </button>
                            <button
                                onClick={handleSaveDraft}
                                disabled={!isScheduleGenerated || scheduleStatus === 'confirmed'}
                                className="inline-flex min-w-0 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
                            >
                                <Save size={15} /> 임시
                            </button>
                            {scheduleStatus === 'confirmed' ? (
                                <button onClick={handleReopenDraft} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700">
                                    <LockKeyhole size={17} /> 확정 해제
                                </button>
                            ) : (
                                <button
                                    onClick={handleConfirmSchedule}
                                    disabled={!isScheduleGenerated || scheduleStatus !== 'saved' || (warnings.length > 0 && !warningsAcknowledged)}
                                    className="inline-flex min-w-0 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
                                >
                                    <CheckCircle2 size={15} /> 확정
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-800">
                        <AlertCircle size={13} className="shrink-0" />
                        <p>이 기기에 저장 · 직원 기기 간 서버 동기화는 미연결</p>
                    </div>
                </section>

                <section className="mx-auto grid w-full max-w-4xl grid-cols-3 gap-2 sm:gap-3">
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:rounded-2xl sm:p-4">
                        <div className="flex min-w-0 items-center gap-1 text-[10px] font-bold text-slate-500 sm:gap-2 sm:text-sm"><Users size={14} className="shrink-0" /><span className="truncate">활성 직원</span></div>
                        <div className="mt-1.5 text-xl font-black sm:mt-2 sm:text-2xl">{activeTeamEmployees.length}<span className="ml-0.5 text-[10px] font-semibold text-slate-400 sm:ml-1 sm:text-sm">명</span></div>
                    </div>
                    <div className="min-w-0 rounded-xl border border-rose-100 bg-white p-2 shadow-sm sm:rounded-2xl sm:p-4">
                        <div className="flex min-w-0 items-center gap-1 text-[10px] font-bold text-slate-500 sm:gap-2 sm:text-sm"><CalendarDays size={14} className="shrink-0" /><span className="truncate">선택일 휴무</span></div>
                        <div className="mt-1.5 text-xl font-black text-rose-600 sm:mt-2 sm:text-2xl">{getRecordOffCount(currentRecord)}<span className="ml-0.5 text-[10px] font-semibold text-slate-400 sm:ml-1 sm:text-sm">명</span></div>
                        <p className="mt-0.5 truncate text-[9px] text-slate-400 sm:mt-1 sm:text-xs">{formatDate(currentDate)}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-amber-100 bg-white p-2 shadow-sm sm:rounded-2xl sm:p-4">
                        <div className="flex min-w-0 items-center gap-1 text-[10px] font-bold text-slate-500 sm:gap-2 sm:text-sm"><Truck size={14} className="shrink-0" /><span className="truncate">미배정 노선</span></div>
                        <div className="mt-1.5 text-xl font-black text-amber-600 sm:mt-2 sm:text-2xl">{unassignedRoutes.length}<span className="ml-0.5 text-[10px] font-semibold text-slate-400 sm:ml-1 sm:text-sm">개</span></div>
                        <p className="mt-0.5 truncate text-[9px] text-slate-400 sm:mt-1 sm:text-xs">선택 팀 기준</p>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col items-center gap-3 border-b border-slate-200 p-3 md:p-4">
                        <div className="mx-auto inline-flex w-fit justify-center rounded-xl bg-slate-100 p-1">
                            <button onClick={function () { setView('weekly'); }} className={'rounded-lg px-4 py-2 text-sm font-bold transition ' + (view === 'weekly' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                                주간 근무표
                            </button>
                            <button onClick={function () { setView('monthly'); }} className={'rounded-lg px-4 py-2 text-sm font-bold transition ' + (view === 'monthly' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                                월간 휴무 분포
                            </button>
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
                            <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-2">
                                {teams.map(function (team) {
                                    return (
                                        <button key={team.id} onClick={function () { handleTeamChange(team.id); }} className={'whitespace-nowrap px-3 py-2 text-xs font-bold ' + (String(selectedTeam) === String(team.id) ? 'text-indigo-700' : 'text-slate-400 hover:text-slate-700')}>
                                            {team.name}
                                        </button>
                                    );
                                })}
                            </div>
                            <button type="button" onClick={toggleSelectedTeamSchedule} aria-expanded={!isSelectedTeamCollapsed} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                                {isSelectedTeamCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                                {isSelectedTeamCollapsed ? '팀 펼치기' : '팀 접기'}
                            </button>
                        </div>
                    </div>

                    {!isSelectedTeamCollapsed && (view === 'weekly' ? (
                        <div className="weekly-schedule-capture">
                            <div className="flex flex-col items-center gap-3 border-b border-slate-100 p-3 md:p-4">
                                <div className="w-full">
                                    <div className="text-center">
                                        <h3 className="font-black">주간 근무표</h3>
                                        <p className="text-xs text-slate-500">{formatDate(weekDates[0])} ~ {formatDate(weekDates[6])}</p>
                                    </div>
                                    <div className="mt-3 flex items-center justify-center gap-3">
                                        <button onClick={function () { handleWeekChange(-1); }} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="이전 주"><ChevronLeft size={18} /></button>
                                        <button type="button" onClick={handleDownloadScheduleImage} className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50" aria-label="근무표 이미지 다운로드" title="근무표 이미지 다운로드"><Download size={18} /></button>
                                        <button onClick={function () { handleWeekChange(1); }} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="다음 주"><ChevronRight size={18} /></button>
                                    </div>
                                </div>
                                <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2">
                                    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 sm:max-w-sm">
                                        <Search size={16} className="shrink-0 text-slate-400" />
                                        <input value={search} onChange={function (event) { setSearch(event.target.value); }} placeholder="직원 이름 또는 노선 검색" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
                                    </label>
                                    <select value={employeeTypeFilter} onChange={function (event) { setEmployeeTypeFilter(event.target.value); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400">
                                        <option value="all">전체 직원</option>
                                        <option value="base">고정 직원</option>
                                        <option value="sub">백업</option>
                                    </select>
                                    
                                </div>
                            </div>

                            {warnings.length > 0 && isScheduleGenerated && (
                                <div className="mx-3 mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 md:mx-4">
                                    <h4 className="mb-1 flex items-center gap-2 text-sm font-black text-rose-700"><AlertCircle size={16} /> {warnings.some(function (warning) { return String(warning).startsWith('[백업 인원 확인 필요]'); }) ? '휴무 지정 완료 · 백업 인원 확인 필요' : '확인이 필요한 항목'} {warnings.length}건</h4>
                                    <ul className="max-h-32 space-y-1 overflow-y-auto text-xs leading-5 text-rose-700">
                                        {warnings.map(function (warning, index) { return <li key={index}>• {warning}</li>; })}
                                    </ul>
                                    <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-rose-200 bg-white p-2 text-xs font-bold leading-5 text-slate-700">
                                        <input type="checkbox" checked={warningsAcknowledged} onChange={function (event) { setWarningsAcknowledged(event.target.checked); }} className="mt-1 h-4 w-4 shrink-0 accent-rose-600" />
                                        <span>위 경고를 확인했습니다. 백업이 없는 경우에도 휴무는 유지되며, 인력 보완 또는 일정 조정이 필요함을 확인했습니다.</span>
                                    </label>
                                </div>
                            )}

                            <div className="schedule-table-scroll max-h-[62vh] w-full overflow-auto md:max-h-[70vh]">
                                <table className="w-max min-w-[350px] border-separate border-spacing-0 text-[11px] md:min-w-[900px] md:text-sm">
                                    <thead>
                                        <tr>
                                            <th className="sticky top-0 z-40 w-auto min-w-0 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-[10px] font-black whitespace-nowrap md:px-3 md:py-3 md:text-sm" style={{ left: 0 }}>이름</th>
                                            <th className="sticky top-0 z-30 hidden w-[75px] min-w-[75px] max-w-[75px] border-b border-r border-slate-200 bg-slate-50 px-1 py-3 text-left font-black md:table-cell md:w-[130px] md:min-w-[130px] md:max-w-[130px] md:px-3">노선</th>
                                            {weekDates.map(function (date) {
                                                const isOutside = date.getMonth() + 1 !== month || date.getFullYear() !== year;
                                                return (
                                                    <th key={formatDate(date)} className={'sticky top-0 z-30 min-w-[38px] border-b border-r border-slate-200 px-0.5 py-2 text-center text-[10px] font-black md:min-w-[112px] md:px-3 md:py-3 md:text-sm ' + (isOutside ? 'bg-slate-100 text-slate-400' : 'bg-slate-50')}>
                                                        <div><span className="md:hidden">{WEEKDAYS[date.getDay()]}</span><span className="hidden md:inline">{WEEKDAYS[date.getDay()]}요일</span></div>
                                                        <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{date.getMonth() + 1}/{date.getDate()}</div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEmployees.map(function (employee) {
                                            return (
                                                <tr key={employee.id} className="group">
                                                    <th scope="row" className={'sticky left-0 z-20 w-auto min-w-0 whitespace-nowrap border-b border-r border-slate-100 px-2 py-2 text-center font-bold md:px-3 md:py-3 ' + (routes.some(function (route) { return String(route.assigned_emp_id) === String(employee.id); }) ? 'bg-white' : 'bg-amber-50')} style={{ left: 0 }}>
                                                        <span className="inline-block text-[11px] md:text-sm">{employee.name}</span>
                                                    </th>
                                                    <td className={'hidden w-[75px] min-w-[75px] max-w-[75px] border-b border-r border-slate-100 px-1 py-3 text-left text-[10px] font-semibold text-slate-600 md:table-cell md:w-[130px] md:min-w-[130px] md:max-w-[130px] md:px-3 md:text-xs ' + (routes.some(function (route) { return String(route.assigned_emp_id) === String(employee.id); }) ? 'bg-white' : 'bg-amber-50')}>
                                                        <span className="block max-w-full truncate" title={getEmployeeRoute(employee, routes)}>{getEmployeeRoute(employee, routes)}</span>
                                                    </td>
                                                    {weekDates.map(function (date) {
                                                        return (
                                                            <td key={formatDate(date)} className={'border-b border-r border-slate-100 px-0 py-1 text-center md:px-2 md:py-2 ' + (!routes.some(function (route) { return String(route.assigned_emp_id) === String(employee.id); }) ? 'bg-amber-50' : '')}>
                                                                {renderStatusCell(employee, date)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                        {filteredEmployees.length === 0 && (
                                            <tr>
                                                <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-400">
                                                    조건에 맞는 직원이 없습니다.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                                <span className="font-semibold text-slate-600">표시 {filteredEmployees.length}명 / 전체 {activeTeamEmployees.length}명</span>
                                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-emerald-100"></span>근무</span>
                                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-rose-100"></span>휴무</span>
                                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-amber-100"></span>백업근무</span>
                                <span className="text-slate-400">날짜 칸을 눌러 휴무 지정 · 이름·팀·노선 고정</span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 md:p-4">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h3 className="font-black">월간 휴무 분포</h3>
                                    <p className="mt-1 text-xs text-slate-500">날짜를 선택하면 휴무자와 백업 배정 내역을 확인합니다.</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={function () { handleMonthChange(-1); }} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="이전 달">
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button onClick={function () { handleMonthChange(1); }} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="다음 달">
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center">
                                {MONTH_WEEKDAYS.map(function (weekday, index) {
                                    return <div key={weekday} className={'py-2 text-xs font-black ' + (index === 5 ? 'text-blue-600' : index === 6 ? 'text-rose-600' : 'text-slate-500')}>{weekday}</div>;
                                })}
                                {calendarDays.map(function (day, index) {
                                    if (!day) return <div key={'empty-' + index} className="min-h-[66px] rounded-lg bg-transparent sm:min-h-[82px] md:min-h-[108px]"></div>;
                                    const date = new Date(year, month - 1, day);
                                    const dayRecord = getDayRecord(monthSchedule, date, year, month);
                                    const isSelected = selectedDay === day;
                                    const isError = dayRecord && dayRecord.status === 'error';
                                    const count = getRecordOffCount(dayRecord);
                                    return (
                                        <button
                                            key={day}
                                            onClick={function () { setSelectedDay(day); setCurrentDate(date); }}
                                            className={'flex min-h-[66px] flex-col items-start rounded-lg border p-1 text-left transition sm:min-h-[82px] sm:rounded-xl sm:p-2 md:min-h-[108px] md:p-3 ' + (
                                                isSelected
                                                    ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
                                                    : isError
                                                        ? 'border-rose-200 bg-rose-50 hover:border-rose-300'
                                                        : dayRecord && count > 0
                                                            ? 'border-slate-200 bg-white hover:border-indigo-200'
                                                            : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                                            )}
                                        >
                                            <span className={'text-xs font-black md:text-sm ' + (isSelected ? 'text-indigo-700' : 'text-slate-700')}>{day}</span>
                                            {dayRecord ? (
                                                <>
                                                    <span className="mt-auto rounded-md bg-rose-50 px-1.5 py-1 text-[10px] font-bold text-rose-700 md:text-xs">휴무 {count}</span>
                                                    {dayRecord.subs && dayRecord.subs.length > 0 && <span className="mt-1 max-w-full truncate rounded-md bg-amber-50 px-1.5 py-1 text-[10px] font-bold text-amber-800 md:text-xs">{dayRecord.subs.map(function (assignment) { return assignment.targetBaseName || assignment.routeName || '백업'; }).join(', ')}</span>}
                                                    {isError && <span className="mt-1 text-[10px] font-bold text-rose-600">인력 확인</span>}
                                                </>
                                            ) : (
                                                <span className="mt-auto text-[10px] text-slate-300">미생성</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-black">{month}월 {selectedDay}일 휴무 내역</h4>
                                        <p className="mt-1 text-xs text-slate-500">{selectedRecord ? '생성된 근무표 기준' : '이 날짜의 근무표가 아직 생성되지 않았습니다.'}</p>
                                    </div>
                                    <button onClick={function () { setView('weekly'); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">
                                        주간 표에서 보기
                                    </button>
                                </div>
                                {selectedOffEmployees.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {selectedOffEmployees.map(function (employee) {
                                            return (
                                                <div key={employee.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                                                    <div>
                                                        <div className="font-bold">{employee.name}</div>
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            {(teams.find(function (team) { return String(team.id) === String(employee.team_id); }) || {}).name || '미배정'} · {getEmployeeRoute(employee, routes)}
                                                        </div>
                                                    </div>
                                                    <span className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">휴무</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
                                        {selectedRecord ? '이 날짜에 휴무인 직원이 없습니다.' : '자동 생성 후 휴무 명단이 표시됩니다.'}
                                    </p>
                                )}
                                {selectedAssignments.length > 0 && (
                                    <div className="mt-4">
                                        <h5 className="mb-2 text-sm font-black text-slate-700">백업근무 배정</h5>
                                        <div className="space-y-2">
                                            {selectedAssignments.map(function (assignment, index) {
                                                return (
                                                    <div key={String(assignment.subId) + '-' + index} className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <span className="font-bold text-amber-900">{assignment.subName}</span>
                                                        <span className="text-xs text-amber-800">→ {assignment.targetBaseName} · {assignment.routeName || '노선 미지정'}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </section>
            </main>
        </div>
    );
}
