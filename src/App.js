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
import { useDelivery } from './contexts/DeliveryContext';
import { exportDataAsCsv, importDataFromCsv } from './utils/dataHandlers.js';

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

function AppContent() {
    const navigate = useNavigate();
    const { entries, saveEntry, deleteEntry, clearAllEntries, saveToLocalStorage } = useDelivery();

    // --- State 관리 ---
    const [targetItemKey, setTargetItemKey] = useState(null);
    const [goalAmount, setGoalAmount] = useState(7000000);
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [newGoalAmountInput, setNewGoalAmountInput] = useState('');
    const isAuthReady = true;
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [selectedMainTab, setSelectedMainTab] = useState('home');
    const [activeContentTab, setActiveContentTab] = useState('monthlyProfit');
    const [activeDataTab, setActiveDataTab] = useState('entry');
    const [moreSubView, setMoreSubView] = useState('main');
    const [date, setDate] = useState(getTodayLocal());
    const [unitPrice, setUnitPrice] = useState('');
    const [formData, setFormData] = useState({});
    const [formType, setFormType] = useState('income');
    const [entryToEdit, setEntryToEdit] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [statisticsView, setStatisticsView] = useState('monthly');
    const [monthlyStatsSubTab, setMonthlyStatsSubTab] = useState('overview');
    const [favoriteUnitPrices, setFavoriteUnitPrices] = useState([700]);
    const [adminFavoritePricesInput, setAdminFavoritePricesInput] = useState('700');
    const [monthlyStartDay, setMonthlyStartDay] = useState(26);
    const [monthlyEndDay, setMonthlyEndDay] = useState(25);
    const [adminMonthlyStartDayInput, setAdminMonthlyStartDayInput] = useState('26');
    const [adminMonthlyEndDayInput, setAdminMonthlyEndDayInput] = useState('25');
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
            { key: 'deliveryCount', label: '배송 수량', isVisible: true },
            { key: 'deliveryInterruptionAmount', label: '배송중단', isVisible: true },
            { key: 'returnCount', label: '반품 수량', isVisible: true },
            { key: 'freshBagCount', label: '프레시백 수량', isVisible: true },
        ];
    });
    const [sortColumn, setSortColumn] = useState('date');
    const [sortDirection, setSortDirection] = useState('desc');
    const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
    const [showMonthlyDetails, setShowMonthlyDetails] = useState(true);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [filters, setFilters] = useState({ period: 'all', startDate: '', endDate: '', type: 'all' });
    const [modalState, setModalState] = useState({ isOpen: false, content: '', type: 'info', onConfirm: null });
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const dateInputRef = useRef(null);
    const touchStartX = useRef(null);
    const touchEndX = useRef(null);
    const touchStartY = useRef(null);
    const touchEndY = useRef(null);

    // --- Effects ---
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

    const handleLocalCsvImport = (file) => {
        importDataFromCsv(file, entries, (mergedData) => saveToLocalStorage(mergedData), showMessage, setIsLoading);
    };

    useEffect(() => {
        const savedView = localStorage.getItem('homeView');
        if (savedView !== null) setShowMonthlyDetails(JSON.parse(savedView));
    }, []);
    useEffect(() => { localStorage.setItem('homeView', JSON.stringify(showMonthlyDetails)); }, [showMonthlyDetails]);
    useEffect(() => {
        const loadDarkModeSetting = async () => {
            const { value } = await Preferences.get({ key: 'isDarkMode' });
            if (value !== null) setIsDarkMode(JSON.parse(value));
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
    // setDate(getTodayLocal()); // ✅ 이 줄을 삭제하거나 주석 처리!
    // 날짜는 그대로 두고, 내용만 비웁니다.
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

    // 🔥 [핵심 수정] 저장 전 유효성 검사 로직 (매출 0원 차단)
    const handleSubmit = async (e, round, customItems = []) => {
        e.preventDefault();
        
      // 2. 루트 필드(배송, 반품 등) 유효성 체크
    const parsedFormData = {};
    Object.keys(formData).forEach(key => {
        // 🔥 [수정] 'memo'는 숫자로 바꾸지 않고 글자 그대로 저장
        if (key === 'memo') {
            parsedFormData[key] = formData[key];
        } else {
            parsedFormData[key] = formData[key] ? parseFloat(formData[key]) : 0;
        }
    });
    
    // 🔥 [수정] 데이터 유무 체크 시 'memo'는 제외하고 계산 (돈이나 수량이 있어야 저장됨)
    const hasRootData = Object.entries(parsedFormData).some(([key, val]) => {
        if (key === 'memo') return false; 
        return val > 0;
    });
    
        const hasCustomData = customItems && customItems.length > 0;

        if (!hasRootData && !hasCustomData) {
            showMessage("❗ 입력된 정보가 없습니다.\n수량이나 금액을 입력해주세요.");
            return;
        }

        // 2. 수익(Income)일 때 매출액 0원 검사
        if (formType === 'income') {
            // A. 루트 항목(배송수량 등)이 있는데 공통 단가가 없는 경우
            const commonUnitPrice = parseFloat(unitPrice) || 0;
            if (hasRootData && commonUnitPrice === 0) {
                showMessage("❗ 단가를 설정해주세요.\n(기본 배송 항목은 공통 단가가 필요합니다)");
                return;
            }

            // B. 커스텀 항목들의 매출 계산
            // (커스텀 항목은 개별 단가가 있으면 그걸 쓰고, 없으면 공통 단가를 이미 DataEntryForm에서 상속받아 옴)
            // 그래도 혹시 모르니 확인
            const customRevenue = customItems.reduce((sum, item) => {
                const count = parseFloat(item.count) || 0;
                const price = parseFloat(item.unitPrice) || 0;
                return sum + (count * price);
            }, 0);

            // C. 루트 항목 매출
            const rootRevenue = Object.values(parsedFormData).reduce((sum, val) => sum + val, 0) * commonUnitPrice;

            // D. 총 매출이 0원이면 차단 (단, 수량은 입력했는데 돈이 0원인 경우)
            if ((rootRevenue + customRevenue) === 0) {
                // 수량은 있는데 돈이 0원인지 확인
                const totalCount = Object.values(parsedFormData).reduce((sum, val) => sum + val, 0) + customItems.reduce((sum, item) => sum + (parseFloat(item.count) || 0), 0);
                
                if (totalCount > 0) {
                    showMessage("❗ 단가를 설정해주세요.\n(매출이 0원입니다)");
                    return;
                }
            }
        }

        const newEntryData = {
            id: entryToEdit?.id, 
            type: formType,      
            date,
            unitPrice: unitPrice ? parseFloat(unitPrice) : 0,
            ...parsedFormData,
            round: round || 0,
            customItems 
        };

        saveEntry(newEntryData);
        showMessage(entryToEdit ? "✅ 수정되었습니다." : "✅ 저장되었습니다."); 

        setEntryToEdit(null);
        resetForm();
    };
  
    const handleEdit = (entry) => {
        setEntryToEdit(entry);
        setDate(entry.date);
        setUnitPrice(entry.unitPrice.toString());
        const { id, date, unitPrice, timestamp, round, ...rest } = entry;
        const stringifiedData = {};
        
        Object.keys(rest).forEach(key => {
            if (key !== 'customItems') {
                stringifiedData[key] = rest[key] ? rest[key].toString() : '';
            }
        });

        if (entry.customItems && Array.isArray(entry.customItems)) {
            entry.customItems.forEach(item => {
                const val = item.type === 'income' ? item.count : item.amount;
                stringifiedData[item.key] = val ? val.toString() : '';
            });
        }

        setFormData(stringifiedData);
        const isExpense = expenseConfig.some(item => rest[item.key] > 0) || (entry.customItems || []).some(i => i.type === 'expense');
        setFormType(isExpense ? 'expense' : 'income');
        setActiveDataTab('entry');
        setSelectedMainTab('data');
        setActiveContentTab('dataEntry');
        setEntryToEdit(null);      
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

    const { monthlyProfit, yearlyProfit, cumulativeProfit, previousMonthlyProfit } = useProfitCalculations(entries, selectedMonth, selectedYear, monthlyStartDay, monthlyEndDay, "local-user");
    const monthlyEntriesForChart = useMemo(() => {
        if (!monthlyProfit?.periodStartDate || !monthlyProfit?.periodEndDate) return [];
        return entries.filter(e => e.date >= monthlyProfit.periodStartDate && e.date <= monthlyProfit.periodEndDate);
    }, [entries, monthlyProfit]);

    const renderComparison = (currentValue, previousValue, isCurrency = false) => {
        if (previousValue === 0 && currentValue === 0) return <span className="text-gray-500">-</span>;
        if (previousValue === 0) return <span className="text-red-500 flex items-center text-xs sm:text-sm">{currentValue.toLocaleString()} {isCurrency ? '원' : ''} <ArrowUp size={14} className="ml-1" /></span>;
        const diff = currentValue - previousValue;
        const colorClass = diff > 0 ? 'text-red-500' : (diff < 0 ? 'text-blue-500' : 'text-gray-500');
        const arrow = diff > 0 ? <ArrowUp size={14} className="ml-1" /> : (diff < 0 ? <ArrowDown size={14} className="ml-1" /> : null);
        return <span className={`${colorClass} flex items-center text-xs sm:text-sm`}>{Math.abs(diff).toLocaleString()} {isCurrency ? '원' : ''} {arrow}</span>;
    };

    const finalFilteredEntries = useMemo(() => {
        const filtered = entries.filter(entry => {
            const extraRevenue = (entry.customItems || []).filter(i => i.type === 'income').reduce((s, i) => {
                const price = i.unitPrice || 0;
                const cnt = i.count || 0;
                const amt = i.amount || 0;
                return s + (price > 0 ? price * cnt : amt);
            }, 0);
            const extraExpense = (entry.customItems || []).filter(i => i.type === 'expense').reduce((s, i) => s + (Number(i.amount) || 0), 0);
            const dailyRevenue = (entry.unitPrice * (entry.deliveryCount || 0)) + (entry.unitPrice * (entry.returnCount || 0)) + (entry.unitPrice * (entry.deliveryInterruptionAmount || 0)) + ((entry.freshBagCount || 0) * 100) + extraRevenue;
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
    const handleMonthChange = (direction) => { setCurrentCalendarDate(prevDate => { const newDate = new Date(prevDate); newDate.setMonth(newDate.getMonth() + direction); setSelectedMonth(newDate.toISOString().slice(0, 7)); return newDate; }); };
    
    const onCalendarTouchStart = (e) => { touchStartX.current = e.targetTouches[0].clientX; touchEndX.current = null; };
    const onCalendarTouchMove = (e) => { touchEndX.current = e.targetTouches[0].clientX; };
    const onCalendarTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        const distance = touchStartX.current - touchEndX.current;
        if (distance > 50) handleMonthChange(1);
        else if (distance < -50) handleMonthChange(-1);
    };
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
        if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -50 && activeDataTab === 'list') { setActiveDataTab('entry'); }
        touchStartX.current = null; touchEndX.current = null; touchStartY.current = null; touchEndY.current = null;
    };

    const generateCalendarDays = useCallback(() => {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        let periodStartDate, periodEndDate;
        if (monthlyStartDay > monthlyEndDay) { periodStartDate = new Date(year, month - 1, monthlyStartDay); periodEndDate = new Date(year, month, monthlyEndDay); } 
        else { periodStartDate = new Date(year, month, monthlyStartDay); periodEndDate = new Date(year, month, monthlyEndDay); }
        const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const pStartStr = toDateStr(periodStartDate);
        const pEndStr = toDateStr(periodEndDate);
        const calendarStartDate = new Date(periodStartDate);
        calendarStartDate.setDate(calendarStartDate.getDate() - calendarStartDate.getDay());
        const calendarEndDate = new Date(periodEndDate);
        if (calendarEndDate.getDay() !== 6) calendarEndDate.setDate(calendarEndDate.getDate() + (6 - calendarEndDate.getDay()));
        const days = [];
        let dayIterator = new Date(calendarStartDate);
        const todayStr = toDateStr(new Date());
        while (dayIterator <= calendarEndDate) {
            const formattedDate = toDateStr(dayIterator);
            const isWithinPeriod = formattedDate >= pStartStr && formattedDate <= pEndStr;
            const dailyData = monthlyProfit.dailyBreakdown[formattedDate] || { revenue: 0, expenses: 0 };
            days.push({ date: formattedDate, day: dayIterator.getDate(), isCurrentMonth: isWithinPeriod, isToday: formattedDate === todayStr, revenue: isWithinPeriod ? dailyData.revenue : 0, expenses: isWithinPeriod ? dailyData.expenses : 0 });
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

    const handleNavigateToDataEntry = () => { setSelectedMainTab('data'); setActiveContentTab('dataEntry'); setActiveDataTab('entry'); setEntryToEdit(null); setDate(getTodayLocal()); setUnitPrice(''); setFormData({}); setFormType('income'); };

    useAppBackButton({ modalState, closeModal, showConfirmation, isFilterModalOpen, setIsFilterModalOpen, moreSubView, setMoreSubView, selectedMainTab, setSelectedMainTab, activeContentTab, setActiveContentTab });

    return (
        <div className={`fixed inset-0 w-full h-full font-sans flex flex-col items-center ${isDarkMode ? 'bg-[#111827] text-gray-100' : 'bg-white text-gray-800'}`} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, paddingTop: '25.5px', paddingBottom: '0px', marginTop: '0px !important', marginBottom: '0px !important', backgroundColor: isDarkMode ? '#111827' : '#ffffff', zIndex: 0 }}>
            <SystemThemeManager isDarkMode={isDarkMode} />
            <div className="w-full h-full overflow-y-auto pb-20">
                {isAuthReady && (
                    <>
                        {activeContentTab === 'monthlyProfit' && (
                            <>
                                <RevenueDistributionChart monthlyProfit={monthlyProfit} entries={monthlyEntriesForChart} incomeConfig={incomeConfig} />
                                <div className="h-3"></div>
                                <div className={`p-4 sm:p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                    <div className="flex items-center justify-between mb-4 px-1">
                                        <div className="w-16"></div>
                                        <div className="flex items-center space-x-1"> 
                                            <button onClick={() => handleMonthChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}><ChevronLeft size={20} /></button>
                                            <h3 className="font-bold text-lg min-w-fit text-center">{currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월</h3>
                                            <button onClick={() => handleMonthChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}><ChevronRight size={20} /></button>
                                        </div>
                                        <div className="w-16 flex justify-end">
                                            <button onClick={() => setShowMonthlyDetails(!showMonthlyDetails)} className={`py-1.5 px-3 rounded-lg font-bold text-xs transition duration-150 ease-in-out ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{showMonthlyDetails ? '달력' : '상세'}</button>
                                        </div>
                                    </div>
                                    {!showMonthlyDetails ? (
                                        <div className="calendar-view touch-pan-y" onTouchStart={onCalendarTouchStart} onTouchMove={onCalendarTouchMove} onTouchEnd={onCalendarTouchEnd}>
                                            <div className="grid grid-cols-7 text-center mb-1"> 
                                                {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (<div key={day} className={`text-xs sm:text-sm font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : (isDarkMode ? 'text-gray-400' : 'text-gray-500')}`}>{day}</div>))}
                                            </div>
                                            <div className="grid grid-cols-7 gap-x-0 gap-y-0"> 
                                                {calendarDays.map((dayInfo, index) => (
                                                    <div key={index} onClick={() => handleCalendarDateClick(dayInfo.date)} className={`cursor-pointer h-[55px] flex flex-col rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                                        <div className="h-[35px] w-full flex items-center justify-center pb-0.5"> <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${!dayInfo.isCurrentMonth ? 'text-gray-300' : ''} ${dayInfo.isCurrentMonth && index % 7 === 0 ? 'text-red-500' : ''} ${dayInfo.isCurrentMonth && index % 7 === 6 ? 'text-blue-500' : ''} ${dayInfo.isToday ? 'border-4 border-yellow-400 shadow-sm' : ''}`}>{dayInfo.day}</span></div>
                                                        <div className="flex-1 w-full flex flex-col items-center justify-start -mt-0.5">
                                                            {dayInfo.isCurrentMonth && dayInfo.revenue > 0 && (<span className="text-red-500 text-[8px] font-medium leading-none mb-0.5">{dayInfo.revenue.toLocaleString()}</span>)}
                                                            {dayInfo.isCurrentMonth && dayInfo.expenses > 0 && (<span className="text-blue-500 text-[8px] font-medium leading-none">{dayInfo.expenses.toLocaleString()}</span>)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="progress-container"><div className="progress-bar"><div className="fill" style={{ width: `${goalAmount > 0 ? Math.min(100, Math.max(0, (monthlyProfit.netProfit / goalAmount) * 100)) : 0}%` }}></div></div><span className="percent-text">{goalAmount > 0 ? Math.round((monthlyProfit.netProfit / goalAmount) * 100) : 0}%</span></div>
                                            <div className={`pl-6 pr-[23px] py-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} space-y-3 shadow`}>
                                                <DetailRow label="총 근무일" value={`${monthlyProfit.totalWorkingDays.toLocaleString()} 일`} comparison={renderComparison(monthlyProfit.totalWorkingDays, previousMonthlyProfit.totalWorkingDays)} />
                                                <DetailRow label="총 물량" value={`${monthlyProfit.totalVolume.toLocaleString()} 건`} comparison={renderComparison(monthlyProfit.totalVolume, previousMonthlyProfit.totalVolume)} />
                                                <DetailRow label="총 프레시백" value={`${monthlyProfit.totalFreshBag.toLocaleString()} 개`} comparison={renderComparison(monthlyProfit.totalFreshBag, previousMonthlyProfit.totalFreshBag)} />
                                                <DetailRow label="일 평균 물량" value={`${Math.round(monthlyProfit.dailyAverageVolume)} 건`} comparison={renderComparison(Math.round(monthlyProfit.dailyAverageVolume), Math.round(previousMonthlyProfit.dailyAverageVolume))} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        {activeContentTab === 'dataEntry' && (
                            <div className={`p-4 sm:p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                                <div className="flex justify-center border-b mb-4">
                                    <button onClick={() => setActiveDataTab('entry')} className={`py-2 px-4 font-semibold ${activeDataTab === 'entry' ? (isDarkMode ? 'border-amber-400 text-amber-400' : 'border-amber-600 text-amber-700') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}>입력</button>
                                    <button onClick={() => setActiveDataTab('list')} className={`py-2 px-4 font-semibold ${activeDataTab === 'list' ? (isDarkMode ? 'border-amber-400 text-amber-400' : 'border-amber-600 text-amber-700') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}>데이터</button>
                                </div>
                                {activeDataTab === 'entry' && (
                                    <DataEntryForm
                                        handleSubmit={handleSubmit} date={date} setDate={setDate} handleDateChange={handleDateChange} dateInputRef={dateInputRef}
                                        formType={formType} setFormType={setFormType} isDarkMode={isDarkMode} entryToEdit={entryToEdit}
                                        unitPrice={unitPrice} setUnitPrice={setUnitPrice}
                                        formData={formData} handleInputChange={handleInputChange} setFormData={setFormData}
                                        incomeConfig={incomeConfig} setIncomeConfig={setIncomeConfig} expenseConfig={expenseConfig}
                                        favoriteUnitPrices={favoriteUnitPrices}
                                        onOpenCalculator={(d, r) => navigate('/calculator', { state: { date: d, currentRound: r, incomeConfig, isDarkMode } })}
                                        onNavigate={(tab) => { setActiveDataTab(tab); }}
                                    />
                                )}
                                {activeDataTab === 'list' && (
                                    <EntriesList
                                        entries={finalFilteredEntries}
                                        summary={{
                                            totalRevenue: finalFilteredEntries.reduce((sum, entry) => {
                                                const basicRevenue = (entry.unitPrice * (entry.deliveryCount||0)) + (entry.unitPrice * (entry.returnCount||0)) + (entry.unitPrice * (entry.deliveryInterruptionAmount||0)) + ((entry.freshBagCount||0) * 100);
                                                const extraRevenue = (entry.customItems || []).filter(i => i.type === 'income').reduce((s, i) => { const price = i.unitPrice || 0; const cnt = i.count || 0; const amt = i.amount || 0; return s + (price > 0 ? price * cnt : amt); }, 0);
                                                return sum + basicRevenue + extraRevenue;
                                            }, 0),
                                            totalExpenses: finalFilteredEntries.reduce((sum, entry) => {
                                                const hasCustomItems = entry.customItems && entry.customItems.length > 0;
                                                const expenseSum = hasCustomItems ? entry.customItems.filter(i => i.type === 'expense').reduce((s, i) => s + (Number(i.amount) || 0), 0) : ((entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0));
                                                return sum + expenseSum;
                                            }, 0),
                                            entryNetProfit: Object.fromEntries(finalFilteredEntries.map(entry => [entry.id, 0])),
                                            filterLabel: filters.label || '전체'
                                        }}
                                        handleEdit={handleEdit} handleDelete={handleDelete} isDarkMode={isDarkMode} onOpenFilter={() => setIsFilterModalOpen(true)} filterType={filters.type}
                                    />
                                )}
                            </div>
                        )}
                        {activeContentTab === 'statistics' && (<StatsDisplay statisticsView={statisticsView} setStatisticsView={setStatisticsView} handleMonthChange={handleMonthChange} selectedYear={selectedYear} currentCalendarDate={currentCalendarDate} monthlyProfit={monthlyProfit} yearlyProfit={yearlyProfit} cumulativeProfit={cumulativeProfit} previousMonthlyProfit={previousMonthlyProfit} isDarkMode={isDarkMode} showMessage={showMessage} monthlyStatsSubTab={monthlyStatsSubTab} setMonthlyStatsSubTab={setMonthlyStatsSubTab} setSelectedYear={setSelectedYear} yearlyPeriod={yearlyPeriod} cumulativePeriod={cumulativePeriod} />)}
                        {activeContentTab === 'adminSettings' && (
                            <div className={`p-4 sm:p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                {moreSubView === 'main' && <MoreView onNavigate={setMoreSubView} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />}
                                {moreSubView === 'account' && <AccountView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} handleLogout={handleLogout} />}
                                {moreSubView === 'unitPrice' && <UnitPriceView onBack={() => { setMoreSubView('main'); setTargetItemKey(null); }} isDarkMode={isDarkMode} adminFavoritePricesInput={adminFavoritePricesInput} setAdminFavoritePricesInput={setAdminFavoritePricesInput} handleSaveFavoritePrices={handleSaveFavoritePrices} favoriteUnitPrices={favoriteUnitPrices} targetItemKey={targetItemKey} incomeConfig={incomeConfig} setIncomeConfig={setIncomeConfig} />}
                                {moreSubView === 'period' && <PeriodView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} adminMonthlyStartDayInput={adminMonthlyStartDayInput} setAdminMonthlyStartDayInput={setAdminMonthlyStartDayInput} adminMonthlyEndDayInput={adminMonthlyEndDayInput} setAdminMonthlyEndDayInput={setAdminMonthlyEndDayInput} handleSaveMonthlyPeriodSettings={handleSaveMonthlyPeriodSettings} monthlyStartDay={monthlyStartDay} monthlyEndDay={monthlyEndDay} />}
                                {moreSubView === 'data' && <DataSettingsView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} handleExportCsv={() => exportDataAsCsv(entries, showMessage)} handleImportCsv={(e) => handleLocalCsvImport(e.target.files[0])} handleDeleteAllData={handleDeleteAllDataRequest} handleBackupToDrive={() => backupToDrive(entries)} />}
                                {moreSubView === 'expenseSettings' && <ExpenseSettingsView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} expenseConfig={expenseConfig} setExpenseConfig={setExpenseConfig} incomeConfig={incomeConfig} setIncomeConfig={setIncomeConfig} onNavigate={(view, key) => { setMoreSubView(view); if (key) setTargetItemKey(key); }} />}
                                {moreSubView === 'userGuide' && <UserGuideView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} />}
                                {moreSubView === 'legalInfo' && <LegalInfoView onBack={() => setMoreSubView('main')} onNavigate={setMoreSubView} isDarkMode={isDarkMode} />}
                                {moreSubView === 'privacyPolicy' && <PrivacyPolicy onBack={() => setMoreSubView('legalInfo')} isDarkMode={isDarkMode} />}
                                {moreSubView === 'openSource' && <OpenSourceLicenses onBack={() => setMoreSubView('legalInfo')} isDarkMode={isDarkMode} />}
                                {moreSubView === 'contact' && <ContactView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} />}
                            </div>
                        )}
                    </>
                )}
            </div>
            {activeContentTab === 'monthlyProfit' && showMonthlyDetails && ( <button onClick={handleNavigateToDataEntry} className="fixed bottom-28 right-6 z-40 p-4 transition-transform hover:scale-150" aria-label="데이터 기록하기"><Plus size={36} className={`${isDarkMode ? 'text-gray-200' : 'text-black'}`} /></button>)}
            {isAuthReady && (
                <div className={`fixed bottom-0 left-0 right-0 w-full ${isDarkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'} shadow-lg flex justify-around py-2 px-4 pb-[env(safe-area-inset-bottom)] z-50`}>
                    <button className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'data' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`} onClick={() => { if (selectedMainTab === 'data') { setEntryToEdit(null); setActiveDataTab('entry'); setFormType('income'); setDate(getTodayLocal()); } else { setSelectedMainTab('data'); setActiveContentTab('dataEntry'); setActiveDataTab('entry'); setFormType('income'); setEntryToEdit(null); setDate(getTodayLocal()); } }}><List size={24} /> <span>데이터</span></button>
                    <button className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'statistics' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`} onClick={() => { setSelectedMainTab('statistics'); setActiveContentTab('statistics'); setStatisticsView('monthly'); setMonthlyStatsSubTab('overview'); }}><BarChart2 size={24} /> <span>통계</span></button>
                    <button className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'home' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`} onClick={() => { setSelectedMainTab('home'); setActiveContentTab('monthlyProfit'); }}><Home size={24} /> <span>홈</span></button>
                    <button className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'more' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`} onClick={() => { setSelectedMainTab('more'); setActiveContentTab('adminSettings'); setMoreSubView('main'); }}><MoreHorizontal size={24} /> <span>더보기</span></button>
                </div>
            )}
            <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} onApply={handleApplyFilters} initialFilters={filters} isDarkMode={isDarkMode} entries={entries} />
            {isLoading && (<div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex flex-col items-center justify-center z-[99]"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mb-4"></div><p className="text-white text-xl font-semibold">{loadingMessage}</p></div>)}
            <MessageModal isOpen={modalState.isOpen} content={modalState.content} type={modalState.type} onConfirm={handleConfirm} onClose={closeModal} isDarkMode={isDarkMode} />
        </div>
    );
}

function App() { return (<Router><Routes><Route path="/" element={<AppContent />} /><Route path="/calculator" element={<CalculatorPageWrapper />} /></Routes></Router>); }
function CalculatorPageWrapper() { const navigate = useNavigate(); const location = useLocation(); const { date, currentRound, incomeConfig, isDarkMode } = location.state || {}; const { saveEntry } = useDelivery(); const handleApply = (results) => { saveEntry({ type: 'income', date: date, round: currentRound || 0, ...results }); navigate(-1); }; return (<CalculatorPage date={date} currentRound={currentRound} incomeConfig={incomeConfig || []} isDarkMode={isDarkMode} onBack={() => navigate(-1)} onApply={handleApply} />); }
export default App;