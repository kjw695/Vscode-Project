/* 관리자페이지 구조
src/
 ├── admin/                    # 관리자 전용 폴더 (모든 데이터 관리는 Main.jsx에서)
 │    ├── Main.jsx             # 👑 앱의 중심. 브라우저 저장소 및 임시 데이터를 하위로 전달
 │    ├── Calendar.jsx         # 📅 [월간 상황판] 자동 배치 엔진 가동 및 달력 UI
 │    ├── Settings.jsx         # ⚙️ [설정] 지역 추가/삭제, 팀 이름 및 초대코드 확인
 │    ├── EmployeeManager.jsx  # 👥 [직원 관리] 직원 목록, 역할(고정/대체) 지정, 근무 패턴 설정
 │    ├── RouteManager.jsx     # 🗺️ [노선 관리] 새 노선 추가/삭제 및 고정 기사 배정
 │    └── utils/
 │         ├── schedulingEngine.js # ⚙️ [배치 알고리즘 엔진] 스케줄 계산 핵심 로직
 │         └── tempInitData.js     # 🧹 [임시 초기 데이터 주입기] DB 연동 후 이 파일만 삭제하면 됨!
 */
// src/admin/Calendar.jsx
// src/admin/Calendar.jsx
import React, { useState, useMemo } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, Play, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { generateMonthlySchedule } from './utils/schedulingEngine'; 
import { useAdminData } from './contexts/DataContext';

