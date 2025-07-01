import React, { useState } from 'react';

// App.js로부터 모든 데이터와 함수를 props로 전달받습니다.
function TransactionManager({
  // 데이터 상태와 상태 변경 함수들
  date, setDate,
  unitPrice, setUnitPrice,
  deliveryCount, setDeliveryCount,
  returnCount, setReturnCount,
  freshBagCount, setFreshBagCount,
  deliveryInterruptionAmount, setDeliveryInterruptionAmount,
  penaltyAmount, setPenaltyAmount,
  industrialAccidentCost, setIndustrialAccidentCost,
  fuelCost, setFuelCost,
  maintenanceCost, setMaintenanceCost,
  vatAmount, setVatAmount,
  incomeTaxAmount, setIncomeTaxAmount,
  taxAccountantFee, setTaxAccountantFee,
  favoriteUnitPrices,
  // 메인 저장/업데이트 함수
  handleSubmit,
  // 편집 중인 항목 정보
  entryToEdit,
  // 다크 모드 정보
  isDarkMode
}) {
  const [activeTab, setActiveTab] = useState('수익'); // '수익', '지출' 탭 상태

  // 수익 관련 입력 필드를 렌더링하는 함수
  const renderIncomeFields = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
        <label htmlFor="deliveryCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>배송 수량</label>
        <input type="number" id="deliveryCount" value={deliveryCount} onChange={(e) => setDeliveryCount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-md shadow-sm`} />
      </div>
      <div>
        <label htmlFor="returnCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>반품 수량</label>
        <input type="number" id="returnCount" value={returnCount} onChange={(e) => setReturnCount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-md shadow-sm`} />
      </div>
      <div>
          <label htmlFor="deliveryInterruptionAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>배송중단(건)</label>
          <input type="number" id="deliveryInterruptionAmount" value={deliveryInterruptionAmount} onChange={(e) => setDeliveryInterruptionAmount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-md shadow-sm`} />
      </div>
      <div>
          <label htmlFor="freshBagCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>프레시백</label>
          <input type="number" id="freshBagCount" value={freshBagCount} onChange={(e) => setFreshBagCount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-md shadow-sm`} />
      </div>
    </div>
  );

  // 지출 관련 입력 필드를 렌더링하는 함수
  const renderExpenseFields = () => (
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
          <label htmlFor="penaltyAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>패널티</label>
          <input type="number" id="penaltyAmount" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-md shadow-sm`} />
      </div>
      <div>
          <label htmlFor="industrialAccidentCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>산재</label>
          <input type="number" id="industrialAccidentCost" value={industrialAccidentCost} onChange={(e) => setIndustrialAccidentCost(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-md shadow-sm`} />
      </div>
      <div>
          <label htmlFor="fuelCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>유류비</label>
          <input type="number" id="fuelCost" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-md shadow-sm`} />
      </div>
      <div>
          <label htmlFor="maintenanceCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>유지보수비</label>
          <input type="number" id="maintenanceCost" value={maintenanceCost} onChange={(e) => setMaintenanceCost(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-md shadow-sm`} />
      </div>
      <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor="vatAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>부가세</label>
          <input type="number" id="vatAmount" value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-md shadow-sm`} />
      </div>
      <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor="incomeTaxAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>종합소득세</label>
          <input type="number" id="incomeTaxAmount" value={incomeTaxAmount} onChange={(e) => setIncomeTaxAmount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-md shadow-sm`} />
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
          <label htmlFor="taxAccountantFee" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>세무사 비용</label>
          <input type="number" id="taxAccountantFee" value={taxAccountantFee} onChange={(e) => setTaxAccountantFee(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} rounded-md shadow-sm`} />
      </div>
    </div>
  );
  
  return (
    <div className={`p-4 rounded-lg shadow-md w-full max-w-4xl mb-6 relative ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>날짜</label>
              <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} required />
            </div>
            <div>
              <label htmlFor="unitPrice" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>단가 (원)</label>
              <input type="number" id="unitPrice" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              <div className="mt-2 flex flex-wrap gap-2">
                {favoriteUnitPrices.map((price) => (
                  <button key={price} type="button" onClick={() => setUnitPrice(price.toString())} className={`${isDarkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} text-xs py-1 px-3 rounded-full`}>
                    {price.toLocaleString()}원
                  </button>
                ))}
              </div>
            </div>
        </div>

        <div className="mt-4">
            <div className="flex border-b border-gray-400">
                <button type="button" onClick={() => setActiveTab('수익')} className={`flex-1 py-2 text-center font-semibold ${activeTab === '수익' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500'}`}>수익 항목</button>
                <button type="button" onClick={() => setActiveTab('지출')} className={`flex-1 py-2 text-center font-semibold ${activeTab === '지출' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>지출 항목</button>
            </div>
        </div>

        <div className="mt-4">
            {activeTab === '수익' ? renderIncomeFields() : renderExpenseFields()}
        </div>

        <div className="mt-6">
          <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">{entryToEdit ? '항목 업데이트' : '항목 추가'}</button>
        </div>
      </form>
    </div>
  );
}

export default TransactionManager;