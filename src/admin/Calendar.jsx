import React, { useMemo, useState } from 'react';
import {
  generateMonthlySchedule,
  isWorkingOnDate,
} from './utils/schedulingEngine';

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
  onScheduleOverridesChange,
}) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [generated, setGenerated] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const result = useMemo(
    () =>
      generateMonthlySchedule({
        year,
        month,
        employees,
        routes,
        workRules,
        scheduleOverrides,
        fixedDaysOff,
        substitutePermissions,
        substituteWorkHistory,
      }),
    [
      year,
      month,
      employees,
      routes,
      workRules,
      scheduleOverrides,
      fixedDaysOff,
      substitutePermissions,
      substituteWorkHistory,
    ]
  );

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

  const selectedEmployees = useMemo(
    () =>
      employees
        .filter((employee) => employee.active)
        .sort((a, b) => {
          if (a.role !== b.role) return a.role === 'base' ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    [employees]
  );

  const getEmployeeStatus = (employee, dateKey) =>
    isWorkingOnDate({
      employee,
      date: dateKey,
      workRules,
      scheduleOverrides,
      fixedDaysOff,
    });

  const changeEmployeeStatus = (employeeId, dateKey, shouldWork) => {
    const next = {
      ...scheduleOverrides,
      [employeeId]: {
        ...(scheduleOverrides?.[employeeId] || {}),
        [dateKey]: shouldWork ? 'work' : 'off',
      },
    };

    onScheduleOverridesChange?.(next);
    setGenerated(null);
  };

  const handleGenerate = () => {
    setGenerated(result);
    onHistoryChange?.(result.updatedSubstituteWorkHistory);
  };

  const moveMonth = (delta) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setSelectedDate(null);
    setGenerated(null);
  };

  const openDateEditor = (dateKey) => {
    setSelectedDate((current) => (current === dateKey ? null : dateKey));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">휴무 · 대체근무 자동배치</h2>
          <p className="text-sm text-gray-500">
            휴무를 변경한 뒤 자동배치를 실행하면 변경된 근무상태가 반영됩니다.
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

      <div className="rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-600">
        날짜를 클릭하면 해당 날짜의 <strong>근무 / 휴무</strong>를 직접 변경할 수 있습니다.
        대체기사의 휴무도 같은 방식으로 관리하며, 휴무 상태에서는 자동배치 대상에서 제외됩니다.
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
            className={`min-h-36 border-b border-r p-2 ${
              day?.date === selectedDate ? 'bg-blue-50' : ''
            }`}
          >
            {day && (
              <>
                <button
                  type="button"
                  onClick={() => openDateEditor(day.date)}
                  className="mb-2 flex w-full items-center justify-between text-left"
                >
                  <span className="font-semibold">
                    {Number(day.date.slice(-2))}
                  </span>

                  <span className="text-xs text-gray-500">
                    휴무 수정
                  </span>
                </button>

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

                {selectedDate === day.date && (
                  <div className="mt-3 rounded-lg border bg-white p-2 shadow-sm">
                    <div className="mb-2 text-xs font-semibold">
                      {day.date} 근무상태
                    </div>

                    <div className="space-y-2">
                      {selectedEmployees.map((employee) => {
                        const working = getEmployeeStatus(employee, day.date);

                        return (
                          <div
                            key={employee.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-medium">
                                {employee.name}
                              </span>
                              <span className="ml-1 text-gray-400">
                                {employee.role === 'base'
                                  ? '고정'
                                  : '대체'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                changeEmployeeStatus(
                                  employee.id,
                                  day.date,
                                  !working
                                )
                              }
                              className={`rounded-md px-2 py-1 font-medium ${
                                working
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {working ? '근무' : '휴무'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
    </section>
  );
};

export default Calendar;
