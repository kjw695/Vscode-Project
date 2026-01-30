import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Save, Plus, ChevronDown, ChevronUp, Check, Calculator, ChevronLeft, ChevronRight, X } from 'lucide-react';
import CalculatorPage from './CalculatorPage'; 
import { useNavigate } from 'react-router-dom';

const LEGACY_KEYS = [
    'deliveryCount', 'returnCount', 'deliveryInterruptionAmount', 'freshBagCount', 
    'penaltyAmount', 'industrialAccidentCost', 'fuelCost', 'maintenanceCost',      
    'vatAmount', 'incomeTaxAmount', 'taxAccountantFee'
];

const formatNumber = (num) => {
    if (!num && num !== 0) return '';
    const stringNum = String(num).replace(/,/g, '');
    return stringNum.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const unformatNumber = (str) => {
    return str.replace(/,/g, '');
};

const TopSheetCalendar = ({ currentDate, onClose, onSelect, isDarkMode }) => {
    const [viewDate, setViewDate] = useState(new Date(currentDate));
    const [dragY, setDragY] = useState(0); 
    const [touchStart, setTouchStart] = useState(null);
    const [touchStartY, setTouchStartY] = useState(null); 

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, []);

    const getTodayStr = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };
    const todayStr = getTodayStr();

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const handleTouchStart = (e) => {
        e.stopPropagation(); 
        setTouchStart(e.targetTouches[0].clientX);
        setTouchStartY(e.targetTouches[0].clientY);
    };

    const handleTouchMove = (e) => {
        e.stopPropagation(); 
        const currentY = e.targetTouches[0].clientY;
        const diffY = currentY - touchStartY;
        
        if (diffY < 0) {
            setDragY(diffY);
        }
    };

    const handleTouchEnd = (e) => {
        e.stopPropagation();
        const touchEnd = e.changedTouches[0].clientX;
        const distanceX = touchStart - touchEnd;

        if (Math.abs(distanceX) > 70 && Math.abs(dragY) < 30) {
            if (distanceX > 0) handleNextMonth();
            else handlePrevMonth();
        } 
        else if (dragY < -50) {
            onClose();
        }

        setDragY(0); 
        setTouchStart(null);
        setTouchStartY(null);
    };

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} />);
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isSelected = dateStr === currentDate;
        const isToday = dateStr === todayStr;
        const dayOfWeek = new Date(year, month, day).getDay();

        days.push(
            <button
                key={day}
                type="button"
                onClick={() => onSelect(dateStr)}
                className={`h-12 w-full flex items-center justify-center rounded-xl text-lg font-bold
                    ${isSelected 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : isToday 
                            ? (isDarkMode ? 'bg-blue-900/40 text-blue-400 border-2 border-blue-500' : 'bg-amber-100 text-amber-700 border-2 border-amber-400')
                            : (dayOfWeek === 0 ? 'text-red-500' : (dayOfWeek === 6 ? 'text-blue-500' : (isDarkMode ? 'text-white' : 'text-gray-700')))
                    }`}
            >
                {day}
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div 
                className={`w-full max-w-md p-6 rounded-b-3xl shadow-2xl ${isDarkMode ? 'bg-gray-900' : 'bg-white'} ${dragY === 0 ? 'transition-all duration-300 ease-out' : ''}`} 
                style={{ 
                    transform: `translateY(${dragY}px)`,
                    touchAction: 'none' 
                }} 
                onClick={(e) => e.stopPropagation()}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="flex items-center mb-6 relative px-1">
                    <div className="flex items-center justify-center flex-1 space-x-6">
                        <button type="button" onClick={handlePrevMonth} className="p-2 rounded-full active:bg-gray-200 dark:active:bg-gray-700"><ChevronLeft size={24} /></button>
                        <div className="relative font-black text-xl cursor-pointer">
                            {year}년 {month + 1}월
                            <input type="month" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" onChange={(e) => {
                                const [y, m] = e.target.value.split('-');
                                setViewDate(new Date(parseInt(y), parseInt(m) - 1, 1));
                            }}/>
                        </div>
                        <button type="button" onClick={handleNextMonth} className="p-2 rounded-full active:bg-gray-200 dark:active:bg-gray-700"><ChevronRight size={24} /></button>
                    </div>
                    
                    <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setViewDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }} 
                        className={`absolute right-0 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm active:scale-90 transition-transform ${isDarkMode ? 'bg-blue-900/40 text-blue-400 border border-blue-800' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}
                    >
                        오늘
                    </button>
                </div>
                
                <div className="grid grid-cols-7 mb-2 text-center text-xs font-bold uppercase tracking-widest">
                    {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                        <span key={d} className={i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'opacity-40'}>{d}</span>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 mb-4">{days}</div>
                
                <button type="button" onClick={onClose} className={`w-full py-4 rounded-xl font-bold text-lg mb-2 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>닫기</button>
                
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto opacity-50" />
            </div>
        </div>
    );
};

