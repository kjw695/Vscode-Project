import React, { useMemo, useState } from 'react';
import { generateMonthlySchedule } from './utils/schedulingEngine';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const formatMoney = (value) =>
  new Intl.NumberFormat('ko-KR').format(value);

const Calendar = ({
  employees,
  routes,
  workRules,
  scheduleOverrides,
  fixedDaysOff,
  substitutePermissions,
  substituteWorkHistory,
  onHistoryChange,
}) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [generated, setGenerated] = useState(null);

  const result = useMemo(() => {
    return generateMonthlySchedule({
      year,
      month,
      employees,
      routes,
      workRules,
      scheduleOverrides,
      fixedDaysOff,
      substitutePermissions,
      substituteWorkHistory,
    });
  }, [
    year,
    month,
    employees,
    routes,
    workRules,
    scheduleOverrides,
    fixedDaysOff,
    substitutePermissions,
    substituteWorkHistory,
  ]);

  const handleGenerate = () => {
    setGenerated(result);
    onHistoryChange?.(result.updatedSubstituteWorkHistory);
  };

  const displayed = generated || result;

  const calendarCells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const cells = [];

    for (let i = 0; i < first.getDay(); i += 1) {
      cells.push(null);
    }

    displayed.schedule.forEach((day) => cells.push(day));

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [displayed.schedule, month, year]);

  const moveMonth = (delta) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setGenerated(null);
  };

  const baseEmployeeById = useMemo(
    () =>
      Object.fromEntries(
        employees.map((employee) => [employee.id, employee])
      ),
    [employees]
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">휴무 · 대체근무 자동배치</h2>
          <p className="text-sm text-gray-500">
            고정업무는 유지하고, 근무 중인 대체기사에게 업무를 공평하게 분배합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="rounded-lg border px-3 py-2"
          >
            이전
          </button>

          <strong className="min-w-24 text-center">
            {year}년 {month}월
          </strong>

          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="rounded-lg border px-3 py-2"
          >
            다음
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            className="rounded-lg bg-black px-4 py-2 font-semibold text-white"
          >
            자동배치 실행
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border">
        {DAY_NAMES.map((day) => (
          <div
            key={day}
            className="border-b bg-gray-50 p-2 text-center text-sm font-semibold"
          >
            {day}
          </div>
        ))}

        {calendarCells.map((day, index) => (
          <div
            key={day?.date || `empty-${index}`}
            className="min-h-36 border-b border-r p-2"
          >
            {day && (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold">
                    {Number(day.date.slice(-2))}
                  </span>
                  {day.assignments.length > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      대체 {day.assignments.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {day.baseOffs.map((off) => (
                    <div
                      key={`${day.date}-off-${off.fixedEmployeeId}`}
                      className="rounded-md bg-gray-100 px-2 py-1 text-xs"
                    >
                      <div className="font-medium">
                        {off.fixedEmployeeName} 휴무
                      </div>
                      <div className="text-gray-500">{off.routeName}</div>
                    </div>
                  ))}

                  {day.assignments.map((assignment) => {
                    const route = routes.find(
                      (item) => item.id === assignment.routeId
                    );

                    return (
                      <div
                        key={`${day.date}-assignment-${assignment.fixedEmployeeId}`}
                        className="rounded-md bg-blue-50 px-2 py-1 text-xs"
                      >
                        <div className="font-medium text-blue-800">
                          {assignment.substituteEmployeeName} →{' '}
                          {assignment.fixedEmployeeName}
                        </div>
                        <div className="text-blue-600">
                          {assignment.routeName}
                          {route?.averageEarnings
                            ? ` · ${formatMoney(route.averageEarnings)}`
                            : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {displayed.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="mb-2 font-bold text-amber-900">
            자동배치 확인 필요 ({displayed.warnings.length})
          </h3>

          <div className="space-y-1 text-sm text-amber-800">
            {displayed.warnings.map((warning, index) => (
              <div key={`${warning.date}-${warning.type}-${index}`}>
                {warning.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border p-4">
        <h3 className="mb-3 font-bold">대체기사 현재 분포</h3>

        <div className="grid gap-3 md:grid-cols-2">
          {employees
            .filter((employee) => employee.role === 'sub' && employee.active)
            .map((employee) => {
              const history = displayed.updatedSubstituteWorkHistory.filter(
                (item) => item.substituteEmployeeId === employee.id
              );

              const counts = routes.map((route) => ({
                ...route,
                count: history.filter(
                  (item) => item.routeId === route.id
                ).length,
              }));

              return (
                <div key={employee.id} className="rounded-lg bg-gray-50 p-3">
                  <div className="mb-2 font-semibold">{employee.name}</div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {counts.map((route) => (
                      <span
                        key={route.id}
                        className="rounded-full border bg-white px-2 py-1"
                      >
                        {route.name} {route.count}회
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    총 대체 {history.length}회
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="hidden">
        {Object.keys(baseEmployeeById).length}
      </div>
    </section>
  );
};

export default Calendar;
