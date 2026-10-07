// src/admin/utils/tempInitData.js
import { useEffect } from 'react';

// 💡 함수 이름을 'use'로 시작하게 변경하여 React 규칙을 준수합니다.
export default function useTempInitData(teams, setTeams, employees, setEmployees, routes, setRoutes) {
    useEffect(() => {
        if (teams.length === 0 && employees.length === 0 && routes.length === 0) {
            
            setTeams([
                { id: 'T1', name: '청주팀' },
                { id: 'T2', name: '대전팀' },
                { id: 'T3', name: '세종팀' }
            ]);
            
            setEmployees([
                { id: 101, name: '김지은', type: 'base', team_id: 'T1', pattern: '주 5일', route: '206a' },
                { id: 102, name: '서준혁', type: 'base', team_id: 'T1', pattern: '주 6일', route: '206b01' },
                { id: 103, name: '김병인', type: 'sub', team_id: 'T1', pattern: '주 5일', target: '' },
                { id: 104, name: '대체', type: 'base', team_id: 'T3', pattern: '격주 5일', route: '206b02' },
                { id: 105, name: '임시', type: 'base', team_id: 'T3', pattern: '격주 5일', route: '세종 A노선' }
            ]);

            setRoutes([
                { id: 'R1', name: '206a', description: '상당구 아파트 단지 위주', team_id: 'T1', assigned_emp_id: 101 },
                { id: 'R2', name: '206b01', description: '서원구 상가 및 주택가', team_id: 'T1', assigned_emp_id: 102 },
                { id: 'R3', name: '206b02', description: '정부청사 인근', team_id: 'T3', assigned_emp_id: 104 },
                { id: 'R4', name: '206b03', description: '신규 오픈 지역', team_id: 'T1', assigned_emp_id: null },
                { id: 'R5', name: '206c', description: '신규 오픈 지역', team_id: 'T1', assigned_emp_id: null },
                { id: 'R6', name: '210a', description: '신규 오픈 지역', team_id: 'T1', assigned_emp_id: null },
                { id: 'R7', name: '210b', description: '신규 오픈 지역', team_id: 'T1', assigned_emp_id: null },
                { id: 'R8', name: '205a', description: '신규 오픈 지역', team_id: 'T1', assigned_emp_id: null },
                { id: 'R9', name: '205b', description: '신규 오픈 지역', team_id: 'T1', assigned_emp_id: null },
            ]);
        }
    }, [teams, employees, routes, setTeams, setEmployees, setRoutes]);
}