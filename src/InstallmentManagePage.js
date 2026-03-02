import React, { useState, useMemo } from 'react';
import { ChevronLeft, Trash2, Calendar, CreditCard, AlertCircle, CheckCircle2, ChevronRight, X } from 'lucide-react';

const InstallmentManagePage = ({ entries = [], isDarkMode, onBack, onDeleteEntries }) => {
    const [deleteModal, setDeleteModal] = useState(null); // { group: object, isOpen: boolean }

    // 오늘 날짜 구하기 (과거/미래 구분용)
    const getTodayStr = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    // entries 데이터를 groupId 기준으로 예쁘게 그룹화하기
    const groupedInstallments = useMemo(() => {
        const groups = {};
        const todayStr = getTodayStr();

        // 날짜순으로 정렬
        const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedEntries.forEach(entry => {
            if (entry.groupId) { // groupId가 있는 데이터만(할부/정기결제) 추출
                if (!groups[entry.groupId]) {
                    groups[entry.groupId] = {
                        groupId: entry.groupId,
                        title: entry.customItems?.[0]?.name || '알 수 없는 지출',
                        amount: entry.customItems?.[0]?.amount || 0,
                        entries: [],
                        totalCount: 0,
                        paidCount: 0,
                        startDate: entry.date,
                        endDate: entry.date,
                        isCompleted: false,
                    };
                }
                
                groups[entry.groupId].entries.push(entry);
                groups[entry.groupId].totalCount++;
                groups[entry.groupId].endDate = entry.date;
                
                // 오늘 날짜보다 작거나 같으면 '결제 완료(진행됨)'로 간주
                if (entry.date <= todayStr) {
                    groups[entry.groupId].paidCount++;
                }
            }
        });

        // 완료 여부 체크 및 배열로 변환
        return Object.values(groups).map(group => ({
            ...group,
            isCompleted: group.paidCount === group.totalCount
        })).sort((a, b) => new Date(b.startDate) - new Date(a.startDate)); // 최신 등록순
    }, [entries]);

    // 삭제 실행 함수
    const handleDelete = (mode) => {
        if (!deleteModal?.group) return;
        
        const todayStr = getTodayStr();
        let entriesToDelete = [];

        if (mode === 'all') {
            // 그룹 전체 내역 삭제
            entriesToDelete = deleteModal.group.entries;
        } else if (mode === 'future') {
            // 오늘 이후의 남은 일정만 삭제
            entriesToDelete = deleteModal.group.entries.filter(e => e.date > todayStr);
        }

        if (entriesToDelete.length === 0) {
            alert('삭제할 내역이 없습니다.');
            setDeleteModal(null);
            return;
        }

        // 부모 컴포넌트(DataEntryForm)로 삭제할 배열 전달
        onDeleteEntries(entriesToDelete);
        setDeleteModal(null);
    };

    return (
        <div className={`fixed inset-0 z-50 flex flex-col ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>
            
            {/* 상단 헤더 */}
            <div className={`relative flex items-end justify-between px-4 pb-3 pt-10 shadow-sm z-10 ${isDarkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-200'}`}>
                <button onClick={onBack} className="absolute left-2 bottom-1.5 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <ChevronLeft size={26} />
                </button>
                <h2 className="w-full text-[19px] sm:text-xl font-extrabold text-center mb-0.5">할부 / 정기결제 관리</h2>
            </div>

            {/* 메인 리스트 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {groupedInstallments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-3 pt-20">
                        <Calendar size={48} className={isDarkMode ? 'text-gray-600' : 'text-gray-400'} />
                        <p className="text-lg font-bold">등록된 할부/정기결제가 없습니다.</p>
                    </div>
                ) : (
                    groupedInstallments.map((group) => (
                        <div key={group.groupId} className={`p-4 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} transition-all`}>
                            
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`p-2 rounded-xl ${group.isCompleted ? (isDarkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-600') : (isDarkMode ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-600')}`}>
                                        <CreditCard size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg leading-tight">{group.title}</h3>
                                        <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                            1회 {group.amount.toLocaleString()}원
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setDeleteModal({ isOpen: true, group })}
                                    className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className={`p-3 rounded-xl mb-3 space-y-1.5 ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">진행 기간</span>
                                    <span className="font-bold">{group.startDate} ~ {group.endDate}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">진행 상황</span>
                                    <span className="font-bold">
                                        <span className="text-blue-500">{group.paidCount}회</span> / {group.totalCount}회
                                    </span>
                                </div>
                            </div>

                            {/* 프로그레스 바 (진행률) */}
                            <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${group.isCompleted ? 'bg-green-500' : 'bg-blue-500'}`} 
                                    style={{ width: `${(group.paidCount / group.totalCount) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))
                )}
                <div className="h-4"></div>
            </div>

            {/* ✨ 스마트 삭제 팝업 모달 */}
            {deleteModal?.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-5 animate-in fade-in duration-200" onClick={() => setDeleteModal(null)}>
                    <div className={`w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-1 bg-red-100 dark:bg-red-900/30 text-red-500">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-xl font-extrabold tracking-tight">일정 삭제</h3>
                            <p className={`text-[15px] leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                <span className="font-bold text-blue-500">[{deleteModal.group.title}]</span> 내역을 삭제합니다.<br/>어떤 방식으로 삭제할까요?
                            </p>
                            
                            <div className="flex flex-col gap-2 w-full mt-4">
                                <button 
                                    onClick={() => handleDelete('future')} 
                                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-left flex justify-between items-center transition-colors border-2 ${isDarkMode ? 'border-blue-900/50 hover:bg-gray-700 bg-gray-700/50' : 'border-blue-100 hover:bg-blue-50 bg-white'}`}
                                >
                                    <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>앞으로 남은 일정만 삭제</span>
                                    <ChevronRight size={18} className="opacity-50" />
                                </button>
                                <button 
                                    onClick={() => handleDelete('all')} 
                                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-left flex justify-between items-center transition-colors border-2 ${isDarkMode ? 'border-red-900/50 hover:bg-gray-700 bg-gray-700/50' : 'border-red-100 hover:bg-red-50 bg-white'}`}
                                >
                                    <span className="text-red-500">과거 내역 포함 전체 삭제</span>
                                    <ChevronRight size={18} className="opacity-50" />
                                </button>
                            </div>
                            
                            <button 
                                onClick={() => setDeleteModal(null)} 
                                className={`w-full py-3 mt-2 rounded-xl font-bold transition-colors ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstallmentManagePage;