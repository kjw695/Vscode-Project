import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// Lucide React 아이콘 임포트
import { Settings, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Home, BarChart2, List, MoreHorizontal, AlertTriangle, Plus } from 'lucide-react';

// Google Drive 및 Capacitor 관련 임포트
import { backupToDrive, restoreFromDrive } from './utils/googleDrive';
import { Preferences } from '@capacitor/preferences'; // 테마 저장용

// 유틸리티 및 커스텀 컴포넌트 임포트
import { formatDate } from './utils';
import StatsDisplay from './StatsDisplay';
import GoalProgressBar from './components/GoalProgressBar';
import AdBanner from './AdBanner';
import RevenueDistributionChart from './components/RevenueDistributionChart';
import FilterModal from './components/DataScreen/FilterModal';
import EntriesList from './components/DataScreen/EntriesList.js';
import DataEntryForm from './DataEntryForm';
import PrivacyPolicy from './components/more/PrivacyPolicy';
import OpenSourceLicenses from './components/more/OpenSourceLicenses.js';

// 백업관리: 내보내기(export) 함수만 가져옵니다. (가져오기(import)는 App.js에서 직접 구현)
import { exportDataAsCsv } from './utils/dataHandlers.js';

// 더보기 화면 컴포넌트
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
import useAppBackButton from './hooks/useAppBackButton'; //뒤로가기 훅 불러오기

// 상세 정보 카드 행 컴포넌트
const DetailRow = ({ label, value, comparison }) => (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-1">
        <span className="text-base sm:text-lg font-semibold">{label}</span>
        <span className="text-base sm:text-lg font-bold">{value}</span>
        <div className="w-16 flex justify-center">
            {comparison}
        </div>
    </div>
);

