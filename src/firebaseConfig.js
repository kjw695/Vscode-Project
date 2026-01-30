// firebaseConfig.js

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 각 소셜 로그인 제공자 인스턴스 생성
const googleProvider = new GoogleAuthProvider();
const kakaoProvider = new OAuthProvider('oidc.kakao');
const naverProvider = new OAuthProvider('oidc.naver'); // 네이버 프로바이더 추가

const appId = firebaseConfig.appId;

// 모든 인스턴스를 export
export {
    app,
    db,
    auth,
    appId,
    googleProvider,
    kakaoProvider,
    naverProvider // 네이버 프로바이더 export 추가
};