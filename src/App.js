//주방장(DeliveryContext): 요리(데이터 저장/삭제)만 전문으로 함.
//도구(dataHandlers): 재료 손질(CSV 변환)만 함.
//사장님(App.js): 손님 응대(화면 표시)만 함.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Home, BarChart2, List, MoreHorizontal, Plus } from 'lucide-react';
import { backupToDrive, restoreFromDrive } from './utils/googleDrive';
import { Preferences } from '@capacitor/preferences';
import MessageModal from './components/common/MessageModal';
import { formatDate } from './utils';
import StatsDisplay from './StatsDisplay';
import GoalProgressBar from './components/GoalProgressBar';
import RevenueDistributionChart from './components/RevenueDistributionChart';
import FilterModal from './components/DataScreen/FilterModal';
import EntriesList from './components/DataScreen/EntriesList.js';
import DataEntryForm from './DataEntryForm';
import PrivacyPolicy from './components/more/PrivacyPolicy';
import OpenSourceLicenses from './components/more/OpenSourceLicenses.js';
import CalculatorPage from './CalculatorPage';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import MoreView from './components/more/MoreView';
import AccountView from './components/more/AccountView';
import UnitPriceView from './components/more/UnitPriceView';
import PeriodView from './components/more/PeriodView';
import DataSettingsView from './components/more/DataSettingsView';
import UserGuideView from './components/more/UserGuideView';
import LegalInfoView from './components/more/LegalInfoView';
import ContactView from './components/more/ContactView';
import { useProfitCalculations } from './hooks/useProfitCalculations';
import ExpenseSettingsView from './components/more/ExpenseSettingsView';
import useAppBackButton from './hooks/useAppBackButton';
import SystemThemeManager from './components/common/SystemThemeManager';
import GoalSettingsView from './components/more/GoalSettingsView';
import { useDelivery } from './contexts/DeliveryContext';
import { exportDataAsCsv, parseCsvData } from './utils/dataHandlers.js'; 

// [추가] 로고 이미지 (경로는 실제 로고 경로에 맞게 조정 필요, 없으면 텍스트만 표시됨)
import logoImage from './logo.png'; 

const DetailRow = ({ label, value, comparison }) => (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-1">
        <span className="text-base sm:text-lg font-semibold">{label}</span>
        <span className="text-base sm:text-lg font-bold">{value}</span>
        <div className="w-16 flex justify-center">{comparison}</div>
    </div>
);

const getTodayLocal = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const getSmartCurrentMonth = (startDay = 26) => {
    const now = new Date(); // 핸드폰 시간(한국 시간)
    const currentDay = now.getDate();
    
    let year = now.getFullYear();
    let month = now.getMonth() + 1;

    // 오늘이 26일 이상이면 다음 달 장부로 인식
    if (currentDay >= startDay) {
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return `${year}-${String(month).padStart(2, '0')}`;
};

function AppContent() {
    const navigate = useNavigate();
    
    // [수정] isDataLoaded 상태 가져오기
    const { entries, saveEntry, deleteEntry, clearAllEntries, importStrictly, isDataLoaded } = useDelivery();

    // --- 목표 관리 ---
    const [targetItemKey, setTargetItemKey] = useState(null);
    const [goalAmount, setGoalAmount] = useState(7000000);
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [newGoalAmountInput, setNewGoalAmountInput] = useState('');

    const isAuthReady = true;

    // --- UI 테마 및 화면 제어 ---
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // 최초 앱 로드 시 핸드폰 기계의 다크모드/라이트모드 설정을 확인합니다.
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    });
    const [isFabVisible, setIsFabVisible] = useState(false);
    const [selectedMainTab, setSelectedMainTab] = useState('home');
    const [activeContentTab, setActiveContentTab] = useState('monthlyProfit');
    const [activeDataTab, setActiveDataTab] = useState('entry');
    const [moreSubView, setMoreSubView] = useState('main');

    // --- 데이터 입력 폼 상태 ---
    const [date, setDate] = useState(getTodayLocal());
    
    const [unitPrice, setUnitPrice] = useState('');
    const [formData, setFormData] = useState({});
    const [formType, setFormType] = useState('income');
    const [entryToEdit, setEntryToEdit] = useState(null);

    // --- 통계용 상태 ---
