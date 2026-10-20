// src/admin/pages/NoticeManager.jsx
import React, { useState } from 'react';
import { ArrowLeft, Bell, Send, Megaphone, Clock } from 'lucide-react';

export default function NoticeManager({ onBack }) {
    const [notices, setNotices] = useState([
        { id: 1, type: '긴급', content: '내일 비가 오니 안전 운전하세요!', date: '2026-10-19 14:30', target: '전체 직원' },
        { id: 2, type: '일반', content: '이번 달 스케줄이 확정되었습니다. 근무표를 확인해주세요.', date: '2026-10-18 09:00', target: '전체 직원' }
    ]);

    const handleSendNotice = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        if (window.confirm(`'${formData.get('target')}'에게 알림을 전송하시겠습니까? (직원들 앱으로 푸시 알림이 발송됩니다)`)) {
            const newNotice = {
                id: Date.now(),
                type: formData.get('type'),
                content: formData.get('content'),
                target: formData.get('target'),
                date: new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' })
            };
            setNotices([newNotice, ...notices]);
            e.target.reset(); // 폼 초기화
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#F2F2F7] font-sans pb-24 overflow-y-auto">
            <header className="bg-white px-5 py-4 flex items-center shadow-sm border-b shrink-0 sticky top-0 z-10">
                <button onClick={onBack} className="p-1.5 -ml-1 mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={22} />
                </button>
                <h1 className="text-lg font-black text-gray-800 flex items-center gap-2">
                    <Bell size={20} className="text-amber-500"/> 공지사항 및 알림
                </h1>
            </header>
            
            <div className="p-5 max-w-2xl mx-auto w-full space-y-6">
                {/* 알림 발송 폼 */}
                <form onSubmit={handleSendNotice} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Megaphone size={18} className="text-amber-500"/>
                        <h2 className="font-bold text-gray-800 text-sm">새 알림 발송하기</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <select name="type" className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-amber-500">
                            <option value="일반">일반 공지</option>
                            <option value="긴급">🚨 긴급 알림</option>
                        </select>
                        <select name="target" className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-amber-500">
                            <option value="전체 직원">전체 직원 (앱 푸시)</option>
                            <option value="고정 배송팀">고정 배송팀만</option>
                            <option value="대체 투입팀">대체 투입(백업)팀만</option>
                        </select>
                    </div>

                    <textarea 
                        name="content" 
                        required 
                        rows="3" 
                        placeholder="예: 내일 비가 오니 안전 운전하세요!" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 resize-none"
                    ></textarea>

                    <button type="submit" className="w-full py-3.5 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-md">
                        <Send size={16}/> 알림 전송 및 공지 등록
                    </button>
                </form>

                {/* 발송 내역 리스트 */}
                <div>
                    <h3 className="font-bold text-gray-500 text-xs mb-3 flex items-center gap-1.5 px-1">
                        <Clock size={14}/> 최근 알림 발송 내역
                    </h3>
                    <div className="space-y-3">
                        {notices.map(notice => (
                            <div key={notice.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-3">
                                <div className="shrink-0 mt-0.5">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${notice.type === '긴급' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                                        <Bell size={14}/>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${notice.type === '긴급' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                            {notice.type}
                                        </span>
                                        <span className="text-[11px] font-bold text-gray-400">{notice.target} 수신</span>
                                    </div>
                                    <p className="text-sm font-bold text-gray-800 leading-snug">{notice.content}</p>
                                    <p className="text-[10px] text-gray-400 mt-2">{notice.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}