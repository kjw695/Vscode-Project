import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.github.kjw695.firstapp',
  appName: '배송 수익 추적기',
  webDir: 'build',
  backgroundColor: '#111827',
  plugins: {
    StatusBar: {
      overlaysWebView: true, 
      style: 'DARK' 
    },
    Keyboard: {
      resize: 'none', 
    }
  }
};

export default config;