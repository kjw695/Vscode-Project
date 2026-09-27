import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// 🔥 [필수] 관리자 파일 임포트 (이 줄이 꼭 있어야 합니다!)
import { DeliveryProvider } from './contexts/DeliveryContext'; 
import { AuthProvider } from './contexts/AuthContext'; // 이 줄 추가


const root = ReactDOM.createRoot(document.getElementById('root'));



root.render(
  <React.StrictMode>
    <AuthProvider>
      <DeliveryProvider>
        <App />
      </DeliveryProvider>
    </AuthProvider>
  </React.StrictMode>
);

reportWebVitals();
