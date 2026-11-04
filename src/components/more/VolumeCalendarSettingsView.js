import React, { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';

const DEFAULT_VOLUME_DISPLAY_ITEMS = {
    deliveryCount: true,
    deliveryInterruptionAmount: true,
    returnCount: true,
    freshBagCount: true
};

const VOLUME_ITEMS = [
    { key: 'deliveryCount', label: '배송', description: '배송 완료 건수' },
    { key: 'deliveryInterruptionAmount', label: '중단', description: '배송 중단 건수' },
    { key: 'returnCount', label: '반품', description: '반품 건수' },
    { key: 'freshBagCount', label: '프레시백', description: '프레시백 수량' }
];

function VolumeCalendarSettingsView({ isDarkMode, onBack, volumeDisplayItems, onSave }) {
    const [localItems, setLocalItems] = useState(() => ({
        ...DEFAULT_VOLUME_DISPLAY_ITEMS,
        ...(volumeDisplayItems || {})
    }));

    const toggleItem = (key) => {
        setLocalItems((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center min-w-0">
                    <button
                        onClick={onBack}
                        className={`p-2 -ml-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'}`}
                        aria-label="뒤로 가기"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold ml-2">물량 달력 표시</h2>
                </div>
                <button
                    onClick={() => onSave({ ...localItems })}
                    className={`p-2 px-4 rounded-full font-bold flex items-center shadow-md active:scale-95 transition-transform ${isDarkMode ? 'bg-yellow-500 text-gray-900' : 'bg-yellow-400 text-yellow-900'}`}
                >
                    <Check size={18} className="mr-1" /> 저장
                </button>
            </div>

            <div className="overflow-y-auto pb-10 space-y-4">
                <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                    <h3 className={`text-sm font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        표시할 항목
                    </h3>
                    <p className={`mb-3 mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        홈 달력에서 '물량'을 선택했을 때 표시할 항목입니다.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {VOLUME_ITEMS.map((item) => (
                            <label
                                key={item.key}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-bold ${isDarkMode ? 'border-gray-700 bg-gray-900 text-gray-200' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={Boolean(localItems[item.key])}
                                    onChange={() => toggleItem(item.key)}
                                    className="h-4 w-4 accent-indigo-600"
                                />
                                <span className="flex flex-col">
                                    <span>{item.label}</span>
                                    <span className={`text-[11px] font-normal ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {item.description}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                <p className={`px-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    선택한 항목만 홈 달력의 물량 모드에 표시됩니다.
                </p>
            </div>
        </div>
    );
}

export default VolumeCalendarSettingsView;
