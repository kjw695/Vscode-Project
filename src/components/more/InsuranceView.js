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
                <h2 className="text-2xl font-bold">내 보험사 설정</h2>
            </div>
            
            <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                홈 화면에 띄워둘 자동차 보험사(긴급출동)를 선택하세요.
            </p>

            <div className="flex-1 overflow-y-auto pb-6 space-y-2">
                {INSURANCE_LIST.map((ins) => {
                    const isSelected = selectedInsurance?.id === ins.id;
                    return (
                        <button
                            key={ins.id}
                            onClick={() => onSelect(ins)}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${
                                isSelected 
                                    ? (isDarkMode ? 'bg-blue-900/30 border-blue-500' : 'bg-blue-50 border-blue-400')
                                    : (isDarkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-200 hover:bg-gray-50')
                            }`}
                        >
                            <span className={`font-bold ${isSelected ? 'text-blue-500' : ''}`}>{ins.name}</span>
                            {ins.phone && (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <PhoneCall size={14} />
                                    {ins.phone}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default InsuranceView;