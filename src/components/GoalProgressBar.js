import React, { useEffect, useState } from 'react';
import truckImg from '../assets/truck.png'; 
import { useWeather } from '../hooks/useWeather'; 

const getProgressColor = (progress) => {
  const hue = progress * 1.2; 
  return `hsl(${hue}, 90%, 45%)`;
};

const GoalProgressBar = ({ current, goal, isDarkMode }) => {
  const progress = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const progressColor = getProgressColor(progress);
  const leftPosition = Math.min(Math.max(progress, 0), 92); 

  const [isAnimating, setIsAnimating] = useState(false);
  useEffect(() => {
    setIsAnimating(progress > 0 && progress < 100);
  }, [progress]);

  // 🚨 [오류 원인 해결] useWeather에서 'dust' 변수도 반드시 꺼내와야 합니다!
  const { temp, condition, conditionText, region, dust, loading } = useWeather();

  const isDust = condition.includes('dust');

  // 💡 [안전성 강화] 날씨 이모티콘 결정하는 로직을 분리해서 깔끔하게 만듭니다.
  const weatherIcon = condition === 'snow' ? '❄️ ' : condition === 'rain' ? '☔ ' : condition === 'dust' ? '😷 ' : '☀️ ';
  
  // 💡 [안전성 강화] 최종적으로 보여줄 텍스트를 하나의 변수로 조합합니다.
  const weatherDisplayString = `[${region}] ${weatherIcon}${temp}°C ${condition === 'dust' && dust ? `- ${dust}` : ''}`;

  return (
    // ✨ 핵심 1: mt(바깥 여백)를 줄이고, pt-16(안쪽 여백 약 64px)을 줘서 
    // 트럭이 튀어오를 '절대 안전 구역'을 물리적으로 크게 확보합니다!
    <div className="relative w-full mt-2 mb-2 px-1 pt-16">
      
      {/* 🌍 구역 한정 날씨 레이어 */}
      {!loading && condition !== 'clear' && (
        <div className={`weather-overlay weather-${condition}`}></div>
      )}

      {/* ✨ 핵심 2: 확보해둔 64px 공간의 맨 꼭대기(top-0)에 글씨를 딱 붙여버립니다. */}
      {/* 이제 트럭이 아무리 높이 점프해도 64px을 넘지 못해 절대 겹치지 않습니다! */}
      {!loading && region && temp !== null && (
        <div className="absolute top-0 left-1 flex items-center z-30">
          <span className={`text-xs font-bold tracking-tight ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {weatherDisplayString}
          </span>
        </div>
      )}

      {/* --- 이하 애니메이션 <style> 및 목표바 코드는 그대로 유지 --- */}

      <style>{`
        @keyframes drive-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes wind-dash {
          0% { opacity: 0; transform: translateX(5px); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translateX(-15px); }
        }
        .animate-truck-image { animation: drive-bounce 0.6s infinite ease-in-out; }
        .speed-line { animation: wind-dash 0.8s infinite linear; }
        .delay-1 { animation-delay: 0.2s; }
        .delay-2 { animation-delay: 0.4s; }

       .weather-overlay {
          position: absolute; 
          /* 텍스트가 위로 올라가면서 전체 박스가 커졌으므로, 배경 위쪽 여백을 살짝 줄였습니다. */
          top: -80px; 
          bottom: -50px;
          left: -20px;
          right: -20px;
          pointer-events: none; 
          overflow: hidden;
          z-index: 0;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
        }

        /* ☔ 비 효과 */
        .weather-rain {
          background-image: 
            radial-gradient(1px 30px at 20px 10px, rgba(173, 216, 230, 0.9), rgba(255,255,255,0)),
            radial-gradient(1px 20px at 60px 80px, rgba(173, 216, 230, 0.8), rgba(255,255,255,0)),
            radial-gradient(1.2px 35px at 110px 30px, rgba(200, 230, 255, 0.9), rgba(255,255,255,0)),
            radial-gradient(1px 25px at 160px 120px, rgba(173, 216, 230, 0.8), rgba(255,255,255,0)),
            radial-gradient(1px 30px at 210px 50px, rgba(200, 230, 255, 0.9), rgba(255,255,255,0)),
            radial-gradient(1.2px 25px at 260px 90px, rgba(173, 216, 230, 0.8), rgba(255,255,255,0)),
            radial-gradient(1px 35px at 40px 180px, rgba(200, 230, 255, 0.9), rgba(255,255,255,0)),
            radial-gradient(1px 20px at 130px 220px, rgba(173, 216, 230, 0.8), rgba(255,255,255,0)),
            radial-gradient(1.2px 30px at 240px 160px, rgba(200, 230, 255, 0.9), rgba(255,255,255,0));
          background-size: 280px 280px;
          animation: rainFall 0.35s linear infinite;
        }
        @keyframes rainFall {
          0% { background-position: 0px 0px; }
          100% { background-position: 15px 280px; }
        }

      /* ❄️ 눈 효과 */
        .weather-snow {
          background-image: 
            radial-gradient(6px 6px at 20px 30px, #ffffff 50%, rgba(255,255,255,0) 100%),
            radial-gradient(4px 4px at 50px 70px, #ffffff 50%, rgba(255,255,255,0) 100%),
            radial-gradient(8px 8px at 90px 40px, #ffffff 50%, rgba(255,255,255,0) 100%),
            radial-gradient(5px 5px at 150px 110px, #ffffff 50%, rgba(255,255,255,0) 100%),
            radial-gradient(6px 6px at 230px 60px, #ffffff 50%, rgba(255,255,255,0) 100%),
            radial-gradient(2px 2px at 10px 10px, #ffffff 80%, rgba(255,255,255,0) 100%),
            radial-gradient(2px 2px at 180px 150px, #ffffff 80%, rgba(255,255,255,0) 100%);
          background-size: 250px 250px; 
          animation: snowFall 4s linear infinite;
          filter: drop-shadow(0px 0px 1px rgba(0,0,0,0.3)); 
        }

        @keyframes snowFall {
          0% { background-position: 0px 0px; }
          100% { background-position: 50px 250px; }
        }

       /* 😷 미세먼지 효과 (나쁨: PM10 81~150) - 기존 코드 유지 */
        .weather-dust {
          background-color: rgba(200, 180, 150, 0.1);
          background-image: 
            radial-gradient(2px 2px at 20px 30px, rgba(139, 100, 60, 0.8), transparent),
            radial-gradient(1px 1px at 80px 70px, rgba(150, 110, 70, 0.9), transparent),
            radial-gradient(1.5px 1.5px at 150px 20px, rgba(120, 80, 50, 0.7), transparent),
            radial-gradient(3px 1.5px at 220px 110px, rgba(160, 120, 80, 0.8), transparent),
            radial-gradient(1.5px 1.5px at 280px 50px, rgba(140, 90, 60, 0.7), transparent),
            radial-gradient(circle at 50% 50%, rgba(200, 180, 150, 0.1) 0%, transparent 80%);
          background-size: 300px 200px, 300px 200px, 300px 200px, 300px 200px, 300px 200px, 100% 100%;
          animation: sandStorm 3.5s linear infinite;
        }

        @keyframes sandStorm {
          0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0% 50%; }
          100% { background-position: 300px 40px, 300px 40px, 300px 40px, 300px 40px, 300px 40px, 0% 50%; }
        }

        /* 🚨 미세먼지 효과 (매우나쁨: PM10 151 이상) - 훨씬 어둡고, 입자가 굵고, 2배 빠름! */
        .weather-dust-severe {
          background-color: rgba(180, 140, 100, 0.25); /* 하늘이 좀 더 누렇고 탁해짐 */
          background-image: 
            radial-gradient(3px 3px at 20px 30px, rgba(120, 80, 40, 0.95), transparent),
            radial-gradient(2px 2px at 80px 70px, rgba(130, 90, 50, 0.9), transparent),
            radial-gradient(3px 2px at 150px 20px, rgba(100, 60, 30, 0.95), transparent),
            radial-gradient(4px 2px at 220px 110px, rgba(140, 100, 60, 0.9), transparent),
            radial-gradient(2.5px 2.5px at 280px 50px, rgba(110, 70, 40, 0.85), transparent),
            /* 굵은 모래 파편 추가 */
            radial-gradient(2px 2px at 50px 150px, rgba(90, 50, 20, 0.9), transparent), 
            radial-gradient(circle at 50% 50%, rgba(180, 140, 100, 0.15) 0%, transparent 80%);
          background-size: 250px 200px, 250px 200px, 250px 200px, 250px 200px, 250px 200px, 250px 200px, 100% 100%;
          /* 속도를 3.5초에서 1.8초로 훅 줄여서 폭풍처럼 날아가게 만듦 */
          animation: sandStormSevere 1.8s linear infinite;
        }

        @keyframes sandStormSevere {
          0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0% 50%; }
          100% { background-position: 250px 40px, 250px 40px, 250px 40px, 250px 40px, 250px 40px, 250px 40px, 0% 50%; }
        }
      `}</style>

      <div className="relative z-10">
        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner relative mt-2">
          <div className="absolute top-1/2 left-0 w-full h-[1px] border-t-2 border-dashed border-gray-400/50 dark:border-gray-500/50 transform -translate-y-1/2 z-0"></div>
          {condition === 'snow' && <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-t from-white to-transparent opacity-80 z-10 pointer-events-none"></div>}
          {condition === 'rain' && <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-blue-900/20 z-10 pointer-events-none mix-blend-multiply"></div>}
          <div className="h-full rounded-full transition-all duration-700 ease-out relative z-0" style={{ width: `${progress}%`, backgroundColor: progressColor, boxShadow: `inset 0 1px 2px rgba(0,0,0,0.2)` }} />
        </div>

        <div className={`absolute top-0 z-20 transition-all duration-700 ease-out`} style={{ left: `${leftPosition}%`, transform: 'translateX(-30%) translateY(-65%)' }}>
            <div className={`relative ${isAnimating ? 'animate-truck-image' : ''}`}>
                {isAnimating && (
                    <svg className="absolute -left-5 top-1/2 -translate-y-1/2 w-8 h-10 overflow-visible pointer-events-none" style={{ zIndex: -1 }}>
                        <path d="M0 8 H 10" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" className="speed-line" />
                        <path d="M-3 18 H 8" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" className="speed-line delay-1" />
                        <path d="M0 28 H 10" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" className="speed-line delay-2" />
                    </svg>
                )}
                <img src={truckImg} alt="Delivery Truck" className="w-14 h-auto object-contain drop-shadow-md" />
                <div className={`absolute -top-4 left-1/2 transform -translate-x-1/2 font-bold text-[9px] py-0.5 px-1.5 rounded-full whitespace-nowrap shadow-md ${isDarkMode ? 'bg-gray-800 text-white border border-gray-600' : 'bg-white text-blue-700 border border-blue-100'}`}>
                    {(current / 10000).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}만
                </div>
            </div>
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1 px-1 font-medium relative z-20">
          <span>0</span>
          <span>{Math.round(goal / 10000).toLocaleString()}만</span>
      </div>
    </div>
  );
};

export default GoalProgressBar;