// src/admin/utils/dummyData.js

export const dummyEmployees = [
    // 🍎 청주팀 (T1) - 주 5일 3명, 주 6일 4명 혼합
    { id: 1, name: '김청주1', employee_type: 'BASE', team_id: 'T1', work_pattern: 5 },
    { id: 2, name: '김청주2', employee_type: 'BASE', team_id: 'T1', work_pattern: 5 },
    { id: 3, name: '김청주3', employee_type: 'BASE', team_id: 'T1', work_pattern: 5 },
    { id: 4, name: '김청주4', employee_type: 'BASE', team_id: 'T1', work_pattern: 6 },
    { id: 5, name: '김청주5', employee_type: 'BASE', team_id: 'T1', work_pattern: 6 },
    { id: 6, name: '김청주6', employee_type: 'BASE', team_id: 'T1', work_pattern: 6 },
    { id: 7, name: '김청주7', employee_type: 'BASE', team_id: 'T1', work_pattern: 6 },
    { id: 8, name: '박대체(청주)', employee_type: 'SUBSTITUTE', team_id: 'T1', is_new: false },
    { id: 9, name: '이대체(청주)', employee_type: 'SUBSTITUTE', team_id: 'T1', is_new: false },
    { id: 10, name: '최신규(청주)', employee_type: 'SUBSTITUTE', team_id: 'T1', is_new: true }, 

    // 🍇 대전팀 (T2) - 전원 주 5일 테스트
    { id: 11, name: '이대전1', employee_type: 'BASE', team_id: 'T2', work_pattern: 5 },
    { id: 12, name: '이대전2', employee_type: 'BASE', team_id: 'T2', work_pattern: 5 },
    { id: 13, name: '이대전3', employee_type: 'BASE', team_id: 'T2', work_pattern: 5 },
    { id: 14, name: '이대전4', employee_type: 'BASE', team_id: 'T2', work_pattern: 5 },
    { id: 15, name: '이대전5', employee_type: 'BASE', team_id: 'T2', work_pattern: 5 },
    { id: 16, name: '이대전6', employee_type: 'BASE', team_id: 'T2', work_pattern: 5 },
    { id: 17, name: '이대전7', employee_type: 'BASE', team_id: 'T2', work_pattern: 5 },
    { id: 18, name: '정대체(대전)', employee_type: 'SUBSTITUTE', team_id: 'T2', is_new: false },
    { id: 19, name: '강대체(대전)', employee_type: 'SUBSTITUTE', team_id: 'T2', is_new: false },
    { id: 20, name: '조대체(대전)', employee_type: 'SUBSTITUTE', team_id: 'T2', is_new: false },

    // 🍊 세종팀 (T3) - 전원 주 6일 테스트
    { id: 21, name: '박세종1', employee_type: 'BASE', team_id: 'T3', work_pattern: 6 },
    { id: 22, name: '박세종2', employee_type: 'BASE', team_id: 'T3', work_pattern: 6 },
    { id: 23, name: '박세종3', employee_type: 'BASE', team_id: 'T3', work_pattern: 6 },
    { id: 24, name: '박세종4', employee_type: 'BASE', team_id: 'T3', work_pattern: 6 },
    { id: 25, name: '박세종5', employee_type: 'BASE', team_id: 'T3', work_pattern: 6 },
    { id: 26, name: '박세종6', employee_type: 'BASE', team_id: 'T3', work_pattern: 6 },
    { id: 27, name: '박세종7', employee_type: 'BASE', team_id: 'T3', work_pattern: 6 },
    { id: 28, name: '윤대체(세종)', employee_type: 'SUBSTITUTE', team_id: 'T3', is_new: false },
    { id: 29, name: '장대체(세종)', employee_type: 'SUBSTITUTE', team_id: 'T3', is_new: false },
    { id: 30, name: '임대체(세종)', employee_type: 'SUBSTITUTE', team_id: 'T3', is_new: false },
];

export const dummyPermissions = [];
dummyEmployees.filter(e => e.employee_type === 'SUBSTITUTE').forEach(sub => {
    dummyEmployees.filter(e => e.employee_type === 'BASE' && e.team_id === sub.team_id).forEach(base => {
        dummyPermissions.push({ substitute_employee_id: sub.id, base_employee_id: base.id });
    });
});

export const dummyFixedOffs = [
    { employee_id: 1, date: '2026-10-05' }, { employee_id: 2, date: '2026-10-05' }, { employee_id: 3, date: '2026-10-05' }, 
    { employee_id: 4, date: '2026-10-12' }, { employee_id: 5, date: '2026-10-12' }, 
    { employee_id: 11, date: '2026-10-07' }, { employee_id: 12, date: '2026-10-07' }, 
    { employee_id: 21, date: '2026-10-20' }, { employee_id: 22, date: '2026-10-20' }, { employee_id: 23, date: '2026-10-20' }, { employee_id: 24, date: '2026-10-20' } 
];

export const dummyHistory = [
    { substitute_employee_id: 8, base_employee_id: 1 }, { substitute_employee_id: 8, base_employee_id: 2 },
    { substitute_employee_id: 8, base_employee_id: 3 }, { substitute_employee_id: 8, base_employee_id: 4 },
    { substitute_employee_id: 9, base_employee_id: 5 },
];