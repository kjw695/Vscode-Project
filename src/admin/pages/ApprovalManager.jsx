import React, { useState } from 'react';
import { Check, X, Clock, ArrowRight, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ApprovalManager({ onBack }) {
    const [activeTab, setActiveTab] = useState('pending'); // 'pending'(대기중) | 'history'(처리내역)

   // ✨ 1. 임시 가상 데이터 (교환은 관리자 승인 없이 당사자 간 완료되므로 내역으로 바로 표시)
    const [requests, setRequests] = useState([
        { 
            id: 'req_1', type: '추가휴무', requester: '이팀장', 
            date: '10/28 (수)', 
            status: 'pending', requestTime: '10.13 09:00' // 관리자 승인이 필요한 추가휴무만 대기 중
        },
        { 
            id: 'req_2', type: '교환완료', requester: '김동료', receiver: '박선배', 
            sourceDate: '10/24 (토)', targetDate: '10/25 (일)', 
            status: 'completed', requestTime: '10.13 14:30', processTime: '10.13 14:35 (당사자 합의완료)' 
        },
        { 
            id: 'req_3', type: '교환완료', requester: '최신입', receiver: '김동료', 
            sourceDate: '10/15 (목)', targetDate: '10/16 (금)', 
            status: 'completed', requestTime: '10.11 11:20', processTime: '10.11 11:25 (당사자 합의완료)' 
        },
        { 
            id: 'req_4', type: '추가휴무', requester: '정사원', 
            date: '10/20 (화)', 
            status: 'timeout', requestTime: '10.10 08:00' // 48시간 초과 건
        }
    ]);

    // 필터링 로직
    const pendingRequests = requests.filter(req => req.status === 'pending');
    const historyRequests = requests.filter(req => req.status !== 'pending');

    // ✨ 2. 관리자 승인/반려 처리 함수
    const handleAction = (id, action) => {
        // TODO: 추후 Supabase DB 업데이트 로직 (update status) 및 알림 전송 로직 추가
        const confirmMessage = action === 'approved' ? '승인' : '반려';
        if (window.confirm(`해당 요청을 ${confirmMessage} 하시겠습니까?`)) {
            setRequests(prev => prev.map(req => 
                req.id === id ? { ...req, status: action, processTime: '방금 전' } : req
            ));
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F2F2F7] dark:bg-gray-950 p-4 md:p-6 lg:p-8 overflow-y-auto">
            
            {/* ✨ 상단 뒤로 가기 버튼 및 타이틀 영역 (mt-4 추가로 숨통 트기, 버튼 정렬 items-start로 변경) */}
            <div className="flex items-start gap-3 mb-6 mt-4">
                {onBack && (
                    <button onClick={onBack} className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0 mt-0.5">
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div className="flex flex-col w-full overflow-hidden">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">요청 결재 대시보드</h1>
                    
                    {/* ✨ 설명을 반응형 박스로 묶고, 작아지면 자동으로 말줄임표(truncate) 되도록 설정 */}
                    <div className="mt-2 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 rounded-lg px-3 py-1.5 inline-flex max-w-full w-fit items-center">
                        <p className="text-[11.5px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate">
                            팀원들의 휴무 교환 및 추가 휴무 신청을 관리합니다.
                        </p>
                    </div>
                </div>
            </div>

            {/* 탭 메뉴 */}
            <div className="flex space-x-1 bg-gray-200/50 dark:bg-gray-800/50 p-1 rounded-xl mb-6 max-w-sm">
                <button 
                    onClick={() => setActiveTab('pending')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2
                        ${activeTab === 'pending' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    휴무 승인 대기 <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all
                        ${activeTab === 'history' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    변동 내역 (교환/기타)
                </button>
            </div>

            {/* 리스트 영역 */}
            <div className="space-y-4 max-w-4xl">
                
                {activeTab === 'pending' && (
                    pendingRequests.length === 0 ? (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 text-center shadow-sm border border-gray-100 dark:border-gray-800">
                            <CheckCircle size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 font-medium">대기 중인 결재 요청이 없습니다.</p>
                        </div>
                    ) : (
                        pendingRequests.map(req => (
                            <div key={req.id} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:shadow-md">
                                {/* 왼쪽: 요청 정보 */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${req.type === '추가휴무' ? 'text-teal-700 bg-teal-50 dark:bg-teal-900/40 dark:text-teal-300' : 'text-indigo-700 bg-indigo-50 dark:bg-indigo-900/40 dark:text-indigo-300'}`}>
                                            {req.type}
                                        </span>
                                        <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={12}/> 신청: {req.requestTime}</span>
                                    </div>
                                    
                                    <div className="text-gray-800 dark:text-white">
                                        <span className="font-black text-lg">{req.requester}</span> 님의 
                                        <span className="font-bold ml-1">{req.type}</span> 요청
                                    </div>

                                    {/* 교환일 경우 화살표 UI, 추가휴무일 경우 단일 날짜 UI */}
                                    <div className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center bg-gray-50 dark:bg-gray-800 inline-flex px-3 py-1.5 rounded-lg border dark:border-gray-700">
                                        {req.type === '교환' ? (
                                            <>
                                                <span>{req.sourceDate}</span>
                                                <ArrowRight size={14} className="mx-2 text-gray-400" />
                                                <span className="text-indigo-600 dark:text-indigo-400">{req.targetDate}</span>
                                                <span className="ml-2 text-[11px] text-gray-500">(대상: {req.receiver})</span>
                                            </>
                                        ) : (
                                            <span className="text-teal-600 dark:text-teal-400">{req.date} 휴무 지정</span>
                                        )}
                                    </div>
                                </div>

                                {/* 오른쪽: 승인/반려 버튼 */}
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button 
                                        onClick={() => handleAction(req.id, 'rejected')}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 dark:bg-gray-800 dark:hover:bg-red-900/30 dark:text-gray-300 rounded-xl font-bold transition-colors"
                                    >
                                        <X size={18}/> 반려
                                    </button>
                                    <button 
                                        onClick={() => handleAction(req.id, 'approved')}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#1E56D0] hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-colors"
                                    >
                                        <Check size={18}/> 승인
                                    </button>
                                </div>
                            </div>
                        ))
                    )
                )}

                {activeTab === 'history' && (
                    historyRequests.map(req => (
                        <div key={req.id} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
                            {/* 시간초과 시 흐리게 처리 */}
                            {req.status === 'timeout' && <div className="absolute inset-0 bg-white/50 dark:bg-black/40 pointer-events-none z-10"></div>}

                            <div className="z-20">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${req.type.includes('교환') ? 'text-blue-700 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-300' : 'text-teal-700 bg-teal-50'}`}>
                                        {req.type}
                                    </span>
                                </div>
                                <div className={`font-bold text-[15px] flex flex-col gap-0.5 ${req.status === 'timeout' ? 'text-gray-400' : 'text-gray-800 dark:text-white'}`}>
                                    {req.type.includes('교환') ? (
                                        <>
                                            <span>{req.requester}님 ⇄ {req.receiver}님</span>
                                            <span className={`text-[13px] font-medium ${req.status === 'timeout' ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {req.sourceDate} ⇄ {req.targetDate}
                                            </span>
                                        </>
                                    ) : (
                                        <span>{req.requester}님의 {req.date} 휴무 신청</span>
                                    )}
                                </div>
                                <div className="text-[11px] text-gray-400 mt-1">
                                    요청일시: {req.requestTime} {req.processTime && `| ${req.processTime}`}
                                </div>
                            </div>

                            <div className="z-20">
                                {req.status === 'completed' && <span className="flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg"><CheckCircle size={16}/> 교환완료</span>}
                                {req.status === 'approved' && <span className="flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"><CheckCircle size={16}/> 승인됨</span>}
                                {req.status === 'rejected' && <span className="flex items-center gap-1 text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg"><XCircle size={16}/> 반려됨</span>}
                                {req.status === 'timeout' && <span className="flex items-center gap-1 text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg"><AlertCircle size={16}/> 시간초과(자동취소)</span>}
                            </div>
                        </div>
                    ))
                )}

            </div>
        </div>
    );
}