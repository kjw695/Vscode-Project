import React from 'react';
import { ChevronLeft, PhoneCall } from 'lucide-react';

const INSURANCE_LIST = [
    { id: 'samsung', name: '삼성화재(애니카)', phone: '1588-5114' },
    { id: 'hyundai', name: '현대해상(하이카)', phone: '1588-5656' },
    { id: 'db', name: 'DB손해보험(프로미)', phone: '1588-0100' },
    { id: 'kb', name: 'KB손해보험(매직카)', phone: '1544-0114' },
    { id: 'meritz', name: '메리츠화재', phone: '1566-7711' },
    { id: 'hanwha', name: '한화손해보험', phone: '1566-8000' },
    { id: 'lotte', name: '롯데손해보험', phone: '1588-3344' },
    { id: 'axa', name: 'AXA손해보험', phone: '1566-1566' },
    { id: 'heungkuk', name: '흥국화재', phone: '1688-1688' },
    { id: 'carrot', name: '캐롯손해보험', phone: '1566-0300' },
    { id: 'hana', name: '하나손해보험', phone: '1566-3000' },
    { id: 'none', name: '표시 안 함', phone: '' }
];

const InsuranceView = ({ onBack, isDarkMode, selectedInsurance, onSelect }) => {
    return (
        <div className="w-full flex flex-col h-full">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className={`p-2 -ml-2 mr-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                    <ChevronLeft size={24} />
                </button>
                <h2 className="text-2xl font-bold">보험사 설정</h2>
            </div>
            
            <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                홈 화면에 띄워둘 자동차 보험사(긴급출동)를 선택하세요.
            </p>

            <div className="flex-1 overflow-y-auto pb-6 space-y-2">
                {INSURANCE_LIST.map((ins) => {
                    const isSelected = selectedInsurance?.id === ins.id;
                    return (
                        <div
                            key={ins.id}
                            onClick={() => onSelect(ins)}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors cursor-pointer ${
                                isSelected 
                                    ? (isDarkMode ? 'bg-blue-900/30 border-blue-500' : 'bg-blue-50 border-blue-400')
                                    : (isDarkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-200 hover:bg-gray-50')
                            }`}
                        >
                            {/* 왼쪽: 보험사 이름과 번호 텍스트 */}
                            <div className="flex flex-col text-left">
                                <span className={`font-bold ${isSelected ? 'text-blue-500' : ''}`}>{ins.name}</span>
                                {ins.phone && (
                                    <span className="text-sm text-gray-500 mt-1">{ins.phone}</span>
                                )}
                            </div>

                          {/* ✨ 오른쪽: 명확한 [등록] 버튼 + 작아진 [통화] 아이콘 */}
                            <div className="flex items-center gap-2 sm:gap-3">
                                
                                {/* 1. 등록/선택 버튼 (누르면 확실하게 등록됨) */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelect(ins);
                                    }}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-bold active:scale-95 transition-colors ${
                                        isSelected 
                                            ? 'bg-indigo-500 text-white shadow-md' // 이미 등록된 상태면 파란색
                                            : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300') // 등록 전이면 회색
                                    }`}
                                >
                                    {isSelected ? '선택됨' : '등록'}
                                </button>

                                {/* 2. 통화 버튼 (글자 빼고 동그랗고 세련된 아이콘으로 축소) */}
                                {ins.phone && (
                                    <a 
                                        href={`tel:${ins.phone.replace(/-/g, '')}`} // ✨ 에러 방지: 전화 넘길 때만 하이픈(-)을 제거합니다!
                                        onClick={(e) => e.stopPropagation()}
                                        className={`p-2.5 rounded-full shadow-sm active:scale-95 transition-transform flex items-center justify-center ${
                                            isDarkMode
                                                ? 'bg-blue-900/50 text-blue-400 hover:bg-blue-800' 
                                                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                        }`}
                                    >
                                        <PhoneCall size={18} />
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InsuranceView;