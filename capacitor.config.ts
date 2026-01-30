import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.github.kjw695.firstapp',
  appName: '배송 수익 추적기',
  webDir: 'build',
  backgroundColor: '#111827', // 앱 로딩 시 배경색
  plugins: {
    StatusBar: {
      // 🔴 [핵심] 이걸 true로 해야 웹뷰(파란색 X)가 핑크색 상단바 위로 올라갑니다.
      overlaysWebView: true, 
      // 상단바 아이콘(시계 등)을 흰색으로 고정 (배경이 어두우니까요)
      style: 'DARK' 
    }
  }
};

export default config;