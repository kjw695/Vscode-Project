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

  // ✨ 1. 새로운 기상청 버전에 맞게 데이터 받아오기
  const { weatherData, locationName, isLoading } = useWeather();
  const loading = isLoading;
  const region = locationName || '위치 찾는 중...';
  const temp = weatherData?.temp || '-';

  // ✨ 2. 기상청 날씨(한국어)를 기존 애니메이션용(영어)으로 변환
  let condition = 'clear';
  const currentCondition = weatherData?.condition || '';
  if (currentCondition.includes('비')) condition = 'rain';
  else if (currentCondition.includes('눈')) condition = 'snow';

  // ✨ 3. 아이콘은 기상청 데이터에서 똑똑하게 바로 가져옴
  let weatherIcon = weatherData?.icon || '☀️ ';

  // ✨ 4. 미세먼지 (기상청 단기예보에는 없으므로 에러 방지용 null 처리)
  let dust = null; 
  let dustColorClass = '';
  let overlayClass = condition;

  // 🚨 [여기에 임시 코드 작성!] 🚨
  // 아래 주석(//)을 풀고 원하는 날씨로 바꿔치기 해보세요. 확인 후엔 다시 주석 처리하거나 지우면 됩니다!
  
  // condition = 'rain'; weatherIcon = '☔ ';  // 👈 비 테스트
  // condition = 'snow'; weatherIcon = '❄️ ';  // 👈 눈 테스트
  // condition = 'dust'; weatherIcon = '😷 ';  // 👈 미세먼지 테스트

  
  // ✨ 최종 날씨 글자
  const weatherDisplayString = `[${region}] ${weatherIcon}${temp}°C`;

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

      {/* 날씨 텍스트 (색상 수치 추가!) */}
      {!loading && region && temp !== null && (
        <div className="absolute top-0 left-1 flex items-center z-30">
          <span className={`text-xs font-bold tracking-tight ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {weatherDisplayString}
            {/* 미세먼지가 맑음이 아닐 때만 수치 띄우기 */}
           {dust && (condition !== 'clear' || dust.includes('나쁨')) && (
                <>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className={`${dustColorClass}`}>{dust}</span>
                </>
            )}
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

       /* ✨ 수정: 좌우 여백을 화면 안에 가두고, 마스크 그라데이션을 부드럽게 조정 */
       .weather-overlay {
          position: absolute; 
          top: -40px; /* 너무 위로 가지 않게 조절 */
          bottom: -20px;
          left: 0; right: 0; /* ✨ 가로 스크롤 방지! 화면에 딱 맞춤 */
          pointer-events: none; 
          overflow: hidden;
          z-index: 0;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
        }

       /* ☔ 비: 빗줄기(ㅣ) 자체를 35도( / )로 물리적으로 꺾어버림! */
        .weather-rain {
          background-image: none !important; /* 기존 직각 비 삭제 */
          animation: none !important;
        }
        
        .weather-rain::before {
          content: '';
          position: absolute;
          top: -50px; bottom: -50px; 
          left: -50px; right: -50px; /* 꺾었을 때 틈 안 보이게 넓게 덮음 */
          transform: skewX(-35deg); /* ✨ 핵심: 빗줄기(ㅣ) 자체를 / 방향으로 35도 비틀기! */

           background-image: 
            /* 1번 빗줄기: 아주 은은하게 파란빛이 도는 색상 */
            radial-gradient(1.5px 35px at 30px 20px, rgba(200, 200, 200, 0.6), transparent),
            /* 2번 빗줄기: 살짝 더 투명한 연파랑 */
            radial-gradient(1.8px 30px at 100px 100px, rgba(200, 200, 200, 0.6), transparent);
          /* 3번: 멀리서 떨어지는 아주 얇고 투명한 빗방울 (입체감 추가!) */
            radial-gradient(0.8px 45px at 150px 50px, rgba(150, 200, 255, 0.4), transparent);

            
          /* 빗방울 숫자가 줄었으니 밀도를 조절해서 너무 푱 비어 보이지 않게 사이즈 살짝 조정 */
          background-size: 140px 250px;
          animation: rainFall 0.7s linear infinite; /* 천천히 운치 있게 */
        }

        @keyframes rainFall {
          0% { background-position: 0px 0px; }
          /* 틀 자체가 기울어져 있어서, 위에서 아래로만 내려도 / 방향으로 완벽하게 떨어집니다! */
          100% { background-position: 0px 250px; } 
        }

      /* ❄️ 함박눈: 몽글몽글한 솜사탕 질감 + 크기 다양화 + 하얀 배경 생존용 얇은 음영 */
        .weather-snow {
          background-image: 
            /* 1. 왕방울 함박눈 (가장자리를 솜털처럼 부드럽게 흩뿌림) */
            radial-gradient(8px 8px at 30px 40px, rgba(255,255,255,1) 80%, rgba(255,255,255,0.4) 80%, transparent 100%),
            /* 2. 중간 눈송이 */
            radial-gradient(5px 5px at 110px 120px, rgba(255,255,255,1) 70%, rgba(255,255,255,0.6) 90%, transparent 100%),
            /* 3. 저 멀리 내리는 작은 눈송이 (원근감 살리기) */
            radial-gradient(3px 3px at 190px 60px, rgba(255,255,255,1) 80%, transparent 100%),
            /* 4. 또 다른 왕방울 함박눈 */
            radial-gradient(7px 7px at 250px 180px, rgba(255,255,255,1) 70%, rgba(255,255,255,0.3) 90%, transparent 100%),
            /* 5. 화면이 비어 보이지 않게 중간 눈송이 하나 더! */
            radial-gradient(4.5px 4.5px at 70px 210px, rgba(255,255,255,1) 60%, transparent 100%);
          
          background-size: 300px 250px; 
          /* 함박눈은 무게감이 있어서 살짝 더 느리고 묵직하게 떨어집니다 (3.5초) */
          animation: snowFall 3.5s linear infinite;
          
         filter: drop-shadow(0px 0px 0.5px rgba(0, 0, 0, 0.5));
        }

        @keyframes snowFall {
          0% { background-position: 0px 0px; }
          /* 무한 루프의 마법: 위에서 아래로 끊김 없이 스르륵 */
          100% { background-position: 0px 250px; } 
        }

        /* 미세먼지 효과 최적화: 블러 필터 빼고 알갱이 갯수 차별화 */

        /* 1. 보통 (알갱이 2개) */
        .weather-dust-normal {
          background-color: rgba(200, 180, 150, 0.05); /* 아주 옅은 배경색 */
          background-image: 
            radial-gradient(2px 2px at 40px 50px, rgba(139, 100, 60, 0.6), transparent),
            radial-gradient(2.5px 2.5px at 150px 100px, rgba(150, 110, 70, 0.5), transparent);
          background-size: 300px 150px;
          animation: dustLoop 4s linear infinite; /* 천천히 둥둥 */
        }

        /* 2. 나쁨 (알갱이 4개) */
        .weather-dust {
          background-color: rgba(200, 180, 150, 0.1);
          background-image: 
            radial-gradient(2.5px 2.5px at 20px 30px, rgba(139, 100, 60, 0.8), transparent),
            radial-gradient(2px 2px at 80px 70px, rgba(150, 110, 70, 0.8), transparent),
            radial-gradient(3px 3px at 180px 40px, rgba(120, 80, 50, 0.7), transparent),
            radial-gradient(2.5px 2.5px at 250px 120px, rgba(160, 120, 80, 0.8), transparent);
          background-size: 300px 150px;
          animation: dustLoop 3s linear infinite;
        }
        
        /* 3. 매우나쁨 (알갱이 6개 + 진함 + 빠름) */
        .weather-dust-severe {
          background-color: rgba(180, 140, 100, 0.2); 
          background-image: 
            radial-gradient(3px 3px at 20px 30px, rgba(100, 60, 30, 0.9), transparent),
            radial-gradient(4px 4px at 80px 80px, rgba(120, 70, 40, 0.9), transparent),
            radial-gradient(3px 3px at 140px 20px, rgba(90, 50, 20, 0.9), transparent),
            radial-gradient(4px 4px at 200px 100px, rgba(110, 60, 30, 0.9), transparent),
            radial-gradient(5px 5px at 260px 50px, rgba(80, 40, 10, 0.9), transparent),
            radial-gradient(3px 3px at 100px 130px, rgba(100, 50, 20, 0.9), transparent);
          background-size: 300px 150px;
          /* 속도를 2초로 줄여서 폭풍처럼 날아가게 만듦 */
          animation: dustLoop 2s linear infinite;
        }

        @keyframes dustLoop {
            0% { background-position: 0px 0px; }
            100% { background-position: -300px 150px; }
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