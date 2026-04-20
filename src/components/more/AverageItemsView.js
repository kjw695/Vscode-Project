import React from 'react';
import { ChevronLeft, Check } from 'lucide-react';

const AverageItemsView = ({ onBack, isDarkMode, incomeConfig, selectedItems, onSelect }) => {
    
    // ✅ 수익 설정 상자에서 '보이기'가 켜진 것만 실시간으로 쏙쏙 뽑아냄!
    const displayItems = incomeConfig
        .filter(item => item.isVisible) // 항목 관리에서 켜진 것만!
        .map(item => item.label);      // 그 이름표만 가져오기!

    const toggleItem = (item) => {
        if (selectedItems.includes(item)) {
            onSelect(selectedItems.filter(i => i !== item));
        } else {
            onSelect([...selectedItems, item]);
        }
    };

    return (
        <div className="w-full flex flex-col h-full">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className={`p-2 -ml-2 mr-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                    <ChevronLeft size={24} />
                </button>
                <h2 className="text-2xl font-bold">평균 물량 설정</h2>
            </div>
            <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                하루 평균 물량에 포함할 항목을 모두 선택하세요.
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 pb-10">
                {displayItems.map((item) => (
                    <button
                        key={item}
                        onClick={() => toggleItem(item)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                            selectedItems.includes(item)
                                ? (isDarkMode ? 'bg-blue-900/30 border-blue-500' : 'bg-blue-50 border-blue-400')
                                : (isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')
                        }`}
                    >
                        <span className={`font-bold ${selectedItems.includes(item) ? 'text-blue-500' : ''}`}>{item}</span>
                        {selectedItems.includes(item) && <Check size={18} className="text-blue-500" />}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default AverageItemsView;