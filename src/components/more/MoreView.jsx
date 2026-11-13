import React from 'react';
import {
    ChevronRight,
    User,
    Users,
    CircleDollarSign,
    CalendarDays,
    Database,
    FileText,
    Sun,
    Moon,
    BookOpen,
    MessageSquare,
    CreditCard,
    Target,
    ShieldCheck,
    BarChart3,
    Calendar
} from 'lucide-react';

const MenuItem = ({ icon, text, onClick, isDarkMode }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
    >
        <div className="flex items-center flex-shrink-0 overflow-hidden">
            {icon}
            <span className="ml-4 font-medium whitespace-nowrap">{text}</span>
        </div>
        <ChevronRight size={20} className="text-gray-400" />
    </button>
);

const MenuSection = ({ title, children }) => (
    <section className="mb-3">
        <h3 className="px-4 mb-1 text-xs font-bold text-gray-500 uppercase">{title}</h3>
        <div className="space-y-1">{children}</div>
    </section>
);

function MoreView({ onNavigate, isDarkMode, toggleDarkMode }) {
    return (
        <div className="w-full max-w-4xl mx-auto pb-4">
            <h2 className={`text-2xl font-bold mb-4 px-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>더보기</h2>

            <MenuSection title="계정 및 회사">
                <MenuItem icon={<User size={24} />} text="계정 관리" onClick={() => onNavigate('account')} isDarkMode={isDarkMode} />
                <MenuItem icon={<Calendar size={24} />} text="휴무 관리" onClick={() => onNavigate('dayOff')} isDarkMode={isDarkMode} />
                <MenuItem icon={<Users size={24} />} text="팀 관리" onClick={() => onNavigate('team')} isDarkMode={isDarkMode} />
            </MenuSection>

            <MenuSection title="배송 및 정산">
                <MenuItem icon={<CircleDollarSign size={24} />} text="단가 설정" onClick={() => onNavigate('unitPrice')} isDarkMode={isDarkMode} />
                <MenuItem icon={<CreditCard size={24} />} text="수익·지출 항목 관리" onClick={() => onNavigate('expenseSettings')} isDarkMode={isDarkMode} />
                <MenuItem icon={<CalendarDays size={24} />} text="월별 집계 기간 설정" onClick={() => onNavigate('period')} isDarkMode={isDarkMode} />
                <MenuItem icon={<Target size={24} />} text="목표 금액 설정" onClick={() => onNavigate('goal')} isDarkMode={isDarkMode} />
                <MenuItem icon={<ShieldCheck size={24} />} text="보험사 설정" onClick={() => onNavigate('insurance')} isDarkMode={isDarkMode} />
            </MenuSection>

            <MenuSection title="장부 화면 설정">
                <MenuItem icon={<BarChart3 size={24} />} text="홈 물량 설정" onClick={() => onNavigate('average_settings')} isDarkMode={isDarkMode} />
                <MenuItem icon={<CalendarDays size={24} />} text="물량 달력 표시" onClick={() => onNavigate('calendar_volume_settings')} isDarkMode={isDarkMode} />
            </MenuSection>

            <MenuSection title="데이터 관리">
                <MenuItem icon={<Database size={24} />} text="데이터 관리" onClick={() => onNavigate('data')} isDarkMode={isDarkMode} />
            </MenuSection>

            <MenuSection title="도움말 및 고객지원">
                <MenuItem icon={<BookOpen size={24} />} text="배송 가이드" onClick={() => onNavigate('userGuide')} isDarkMode={isDarkMode} />
                <MenuItem icon={<FileText size={24} />} text="이용약관 및 법적고지" onClick={() => onNavigate('legalInfo')} isDarkMode={isDarkMode} />
                <MenuItem icon={<MessageSquare size={24} />} text="의견 보내기" onClick={() => onNavigate('contact')} isDarkMode={isDarkMode} />
                <a
                    href="http://pf.kakao.com/_SnnTX"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full flex items-center justify-between p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
                >
                    <div className="flex items-center flex-shrink-0 overflow-hidden">
                        <img
                            src={require('../../assets/kakao_icon.png')}
                            alt="카카오톡 문의"
                            className="w-6 h-6 rounded-lg object-contain flex-shrink-0 shadow-sm"
                        />
                        <div className="flex flex-col text-left ml-4">
                            <span className="font-medium whitespace-nowrap">카카오톡 1:1 문의</span>
                            <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-keep">
                                배송중이라, 답변이 느릴수있습니다.
                            </span>
                        </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
                </a>
            </MenuSection>

            <div className="mt-6 p-4 flex items-center justify-between">
                <div className={`flex items-center ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                    {isDarkMode ? <Moon size={24} /> : <Sun size={24} />}
                    <span className="ml-4 font-medium">다크 모드</span>
                </div>
                <button
                    onClick={toggleDarkMode}
                    aria-label="다크 모드 전환"
                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
    );
}

export default MoreView;
