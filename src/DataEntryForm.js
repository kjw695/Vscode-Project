import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function DataEntryForm({
  handleSubmit,
  date,
  setDate,
  handleDateChange,
  dateInputRef,
  formType,
  setFormType,
  isDarkMode,
  entryToEdit,
  
  unitPrice, setUnitPrice,
  deliveryCount, setDeliveryCount,
  returnCount, setReturnCount,
  deliveryInterruptionAmount, setDeliveryInterruptionAmount,
  freshBagCount, setFreshBagCount,
  penaltyAmount, setPenaltyAmount,
  industrialAccidentCost, setIndustrialAccidentCost,
  fuelCost, setFuelCost,
  maintenanceCost, setMaintenanceCost,
  vatAmount, setVatAmount,
  incomeTaxAmount, setIncomeTaxAmount,
  taxAccountantFee, setTaxAccountantFee,
  favoriteUnitPrices,
}) {

  // ✨ [핵심 기능] 입력창을 터치하면 화면 상단으로 부드럽게 스크롤 이동
  // (block: 'start'로 설정하여 입력창이 화면 위쪽에 붙도록 함)
  const handleInputFocus = (e) => {
    // 모바일 키보드가 올라오는 시간을 고려해 0.3초 뒤에 실행
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className={`md:col-span-2 p-1 rounded-lg ${isDarkMode ? 'bg-gray-700' : ''}`}>
        <div className="flex items-center justify-center space-x-3">
          <button type="button" onClick={() => handleDateChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-pink-200'}`}>
            <ChevronLeft size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
          </button>
          <span
            onClick={() => dateInputRef.current?.showPicker()}
            className={`font-bold text-lg cursor-pointer select-none ${isDarkMode ? 'text-pink-300' : 'text-pink-500'}`}
          >
            {date}
          </span>
          <button type="button" onClick={() => handleDateChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-pink-200'}`}>
            <ChevronRight size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="opacity-0 w-0 h-0 absolute"
            required
          />
        </div>
      </div>
      
      <div className="md:col-span-2 flex justify-center space-x-4 my-4">
        <button
          type="button"
          onClick={() => setFormType('income')}
          className={`py-2 px-6 rounded-md font-semibold transition-colors duration-200 ${
            formType === 'income' 
            ? (isDarkMode ? 'bg-red-600 text-white' : 'bg-red-500 text-white')
            : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
          }`}
        >
          수익
        </button>
        <button
          type="button"
          onClick={() => setFormType('expense')}
          className={`py-2 px-6 rounded-md font-semibold transition-colors duration-200 ${
            formType === 'expense' 
            ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
            : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
          }`}
        >
          지출
        </button>
      </div>

      {formType === 'income' && (
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="unitPrice" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>단가 (원)</label>
            <input
              type="number" id="unitPrice" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
              step="0.01"
            />
            <div className="mt-2 flex space-x-2">
              {favoriteUnitPrices.map((price) => (
                <button
                  key={price} type="button" onClick={() => setUnitPrice(price.toString())}
                  className={`${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} text-xs py-1 px-3 rounded-full transition duration-150 ease-in-out`}
                >
                  {price.toLocaleString()}원
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="deliveryCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>배송 수량</label>
            <input
              type="number" id="deliveryCount" value={deliveryCount} onChange={(e) => setDeliveryCount(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
            step="0.01" placeholder="선택 사항"
            />
          </div>
          <div>
            <label htmlFor="deliveryInterruptionAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>배송중단</label>
            <input
              type="number" id="deliveryInterruptionAmount" value={deliveryInterruptionAmount} onChange={(e) => setDeliveryInterruptionAmount(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
              step="0.01" placeholder="선택 사항"
            />
          </div>
          <div>
            <label htmlFor="returnCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>반품 수량</label>
            <input
              type="number" id="returnCount" value={returnCount} onChange={(e) => setReturnCount(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
            step="0.01" placeholder="선택 사항"
            />
          </div>
          <div>
            <label htmlFor="freshBagCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>프레시백 수량</label>
            <input
              type="number" id="freshBagCount" value={freshBagCount} onChange={(e) => setFreshBagCount(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
              placeholder="선택 사항"
            />
          </div>
        </div>
      )}

      {formType === 'expense' && (
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="penaltyAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>패널티</label>
            <input
              type="number" id="penaltyAmount" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
              step="0.01" placeholder="선택 사항"
            />
          </div>
          <div>
            <label htmlFor="industrialAccidentCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>산재</label>
            <input
              type="number" id="industrialAccidentCost" value={industrialAccidentCost} onChange={(e) => setIndustrialAccidentCost(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
              step="0.01" placeholder="선택 사항"
            />
          </div>
          <div>
            <label htmlFor="fuelCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>유류비</label>
            <input
              type="number" id="fuelCost" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
              step="0.01" placeholder="선택 사항"
            />
          </div>
          <div>
            <label htmlFor="maintenanceCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>유지보수비</label>
            <input
              type="number" id="maintenanceCost" value={maintenanceCost} onChange={(e) => setMaintenanceCost(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
              step="0.01" placeholder="선택 사항"
            />
          </div>
          <div>
            <label htmlFor="vatAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>부가세</label>
            <input
              type="number" id="vatAmount" value={vatAmount} onChange={(e) => setVatAmount(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
              step="0.01" placeholder="선택 사항"
            />
          </div>
          <div>
            <label htmlFor="incomeTaxAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>종합소득세</label>
            <input
              type="number" id="incomeTaxAmount" value={incomeTaxAmount} onChange={(e) => setIncomeTaxAmount(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
              step="0.01" placeholder="선택 사항"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="taxAccountantFee" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>세무사 비용</label>
            <input
              type="number" id="taxAccountantFee" value={taxAccountantFee} onChange={(e) => setTaxAccountantFee(e.target.value)}
              onFocus={handleInputFocus}
              className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
              step="0.01" placeholder="선택 사항"
            />
          </div>
        </div>
      )}

      <div className="md:col-span-2 mt-4">
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out"
        >
          {entryToEdit ? '수정' : '저장'}
        </button>
      </div>
      
      {/* ✨ [방법 2] 하단 여백 추가 (키보드가 올라와도 스크롤 할 수 있는 공간 확보) */}
      <div className="h-64 md:h-20 w-full" aria-hidden="true"></div>
    </form>
  );
}

export default DataEntryForm;