/**
 * 관리자 휴무관리 / 대체근무 자동배치 테스트용 초기 데이터
 *
 * 목적
 * - Main.jsx가 초기 상태로 사용할 수 있는 목업 데이터
 * - 실제 DB 연결 전 화면/스케줄링 엔진 테스트
 * - 직원 / 팀 / 고정업무(노선) / 근무규칙 / 대체업무 이력을 분리
 *
 * 핵심 원칙
 * 1. base 직원은 고정 업무를 유지한다.
 * 2. sub 직원도 정상 근무자이며 자신의 휴무가 있다.
 * 3. 대체기사는 실제 근무일에만 대체업무에 투입된다.
 * 4. 대체기사의 휴무를 깨서 투입하지 않는다.
 * 5. 대체업무 이력에는 어떤 고정업무를 대체했는지 기록한다.
 * 6. 노선 순번/로테이션은 사용하지 않는다.
 */

export const teams = [
  {
    id: 'team-1',
    name: '1조',
    description: '청주 서부권',
    active: true,
  },
  {
    id: 'team-2',
    name: '2조',
    description: '청주 동부권',
    active: true,
  },
  {
    id: 'team-3',
    name: '대체조',
    description: '대체업무 전담',
    active: true,
  },
];

export const employees = [
  // -------------------------
  // 고정기사
  // -------------------------
  {
    id: 'emp-1',
    name: '기사1',
    role: 'base',
    teamId: 'team-1',
    active: true,
    joinedAt: '2026-01-01',
    target: 'A노선',
  },
  {
    id: 'emp-2',
    name: '기사2',
    role: 'base',
    teamId: 'team-1',
    active: true,
    joinedAt: '2026-01-01',
    target: 'B노선',
  },
  {
    id: 'emp-3',
    name: '기사3',
    role: 'base',
    teamId: 'team-2',
    active: true,
    joinedAt: '2026-01-01',
    target: 'C노선',
  },
  {
    id: 'emp-4',
    name: '기사4',
    role: 'base',
    teamId: 'team-2',
    active: true,
    joinedAt: '2026-01-01',
    target: 'D노선',
  },
  {
    id: 'emp-5',
    name: '기사5',
    role: 'base',
    teamId: 'team-2',
    active: true,
    joinedAt: '2026-01-01',
    target: 'E노선',
  },

  // -------------------------
  // 대체기사
  // -------------------------
  {
    id: 'emp-6',
    name: '대체기사6',
    role: 'sub',
    teamId: 'team-3',
    active: true,
    joinedAt: '2026-01-01',
    target: 'A노선,B노선',
  },
  {
    id: 'emp-7',
    name: '대체기사7',
    role: 'sub',
    teamId: 'team-3',
    active: true,
    joinedAt: '2026-01-01',
    target: 'C노선,D노선,E노선',
  },
];

export const routes = [
  {
    id: 'route-a',
    name: 'A노선',
    teamId: 'team-1',
    assignedEmpId: 'emp-1',
    active: true,

    // 테스트용 객관적 업무 특성
    // 실제 DB에서는 실적 데이터로 대체 가능
    averageEarnings: 180000,
    averageDeliveries: 145,
    difficulty: 3,
  },
  {
    id: 'route-b',
    name: 'B노선',
    teamId: 'team-1',
    assignedEmpId: 'emp-2',
    active: true,
    averageEarnings: 150000,
    averageDeliveries: 125,
    difficulty: 2,
  },
  {
    id: 'route-c',
    name: 'C노선',
    teamId: 'team-2',
    assignedEmpId: 'emp-3',
    active: true,
    averageEarnings: 210000,
    averageDeliveries: 160,
    difficulty: 4,
  },
  {
    id: 'route-d',
    name: 'D노선',
    teamId: 'team-2',
    assignedEmpId: 'emp-4',
    active: true,
    averageEarnings: 130000,
    averageDeliveries: 110,
    difficulty: 2,
  },
  {
    id: 'route-e',
    name: 'E노선',
    teamId: 'team-2',
    assignedEmpId: 'emp-5',
    active: true,
    averageEarnings: 170000,
    averageDeliveries: 135,
    difficulty: 3,
  },
];

/**
 * 근무 규칙
 *
 * pattern
 * - weekly-5 : 주5일
 * - weekly-6 : 주6일
 * - biweekly : 격주
 *
 * biweekly의 경우 cycle을 명시한다.
 * weekIndex 0 / 1이 각각 다른 근무일 수를 갖도록 구성한다.
 *
 * preferredRestDays
 * - 관리자가 선호 휴무 요일을 설정할 수 있도록 미리 분리
 * - 현재 자동배치 알고리즘에서는 참고 데이터이며,
 *   휴무일을 강제로 결정하는 로직은 아직 포함하지 않는다.
 */
