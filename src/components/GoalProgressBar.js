import React, { useEffect, useState } from 'react';
// 🚚 내 컴퓨터에 저장한 트럭 사진 불러오기
import truckImg from '../assets/truck.png'; 

const getProgressColor = (progress) => {
  const hue = progress * 1.2; 
  return `hsl(${hue}, 90%, 45%)`;
};

const GoalProgressBar = ({ current, goal, isDarkMode }) => {
  const progress = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const progressColor = getProgressColor(progress);
  // 이미지 크기 고려해서 위치 보정 (0 ~ 92%)
  const leftPosition = Math.min(Math.max(progress, 0), 92); 

  // 애니메이션 상태 관리
  const [isAnimating, setIsAnimating] = useState(false);
  useEffect(() => {
    setIsAnimating(progress > 0 && progress < 100);
  }, [progress]);

  return (
    <div className="w-full mt-4 mb-2 px-1">
      {/* ✨ 애니메이션 스타일 정의 */}
      <style>{`
        /* 1. 트럭 덜컹거리는 효과 */
        @keyframes drive-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        
        /* 2. 뒤쪽 스피드 라인(바람) 효과 */
        @keyframes wind-dash {
          0% { opacity: 0; transform: translateX(5px); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translateX(-15px); }
        }

        .animate-truck-image {
          animation: drive-bounce 0.6s infinite ease-in-out;
        }
        
        /* 스피드 라인 클래스 */
        .speed-line {
          animation: wind-dash 0.8s infinite linear;
        }
        .delay-1 { animation-delay: 0.2s; }
        .delay-2 { animation-delay: 0.4s; }
      `}</style>

      <div className="relative">
        {/* 🛣️ 도로 배경 */}
        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner relative">
           <div className="absolute top-1/2 left-0 w-full h-[1px] border-t-2 border-dashed border-gray-400/50 dark:border-gray-500/50 transform -translate-y-1/2"></div>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out relative"
            style={{ 
                width: `${progress}%`, 
                backgroundColor: progressColor,
                boxShadow: `inset 0 1px 2px rgba(0,0,0,0.2)`
            }}
          />
        </div>

        {/* 🚚 트럭 위치 */}
        <div 
            className={`absolute top-0 z-20 transition-all duration-700 ease-out`}
            style={{ 
                left: `${leftPosition}%`,
                transform: 'translateX(-30%) translateY(-65%)', 
            }}
        >
            {/* 움직이는 애니메이션 그룹 */}
            <div className={`relative ${isAnimating ? 'animate-truck-image' : ''}`}>
                
                {/* ✨ [추가] 달리는 효과 (스피드 라인 SVG) */}
                {isAnimating && (
                    <svg className="absolute -left-5 top-1/2 -translate-y-1/2 w-8 h-10 overflow-visible pointer-events-none" style={{ zIndex: -1 }}>
                        <path d="M0 8 H 10" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" className="speed-line" />
                        <path d="M-3 18 H 8" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" className="speed-line delay-1" />
                        <path d="M0 28 H 10" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" className="speed-line delay-2" />
                    </svg>
                )}

                {/* 🖼️ 트럭 이미지 */}
                <img 
                    src={truckImg} 
                    alt="Delivery Truck" 
                    className="w-14 h-auto object-contain drop-shadow-md" 
                />
                
                {/* 💬 말풍선 (위치 수정: -top-7 -> -top-4로 내려줌) */}
                <div className={`absolute -top-4 left-1/2 transform -translate-x-1/2 font-bold text-[9px] py-0.5 px-1.5 rounded-full whitespace-nowrap shadow-md
                    ${isDarkMode 
                        ? 'bg-gray-800 text-white border border-gray-600' 
                        : 'bg-white text-blue-700 border border-blue-100'}`}>
                    {Math.round(current / 10000).toLocaleString()}만
                </div>
            </div>
        </div>
      </div>

      {/* 목표 금액 */}
      <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1 px-1 font-medium">
          <span>0</span>
          <span>{Math.round(goal / 10000).toLocaleString()}만</span>
      </div>
    </div>
  );
};

export default GoalProgressBar;