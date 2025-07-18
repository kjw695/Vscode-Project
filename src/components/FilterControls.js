import React, { useState } from 'react';

const FilterControls = ({ onFilterChange, isDarkMode }) => {
  const [activePeriod, setActivePeriod] = useState('3m');
  const [activeType, setActiveType] = useState('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dates, setDates] = useState({ start: '', end: '' });

  const handlePeriodClick = (period) => {
    setActivePeriod(period);
    setShowDatePicker(period === 'direct');
    
    if (period !== 'direct') {
      const endDate = new Date();
      const startDate = new Date();
      if (period === '1m') startDate.setMonth(endDate.getMonth() - 1);
      else if (period === '3m') startDate.setMonth(endDate.getMonth() - 3);
      else if (period === '6m') startDate.setMonth(endDate.getMonth() - 6);
      
      onFilterChange({ 
        period, 
        type: activeType, 
        startDate: startDate.toISOString().slice(0, 10), 
        endDate: endDate.toISOString().slice(0, 10) 
      });
    }
  };

  const handleTypeClick = (type) => {
    setActiveType(type);
    // 현재 기간 설정에 따라 필터 다시 적용
    handlePeriodClick(activePeriod); 
  };
  
  const handleDateChange = (e, type) => {
    const newDates = { ...dates, [type]: e.target.value };
    setDates(newDates);
    if(newDates.start && newDates.end) {
        onFilterChange({ period: 'direct', type: activeType, ...newDates });
    }
  };

  const presetButtonClass = (period) => `py-2 px-4 text-sm rounded-md transition-colors w-full ${activePeriod === period ? 'bg-blue-600 text-white' : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300')}`;
  const typeButtonClass = (type) => `py-1 px-4 text-xs rounded-full transition-colors ${activeType === type ? 'bg-indigo-600 text-white' : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300')}`;

  return (
    <div className={`p-4 rounded-lg mb-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-900/50'}`}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button onClick={() => handlePeriodClick('1m')} className={presetButtonClass('1m')}>최근 1개월</button>
        <button onClick={() => handlePeriodClick('3m')} className={presetButtonClass('3m')}>최근 3개월</button>
        <button onClick={() => handlePeriodClick('6m')} className={presetButtonClass('6m')}>최근 6개월</button>
        <button onClick={() => handlePeriodClick('direct')} className={presetButtonClass('direct')}>직접 입력</button>
      </div>
      
      {showDatePicker && (
        <div className="flex items-center justify-center space-x-2 text-sm my-3">
          <input type="date" value={dates.start} onChange={(e) => handleDateChange(e, 'start')} className={`p-2 rounded-md ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`} />
          <span>~</span>
          <input type="date" value={dates.end} onChange={(e) => handleDateChange(e, 'end')} className={`p-2 rounded-md ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`} />
        </div>
      )}
      
      <div className="flex items-center justify-center p-1 rounded-full bg-gray-100 dark:bg-gray-700 space-x-1">
        <button onClick={() => handleTypeClick('all')} className={typeButtonClass('all')}>전체</button>
        <button onClick={() => handleTypeClick('income')} className={typeButtonClass('income')}>수익</button>
        <button onClick={() => handleTypeClick('expense')} className={typeButtonClass('expense')}>지출</button>
      </div>
    </div>
  );
};

export default FilterControls;