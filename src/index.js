import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// 🔥 [필수] 관리자 파일 임포트 (이 줄이 꼭 있어야 합니다!)
import { DeliveryProvider } from './contexts/DeliveryContext'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* 🔥 [필수] App을 DeliveryProvider로 감싸야 에러가 안 납니다! */}
    <DeliveryProvider>
      <App />
    </DeliveryProvider>
  </React.StrictMode>
);

reportWebVitals();
