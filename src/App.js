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

//더보기제어
import MoreView from './components/more/MoreView';
import AccountView from './components/more/AccountView';
import UnitPriceView from './components/more/UnitPriceView';
import PeriodView from './components/more/PeriodView';
import DataSettingsView from './components/more/DataSettingsView';


function App() {
    const [userId, setUserId] = useState(null);
    const dateInputRef = useRef(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false); // 다크 모드 상태 추가

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
    const [modalContent, setModalContent] = useState('');
    const [entryToEdit, setEntryToEdit] = useState(null);
    
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

    // 월별 수익 탭의 캘린더 관련 상태
    const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date()); // 캘린더에 표시될 현재 날짜 (월 이동용)
    const [showMonthlyDetails, setShowMonthlyDetails] = useState(false); // 월별 상세 내역 표시 여부

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
    const showMessage = (msg) => {
        setModalContent(msg);
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
    const calculateMonthlyProfit = useCallback(() => {
        const [year, month] = selectedMonth.split('-').map(Number); // month is 1-indexed

        // 월별 집계 기간의 종료일 (선택된 월의 endDay)
        const periodEndDate = new Date(year, month - 1, monthlyEndDay); // month - 1 because Date month is 0-indexed

        // 월별 집계 기간의 시작일
        let periodStartDate;
        if (monthlyStartDay <= monthlyEndDay) {
            // 시작일이 종료일보다 작거나 같으면 같은 달 내에서 기간 설정
            periodStartDate = new Date(year, month - 1, monthlyStartDay);
        } else {
            // 시작일이 종료일보다 크면 이전 달에서 시작 (예: 26일 ~ 다음 달 25일)
            periodStartDate = new Date(year, month - 2, monthlyStartDay); // month - 2 for previous month
        }

        const formattedPeriodStartDate = formatDate(periodStartDate);
        const formattedPeriodEndDate = formatDate(periodEndDate);

        // userId가 없는 경우, filteredEntries를 빈 배열로 설정하여 계산에서 제외
        const filteredEntries = userId ? entries.filter(entry => {
            // entry.date가 시작일과 종료일 사이에 있는지 확인
            return entry.date >= formattedPeriodStartDate && entry.date <= formattedPeriodEndDate;
        }) : [];


        let totalDeliveryRevenue = 0;
        let totalReturnRevenue = 0;
        let totalFreshBagRevenue = 0;
        let totalDeliveryInterruptionRevenue = 0; // 배송중단 수익 합계 추가
        let totalPenaltyCost = 0;
        let totalIndustrialAccidentCost = 0;
        let totalFuelCost = 0;
        let totalMaintenanceCost = 0;
        let totalVatAmount = 0;
        let totalIncomeTaxAmount = 0;
        let totalTaxAccountantFee = 0;

        // 일별 수익/지출을 저장할 객체
        const dailyBreakdown = {};

        const uniqueDatesMonthly = new Set();

        filteredEntries.forEach(entry => {
            // 매출이 발생한 날짜를 근무일로 간주
            if (entry.deliveryCount > 0 || entry.returnCount > 0 || entry.freshBagCount > 0 || entry.deliveryInterruptionAmount > 0 || entry.penaltyAmount > 0 || entry.industrialAccidentCost > 0 || entry.fuelCost > 0 || entry.maintenanceCost > 0 || entry.vatAmount > 0 || entry.incomeTaxAmount > 0 || entry.taxAccountantFee > 0) {
                uniqueDatesMonthly.add(entry.date);
            }

            // 배송중단 금액에 단가 적용
            const deliveryInterruptionCalculated = (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0);
            const dailyRevenue = (entry.unitPrice * entry.deliveryCount) + (entry.unitPrice * entry.returnCount) + deliveryInterruptionCalculated + ((entry.freshBagCount || 0) * 100);
            const dailyExpenses = (entry.penaltyAmount || 0) + (entry.industrialAccidentCost || 0) + (entry.fuelCost || 0) + (entry.maintenanceCost || 0) + (entry.vatAmount || 0) + (entry.incomeTaxAmount || 0) + (entry.taxAccountantFee || 0);
            
            if (!dailyBreakdown[entry.date]) {
                dailyBreakdown[entry.date] = { revenue: 0, expenses: 0 };
            }
            dailyBreakdown[entry.date].revenue += dailyRevenue;
            dailyBreakdown[entry.date].expenses += dailyExpenses;

            totalDeliveryRevenue += entry.unitPrice * entry.deliveryCount;
            totalReturnRevenue += entry.unitPrice * entry.returnCount;
            totalDeliveryInterruptionRevenue += deliveryInterruptionCalculated; // 배송중단 수익 합계
            totalFreshBagRevenue += (entry.freshBagCount || 0) * 100; // 프레시백 단가를 100원으로 가정, 값이 없으면 0으로 처리
            totalPenaltyCost += (entry.penaltyAmount || 0);
            totalIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
            totalFuelCost += (entry.fuelCost || 0);
            totalMaintenanceCost += (entry.maintenanceCost || 0);
            totalVatAmount += (entry.vatAmount || 0);
            totalIncomeTaxAmount += (entry.incomeTaxAmount || 0);
            totalTaxAccountantFee += (entry.taxAccountantFee || 0);
        });

        // netProfit 계산 시 totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue를 더하고 totalTaxAccountantFee를 뺌
        const netProfit = totalDeliveryRevenue + totalReturnRevenue + totalFreshBagRevenue + totalDeliveryInterruptionRevenue - totalPenaltyCost - totalIndustrialAccidentCost - totalFuelCost - totalMaintenanceCost - totalVatAmount - totalIncomeTaxAmount - totalTaxAccountantFee;
        
        // 총 물량 (배송 + 반품) - 배송중단은 물량으로 합산하지 않음
        const totalVolume = filteredEntries.reduce((sum, entry) => sum + (entry.deliveryCount || 0) + (entry.returnCount || 0), 0);
        // 총 프레시백
        const totalFreshBag = filteredEntries.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
        // 총 근무일
        const totalWorkingDays = uniqueDatesMonthly.size;
        // 일평균 물량
        const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;
        // 총 지출 (모든 지출 항목 합계)
        const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;

        return {
            totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue,
            totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee,
            netProfit, periodStartDate, periodEndDate, dailyBreakdown,
            totalVolume, totalExpensesSum, totalFreshBag, totalWorkingDays, dailyAverageVolume
        };
    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, userId]); // userId 의존성 추가

    // 연간 수익 계산
    const calculateYearlyProfit = useCallback(() => {
        const year = parseInt(selectedYear);
        let totalDeliveryRevenue = 0;
        let totalReturnRevenue = 0;
        let totalFreshBagRevenue = 0;
        let totalDeliveryInterruptionRevenue = 0; // 연간 배송중단 수익 합계 추가
        let totalPenaltyCost = 0;
        let totalIndustrialAccidentCost = 0;
        let totalFuelCost = 0;
        let totalMaintenanceCost = 0;
        let totalVatAmount = 0;
        let totalIncomeTaxAmount = 0;
        let totalTaxAccountantFee = 0;
        let yearlyNetProfit = 0;
        const monthlyBreakdown = [];

        // 연간 집계의 전체 시작일과 종료일 계산
        let overallYearlyStartDate;
        let overallYearlyEndDate;

        // Determine the start date of the first period in the year
        if (monthlyStartDay <= monthlyEndDay) {
            overallYearlyStartDate = new Date(year, 0, monthlyStartDay);
        } else {
            overallYearlyStartDate = new Date(year - 1, 11, monthlyStartDay);
        }

        // Determine the end date of the last period in the year
        if (monthlyEndDay >= monthlyStartDay) {
            overallYearlyEndDate = new Date(year, 11, monthlyEndDay);
        } else {
            overallYearlyEndDate = new Date(year + 1, 0, monthlyEndDay);
        }

        const uniqueDatesYearly = new Set();

        // userId가 없는 경우, filteredEntriesForYear를 빈 배열로 설정하여 계산에서 제외
        const filteredEntriesForYear = userId ? entries.filter(entry => new Date(entry.date).getFullYear() === year) : [];


        for (let month = 1; month <= 12; month++) {
            // 각 월의 집계 기간 계산
            const periodEndDate = new Date(year, month - 1, monthlyEndDay);
            let periodStartDate;
            if (monthlyStartDay <= monthlyEndDay) {
                periodStartDate = new Date(year, month - 1, monthlyStartDay);
            } else {
                periodStartDate = new Date(year, month - 2, monthlyStartDay);
            }

            const formattedPeriodStartDate = formatDate(periodStartDate);
            const formattedPeriodEndDate = formatDate(periodEndDate);

            const filteredEntriesForMonth = filteredEntriesForYear.filter(entry => {
                return entry.date >= formattedPeriodStartDate && entry.date <= formattedPeriodEndDate;
            });

            let monthNetProfit = 0;
            let monthDeliveryRevenue = 0;
            let monthReturnRevenue = 0;
            let monthFreshBagRevenue = 0;
            let monthDeliveryInterruptionRevenue = 0; // 월별 배송중단 수익 합계 추가
            let monthPenaltyCost = 0;
            let monthIndustrialAccidentCost = 0;
            let monthFuelCost = 0;
            let monthMaintenanceCost = 0;
            let monthVatAmount = 0;
            let monthIncomeTaxAmount = 0;
            let monthTaxAccountantFee = 0;

            filteredEntriesForMonth.forEach(entry => {
                // 매출이 발생한 날짜를 근무일로 간주
                if (entry.deliveryCount > 0 || entry.returnCount > 0 || entry.freshBagCount > 0 || entry.deliveryInterruptionAmount > 0 || entry.penaltyAmount > 0 || entry.industrialAccidentCost > 0 || entry.fuelCost > 0 || entry.maintenanceCost > 0 || entry.vatAmount > 0 || entry.incomeTaxAmount > 0 || entry.taxAccountantFee > 0) {
                    uniqueDatesYearly.add(entry.date);
                }

                monthDeliveryRevenue += entry.unitPrice * entry.deliveryCount;
                monthReturnRevenue += entry.unitPrice * entry.returnCount;
                monthDeliveryInterruptionRevenue += (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0); // 월별 배송중단 수익 합계
                monthFreshBagRevenue += (entry.freshBagCount || 0) * 100;
                monthPenaltyCost += (entry.penaltyAmount || 0);
                monthIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
                monthFuelCost += (entry.fuelCost || 0);
                monthMaintenanceCost += (entry.maintenanceCost || 0);
                monthVatAmount += (entry.vatAmount || 0);
                monthIncomeTaxAmount += (entry.incomeTaxAmount || 0);
                monthTaxAccountantFee += (entry.taxAccountantFee || 0);
            });

            // netProfit 계산 시 monthReturnRevenue, monthFreshBagRevenue, monthDeliveryInterruptionRevenue를 더하고 monthTaxAccountantFee를 뺌
            monthNetProfit = monthDeliveryRevenue + monthReturnRevenue + monthFreshBagRevenue + monthDeliveryInterruptionRevenue - monthPenaltyCost - monthIndustrialAccidentCost - monthFuelCost - monthMaintenanceCost - monthVatAmount - monthIncomeTaxAmount - monthTaxAccountantFee;
            yearlyNetProfit += monthNetProfit;

            totalDeliveryRevenue += monthDeliveryRevenue;
            totalReturnRevenue += monthReturnRevenue;
            totalFreshBagRevenue += monthFreshBagRevenue;
            totalDeliveryInterruptionRevenue += monthDeliveryInterruptionRevenue; // 연간 배송중단 수익 합계
            totalPenaltyCost += monthPenaltyCost;
            totalIndustrialAccidentCost += monthIndustrialAccidentCost;
            totalFuelCost += monthFuelCost;
            totalMaintenanceCost += monthMaintenanceCost;
            totalVatAmount += monthVatAmount;
            totalIncomeTaxAmount += monthIncomeTaxAmount;
            totalTaxAccountantFee += monthTaxAccountantFee;

            monthlyBreakdown.push({
                month: month,
                netProfit: monthNetProfit,
                periodStart: formattedPeriodStartDate,
                periodEnd: formattedPeriodEndDate
            });
        }
        
        // 총 물량 (배송 + 반품) - 배송중단은 물량으로 합산하지 않음
        const totalVolume = filteredEntriesForYear.reduce((sum, entry) => sum + (entry.deliveryCount || 0) + (entry.returnCount || 0), 0);
        // 총 프레시백
        const totalFreshBag = filteredEntriesForYear.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
        // 총 근무일
        const totalWorkingDays = uniqueDatesYearly.size;
        // 일평균 물량
        const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;
        // 총 지출 (모든 지출 항목 합계)
        const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;


        return {
            totalDeliveryRevenue,
            totalReturnRevenue,
            totalFreshBagRevenue,
            totalDeliveryInterruptionRevenue, // 연간 배송중단 수익 포함
            totalPenaltyCost,
            totalIndustrialAccidentCost,
            totalFuelCost,
            totalMaintenanceCost,
            totalVatAmount,
            totalIncomeTaxAmount,
            totalTaxAccountantFee,
            netProfit: yearlyNetProfit,
            monthlyBreakdown,
            overallYearlyStartDate: formatDate(overallYearlyStartDate),
            overallYearlyEndDate: formatDate(overallYearlyEndDate),
            totalVolume, totalExpensesSum, totalFreshBag, totalWorkingDays, dailyAverageVolume
        };
    }, [entries, selectedYear, monthlyStartDay, monthlyEndDay, userId]); // userId 의존성 추가

    // 누적 수익 계산
    const calculateCumulativeProfit = useCallback(() => {
        let totalDeliveryRevenue = 0;
        let totalReturnRevenue = 0;
        let totalFreshBagRevenue = 0;
        let totalDeliveryInterruptionRevenue = 0;
        let totalPenaltyCost = 0;
        let totalIndustrialAccidentCost = 0;
        let totalFuelCost = 0;
        let totalMaintenanceCost = 0;
        let totalVatAmount = 0;
        let totalIncomeTaxAmount = 0;
        let totalTaxAccountantFee = 0;

        const uniqueDatesCumulative = new Set();

        // userId가 없는 경우, entries를 빈 배열로 설정하여 계산에서 제외
        const entriesForCumulative = userId ? entries : [];

        entriesForCumulative.forEach(entry => {
            // 매출이 발생한 날짜를 근무일로 간주
            if (entry.deliveryCount > 0 || entry.returnCount > 0 || entry.freshBagCount > 0 || entry.deliveryInterruptionAmount > 0 || entry.penaltyAmount > 0 || entry.industrialAccidentCost > 0 || entry.fuelCost > 0 || entry.maintenanceCost > 0 || entry.vatAmount > 0 || entry.incomeTaxAmount > 0 || entry.taxAccountantFee > 0) {
                uniqueDatesCumulative.add(entry.date);
            }

            const deliveryInterruptionCalculated = (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0);

            totalDeliveryRevenue += entry.unitPrice * entry.deliveryCount;
            totalReturnRevenue += entry.unitPrice * entry.returnCount;
            totalDeliveryInterruptionRevenue += deliveryInterruptionCalculated;
            totalFreshBagRevenue += (entry.freshBagCount || 0) * 100;
            totalPenaltyCost += (entry.penaltyAmount || 0);
            totalIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
            totalFuelCost += (entry.fuelCost || 0);
            totalMaintenanceCost += (entry.maintenanceCost || 0);
            totalVatAmount += (entry.vatAmount || 0);
            totalIncomeTaxAmount += (entry.incomeTaxAmount || 0);
            totalTaxAccountantFee += (entry.taxAccountantFee || 0);
        });

        const netProfit = totalDeliveryRevenue + totalReturnRevenue + totalFreshBagRevenue + totalDeliveryInterruptionRevenue - totalPenaltyCost - totalIndustrialAccidentCost - totalFuelCost - totalMaintenanceCost - totalVatAmount - totalIncomeTaxAmount - totalTaxAccountantFee;
        
        const totalWorkingDays = uniqueDatesCumulative.size;
        const totalVolume = entriesForCumulative.reduce((sum, entry) => sum + (entry.deliveryCount || 0) + (entry.returnCount || 0), 0);
        const totalFreshBag = entriesForCumulative.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
        const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;
        const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;

        return {
            totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue,
            totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee,
            netProfit, totalWorkingDays, totalVolume, totalFreshBag, dailyAverageVolume, totalExpensesSum
        };
    }, [entries, userId]); // userId 의존성 추가

    // Previous Month Profit Calculation
    const calculatePreviousMonthlyProfit = useCallback(() => {
        const [year, month] = selectedMonth.split('-').map(Number); // current month is 1-indexed

        // Calculate previous month's year and month
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear -= 1;
        }

        // Determine the period for the previous month
        const prevPeriodEndDate = new Date(prevYear, prevMonth - 1, monthlyEndDay);
        let prevPeriodStartDate;
        if (monthlyStartDay <= monthlyEndDay) {
            prevPeriodStartDate = new Date(prevYear, prevMonth - 1, monthlyStartDay);
        } else {
            prevPeriodStartDate = new Date(prevYear, prevMonth - 2, monthlyStartDay);
        }

        const formattedPrevPeriodStartDate = formatDate(prevPeriodStartDate);
        const formattedPrevPeriodEndDate = formatDate(prevPeriodEndDate);

        // userId가 없는 경우, filteredEntries를 빈 배열로 설정하여 계산에서 제외
        const filteredEntries = userId ? entries.filter(entry => {
            return entry.date >= formattedPrevPeriodStartDate && entry.date <= formattedPrevPeriodEndDate;
        }) : [];


        let totalDeliveryRevenue = 0;
        let totalReturnRevenue = 0;
        let totalFreshBagRevenue = 0;
        let totalDeliveryInterruptionRevenue = 0;
        let totalPenaltyCost = 0;
        let totalIndustrialAccidentCost = 0;
        let totalFuelCost = 0;
        let totalMaintenanceCost = 0;
        let totalVatAmount = 0;
        let totalIncomeTaxAmount = 0;
        let totalTaxAccountantFee = 0;

        const uniqueDatesPrevMonth = new Set();

        filteredEntries.forEach(entry => {
            if (entry.deliveryCount > 0 || entry.returnCount > 0 || entry.freshBagCount > 0 || entry.deliveryInterruptionAmount > 0 || entry.penaltyAmount > 0 || entry.industrialAccidentCost > 0 || entry.fuelCost > 0 || entry.maintenanceCost > 0 || entry.vatAmount > 0 || entry.incomeTaxAmount > 0 || entry.taxAccountantFee > 0) {
                uniqueDatesPrevMonth.add(entry.date);
            }

            const deliveryInterruptionCalculated = (entry.unitPrice || 0) * (entry.deliveryInterruptionAmount || 0);

            totalDeliveryRevenue += entry.unitPrice * entry.deliveryCount;
            totalReturnRevenue += entry.unitPrice * entry.returnCount;
            totalDeliveryInterruptionRevenue += deliveryInterruptionCalculated;
            totalFreshBagRevenue += (entry.freshBagCount || 0) * 100;
            totalPenaltyCost += (entry.penaltyAmount || 0);
            totalIndustrialAccidentCost += (entry.industrialAccidentCost || 0);
            totalFuelCost += (entry.fuelCost || 0);
            totalMaintenanceCost += (entry.maintenanceCost || 0);
            totalVatAmount += (entry.vatAmount || 0);
            totalIncomeTaxAmount += (entry.incomeTaxAmount || 0);
            totalTaxAccountantFee += (entry.taxAccountantFee || 0);
        });

        const netProfit = totalDeliveryRevenue + totalReturnRevenue + totalFreshBagRevenue + totalDeliveryInterruptionRevenue - totalPenaltyCost - totalIndustrialAccidentCost - totalFuelCost - totalMaintenanceCost - totalVatAmount - totalIncomeTaxAmount - totalTaxAccountantFee;
        
        const totalVolume = filteredEntries.reduce((sum, entry) => sum + (entry.deliveryCount || 0) + (entry.returnCount || 0), 0);
        const totalFreshBag = filteredEntries.reduce((sum, entry) => sum + (entry.freshBagCount || 0), 0);
        const totalWorkingDays = uniqueDatesPrevMonth.size;
        const dailyAverageVolume = totalWorkingDays > 0 ? (totalVolume / totalWorkingDays) : 0;
        const totalExpensesSum = totalPenaltyCost + totalIndustrialAccidentCost + totalFuelCost + totalMaintenanceCost + totalVatAmount + totalIncomeTaxAmount + totalTaxAccountantFee;

        return {
            totalDeliveryRevenue, totalReturnRevenue, totalFreshBagRevenue, totalDeliveryInterruptionRevenue,
            totalPenaltyCost, totalIndustrialAccidentCost, totalFuelCost, totalMaintenanceCost, totalVatAmount, totalIncomeTaxAmount, totalTaxAccountantFee,
            netProfit, totalVolume, totalFreshBag, totalWorkingDays, dailyAverageVolume, totalExpensesSum
        };
    }, [entries, selectedMonth, monthlyStartDay, monthlyEndDay, userId]); // userId 의존성 추가


    const monthlyProfit = calculateMonthlyProfit();
    const yearlyProfit = calculateYearlyProfit();
    const cumulativeProfit = calculateCumulativeProfit();
    const previousMonthlyProfit = calculatePreviousMonthlyProfit(); // 이전 달 데이터 계산

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

    // 데이터 백업 기능 (JSON)
    const handleBackupData = async () => {
        if (!userId) {
            showMessage("로그인해야 데이터를 백업할 수 있습니다.");
            return;
        }
        try {
            const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
            const querySnapshot = await getDocs(entriesCollectionRef);
            const dataToBackup = querySnapshot.docs.map(doc => doc.data());

            const jsonString = JSON.stringify(dataToBackup, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            const today = new Date().toISOString().slice(0, 10);
            a.download = `delivery_data_${today}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showMessage("데이터 백업(JSON)이 완료되었습니다.");
        } catch (error) {
            console.error("Error backing up data:", error);
            showMessage("데이터 백업(JSON)에 실패했습니다.");
        }
    };

    // 데이터 복원 기능 (JSON)
    const handleRestoreData = (event) => {
        if (!userId) {
            showMessage("로그인해야 데이터를 복원할 수 있습니다.");
            return;
        }
        const file = event.target.files[0];
        if (!file) {
            showMessage("복원할 JSON 파일을 선택해주세요.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!Array.isArray(importedData)) {
                    showMessage("유효한 JSON 배열 형식이 아닙니다.");
                    return;
                }

                const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
                for (const item of importedData) {
                    const dataToAdd = { ...item };
                    // Firestore Timestamp 객체 또는 문자열을 Date 객체로 변환
                    if (dataToAdd.timestamp && typeof dataToAdd.timestamp.toDate === 'function') {
                        dataToAdd.timestamp = dataToAdd.timestamp.toDate();
                    } else if (dataToAdd.timestamp && typeof dataToAdd.timestamp === 'object' && dataToAdd.timestamp._seconds) {
                        dataToAdd.timestamp = new Date(dataToAdd.timestamp._seconds * 1000 + (dataToAdd.timestamp._nanoseconds / 1000000));
                    } else if (typeof dataToAdd.timestamp === 'string') {
                        dataToAdd.timestamp = new Date(dataToAdd.timestamp);
                    } else {
                        dataToAdd.timestamp = new Date(); // 기본값 설정
                    }
                    
                    delete dataToAdd.id; // Firestore에서 자동으로 생성하므로 제거

                    await addDoc(entriesCollectionRef, dataToAdd);
                }
                showMessage("데이터 복원(JSON)이 완료되었습니다.");
                event.target.value = null; // 파일 입력 초기화
            } catch (error) {
                console.error("Error restoring data:", error);
                showMessage("데이터 복원(JSON)에 실패했습니다. 파일 형식을 확인해주세요. (예: 헤더, 데이터 형식)");
                event.target.value = null; // 오류 시 파일 입력 초기화
            }
        };
        reader.readAsText(file);
    };

    // CSV 내보내기 기능
    const handleExportCsv = async () => {
        if (!userId) {
            showMessage("로그인해야 데이터를 내보낼 수 있습니다.");
            return;
        }
        try {
            const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
            const querySnapshot = await getDocs(entriesCollectionRef);
            const dataToExport = querySnapshot.docs.map(doc => doc.data());

            if (dataToExport.length === 0) {
                showMessage("내보낼 데이터가 없습니다.");
                return;
            }

            // CSV 헤더 정의 (한국어)
            const headers = [
                "날짜", "단가", "배송 수량", "반품 수량", "배송중단", "프레시백 수량",
                "패널티", "산재", "유류비", "유지보수비", "부가세", "종합소득세", "세무사 비용", "타임스탬프"
            ];

            // 데이터 매핑 및 CSV 행 생성
            const csvRows = dataToExport.map(entry => {
                return [
                    entry.date,
                    entry.unitPrice || 0,
                    entry.deliveryCount || 0,
                    entry.returnCount || 0,
                    entry.deliveryInterruptionAmount || 0,
                    entry.freshBagCount || 0,
                    entry.penaltyAmount || 0,
                    entry.industrialAccidentCost || 0,
                    entry.fuelCost || 0,
                    entry.maintenanceCost || 0,
                    entry.vatAmount || 0,
                    entry.incomeTaxAmount || 0,
                    entry.taxAccountantFee || 0,
                    entry.timestamp ? new Date(entry.timestamp.seconds * 1000).toISOString() : '' // Firestore Timestamp를 ISO 문자열로 변환
                ].map(value => {
                    // 기본적인 CSV 이스케이프: 쉼표나 큰따옴표가 포함된 경우 큰따옴표로 묶고, 큰따옴표는 두 번 반복
                    let stringValue = String(value);
                    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                        stringValue = `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                }).join(',');
            });

            const csvString = [headers.join(','), ...csvRows].join('\n');
            
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            const today = new Date().toISOString().slice(0, 10);
            a.download = `delivery_data_${today}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showMessage("데이터 내보내기(CSV)가 완료되었습니다.");
        } catch (error) {
            console.error("Error exporting data:", error);
            showMessage("데이터 내보내기(CSV)에 실패했습니다.");
        }
    };

    // CSV 가져오기 기능
    const handleImportCsv = (event) => {
        if (!userId) {
            showMessage("로그인해야 데이터를 가져올 수 있습니다.");
            return;
        }
        const file = event.target.files[0];
        if (!file) {
            showMessage("가져올 CSV 파일을 선택해주세요.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const csvText = e.target.result;
                const lines = csvText.split('\n').filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    showMessage("유효한 CSV 파일 형식이 아닙니다 (헤더와 최소 한 줄의 데이터 필요).");
                    return;
                }

                const headers = lines[0].split(',').map(h => h.trim());
                const dataToImport = [];

                for (let i = 1; i < lines.length; i++) {
                    // 기본적인 CSV 파싱 (쉼표로 분리, 큰따옴표 처리)
                    // 이스케이프된 쉼표를 처리하기 위해 정규식을 사용하거나 더 견고한 파서를 사용해야 할 수 있습니다.
                    // 여기서는 간단한 split으로 처리하며, 복잡한 CSV에는 한계가 있을 수 있습니다.
                    const values = lines[i].match(/(".*?"|[^",]+)(,|$)/g).map(val => {
                        val = val.endsWith(',') ? val.slice(0, -1) : val; // 마지막 쉼표 제거
                        if (val.startsWith('"') && val.endsWith('"')) {
                            return val.substring(1, val.length - 1).replace(/""/g, '"');
                        }
                        return val;
                    });

                    const entry = {};
                    headers.forEach((header, index) => {
                        let value = values[index];
                        
                        // CSV 헤더를 Firestore 필드 이름으로 매핑 (한국어 -> 영어)
                        switch(header) {
                            case "날짜": entry.date = value; break;
                            case "단가": entry.unitPrice = parseFloat(value) || 0; break;
                            case "배송 수량": entry.deliveryCount = parseInt(value) || 0; break;
                            case "반품 수량": entry.returnCount = parseInt(value) || 0; break;
                            case "배송중단": entry.deliveryInterruptionAmount = parseFloat(value) || 0; break;
                            case "프레시백 수량": entry.freshBagCount = parseInt(value) || 0; break;
                            case "패널티": entry.penaltyAmount = parseFloat(value) || 0; break;
                            case "산재": entry.industrialAccidentCost = parseFloat(value) || 0; break;
                            case "유류비": entry.fuelCost = parseFloat(value) || 0; break;
                            case "유지보수비": entry.maintenanceCost = parseFloat(value) || 0; break;
                            case "부가세": entry.vatAmount = parseFloat(value) || 0; break;
                            case "종합소득세": entry.incomeTaxAmount = parseFloat(value) || 0; break;
                            case "세무사 비용": entry.taxAccountantFee = parseFloat(value) || 0; break;
                            case "타임스탬프": entry.timestamp = value ? new Date(value) : new Date(); break;
                            default: break;
                        }
                    });
                    // 타임스탬프가 없으면 현재 시간으로 설정
                    if (!entry.timestamp) {
                        entry.timestamp = new Date();
                    }
                    dataToImport.push(entry);
                }

                const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
                for (const item of dataToImport) {
                    await addDoc(entriesCollectionRef, item);
                }
                showMessage("데이터 복원(JSON)이 완료되었습니다.");
                event.target.value = null; // 파일 입력 초기화
            } catch (error) {
                console.error("Error restoring data:", error);
                showMessage("데이터 복원(JSON)에 실패했습니다. 파일 형식을 확인해주세요. (예: 헤더, 데이터 형식)");
                event.target.value = null; // 오류 시 파일 입력 초기화
            }
        };
        reader.readAsText(file);
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
    <div className={`min-h-screen p-4 font-sans flex flex-col items-center ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-800'} pb-20`}>
    
    
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
            <div className={`p-6 rounded-lg shadow-md w-full max-w-4xl mb-6 relative ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h1 className="text-3xl font-bold text-center mb-6">
                  {activeContentTab === 'dataEntry' ? '입출금' : '배송 수익 추적기'}
</h1>
                {/* 다크 모드 토글 버튼은 로그인 여부와 관계없이 항상 표시 */}
                <button
                    onClick={toggleDarkMode}
                    className={`absolute top-4 right-4 p-2 rounded-full ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} transition duration-150 ease-in-out`}
                    title={isDarkMode ? "밝은 모드로 전환" : "다크 모드로 전환"}
                >
                    {isDarkMode ? <Sun size={24} className="text-yellow-400" /> : <Moon size={24} className="text-gray-700" />}
                </button>

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
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                <p className="md:col-span-2">
                    <strong>집계 기간:</strong> {monthlyProfit.periodStartDate ? new Date(monthlyProfit.periodStartDate).toLocaleDateString('ko-KR') : ''} ~ {monthlyProfit.periodEndDate ? new Date(monthlyProfit.periodEndDate).toLocaleDateString('ko-KR') : ''}
                </p>
                <div className={`p-4 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} cursor-pointer`} onClick={() => { setMonthlyStatsSubTab('revenue'); setSelectedMainTab('statistics'); setActiveContentTab('statistics'); setStatisticsView('monthly'); }}>
                    <p className="text-lg font-semibold">총 수익: {(monthlyProfit.totalDeliveryRevenue + monthlyProfit.totalReturnRevenue + monthlyProfit.totalFreshBagRevenue + monthlyProfit.totalDeliveryInterruptionRevenue).toLocaleString()} 원</p>
                    <p className="text-sm text-gray-500">클릭하여 상세 보기</p>
                </div>
                <div className={`p-4 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} cursor-pointer`} onClick={() => { setMonthlyStatsSubTab('expenses'); setSelectedMainTab('statistics'); setActiveContentTab('statistics'); setStatisticsView('monthly'); }}>
                    <p className="text-lg font-semibold">총 지출: {monthlyProfit.totalExpensesSum.toLocaleString()} 원</p>
                    <p className="text-sm text-gray-500">클릭하여 상세 보기</p>
                </div>
                <p className="md:col-span-2 text-lg font-semibold"><strong>월 순이익:</strong> {monthlyProfit.netProfit.toLocaleString()} 원</p>
            </div>
        )}
    </>
)}
                        {activeContentTab === 'dataEntry' && ( // 이제 userId 조건 없음
                            <>
                               <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    {/* 새로운 날짜 선택기 UI */}
                                    <div className={`md:col-span-2 p-1 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-pink-100'}`}>
                                        <div className="flex items-center justify-center space-x-3">
                                            <button type="button" onClick={() => handleDateChange(-1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-pink-200'}`}>
                                                <ChevronLeft size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                                            </button>
                                            <span
                                                onClick={() => dateInputRef.current?.showPicker()}
                                                className={`font-bold text-lg cursor-pointer select-none ${isDarkMode ? 'text-pink-300' : 'text-pink-700'}`}
                                            >
                                                {date}
                                            </span>
                                            <button type="button" onClick={() => handleDateChange(1)} className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-pink-200'}`}>
                                                <ChevronRight size={20} className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                                            </button>
                                            {/* 실제 날짜 값을 다루고, 달력을 띄우기 위한 숨겨진 입력창 */}
                                            <input
                                                ref={dateInputRef}
                                                type="date"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                className="opacity-0 w-0 h-0 absolute"
                                                required
                                            />
                                        </div>
                                    </div>
                                   
                                    {/* 수익/지출 선택 버튼 */}
                                    <div className="md:col-span-2 flex justify-center space-x-4 my-4">
                                        <button
                                            type="button"
                                            onClick={() => setFormType('income')}
                                            className={`py-2 px-6 rounded-md font-semibold transition-colors duration-200 ${
                                                formType === 'income' 
                                                ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-red-500 text-white')
                                                : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
                                            }`}
                                        >
                                            수익
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormType('expense')}
                                            className={`py-2 px-6 rounded-md font-semibold transition-colors duration-200 ${
                                                formType === 'expense' 
                                                ? (isDarkMode ? 'bg-red-600 text-white' : 'bg-blue-500 text-white')
                                                : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
                                            }`}
                                        >
                                            지출
                                        </button>
                                    </div>


                               {/* 수익 입력 필드 */}
                                    {formType === 'income' && (
                                        <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                            {/* '단가' 입력란이 이곳으로 이동했습니다. */}
                                            <div className="col-span-2">
                                                <label htmlFor="unitPrice" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>단가 (원)</label>
                                                <input
                                                    type="number"
                                                    id="unitPrice"
                                                    value={unitPrice}
                                                    onChange={(e) => setUnitPrice(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                    step="0.01"
                                                />
                                                <div className="mt-2 flex space-x-2">
                                                    {favoriteUnitPrices.map((price) => (
                                                        <button
                                                            key={price}
                                                            type="button"
                                                            onClick={() => setUnitPrice(price.toString())}
                                                            className={`${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} text-xs py-1 px-3 rounded-full transition duration-150 ease-in-out`}
                                                        >
                                                            {price.toLocaleString()}원
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label htmlFor="deliveryCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>배송 수량</label>
                                                <input
                                                    type="number"
                                                    id="deliveryCount"
                                                    value={deliveryCount}
                                                    onChange={(e) => setDeliveryCount(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="returnCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>반품 수량</label>
                                                <input
                                                    type="number"
                                                    id="returnCount"
                                                    value={returnCount}
                                                    onChange={(e) => setReturnCount(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="deliveryInterruptionAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>배송중단</label>
                                                <input
                                                    type="number"
                                                    id="deliveryInterruptionAmount"
                                                    value={deliveryInterruptionAmount}
                                                    onChange={(e) => setDeliveryInterruptionAmount(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                    step="0.01"
                                                    placeholder="원, 선택 사항"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="freshBagCount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>프레시백 수량</label>
                                                <input
                                                    type="number"
                                                    id="freshBagCount"
                                                    value={freshBagCount}
                                                    onChange={(e) => setFreshBagCount(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                    placeholder="선택 사항"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* 지출 입력 필드 */}
                                    {formType === 'expense' && (
                                        <div className="md:col-span-2 grid grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <label htmlFor="penaltyAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>패널티</label>
                                                <input
                                                    type="number"
                                                    id="penaltyAmount"
                                                    value={penaltyAmount}
                                                    onChange={(e) => setPenaltyAmount(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                    step="0.01"
                                                    placeholder="원, 지출"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="industrialAccidentCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>산재</label>
                                                <input
                                                    type="number"
                                                    id="industrialAccidentCost"
                                                    value={industrialAccidentCost}
                                                    onChange={(e) => setIndustrialAccidentCost(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                    step="0.01"
                                                    placeholder="원, 선택 사항"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="fuelCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>유류비</label>
                                                <input
                                                    type="number"
                                                    id="fuelCost"
                                                    value={fuelCost}
                                                    onChange={(e) => setFuelCost(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                    step="0.01"
                                                    placeholder="원, 선택 사항"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="maintenanceCost" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>유지보수비</label>
                                                <input
                                                    type="number"
                                                    id="maintenanceCost"
                                                    value={maintenanceCost}
                                                    onChange={(e) => setMaintenanceCost(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                    step="0.01"
                                                    placeholder="원, 선택 사항"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="vatAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>부가세</label>
                                                <input
                                                    type="number"
                                                    id="vatAmount"
                                                    value={vatAmount}
                                                    onChange={(e) => setVatAmount(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                    step="0.01"
                                                    placeholder="원, 선택 사항"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="incomeTaxAmount" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>종합소득세</label>
                                                <input
                                                    type="number"
                                                    id="incomeTaxAmount"
                                                    value={incomeTaxAmount}
                                                    onChange={(e) => setIncomeTaxAmount(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                    step="0.01"
                                                    placeholder="원, 선택 사항"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label htmlFor="taxAccountantFee" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>세무사 비용</label>
                                                <input
                                                    type="number"
                                                    id="taxAccountantFee"
                                                    value={taxAccountantFee}
                                                    onChange={(e) => setTaxAccountantFee(e.target.value)}
                                                    className={`mt-1 block w-full p-2 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-white text-gray-800'} rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500`}
                                                    step="0.01"
                                                    placeholder="원, 선택 사항"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="md:col-span-2 mt-4">
                                        <button
                                            type="submit"
                                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out"
                                        >
                                            {entryToEdit ? '수정' : '저장'}
                                        </button>
                                    </div>
                                </form>


                                <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>입력된 데이터</h2>
                                <div className="overflow-x-auto">
                                    <table className={`min-w-full rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                        <thead>
                                            <tr className={`${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-600'} uppercase text-sm leading-normal`}>
                                                <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('date')}>
                                                    날짜
                                                    {sortColumn === 'date' && (sortDirection === 'asc' ? <ArrowUp size={16} className="inline ml-1" /> : <ArrowDown size={16} className="inline ml-1" />)}
                                                </th>
                                                <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('unitPrice')}>
                                                    단가
                                                    {sortColumn === 'unitPrice' && (sortDirection === 'asc' ? <ArrowUp size={16} className="inline ml-1" /> : <ArrowDown size={16} className="inline ml-1" />)}
                                                </th>
                                                <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('deliveryCount')}>
                                                    배송
                                                    {sortColumn === 'deliveryCount' && (sortDirection === 'asc' ? <ArrowUp size={16} className="inline ml-1" /> : <ArrowDown size={16} className="inline ml-1" />)}
                                                </th>
                                                <th className="py-3 px-6 text-left cursor-pointer" onClick={() => handleSort('returnCount')}>
                                                    반품
                                                    {sortColumn === 'returnCount' && (sortDirection === 'asc' ? <ArrowUp size={16} className="inline ml-1" /> : <ArrowDown size={16} className="inline ml-1" />)}
                                                </th>
                                                <th className="py-3 px-6 text-left">배송중단</th>
                                                <th className="py-3 px-6 text-left">프레시백</th>
                                                <th className="py-3 px-6 text-left">패널티</th>
                                                <th className="py-3 px-6 text-left">산재</th>
                                                <th className="py-3 px-6 text-left">유류비</th>
                                                <th className="py-3 px-6 text-left">유지보수비</th>
                                                <th className="py-3 px-6 text-left">부가세</th>
                                                <th className="py-3 px-6 text-left">종합소득세</th>
                                                <th className="py-3 px-6 text-left">세무사 비용</th>
                                                <th className="py-3 px-6 text-center">작업</th>
                                            </tr>

                                        </thead>
                                        <tbody className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm font-light`}>
                                            {filteredAndSortedEntries.length > 0 ? ( // 데이터가 있을 때만 렌더링
                                                filteredAndSortedEntries.map(entry => (
                                                    <tr key={entry.id} className={`${isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-100'} border-b`}>
                                                        <td className="py-3 px-6 text-left whitespace-nowrap">{entry.date}</td>
                                                        <td className="py-3 px-6 text-left">{entry.unitPrice.toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-left">{entry.deliveryCount.toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-left">{entry.returnCount.toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-left">{(entry.deliveryInterruptionAmount || 0).toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-left">{(entry.freshBagCount || 0).toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-left">{(entry.penaltyAmount || 0).toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-left">{(entry.industrialAccidentCost || 0).toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-left">{(entry.fuelCost || 0).toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-left">{(entry.maintenanceCost || 0).toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-left">{(entry.vatAmount || 0).toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-left">{(entry.incomeTaxAmount || 0).toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-left">{(entry.taxAccountantFee || 0).toLocaleString()}</td>
                                                        <td className="py-3 px-6 text-center">
                                                            <div className="flex item-center justify-center">
                                                                <button
                                                                    onClick={() => handleEdit(entry)}
                                                                    className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded-md mr-2 transition duration-150 ease-in-out"
                                                                >
                                                                    수정
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(entry.id)}
                                                                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-md transition duration-150 ease-in-out"
                                                                >
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : ( // 데이터가 없을 때 표시할 행
                                                <tr>
                                                    <td colSpan="14" className="py-3 px-6 text-center">
                                                        <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>입력된 데이터가 없습니다. (로그인하지 않으면 데이터는 저장되지 않습니다.)</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {activeContentTab === 'statistics' && ( // statistics는 userId 조건 없음
                            <StatsDisplay
                                statisticsView={statisticsView}
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
                                setSelectedYear={setSelectedYear} // setSelectedYear 전달
                            />
                        )}

                        {/* 관리자 설정은 로그인 여부와 관계없이 접근 가능하도록 변경 */}
                        
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
                                        handleBackupData={handleBackupData}
                                        handleRestoreData={handleRestoreData}
                                        handleExportCsv={handleExportCsv}
                                        handleImportCsv={handleImportCsv}
                                    />
                                )}
                            </>
                        )}

                        {activeContentTab === 'userGuide' && (
                            <div className={`p-6 rounded-lg shadow-md w-full max-w-4xl mb-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>사용자 가이드</h2>
                                <div className={`${isDarkMode ? 'text-gray-200' : 'text-gray-700'} space-y-4`}>
                                    <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>1. 데이터 입력</h3>
                                    <p>
                                        매일의 배송 관련 데이터를 입력하는 섹션입니다.
                                        <ul>
                                            <li><strong>날짜:</strong> 데이터 입력 날짜를 선택합니다.</li>
                                            <li><strong>단가:</strong> 배송 건당 단가를 입력합니다.</li>
                                            <li><strong>배송 수량:</strong> 해당 날짜의 배송 완료 건수를 입력합니다.</li>
                                            <li><strong>반품 수량:</strong> 해당 날짜의 반품 건수를 입력합니다. (수익으로 계산됩니다)</li>
                                            <li><strong>배송중단:</strong> 배송 중단으로 인한 수익 금액을 입력합니다.</li>
                                            <li><strong>프레시백 수량:</strong> 수거한 프레시백 수량을 입력합니다. (개당 100원으로 계산)</li>
                                            <li><strong>지출 비용 입력:</strong> 버튼을 클릭하여 패널티, 산재, 유류비, 유지보수비, 부가세, 종합소득세, 세무사 비용을 추가로 입력할 수 있습니다.</li>
                                        </ul>
                                        입력 후 '저장' 또는 '수정' 버튼을 클릭하여 저장합니다.
                                    </p>

                                    <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>2. 월별 수익 (홈)</h3>
                                    <p>
                                        '홈' 탭에서 접근할 수 있으며, 선택한 월의 총 배송 수익, 반품 수익, 프레시백 수익, 배송중단 수익, 그리고 각종 비용을 집계하여 월별 순이익을 보여줍니다.
                                        집계 기간은 '관리자 설정'에서 변경할 수 있습니다.
                                    </p>

                                    <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>3. 통계</h3>
                                    <p>
                                        '통계' 탭에서 접근할 수 있으며, '월간 통계', '연간 통계', '누적 통계'를 선택하여 확인할 수 있습니다.
                                        각 통계는 총 근무일, 총 물량 (배송+반품), 총 프레시백, 일평균 물량, 총 매출, 총 지출, 순이익 정보를 제공합니다.
                                        '총 매출'과 '총 지출'을 클릭하면 상세 내역을 볼 수 있습니다.
                                    </p>

                                    <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>4. 관리자 설정 (더보기)</h3>
                                    <p>
                                        '더보기' 탭을 클릭하여 나타나는 모달에서 접근할 수 있으며, 앱의 기본 설정을 변경하는 섹션입니다.
                                        <ul>
                                            <li><strong>즐겨찾는 단가 설정:</strong> 자주 사용하는 단가를 등록하여 데이터 입력 시 빠르게 선택할 수 있습니다.</li>
                                            <li><strong>월별 집계 기간 설정:</strong> 월별 수익을 계산할 때의 시작일과 종료일을 설정할 수 있습니다. (예: 매월 26일 ~ 다음 달 25일)</li>
                                            <li><strong>데이터 백업 (JSON):</strong> 현재 데이터를 JSON 파일로 다운로드합니다.</li>
                                            <li><strong>데이터 복원 (JSON):</strong> JSON 파일을 업로드하여 데이터를 복원합니다. (기존 데이터에 추가됩니다)</li>
                                            <li><strong>데이터 내보내기 (CSV):</strong> 현재 데이터를 CSV 파일로 다운로드합니다.</li>
                                            <li><strong>데이터 가져오기 (CSV):</strong> CSV 파일을 업로드하여 데이터를 복원합니다. (기존 데이터에 추가됩니다)</li>
                                        </ul>
                                    </p>

                                    <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>5. 로그인/로그아웃</h3>
                                    <p>
                                        구글 계정으로 로그인하여 데이터를 안전하게 저장하고 관리할 수 있습니다.
                                        로그인하지 않으면 데이터가 저장되지 않습니다.
                                        '로그아웃' 버튼을 클릭하여 현재 계정에서 로그아웃할 수 있습니다.
                                        (네이버 로그인은 현재 지원되지 않습니다.)
                                    </p>

                                    <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>6. 다크 모드</h3>
                                    <p>
                                        앱 오른쪽 상단의 달/해 아이콘을 클릭하여 앱의 색상 테마를 다크 모드와 밝은 모드 사이에서 전환할 수 있습니다.
                                    </p>

                                    <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>7. 데이터 정렬</h3>
                                    <p>
                                        '데이터' 탭의 테이블 각 열 제목을 클릭하여 해당 열을 기준으로 데이터를 정렬할 수 있습니다.
                                    </p>
                                </div>
                            </div>
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
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className={`p-6 rounded-lg shadow-xl max-w-sm w-full text-center ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-800'}`}>
                        <p className="text-lg font-semibold mb-4">{modalContent}</p>
                        <button
                            onClick={closeModal}
                            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;