import React, { useEffect, useState, useMemo } from 'react';
import truckImg from '../assets/truck.png'; 
import { useWeather } from '../hooks/useWeather'; 

// 차트 색상 팔레트 (RevenueDistributionChart에서 가져옴)
const COLORS = [
    'bg-cyan-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 
    'bg-yellow-500', 'bg-orange-500', 'bg-blue-500', 'bg-red-500',
    'bg-indigo-500', 'bg-teal-500'
];

const getProgressColor = (progress) => {
  const hue = progress * 1.2; 
  return `hsl(${hue}, 90%, 45%)`;
};

// 💡 1. props에 revenueDistribution 추가
const GoalProgressBar = ({ current, goal, isDarkMode, revenueDistribution }) => {
  const progress = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const progressColor = getProgressColor(progress);
  const leftPosition = Math.min(Math.max(progress, 0), 92); 

  const [isAnimating, setIsAnimating] = useState(false);
  useEffect(() => {
    setIsAnimating(progress > 0 && progress < 100);
  }, [progress]);

  const { temp, condition, conditionText, region, dust, loading } = useWeather();
  const isDust = condition.includes('dust');
  const weatherIcon = condition === 'snow' ? '❄️ ' : condition === 'rain' ? '☔ ' : condition === 'dust' ? '😷 ' : '☀️ ';
  const weatherDisplayString = `[${region}] ${weatherIcon}${temp}°C ${condition === 'dust' && dust ? `- ${dust}` : ''}`;

  // 💡 2. 매출 비중 데이터 계산 로직 (상위 3개 + 기타)
  // 막대가 트럭까지 꽉 차게 보이기 위해 항목이 많을 경우 4번째는 '기타'로 묶습니다.
  const chartItems = useMemo(() => {
    if (!revenueDistribution || revenueDistribution.length === 0) return [];

    let items = [...revenueDistribution];
    items.sort((a, b) => b.value - a.value);

    let topItems = [];
    if (items.length > 4) {
      topItems = items.slice(0, 3);
      const othersValue = items.slice(3).reduce((sum, item) => sum + item.value, 0);
      topItems.push({ name: '기타', value: othersValue });
    } else {
      topItems = items;
    }

    return topItems.map((item, index) => {
      const rawPercent = current > 0 ? (item.value / current) * 100 : 0;
      return {
        key: item.name + index,
        label: item.name,
        value: item.value,
        color: COLORS[index % COLORS.length],
        percent: rawPercent.toFixed(1),
        rawPercent: rawPercent // 실제 너비 계산용 (오차 방지)
      };
    });
  }, [revenueDistribution, current]);

  return (
    <div className="relative w-full mt-2 mb-2 px-1 pt-16">
      
      {/* 🌍 구역 한정 날씨 레이어 */}
      {!loading && condition !== 'clear' && (
        <div className={`weather-overlay weather-${condition}`}></div>
      )}

      {/* 날씨 텍스트 */}
      {!loading && region && temp !== null && (
        <div className="absolute top-0 left-1 flex items-center z-30">
          <span className={`text-xs font-bold tracking-tight ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {weatherDisplayString}
          </span>
        </div>
      )}

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

        .weather-dust-severe {
          background-color: rgba(180, 140, 100, 0.25);
          background-image: 
            radial-gradient(3px 3px at 20px 30px, rgba(120, 80, 40, 0.95), transparent),
            radial-gradient(2px 2px at 80px 70px, rgba(130, 90, 50, 0.9), transparent),
            radial-gradient(3px 2px at 150px 20px, rgba(100, 60, 30, 0.95), transparent),
            radial-gradient(4px 2px at 220px 110px, rgba(140, 100, 60, 0.9), transparent),
            radial-gradient(2.5px 2.5px at 280px 50px, rgba(110, 70, 40, 0.85), transparent),
            radial-gradient(2px 2px at 50px 150px, rgba(90, 50, 20, 0.9), transparent), 
            radial-gradient(circle at 50% 50%, rgba(180, 140, 100, 0.15) 0%, transparent 80%);
          background-size: 250px 200px, 250px 200px, 250px 200px, 250px 200px, 250px 200px, 250px 200px, 100% 100%;
          animation: sandStormSevere 1.8s linear infinite;
        }

        @keyframes sandStormSevere {
          0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0% 50%; }
          100% { background-position: 250px 40px, 250px 40px, 250px 40px, 250px 40px, 250px 40px, 250px 40px, 0% 50%; }
        }
      `}</style>

      <div className="relative z-10">
        {/* 💡 3. 프로그레스 바 영역 수정 (분할 색상 적용) */}
        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner relative mt-2">
          <div className="absolute top-1/2 left-0 w-full h-[1px] border-t-2 border-dashed border-gray-400/50 dark:border-gray-500/50 transform -translate-y-1/2 z-0"></div>
          {condition === 'snow' && <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-t from-white to-transparent opacity-80 z-10 pointer-events-none"></div>}
          {condition === 'rain' && <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-blue-900/20 z-10 pointer-events-none mix-blend-multiply"></div>}
          
          {/* 채워지는 바 영역 (단색 -> 다중 색상 flexBox) */}
          <div 
            className="h-full rounded-full transition-all duration-700 ease-out relative z-0 flex overflow-hidden" 
            style={{ width: `${progress}%`, boxShadow: `inset 0 1px 2px rgba(0,0,0,0.2)` }}
          >
            {chartItems.length > 0 ? (
                chartItems.map((item) => (
                    <div 
                        key={item.key}
                        className={`${item.color} h-full transition-all duration-500`}
                        style={{ width: `${item.rawPercent}%` }}
                    />
                ))
            ) : (
                // revenueDistribution 데이터가 없을 경우를 대비한 기존 단색 지원
                <div className="w-full h-full" style={{ backgroundColor: progressColor }} />
            )}
          </div>
        </div>

        {/* 트럭 애니메이션 영역 */}
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

      {/* 💡 4. 하단 범례 추가 (상위 4개 항목 표시) */}
      {chartItems.length > 0 && (
        <div className="grid grid-cols-4 gap-1 w-full mt-0 px-1">
            {chartItems.map((item) => (
                <div key={item.key} className="flex items-center justify-center min-w-0">
                    <div className={`w-[7px] h-[7px] rounded-full ${item.color} mr-1 flex-shrink-0 self-center`}></div>
                    <div className="text-gray-500 dark:text-gray-400 text-center min-w-0">
                        <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis text-[clamp(9px,2.5vw,11px)]">
                            {item.label}<span className="opacity-80 ml-0.5">({item.percent}%)</span>
                        </span>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default GoalProgressBar;