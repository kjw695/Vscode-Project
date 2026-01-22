import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Plus, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';

const ExpenseSettingsView = ({ onBack, isDarkMode, expenseConfig, setExpenseConfig, incomeConfig, setIncomeConfig }) => {
    // 탭 상태: 'income' (수익) 또는 'expense' (지출)
    const [activeTab, setActiveTab] = useState('expense'); // 기본값은 지출

    // 로컬 데이터 상태
    const [localExpense, setLocalExpense] = useState([]);
    const [localIncome, setLocalIncome] = useState([]);
    const [newItemName, setNewItemName] = useState('');

    // ✨ [추가됨] 터치 제어를 위한 변수 (Swipe)
    const touchStartX = useRef(null);
    const touchEndX = useRef(null);
    const minSwipeDistance = 50; // 최소 50px 이상 밀어야 인식

    // 1. 초기 데이터 로드
    useEffect(() => {
        if (expenseConfig && Array.isArray(expenseConfig)) {
            setLocalExpense(expenseConfig);
        }
        if (incomeConfig && Array.isArray(incomeConfig)) {
            setLocalIncome(incomeConfig);
        }
    }, [expenseConfig, incomeConfig]);

    // ✨ [추가됨] 터치 시작
    const onTouchStart = (e) => {
        touchStartX.current = e.targetTouches[0].clientX;
        touchEndX.current = null;
    };

    // ✨ [추가됨] 터치 이동
    const onTouchMove = (e) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    // ✨ [추가됨] 터치 종료 (스와이프 방향 판단)
    const onTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        
        const distance = touchStartX.current - touchEndX.current;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        // 왼쪽으로 밀기 ( <- ) : 수익 탭에서 지출 탭으로
        if (isLeftSwipe && activeTab === 'income') {
            setActiveTab('expense');
        }
        
        // 오른쪽으로 밀기 ( -> ) : 지출 탭에서 수익 탭으로
        if (isRightSwipe && activeTab === 'expense') {
            setActiveTab('income');
        }
    };

    // 공통 저장 함수
    const updateAndSave = (newList, type) => {
        const targetType = type || activeTab; 
        
        try {
            const currentSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
            let updatedSettings = { ...currentSettings };

            if (targetType === 'expense') {
                setLocalExpense(newList);
                setExpenseConfig(newList); 
                updatedSettings.expenseConfig = newList;
            } else {
                setLocalIncome(newList);
                if (setIncomeConfig) setIncomeConfig(newList);
                updatedSettings.incomeConfig = newList;
            }

            localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
        } catch (error) {
            console.error("저장 실패:", error);
            alert("자동 저장 중 오류가 발생했습니다.");
        }
    };

    // 항목 추가
    const handleAddItem = () => {
        if (!newItemName.trim()) return;
        
        const label = newItemName.trim();
        const currentList = activeTab === 'expense' ? localExpense : localIncome;

        if (currentList.some(item => item.label === label)) {
            alert("이미 존재하는 항목입니다.");
            return;
        }

        const newItem = { key: label, label, isVisible: true };
        const newList = [...currentList, newItem];
        
        updateAndSave(newList);
        setNewItemName('');
    };

    // 항목 삭제
    const handleDeleteItem = (key) => {
        if (window.confirm(`선택한 ${activeTab === 'expense' ? '지출' : '수익'} 항목을 삭제하시겠습니까?`)) {
            const currentList = activeTab === 'expense' ? localExpense : localIncome;
            const newList = currentList.filter(item => item.key !== key);
            updateAndSave(newList);
        }
    };

    // 초기화
    const handleReset = () => {
        const typeText = activeTab === 'expense' ? '지출' : '수익';
        if(window.confirm(`${typeText} 설정값을 초기 상태로 되돌리시겠습니까?\n추가한 항목들이 모두 사라집니다.`)) {
            let defaultConfig = [];

            if (activeTab === 'expense') {
                defaultConfig = [
                    { key: 'penaltyAmount', label: '패널티', isVisible: true },
                    { key: 'industrialAccidentCost', label: '산재', isVisible: true },
                    { key: 'fuelCost', label: '유류비', isVisible: true },
                    { key: 'maintenanceCost', label: '유지보수비', isVisible: true },
                    { key: 'vatAmount', label: '부가세', isVisible: true },
                    { key: 'incomeTaxAmount', label: '종합소득세', isVisible: true },
                    { key: 'taxAccountantFee', label: '세무사 비용', isVisible: true },
                ];
            } else {
                defaultConfig = [
                    { key: 'deliveryCount', label: '배송 수량', isVisible: true },
                    { key: 'deliveryInterruptionAmount', label: '배송중단', isVisible: true },
                    { key: 'returnCount', label: '반품 수량', isVisible: true },
                    { key: 'freshBagCount', label: '프레시백 수량', isVisible: true },
                ];
            }
            
            updateAndSave(defaultConfig);
            alert(`${typeText} 설정이 초기화되었습니다.`);
        }
    }

    const displayList = activeTab === 'expense' ? localExpense : localIncome;
    const themeColor = activeTab === 'expense' ? 'red' : 'blue';

    return (
        // ✨ [수정됨] div에 터치 이벤트 핸들러 연결
        <div 
            className={`w-full h-full flex flex-col ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            
            {/* 1. 헤더 */}
            <div className="flex items-center mb-2 px-1 py-2">
                <button onClick={onBack} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
                    <ChevronLeft size={24} />
                </button>
                <h2 className="text-xl font-bold ml-2">항목 관리</h2>
            </div>

            {/* 2. 탭 전환 버튼 */}
            <div className="flex p-1 mx-1 mb-4 bg-gray-200 dark:bg-gray-800 rounded-lg relative">
                <button
                    onClick={() => setActiveTab('income')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all duration-200 z-10 ${
                        activeTab === 'income' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    수익 항목
                </button>
                <button
                    onClick={() => setActiveTab('expense')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all duration-200 z-10 ${
                        activeTab === 'expense' 
                            ? 'bg-red-500 text-white shadow-md' 
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    지출 항목
                </button>
            </div>

            {/* 3. 안내 문구 */}
            <div className={`p-3 rounded-lg text-sm mb-4 mx-1 ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-600 shadow-sm'}`}>
                {activeTab === 'income' ? '수익(매출)' : '지출'} 항목을 관리합니다.
                <br/>추가하거나 삭제하면 <strong>자동으로 저장</strong>됩니다.
            </div>

            {/* 4. 입력창 영역 */}
            <div className="flex gap-2 mb-4 px-1">
                <input 
                    type="text" 
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={activeTab === 'expense' ? "예: 식대, 회식비" : "예: 인센티브, 보너스"}
                    className={`flex-1 p-3 min-w-0 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:ring-2 focus:ring-${themeColor}-500`}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                />
                <button 
                    onClick={handleAddItem}
                    className={`text-white px-5 rounded-lg font-bold flex items-center whitespace-nowrap shadow-md ${activeTab === 'expense' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    <Plus size={20} />
                </button>
            </div>

            {/* 5. 항목 리스트 */}
            <div className="flex-1 overflow-y-auto px-1 space-y-2 min-h-0">
                {displayList.map((item) => (
                    <div key={item.key} className={`flex items-center justify-between p-3 rounded-lg border ${isDarkMode ? 'border-gray-700 bg-gray-700/50' : 'border-gray-200 bg-white shadow-sm'}`}>
                        <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{item.label}</span>
                        <button 
                            onClick={() => handleDeleteItem(item.key)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
                
                {displayList.length === 0 && (
                    <div className="text-center text-gray-500 py-8">등록된 항목이 없습니다.</div>
                )}
            </div>

            {/* 6. 하단 초기화 영역 */}
            <div className="mt-4 px-1 pb-6">
                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400 font-bold">
                        <AlertTriangle size={18} />
                        <span>{activeTab === 'income' ? '수익' : '지출'} 설정 초기화</span>
                    </div>
                    <p className={`text-xs mb-3 ${isDarkMode ? 'text-red-300' : 'text-red-600/70'}`}>
                        현재 선택된 탭({activeTab === 'income' ? '수익' : '지출'})의 항목만 기본값으로 돌아갑니다.
                    </p>
                    <button 
                        onClick={handleReset}
                        className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${isDarkMode ? 'bg-red-900/40 text-red-200 hover:bg-red-900/60' : 'bg-white border border-red-200 text-red-600 hover:bg-red-50'}`}
                    >
                        <RotateCcw size={16} /> 초기 상태로 복구
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExpenseSettingsView;