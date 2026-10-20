// src/admin/utils/schedulingEngine.js
// 직원의 type/pattern과 이전 데이터의 employee_type/work_pattern을 함께 지원합니다.

const WEIGHTS = {
    TOTAL_COUNT: -10,
    SPECIFIC_TARGET: -20
};

/**
 * 기존 월간 생성 함수는 호환성을 위해 유지합니다.
 * 신규 근무표 화면은 generateWeeklySchedule을 사용해 선택한 주만 생성합니다.
 */
export function generateMonthlySchedule(options = {}) {
    const year = Number(options.year);
    const month = Number(options.month);
    const daysInMonth = new Date(year, month, 0).getDate();
    const weeks = getWeeksInMonth(year, month);
    const result = generateScheduleForWeeks({
        weeks,
        employees: options.employees || [],
        substitutePermissions: options.substitutePermissions || [],
        fixedDaysOff: options.fixedDaysOff || [],
        substituteWorkHistory: options.substituteWorkHistory || [],
        weekIndexOffset: getStableWeekIndex(getSunday(new Date(year, month - 1, 1)))
    });

    const monthSchedule = {};
    Object.keys(result.schedule).forEach(function (dateKey) {
        const day = Number(dateKey.slice(-2));
        if (day >= 1 && day <= daysInMonth) monthSchedule[day] = result.schedule[dateKey];
    });

    return { schedule: monthSchedule, warnings: result.warnings };
}

/**
 * weekStart가 속한 일요일~토요일 7일만 생성합니다.
 * 반환 객체의 키는 날짜 충돌을 막기 위해 YYYY-MM-DD 형식입니다.
 */
export function generateWeeklySchedule(options = {}) {
    const startDate = parseDateInput(options.weekStart);
    if (!startDate || Number.isNaN(startDate.getTime())) {
        throw new Error('유효한 주 시작 날짜(YYYY-MM-DD)가 필요합니다.');
    }

    const sunday = getSunday(startDate);
    const weekDates = Array.from({ length: 7 }, function (_, index) {
        const date = new Date(sunday);
        date.setDate(sunday.getDate() + index);
        return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
    });

    return generateScheduleForWeeks({
        weeks: [weekDates],
        employees: options.employees || [],
        substitutePermissions: options.substitutePermissions || [],
        fixedDaysOff: options.fixedDaysOff || [],
        substituteWorkHistory: options.substituteWorkHistory || [],
        // 격주 패턴은 월이 바뀌어도 초기화하지 않고 주차를 연속해서 계산합니다.
        weekIndexOffset: getStableWeekIndex(sunday)
    });
}