const [selectedMonth, setSelectedMonth] = useState(() => {
        // 저장된 설정(시작일)을 확인하고, 없으면 기본값 26일 사용
        const savedSettings = localStorage.getItem('appSettings');
        const parsed = savedSettings ? JSON.parse(savedSettings) : {};
        const startDay = parsed.monthlyPeriod?.startDay || 26;
        return getSmartCurrentMonth(startDay);
    });
    
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

    const [statisticsView, setStatisticsView] = useState('monthly');
    const [monthlyStatsSubTab, setMonthlyStatsSubTab] = useState('overview');

    // --- 설정값 관리 ---
    const [favoriteUnitPrices, setFavoriteUnitPrices] = useState([700]);
    const [adminFavoritePricesInput, setAdminFavoritePricesInput] = useState('700');
    const [monthlyStartDay, setMonthlyStartDay] = useState(26);
    const [monthlyEndDay, setMonthlyEndDay] = useState(25);
    const [adminMonthlyStartDayInput, setAdminMonthlyStartDayInput] = useState('26');
    const [adminMonthlyEndDayInput, setAdminMonthlyEndDayInput] = useState('25');

    // --- 항목 설정 (지출/수익) ---
    const [expenseConfig, setExpenseConfig] = useState(() => {
        const savedSettings = localStorage.getItem('appSettings');
        const parsedSettings = savedSettings ? JSON.parse(savedSettings) : {};
        return parsedSettings.expenseConfig || [
            { key: 'penaltyAmount', label: '패널티', isVisible: true },
            { key: 'industrialAccidentCost', label: '산재', isVisible: true },
            { key: 'fuelCost', label: '유류비', isVisible: true },
            { key: 'maintenanceCost', label: '유지보수비', isVisible: true },
            { key: 'vatAmount', label: '부가세', isVisible: true },
            { key: 'incomeTaxAmount', label: '종합소득세', isVisible: true },
            { key: 'taxAccountantFee', label: '세무사 비용', isVisible: true },
        ];
    });

    const [incomeConfig, setIncomeConfig] = useState(() => {
        const savedSettings = localStorage.getItem('appSettings');
        const parsedSettings = savedSettings ? JSON.parse(savedSettings) : {};
        return parsedSettings.incomeConfig || [
            { key: 'deliveryCount', label: '배송', isVisible: true },
            { key: 'deliveryInterruptionAmount', label: '중단', isVisible: true },
            { key: 'returnCount', label: '반품', isVisible: true },
            { key: 'freshBagCount', label: '프레시백', isVisible: true, useCustomPrice: true, customPrice: [100, 200] },
            { key: 'assignmentCount', label: '채번', isVisible: false },
            { key: 'promotionAmount', label: '프로모션', isVisible: false, useCustomPrice: true, customPrice: [1] }
        ];
    });

    // --- 정렬 및 필터 ---
    const [sortColumn, setSortColumn] = useState('date');
    const [sortDirection, setSortDirection] = useState('desc');
    const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [filters, setFilters] = useState({ period: 'all', startDate: '', endDate: '', type: 'all' });

    // --- 팝업 및 로딩 ---
    const [modalState, setModalState] = useState({ isOpen: false, content: '', type: 'info', onConfirm: null });
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    const dateInputRef = useRef(null);
    const touchStartX = useRef(null);
    const touchEndX = useRef(null);
    const touchStartY = useRef(null);
    const touchEndY = useRef(null);

    // 설정값 로드
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedSettings = localStorage.getItem('appSettings');
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    if (settings.favoriteUnitPrices) {
                        setFavoriteUnitPrices(settings.favoriteUnitPrices);
                        setAdminFavoritePricesInput(settings.favoriteUnitPrices.join(', '));
                        if (settings.favoriteUnitPrices.length === 1) setUnitPrice(settings.favoriteUnitPrices[0].toString());
                    }
                    if (settings.monthlyPeriod) {
                        setMonthlyStartDay(settings.monthlyPeriod.startDay);
                        setMonthlyEndDay(settings.monthlyPeriod.endDay);
                        setAdminMonthlyStartDayInput(settings.monthlyPeriod.startDay.toString());
                        setAdminMonthlyEndDayInput(settings.monthlyPeriod.endDay.toString());
                    }
                    if (settings.goalAmount) setGoalAmount(settings.goalAmount);
                    if (settings.expenseConfig) setExpenseConfig(settings.expenseConfig);
                    if (settings.incomeConfig) setIncomeConfig(settings.incomeConfig);
                }
            } catch (error) {
                console.error("설정 로드 실패:", error);
            }
        };
        loadSettings();
    }, []);

    useEffect(() => {
        const now = new Date();
        if (now.getDate() > monthlyEndDay) {
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            setCurrentCalendarDate(nextMonth);
            setSelectedMonth(nextMonth.toISOString().slice(0, 7));
        }
    }, [monthlyEndDay]);

    const saveSettingsToLocal = (newSettings) => {
        const currentSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
        const updatedSettings = { ...currentSettings, ...newSettings };
        localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
    };
