// src/admin/contexts/DataContext.jsx
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    fetchMyOrganizationAdminState,
    fetchMyOrganizationMembers,
    fetchMyVendorInfo,
    saveMyOrganizationAdminState,
    subscribeToOrganizationAdminState
} from '../../services/teamService';

const DataContext = createContext(null);
const LEGACY_KEYS = {
    regions: 'my_regions',
    teams: 'my_teams',
    employees: 'my_employees',
    routes: 'my_routes'
};

const safeReadArray = (key) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn(`[DataContext] ${key} 복원 실패:`, error);
        return [];
    }
};

const readLegacyAdminData = () => {
    const teams = safeReadArray(LEGACY_KEYS.teams);
    const storedRegions = safeReadArray(LEGACY_KEYS.regions);
    const teamRegions = teams
        .map((team) => team?.region || '기본 지역')
        .filter(Boolean);

    return {
        regions: [...new Set([...storedRegions, ...teamRegions])],
        teams,
        employees: safeReadArray(LEGACY_KEYS.employees),
        routes: safeReadArray(LEGACY_KEYS.routes)
    };
};

const normalizeRemoteState = (state) => ({
    regions: Array.isArray(state?.regions) ? state.regions : [],
    teams: Array.isArray(state?.teams) ? state.teams : [],
    employees: Array.isArray(state?.employees) ? state.employees : [],
    routes: Array.isArray(state?.routes) ? state.routes : []
});

const serializeAdminData = ({ regions, teams, employees, routes }) =>
    JSON.stringify({ regions, teams, employees, routes });

