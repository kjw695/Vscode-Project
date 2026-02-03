import React, { useMemo } from 'react';

// 차트 색상 팔레트
const COLORS = [
    'bg-cyan-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 
    'bg-yellow-500', 'bg-orange-500', 'bg-blue-500', 'bg-red-500',
    'bg-indigo-500', 'bg-teal-500'
];

const RevenueDistributionChart = ({ monthlyProfit }) => {
    // 1. 시스템 언어 감지
    const isKo = useMemo(() => {
        if (typeof navigator === 'undefined') return true;
        return (navigator.language || navigator.userLanguage || 'ko').toLowerCase().includes('ko');
    }, []);

    const t = {
        title: isKo ? "총 매출 현황" : "Revenue Distribution",
        unit: isKo ? "원" : "",
        others: isKo ? "기타" : "Others"
    };

    // 2. 차트 데이터 구성 로직 (이름 상관없이 상위 4개 추출)
    const chartItems = useMemo(() => {
        // 데이터가 없으면 빈 배열
        if (!monthlyProfit || !monthlyProfit.revenueDistribution) return [];

        // 1. 데이터 원본 가져오기 (이미 useProfitCalculations에서 계산된 값)
        let items = [...monthlyProfit.revenueDistribution];

        // 2. 금액 높은 순으로 정렬 (혹시 모르니 한번 더 정렬)
        items.sort((a, b) => b.value - a.value);

        // 3. 상위 4개만 자르기
        const topItems = items.slice(0, 4);

        // 4. 차트용 데이터로 변환
        const totalRevenue = monthlyProfit.totalRevenue || 0;
        
        return topItems.map((item, index) => {
            const rawPercent = totalRevenue > 0 ? (item.value / totalRevenue) * 100 : 0;
            return {
                key: item.name + index, // 고유 키
                label: item.name,       // 데이터에 있는 이름 그대로 사용
                value: item.value,
                color: COLORS[index % COLORS.length], // 색상 부여
                percent: Math.round(rawPercent),
                displayPercent: rawPercent.toFixed(1)
            };
        });

    }, [monthlyProfit, isKo]);

    const totalDisplayRevenue = monthlyProfit?.totalRevenue || 0;

    if (!monthlyProfit) return null;

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

            {/* 메인: 막대 그래프 */}
            <div className="flex w-full h-5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 mb-2.5">
                {totalDisplayRevenue > 0 ? (
                    chartItems.map((item) => (
                        <div 
                            key={item.key}
                            className={`${item.color} h-full transition-all duration-500 relative group`}
                            style={{ width: `${item.percent}%` }}
                        />
                    ))
                ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-600" />
                )}
            </div>

            {/* 하단: 범례 (4등분 그리드 + 한 줄 표시 + 형식 변경) */}
            <div className="grid grid-cols-4 gap-1 w-full mt-2">
                {chartItems.length > 0 ? (
                    chartItems.map((item) => (
                        <div key={item.key} className="flex items-center justify-center min-w-0">
                            {/* 색상 점: 크기 증가(w-[7px] h-[7px]), 중앙 정렬 강화(self-center) */}
                            <div className={`w-[7px] h-[7px] rounded-full ${item.color} mr-1 flex-shrink-0 self-center`}></div>
                            
                            {/* 텍스트 영역: 이름(퍼센트%) 형식으로 한 줄 표시 */}
                            <div className="text-gray-500 dark:text-gray-400 text-center min-w-0">
                                <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis text-[clamp(9px,2.5vw,11px)]">
                                    {item.label}<span className="opacity-80 ml-0.5">({item.percent}%)</span>
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-4 text-center text-[10px] text-gray-400">데이터 없음</div>
                )}
            </div>
        </div>
    );
};

export default RevenueDistributionChart;