const handleCloudRestore = async () => {
        try {
            const restoredData = await restoreFromDrive(); // 구글 드라이브에서 데이터 가져오기
            if (restoredData) {
                const result = await importStrictly(restoredData); // 데이터 덮어쓰기/병합
                showMessage(`✅ 복원 완료!\n총 ${result.added}건이 복구되었습니다.`);
            }
        } catch (error) {
            showMessage(`❌ 복원 실패: ${error.message}`);
        }
    };
    
    const handleLocalCsvImport = async (file) => {
        try {
            const parsedData = await parseCsvData(file);
            const result = await importStrictly(parsedData);
            showMessage(`✅ 복원 완료!\n총 ${result.added}건이 추가되었습니다.\n(중복 제외: ${result.skipped}건)`);
        } catch (error) {
            showMessage(`❌ 불러오기 실패: ${error.message}`);
        }
    };

    useEffect(() => {
        const loadDarkModeSetting = async () => {
            const { value } = await Preferences.get({ key: 'isDarkMode' });
            if (value !== null) {
                // 1. 두 번째 실행부터: 사용자가 마지막으로 설정한 모드로 기억
                setIsDarkMode(JSON.parse(value));
            } else {
                // 2. 최초 실행 시: 핸드폰 기계가 다크/라이트인지 확인 후 적용
                const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                setIsDarkMode(systemPrefersDark);
            }
        };
        loadDarkModeSetting();
    }, []);
    useEffect(() => {
        const saveAndApplyTheme = async () => {
            await Preferences.set({ key: 'isDarkMode', value: JSON.stringify(isDarkMode) });
            if (isDarkMode) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
        };
        saveAndApplyTheme();
    }, [isDarkMode]);

    useEffect(() => {
        if (selectedMainTab !== 'data' && entryToEdit) {
            setEntryToEdit(null);
            resetForm();
        }
    }, [selectedMainTab, entryToEdit]);

    const resetForm = () => {
        
        setUnitPrice('');
        setFormData({});
        setFormType('income');
    };

    const handleInputChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const showMessage = (msg) => setModalState({ isOpen: true, content: msg, type: 'info', onConfirm: null });
    const showConfirmation = (msg, onConfirmAction) => setModalState({ isOpen: true, content: msg, type: 'confirm', onConfirm: onConfirmAction });
    const closeModal = () => setModalState({ isOpen: false, content: '', type: 'info', onConfirm: null });
    const handleConfirm = () => { if (modalState.onConfirm) modalState.onConfirm(); closeModal(); };
    const handleApplyFilters = (newFilters) => { setFilters(newFilters); setIsFilterModalOpen(false); };

    const handleSaveGoal = () => {
        const newGoal = parseInt(newGoalAmountInput);
        if (!isNaN(newGoal) && newGoal > 0) {
            setGoalAmount(newGoal);
            setIsEditingGoal(false);
            saveSettingsToLocal({ goalAmount: newGoal });
        } else { showMessage("올바른 금액을 숫자로 입력해주세요."); }
    };

    const handleSubmit = async (e, round, customItems = []) => {
        e.preventDefault();
        
       const totalRevenue = customItems?.reduce((sum, item) => {
            const amount = Number(item.amount) || 0;     // 직접 입력한 금액 (지출 등)
            const calculated = (Number(item.count) || 0) * (Number(item.unitPrice) || 0); // 수량 * 단가
            return sum + amount + calculated;
        }, 0) || 0;

        // 규칙 변경: "공통 단가가 비어있더라도(0원), 계산된 총 수익(totalRevenue)이 0보다 크면 통과시켜라"
        if (formType === 'income' && (!unitPrice || parseFloat(unitPrice) <= 0) && totalRevenue <= 0) {
            showMessage("❗ 단가 또는 개별 항목 금액을 입력해주세요.");
            return;
        }

        const parsedFormData = {};
        Object.keys(formData).forEach(key => {
            parsedFormData[key] = formData[key] ? parseFloat(formData[key]) : 0;
        });

        const newEntryData = {
            id: entryToEdit?.id,
            type: formType,
            date,
            unitPrice: unitPrice ? parseFloat(unitPrice) : 0,
            ...parsedFormData,
            round: round || 0,
            customItems
        };

        const hasValue = Object.values(parsedFormData).some(val => val > 0) || (formType === 'income' && newEntryData.unitPrice > 0);
        if (!hasValue) {
            showMessage("❗ 입력된 정보가 없습니다.");
            return;
        }

        try {
            saveEntry(newEntryData);
            showMessage(entryToEdit ? "✅ 수정되었습니다." : "✅ 저장되었습니다."); 
            setEntryToEdit(null);
            resetForm();
        } catch (err) {
            // Context handles errors
        }
    };
  
    const handleEdit = (entry) => {
        setEntryToEdit(entry); // "이 항목을 수정할 거야" 라고 확실히 기억함
        setDate(entry.date);
        setUnitPrice(entry.unitPrice ? entry.unitPrice.toString() : '');
        
        // customItems(추가 항목)와 일반 항목(배송, 반품 등)을 분리해서 안전하게 담음
        const { id, date, unitPrice, timestamp, round, customItems, ...rest } = entry;
        const stringifiedData = {};
        
        Object.keys(rest).forEach(key => {
            stringifiedData[key] = rest[key] ? rest[key].toString() : '';
        });
        
        setFormData(stringifiedData);
        
        const isExpense = expenseConfig.some(item => rest[item.key] > 0);
        setFormType(isExpense ? 'expense' : 'income');
        
        setSelectedMainTab('data');
        setActiveContentTab('dataEntry');
        setActiveDataTab('entry'); 
        
    };

    const handleDelete = (id) => {
        if (!id) return;
        showConfirmation("정말로 삭제하시겠습니까?", () => {
            deleteEntry(id);
            showMessage("✅ 삭제되었습니다.");
        });
    };

    const handleDeleteAllDataRequest = () => {
        showConfirmation("정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.", () => {
            clearAllEntries(); 
            showMessage("모든 데이터가 삭제되었습니다.");
        });
    };

    const handleDateChange = (days) => {
        if (!date) return;
        const [y, m, d] = date.split('-').map(Number);
        const currentDate = new Date(y, m - 1, d); 
        currentDate.setDate(currentDate.getDate() + days);
        
        const nextY = currentDate.getFullYear();
        const nextM = String(currentDate.getMonth() + 1).padStart(2, '0');
        const nextD = String(currentDate.getDate()).padStart(2, '0');
        setDate(`${nextY}-${nextM}-${nextD}`);
    };

    // 안전 장치 포함된 통계 계산
    // [수정] 기본 항목은 번역을 따르고, 추가한 항목만 이름표를 붙입니다.
   // [수정] 기본 항목은 앱의 자동 번역에 맡기고, 커스텀 항목만 이름표를 전달합니다.
    const itemLabels = useMemo(() => {
        const labels = {};
        
        // 수익 설정의 모든 이름표 저장 (시스템 키 여부 상관없이 덮어씀)
        if (incomeConfig) {
            incomeConfig.forEach(item => {
                labels[item.key] = item.label;
            });
        }

        // 지출 설정의 모든 이름표 저장
        if (expenseConfig) {
            expenseConfig.forEach(item => {
                labels[item.key] = item.label;
            });
        }
        return labels;
    }, [incomeConfig, expenseConfig]);

    // [수정] 안전 장치 포함된 통계 계산 (마지막에 itemLabels 추가)
    const profitData = useProfitCalculations(
        entries, selectedMonth, selectedYear, monthlyStartDay, monthlyEndDay, "local-user",
        itemLabels 
    ) || {};

    const { 
        monthlyProfit = { netProfit: 0, totalWorkingDays: 0, totalVolume: 0, totalFreshBag: 0, dailyAverageVolume: 0, dailyBreakdown: {} },
        yearlyProfit = {}, 
        cumulativeProfit = {}, 
        previousMonthlyProfit = { totalWorkingDays: 0, totalVolume: 0, totalFreshBag: 0, dailyAverageVolume: 0 }
    } = profitData;

    const renderComparison = (currentValue, previousValue, isCurrency = false) => {
        if ((previousValue || 0) === 0 && (currentValue || 0) === 0) return <span className="text-gray-500">-</span>;
        if ((previousValue || 0) === 0) return <span className="text-red-500 flex items-center text-xs sm:text-sm">{currentValue.toLocaleString()} {isCurrency ? '원' : ''} <ArrowUp size={14} className="ml-1" /></span>;
        const diff = currentValue - previousValue;
        const colorClass = diff > 0 ? 'text-red-500' : (diff < 0 ? 'text-blue-500' : 'text-gray-500');
        const arrow = diff > 0 ? <ArrowUp size={14} className="ml-1" /> : (diff < 0 ? <ArrowDown size={14} className="ml-1" /> : null);
        return <span className={`${colorClass} flex items-center text-xs sm:text-sm`}>{Math.abs(diff).toLocaleString()} {isCurrency ? '원' : ''} {arrow}</span>;
    };

    const finalFilteredEntries = useMemo(() => {
        const filtered = entries.filter(entry => {
            const extraRevenue = (entry.customItems || []).filter(i => i.type === 'income').reduce((s, i) => s + (Number(i.amount) || 0), 0);
            const extraExpense = (entry.customItems || []).filter(i => i.type === 'expense').reduce((s, i) => s + (Number(i.amount) || 0), 0);

            const dailyRevenue = (entry.unitPrice * (entry.deliveryCount || 0)) + (entry.unitPrice * (entry.returnCount || 0)) + (entry.unitPrice * (entry.deliveryInterruptionAmount || 0)) + (entry.unitPrice * (entry.freshBagCount || 0)) + extraRevenue;
            const dailyExpenses = (entry.customItems && entry.customItems.length > 0)
                ? entry.customItems.filter(i => i.type === 'expense').reduce((s, i) => s + (Number(i.amount) || 0), 0)
                : ((entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0));

            const typeMatch = filters.type === 'all' || (filters.type === 'income' && dailyRevenue > 0) || (filters.type === 'expense' && dailyExpenses > 0);
            if (!typeMatch) return false;
            if (filters.period === 'all' || !filters.startDate || !filters.endDate) return true;
            return entry.date >= filters.startDate && entry.date <= filters.endDate;
        });
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [entries, filters, sortColumn, sortDirection]);

    const handleSaveFavoritePrices = async () => {
        const pricesArray = adminFavoritePricesInput.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        if (pricesArray.length === 0) { showMessage("유효한 단가를 입력해주세요."); return; }
        setFavoriteUnitPrices(pricesArray);
        saveSettingsToLocal({ favoriteUnitPrices: pricesArray });
        if (pricesArray.length === 1) setUnitPrice(pricesArray[0].toString());
        else setUnitPrice('');
        showMessage("즐겨찾는 단가가 저장되었습니다.");
    };

    const handleSaveMonthlyPeriodSettings = async () => {
        const startDay = parseInt(adminMonthlyStartDayInput);
        const endDay = parseInt(adminMonthlyEndDayInput);
        if (isNaN(startDay) || isNaN(endDay) || startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) { showMessage("유효한 날짜를 입력해주세요."); return; }
        setMonthlyStartDay(startDay);
        setMonthlyEndDay(endDay);
        saveSettingsToLocal({ monthlyPeriod: { startDay, endDay } });
        showMessage("월별 집계 기간이 저장되었습니다.");
    };

    const handleLogout = () => { showMessage("로컬 모드입니다."); };
   const toggleDarkMode = () => { setIsDarkMode(prevMode => !prevMode); };
    
    // [수정] 시차 문제 없는 월 변경 함수 (문자열 계산 방식)
    const handleMonthChange = (direction) => {
        const [yearStr, monthStr] = selectedMonth.split('-');
        let year = parseInt(yearStr, 10);
        let month = parseInt(monthStr, 10);

        month += direction;

        // 연도 변경 처리
        if (month > 12) {
            month = 1;
            year += 1;
        } else if (month < 1) {
            month = 12;
            year -= 1;
        }

        const newMonthStr = `${year}-${String(month).padStart(2, '0')}`;
        setSelectedMonth(newMonthStr);
        setCurrentCalendarDate(new Date(year, month - 1, 1));
    };
    
    // --- 달력 스와이프 기능 ---

    const onCalendarTouchStart = (e) => {
        touchStartX.current = e.targetTouches[0].clientX;
        touchEndX.current = null;
    };
    const onCalendarTouchMove = (e) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };
    const onCalendarTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        const distance = touchStartX.current - touchEndX.current;
        const isLeftSwipe = distance > 50; 
        const isRightSwipe = distance < -50; 

        if (isLeftSwipe) {
            handleMonthChange(1);
        } else if (isRightSwipe) {
            handleMonthChange(-1);
        }
    };

    const handleTodayClick = () => { const today = new Date(); setCurrentCalendarDate(today); setSelectedMonth(today.toISOString().slice(0, 7)); };
    const handleCalendarDateClick = (clickedDate) => {
        const entriesForDate = entries.filter(entry => entry.date === clickedDate);
        if (entriesForDate.length === 1) { handleEdit(entriesForDate[0]); }
        else if (entriesForDate.length > 1) { setFilters({ period: 'custom', startDate: clickedDate, endDate: clickedDate, type: 'all' }); setSelectedMainTab('data'); setActiveContentTab('dataEntry'); setActiveDataTab('list'); }
        else { setSelectedMainTab('data'); setActiveContentTab('dataEntry'); setActiveDataTab('entry'); setDate(clickedDate); setUnitPrice(''); setFormData({}); setEntryToEdit(null); }
    };

    const handleTouchStart = (e) => { touchStartX.current = e.targetTouches[0].clientX; touchStartY.current = e.targetTouches[0].clientY; touchEndX.current = null; touchEndY.current = null; };
    const handleTouchMove = (e) => { touchEndX.current = e.targetTouches[0].clientX; touchEndY.current = e.targetTouches[0].clientY; };
    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current || !touchStartY.current || !touchEndY.current) return;
        const deltaX = touchStartX.current - touchEndX.current;
        const deltaY = touchStartY.current - touchEndY.current;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            const isRightSwipe = deltaX < -50;
            if (isRightSwipe && activeDataTab === 'list') {
                setActiveDataTab('entry');
            }
        }
        touchStartX.current = null; touchEndX.current = null; touchStartY.current = null; touchEndY.current = null;
    };

    const generateCalendarDays = useCallback(() => {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        let periodStartDate, periodEndDate;

        if (monthlyStartDay > monthlyEndDay) { 
            periodStartDate = new Date(year, month - 1, monthlyStartDay); 
            periodEndDate = new Date(year, month, monthlyEndDay); 
        } else { 
            periodStartDate = new Date(year, month, monthlyStartDay); 
            periodEndDate = new Date(year, month, monthlyEndDay); 
        }

        const toDateStr = (d) => {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };

        const pStartStr = toDateStr(periodStartDate);
        const pEndStr = toDateStr(periodEndDate);

        const calendarStartDate = new Date(periodStartDate);
        calendarStartDate.setDate(calendarStartDate.getDate() - calendarStartDate.getDay());
        
        const calendarEndDate = new Date(periodEndDate);
        if (calendarEndDate.getDay() !== 6) {
            calendarEndDate.setDate(calendarEndDate.getDate() + (6 - calendarEndDate.getDay()));
        }

        const days = [];
        let dayIterator = new Date(calendarStartDate);
        const todayStr = toDateStr(new Date());

        const breakdown = monthlyProfit.dailyBreakdown || {};

        while (dayIterator <= calendarEndDate) {
            const formattedDate = toDateStr(dayIterator);
            
            const isWithinPeriod = formattedDate >= pStartStr && formattedDate <= pEndStr;
            const isToday = formattedDate === todayStr;
            
            const dailyData = breakdown[formattedDate] || { revenue: 0, expenses: 0 };
            
            days.push({ 
                date: formattedDate, 
                day: dayIterator.getDate(), 
                isCurrentMonth: isWithinPeriod, 
                isToday: isToday, 
                revenue: isWithinPeriod ? dailyData.revenue : 0, 
                expenses: isWithinPeriod ? dailyData.expenses : 0 
            });

            dayIterator.setDate(dayIterator.getDate() + 1);
        }
        return days;
    }, [currentCalendarDate, monthlyStartDay, monthlyEndDay, monthlyProfit.dailyBreakdown]);

    const calendarDays = generateCalendarDays();
    const yearlyPeriod = useMemo(() => {
        const year = parseInt(selectedYear); let startDate, endDate;
        if (monthlyStartDay > monthlyEndDay) { startDate = new Date(year - 1, 11, monthlyStartDay); endDate = new Date(year, 11, monthlyEndDay); }
        else { startDate = new Date(year, 0, 1); endDate = new Date(year, 11, 31); }
        return { startDate: startDate.toLocaleDateString('ko-KR'), endDate: endDate.toLocaleDateString('ko-KR') };
    }, [selectedYear, monthlyStartDay, monthlyEndDay]);
    const cumulativePeriod = null;

    const handleNavigateToDataEntry = () => {
        setSelectedMainTab('data'); setActiveContentTab('dataEntry'); setActiveDataTab('entry'); setEntryToEdit(null);
        setDate(getTodayLocal()); setUnitPrice(''); setFormData({}); setFormType('income');
    };

    useAppBackButton({
        modalState, closeModal, showConfirmation, isFilterModalOpen, setIsFilterModalOpen,
        moreSubView, setMoreSubView, selectedMainTab, setSelectedMainTab, activeContentTab, setActiveContentTab
    });

    // [핵심] 데이터 로딩 중이면 스플래시 스크린(로딩 화면) 표시
    if (!isDataLoaded) {
        return (
            <div className={`fixed inset-0 w-full h-full flex flex-col items-center justify-center ${isDarkMode ? 'bg-[#111827]' : 'bg-white'}`}>
                <div className="animate-pulse flex flex-col items-center">
                    <img src={logoImage} alt="Loading..." className="w-24 h-24 mb-4" />
                    <p className={`text-lg font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        데이터 불러오는 중...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div 
            className={`fixed inset-0 w-full h-full font-sans flex flex-col items-center 
                ${isDarkMode ? 'bg-[#111827] text-gray-100' : 'bg-white text-gray-800'}`}
            style={{ 
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                paddingTop: '25.5px', 
                paddingBottom: '0px',
                marginTop: '0px !important', 
                marginBottom: '0px !important',
                backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                zIndex: 0
            }}
        >
            <SystemThemeManager isDarkMode={isDarkMode} />

          <div 
                className="w-full h-full overflow-y-auto pb-20"
                onClick={(e) => {
                    // 다른 버튼이나 입력창을 눌렀을 때는 무시하고, 진짜 바탕화면일 때만 반응
                    if (e.target.closest('button') || e.target.closest('input')) return;
                    setIsFabVisible(prev => !prev);
                }}
            >
                {isAuthReady && (
                    <>
                       {activeContentTab === 'monthlyProfit' && (
    <>
        <RevenueDistributionChart 
            monthlyProfit={monthlyProfit} 
            incomeConfig={incomeConfig} 
        />
                          
                            <div className="h-3"></div>
                            <div className={`p-4 sm:p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            <GoalProgressBar 
        current={monthlyProfit?.netProfit || 0} 
        goal={goalAmount} 
        isDarkMode={isDarkMode} 
    />
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <div className="w-16"></div>
                                    <div className="flex items-center space-x-1"> 
                                        <button onClick={() => handleMonthChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>
                                            <ChevronLeft size={20} />
                                        </button>
                                        <h3 className="font-bold text-lg min-w-fit text-center">
                                            {currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월
                                        </h3>
                                        <button onClick={() => handleMonthChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                  <div className="w-16 flex justify-end">
                <button 
                    onClick={handleTodayClick} 
                    className="py-1 px-3 rounded-lg font-bold text-xs border-2 border-yellow-400 text-yellow-500 transition duration-150 ease-in-out"
                >
                    오늘
                </button>
            </div>
                                </div>

                                    <div 
                                        className="calendar-view touch-pan-y"
                                        onTouchStart={onCalendarTouchStart}
                                        onTouchMove={onCalendarTouchMove}
                                        onTouchEnd={onCalendarTouchEnd}
                                    >
                                        <div className="grid grid-cols-7 text-center mb-1"> 
                                            {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                                                <div key={day} className={`text-xs sm:text-sm font-bold ${
                                                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                                                }`}>
                                                    {day}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-7 gap-x-0 gap-y-0"> 
                                            {calendarDays.map((dayInfo, index) => (
                                                <div 
                                                    key={index} 
                                                    onClick={() => handleCalendarDateClick(dayInfo.date)} 
                                                    className={`
                                                        cursor-pointer h-[55px] flex flex-col rounded-md 
                                                        ${isDarkMode ? 'bg-gray-800' : 'bg-white'}
                                                    `}
                                                >
                                                    <div className="h-[35px] w-full flex items-center justify-center pb-0.5"> 
                                                        <span className={`
                                                            flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                                                            ${!dayInfo.isCurrentMonth ? 'text-gray-300' : ''} 
                                                            ${dayInfo.isCurrentMonth && index % 7 === 0 ? 'text-red-500' : ''} 
                                                            ${dayInfo.isCurrentMonth && index % 7 === 6 ? 'text-blue-500' : ''} 
                                                            ${dayInfo.isToday ? 'border-4 border-yellow-400 shadow-sm' : ''} 
                                                        `}>
                                                            {dayInfo.day}
                                                        </span>
                                                    </div>

                                                    <div className="flex-1 w-full flex flex-col items-center justify-start -mt-0.5">
                                                        {dayInfo.isCurrentMonth && dayInfo.revenue > 0 && (
                                                            <span className="text-red-500 text-[8px] font-medium leading-none mb-0.5">
                                                                {dayInfo.revenue.toLocaleString()}
                                                            </span>
                                                        )}
                                                        {dayInfo.isCurrentMonth && dayInfo.expenses > 0 && (
                                                            <span className="text-blue-500 text-[8px] font-medium leading-none">
                                                                {dayInfo.expenses.toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                      </div>
    </div>
    </div>
    </>
)}

                        {activeContentTab === 'dataEntry' && (
                            // 껍데기를 모두 벗기고 화면 전체를 쓰도록 확장했습니다.
                            <div className="w-full h-full flex flex-col pt-2" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                                <div className="flex justify-center border-b mb-2 px-4">
                                    <button onClick={() => setActiveDataTab('entry')} className={`py-2 px-4 font-semibold ${activeDataTab === 'entry' ? (isDarkMode ? 'border-amber-400 text-amber-400' : 'border-amber-600 text-amber-700') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}>입력</button>
                                    <button onClick={() => setActiveDataTab('list')} className={`py-2 px-4 font-semibold ${activeDataTab === 'list' ? (isDarkMode ? 'border-amber-400 text-amber-400' : 'border-amber-600 text-amber-700') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}>데이터</button>
                                </div>
                                {activeDataTab === 'entry' && (
                                    <DataEntryForm
    entries={entries}                   
    handleSubmit={handleSubmit} 
    date={date} 
    setDate={setDate} 
    handleDateChange={handleDateChange} 
    dateInputRef={dateInputRef}
    formType={formType} 
    setFormType={setFormType} 
    isDarkMode={isDarkMode} 
    entryToEdit={entryToEdit}
    unitPrice={unitPrice} 
    setUnitPrice={setUnitPrice}
    formData={formData} 
    setFormData={setFormData}  
    handleInputChange={handleInputChange}

    incomeConfig={incomeConfig} 
    expenseConfig={expenseConfig}
    favoriteUnitPrices={favoriteUnitPrices}
    
    onNavigate={(tab) => { setActiveDataTab(tab); }}
/>
                                )}
                                {activeDataTab === 'list' && (
    <EntriesList
        entries={finalFilteredEntries}
        summary={{
            totalRevenue: finalFilteredEntries.reduce((sum, entry) => {
                // 1. 옛날 데이터 호환용 (기본 항목)
                const basicRevenue = (entry.unitPrice * (entry.deliveryCount||0)) + 
                                     (entry.unitPrice * (entry.returnCount||0)) + 
                                     (entry.unitPrice * (entry.deliveryInterruptionAmount||0)) + 
                                     (entry.unitPrice * (entry.freshBagCount || 0));
                
                // 2. [수정됨] 커스텀 항목: (금액) + (수량 × 단가) 모두 합산
                const extraRevenue = (entry.customItems || [])
                    .filter(i => i.type === 'income')
                    .reduce((s, i) => {
                        const amount = Number(i.amount) || 0;
                        const calculated = (Number(i.count) || 0) * (Number(i.unitPrice) || 0);
                        return s + amount + calculated;
                    }, 0);

                return sum + basicRevenue + extraRevenue;
            }, 0),
            
            // 지출 부분은 기존과 동일하게 유지
            totalExpenses: finalFilteredEntries.reduce((sum, entry) => {
                const hasCustomItems = entry.customItems && entry.customItems.length > 0;
                const expenseSum = hasCustomItems
                    ? entry.customItems.filter(i => i.type === 'expense').reduce((s, i) => s + (Number(i.amount) || 0), 0)
                    : ((entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0));
                return sum + expenseSum;
            }, 0),
            entryNetProfit: Object.fromEntries(finalFilteredEntries.map(entry => [entry.id, 0])),
            filterLabel: filters.label || '전체'
        }}
        handleEdit={handleEdit} 
        handleDelete={handleDelete} 
        isDarkMode={isDarkMode} 
        onOpenFilter={() => setIsFilterModalOpen(true)} 
        filterType={filters.type}
    />
)}
                            </div>
                        )}

                        {activeContentTab === 'statistics' && (
                            <StatsDisplay statisticsView={statisticsView} setStatisticsView={setStatisticsView} handleMonthChange={handleMonthChange} selectedYear={selectedYear} currentCalendarDate={currentCalendarDate} monthlyProfit={monthlyProfit} yearlyProfit={yearlyProfit} cumulativeProfit={cumulativeProfit} previousMonthlyProfit={previousMonthlyProfit} isDarkMode={isDarkMode} showMessage={showMessage} monthlyStatsSubTab={monthlyStatsSubTab} setMonthlyStatsSubTab={setMonthlyStatsSubTab} setSelectedYear={setSelectedYear} yearlyPeriod={yearlyPeriod} cumulativePeriod={cumulativePeriod} />
                        )}

                        {activeContentTab === 'adminSettings' && (
                            <div className={`p-4 sm:p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                {moreSubView === 'main' && <MoreView onNavigate={setMoreSubView} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />}
                                {moreSubView === 'account' && <AccountView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} handleLogout={handleLogout} />}
                                {moreSubView === 'unitPrice' && <UnitPriceView onBack={() => { setMoreSubView('main'); setTargetItemKey(null); }} isDarkMode={isDarkMode} adminFavoritePricesInput={adminFavoritePricesInput} setAdminFavoritePricesInput={setAdminFavoritePricesInput} handleSaveFavoritePrices={handleSaveFavoritePrices} favoriteUnitPrices={favoriteUnitPrices} targetItemKey={targetItemKey} incomeConfig={incomeConfig} setIncomeConfig={setIncomeConfig} />}
                                {moreSubView === 'period' && <PeriodView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} adminMonthlyStartDayInput={adminMonthlyStartDayInput} setAdminMonthlyStartDayInput={setAdminMonthlyStartDayInput} adminMonthlyEndDayInput={adminMonthlyEndDayInput} setAdminMonthlyEndDayInput={setAdminMonthlyEndDayInput} handleSaveMonthlyPeriodSettings={handleSaveMonthlyPeriodSettings} monthlyStartDay={monthlyStartDay} monthlyEndDay={monthlyEndDay} />}
                                {moreSubView === 'data' && <DataSettingsView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} handleExportCsv={() => exportDataAsCsv(entries, showMessage)} handleImportCsv={(e) => handleLocalCsvImport(e.target.files[0])} handleDeleteAllData={handleDeleteAllDataRequest} handleBackupToDrive={() => backupToDrive(entries)} handleRestoreFromDrive={handleCloudRestore} />}
                                {moreSubView === 'expenseSettings' && <ExpenseSettingsView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} expenseConfig={expenseConfig} setExpenseConfig={setExpenseConfig} incomeConfig={incomeConfig} setIncomeConfig={setIncomeConfig} onNavigate={(view, key) => { setMoreSubView(view); if (key) setTargetItemKey(key); }} />}
                                {moreSubView === 'userGuide' && <UserGuideView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} />}
                                {moreSubView === 'legalInfo' && <LegalInfoView onBack={() => setMoreSubView('main')} onNavigate={setMoreSubView} isDarkMode={isDarkMode} />}
                                {moreSubView === 'privacyPolicy' && <PrivacyPolicy onBack={() => setMoreSubView('legalInfo')} isDarkMode={isDarkMode} />}
                                {moreSubView === 'openSource' && <OpenSourceLicenses onBack={() => setMoreSubView('legalInfo')} isDarkMode={isDarkMode} />}
                                {moreSubView === 'contact' && <ContactView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} />}
                                {moreSubView === 'goal' && <GoalSettingsView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} goalAmount={goalAmount} onSaveGoal={(amount) => { setGoalAmount(amount); saveSettingsToLocal({ goalAmount: amount }); showMessage("목표 금액이 성공적으로 변경되었습니다!"); }} />}
                            </div>
                        )}
                    </>
                )}
            </div>

      {activeContentTab === 'monthlyProfit' && (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isFabVisible) handleNavigateToDataEntry();
                        else setIsFabVisible(true);
                    }} 
                    // right-4 를 right-2 로 변경하여 오른쪽 빈 공간을 확 줄였습니다.
                    className={`fixed z-40 right-2 px-6 py-2.5 rounded-full shadow-lg transition-all duration-300 flex justify-center items-center font-bold tracking-widest border-2 ${
                        isDarkMode ? 'bg-gray-900 border-yellow-500 text-yellow-400' : 'bg-gray-800 border-gray-700 text-yellow-400'
                    } ${
                        isFabVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                    }`} 
                    style={{ bottom: 'calc(70px + env(safe-area-inset-bottom))' }}
                >
                    <span>입력</span>
                </button>
            )}
            {isAuthReady && (
                   <div 
                    className={`fixed bottom-0 left-0 right-0 w-full ${isDarkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'} shadow-lg flex justify-around py-2 px-4 pb-[env(safe-area-inset-bottom)] z-50 select-none`}
                    style={{ WebkitTouchCallout: 'none' }}
                >

                    <button 
                        className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'data' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`} 
                        onClick={() => { 
                            if (selectedMainTab === 'data') {
                                setEntryToEdit(null);      
                                setActiveDataTab('entry'); 
                                setFormType('income');     
                                setDate(getTodayLocal());  
                            } else {
                                setSelectedMainTab('data'); 
                                setActiveContentTab('dataEntry'); 
                                setActiveDataTab('entry'); 
                                setFormType('income');     
                                setEntryToEdit(null);      
                                setDate(getTodayLocal()); 
                            }
                        }}
                    >
                        <List size={24} /> <span>데이터</span>
                    </button>
                    <button className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'statistics' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`} onClick={() => { setSelectedMainTab('statistics'); setActiveContentTab('statistics'); setStatisticsView('monthly'); setMonthlyStatsSubTab('overview'); }}>
                        <BarChart2 size={24} /> <span>통계</span>
                    </button>
                    <button className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'home' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`} onClick={() => { setSelectedMainTab('home'); setActiveContentTab('monthlyProfit'); }}>
                        <Home size={24} /> <span>홈</span>
                    </button>
                    <button className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'more' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`} onClick={() => { setSelectedMainTab('more'); setActiveContentTab('adminSettings'); setMoreSubView('main'); }}>
                        <MoreHorizontal size={24} /> <span>더보기</span>
                    </button>
                </div>
            )}

            <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} onApply={handleApplyFilters} initialFilters={filters} isDarkMode={isDarkMode} entries={entries} />
            {isLoading && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex flex-col items-center justify-center z-[99]">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mb-4"></div>
                    <p className="text-white text-xl font-semibold">{loadingMessage}</p>
                </div>
            )}
            <MessageModal isOpen={modalState.isOpen} content={modalState.content} type={modalState.type} onConfirm={handleConfirm} onClose={closeModal} isDarkMode={isDarkMode} />
        </div>
    );
}

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<AppContent />} />
                <Route path="/calculator" element={<CalculatorPageWrapper />} />
            </Routes>
        </Router>
    );
}

function CalculatorPageWrapper() {
    const navigate = useNavigate();
    const location = useLocation();
    
    const { date, currentRound, incomeConfig, isDarkMode } = location.state || {};
    const { saveEntry } = useDelivery(); 

    const handleApply = (results) => {
        saveEntry({
            type: 'income',
            date: date,
            round: currentRound || 0,
            ...results
        });
        navigate(-1);
    };

    return (
        <CalculatorPage 
            date={date}
            currentRound={currentRound}
            incomeConfig={incomeConfig || []}
            isDarkMode={isDarkMode}
            onBack={() => navigate(-1)} 
            onApply={handleApply} 
        />
    );
}

export default App;