// src/hooks/useAppBackButton.js
import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

const useAppBackButton = ({
    modalState, closeModal, 
    showConfirmation, 
    isFilterModalOpen, setIsFilterModalOpen,
    isExpenseSettingsModalOpen, setIsExpenseSettingsModalOpen,
    moreSubView, setMoreSubView,
    selectedMainTab, setSelectedMainTab,
    activeContentTab, setActiveContentTab
}) => {
    useEffect(() => {
        let backButtonListener;

        const setupListener = async () => {
            backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                
                // ✨ 1. 공통 팝업/경고창 닫기 (최우선)
                if (modalState && modalState.isOpen) {
                    closeModal();
                    return;
                }

                // ✨ 2. 항목 관리 팝업 닫기 (주소 해시보다 무조건 먼저 검사하도록 순서를 위로 올렸습니다!)
                if (isExpenseSettingsModalOpen) {
                    setIsExpenseSettingsModalOpen(false);
                    return;
                }

                // ✨ 3. 필터 모달 닫기
                if (isFilterModalOpen) {
                    setIsFilterModalOpen(false);
                    return;
                }

                // ✨ 4. 주소(Hash) 확인 및 뒤로 가기 (할부 창, 계산기 창 등)
                // 이제 팝업이 모두 닫힌 상태에서만 할부 창이 닫힙니다.
                if (window.location.hash) {
                    window.history.back();
                    return;
                }

                // 5. '더보기' 안의 하위 화면이면 -> 더보기 메인으로
                if (selectedMainTab === 'more' && moreSubView !== 'main') {
                    setMoreSubView('main');
                    return;
                }

                // 6. 다른 메인 탭이면 -> 홈으로 이동
                if (selectedMainTab !== 'home') {
                    setSelectedMainTab('home');
                    setActiveContentTab('monthlyProfit');
                    return;
                }

                // 7. 홈 화면이면 -> 종료 확인 팝업 띄우기
                if (selectedMainTab === 'home') {
                    showConfirmation("앱을 종료하시겠습니까?", () => {
                        CapacitorApp.exitApp();
                    });
                }
            });
        };

        setupListener();

        return () => {
            if (backButtonListener) {
                backButtonListener.remove();
            }
        };
    }, [
        modalState, isFilterModalOpen, isExpenseSettingsModalOpen, moreSubView, selectedMainTab, showConfirmation 
    ]);
};

export default useAppBackButton;