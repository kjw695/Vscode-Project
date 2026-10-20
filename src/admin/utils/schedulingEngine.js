// 요일 매핑용 객체
const DAY_MAP = {
    '일요일': 0, '월요일': 1, '화요일': 2, 
    '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6
};

export const generateMonthlySchedule = (visualWeeks, employees, targetWeekIndices, existingSchedules = []) => {
    const generatedSchedule = [];

    // ✨ 핵심: 휴직 중인('leave') 직원은 배치 대상에서 완전 제외합니다.
    const activeEmployees = employees.filter(e => e.status !== 'leave');

    // 1. 팀별 대체 기사 수(Capacity) 파악 (활성 대체 인원 기준)
    const teamSubCapacity = {};
    activeEmployees.filter(e => e.dutyType === '백업' || e.type === 'sub' || e.type === 'SUBSTITUTE').forEach(sub => {
        const tId = sub.team_id || 'default_team';
        teamSubCapacity[tId] = (teamSubCapacity[tId] || 0) + 1;
    });

    // 2. 기존 확정 휴무 매핑
    const allOffs = {};
    existingSchedules.forEach(s => {
        if (!allOffs[s.date]) allOffs[s.date] = [];
        if (!allOffs[s.date].includes(s.employeeId)) {
            allOffs[s.date].push(s.employeeId);
        }
    });

    // 3. 고정 배송 직원 대상 주간 단위 분산 배치 (활성 직원만 대상)
    const baseEmployees = activeEmployees.filter(e => e.dutyType === '고정' || e.type === 'base' || e.type === 'BASE' || !e.dutyType);

    baseEmployees.forEach(emp => {
        targetWeekIndices.forEach((weekIdx, index) => {
            const weekDays = visualWeeks[weekIdx];
            if (!weekDays) return;

            const patternStr = emp.pattern || '주 5일 근무';
            let workDaysNum = 5;
            const match = patternStr.match(/\d/);
            if (match) workDaysNum = parseInt(match[0], 10);

            if (patternStr.includes('격주')) {
                workDaysNum = (index % 2 === 0) ? Math.min(6, workDaysNum + 1) : workDaysNum;
            }

            const targetOffsPerWeek = Math.max(1, 7 - workDaysNum);
            const preferredDayNum = DAY_MAP[emp.preferredDay];

            let currentOffsThisWeek = weekDays.filter(d => allOffs[d.dateStr] && allOffs[d.dateStr].includes(emp.id)).length;

            // A. 선호 요일 휴무 반영
            weekDays.forEach(dayObj => {
                if (currentOffsThisWeek >= targetOffsPerWeek) return;
                const currentDate = new Date(dayObj.year, dayObj.month - 1, dayObj.day);

                if (currentDate.getDay() === preferredDayNum) {
                    if (!allOffs[dayObj.dateStr]) allOffs[dayObj.dateStr] = [];
                    if (!allOffs[dayObj.dateStr].includes(emp.id)) {
                        const tId = emp.team_id || 'default_team';
                        const teamOffCount = allOffs[dayObj.dateStr].filter(id => {
                            const offEmp = activeEmployees.find(e => e.id === id);
                            return offEmp && (offEmp.team_id || 'default_team') === tId;
                        }).length;

                        const maxOffAllowed = Math.max(1, teamSubCapacity[tId] || 1);

                        if (teamOffCount < maxOffAllowed) {
                            allOffs[dayObj.dateStr].push(emp.id);
                            currentOffsThisWeek++;
                            generatedSchedule.push({
                                employeeId: emp.id,
                                employeeName: emp.name,
                                roleType: emp.dutyType || '고정', // 👈 역할 정보 추가 (대체 인원 구분을 위함)
                                date: dayObj.dateStr,
                                type: '고정휴무',
                                isAuto: true
                            });
                        }
                    }
                }
            });

            // B. 랜덤 휴무 분산 배치
            const availableDays = weekDays.filter(dayObj => {
                const isAlreadyOff = allOffs[dayObj.dateStr] && allOffs[dayObj.dateStr].includes(emp.id);
                return !isAlreadyOff;
            });

            for (let i = availableDays.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableDays[i], availableDays[j]] = [availableDays[j], availableDays[i]];
            }

            for (const dayObj of availableDays) {
                if (currentOffsThisWeek >= targetOffsPerWeek) break;

                if (!allOffs[dayObj.dateStr]) allOffs[dayObj.dateStr] = [];
                const tId = emp.team_id || 'default_team';
                
                const teamOffCount = allOffs[dayObj.dateStr].filter(id => {
                    const offEmp = activeEmployees.find(e => e.id === id);
                    return offEmp && (offEmp.team_id || 'default_team') === tId;
                }).length;

                const maxOffAllowed = Math.max(1, teamSubCapacity[tId] || 1);

                if (teamOffCount < maxOffAllowed) {
                    allOffs[dayObj.dateStr].push(emp.id);
                    currentOffsThisWeek++;
                    generatedSchedule.push({
                        employeeId: emp.id,
                        employeeName: emp.name,
                        roleType: emp.dutyType || '고정', // 👈 역할 정보 추가
                        date: dayObj.dateStr,
                        type: '랜덤휴무',
                        isAuto: true
                    });
                }
            }
        });
    });

    return generatedSchedule;
};