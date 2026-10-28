import React, { useState, useRef } from 'react';
import { ArrowLeft, Check, X, Plus, Maximize2 } from 'lucide-react'; // ✨ 직관적인 화살표 모양으로 변경!
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(GridLayout);
const GRID_COLUMNS = 4;

const getEventPoint = (event) => {
    const nativeEvent = event?.nativeEvent || event;
    if (!nativeEvent) return null;
    const touch = nativeEvent.changedTouches?.[0] || nativeEvent.touches?.[0];
    const point = touch || nativeEvent;
    return Number.isFinite(point.clientX) && Number.isFinite(point.clientY)
        ? { x: point.clientX, y: point.clientY }
        : null;
};

const hasGridOverlap = (a, b) =>
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y;

const findNearestFreePosition = (item, preferredX, preferredY, placed, maxExistingY) => {
    const maxSearchY = Math.max(8, maxExistingY + placed.length * 2 + 6, preferredY + placed.length * 2 + 4);
    const candidates = [];

    for (let y = 0; y <= maxSearchY; y += 1) {
        for (let x = 0; x <= GRID_COLUMNS - item.w; x += 1) {
            const candidate = { ...item, x, y };
            if (placed.some(other => hasGridOverlap(candidate, other))) continue;

            const distance = Math.abs(x - preferredX) + Math.abs(y - preferredY) * GRID_COLUMNS;
            candidates.push({ x, y, distance });
        }
    }

    candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    return candidates[0] || { x: 0, y: maxSearchY + 1 };
};

const reflowAfterDifferentSizeDrop = (sourceConfig, draggedId, targetId) => {
    const visible = sourceConfig.filter(item => item.isVisible);
    const dragged = visible.find(item => item.id === draggedId);
    const target = visible.find(item => item.id === targetId);
    if (!dragged || !target) return sourceConfig;

    const centeredX = Math.round(target.x + target.w / 2 - dragged.w / 2);
    const centeredY = Math.round(target.y + target.h / 2 - dragged.h / 2);
    const draggedX = Math.max(0, Math.min(GRID_COLUMNS - dragged.w, centeredX));
    const draggedY = Math.max(0, centeredY);
    const placed = [{ ...dragged, x: draggedX, y: draggedY }];
    const positions = new Map([[dragged.id, { x: draggedX, y: draggedY }]]);
    const maxExistingY = visible.reduce((max, item) => Math.max(max, item.y + item.h), 0);

    const remaining = visible
        .filter(item => item.id !== draggedId)
        .sort((a, b) => {
            if (a.id === targetId) return -1;
            if (b.id === targetId) return 1;
            return a.y - b.y || a.x - b.x;
        });

    remaining.forEach(item => {
        const preferredX = item.id === targetId ? dragged.x : item.x;
        const preferredY = item.id === targetId ? dragged.y : item.y;
        const safeX = Math.max(0, Math.min(GRID_COLUMNS - item.w, preferredX));
        const safeY = Math.max(0, preferredY);
        const preferred = { ...item, x: safeX, y: safeY };
        const position = placed.some(other => hasGridOverlap(preferred, other))
            ? findNearestFreePosition(item, safeX, safeY, placed, maxExistingY)
            : { x: safeX, y: safeY };

        const placedItem = { ...item, x: position.x, y: position.y };
        placed.push(placedItem);
        positions.set(item.id, { x: position.x, y: position.y });
    });

    return sourceConfig.map(item => {
        const position = positions.get(item.id);
        return position ? { ...item, x: position.x, y: position.y } : item;
    });
};