export function DataProvider({ children }) {
    const { user: currentUser, isAuthLoading } = useAuth();

    const [teams, setTeamsState] = useState([]);
    const [regions, setRegionsState] = useState([]);
    const [employees, setEmployeesState] = useState([]);
    const [routes, setRoutesState] = useState([]);

    const [scope, setScope] = useState('resolving');
    const [syncStatus, setSyncStatus] = useState('loading');
    const [memberSyncStatus, setMemberSyncStatus] = useState('idle');
    const [organizationId, setOrganizationId] = useState(null);
    const [organizationRole, setOrganizationRole] = useState(null);
    const [sharedVersion, setSharedVersion] = useState(null);

    const versionRef = useRef(null);
    const lastPersistedSignatureRef = useRef(null);
    const latestDataRef = useRef({ regions: [], teams: [], employees: [], routes: [] });
    const scopeRef = useRef('resolving');
    const statusRef = useRef('loading');
    const writeEnabledRef = useRef(false);
    const savingRef = useRef(false);
    const saveTimerRef = useRef(null);
    const subscriptionCleanupRef = useRef(null);
    const currentOrganizationRef = useRef(null);
    const currentUserRef = useRef(null);

    const setStatus = useCallback((next) => {
        statusRef.current = next;
        setSyncStatus(next);
    }, []);

    const applyData = useCallback((nextData, version, nextStatus = 'ready') => {
        const normalized = normalizeRemoteState(nextData);
        const signature = serializeAdminData(normalized);

        latestDataRef.current = normalized;
        lastPersistedSignatureRef.current = signature;
        versionRef.current = Number(version) || 1;

        setRegionsState(normalized.regions);
        setTeamsState(normalized.teams);
        setEmployeesState(normalized.employees);
        setRoutesState(normalized.routes);
        setSharedVersion(versionRef.current);

        try {
            const orgId = currentOrganizationRef.current;
            if (orgId) {
                localStorage.setItem(
                    `organization_admin_state:${orgId}`,
                    JSON.stringify({ ...normalized, version: versionRef.current })
                );
            }
        } catch (error) {
            console.warn('[DataContext] 공용 데이터 캐시 저장 실패:', error);
        }

        writeEnabledRef.current = true;
        setStatus(nextStatus);
    }, [setStatus]);

    const applyLegacyPreview = useCallback(() => {
        const legacy = readLegacyAdminData();
        latestDataRef.current = legacy;
        lastPersistedSignatureRef.current = null;
        setRegionsState(legacy.regions);
        setTeamsState(legacy.teams);
        setEmployeesState(legacy.employees);
        setRoutesState(legacy.routes);
        writeEnabledRef.current = false;
        setStatus('needs_migration');
    }, [setStatus]);

    const reloadSharedState = useCallback(async () => {
        const orgId = currentOrganizationRef.current;
        if (!orgId) throw new Error('회사 정보가 확인되지 않았습니다.');

        setStatus('loading');
        writeEnabledRef.current = false;

        const remote = await fetchMyOrganizationAdminState();
        if (!remote) {
            if (organizationRole === 'owner') {
                applyLegacyPreview();
            } else {
                setRegionsState([]);
                setTeamsState([]);
                setEmployeesState([]);
                setRoutesState([]);
                setStatus('awaiting_owner');
            }
            return null;
        }

        applyData(remote, remote.version, 'ready');
        return remote;
    }, [applyData, applyLegacyPreview, organizationRole, setStatus]);

    // Resolve the current organization before showing or persisting administrator data.
    useEffect(() => {
        if (isAuthLoading) return undefined;

        let active = true;
        const userId = currentUser?.id || null;

        scopeRef.current = 'resolving';
        writeEnabledRef.current = false;
        currentOrganizationRef.current = null;
        setScope('resolving');
        setStatus('loading');
        setOrganizationId(null);
        setOrganizationRole(null);
        setSharedVersion(null);
        setRegionsState([]);
        setTeamsState([]);
        setEmployeesState([]);
        setRoutesState([]);
        setMemberSyncStatus('idle');
        latestDataRef.current = { regions: [], teams: [], employees: [], routes: [] };
        lastPersistedSignatureRef.current = null;
        versionRef.current = null;

        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        subscriptionCleanupRef.current?.();
        subscriptionCleanupRef.current = null;

        const resolveOrganization = async () => {
            if (!userId) {
                if (!active) return;
                const legacy = readLegacyAdminData();
                latestDataRef.current = legacy;
                setRegionsState(legacy.regions);
                setTeamsState(legacy.teams);
                setEmployeesState(legacy.employees);
                setRoutesState(legacy.routes);
                scopeRef.current = 'local';
                setScope('local');
                setStatus('local');
                return;
            }

            try {
                const info = await fetchMyVendorInfo(userId);
                if (!active) return;

                if (!info?.vendor?.id) {
                    const legacy = readLegacyAdminData();
                    latestDataRef.current = legacy;
                    setRegionsState(legacy.regions);
                    setTeamsState(legacy.teams);
                    setEmployeesState(legacy.employees);
                    setRoutesState(legacy.routes);
                    scopeRef.current = 'local';
                    setScope('local');
                    setStatus('local');
                    return;
                }

                const orgId = String(info.vendor.id);
                const role = info.role || 'member';
                setOrganizationId(orgId);
                setOrganizationRole(role);
                currentOrganizationRef.current = orgId;
                currentUserRef.current = userId;
                scopeRef.current = 'shared';
                setScope('shared');

                if (role !== 'owner' && role !== 'admin') {
                    setStatus('unauthorized');
                    return;
                }

                // Subscribe before the first read so another admin's first initialization
                // cannot be missed between fetching and subscribing.
                subscriptionCleanupRef.current = subscribeToOrganizationAdminState(orgId, async () => {
                    if (!active || savingRef.current) return;
                    try {
                        const latest = await fetchMyOrganizationAdminState();
                        if (!active || !latest) return;
                        const currentSignature = serializeAdminData(latestDataRef.current);
                        const hasLocalChanges =
                            lastPersistedSignatureRef.current !== null &&
                            currentSignature !== lastPersistedSignatureRef.current;

                        if (hasLocalChanges) {
                            writeEnabledRef.current = false;
                            setStatus('conflict');
                            return;
                        }

                        if (Number(latest.version) > Number(versionRef.current || 0)) {
                            applyData(latest, latest.version, 'ready');
                        }
                    } catch (error) {
                        console.warn('[DataContext] 공용 데이터 실시간 갱신 실패:', error);
                    }
                });

                const remote = await fetchMyOrganizationAdminState();
                if (!active) return;

                if (remote) {
                    applyData(remote, remote.version, 'ready');
                } else if (role === 'owner') {
                    applyLegacyPreview();
                } else {
                    writeEnabledRef.current = false;
                    setStatus('awaiting_owner');
                }
            } catch (error) {
                if (!active) return;
                console.error('[DataContext] 회사 공용 데이터 연결 실패:', error);
                writeEnabledRef.current = false;
                setStatus('error');
            }
        };

        resolveOrganization();

        return () => {
            active = false;
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            subscriptionCleanupRef.current?.();
            subscriptionCleanupRef.current = null;
        };
    }, [applyData, applyLegacyPreview, currentUser?.id, isAuthLoading, setStatus]);

    const updateRegions = useCallback((updater) => {
        setRegionsState((previous) => {
            const next = typeof updater === 'function' ? updater(previous) : updater;
            const safe = Array.isArray(next) ? next : [];
            latestDataRef.current = { ...latestDataRef.current, regions: safe };
            return safe;
        });
    }, []);

    const updateTeams = useCallback((updater) => {
        setTeamsState((previous) => {
            const next = typeof updater === 'function' ? updater(previous) : updater;
            const safe = Array.isArray(next) ? next : [];
            latestDataRef.current = { ...latestDataRef.current, teams: safe };
            return safe;
        });
    }, []);

    const updateEmployees = useCallback((updater) => {
        setEmployeesState((previous) => {
            const next = typeof updater === 'function' ? updater(previous) : updater;
            const safe = Array.isArray(next) ? next : [];
            latestDataRef.current = { ...latestDataRef.current, employees: safe };
            return safe;
        });
    }, []);

    const updateRoutes = useCallback((updater) => {
        setRoutesState((previous) => {
            const next = typeof updater === 'function' ? updater(previous) : updater;
            const safe = Array.isArray(next) ? next : [];
            latestDataRef.current = { ...latestDataRef.current, routes: safe };
            return safe;
        });
    }, []);

    // Existing non-company / guest use keeps its local-storage behavior.
    useEffect(() => {
        if (scope !== 'local') return;
        try {
            localStorage.setItem(LEGACY_KEYS.teams, JSON.stringify(teams));
            localStorage.setItem(LEGACY_KEYS.regions, JSON.stringify(regions));
            localStorage.setItem(LEGACY_KEYS.employees, JSON.stringify(employees));
            localStorage.setItem(LEGACY_KEYS.routes, JSON.stringify(routes));
        } catch (error) {
            console.warn('[DataContext] 로컬 관리자 데이터 저장 실패:', error);
        }
    }, [employees, regions, routes, scope, teams]);

    // Persist company-wide changes with a version check. This prevents one admin's
    // delayed write from silently overwriting a newer edit made by another admin.
    useEffect(() => {
        if (scope !== 'shared' || syncStatus !== 'ready' || !writeEnabledRef.current) return undefined;

        const snapshot = { regions, teams, employees, routes };
        const signature = serializeAdminData(snapshot);
        if (signature === lastPersistedSignatureRef.current) return undefined;

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            if (!writeEnabledRef.current || !currentOrganizationRef.current) return;

            savingRef.current = true;
            setStatus('saving');
            try {
                const saved = await saveMyOrganizationAdminState({
                    ...snapshot,
                    expectedVersion: versionRef.current
                });

                versionRef.current = Number(saved.version) || (Number(versionRef.current) + 1);
                lastPersistedSignatureRef.current = signature;
                setSharedVersion(versionRef.current);
                try {
                    localStorage.setItem(
                        `organization_admin_state:${currentOrganizationRef.current}`,
                        JSON.stringify({ ...snapshot, version: versionRef.current })
                    );
                } catch (cacheError) {
                    console.warn('[DataContext] 공용 데이터 캐시 저장 실패:', cacheError);
                }
                setStatus('ready');
            } catch (error) {
                const message = String(error?.message || '');
                if (error?.code === '40001' || message.includes('다른 관리자에 의해 변경')) {
                    writeEnabledRef.current = false;
                    setStatus('conflict');
                } else {
                    writeEnabledRef.current = false;
                    setStatus('error');
                }
                console.error('[DataContext] 회사 공용 데이터 저장 실패:', error);
            } finally {
                savingRef.current = false;
            }
        }, 650);

        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        };
    }, [employees, regions, routes, scope, setStatus, syncStatus, teams]);

    // Sync employee accounts into the shared roster. Existing manual employee settings are retained.
    useEffect(() => {
        if (scope !== 'shared' || (organizationRole !== 'owner' && organizationRole !== 'admin')) {
            setMemberSyncStatus('idle');
            return undefined;
        }

        let active = true;
        let inFlight = false;
        let timerId;

        const syncOrganizationMembers = async () => {
            if (inFlight) return;
            inFlight = true;
            try {
                const members = await fetchMyOrganizationMembers();
                if (!active) return;

                const membersById = new Map(members.map((member) => [String(member.id), member]));
                updateEmployees((previous) => {
                    const seenMemberIds = new Set();
                    let changed = false;

                    const next = previous.map((employee) => {
                        const linkedUserId = employee.linkedUserId ||
                            (employee.accountMember ? employee.id : null);
                        const member = linkedUserId
                            ? membersById.get(String(linkedUserId))
                            : membersById.get(String(employee.id));

                        if (member) {
                            seenMemberIds.add(String(member.id));
                            const syncedName = employee.nameManuallyEdited ? employee.name : member.name;
                            const alreadyCurrent =
                                employee.id === String(member.id) &&
                                employee.linkedUserId === String(member.id) &&
                                employee.accountMember === true &&
                                employee.organizationMember === true &&
                                employee.accountDisplayName === member.name &&
                                employee.name === syncedName;
                            if (alreadyCurrent) return employee;
                            changed = true;
                            return {
                                ...employee,
                                id: String(member.id),
                                linkedUserId: String(member.id),
                                accountMember: true,
                                organizationMember: true,
                                accountDisplayName: member.name,
                                name: syncedName,
                                active: employee.active === undefined ? true : employee.active
                            };
                        }

                        if (employee.accountMember || employee.linkedUserId) {
                            if (employee.organizationMember === false && employee.active === false) return employee;
                            changed = true;
                            return { ...employee, accountMember: true, organizationMember: false, active: false };
                        }
                        return employee;
                    });

                    members.forEach((member) => {
                        const memberId = String(member.id);
                        if (seenMemberIds.has(memberId)) return;
                        changed = true;
                        next.push({
                            id: memberId,
                            linkedUserId: memberId,
                            accountMember: true,
                            organizationMember: true,
                            accountDisplayName: member.name,
                            name: member.name,
                            nameManuallyEdited: false,
                            type: 'base',
                            team_id: '',
                            pattern: '주 5일',
                            target: '',
                            vehicle_number: '',
                            active: true,
                            hasFixedOffDays: false,
                            fixedOffWeekdays: [],
                            fixedOffWeekdaysByWeek: null,
                            biweeklyPairId: null,
                            biweeklyWeekOffset: 0
                        });
                    });

                    return changed ? next : previous;
                });
                if (active) setMemberSyncStatus('ready');
            } catch (error) {
                console.error('[DataContext] 팀 가입 계정 동기화 실패:', error);
                if (active) setMemberSyncStatus('error');
            } finally {
                inFlight = false;
            }
        };

        setMemberSyncStatus('loading');
        syncOrganizationMembers();
        timerId = window.setInterval(syncOrganizationMembers, 60000);

        return () => {
            active = false;
            if (timerId) window.clearInterval(timerId);
        };
    }, [organizationRole, scope, updateEmployees]);

    // Existing team regions should always remain selectable in the region list.
    useEffect(() => {
        const teamRegions = teams.map((team) => team?.region || '기본 지역').filter(Boolean);
        updateRegions((current) => {
            const next = [...new Set([...current, ...teamRegions])];
            return next.length === current.length && next.every((region, index) => region === current[index])
                ? current
                : next;
        });
    }, [teams, updateRegions]);

    const initializeSharedState = useCallback(async (importLegacy) => {
        if (organizationRole !== 'owner' || scope !== 'shared') {
            throw new Error('회사 대표 관리자만 최초 공용 데이터를 연결할 수 있습니다.');
        }
        const source = importLegacy ? {
            regions,
            teams,
            employees,
            routes
        } : {
            regions: [],
            teams: [],
            employees: [],
            routes: []
        };

        setStatus('saving');
        writeEnabledRef.current = false;
        try {
            const saved = await saveMyOrganizationAdminState({
                ...source,
                expectedVersion: 0
            });
            applyData(saved, saved.version, 'ready');
            return saved;
        } catch (error) {
            const latest = await fetchMyOrganizationAdminState().catch(() => null);
            if (latest) {
                applyData(latest, latest.version, 'ready');
            } else {
                setStatus('error');
            }
            throw error;
        }
    }, [applyData, employees, organizationRole, regions, routes, scope, setStatus, teams]);

    const updateEmployee = useCallback((updatedEmployee) => {
        const oldEmployee = employees.find((employee) =>
            String(employee.id) === String(updatedEmployee.id)
        );

        updateEmployees((previous) => previous.map((employee) =>
            String(employee.id) === String(updatedEmployee.id) ? updatedEmployee : employee
        ));

        if (
            (oldEmployee && String(oldEmployee.team_id) !== String(updatedEmployee.team_id)) ||
            updatedEmployee.type === 'sub'
        ) {
            updateRoutes((previous) => previous.map((route) =>
                String(route.assigned_emp_id) === String(updatedEmployee.id)
                    ? { ...route, assigned_emp_id: null }
                    : route
            ));
        }
    }, [employees, updateEmployees, updateRoutes]);

    const assignRoute = useCallback((routeId, empId) => {
        const finalEmpId = empId === '' ? null : (isNaN(Number(empId)) ? empId : Number(empId));
        updateRoutes((previous) => previous.map((route) =>
            String(route.id) === String(routeId) ? { ...route, assigned_emp_id: finalEmpId } : route
        ));
    }, [updateRoutes]);

    const getEmployeeRouteNames = useCallback((employeeId) => {
        const assigned = routes.filter((route) =>
            String(route.assigned_emp_id) === String(employeeId)
        );
        return assigned.length > 0 ? assigned.map((route) => route.name).join(', ') : '미지정';
    }, [routes]);

    const hasLegacyLocalData = useMemo(() => {
        const legacy = readLegacyAdminData();
        return legacy.regions.length > 0 || legacy.teams.length > 0 ||
            legacy.employees.length > 0 || legacy.routes.length > 0;
    }, [syncStatus]);

    const value = {
        teams,
        setTeams: updateTeams,
        regions,
        setRegions: updateRegions,
        employees,
        setEmployees: updateEmployees,
        updateEmployee,
        memberSyncStatus,
        routes,
        setRoutes: updateRoutes,
        assignRoute,
        getEmployeeRouteNames,
        scope,
        syncStatus,
        organizationId,
        organizationRole,
        sharedVersion,
        hasLegacyLocalData,
        initializeSharedState,
        reloadSharedState,
        isCompanyAdmin: organizationRole === 'owner' || organizationRole === 'admin',
        canManageAdminSeats: organizationRole === 'owner'
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) throw new Error('useData는 DataProvider 내부에서만 사용할 수 있습니다.');
    return context;
};
export const useAdminData = useData;