function generateScheduleForWeeks(options) {
    const weeks = options.weeks || [];
    const employees = options.employees || [];
    const substitutePermissions = options.substitutePermissions || [];
    const fixedDaysOff = options.fixedDaysOff || [];
    const substituteWorkHistory = options.substituteWorkHistory || [];
    const weekIndexOffset = Number(options.weekIndexOffset || 0);

    const activeEmployees = employees.filter(function (employee) {
        return employee && employee.active !== false;
    });
    const baseEmployees = activeEmployees.filter(function (employee) {
        return getEmployeeType(employee) === 'base';
    });
    const substitutes = activeEmployees.filter(function (employee) {
        return getEmployeeType(employee) === 'sub';
    });

    const allDateKeys = new Set([].concat.apply([], weeks));
    const scheduleResult = {};
    const warnings = [];
    const allOffs = {};

    fixedDaysOff.forEach(function (off) {
        if (!off || !off.date || off.employee_id == null) return;
        const dateKey = String(off.date).slice(0, 10);
        if (!allDateKeys.has(dateKey)) return;
        if (!allOffs[dateKey]) allOffs[dateKey] = [];
        if (!containsId(allOffs[dateKey], off.employee_id)) {
            allOffs[dateKey].push(off.employee_id);
        }
    });

    // 직원 설정에서 지정한 고정 휴무 요일을 먼저 반영합니다.
    // 일반 패턴은 매주 같은 요일을, 격주 패턴은 짧은 주/긴 주별 설정을 적용합니다.
    // 요일 번호: 0=일요일, 1=월요일 ... 6=토요일
    activeEmployees.forEach(function (employee) {
        const normalizeWeekdays = function (values) {
            return Array.isArray(values)
                ? Array.from(new Set(values.map(Number).filter(function (day) {
                    return Number.isInteger(day) && day >= 0 && day <= 6;
                })))
                : [];
        };

        const commonFixedWeekdays = normalizeWeekdays(employee.fixedOffWeekdays);
        const fixedByWeek = employee.fixedOffWeekdaysByWeek;
        const employeePattern = String(employee.pattern || employee.work_pattern || '');
        const usesAlternatingWeeks = employeePattern.includes('격주') &&
            fixedByWeek && typeof fixedByWeek === 'object';

        weeks.forEach(function (weekDates, weekIndex) {
            let fixedOffWeekdays = commonFixedWeekdays;

            if (usesAlternatingWeeks) {
                const workDaysThisWeek = getWorkDaysForWeek(employee, weekIndexOffset + weekIndex);
                const match = employeePattern.match(/[1-6]/);
                const targetDays = match ? Number(match[0]) : 6;
                const isShortWorkWeek = workDaysThisWeek === targetDays;
                const selectedWeekdays = isShortWorkWeek ? fixedByWeek.shortWeek : fixedByWeek.longWeek;
                fixedOffWeekdays = normalizeWeekdays(selectedWeekdays);
            }

            if (fixedOffWeekdays.length === 0) return;

            weekDates.forEach(function (dateKey) {
                const match = String(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (!match) return;
                const weekday = new Date(
                    Number(match[1]),
                    Number(match[2]) - 1,
                    Number(match[3])
                ).getDay();
                if (!fixedOffWeekdays.includes(weekday)) return;

                if (!allOffs[dateKey]) allOffs[dateKey] = [];
                if (!containsId(allOffs[dateKey], employee.id)) {
                    allOffs[dateKey].push(employee.id);
                }
            });
        });
    });

    // 백업 직원의 휴무부터 배치해 대체 가능 인원을 먼저 확보합니다.
    const patternOrder = substitutes.concat(baseEmployees);
    patternOrder.forEach(function (employee) {
        weeks.forEach(function (weekDates, weekIndex) {
            const workDays = getWorkDaysForWeek(employee, weekIndexOffset + weekIndex);
            const targetOffCount = Math.max(0, weekDates.length - Math.min(workDays, weekDates.length));
            if (workDays >= 7) {
                warnings.push(
                    '[휴무 없음 경고] ' + employee.name + ': ' + weekDates[0] +
                    ' 주간은 격주 6일 패턴에 따라 7일 근무 기준(휴무 0일)이 됩니다. ' +
                    '7일 연속 근무는 허용되지 않으므로 고정 휴무를 지정하거나 근무 패턴을 조정하세요.'
                );
            }
            const alreadyOffCount = weekDates.filter(function (dateKey) {
                return containsId(allOffs[dateKey] || [], employee.id);
            }).length;

            // 고정 휴무일이 격주 패턴의 목표 휴무일보다 많으면 실제 근무일이 목표보다 줄어듭니다.
            if (alreadyOffCount > targetOffCount) {
                warnings.push(
                    '[고정 휴무와 근무 패턴 충돌] ' + employee.name + ': ' + weekDates[0] +
                    ' 주간은 목표 ' + workDays + '일 근무지만 고정 휴무가 ' + alreadyOffCount +
                    '일 지정되어 실제 근무일이 ' + (weekDates.length - alreadyOffCount) +
                    '일로 줄어듭니다.'
                );
            }

            let remainingOffs = Math.max(0, targetOffCount - alreadyOffCount);
            if (remainingOffs === 0) return;

            const candidateDates = weekDates.filter(function (dateKey) {
                return !containsId(allOffs[dateKey] || [], employee.id);
            }).sort(function (a, b) {
                const aCoverage = getAvailableSubstituteCount(a, employee.team_id, substitutes, allOffs);
                const bCoverage = getAvailableSubstituteCount(b, employee.team_id, substitutes, allOffs);
                const aBaseOffs = getBaseOffCount(a, employee.team_id, baseEmployees, allOffs);
                const bBaseOffs = getBaseOffCount(b, employee.team_id, baseEmployees, allOffs);
                const aSubOffs = getTeamSubOffCount(a, employee.team_id, substitutes, allOffs);
                const bSubOffs = getTeamSubOffCount(b, employee.team_id, substitutes, allOffs);
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

                // 휴무는 백업 인원이 부족해도 일정에 지정합니다.
                // 백업 배정은 아래 검증에서 별도 경고로 알려 근무자의 휴무가 사라지지 않게 합니다.

                if (!allOffs[dateKey]) allOffs[dateKey] = [];
                if (!containsId(allOffs[dateKey], employee.id)) {
                    allOffs[dateKey].push(employee.id);
                    remainingOffs -= 1;
                }
            });

            if (remainingOffs > 0) {
                warnings.push(
                    '[휴무 패턴 미충족] ' + employee.name + ': ' + weekDates[0] +
                    ' 주간에 휴무 ' + remainingOffs + '일을 추가 배정하지 못했습니다. 백업 인원을 확인하세요.'
                );
            }
        });
    });

    const totalHistorySubCount = substitutes.length > 0
        ? Math.floor(substituteWorkHistory.length / substitutes.length)
        : 0;
    const sortedDateKeys = Array.from(allDateKeys).sort();

    sortedDateKeys.forEach(function (dateKey) {
        const offIds = allOffs[dateKey] || [];
        const baseOffEmployees = baseEmployees.filter(function (employee) {
            return containsId(offIds, employee.id);
        });
        const subOffEmployees = substitutes.filter(function (employee) {
            return containsId(offIds, employee.id);
        });

        scheduleResult[dateKey] = {
            date: dateKey,
            offs: baseOffEmployees.map(function (employee) { return employee.name; }),
            subOffs: subOffEmployees.map(function (employee) { return employee.name; }),
            offEmployeeIds: offIds.slice(),
            subs: [],
            status: 'ok'
        };

        baseOffEmployees.forEach(function (baseEmployee) {
            const assignedSubstitutes = scheduleResult[dateKey].subs;
            const candidates = getValidSubstitutes(
                baseEmployee,
                dateKey,
                substitutes,
                substitutePermissions,
                allOffs,
                assignedSubstitutes
            );

            if (candidates.length === 0) {
                scheduleResult[dateKey].status = 'error';
                warnings.push(
                    '[백업 인원 확인 필요] ' + dateKey + ': ' + baseEmployee.name +
                    ' 담당 노선을 맡을 수 있는 근무 가능 백업이 없습니다.'
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
    });

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
    // 직원관리에서 저장한 pattern을 우선 사용하고, 예전 데이터의 work_pattern은 보조로 읽습니다.
    const pattern = String(employee.pattern || employee.work_pattern || '');
    const match = pattern.match(/[1-6]/);
    const parsedDays = match ? Number(match[0]) : 6;

    // '격주 N일'은 N일 근무 주와 N+1일 근무 주를 번갈아 적용합니다.
    // 격주 짝을 맺은 직원은 biweeklyWeekOffset(0/1)으로 서로 반대 주기를 가집니다.
    // 주차는 1970-01-04(일요일) 기준으로 고정해 월이 바뀌어도 교대가 유지됩니다.
    if (pattern.includes('격주')) {
        const targetDays = Math.min(6, Math.max(1, parsedDays));
        const alternateDays = targetDays + 1;
        const phaseOffset = Number(employee.biweeklyWeekOffset) === 1 ? 1 : 0;
        return Math.abs((weekIndex + phaseOffset) % 2) === 0 ? alternateDays : targetDays;
    }
    return Math.min(6, Math.max(1, parsedDays));
}

function getWeeksInMonth(year, month) {
    const weeks = [];
    let currentWeek = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day);
        currentWeek.push(formatDate(year, month, day));
        if (date.getDay() === 6 || day === daysInMonth) {
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

function getTeamSubOffCount(dateKey, teamId, substitutes, allOffs) {
    return substitutes.filter(function (substitute) {
        return String(substitute.team_id) === String(teamId) &&
            containsId(allOffs[dateKey] || [], substitute.id);
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

function parseDateInput(value) {
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    if (typeof value === 'string') {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    if (value == null) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getSunday(date) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() - result.getDay());
    return result;
}

function getStableWeekIndex(sunday) {
    const weekMilliseconds = 7 * 24 * 60 * 60 * 1000;
    const currentSundayUtc = Date.UTC(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());
    const anchorSundayUtc = Date.UTC(1970, 0, 4);
    return Math.floor((currentSundayUtc - anchorSundayUtc) / weekMilliseconds);
}

function formatDate(year, month, day) {
    return String(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
