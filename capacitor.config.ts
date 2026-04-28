import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kjw.deliverytracker',
  appName: '택배메이트',
  webDir: 'build',
  backgroundColor: '#111827',
  plugins: {
    StatusBar: {
      overlaysWebView: true, 
      style: 'DARK' 
    }
  }
};

export default config;