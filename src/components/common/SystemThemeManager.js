import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';

const SystemThemeManager = ({ isDarkMode }) => {
    
    useEffect(() => {
        const syncSystemBars = async () => {
            try {
                // 🔴 [수정] false -> true 로 바꿔야 '자동 확보' 기능이 켜집니다.
                // 이제 웹뷰가 상단바 뒤로 들어가면서 env() 값이 제대로 나옵니다.
                await StatusBar.setOverlaysWebView({ overlay: true });

                if (isDarkMode) {
                    await StatusBar.setStyle({ style: Style.Dark }); 
                    // 배경색 설정 삭제 (Java에서 투명하게 뚫어놨는데 여기서 색칠하면 안 됨)
                } else {
                    await StatusBar.setStyle({ style: Style.Light }); 
                }
            } catch (e) {
                console.error("시스템바 제어 오류:", e);
            }
        };

        const timer = setTimeout(() => {
            syncSystemBars();
        }, 50);

        return () => clearTimeout(timer);

    }, [isDarkMode]);

    return null; 
};

export default SystemThemeManager;