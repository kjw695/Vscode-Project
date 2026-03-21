import React, { useMemo } from 'react';

const GoalSummaryCards = ({ monthlyProfit, goal, selectedMonth, monthlyEndDay, isDarkMode }) => {
  // 1. 필요한 데이터 추출 (App.js에서 복잡하게 안 넘기고 통째로 받아서 여기서 꺼내 씁니다)
  const current = monthlyProfit?.totalRevenue || 0;
  const totalWorkingDays = monthlyProfit?.totalWorkingDays || 0;

  // 2. 남은 일수 계산 (App.js 코드를 줄이기 위해 자체적으로 여기서 계산!)
  const remainingDays = useMemo(() => {
    if (!selectedMonth || !monthlyEndDay) return 1;
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const endDate = new Date(year, month - 1, monthlyEndDay);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      return diffDays > 0 ? diffDays : 1; 
    } catch (e) {
      return 1;
    }
  }, [selectedMonth, monthlyEndDay]);

  // 3. 하루 수익 및 일일 권장액 계산
  const dailyAverageRevenue = totalWorkingDays > 0 ? Math.round(current / totalWorkingDays) : 0;
  const remainingGoal = Math.max(0, goal - current);
  const recommendedDaily = remainingDays > 0 ? Math.round(remainingGoal / remainingDays) : 0;

  // 4. 디자인 클래스 모음
  const cardClass = `py-3 px-2 rounded-2xl text-center shadow-sm border transition-colors ${
    isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'
  }`;
  const labelClass = "text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium mb-1";
  const valueClass = "text-sm sm:text-base font-bold leading-tight";

  return (
    <div className="grid grid-cols-3 gap-2 w-full mb-3 px-1">
      <div className={cardClass}>
        <div className={labelClass}>출근일</div>
        <div className={`${valueClass} text-gray-900 dark:text-white`}>
          {totalWorkingDays}일
        </div>
      </div>

      <div className={cardClass}>
        <div className={labelClass}>하루 수익</div>
        <div className={`${valueClass} text-blue-600 dark:text-blue-400`}>
          {dailyAverageRevenue.toLocaleString()}원
        </div>
      </div>

      <div className={cardClass}>
        <div className={labelClass}>일일 권장</div>
        <div className={`${valueClass} text-orange-600 dark:text-orange-400`}>
          {recommendedDaily.toLocaleString()}원
        </div>
      </div>
    </div>
  );
};

export default GoalSummaryCards;