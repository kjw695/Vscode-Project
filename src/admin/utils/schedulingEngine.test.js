import {
  generateMonthlySchedule,
  getSubstituteDistribution,
} from './schedulingEngine';

import tempInitData from '../tempInitData';

describe('schedulingEngine', () => {
  test('대체기사는 휴무일에 배정되지 않는다', () => {
    const result = generateMonthlySchedule({
      year: 2026,
      month: 10,
      ...tempInitData,
    });

    result.schedule.forEach((day) => {
      day.assignments.forEach((assignment) => {
        const override =
          tempInitData.scheduleOverrides[assignment.substituteEmployeeId]?.[
            day.date
          ];

        expect(override).not.toBe('off');
      });
    });
  });

  test('대체기사는 허용된 노선만 대체한다', () => {
    const result = generateMonthlySchedule({
      year: 2026,
      month: 10,
      ...tempInitData,
    });

    result.schedule.forEach((day) => {
      day.assignments.forEach((assignment) => {
        const permissions =
          tempInitData.substitutePermissions[
            assignment.substituteEmployeeId
          ] || [];

        expect(permissions).toContain(assignment.routeId);
      });
    });
  });

  test('대체 이력은 어떤 고정업무를 대체했는지 기록한다', () => {
    const result = generateMonthlySchedule({
      year: 2026,
      month: 10,
      ...tempInitData,
    });

    result.updatedSubstituteWorkHistory.forEach((item) => {
      expect(item.substituteEmployeeId).toBeTruthy();
      expect(item.fixedEmployeeId).toBeTruthy();
      expect(item.routeId).toBeTruthy();
      expect(item.date).toMatch(/^\\d{4}-\\d{2}-\\d{2}$/);
    });
  });

  test('신규 대체기사의 초기 분포는 0에서 시작한다', () => {
    const distribution = getSubstituteDistribution({
      substituteEmployeeId: 'new-substitute',
      substituteWorkHistory: tempInitData.substituteWorkHistory,
      routes: tempInitData.routes,
    });

    expect(distribution.total).toBe(0);
    expect(distribution.routes.every((route) => route.count === 0)).toBe(
      true
    );
  });

  test('대체기사 부족 시 경고를 반환한다', () => {
    const employees = tempInitData.employees.map((employee) =>
      employee.id === 'emp-6' || employee.id === 'emp-7'
        ? { ...employee, active: false }
        : employee
    );

    const result = generateMonthlySchedule({
      year: 2026,
      month: 10,
      ...tempInitData,
      employees,
    });

    expect(
      result.warnings.some((warning) => warning.type === 'no-substitute')
    ).toBe(true);
  });
});
