import React, { useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, Check, Eye, EyeOff } from 'lucide-react';

const DashboardSettingsView = ({ isDarkMode, onBack, config, onSave }) => {
    // 저장하기 전까지 임시로 순서와 상태를 기억할 공간
    const [localConfig, setLocalConfig] = useState([...config]);

    // 위로 이동
    const moveUp = (index) => {
        if (index === 0) return;
        const newConfig = [...localConfig];
        const temp = newConfig[index - 1];
        newConfig[index - 1] = newConfig[index];
        newConfig[index] = temp;
        setLocalConfig(newConfig);
    };

    // 아래로 이동
    const moveDown = (index) => {
        if (index === localConfig.length - 1) return;
        const newConfig = [...localConfig];
        const temp = newConfig[index + 1];
        newConfig[index + 1] = newConfig[index];
        newConfig[index] = temp;
        setLocalConfig(newConfig);
    };

    // 눈 아이콘 (끄기/켜기)
    const toggleVisibility = (index) => {
        const newConfig = [...localConfig];
        newConfig[index].isVisible = !newConfig[index].isVisible;
        setLocalConfig(newConfig);
    };

    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <button onClick={onBack} className={`p-2 -ml-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'}`}>
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold ml-2">홈 화면 요약 카드 설정</h2>
                </div>
                {/* 💾 저장 버튼 */}
                <button 
                    onClick={() => onSave(localConfig)} 
                    className={`p-2 px-4 rounded-full font-bold flex items-center shadow-md active:scale-95 transition-transform ${isDarkMode ? 'bg-yellow-500 text-gray-900' : 'bg-yellow-400 text-yellow-900'}`}
                >
                    <Check size={18} className="mr-1" /> 저장
                </button>
            </div>

            <p className={`text-sm mb-4 font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                보고 싶은 항목을 켜고, 화살표를 눌러 순서를 변경해보세요.
            </p>

            <div className="space-y-3">
                {localConfig.map((item, index) => (
                    <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm transition-all`}>
                        <div className="flex items-center space-x-4">
                            {/* 끄고 켜는 눈동자 버튼 */}
                            <button 
                                onClick={() => toggleVisibility(index)} 
                                className={`p-2 rounded-full transition-colors ${item.isVisible ? (isDarkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-600') : (isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')}`}
                            >
                                {item.isVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                            </button>
                            <span className={`text-lg font-bold ${item.isVisible ? (isDarkMode ? 'text-white' : 'text-gray-800') : 'line-through text-gray-400'}`}>
                                {item.label}
                            </span>
                        </div>
                        <div className="flex items-center space-x-1">
                            {/* 위 화살표 */}
                            <button onClick={() => moveUp(index)} disabled={index === 0} className={`p-2 rounded-lg ${index === 0 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}`}>
                                <ArrowUp size={22} />
                            </button>
                            {/* 아래 화살표 */}
                            <button onClick={() => moveDown(index)} disabled={index === localConfig.length - 1} className={`p-2 rounded-lg ${index === localConfig.length - 1 ? 'opacity-30 cursor-not-allowed' : (isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}`}>
                                <ArrowDown size={22} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default DashboardSettingsView;