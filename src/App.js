import React, { useState, useEffect, useCallback, useMemo,useRef } from 'react';
// Lucide React 아이콘 임포트
// src/App.js
// ✨ 변경점: Plus 아이콘을 추가로 임포트합니다.
import { Settings, Sun, Moon, Info, Download, Upload, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Home, BarChart2, List, MoreHorizontal, AlertTriangle, Plus } from 'lucide-react';

// Firebase 관련 임포트
import { app, db, auth, appId, googleProvider, kakaoProvider, naverProvider } from './firebaseConfig';
import { doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged, signOut, linkWithPopup, signInWithPopup } from 'firebase/auth';


import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Preferences } from '@capacitor/preferences';
// 유틸리티 및 커스텀 컴포넌트 임포트
import { formatDate } from './utils';
import StatsDisplay from './StatsDisplay';
import GoalProgressBar from './components/GoalProgressBar';
import AdBanner from './AdBanner'; // 광고 배너 컴포넌트
//홈화면 반원바
import RevenueDistributionChart from './components/RevenueDistributionChart'; 
//기록 보기 편하게 만들기

import FilterModal from './components/DataScreen/FilterModal';
import EntriesList from './components/DataScreen/EntriesList.js';

import DataEntryForm from './DataEntryForm';
//import EntriesTable from './EntriesTable';

import FilterControls from './components/FilterControls';
import PrivacyPolicy from './components/more/PrivacyPolicy'; // 👈 추가
import OpenSourceLicenses from './components/more/OpenSourceLicenses.js'; // 👈 추가
import { Pedometer } from '@hamjad/capacitor-pedometer'; //만보기

//입력/데이터탭기능추가
import TransactionManager from './components/TransactionManager';
import TransactionTable from './components/TransactionTable';
//백업관리
import { exportDataAsCsv, importDataFromCsv, deleteAllData } from './utils/dataHandlers.js';
//따로 다운로드 팝업보이게하기
import Modal from './components/Modal';
//랭킹 뷰
import RankingView from './components/RankingView';
import PedometerView from './components/PedometerView' //만보기
//더보기제어
import MoreView from './components/more/MoreView';
import AccountView from './components/more/AccountView';
import UnitPriceView from './components/more/UnitPriceView';
import PeriodView from './components/more/PeriodView';
import DataSettingsView from './components/more/DataSettingsView';
import UserGuideView from './components/more/UserGuideView'; //사용자가이드
import LegalInfoView from './components/more/LegalInfoView'; //약관및 법적조치
import AnnouncementsView from './components/more/AnnouncementsView'; //알림
import ContactView from './components/more/ContactView';//문의
import { useProfitCalculations } from './hooks/useProfitCalculations';

// 재사용을 위해 DetailRow 컴포넌트를 정의합니다. (별도 파일로 분리해도 좋습니다)
/**
 * 상세 정보 카드에 사용되는 행(Row) 컴포넌트입니다. (비교 데이터 포함)
 */
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
    /** @description 월별 목표 금액 (초기값: 7,000,000원) */
    const [goalAmount, setGoalAmount] = useState(7000000);
    /** @description 목표 금액을 수정하는 모드인지 여부 (true/false) */
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    /** @description 목표 금액 수정 시, input에 입력되는 값을 임시 저장 */
    const [newGoalAmountInput, setNewGoalAmountInput] = useState('');

    // --- 사용자 및 인증 ---
    /** @description 현재 로그인된 사용자의 고유 ID (UID) */
    const [userId, setUserId] = useState(null);
    /** @description Firebase 인증 상태가 준비되었는지 확인 (초기 로딩 제어용) */
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // --- 만보기 기능 ---
    /** @description 오늘 기록된 걸음 수 */
    const [dailySteps, setDailySteps] = useState(0);

