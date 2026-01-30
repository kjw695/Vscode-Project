import { useEffect } from 'react';

/**
 * 안드로이드 뒤로가기 대응 커스텀 훅
 */
export const useDialogHistory = (isOpen, onClose) => {
    useEffect(() => {
        if (isOpen) {
            // 1. 계산기가 열릴 때 히스토리 스택에 가짜 상태 추가 (방지턱 생성)
            window.history.pushState({ modal: 'calculator' }, '', '');

            const handlePopState = () => {
                // 2. 안드로이드 뒤로가기 클릭 시 실행
                onClose();
            };

            // 뒤로가기 이벤트 감시 시작
            window.addEventListener('popstate', handlePopState);

            return () => {
                // 컴포넌트가 닫힐 때 감시 종료
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [isOpen, onClose]);

    // 3. UI 버튼(취소 등)으로 닫을 때 역사책을 수동으로 정리함
    const closeWithHistory = () => {
        if (isOpen) {
            window.history.back(); // 기록을 한 칸 뒤로 돌려 popstate 유발
        }
    };

    return { closeWithHistory };
};