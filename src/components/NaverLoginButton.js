// server.js

const express = require('express');
const axios = require('axios');
const app = express();

const NAVER_CLIENT_ID = process.env.REACT_APP_NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.REACT_APP_NAVER_CLIENT_SECRET;

// 네이버 로그인 콜백을 처리할 라우터
app.get('/auth/naver/callback', async (req, res) => {
  // 네이버에서 보내주는 authorization code와 state 값을 받아옵니다.
  const code = req.query.code;
  const state = req.query.state;

  const tokenApiUrl = `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${NAVER_CLIENT_ID}&client_secret=${NAVER_CLIENT_SECRET}&code=${code}&state=${state}`;

  try {
    // 1. 코드를 이용해 네이버로부터 액세스 토큰(Access Token) 발급받기
    const tokenResponse = await axios.get(tokenApiUrl);
    const accessToken = tokenResponse.data.access_token;

    // 2. 발급받은 액세스 토큰을 이용해 사용자 정보 가져오기
    const profileApiUrl = 'https://openapi.naver.com/v1/nid/me';
    const profileResponse = await axios.get(profileApiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const naverUser = profileResponse.data.response;
    console.log('네이버 사용자 정보:', naverUser);

    // ---- 중요: 사용자 정보 DB 처리 ---- //
    // naverUser.email 또는 naverUser.id 를 기준으로 
    // 우리 DB에 이미 가입된 사용자인지 확인합니다.
    // 1. 가입된 사용자라면? -> 로그인 성공 처리 (JWT 토큰 발급 등)
    // 2. 가입되지 않은 사용자라면? -> 회원가입 처리 후 로그인 성공 처리
    // ------------------------------------ //
    
    // 로그인/회원가입 처리가 성공적으로 끝나면,
    // 사용자를 프론트엔드의 메인 페이지나 대시보드로 리디렉션합니다.
    res.redirect('http://localhost:3000/dashboard'); // 예시: 대시보드 페이지로 이동

  } catch (error) {
    console.error('네이버 로그인 에러:', error.response ? error.response.data : error.message);
    res.status(500).send('서버 에러가 발생했습니다.');
  }
});


// ... 기존 서버 코드 ...

const PORT = 3001; // 백엔드 포트는 프론트엔드와 달라야 합니다 (예: 3001)
app.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});