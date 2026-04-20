// src/components/common/SwipeableView.js
import React, { useState, useRef } from 'react';

const SwipeableView = ({ children, onSwipeLeft, onSwipeRight, swipeDisabled, animationKey }) => {
    const [slideDir, setSlideDir] = useState('');
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);
    const touchEndX = useRef(null);
    const touchEndY = useRef(null);

    
    const onTouchStart = (e) => {
        touchStartX.current = e.targetTouches[0].clientX;
        touchStartY.current = e.targetTouches[0].clientY;
        touchEndX.current = null;
        touchEndY.current = null;
    };

    const onTouchMove = (e) => {
        touchEndX.current = e.targetTouches[0].clientX;
        touchEndY.current = e.targetTouches[0].clientY;
    };

    const onTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        const deltaX = touchStartX.current - touchEndX.current;
        const deltaY = touchStartY.current - touchEndY.current;

        // X축 이동이 Y축 이동보다 크고 50px 이상 이동했을 때만 반응
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (swipeDisabled) return; // 스와이프가 금지된 상태면 무시

            if (deltaX > 0) {
                // 오른쪽에서 왼쪽으로 밈 (다음 페이지)
                setSlideDir('right');
                if (onSwipeLeft) onSwipeLeft();
            } else {
                // 왼쪽에서 오른쪽으로 밈 (이전 페이지)
                setSlideDir('left');
                if (onSwipeRight) onSwipeRight();
            }
        }
    };

    return (
        <div 
            onTouchStart={onTouchStart} 
            onTouchMove={onTouchMove} 
            onTouchEnd={onTouchEnd} 
            className="overflow-x-hidden w-full"
        >
            {/* 스르륵 애니메이션을 위한 CSS */}
            <style>
                {`
                    @keyframes slideInFromRight {
                        0% { transform: translateX(30%); opacity: 0; }
                        100% { transform: translateX(0); opacity: 1; }
                    }
                    @keyframes slideInFromLeft {
                        0% { transform: translateX(-30%); opacity: 0; }
                        100% { transform: translateX(0); opacity: 1; }
                    }
                    .animate-slide-in-right { animation: slideInFromRight 0.25s ease-out forwards; }
                    .animate-slide-in-left { animation: slideInFromLeft 0.25s ease-out forwards; }
                `}
            </style>
            
            <div 
                key={animationKey} 
                className={slideDir === 'right' ? 'animate-slide-in-right' : (slideDir === 'left' ? 'animate-slide-in-left' : '')}
            >
                {children}
            </div>
        </div>
    );
};

export default SwipeableView;