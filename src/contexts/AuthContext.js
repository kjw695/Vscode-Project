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

    // 최초 세션 확인과 인증 이벤트를 함께 처리합니다.
    useEffect(() => {
        let isMounted = true;
        let authStateVersion = 0;

        // 인증 이벤트를 먼저 구독합니다. 로그인/로그아웃 이벤트가 getSession보다
        // 늦게 도착한 오래된 결과에 의해 덮어써지는 경쟁 조건을 막습니다.
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
            if (!isMounted) return;

            if (session?.user) {
                authStateVersion += 1;
                setUser(session.user);
                setIsAuthLoading(false);
                return;
            }

            // 명시적 로그아웃 또는 최초 세션 확인 결과만 게스트 상태로 반영합니다.
            // 일시적인 토큰 갱신/네트워크 오류는 계정 상태를 초기화하지 않습니다.
            if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
                authStateVersion += 1;
                setUser(null);
                setIsAuthLoading(false);
            }
        });

        const resolveSession = async () => {
            const requestedVersion = authStateVersion;
            try {
                const { data, error } = await supabase.auth.getSession();
                if (error) throw error;
                if (!isMounted || authStateVersion !== requestedVersion) return;
                setUser(data?.session?.user ?? null);
                setIsAuthLoading(false);
            } catch (error) {
                if (!isMounted || authStateVersion !== requestedVersion) return;
                console.warn('[Auth] 세션 확인 실패. 기존 인증 상태를 유지하고 재연결을 기다립니다:', error);
                // 인증 상태가 불명확할 때 게스트 저장소를 열지 않습니다.
                // 네트워크 복구 시 online 이벤트에서 다시 확인합니다.
            }
        };

        // 구독을 먼저 연결한 뒤 초기 세션을 읽어 오래된 null 응답의 덮어쓰기를 방지합니다.
        resolveSession();

        const handleOnline = () => { resolveSession(); };
        window.addEventListener('online', handleOnline);

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
            window.removeEventListener('online', handleOnline);
            appUrlListener?.remove();
        };
    }, []);

    // 로그인한 사용자의 profiles 정보를 조회하고, 다른 화면에서 저장한 변경도 다시 불러옵니다.
    const refreshProfile = useCallback(async () => {
        if (!user?.id) {
            setProfile(null);
            return null;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.warn('[Auth] 프로필 조회 실패 또는 아직 없음:', error.message);
            throw error;
        }

        setProfile(data);
        return data;
    }, [user?.id]);

    useEffect(() => {
        let isMounted = true;
        if (!user?.id) {
            setProfile(null);
            return undefined;
        }

        refreshProfile().catch((error) => {
            if (isMounted) setProfile(null);
        });

        return () => { isMounted = false; };
    }, [user?.id, refreshProfile]);

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

    // 카카오 로그인도 Google / Apple과 동일한 Supabase OAuth + 앱 딥링크 흐름을 사용합니다.
    const signInWithKakao = useCallback(async () => {
        try {
            const isWeb = Capacitor.getPlatform() === 'web';
            const redirectUrl = isWeb ? window.location.origin : 'deliverytracker://login-callback';

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'kakao',
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
            alert("카카오 로그인 중 에러가 발생했습니다: " + err.message);
            throw err;
        }
    }, []);

    const signOut = useCallback(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }, []);

    const value = {
        user,
        profile,
        refreshProfile,
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