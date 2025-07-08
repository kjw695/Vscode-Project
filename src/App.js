import React, { useState, useEffect, useCallback, useMemo,useRef } from 'react';
// Lucide React 아이콘 임포트
import { Settings, Sun, Moon, Info, Download, Upload, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Home, BarChart2, List, MoreHorizontal } from 'lucide-react';

// Firebase 관련 임포트
import { app, db, auth, appId, googleProvider, kakaoProvider, naverProvider } from './firebaseConfig';
import { doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged, signOut, linkWithPopup, signInWithPopup } from 'firebase/auth';

// 유틸리티 및 커스텀 컴포넌트 임포트
import { formatDate } from './utils';
import StatsDisplay from './StatsDisplay';
import AdBanner from './AdBanner'; // 광고 배너 컴포넌트
import DataEntryForm from './DataEntryForm';
import EntriesTable from './EntriesTable';
import PrivacyPolicy from './components/PrivacyPolicy'; // 👈 추가
import OpenSourceLicenses from './components/OpenSourceLicenses'; // 👈 추가

//입력/데이터탭기능추가
import TransactionManager from './components/TransactionManager';
import TransactionTable from './components/TransactionTable';
//백업관리
import { exportDataAsCsv, importDataFromCsv } from './utils/dataHandlers';
//따로 다운로드 팝업보이게하기
import Modal from './components/Modal';

//더보기제어
import MoreView from './components/more/MoreView';
import AccountView from './components/more/AccountView';
import UnitPriceView from './components/more/UnitPriceView';
import PeriodView from './components/more/PeriodView';
import DataSettingsView from './components/more/DataSettingsView';
import UserGuideView from './components/more/UserGuideView'; //사용자가이드
import { useProfitCalculations } from './hooks/useProfitCalculations';