export const workRules = [
  {
    employeeId: 'emp-1',
    pattern: 'biweekly',
    weeklyWorkDays: [6, 5],
    cycle: {
      type: 'week',
      length: 2,
      weekIndex: 0,
      workDays: 6,
    },
    preferredRestDays: ['SUN'],
    restPriority: {
      SAT: 1,
      SUN: 3,
    },
  },
  {
    employeeId: 'emp-2',
    pattern: 'weekly-5',
    weeklyWorkDays: [5],
    preferredRestDays: ['SAT'],
    restPriority: {
      SAT: 3,
      SUN: 1,
    },
  },
  {
    employeeId: 'emp-3',
    pattern: 'weekly-6',
    weeklyWorkDays: [6],
    preferredRestDays: ['SUN'],
    restPriority: {
      SAT: 1,
      SUN: 3,
    },
  },
  {
    employeeId: 'emp-4',
    pattern: 'biweekly',
    weeklyWorkDays: [5, 6],
    cycle: {
      type: 'week',
      length: 2,
      weekIndex: 0,
      workDays: 5,
    },
    preferredRestDays: ['SAT'],
    restPriority: {
      SAT: 3,
      SUN: 1,
    },
  },
  {
    employeeId: 'emp-5',
    pattern: 'weekly-5',
    weeklyWorkDays: [5],
    preferredRestDays: ['SUN'],
    restPriority: {
      SAT: 1,
      SUN: 3,
    },
  },
  {
    employeeId: 'emp-6',
    pattern: 'weekly-5',
    weeklyWorkDays: [5],
    preferredRestDays: ['SAT'],
    restPriority: {
      SAT: 3,
      SUN: 1,
    },
  },
  {
    employeeId: 'emp-7',
    pattern: 'weekly-5',
    weeklyWorkDays: [5],
    preferredRestDays: ['SAT'],
    restPriority: {
      SAT: 3,
      SUN: 1,
    },
  },
];

/**
 * 특정 날짜의 실제 근무/휴무 상태를 테스트하기 위한 예외 데이터
 *
 * 상태
 * - work : 근무
 * - off  : 휴무
 *
 * 실제 서비스에서는 Calendar에서 관리자가 휴무를 변경하면
 * 이 데이터가 상태로 저장되는 형태를 목표로 한다.
 */
export const scheduleOverrides = {
  'emp-1': {
    '2026-10-04': 'off',
    '2026-10-07': 'off',
    '2026-10-11': 'off',
    '2026-10-14': 'off',
  },
  'emp-2': {
    '2026-10-03': 'off',
    '2026-10-08': 'off',
    '2026-10-10': 'off',
    '2026-10-15': 'off',
  },
  'emp-3': {
    '2026-10-05': 'off',
    '2026-10-12': 'off',
    '2026-10-19': 'off',
    '2026-10-26': 'off',
  },
  'emp-4': {
    '2026-10-06': 'off',
    '2026-10-10': 'off',
    '2026-10-13': 'off',
    '2026-10-17': 'off',
  },
  'emp-5': {
    '2026-10-02': 'off',
    '2026-10-09': 'off',
    '2026-10-16': 'off',
    '2026-10-23': 'off',
  },

  // 대체기사도 휴무가 있다.
  // 이 날짜에는 절대로 대체업무를 배정하면 안 된다.
  'emp-6': {
    '2026-10-03': 'off',
    '2026-10-07': 'off',
    '2026-10-11': 'off',
    '2026-10-15': 'off',
  },
  'emp-7': {
    '2026-10-04': 'off',
    '2026-10-08': 'off',
    '2026-10-12': 'off',
    '2026-10-16': 'off',
  },
};

/**
 * 대체 가능 업무
 *
 * 대체기사가 실제로 어떤 고정업무를 수행할 수 있는지 명시한다.
 * 이후 EmployeeManager에서 UI로 관리할 수 있도록 독립 데이터로 둔다.
 */
export const substitutePermissions = {
  'emp-6': ['route-a', 'route-b'],
  'emp-7': ['route-c', 'route-d', 'route-e'],
};

/**
 * 고정기사의 휴무를 별도로 기록해야 하는 경우 사용할 데이터.
 *
 * 현재는 scheduleOverrides와 중복되지 않도록 비워둔다.
 * 이후 휴무 교환 기능을 만들 때 실제 교환 결과를 이 영역 또는
 * 통합된 날짜별 근무상태 데이터로 관리한다.
 */
export const fixedDaysOff = {};

/**
 * 대체업무 이력
 *
 * 중요:
 * - 단순히 "대체 몇 번"만 기록하지 않는다.
 * - 어떤 고정기사/노선의 업무를 대체했는지를 기록한다.
 * - 이 데이터를 schedulingEngine이 읽어 대체업무 분포를 계산한다.
 *
 * 신규 대체기사가 입사하면 이 배열에 입사일 이전 기록을 만들지 않는다.
 * 퇴사한 대체기사의 과거 기록도 삭제/이관하지 않는다.
 */
export const substituteWorkHistory = [
  {
    id: 'hist-001',
    date: '2026-09-01',
    substituteEmployeeId: 'emp-6',
    fixedEmployeeId: 'emp-1',
    routeId: 'route-a',
  },
  {
    id: 'hist-002',
    date: '2026-09-03',
    substituteEmployeeId: 'emp-6',
    fixedEmployeeId: 'emp-2',
    routeId: 'route-b',
  },
  {
    id: 'hist-003',
    date: '2026-09-05',
    substituteEmployeeId: 'emp-7',
    fixedEmployeeId: 'emp-3',
    routeId: 'route-c',
  },
  {
    id: 'hist-004',
    date: '2026-09-07',
    substituteEmployeeId: 'emp-7',
    fixedEmployeeId: 'emp-4',
    routeId: 'route-d',
  },
  {
    id: 'hist-005',
    date: '2026-09-10',
    substituteEmployeeId: 'emp-6',
    fixedEmployeeId: 'emp-1',
    routeId: 'route-a',
  },
  {
    id: 'hist-006',
    date: '2026-09-12',
    substituteEmployeeId: 'emp-7',
    fixedEmployeeId: 'emp-5',
    routeId: 'route-e',
  },
];

/**
 * Main.jsx에서 초기 상태로 한 번에 가져갈 수 있는 형태
 */
export const tempInitData = {
  teams,
  employees,
  routes,
  workRules,
  scheduleOverrides,
  substitutePermissions,
  fixedDaysOff,
  substituteWorkHistory,
};

export default tempInitData;
