// src/components/TransactionManager.jsx

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// App.js로부터 필요한 모든 데이터와 함수를 props로 전달받습니다.
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
  const [formType, setFormType] = useState('income'); // 'income' 또는 'expense'
  const dateInputRef = useRef(null);

  // entryToEdit이 변경될 때 formType을 자동으로 설정
  useEffect(() => {
    if (entryToEdit) {
      if (entryToEdit.penaltyAmount || entryToEdit.industrialAccidentCost || entryToEdit.fuelCost || entryToEdit.maintenanceCost || entryToEdit.vatAmount || entryToEdit.incomeTaxAmount || entryToEdit.taxAccountantFee) {
        setFormType('expense');
      } else {
        setFormType('income');
      }
    } else {
      // 새 항목을 작성할 때는 기본적으로 '수익' 폼으로 시작
      setFormType('income');
    }
  }, [entryToEdit]);

  // 날짜를 하루씩 변경하는 함수
  const handleDateChange = (days) => {
    if (!date) return;
    const currentDate = new Date(date);
    currentDate.setDate(currentDate.getDate() + days);
    setDate(currentDate.toISOString().slice(0, 10));
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 날짜 선택기 UI */}
      <div className={`md:col-span-2 p-1 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-pink-100'}`}>
          <div className="flex items-center justify-center space-x-3">
              <button type="button" onClick={() => handleDateChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-pink-200'}`}>
                  <ChevronLeft size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
              </button>
              <span
                  onClick={() => dateInputRef.current?.showPicker()}
                  className={`font-bold text-lg cursor-pointer select-none ${isDarkMode ? 'text-pink-300' : 'text-pink-700'}`}
              >
                  {date}
              </span>
              <button type="button" onClick={() => handleDateChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-pink-200'}`}>
                  <ChevronRight size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
              </button>
              <input ref={dateInputRef} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="opacity-0 w-0 h-0 absolute" required />
          </div>
      </div>
     
      {/* 수익/지출 선택 버튼 */}
      <div className="md:col-span-2 flex justify-center space-x-4 my-4">
          <button
              type="button"
              onClick={() => setFormType('income')}
              className={`py-2 px-6 rounded-md font-semibold transition-colors duration-200 ${ formType === 'income' ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-red-500 text-white') : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300') }`}
          >
              수익
          </button>
          <button
              type="button"
              onClick={() => setFormType('expense')}
              className={`py-2 px-6 rounded-md font-semibold transition-colors duration-200 ${ formType === 'expense' ? (isDarkMode ? 'bg-red-600 text-white' : 'bg-blue-500 text-white') : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300') }`}
          >
              지출
          </button>
      </div>

      {/* 수익 입력 필드 */}
      {formType === 'income' && (
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                  <label htmlFor="unitPrice" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>단가 (원)</label>
                  <input type="number" id="unitPrice" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
                  <div className="mt-2 flex space-x-2">
                      {favoriteUnitPrices.map((price) => (
                          <button key={price} type="button" onClick={() => setUnitPrice(price.toString())} className={`${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} text-xs py-1 px-3 rounded-full`}>
                              {price.toLocaleString()}원
                          </button>
                      ))}
                  </div>
              </div>
              <div>
                  <label htmlFor="deliveryCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>배송</label>
                  <input type="number" id="deliveryCount" value={deliveryCount} onChange={(e) => setDeliveryCount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              </div>
              <div>
                  <label htmlFor="returnCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>반품</label>
                  <input type="number" id="returnCount" value={returnCount} onChange={(e) => setReturnCount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              </div>
              <div>
                  <label htmlFor="deliveryInterruptionAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>중단(단가곱)</label>
                  <input type="number" id="deliveryInterruptionAmount" value={deliveryInterruptionAmount} onChange={(e) => setDeliveryInterruptionAmount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              </div>
              <div>
                  <label htmlFor="freshBagCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>프레시백</label>
                  <input type="number" id="freshBagCount" value={freshBagCount} onChange={(e) => setFreshBagCount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              </div>
          </div>
      )}

      {/* 지출 입력 필드 */}
      {formType === 'expense' && (
          <div className="md:col-span-2 grid grid-cols-2 gap-4 mt-4">
              <div>
                  <label htmlFor="penaltyAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>패널티</label>
                  <input type="number" id="penaltyAmount" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              </div>
              <div>
                  <label htmlFor="industrialAccidentCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>산재</label>
                  <input type="number" id="industrialAccidentCost" value={industrialAccidentCost} onChange={(e) => setIndustrialAccidentCost(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              </div>
              <div>
                  <label htmlFor="fuelCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>유류비</label>
                  <input type="number" id="fuelCost" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              </div>
              <div>
                  <label htmlFor="maintenanceCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>유지보수비</label>
                  <input type="number" id="maintenanceCost" value={maintenanceCost} onChange={(e) => setMaintenanceCost(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              </div>
              <div>
                  <label htmlFor="vatAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>부가세</label>
                  <input type="number" id="vatAmount" value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              </div>
              <div>
                  <label htmlFor="incomeTaxAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>종합소득세</label>
                  <input type="number" id="incomeTaxAmount" value={incomeTaxAmount} onChange={(e) => setIncomeTaxAmount(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              </div>
              <div className="md:col-span-2">
                  <label htmlFor="taxAccountantFee" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>세무사 비용</label>
                  <input type="number" id="taxAccountantFee" value={taxAccountantFee} onChange={(e) => setTaxAccountantFee(e.target.value)} className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`} />
              </div>
          </div>
      )}

      <div className="md:col-span-2 mt-4">
          <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
              {entryToEdit ? '수정' : '저장'}
          </button>
      </div>
    </form>
  );
}

export default TransactionManager;