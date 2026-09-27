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

        return () => {
            isMounted = false;
            listener?.subscription?.unsubscribe();
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
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) throw error;
    }, []);

    // 애플 로그인
    const signInWithApple = useCallback(async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'apple',
        });
        if (error) throw error;
    }, []);

    // 카카오 로그인은 Supabase 기본 OAuth 목록에 없어서 별도 구현이 필요합니다.
    // (1단계에서는 자리만 비워두고, 추후 카카오 SDK 연동 시 채울 예정)
    const signInWithKakao = useCallback(async () => {
        throw new Error('카카오 로그인은 아직 준비 중입니다.');
    }, []);

    // 로그아웃 — 안전을 위해 "로컬 캐시 비우기"는 여기서 하지 않고
    // 호출하는 쪽(UI)에서 migration.js의 clearLocalDataAfterLogout()을
    // 명시적으로 호출하도록 분리했습니다. (실수로 로그아웃만 했는데
    // 데이터가 같이 날아가는 사고를 방지하기 위함)
    const signOut = useCallback(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }, []);

    const value = {
        user,                 // null이면 게스트모드
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
    if (!ctx) {
        throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
    }
    return ctx;
}