function App() {
    const [goalAmount, setGoalAmount] = useState(7000000);
    const [isEditingGoal, setIsEditingGoal] = useState(false); // 👈 목표 수정 모드 상태
    const [newGoalAmountInput, setNewGoalAmountInput] = useState(''); // 👈 목표 입력값 상태
    const [userId, setUserId] = useState(null);
    const dateInputRef = useRef(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    const [isDarkMode, setIsDarkMode] = useState(() => {
        // 앱이 처음 로드될 때 localStorage에서 값을 읽어옵니다.
        const savedMode = localStorage.getItem('isDarkMode');
        // 저장된 값이 있다면 그 값을 사용하고, 없다면 기본값(false: 밝은 모드)을 반환합니다.
        // JSON.parse를 사용하여 문자열 "true" 또는 "false"를 불리언 값으로 변환합니다.
        return savedMode ? JSON.parse(savedMode) : false; 
    }); 


    useEffect(() => {
        // isDarkMode 상태가 변경될 때마다 그 값을 localStorage에 저장합니다.
        localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
        // HTML body에 dark/light 클래스를 추가하여 Tailwind CSS가 테마를 적용하도록 합니다.
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // 날짜 필드를 오늘 날짜로 초기화
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [unitPrice, setUnitPrice] = useState('');
    const [deliveryCount, setDeliveryCount] = useState('');
    const [returnCount, setReturnCount] = useState('');
    const [freshBagCount, setFreshBagCount] = useState('');
    const [deliveryInterruptionAmount, setDeliveryInterruptionAmount] = useState(''); // 배송중단 금액 추가
    const [penaltyAmount, setPenaltyAmount] = useState('');
    const [industrialAccidentCost, setIndustrialAccidentCost] = useState('');
    const [fuelCost, setFuelCost] = useState('');
    const [maintenanceCost, setMaintenanceCost] = useState('');
    // 새로운 상태: 부가세, 종합소득세, 세무사 비용
    const [vatAmount, setVatAmount] = useState('');
    const [incomeTaxAmount, setIncomeTaxAmount] = useState('');
    const [taxAccountantFee, setTaxAccountantFee] = useState('');
    // '수익'과 '지출' 폼 타입을 관리하는 상태
    const [formType, setFormType] = useState('income'); // 'income' 또는 'expense'

    const [entries, setEntries] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); //YYYY-MM
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString()); //YYYY
    const [isModalOpen, setIsModalOpen] = useState(false);
// modalContent의 초기값을 객체 형태로 변경합니다.
const [modalContent, setModalContent] = useState({ title: '', content: null });
    const [entryToEdit, setEntryToEdit] = useState(null);
    
       // 새로운 목표 금액 저장 함수
    const handleSaveGoal = () => {
        const newGoal = parseInt(newGoalAmountInput);
        if (!isNaN(newGoal) && newGoal > 0) {
            setGoalAmount(newGoal);
            setIsEditingGoal(false); // 저장 후 수정 모드 닫기
        } else {
            showMessage("올바른 금액을 숫자로 입력해주세요.");
        }
    };

    // 메인 내비게이션 탭 상태: 'data', 'statistics', 'home', 'more' (순서 변경)
    const [selectedMainTab, setSelectedMainTab] = useState('home'); // 기본 화면은 '홈'
    // 실제 콘텐츠를 렌더링할 서브 탭 상태: 'monthlyProfit', 'dataEntry', 'statistics', 'adminSettings', 'userGuide'
    const [activeContentTab, setActiveContentTab] = useState('monthlyProfit'); // '홈' 탭의 기본 콘텐츠는 '월별 수익'

    // 통계 탭 내에서 월별/연간/누적 선택 상태
    const [statisticsView, setStatisticsView] = useState('monthly'); // 'monthly', 'yearly', or 'cumulative'
    // 월간 통계 내에서 '월간 통계', '매출', '지출' 선택 상태
    const [monthlyStatsSubTab, setMonthlyStatsSubTab] = useState('overview'); // 'overview', 'revenue', 'expenses'

    // 단가 즐겨찾기 목록 상태
    const [favoriteUnitPrices, setFavoriteUnitPrices] = useState([]);
    // 관리자 페이지에서 사용할 단가 입력 상태
    const [adminFavoritePricesInput, setAdminFavoritePricesInput] = useState('');

    // 월별 집계 기간 설정 상태
    const [monthlyStartDay, setMonthlyStartDay] = useState(26);
    const [monthlyEndDay, setMonthlyEndDay] = useState(25);
    // 관리자 페이지에서 사용할 월별 집계 기간 입력 상태
    const [adminMonthlyStartDayInput, setAdminMonthlyStartDayInput] = useState('26');
    const [adminMonthlyEndDayInput, setAdminMonthlyEndDayInput] = useState('25');

    // 정렬 상태 추가
    const [sortColumn, setSortColumn] = useState('date'); // 기본 정렬 기준: 날짜
    const [sortDirection, setSortDirection] = useState('desc'); // 기본 정렬 방향: 내림차순
    //입력'/'데이터' 탭 상태 추가
     const [activeDataTab, setActiveDataTab] = useState('entry'); // 'entry' 또는 'list'

    // 월별 수익 탭의 캘린더 관련 상태
    const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date()); // 캘린더에 표시될 현재 날짜 (월 이동용)
    const [showMonthlyDetails, setShowMonthlyDetails] = useState(true); // 월별 상세 내역 표시 여부

     // 👇 '더보기' 탭의 하위 메뉴를 제어할 상태 추가
    const [moreSubView, setMoreSubView] = useState('main'); // 'main', 'account', 'unitPrice', 'period', 'data'
    

// Firebase 인증 상태 변경 리스너
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      // 이미 로그인된 사용자(소셜 계정 또는 기존 익명 계정)가 있으면 ID 설정
      setUserId(user.uid);
      console.log("기존 사용자로 로그인:", user.uid, "익명 여부:", user.isAnonymous);
    } else {
      // 로그인된 사용자가 아무도 없으면, 익명으로 새로 로그인 시도
      try {
        const userCredential = await signInAnonymously(auth);
        setUserId(userCredential.user.uid);
        console.log("새로운 익명 사용자로 로그인:", userCredential.user.uid);
      } catch (error) {
        console.error("익명 로그인 실패:", error);
        showMessage("앱 초기화에 실패했습니다. 새로고침 해주세요.");
        setUserId(null);
      }
    }
    setIsAuthReady(true);
  });

  return () => unsubscribe();
}, []);

    // 데이터 로드 (onSnapshot 사용)
    useEffect(() => {
        // userId가 없으면 데이터를 로드하지 않음 (로그인 없이 사용 가능하지만 데이터는 저장 안됨)
        if (!isAuthReady || !userId) {
            setEntries([]); // 로그인 안 된 상태에서는 데이터 목록을 비워 둠 (혹은 데모 데이터)
            return;
        }

        const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
        const q = query(entriesCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedEntries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // 날짜를 기준으로 정렬 (초기 로드 시)
            fetchedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
            setEntries(fetchedEntries);
        }, (error) => {
            console.error("Error fetching documents: ", error);
            // showMessage("데이터를 불러오는 데 실패했습니다."); // 오류 메시지 모달은 로그인 실패 시에만
        });

        return () => unsubscribe();
    }, [isAuthReady, userId]);

    // 즐겨찾는 단가 및 월별 집계 기간 로드 및 초기 설정
    useEffect(() => {
        if (!isAuthReady || !userId) { // userId 없으면 설정 로드 안 함 (기본값 사용)
             // 기본값으로 설정 상태를 초기화
             setFavoriteUnitPrices([700]);
             setAdminFavoritePricesInput('700');
             setUnitPrice('700'); // 기본 단가를 700으로 설정

             setMonthlyStartDay(26);
             setMonthlyEndDay(25);
             setAdminMonthlyStartDayInput('26');
             setAdminMonthlyEndDayInput('25');
            return;
        }

        const fetchSettings = async () => {
            // 즐겨찾는 단가 로드
            const favPricesDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'favoriteUnitPrices');
            try {
                const docSnap = await getDoc(favPricesDocRef);
                let loadedPrices = [];
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    loadedPrices = data.prices || []; // Ensure it's an array, default to empty array
                }

                // If no prices loaded or empty, use a default of [700] and save it
                if (loadedPrices.length === 0) {
                    loadedPrices = [700];
                    await setDoc(favPricesDocRef, { prices: loadedPrices }); // Save this default back
                }

                setFavoriteUnitPrices(loadedPrices);
                setAdminFavoritePricesInput(loadedPrices.join(', '));

                // If exactly one favorite price is set, automatically fill the unitPrice
                if (loadedPrices.length === 1) {
                    setUnitPrice(loadedPrices[0].toString());
                } else {
                    // If multiple or no favorite prices, clear unitPrice or keep existing
                    setUnitPrice(''); // Clear if multiple or no default
                }

            } catch (error) {
                console.error("Error fetching favorite unit prices: ", error);
                showMessage("즐겨찾는 단가를 불러오는 데 실패했습니다.");
                const fallbackPrices = [700]; // Fallback to a single default price
                setFavoriteUnitPrices(fallbackPrices);
                setAdminFavoritePricesInput(fallbackPrices.join(', '));
                setUnitPrice(fallbackPrices[0].toString()); // Set unitPrice to the fallback
            }

            // 월별 집계 기간 로드
            const monthlyPeriodDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'monthlyPeriod');
            try {
                const docSnap = await getDoc(monthlyPeriodDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const loadedStartDay = data.startDay || 26;
                    const loadedEndDay = data.endDay || 25;
                    setMonthlyStartDay(loadedStartDay);
                    setMonthlyEndDay(loadedEndDay);
                    setAdminMonthlyStartDayInput(loadedStartDay.toString());
                    setAdminMonthlyEndDayInput(loadedEndDay.toString());
                } else {
                    const defaultStartDay = 26;
                    const defaultEndDay = 25;
                    await setDoc(monthlyPeriodDocRef, { startDay: defaultStartDay, endDay: defaultEndDay });
                    setMonthlyStartDay(defaultStartDay);
                    setMonthlyEndDay(defaultEndDay);
                    setAdminMonthlyStartDayInput(defaultStartDay.toString());
                    setAdminMonthlyEndDayInput(defaultEndDay.toString());
                }
            } catch (error) {
                console.error("Error fetching monthly period settings: ", error);
                showMessage("월별 집계 기간 설정을 불러오는 데 실패했습니다.");
                setMonthlyStartDay(26); // Fallback to default
                setMonthlyEndDay(25);
                setAdminMonthlyStartDayInput('26');
                setAdminMonthlyEndDayInput('25');
            }
        };
        fetchSettings();
    }, [isAuthReady, userId]);

    // 메시지 표시 함수
   const showMessage = (title, content = null) => {
    setModalContent({ title, content });
    setIsModalOpen(true);
};

    const closeModal = () => {
        setIsModalOpen(false);
        setModalContent('');
    };

    // 데이터 입력 핸들러
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userId) {
            showMessage("로그인해야 데이터를 저장할 수 있습니다. Google 계정으로 로그인해주세요."); // 로그인 필요 메시지
            return;
        }

        if (!date) {
            showMessage("날짜는 필수로 채워주세요.");
            return;
        }

        // 모든 입력 필드의 현재 상태를 확인
        const anyFieldHasData = unitPrice !== '' || deliveryCount !== '' || returnCount !== '' ||
                                  deliveryInterruptionAmount !== '' || freshBagCount !== '' || penaltyAmount !== '' ||
                                  industrialAccidentCost !== '' || fuelCost !== '' || maintenanceCost !== '' ||
                                  vatAmount !== '' || incomeTaxAmount !== '' || taxAccountantFee !== '';

        // 모든 필드가 비어있으면 데이터 저장 불가
        if (!anyFieldHasData) {
            showMessage("배송 데이터(단가, 배송 수량, 반품 수량, 배송중단), 프레시백 수량, 패널티, 산재, 유류비, 유지보수비, 부가세, 종합소득세 또는 세무사 비용 중 하나 이상은 입력해야 합니다.");
            return;
        }

        // 배송 수량 또는 반품 수량이 입력되었을 경우, 단가도 필수로 입력되어야 함
        if ((deliveryCount !== '' || returnCount !== '') && unitPrice === '') {
            showMessage("배송 수량 또는 반품 수량을 입력하려면 단가를 입력해야 합니다.");
            return;
        }

        const newEntry = {
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
            timestamp: new Date(),
        };

        try {
            if (entryToEdit) {
                // 기존 항목 업데이트
                const entryRef = doc(db, `artifacts/${appId}/users/${userId}/deliveryEntries`, entryToEdit.id);
                await updateDoc(entryRef, newEntry);
                showMessage("항목이 성공적으로 업데이트되었습니다.");
                setEntryToEdit(null); // 편집 모드 종료
            } else {
                // 새 항목 추가
                await addDoc(collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`), newEntry);
                showMessage("항목이 성공적으로 추가되었습니다.");
            }
            // 입력 필드 초기화 (날짜는 오늘 날짜로 유지)
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
            // 성공 후 수익 입력 폼으로 전환
            setFormType('income'); 
        } catch (e) {
            console.error("Error adding/updating document: ", e);
            showMessage("데이터 저장/업데이트에 실패했습니다. 로그인했는지 확인해주세요."); // 로그인 필요 메시지
        }
    };

    // 항목 편집 모드 설정
    const handleEdit = (entry) => {
        if (!userId) {
            showMessage("로그인해야 데이터를 편집할 수 있습니다.");
            return;
        }
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
        
        // 지출 데이터 유무에 따라 폼 타입 설정
        if (entry.penaltyAmount || entry.industrialAccidentCost || entry.fuelCost || entry.maintenanceCost || entry.vatAmount || entry.incomeTaxAmount || entry.taxAccountantFee) {
            setFormType('expense'); // 지출 데이터가 있으면 지출 폼을 보여줌
        } else {
            setFormType('income'); // 없으면 수익 폼을 보여줌
        }
        setActiveDataTab('entry'); // 수정 시 '입력' 탭으로 자동 이동
        setSelectedMainTab('data'); // 편집 시 '데이터' 탭으로 이동
        setActiveContentTab('dataEntry');
    };

    // 항목 삭제
    const handleDelete = async (id) => {
        if (!userId) {
            showMessage("로그인해야 데이터를 삭제할 수 있습니다.");
            return;
        }
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/deliveryEntries`, id));
            showMessage("항목이 성공적으로 삭제되었습니다.");
        } catch (e) {
            console.error("Error deleting document: ", e);
            showMessage("데이터 삭제에 실패했습니다. 로그인했는지 확인해주세요.");
        }
    };
    // 날짜를 하루씩 변경하는 함수
    const handleDateChange = (days) => {
        if (!date) return; // 날짜가 없으면 아무것도 하지 않음
        const currentDate = new Date(date);
        currentDate.setDate(currentDate.getDate() + days);
        setDate(currentDate.toISOString().slice(0, 10));
    };

    // 월별 수익 계산

    
    // App.js

    // ... (handleDateChange 함수 바로 다음 줄입니다) ...

    // 🚨 여기를 아래 코드로 수정해주세요. 🚨

    const { monthlyProfit, yearlyProfit, cumulativeProfit, previousMonthlyProfit } = useProfitCalculations(
        entries,
        selectedMonth,
        selectedYear,
        monthlyStartDay,
        monthlyEndDay,
        userId
    );

    // Helper to render comparison with previous month
    const renderComparison = (currentValue, previousValue, isCurrency = false) => {
        if (previousValue === 0 && currentValue === 0) {
            return <span className="text-gray-500">-</span>;
        }
        if (previousValue === 0) { // If previous is 0 and current is not 0, it's an increase
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


    // 현재 선택된 통계 데이터 (월간, 연간, 누적)
    const currentProfitData = useMemo(() => {
        if (statisticsView === 'monthly') {
            return monthlyProfit;
        } else if (statisticsView === 'yearly') {
            return yearlyProfit;
        } else { // cumulative
            return cumulativeProfit;
        }
    }, [statisticsView, monthlyProfit, yearlyProfit, cumulativeProfit]);

    // 필터링 및 정렬된 항목 계산 (필터링 제거로 인해 필터링 로직은 주석 처리)
    const filteredAndSortedEntries = useMemo(() => {
        let currentEntries = [...entries];

        // userId가 없는 경우, 필터링 및 정렬된 항목을 빈 배열로 설정
        if (!userId) {
            return [];
        }

        // 정렬 적용
        currentEntries.sort((a, b) => {
            let valA = a[sortColumn];
            let valB = b[sortColumn];

            // 날짜 정렬 처리
            if (sortColumn === 'date') {
                valA = new Date(valA);
                valB = new Date(valB);
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return currentEntries;
    }, [entries, sortColumn, sortDirection, userId]); // userId 의존성 추가


    // 즐겨찾는 단가 저장 핸들러
    const handleSaveFavoritePrices = async () => {
        if (!userId) {
            showMessage("로그인해야 즐겨찾는 단가를 저장할 수 있습니다.");
            return;
        }
        // 입력된 문자열을 쉼표로 분리하고 숫자로 변환, 유효하지 않은 값 제거
        const pricesArray = adminFavoritePricesInput.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));

        if (pricesArray.length === 0) {
            showMessage("유효한 단가를 입력해주세요. (예: 700, 725, 750)");
            return;
        }

        const docRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'favoriteUnitPrices');
        try {
            await setDoc(docRef, { prices: pricesArray });
            setFavoriteUnitPrices(pricesArray); // 메인 상태 업데이트
            // If exactly one favorite price is set, automatically fill the unitPrice
            if (pricesArray.length === 1) {
                setUnitPrice(pricesArray[0].toString());
            } else {
                setUnitPrice(''); // Clear if multiple prices
            }
            showMessage("즐겨찾는 단가가 성공적으로 저장되었습니다.");
        } catch (error) {
            console.error("Error saving favorite unit prices: ", error);
            showMessage("즐겨찾는 단가를 저장하는 데 실패했습니다.");
        }
    };

    // 월별 집계 기간 저장 핸들러
    const handleSaveMonthlyPeriodSettings = async () => {
        if (!userId) {
            showMessage("로그인해야 월별 집계 기간을 저장할 수 있습니다.");
            return;
        }
        const startDay = parseInt(adminMonthlyStartDayInput);
        const endDay = parseInt(adminMonthlyEndDayInput);

        if (isNaN(startDay) || isNaN(endDay) || startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) {
            showMessage("유효한 시작일과 종료일을 입력해주세요 (1-31 사이의 숫자).");
            return;
        }

        const docRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'monthlyPeriod');
        try {
            await setDoc(docRef, { startDay: startDay, endDay: endDay });
            setMonthlyStartDay(startDay);
            setMonthlyEndDay(endDay);
            showMessage("월별 집계 기간이 성공적으로 저장되었습니다.");
        } catch (error) {
            console.error("Error saving monthly period settings: ", error);
            showMessage("월별 집계 기간을 저장하는 데 실패했습니다.");
        }
    };

    // Google 로그인 처리
    const handleGoogleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            showMessage("구글 로그인에 성공했습니다!");
        } catch (error) {
            console.error("Google login failed:", error);
            showMessage("구글 로그인에 실패했습니다.");
        }
    };
