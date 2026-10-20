import React from 'react';
import { 
    LayoutDashboard, Users, Map, CalendarDays, 
    FileSignature, Bell, Settings 
} from 'lucide-react';

export default function AdminSidebar({ activeMenu, onMenuSelect }) {
    const menuItems = [
        { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
        { id: 'employee', label: '직원 및 근무 패턴', icon: Users },
        { id: 'calendar', label: '월간 스케줄 상황판', icon: CalendarDays },
        { id: 'approval', label: '휴무 및 결재 관리함', icon: FileSignature, badge: 3 },
        { id: 'route', label: '노선 및 팀 관리', icon: Map },
        { id: 'notice', label: '공지사항 및 알림', icon: Bell },
        { id: 'settings', label: '시스템 설정', icon: Settings },
    ];

    return (
        <div className="w-64 h-full bg-gray-900 text-gray-300 flex flex-col shadow-xl flex-shrink-0">
            <div className="p-6 border-b border-gray-800">
                <h2 className="text-xl font-black text-white tracking-tight">배송 통합 관리</h2>
                <p className="text-xs text-gray-500 mt-1">Admin Workspace</p>
            </div>
            
            <nav className="flex-1 py-4 overflow-y-auto space-y-1 px-3">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeMenu === item.id;
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => onMenuSelect(item.id)}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all ${
                                isActive 
                                ? 'bg-indigo-600 text-white shadow-md font-bold' 
                                : 'hover:bg-gray-800 hover:text-white font-medium'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                                <span className="text-sm">{item.label}</span>
                            </div>
                            {item.badge && (
                                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
            
            <div className="p-4 border-t border-gray-800">
                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                        A
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-bold text-white">최고 관리자</p>
                        <p className="text-xs text-gray-500">admin@delivery.com</p>
                    </div>
                </div>
            </div>
        </div>
    );
}