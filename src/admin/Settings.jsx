// src/admin/Settings.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Settings as SettingsIcon,
    RefreshCw,
    Plus,
    Trash2,
    MapPin,
    Users,
    ChevronDown,
    ChevronUp,
    Pencil,
    Check,
    X,
    Search
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAdminData } from './contexts/DataContext';

const DEFAULT_REGION = '기본 지역';
const getTeamRegion = (team) => team?.region || DEFAULT_REGION;
const normalizeName = (value) => String(value || '').trim().toLocaleLowerCase();

export default function Settings({ onBack }) {
    const { profile } = useAuth();
    const {
        teams = [],
        setTeams,
        regions = [],
        setRegions,
        employees = [],
        routes = []
    } = useAdminData();

    const [newRegionName, setNewRegionName] = useState('');
    const [newTeamName, setNewTeamName] = useState('');
    const [addingTeamRegion, setAddingTeamRegion] = useState('');
    const [search, setSearch] = useState('');
    const [expandedRegions, setExpandedRegions] = useState(() => {
        try {
            const saved = window.localStorage.getItem('admin_settings_expanded_regions');
            return saved === null ? null : JSON.parse(saved);
        } catch (error) {
            return {};
        }
    });
    const [editing, setEditing] = useState(null);
    const [notice, setNotice] = useState('');
    const [addedTeamId, setAddedTeamId] = useState(null);

    const regionCardRefs = useRef({});
    const teamFormRefs = useRef({});
    const teamInputRefs = useRef({});
    const teamRowRefs = useRef({});
    const editDialogRef = useRef(null);
    const editNameInputRef = useRef(null);
    const editingRef = useRef(editing);
    const addingTeamRegionRef = useRef(addingTeamRegion);
    editingRef.current = editing;
    addingTeamRegionRef.current = addingTeamRegion;

    const regionList = useMemo(() => [...new Set([
        ...regions,
        ...teams.map((team) => getTeamRegion(team))
    ])], [regions, teams]);
    const keyword = search.trim().toLocaleLowerCase();

    // 첫 실행 때만 첫 지역을 펼칩니다. 이후 접기/펼치기 상태는 기기에 저장됩니다.
    useEffect(() => {
        if (expandedRegions === null) {
            if (regionList.length === 0) return;
            const initial = { [regionList[0]]: true };
            setExpandedRegions(initial);
            try {
                window.localStorage.setItem('admin_settings_expanded_regions', JSON.stringify(initial));
            } catch (error) {
                // 저장이 제한된 환경에서도 화면 조작은 계속 가능하게 합니다.
            }
            return;
        }
        try {
            window.localStorage.setItem('admin_settings_expanded_regions', JSON.stringify(expandedRegions));
        } catch (error) {
            // 저장이 제한된 환경에서도 화면 조작은 계속 가능하게 합니다.
        }
    }, [expandedRegions, regionList]);

    // 편집창 또는 팀 추가 입력 중 Android 뒤로가기는 현재 팝업/입력만 닫습니다.
    useEffect(() => {
        const closeOverlay = () => {
            if (editingRef.current) {
                setEditing(null);
                return;
            }
            if (addingTeamRegionRef.current) {
                setAddingTeamRegion('');
                setNewTeamName('');
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && window.__adminSettingsHasOverlay) {
                event.preventDefault();
                closeOverlay();
            }
        };
        window.addEventListener('admin-settings-back', closeOverlay);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('admin-settings-back', closeOverlay);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        window.__adminSettingsHasOverlay = Boolean(editing || addingTeamRegion);
    }, [editing, addingTeamRegion]);

    useEffect(() => () => {
        window.__adminSettingsHasOverlay = false;
    }, []);

    // 편집창은 모바일에서 위쪽에 고정하고, 입력창 포커스가 페이지를 임의로 움직이지 않게 합니다.
    const editingKey = editing
        ? editing.type + ':' + (editing.type === 'team' ? editing.id : editing.originalName)
        : '';
    useEffect(() => {
        if (!editingKey) return undefined;
        const frame = window.requestAnimationFrame(() => {
            const dialog = editDialogRef.current;
            if (dialog) {
                const bounds = dialog.getBoundingClientRect();
                const top = window.scrollY + bounds.top - 15;
                if (Math.abs(bounds.top - 15) > 8) {
                    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                }
            }
            if (editNameInputRef.current) {
                editNameInputRef.current.focus({ preventScroll: true });
            }
        });
        return () => window.cancelAnimationFrame(frame);
    }, [editingKey]);

    // 팀 추가 입력란이 열리면 먼저 상단 15px 지점으로 부드럽게 이동한 후 키보드를 엽니다.
    useEffect(() => {
        if (!addingTeamRegion) return undefined;
        let focusTimer;
        const frame = window.requestAnimationFrame(() => {
            const form = teamFormRefs.current[addingTeamRegion];
            if (!form) return;
            const top = window.scrollY + form.getBoundingClientRect().top - 15;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            focusTimer = window.setTimeout(() => {
                teamInputRefs.current[addingTeamRegion]?.focus({ preventScroll: true });
            }, 320);
        });
        return () => {
            window.cancelAnimationFrame(frame);
            if (focusTimer) window.clearTimeout(focusTimer);
        };
    }, [addingTeamRegion]);

    // 팀 저장 후 키보드가 닫히고 화면 크기 변경이 끝난 뒤, 방금 추가한 팀을 상단 15px에 표시합니다.
    useEffect(() => {
        if (!addedTeamId) return undefined;
        let settleTimer;
        let fallbackTimer;
        const scrollToAddedTeam = () => {
            if (settleTimer) window.clearTimeout(settleTimer);
            settleTimer = window.setTimeout(() => {
                const row = teamRowRefs.current[addedTeamId];
                if (row) {
                    const top = window.scrollY + row.getBoundingClientRect().top - 15;
                    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                }
                setAddedTeamId(null);
            }, 120);
        };
        const viewport = window.visualViewport;
        viewport?.addEventListener('resize', scrollToAddedTeam);
        fallbackTimer = window.setTimeout(scrollToAddedTeam, 280);
        return () => {
            viewport?.removeEventListener('resize', scrollToAddedTeam);
            if (settleTimer) window.clearTimeout(settleTimer);
            if (fallbackTimer) window.clearTimeout(fallbackTimer);
        };
    }, [addedTeamId, teams]);

    const visibleRegions = regionList.filter((region) => {
        if (!keyword || region.toLocaleLowerCase().includes(keyword)) return true;
        return teams.some((team) =>
            getTeamRegion(team) === region &&
            String(team.name || '').toLocaleLowerCase().includes(keyword)
        );
    });

    const handleAddRegion = (event) => {
        event.preventDefault();
        const region = newRegionName.trim();
        if (!region) {
            window.alert('지역 이름을 입력해주세요.');
            return;
        }
        if (regionList.some((item) => normalizeName(item) === normalizeName(region))) {
            window.alert('같은 이름의 지역이 이미 있습니다.');
            return;
        }

        setRegions((previous) => [...(Array.isArray(previous) ? previous : []), region]);
        setNewRegionName('');
        setExpandedRegions((previous) => ({ ...(previous || {}), [region]: true }));
        setNotice(region + ' 지역을 추가했습니다.');
    };

    const handleAddTeam = (event, region) => {
        event.preventDefault();
        const name = newTeamName.trim();
        if (!name) {
            window.alert('팀 이름을 입력해주세요.');
            return;
        }
        const duplicate = teams.some((team) =>
            getTeamRegion(team) === region &&
            normalizeName(team.name) === normalizeName(name)
        );
        if (duplicate) {
            window.alert('해당 지역에 같은 이름의 팀이 이미 있습니다.');
            return;
        }

        const newTeam = {
            id: 'T' + Date.now(),
            name,
            region
        };
        teamInputRefs.current[region]?.blur();
        window.__adminSettingsHasOverlay = false;
        setTeams((previous) => [...(Array.isArray(previous) ? previous : []), newTeam]);
        setNewTeamName('');
        setAddingTeamRegion('');
        setExpandedRegions((previous) => ({ ...(previous || {}), [region]: true }));
        setAddedTeamId(newTeam.id);
        setNotice(region + ' 지역에 ' + name + ' 팀을 추가했습니다.');
    };

    const handleDeleteRegion = (region) => {
        const regionTeams = teams.filter((team) => getTeamRegion(team) === region);
        if (regionTeams.length > 0) {
            window.alert('이 지역에는 팀이 ' + regionTeams.length + '개 있습니다. 팀을 다른 지역으로 옮기거나 삭제한 뒤 지역을 삭제해주세요.');
            return;
        }
        if (!window.confirm(region + ' 지역을 삭제할까요?')) return;

        setRegions((previous) => previous.filter((item) => item !== region));
        setExpandedRegions((previous) => {
            const next = { ...(previous || {}) };
            delete next[region];
            return next;
        });
        setNotice(region + ' 지역을 삭제했습니다.');
    };

    const handleDeleteTeam = (team) => {
        const employeeCount = employees.filter((employee) => String(employee.team_id) === String(team.id)).length;
        const routeCount = routes.filter((route) => String(route.team_id) === String(team.id)).length;

        if (employeeCount > 0 || routeCount > 0) {
            window.alert(
                '이 팀에는 직원 ' + employeeCount + '명, 노선 ' + routeCount + '개가 연결되어 있습니다. ' +
                '직원과 노선을 먼저 옮기거나 정리해야 삭제할 수 있습니다.'
            );
            return;
        }
        if (teams.length <= 1) {
            window.alert('최소 1개의 팀은 유지되어야 합니다.');
            return;
        }
        if (!window.confirm(team.name + ' 팀을 삭제할까요?')) return;

        setTeams((previous) => previous.filter((item) => String(item.id) !== String(team.id)));
        setNotice(team.name + ' 팀을 삭제했습니다.');
    };

    const openRegionEditor = (region) => {
        window.__adminSettingsHasOverlay = true;
        setEditing({ type: 'region', originalName: region, name: region });
    };

    const openTeamEditor = (team) => {
        window.__adminSettingsHasOverlay = true;
        setEditing({
            type: 'team',
            id: team.id,
            originalName: team.name,
            name: team.name,
            region: getTeamRegion(team)
        });
    };

    const handleSaveEdit = (event) => {
        event.preventDefault();
        if (!editing) return;

        const name = editing.name.trim();
        if (!name) {
            window.alert(editing.type === 'region' ? '지역 이름을 입력해주세요.' : '팀 이름을 입력해주세요.');
            return;
        }

        if (editing.type === 'region') {
            const originalName = editing.originalName;
            const duplicate = regionList.some((region) =>
                region !== originalName && normalizeName(region) === normalizeName(name)
            );
            if (duplicate) {
                window.alert('같은 이름의 지역이 이미 있습니다.');
                return;
            }
            if (name !== originalName) {
                setRegions((previous) => previous.map((region) => region === originalName ? name : region));
                setTeams((previous) => previous.map((team) =>
                    getTeamRegion(team) === originalName ? { ...team, region: name } : team
                ));
                setExpandedRegions((previous) => {
                    const next = { ...(previous || {}) };
                    if (Object.prototype.hasOwnProperty.call(next, originalName)) {
                        next[name] = next[originalName];
                        delete next[originalName];
                    } else {
                        next[name] = true;
                    }
                    return next;
                });
                setNotice(originalName + ' 지역명을 ' + name + '으로 변경했습니다.');
            }
        } else {
            const targetRegion = editing.region;
            const duplicate = teams.some((team) =>
                String(team.id) !== String(editing.id) &&
                getTeamRegion(team) === targetRegion &&
                normalizeName(team.name) === normalizeName(name)
            );
            if (duplicate) {
                window.alert('선택한 지역에 같은 이름의 팀이 이미 있습니다.');
                return;
            }

            setTeams((previous) => previous.map((team) =>
                String(team.id) === String(editing.id)
                    ? { ...team, name, region: targetRegion }
                    : team
            ));
            setExpandedRegions((previous) => ({ ...previous, [targetRegion]: true }));
            setNotice(editing.originalName === name
                ? name + ' 팀의 소속 지역을 변경했습니다.'
                : editing.originalName + ' 팀 정보를 수정했습니다.');
        }

        window.__adminSettingsHasOverlay = false;
        setEditing(null);
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-800">
            <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
                <button onClick={onBack} className="-ml-2 rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="관리자 화면으로 돌아가기">
                    <ArrowLeft size={23} />
                </button>
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2 text-lg font-black sm:text-xl">
                        <SettingsIcon size={21} className="text-slate-600" /> 팀 및 지역 설정
                    </h1>
                    <p className="mt-0.5 text-xs text-slate-500">지역을 펼쳐 팀을 추가하고, 이름이나 소속을 편집하세요.</p>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-3 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:p-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <h2 className="mb-1 flex items-center gap-2 font-black text-slate-800">
                        <MapPin size={18} className="text-indigo-600" /> 지역 목록
                    </h2>
                    <p className="mb-4 text-xs leading-5 text-slate-500">지역을 먼저 등록한 뒤, 각 지역 카드 안에서 팀을 추가합니다.</p>

                    <form onSubmit={handleAddRegion} className="flex gap-2">
                        <input
                            type="text"
                            value={newRegionName}
                            onChange={(event) => setNewRegionName(event.target.value)}
                            placeholder="새 지역 이름 (예: 청주)"
                            aria-label="새 지역 이름"
                            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                        <button type="submit" className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-slate-800 px-3 py-3 text-sm font-black text-white hover:bg-slate-700">
                            <Plus size={17} /> 지역 추가
                        </button>
                    </form>

                </section>

                {notice && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800" role="status">
                        <span>{notice}</span>
                        <button onClick={() => setNotice('')} className="rounded-md p-1" aria-label="알림 닫기"><X size={15} /></button>
                    </div>
                )}

                <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-sm font-black text-slate-800">지역별 팀 관리</h2>
                        <span className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600">{regionList.length}개 지역</span>
                    </div>

                    {visibleRegions.map((region) => {
                        const regionTeams = teams.filter((team) => getTeamRegion(team) === region);
                        const regionTeamIds = regionTeams.map((team) => String(team.id));
                        const employeeCount = employees.filter((employee) => regionTeamIds.includes(String(employee.team_id))).length;
                        const isExpanded = Boolean(expandedRegions?.[region]);
                        const regionMatchesSearch = Boolean(keyword && region.toLocaleLowerCase().includes(keyword));
                        const visibleTeams = regionTeams.filter((team) =>
                            !keyword || regionMatchesSearch || String(team.name || '').toLocaleLowerCase().includes(keyword)
                        );

                        return (
                            <article key={region} ref={(node) => { regionCardRefs.current[region] = node; }} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-3 sm:px-4">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedRegions((previous) => ({ ...(previous || {}), [region]: !previous?.[region] }))}
                                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                        aria-expanded={isExpanded}
                                    >
                                        <span className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><MapPin size={18} /></span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-black text-slate-800">{region}</span>
                                            <span className="mt-0.5 block text-xs text-slate-500">{regionTeams.length}개 팀 · 직원 {employeeCount}명</span>
                                        </span>
                                        {isExpanded ? <ChevronUp size={19} className="shrink-0 text-slate-400" /> : <ChevronDown size={19} className="shrink-0 text-slate-400" />}
                                    </button>
                                    <button type="button" onClick={() => openRegionEditor(region)} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" aria-label={region + ' 지역 편집'} title="지역 편집">
                                        <Pencil size={16} />
                                    </button>
                                    <button type="button" onClick={() => handleDeleteRegion(region)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={region + ' 지역 삭제'} title="지역 삭제">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="space-y-2 p-3 sm:p-4">
                                        {visibleTeams.map((team) => {
                                            const teamEmployeeCount = employees.filter((employee) => String(employee.team_id) === String(team.id)).length;
                                            const teamRouteCount = routes.filter((route) => String(route.team_id) === String(team.id)).length;
                                            return (
                                                <div key={team.id} ref={(node) => { teamRowRefs.current[team.id] = node; }} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white p-3">
                                                    <span className="rounded-lg bg-slate-100 p-2 text-slate-500"><Users size={17} /></span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-bold text-slate-800">{team.name}</p>
                                                        <p className="mt-0.5 text-xs text-slate-500">직원 {teamEmployeeCount}명 · 노선 {teamRouteCount}개</p>
                                                    </div>
                                                    <button type="button" onClick={() => openTeamEditor(team)} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" aria-label={team.name + ' 팀 편집'} title="팀 편집">
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteTeam(team)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={team.name + ' 팀 삭제'} title="팀 삭제">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {visibleTeams.length === 0 && regionTeams.length > 0 && (
                                            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">검색어와 일치하는 팀이 없습니다.</p>
                                        )}
                                        {regionTeams.length === 0 && (
                                            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">아직 등록된 팀이 없습니다. 아래 버튼으로 첫 팀을 추가하세요.</p>
                                        )}

                                        {addingTeamRegion === region ? (
                                            <form ref={(node) => { teamFormRefs.current[region] = node; }} onSubmit={(event) => handleAddTeam(event, region)} className="scroll-mt-[15px] rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                                                <label className="mb-1.5 block text-xs font-bold text-slate-600" htmlFor={'new-team-' + region}>{region}에 추가할 팀 이름</label>
                                                <input
                                                    id={'new-team-' + region}
                                                    ref={(node) => { teamInputRefs.current[region] = node; }}
                                                    value={newTeamName}
                                                    onChange={(event) => setNewTeamName(event.target.value)}
                                                    placeholder="팀 이름 입력"
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                                                />
                                                <div className="mt-2 flex gap-2">
                                                    <button type="submit" className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-black text-white hover:bg-indigo-700">
                                                        <Check size={16} /> 팀 저장
                                                    </button>
                                                    <button type="button" onClick={() => { setAddingTeamRegion(''); setNewTeamName(''); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                                                        취소
                                                    </button>
                                                </div>
                                            </form>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => { window.__adminSettingsHasOverlay = true; setAddingTeamRegion(region); setNewTeamName(''); }}
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 px-3 py-3 text-sm font-black text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50"
                                            >
                                                <Plus size={17} /> {region}에 팀 추가
                                            </button>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })}

                    {visibleRegions.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                            <MapPin size={25} className="mx-auto mb-2 text-slate-300" />
                            <p className="text-sm font-bold text-slate-700">{keyword ? '검색 결과가 없습니다.' : '등록된 지역이 없습니다.'}</p>
                            <p className="mt-1 text-xs text-slate-500">{keyword ? '검색어를 바꾸거나 지워보세요.' : '위에서 지역을 추가하면 팀을 등록할 수 있습니다.'}</p>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <h2 className="mb-4 font-black text-slate-800">관리자 정보</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-bold text-slate-500">팀 이름 (계정 정보)</label>
                            <input type="text" value={profile?.team_name || '팀 이름 없음'} disabled className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-slate-500 outline-none" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold text-slate-500">관리자</label>
                            <input type="text" value={profile?.full_name || '관리자'} disabled className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-slate-500 outline-none" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-700">팀 초대 코드</p>
                            <p className="mt-0.5 break-all text-lg font-black tracking-widest text-slate-800">{profile?.invite_code || '초대코드 없음'}</p>
                        </div>
                        <button type="button" onClick={() => window.alert('초대 코드 재발급은 서버 업데이트 로직 연결 후 사용할 수 있습니다.')} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50">
                            <RefreshCw size={14} /> 재발급
                        </button>
                    </div>
                </section>
            </main>

            <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
                <div className="mx-auto w-full max-w-3xl">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
                        <Search size={17} className="shrink-0 text-slate-400" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="지역 또는 팀 검색"
                            aria-label="지역 또는 팀 검색"
                            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                        />
                        {search && <button type="button" onClick={() => setSearch('')} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="검색어 지우기"><X size={15} /></button>}
                    </label>
                    <p className="mt-1.5 text-center text-[10px] text-slate-500">지역·팀 변경 사항은 현재 기기에 자동 저장됩니다.</p>
                </div>
            </div>

            {editing && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/50 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-3 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
                    <div ref={editDialogRef} className="my-0 w-full max-w-md max-h-[calc(100dvh-24px)] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl sm:my-auto" role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
                            <h2 id="edit-dialog-title" className="font-black text-slate-800">{editing.type === 'region' ? '지역 편집' : '팀 편집'}</h2>
                            <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="편집 창 닫기"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="space-y-4 p-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-bold text-slate-600">{editing.type === 'region' ? '지역 이름' : '팀 이름'}</label>
                                <input
                                    ref={editNameInputRef}
                                    value={editing.name}
                                    onChange={(event) => setEditing((previous) => ({ ...previous, name: event.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>
                            {editing.type === 'team' && (
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold text-slate-600">소속 지역</label>
                                    <select
                                        value={editing.region}
                                        onChange={(event) => setEditing((previous) => ({ ...previous, region: event.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium outline-none focus:border-indigo-500"
                                    >
                                        {[...new Set([...regionList, editing.region])].map((region) => <option key={region} value={region}>{region}</option>)}
                                    </select>
                                </div>
                            )}
                            {editing.type === 'region' && (
                                <p className="text-xs leading-5 text-slate-500">지역 이름을 바꾸면 해당 지역에 속한 모든 팀의 소속 지역도 함께 변경됩니다.</p>
                            )}
                            {editing.type === 'team' && (
                                <p className="text-xs leading-5 text-slate-500">팀의 이름이나 소속 지역을 바꿔도 직원·노선의 팀 연결 ID는 유지됩니다.</p>
                            )}
                            <div className="flex gap-2 pt-1">
                                <button type="submit" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white hover:bg-indigo-700">
                                    <Check size={17} /> 변경 저장
                                </button>
                                <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
                                    취소
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