function App() {
    // --- 목표 관리 ---
    const [goalAmount, setGoalAmount] = useState(7000000);
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [newGoalAmountInput, setNewGoalAmountInput] = useState('');

    // --- 사용자 및 인증 (로컬 모드) ---
    const isAuthReady = true;

    // --- UI 테마 및 화면 제어 ---
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [selectedMainTab, setSelectedMainTab] = useState('home');
    const [activeContentTab, setActiveContentTab] = useState('monthlyProfit');
    const [activeDataTab, setActiveDataTab] = useState('entry');
    const [moreSubView, setMoreSubView] = useState('main');

    // --- 데이터 입력 폼 상태 ---
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [unitPrice, setUnitPrice] = useState('');
    const [deliveryCount, setDeliveryCount] = useState('');
    const [returnCount, setReturnCount] = useState('');
    const [freshBagCount, setFreshBagCount] = useState('');
    const [deliveryInterruptionAmount, setDeliveryInterruptionAmount] = useState('');
    const [penaltyAmount, setPenaltyAmount] = useState('');
    const [industrialAccidentCost, setIndustrialAccidentCost] = useState('');
    const [fuelCost, setFuelCost] = useState('');
    const [maintenanceCost, setMaintenanceCost] = useState('');
    const [vatAmount, setVatAmount] = useState('');
    const [incomeTaxAmount, setIncomeTaxAmount] = useState('');
    const [taxAccountantFee, setTaxAccountantFee] = useState('');
    const [formType, setFormType] = useState('income');
    const [entryToEdit, setEntryToEdit] = useState(null);

    // --- 데이터 목록 및 통계 ---
    const [entries, setEntries] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
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

    // --- 지출 항목 설정 관리 State ---
    const [expenseConfig, setExpenseConfig] = useState(() => {
        const savedSettings = localStorage.getItem('appSettings');
        const parsedSettings = savedSettings ? JSON.parse(savedSettings) : {};
        
        // 저장된 설정이 있으면 사용, 없으면 기본값 사용
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
        
        // 저장된 설정이 있으면 사용, 없으면 기본값 사용
        return parsedSettings.incomeConfig || [
            { key: 'deliveryCount', label: '배송 수량', isVisible: true },
            { key: 'deliveryInterruptionAmount', label: '배송중단', isVisible: true },
            { key: 'returnCount', label: '반품 수량', isVisible: true },
            { key: 'freshBagCount', label: '프레시백 수량', isVisible: true },
        ];
    });

    // --- 정렬 및 필터 ---
    const [sortColumn, setSortColumn] = useState('date');
    const [sortDirection, setSortDirection] = useState('desc');
    const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
    const [showMonthlyDetails, setShowMonthlyDetails] = useState(true);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [filters, setFilters] = useState({
        period: 'all',
        startDate: '',
        endDate: '',
        type: 'all'
    });

    // --- 팝업 및 로딩 ---
    const [modalState, setModalState] = useState({ isOpen: false, content: '', type: 'info', onConfirm: null });
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    // --- Ref ---
    const dateInputRef = useRef(null);
    const touchStartX = useRef(null);
    const touchEndX = useRef(null);
    const touchStartY = useRef(null);
    const touchEndY = useRef(null);

    // =========================================================================
    // ✨ 핵심 변경: 로컬 스토리지 데이터 로드 및 저장 로직
    // =========================================================================

    // 앱 시작 시 로컬 스토리지 데이터 로드
    useEffect(() => {
        const loadLocalData = async () => {
            try {
                // 데이터 불러오기
                const savedEntries = localStorage.getItem('deliveryEntries');
                if (savedEntries) {
                    const parsedEntries = JSON.parse(savedEntries);
                    parsedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
                    setEntries(parsedEntries);
                }

                // 설정 불러오기
                const savedSettings = localStorage.getItem('appSettings');
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    
                    if (settings.favoriteUnitPrices) {
                        setFavoriteUnitPrices(settings.favoriteUnitPrices);
                        setAdminFavoritePricesInput(settings.favoriteUnitPrices.join(', '));
                        if (settings.favoriteUnitPrices.length === 1) {
                            setUnitPrice(settings.favoriteUnitPrices[0].toString());
                        }
                    }

                    if (settings.monthlyPeriod) {
                        setMonthlyStartDay(settings.monthlyPeriod.startDay);
                        setMonthlyEndDay(settings.monthlyPeriod.endDay);
                        setAdminMonthlyStartDayInput(settings.monthlyPeriod.startDay.toString());
                        setAdminMonthlyEndDayInput(settings.monthlyPeriod.endDay.toString());
                    }

                    if (settings.goalAmount) {
                        setGoalAmount(settings.goalAmount);
                    }
                    
                    // [추가됨] 지출 설정 불러오기
                    if (settings.expenseConfig) {
                        setExpenseConfig(settings.expenseConfig);

                        
                    }
                }
            } catch (error) {
                console.error("데이터 로드 실패:", error);
                showMessage("저장된 데이터를 불러오는 중 오류가 발생했습니다.");
            }
        };

        loadLocalData();
    }, []);

    // LocalStorage 저장 헬퍼 함수
    const saveEntriesToLocal = (newEntries) => {
        setEntries(newEntries);
        localStorage.setItem('deliveryEntries', JSON.stringify(newEntries));
    };

    const saveSettingsToLocal = (newSettings) => {
        const currentSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
        const updatedSettings = { ...currentSettings, ...newSettings };
        localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
    };

    // =========================================================================
    // ✨ 핵심 기능: CSV 파일 직접 파싱 및 중복 제외 로직 구현
    // =========================================================================
    const handleLocalCsvImport = (file) => {
        if (!file) return;

        setLoadingMessage('데이터를 복원하는 중...');
        setIsLoading(true);

        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                if (!text) {
                    throw new Error("파일 내용이 비어있습니다.");
                }

                const rows = text.split('\n').filter(row => row.trim() !== '');
                if (rows.length < 2) {
                    throw new Error("유효한 데이터가 없습니다.");
                }

                const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                
                const newEntries = [];
                let duplicateCount = 0;

                // 2번째 줄부터 데이터 파싱
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    // 쉼표로 분리하되 따옴표 안의 쉼표는 무시하는 정규식 사용 권장되나, 간단히 split 처리 (복잡한 CSV가 아니라고 가정)
                    const values = row.split(',').map(val => val.trim().replace(/^"|"$/g, ''));

                    if (values.length < headers.length) continue;

                    const entry = {};
                    headers.forEach((header, index) => {
                        const value = values[index];
                        // 숫자 필드 변환
                        if (['unitPrice', 'deliveryCount', 'returnCount', 'freshBagCount', 'deliveryInterruptionAmount', 'penaltyAmount', 'industrialAccidentCost', 'fuelCost', 'maintenanceCost', 'vatAmount', 'incomeTaxAmount', 'taxAccountantFee'].includes(header)) {
                            entry[header] = value ? parseFloat(value) : 0;
                        } else {
                            entry[header] = value;
                        }
                    });

                    // ID가 없다면 생성 (임시)
                    if (!entry.id) entry.id = crypto.randomUUID();
                    // 타임스탬프가 없다면 현재 시간 (이러면 중복 체크가 어려울 수 있음)
                    if (!entry.timestamp) entry.timestamp = new Date().toISOString();

                    newEntries.push(entry);
                }

                // ✨ 중복 데이터 제거 로직
                // 기준: timestamp가 완전히 같거나, (날짜 + 주요 데이터)가 완전히 같으면 중복으로 간주
                const uniqueEntries = newEntries.filter(newEntry => {
                    const isDuplicate = entries.some(existingEntry => {
                        // 1. 타임스탬프가 있는 경우 타임스탬프 비교
                        if (existingEntry.timestamp && newEntry.timestamp && existingEntry.timestamp === newEntry.timestamp) {
                            return true;
                        }
                        // 2. 타임스탬프가 없거나 다를 경우, 데이터 내용 비교 (날짜, 단가, 배송수량 등)
                        // 주의: 너무 엄격하면 수정된 데이터를 못 가져오고, 너무 느슨하면 중복됨.
                        // 여기서는 '날짜'와 '생성시간(timestamp)'이 같으면 중복으로 봅니다.
                        return false; 
                    });

                    if (isDuplicate) {
                        duplicateCount++;
                        return false;
                    }
                    return true;
                });

                // 기존 데이터와 합치기
                const mergedEntries = [...entries, ...uniqueEntries];
                
                // 날짜순 정렬
                mergedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

                saveEntriesToLocal(mergedEntries);
                showMessage(`복원 완료!\n총 ${newEntries.length}개 중 ${uniqueEntries.length}개가 추가되었습니다.\n(${duplicateCount}개 중복 제외)`);

            } catch (error) {
                console.error("CSV 파싱 오류:", error);
                showMessage("파일을 읽는 중 오류가 발생했습니다.\n올바른 CSV 파일인지 확인해주세요.");
            } finally {
                setIsLoading(false);
            }
        };

        reader.onerror = () => {
            showMessage("파일을 읽는 데 실패했습니다.");
            setIsLoading(false);
        };

        reader.readAsText(file, 'UTF-8'); // 한글 깨짐 방지를 위해 UTF-8 명시 (필요시 'euc-kr'로 변경)
    };


    // --- 기존 useEffect (테마 등) ---
    useEffect(() => {
        const savedView = localStorage.getItem('homeView');
        if (savedView !== null) {
            setShowMonthlyDetails(JSON.parse(savedView));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('homeView', JSON.stringify(showMonthlyDetails));
    }, [showMonthlyDetails]);

    useEffect(() => {
        const loadDarkModeSetting = async () => {
            try {
                const { value } = await Preferences.get({ key: 'isDarkMode' });
                if (value !== null) {
                    setIsDarkMode(JSON.parse(value));
                }
            } catch (error) {
                console.error("테마 설정 불러오기 실패:", error);
            }
        };
        loadDarkModeSetting();
    }, []);

    useEffect(() => {
        const saveAndApplyTheme = async () => {
            try {
                await Preferences.set({
                    key: 'isDarkMode',
                    value: JSON.stringify(isDarkMode),
                });
                if (isDarkMode) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            } catch (error) {
                console.error("테마 설정 저장 실패:", error);
            }
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
        setDate(new Date().toISOString().slice(0, 10));
        setUnitPrice('');
        setDeliveryCount('');
        setReturnCount('');
        setDeliveryInterruptionAmount('');
        setFreshBagCount('');
        setPenaltyAmount('');
        setIndustrialAccidentCost('');
        setFuelCost('');
        setMaintenanceCost('');
        setVatAmount('');
        setIncomeTaxAmount('');
        setTaxAccountantFee('');
        setFormType('income');
    };

    const showMessage = (msg) => {
        setModalState({ isOpen: true, content: msg, type: 'info', onConfirm: null });
    };

    const showConfirmation = (msg, onConfirmAction) => {
        setModalState({ isOpen: true, content: msg, type: 'confirm', onConfirm: onConfirmAction });
    };

    const closeModal = () => {
        setModalState({ isOpen: false, content: '', type: 'info', onConfirm: null });
    };

    const handleConfirm = () => {
        if (modalState.onConfirm) {
            modalState.onConfirm();
        }
        closeModal();
    };

    const handleApplyFilters = (newFilters) => {
        setFilters(newFilters);
        setIsFilterModalOpen(false);
    };

    const handleSaveGoal = () => {
        const newGoal = parseInt(newGoalAmountInput);
        if (!isNaN(newGoal) && newGoal > 0) {
            setGoalAmount(newGoal);
            setIsEditingGoal(false);
            saveSettingsToLocal({ goalAmount: newGoal }); // 로컬 저장
        } else {
            showMessage("올바른 금액을 숫자로 입력해주세요.");
        }
    };

    // 데이터 저장/수정 핸들러
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (entryToEdit) {
            const updatedEntry = {
                ...entryToEdit,
                date,
                unitPrice: unitPrice === '' ? 0 : parseFloat(unitPrice),
                deliveryCount: deliveryCount === '' ? 0 : parseInt(deliveryCount),
                returnCount: returnCount === '' ? 0 : parseInt(returnCount),
                deliveryInterruptionAmount: deliveryInterruptionAmount === '' ? 0 : parseFloat(deliveryInterruptionAmount),
                freshBagCount: freshBagCount === '' ? 0 : parseInt(freshBagCount),
                penaltyAmount: penaltyAmount === '' ? 0 : parseFloat(penaltyAmount),
                industrialAccidentCost: industrialAccidentCost === '' ? 0 : parseFloat(industrialAccidentCost),
                fuelCost: fuelCost === '' ? 0 : parseFloat(fuelCost),
                maintenanceCost: maintenanceCost === '' ? 0 : parseFloat(maintenanceCost),
                vatAmount: vatAmount === '' ? 0 : parseFloat(vatAmount),
                incomeTaxAmount: incomeTaxAmount === '' ? 0 : parseFloat(incomeTaxAmount),
                taxAccountantFee: taxAccountantFee === '' ? 0 : parseFloat(taxAccountantFee),
                timestamp: new Date().toISOString(),
            };

            const updatedEntries = entries.map(entry => 
                entry.id === entryToEdit.id ? updatedEntry : entry
            );
            
            saveEntriesToLocal(updatedEntries);
            showMessage("항목이 성공적으로 업데이트되었습니다.");
            setEntryToEdit(null);
            resetForm();
            setActiveDataTab('list');
            return;
        }

        const hasRevenueData = (unitPrice && (deliveryCount || returnCount || deliveryInterruptionAmount)) || freshBagCount;
        const hasExpenseData = penaltyAmount || industrialAccidentCost || fuelCost || maintenanceCost || vatAmount || incomeTaxAmount || taxAccountantFee;

        if (!hasRevenueData && !hasExpenseData) {
            showMessage("입력된 수익 또는 지출 정보가 없습니다.");
            return;
        }

        let newEntries = [...entries];
        const timestamp = new Date().toISOString();

        if (hasRevenueData) {
            const revenueEntry = {
                id: crypto.randomUUID(),
                date,
                unitPrice: unitPrice ? parseFloat(unitPrice) : 0,
                deliveryCount: deliveryCount ? parseInt(deliveryCount) : 0,
                returnCount: returnCount ? parseInt(returnCount) : 0,
                deliveryInterruptionAmount: deliveryInterruptionAmount ? parseFloat(deliveryInterruptionAmount) : 0,
                freshBagCount: freshBagCount ? parseInt(freshBagCount) : 0,
                penaltyAmount: 0, industrialAccidentCost: 0, fuelCost: 0, maintenanceCost: 0, vatAmount: 0, incomeTaxAmount: 0, taxAccountantFee: 0,
                timestamp,
            };
            newEntries.push(revenueEntry);
        }

        if (hasExpenseData) {
            const expenseEntry = {
                id: crypto.randomUUID(),
                date,
                unitPrice: 0, deliveryCount: 0, returnCount: 0, deliveryInterruptionAmount: 0, freshBagCount: 0,
                penaltyAmount: penaltyAmount ? parseFloat(penaltyAmount) : 0,
                industrialAccidentCost: industrialAccidentCost ? parseFloat(industrialAccidentCost) : 0,
                fuelCost: fuelCost ? parseFloat(fuelCost) : 0,
                maintenanceCost: maintenanceCost ? parseFloat(maintenanceCost) : 0,
                vatAmount: vatAmount ? parseFloat(vatAmount) : 0,
                incomeTaxAmount: incomeTaxAmount ? parseFloat(incomeTaxAmount) : 0,
                taxAccountantFee: taxAccountantFee ? parseFloat(taxAccountantFee) : 0,
                timestamp,
            };
            newEntries.push(expenseEntry);
        }

        newEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
        saveEntriesToLocal(newEntries);
        
        showMessage("항목이 성공적으로 저장되었습니다.");
        resetForm();
        setActiveDataTab('list');
    };

    const handleEdit = (entry) => {
        setEntryToEdit(entry);
        setDate(entry.date);
        setUnitPrice(entry.unitPrice.toString());
        setDeliveryCount(entry.deliveryCount.toString());
        setReturnCount(entry.returnCount.toString());
        setDeliveryInterruptionAmount(entry.deliveryInterruptionAmount ? entry.deliveryInterruptionAmount.toString() : '');
        setFreshBagCount(entry.freshBagCount ? entry.freshBagCount.toString() : '');
        setPenaltyAmount(entry.penaltyAmount ? entry.penaltyAmount.toString() : '');
        setIndustrialAccidentCost(entry.industrialAccidentCost ? entry.industrialAccidentCost.toString() : '');
        setFuelCost(entry.fuelCost ? entry.fuelCost.toString() : '');
        setMaintenanceCost(entry.maintenanceCost ? entry.maintenanceCost.toString() : '');
        setVatAmount(entry.vatAmount ? entry.vatAmount.toString() : '');
        setIncomeTaxAmount(entry.incomeTaxAmount ? entry.incomeTaxAmount.toString() : '');
        setTaxAccountantFee(entry.taxAccountantFee ? entry.taxAccountantFee.toString() : '');
        
        if (entry.penaltyAmount || entry.industrialAccidentCost || entry.fuelCost || entry.maintenanceCost || entry.vatAmount || entry.incomeTaxAmount || entry.taxAccountantFee) {
            setFormType('expense');
        } else {
            setFormType('income');
        }
        setActiveDataTab('entry');
        setSelectedMainTab('data');
        setActiveContentTab('dataEntry');
    };

    const handleDelete = async (id) => {
        try {
            const newEntries = entries.filter(entry => entry.id !== id);
            saveEntriesToLocal(newEntries);
            showMessage("항목이 성공적으로 삭제되었습니다.");
        } catch (e) {
            console.error("Error deleting document: ", e);
            showMessage("데이터 삭제에 실패했습니다.");
        }
    };

    const handleDeleteAllDataRequest = () => {
        showConfirmation(
            "정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.",
            () => {
                saveEntriesToLocal([]);
                showMessage("모든 데이터가 삭제되었습니다.");
            }
        );
    };

    const handleDateChange = (days) => {
        if (!date) return;
        const currentDate = new Date(date);
        currentDate.setDate(currentDate.getDate() + days);
        setDate(currentDate.toISOString().slice(0, 10));
    };

    const { monthlyProfit, yearlyProfit, cumulativeProfit, previousMonthlyProfit } = useProfitCalculations(
        entries,
        selectedMonth,
        selectedYear,
        monthlyStartDay,
        monthlyEndDay,
        "local-user"
    );

    const renderComparison = (currentValue, previousValue, isCurrency = false) => {
        if (previousValue === 0 && currentValue === 0) {
            return <span className="text-gray-500">-</span>;
        }
        if (previousValue === 0) {
            return (
                <span className="text-red-500 flex items-center text-xs sm:text-sm">
                    {currentValue.toLocaleString()} {isCurrency ? '원' : ''} <ArrowUp size={14} className="ml-1" />
                </span>
            );
        }
        const diff = currentValue - previousValue;
        const colorClass = diff > 0 ? 'text-red-500' : (diff < 0 ? 'text-blue-500' : 'text-gray-500');
        const arrow = diff > 0 ? <ArrowUp size={14} className="ml-1" /> : (diff < 0 ? <ArrowDown size={14} className="ml-1" /> : null);
        
        return (
            <span className={`${colorClass} flex items-center text-xs sm:text-sm`}>
                {Math.abs(diff).toLocaleString()} {isCurrency ? '원' : ''} {arrow}
            </span>
        );
    };

    const finalFilteredEntries = useMemo(() => {
        const filtered = entries.filter(entry => {
            const dailyRevenue = (entry.unitPrice * entry.deliveryCount) + (entry.unitPrice * entry.returnCount) + (entry.unitPrice * (entry.deliveryInterruptionAmount || 0)) + ((entry.freshBagCount || 0) * 100);
            const dailyExpenses = ((entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0));

            const typeMatch = filters.type === 'all' ||
                (filters.type === 'income' && dailyRevenue > 0) ||
                (filters.type === 'expense' && dailyExpenses > 0);
            
            if (!typeMatch) return false;

            if (filters.period === 'all' || !filters.startDate || !filters.endDate) {
                return true;
            }
            return entry.date >= filters.startDate && entry.date <= filters.endDate;
        });

        return filtered.sort((a, b) => {
            let valA = a[sortColumn];
            let valB = b[sortColumn];
            if (sortColumn === 'date') {
                valA = new Date(valA);
                valB = new Date(valB);
            }
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [entries, filters, sortColumn, sortDirection]);

    const handleSaveFavoritePrices = async () => {
        const pricesArray = adminFavoritePricesInput.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        if (pricesArray.length === 0) {
            showMessage("유효한 단가를 입력해주세요.");
            return;
        }
        setFavoriteUnitPrices(pricesArray);
        saveSettingsToLocal({ favoriteUnitPrices: pricesArray });
        
        if (pricesArray.length === 1) {
            setUnitPrice(pricesArray[0].toString());
        } else {
            setUnitPrice('');
        }
        showMessage("즐겨찾는 단가가 저장되었습니다.");
    };

    const handleSaveMonthlyPeriodSettings = async () => {
        const startDay = parseInt(adminMonthlyStartDayInput);
        const endDay = parseInt(adminMonthlyEndDayInput);

        if (isNaN(startDay) || isNaN(endDay) || startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) {
            showMessage("유효한 날짜를 입력해주세요.");
            return;
        }
        setMonthlyStartDay(startDay);
        setMonthlyEndDay(endDay);
        saveSettingsToLocal({ monthlyPeriod: { startDay, endDay } });
        showMessage("월별 집계 기간이 저장되었습니다.");
    };

    const handleLogout = () => {
        showMessage("로컬 모드입니다.");
    };

    const toggleDarkMode = () => {
        setIsDarkMode(prevMode => !prevMode);
    };

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(prevDir => (prevDir === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const handleMonthChange = (direction) => {
        setCurrentCalendarDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setMonth(newDate.getMonth() + direction);
            setSelectedMonth(newDate.toISOString().slice(0, 7));
            return newDate;
        });
    };

    const handleTodayClick = () => {
        const today = new Date();
        setCurrentCalendarDate(today);
        setSelectedMonth(today.toISOString().slice(0, 7));
    };

    const handleCalendarDateClick = (clickedDate) => {
        const entriesForDate = entries.filter(entry => entry.date === clickedDate);
        if (entriesForDate.length === 1) {
            handleEdit(entriesForDate[0]);
        } else if (entriesForDate.length > 1) {
            setFilters({
                period: 'custom',
                startDate: clickedDate,
                endDate: clickedDate,
                type: 'all'
            });
            setSelectedMainTab('data');
            setActiveContentTab('dataEntry');
            setActiveDataTab('list');
        } else {
            setSelectedMainTab('data');
            setActiveContentTab('dataEntry');
            setActiveDataTab('entry');
            setDate(clickedDate);
            setUnitPrice(''); setDeliveryCount(''); setReturnCount('');
            setDeliveryInterruptionAmount(''); setFreshBagCount('');
            setPenaltyAmount(''); setIndustrialAccidentCost(''); setFuelCost('');
            setMaintenanceCost(''); setVatAmount(''); setIncomeTaxAmount('');
            setTaxAccountantFee('');
            setEntryToEdit(null);
        }
    };

    const handleTouchStart = (e) => {
        touchStartX.current = e.targetTouches[0].clientX;
        touchStartY.current = e.targetTouches[0].clientY;
        touchEndX.current = null;
        touchEndY.current = null;
    };

    const handleTouchMove = (e) => {
        touchEndX.current = e.targetTouches[0].clientX;
        touchEndY.current = e.targetTouches[0].clientY;
    };

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current || !touchStartY.current || !touchEndY.current) return;
        const deltaX = touchStartX.current - touchEndX.current;
        const deltaY = touchStartY.current - touchEndY.current;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            const isLeftSwipe = deltaX > 50;
            const isRightSwipe = deltaX < -50;
            if (isLeftSwipe && activeDataTab === 'entry') setActiveDataTab('list');
            else if (isRightSwipe && activeDataTab === 'list') setActiveDataTab('entry');
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
        periodEndDate.setHours(23, 59, 59, 999);

        const calendarStartDate = new Date(periodStartDate);
        calendarStartDate.setDate(calendarStartDate.getDate() - calendarStartDate.getDay());
        const calendarEndDate = new Date(periodEndDate);
        if (calendarEndDate.getDay() !== 6) {
            calendarEndDate.setDate(calendarEndDate.getDate() + (6 - calendarEndDate.getDay()));
        }

        const days = [];
        let dayIterator = new Date(calendarStartDate);
        const todayString = formatDate(new Date());

        while (dayIterator <= calendarEndDate) {
            const formattedDate = formatDate(dayIterator);
            const isToday = formattedDate === todayString;
            const isWithinPeriod = dayIterator >= periodStartDate && dayIterator <= periodEndDate;
            const dailyData = monthlyProfit.dailyBreakdown[formattedDate] || { revenue: 0, expenses: 0 };

            days.push({
                date: formattedDate,
                day: dayIterator.getDate(),
                isCurrentMonth: isWithinPeriod,
                isToday: isToday,
                revenue: dailyData.revenue,
                expenses: dailyData.expenses,
            });
            dayIterator.setDate(dayIterator.getDate() + 1);
        }
        return days;
    }, [currentCalendarDate, monthlyStartDay, monthlyEndDay, monthlyProfit.dailyBreakdown]);

    const calendarDays = generateCalendarDays();

    const yearlyPeriod = useMemo(() => {
        const year = parseInt(selectedYear);
        let startDate, endDate;
        if (monthlyStartDay > monthlyEndDay) {
            startDate = new Date(year - 1, 11, monthlyStartDay);
            endDate = new Date(year, 11, monthlyEndDay);
        } else {
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31);
        }
        return { startDate: startDate.toLocaleDateString('ko-KR'), endDate: endDate.toLocaleDateString('ko-KR') };
    }, [selectedYear, monthlyStartDay, monthlyEndDay]);

    const cumulativePeriod = useMemo(() => {
        if (entries.length === 0) return null;
        const dates = entries.map(e => new Date(e.date));
        const minDate = new Date(Math.min.apply(null, dates));
        const maxDate = new Date(Math.max.apply(null, dates));
        return { startDate: minDate.toLocaleDateString('ko-KR'), endDate: maxDate.toLocaleDateString('ko-KR') };
    }, [entries]);

    const handleNavigateToDataEntry = () => {
        setSelectedMainTab('data');
        setActiveContentTab('dataEntry');
        setActiveDataTab('entry');
        setEntryToEdit(null);
        setDate(new Date().toISOString().slice(0, 10));
        setUnitPrice(''); setDeliveryCount(''); setReturnCount('');
        setDeliveryInterruptionAmount(''); setFreshBagCount('');
        setPenaltyAmount(''); setIndustrialAccidentCost(''); setFuelCost('');
        setMaintenanceCost(''); setVatAmount(''); setIncomeTaxAmount('');
        setTaxAccountantFee('');
        setFormType('income');
    };

// [추가됨] 앱 전체 뒤로가기 버튼 제어 훅 실행
    useAppBackButton({
        modalState, 
        closeModal,
        showConfirmation, // 앱 종료 확인 팝업을 띄우기 위해 함수 전달
        isFilterModalOpen, 
        setIsFilterModalOpen,
        moreSubView, 
        setMoreSubView,
        selectedMainTab, 
        setSelectedMainTab,
        activeContentTab, 
        setActiveContentTab
    });


    return (
        <div className={`min-h-screen font-sans flex flex-col items-center flex-grow ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-800'} pb-20 px-4 sm:px-8 pt-[calc(0.5rem+env(safe-area-inset-top))]`}>
            
            <div className={`w-full mb-6 relative ${isDarkMode ? 'bg-transparent' : 'bg-transparent'}`}>
                {isAuthReady && (
                    <>
                        {activeContentTab === 'monthlyProfit' && (
                            <div className={`p-4 sm:p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                <RevenueDistributionChart monthlyProfit={monthlyProfit} />
                                <div className="text-center mb-6"></div>
                                <div className="text-center mb-6">
                                    <button
                                        onClick={() => setShowMonthlyDetails(!showMonthlyDetails)}
                                        className={`py-2 px-4 rounded-md transition duration-150 ease-in-out ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} text-sm`}
                                    >
                                        {showMonthlyDetails ? '캘린더 보기' : '상세보기'}
                                    </button>
                                </div>

                                {!showMonthlyDetails ? (
                                    <div className="calendar-view">
                                        <div className="flex justify-center items-center mb-4 space-x-3">
                                            <button onClick={() => handleMonthChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>
                                                <ChevronLeft size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                                            </button>
                                            <h3 className={`font-bold text-lg ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                                                {currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월
                                            </h3>
                                            <button onClick={() => handleMonthChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>
                                                <ChevronRight size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                                            </button>
                                        </div>
                                        <p className={`text-sm text-right mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {monthlyProfit.periodStartDate ? new Date(monthlyProfit.periodStartDate).toLocaleDateString('ko-KR') : ''} ~ {monthlyProfit.periodEndDate ? new Date(monthlyProfit.periodEndDate).toLocaleDateString('ko-KR') : ''}
                                            <button onClick={handleTodayClick} className={`ml-4 py-1 px-3 rounded-md text-xs ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'} transition duration-150 ease-in-out`}>오늘</button>
                                        </p>
                                        <div className="grid grid-cols-7 text-center font-bold mb-2">
                                            <div className="py-2 text-red-500">일</div>
                                            <div className="py-2">월</div>
                                            <div className="py-2">화</div>
                                            <div className="py-2">수</div>
                                            <div className="py-2">목</div>
                                            <div className="py-2">금</div>
                                            <div className="py-2 text-blue-500">토</div>
                                        </div>
                                        <div className="grid grid-cols-7 gap-1">
                                            {calendarDays.map((dayInfo, index) => (
                                                <div key={index} onClick={() => handleCalendarDateClick(dayInfo.date)} className={`cursor-pointer aspect-square flex flex-col items-center justify-start p-1 rounded-md ${dayInfo.isCurrentMonth ? (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-100') : (isDarkMode ? 'bg-gray-800' : 'bg-white')} ${dayInfo.isToday && dayInfo.isCurrentMonth ? 'border-2 border-blue-500' : ''}`}>
                                                    {dayInfo.isCurrentMonth && (
                                                        <>
                                                            <span className={`font-semibold text-[clamp(0.75rem,3vw,0.875rem)] ${index % 7 === 0 ? 'text-red-500' : ''} ${index % 7 === 6 ? 'text-blue-500' : ''} ${dayInfo.isToday ? 'text-blue-500' : ''}`}>{dayInfo.day}</span>
                                                            {dayInfo.revenue > 0 && <span className="text-red-500 text-[clamp(0.5rem,2vw,0.625rem)] leading-tight">{dayInfo.revenue.toLocaleString()}</span>}
                                                            {dayInfo.expenses > 0 && <span className="text-blue-500 text-[clamp(0.5rem,2vw,0.625rem)] leading-tight">{dayInfo.expenses.toLocaleString()}</span>}
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex justify-center items-center mb-4 space-x-3">
                                            <button onClick={() => handleMonthChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>
                                                <ChevronLeft size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                                            </button>
                                            <h3 className={`font-bold text-lg ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                                                {currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월
                                            </h3>
                                            <button onClick={() => handleMonthChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>
                                                <ChevronRight size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                                            </button>
                                        </div>
                                        <div className="max-w-md mx-auto space-y-4">
                                            <div>
                                                {monthlyProfit.periodEndDate && (
                                                    <div className="text-center mb-2">
                                                        <span className={`font-semibold ${isDarkMode ? 'text-red-500' : 'text-red-500'}`}>
                                                            {(() => {
                                                                const today = new Date();
                                                                const endDate = new Date(monthlyProfit.periodEndDate);
                                                                today.setHours(0, 0, 0, 0);
                                                                endDate.setHours(0, 0, 0, 0);
                                                                const timeDiff = endDate.getTime() - today.getTime();
                                                                const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
                                                                return daysRemaining > 0 ? `마감까지 ${daysRemaining}일 남음` : '이번 달 집계 마감';
                                                            })()}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-[1fr_auto_1fr] items-center text-sm sm:text-base mb-1 gap-x-1 sm:gap-x-2">
                                                    {!isEditingGoal ? (
                                                        <>
                                                            <span className={`${isDarkMode ? 'text-gray-200' : 'text-gray-800'} font-semibold text-right whitespace-nowrap truncate`}>현재: {monthlyProfit.netProfit.toLocaleString()}</span>
                                                            <span className="font-bold text-red-500">VS</span>
                                                            <div className="flex items-center justify-start min-w-0">
                                                                <span className={`${isDarkMode ? 'text-gray-200' : 'text-gray-800'} font-semibold whitespace-nowrap truncate`}>목표: {goalAmount.toLocaleString()}</span>
                                                                <button onClick={() => { setIsEditingGoal(true); setNewGoalAmountInput(goalAmount.toString()); }} className="ml-1 sm:ml-2 flex-shrink-0">
                                                                    <Settings size={14} className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="col-span-3 flex justify-center items-center space-x-2">
                                                            <input type="tel" value={newGoalAmountInput ? parseInt(newGoalAmountInput).toLocaleString('ko-KR') : ''} onChange={(e) => setNewGoalAmountInput(e.target.value.replace(/[^0-9]/g, ''))} className={`w-32 p-1 text-xs border rounded-md ${isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'}`} placeholder="새 목표 금액" />
                                                            <button onClick={handleSaveGoal} className={`flex-shrink-0 py-1 px-2 text-xs rounded-md ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white`}>저장</button>
                                                            <button onClick={() => setIsEditingGoal(false)} className={`flex-shrink-0 py-1 px-2 text-xs rounded-md ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} ${isDarkMode ? 'text-white' : 'text-black'}`}>취소</button>
                                                        </div>
                                                    )}
                                                </div>
                                                <GoalProgressBar current={monthlyProfit.netProfit} goal={goalAmount} isDarkMode={isDarkMode} />
                                            </div>
                                            <div className={`pl-6 pr-[23px] py-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} space-y-3 shadow`}>
                                                <DetailRow label="총 근무일" value={`${monthlyProfit.totalWorkingDays.toLocaleString()} 일`} comparison={renderComparison(monthlyProfit.totalWorkingDays, previousMonthlyProfit.totalWorkingDays)} />
                                                <DetailRow label="총 물량" value={`${monthlyProfit.totalVolume.toLocaleString()} 건`} comparison={renderComparison(monthlyProfit.totalVolume, previousMonthlyProfit.totalVolume)} />
                                                <DetailRow label="총 프레시백" value={`${monthlyProfit.totalFreshBag.toLocaleString()} 개`} comparison={renderComparison(monthlyProfit.totalFreshBag, previousMonthlyProfit.totalFreshBag)} />
                                                <DetailRow label="일 평균 물량" value={`${Math.round(monthlyProfit.dailyAverageVolume)} 건`} comparison={renderComparison(Math.round(monthlyProfit.dailyAverageVolume), Math.round(previousMonthlyProfit.dailyAverageVolume))} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeContentTab === 'dataEntry' && (
                            <div className={`p-4 sm:p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                                <div className="flex justify-center border-b mb-4">
                                    <button onClick={() => setActiveDataTab('entry')} className={`py-2 px-4 font-semibold ${activeDataTab === 'entry' ? (isDarkMode ? 'border-amber-400 text-amber-400' : 'border-amber-600 text-amber-700') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}>입력</button>
                                    <button onClick={() => setActiveDataTab('list')} className={`py-2 px-4 font-semibold ${activeDataTab === 'list' ? (isDarkMode ? 'border-amber-400 text-amber-400' : 'border-amber-600 text-amber-700') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}>데이터</button>
                                </div>
                                {activeDataTab === 'entry' && (
                                    <DataEntryForm
                                        handleSubmit={handleSubmit} date={date} setDate={setDate} handleDateChange={handleDateChange} dateInputRef={dateInputRef} formType={formType} setFormType={setFormType} isDarkMode={isDarkMode} entryToEdit={entryToEdit}
                                        unitPrice={unitPrice} setUnitPrice={setUnitPrice} deliveryCount={deliveryCount} setDeliveryCount={setDeliveryCount} returnCount={returnCount} setReturnCount={setReturnCount}
                                        deliveryInterruptionAmount={deliveryInterruptionAmount} setDeliveryInterruptionAmount={setDeliveryInterruptionAmount} freshBagCount={freshBagCount} setFreshBagCount={setFreshBagCount}
                                        penaltyAmount={penaltyAmount} setPenaltyAmount={setPenaltyAmount} industrialAccidentCost={industrialAccidentCost} setIndustrialAccidentCost={setIndustrialAccidentCost} fuelCost={fuelCost} setFuelCost={setFuelCost}
                                        maintenanceCost={maintenanceCost} setMaintenanceCost={setMaintenanceCost} vatAmount={vatAmount} setVatAmount={setVatAmount} incomeTaxAmount={incomeTaxAmount} setIncomeTaxAmount={setIncomeTaxAmount}
                                        taxAccountantFee={taxAccountantFee} setTaxAccountantFee={setTaxAccountantFee} favoriteUnitPrices={favoriteUnitPrices}
                                    />
                                )}
                                {activeDataTab === 'list' && (
                                    <EntriesList
                                        entries={finalFilteredEntries}
                                        summary={{
                                            totalRevenue: finalFilteredEntries.reduce((sum, entry) => sum + (entry.unitPrice * entry.deliveryCount) + (entry.unitPrice * entry.returnCount) + (entry.unitPrice * (entry.deliveryInterruptionAmount || 0)) + ((entry.freshBagCount || 0) * 100), 0),
                                            totalExpenses: finalFilteredEntries.reduce((sum, entry) => sum + (entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0), 0),
                                            entryNetProfit: Object.fromEntries(finalFilteredEntries.map(entry => [entry.id, ((entry.unitPrice * entry.deliveryCount) + (entry.unitPrice * entry.returnCount) + (entry.unitPrice * (entry.deliveryInterruptionAmount || 0)) + ((entry.freshBagCount || 0) * 100)) - ((entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0))])),
                                            filterLabel: (() => {
                                                if (filters.period === '1m') return '최근 1개월';
                                                if (filters.period === '3m') return '최근 3개월';
                                                if (filters.period === '6m') return '최근 6개월';
                                                if (filters.period === 'thisYear') return '올해';
                                                if (filters.period === 'lastYear') return '작년';
                                                if (filters.period === 'custom' && filters.startDate && filters.endDate) return `${filters.startDate} ~ ${filters.endDate}`;
                                                return '전체';
                                            })()
                                        }}
                                        handleEdit={handleEdit} handleDelete={handleDelete} isDarkMode={isDarkMode} onOpenFilter={() => setIsFilterModalOpen(true)} filterType={filters.type}
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
                                {moreSubView === 'account' && <AccountView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} auth={null} handleLinkAccount={() => showMessage("로컬 모드입니다.")} handleLogout={handleLogout} googleProvider={null} kakaoProvider={null} naverProvider={null} />}
                                {moreSubView === 'unitPrice' && <UnitPriceView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} adminFavoritePricesInput={adminFavoritePricesInput} setAdminFavoritePricesInput={setAdminFavoritePricesInput} handleSaveFavoritePrices={handleSaveFavoritePrices} favoriteUnitPrices={favoriteUnitPrices} />}
                                {moreSubView === 'period' && <PeriodView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} adminMonthlyStartDayInput={adminMonthlyStartDayInput} setAdminMonthlyStartDayInput={setAdminMonthlyStartDayInput} adminMonthlyEndDayInput={adminMonthlyEndDayInput} setAdminMonthlyEndDayInput={setAdminMonthlyEndDayInput} handleSaveMonthlyPeriodSettings={handleSaveMonthlyPeriodSettings} monthlyStartDay={monthlyStartDay} monthlyEndDay={monthlyEndDay} />}
                                {moreSubView === 'data' && (
                                    <DataSettingsView
                                        onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode}
                                        handleExportCsv={() => {
                                            // 로컬 데이터 'entries'를 넘겨줍니다. 
                                            exportDataAsCsv(entries, showMessage); 
                                        }}
                                        handleImportCsv={(e) => {
                                            // 새로 구현한 로컬 CSV 파서 사용
                                            handleLocalCsvImport(e.target.files[0]);
                                        }}
                                        handleDeleteAllData={handleDeleteAllDataRequest}
                                        handleBackupToCloud={() => backupToDrive(entries)}
                                        onRestoreCloudData={() => {
                                            setLoadingMessage('구글 드라이브에서 복원 중...');
                                            restoreFromDrive().then((data) => {
                                                if (data && Array.isArray(data)) {
                                                    // 복원 데이터도 중복 체크 후 저장 (선택 사항)
                                                    // 여기서는 덮어쓰기 방식으로 구현 (백업본을 신뢰)
                                                    saveEntriesToLocal(data);
                                                    showMessage("복원 완료! 데이터가 갱신되었습니다.");
                                                } else {
                                                    showMessage("복원할 데이터가 없거나 형식이 올바르지 않습니다.");
                                                }
                                                setIsLoading(false);
                                            });
                                        }}
                                    />
                                )}
                                {/* [추가됨] 지출 설정 화면 연결 */}
                                {moreSubView === 'expenseSettings' && (
                                    <ExpenseSettingsView 
                                        onBack={() => setMoreSubView('main')} 
                                        isDarkMode={isDarkMode}
                                        expenseConfig={expenseConfig}
                                        setExpenseConfig={setExpenseConfig}
                                        incomeConfig={incomeConfig}
                                        setIncomeConfig={setIncomeConfig}

                                    />
                                )}

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

            {activeContentTab === 'monthlyProfit' && showMonthlyDetails && (
                <button onClick={handleNavigateToDataEntry} className="fixed bottom-28 right-6 z-40 p-4 transition-transform hover:scale-150" aria-label="데이터 기록하기">
                    <Plus size={36} className={`${isDarkMode ? 'text-gray-200' : 'text-black'}`} />
                </button>
            )}

            {isAuthReady && (
                <div className={`fixed bottom-0 left-0 right-0 w-full ${isDarkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'} shadow-lg flex justify-around py-2 px-4 pb-[env(safe-area-inset-bottom)]`}>
                    <button className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'data' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`} onClick={() => { setSelectedMainTab('data'); setActiveContentTab('dataEntry'); }}>
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

            <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} onApply={handleApplyFilters} initialFilters={filters} isDarkMode={isDarkMode} />

            {isLoading && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex flex-col items-center justify-center z-[99]">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mb-4"></div>
                    <p className="text-white text-xl font-semibold">{loadingMessage}</p>
                </div>
            )}

            {modalState.isOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className={`p-6 rounded-lg shadow-xl max-w-sm w-full text-center ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`}>
                        {modalState.type === 'confirm' && <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" />}
                        <p className="text-lg font-semibold mb-4 whitespace-pre-wrap">{modalState.content}</p>
                        {modalState.type === 'info' ? (
                            <button onClick={closeModal} className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none">확인</button>
                        ) : (
                            <div className="flex justify-center space-x-4">
                                <button onClick={closeModal} className={`py-2 px-6 rounded-md focus:outline-none ${isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'}`}>취소</button>
                               <button onClick={handleConfirm} className="bg-red-600 text-white py-2 px-6 rounded-md hover:bg-red-700 focus:outline-none">
                                    {modalState.content.includes('종료') ? '종료' : '삭제'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
export default App;