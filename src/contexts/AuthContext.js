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
import { Capacitor } from '@capacitor/core';

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

      // 모바일 딥링크: 로그인 복귀와 팀 초대를 함께 처리합니다.
let appUrlListener = null;

const handleIncomingUrl = async (rawUrl) => {
    if (!isMounted || !rawUrl) return;

    let urlObj;

    try {
        urlObj = new URL(rawUrl);
    } catch (error) {
        console.warn('[DeepLink] URL 해석 실패:', error);
        return;
    }

    // 1. 기존 Google / Apple 로그인 복귀 처리
    if (urlObj.host === 'login-callback') {
        await Browser.close().catch(() => {});

        if (urlObj.hash) {
            window.location.hash = urlObj.hash;

            localStorage.setItem('returnToAccount', 'true');

            window.setTimeout(() => {
                if (isMounted) {
                    window.location.reload();
                }
            }, 100);
        }

        return;
    }

    // 2. 팀 초대 링크 처리
    if (urlObj.host === 'invite') {
        const inviteCode = (
            urlObj.searchParams.get('code') || ''
        ).trim();

        if (!inviteCode) {
            console.warn('[Invite] 링크에 초대코드가 없습니다.');
            return;
        }

        try {
            // 로그인 전 링크를 열어도 코드를 보존합니다.
            localStorage.setItem('pendingInviteCode', inviteCode);
        } catch (error) {
            console.error('[Invite] 초대코드 임시 저장 실패:', error);
            return;
        }

        // App.js와 팀 관리 화면에 초대 링크가 열렸음을 전달합니다.
        window.dispatchEvent(
            new CustomEvent('deliverytracker:invite-link', {
                detail: { code: inviteCode }
            })
        );
    }
};

const setupDeepLink = async () => {
    const handle = await App.addListener(
        'appUrlOpen',
        (event) => {
            handleIncomingUrl(event.url).catch((error) => {
                console.error('[DeepLink] URL 처리 실패:', error);
            });
        }
    );

    // 등록이 끝나기 전에 컴포넌트가 정리됐다면 리스너를 제거합니다.
    if (!isMounted) {
        await handle.remove();
        return;
    }

    appUrlListener = handle;

    // 초대 링크로 앱이 처음 실행된 경우도 처리합니다.
    const launchUrl = await App.getLaunchUrl();

    if (isMounted && launchUrl?.url) {
        await handleIncomingUrl(launchUrl.url);
    }
};

setupDeepLink().catch((error) => {
    console.error('[DeepLink] 초기화 실패:', error);
});


       return () => {
    isMounted = false;
    listener?.subscription?.unsubscribe();
    appUrlListener?.remove();
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

    // 구글 로그인
    const signInWithGoogle = useCallback(async () => {
        try {
            const isWeb = Capacitor.getPlatform() === 'web';
            // ✨ 웹이면 현재 주소(localhost:3000 등)로, 모바일이면 앱 전용 주소로 설정
            const redirectUrl = isWeb ? window.location.origin : 'deliverytracker://login-callback';
            
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,     // 👈 여기가 완벽하게 수정되었습니다!
                    skipBrowserRedirect: !isWeb, // 👈 웹(인터넷)일 때는 false가 되어 자동으로 넘어갑니다.
                }
            });
            
            if (error) throw error;

            // 모바일 환경일 때만 인앱 브라우저를 수동으로 엽니다.
            if (!isWeb && data?.url) {
                await Browser.open({ url: data.url });
            }
        } catch (err) {
            alert("로그인 중 에러가 발생했습니다: " + err.message);
            throw err;
        }
    }, []);

   // 애플 로그인
    const signInWithApple = useCallback(async () => {
        try {
            const isWeb = Capacitor.getPlatform() === 'web';
            const redirectUrl = isWeb ? window.location.origin : 'deliverytracker://login-callback';

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'apple',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: !isWeb,
                }
            });
            
            if (error) throw error;
            
            if (!isWeb && data?.url) {
                await Browser.open({ url: data.url });
            }
        } catch (err) {
            alert("로그인 중 에러가 발생했습니다: " + err.message);
            throw err;
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