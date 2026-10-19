// src/admin/utils/schedulingEngine.js
// 기존 직원 데이터(type, pattern)와 이전 데이터(employee_type, work_pattern)를 함께 지원합니다.

const WEIGHTS = {
    TOTAL_COUNT: -10,
    SPECIFIC_TARGET: -20
};

export function generateMonthlySchedule({
    year,
    month,
    employees = [],
    substitutePermissions = [],
    fixedDaysOff = [],
    substituteWorkHistory = []
}) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const activeEmployees = employees.filter(function (employee) {
        return employee && employee.active !== false;
    });
    const baseEmployees = activeEmployees.filter(function (employee) {
        return getEmployeeType(employee) === 'base';
    });
    const substitutes = activeEmployees.filter(function (employee) {
        return getEmployeeType(employee) === 'sub';
    });
    const scheduleResult = {};
    const warnings = [];
    const allOffs = {};

    fixedDaysOff.forEach(function (off) {
        if (!off || !off.date || off.employee_id == null) return;
        const dateKey = String(off.date).slice(0, 10);
        if (!allOffs[dateKey]) allOffs[dateKey] = [];
        if (!allOffs[dateKey].some(function (id) { return String(id) === String(off.employee_id); })) {
            allOffs[dateKey].push(off.employee_id);
        }
    });

    const weeks = getWeeksInMonth(year, month);

    // 대체 직원의 휴무를 먼저 배치해야 고정 직원의 휴무를 대체 가능일에 맞춰 배치할 수 있습니다.
    const patternOrder = substitutes.concat(baseEmployees);
    patternOrder.forEach(function (employee) {
        weeks.forEach(function (weekDates, weekIndex) {
            const workDays = getWorkDaysForWeek(employee, weekIndex);
            const targetOffCount = Math.max(0, weekDates.length - Math.min(workDays, weekDates.length));
            const alreadyOffCount = weekDates.filter(function (dateKey) {
                return (allOffs[dateKey] || []).some(function (id) {
                    return String(id) === String(employee.id);
                });
            }).length;

            let remainingOffs = Math.max(0, targetOffCount - alreadyOffCount);
            if (remainingOffs === 0) return;

            const candidateDates = weekDates.filter(function (dateKey) {
                return !(allOffs[dateKey] || []).some(function (id) {
                    return String(id) === String(employee.id);
                });
            }).sort(function (a, b) {
                const aCoverage = getAvailableSubstituteCount(a, employee.team_id, substitutes, allOffs);
                const bCoverage = getAvailableSubstituteCount(b, employee.team_id, substitutes, allOffs);
                const aBaseOffs = getBaseOffCount(a, employee.team_id, baseEmployees, allOffs);
                const bBaseOffs = getBaseOffCount(b, employee.team_id, baseEmployees, allOffs);
                const aSubOffs = substitutes.filter(function (sub) {
                    return String(sub.team_id) === String(employee.team_id) && containsId(allOffs[a] || [], sub.id);
                }).length;
                const bSubOffs = substitutes.filter(function (sub) {
                    return String(sub.team_id) === String(employee.team_id) && containsId(allOffs[b] || [], sub.id);
                }).length;
                const aScore = getEmployeeType(employee) === 'base'
                    ? (aCoverage - aBaseOffs)
                    : (-aBaseOffs * 10 - aSubOffs * 2);
                const bScore = getEmployeeType(employee) === 'base'
                    ? (bCoverage - bBaseOffs)
                    : (-bBaseOffs * 10 - bSubOffs * 2);
                return bScore - aScore || a.localeCompare(b);
            });

            candidateDates.forEach(function (dateKey) {
                if (remainingOffs <= 0) return;

                // 고정 직원의 자동 휴무는 같은 팀에서 쉬지 않는 대체 직원 수를 넘지 않도록 배치합니다.
                if (getEmployeeType(employee) === 'base') {
                    const availableSubs = getAvailableSubstituteCount(dateKey, employee.team_id, substitutes, allOffs);
                    const baseOffCount = getBaseOffCount(dateKey, employee.team_id, baseEmployees, allOffs);
                    if (baseOffCount >= availableSubs) return;
                }

                if (!allOffs[dateKey]) allOffs[dateKey] = [];
                allOffs[dateKey].push(employee.id);
                remainingOffs -= 1;
            });

            if (remainingOffs > 0) {
                warnings.push(
                    '[휴무 패턴 미충족] ' + employee.name + ': ' + weekDates[0] + ' 주간에 휴무 ' +
                    remainingOffs + '일을 추가 배정하지 못했습니다. 대체 인력을 확인하세요.'
                );
            }
        });
    });

    const totalHistorySubCount = substitutes.length > 0
        ? Math.floor(substituteWorkHistory.length / substitutes.length)
        : 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = formatDate(year, month, day);
        const offIds = allOffs[dateKey] || [];
        const baseOffEmployees = baseEmployees.filter(function (employee) {
            return containsId(offIds, employee.id);
        });
        const subOffEmployees = substitutes.filter(function (employee) {
            return containsId(offIds, employee.id);
        });

        scheduleResult[day] = {
            date: dateKey,
            offs: baseOffEmployees.map(function (employee) { return employee.name; }),
            subOffs: subOffEmployees.map(function (employee) { return employee.name; }),
            offEmployeeIds: offIds.slice(),
            subs: [],
            status: 'ok'
        };

        baseOffEmployees.forEach(function (baseEmployee) {
            const assignedSubstitutes = scheduleResult[day].subs;
            const candidates = getValidSubstitutes(
                baseEmployee,
                dateKey,
                substitutes,
                substitutePermissions,
                allOffs,
                assignedSubstitutes
            );

            if (candidates.length === 0) {
                scheduleResult[day].status = 'error';
                warnings.push(
                    '[인력 부족] ' + dateKey + ': ' + baseEmployee.name +
                    ' 담당 업무를 대신할 수 있는 대체 직원이 없습니다.'
                );
                return;
            }

            let bestSubstitute = null;
            let highestScore = -Infinity;

            candidates.forEach(function (substitute) {
                const score = calculateSubstituteScore(
                    substitute,
                    baseEmployee,
                    substituteWorkHistory,
                    totalHistorySubCount
                );
                if (score > highestScore) {
                    highestScore = score;
                    bestSubstitute = substitute;
                }
            });

            if (bestSubstitute) {
                assignedSubstitutes.push({
                    subId: bestSubstitute.id,
                    subName: bestSubstitute.name,
                    targetBaseId: baseEmployee.id,
                    targetBaseName: baseEmployee.name,
                    routeName: getEmployeeRouteName(baseEmployee),
                    score: highestScore
                });
            }
        });
    }

    return {
        schedule: scheduleResult,
        warnings: Array.from(new Set(warnings))
    };
}

