import React, { useMemo } from 'react';
import { PhoneCall } from 'lucide-react';

const GoalSummaryCards = ({ 
  monthlyProfit, 
  goal, 
  selectedMonth, 
  monthlyEndDay, 
  isDarkMode, 
  selectedInsurance,
  selectedItemsForAverage = [] 
}) => {
  const current = monthlyProfit?.totalRevenue || 0;
  const totalWorkingDays = monthlyProfit?.totalWorkingDays || 0;

  const displayMonth = useMemo(() => {
    if (!selectedMonth) return new Date().getMonth() + 1;
    const [, monthStr] = selectedMonth.split('-');
    return parseInt(monthStr, 10);
  }, [selectedMonth]);

  // 1. 평균 물량 계산 (소수점 제거)
  const averageVolume = useMemo(() => {
    if (!totalWorkingDays || totalWorkingDays === 0 || !monthlyProfit?.revenueDetails) return 0;
    const itemsToSum = selectedItemsForAverage || [];
    const totalVol = itemsToSum.reduce((acc, itemName) => {
      const itemData = monthlyProfit.revenueDetails[itemName];
      return acc + (itemData ? Number(itemData.count || 0) : 0);
    }, 0);
    return Math.round(totalVol / totalWorkingDays);
  }, [monthlyProfit, totalWorkingDays, selectedItemsForAverage]);

  // 2. 남은 일수 및 권장 금액 계산
  const dailyAverageRevenue = totalWorkingDays > 0 ? Math.round(current / totalWorkingDays) : 0;
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
    } catch (e) { return 1; }
  }, [selectedMonth, monthlyEndDay]);

  const remainingGoal = Math.max(0, goal - current);
  const recommendedDaily = remainingDays > 0 ? Math.round(remainingGoal / remainingDays) : 0;

  // ✨ 디자인 수정 포인트: 굵기를 다시 '정상'으로 돌렸습니다.
  const cardClass = `py-3 px-1 rounded-xl text-center shadow-sm border flex flex-col justify-center items-center h-full transition-all ${
    isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'
  }`;
  
  // 🏷️ 라벨: font-bold 대신 font-medium으로 (더보기 메뉴와 동일한 굵기)
  const labelClass = "text-[clamp(9px,2.5vw,12px)] text-gray-500 dark:text-gray-400 font-medium mb-1 whitespace-nowrap tracking-tight";
  
  // 💰 숫자: font-black 대신 font-bold로 (기존의 시원한 굵기)
  const valueClass = "text-[clamp(11px,3.8vw,17px)] font-bold leading-none whitespace-nowrap tracking-tighter";

 return (
    <div className="relative w-full mb-1 px-1 pt-10"> {/* ✨ pt-12를 pt-16으로 늘림 */}
      
      <div className="absolute top-2 left-1 flex items-center gap-1.5">
          <span className={`text-sm sm:text-base font-extrabold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {displayMonth}월 매출
          </span>
          <span className={`text-2xl sm:text-3xl font-black tracking-tighter ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              {current.toLocaleString()}<span className="text-sm sm:text-base font-bold ml-0.5 text-gray-500 dark:text-gray-400">원</span>
          </span>
      </div>

      {selectedInsurance && selectedInsurance.phone && (
        <a 
          href={`tel:${selectedInsurance.phone}`} 
          className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm active:scale-95 transition-transform ${
            isDarkMode ? 'bg-blue-900/40 text-blue-300 border border-blue-800' : 'bg-blue-50 text-blue-600 border border-blue-200'
          }`}
        >
          <PhoneCall size={10} className="animate-pulse" />
          {selectedInsurance.name.split('(')[0]}
        </a>
      )}

      <div className="grid grid-cols-4 gap-[1vw] w-full">
        <div className={cardClass}>
          <div className={labelClass}>출근일</div>
          <div className={`${valueClass} text-gray-900 dark:text-white`}>
            {totalWorkingDays}일
          </div>
        </div>

        <div className={cardClass}>
          <div className={labelClass}>평균 물량</div>
          <div className={`${valueClass} text-green-600 dark:text-green-500`}>
            {averageVolume}개
          </div>
        </div>

        <div className={cardClass}>
          <div className={labelClass}>하루 평균</div>
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
    </div>
  );
};

export default GoalSummaryCards;