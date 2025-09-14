import React from 'react';
import { ChevronLeft } from 'lucide-react';

function UnitPriceView({ onBack, isDarkMode, adminFavoritePricesInput, setAdminFavoritePricesInput, handleSaveFavoritePrices, favoriteUnitPrices }) {
  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold ml-2">즐겨찾는 단가 설정</h2>
      </div>

      <div className="mb-4">
        <label htmlFor="favoritePrices" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
          즐겨찾는 단가 (쉼표로 구분, 예: 700, 725, 750)
        </label>
        <input
          type="text"
          id="favoritePrices"
          value={adminFavoritePricesInput}
          onChange={(e) => setAdminFavoritePricesInput(e.target.value)}
          className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm`}
        />
      </div>
      <button
        onClick={handleSaveFavoritePrices}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
      >
        단가 저장
      </button>
      <p className={`text-sm mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        현재 즐겨찾는 단가: {favoriteUnitPrices.map(p => p.toLocaleString()).join(', ')} 원
      </p>
    </div>
  );
}

export default UnitPriceView;