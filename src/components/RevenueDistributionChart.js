import React, { useMemo } from 'react';

// 차트 색상 팔레트 (항목이 늘어날 경우 순환 사용)
const COLORS = [
    'bg-cyan-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 
    'bg-yellow-500', 'bg-orange-500', 'bg-blue-500', 'bg-red-500',
    'bg-indigo-500', 'bg-teal-500'
];

const RevenueDistributionChart = ({ monthlyProfit, entries, incomeConfig }) => {
    // 1. 시스템 언어 감지 (Hook은 최상단에 위치)
    const isKo = useMemo(() => {
        if (typeof navigator === 'undefined') return true;
        return (navigator.language || navigator.userLanguage || 'ko').toLowerCase().includes('ko');
    }, []);

    const t = {
        title: isKo ? "총 매출 현황" : "Revenue Distribution",
        unit: isKo ? "원" : "",
        empty: isKo ? "데이터 없음" : "No Data",
        others: isKo ? "기타" : "Others"
    };

    // 2. 동적 데이터 계산 로직 (Hook 위치 수정: return보다 먼저 실행)
    const chartItems = useMemo(() => {
        // [안전장치] 데이터가 없으면 빈 배열 반환
        if (!monthlyProfit) return [];

        // A. 사용할 엔트리 확보
        const targetEntries = entries || []; 
        if (targetEntries.length === 0) return [];

        // B. 설정(Config)이 없으면 기본 고정값 사용 (안전장치)
        const safeIncomeConfig = Array.isArray(incomeConfig) ? incomeConfig : [];
        
        const activeConfig = safeIncomeConfig.length > 0 
            ? safeIncomeConfig.filter(item => item.isVisible) 
            : [
                { key: 'deliveryCount', label: isKo ? '배송' : 'Delivery' },
                { key: 'deliveryInterruptionAmount', label: isKo ? '중단' : 'Stop' },
                { key: 'returnCount', label: isKo ? '반품' : 'Return' },
                { key: 'freshBagCount', label: isKo ? '프레시백' : 'Fresh Bag' }
              ];

        // C. 항목별 합계 계산
        const sums = {};
        
        targetEntries.forEach(entry => {
            const unitPrice = Number(entry.unitPrice) || 0;

            activeConfig.forEach(configItem => {
                const key = configItem.key;
                let amount = 0;

                // --- 1) 레거시(Preset) 항목 계산 로직 ---
                if (key === 'deliveryCount') amount = unitPrice * (Number(entry.deliveryCount) || 0);
                else if (key === 'returnCount') amount = unitPrice * (Number(entry.returnCount) || 0);
                else if (key === 'deliveryInterruptionAmount') amount = unitPrice * (Number(entry.deliveryInterruptionAmount) || 0);
                else if (key === 'freshBagCount') amount = (Number(entry.freshBagCount) || 0) * 100;
                
                // --- 2) 커스텀(Custom) 항목 계산 로직 ---
                else if (entry.customItems && Array.isArray(entry.customItems)) {
                    const foundItem = entry.customItems.find(item => item.key === key || item.name === configItem.label); 
                    
                    if (foundItem) {
                        const val = parseFloat(foundItem.amount) || 0;
                        const count = parseFloat(foundItem.count) || 1;
                        const itemUnitPrice = foundItem.unitPrice !== undefined && foundItem.unitPrice !== null && foundItem.unitPrice !== '' 
                                            ? parseFloat(foundItem.unitPrice) 
                                            : null;

                        if (itemUnitPrice !== null && !isNaN(itemUnitPrice)) {
                             amount = itemUnitPrice * count;
                        } else {
                             amount = val;
                        }
                    }
                }

                if (amount > 0) {
                    sums[key] = (sums[key] || 0) + amount;
                }
            });
        });

        // D. 차트 데이터 포맷팅
        const totalRevenue = Object.values(sums).reduce((a, b) => a + b, 0);
        if (totalRevenue === 0) return [];

        let items = activeConfig.map((configItem, index) => {
            const value = sums[configItem.key] || 0;
            if (value <= 0) return null;

            const rawPercent = (value / totalRevenue) * 100;
            return {
                key: configItem.key,
                label: configItem.label,
                color: COLORS[index % COLORS.length], 
                value,
                percent: Math.floor(rawPercent),
                remainder: rawPercent - Math.floor(rawPercent)
            };
        }).filter(item => item !== null);

        // E. 100% 퍼센트 보정
        const currentSum = items.reduce((acc, item) => acc + item.percent, 0);
        const missing = 100 - currentSum;
        
        if (missing > 0) {
            items.sort((a, b) => b.remainder - a.remainder);
            for (let i = 0; i < missing; i++) {
                if (items[i]) items[i].percent += 1;
            }
            items.sort((a, b) => b.value - a.value); 
        }

        return items;
    }, [monthlyProfit, entries, incomeConfig, isKo]);

    // 3. 총 매출액 (안전하게 접근)
    const totalDisplayRevenue = monthlyProfit?.totalRevenue || 0;

    // 🔥 [수정됨] 조건부 렌더링을 Hook 선언 이후로 이동 (Rules of Hooks 준수)
    if (!monthlyProfit) return null;

    // 매출 0원일 때 UI
    if (totalDisplayRevenue === 0 || chartItems.length === 0) {
        return (
            <div className="w-full my-2 py-3 px-4 rounded-xl shadow-sm bg-white dark:bg-gray-800">
                <div className="mb-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-0.5">{t.title}</span>
                    <div className="text-lg font-bold text-gray-900 dark:text-white leading-none">0{t.unit}</div>
                </div>
                <div className="w-full h-5 rounded-full bg-gray-100 dark:bg-gray-700"></div>
            </div>
        );
    }

    return (
        <div className="w-full my-2 py-3 px-4 rounded-xl shadow-sm bg-white dark:bg-gray-800">
            
            {/* 상단: 제목 & 총액 */}
            <div className="mb-2">
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-0.5">
                    {t.title}
                </span>
                <div className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                    {totalDisplayRevenue.toLocaleString()}{t.unit}
                </div>
            </div>

            {/* 메인: 막대 그래프 (Stacked Bar) */}
            <div className="flex w-full h-5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 mb-2.5">
                {chartItems.map((item) => (
                    <div 
                        key={item.key}
                        className={`${item.color} h-full transition-all duration-500 relative group`}
                        style={{ width: `${item.percent}%` }}
                    >
                    </div>
                ))}
            </div>

            {/* 하단: 범례 (Flex Wrap으로 줄바꿈 허용하여 모든 항목 표시) */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 w-full">
                {chartItems.map((item) => (
                    <div key={item.key} className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.color} flex-shrink-0`}></div>
                        <div className="flex items-baseline gap-1 text-gray-500 dark:text-gray-400">
                            <span className="text-[11px] font-medium whitespace-nowrap">
                                {item.label}
                            </span>
                            <span className="text-[10px] opacity-80">
                                {item.percent}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RevenueDistributionChart;