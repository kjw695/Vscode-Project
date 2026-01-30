// src/hooks/useAppBackButton.js
import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

const useAppBackButton = ({
    modalState, closeModal, 
    showConfirmation, // ✨ 추가됨: 확인 팝업 함수 받기
    isFilterModalOpen, setIsFilterModalOpen,
    moreSubView, setMoreSubView,
    selectedMainTab, setSelectedMainTab,
    activeContentTab, setActiveContentTab
}) => {
    useEffect(() => {
        let backButtonListener;

        const setupListener = async () => {
            backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                
                // 1. 팝업/경고창이 떠 있으면 -> 닫기
                if (modalState && modalState.isOpen) {
                    closeModal();
                    return;
                }

                // 2. 필터 모달이 떠 있으면 -> 닫기
                if (isFilterModalOpen) {
                    setIsFilterModalOpen(false);
                    return;
                }

                // 3. '더보기' 안의 하위 화면이면 -> 더보기 메인으로
                if (selectedMainTab === 'more' && moreSubView !== 'main') {
                    setMoreSubView('main');
                    return;
                }

                // 4. 다른 메인 탭이면 -> 홈으로 이동
                if (selectedMainTab !== 'home') {
                    setSelectedMainTab('home');
                    setActiveContentTab('monthlyProfit');
                    return;
                }

                // 5. ✨ 홈 화면이면 -> 종료 확인 팝업 띄우기
                if (selectedMainTab === 'home') {
                    showConfirmation("앱을 종료하시겠습니까?", () => {
                        // 확인(Yes)을 눌렀을 때 실행될 함수
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
        modalState, isFilterModalOpen, moreSubView, selectedMainTab, showConfirmation // 의존성 추가
    ]);
};

export default useAppBackButton;