import React from 'react';
import { 
    Users, AlertTriangle, FileSignature, CheckCircle2, 
    ArrowRight, Clock, Truck, ShieldAlert 
} from 'lucide-react';
// import { useAdminData } from '../contexts/DataContext'; // 추후 실제 데이터 연동 시 사용

export default function Dashboard({ onNavigate }) {
    // 💡 기계(기기) 설정에 따른 오늘 날짜 출력
    const today = new Date();
    const formattedDate = today.toLocaleDateString(undefined, { 
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
    });

    // 💡 테스트용 가상 데이터 (추후 useAdminData를 통해 DB 데이터로 교체)
    const dashboardStats = {
        working: 24,
        off: 4,
        unassignedRoutes: 1, // 미배정(펑크) 경고
        pendingApprovals: 3   // 결재 대기
    };

    const todaySubstitutes = [
        { id: 1, subName: '김병인', targetName: '박선배', route: '청주 A구역' },
        { id: 2, subName: '서준혁', targetName: '이팀장', route: '청주 B구역' }
    ];

    const pendingRequests = [
        { id: 1, name: '김지은', type: '휴무 신청', date: '10/25(금)', reason: '개인 사정' },
        { id: 2, name: '최신입', type: '스케줄 교환', date: '10/26(토)', reason: '병원 진료' }
    ];

    return (
        <div className="w-full h-full min-h-screen bg-[#F2F2F7] dark:bg-gray-950 flex flex-col font-sans overflow-y-auto">
            
            {/* 1. 상단 헤더 & 날짜 */}
            <div className="bg-white dark:bg-gray-900 px-6 py-8 border-b border-gray-100 shrink-0">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
                    안녕하세요, 관리자님! 👋
                </h1>
                <p className="text-gray-500 font-medium flex items-center gap-2">
                    오늘은 <span className="text-indigo-600 font-bold">{formattedDate}</span> 입니다.
                </p>
            </div>

            <div className="p-6 space-y-6 max-w-5xl mx-auto w-full pb-24">
                
                {/* 2. 핵심 지표 요약 카드 (4칸) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* 출근 현황 */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500 text-sm font-bold">오늘 출근자</span>
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Users size={16} />
                            </div>
                        </div>
                        <div className="flex items-end gap-1">
                            <span className="text-3xl font-black text-gray-800">{dashboardStats.working}</span>
                            <span className="text-sm font-medium text-gray-400 mb-1">명</span>
                        </div>
                    </div>

                    {/* 휴무 현황 */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500 text-sm font-bold">오늘 휴무자</span>
                            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <CheckCircle2 size={16} />
                            </div>
                        </div>
                        <div className="flex items-end gap-1">
                            <span className="text-3xl font-black text-gray-800">{dashboardStats.off}</span>
                            <span className="text-sm font-medium text-gray-400 mb-1">명</span>
                        </div>
                    </div>

                    {/* 미배정 노선 (펑크 경고) - 누르면 노선관리나 근무표로 이동 */}
                    <div 
                        onClick={() => onNavigate && onNavigate('calendar')}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-red-100 flex flex-col gap-3 cursor-pointer hover:border-red-300 hover:shadow-md transition-all group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-red-500 text-sm font-bold flex items-center gap-1.5">
                                <ShieldAlert size={14} /> 미배정 노선
                            </span>
                            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                                <AlertTriangle size={16} />
                            </div>
                        </div>
                        <div className="flex items-end gap-1">
                            <span className="text-3xl font-black text-red-600">{dashboardStats.unassignedRoutes}</span>
                            <span className="text-sm font-medium text-red-400 mb-1">건 발생!</span>
                        </div>
                    </div>

                    {/* 결재 대기 - 누르면 결재관리함으로 이동 */}
                    <div 
                        onClick={() => onNavigate && onNavigate('approval')}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100 flex flex-col gap-3 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-amber-600 text-sm font-bold flex items-center gap-1.5">
                                <Clock size={14} /> 결재 대기
                            </span>
                            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                                <FileSignature size={16} />
                            </div>
                        </div>
                        <div className="flex items-end gap-1">
                            <span className="text-3xl font-black text-amber-600">{dashboardStats.pendingApprovals}</span>
                            <span className="text-sm font-medium text-amber-400 mb-1">건</span>
                        </div>
                    </div>
                </div>

                {/* 3. 중간 영역: 오늘 대체 투입 현황 & 최근 요청 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    
                    {/* 오늘 대체 투입 현황 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-black text-gray-800 flex items-center gap-2">
                                <Truck size={18} className="text-blue-500" /> 오늘 대체 투입 인원
                            </h3>
                        </div>
                        <div className="p-2 flex-1">
                            {todaySubstitutes.length > 0 ? (
                                <ul className="space-y-1">
                                    {todaySubstitutes.map((sub) => (
                                        <li key={sub.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-sm">
                                                    {sub.subName.substring(0, 1)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800 text-sm">{sub.subName}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{sub.targetName}님 대체</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-bold rounded-lg">
                                                    {sub.route}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center py-8 text-gray-400">
                                    <CheckCircle2 size={32} className="mb-2 opacity-20" />
                                    <p className="text-sm font-bold">오늘은 대체 투입 인원이 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 최근 결재 대기건 미리보기 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-black text-gray-800 flex items-center gap-2">
                                <FileSignature size={18} className="text-amber-500" /> 처리 대기 중인 요청
                            </h3>
                            <button 
                                onClick={() => onNavigate && onNavigate('approval')}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                                전체보기 <ArrowRight size={14} />
                            </button>
                        </div>
                        <div className="p-2 flex-1">
                            {pendingRequests.length > 0 ? (
                                <ul className="space-y-1">
                                    {pendingRequests.map((req) => (
                                        <li key={req.id} className="flex items-center justify-between p-3 border border-transparent hover:border-gray-100 hover:bg-gray-50 rounded-xl transition-all">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                                        req.type === '휴무 신청' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
                                                    }`}>
                                                        {req.type}
                                                    </span>
                                                    <span className="font-bold text-gray-800 text-sm">{req.name}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 font-medium">희망일: {req.date} · {req.reason}</p>
                                            </div>
                                            <button 
                                                onClick={() => onNavigate && onNavigate('approval')}
                                                className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-lg transition-colors"
                                            >
                                                검토
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center py-8 text-gray-400">
                                    <CheckCircle2 size={32} className="mb-2 opacity-20" />
                                    <p className="text-sm font-bold">대기 중인 결재가 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}