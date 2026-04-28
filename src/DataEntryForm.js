import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Save, Plus, ChevronDown, ChevronUp, Check, Calculator, ChevronLeft, ChevronRight, X, Loader2, Camera } from 'lucide-react';
import CalculatorPage from './CalculatorPage'; 
import { useNavigate } from 'react-router-dom';
import InstallmentPage from './InstallmentPage';
import { useDelivery } from './contexts/DeliveryContext';
import InstallmentManagePage from './InstallmentManagePage';


const formatNumber = (num) => {
    if (!num && num !== 0) return '';
    const stringNum = String(num).replace(/,/g, '');
    return stringNum.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const unformatNumber = (str) => {
    return str.replace(/,/g, '');
};

// ----------------------------------------------------------------------
// 달력 컴포넌트
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// 메인 입력 폼 컴포넌트
// ----------------------------------------------------------------------
const DataEntryForm = ({ 
    handleSubmit, 
    date, setDate, handleDateChange, dateInputRef, 
    formType, setFormType, isDarkMode, entryToEdit,
    unitPrice, setUnitPrice, 
    formData, handleInputChange, 
    incomeConfig, expenseConfig,
   
    favoriteUnitPrices,
    onNavigate,
    setFormData,
    entries,
    onGoToExpenseSettings
}) => {
    const navigate = useNavigate();

    const { saveEntry, deleteEntry } = useDelivery();
    const [selectedExtraKeys, setSelectedExtraKeys] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedItemPrices, setSelectedItemPrices] = useState({});
    const [openDropdownKey, setOpenDropdownKey] = useState(null);
    const [currentRound, setCurrentRound] = useState(null);
    const [viewMode, setViewMode] = useState('form'); 
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    
    // 스크롤 컨테이너 참조
    const listContainerRef = useRef(null);
    const roundScrollRef = useRef(null);
    const touchStartX = useRef(null);
    const touchEndX = useRef(null);
    const minSwipeDistance = 50;

    const safeNum = (val) => {
        if (!val) return 0;
        const num = Number(String(val).replace(/,/g, '').trim());
        return isNaN(num) ? 0 : num;
    };

    const handleBoxClick = (key) => {
        const input = document.getElementById(`input-${key}`);
        if (input) input.focus();
    };

    const boxBottomLineClass = `border-b-2 ${isDarkMode ? '!border-gray-900' : '!border-gray-200'} focus-within:!border-yellow-300 transition-colors duration-200`;

    // ✨ [수정 완료] 키패드가 올라올 때 입력창을 화면 상위 30% 위치로 부드럽게 이동시키는 함수
    const handleFocus = (e) => {
        let targetElement = e.target;
        
        // 1. 클릭한 입력창을 감싸는 부모 박스 찾기 (공통 단가, 개별 항목, 메모 모두 호환)
        targetElement = targetElement.closest('.relative, .rounded-xl, .p-4') || targetElement;

        setTimeout(() => {
            if (targetElement) {
                // 2. '진짜로' 스크롤이 발생하고 있는 컨테이너 찾기
                let container = targetElement.parentElement;
                while (container) {
                    const style = window.getComputedStyle(container);
                    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && container.scrollHeight > container.clientHeight + 10) {
                        break;
                    }
                    container = container.parentElement;
                }

                // 3. 진짜 컨테이너를 찾았다면 정확히 상위 30%로 이동
                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const elementRect = targetElement.getBoundingClientRect();
                    
                    const targetScrollTop = container.scrollTop + (elementRect.top - containerRect.top) - (container.clientHeight * 0.20);
                    
                    container.scrollTo({
                        top: targetScrollTop,
                        behavior: 'smooth'
                    });
                } else {
                    // 최후의 방법 (만약 컨테이너를 못 찾으면 기본 스크롤 중앙 정렬 사용)
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 450); 
    };

    // [초기화] 값이 없으면 ''(빈칸)으로 설정
    useEffect(() => {
        if (!entryToEdit) {
            setUnitPrice('');
            setFormType('income');
            setTimeout(() => {
                if (handleInputChange) {
                    const allConfigItems = [...(incomeConfig||[]), ...(expenseConfig||[])];
                    allConfigItems.forEach(item => handleInputChange(item.key, ''));
                }
            }, 0);
        }
    }, [entryToEdit]);

    // ✨ [추가] 공통 단가가 딱 1개만 있으면 자동으로 선택 (2개 이상이면 무시)
    useEffect(() => {
        if (!entryToEdit && favoriteUnitPrices && favoriteUnitPrices.length === 1) {
            setUnitPrice(favoriteUnitPrices[0].toString());
        }
    }, [favoriteUnitPrices, entryToEdit, setUnitPrice]);

    useEffect(() => {
        const handleAndroidBack = () => setViewMode('form');
        window.addEventListener('popstate', handleAndroidBack);
        return () => window.removeEventListener('popstate', handleAndroidBack);
    }, []);

    // ✅ (자동 회차 선택 로직) - 덮어씌울 새로운 코드
    useEffect(() => {
        // 1. 수정 모드일 때는 원래 데이터의 회차를 그대로 보여줌
        if (entryToEdit) {
            setCurrentRound(Number(entryToEdit.round) || 1);
            return;
        }

        // 2. 수익(income) 탭이고, 전체 데이터가 잘 들어왔을 때만 다음 회차 계산
        if (formType === 'income' && entries && Array.isArray(entries)) {
            // 현재 달력에 선택된 날짜의 '수익' 데이터만 쏙 빼냅니다.
            const todaysEntries = entries.filter(e => e.date === date && e.type === 'income');
            
            // 가장 높은 회차 번호를 찾습니다. (데이터가 없으면 0)
            // ✨ [핵심] 과거 데이터가 문자열("2")로 저장되어 있어도 꼬이지 않게 Number()로 안전하게 변환!
            const maxRound = todaysEntries.reduce((max, e) => {
                const r = Number(e.round) || 0; 
                return r > max ? r : max;
            }, 0);
            
            // 다음 회차 = 최대 회차 + 1 
            let nextRound = maxRound + 1;

            // 드디어 정확하게 계산된 다음 회차를 선택합니다!
            setCurrentRound(nextRound);
        } else {
            // 지출 탭이거나 데이터가 없으면 선택 해제
            setCurrentRound(null);
        }
    }, [date, entries, formType, entryToEdit]);

    // [추가] 회차가 변경되면 해당 버튼이 보이도록 스크롤 자동 이동
    useEffect(() => {
        if (currentRound && roundScrollRef.current) {
            // 현재 회차에 해당하는 버튼 찾기 (data-round 속성 이용)
            const activeBtn = roundScrollRef.current.querySelector(`[data-round="${currentRound}"]`);
            
            if (activeBtn) {
                // 부드럽게 해당 버튼을 화면 중앙으로 이동
                activeBtn.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center' 
                });
            }
        }
    }, [currentRound]);

    useEffect(() => {
        const initialPrices = {};
        const items = incomeConfig || [];
        
        if (formType === 'income') {
            items.forEach(item => {
                if (item.useCustomPrice && Array.isArray(item.customPrice) && item.customPrice.length === 1) {
                    initialPrices[item.key] = item.customPrice[0];
                }
            });
        }
        
        setSelectedItemPrices(prev => {
            const next = { ...prev };
            
            // 1. 설정에 있는 기본 단가 채우기 (비어있을 때만)
            Object.keys(initialPrices).forEach(key => {
                if (next[key] === undefined || next[key] === '') {
                    next[key] = initialPrices[key];
                }
            });

            // 2. ✨ 수정 모드일 때: 예전에 저장했던 개별 단가로 완벽하게 덮어쓰기!
            if (entryToEdit && entryToEdit.customItems) {
                entryToEdit.customItems.forEach(item => {
                    if (item.type === 'income' && item.unitPrice > 0) {
                        next[item.key] = item.unitPrice.toString();
                    }
                });
            }
            
            return next;
        });
    }, [incomeConfig, formType, entryToEdit]); // ✨ 의존성에 entryToEdit 추가

    useEffect(() => {
        if (entryToEdit) {
            const keysWithValues = Object.keys(formData).filter(key => formData[key] > 0);
            setSelectedExtraKeys(keysWithValues);
        }
    }, [entryToEdit, formData]);

    const toggleExtraItem = (key) => {
        setSelectedExtraKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const handleItemPriceChange = (key, value) => {
        const numValue = unformatNumber(value);
        setSelectedItemPrices(prev => ({ ...prev, [key]: numValue }));
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

    // ✨ 할부 페이지 컨트롤용 함수
    const handleOpenInstallment = () => {
        window.history.pushState({ page: 'installment' }, '', '#installment');
        setViewMode('installment');
    };

    const handleInstallmentBack = useCallback(() => {
        window.history.back(); // 뒤로가기 연동
    }, []);

    const handleInstallmentApply = (entriesToSave) => {
        entriesToSave.forEach(entry => saveEntry(entry));
        window.history.back(); // 저장 후 자동으로 닫기 (지출 탭 유지)
    };


    const onFormSubmit = (e) => {
        e.preventDefault();
        const customItems = [];
        
        if (formType === 'income' && incomeConfig) {
            for (const item of incomeConfig) {
                const qty = safeNum(formData[item.key]); 
                
                // ✨ 수정 포인트: 옛날방식(isLegacy) 조건 삭제! 모든 데이터를 customItems로 넣습니다.
                if (qty > 0) {
                  let finalUnitPrice = 0;
if (selectedItemPrices[item.key] !== undefined && selectedItemPrices[item.key] !== '') {
    finalUnitPrice = parseFloat(selectedItemPrices[item.key]);
} 
else if (item.useCustomPrice) {
    // ✨ 개별 항목은 공통 단가 무시!
    if (item.customPrice && item.customPrice.length === 1) {
        finalUnitPrice = item.customPrice[0];
    } else {
        finalUnitPrice = 0; 
    }
} 
else {
    finalUnitPrice = parseFloat(unitPrice) || 0;
}
                    
                    if (finalUnitPrice <= 0) {
                        alert(`'${item.label}' 항목의 단가가 0원입니다.\n단가를 입력해주세요.`);
                        return;
                    }
                    
                    customItems.push({
                        key: item.key, name: item.label, amount: 0, type: 'income', unitPrice: finalUnitPrice, count: qty 
                    });
                }
            }
        } 
        else if (formType === 'expense' && expenseConfig) {
            expenseConfig.forEach(item => {
                const cost = safeNum(formData[item.key]); 
                // ✨ 수정 포인트: 지출에서도 옛날방식 방해물 삭제!
                if (cost > 0) {
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
        if (formType === 'income' && incomeConfig) {
            incomeConfig.forEach(item => {
                const qty = safeNum(formData[item.key]);
                if (qty > 0) {
                    let appliedPrice = 0;
if (selectedItemPrices[item.key] !== undefined && selectedItemPrices[item.key] !== '') {
    appliedPrice = parseFloat(selectedItemPrices[item.key]);
} 
else if (item.useCustomPrice) {
    // ✨ 개별 항목은 공통 단가 무시!
    if (item.customPrice && item.customPrice.length === 1) {
        appliedPrice = item.customPrice[0];
    } else {
        appliedPrice = 0; 
    }
} 
else {
    appliedPrice = parseFloat(unitPrice) || 0;
}
                    total += qty * appliedPrice;
                }
            });
        } else if (formType === 'expense' && expenseConfig) {
            expenseConfig.forEach(item => {
                const cost = safeNum(formData[item.key]);
                total -= cost; 
            });
        }
        return total;
    }, [formData, incomeConfig, expenseConfig, unitPrice, selectedItemPrices, formType]);

    const handleTabSwitch = (type) => {
        setFormType(type);
        setFormData({}); 
        setSelectedExtraKeys([]); 
        setIsMenuOpen(false); 
        setOpenDropdownKey(null);
    };

    const renderItemBox = (item, isHiddenItem = false) => {
        const inputId = `input-${item.key}`;
        
       let currentPriceValue = '';
let isCustom = false; 

if (selectedItemPrices[item.key] !== undefined && selectedItemPrices[item.key] !== '') {
    currentPriceValue = selectedItemPrices[item.key];
    isCustom = true;
} 
else if (item.useCustomPrice) {
    // ✨ 개별 항목은 공통 단가 표시 안 함 (비워둠)
    if (item.customPrice && item.customPrice.length === 1) {
        currentPriceValue = item.customPrice[0];
    } else {
        currentPriceValue = ''; 
    }
    isCustom = true;
} 
else {
    currentPriceValue = unitPrice; 
    isCustom = false;
}

        const hasOptions = item.customPrice && item.customPrice.length > 0;

        const priceComponent = (
            <div className="flex flex-col w-full gap-1 justify-end h-full">
                 {hasOptions && (
                    <div className="flex gap-1 overflow-x-auto no-scrollbar justify-center mb-0.5">
                        {item.customPrice.map((p, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault(); e.stopPropagation();
                                    handleItemPriceChange(item.key, p.toString());
                                }}
                                className={`flex-none px-2 py-0.5 rounded text-[10px] font-bold border transition-colors whitespace-nowrap shadow-sm
                                    ${Number(currentPriceValue) === p
                                        ? (isDarkMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-600 text-white border-blue-600') 
                                        : 'bg-white text-gray-800 border-gray-300'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                )}
                
                <input 
                    type="text" 
                    inputMode="numeric"
                    tabIndex={-1} 
                    value={formatNumber(currentPriceValue)}
                    onChange={(e) => handleItemPriceChange(item.key, e.target.value)}
                    onClick={(e) => e.stopPropagation()} 
                    onFocus={handleFocus}
                    placeholder="단가"
                    className={`w-full h-8 text-center text-xs font-bold rounded outline-none focus:ring-1 focus:ring-blue-500 transition-colors
                        ${isDarkMode 
                            ? (isCustom ? 'bg-gray-700 text-blue-400 border border-blue-500/50' : 'bg-gray-700 text-gray-400 border border-gray-600') 
                            : (isCustom ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-gray-500 border border-transparent')
                        }`}
                />
            </div>
        );

        // 통계 카드와 똑같은 좌우 여백(px-6)과 넉넉한 높이(py-3) 적용, 배경색은 투명하게 뚫어 부모(bg-gray-700) 색을 따라가게 함
        const containerClass = isHiddenItem 
            ? `relative py-2 px-4 flex flex-row items-center gap-2 border-b border-dashed border-red-200 dark:border-red-900/50 min-h-[3.5rem] h-auto cursor-pointer bg-transparent ${boxBottomLineClass}`
            : `relative py-2 px-4 flex flex-row items-center gap-2 border-b border-gray-100 dark:border-gray-700 transition-colors min-h-[3.5rem] h-auto cursor-pointer bg-transparent last:border-b-0 ${boxBottomLineClass}`;
        return (
            <div key={item.key} className={containerClass} onClick={() => handleBoxClick(item.key)}>
                <div className="w-[30%] flex items-center overflow-hidden pl-1">
                    <label className={`text-[13px] font-bold truncate ${isDarkMode ? (isHiddenItem ? 'text-red-300' : 'text-white') : (isHiddenItem ? 'text-red-600' : 'text-black')}`}>
                        {item.label}
                    </label>
                </div>

                <div className="w-[30%] flex justify-center px-1">
                    {formType === 'income' ? priceComponent : <div className="w-full" />}
                </div>

                <div className="w-[40%]">
                    <input 
                        id={inputId} 
                        type="text" 
                        inputMode="numeric" 
                        value={formatNumber(formData[item.key])} 
                        onChange={(e) => handleInputChange(item.key, unformatNumber(e.target.value))} 
                        onFocus={handleFocus}  // 이 줄을 꼭 넣어주세요!
                        className={`w-full h-10 text-xl font-bold bg-transparent outline-none text-right ${isDarkMode ? 'text-white' : 'text-black'}`} 
                        placeholder="0" 
                    />
                </div>
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

if (viewMode === 'installment') return (
        <InstallmentPage 
            expenseConfig={expenseConfig} 
            isDarkMode={isDarkMode} 
            onBack={handleInstallmentBack} 
            onApply={handleInstallmentApply} 
            onAddCategory={() => {
                // ✨ 창을 닫지 않고, 그 위에 항목 관리 팝업만 띄웁니다! (입력 데이터 유지)
                if (onGoToExpenseSettings) onGoToExpenseSettings(); 
            }}
        />
    );

   // ✨ 새로 추가되는 할부 관리 페이지 렌더링
    if (viewMode === 'installment-manage') return (
        <InstallmentManagePage
            entries={entries}
            isDarkMode={isDarkMode}
            onBack={() => window.history.back()}
            onDeleteEntries={(entriesToDelete) => {
                // ✨ 진짜 삭제 로직: 전달받은 삭제 목록을 하나씩 돌면서 모두 지워줍니다!
                entriesToDelete.forEach(entry => {
                    if (entry.id) {
                        deleteEntry(entry.id);
                    }
                });
                
                // 삭제 완료 후 안내 및 화면 복귀
                alert(`${entriesToDelete.length}건의 일정이 성공적으로 삭제되었습니다.`);
                           }}
        />
    );
    
    return (
        <form onSubmit={onFormSubmit} className={`w-full h-full flex flex-col pb-20 font-sans overflow-y-auto ${isDarkMode ? 'bg-gray-800' : 'bg-slate-50'}`} onClick={() => setOpenDropdownKey(null)} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>     
            {isCalendarOpen && (
                <TopSheetCalendar 
                    currentDate={date} 
                    onClose={() => setIsCalendarOpen(false)} 
                    onSelect={(newDate) => { setDate(newDate); setIsCalendarOpen(false); }}
                    isDarkMode={isDarkMode}
                />
            )}

            <div className={`relative pt-2 pb-1 px-3 ${isDarkMode ? 'bg-gray-800' : 'bg-slate-50'}`}>
                <div className="flex items-center justify-center space-x-6 mb-1">
                    <button type="button" onClick={() => handleDateChange(-1)} className={`p-2 rounded-full ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>◀</button>
                    <div className="relative group cursor-pointer" onClick={() => setIsCalendarOpen(true)}>
                        <div className={`text-2xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{date}</div>
                    </div>
                    <button type="button" onClick={() => handleDateChange(1)} className={`p-2 rounded-full ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>▶</button>
                </div>

                <div className={`flex p-1 mb-3 rounded-lg w-full ${isDarkMode ? 'bg-gray-900' : 'bg-slate-200'}`}>
                    <button type="button" onClick={() => handleTabSwitch('income')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${formType === 'income' ? 'bg-red-600 text-white shadow' : (isDarkMode ? 'text-slate-400' : 'text-slate-600')}`}>수익</button>
                    <button type="button" onClick={() => handleTabSwitch('expense')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${formType === 'expense' ? 'bg-blue-600 text-white shadow' : (isDarkMode ? 'text-slate-400' : 'text-slate-600')}`}>지출</button>
                </div>

              {/* 회차 선택 및 계산하기 영역 */}
                {formType === 'income' && (
                    <div className="flex justify-between items-center w-full mb-3 gap-2">
                        {/* 가로 스크롤 영역 */}
                        <div 
                            ref={roundScrollRef}
                            className="flex-1 overflow-x-auto pb-1"
                            style={{ 
                                msOverflowStyle: 'none', 
                                scrollbarWidth: 'none',
                                WebkitOverflowScrolling: 'touch' 
                            }}
                        >
                            <style>{`
                                .hide-scrollbar::-webkit-scrollbar { display: none; }
                            `}</style>
                            
                            <div className="flex gap-1 w-max hide-scrollbar">
                                {/* ✨ 동적 생성: 현재 날짜의 최대 회차를 찾아서 버튼 갯수를 유동적으로 만듭니다 (최소 6개 유지) */}
                                {Array.from({ 
                                    length: Math.max(6, (entries || []).filter(e => e.date === date && e.type === 'income').reduce((max, e) => Math.max(max, Number(e.round) || 0), 0) + 1) 
                                }, (_, i) => i + 1).map(round => (
                                    <button 
                                        key={round} 
                                        data-round={round}
                                        type="button" 
                                        onClick={() => handleRoundClick(round)} 
                                        className={`px-2 py-1 text-xs font-bold rounded-full border transition-all flex-shrink-0 ${
                                            currentRound === round ? bgThemeSelected : bgThemeUnselected
                                        }`}
                                    >
                                        {round}회전
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* 계산하기 버튼 */}
                        <button 
                            type="button" 
                            onClick={handleOpenCalculator} 
                            className="flex-none px-2 py-1 text-xs font-bold rounded-full border border-black bg-black text-yellow-400 animate-pulse shadow-md whitespace-nowrap"
                        >
                            계산하기
                        </button>
                    </div>
)}

{formType === 'expense' && (
    // ✨ 1. 부모 상자(2칸짜리)에 '황금 비율(3.5vw)' 뼈대를 심고 최소 크기를 1px로 뚫어버립니다!
    <div className="flex justify-between items-center w-full mb-3 gap-2 text-[clamp(1px,3.5vw,15px)]">
        
        {/* ✨ 할부/정기결제 관리 버튼 */}
        <button
            type="button"
            onClick={() => {
                window.history.pushState({ page: 'installment-manage' }, '', '#installment-manage');
                setViewMode('installment-manage');
            }}
            // ✨ 2. text-xs를 지우고, whitespace-nowrap(줄바꿈 금지)를 추가합니다!
            className={`p-1.5 sm:p-2 rounded-lg font-bold border-2 flex items-center shadow-sm transition-colors flex-1 justify-center whitespace-nowrap ${
                isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
            // ✨ 3. 자식은 부모 크기에 100%(1em) 종속시킵니다.
            style={{ fontSize: '1em' }}
        >
            할부/정기결제 관리
        </button>

        {/* ✨ 고정 지출 / 할부 등록 버튼 */}
        <button
            type="button"
            onClick={handleOpenInstallment}
            className={`p-1.5 sm:p-2 rounded-lg font-bold border-2 flex items-center shadow-sm transition-colors flex-1 justify-center whitespace-nowrap ${
                isDarkMode ? 'border-blue-500 text-blue-400 hover:bg-gray-800' : 'border-blue-500 text-blue-600 hover:bg-blue-50'
            }`}
            style={{ fontSize: '1em' }}
        >
            {/* ✨ 4. Plus 아이콘도 16px 고정을 버리고 글자 크기(1.1em)에 맞춰 같이 작아지도록 수정! shrink-0로 찌그러짐 방지 */}
            <Plus style={{ width: '1.1em', height: '1.1em' }} className="mr-1 shrink-0" /> 고정 지출 / 할부 등록
        </button>
    </div>
)}

                {/* 공통 단가 입력 영역 */}
                {formType === 'income' && (
                   <div className={`w-full px-4 py-3 rounded-xl shadow mb-2 transition-colors duration-200 ${boxBottomLineClass} ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'}`}
                        onClick={() => {
                            const input = document.getElementById('unit-price-input');
                            if(input) input.focus();
                        }}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <label className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>공통 단가 (원)</label>
                            
                   
            

                            <div className="flex gap-1">
                                {(favoriteUnitPrices || []).map((price) => (
                                    <button 
                                        key={price} 
                                        type="button" 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation(); 
                                            if (unitPrice === price.toString()) setUnitPrice('');
                                            else setUnitPrice(price.toString());
                                        }} 
                                        className={`px-2 py-0.5 text-[10px] rounded border font-extrabold shadow-sm ${unitPrice === price.toString() ? 'bg-black !text-yellow-400 border-yellow-400' : 'bg-white text-gray-800 border-gray-300'}`}
                                    >
                                        {price}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <input 
                            id="unit-price-input" 
                            type="text" 
                            inputMode="numeric" 
                            value={formatNumber(unitPrice)} 
                            onChange={(e) => setUnitPrice(unformatNumber(e.target.value))} 
                            onFocus={handleFocus} 
                            className={`w-full h-10 text-xl font-bold bg-transparent outline-none ${isDarkMode ? 'text-white' : 'text-black'}`} 
                            placeholder="0" 
                        />
                    </div>
                )}
            </div>

          <div ref={listContainerRef} className={`flex-1 px-3 space-y-4 pt-2 pb-4 ${isDarkMode ? 'bg-gray-800' : 'bg-slate-50'}`}>
                  
               <div className={`w-full flex flex-col gap-0 rounded-lg shadow overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-black'}`}>
                    {primaryItems.map((item) => renderItemBox(item, false))}
                    {hiddenItems.map((item) => (selectedExtraKeys.includes(item.key) && renderItemBox(item, true)))}
                </div>
                
               {hiddenItems.length > 0 && (
                    <div className="w-full pb-0">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className={`w-full py-2.5 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 font-bold text-sm transition-all
                            ${!isMenuOpen 
                                ? (isDarkMode ? 'bg-gray-700 text-gray-200 border-amber-200 shadow-sm' : 'bg-white text-gray-600 border-amber-200 shadow-sm') 
                                : (isDarkMode ? 'border-amber-200/50 text-gray-400 bg-gray-700/40 hover:bg-gray-700' : 'border-slate-300 text-slate-500 bg-white hover:bg-white')
                            }`}>
                            {isMenuOpen ? <ChevronUp size={18} /> : <Plus size={18} />} 
                            {isMenuOpen ? '항목 선택 닫기' : '기타 항목 입력하기'}
                        </button>
                        {isMenuOpen && (
                            <div className={`mt-2 p-3 rounded-xl border animate-in slide-in-from-top-2 duration-200 ${isDarkMode ? 'bg-gray-700 border-gray-600 shadow-2xl' : 'bg-white border-gray-200 shadow-lg'}`}>
                                <div className="flex flex-wrap gap-2">
                                    {hiddenItems.map(item => (
                                        <button key={item.key} type="button" onClick={() => toggleExtraItem(item.key)} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${selectedExtraKeys.includes(item.key) ? (formType === 'income' ? 'bg-red-600 text-white shadow-md' : 'bg-blue-600 text-white shadow-md') : (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600 border border-amber-200')}`}>
                                            {selectedExtraKeys.includes(item.key) && <Check size={14} />} {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className={`w-full p-4 rounded-xl shadow transition-colors duration-200 border-2 ${isDarkMode ? 'bg-gray-700 border-green-200' : 'bg-white border-green-200'}`}>
                    <label className="block text-xs font-bold mb-1 opacity-50">📝 특이사항 / 메모</label>
                    <textarea 
                        value={formData['memo'] || ''} 
                        onChange={(e) => handleInputChange('memo', e.target.value)} 
                        onFocus={handleFocus} 
                        placeholder="메모를 입력하세요" 
                        rows={2} 
                        tabIndex="-1"
                        className={`w-full bg-transparent outline-none resize-none text-sm font-medium ${isDarkMode ? 'text-white' : 'text-black'}`} 
                    
                    />
                    
                </div>
                <div className="h-[33vh]" />
            </div>


          <div 
    className={`absolute left-0 right-0 p-2 px-4 z-30 border-t shadow-[0_-5px_15px_-3px_rgba(0,0,0,0.15)] ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'}`}
    style={{ bottom: 'calc(56px + env(safe-area-inset-bottom))' }}
>
                <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                    <div className="flex flex-col ml-2">
                        <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>예상 합계</span>
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