/**
 * 휴무관리 / 대체근무 자동배치 엔진
 *
 * 원칙
 * - 고정기사의 업무는 변경하지 않는다.
 * - 대체기사는 실제 근무일에만 배정한다.
 * - 대체기사의 휴무는 절대 깨지 않는다.
 * - 대체 가능 업무가 아닌 경우 배정하지 않는다.
 * - 단순 총 대체 횟수가 아니라 "어떤 업무를 대체했는지"의 분포를 기준으로 선택한다.
 * - 배정 결과는 이후 날짜의 판단에 즉시 반영한다.
 *
 * 이 파일은 UI/React 상태와 분리된 순수 업무 로직이다.
 */

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateKey = (value) => {
  if (value instanceof Date) return new Date(value);
  const [y, m, d] = String(value).split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getDayCode = (date) => DAY_CODES[date.getDay()];

const getWorkRule = (employeeId, workRules = []) =>
  workRules.find((rule) => rule.employeeId === employeeId) || null;

const getOverrideStatus = (employeeId, dateKey, scheduleOverrides = {}) => {
  const employeeOverrides = scheduleOverrides?.[employeeId];
  return employeeOverrides?.[dateKey] || null;
};

const getFixedDayOffSet = (employeeId, fixedDaysOff = {}) => {
  const value = fixedDaysOff?.[employeeId];

  if (Array.isArray(value)) return new Set(value);

  if (value && typeof value === 'object') {
    return new Set(Object.keys(value).filter((key) => value[key] === true));
  }

  return new Set();
};

const getWeekIndexFromReference = (date) => {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const diffDays = Math.floor((date - firstDay) / 86400000);
  return Math.floor(diffDays / 7);
};

const isEmployeeWorking = ({
  employee,
  date,
  workRules,
  scheduleOverrides,
  fixedDaysOff,
}) => {
  if (!employee?.active) return false;

  const dateKey = toDateKey(date);
  const override = getOverrideStatus(
    employee.id,
    dateKey,
    scheduleOverrides
  );

  // 날짜별 실제 상태가 있으면 이것을 최우선으로 사용한다.
  if (override === 'work') return true;
  if (override === 'off') return false;

  if (getFixedDayOffSet(employee.id, fixedDaysOff).has(dateKey)) {
    return false;
  }

  const rule = getWorkRule(employee.id, workRules);

  if (!rule) {
    // 규칙이 없으면 기존 employee.schedule/workSchedule이 있으면 지원한다.
    const schedule =
      employee.workSchedule ||
      employee.schedule ||
      employee.workingDays ||
      null;

    if (schedule && typeof schedule === 'object') {
      if (schedule[dateKey] === 'work' || schedule[dateKey] === true) {
        return true;
      }
      if (schedule[dateKey] === 'off' || schedule[dateKey] === false) {
        return false;
      }
    }

    // 명시적 규칙이 없으면 배치 대상이 되지 않도록 보수적으로 처리한다.
    return false;
  }

  const dayCode = getDayCode(date);
  const workDayNumbers = {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
  };

  const weekDay = workDayNumbers[dayCode];

  if (rule.workDays && Array.isArray(rule.workDays)) {
    return rule.workDays.includes(dayCode) || rule.workDays.includes(weekDay);
  }

  if (rule.pattern === 'weekly-5' || rule.pattern === 'weekly-6') {
    // 요일별 고정 근무일이 아직 지정되지 않은 테스트 데이터에서는
    // 주간 근무일 수만으로 휴무를 임의 결정하지 않는다.
    if (Array.isArray(rule.restDays)) {
      return !rule.restDays.includes(dayCode) && !rule.restDays.includes(weekDay);
    }

    if (Array.isArray(rule.workingDays)) {
      return (
        rule.workingDays.includes(dayCode) ||
        rule.workingDays.includes(weekDay)
      );
    }

    // 주5/주6 패턴만 있는 경우 날짜별 휴무 결정은 별도 휴무생성 단계가 담당한다.
    // 엔진 호출자가 실제 상태를 넘기지 않았다면 기본적으로 근무로 취급한다.
    return true;
  }

  if (rule.pattern === 'biweekly') {
    if (Array.isArray(rule.restDaysByWeek)) {
      const weekIndex = getWeekIndexFromReference(date) % 2;
      const restDays = rule.restDaysByWeek[weekIndex] || [];
      return !restDays.includes(dayCode) && !restDays.includes(weekDay);
    }

    if (Array.isArray(rule.workingDaysByWeek)) {
      const weekIndex = getWeekIndexFromReference(date) % 2;
      const workingDays = rule.workingDaysByWeek[weekIndex] || [];
      return (
        workingDays.includes(dayCode) || workingDays.includes(weekDay)
      );
    }

    if (Array.isArray(rule.workingDays)) {
      return (
        rule.workingDays.includes(dayCode) ||
        rule.workingDays.includes(weekDay)
      );
    }

    return true;
  }

  return true;
};

const routeForFixedEmployee = (fixedEmployee, routes = []) =>
  routes.find(
    (route) =>
      route.assignedEmpId === fixedEmployee.id ||
      route.employeeId === fixedEmployee.id
  ) || null;

const permissionIncludesRoute = (
  substituteEmployeeId,
  route,
  substitutePermissions = {}
) => {
  if (!route) return false;

  const permissions = substitutePermissions?.[substituteEmployeeId];

  if (!permissions) return false;

  if (Array.isArray(permissions)) {
    return permissions.includes(route.id) || permissions.includes(route.name);
  }

  if (permissions && typeof permissions === 'object') {
    return (
      permissions[route.id] === true ||
      permissions[route.name] === true
    );
  }

  return false;
};

const routeMatchesEmployeeTarget = (employee, route) => {
  if (!employee?.target || !route) return false;

  const target = String(employee.target);
  return (
    target === route.id ||
    target === route.name ||
    target
      .split(',')
      .map((value) => value.trim())
      .includes(route.id) ||
    target
      .split(',')
      .map((value) => value.trim())
      .includes(route.name)
  );
};

const canSubstituteRoute = ({
  substitute,
  route,
  substitutePermissions,
}) => {
  if (!substitute || !route) return false;

  if (permissionIncludesRoute(
    substitute.id,
    route,
    substitutePermissions
  )) {
    return true;
  }

  return routeMatchesEmployeeTarget(substitute, route);
};

const historyForSubstitute = (history, substituteEmployeeId) =>
  (history || []).filter(
    (item) => item.substituteEmployeeId === substituteEmployeeId
  );

const countByRoute = (history, substituteEmployeeId) => {
  const result = {};

  historyForSubstitute(history, substituteEmployeeId).forEach((item) => {
    if (!item.routeId) return;
    result[item.routeId] = (result[item.routeId] || 0) + 1;
  });

  return result;
};

const countTotal = (history, substituteEmployeeId) =>
  historyForSubstitute(history, substituteEmployeeId).length;

const routeDistributionRatio = (
  history,
  substituteEmployeeId,
  routeId
) => {
  const total = countTotal(history, substituteEmployeeId);
  if (!total) return 0;

  const routeCounts = countByRoute(history, substituteEmployeeId);
  return (routeCounts[routeId] || 0) / total;
};

const averageRouteRatioAmongActiveSubs = (
  history,
  activeSubstitutes,
  routeId
) => {
  if (!activeSubstitutes.length) return 0;

  const ratios = activeSubstitutes.map((employee) =>
    routeDistributionRatio(history, employee.id, routeId)
  );

  return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
};

/**
 * 낮은 점수가 더 공평한 후보.
 *
 * 1순위: 해당 노선이 현재 후보의 대체업무에서 차지하는 비율이
 *        다른 활성 대체기사 평균보다 얼마나 높은지
 * 2순위: 전체 대체 횟수
 *
 * 따라서 "총 대체 횟수가 적은 사람 무조건 우선"이 아니다.
 */
const candidateScore = ({
  candidate,
  route,
  history,
  activeSubstitutes,
}) => {
  const currentRatio = routeDistributionRatio(
    history,
    candidate.id,
    route.id
  );

  const averageRatio = averageRouteRatioAmongActiveSubs(
    history,
    activeSubstitutes,
    route.id
  );

  const distributionDeviation = Math.abs(currentRatio - averageRatio);

  const routeCount =
    countByRoute(history, candidate.id)[route.id] || 0;

  const totalCount = countTotal(history, candidate.id);

  // 같은 분포라면 전체 횟수를 보조 기준으로 사용한다.
  return (
    distributionDeviation * 1000 +
    routeCount * 10 +
    totalCount * 0.01
  );
};

const createHistoryRecord = ({
  dateKey,
  substitute,
  fixedEmployee,
  route,
}) => ({
  id: `history-${dateKey}-${substitute.id}-${route.id}`,
  date: dateKey,
  substituteEmployeeId: substitute.id,
  fixedEmployeeId: fixedEmployee.id,
  routeId: route.id,
});

const getDatesOfMonth = (year, month) => {
  const dates = [];
  const lastDay = new Date(year, month, 0).getDate();

  for (let day = 1; day <= lastDay; day += 1) {
    dates.push(new Date(year, month - 1, day));
  }

  return dates;
};

/**
 * 한 달 자동배치
 */
export const generateMonthlySchedule = ({
  year,
  month,
  employees = [],
  routes = [],
  workRules = [],
  scheduleOverrides = {},
  fixedDaysOff = {},
  substitutePermissions = {},
  substituteWorkHistory = [],
}) => {
  const fixedEmployees = employees.filter(
    (employee) => employee.active && employee.role === 'base'
  );

  const substituteEmployees = employees.filter(
    (employee) => employee.active && employee.role === 'sub'
  );

  const history = [...substituteWorkHistory];
  const days = getDatesOfMonth(year, month);

  const schedule = [];
  const warnings = [];

  days.forEach((date) => {
    const dateKey = toDateKey(date);
    const baseOffs = [];

    fixedEmployees.forEach((fixedEmployee) => {
      const working = isEmployeeWorking({
        employee: fixedEmployee,
        date,
        workRules,
        scheduleOverrides,
        fixedDaysOff,
      });

      if (!working) {
        const route = routeForFixedEmployee(fixedEmployee, routes);

        baseOffs.push({
          fixedEmployeeId: fixedEmployee.id,
          fixedEmployeeName: fixedEmployee.name,
          routeId: route?.id || null,
          routeName: route?.name || fixedEmployee.target || '미지정',
        });
      }
    });

    const assignments = [];

    baseOffs.forEach((off) => {
      const fixedEmployee = fixedEmployees.find(
        (employee) => employee.id === off.fixedEmployeeId
      );

      const route = routes.find((item) => item.id === off.routeId);

      if (!fixedEmployee || !route) {
        warnings.push({
          date: dateKey,
          type: 'missing-route',
          fixedEmployeeId: off.fixedEmployeeId,
          message: `${off.fixedEmployeeName}의 고정 업무를 찾을 수 없습니다.`,
        });
        return;
      }

      const candidates = substituteEmployees.filter((substitute) => {
        const working = isEmployeeWorking({
          employee: substitute,
          date,
          workRules,
          scheduleOverrides,
          fixedDaysOff,
        });

        if (!working) return false;

        return canSubstituteRoute({
          substitute,
          route,
          substitutePermissions,
        });
      });

      if (!candidates.length) {
        warnings.push({
          date: dateKey,
          type: 'no-substitute',
          fixedEmployeeId: fixedEmployee.id,
          routeId: route.id,
          message: `${dateKey}: ${fixedEmployee.name} 휴무를 대체할 수 있는 근무 중인 대체기사가 없습니다.`,
        });
        return;
      }

      const ranked = [...candidates].sort((a, b) => {
        const scoreA = candidateScore({
          candidate: a,
          route,
          history,
          activeSubstitutes: substituteEmployees,
        });

        const scoreB = candidateScore({
          candidate: b,
          route,
          history,
          activeSubstitutes: substituteEmployees,
        });

        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.id.localeCompare(b.id);
      });

      const selected = ranked[0];

      const assignment = {
        date: dateKey,
        substituteEmployeeId: selected.id,
        substituteEmployeeName: selected.name,
        fixedEmployeeId: fixedEmployee.id,
        fixedEmployeeName: fixedEmployee.name,
        routeId: route.id,
        routeName: route.name,
      };

      assignments.push(assignment);

      // 같은 날짜의 다음 대체업무 판단에도 이번 배정을 반영한다.
      history.push(
        createHistoryRecord({
          dateKey,
          substitute: selected,
          fixedEmployee,
          route,
        })
      );
    });

    schedule.push({
      date: dateKey,
      dayCode: getDayCode(date),
      baseOffs,
      assignments,
    });
  });

  return {
    year,
    month,
    schedule,
    warnings,
    updatedSubstituteWorkHistory: history,
  };
};

export const getSubstituteDistribution = ({
  substituteEmployeeId,
  substituteWorkHistory = [],
  routes = [],
}) => {
  const history = historyForSubstitute(
    substituteWorkHistory,
    substituteEmployeeId
  );

  const routeCounts = countByRoute(
    substituteWorkHistory,
    substituteEmployeeId
  );

  return {
    total: history.length,
    routes: routes.map((route) => ({
      routeId: route.id,
      routeName: route.name,
      count: routeCounts[route.id] || 0,
      ratio:
        history.length > 0
          ? (routeCounts[route.id] || 0) / history.length
          : 0,
    })),
  };
};

export const isWorkingOnDate = ({
  employee,
  date,
  workRules = [],
  scheduleOverrides = {},
  fixedDaysOff = {},
}) =>
  isEmployeeWorking({
    employee,
    date: parseDateKey(date),
    workRules,
    scheduleOverrides,
    fixedDaysOff,
  });

export default {
  generateMonthlySchedule,
  getSubstituteDistribution,
  isWorkingOnDate,
};