// --- UI 테마 및 화면 제어 ---
const [isDarkMode, setIsDarkMode] = useState(true);

    /** @description 만보기 센서 사용 가능 여부 */
    const [pedometerAvailable, setPedometerAvailable] = useState(false);

    /** @description 하단 탭 메뉴('홈', '데이터', '통계' 등) 중 현재 선택된 탭 */
    const [selectedMainTab, setSelectedMainTab] = useState('home');
    /** @description 하단 탭 선택 시, 화면에 보여줄 메인 콘텐츠 종류 */
    const [activeContentTab, setActiveContentTab] = useState('monthlyProfit');
    /** @description '데이터' 탭 내부의 '입력'과 '목록' 탭 중 현재 선택된 탭 */
    const [activeDataTab, setActiveDataTab] = useState('entry');
    /** @description '더보기' 탭 내부의 하위 메뉴 화면 제어 */
    const [moreSubView, setMoreSubView] = useState('main');

    // --- 데이터 입력 폼 ---
    /** @description 데이터 입력 시 사용되는 날짜 */
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    /** @description 배송/반품 건당 단가 */
    const [unitPrice, setUnitPrice] = useState('');
    /** @description 배송 완료 수량 */
    const [deliveryCount, setDeliveryCount] = useState('');
    /** @description 반품 수량 */
    const [returnCount, setReturnCount] = useState('');
    /** @description 프레시백 수거 수량 */
    const [freshBagCount, setFreshBagCount] = useState('');
    /** @description 배송 중단으로 발생한 수익 */
    const [deliveryInterruptionAmount, setDeliveryInterruptionAmount] = useState('');
    /** @description 패널티 금액 (지출) */
    const [penaltyAmount, setPenaltyAmount] = useState('');
    /** @description 산재 비용 (지출) */
    const [industrialAccidentCost, setIndustrialAccidentCost] = useState('');
    /** @description 유류비 (지출) */
    const [fuelCost, setFuelCost] = useState('');
    /** @description 차량 유지보수비 (지출) */
    const [maintenanceCost, setMaintenanceCost] = useState('');
    /** @description 부가세 (지출) */
    const [vatAmount, setVatAmount] = useState('');
    /** @description 종합소득세 (지출) */
    const [incomeTaxAmount, setIncomeTaxAmount] = useState('');
    /** @description 세무사 비용 (지출) */
    const [taxAccountantFee, setTaxAccountantFee] = useState('');
    /** @description 데이터 입력 폼을 '수익'과 '지출' 중 어떤 모드로 보여줄지 제어 */
    const [formType, setFormType] = useState('income');
    /** @description 수정할 데이터 항목을 임시 저장 (null이 아니면 수정 모드) */
    const [entryToEdit, setEntryToEdit] = useState(null);

    // --- 데이터 목록 및 통계 ---
    /** @description Firebase에서 불러온 모든 데이터 목록을 저장하는 배열 */
    const [entries, setEntries] = useState([]);
    /** @description 통계 계산의 기준이 되는 '월' (예: "2025-07") */
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    /** @description 통계 계산의 기준이 되는 '연도' (예: "2025") */
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    /** @description '통계' 탭에서 '월간', '연간', '누적' 보기 중 현재 선택된 모드 */
    const [statisticsView, setStatisticsView] = useState('monthly');
    /** @description '월간 통계' 상세 화면에서 '개요', '매출', '지출' 중 현재 선택된 탭 */
    const [monthlyStatsSubTab, setMonthlyStatsSubTab] = useState('overview');

    // --- 설정값 관리 ---
    /** @description 사용자가 즐겨찾기로 등록한 단가 목록 */
    const [favoriteUnitPrices, setFavoriteUnitPrices] = useState([]);
    /** @description '더보기 > 단가 설정'에서 사용자가 input에 입력하는 값 */
    const [adminFavoritePricesInput, setAdminFavoritePricesInput] = useState('');
    /** @description 월별 수익 집계 시작일 */
    const [monthlyStartDay, setMonthlyStartDay] = useState(26);
    /** @description 월별 수익 집계 종료일 */
    const [monthlyEndDay, setMonthlyEndDay] = useState(25);
    /** @description '더보기 > 기간 설정'의 시작일 input 값 */
    const [adminMonthlyStartDayInput, setAdminMonthlyStartDayInput] = useState('26');
    /** @description '더보기 > 기간 설정'의 종료일 input 값 */
    const [adminMonthlyEndDayInput, setAdminMonthlyEndDayInput] = useState('25');

    // --- 데이터 목록 필터링 및 정렬 ---
    /** @description 데이터 목록을 정렬할 기준 컬럼 (예: 'date', 'unitPrice') */
    const [sortColumn, setSortColumn] = useState('date');
    /** @description 데이터 목록의 정렬 방향 ('asc': 오름차순, 'desc': 내림차순) */
    const [sortDirection, setSortDirection] = useState('desc');

    // --- 캘린더 및 상세 보기 ---
    /** @description '홈' 탭의 캘린더가 보여주는 현재 월 */
    const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
    /** @description '홈' 탭에서 '상세보기'와 '캘린더 보기'를 전환하는 상태 */
    const [showMonthlyDetails, setShowMonthlyDetails] = useState(true);
   


    // 앱이 시작될 때 마지막으로 본 화면(캘린더/상세보기) 상태를 불러옵니다.
    useEffect(() => {
        const savedView = localStorage.getItem('homeView');
        if (savedView !== null) {
            setShowMonthlyDetails(JSON.parse(savedView));
        }
    }, []); // 빈 배열을 전달하여 앱 시작 시 한 번만 실행되도록 함

    // '캘린더/상세보기' 상태가 바뀔 때마다 그 상태를 저장합니다.
    useEffect(() => {
        localStorage.setItem('homeView', JSON.stringify(showMonthlyDetails));
    }, [showMonthlyDetails]);

    // 필터 팝업(모달) 제어
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false); 

    //데이터 필터만들기
    const [filters, setFilters] = useState({
        period: 'all', // '1m', '3m', '6m', 'custom', 'all'
        startDate: '',
        endDate: '',
        type: 'all' // 'all', 'income', 'expense'
    });

    const handleApplyFilters = (newFilters) => {
        setFilters(newFilters);
        setIsFilterModalOpen(false);
    };

    // --- 팝업 (모달) ---
    /** @description 앱 전체에서 사용되는 팝업(모달)의 상태 (열림 여부, 내용, 종류 등) */
    const [modalState, setModalState] = useState({
        isOpen: false,
        content: '',
        type: 'info',
        onConfirm: null,
    });

    // --- DOM 직접 제어 ---
    /** @description 날짜 input 태그를 직접 제어하기 위한 Ref 객체 */
    const dateInputRef = useRef(null);
    //스와이프&슬라이드 기능 추가