const findDropTargetId = (dragInfo, event, layout, newItem) => {
    if (!dragInfo) return null;
    const point = getEventPoint(event);
    const activeRect = dragInfo.rects.find(rect => rect.id === dragInfo.draggedId);

    if (point && activeRect && Number.isFinite(dragInfo.grabOffsetX) && Number.isFinite(dragInfo.grabOffsetY)) {
        const droppedRect = {
            left: point.x - dragInfo.grabOffsetX,
            top: point.y - dragInfo.grabOffsetY,
            right: point.x - dragInfo.grabOffsetX + activeRect.width,
            bottom: point.y - dragInfo.grabOffsetY + activeRect.height,
            width: activeRect.width,
            height: activeRect.height
        };

        const directHit = dragInfo.rects.find(rect =>
            rect.id !== dragInfo.draggedId &&
            point.x >= rect.left && point.x <= rect.right &&
            point.y >= rect.top && point.y <= rect.bottom
        );
        if (directHit) return directHit.id;

        const overlaps = dragInfo.rects
            .filter(rect => rect.id !== dragInfo.draggedId)
            .map(rect => {
                const width = Math.max(0, Math.min(droppedRect.right, rect.right) - Math.max(droppedRect.left, rect.left));
                const height = Math.max(0, Math.min(droppedRect.bottom, rect.bottom) - Math.max(droppedRect.top, rect.top));
                const area = width * height;
                const smallerArea = Math.min(
                    droppedRect.width * droppedRect.height,
                    rect.width * rect.height
                );
                return { id: rect.id, area, ratio: smallerArea > 0 ? area / smallerArea : 0 };
            })
            .filter(item => item.ratio >= 0.12)
            .sort((a, b) => b.ratio - a.ratio || b.area - a.area);

        if (overlaps.length > 0) return overlaps[0].id;
    }

    const proposed = newItem || layout?.find(item => item.i === dragInfo.draggedId);
    if (!proposed) return null;
    const target = dragInfo.config
        .filter(item => item.isVisible && item.id !== dragInfo.draggedId)
        .map(item => {
            const overlapX = Math.max(0, Math.min(proposed.x + proposed.w, item.x + item.w) - Math.max(proposed.x, item.x));
            const overlapY = Math.max(0, Math.min(proposed.y + proposed.h, item.y + item.h) - Math.max(proposed.y, item.y));
            return { id: item.id, area: overlapX * overlapY };
        })
        .filter(item => item.area > 0)
        .sort((a, b) => b.area - a.area)[0];

    return target?.id || null;
};

