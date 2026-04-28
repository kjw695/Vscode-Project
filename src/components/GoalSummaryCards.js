import React, { useMemo } from 'react';

const GoalSummaryCards = ({ 
  entries = [],monthlyProfit, goal, selectedMonth, monthlyEndDay, 
  monthlyStartDay, // ✨ 추가: 휴일 계산을 위해 시작일을 받아옵니다.
  isDarkMode, 
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

 // ✨ 1. 남은 휴일 수 및 예상 월급 계산 (미래)
  const futureHolidays = useMemo(() => {
    if (!entries || !Array.isArray(entries) || entries.length === 0) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return entries.filter(entry => {
        // 💡 [안전장치 1] date가 글자가 아니거나 아예 이상하면 패스해서 팅김을 막습니다.
        if (!entry || !entry.date || typeof entry.date !== 'string') return false;
        const parts = entry.date.split('-');
        if (parts.length !== 3) return false;

        const [y, m, d] = parts.map(Number);
        const entryDate = new Date(y, m - 1, d);
        
        // 💡 [안전장치 2] memo나 customItems가 이상한 형태여도 에러가 나지 않게 방어합니다.
        const hasHolidayMemo = entry.memo && typeof entry.memo === 'string' && entry.memo.includes('휴무');
        const isDayOffType = entry.isDayOff === true;
        const hasDayOffCustomItem = entry.customItems && Array.isArray(entry.customItems) && entry.customItems.some(item => item.key === 'dayOff' || item.key === '휴무');
        
        const isHoliday = hasHolidayMemo || isDayOffType || hasDayOffCustomItem;
        
        return entryDate >= today && isHoliday;
    }).length;
  }, [entries]);

  const netWorkingDays = Math.max(0, remainingDays - futureHolidays);
  const estimatedSalary = current + (dailyAverageRevenue * netWorkingDays);

  // ✨ 2. 이번 달 장부 기간 내 전체 휴무일수 계산 (휴무 카드용)
  const monthlyHolidaysCount = useMemo(() => {
    if (!entries || !Array.isArray(entries) || entries.length === 0 || !selectedMonth || typeof selectedMonth !== 'string') return 0;
    
    const startDay = Number(monthlyStartDay) || 26; 
    const endDay = Number(monthlyEndDay) || 25;

    const parts = selectedMonth.split('-');
    if (parts.length !== 2) return 0;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    
    let periodStartDate, periodEndDate;
    if (startDay > endDay) { 
        periodStartDate = new Date(year, month - 2, startDay); 
        periodEndDate = new Date(year, month - 1, endDay, 23, 59, 59); 
    } else { 
        periodStartDate = new Date(year, month - 1, startDay); 
        periodEndDate = new Date(year, month - 1, endDay, 23, 59, 59); 
    }

    // 🚨 안드로이드 팅김의 주범이었던 추적기(console.log)를 모두 깔끔하게 철거했습니다!
    const holidayEntries = entries.filter(entry => {
        // 💡 [안전장치 3] 여기서도 에러 폭탄(이상한 데이터)을 전부 걸러냅니다.
        if (!entry || !entry.date || typeof entry.date !== 'string') return false;
        const dParts = entry.date.split('-');
        if (dParts.length !== 3) return false;

        const [eYear, eMonth, eDay] = dParts.map(Number);
        const entryDate = new Date(eYear, eMonth - 1, eDay, 12, 0, 0); 
        
        const isWithinPeriod = entryDate >= periodStartDate && entryDate <= periodEndDate;
        
        const hasHolidayMemo = entry.memo && typeof entry.memo === 'string' && entry.memo.includes('휴무');
        const isDayOffType = entry.isDayOff === true;
        const hasDayOffCustomItem = entry.customItems && Array.isArray(entry.customItems) && entry.customItems.some(item => item.key === 'dayOff' || item.key === '휴무');
        
        const isHoliday = hasHolidayMemo || isDayOffType || hasDayOffCustomItem;

        return isWithinPeriod && isHoliday;
    });

    return holidayEntries.length;
  }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay]);

  // 카드 디자인 맵핑
const cardDataMap = {
        revenue: { value: `${current.toLocaleString()}원`, colorClass: "text-yellow-600 dark:text-yellow-400" },
        estimatedSalary: { value: `${estimatedSalary.toLocaleString()}원`, colorClass: "text-emerald-600 dark:text-emerald-500" },

monthlyHolidays: { value: `${monthlyHolidaysCount}일`, colorClass: "text-indigo-600 dark:text-indigo-400" },

   insurance: { 
          value: (selectedInsurance && selectedInsurance.phone) ? (
              <a 
                  href={`tel:${selectedInsurance.phone.replace(/-/g, '')}`} 
                  className="flex items-center justify-center w-full h-full px-1 gap-1 active:scale-95 transition-transform overflow-hidden"
              >
                  {/* ✨ truncate를 삭제하고, 사장님 지시대로 whitespace-nowrap(줄바꿈금지)만 남김 */}
                  <div 
                      className="font-bold text-gray-800 dark:text-gray-200 text-center whitespace-nowrap leading-none tracking-tighter"
                      style={{ fontSize: '0.85em' }} 
                  >
                      {selectedInsurance.name.split('(')[0].replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g, '').trim()}
                  </div>
              </a>
          ) : (
             <button 
                  onClick={() => onTabChange && onTabChange('insurance')} 
                  className="flex items-center justify-center w-full h-full text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 active:scale-95 whitespace-nowrap tracking-tighter"
                  style={{ fontSize: '0.8em' }}
              >
                  + 보험사 등록
              </button>
          ), 
          colorClass: "" 
      },


      workDays: { value: `${totalWorkingDays}일`, colorClass: "text-gray-900 dark:text-white" },
      totalVolume: { value: `${totalVolume.toLocaleString()}개`, colorClass: "text-purple-600 dark:text-purple-400" },
      avgVolume: { value: `${averageVolume}개`, colorClass: "text-green-600 dark:text-green-500" },
      dailyAvg: { value: `${dailyAverageRevenue.toLocaleString()}원`, colorClass: "text-blue-600 dark:text-blue-400" },
      recommended: { value: `${recommendedDaily.toLocaleString()}원`, colorClass: "text-orange-600 dark:text-orange-400" },
      remainingWorkDays: { value: `${netWorkingDays}일`, colorClass: "text-pink-600 dark:text-pink-400" }, // ✨ 해결
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

           // ✨ [진짜 박스 반응형 - 황금 비율 적용!]
                let baseFontSizeClass = "text-[clamp(1px,2.5vw,16px)]"; // ✨ 1.6vw -> 2.5vw로 키워서 상자에 꽉 차게 버팀
              // ✨ 1. [여백 다이어트] p-1을 px(좌우)와 py(상하)로 쪼개서 좌우 여백을 극한으로 줄였습니다.
                let paddingClass = "px-0.5 py-1.5 sm:p-1.5"; 

                if (item.w === 4) {
                    baseFontSizeClass = "text-[clamp(1px,6vw,28px)]"; 
                    paddingClass = "px-4 py-3 sm:p-5"; 
                } else if (item.w === 3) {
                    baseFontSizeClass = "text-[clamp(1px,4.5vw,24px)]"; 
                    paddingClass = "px-3 py-2.5 sm:p-4"; 
                } else if (item.w === 2) {
                    baseFontSizeClass = "text-[clamp(1px,3.5vw,20px)]"; 
                    paddingClass = "px-1 py-2 sm:p-2"; 
                }

             return (

                   <div 
                        key={item.id} 
                        // ✨ 부모 상자 최상단에 baseFontSizeClass를 부여합니다.
                        // ... 중략 ...
className={`rounded-xl sm:rounded-2xl text-center shadow-sm border flex transition-all w-full h-full overflow-hidden
    ${paddingClass} ${baseFontSizeClass} 
    ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'}
    {/* ✨ justify-between을 지우고 다시 justify-center로 복구! 간격(gap)만 살짝 넉넉하게 줍니다 */}
    ${isHorizontal ? 'flex-row items-center justify-center gap-4 sm:gap-6' : 'flex-col items-center justify-center gap-1 sm:gap-2'}
`}
                        style={{
                            gridColumn: `${Number(item.x) + 1} / span ${Number(item.w)}`,
                            gridRow: `${Number(item.y) + 1} / span ${Number(item.h)}`,
                        }}
                    >
                        {/* ✨ 1. 라벨(제목): 부모 상자 크기의 80%(0.8em)로 무조건 종속! 절대 잘리지 않음 */}
                        <div 
                            className="w-full text-gray-500 dark:text-gray-400 font-medium leading-tight break-keep"
                            style={{ fontSize: '0.8em' }}
                        >
                            {displayLabel}
                        </div>
                        
                        {/* ✨ 2. 내용(값): 부모 상자 크기의 1.2배(1.2em)로 무조건 종속! 비율 유지 */}
                        <div 
                            className={`w-full font-bold leading-tight tracking-tighter ${cardInfo.colorClass} break-keep`}
                            style={{ fontSize: '1.2em' }}
                        >
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