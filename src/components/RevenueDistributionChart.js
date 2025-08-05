import React from 'react';

const ChartItem = ({ color, label }) => (
    <div className="flex items-center space-x-2">
        <span className={`w-3 h-3 rounded-full ${color}`}></span>
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </div>
);

const RevenueDistributionChart = ({ monthlyProfit }) => {
    const totalRevenue = 
        (monthlyProfit.totalDeliveryRevenue || 0) +
        (monthlyProfit.totalReturnRevenue || 0) +
        (monthlyProfit.totalDeliveryInterruptionRevenue || 0) +
        (monthlyProfit.totalFreshBagRevenue || 0);

    const totalExpenses = monthlyProfit.totalExpensesSum || 0;

    // ✨ 변경점: SVG에서 사용할 실제 색상값(color)과 범례(legend)에서 사용할 Tailwind 클래스를 분리했습니다.
    const items = [
        { label: '배송', value: monthlyProfit.totalDeliveryRevenue, color: '#06b6d4', legendClass: 'bg-cyan-500' },
        { label: '중단', value: monthlyProfit.totalDeliveryInterruptionRevenue, color: '#8b5cf6', legendClass: 'bg-purple-500' },
        { label: '반품', value: monthlyProfit.totalReturnRevenue, color: '#ec4899', legendClass: 'bg-pink-500' },
        { label: '프레시백', value: monthlyProfit.totalFreshBagRevenue, color: '#22c55e', legendClass: 'bg-green-500' },
        { label: '추가 지출', value: totalExpenses, color: '#3b82f6', legendClass: 'bg-blue-500' },
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
                        // ✨ 변경점: stroke 속성에 실제 색상값을 사용하도록 수정했습니다.
                        return <path key={index} d={path} stroke={item.color} strokeWidth="20" fill="none" />;
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center top-[-1rem]">
                    {/* ✨ 변경점: 라이트/다크 모드에 맞는 글자색을 적용했습니다. */}
                    <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">총 매출</h3>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                        {totalRevenue.toLocaleString()}원
                    </p>
                </div>
            </div>
            <div className="flex justify-center flex-wrap gap-x-4 gap-y-2 mt-4">
                {items.filter(item => item.value > 0).map((item, index) => (
                    <ChartItem key={index} color={item.legendClass} label={item.label} />
                ))}
            </div>
        </div>
    );
};

export default RevenueDistributionChart;