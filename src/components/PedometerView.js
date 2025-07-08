// src/components/PedometerView.js

import React from 'react';

// 걸음 수에 따른 예상치 계산 (단순 참고용)
const stepToKm = (steps) => (steps * 0.0007).toFixed(2);
const stepToKcal = (steps) => (steps * 0.04).toFixed(0);

function PedometerView({ dailySteps, stepGoal, isDarkMode }) {
  const progress = Math.min((dailySteps / stepGoal) * 100, 100);

  return (
    <div className="w-full max-w-4xl text-center">
      {/* 주간 걸음 수 차트 (추후 구현) */}
      <div className="mb-8 p-4 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed dark:border-gray-700 rounded-lg">
        주간 걸음 수 차트는 준비중입니다.
      </div>
      
      {/* 오늘의 걸음 수 및 진행률 */}
      <div className={`p-6 rounded-2xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <h2 className="text-6xl font-bold text-white mb-4">
          {dailySteps.toLocaleString()} <span className="text-4xl font-medium text-gray-400">걸음</span>
        </h2>

        {/* 진행률 바 */}
        <div className="relative h-4 w-full bg-gray-600 rounded-full">
          <div 
            className="absolute top-0 left-0 h-4 bg-green-500 rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
          <span>0</span>
          <span>목표: {stepGoal.toLocaleString()}</span>
        </div>

        {/* 추가 정보 (거리, 칼로리, 층수) */}
        <div className="flex justify-around mt-8 text-white">
          <div>
            <p className="text-xl font-semibold">{stepToKm(dailySteps)} <span className="text-sm text-gray-400">km</span></p>
          </div>
          <div className="border-l border-gray-600 h-8"></div>
          <div>
            <p className="text-xl font-semibold">{stepToKcal(dailySteps)} <span className="text-sm text-gray-400">kcal</span></p>
          </div>
          <div className="border-l border-gray-600 h-8"></div>
          <div>
            <p className="text-xl font-semibold">0 <span className="text-sm text-gray-400">층</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PedometerView;