const DashboardSettingsView = ({ isDarkMode, onBack, config, onSave }) => {
    const [localConfig, setLocalConfig] = useState(config);
    const draggingRef = useRef(false);
    const skipNextLayoutChangeRef = useRef(false);
    const dragStartRef = useRef(null);

    const handleLayoutChange = (newLayout) => {
        if (draggingRef.current) return;
        if (skipNextLayoutChangeRef.current) {
            skipNextLayoutChangeRef.current = false;
            return;
        }

        const updatedConfig = localConfig.map(item => {
            const layoutItem = newLayout.find(l => l.i === item.id);
            if (layoutItem) {
                // 위치(x, y)만 업데이트합니다. 크기(w, h)는 버튼으로만 바꿉니다!
                return { ...item, x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h };
            }
            return item;
        });
        setLocalConfig(updatedConfig);
    };

    const handleDragStart = (layout, oldItem, newItem, placeholder, event, element) => {
        skipNextLayoutChangeRef.current = false;
        draggingRef.current = true;

        const draggedId = oldItem?.i || newItem?.i;
        const gridRoot = document.querySelector('.dashboard-settings-grid');
        const rects = Array.from(gridRoot?.querySelectorAll('.react-grid-item') || [])
            .map(wrapper => {
                const card = wrapper.querySelector('[data-dashboard-id]');
                if (!card) return null;
                const rect = wrapper.getBoundingClientRect();
                return {
                    id: card.getAttribute('data-dashboard-id'),
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height
                };
            })
            .filter(Boolean);
        const point = getEventPoint(event);
        const activeElement = element?.closest?.('.react-grid-item') || element;
        const activeRect = activeElement?.getBoundingClientRect?.() || null;

        dragStartRef.current = {
            draggedId,
            config: localConfig.map(item => ({ ...item })),
            rects,
            grabOffsetX: point && activeRect ? point.x - activeRect.left : null,
            grabOffsetY: point && activeRect ? point.y - activeRect.top : null
        };
    };

    const handleDragStop = (layout, oldItem, newItem, placeholder, event) => {
        const dragInfo = dragStartRef.current;
        draggingRef.current = false;
        const visibleLayout = Array.isArray(layout) ? layout : [];
        skipNextLayoutChangeRef.current = Boolean(dragInfo && visibleLayout.some(layoutItem => {
            const original = dragInfo.config.find(item => item.id === layoutItem.i && item.isVisible);
            return original && (original.x !== layoutItem.x || original.y !== layoutItem.y);
        }));
        dragStartRef.current = null;

        if (!dragInfo) {
            const updated = localConfig.map(item => {
                const layoutItem = layout.find(entry => entry.i === item.id);
                return layoutItem ? { ...item, x: layoutItem.x, y: layoutItem.y } : item;
            });
            setLocalConfig(updated);
            return;
        }

        const draggedId = dragInfo.draggedId || oldItem?.i || newItem?.i;
        const targetId = findDropTargetId(dragInfo, event, layout, newItem);
        let updatedConfig;

        if (targetId) {
            const dragged = dragInfo.config.find(item => item.id === draggedId);
            const target = dragInfo.config.find(item => item.id === targetId);

            if (dragged && target && dragged.w === target.w && dragged.h === target.h) {
                // 같은 크기 파츠끼리는 다른 파츠를 밀지 않고 정확하게 자리만 교환합니다.
                updatedConfig = dragInfo.config.map(item => {
                    if (item.id === draggedId) return { ...item, x: target.x, y: target.y };
                    if (item.id === targetId) return { ...item, x: dragged.x, y: dragged.y };
                    return item;
                });
            } else {
                // 크기가 다르면 가로폭·겹침을 검사하고, 부딪히는 파츠만 가까운 빈자리로 이동합니다.
                updatedConfig = reflowAfterDifferentSizeDrop(dragInfo.config, draggedId, targetId);
            }
        } else {
            // 빈 공간에 놓았을 때는 기존 드래그 배치 결과를 적용합니다.
            updatedConfig = dragInfo.config.map(item => {
                const layoutItem = layout.find(entry => entry.i === item.id);
                return layoutItem ? { ...item, x: layoutItem.x, y: layoutItem.y } : item;
            });
        }

        setLocalConfig(updatedConfig);
    };

    const toggleVisibility = (id) => {
        setLocalConfig(prev => prev.map(item => item.id === id ? { ...item, isVisible: !item.isVisible } : item));
    };

    // ✨ 변경: 크기 조절 시 겹침 현상을 완벽 방지하는 스마트 리사이징 로직!
    const cycleSize = (id, currentW) => {
        setLocalConfig(prev => {
            const itemIndex = prev.findIndex(p => p.id === id);
            if (itemIndex === -1) return prev;

            const newConfig = [...prev];
            const item = { ...newConfig[itemIndex] }; // 원본 보호를 위해 복사

            // 1. 크기 증가 (4를 넘어가면 1로)
            let newW = item.w + 1;
            if (newW > 4) newW = 1;
            item.w = newW;
            item.h = 2; // 세로는 2칸 고정

            // 현재 화면에 나와 있는 파츠들 중 가장 아래쪽의 y 좌표 (새로운 줄 생성용)
            const maxY = Math.max(...prev.filter(p => p.isVisible).map(p => p.y + p.h), 0);

            // 2. 만약 크기가 커져서 전체 가로폭(4칸)을 뚫고 나가면 강제로 맨 아래 새 줄로 내림
            if (item.x + item.w > 4) {
                item.x = 0;
                item.y = maxY;
            }

            // 3. 다른 파츠와 겹치는지(Collision) x축, y축 좌표로 정밀 검사
            const hasCollision = prev.some(other => {
                if (other.id === item.id || !other.isVisible) return false; // 나 자신이나 숨겨진 건 제외
                
                const isXOverlap = item.x < other.x + other.w && item.x + item.w > other.x;
                const isYOverlap = item.y < other.y + other.h && item.y + item.h > other.y;
                
                return isXOverlap && isYOverlap; // 가로 세로가 모두 겹치면 충돌!
            });

            // 4. 겹치면? 기존 파츠를 밀어내서 망가뜨리지 않고, 자신을 맨 아래 빈 공간으로 피신시킴
            if (hasCollision) {
                item.x = 0;
                item.y = maxY;
            }

            newConfig[itemIndex] = item;
            return newConfig;
        });
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
                            👆 꾹 눌러 이동 · 겹치면 자동 정리
                        </span>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center ${isDarkMode ? 'bg-gray-700 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                            <Maximize2 size={12} strokeWidth={3} className="mr-1" /> 버튼으로 크기 조절
                        </span>
                    </div>

                   {/* 여기가 바로 4x4 그리드 도화지입니다! */}
                    <ResponsiveGridLayout
                        className="layout dashboard-settings-grid"
                        layout={visibleItems.map(item => ({ i: item.id, x: item.x, y: item.y, w: item.w, h: item.h }))}
                        cols={4}               
                        rowHeight={35}         // ✨ 기존 40에서 35로 줄여서 위아래 텅 빈 공간을 압축합니다!
                        onLayoutChange={handleLayoutChange}
                        onDragStart={handleDragStart}
                        onDragStop={handleDragStop}
                        isResizable={false}    
                        compactType={null}
                        preventCollision={false}
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
                                    data-dashboard-id={item.id}
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