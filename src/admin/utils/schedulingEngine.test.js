import { generateMonthlySchedule, generateWeeklySchedule, rebalanceWeeklyScheduleDay, validateWeeklySchedule } from './schedulingEngine';

const createEmployee = (id, name, type, pattern, target) => ({
    id,
    name,
    type,
    pattern,
    team_id: 'T1',
    ...(target ? { target } : {})
});

const makeSchedule = (employees, permissions = []) =>
    generateMonthlySchedule({
        year: 2026,
        month: 10,
        employees,
        substitutePermissions: permissions,
        fixedDaysOff: [],
        substituteWorkHistory: []
    });

describe('generateMonthlySchedule', () => {
    test('creates an entry for every date in the selected month', () => {
        const result = makeSchedule([
            createEmployee(1, '고정 기사', 'base', '주 5일'),
            createEmployee(2, '대체 기사', 'sub', '주 5일', '전지역 백업')
        ]);

        expect(Object.keys(result.schedule)).toHaveLength(31);
        expect(result.schedule[1].date).toBe('2026-10-01');
        expect(result.schedule[31].date).toBe('2026-10-31');
    });

    test('does not assign a substitute on their own scheduled day off', () => {
        const result = makeSchedule([
            createEmployee(1, '고정 기사 A', 'base', '주 5일'),
            createEmployee(2, '고정 기사 B', 'base', '주 6일'),
            createEmployee(3, '대체 기사', 'sub', '주 5일', '전지역 백업')
        ]);

        Object.values(result.schedule).forEach((day) => {
            day.subs.forEach((assignment) => {
                expect(day.offEmployeeIds.map(String)).not.toContain(String(assignment.subId));
            });
        });
    });

    test('does not assign one substitute to two routes on the same day', () => {
        const result = makeSchedule([
            createEmployee(1, '고정 기사 A', 'base', '주 5일'),
            createEmployee(2, '고정 기사 B', 'base', '주 5일'),
            createEmployee(3, '대체 기사', 'sub', '주 6일', '전지역 백업')
        ]);

        Object.values(result.schedule).forEach((day) => {
            const substituteIds = day.subs.map((assignment) => String(assignment.subId));
            expect(new Set(substituteIds).size).toBe(substituteIds.length);
        });
    });

    test('only assigns a substitute to employees covered by explicit permissions', () => {
        const result = makeSchedule(
            [
                createEmployee(1, '고정 기사 A', 'base', '주 5일'),
                createEmployee(2, '고정 기사 B', 'base', '주 5일'),
                createEmployee(3, '대체 기사', 'sub', '주 6일', '전지역 백업')
            ],
            [{ substitute_employee_id: 3, base_employee_id: 1 }]
        );

        Object.values(result.schedule).forEach((day) => {
            day.subs.forEach((assignment) => {
                expect(String(assignment.targetBaseId)).toBe('1');
            });
        });
    });

    test('records staffing warnings when no substitute can cover an absent fixed employee', () => {
        const result = makeSchedule([
            createEmployee(1, '고정 기사', 'base', '주 5일')
        ]);

        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings.join(' ')).toMatch(/백업/);
        // 백업이 없어도 고정 직원의 휴무는 지정하고, 근무 가능한 백업 부족을 따로 알려야 합니다.
        expect(Object.values(result.schedule).some((day) =>
            day.offEmployeeIds.map(String).includes('1')
        )).toBe(true);
        expect(result.warnings.join(' ')).toMatch(/백업/);
    });
});

describe('generateWeeklySchedule', () => {
    test('creates exactly the selected Sunday-to-Saturday week, including month boundaries', () => {
        const result = generateWeeklySchedule({
            weekStart: '2026-09-27',
            employees: [
                createEmployee(1, '고정 기사', 'base', '주 5일'),
                createEmployee(2, '대체 기사', 'sub', '주 5일', '전지역 백업')
            ],
            substitutePermissions: [],
            fixedDaysOff: [],
            substituteWorkHistory: []
        });

        const dates = Object.keys(result.schedule).sort();
        expect(dates).toEqual([
            '2026-09-27',
            '2026-09-28',
            '2026-09-29',
            '2026-09-30',
            '2026-10-01',
            '2026-10-02',
            '2026-10-03'
        ]);
        expect(Object.values(result.schedule).every((record) => record.date)).toBe(true);
    });

    test('still schedules the fixed employee rest day when no backup staff exist', () => {
        const result = generateWeeklySchedule({
            weekStart: '2026-10-19',
            employees: [createEmployee(1, '고정 기사', 'base', '주 5일')],
            substitutePermissions: [],
            fixedDaysOff: [],
            substituteWorkHistory: []
        });

        expect(Object.values(result.schedule).some((day) =>
            day.offEmployeeIds.map(String).includes('1')
        )).toBe(true);
        expect(result.warnings.join(' ')).toMatch(/백업/);
    });

    test('keeps a substitute off on their scheduled rest day', () => {
        const result = generateWeeklySchedule({
            weekStart: '2026-10-19',
            employees: [
                createEmployee(1, '고정 기사', 'base', '주 5일'),
                createEmployee(2, '대체 기사', 'sub', '주 5일', '전지역 백업')
            ],
            substitutePermissions: [],
            fixedDaysOff: [{ date: '2026-10-19', employee_id: 2 }],
            substituteWorkHistory: []
        });

        const monday = result.schedule['2026-10-19'];
        expect(monday.offEmployeeIds.map(String)).toContain('2');
        expect(monday.subs.map((assignment) => String(assignment.subId))).not.toContain('2');
    });
});


