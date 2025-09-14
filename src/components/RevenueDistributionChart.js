import React from 'react';

const ChartItem = ({ color, label }) => (
    <div className="flex items-center space-x-2">
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${color}`}></span>
        <span className="text-gray-700 dark:text-gray-300 whitespace-nowrap text-[clamp(0.75rem,2.5vw,0.875rem)]">
            {label}
        </span>
    </div>
);

const RevenueDistributionChart = ({ monthlyProfit }) => {
    const totalRevenue = 
        (monthlyProfit.totalDeliveryRevenue || 0) +
        (monthlyProfit.totalReturnRevenue || 0) +
        (monthlyProfit.totalDeliveryInterruptionRevenue || 0) +
        (monthlyProfit.totalFreshBagRevenue || 0);

    const totalExpenses = monthlyProfit.totalExpensesSum || 0;

    const items = [
        { label: '배송', value: monthlyProfit.totalDeliveryRevenue, color: '#06b6d4', legendClass: 'bg-cyan-500' },
        { label: '중단', value: monthlyProfit.totalDeliveryInterruptionRevenue, color: '#8b5cf6', legendClass: 'bg-purple-500' },
        { label: '반품', value: monthlyProfit.totalReturnRevenue, color: '#ec4899', legendClass: 'bg-pink-500' },
        { label: '프레시백', value: monthlyProfit.totalFreshBagRevenue, color: '#22c55e', legendClass: 'bg-green-500' },
            ];

    const totalForChart = items.reduce((sum, item) => sum + (item.value || 0), 0);

    const getArcPath = (startAngle, endAngle, radius) => {
        const start = {
            x: 100 + radius * Math.cos(startAngle),
            y: 100 + radius * Math.sin(startAngle)
        };
        const end = {
            x: 100 + radius * Math.cos(endAngle),
            y: 100 + radius * Math.sin(endAngle)
        };
        const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";
        return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
    };

    let currentAngle = -Math.PI;

    return (
        <div className="w-full">
            <div className="relative w-full max-w-xs mx-auto">
                <svg viewBox="0 0 200 100" className="w-full">
                    {items.map((item, index) => {
                        if (!item.value || item.value <= 0 || totalForChart === 0) return null;
                        const angle = (item.value / totalForChart) * Math.PI;
                        const path = getArcPath(currentAngle, currentAngle + angle, 90);
                        currentAngle += angle;
                        return <path key={index} d={path} stroke={item.color} strokeWidth="20" fill="none" />;
                    })}
                </svg>
                {/* 👇 변경점: 텍스트와 범례를 모두 이 div 안에 넣습니다. */}
                 <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-0">
                    <h3 className="text-lg font-semibold text-black dark:text-gray-400">총 매출</h3>
                    <p className="font-bold text-black dark:text-gray-100 text-[clamp(1.75rem,5vw,2.25rem)] leading-tight">
                        {totalRevenue.toLocaleString()}원
                    </p>

                    {/* 👇 기존에 밖에 있던 범례 div를 이곳으로 옮겼습니다. */}
                    <div className="flex justify-center flex-nowrap gap-x-3 mt-2 overflow-x-auto">
                        {items.filter(item => item.value > 0).map((item, index) => (
                            <ChartItem key={index} color={item.legendClass} label={item.label} />
                        ))}
                    </div>
                </div>
            </div>
            {/* 👆 원래 범례가 있던 자리는 이제 비어있게 됩니다. */}
        </div>
    );
};

export default RevenueDistributionChart;