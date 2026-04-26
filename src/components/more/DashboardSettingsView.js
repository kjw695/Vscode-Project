import React, { useState } from 'react';
import { ArrowLeft, Check, X, Plus, Maximize2 } from 'lucide-react'; // ✨ 직관적인 화살표 모양으로 변경!
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(GridLayout);

const DashboardSettingsView = ({ isDarkMode, onBack, config, onSave }) => {
    const [localConfig, setLocalConfig] = useState(config);

    const handleLayoutChange = (newLayout) => {
        const updatedConfig = localConfig.map(item => {
            const layoutItem = newLayout.find(l => l.i === item.id);
            if (layoutItem) {
                // 위치(x, y)만 업데이트합니다. 크기(w, h)는 버튼으로만 바꿉니다!
                return { ...item, x: layoutItem.x, y: layoutItem.y };
            }
            return item;
        });
        setLocalConfig(updatedConfig);
    };

    const toggleVisibility = (id) => {
        setLocalConfig(prev => prev.map(item => item.id === id ? { ...item, isVisible: !item.isVisible } : item));
    };

    // ✨ 변경: 1칸씩 늘어나고, 4칸 다음엔 다시 1칸으로 돌아오는 똑똑한 로직!
    const cycleSize = (id, currentW) => {
        setLocalConfig(prev => prev.map(item => {
            if (item.id === id) {
                // 현재 가로 크기(currentW)에서 1을 더합니다. 
                // 만약 더한 값이 4칸보다 커지면 다시 1칸으로 되돌립니다.
                let newW = currentW + 1;
                if (newW > 4) newW = 1;
                
                return { ...item, w: newW, h: 2 }; // 세로는 2칸으로 유지
            }
            return item;
        }));
    };

    const handleSave = () => onSave(localConfig);

    const visibleItems = localConfig.filter(c => c.isVisible);
    const hiddenItems = localConfig.filter(c => !c.isVisible);

    return (
        <div className="flex flex-col h-full w-full select-none">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <button onClick={onBack} className={`p-2 -ml-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'}`}>
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold ml-2">홈 화면 설정</h2>
                </div>
                <button onClick={handleSave} className={`p-2 px-4 rounded-full font-bold flex items-center shadow-md active:scale-95 transition-transform ${isDarkMode ? 'bg-yellow-500 text-gray-900' : 'bg-yellow-400 text-yellow-900'}`}>
                    <Check size={18} className="mr-1" /> 저장
                </button>
            </div>
            
            <div className="overflow-y-auto pb-10">
                <div className={`p-2 rounded-xl border-2 border-dashed ${isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="text-center mb-4 flex justify-center gap-2">
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                            👆 꾹 눌러서 이동
                        </span>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center ${isDarkMode ? 'bg-gray-700 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                            <Maximize2 size={12} strokeWidth={3} className="mr-1" /> 버튼으로 크기 조절
                        </span>
                    </div>

                   {/* 여기가 바로 4x4 그리드 도화지입니다! */}
                    <ResponsiveGridLayout
                        className="layout"
                        layout={visibleItems.map(item => ({ i: item.id, x: item.x, y: item.y, w: item.w, h: item.h }))}
                        cols={4}               
                        rowHeight={35}         // ✨ 기존 40에서 35로 줄여서 위아래 텅 빈 공간을 압축합니다!
                        onLayoutChange={handleLayoutChange}
                        isResizable={false}    
                        compactType="vertical" 
                        margin={[10, 10]}      
                    >
                        {visibleItems.map(item => {
                            // ✨ [핵심] 박스 크기에 맞춰 글자 크기를 시원시원하게 확 키웁니다!
                            let dynamicLabelClass = "text-[clamp(11px,3vw,13px)]"; // 1칸일 때 (기본)
                            
                            if (item.w === 4) {
                                dynamicLabelClass = "text-[clamp(18px,5vw,24px)]"; // 4칸일 때 (엄청 크게!)
                            } else if (item.w === 3) {
                                dynamicLabelClass = "text-[clamp(15px,4.5vw,20px)]"; // 3칸일 때 (적당히 크게!)
                            } else if (item.w === 2) {
                                dynamicLabelClass = "text-[clamp(13px,3.8vw,16px)]"; // 2칸일 때 (조금 크게)
                            }

                          return (
                                <div 
                                    key={item.id} 
                                    // 1. items-center justify-center를 제거하고, overflow-hidden을 추가했습니다.
                                    className={`rounded-2xl border-2 shadow-sm flex flex-col relative cursor-move transition-transform duration-150 overflow-hidden
                                        ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-800'}
                                    `}
                                >
                                    {/* ✨ 1층: 상단 아이콘 구역 (버튼 전용 공간) */}
                                    <div className="w-full h-8 flex justify-between items-start p-1.5 z-10 shrink-0">
                                        <button 
                                            onPointerDown={(e) => { e.stopPropagation(); cycleSize(item.id, item.w); }}
                                            // absolute를 빼고 상단 바 안에 배치했습니다.
                                            className="p-1 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-400"
                                        >
                                            <Maximize2 size={14} strokeWidth={3} />
                                        </button>

                                        <button 
                                            onPointerDown={(e) => { e.stopPropagation(); toggleVisibility(item.id); }}
                                            // absolute를 빼고 상단 바 안에 배치했습니다.
                                            className="p-1 rounded-full bg-red-100 text-red-500 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400"
                                        >
                                            <X size={14} strokeWidth={3} />
                                        </button>
                                    </div>

                                    {/* ✨ 2층: 하단 텍스트 구역 (글자 전용 공간) */}
                                    <div className="flex-1 w-full flex items-center justify-center px-1 pb-2">
                                        <span className={`font-extrabold text-center leading-tight break-keep ${dynamicLabelClass}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                </div>
                            );
                            
                        })}
                    </ResponsiveGridLayout>

                </div>

                {hiddenItems.length > 0 && (
                    <div className="mt-8">
                        <h3 className={`font-bold mb-3 ml-1 flex items-center ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                            <span className="mr-1">📦</span> 보관함
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {hiddenItems.map(item => (
                                <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border border-dashed opacity-80 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
                                    <span className={`text-sm font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
                                   {/* 파츠 꺼내기(+) 버튼 */}
                                    <button onClick={() => toggleVisibility(item.id)} className="p-1.5 rounded-full bg-blue-100 text-blue-600 shadow-sm active:scale-95 dark:bg-blue-900/50 dark:text-blue-400">
                                        <Plus size={16} strokeWidth={3} /> {/* ✨ 직관적인 플러스 아이콘! */}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DashboardSettingsView;