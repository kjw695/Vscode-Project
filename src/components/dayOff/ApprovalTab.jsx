import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function ApprovalTab({ onBack, isDarkMode, showMessage }) {
    const [activeTab, setActiveTab] = useState('pending');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 가상 데이터 (미결요청)
    const mockPending = [
        { id: 1, requester: '김동료', sourceDate: '10/22 (목)', targetDate: '10/23 (금)', requestTime: '10.13 14:30', timeAgo: '2시간 전' },
    ];

    // ✨ 가상 데이터 (요청이력 - 신청시간 및 시간초과 상태 추가)
    const mockHistory = [
        { id: 2, type: '추가휴무', date: '10/18 (일)', status: '승인됨', requestTime: '10.12 09:15' },
        { id: 3, type: '교환', requester: '박선배', sourceDate: '10/24 (토)', targetDate: '10/25 (일)', status: '대기중', requestTime: '10.13 08:30' },
        { id: 4, type: '교환', requester: '이팀장', sourceDate: '10/28 (수)', targetDate: '10/29 (목)', status: '시간초과', requestTime: '10.10 10:00' } // ✨ 48시간이 지나 자동 취소된 케이스
    ];

    const handleRefresh = () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        setTimeout(() => {
            setIsRefreshing(false);
            if (showMessage) showMessage("최신 내역을 불러왔습니다.");
        }, 1000);
    };

    return (
        <div className={`absolute inset-0 z-50 flex flex-col w-full h-full ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
            <div className={`shrink-0 flex items-center justify-between px-4 pt-7 pb-3 z-10 ${isDarkMode ? 'bg-blue-800 text-white' : 'bg-[#1E56D0] text-white'}`}>
                <div className="flex items-center">
                    <button onClick={onBack} className="mr-3 opacity-90 hover:opacity-100 transition-opacity active:scale-95">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-[19px] font-bold tracking-tight">요청 결재</h2>
                </div>
                <button onClick={handleRefresh} className="opacity-90 hover:opacity-100 transition-opacity active:scale-95">
                    <RefreshCw size={22} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className={`shrink-0 flex text-[14px] font-bold z-10 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-sm`}>
                <button onClick={() => setActiveTab('pending')} className={`flex-1 py-3.5 text-center transition-all ${activeTab === 'pending' ? 'border-b-[2px] border-[#1E56D0] text-[#1E56D0]' : 'text-gray-500'}`}>
                    미결요청 <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{mockPending.length}</span>
                </button>
                <button onClick={() => setActiveTab('history')} className={`flex-1 py-3.5 text-center transition-all ${activeTab === 'history' ? 'border-b-[2px] border-[#1E56D0] text-[#1E56D0]' : 'text-gray-500'}`}>
                    요청이력
                </button>
            </div>

            <div className="flex-1 w-full bg-[#F2F2F7] dark:bg-gray-950 overflow-y-auto p-4 pb-20">
                {activeTab === 'pending' && (
                    <>
                        <div className="mb-4 text-[12px] font-bold text-gray-500 px-1">나에게 들어온 휴무 교환 요청입니다.</div>
                        {mockPending.map(req => (
                            <div key={req.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-3 shadow-sm border border-gray-200 dark:border-gray-800">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-1 rounded-md">휴무 교환</span>
                                        <p className="font-bold text-[15px] mt-2 text-gray-800 dark:text-white">{req.requester}님의 교환 요청</p>
                                    </div>
                                    <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={12} /> {req.timeAgo}</span>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-3 border dark:border-gray-700 flex justify-between items-center">
                                    <span className="text-[12px] text-gray-500">내 휴무 <strong className="text-black dark:text-gray-200">{req.targetDate}</strong></span>
                                    <ArrowLeft size={14} className="text-gray-400 mx-2" />
                                    <span className="text-[12px] text-gray-500">{req.requester} <strong className="text-black dark:text-gray-200">{req.sourceDate}</strong></span>
                                </div>
                                {/* ✨ 신청 시간 표시 */}
                                <div className="text-[10px] text-gray-400 mb-3 text-right">신청일시: {req.requestTime}</div>
                                
                                <div className="flex gap-2">
                                    <button onClick={() => showMessage(`${req.requester}님의 요청을 거절했습니다.`)} className="flex-1 py-2.5 rounded-lg text-[13px] font-bold bg-[#F2F2F7] text-gray-600 hover:bg-gray-200 dark:bg-gray-800 transition-colors">거절</button>
                                    <button onClick={() => showMessage(`${req.requester}님의 요청을 수락했습니다.`)} className="flex-1 py-2.5 rounded-lg text-[13px] font-bold bg-[#1E56D0] text-white hover:bg-blue-700 transition-colors">수락</button>
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {activeTab === 'history' && (
                    <>
                        <div className="mb-4 text-[12px] font-bold text-gray-500 px-1">내가 신청한 추가 휴무 및 교환 내역입니다.</div>
                        {mockHistory.map(req => (
                            <div key={req.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-3 shadow-sm border border-gray-200 dark:border-gray-800 flex justify-between items-center relative overflow-hidden">
                                
                                {/* ✨ 시간초과일 경우 카드를 전체적으로 흐리게 처리 */}
                                {req.status === '시간초과' && <div className="absolute inset-0 bg-white/50 dark:bg-black/40 pointer-events-none"></div>}
                                
                                <div className="z-10">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${req.type === '추가휴무' ? 'text-teal-600 bg-teal-50 dark:bg-teal-900/30' : 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'}`}>{req.type}</span>
                                    <p className={`font-bold text-[14px] mt-2 ${req.status === '시간초과' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-white'}`}>
                                        {req.type === '추가휴무' ? `${req.date} 휴무 신청` : `${req.requester}님과 교환 신청`}
                                    </p>
                                    {req.type === '교환' && <p className="text-[12px] text-gray-400 mt-0.5">{req.sourceDate} ➔ {req.targetDate}</p>}
                                    {/* ✨ 신청 시간 표시 */}
                                    <p className="text-[10px] text-gray-400 mt-2">신청일시: {req.requestTime}</p>
                                </div>
                                <div className="flex flex-col items-end z-10">
                                    {req.status === '승인됨' && <span className="text-[12px] font-bold text-blue-500 flex items-center gap-1"><CheckCircle size={14}/>승인됨</span>}
                                    {req.status === '거절됨' && <span className="text-[12px] font-bold text-red-500 flex items-center gap-1"><XCircle size={14}/>거절됨</span>}
                                    {req.status === '대기중' && <span className="text-[12px] font-bold text-gray-500 flex items-center gap-1"><Clock size={14}/>대기중</span>}
                                    
                                    {/* ✨ 시간초과 (48시간 경과) 뱃지 */}
                                    {req.status === '시간초과' && <span className="text-[12px] font-bold text-gray-400 flex items-center gap-1"><AlertCircle size={14}/>시간초과</span>}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}