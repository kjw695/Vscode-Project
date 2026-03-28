import React, { useMemo } from 'react';
import { PhoneCall } from 'lucide-react';

const GoalSummaryCards = ({ 
  monthlyProfit, 
  goal, 
  selectedMonth, 
  monthlyEndDay, 
  isDarkMode, 
  selectedInsurance,
  selectedItemsForAverage = [] ,
  dashboardConfig = []
}) => {
  const current = monthlyProfit?.totalRevenue || 0;
  const totalWorkingDays = monthlyProfit?.totalWorkingDays || 0;

  const displayMonth = useMemo(() => {
    if (!selectedMonth) return new Date().getMonth() + 1;
    const [, monthStr] = selectedMonth.split('-');
    return parseInt(monthStr, 10);
  }, [selectedMonth]);

  // ✨ 1. 총 물량 계산 (평균 물량 설정에서 고른 항목들만 더하기!)
  const totalVolume = useMemo(() => {
    if (!monthlyProfit?.revenueDetails) return 0;
    const itemsToSum = selectedItemsForAverage || [];
    return itemsToSum.reduce((acc, itemName) => {
      const itemData = monthlyProfit.revenueDetails[itemName];
      return acc + (itemData ? Number(itemData.count || 0) : 0);
    }, 0);
  }, [monthlyProfit, selectedItemsForAverage]);

  // ✨ 2. 평균 물량 계산 (총 물량 / 출근일)
  const averageVolume = totalWorkingDays > 0 ? Math.round(totalVolume / totalWorkingDays) : 0;

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
  
const valueClass = "text-[clamp(11px,3.8vw,17px)] font-bold leading-none whitespace-nowrap tracking-tighter";

  // ✨ [여기서부터 추가] 각 카드의 데이터와 텍스트 색상을 미리 매칭해 둡니다.
  // ✨ 핵심 1: 각 카드의 데이터와 텍스트 색상을 미리 매칭해 둡니다.
  const cardDataMap = {
      workDays: {
          value: `${totalWorkingDays}일`,
          colorClass: "text-gray-900 dark:text-white"
      },
      totalVolume: { // ✨ 총 물량 카드 디자인 추가 (보라색 계열)
          value: `${totalVolume.toLocaleString()}개`,
          colorClass: "text-purple-600 dark:text-purple-400" 
      },
      avgVolume: {
          value: `${averageVolume}개`,
          colorClass: "text-green-600 dark:text-green-500"
      },
      dailyAvg: {
          value: `${dailyAverageRevenue.toLocaleString()}원`,
          colorClass: "text-blue-600 dark:text-blue-400"
      },
      recommended: {
          value: `${recommendedDaily.toLocaleString()}원`,
          colorClass: "text-orange-600 dark:text-orange-400"
      }
  };

  // 설정에서 보이기(isVisible)가 켜져있는 항목만 걸러냅니다.
  const visibleCards = dashboardConfig.filter(item => item.isVisible);
  // ✨ [여기까지 추가]

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

     {/* ✨ [수정할 내용] 설정된 카드 개수에 맞춰 자동으로 1~4칸으로 조절되게 변경! */}
      <div className={`grid gap-[1vw] w-full ${
          visibleCards.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : 
          visibleCards.length === 2 ? 'grid-cols-2' : 
          visibleCards.length === 3 ? 'grid-cols-3' : 
          'grid-cols-4'
      }`}>
        
        {/* ✨ 배열에 담긴 순서대로 카드를 화면에 뿌려줍니다. */}
        {visibleCards.map((item) => {
            const cardInfo = cardDataMap[item.id];
            if (!cardInfo) return null; 
            
            return (
                <div key={item.id} className={cardClass}>
                    <div className={labelClass}>{item.label}</div>
                    <div className={`${valueClass} ${cardInfo.colorClass}`}>
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