const touchStartX = useRef(null);
const touchEndX = useRef(null);
const touchStartY = useRef(null);
const touchEndY = useRef(null);

    /** @description 삭제/복원 등 시간이 걸리는 작업 진행 여부 (true/false) */
    const [isLoading, setIsLoading] = useState(false);
    /** @description 로딩 팝업에 표시될 메시지 (예: '삭제 중...') */
    const [loadingMessage, setLoadingMessage] = useState('');


  // 1. 앱이 처음 시작될 때 딱 한 번만 실행되어 저장된 테마 설정을 불러옵니다.
useEffect(() => {
    const loadDarkModeSetting = async () => {
        try {
            const { value } = await Preferences.get({ key: 'isDarkMode' });
            // 저장된 값이 있으면 (null이 아니면) 그 값을 상태에 적용합니다.
            if (value !== null) {
                setIsDarkMode(JSON.parse(value));
            }
            // 저장된 값이 없으면, 맨 처음 useState(true)로 설정된 기본 다크모드가 유지됩니다.
        } catch (error) {
            console.error("테마 설정 불러오기 실패:", error);
        }
    };

    loadDarkModeSetting();
}, []); // 빈 배열: 앱 시작 시 딱 한 번만 실행

// 2. isDarkMode 상태가 바뀔 때마다 실행되어, 선택을 저장하고 화면을 변경합니다.
useEffect(() => {
    const saveAndApplyTheme = async () => {
        try {
            // 선택 사항을 기기에 저장합니다.
            await Preferences.set({
                key: 'isDarkMode',
                value: JSON.stringify(isDarkMode),
            });

            // <html> 태그에 dark 클래스를 적용/제거합니다.
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
        const fetchDailySteps = async () => {
            try {
                const permissions = await Pedometer.requestPermissions();
                
                // 👇 플러그인이 응답이 없더라도 앱이 멈추지 않도록 안전장치를 추가합니다.
                if (permissions?.status !== 'granted') {
                    console.log("만보기 권한이 부여되지 않았거나, 플러그인이 응답하지 않았습니다.");
                    // 사용자에게 알림은 주되, 앱이 멈추지는 않습니다.
                    showMessage("만보기 기능을 사용하려면 신체 활동 권한이 필요합니다.");
                    setPedometerAvailable(false);
                    return; 
                }
                
                // 이 아래 코드는 권한이 있을 때만 실행됩니다.
                setPedometerAvailable(true);
                const startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                const endDate = new Date();
                const data = await Pedometer.query({
                    startDate: startDate.getTime(),
                    endDate: endDate.getTime()
                });
                setDailySteps(data?.numberOfSteps || 0);

            } catch (error) {
                console.error("만보기 데이터 조회 에러:", error);
                setPedometerAvailable(false);
            }
        };

        fetchDailySteps();
    }, []);

    // 👇 [수정 2] 걸음 수가 변경될 때마다 Firebase에 저장하는 useEffect를 바깥으로 분리
    useEffect(() => {
        if (userId && dailySteps > 0) {
            const today = new Date().toISOString().slice(0, 10);
            const userStepsRef = doc(db, `pedometer/${today}/userSteps`, userId);
            setDoc(userStepsRef, {
                steps: dailySteps,
                lastUpdated: new Date()
            }, { merge: true });
        }
    }, [userId, dailySteps]);


    // 정보 팝업을 띄우는 함수 (showMessage의 이름을 content로만 받도록 변경)
    const showMessage = (msg) => {
        setModalState({ isOpen: true, content: msg, type: 'info', onConfirm: null });
    };

    // 확인/취소 팝업을 띄우는 함수
    const showConfirmation = (msg, onConfirmAction) => {
        setModalState({ isOpen: true, content: msg, type: 'confirm', onConfirm: onConfirmAction });
    }

    // 팝업을 닫는 함수
    const closeModal = () => {
        setModalState({ isOpen: false, content: '', type: 'info', onConfirm: null });
    };

    // 팝업의 '확인' 또는 '삭제' 버튼을 눌렀을 때 실행될 함수
    const handleConfirm = () => {
        if (modalState.onConfirm) {
            modalState.onConfirm(); // 저장된 함수(예: deleteAllData)를 실행
        }
        closeModal();
    };

    
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
    const handleDeleteAllDataRequest = () => {
        showConfirmation(
            "정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.",
            () => deleteAllData(db, appId, userId, showMessage)
        );
    };

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

    // 즐겨찾는 단가 및 월별 집계 기간 로드 및 초기 설정
    useEffect(() => {
        // ... (이 안의 내용은 그대로 둡니다) ...
    }, [isAuthReady, userId]);

    // 👇👇👇 바로 이 자리에 아래의 새로운 useEffect 코드 블록을 추가해주세요! 👇👇👇
    useEffect(() => {
        // '데이터' 탭을 벗어났을 때, 수정 모드를 자동으로 취소하고 입력 폼을 초기화합니다.
        if (selectedMainTab !== 'data' && entryToEdit) {
            setEntryToEdit(null); // 수정 모드 해제
            
            // 입력 필드 초기화
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
        }
    }, [selectedMainTab, entryToEdit]);

    // 데이터 입력 핸들러
    const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) {
        showMessage("로그인해야 데이터를 저장할 수 있습니다.");
        return;
    }
    const handleContactSubmit = async (category, message) => {
        const today = new Date().toISOString().slice(0, 10);
        const userIdentifier = userId || 'anonymous'; // 로그인 사용자는 UID, 비로그인 사용자는 'anonymous'

        // 1. 사용자의 하루 제출 횟수를 확인합니다.
        const submissionCountRef = doc(db, 'submissionCounts', `${userIdentifier}_${today}`);
        
        try {
            const docSnap = await getDoc(submissionCountRef);
            if (docSnap.exists() && docSnap.data().count >= 5) {
                showMessage("하루에 5번까지만 의견을 보낼 수 있습니다. 내일 다시 시도해주세요.");
                return;
            }

            // 2. 의견을 Firestore에 저장합니다.
            const inquiriesCollectionRef = collection(db, 'inquiries');
            await addDoc(inquiriesCollectionRef, {
                userId: userIdentifier,
                category: category,
                message: message,
                timestamp: new Date(),
                isResolved: false
            });

            // 3. 제출 횟수를 1 증가시킵니다.
            if (docSnap.exists()) {
                await updateDoc(submissionCountRef, { count: docSnap.data().count + 1 });
            } else {
                await setDoc(submissionCountRef, { count: 1 });
            }

            showMessage("소중한 의견 감사합니다! 성공적으로 전송되었습니다.");
            setMoreSubView('main');

        } catch (error) {
            console.error("Error sending inquiry: ", error);
            showMessage("의견 전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
    };

    // --- 🚨 중요: 수정 모드일 때는 기존처럼 하나의 항목으로 업데이트합니다. ---
    // 수익/지출이 섞인 항목을 수정할 때 데이터가 나뉘는 혼란을 방지하기 위함입니다.
    if (entryToEdit) {
        const entryRef = doc(db, `artifacts/${appId}/users/${userId}/deliveryEntries`, entryToEdit.id);
        const updatedEntry = {
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
        await updateDoc(entryRef, updatedEntry);
        showMessage("항목이 성공적으로 업데이트되었습니다.");
        setEntryToEdit(null);
        
        // 입력 필드 초기화
        setUnitPrice(''); setDeliveryCount(''); setReturnCount('');
        setDeliveryInterruptionAmount(''); setFreshBagCount('');
        setPenaltyAmount(''); setIndustrialAccidentCost(''); setFuelCost('');
        setMaintenanceCost(''); setVatAmount(''); setIncomeTaxAmount('');
        setTaxAccountantFee('');
        setFormType('income');
        
        setActiveDataTab('list');
        return; // 업데이트 후 함수 종료
    }
    
    // --- 👇 새로 추가되는 항목에 대한 분리 저장 로직 ---
    const hasRevenueData = (unitPrice && (deliveryCount || returnCount || deliveryInterruptionAmount)) || freshBagCount;
    const hasExpenseData = penaltyAmount || industrialAccidentCost || fuelCost || maintenanceCost || vatAmount || incomeTaxAmount || taxAccountantFee;

    if (!hasRevenueData && !hasExpenseData) {
        showMessage("입력된 수익 또는 지출 정보가 없습니다.");
        return;
    }

    try {
        // 수익 데이터가 있으면 '수익 전용' 항목을 생성하여 저장
        if (hasRevenueData) {
            const revenueEntry = {
                date,
                unitPrice: unitPrice ? parseFloat(unitPrice) : 0,
                deliveryCount: deliveryCount ? parseInt(deliveryCount) : 0,
                returnCount: returnCount ? parseInt(returnCount) : 0,
                deliveryInterruptionAmount: deliveryInterruptionAmount ? parseFloat(deliveryInterruptionAmount) : 0,
                freshBagCount: freshBagCount ? parseInt(freshBagCount) : 0,
                // 모든 지출 항목은 0으로 저장
                penaltyAmount: 0, industrialAccidentCost: 0, fuelCost: 0, maintenanceCost: 0, vatAmount: 0, incomeTaxAmount: 0, taxAccountantFee: 0,
                timestamp: new Date(),
            };
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`), revenueEntry);
        }

        // 지출 데이터가 있으면 '지출 전용' 항목을 생성하여 저장
        if (hasExpenseData) {
            const expenseEntry = {
                date,
                // 모든 수익 항목은 0으로 저장
                unitPrice: 0, deliveryCount: 0, returnCount: 0, deliveryInterruptionAmount: 0, freshBagCount: 0,
                penaltyAmount: penaltyAmount ? parseFloat(penaltyAmount) : 0,
                industrialAccidentCost: industrialAccidentCost ? parseFloat(industrialAccidentCost) : 0,
                fuelCost: fuelCost ? parseFloat(fuelCost) : 0,
                maintenanceCost: maintenanceCost ? parseFloat(maintenanceCost) : 0,
                vatAmount: vatAmount ? parseFloat(vatAmount) : 0,
                incomeTaxAmount: incomeTaxAmount ? parseFloat(incomeTaxAmount) : 0,
                taxAccountantFee: taxAccountantFee ? parseFloat(taxAccountantFee) : 0,
                timestamp: new Date(),
            };
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`), expenseEntry);
        }

        showMessage("항목이 성공적으로 저장되었습니다.");

        // 모든 입력 필드 초기화
        setUnitPrice(''); setDeliveryCount(''); setReturnCount('');
        setDeliveryInterruptionAmount(''); setFreshBagCount('');
        setPenaltyAmount(''); setIndustrialAccidentCost(''); setFuelCost('');
        setMaintenanceCost(''); setVatAmount(''); setIncomeTaxAmount('');
        setTaxAccountantFee('');
        setFormType('income');
        setActiveDataTab('list');

    } catch (e) {
        console.error("Error adding document: ", e);
        showMessage("데이터 저장에 실패했습니다.");
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

// 필터링과 정렬을 한 번에 처리하는 최종 데이터 목록
const finalFilteredEntries = useMemo(() => {
    if (!userId) return [];

    const filtered = entries.filter(entry => {
        // 거래구분 필터 로직
        const dailyRevenue = (entry.unitPrice * entry.deliveryCount) + (entry.unitPrice * entry.returnCount) + (entry.unitPrice * (entry.deliveryInterruptionAmount || 0)) + ((entry.freshBagCount || 0) * 100);
        const dailyExpenses = ((entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0));

        const typeMatch = filters.type === 'all' ||
            (filters.type === 'income' && dailyRevenue > 0) ||
            (filters.type === 'expense' && dailyExpenses > 0);
        
        if (!typeMatch) return false;

        // 기간 필터 로직
        if (filters.period === 'all' || !filters.startDate || !filters.endDate) {
            return true;
        }
        return entry.date >= filters.startDate && entry.date <= filters.endDate;
    });

    // 정렬 로직
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
}, [entries, filters, sortColumn, sortDirection, userId]);

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
// 👇👇👇 여기에 아래 새로운 함수를 추가해주세요! 👇👇👇
    const handleCalendarDateClick = (clickedDate) => {
        // 클릭한 날짜에 해당하는 모든 데이터 항목을 찾습니다.
        const entriesForDate = entries.filter(entry => entry.date === clickedDate);

        // 해당 날짜에 데이터가 1개만 있는 경우 -> 바로 '수정' 모드로 전환
        if (entriesForDate.length === 1) {
            handleEdit(entriesForDate[0]);
        } 
        // 해당 날짜에 데이터가 2개 이상 있는 경우  -> '데이터' 탭으로 이동하여 목록 보여주기
    else if (entriesForDate.length > 1) {
            // 👇 '데이터' 탭으로 이동하기 전에 필터를 먼저 적용합니다.
            setFilters({
                period: 'custom',
                startDate: clickedDate,
                endDate: clickedDate,
                type: 'all'
            });
            setSelectedMainTab('data');
            setActiveContentTab('dataEntry');
            setActiveDataTab('list');
        } 
        // 해당 날짜에 데이터가 없는 경우 -> '입력' 탭으로 이동하여 새 데이터 입력 준비
        else {
            setSelectedMainTab('data');
            setActiveContentTab('dataEntry');
            setActiveDataTab('entry'); // '입력' 탭을 보여줌
            setDate(clickedDate); // 클릭한 날짜를 입력 폼에 설정
            
            // 다른 입력 필드는 깨끗하게 초기화
            setUnitPrice(''); setDeliveryCount(''); setReturnCount('');
            setDeliveryInterruptionAmount(''); setFreshBagCount('');
            setPenaltyAmount(''); setIndustrialAccidentCost(''); setFuelCost('');
            setMaintenanceCost(''); setVatAmount(''); setIncomeTaxAmount('');
            setTaxAccountantFee('');
            setEntryToEdit(null); // 수정 모드 해제
        }
    };
 // ✨ 변경점: 아래 세 개의 스와이프 관련 함수를 추가합니다.
    // ✨ 변경점: 아래 세 개의 스와이프 관련 함수를 이 코드로 완전히 교체해주세요.
const handleTouchStart = (e) => {
    // 첫 터치 지점의 X와 Y 좌표를 모두 저장합니다.
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    touchEndX.current = null;
    touchEndY.current = null;
};

const handleTouchMove = (e) => {
    // 손가락이 움직이는 동안 계속해서 끝 지점의 X와 Y 좌표를 업데이트합니다.
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
};

const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current || !touchStartY.current || !touchEndY.current) {
        return;
    }

    const deltaX = touchStartX.current - touchEndX.current;
    const deltaY = touchStartY.current - touchEndY.current;

    // 수평 움직임이 수직 움직임(스크롤)보다 훨씬 클 때만 슬라이드로 간주합니다.
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        const isLeftSwipe = deltaX > 50;  // 손가락을 왼쪽으로 미는 동작
        const isRightSwipe = deltaX < -50; // 손가락을 오른쪽으로 미는 동작

        if (isLeftSwipe && activeDataTab === 'entry') {
            // '입력' 화면에서 왼쪽으로 슬라이드 -> '데이터' 목록으로 이동
            setActiveDataTab('list');
        } else if (isRightSwipe && activeDataTab === 'list') {
            // '데이터' 목록에서 오른쪽으로 슬라이드 -> '입력' 화면으로 이동
            setActiveDataTab('entry');
        }
    }

    // 다음 동작을 위해 모든 좌표를 초기화합니다.
    touchStartX.current = null;
    touchEndX.current = null;
    touchStartY.current = null;
    touchEndY.current = null;
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

// ✨ 변경점: 연간 및 누적 집계 기간을 계산하는 로직을 추가합니다.
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
    return {
        startDate: startDate.toLocaleDateString('ko-KR'),
        endDate: endDate.toLocaleDateString('ko-KR')
    };
}, [selectedYear, monthlyStartDay, monthlyEndDay]);

