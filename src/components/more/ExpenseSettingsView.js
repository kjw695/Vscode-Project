import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, Plus, Trash2, RotateCcw, Eye, EyeOff, CheckSquare, Square, GripVertical, ArrowUpDown } from 'lucide-react';

// ✨ initialTab 신호를 받아옵니다
const ExpenseSettingsView = ({ initialTab = 'income', onBack, onNavigate, isDarkMode, expenseConfig, setExpenseConfig, incomeConfig, setIncomeConfig }) => {
    // 처음 열릴 때 전달받은 탭으로 설정
    const [activeTab, setActiveTab] = useState(initialTab);
    
    // ✨ 만약 화면이 떠있는 상태에서 신호가 바뀌면 즉시 탭을 바꿔줍니다
    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);
    
    const [localExpense, setLocalExpense] = useState([]);
    
    const [localIncome, setLocalIncome] = useState([]);
    const [newItemName, setNewItemName] = useState('');
    const [useCustomPrice, setUseCustomPrice] = useState(false);

    // 팝업 상태 관리
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [selectedItemKey, setSelectedItemKey] = useState(null);

    // 순서 이동을 위한 상태
    const [movingIndex, setMovingIndex] = useState(null);

    const touchStartX = useRef(null);
    const touchEndX = useRef(null);
    const minSwipeDistance = 50;

    // 🔥 [원칙 준수] 시스템 언어 감지 및 텍스트 매핑
    const isKo = useMemo(() => navigator.language.toLowerCase().includes('ko'), []);
    const t = {
        title: isKo ? "항목 관리" : "Item Management",
        tabIncome: isKo ? "수익 항목" : "Income Items",
        tabExpense: isKo ? "지출 항목" : "Expense Items",
        placeholder: isKo ? "새 항목 이름 입력" : "Enter new item name",
        exists: isKo ? "이미 존재하는 항목입니다." : "Item already exists.",
        confirmDelete: isKo ? "선택한 항목을 삭제하시겠습니까?" : "Delete selected item?",
        resetConfirm: (label) => isKo 
            ? `현재 보고 계신 [${label}] 항목 설정을 초기화하시겠습니까?\n(추가한 항목과 단가 설정이 모두 사라집니다)`
            : `Reset settings for [${label}]?\n(Added items and prices will be lost)`,
        resetDone: (label) => isKo ? `[${label}] 항목 설정이 초기화되었습니다.` : `[${label}] settings have been reset.`,
        resetBtn: isKo ? "설정 초기화" : "Reset Settings",
        showBtn: isKo ? "입력창에 '0 ▼' 버튼 표시하기" : "Show '0 ▼' button in input",
        btnShown: isKo ? "버튼 표시됨" : "Button ON",
        btnHidden: isKo ? "버튼 없음" : "Button OFF",
        moveHandle: isKo ? "이동할 위치의 핸들(≡)을 선택하세요" : "Select handle (≡) to move",
        modalTitle: isKo ? "단가 설정으로 이동" : "Go to Unit Price Settings",
        modalDesc: isKo ? "버튼을 표시하고 단가를 설정하시겠습니까?" : "Enable button and set unit price?",
        yes: isKo ? "예 (이동)" : "Yes (Go)",
        no: isKo ? "아니요" : "No",
        alertNoLink: isKo ? "이동 기능이 연결되지 않았습니다." : "Navigation not linked."
    };

    useEffect(() => {
        if (expenseConfig) setLocalExpense(expenseConfig);
        if (incomeConfig) setLocalIncome(incomeConfig);
    }, [expenseConfig, incomeConfig]);

    const onTouchStart = (e) => { touchStartX.current = e.targetTouches[0].clientX; touchEndX.current = null; };
    const onTouchMove = (e) => { touchEndX.current = e.targetTouches[0].clientX; };
    const onTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        const distance = touchStartX.current - touchEndX.current;
        if (distance > minSwipeDistance && activeTab === 'income') setActiveTab('expense');
        else if (distance < -minSwipeDistance && activeTab === 'expense') setActiveTab('income');
    };

    const updateAndSave = (newList, type) => {
        const targetType = type || activeTab;
        const currentSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
        let updatedSettings = { ...currentSettings };

        if (targetType === 'expense') {
            setLocalExpense(newList);
            setExpenseConfig(newList);
            updatedSettings.expenseConfig = newList;
        } else {
            setLocalIncome(newList);
            setIncomeConfig(newList);
            updatedSettings.incomeConfig = newList;
        }
        localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
    };

    const handleMoveClick = (index) => {
        if (movingIndex === index) {
            setMovingIndex(null);
            return;
        }

        if (movingIndex === null) {
            setMovingIndex(index);
            return;
        }

        const currentList = activeTab === 'expense' ? [...localExpense] : [...localIncome];
        const itemToMove = currentList[movingIndex];
        currentList.splice(movingIndex, 1);
        currentList.splice(index, 0, itemToMove);

        updateAndSave(currentList);
        setMovingIndex(null);
    };

    const toggleVisibility = (key) => {
        const currentList = activeTab === 'expense' ? localExpense : localIncome;
        const newList = currentList.map(item => item.key === key ? { ...item, isVisible: !item.isVisible } : item);
        updateAndSave(newList);
    };

    const handleToggleClick = (item) => {
        const nextValue = !item.useCustomPrice;
        toggleCustomPrice(item.key, nextValue); 
        if (nextValue) {
            setSelectedItemKey(item.key);
            setLinkModalOpen(true);
        }
    };

    const toggleCustomPrice = (key, value) => {
        const currentList = activeTab === 'expense' ? localExpense : localIncome;
        const newList = currentList.map(item => 
            item.key === key ? { ...item, useCustomPrice: value } : item
        );
        updateAndSave(newList);
    };

    const confirmMoveToUnitPrice = () => {
        if (selectedItemKey) {
            setLinkModalOpen(false);
            if (onNavigate) {
                onNavigate('unitPrice', selectedItemKey); 
            } else {
                alert(t.alertNoLink);
            }
            setSelectedItemKey(null);
        }
    };

    const handleAddItem = () => {
        if (!newItemName.trim()) return;
        const label = newItemName.trim();
        const currentList = activeTab === 'expense' ? localExpense : localIncome;

        if (currentList.some(item => item.label === label)) {
            alert(t.exists);
            return;
        }

        const newItem = { 
            key: label, 
            label, 
            isVisible: true,
            useCustomPrice: activeTab === 'income' ? useCustomPrice : false,
            type: activeTab 
        };

        const newList = [...currentList, newItem];
        updateAndSave(newList);
        setNewItemName('');
        setUseCustomPrice(false);
    };

    const handleDeleteItem = (key) => {
        if (window.confirm(t.confirmDelete)) {
            const currentList = activeTab === 'expense' ? localExpense : localIncome;
            const newList = currentList.filter(item => item.key !== key);
            updateAndSave(newList);
        }
    };

    const handleReset = () => {
        const targetLabel = activeTab === 'income' ? t.tabIncome : t.tabExpense;
        
        if (window.confirm(t.resetConfirm(targetLabel))) {
            const defaultIncome = [
                { key: 'deliveryCount', label: isKo ? '배송' : 'Delivery Count', isVisible: true, type: 'income' },
                { key: 'deliveryInterruptionAmount', label: isKo ? '중단' : 'Interruption', isVisible: true, type: 'income' },
                { key: 'returnCount', label: isKo ? '반품' : 'Return Count', isVisible: true, type: 'income' },
                { key: 'freshBagCount', label: isKo ? '프레시백' : 'Fresh Bag', isVisible: true, type: 'income' },
            ];
            
            const defaultExpense = [
                { key: 'penaltyAmount', label: isKo ? '패널티' : 'Penalty', isVisible: true, type: 'expense' },
                { key: 'fuelCost', label: isKo ? '유류비' : 'Fuel Cost', isVisible: true, type: 'expense' },
                { key: 'maintenanceCost', label: isKo ? '유지보수비' : 'Maintenance', isVisible: true, type: 'expense' },
                { key: 'vatAmount', label: isKo ? '부가세' : 'VAT', isVisible: true, type: 'expense' },
                { key: 'incomeTaxAmount', label: isKo ? '종합소득세' : 'Income Tax', isVisible: true, type: 'expense' },
                { key: 'taxAccountantFee', label: isKo ? '세무사 비용' : 'Accountant Fee', isVisible: true, type: 'expense' },
            ];

            const currentSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
            let newSettings = { ...currentSettings };

            if (activeTab === 'income') {
                setLocalIncome(defaultIncome);
                if (setIncomeConfig) setIncomeConfig(defaultIncome);
                newSettings.incomeConfig = defaultIncome;
            } else {
                setLocalExpense(defaultExpense);
                if (setExpenseConfig) setExpenseConfig(defaultExpense);
                newSettings.expenseConfig = defaultExpense;
            }

            localStorage.setItem('appSettings', JSON.stringify(newSettings));
            alert(t.resetDone(targetLabel));
        }
    };

    const displayList = activeTab === 'expense' ? localExpense : localIncome;

    return (
        <div className={`w-full h-full flex flex-col ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="flex items-center mb-2 px-1 py-2">
                <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><ChevronLeft size={24} /></button>
                <h2 className="text-xl font-bold ml-2">{t.title}</h2>
            </div>

            <div className="flex p-1 mx-1 mb-4 bg-gray-200 dark:bg-gray-800 rounded-lg">
                <button onClick={() => setActiveTab('income')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'income' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500'}`}>{t.tabIncome}</button>
                <button onClick={() => setActiveTab('expense')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'expense' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500'}`}>{t.tabExpense}</button>
            </div>

            <div className={`mb-4 px-3 py-4 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex gap-2 mb-3">
                    <input 
                        type="text" 
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder={t.placeholder}
                        className={`flex-1 min-w-0 p-3 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                    />
                    <button 
                        onClick={handleAddItem} 
                        className={`w-14 flex-none rounded-lg font-bold flex items-center justify-center ${activeTab === 'income' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}
                    >
                        <Plus size={24} />
                    </button>
                </div>
                
                {activeTab === 'income' && (
                    <button 
                        onClick={() => setUseCustomPrice(!useCustomPrice)}
                        className={`w-full flex items-center justify-center gap-2 text-sm p-3 rounded-lg transition-all border ${useCustomPrice ? 'bg-red-50 border-red-200 text-red-600 font-bold' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}`}
                    >
                        {useCustomPrice ? <CheckSquare size={18}/> : <Square size={18}/>}
                        {t.showBtn}
                    </button>
                )}
            </div>

            {movingIndex !== null && (
                <div className="mx-2 mb-3 p-3 rounded-lg bg-blue-100 text-blue-800 text-sm font-bold text-center border border-blue-200 animate-pulse">
                    <ArrowUpDown className="inline-block mr-1" size={16}/>
                    {t.moveHandle}
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-1 space-y-2 pb-32">
                {displayList.map((item, index) => {
                    const isMoving = movingIndex === index;
                    
                    return (
                        <div 
                            key={item.key} 
                            className={`flex items-center justify-between px-3 py-3 rounded-lg border transition-all duration-200 ${
                                isMoving
                                ? 'bg-blue-100 border-blue-500 shadow-md transform scale-[1.02] ring-1 ring-blue-400' 
                                : (isDarkMode ? 'border-gray-700 bg-gray-700/50' : 'border-gray-200 bg-white shadow-sm')
                            }`}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <button 
                                    onClick={() => handleMoveClick(index)}
                                    className={`p-1.5 rounded cursor-pointer touch-manipulation ${
                                        isMoving 
                                        ? 'bg-blue-500 text-white' 
                                        : (isDarkMode ? 'text-gray-400 hover:bg-gray-600' : 'text-gray-400 hover:bg-gray-100')
                                    }`}
                                >
                                    <GripVertical size={20} />
                                </button>

                                <button onClick={() => toggleVisibility(item.key)} className={`p-1.5 rounded-md transition-colors flex-none ${item.isVisible ? (activeTab === 'income' ? 'text-red-500 bg-red-50' : 'text-blue-500 bg-blue-50') : 'text-gray-400 bg-gray-100'}`}>
                                    {item.isVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                                </button>

                                <div className="flex flex-col gap-1 justify-center flex-1 min-w-0">
                                    <span className={`font-bold text-base leading-none truncate ${!item.isVisible && 'text-gray-400 line-through'}`}>{item.label}</span>
                                    
                                    {activeTab === 'income' && (
                                        <div 
                                            onClick={() => handleToggleClick(item)}
                                            className="cursor-pointer leading-none"
                                        >
                                            {item.useCustomPrice ? (
                                                <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-md font-bold border border-red-200">
                                                    <CheckSquare size={14} /> {t.btnShown}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-200 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300">
                                                    <Square size={14} /> {t.btnHidden}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => handleDeleteItem(item.key)} className="p-2 text-gray-400 hover:text-red-500 flex-none">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    );
                })}

                 <div className="mt-4 px-1">
                    <button onClick={handleReset} className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 border ${isDarkMode ? 'border-red-900 text-red-400' : 'border-red-200 text-red-600'}`}>
                        <RotateCcw size={16} /> {t.resetBtn}
                    </button>
                </div>
            </div>

            {linkModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] px-4">
                    <div className={`w-full max-w-sm p-6 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
                        <h3 className="text-lg font-bold mb-2">{t.modalTitle}</h3>
                        <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {t.modalDesc}
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => {
                                    setLinkModalOpen(false);
                                    setSelectedItemKey(null);
                                }}
                                className={`flex-1 py-3 rounded-lg font-bold ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
                            >
                                {t.no}
                            </button>
                            <button 
                                onClick={confirmMoveToUnitPrice}
                                className="flex-1 py-3 rounded-lg font-bold bg-blue-600 text-white shadow-lg"
                            >
                                {t.yes}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpenseSettingsView;