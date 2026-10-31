import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Check, X, Plus, Maximize2, GripVertical } from 'lucide-react';

const GRID_COLUMNS = 4;
const GRID_ROW_HEIGHT = 35;
const GRID_GAP = 10;
const LONG_PRESS_DELAY = 220;

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

const DashboardSettingsView = ({ isDarkMode, onBack, config, onSave }) => {
    const [localConfig, setLocalConfig] = useState(config);
    const [dragState, setDragState] = useState(null);
    const gridRef = useRef(null);
    const dragRef = useRef(null);
    const dragTimerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (dragTimerRef.current) window.clearTimeout(dragTimerRef.current);
        };
    }, []);

    const handleDragPointerDown = (event, itemId) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();

        const handle = event.currentTarget;
        try {
            handle.setPointerCapture(event.pointerId);
        } catch (error) {
            // Pointer capture is best-effort; touch and mouse events still work where unsupported.
        }

        const grid = gridRef.current;
        const cardElements = Array.from(grid?.querySelectorAll('[data-dashboard-id]') || []);
        const rects = cardElements.map(card => {
            const rect = card.getBoundingClientRect();
            return {
                id: card.getAttribute('data-dashboard-id'),
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
            };
        });

        const draggedRect = rects.find(rect => rect.id === itemId);
        if (!draggedRect) return;

        dragRef.current = {
            draggedId: itemId,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            dx: 0,
            dy: 0,
            active: false,
            draggedRect,
            rects,
            config: localConfig.map(item => ({ ...item }))
        };

        if (dragTimerRef.current) window.clearTimeout(dragTimerRef.current);
        dragTimerRef.current = window.setTimeout(() => {
            const current = dragRef.current;
            if (!current || current.pointerId !== event.pointerId) return;
            current.active = true;
            setDragState({ id: itemId, dx: 0, dy: 0, targetId: null });
        }, LONG_PRESS_DELAY);
    };

    const handleDragPointerMove = (event) => {
        const current = dragRef.current;
        if (!current || current.pointerId !== event.pointerId) return;

        const dx = event.clientX - current.startX;
        const dy = event.clientY - current.startY;

        if (!current.active) {
            // 길게 누르기 전에 손가락이 크게 움직이면 페이지 스크롤/일반 터치로 판단합니다.
            if (Math.hypot(dx, dy) > 10) {
                if (dragTimerRef.current) window.clearTimeout(dragTimerRef.current);
                dragTimerRef.current = null;
                dragRef.current = null;
            }
            return;
        }

        current.dx = dx;
        current.dy = dy;

        const movedRect = {
            left: current.draggedRect.left + dx,
            top: current.draggedRect.top + dy,
            right: current.draggedRect.right + dx,
            bottom: current.draggedRect.bottom + dy
        };
        const centerX = (movedRect.left + movedRect.right) / 2;
        const centerY = (movedRect.top + movedRect.bottom) / 2;

        // 드래그한 파츠의 중앙이 들어간 파츠만 교환 대상으로 지정합니다.
        const target = current.rects.find(rect =>
            rect.id !== current.draggedId &&
            centerX >= rect.left && centerX <= rect.right &&
            centerY >= rect.top && centerY <= rect.bottom
        );

        setDragState(previous => {
            if (
                previous &&
                previous.id === current.draggedId &&
                previous.dx === dx &&
                previous.dy === dy &&
                previous.targetId === (target?.id || null)
            ) return previous;

            return {
                id: current.draggedId,
                dx,
                dy,
                targetId: target?.id || null
            };
        });
    };

    const finishDrag = (event, cancelled = false) => {
        const current = dragRef.current;
        if (!current || current.pointerId !== event.pointerId) return;

        if (dragTimerRef.current) window.clearTimeout(dragTimerRef.current);
        dragTimerRef.current = null;
        dragRef.current = null;
        setDragState(null);

        if (cancelled || !current.active) return;

        const movedRect = {
            left: current.draggedRect.left + current.dx,
            top: current.draggedRect.top + current.dy,
            right: current.draggedRect.right + current.dx,
            bottom: current.draggedRect.bottom + current.dy
        };
        const centerX = (movedRect.left + movedRect.right) / 2;
        const centerY = (movedRect.top + movedRect.bottom) / 2;
        const targetRect = current.rects.find(rect =>
            rect.id !== current.draggedId &&
            centerX >= rect.left && centerX <= rect.right &&
            centerY >= rect.top && centerY <= rect.bottom
        );

        const dragged = current.config.find(item => item.id === current.draggedId);
        if (!dragged) return;

        let updatedConfig = current.config;

        if (targetRect) {
            const target = current.config.find(item => item.id === targetRect.id);
            if (!target) return;

            if (dragged.w === target.w && dragged.h === target.h) {
                // 같은 크기는 정확히 두 파츠의 좌표만 맞바꿉니다.
                updatedConfig = current.config.map(item => {
                    if (item.id === dragged.id) return { ...item, x: target.x, y: target.y };
                    if (item.id === target.id) return { ...item, x: dragged.x, y: dragged.y };
                    return item;
                });
            } else {
                // 크기가 다르면 충돌하는 파츠만 가까운 빈자리로 재배치합니다.
                updatedConfig = reflowAfterDifferentSizeDrop(current.config, dragged.id, target.id);
            }
        } else {
            // 다른 파츠 위가 아닌 빈 칸에 놓으면 해당 칸으로 이동합니다.
            const gridRect = gridRef.current?.getBoundingClientRect();
            if (!gridRect) return;

            const columnWidth = (gridRect.width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
            const columnStep = columnWidth + GRID_GAP;
            const rowStep = GRID_ROW_HEIGHT + GRID_GAP;
            const nextX = Math.max(0, Math.min(
                GRID_COLUMNS - dragged.w,
                Math.round((movedRect.left - gridRect.left) / columnStep)
            ));
            const nextY = Math.max(0, Math.round((movedRect.top - gridRect.top) / rowStep));
            const candidate = { ...dragged, x: nextX, y: nextY };
            const collides = current.config.some(item =>
                item.isVisible &&
                item.id !== dragged.id &&
                hasGridOverlap(candidate, item)
            );

            if (!collides) {
                updatedConfig = current.config.map(item =>
                    item.id === dragged.id ? candidate : item
                );
            }
        }

        setLocalConfig(updatedConfig);
    };

    const handleDragPointerUp = (event) => finishDrag(event, false);
    const handleDragPointerCancel = (event) => finishDrag(event, true);

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
                            오른쪽 아래 손잡이를 꾹 눌러 이동 · 파츠 중앙을 목표 위에 놓기
                        </span>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center ${isDarkMode ? 'bg-gray-700 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                            <Maximize2 size={12} strokeWidth={3} className="mr-1" /> 버튼으로 크기 조절
                        </span>
                    </div>

                   {/* 여기가 바로 4x4 그리드 도화지입니다! */}
                    <div
                        ref={gridRef}
                        className="dashboard-settings-grid w-full"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            gridAutoRows: `${GRID_ROW_HEIGHT}px`,
                            columnGap: `${GRID_GAP}px`,
                            rowGap: `${GRID_GAP}px`,
                            position: 'relative'
                        }}
                    >
                        {visibleItems.map(item => {
                            let dynamicLabelClass = "text-[clamp(11px,3vw,13px)]";
                            if (item.w === 4) {
                                dynamicLabelClass = "text-[clamp(18px,5vw,24px)]";
                            } else if (item.w === 3) {
                                dynamicLabelClass = "text-[clamp(15px,4.5vw,20px)]";
                            } else if (item.w === 2) {
                                dynamicLabelClass = "text-[clamp(13px,3.8vw,16px)]";
                            }

                            const isDragging = dragState?.id === item.id;
                            const isDropTarget = dragState?.targetId === item.id;

                            return (
                                <div
                                    key={item.id}
                                    data-dashboard-id={item.id}
                                    className={`rounded-2xl border-2 shadow-sm flex flex-col relative overflow-hidden min-w-0 min-h-0
                                        ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-800'}
                                        ${isDropTarget ? 'ring-4 ring-blue-400 ring-offset-1' : ''}
                                        ${isDragging ? 'opacity-95' : ''}
                                    `}
                                    style={{
                                        gridColumn: `${Math.max(0, Number(item.x) || 0) + 1} / span ${item.w}`,
                                        gridRow: `${Math.max(0, Number(item.y) || 0) + 1} / span ${item.h}`,
                                        height: '100%',
                                        zIndex: isDragging ? 30 : (isDropTarget ? 20 : 1),
                                        transform: isDragging
                                            ? `translate3d(${dragState.dx}px, ${dragState.dy}px, 0)`
                                            : 'none',
                                        transition: isDragging ? 'none' : 'transform 150ms ease',
                                        boxShadow: isDragging ? '0 12px 28px rgba(0,0,0,0.22)' : undefined
                                    }}
                                >
                                    {/* 상단 조작 영역: 양쪽 버튼은 기존 기능, 가운데 손잡이만 드래그합니다. */}
                                    <div className="w-full h-8 flex justify-between items-start p-1.5 z-10 shrink-0">
                                        <button
                                            type="button"
                                            onPointerDown={(e) => { e.stopPropagation(); cycleSize(item.id, item.w); }}
                                            className="p-1 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-400"
                                            aria-label={`${item.label} 크기 변경`}
                                        >
                                            <Maximize2 size={14} strokeWidth={3} />
                                        </button>

                                        <button
                                            type="button"
                                            onPointerDown={(e) => { e.stopPropagation(); toggleVisibility(item.id); }}
                                            className="p-1 rounded-full bg-red-100 text-red-500 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400"
                                            aria-label={`${item.label} 숨기기`}
                                        >
                                            <X size={14} strokeWidth={3} />
                                        </button>
                                    </div>

                                    <div className="flex-1 w-full flex items-center justify-center px-1 pb-2">
                                        <span className={`font-extrabold text-center leading-tight break-keep ${dynamicLabelClass}`}>
                                            {item.label}
                                        </span>
                                    </div>

                                    {/* 오른쪽 아래 모서리에 자연스럽게 배치한 이동 손잡이 */}
                                    <button
                                        type="button"
                                        className={`absolute z-20 flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors
                                            ${isDarkMode
                                                ? 'text-gray-500 hover:text-gray-300'
                                                : 'text-gray-400 hover:text-gray-600'}`}
                                        style={{
                                            position: 'absolute',
                                            right: 0,
                                            bottom: 0,
                                            width: '17px',
                                            height: '17px',
                                            padding: 0,
                                            margin: 0,
                                            borderTopLeftRadius: '7px',
                                            touchAction: 'none',
                                            userSelect: 'none',
                                            lineHeight: 0
                                        }}
                                        aria-label={`${item.label} 이동 손잡이`}
                                        onPointerDown={(e) => handleDragPointerDown(e, item.id)}
                                        onPointerMove={handleDragPointerMove}
                                        onPointerUp={handleDragPointerUp}
                                        onPointerCancel={handleDragPointerCancel}
                                        onClick={(e) => e.preventDefault()}
                                    >
                                        <GripVertical size={13} strokeWidth={2.5} className="rotate-45" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

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