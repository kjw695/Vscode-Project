import React from 'react';
import { ChevronLeft } from 'lucide-react';

function PeriodView({ onBack, isDarkMode, adminMonthlyStartDayInput, setAdminMonthlyStartDayInput, adminMonthlyEndDayInput, setAdminMonthlyEndDayInput, handleSaveMonthlyPeriodSettings, monthlyStartDay, monthlyEndDay }) {
  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold ml-2">월별 집계 기간 설정</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="monthlyStartDay" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            월별 집계 시작일 (1-31)
          </label>
          <input
            type="number"
            id="monthlyStartDay"
            value={adminMonthlyStartDayInput}
            onChange={(e) => setAdminMonthlyStartDayInput(e.target.value)}
            className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`}
            min="1" max="31"
          />
        </div>
        <div>
          <label htmlFor="monthlyEndDay" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            월별 집계 종료일 (1-31)
          </label>
          <input
            type="number"
            id="monthlyEndDay"
            value={adminMonthlyEndDayInput}
            onChange={(e) => setAdminMonthlyEndDayInput(e.target.value)}
            className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`}
            min="1" max="31"
          />
        </div>
      </div>
      <button
        onClick={handleSaveMonthlyPeriodSettings}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
      >
        기간 저장
      </button>
      <p className={`text-sm mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        현재 월별 집계 기간: 매월 {monthlyStartDay}일 ~ 다음 달 {monthlyEndDay}일
      </p>
    </div>
  );
}

export default PeriodView;
