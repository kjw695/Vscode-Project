//데이터-계산하기 페이지

import React, { useState, useEffect, useRef } from 'react';
import { Save, X, RotateCcw, TrendingUp, TrendingDown, ArrowLeft, Minus } from 'lucide-react';

const CalculatorPage = ({ 
    onBack, 
    onApply, 
    date, 
    currentRound, 
    incomeConfig, 
    isDarkMode 
}) => {
    const [totalInputs, setTotalInputs] = useState({});
    const [previousData, setPreviousData] = useState({});
    const [previousBreakdown, setPreviousBreakdown] = useState({});
    
    const scrollContainerRef = useRef(null);
    
    // 1. 데이터 불러오기
    useEffect(() => {
        if (!date) return;
        const allData = JSON.parse(localStorage.getItem('deliveryEntries') || '[]'); 
        const prevDataSum = {};
        const breakdown = {};

        const todayEntries = allData.filter(d => d.date === date);

        // ✨ 누적 계산을 도와주는 작은 헬퍼 함수
        const addValue = (key, val, round) => {
            if (val <= 0) return;
            prevDataSum[key] = (prevDataSum[key] || 0) + val;
            
            if (!breakdown[key]) breakdown[key] = [];
            const label = round > 0 ? `${round}회전` : '기존';
            const existing = breakdown[key].find(b => b.label === label);
            if (existing) {
                existing.value += val;
            } else {
                breakdown[key].push({ label: label, value: val, round: round });
            }
        };

        todayEntries.forEach((entry) => {
             const entryRound = entry.round || 0; 
             
             if (entryRound < currentRound) {
                 // 1️⃣ 예전 방식 데이터 (루트에 숫자가 있는 경우)
                 Object.keys(entry).forEach(key => {
                    if (typeof entry[key] === 'number' && key !== 'id' && key !== 'unitPrice' && key !== 'round') {
                        addValue(key, entry[key], entryRound);
                    }
                });

                // 2️⃣ ✨ 새로운 방식 데이터 (customItems 상자 안에 숫자가 있는 경우 완벽 지원!)
                if (entry.customItems && Array.isArray(entry.customItems)) {
                    entry.customItems.forEach(item => {
                        // 물량(count)이 있으면 우선적으로 가져오고, 없으면 금액(amount)을 가져옵니다.
                        const val = Number(item.count) || Number(item.amount) || 0;
                        addValue(item.key, val, entryRound);
                    });
                }
             }
        });

        Object.keys(breakdown).forEach(key => {
            breakdown[key].sort((a, b) => a.round - b.round);
        });

        setPreviousData(prevDataSum);
        setPreviousBreakdown(breakdown);
    }, [date, currentRound]);

    // 2. 저장 핸들러 (마이너스 경고 팝업)
    const handleSave = (e) => {
        e.preventDefault();
        const calculatedResults = {};
        const config = incomeConfig || []; 
        const itemsToCalculate = config.filter(item => item.isVisible || (previousData[item.key] && previousData[item.key] > 0));

        let hasNegative = false;

        itemsToCalculate.forEach(item => {
            const totalQty = parseFloat(totalInputs[item.key] || 0);
            const prevQty = parseFloat(previousData[item.key] || 0);
            
            if (totalInputs[item.key] !== undefined && totalInputs[item.key] !== '') {
                const currentQty = totalQty - prevQty;
                calculatedResults[item.key] = currentQty;

                if (currentQty < 0) {
                    hasNegative = true;
                }
            }
        });

        if (hasNegative) {
            const isConfirmed = window.confirm(
                "⚠️ 입력한 수량이 누적 수량보다 적습니다.\n" +
                "차이만큼 마이너스(-)로 기록됩니다.\n\n" +
                "정말 저장하시겠습니까?"
            );
            if (!isConfirmed) return;
        }

        onApply(calculatedResults);
    };

    const handleBoxClick = (key) => {
        const inputElement = document.getElementById(`calc-input-${key}`);
        if (inputElement) {
            inputElement.focus();
        }
    };

    const primaryItems = (incomeConfig || []).filter(item => item.isVisible !== false);
    const hiddenItems = (incomeConfig || []).filter(item => item.isVisible === false);
    const activeHiddenItems = hiddenItems.filter(item => (previousData[item.key] > 0) || (totalInputs[item.key] > 0));

    return (
        <div 
            ref={scrollContainerRef}
            className={`fixed inset-0 z-[9999] overflow-y-auto font-sans ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-slate-50 text-slate-900'}`} 
        >
            <form onSubmit={handleSave} className="min-h-full flex flex-col relative">
                
                {/* 헤더 */}
                <div className={`px-4 pt-4 pb-2 flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <button type="button" onClick={onBack} className={`p-2 -ml-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="text-xl font-black flex items-center gap-1.5">
                            {currentRound}회전 자동계산
                        </h1>
                        <button type="button" onClick={() => setTotalInputs({})} className={`p-2 -mr-2 transition-colors ${isDarkMode ? 'text-gray-600 hover:text-white' : 'text-gray-300 hover:text-gray-600'}`}>
                            <RotateCcw size={20} />
                        </button>
                    </div>

                    <div className={`mx-auto w-full text-center py-2 mb-1 rounded-lg font-black text-2xl tracking-widest ${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-slate-700 shadow-sm'}`}>
                        {date}
                    </div>
                </div>

                {/* 메인 콘텐츠 */}
                <div className="flex-1 p-4 space-y-4 pb-32">
                    <div className="grid grid-cols-2 gap-4">
                        {[...primaryItems, ...activeHiddenItems].map((item) => {
                            const prevQty = previousData[item.key] || 0;
                            const breakdownList = previousBreakdown[item.key] || [];
                            const totalQty = parseFloat(totalInputs[item.key] || 0);
                            const currentQty = totalQty - prevQty;
                            const hasInput = totalInputs[item.key] !== undefined && totalInputs[item.key] !== '';
                            
                            // 주식시장 컬러 테마
                            const isZero = currentQty === 0;
                            const isNegative = currentQty < 0; // 하락 (파랑)
                            const isPositive = currentQty > 0; // 상승 (빨강)

                            return (
                                <div key={item.key} 
                                    onClick={() => handleBoxClick(item.key)}
                                    className={`relative flex flex-col justify-between rounded-2xl transition-all duration-200 cursor-pointer
                                    ${isDarkMode 
                                        ? `bg-gray-800 ${hasInput 
                                            ? (isZero ? 'ring-1 ring-gray-500' : isNegative ? 'ring-1 ring-blue-500' : 'ring-1 ring-red-500') 
                                            : 'border border-gray-700 focus-within:border-transparent focus-within:ring-2 focus-within:ring-indigo-400'}` 
                                        : `bg-white ${hasInput 
                                            ? (isZero ? 'ring-2 ring-gray-400 shadow-lg scale-[1.02]' : isNegative ? 'ring-2 ring-blue-500 shadow-lg scale-[1.02]' : 'ring-2 ring-red-500 shadow-lg scale-[1.02]') 
                                            : 'shadow-sm border border-slate-100 focus-within:border-transparent focus-within:ring-2 focus-within:ring-indigo-500'}` 
                                    }`}
                                >
                                    {/* 상단: 라벨 */}
                                    <div className="p-3 pb-0 pointer-events-none">
                                        <div className="flex justify-between items-start mb-1">
                                            <label className={`text-base font-bold truncate pr-2 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                                                {item.label}
                                            </label>
                                        </div>

                                        {/* 상세 내역 */}
                                        {prevQty > 0 && (
                                            <div className={`flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] mb-1 leading-tight ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {breakdownList.map((rec, idx) => (
                                                    <React.Fragment key={idx}>
                                                        <span className="flex items-center">
                                                            <span className="opacity-70 mr-0.5">{rec.label}:</span>
                                                            <span className={`font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{rec.value}</span>
                                                        </span>
                                                        {idx < breakdownList.length - 1 && (
                                                            <span className="opacity-30">|</span>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* 중단: 입력창 */}
                                    <div className="px-3 py-1">
                                        <input 
                                            id={`calc-input-${item.key}`}
                                            type="number" 
                                            inputMode="numeric" 
                                            value={totalInputs[item.key] || ''} 
                                            onChange={(e) => setTotalInputs({...totalInputs, [item.key]: e.target.value})} 
                                            // 🔥 onFocus 제거 (화면 움직임 방지)
                                            className={`w-full h-10 text-2xl font-black bg-transparent outline-none text-right tracking-tight
                                                ${!hasInput ? (isDarkMode ? 'text-white' : 'text-slate-900') : ''}
                                                ${hasInput ? (isZero ? (isDarkMode ? 'text-gray-400' : 'text-gray-500') : isNegative ? 'text-blue-500' : 'text-red-500') : ''} 
                                                placeholder-gray-300 dark:placeholder-gray-700
                                            `}
                                            placeholder="0" 
                                        />
                                    </div>

                                    {/* 하단 바: 누적 + 차이값 */}
                                    <div className={`h-9 flex items-center justify-between px-3 rounded-b-2xl transition-all overflow-hidden pointer-events-none
                                        ${hasInput 
                                            ? (isZero 
                                                ? (isDarkMode ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100 text-gray-500') 
                                                : isNegative 
                                                    ? (isDarkMode ? 'bg-blue-900/40 text-blue-200' : 'bg-blue-50 text-blue-700') 
                                                    : (isDarkMode ? 'bg-red-900/40 text-red-200' : 'bg-red-50 text-red-600')
                                            )
                                            : 'bg-transparent'
                                        }`
                                    }>
                                        <div className={`text-[11px] font-bold ${prevQty > 0 ? '' : 'opacity-0'} ${!hasInput && (isDarkMode ? 'text-gray-500' : 'text-gray-400')}`}>
                                            누적: {prevQty}
                                        </div>

                                        {hasInput && (
                                            <div className="flex items-center gap-0.5 text-sm font-black animate-in slide-in-from-bottom-1 fade-in">
                                                {isZero ? <Minus size={14} /> : (isNegative ? <TrendingDown size={14} /> : <TrendingUp size={14} />)}
                                                <span>{Math.abs(currentQty)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 푸터 (취소/저장) */}
                <div className={`fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-[10000] ${isDarkMode ? 'bg-gray-900 border-t border-gray-800' : 'bg-white border-t border-gray-200'} shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]`}>
                    <div className="flex gap-3 max-w-md mx-auto">
                        <button 
                            type="button" 
                            onClick={onBack}
                            className={`flex-1 py-3 rounded-xl font-bold text-base shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2
                                ${isDarkMode ? 'bg-gray-800 text-gray-300 border border-gray-700' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}
                        >
                            <X size={18} />
                            <span>취소</span>
                        </button>
                        
                        <button 
                            type="submit" 
                            className={`flex-[2] py-3 rounded-xl font-bold text-base shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 
                                ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-black text-white hover:bg-gray-800'}`}
                        >
                            <Save size={18} />
                            <span>저장하기</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CalculatorPage;