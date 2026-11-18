import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, Save, Coins, CheckCircle, List, Tag, ChevronDown, X } from 'lucide-react';

// ✨ 개별 항목 카드 컴포넌트
const PriceItemCard = ({ item, onSave, onDelete, isDarkMode, isActive, onClickCard, cardRef, t }) => {
    const [inputVal, setInputVal] = useState('');
    const inputRef = useRef(null); 

    useEffect(() => {
        if (Array.isArray(item.customPrice) && item.customPrice.length > 0) {
            setInputVal(item.customPrice.join(', '));
        } else if (item.customPrice) {
            setInputVal(item.customPrice.toString());
        } else {
            setInputVal('');
        }
    }, [item.customPrice]);

    const isValid = inputVal.trim() !== '' && inputVal.split(',').some(s => parseFloat(s.trim()) >= 1);

    const handleSave = (e) => {
        e.stopPropagation();
        const pricesArray = inputVal.split(',')
            .map(s => parseFloat(s.trim()))
            .filter(n => !isNaN(n));
        const validPrices = pricesArray.filter(n => n >= 1);
        if (validPrices.length === 0) {
            alert(t.alertMin1);
            return;
        }
        onSave(item.key, validPrices);
    };

    let containerStyle = !isValid 
        ? (isDarkMode ? 'bg-gray-800 border-red-500/50 shadow-none' : 'bg-red-50 border-red-300 shadow-sm')
        : (isActive 
            ? (isDarkMode ? 'bg-gray-800 border-blue-500 shadow-blue-500/20 shadow-lg' : 'bg-blue-50 border-blue-400 shadow-md ring-1 ring-blue-400')
            : (isDarkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300')
        );

    const handleCardClick = (e) => {
        onClickCard(e);
        const targetTag = e.target.tagName;
        if (targetTag !== 'INPUT' && targetTag !== 'BUTTON' && targetTag !== 'svg' && targetTag !== 'path') {
            inputRef.current?.focus();
        }
    };

    return (
        <div 
            ref={cardRef}
            onClick={handleCardClick}
            className={`relative p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${containerStyle}`}
        >
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-red-400' : 'text-gray-400 hover:bg-gray-100 hover:text-red-500'
                }`}
            >
                <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-2 pr-8">
                <div className={`p-1.5 rounded-lg ${
                    !isValid ? 'bg-red-100 text-red-500' : (isActive ? 'bg-blue-500 text-white' : (isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'))
                }`}>
                    <Tag size={16} />
                </div>
                <h3 className={`font-bold ${
                    !isValid ? 'text-red-500' : (isActive ? 'text-blue-600 dark:text-blue-400' : (isDarkMode ? 'text-gray-200' : 'text-gray-800'))
                }`}>
                    {item.label}
                </h3>
            </div>

            <div className="flex gap-1">
                <input 
                    ref={inputRef} 
                    type="text" 
                    inputMode="numeric"
                    value={inputVal}
                    onChange={(e) => {
                        const filteredValue = e.target.value.replace(/[^0-9, ]/g, '');
                        setInputVal(filteredValue);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => onClickCard(e)}
                    placeholder={t.placeholder} 
                    className={`flex-1 min-w-0 h-11 px-3 font-bold rounded-lg border outline-none text-base ${
                        isDarkMode 
                        ? 'bg-gray-900 border-gray-600 text-white focus:border-blue-500 placeholder-gray-600' 
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 placeholder-gray-400'
                    }`}
                />
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        const newVal = inputVal.trim();
                        if (newVal && !newVal.endsWith(',')) setInputVal(newVal + ', ');
                    }}
                    className={`flex-none px-3.5 h-11 rounded-lg font-black text-xl flex items-center justify-center transition-colors shadow-sm ${
                        isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300'
                    }`}
                >
                    ,
                </button>
                <button
                    onClick={handleSave}
                    className={`flex-none px-3 h-11 rounded-lg font-bold text-sm whitespace-nowrap flex items-center gap-1 ${
                        !isValid
                        ? (isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-white border border-red-200 text-red-400')
                        : (isActive ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-800 hover:bg-gray-900 text-white'))
                    }`}
                >
                    <Save size={16} /> {t.save}
                </button>
            </div>

            <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex flex-wrap gap-2">
                    {item.customPrice && (Array.isArray(item.customPrice) ? item.customPrice : [item.customPrice]).map((price, idx) => (
                        <span key={idx} className={`px-2 py-1 rounded-md text-xs font-bold border ${
                            isActive 
                            ? 'bg-blue-100 text-blue-700 border-blue-200' 
                            : (isDarkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-600 border-gray-300')
                        }`}>
                            {price}
                        </span>
                    ))}
                    {(!isValid) && (
                        <span className="text-xs text-red-500 font-bold flex items-center gap-1">
                            ! {t.errorMin1}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const UnitPriceView = ({ 
    onBack, 
    isDarkMode, 
    adminFavoritePricesInput, 
    setAdminFavoritePricesInput, 
    handleSaveFavoritePrices, 
    favoriteUnitPrices,
    targetItemKey,
    incomeConfig,
    setIncomeConfig
}) => {
    const targetRef = useRef(null);
    const cardRefs = useRef({});
    const scrollTimerRef = useRef(null);
    const commonInputRef = useRef(null); // ✨ [추가] 공통 단가 입력창 참조

    const [activeCardKey, setActiveCardKey] = useState(targetItemKey);
    const [activeFavPrice, setActiveFavPrice] = useState(null);

    const getCardRef = (key) => {
        if (!cardRefs.current[key]) {
            cardRefs.current[key] = React.createRef();
        }
        return cardRefs.current[key];
    };

    const handleBoxClick = useCallback((key) => {
        setActiveCardKey(key);

        const cardEl = key === 'common' 
            ? document.getElementById('common-fav-box') 
            : cardRefs.current[key]?.current;

        if (!cardEl) return;

        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);

        scrollTimerRef.current = setTimeout(() => {
            let container = cardEl.parentElement;
            let foundContainer = null;

            while (container) {
                const style = window.getComputedStyle(container);
                if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && container.scrollHeight > container.clientHeight + 10) {
                    foundContainer = container;
                    break;
                }
                container = container.parentElement;
            }

            if (foundContainer) {
                const containerRect = foundContainer.getBoundingClientRect();
                const elementRect = cardEl.getBoundingClientRect();
                const targetScrollTop = foundContainer.scrollTop + (elementRect.top - containerRect.top) - (foundContainer.clientHeight * 0.20);
                
                foundContainer.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
            } else {
                const elementRect = cardEl.getBoundingClientRect();
                const targetScrollTop = window.scrollY + elementRect.top - (window.innerHeight * 0.20);
                window.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
            }
        }, 350);
    }, []);

    useEffect(() => {
        return () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); };
    }, []);

    const isKo = useMemo(() => navigator.language.toLowerCase().includes('ko'), []);
    const t = {
        title: isKo ? "단가 설정" : "Unit Price Settings",
        commonList: isKo ? "공통 즐겨찾기 목록" : "Common Favorites",
        commonDesc: isKo ? "메인 화면 상단에 뜨는 단가 목록" : "Price list shown on main screen",
        commonHint: isKo ? "눌러서 목록 수정하기" : "Tap to edit list",
        placeholder: isKo ? "예: 700, 750, 800" : "Ex: 700, 750, 800",
        saveFav: isKo ? "즐겨찾기 저장" : "Save Favorites",
        preview: isKo ? "현재 즐겨찾기 미리보기:" : "Current Favorites Preview:",
        individualTitle: isKo ? "개별 항목 단가" : "Individual Item Prices",
        individualDesc: isKo ? "항목별 단가 수정" : "Edit prices per item",
        alertMin1: isKo ? "❗ 1이상 입력해주세요." : "❗ Please enter 1 or more.",
        save: isKo ? "저장" : "Save",
        errorMin1: isKo ? "1원 이상 입력 필요" : "Must be >= 1",
        deleteConfirm: (label) => isKo 
            ? `'${label}' 항목의 단가 설정을 삭제하시겠습니까?\n(항목 관리에서 '버튼 없음' 상태로 변경됩니다)` 
            : `Delete unit price settings for '${label}'?\n(Will be set to 'Button OFF' in Item Management)`,
        noButtons: isKo ? "설정된 개별 버튼이 없습니다." : "No individual buttons set.",
        noButtonsHint: isKo ? "'항목 관리'에서 버튼을 표시하면 여기에 나타납니다." : "Enable buttons in 'Item Management' to see them here."
    };

    const safeCommonInput = adminFavoritePricesInput || '';
    const isCommonValid = safeCommonInput.trim() !== '' && 
                          safeCommonInput.split(',').some(s => parseFloat(s.trim()) >= 1);

    useEffect(() => {
        if (targetItemKey) setActiveCardKey(targetItemKey);
    }, [targetItemKey]);

    const [isFavExpanded, setIsFavExpanded] = useState(() => {
        const saved = localStorage.getItem('unitPrice_favExpanded');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const toggleFavExpanded = () => {
        const newState = !isFavExpanded;
        setIsFavExpanded(newState);
        localStorage.setItem('unitPrice_favExpanded', JSON.stringify(newState));
    };

    const [isIndividualExpanded, setIsIndividualExpanded] = useState(() => {
        const saved = localStorage.getItem('unitPrice_individualExpanded');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const toggleIndividualExpanded = () => {
        const newState = !isIndividualExpanded;
        setIsIndividualExpanded(newState);
        localStorage.setItem('unitPrice_individualExpanded', JSON.stringify(newState));
    };

    const enabledItems = incomeConfig.filter(item => item.useCustomPrice).sort((a, b) => {
        if (a.key === targetItemKey) return -1;
        if (b.key === targetItemKey) return 1;
        return 0;
    });

    const hasInvalidItems = enabledItems.some(item => {
        const price = item.customPrice;
        if (price === undefined || price === null) return true;
        if (Array.isArray(price)) {
            if (price.length === 0) return true;
            return !price.some(p => p >= 1);
        }
        const numPrice = parseFloat(price);
        return isNaN(numPrice) || numPrice < 1;
    });

    const handleSaveItemPrice = (key, newPricesArray) => {
        const newConfig = incomeConfig.map(item => 
            item.key === key ? { ...item, customPrice: newPricesArray } : item
        );
        updateConfig(newConfig);
    };

    const handleDeleteItem = (itemToDelete) => {
        if (window.confirm(t.deleteConfirm(itemToDelete.label))) {
            const newConfig = incomeConfig.map(item => 
                item.key === itemToDelete.key ? { ...item, useCustomPrice: false, customPrice: [] } : item
            );
            updateConfig(newConfig);
        }
    };

    const updateConfig = (newConfig) => {
        if (setIncomeConfig) {
            setIncomeConfig(newConfig);
            const currentSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
            localStorage.setItem('appSettings', JSON.stringify({
                ...currentSettings,
                incomeConfig: newConfig
            }));
        }
    };

    const onSaveFavorite = () => {
        const pricesArray = safeCommonInput.split(',')
            .map(s => parseFloat(s.trim()))
            .filter(n => !isNaN(n));
        const validPrices = pricesArray.filter(n => n >= 1);
        if (validPrices.length === 0) {
            alert(t.alertMin1);
            return;
        }
        handleSaveFavoritePrices(); 
    };

    useEffect(() => {
        if (!targetItemKey || !targetRef.current) return undefined;

        if (!isIndividualExpanded) {
            setIsIndividualExpanded(true);
            localStorage.setItem('unitPrice_individualExpanded', JSON.stringify(true));
            return undefined;
        }

        const timeoutId = setTimeout(() => {
            targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [targetItemKey, isIndividualExpanded]);

    const isCommonActive = activeCardKey === 'common';
    let commonContainerStyle = !isCommonValid 
        ? (isDarkMode ? 'bg-gray-800 border-red-500/50' : 'bg-red-50 border-red-300 shadow-sm')
        : (isCommonActive 
            ? (isDarkMode ? 'bg-gray-800 border-blue-500 shadow-blue-500/20 shadow-lg' : 'bg-blue-50 border-blue-400 shadow-md ring-1 ring-blue-400')
            : (isDarkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300')
        );

    return (
        <div className={`w-full flex flex-col gap-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            <div className="flex items-center px-1 py-2 border-b border-gray-200 dark:border-gray-700">
                <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
                    <ChevronLeft size={24} />
                </button>
                <h2 className="text-xl font-bold ml-2">{t.title}</h2>
            </div>

            {/* ⚫ 구역 1: 공통 즐겨찾기 목록 */}
            <div 
                id="common-fav-box"
                className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${commonContainerStyle}`}
            >
                {/* 헤더 부분 */}
                <div 
                    onClick={() => {
                        // ✨ [추가] 닫혀있을 때 누르면 열리면서 동시에 입력창으로 포커스
                        if (!isFavExpanded) {
                            toggleFavExpanded();
                            handleBoxClick('common');
                            setTimeout(() => commonInputRef.current?.focus(), 200); 
                        } else {
                            toggleFavExpanded();
                        }
                    }}
                    className="flex items-center justify-between p-4 cursor-pointer"
                >
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${!isCommonValid ? 'bg-red-100 text-red-500' : (isCommonActive ? 'bg-blue-500 text-white' : (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'))}`}>
                            <List size={20} />
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${!isCommonValid ? 'text-red-500' : (isCommonActive ? 'text-blue-600 dark:text-blue-400' : (isDarkMode ? 'text-gray-100' : 'text-gray-800'))}`}>
                                {t.commonList}
                            </h3>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {isFavExpanded ? t.commonDesc : t.commonHint}
                            </p>
                        </div>
                    </div>
                    <div className={`text-gray-400 transition-transform duration-300 ${isFavExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={24} />
                    </div>
                </div>

                {/* 펼쳐진 내용 부분 */}
                {isFavExpanded && (
                    <div 
                        className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200 cursor-pointer"
                        // ✨ [추가] 박스 내부 빈 공간을 클릭했을 때의 동작
                        onClick={(e) => {
                            handleBoxClick('common');
                            const targetTag = e.target.tagName;
                            if (targetTag !== 'INPUT' && targetTag !== 'BUTTON' && targetTag !== 'svg' && targetTag !== 'path') {
                                commonInputRef.current?.focus();
                            }
                        }}
                    >
                       <div className="space-y-4">
                            <div className="flex gap-2">
                                <input 
                                    ref={commonInputRef} // ✨ [추가] 참조 연결
                                    type="text" 
                                    inputMode="numeric"
                                    value={adminFavoritePricesInput} 
                                    onChange={(e) => {
                                        const filteredValue = e.target.value.replace(/[^0-9, ]/g, '');
                                        setAdminFavoritePricesInput(filteredValue);
                                    }} 
                                    onClick={(e) => e.stopPropagation()}
                                    onFocus={() => handleBoxClick('common')} 
                                    placeholder={t.placeholder}
                                    className={`flex-1 min-w-0 p-4 text-base font-bold rounded-xl border outline-none text-left ${
                                        isDarkMode 
                                        ? 'bg-gray-900 border-gray-600 text-white focus:border-blue-500' 
                                        : 'bg-white border-gray-300 text-black focus:border-blue-500'
                                    }`} 
                                />
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newVal = adminFavoritePricesInput.trim();
                                        if (newVal && !newVal.endsWith(',')) setAdminFavoritePricesInput(newVal + ', ');
                                    }}
                                    className={`flex-none w-14 rounded-xl font-black text-2xl flex items-center justify-center transition-colors shadow-sm ${
                                        isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300'
                                    }`}
                                >
                                    ,
                                </button>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onSaveFavorite(); }} 
                                className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform ${
                                    !isCommonValid 
                                    ? (isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-white border border-red-200 text-red-400')
                                    : (isCommonActive ? 'bg-blue-600 hover:bg-blue-700' : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-800 hover:bg-gray-900'))
                                }`}
                            >
                                <CheckCircle size={18} /> {t.saveFav}
                            </button>
                        </div>

                        <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <p className={`text-xs font-bold mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t.preview}
                            </p>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                {favoriteUnitPrices.map((price, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={(e) => { e.stopPropagation(); setActiveFavPrice(price); }}
                                        className={`py-2 rounded-lg text-sm font-bold border cursor-pointer transition-colors ${
                                            activeFavPrice === price
                                            ? 'bg-blue-100 text-blue-700 border-blue-200' 
                                            : (isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500' : 'bg-gray-100 border-gray-300 text-gray-600 hover:border-gray-400')
                                        }`}
                                    >
                                        {price}
                                    </div>
                                ))}
                                {(!isCommonValid) && (
                                     <span className="col-span-4 text-xs text-red-500 font-bold py-1 text-center">
                                        ! {t.errorMin1}
                                     </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className={`h-px w-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />

            {/* 🔵 구역 2: 개별 항목 단가 리스트 */}
            <div className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div 
                    onClick={toggleIndividualExpanded}
                    className={`flex items-center justify-between p-4 cursor-pointer ${isDarkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}`}
                >
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                            <Coins size={20} className="text-blue-500" />
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${hasInvalidItems ? 'text-red-500' : (isDarkMode ? 'text-gray-200' : 'text-gray-800')}`}>
                                {t.individualTitle}
                            </h3>
                            <p className={`text-xs ${hasInvalidItems ? 'text-red-400' : (isDarkMode ? 'text-gray-400' : 'text-gray-500')}`}>
                                {isIndividualExpanded ? t.individualDesc : t.commonHint}
                            </p>
                        </div>
                    </div>
                    <div className={`text-gray-400 transition-transform duration-300 ${isIndividualExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={24} />
                    </div>
                </div>
                
                {isIndividualExpanded && (
                    <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200 border-t border-transparent">
                        {enabledItems.length > 0 ? (
                            <div className="space-y-4 pt-2">
                                {enabledItems.map(item => {
                                    const cardRef = getCardRef(item.key);
                                    const isTarget = item.key === targetItemKey;
                                    return (
                                        <div key={item.key} ref={isTarget ? targetRef : null}>
                                            <PriceItemCard 
                                                item={item} 
                                                onSave={handleSaveItemPrice} 
                                                onDelete={handleDeleteItem}
                                                isDarkMode={isDarkMode}
                                                isActive={item.key === activeCardKey}
                                                onClickCard={() => handleBoxClick(item.key)}
                                                cardRef={cardRef}
                                                t={t}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-6 text-center text-gray-400 border border-dashed rounded-xl mt-2">
                                <p>{t.noButtons}</p>
                                <p className="text-xs mt-1">{t.noButtonsHint}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="h-[33vh] flex-none" />
        </div>
    );
};

export default UnitPriceView;