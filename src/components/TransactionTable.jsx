// src/components/TransactionTable.jsx

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

function TransactionTable({
  entries,
  handleEdit,
  handleDelete,
  handleSort,
  sortColumn,
  sortDirection,
  isDarkMode
}) {
  const renderSortArrow = (columnName) => {
    if (sortColumn === columnName) {
      return sortDirection === 'asc' ? <ArrowUp size={16} className="inline ml-1" /> : <ArrowDown size={16} className="inline ml-1" />;
    }
    return null;
  };

  return (
    <div>
      <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>입력된 데이터</h2>
      <div className="overflow-x-auto">
        <table className={`min-w-full rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <thead>
            <tr className={`${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-600'} uppercase text-sm leading-normal`}>
              <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('date')}>날짜 {renderSortArrow('date')}</th>
              <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('unitPrice')}>단가 {renderSortArrow('unitPrice')}</th>
              <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('deliveryCount')}>배송 {renderSortArrow('deliveryCount')}</th>
              <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('returnCount')}>반품 {renderSortArrow('returnCount')}</th>
              <th className="py-3 px-6 text-left">배송중단</th>
              <th className="py-3 px-6 text-left">프레시백</th>
              <th className="py-3 px-6 text-left">패널티</th>
              <th className="py-3 px-6 text-left">산재</th>
              <th className="py-3 px-6 text-left">유류비</th>
              <th className="py-3 px-6 text-left">유지보수비</th>
              <th className="py-3 px-6 text-left">부가세</th>
              <th className="py-3 px-6 text-left">종합소득세</th>
              <th className="py-3 px-6 text-left">세무사 비용</th>
              <th className="py-3 px-6 text-center">작업</th>
            </tr>
          </thead>
          <tbody className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm font-light`}>
            {entries.length > 0 ? (
              entries.map(entry => (
                <tr key={entry.id} className={`${isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-100'} border-b`}>
                  <td className="py-3 px-6 text-left whitespace-nowrap">{entry.date}</td>
                  <td className="py-3 px-6 text-left">{entry.unitPrice.toLocaleString()}</td>
                  <td className="py-3 px-6 text-left">{entry.deliveryCount.toLocaleString()}</td>
                  <td className="py-3 px-6 text-left">{entry.returnCount.toLocaleString()}</td>
                  <td className="py-3 px-6 text-left">{(entry.deliveryInterruptionAmount || 0).toLocaleString()}</td>
                  <td className="py-3 px-6 text-left">{(entry.freshBagCount || 0).toLocaleString()}</td>
                  <td className="py-3 px-6 text-left">{(entry.penaltyAmount || 0).toLocaleString()}</td>
                  <td className="py-3 px-6 text-left">{(entry.industrialAccidentCost || 0).toLocaleString()}</td>
                  <td className="py-3 px-6 text-left">{(entry.fuelCost || 0).toLocaleString()}</td>
                  <td className="py-3 px-6 text-left">{(entry.maintenanceCost || 0).toLocaleString()}</td>
                  <td className="py-3 px-6 text-left">{(entry.vatAmount || 0).toLocaleString()}</td>
                  <td className="py-3 px-6 text-left">{(entry.incomeTaxAmount || 0).toLocaleString()}</td>
                  <td className="py-3 px-6 text-left">{(entry.taxAccountantFee || 0).toLocaleString()}</td>
                  <td className="py-3 px-6 text-center">
                    <div className="flex item-center justify-center">
                      <button onClick={() => handleEdit(entry)} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded-md mr-2">수정</button>
                      <button onClick={() => handleDelete(entry.id)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-md">삭제</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="14" className="py-3 px-6 text-center">
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>데이터가 없습니다.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TransactionTable;