const DataEntryForm = ({ 
    handleSubmit, 
    date, setDate, handleDateChange, dateInputRef, 
    formType, setFormType, isDarkMode, entryToEdit,
    unitPrice, setUnitPrice, 
    formData, handleInputChange, 
    incomeConfig, expenseConfig,
    favoriteUnitPrices,
    onNavigate,
    setFormData // 🔥 App.js에서 전달받은 setFormData 사용
}) => {
    const navigate = useNavigate();
    const [selectedExtraKeys, setSelectedExtraKeys] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedItemPrices, setSelectedItemPrices] = useState({});
    const [openDropdownKey, setOpenDropdownKey] = useState(null);
    const [currentRound, setCurrentRound] = useState(null);
    const [viewMode, setViewMode] = useState('form'); 
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const touchStartX = useRef(null);
    const touchEndX = useRef(null);
    const minSwipeDistance = 50;

    const safeNum = (val) => {
        if (!val) return 0;
        const num = Number(String(val).replace(/,/g, '').trim());
        return isNaN(num) ? 0 : num;
    };

    const getTodayLocal = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const boxBottomLineClass = formType === 'income' 
        ? 'focus-within:border-b-red-500' 
        : 'focus-within:border-b-blue-500';

    const handleBoxClick = (key) => {
        const input = document.getElementById(`input-${key}`);
        if (input) input.focus();
    };

    useEffect(() => {
        if (!entryToEdit) {
            setUnitPrice('');
            setFormType('income');
            setTimeout(() => {
                if (handleInputChange) {
                    const allConfigItems = [...(incomeConfig||[]), ...(expenseConfig||[])];
                    allConfigItems.forEach(item => handleInputChange(item.key, 0));
                }
            }, 0);
        }
    }, [entryToEdit]);

    useEffect(() => {
        const handleAndroidBack = () => setViewMode('form');
        window.addEventListener('popstate', handleAndroidBack);
        return () => window.removeEventListener('popstate', handleAndroidBack);
    }, []);

    useEffect(() => {
        setCurrentRound(null); 
    }, [formType, date]);

    useEffect(() => {
        const initialPrices = {};
        const items = incomeConfig || [];
        if (formType === 'income') {
            items.forEach(item => {
                if (item.useCustomPrice && Array.isArray(item.customPrice) && item.customPrice.length > 0) {
                    if (item.customPrice.length === 1) initialPrices[item.key] = item.customPrice[0];
                    else initialPrices[item.key] = 0; 
                }
            });
        }
        setSelectedItemPrices(prev => ({ ...prev, ...initialPrices }));
    }, [incomeConfig, formType]);

    useEffect(() => {
        if (entryToEdit) {
            const keysWithValues = Object.keys(formData).filter(key => formData[key] > 0);
            setSelectedExtraKeys(keysWithValues);
        }
    }, [entryToEdit, formData]);

    const handleFocus = (e) => {
    const target = e.target;
    
    // 🔥 [추가] 입력칸을 누르면 기존 숫자를 '전체 선택' 상태로 만듦
    // 이러면 사용자가 숫자를 누르는 순간 기존 값이 덮어씌워짐 (0을 지울 필요 없음)
    target.select(); 

    setTimeout(() => { 
        const rect = target.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const absoluteTop = rect.top + scrollTop;
        const offset = window.innerHeight * 0.35; 
        window.scrollTo({ top: absoluteTop - offset, behavior: 'smooth' });
    }, 300);
};

    const toggleExtraItem = (key) => {
        setSelectedExtraKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const handleItemPriceSelect = (key, price) => {
        setSelectedItemPrices(prev => ({ ...prev, [key]: price }));
        setOpenDropdownKey(null); 
    };

    const handleRoundClick = (round) => {
        if (currentRound === round) setCurrentRound(null); 
        else setCurrentRound(round);
    };

    const handleOpenCalculator = () => {
        if (!currentRound || currentRound === 1) {
            alert("계산기는 2회전 이상부터 사용할 수 있습니다.");
            return;
        }
        window.history.pushState({ page: 'calculator' }, '', '#calculator'); 
        setViewMode('calculator');
    };

    const handleCalculatorBack = useCallback(() => {
        window.history.back(); 
    }, []);

    const handleCalculatorApply = (results) => {
        const newExtraKeys = [...selectedExtraKeys];
        Object.keys(results).forEach(key => {
            if (handleInputChange) handleInputChange(key, results[key]);
            const item = incomeConfig.find(i => i.key === key);
            if (item && !item.isVisible && !newExtraKeys.includes(key)) {
                newExtraKeys.push(key);
            }
        });
        setSelectedExtraKeys(newExtraKeys);
        window.history.back(); 
    };

    const onFormSubmit = (e) => {
        e.preventDefault();
        const customItems = [];
        
        // 🔥 [혼합 방지] 현재 탭(formType)에 해당하는 Config만 순회하여 저장
        if (formType === 'income' && incomeConfig) {
            incomeConfig.forEach(item => {
                const qty = safeNum(formData[item.key]); 
                if (qty > 0 && !LEGACY_KEYS.includes(item.key)) {
                    let finalUnitPrice = 0;
                    if (item.useCustomPrice) {
                        finalUnitPrice = selectedItemPrices[item.key] || 0;
                    } else {
                        finalUnitPrice = parseFloat(unitPrice) || 0;
                    }
                    customItems.push({
                        key: item.key, name: item.label, amount: 0, type: 'income', unitPrice: finalUnitPrice, count: qty 
                    });
                }
            });
        } 
        else if (formType === 'expense' && expenseConfig) {
            expenseConfig.forEach(item => {
                const cost = safeNum(formData[item.key]); 
                if (cost > 0 && !LEGACY_KEYS.includes(item.key)) {
                    customItems.push({
                        key: item.key, name: item.label, amount: cost, type: 'expense'
                    });
                }
            });
        }

        handleSubmit(e, currentRound, customItems); 
    };

    const calculatedTotal = useMemo(() => {
        let total = 0;
        // 계산 시에도 현재 탭만 계산 (미리보기 혼동 방지)
        if (formType === 'income' && incomeConfig) {
            incomeConfig.forEach(item => {
                const qty = safeNum(formData[item.key]);
                if (qty > 0) {
                    let appliedPrice = item.useCustomPrice ? (selectedItemPrices[item.key] || 0) : parseFloat(unitPrice || 0);
                    total += qty * appliedPrice;
                }
            });
        } else if (formType === 'expense' && expenseConfig) {
            expenseConfig.forEach(item => {
                const cost = safeNum(formData[item.key]);
                total -= cost; // 지출은 마이너스로 표기
            });
        }
        return total;
    }, [formData, incomeConfig, expenseConfig, unitPrice, selectedItemPrices, formType]); // formType 의존성 추가

    // 🔥 [초기화 로직] 탭 전환 핸들러
    const handleTabSwitch = (type) => {
        setFormType(type);
        setFormData({}); // 입력값 초기화
        setSelectedExtraKeys([]); 
        setIsMenuOpen(false); 
        setOpenDropdownKey(null);
    };

    const renderItemBox = (item, isHiddenItem = false) => {
        const inputId = `input-${item.key}`;
        let priceBadge = null;
        
        if (formType === 'income') {
            if (item.useCustomPrice && Array.isArray(item.customPrice) && item.customPrice.length > 0) {
                if (item.customPrice.length === 1) {
                    priceBadge = <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200 whitespace-nowrap">{item.customPrice[0]}</span>;
                } else {
                    const selected = selectedItemPrices[item.key];
                    priceBadge = (
                        <div className="relative inline-block">
                            <button type="button" onClick={(e) => { e.stopPropagation(); setOpenDropdownKey(openDropdownKey === item.key ? null : item.key); }} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap flex items-center gap-0.5 transition-colors ${selected > 0 ? 'bg-red-100 text-red-600 border-red-200' : 'bg-yellow-100 text-yellow-600 border-yellow-200 animate-pulse'}`}>
                                {selected > 0 ? `${selected}` : '단가선택'} <ChevronDown size={10} />
                            </button>
                            {openDropdownKey === item.key && (
                                <div className={`absolute right-0 top-full mt-1 min-w-[80px] rounded shadow-xl border overflow-hidden z-[999] animate-in zoom-in-95 duration-100 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}>
                                    {item.customPrice.map((p, idx) => (
                                        <button key={idx} type="button" onClick={() => handleItemPriceSelect(item.key, p)} className={`w-full text-right px-3 py-1.5 text-xs font-bold transition-colors ${selectedItemPrices[item.key] === p ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : (isDarkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-white')}`}>{p}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                }
            } else {
                priceBadge = <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${isDarkMode ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-white text-gray-500 border-gray-200'}`}>{unitPrice || 0}</span>;
            }
        }

        const containerClass = isHiddenItem 
            ? `p-2 rounded-lg border border-red-400 border-b-4 border-b-transparent animate-in zoom-in duration-200 cursor-pointer ${isDarkMode ? 'bg-red-900/20' : 'bg-red-50'} ${boxBottomLineClass}`
            : `relative p-2 rounded-lg border border-gray-300 border-b-4 border-b-transparent cursor-pointer transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white shadow-sm'} ${boxBottomLineClass}`;

        return (
            <div key={item.key} className={containerClass} onClick={() => handleBoxClick(item.key)} style={{ zIndex: openDropdownKey === item.key ? 50 : 1 }}>
                <div className="flex justify-between items-center mb-0.5">
                    <label className={`text-[11px] font-bold truncate flex-1 text-left ${isDarkMode ? (isHiddenItem ? 'text-red-300' : 'text-white') : (isHiddenItem ? 'text-red-600' : 'text-black')}`}>{item.label}</label>
                    <div className="flex-none ml-1">{priceBadge}</div>
                </div>
                <input id={inputId} type="text" inputMode="numeric" value={formatNumber(formData[item.key])} onChange={(e) => handleInputChange(item.key, unformatNumber(e.target.value))} onFocus={handleFocus} className={`w-full h-8 text-xl font-bold bg-transparent outline-none text-right ${isDarkMode ? 'text-white' : 'text-black'}`} placeholder="0" />
            </div>
        );
    };

    const onTouchStart = (e) => { touchEndX.current = null; touchStartX.current = e.targetTouches[0].clientX; };
    const onTouchMove = (e) => { touchEndX.current = e.targetTouches[0].clientX; };
    const onTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        const distance = touchStartX.current - touchEndX.current;
        if (distance > minSwipeDistance) { 
            if (formType === 'income') handleTabSwitch('expense'); 
            else if (formType === 'expense' && onNavigate) onNavigate('list'); 
        } else if (distance < -minSwipeDistance) {
            if (formType === 'expense') handleTabSwitch('income'); 
        }
    };

    const bgThemeSelected = formType === 'income' ? 'bg-red-600 text-white shadow-md border-transparent' : 'bg-blue-600 text-white shadow-md border-transparent';
    const bgThemeUnselected = isDarkMode ? 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700' : `bg-white ${formType === 'income' ? 'text-red-600 border-red-200' : 'text-blue-600 border-blue-200'} hover:bg-gray-50`;

    const primaryItems = (formType === 'income' ? (incomeConfig || []) : (expenseConfig || [])).filter(item => item.isVisible !== false);
    const hiddenItems = (formType === 'income' ? (incomeConfig || []) : (expenseConfig || [])).filter(item => item.isVisible === false);

    if (viewMode === 'calculator') return <CalculatorPage onBack={handleCalculatorBack} onApply={handleCalculatorApply} date={date} currentRound={currentRound} incomeConfig={incomeConfig} isDarkMode={isDarkMode} />;

    return (
        <form onSubmit={onFormSubmit} className={`w-full h-full flex flex-col pb-20 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`} onClick={() => setOpenDropdownKey(null)} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            
            {isCalendarOpen && (
                <TopSheetCalendar 
                    currentDate={date} 
                    onClose={() => setIsCalendarOpen(false)} 
                    onSelect={(newDate) => { setDate(newDate); setIsCalendarOpen(false); }}
                    isDarkMode={isDarkMode}
                />
            )}

            <div className={`relative py-1 px-1 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                <div className="flex items-center justify-center space-x-6 mb-1">
                    <button type="button" onClick={() => handleDateChange(-1)} className={`p-2 rounded-full ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>◀</button>
                    <div className="relative group cursor-pointer" onClick={() => setIsCalendarOpen(true)}>
                        <div className={`text-2xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{date}</div>
                    </div>
                    <button type="button" onClick={() => handleDateChange(1)} className={`p-2 rounded-full ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>▶</button>
                </div>

                <div className={`flex p-1 mb-2 rounded-lg mx-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    {/* 🔥 [수정] 탭 버튼 클릭 시 handleTabSwitch 호출 */}
                    <button type="button" onClick={() => handleTabSwitch('income')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${formType === 'income' ? 'bg-red-600 text-white shadow' : (isDarkMode ? 'text-slate-400' : 'text-slate-600')}`}>수익</button>
                    <button type="button" onClick={() => handleTabSwitch('expense')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${formType === 'expense' ? 'bg-blue-600 text-white shadow' : (isDarkMode ? 'text-slate-400' : 'text-slate-600')}`}>지출</button>
                </div>

                {formType === 'income' ? (
                    <div className="flex justify-between items-center px-2 mb-2">
                        <div className="flex gap-1.5">
                            {[1, 2, 3].map(round => (
                                <button key={round} type="button" onClick={() => handleRoundClick(round)} className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${currentRound === round ? bgThemeSelected : bgThemeUnselected}`}>{round}회전</button>
                            ))}
                        </div>
                        <button type="button" onClick={handleOpenCalculator} className="px-3 py-1 text-xs font-bold rounded-full border border-black bg-black text-yellow-400 animate-pulse shadow-md">계산하기</button>
                    </div>
                ) : <div className="h-[34px] mb-2" />}

                {formType === 'income' && (
                    <div className={`mx-2 p-2 rounded-xl border mb-1 border-b-4 border-b-transparent transition-colors duration-200 ${boxBottomLineClass} ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300 shadow-sm'}`} onClick={() => document.getElementById('unit-price-input').focus()}>
                        <div className="flex justify-between items-center mb-1">
                            <label className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>공통 단가 (원)</label>
                            <div className="flex gap-1">
                                {(favoriteUnitPrices || []).map((price) => (
                                    <button key={price} type="button" onClick={(e) => {e.stopPropagation(); setUnitPrice(price.toString());}} className={`px-2 py-0.5 text-[10px] rounded border font-extrabold ${unitPrice === price.toString() ? 'bg-black !text-yellow-400 border-yellow-400' : isDarkMode ? 'bg-gray-700 text-white border-gray-500' : 'bg-gray-100 text-black border-gray-400'}`}>{price}</button>
                                ))}
                            </div>
                        </div>
                        <input id="unit-price-input" type="text" inputMode="numeric" value={formatNumber(unitPrice)} onChange={(e) => setUnitPrice(unformatNumber(e.target.value))} onFocus={handleFocus} className={`w-full h-10 text-xl font-bold bg-transparent outline-none ${isDarkMode ? 'text-white' : 'text-black'}`} placeholder="0" />
                    </div>
                )}
            </div>

            <div className={`flex-1 overflow-y-auto px-2 space-y-1 pt-2 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                <div className="grid grid-cols-2 gap-3">
                    {primaryItems.map((item) => renderItemBox(item, false))}
                    {hiddenItems.map((item) => (selectedExtraKeys.includes(item.key) && renderItemBox(item, true)))}
                </div>
                {hiddenItems.length > 0 && (
                    <div className="mt-4 pb-24">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className={`w-full py-2.5 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 font-bold text-sm transition-all ${isDarkMode ? 'border-slate-700 text-slate-400 bg-slate-800/40 hover:bg-slate-800' : 'border-slate-300 text-slate-500 bg-white hover:bg-white'}`}>
                            {isMenuOpen ? <ChevronUp size={18} /> : <Plus size={18} />} 
                            {isMenuOpen ? '항목 선택 닫기' : '기타 항목 입력하기'}
                    </button>
                    {isMenuOpen && (
                        <div className={`mt-2 p-3 rounded-xl border animate-in slide-in-from-top-2 duration-200 ${isDarkMode ? 'bg-gray-800 border-gray-700 shadow-2xl' : 'bg-white border-gray-200 shadow-lg'}`}>
                            <div className="flex flex-wrap gap-2">
                                {hiddenItems.map(item => (
                                    <button key={item.key} type="button" onClick={() => toggleExtraItem(item.key)} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${selectedExtraKeys.includes(item.key) ? (formType === 'income' ? 'bg-red-600 text-white shadow-md' : 'bg-blue-600 text-white shadow-md') : isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600'}`}>
                                        {selectedExtraKeys.includes(item.key) && <Check size={14} />} {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 🔥 [추가] 특이사항 메모 입력창 */}
            <div className={`mt-4 mx-2 p-3 rounded-xl border mb-24 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300 shadow-sm'}`}>
                <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    📝 특이사항 / 메모
                </label>
                <textarea
                    value={formData['memo'] || ''}
                    onChange={(e) => handleInputChange('memo', e.target.value)}
                    placeholder="예: 비가 많이 와서 지연됨, 차량 정비 등"
                    rows={2}
                    className={`w-full bg-transparent outline-none resize-none text-sm font-medium leading-relaxed ${isDarkMode ? 'text-white placeholder-gray-600' : 'text-black placeholder-gray-400'}`}
                />
            </div>

        </div>

            <div className={`fixed bottom-[70px] left-0 right-0 p-2 px-4 ${isDarkMode ? 'bg-slate-900/95 border-t border-slate-800' : 'bg-white/95 border-t border-slate-200'} backdrop-blur-sm z-30`}>
                <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                    <div className="flex flex-col ml-2">
                        <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>예상 합계</span>
                        {/* 🔥 [수정] 예상 합계 계산된 값 표시 (마이너스 포함) */}
                        <div className={`text-lg font-black flex items-center gap-1 ${calculatedTotal > 0 ? 'text-red-500' : (calculatedTotal < 0 ? 'text-blue-500' : 'text-gray-400')}`}>
                            <Calculator size={16} /> {calculatedTotal.toLocaleString()}원
                        </div>
                    </div>
                    <button type="submit" className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-md active:scale-95 transition-transform flex items-center gap-2 text-sm ${formType === 'income' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        <Save size={18} /> {entryToEdit ? '수정 완료' : '저장하기'}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default DataEntryForm;