// 계정 연결 처리 함수
    const handleLinkAccount = async (provider) => {
      if (!auth.currentUser) {
        showMessage("로그인 정보가 없습니다.");
        return;
      }
      try {
        await linkWithPopup(auth.currentUser, provider);
        showMessage("계정이 성공적으로 연결되었습니다! 이제 데이터가 안전하게 보관됩니다.");
      } catch (error) {
        console.error("계정 연결 실패:", error);
        if (error.code === 'auth/popup-closed-by-user') {
          return;
        }
        showMessage("계정 연결에 실패했습니다. 이미 다른 계정과 연결된 소셜 계정일 수 있습니다.");
      }
    };

    // 로그아웃 처리
    const handleLogout = async () => {
        try {
            await signOut(auth);
            setUserId(null); // userId 초기화
            setEntries([]); // 데이터 초기화
            showMessage("로그아웃되었습니다.");
        } catch (error) {
            console.error("Logout failed:", error);
            showMessage("로그아웃에 실패했습니다.");
        }
    };

    // 다크 모드 토글
    const toggleDarkMode = () => {
        setIsDarkMode(prevMode => !prevMode);
    };


    // 정렬 핸들러
    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(prevDir => (prevDir === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortColumn(column);
            setSortDirection('asc'); // 컬럼 변경 시 기본적으로 오름차순 정렬
        }
    };

    // 캘린더 월 변경 핸들러
    const handleMonthChange = (direction) => {
        setCurrentCalendarDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setMonth(newDate.getMonth() + direction);
            setSelectedMonth(newDate.toISOString().slice(0, 7)); // Update selectedMonth for profit calculation
            return newDate;
        });
    };

    // 캘린더 오늘 날짜로 이동
    const handleTodayClick = () => {
        const today = new Date();
        setCurrentCalendarDate(today);
        setSelectedMonth(today.toISOString().slice(0, 7));
    };

    // 캘린더 날짜 생성
    // 👇 이 최종 버전의 함수로 기존 함수를 완전히 교체해주세요. 👇
