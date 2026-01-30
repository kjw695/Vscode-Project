import React from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import 'react-calendar-heatmap/dist/styles.css';

const ProfitHeatmap = ({ data, year }) => {
  if (!data || data.length === 0) {
    return <p>표시할 데이터가 없습니다.</p>;
  }

  // 수익 금액에 따라 색상 등급을 결정하는 함수
  const getClassForValue = (value) => {
    if (!value || value.profit <= 0) {
      return 'color-empty';
    }
    if (value.profit < 50000) {
      return 'color-scale-1';
    }
    if (value.profit < 100000) {
      return 'color-scale-2';
    }
    if (value.profit < 200000) {
      return 'color-scale-3';
    }
    return 'color-scale-4';
  };

  // 한글 월 배열
  const koreanMonthLabels = [
    '1월', '2월', '3월', '4월', '5월', '6월', 
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  return (
    <div className="heatmap-container">
      <CalendarHeatmap
        startDate={new Date(`${year}-01-01`)}
        endDate={new Date(`${year}-12-31`)}
        values={data}
        classForValue={getClassForValue}
        monthLabels={koreanMonthLabels} // 한글 월 배열을 적용합니다.
        tooltipDataAttrs={value => {
            return {
              'data-tooltip-id': 'heatmap-tooltip',
              'data-tooltip-content': value.date ? `${value.date}: ${value.profit?.toLocaleString() || 0} 원` : '데이터 없음',
            };
        }}
        showWeekdayLabels={true}
      />
      <ReactTooltip id="heatmap-tooltip" />
    </div>
  );
};

export default ProfitHeatmap;