export default function Calendar({ onBack }) {
    const { employees, teams, routes, substitutePermissions = [], fixedDaysOff = [], substituteWorkHistory = [] } = useAdminData();
    
    const [scheduleStatus, setScheduleStatus] = useState('ready'); 
    const [currentDate, setCurrentDate] = useState(new Date()); 
    const [selectedTeam, setSelectedTeam] = useState(teams && teams.length > 0 ? teams[0].id : 'T1'); 
    const [generatedSchedule, setGeneratedSchedule] = useState({});
    const [warnings, setWarnings] = useState([]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        return days;
    }, [year, month]);

    const handleMonthChange = (offset) => {
        setCurrentDate(new Date(year, currentDate.getMonth() + offset, 1));
        setScheduleStatus('ready'); 
        setGeneratedSchedule({});
        setWarnings([]);
    };

    const handleTeamChange = (teamId) => {
        setSelectedTeam(teamId);
        setScheduleStatus('ready');
        setGeneratedSchedule({});
        setWarnings([]);
    };

    // 🚀 자동 배치 엔진 가동 (실시간 최신 노선 데이터 자동 덧씌우기 포함)
   const handleStartAutoSchedule = () => {
    setScheduleStatus('processing');
    
    const targetTeamEmployees = employees
        .filter(e => e.team_id === selectedTeam)
        .map(emp => {
            if (emp.employee_type === 'BASE') { // 오타 수정 (type -> employee_type)
                const currentRoutes = routes.filter(r => String(r.assigned_emp_id) === String(emp.id)).map(r => r.name).join(', ');
                return { ...emp, route: currentRoutes || '미지정' };
            }
            return emp;
        });

    setTimeout(() => {
        const result = generateMonthlySchedule({
            year,
            month,
            employees: targetTeamEmployees, 
            substitutePermissions,       // 👈 빈 배열 대신 실제 데이터 연결
            fixedDaysOff,                // 👈 빈 배열 대신 실제 데이터 연결
            substituteWorkHistory        // 👈 빈 배열 대신 실제 데이터 연결
        });

        setGeneratedSchedule(result.schedule);
        setWarnings(result.warnings);
        setScheduleStatus('done');
    }, 800); 
};

    const currentTeamEmployees = employees.filter(e => e.team_id === selectedTeam);

    return (
        <div className="w-full h-full min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className="bg-white px-4 py-3 flex items-center shadow-sm relative z-10">
                <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="ml-2 text-xl font-black text-gray-800 flex items-center gap-2">
                    <CalendarIcon size={22} className="text-indigo-600" /> 스케줄 상황판
                </h1>
            </header>

            <div className="bg-white border-b z-0">
                <div className="flex px-4 pt-2 gap-2 overflow-x-auto">
                    {teams.map(team => (
                        <button key={team.id} onClick={() => handleTeamChange(team.id)} className={`px-4 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${selectedTeam === team.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'}`}>
                            {team.name}
                        </button>
                    ))}
                </div>

                <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleMonthChange(-1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft size={20}/></button>
                            <h2 className="font-black text-lg text-gray-800">{year}년 {month}월</h2>
                            <button onClick={() => handleMonthChange(1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronRight size={20}/></button>
                        </div>
                    </div>

                    <button onClick={handleStartAutoSchedule} disabled={scheduleStatus === 'processing' || currentTeamEmployees.length === 0} className={`w-full py-3.5 rounded-xl font-black flex justify-center items-center gap-2 transition-all shadow-md ${scheduleStatus === 'done' ? 'bg-green-500 text-white' : currentTeamEmployees.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        {scheduleStatus === 'ready' && <><Play size={20} /> {teams.find(t => t.id === selectedTeam)?.name} 자동 배치 시작</>}
                        {scheduleStatus === 'processing' && <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> 엔진 가동 중...</>}
                        {scheduleStatus === 'done' && <><CheckCircle2 size={20} /> 배치 완료 (다시 돌리기)</>}
                    </button>
                    
                    {currentTeamEmployees.length === 0 && (
                        <p className="text-center text-xs text-gray-500 mt-2">이 지역에는 아직 등록된 직원이 없습니다.</p>
                    )}
                </div>
            </div>

            {scheduleStatus === 'done' && warnings.length > 0 && (
                <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <h3 className="text-xs font-bold text-red-600 flex items-center gap-1 mb-1"><AlertCircle size={14}/> 인력 부족 발생!</h3>
                    <ul className="text-[10px] text-red-500 space-y-0.5 max-h-20 overflow-y-auto">
                        {warnings.map((warn, idx) => (<li key={idx}>• {warn}</li>))}
                    </ul>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 pb-10">
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                        <div key={d} className={`text-xs font-bold ${i===0 ? 'text-red-500' : i===6 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>
                    ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) => {
                        if (!day) return <div key={`empty-${index}`} className="h-[85px] rounded-lg bg-transparent"></div>;

                        const dayData = scheduleStatus === 'done' ? generatedSchedule[day] : null;
                        const teamOffs = (dayData?.offs || []).map(off => typeof off === 'object' ? off : employees.find(e => String(e.id) === String(off) || e.name === off)).filter(Boolean);
                        const teamSubs = dayData?.subs || [];
                        const hasError = dayData?.status === 'error' && teamOffs.length > teamSubs.length;

                        return (
                            <div key={day} className={`h-[85px] flex flex-col rounded-lg border p-1 transition-colors ${hasError ? 'bg-red-50 border-red-200' : teamOffs.length > 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-gray-100'}`}>
                                <span className={`text-[10px] font-bold text-left pl-1 ${teamOffs.length > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                                    {day}
                                </span>
                                
                                {teamOffs.length > 0 && (
                                    <div className="mt-auto flex flex-col gap-0.5 pb-0.5 w-full overflow-hidden">
                                        <div className="text-[9px] font-bold text-gray-600 bg-white/80 rounded px-1 truncate border border-gray-100 flex items-center gap-0.5">
                                            휴무 {teamOffs.length}
                                        </div>
                                        <div className={`text-[8px] font-bold rounded px-1 truncate border flex flex-col ${hasError ? 'bg-red-100 text-red-600 border-red-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>
                                            {teamSubs.map((s, i) => (
                                                <span key={i} className="truncate">{s.subName} ➡ {s.targetBaseName}</span>
                                            ))}
                                            {hasError && <span className="text-red-500">⚠️ 부족</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}