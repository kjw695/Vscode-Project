// src/lib/supabaseClient.js
//
// Supabase 연결 설정 파일입니다. 다른 파일들이 이 파일을 통해서만
// Supabase에 접근합니다 (연결 설정을 한 곳에서만 관리하기 위함).
//
// 새로 만드는 파일이라 기존 코드에는 영향이 없습니다.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    // 환경변수가 없으면 앱이 조용히 망가지는 대신 콘솔에 명확히 경고합니다.
    console.error(
        '[Supabase] 환경변수가 설정되지 않았습니다. .env 파일에 ' +
        'REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY 를 추가해주세요.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,      // 앱 재시작해도 로그인 유지
        autoRefreshToken: true,    // 토큰 자동 갱신
        detectSessionInUrl: true,  // OAuth 리다이렉트 후 세션 자동 인식
    },
});