// App.js 파일 내부

// 👇 이 함수 하나만 아래의 새 코드로 완전히 교체해주세요. 👇
// 👇 이 함수와 바로 아래 const 변수 선언까지를 아래의 '올바른' 코드로 완전히 교체해주세요. 👇

const generateCalendarDays = useCallback(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    let periodStartDate;
    let periodEndDate;

   //...
    if (monthlyStartDay > monthlyEndDay) {
        periodStartDate = new Date(year, month - 1, monthlyStartDay);
        periodEndDate = new Date(year, month, monthlyEndDay);
    } else {
        periodStartDate = new Date(year, month, monthlyStartDay);
        periodEndDate = new Date(year, month, monthlyEndDay);
    }
// 종료일의 시간을 23:59:59로 설정하여 해당 일을 완전히 포함시킵니다.
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
        
        // ✨ 핵심: 일별 데이터를 다시 불러옵니다. (이 부분이 빠졌었습니다)
        const dailyData = monthlyProfit.dailyBreakdown[formattedDate] || { revenue: 0, expenses: 0 };

        days.push({
            date: formattedDate,
            day: dayIterator.getDate(),
            isCurrentMonth: isWithinPeriod,
            isToday: isToday,
            // ✨ 핵심: 수익과 지출 데이터를 다시 포함시킵니다.
            revenue: dailyData.revenue,
            expenses: dailyData.expenses,
        });

        dayIterator.setDate(dayIterator.getDate() + 1);
    }
    
    return days;
}, [currentCalendarDate, monthlyStartDay, monthlyEndDay, monthlyProfit.dailyBreakdown]); // ✨ 핵심: monthlyProfit 의존성을 다시 추가합니다.

