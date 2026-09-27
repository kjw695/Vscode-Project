// src/contexts/AuthContext.js
//
// 로그인 상태를 앱 전체에서 공유하기 위한 Context입니다.
// 기존 DeliveryContext.js와는 별개로 작동하며, "지금 로그인되어 있는가?"
// "누구로 로그인했는가?"만 책임집니다.
//
// 새로 만드는 파일이라 기존 코드에는 영향이 없습니다.
// App.js에서 이 Provider로 한 번만 감싸주면 됩니다 (가이드는 별도 안내).

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { App } from '@capacitor/app';           // ✨ 추가: 앱 복귀(딥링크) 감지용
import { Browser } from '@capacitor/browser';   // ✨ 추가: 안전한 로그인 창을 띄우기 위함

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);          // 로그인한 사용자 (없으면 null = 게스트모드)
    const [isAuthLoading, setIsAuthLoading] = useState(true); // 최초 로그인 상태 확인 중인지
    const [profile, setProfile] = useState(null);     // profiles 테이블의 추가 정보 (조직, 역할 등)

    // 최초 로드 시 현재 세션 확인 + 이후 로그인/로그아웃 변화 감지
    useEffect(() => {
        let isMounted = true;

        // 1. 현재 세션이 있는지 확인 (앱 재시작 시에도 로그인 유지되는지)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!isMounted) return;
            setUser(session?.user ?? null);
            setIsAuthLoading(false);
        });

        // 2. 로그인/로그아웃/토큰갱신 등 상태 변화를 실시간으로 감지
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return;
            setUser(session?.user ?? null);
        });

        // ✨ [모바일 핵심] 딥링크(로그인 완료 후 앱으로 복귀) 수신 처리
        const setupDeepLink = async () => {
            await App.addListener('appUrlOpen', async (event) => {
                if (event.url.includes('login-callback')) {
                    // 1. 열려있던 구글 로그인 브라우저 창 닫기
                    await Browser.close().catch(() => {});
                    
                    // 2. 반환된 URL에서 인증 토큰 부분 추출
                    const urlObj = new URL(event.url);
                    
                    if (urlObj.hash) {
                        window.location.hash = urlObj.hash;
                        // 🚨 강제 새로고침 추가: Supabase가 바뀐 해시(토큰)를 즉시 인식하고 로그인 처리함
                        window.location.reload();
                    }
                }
            });
        };
        setupDeepLink();


        return () => {
            isMounted = false;
            listener?.subscription?.unsubscribe();
            App.removeAllListeners('appUrlOpen'); // 리스너 정리
        };
    }, []);

    // 로그인한 사용자의 profiles 정보를 별도로 불러옵니다 (조직 소속, 관리자 여부 등)
    useEffect(() => {
        if (!user) {
            setProfile(null);
            return;
        }
        let isMounted = true;

        supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
            .then(({ data, error }) => {
                if (!isMounted) return;
                if (error) {
                    // 프로필이 아직 없을 수 있음 (최초 로그인 직후) - 에러로 취급하지 않음
                    console.warn('[Auth] 프로필 조회 실패 또는 아직 없음:', error.message);
                    setProfile(null);
                } else {
                    setProfile(data);
                }
            });

        return () => { isMounted = false; };
    }, [user]);

    // 구글 로그인 (디버깅용)
    const signInWithGoogle = useCallback(async () => {
        try {
            alert("1. Supabase에 로그인 URL 요청 시작"); // 👈 1번 팝업
            
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: 'deliverytracker://login-callback',
                    skipBrowserRedirect: true, 
                }
            });
            
            if (error) {
                alert("에러 발생: " + error.message); // 👈 에러 팝업
                throw error;
            }

            alert("2. URL 받아오기 성공!\nURL: " + data?.url); // 👈 2번 팝업

            if (data?.url) {
                await Browser.open({ url: data.url });
                alert("3. 인앱 브라우저 실행 완료"); // 👈 3번 팝업
            } else {
                alert("URL이 비어 있습니다!");
            }
        } catch (err) {
            alert("예외 에러: " + err.message);
            throw err;
        }
    }, []);

   // ✨ 애플 로그인 (동일하게 교체)
    const signInWithApple = useCallback(async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'apple',
            options: {
                redirectTo: 'deliverytracker://login-callback',
                skipBrowserRedirect: true,
            }
        });
        
        if (error) throw error;
        
        if (data?.url) {
            await Browser.open({ url: data.url });
        }
    }, []);

    const signInWithKakao = useCallback(async () => {
        throw new Error('카카오 로그인은 아직 준비 중입니다.');
    }, []);

    const signOut = useCallback(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }, []);

    const value = {
        user,
        profile,
        isAuthLoading,
        isLoggedIn: !!user,
        signInWithGoogle,
        signInWithApple,
        signInWithKakao,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
    return ctx;
}