function getEmployeeType(employee) {
    const rawType = String(employee.type || employee.employee_type || employee.employeeType || '').toLowerCase();
    if (rawType === 'sub' || rawType === 'substitute' || rawType === 'backup' || rawType === '대체') return 'sub';
    if (rawType === 'base' || rawType === 'fixed' || rawType === 'fixed_employee' || rawType === '고정') return 'base';
    return 'base';
}

function getWorkDaysForWeek(employee, weekIndex) {
    const pattern = String(employee.work_pattern || employee.pattern || '');
    const match = pattern.match(/[1-6]/);
    const parsedDays = match ? Number(match[0]) : 6;

    // 프로젝트의 "격주 5일" 패턴은 6일 근무 주와 5일 근무 주를 번갈아 적용합니다.
    if (pattern.indexOf('격주') >= 0 && parsedDays === 5) {
        return weekIndex % 2 === 0 ? 6 : 5;
    }
    return Math.min(6, Math.max(1, parsedDays));
}

function getWeeksInMonth(year, month) {
    const weeks = [];
    let currentWeek = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        currentWeek.push(formatDate(year, month, day));

        // 월요일부터 일요일까지 한 주로 묶습니다.
        if (date.getDay() === 0 || day === daysInMonth) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }
    return weeks;
}

function getValidSubstitutes(baseEmployee, dateKey, substitutes, permissions, allOffs, alreadyAssignedSubs) {
    return substitutes.filter(function (substitute) {
        if (String(substitute.team_id) !== String(baseEmployee.team_id)) return false;
        if (containsId(allOffs[dateKey] || [], substitute.id)) return false;
        if (alreadyAssignedSubs.some(function (item) {
            return String(item.subId) === String(substitute.id);
        })) return false;
        return isSubstituteAllowedForBase(substitute, baseEmployee, permissions);
    });
}

function isSubstituteAllowedForBase(substitute, baseEmployee, permissions) {
    const explicitRulesForSub = permissions.filter(function (permission) {
        return String(permission.substitute_employee_id) === String(substitute.id);
    });

    if (explicitRulesForSub.length > 0) {
        return explicitRulesForSub.some(function (permission) {
            return String(permission.base_employee_id) === String(baseEmployee.id);
        });
    }

    // 현재 UI의 대체 담당 설정은 자유 입력 문구이므로, 명시적인 규칙이 없을 때는 같은 팀을 기본 범위로 사용합니다.
    const target = String(substitute.target || '').trim().toLowerCase();
    if (!target) return true;

    const routeName = getEmployeeRouteName(baseEmployee).toLowerCase();
    const baseName = String(baseEmployee.name || '').toLowerCase();
    const broadScopeWords = ['전지역', '전체', '모든', '백업', '대체', '팀 전체', 'all'];
    if (broadScopeWords.some(function (word) { return target.indexOf(word) >= 0; })) return true;

    return target.indexOf(baseName) >= 0 || (routeName && routeName !== '미지정' && target.indexOf(routeName) >= 0);
}

function calculateSubstituteScore(substitute, baseEmployee, history, averageHistory) {
    const ownHistory = history.filter(function (item) {
        return String(item.substitute_employee_id) === String(substitute.id);
    });
    let totalCount = ownHistory.length;
    if (substitute.is_new) totalCount = averageHistory + totalCount;

    const specificTargetCount = history.filter(function (item) {
        return String(item.substitute_employee_id) === String(substitute.id) &&
            String(item.base_employee_id) === String(baseEmployee.id);
    }).length;

    return (totalCount * WEIGHTS.TOTAL_COUNT) + (specificTargetCount * WEIGHTS.SPECIFIC_TARGET);
}

function getAvailableSubstituteCount(dateKey, teamId, substitutes, allOffs) {
    return substitutes.filter(function (substitute) {
        return String(substitute.team_id) === String(teamId) &&
            !containsId(allOffs[dateKey] || [], substitute.id);
    }).length;
}

function getBaseOffCount(dateKey, teamId, baseEmployees, allOffs) {
    return baseEmployees.filter(function (employee) {
        return String(employee.team_id) === String(teamId) &&
            containsId(allOffs[dateKey] || [], employee.id);
    }).length;
}

function containsId(ids, targetId) {
    return (ids || []).some(function (id) {
        if (id && typeof id === 'object') {
            id = id.employeeId || id.employee_id || id.id;
        }
        return String(id) === String(targetId);
    });
}

function getEmployeeRouteName(employee) {
    const route = employee.route || employee.routeName || employee.route_name || '';
    return String(route || '미지정');
}

function formatDate(year, month, day) {
    return String(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
