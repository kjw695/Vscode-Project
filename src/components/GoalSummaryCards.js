import React, { useMemo } from 'react';
import { PhoneCall } from 'lucide-react';

const GoalSummaryCards = ({ 
  monthlyProfit, goal, selectedMonth, monthlyEndDay, isDarkMode, 
  selectedInsurance, selectedItemsForAverage = [], dashboardConfig = [], previousMonthlyProfit,onTabChange
}) => {
  // --- 데이터 계산 로직 (기존과 동일) ---
  const current = monthlyProfit?.totalRevenue || 0;
  const totalWorkingDays = monthlyProfit?.totalWorkingDays || 0;
  const displayMonth = useMemo(() => {
    if (!selectedMonth) return new Date().getMonth() + 1;
    const [, monthStr] = selectedMonth.split('-');
    return parseInt(monthStr, 10);
  }, [selectedMonth]);
  const totalVolume = useMemo(() => {
    if (!monthlyProfit?.revenueDetails) return 0;
    const itemsToSum = selectedItemsForAverage || [];
    return itemsToSum.reduce((acc, itemName) => {
      const itemData = monthlyProfit.revenueDetails[itemName];
      return acc + (itemData ? Number(itemData.count || 0) : 0);
    }, 0);
  }, [monthlyProfit, selectedItemsForAverage]);
  const averageVolume = totalWorkingDays > 0 ? Math.round(totalVolume / totalWorkingDays) : 0;
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
  const prevCurrent = previousMonthlyProfit?.totalRevenue || 0;
  const compareDiff = current - prevCurrent;

  // 카드 디자인 맵핑
 const cardDataMap = {
        revenue: { value: `${current.toLocaleString()}원`, colorClass: "text-yellow-600 dark:text-yellow-400" },
        insurance: { 
            value: (selectedInsurance && selectedInsurance.phone) ? (
                <a href={`tel:${selectedInsurance.phone}`} className="flex items-center justify-center gap-2 text-blue-500 hover:text-blue-600 active:scale-95 transition-transform">
                    <PhoneCall className="w-[1em] h-[1em] animate-pulse" />
                    {selectedInsurance.name.split('(')[0]}
                </a>
            ) : (
                // ✨ [수정] 미설정 시 클릭하면 '더보기(more)' 탭 등 설정 화면으로 이동하게 만듭니다!
               <button 
                    onClick={() => onTabChange && onTabChange('insurance')} 
                    className="text-gray-400 text-[0.8em] underline decoration-dotted hover:text-gray-500 active:scale-95"
                >
                    설정하기
                </button>
            ), 
            colorClass: "" 
        },
      workDays: { value: `${totalWorkingDays}일`, colorClass: "text-gray-900 dark:text-white" },
      totalVolume: { value: `${totalVolume.toLocaleString()}개`, colorClass: "text-purple-600 dark:text-purple-400" },
      avgVolume: { value: `${averageVolume}개`, colorClass: "text-green-600 dark:text-green-500" },
      dailyAvg: { value: `${dailyAverageRevenue.toLocaleString()}원`, colorClass: "text-blue-600 dark:text-blue-400" },
      recommended: { value: `${recommendedDaily.toLocaleString()}원`, colorClass: "text-orange-600 dark:text-orange-400" },
      remainingWorkDays: { value: `${remainingDays}일`, colorClass: "text-pink-600 dark:text-pink-400" },
      compareLastMonth: { 
          value: compareDiff > 0 ? `+${compareDiff.toLocaleString()}원` : `${compareDiff.toLocaleString()}원`, 
          colorClass: compareDiff > 0 ? "text-red-500" : (compareDiff < 0 ? "text-blue-500" : "text-gray-500") 
      },
  };

  const visibleCards = dashboardConfig.filter(item => item.isVisible);

  return (
    <div className="relative w-full mb-1 px-1 pt-2"> 
        <div 
            className="grid grid-cols-4 gap-[2vw] w-full"
            style={{ gridAutoRows: 'minmax(30px, auto)' }} 
        >
            {visibleCards.map((item) => {
                const cardInfo = cardDataMap[item.id];
                if (!cardInfo) return null;
                
                let displayLabel = item.label;
                if (item.id === 'revenue') displayLabel = `${displayMonth}월 매출`;

                // ✨ [레이아웃 결정] 3칸 이상이면 가로(row), 2칸 이하면 세로(col)
                const isHorizontal = item.w >= 3;

                // ✨ [폰트 크기 조절] 가로 배치일 때는 글씨를 더 공격적으로 키웁니다!
                let dynamicLabelClass = "text-[clamp(10px,2.8vw,14px)]"; 
                let dynamicValueClass = "text-[clamp(13px,4.5vw,22px)]";

                if (item.w === 4) {
                    dynamicLabelClass = "text-[clamp(16px,5.5vw,26px)]"; 
                    dynamicValueClass = "text-[clamp(26px,9vw,52px)]";
                } else if (item.w === 3) {
                    dynamicLabelClass = "text-[clamp(14px,4.5vw,22px)]"; 
                    dynamicValueClass = "text-[clamp(22px,7vw,40px)]";
                } else if (item.w === 2) {
                    dynamicLabelClass = "text-[clamp(12px,3.5vw,16px)]";
                    dynamicValueClass = "text-[clamp(18px,5.5vw,28px)]";
                }

               return (
                    <div 
                        key={item.id} 
                        className={`rounded-2xl text-center shadow-sm border flex transition-all p-2
                            ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'}
                            ${isHorizontal ? 'flex-row items-center justify-center gap-4' : 'flex-col items-center justify-center gap-1.5'}
                        `}
                        style={{
                            gridColumn: `${item.x + 1} / span ${item.w}`,
                            gridRow: `${item.y + 1} / span ${item.h}`,
                        }}
                    >
                        <div className={`${dynamicLabelClass} text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap leading-none`}>
                            {displayLabel}
                        </div>
                        <div className={`${dynamicValueClass} font-bold leading-none whitespace-nowrap tracking-tighter ${cardInfo.colorClass}`}>
                            {cardInfo.value}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default GoalSummaryCards;