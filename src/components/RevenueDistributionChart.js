import React from 'react';

const RevenueDistributionChart = ({ monthlyProfit }) => {
    // [안전장치] 데이터 없으면 숨김
    if (!monthlyProfit) return null;

    // 1. 데이터 준비
    const data = {
        delivery: monthlyProfit.totalDeliveryRevenue || 0,
        stop: monthlyProfit.totalDeliveryInterruptionRevenue || 0,
        return: monthlyProfit.totalReturnRevenue || 0,
        freshBag: monthlyProfit.totalFreshBagRevenue || 0
    };

    const totalRevenue = Object.values(data).reduce((acc, curr) => acc + curr, 0);

    const categories = [
        { key: 'delivery', label: '배송', color: 'bg-cyan-500' },
        { key: 'stop', label: '중단', color: 'bg-purple-500' },
        { key: 'return', label: '반품', color: 'bg-pink-500' },
        { key: 'freshBag', label: '프레시백', color: 'bg-green-500' }
    ];

    // 매출 0원일 때
    if (totalRevenue === 0) {
        return (
            <div className="w-full mt-2 mb-2 py-3 px-4 rounded-xl shadow-sm bg-white dark:bg-gray-800">
                <div className="mb-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-0.5">총 매출 현황</span>
                    <div className="text-lg font-bold text-gray-900 dark:text-white leading-none">0원</div>
                </div>
                <div className="w-full h-5 rounded-full bg-gray-100 dark:bg-gray-700"></div>
            </div>
        );
    }

    // 4. 퍼센트 계산
    let items = categories.map(cat => {
        const value = data[cat.key];
        const rawPercent = (value / totalRevenue) * 100;
        return {
            ...cat,
            value,
            percent: Math.floor(rawPercent), 
            remainder: rawPercent - Math.floor(rawPercent) 
        };
    });

    // 100% 맞추기 로직
    const currentSum = items.reduce((acc, item) => acc + item.percent, 0);
    const missing = 100 - currentSum;
    if (missing > 0) {
        const sortedIndices = items
            .map((item, index) => ({ index, remainder: item.remainder }))
            .sort((a, b) => b.remainder - a.remainder)
            .map(item => item.index);
        for (let i = 0; i < missing; i++) {
            if (items[sortedIndices[i]]) items[sortedIndices[i]].percent += 1;
        }
    }

    return (
        // 🔥 [수정 1] 박스 크기 줄임: py-4 -> py-3, 위아래 마진 최소화
        <div className="w-full my-2 py-3 px-4 rounded-xl shadow-sm bg-white dark:bg-gray-800">
            
            {/* [상단] 제목 & 금액 */}
            <div className="mb-2">
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block mb-0.5">
                    총 매출 현황
                </span>
                <div className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                    {totalRevenue.toLocaleString()}원
                </div>
            </div>

            {/* [메인] 막대 그래프 */}
            <div className="flex w-full h-5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 mb-2.5">
                {items.map((item) => {
                    if (item.value <= 0) return null;
                    return (
                        <div 
                            key={item.key}
                            className={`${item.color} h-full transition-all duration-500`}
                            style={{ width: `${item.percent}%` }}
                        />
                    );
                })}
            </div>

            {/* 🔥 [수정 2] 하단 범례: 한 줄 강제 (flex-nowrap) + 양끝 정렬 (justify-between) */}
            <div className="flex flex-nowrap justify-between items-center w-full">
                {items.map((item) => {
                    // 0%라도 표시는 하고 싶다면 if문 제거, 아니면 유지
                    // 예시 사진처럼 0%도 자리를 차지하게 하려면 아래 if문을 지우세요.
                    // 현재는 0보다 클 때만 표시
                    if (item.value <= 0) return null; 

                    return (
                        <div key={item.key} className="flex items-center gap-1">
                            {/* 색상 점 (약간 작게 w-1.5) */}
                            <div className={`w-1.5 h-1.5 rounded-full ${item.color} flex-shrink-0`}></div>
                            
                            {/* 글자 (더 작게 text-[10px] 또는 text-xs) */}
                            <div className="flex items-baseline gap-0.5 text-gray-500 dark:text-gray-400">
                                <span className="text-[11px] font-medium whitespace-nowrap">
                                    {item.label}
                                </span>
                                <span className="text-[10px]">
                                    {item.percent}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RevenueDistributionChart;