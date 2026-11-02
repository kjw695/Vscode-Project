import {
    buildWeeklyScheduleExportRows,
    createWeeklyScheduleXlsxBytes,
    WEEKLY_EXCEL_HEADERS
} from './weeklyScheduleExcel';

function makeWeek() {
    return Array.from({ length: 7 }, function (_, index) {
        return new Date(2024, 10, 24 + index);
    });
}

describe('weekly schedule Excel export', () => {
    test('creates the 8-column upload format without weekday or employee name columns', () => {
        const employees = [{
            id: 'employee-1',
            name: '최정우',
            accountUsername: 'wjddn32',
            team_id: 'team-1',
            type: 'base',
            excelRotations: ['1회전', '2회전']
        }];
        const routes = [
            { id: 'r1', name: '016A', assigned_emp_id: 'employee-1' },
            { id: 'r2', name: '016B', assigned_emp_id: 'employee-1' }
        ];
        const schedule = {};
        makeWeek().forEach(function (date) {
            const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
            schedule[key] = {
                date: key,
                offEmployeeIds: key === '2024-11-26' ? ['employee-1'] : [],
                subs: []
            };
        });

        const rows = buildWeeklyScheduleExportRows({
            employees,
            routes,
            schedule,
            weekDates: makeWeek(),
            team: { id: 'team-1', shift: 'day' },
            businessRegistrationNumber: '8011400958',
            campName: '천안1'
        });

        expect(rows[0]).toEqual(WEEKLY_EXCEL_HEADERS);
        expect(rows[0]).toHaveLength(8);
        expect(rows[0]).not.toContain('요일');
        expect(rows[0]).not.toContain('이름');
        expect(rows[1]).toEqual([
            '2024-11-24', '8011400958', '천안1', 'WAVE2',
            'wjddn32', '출근', '1회전,2회전', '016A,016B'
        ]);
        expect(rows[3]).toEqual([
            '2024-11-26', '8011400958', '천안1', 'WAVE2',
            'wjddn32', '휴무', '', ''
        ]);
    });

    test('uses WAVE1 and employee-specific night rotations', () => {
        const date = makeWeek();
        const schedule = {};
        date.forEach(function (day) {
            const key = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
            schedule[key] = { date: key, offEmployeeIds: [], subs: [] };
        });
        const rows = buildWeeklyScheduleExportRows({
            employees: [{
                id: 'night-1',
                name: '이진',
                accountUsername: 'cjon45',
                type: 'base',
                excelRotations: ['D1', 'D2', 'F3']
            }],
            routes: [
                { name: '915A', assigned_emp_id: 'night-1' },
                { name: '915B', assigned_emp_id: 'night-1' },
                { name: '915C', assigned_emp_id: 'night-1' },
                { name: '915D', assigned_emp_id: 'night-1' }
            ],
            schedule,
            weekDates: date,
            team: { shift: 'night' },
            businessRegistrationNumber: '8011400958',
            campName: '청주1'
        });
        expect(rows[1]).toEqual([
            '2024-11-24', '8011400958', '청주1', 'WAVE1',
            'cjon45', '출근', 'D1,D2,F3', '915A,915B,915C,915D'
        ]);
    });

    test('keeps backup attendance status aligned with the schedule and uses assigned route only on coverage days', () => {
        const dates = makeWeek();
        const schedule = {};
        dates.forEach(function (date, index) {
            const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
            schedule[key] = {
                date: key,
                offEmployeeIds: index === 2 ? ['backup-1'] : [],
                subs: index === 1 ? [{
                    subId: 'backup-1',
                    routeName: '915A,915B'
                }] : []
            };
        });
        const rows = buildWeeklyScheduleExportRows({
            employees: [{
                id: 'backup-1',
                name: '백업 직원',
                accountUsername: 'backup1',
                type: 'sub',
                excelRotations: ['D1']
            }],
            routes: [],
            schedule,
            weekDates: dates,
            team: { shift: 'night' },
            businessRegistrationNumber: '8011400958',
            campName: '청주1'
        });

        expect(rows[1]).toEqual([
            '2024-11-24', '8011400958', '청주1', 'WAVE1',
            'backup1', '출근', 'D1', ''
        ]);
        expect(rows[2]).toEqual([
            '2024-11-25', '8011400958', '청주1', 'WAVE1',
            'backup1', '출근', 'D1', '915A,915B'
        ]);
        expect(rows[3]).toEqual([
            '2024-11-26', '8011400958', '청주1', 'WAVE1',
            'backup1', '휴무', '', ''
        ]);
    });

    test('preserves route codes without spaces and creates an XLSX zip archive', () => {
        const bytes = createWeeklyScheduleXlsxBytes([WEEKLY_EXCEL_HEADERS, ['2024-11-24', '8011400958', '청주1', 'WAVE2', 'wjddn32', '출근', '1회전,2회전', '016A,016B']]);
        expect(bytes[0]).toBe(0x50);
        expect(bytes[1]).toBe(0x4b);
    });

    test('blocks export when a working employee has no login ID or rotation', () => {
        const schedule = {};
        makeWeek().forEach(function (date) {
            const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
            schedule[key] = { date: key, offEmployeeIds: [], subs: [] };
        });
        expect(() => buildWeeklyScheduleExportRows({
            employees: [{ id: 'employee-2', name: '아이디 없음', type: 'base' }],
            routes: [{ name: '016A', assigned_emp_id: 'employee-2' }],
            schedule,
            weekDates: makeWeek(),
            team: { shift: 'day' },
            businessRegistrationNumber: '8011400958',
            campName: '천안1'
        })).toThrow('업로드 아이디가 없습니다.');
    });
});