const calendarDays = generateCalendarDays();


return (
    <div className={`min-h-screen p-4 font-sans flex flex-col items-center flex-grow ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-800'} pb-20`}>

    
    {/* 'production' 모드일 때만 AdBanner 컴포넌트를 렌더링합니다. */}
{/*
// 👇 광고 배너를 이 div로 감싸줍니다. 👇
<div className="w-full max-w-4xl text-center py-2 mx-auto flex-shrink-0 px-4">
  <AdBanner 
    data-ad-client="ca-pub-3940256099942544"
    data-ad-slot="6300978111"
    data-ad-format="auto"
    data-full-width-responsive="true"
  />
</div>
// 👆 여기까지 👆
*/}

            {/* 여기는 원래 있던 메인 콘텐츠 div 입니다 */}
<div className={`p-6 rounded-lg shadow-md w-full max-w-4xl mb-6 relative flex-grow overflow-y-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                {/* 통계와 더보기 화면에서는 큰 제목을 숨겨서 공간 확보 */}
{activeContentTab !== 'statistics' && activeContentTab !== 'adminSettings' && (
    <h1 className="text-3xl font-bold text-center mb-6">
         {activeContentTab === 'dataEntry' ? '' : '배송 수익 추적기'}
</h1>
)}
               

                {/* 로그인 안 된 상태 메시지 (제거) */}
                {/* {isAuthReady && !userId && activeContentTab !== 'adminSettings' && activeContentTab !== 'userGuide' && (
                    <div className="text-center mb-6">
                        <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>데이터를 저장하고 관리하려면 로그인해주세요.</p>
                    </div>
                )} */}

                {/* 모든 콘텐츠 렌더링 조건을 isAuthReady로 변경 (userId 조건 제거) */}
                {isAuthReady && ( // 인증 초기화가 되면 모든 탭 콘텐츠를 보이게 함
                    <>
                        {activeContentTab === 'monthlyProfit' && ( // 이제 userId 조건 없음
    <>
        <h2 className={`text-2xl font-bold text-center mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            {currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월 순이익
        </h2>
        <p className={`text-4xl font-extrabold text-center mb-6 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>
            {monthlyProfit.netProfit.toLocaleString()} 원
        </p>
        
    
       <div className="text-center mb-6">
  <button
    onClick={() => setShowMonthlyDetails(!showMonthlyDetails)}
    className={`py-2 px-4 rounded-md transition duration-150 ease-in-out ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} text-sm`}
  >
    {showMonthlyDetails ? '캘린더 보기' : '상세보기'}
  </button>
</div>

        {!showMonthlyDetails ? (
            // 캘린더 뷰
            <div className="calendar-view">
                <div className="flex justify-between items-center mb-4">
                    <button
                        onClick={() => handleMonthChange(-1)}
                        className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition duration-150 ease-in-out`}
                    >
                        <ChevronLeft size={24} className={`${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`} />
                    </button>
                    <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                        {currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월
                    </h3>
                    <button
                        onClick={() => handleMonthChange(1)}
                        className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition duration-150 ease-in-out`}
                    >
                        <ChevronRight size={24} className={`${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`} />
                    </button>
                </div>
                <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {monthlyProfit.periodStartDate ? new Date(monthlyProfit.periodStartDate).toLocaleDateString('ko-KR') : ''} ~ {monthlyProfit.periodEndDate ? new Date(monthlyProfit.periodEndDate).toLocaleDateString('ko-KR') : ''}
                    <button
                        onClick={handleTodayClick}
                        className={`ml-4 py-1 px-3 rounded-md text-xs ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'} transition duration-150 ease-in-out`}
                    >
                        오늘
                    </button>
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
                {/* 👇 이 코드 블록 전체를 복사해서 기존 코드를 대체해주세요 👇 */}
<div className="grid grid-cols-7 gap-1">
    {calendarDays.map((dayInfo, index) => (
        <div
            key={index}
            // ✨ 핵심 1: Flexbox를 사용해 내용물을 정렬합니다.
            className={`aspect-square flex flex-col items-center justify-start p-1 rounded-md text-xs sm:text-sm
                ${dayInfo.isCurrentMonth ? (isDarkMode ? 'bg-gray-700' : 'bg-white') : (isDarkMode ? 'bg-gray-800' : 'bg-gray-100')}
                ${dayInfo.isToday && dayInfo.isCurrentMonth ? 'border-2 border-blue-500' : ''}
            `}
        >
            {/* 조건부 렌더링으로 현재 월의 날짜만 표시합니다. */}
            {dayInfo.isCurrentMonth && (
                <>
                    {/* 날짜 숫자에 색상 적용 */}
                    <span className={`font-semibold 
                        ${index % 7 === 0 ? 'text-red-500' : ''}
                        ${index % 7 === 6 ? 'text-blue-500' : ''}
                        ${dayInfo.isToday ? 'text-blue-500' : ''}
                    `}>
                        {dayInfo.day}
                    </span>
                    
                    {/* 수익이 있을 때만 표시 */}
                    {dayInfo.revenue > 0 && (
                        <span className="text-red-500 text-[10px] leading-tight">
                            {dayInfo.revenue.toLocaleString()}
                        </span>
                    )}
                    {/* 지출이 있을 때만 표시 */}
                    {dayInfo.expenses > 0 && (
                        <span className="text-blue-500 text-[10px] leading-tight">
                            {dayInfo.expenses.toLocaleString()}
                        </span>
                    )}
                </> 
            )}
        </div>
    ))}
</div>
            </div>
        ) : (
            // 상세 내역 뷰 (기존 월별 수익 내용)
            <div className="space-y-4">
                {/* 집계 기간 및 목표 진행률 표시줄 */}
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

                    {/* 목표 금액 표시 및 수정 UI */}
                    <div className="flex justify-between items-center text-sm mb-1">
                        {!isEditingGoal ? (
                            <>
                                <div className="flex items-center">
                                    <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                        목표: {goalAmount.toLocaleString()}원
                                    </span>
                                    <button onClick={() => { setIsEditingGoal(true); setNewGoalAmountInput(goalAmount.toString()); }} className="ml-2">
                                        <Settings size={14} className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                                    </button>
                                </div>
                                <span className={`${isDarkMode ? 'text-gray-200' : 'text-gray-800'} font-semibold`}>
                                    현재: {monthlyProfit.netProfit.toLocaleString()}원
                                </span>
                            </>
                        ) : (
                            <div className="flex items-center space-x-2">
                                <input
                                    type="tel"
                                    value={newGoalAmountInput ? parseInt(newGoalAmountInput).toLocaleString('ko-KR') : ''}
                                    onChange={(e) => setNewGoalAmountInput(e.target.value.replace(/[^0-9]/g, ''))}
                                    className={`w-32 p-1 text-xs border rounded-md ${isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-300'}`}
                                    placeholder="새 목표 금액"
                                />
                                <button onClick={handleSaveGoal} className={`flex-shrink-0 py-1 px-2 text-xs rounded-md ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white`}>저장</button>
                                <button onClick={() => setIsEditingGoal(false)} className={`flex-shrink-0 py-1 px-2 text-xs rounded-md ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'} ${isDarkMode ? 'text-white' : 'text-black'}`}>취소</button>
                            </div>
                        )}
                    </div>

                    <div className={`w-full rounded-full h-2.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <div
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{ width: `${Math.min((monthlyProfit.netProfit / goalAmount) * 100, 100)}%` }}
                        ></div>
                    </div>
                </div>

                {/* 전월 대비 통계 */}
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} space-y-3`}>
                    <div className="flex justify-between items-center">
                        <span className="font-semibold">총 근무일</span>
                        <div className="flex items-center space-x-2">
                            <span>{monthlyProfit.totalWorkingDays.toLocaleString()} 일</span>
                            {renderComparison(monthlyProfit.totalWorkingDays, previousMonthlyProfit.totalWorkingDays)}
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-semibold">총 물량</span>
                        <div className="flex items-center space-x-2">
                            <span>{Math.round(monthlyProfit.totalVolume).toLocaleString()} 건</span>
                            {renderComparison(monthlyProfit.totalVolume, previousMonthlyProfit.totalVolume)}
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-semibold">총 프레시백</span>
                        <div className="flex items-center space-x-2">
                            <span>{monthlyProfit.totalFreshBag.toLocaleString()} 개</span>
                            {renderComparison(monthlyProfit.totalFreshBag, previousMonthlyProfit.totalFreshBag)}
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-semibold">일 평균 물량</span>
                        <div className="flex items-center space-x-2">
                            <span>{Math.round(monthlyProfit.dailyAverageVolume).toLocaleString()} 건</span>
                            {renderComparison(monthlyProfit.dailyAverageVolume, previousMonthlyProfit.dailyAverageVolume)}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </>
)}
{activeContentTab === 'dataEntry' && (
    <>
      {/* 입력 / 데이터 탭 버튼 (중앙 정렬 적용) */}
      <div className="flex justify-center border-b mb-4">
        <button
          onClick={() => setActiveDataTab('entry')}
          className={`py-2 px-4 font-semibold ${activeDataTab === 'entry' ? (isDarkMode ? 'border-blue-400 text-blue-400' : 'border-blue-500 text-blue-600') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}
        >
          입력
        </button>
        <button
          onClick={() => setActiveDataTab('list')}
          className={`py-2 px-4 font-semibold ${activeDataTab === 'list' ? (isDarkMode ? 'border-blue-400 text-blue-400' : 'border-blue-500 text-blue-600') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}
        >
          데이터
        </button>
      </div>

      {/* '입력' 탭일 때 DataEntryForm을 보여줍니다. */}
      {activeDataTab === 'entry' && (
        <DataEntryForm
            handleSubmit={handleSubmit}
            date={date}
            setDate={setDate}
            handleDateChange={handleDateChange}
            dateInputRef={dateInputRef}
            formType={formType}
            setFormType={setFormType}
            isDarkMode={isDarkMode}
            entryToEdit={entryToEdit}
            unitPrice={unitPrice} setUnitPrice={setUnitPrice}
            deliveryCount={deliveryCount} setDeliveryCount={setDeliveryCount}
            returnCount={returnCount} setReturnCount={setReturnCount}
            deliveryInterruptionAmount={deliveryInterruptionAmount} setDeliveryInterruptionAmount={setDeliveryInterruptionAmount}
            freshBagCount={freshBagCount} setFreshBagCount={setFreshBagCount}
            penaltyAmount={penaltyAmount} setPenaltyAmount={setPenaltyAmount}
            industrialAccidentCost={industrialAccidentCost} setIndustrialAccidentCost={setIndustrialAccidentCost}
            fuelCost={fuelCost} setFuelCost={setFuelCost}
            maintenanceCost={maintenanceCost} setMaintenanceCost={setMaintenanceCost}
            vatAmount={vatAmount} setVatAmount={setVatAmount}
            incomeTaxAmount={incomeTaxAmount} setIncomeTaxAmount={setIncomeTaxAmount}
            taxAccountantFee={taxAccountantFee} setTaxAccountantFee={setTaxAccountantFee}
            favoriteUnitPrices={favoriteUnitPrices}
        />
      )}

      {/* '데이터' 탭일 때 EntriesTable을 보여줍니다. */}
      {activeDataTab === 'list' && (
        <>
            <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>입력된 데이터</h2>
            <EntriesTable
                entries={filteredAndSortedEntries}
                handleSort={handleSort}
                handleEdit={handleEdit}
                handleDelete={handleDelete}
                isDarkMode={isDarkMode}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
            />
        </>
      )}
    </>
)}
                                

                        {activeContentTab === 'statistics' && (
                        <StatsDisplay
                            statisticsView={statisticsView}
                            setStatisticsView={setStatisticsView}
                            handleMonthChange={handleMonthChange}
                            selectedYear={selectedYear}
                            currentCalendarDate={currentCalendarDate}
                            monthlyProfit={monthlyProfit}
                            yearlyProfit={yearlyProfit}
                            cumulativeProfit={cumulativeProfit}
                            previousMonthlyProfit={previousMonthlyProfit}
                            isDarkMode={isDarkMode}
                            showMessage={showMessage}
                            monthlyStatsSubTab={monthlyStatsSubTab}
                            setMonthlyStatsSubTab={setMonthlyStatsSubTab}
                            setSelectedYear={setSelectedYear}
                        />
                    )}

                        {/* --- 👇 '더보기' 탭의 새로운 렌더링 로직 --- */}
                        {activeContentTab === 'adminSettings' && (
                            <>
                                {moreSubView === 'main' && (
                                    <MoreView
                                        onNavigate={setMoreSubView}
                                        isDarkMode={isDarkMode}
                                        toggleDarkMode={toggleDarkMode}
                                    />
                                )}
                                {moreSubView === 'account' && (
                                    <AccountView
                                        onBack={() => setMoreSubView('main')}
                                        isDarkMode={isDarkMode}
                                        auth={auth}
                                        handleLinkAccount={handleLinkAccount}
                                        handleLogout={handleLogout}
                                        googleProvider={googleProvider}
                                        kakaoProvider={kakaoProvider}
                                        naverProvider={naverProvider}
                                    />
                                )}
                                {moreSubView === 'unitPrice' && (
                                    <UnitPriceView
                                        onBack={() => setMoreSubView('main')}
                                        isDarkMode={isDarkMode}
                                        adminFavoritePricesInput={adminFavoritePricesInput}
                                        setAdminFavoritePricesInput={setAdminFavoritePricesInput}
                                        handleSaveFavoritePrices={handleSaveFavoritePrices}
                                        favoriteUnitPrices={favoriteUnitPrices}
                                    />
                                )}
                                {moreSubView === 'period' && (
                                    <PeriodView
                                        onBack={() => setMoreSubView('main')}
                                        isDarkMode={isDarkMode}
                                        adminMonthlyStartDayInput={adminMonthlyStartDayInput}
                                        setAdminMonthlyStartDayInput={setAdminMonthlyStartDayInput}
                                        adminMonthlyEndDayInput={adminMonthlyEndDayInput}
                                        setAdminMonthlyEndDayInput={setAdminMonthlyEndDayInput}
                                        handleSaveMonthlyPeriodSettings={handleSaveMonthlyPeriodSettings}
                                        monthlyStartDay={monthlyStartDay}
                                        monthlyEndDay={monthlyEndDay}
                                    />
                                )}
                             
   {moreSubView === 'data' && (
    <DataSettingsView
        onBack={() => setMoreSubView('main')}
        isDarkMode={isDarkMode}
        handleExportCsv={() => exportDataAsCsv(db, appId, userId, showMessage)}
        handleImportCsv={(e) => importDataFromCsv(e, db, appId, userId, showMessage)}
    />
)}
  {moreSubView === 'privacyPolicy' && (
                                    <PrivacyPolicy
                                        onBack={() => setMoreSubView('main')}
                                        isDarkMode={isDarkMode}
                                    />
                                )}
                                {moreSubView === 'openSource' && (
                                    <OpenSourceLicenses
                                        onBack={() => setMoreSubView('main')}
                                        isDarkMode={isDarkMode}
                                    />
                                )}

                            </>
                        )}

                       {moreSubView === 'userGuide' && (
    <UserGuideView
        onBack={() => setMoreSubView('main')}
        isDarkMode={isDarkMode}
    />
)}
                          
                 
                    </>
                )}
            </div>

            {/* 하단 내비게이션 바는 이제 userId 조건 없이 항상 표시 */}
            {isAuthReady && ( // 인증 준비가 되면 하단 바 표시
                <div className={`fixed bottom-0 left-0 right-0 w-full ${isDarkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'} shadow-lg flex justify-around py-2 px-4 pb-[env(safe-area-inset-bottom)]`}>
                    <button
                        className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'data' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`}
                        onClick={() => { setSelectedMainTab('data'); setActiveContentTab('dataEntry'); }}
                    >
                        <List size={24} />
                        <span>데이터</span>
                    </button>
                    <button
                        className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'statistics' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`}
                        onClick={() => { setSelectedMainTab('statistics'); setActiveContentTab('statistics'); setStatisticsView('monthly'); setMonthlyStatsSubTab('overview'); }}
                    >
                        <BarChart2 size={24} />
                        <span>통계</span>
                    </button>
                    <button
                        className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'home' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`}
                        onClick={() => { setSelectedMainTab('home'); setActiveContentTab('monthlyProfit'); }}
                    >
                        <Home size={24} />
                        <span>홈</span>
                    </button>
                                     <button
                        className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'more' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`}
                        onClick={() => { setSelectedMainTab('more'); setActiveContentTab('adminSettings'); setMoreSubView('main'); }}
                    >
                        <MoreHorizontal size={24} />
                        <span>더보기</span>
                    </button>
                </div>
            )}

            {/* Custom Modal for messages */}
           <Modal
    isOpen={isModalOpen}
    onClose={closeModal}
    title={modalContent.title}
    content={modalContent.content}
    isDarkMode={isDarkMode}
/>
</div>
);
}
export default App;  // <-- export는 함수 바깥, 파일의 최상단 레벨에 있어야 합니다.