const cumulativePeriod = useMemo(() => {
    if (entries.length === 0) return null;
    const dates = entries.map(e => new Date(e.date));
    const minDate = new Date(Math.min.apply(null, dates));
    const maxDate = new Date(Math.max.apply(null, dates));
    return {
        startDate: minDate.toLocaleDateString('ko-KR'),
        endDate: maxDate.toLocaleDateString('ko-KR')
    };
}, [entries]);

// ✨ 변경점: 데이터 입력 화면으로 바로 이동하는 함수를 추가합니다.
const handleNavigateToDataEntry = () => {
    setSelectedMainTab('data');
    setActiveContentTab('dataEntry');
    setActiveDataTab('entry');
    // 새 입력을 위해 폼을 초기화합니다.
    setEntryToEdit(null);
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

return (
    <div className={`min-h-screen font-sans flex flex-col items-center flex-grow ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-800'} pb-20 px-4 sm:px-8 pt-[calc(0.5rem+env(safe-area-inset-top))]`}>

    
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
                <div className={`w-full mb-6 relative ${isDarkMode ? 'bg-transparent' : 'bg-transparent'}`}>
                    {/* 통계와 더보기 화면에서는 큰 제목을 숨겨서 공간 확보 */}
                   {false && (
    <h1 className="text-3xl font-bold text-center mb-6">
        {activeContentTab === 'dataEntry' ? '' : ''}
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
                                        // 캘린더 뷰
                                        <div className="calendar-view">
  <div className="flex justify-center items-center mb-4 space-x-3">
    <button
        onClick={() => handleMonthChange(-1)}
        className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
    >
        <ChevronLeft size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
    </button>
    <h3 className={`font-bold text-lg ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
        {currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월
    </h3>
    <button
        onClick={() => handleMonthChange(1)}
        className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
    >
        <ChevronRight size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
    </button>
</div>
                                           <p className={`text-sm text-right mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
                                        <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((dayInfo, index) => (
                                    <div
                                        key={index}
                                        onClick={() => handleCalendarDateClick(dayInfo.date)}
                                        className={`cursor-pointer aspect-square flex flex-col items-center justify-start p-1 rounded-md
                                        ${dayInfo.isCurrentMonth ? (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-100') : (isDarkMode ? 'bg-gray-800' : 'bg-white')}
                                        ${dayInfo.isToday && dayInfo.isCurrentMonth ? 'border-2 border-blue-500' : ''}
                                        `}
                                    >
                                        {dayInfo.isCurrentMonth && (
                                            <>
                                                <span className={`font-semibold text-[clamp(0.75rem,3vw,0.875rem)]
                                                    ${index % 7 === 0 ? 'text-red-500' : ''}
                                                    ${index % 7 === 6 ? 'text-blue-500' : ''}
                                                    ${dayInfo.isToday ? 'text-blue-500' : ''}
                                                `}>
                                                    {dayInfo.day}
                                                </span>
                                                
                                                {dayInfo.revenue > 0 && (
                                                    <span className="text-red-500 text-[clamp(0.5rem,2vw,0.625rem)] leading-tight">
                                                        {dayInfo.revenue.toLocaleString()}
                                                    </span>
                                                )}
                                                {dayInfo.expenses > 0 && (
                                                    <span className="text-blue-500 text-[clamp(0.5rem,2vw,0.625rem)] leading-tight">
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
                                        // 상세 내역 뷰
                                        <div className="space-y-4">
    <div className="flex justify-center items-center mb-4 space-x-3">
        <button
            onClick={() => handleMonthChange(-1)}
            className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
        >
            <ChevronLeft size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
        </button>
        <h3 className={`font-bold text-lg ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            {currentCalendarDate.getFullYear()}년 {currentCalendarDate.getMonth() + 1}월
        </h3>
        <button
            onClick={() => handleMonthChange(1)}
            className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
        >
            <ChevronRight size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
        </button>
    </div>
                                            <div className="max-w-md mx-auto space-y-4">
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

                                                    {/* ✨ 변경점: 작은 화면에서 글자 크기와 간격을 줄여 줄바꿈 문제를 해결합니다. */}
                                                    <div className="grid grid-cols-[1fr_auto_1fr] items-center text-sm sm:text-base mb-1 gap-x-1 sm:gap-x-2">
    {!isEditingGoal ? (
        <>
            <span className={`${isDarkMode ? 'text-gray-200' : 'text-gray-800'} font-semibold text-right whitespace-nowrap truncate`}>
                현재: {monthlyProfit.netProfit.toLocaleString()}
            </span>

            <span className="font-bold text-red-500">VS</span>

            <div className="flex items-center justify-start min-w-0">
                <span className={`${isDarkMode ? 'text-gray-200' : 'text-gray-800'} font-semibold whitespace-nowrap truncate`}>
                    목표: {goalAmount.toLocaleString()}
                </span>
                <button onClick={() => { setIsEditingGoal(true); setNewGoalAmountInput(goalAmount.toString()); }} className="ml-1 sm:ml-2 flex-shrink-0">
                    <Settings size={14} className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                </button>
            </div>
                                                            </>
                                                        ) : (
                                                            <div className="col-span-3 flex justify-center items-center space-x-2">
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
                                                    <GoalProgressBar 
                                                        current={monthlyProfit.netProfit} 
                                                        goal={goalAmount} 
                                                        isDarkMode={isDarkMode}
                                                    />
                                                </div>

                                                {/* 상세 정보 카드 */}
                                                <div className={`pl-6 pr-[23px] py-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} space-y-3 shadow`}>
                                                    <DetailRow
                                                        label="총 근무일"
                                                        value={`${monthlyProfit.totalWorkingDays.toLocaleString()} 일`}
                                                        comparison={renderComparison(monthlyProfit.totalWorkingDays, previousMonthlyProfit.totalWorkingDays)}
                                                    />
                                                    <DetailRow
                                                        label="총 물량"
                                                        value={`${monthlyProfit.totalVolume.toLocaleString()} 건`}
                                                        comparison={renderComparison(monthlyProfit.totalVolume, previousMonthlyProfit.totalVolume)}
                                                    />
                                                    <DetailRow
                                                        label="총 프레시백"
                                                        value={`${monthlyProfit.totalFreshBag.toLocaleString()} 개`}
                                                        comparison={renderComparison(monthlyProfit.totalFreshBag, previousMonthlyProfit.totalFreshBag)}
                                                    />
                                                    <DetailRow
                                                        label="일 평균 물량"
                                                        value={`${Math.round(monthlyProfit.dailyAverageVolume)} 건`}
                                                        comparison={renderComparison(Math.round(monthlyProfit.dailyAverageVolume), Math.round(previousMonthlyProfit.dailyAverageVolume))}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeContentTab === 'dataEntry' && (
                                <div 
        className={`p-4 sm:p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
                                    {/* 입력 / 데이터 탭 버튼 (중앙 정렬 적용) */}
                                    <div className="flex justify-center border-b mb-4">
                                        <button
                                            onClick={() => setActiveDataTab('entry')}
                                            className={`py-2 px-4 font-semibold ${activeDataTab === 'entry' ? (isDarkMode ? 'border-amber-400 text-amber-400' : 'border-amber-600 text-amber-700') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}
                                        >
                                            입력
                                        </button>
                                        <button
                                            onClick={() => setActiveDataTab('list')}
                                            className={`py-2 px-4 font-semibold ${activeDataTab === 'list' ? (isDarkMode ? 'border-amber-400 text-amber-400' : 'border-amber-600 text-amber-700') : (isDarkMode ? 'border-transparent text-gray-400' : 'border-transparent text-gray-500')} border-b-2`}
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

                                    {/* '데이터' 탭일 때 새로운 EntriesList를 보여줍니다. */}
                                    {activeDataTab === 'list' && (
                                        <EntriesList
                                            entries={finalFilteredEntries} // 👈 수정: 필터링된 최종 데이터 전달
                                            summary={{
                                                // 👇 수정: 필터링된 데이터를 기반으로 요약 정보 다시 계산
                                                totalRevenue: finalFilteredEntries.reduce((sum, entry) => sum + (entry.unitPrice * entry.deliveryCount) + (entry.unitPrice * entry.returnCount) + (entry.unitPrice * (entry.deliveryInterruptionAmount || 0)) + ((entry.freshBagCount || 0) * 100), 0),
                                                totalExpenses: finalFilteredEntries.reduce((sum, entry) => sum + (entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0), 0),
                                                entryNetProfit: Object.fromEntries(
                                                    finalFilteredEntries.map(entry => [
                                                        entry.id,
                                                        ((entry.unitPrice * entry.deliveryCount) + (entry.unitPrice * entry.returnCount) + (entry.unitPrice * (entry.deliveryInterruptionAmount || 0)) + ((entry.freshBagCount || 0) * 100)) - 
                                                        ((entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0))
                                                    ])
                                                ),
                                                // 👇 추가: 필터 버튼 텍스트를 위한 라벨
                                                filterLabel: (() => {
                                                    if (filters.period === '1m') return '최근 1개월';
                                                    if (filters.period === '3m') return '최근 3개월';
                                                    if (filters.period === '6m') return '최근 6개월';
                                                    if (filters.period === 'thisYear') return '올해'; // 👈 '올해' 추가
                                                    if (filters.period === 'lastYear') return '작년'; // 👈 '작년' 추가
                                                    if (filters.period === 'custom' && filters.startDate && filters.endDate) return `${filters.startDate} ~ ${filters.endDate}`;
                                                    return '전체';
                                                })()
                                            }}
                                            handleEdit={handleEdit}
                                            handleDelete={handleDelete}
                                            isDarkMode={isDarkMode}
                                            onOpenFilter={() => setIsFilterModalOpen(true)} // 👈 추가: 필터 팝업 여는 기능 전달
                                            filterType={filters.type}
                                        />
                                    )}
                                </div>
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
                                        yearlyPeriod={yearlyPeriod} // ✨ 여기에 추가
                                        cumulativePeriod={cumulativePeriod}

                                    />
                                )}
                                {/* 👇 랭킹 화면을 보여주는 로직 추가 */}
                                    {activeContentTab === 'rankingView' && (
                                        <div className={`p-4 sm:p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                            <RankingView dailySteps={dailySteps} isDarkMode={isDarkMode} />
                                        </div>
                                    )}
                                    
                                    {/* --- 👇 '더보기' 탭의 새로운 렌더링 로직 --- */}
                                    {activeContentTab === 'adminSettings' && (
                                        <div className={`p-4 sm:p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
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
                                                        handleImportCsv={(e) => {
                                                            setLoadingMessage('데이터를 복원하는 중...'); // 로딩 메시지 설정
                                                            importDataFromCsv(e.target.files[0], db, appId, userId, showMessage, setIsLoading); // setIsLoading 전달
                                                        }}
                                                        handleDeleteAllData={() => {
                                                            showConfirmation(
                                                                "정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.",
                                                                () => {
                                                                    setLoadingMessage('모든 데이터를 삭제하는 중...'); // 로딩 메시지 설정
                                                                    deleteAllData(db, appId, userId, showMessage, setIsLoading); // setIsLoading 전달
                                                                }
                                                            );
                                                        }} 
                                                    />
                                                )}

                                                {moreSubView === 'userGuide' && ( <UserGuideView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} /> )}
                                                {moreSubView === 'legalInfo' && ( <LegalInfoView onBack={() => setMoreSubView('main')} onNavigate={setMoreSubView} isDarkMode={isDarkMode} /> )}
                                                {moreSubView === 'privacyPolicy' && ( <PrivacyPolicy onBack={() => setMoreSubView('legalInfo')} isDarkMode={isDarkMode} /> )}
                                                {moreSubView === 'openSource' && ( <OpenSourceLicenses onBack={() => setMoreSubView('legalInfo')} isDarkMode={isDarkMode} /> )}
                                                {moreSubView === 'announcements' && ( <AnnouncementsView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} /> )} 
                                                {moreSubView === 'contact' && ( <ContactView onBack={() => setMoreSubView('main')} isDarkMode={isDarkMode} /> )}
                                            </>
                                        </div>
                                    )}
                                </
                            >
                        )}
                    </div>

{/* 홈 상세정보 화면에만 보이는 데이터 기록 바로가기 버튼 */}
{activeContentTab === 'monthlyProfit' && showMonthlyDetails && (
    <button
        onClick={handleNavigateToDataEntry}
        className="fixed bottom-28 right-6 z-40 p-4 transition-transform hover:scale-150"
        aria-label="데이터 기록하기"
    >
        <Plus 
            size={36} 
            className={`${isDarkMode ? 'text-gray-200' : 'text-black'}`} 
        />
    </button>
)}

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
                                className={`flex flex-col items-center text-sm font-medium px-2 py-1 rounded-md transition duration-150 ease-in-out ${selectedMainTab === 'ranking' ? (isDarkMode ? 'text-blue-400 bg-gray-700' : 'text-blue-600 bg-blue-50') : (isDarkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800')}`}
                                onClick={() => { setSelectedMainTab('ranking'); setActiveContentTab('rankingView'); }}
                            >
                                <BarChart2 size={24} />
                                <span>랭킹</span>
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
                    <FilterModal
                        isOpen={isFilterModalOpen}
                        onClose={() => setIsFilterModalOpen(false)}
                        onApply={handleApplyFilters}
                        initialFilters={filters}
                        isDarkMode={isDarkMode}
                    />


                    {/* ✨ 로딩 팝업 UI ✨ */}
                    {isLoading && (
                        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex flex-col items-center justify-center z-[99]">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mb-4"></div>
                            <p className="text-white text-xl font-semibold">{loadingMessage}</p>
                        </div>
                    )}

                    {/* Custom Modal for messages */}

                    {modalState.isOpen && (
                        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
                            <div className={`p-6 rounded-lg shadow-xl max-w-sm w-full text-center ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`}>

                                {modalState.type === 'confirm' && (
                                    <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
                                )}

                                <p className="text-lg font-semibold mb-4 whitespace-pre-wrap">{modalState.content}</p>

                                {modalState.type === 'info' ? (
                                    <button
                                        onClick={closeModal}
                                        className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none"
                                    >
                                        확인
                                    </button>
                                ) : (
                                    <div className="flex justify-center space-x-4">
                                        <button
                                            onClick={closeModal}
                                            className={`py-2 px-6 rounded-md focus:outline-none ${isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'}`}
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={handleConfirm}
                                            className="bg-red-600 text-white py-2 px-6 rounded-md hover:bg-red-700 focus:outline-none"
                                        >
                                            삭제
                                        </button>
                                    </div>
                                )}
                                </div>
                        </div>
                    )}
                </div>
            );
        }
export default App