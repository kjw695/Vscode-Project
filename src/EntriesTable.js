import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

function EntriesTable({
  entries,
  handleSort,
  handleEdit,
  handleDelete,
  isDarkMode,
  sortColumn,
  sortDirection,
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <thead>
          <tr className={`${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-600'} uppercase text-sm leading-normal`}>
            <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('date')}>
              날짜
              {sortColumn === 'date' && (sortDirection === 'asc' ? <ArrowUp size={16} className="inline ml-1" /> : <ArrowDown size={16} className="inline ml-1" />)}
            </th>
            <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('unitPrice')}>
              단가
              {sortColumn === 'unitPrice' && (sortDirection === 'asc' ? <ArrowUp size={16} className="inline ml-1" /> : <ArrowDown size={16} className="inline ml-1" />)}
            </th>
            <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('deliveryCount')}>
              배송
              {sortColumn === 'deliveryCount' && (sortDirection === 'asc' ? <ArrowUp size={16} className="inline ml-1" /> : <ArrowDown size={16} className="inline ml-1" />)}
            </th>
            <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('returnCount')}>
              반품
              {sortColumn === 'returnCount' && (sortDirection === 'asc' ? <ArrowUp size={16} className="inline ml-1" /> : <ArrowDown size={16} className="inline ml-1" />)}
            </th>
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
                    <button onClick={() => handleEdit(entry)} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded-md mr-2 transition duration-150 ease-in-out">
                      수정
                    </button>
                    <button onClick={() => handleDelete(entry.id)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-md transition duration-150 ease-in-out">
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="14" className="py-3 px-6 text-center">
                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>입력된 데이터가 없습니다. (로그인하지 않으면 데이터는 저장되지 않습니다.)</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default EntriesTable;