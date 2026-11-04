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

  // 금액은 만원 단위로 간결하게 표시해 자릿수에 따라 글자가 작아지는 현상을 방지합니다.
  const formatCompactWon = (amount) => {
    const numericAmount = Number(amount);
    const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
    const absoluteAmount = Math.abs(safeAmount);

    if (absoluteAmount < 10000) {
      return `${Math.round(safeAmount).toLocaleString('ko-KR')}원`;
    }

    const manAmount = Math.round(absoluteAmount / 1000) / 10;
    const formattedMan = manAmount.toLocaleString('ko-KR', {
      maximumFractionDigits: 1
    });

    return `${safeAmount < 0 ? '-' : ''}${formattedMan}만원`;
  };

  // 카드 디자인 맵핑
const cardDataMap = {
        revenue: { value: formatCompactWon(current), colorClass: "text-yellow-600 dark:text-yellow-400" },
        estimatedSalary: { value: formatCompactWon(estimatedSalary), colorClass: "text-emerald-600 dark:text-emerald-500" },

monthlyHolidays: { value: `${monthlyHolidaysCount}일`, colorClass: "text-indigo-600 dark:text-indigo-400" },

   insurance: { 
          value: (selectedInsurance && selectedInsurance.phone) ? (
              <a 
                  href={`tel:${selectedInsurance.phone.replace(/-/g, '')}`} 
                  className="flex items-center justify-center w-full px-1 gap-1 active:scale-95 transition-transform overflow-hidden"
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
                  className="flex items-center justify-center w-full text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 active:scale-95 whitespace-nowrap tracking-tighter"
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
      dailyAvg: { value: formatCompactWon(dailyAverageRevenue), colorClass: "text-blue-600 dark:text-blue-400" },
      recommended: { value: formatCompactWon(recommendedDaily), colorClass: "text-orange-600 dark:text-orange-400" },
      remainingWorkDays: { value: `${netWorkingDays}일`, colorClass: "text-pink-600 dark:text-pink-400" }, // ✨ 해결
      compareLastMonth: {
          value: compareDiff > 0 ? `+${formatCompactWon(compareDiff)}` : formatCompactWon(compareDiff), 
          colorClass: compareDiff > 0 ? "text-red-500" : (compareDiff < 0 ? "text-blue-500" : "text-gray-500") 
      },
  };

  const visibleCards = dashboardConfig.filter(item => item.isVisible);

  return (
    <div className="relative w-full mb-1 px-0.5 pt-0.5">
        <div
            className="grid grid-cols-4 gap-1 w-full"
            style={{ gridAutoRows: 'minmax(30px, auto)' }}
        >
            {visibleCards.map((item) => {
                const cardInfo = cardDataMap[item.id];
                if (!cardInfo) return null;

                let displayLabel = item.label;
                if (item.id === 'revenue') displayLabel = `${displayMonth}월 매출`;

                const cardWidth = Math.max(1, Math.min(4, Number(item.w) || 1));

                // 폭별 글자 크기는 카드 폭에 반응하되, 값의 자릿수에는 영향받지 않게 합니다.
                let baseFontSizeClass = "text-[13px]";
                let paddingClass = "px-1.5 py-1";
                let labelFontSize = "10px";
                let valueFontSize = "clamp(13px, 17cqw, 17px)";

                if (cardWidth === 2) {
                    baseFontSizeClass = "text-[15px]";
                    paddingClass = "px-2 py-1.5";
                    labelFontSize = "11px";
                    valueFontSize = "clamp(15px, 10cqw, 20px)";
                } else if (cardWidth === 3) {
                    baseFontSizeClass = "text-[17px]";
                    paddingClass = "px-2.5 py-2";
                    labelFontSize = "12px";
                    valueFontSize = "clamp(17px, 8.5cqw, 24px)";
                } else if (cardWidth === 4) {
                    baseFontSizeClass = "text-[19px]";
                    paddingClass = "px-3 py-2";
                    labelFontSize = "13px";
                    valueFontSize = "clamp(19px, 7.2cqw, 27px)";
                }

                const isObjectValue = typeof cardInfo.value === 'object';
                const valueColorClass = item.id === 'compareLastMonth'
                    ? cardInfo.colorClass
                    : 'text-slate-900 dark:text-slate-50';

                return (
                    <div
                        key={item.id}
                        className={`[container-type:inline-size] min-w-0 overflow-hidden rounded-[15px] border flex flex-col items-start justify-center gap-0.5 w-full h-full transition-colors duration-150
                            ${paddingClass} ${baseFontSizeClass}
                            ${isDarkMode
                                ? 'bg-slate-800/85 border-slate-700/70'
                                : 'bg-white border-slate-200/80'}
                            shadow-[0_1px_4px_rgba(15,23,42,0.035)]
                        `}
                        style={{
                            gridColumn: `${Number(item.x) + 1} / span ${cardWidth}`,
                            gridRow: `${Number(item.y) + 1} / span ${Number(item.h)}`,
                            // 작은 파츠 높이도 소폭 줄여 위아래 빈 공간을 줄이되, 반응형 크기는 유지합니다.
                            ...(cardWidth < 3
                                ? { height: 'clamp(56px, calc(54px + 1.5vw), 64px)', alignSelf: 'start' }
                                : {}),
                        }}
                    >
                        <div
                            className="min-w-0 w-full text-left text-slate-500 dark:text-slate-400 font-medium leading-none tracking-tight whitespace-nowrap"
                            style={{ fontSize: labelFontSize }}
                        >
                            {displayLabel}
                        </div>

                        <div
                            className={`min-w-0 w-full font-semibold leading-none tracking-tight whitespace-nowrap flex justify-start text-left ${valueColorClass}`}
                            style={{
                                // 금액 자릿수로 축소하지 않고, 파츠 너비에 따라 글자 크기를 반응형으로 조절합니다.
                                fontSize: isObjectValue ? '1em' : valueFontSize
                            }}
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