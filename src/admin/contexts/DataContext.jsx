// src/admin/contexts/DataContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import useTempInitData from '../utils/tempInitData';

const DataContext = createContext();

const readInitialRegions = () => {
    try {
        const storedRegions = localStorage.getItem('my_regions');
        if (storedRegions !== null) {
            const parsedRegions = JSON.parse(storedRegions);
            if (Array.isArray(parsedRegions)) {
                return [...new Set(parsedRegions.filter((region) => typeof region === 'string' && region.trim()))];
            }
        }

        // 기존 버전에서 지역 목록을 별도로 저장하지 않았던 경우,
        // 저장된 팀의 지역 정보를 이용해 목록을 복구합니다.
        const storedTeams = JSON.parse(localStorage.getItem('my_teams') || '[]');
        if (Array.isArray(storedTeams)) {
            return [...new Set(storedTeams.map((team) => team?.region || '기본 지역').filter(Boolean))];
        }
    } catch (error) {
        console.warn('지역 설정을 불러오지 못했습니다.', error);
    }
    return [];
};

export function DataProvider({ children }) {
    const [teams, setTeams] = useState(() => JSON.parse(localStorage.getItem('my_teams')) || []);
    const [regions, setRegions] = useState(readInitialRegions);
    const [employees, setEmployees] = useState(() => JSON.parse(localStorage.getItem('my_employees')) || []);
    const [routes, setRoutes] = useState(() => JSON.parse(localStorage.getItem('my_routes')) || []);

    // 임시 초기 데이터 주입기 (추후 실제 DB 연동 시 이 줄만 삭제)
    useTempInitData(teams, setTeams, employees, setEmployees, routes, setRoutes);

    // 기존 팀에 등록된 지역이 지역 목록에서도 누락되지 않도록 동기화합니다.
    useEffect(() => {
        const teamRegions = teams.map((team) => team?.region || '기본 지역').filter(Boolean);
        setRegions((currentRegions) => {
            const current = Array.isArray(currentRegions) ? currentRegions : [];
            const next = [...new Set([...current, ...teamRegions])];
            const unchanged = next.length === current.length && next.every((region, index) => region === current[index]);
            return unchanged ? currentRegions : next;
        });
    }, [teams]);

    // 로컬 스토리지 동기화 (현재 기기의 브라우저 저장소)
    useEffect(() => { localStorage.setItem('my_teams', JSON.stringify(teams)); }, [teams]);
    useEffect(() => { localStorage.setItem('my_regions', JSON.stringify(regions)); }, [regions]);
    useEffect(() => { localStorage.setItem('my_employees', JSON.stringify(employees)); }, [employees]);
    useEffect(() => { localStorage.setItem('my_routes', JSON.stringify(routes)); }, [routes]);

    // 직원 소속 변경 또는 대체직 전환 시 기존 고정 노선 배정을 회수합니다.
    const updateEmployee = (updatedEmp) => {
        const oldEmp = employees.find((employee) => String(employee.id) === String(updatedEmp.id));

        setEmployees((previous) => previous.map((employee) =>
            String(employee.id) === String(updatedEmp.id) ? updatedEmp : employee
        ));

        if ((oldEmp && String(oldEmp.team_id) !== String(updatedEmp.team_id)) || updatedEmp.type === 'sub') {
            setRoutes((previous) => previous.map((route) =>
                String(route.assigned_emp_id) === String(updatedEmp.id)
                    ? { ...route, assigned_emp_id: null }
                    : route
            ));
        }
    };

    // 노선 배정 (문자/숫자 ID를 통일해 비교합니다.)
    const assignRoute = (routeId, empId) => {
        const finalEmpId = empId === '' ? null : (isNaN(Number(empId)) ? empId : Number(empId));
        setRoutes((previous) => previous.map((route) =>
            String(route.id) === String(routeId) ? { ...route, assigned_emp_id: finalEmpId } : route
        ));
    };

    const getEmployeeRouteNames = (empId) => {
        const myRoutes = routes.filter((route) => String(route.assigned_emp_id) === String(empId));
        return myRoutes.length > 0 ? myRoutes.map((route) => route.name).join(', ') : '미지정';
    };

    return (
        <DataContext.Provider value={{
            teams, setTeams,
            regions, setRegions,
            employees, setEmployees, updateEmployee,
            routes, setRoutes, assignRoute, getEmployeeRouteNames
        }}>
            {children}
        </DataContext.Provider>
    );
}

export const useData = () => useContext(DataContext);
// 두 이름을 모두 지원해 기존 컴포넌트와의 호환성을 유지합니다.
export const useAdminData = useData;