describe('alternating-week work patterns', () => {
 test('alternates 격주 5일 across Sunday-start weeks', () => {
  const employee = createEmployee(1, '격주 직원', 'base', '격주 5일');
  const weeks = ['2026-10-18', '2026-10-25', '2026-11-01'].map((weekStart) => generateWeeklySchedule({ weekStart, employees: [employee], fixedDaysOff: [], substitutePermissions: [], substituteWorkHistory: [] }));
  const offCounts = weeks.map((result) => Object.values(result.schedule).filter((day) => day.offEmployeeIds.map(String).includes('1')).length);
  expect(offCounts[0]).not.toBe(offCounts[1]);
  expect(offCounts[0]).toBe(offCounts[2]);
 });
});

describe('rebalanceWeeklyScheduleDay', () => {
    test('uses historical backup workload to balance newly assigned routes', () => {
        const employees = [
            createEmployee(1, '고정 기사 A', 'base', '주 5일'),
            createEmployee(2, '고정 기사 B', 'base', '주 5일'),
            createEmployee(3, '백업 기사 누적', 'sub', '주 6일', '전지역 백업'),
            createEmployee(4, '백업 기사 여유', 'sub', '주 6일', '전지역 백업')
        ];
        const history = Array.from({ length: 6 }, (_, index) => ({
            substitute_employee_id: 3,
            base_employee_id: index % 2 === 0 ? 1 : 2
        }));

        const result = rebalanceWeeklyScheduleDay({
            dateKey: '2026-10-19',
            employees,
            offEmployeeIds: [1, 2],
            existingRecord: { date: '2026-10-19', offEmployeeIds: [], subs: [] },
            substitutePermissions: [],
            substituteWorkHistory: history
        });

        expect(result.warnings).toHaveLength(0);
        expect(result.record.subs).toHaveLength(2);
        expect(result.record.subs[0].subId).toBe(4);
        expect(result.record.subs[1].subId).toBe(3);
        expect(new Set(result.record.subs.map((item) => String(item.subId))).size).toBe(2);
    });

    test('preserves valid existing assignments and does not assign an off backup', () => {
        const employees = [
            createEmployee(1, '고정 기사', 'base', '주 5일'),
            createEmployee(2, '백업 기사 A', 'sub', '주 6일'),
            createEmployee(3, '백업 기사 B', 'sub', '주 6일')
        ];

        const result = rebalanceWeeklyScheduleDay({
            dateKey: '2026-10-19',
            employees,
            offEmployeeIds: [1, 2],
            existingRecord: {
                offEmployeeIds: [1],
                subs: [{
                    subId: 3,
                    subName: '백업 기사 B',
                    targetBaseId: 1,
                    targetBaseName: '고정 기사'
                }]
            },
            substitutePermissions: [],
            substituteWorkHistory: []
        });

        expect(result.record.subs).toHaveLength(1);
        expect(String(result.record.subs[0].subId)).toBe('3');
        expect(result.warnings).toHaveLength(0);
    });

    test('respects explicit backup-to-route permissions and reports uncovered routes', () => {
        const employees = [
            createEmployee(1, '고정 기사 A', 'base', '주 5일'),
            createEmployee(2, '고정 기사 B', 'base', '주 5일'),
            createEmployee(3, '백업 기사', 'sub', '주 6일', '전지역 백업')
        ];

        const result = rebalanceWeeklyScheduleDay({
            dateKey: '2026-10-19',
            employees,
            offEmployeeIds: [1, 2],
            existingRecord: { subs: [] },
            substitutePermissions: [{ substitute_employee_id: 3, base_employee_id: 1 }],
            substituteWorkHistory: []
        });

        expect(result.record.subs.map((item) => String(item.targetBaseId))).toEqual(['1']);
        expect(result.warnings.join(' ')).toMatch(/고정 기사 B/);
    });
});

describe('validateWeeklySchedule', () => {
    test('detects duplicate backup assignments and a backup assigned on its own off day', () => {
        const employees = [
            createEmployee(1, '고정 기사', 'base', '주 5일'),
            createEmployee(2, '백업 기사', 'sub', '주 6일')
        ];
        const generated = generateWeeklySchedule({
            weekStart: '2026-10-18',
            employees,
            substitutePermissions: [],
            fixedDaysOff: [],
            substituteWorkHistory: []
        });
        const date = Object.keys(generated.schedule).find((key) =>
            generated.schedule[key].offEmployeeIds.map(String).includes('1')
        );
        const day = generated.schedule[date];
        day.offEmployeeIds = day.offEmployeeIds.concat([2]);
        day.subs = [
            { subId: 2, targetBaseId: 1 },
            { subId: 2, targetBaseId: 1 }
        ];

        const warnings = validateWeeklySchedule({
            weekStart: '2026-10-18',
            schedule: generated.schedule,
            employees,
            substitutePermissions: []
        });

        expect(warnings.join(' ')).toMatch(/백업 배정 충돌/);
        expect(warnings.join(' ')).toMatch(/백업 중복 배정/);
    });

    test('detects an alternating-week count that no longer matches its phase', () => {
        const employee = createEmployee(1, '격주 직원', 'base', '격주 5일');
        const generated = generateWeeklySchedule({
            weekStart: '2026-10-18',
            employees: [employee],
            substitutePermissions: [],
            fixedDaysOff: [],
            substituteWorkHistory: []
        });
        const alteredSchedule = {};
        Object.keys(generated.schedule).forEach((date) => {
            alteredSchedule[date] = {
                ...generated.schedule[date],
                offEmployeeIds: [],
                offs: [],
                subs: []
            };
        });

        const warnings = validateWeeklySchedule({
            weekStart: '2026-10-18',
            schedule: alteredSchedule,
            employees: [employee],
            substitutePermissions: []
        });

        expect(warnings.join(' ')).toMatch(/격주 근무 검증/);
    });
});
