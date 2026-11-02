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

function makeEmptyWeekSchedule(dates) {
    const schedule = {};
    dates.forEach(function (date) {
        const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        schedule[key] = { date: key, offEmployeeIds: [], subs: [] };
    });
    return schedule;
}

describe('weekly schedule Excel export', () => {
    test('exports profile ID and vehicle number in the 9-column upload format', () => {
        const dates = makeWeek();
        const schedule = makeEmptyWeekSchedule(dates);
        schedule['2024-11-26'].offEmployeeIds = ['employee-1'];

        const rows = buildWeeklyScheduleExportRows({
            employees: [{
                id: 'employee-1', name: '최정우', accountMember: true,
                accountUsername: 'wjddn32', accountVehicleNumber: '12가3456',
                team_id: 'team-1', type: 'base', excelRotations: ['1회전', '2회전']
            }],
            routes: [
                { id: 'r1', name: '016A', assigned_emp_id: 'employee-1' },
                { id: 'r2', name: '016B', assigned_emp_id: 'employee-1' }
            ],
            schedule, weekDates: dates, team: { id: 'team-1', shift: 'day' },
            businessRegistrationNumber: '8011400958', campName: '천안1'
        });

        expect(rows[0]).toEqual([
            '업무일', '사업자등록번호', '캠프명', '웨이브', '아이디',
            '차량번호', '업무상태', '회전', '업무라우트'
        ]);
        expect(rows[0]).toHaveLength(9);
        expect(rows[0]).not.toContain('이름');
        expect(rows[1]).toEqual([
            '2024-11-24', '8011400958', '천안1', 'WAVE2',
            'wjddn32', '12가3456', '출근', '1회전,2회전', '016A,016B'
        ]);
        expect(rows[3]).toEqual([
            '2024-11-26', '8011400958', '천안1', 'WAVE2',
            'wjddn32', '12가3456', '휴무', '', ''
        ]);
    });

    test('uses WAVE1 and night rotations D1, D2, F3', () => {
        const dates = makeWeek();
        const rows = buildWeeklyScheduleExportRows({
            employees: [{
                id: 'night-1', name: '이진', accountMember: true,
                accountUsername: 'cjon45', accountVehicleNumber: '88가1122',
                type: 'base', excelRotations: ['D1', 'D2', 'F3']
            }],
            routes: [
                { name: '915A', assigned_emp_id: 'night-1' },
                { name: '915B', assigned_emp_id: 'night-1' },
                { name: '915C', assigned_emp_id: 'night-1' },
                { name: '915D', assigned_emp_id: 'night-1' }
            ],
            schedule: makeEmptyWeekSchedule(dates), weekDates: dates,
            team: { shift: 'night' }, businessRegistrationNumber: '8011400958', campName: '청주1'
        });
        expect(rows[1]).toEqual([
            '2024-11-24', '8011400958', '청주1', 'WAVE1',
            'cjon45', '88가1122', '출근', 'D1,D2,F3', '915A,915B,915C,915D'
        ]);
    });

    test('keeps backup attendance and route assignment separate', () => {
        const dates = makeWeek();
        const schedule = makeEmptyWeekSchedule(dates);
        schedule['2024-11-25'].subs = [{ subId: 'backup-1', routeName: '915A,915B' }];
        schedule['2024-11-26'].offEmployeeIds = ['backup-1'];

        const rows = buildWeeklyScheduleExportRows({
            employees: [{
                id: 'backup-1', name: '백업 직원', accountMember: true,
                accountUsername: 'backup1', accountVehicleNumber: '99나1234',
                type: 'sub', excelRotations: ['D1']
            }],
            routes: [], schedule, weekDates: dates, team: { shift: 'night' },
            businessRegistrationNumber: '8011400958', campName: '청주1'
        });

        expect(rows[1]).toEqual([
            '2024-11-24', '8011400958', '청주1', 'WAVE1',
            'backup1', '99나1234', '출근', 'D1', ''
        ]);
        expect(rows[2]).toEqual([
            '2024-11-25', '8011400958', '청주1', 'WAVE1',
            'backup1', '99나1234', '출근', 'D1', '915A,915B'
        ]);
        expect(rows[3]).toEqual([
            '2024-11-26', '8011400958', '청주1', 'WAVE1',
            'backup1', '99나1234', '휴무', '', ''
        ]);
    });

    test('creates a ZIP signature for the XLSX workbook', () => {
        const bytes = createWeeklyScheduleXlsxBytes([
            WEEKLY_EXCEL_HEADERS,
            ['2024-11-24', '8011400958', '청주1', 'WAVE2', 'wjddn32', '12가3456', '출근', '1회전', '016A']
        ]);
        expect(bytes[0]).toBe(0x50);
        expect(bytes[1]).toBe(0x4b);
    });

    test('blocks export when the employee profile ID is missing', () => {
        const dates = makeWeek();
        expect(() => buildWeeklyScheduleExportRows({
            employees: [{
                id: 'employee-2', name: '아이디 없음', accountMember: true,
                accountUsername: '', type: 'base', excelRotations: []
            }],
            routes: [{ name: '016A', assigned_emp_id: 'employee-2' }],
            schedule: makeEmptyWeekSchedule(dates), weekDates: dates,
            team: { shift: 'day' }, businessRegistrationNumber: '8011400958', campName: '천안1'
        })).toThrow('직원 프로필의 아이디가 없습니다.');
    });
});
