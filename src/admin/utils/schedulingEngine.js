// src/admin/utils/schedulingEngine.js

const WEIGHTS = {
    RECENT_FATIGUE: -50,
    SPECIFIC_TARGET: -20,
    TOTAL_COUNT: -10,
    PREFERENCE_DAY: 30
};

export function generateMonthlySchedule({ year, month, employees, substitutePermissions, fixedDaysOff, substituteWorkHistory }) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const scheduleResult = {}; 
    const lackOfStaffWarnings = [];

    const activeSubs = [...new Set(substituteWorkHistory.map(h => h.substitute_employee_id))];
    const teamAverageHistory = activeSubs.length > 0 
        ? Math.floor(substituteWorkHistory.length / activeSubs.length) 
        : 0;

    // ✨ [1] 팀별 최대 대체 기사 수(Capacity) 파악
    const teamSubCapacity = {};
   employees.filter(e => e.type === 'substitute' || e.type === 'SUBSTITUTE').forEach(sub => {
        teamSubCapacity[sub.team_id] = (teamSubCapacity[sub.team_id] || 0) + 1;
    });

    // ✨ [2] 달력의 모든 휴무일을 담을 그릇 (확정 휴무 세팅)
    const allOffs = {};
    fixedDaysOff.forEach(off => {
        if (!allOffs[off.date]) allOffs[off.date] = [];
        allOffs[off.date].push(off.employee_id);
    });

   // ✨ [3] 주간 단위(월~일) 자동 휴무 흩뿌리기
    const weeks = getWeeksInMonth(year, month);
    employees.filter(e => e.employee_type === 'BASE').forEach(emp => {
        weeks.forEach((weekDates, weekIndex) => {
            // 💡 주1일~주6일, 격주 등 다양한 패턴 동적 처리
            let currentPattern = emp.work_pattern || 6;
            
            // 격주5일 처리 (첫째 주는 6일 근무, 둘째 주는 5일 근무 교차)
            if (currentPattern === '격주5일') {
                currentPattern = (weekIndex % 2 === 0) ? 6 : 5;
            }
            
            // 일주일(7일)에서 근무일수를 빼서 목표 휴무일 산출 (주1일이면 6일 휴무)
            const targetOffsPerWeek = 7 - Number(currentPattern); 

            let currentOffsThisWeek = weekDates.filter(d => allOffs[d] && allOffs[d].includes(emp.id)).length;

            for (const dateStr of weekDates) {
                if (currentOffsThisWeek >= targetOffsPerWeek) break; // 목표 휴무일 달성 시 종료

                if (!allOffs[dateStr]) allOffs[dateStr] = [];
                if (allOffs[dateStr].includes(emp.id)) continue; // 이미 쉬는 날 패스

                // ⚠️ 해당 날짜에 같은 팀의 휴무자가 대체 기사 수(Capacity)를 초과하지 않는 날만 골라서 배정
                const teamOffCount = allOffs[dateStr].filter(id => {
                    const offEmp = employees.find(e => e.id === id);
                    return offEmp && offEmp.team_id === emp.team_id;
                }).length;

               const maxOffAllowed = Math.max(1, teamSubCapacity[emp.team_id] || 0); 
if (teamOffCount < maxOffAllowed) {
    allOffs[dateStr].push(emp.id);
    currentOffsThisWeek++;
}
            }
        });
    });

    // [4] 결정된 휴무일(allOffs)을 바탕으로 대체 근무자 공평 배정 시작
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        scheduleResult[day] = {
            date: currentDateStr,
            offs: [],       
            subs: [],       
            status: 'ok'    
        };

        const todayOffBaseEmployees = getEmployeesOffToday(currentDateStr, employees, allOffs); // 확정휴무(fixedDaysOff) 대신 통합 휴무(allOffs) 사용
        if (todayOffBaseEmployees.length === 0) continue;

        for (const baseEmp of todayOffBaseEmployees) {
            scheduleResult[day].offs.push(baseEmp.name);

            let validSubCandidates = getValidSubstitutes(
                baseEmp, currentDateStr, employees, substitutePermissions, allOffs, scheduleResult[day].subs
            );

            if (validSubCandidates.length === 0) {
                scheduleResult[day].status = 'error';
                lackOfStaffWarnings.push(`[인력부족] ${currentDateStr} : ${baseEmp.name}의 업무를 대체할 수 있는 가능한 인력이 없습니다.`);
                continue; 
            }

            let bestSub = null;
            let highestScore = -99999;

            for (const sub of validSubCandidates) {
                const score = calculateSubstituteScore(sub, baseEmp, currentDateStr, substituteWorkHistory, teamAverageHistory);
                
                if (score > highestScore) {
                    highestScore = score;
                    bestSub = sub;
                }
            }

            if (bestSub) {
                scheduleResult[day].subs.push({
                    subId: bestSub.id,
                    subName: bestSub.name,
                    targetBaseId: baseEmp.id,
                    targetBaseName: baseEmp.name,
                    score: highestScore
                });
            }
        }
    }

    return { schedule: scheduleResult, warnings: lackOfStaffWarnings };
}

// ==========================================
// 🛠 [엔진 내부 헬퍼 로직]
// ==========================================

// ✨ 월을 주(월~일) 단위로 쪼개는 함수
function getWeeksInMonth(year, month) {
    const weeks = [];
    let currentWeek = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        currentWeek.push(dateStr);

        // 0: 일요일 (한 주의 끝) 또는 말일이면 주차 묶음 완성
        if (date.getDay() === 0 || day === daysInMonth) { 
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }
    return weeks;
}

function getValidSubstitutes(baseEmp, dateStr, allEmployees, permissions, allOffs, alreadyAssignedSubs) {
    return allEmployees.filter(emp => {
        if (emp.type !== 'substitute' && emp.type !== 'SUBSTITUTE') return false;
        
        // 대체 기사 본인의 휴무일인지 검사 (통합 휴무 데이터 사용)
        const isOff = allOffs[dateStr] && allOffs[dateStr].includes(emp.id);
        if (isOff) return false;

        const isAlreadyWorking = alreadyAssignedSubs.some(sub => sub.subId === emp.id);
        if (isAlreadyWorking) return false;

        const hasPermission = permissions.some(p => p.substitute_employee_id === emp.id && p.base_employee_id === baseEmp.id);
        if (!hasPermission) return false;

        return true; 
    });
}

function calculateSubstituteScore(subEmp, baseEmp, dateStr, history, teamAverageHistory) {
    let score = 0;
    let totalSubCount = history.filter(h => h.substitute_employee_id === subEmp.id).length;

    if (subEmp.is_new) {
        totalSubCount = teamAverageHistory + totalSubCount;
    }

    score += (totalSubCount * WEIGHTS.TOTAL_COUNT);

    const specificTargetCount = history.filter(h => 
        h.substitute_employee_id === subEmp.id && 
        h.base_employee_id === baseEmp.id
    ).length;
    score += (specificTargetCount * WEIGHTS.SPECIFIC_TARGET);
    
    return score;
}

function getEmployeesOffToday(dateStr, employees, allOffs) {
    const offIds = allOffs[dateStr] || [];
    return employees.filter(emp => (emp.type === 'base' || emp.type === 'BASE') && offIds.includes(emp.id));
}