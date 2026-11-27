import { Toast } from '@capacitor/toast';

/** 짧은 성공 안내용 네이티브 토스트. 알림 실패는 실제 작업 결과에 영향을 주지 않습니다. */
export const showToast = async (message) => {
    try {
        await Toast.show({ text: String(message || ''), duration: 'short', position: 'bottom' });
    } catch (error) {
        console.warn('Toast could not be shown:', error);
    }
};
