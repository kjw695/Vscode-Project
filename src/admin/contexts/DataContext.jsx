// src/admin/contexts/DataContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import useTempInitData from '../utils/tempInitData';

const DataContext = createContext();

export function DataProvider({ children }) {
    const [teams, setTeams] = useState(() => JSON.parse(localStorage.getItem('my_teams')) || []);
    const [employees, setEmployees] = useState(() => JSON.parse(localStorage.getItem('my_employees')) || []);
    const [routes, setRoutes] = useState(() => JSON.parse(localStorage.getItem('my_routes')) || []);

    // 임시 초기 데이터 주입기 (추후 실제 DB 연동 시 이 줄만 삭제)
    useTempInitData(teams, setTeams, employees, setEmployees, routes, setRoutes);

    // 로컬 스토리지 동기화 (Single Source of Truth 영구 금고)
    useEffect(() => { localStorage.setItem('my_teams', JSON.stringify(teams)); }, [teams]);
    useEffect(() => { localStorage.setItem('my_employees', JSON.stringify(employees)); }, [employees]);
    useEffect(() => { localStorage.setItem('my_routes', JSON.stringify(routes)); }, [routes]);

    // ✨ [규칙 4] 직원 정보 수정 (소속 변경 또는 대체직 전환 시 기존 고정 노선 강제 회수)
    const updateEmployee = (updatedEmp) => {
        const oldEmp = employees.find(e => String(e.id) === String(updatedEmp.id));
        
        setEmployees(prev => prev.map(e => String(e.id) === String(updatedEmp.id) ? updatedEmp : e));

        if ((oldEmp && oldEmp.team_id !== updatedEmp.team_id) || updatedEmp.type === 'sub') {
            setRoutes(prev => prev.map(route => 
                String(route.assigned_emp_id) === String(updatedEmp.id) 
                    ? { ...route, assigned_emp_id: null } 
                    : route
            ));
        }
    };

    // ✨ [규칙 1, 3] 노선 배정 (문자/숫자 ID 무결성 및 다중 배차 대응)
    const assignRoute = (routeId, empId) => {
        const finalEmpId = empId === "" ? null : (isNaN(Number(empId)) ? empId : Number(empId));
        setRoutes(prev => prev.map(route => 
            route.id === routeId ? { ...route, assigned_emp_id: finalEmpId } : route
        ));
    };

    // ✨ [규칙 2] SSOT 기반: 노선 테이블을 훑어서 해당 기사님의 모든 노선 이름을 쉼표로 조립
    const getEmployeeRouteNames = (empId) => {
        const myRoutes = routes.filter(r => String(r.assigned_emp_id) === String(empId));
        return myRoutes.length > 0 ? myRoutes.map(r => r.name).join(', ') : '미지정';
    };

    return (
        <DataContext.Provider value={{
            teams, setTeams,
            employees, setEmployees, updateEmployee,
            routes, setRoutes, assignRoute, getEmployeeRouteNames
        }}>
            {children}
        </DataContext.Provider>
    );
}

export const useData = () => useContext(DataContext);
// 🛡️ 혹시 모를 다른 파일과의 충돌을 막기 위해 두 이름 모두 동일하게 지원합니다.
export const useAdminData = useData;