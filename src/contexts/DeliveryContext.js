import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { isDuplicateEntry } from '../utils/calculator';

// ✨ 1. Supabase 도구와 Auth(로그인) 상태를 불러옵니다.
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const DeliveryContext = createContext();

// ✨ 2. DB에서 온 언더바(_) 데이터를 리액트가 쓰던 이름으로 예쁘게 포장해 주는 번역기
const toClientFormat = (row) => ({
    id: row.id, 
    date: row.date,
    type: row.type,
    unitPrice: row.unit_price,
    round: row.round,
    memo: row.memo,
    customItems: row.custom_items || [],
    isEdited: row.is_edited,
    timestamp: row.created_at
});


export function DeliveryProvider({ children }) {
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // ✨ AuthContext에서 "로그인했는지(isLoggedIn)"와 "유저 정보(user)"를 뽑아옵니다.
    const { user, isLoggedIn } = useAuth();

    const lastSRef = useRef(0);
    const lastZRef = useRef(0);
    const lastSaveTimeRef = useRef(0); 

    const isKoreanSystem = navigator.language?.startsWith('ko');

    const fieldMapping = {
        date: { ko: '날짜', en: 'Date' },
        type: { ko: '구분', en: 'Type' }, 
        timestamp: { ko: '기록시간', en: 'Timestamp' }
    };

  useEffect(() => {
        let isMounted = true; // ✨ 인터넷 느릴 때 에러 뿜는 걸 막아주는 리액트 안전장치

        const loadData = async () => {
            setIsLoading(true);
            try {
                if (isLoggedIn && user) {
                    // 🟢 [온라인 모드] DB의 entries 테이블에서 내 데이터만 '날짜 최신순'으로 긁어오기
                    const { data, error } = await supabase
                        .from('entries')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('date', { ascending: false });

                    if (error) throw error;

                    if (isMounted) {
                        setEntries((data || []).map(toClientFormat)); // 번역기 돌려서 넣기!
                    }
                } else {
                    // 🟡 [오프라인 모드] 옛날처럼 내 폰 스토리지에서 긁어오기
                    const saved = localStorage.getItem('deliveryEntries');
                    if (saved && isMounted) {
                        const parsed = JSON.parse(saved);
                        updateLastIdRefs(parsed);
                        setEntries(parsed);
                    }
                }
            } catch (e) {
                console.error("데이터 로드 실패:", e);
            } finally {
                if (isMounted) {
                    setIsDataLoaded(true);
                    setIsLoading(false);
                }
            }
        };

        loadData();
        return () => { isMounted = false; };
    }, [isLoggedIn, user]); // ✨ 감시 카메라: 로그인 상태가 바뀌면 이 코드를 다시 실행함!
    // 실시간 동기화 — 다른 기기에서 변경 시 이 화면에도 즉시 반영
    useEffect(() => {
        if (!isLoggedIn || !user) return;

        const channel = supabase
            .channel(`entries-${user.id}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${user.id}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setEntries(prev => {
                            if (prev.some(e => e.id === payload.new.id)) return prev;
                            return [toClientFormat(payload.new), ...prev]
                                .sort((a, b) => new Date(b.date) - new Date(a.date));
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setEntries(prev => prev.map(e =>
                            e.id === payload.new.id ? toClientFormat(payload.new) : e
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setEntries(prev => prev.filter(e => e.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isLoggedIn, user]);
    
    const updateLastIdRefs = (data) => {
        // ✨ typeof e.id === 'string' 조건이 추가되어 DB 숫자 ID를 만나도 안 터집니다!
        const sNums = data.filter(e => typeof e.id === 'string' && e.id.startsWith('s')).map(e => parseInt(e.id.slice(1)) || 0);
        const zNums = data.filter(e => typeof e.id === 'string' && e.id.startsWith('z')).map(e => parseInt(e.id.slice(1)) || 0);
        lastSRef.current = sNums.length > 0 ? Math.max(...sNums) : 0;
        lastZRef.current = zNums.length > 0 ? Math.max(...zNums) : 0;
    };

    const syncToStorage = (data) => {
        const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem('deliveryEntries', JSON.stringify(sorted));
    };

  // ✨ [핵심 수정 완성본] saveEntry 함수
    const saveEntry = useCallback(async (entryData) => {
        setIsLoading(true);
        try {
            const now = Date.now();
            if (!entryData.id && (now - lastSaveTimeRef.current < 2000)) {
                if (!window.confirm("방금 저장이 완료되었습니다.\n정말로 한 번 더 똑같이 저장하시겠습니까?")) {
                    throw new Error("SAVE_CANCELLED"); 
                }
            }

            const currentTimestamp = new Date().toISOString();

            if (isLoggedIn && user) {
                // 🟢 [온라인 모드] DB 직접 반영
                if (entryData.id) {
                    const payload = {
                        date: entryData.date, type: entryData.type,
                        unit_price: Number(entryData.unitPrice) || 0, round: Number(entryData.round) || 0,
                        memo: entryData.memo || null, custom_items: entryData.customItems || [],
                        is_edited: true, created_at: currentTimestamp
                    };
                    const { error } = await supabase.from('entries').update(payload).eq('id', entryData.id).eq('user_id', user.id);
                    if (error) throw new Error(error.message);

                    setEntries(prev => prev.map(e => e.id === entryData.id ? { ...e, ...entryData, timestamp: currentTimestamp, isEdited: true } : e));
                } else {
                    const payload = {
                        user_id: user.id, date: entryData.date, type: entryData.type,
                        unit_price: Number(entryData.unitPrice) || 0, round: Number(entryData.round) || 0,
                        memo: entryData.memo || null, custom_items: entryData.customItems || [],
                        is_edited: false, created_at: currentTimestamp
                    };
                    const { data: savedRow, error } = await supabase.from('entries').insert(payload).select().single();
                    if (error) throw new Error(error.message);

                    setEntries(prev => [...prev, toClientFormat(savedRow)].sort((a, b) => new Date(b.date) - new Date(a.date)));
                }
                lastSaveTimeRef.current = Date.now();
            } else {
                // 🟡 [오프라인 모드] 로컬 스토리지 저장
                setEntries(prev => {
                    let nextEntries = [...prev];
                    if (entryData.id) {
                        const idx = nextEntries.findIndex(e => e.id === entryData.id);
                        if (idx !== -1) {
                            nextEntries[idx] = { ...nextEntries[idx], ...entryData, timestamp: currentTimestamp, isEdited: true };
                            syncToStorage(nextEntries); lastSaveTimeRef.current = Date.now(); 
                            return nextEntries;
                        }
                    }
                    const prefix = entryData.type === 'income' ? 's' : 'z';
                    const nextNum = (entryData.type === 'income' ? ++lastSRef.current : ++lastZRef.current);
                    const finalEntry = { ...entryData, id: `${prefix}${nextNum}`, timestamp: currentTimestamp };
                    const updated = [...nextEntries, finalEntry];
                    syncToStorage(updated); lastSaveTimeRef.current = Date.now(); 
                    return updated;
                });
            }
        } catch (error) {
            if (error.message !== "SAVE_CANCELLED") alert(error.message);
            throw error; 
        } finally {
            setIsLoading(false);
        }
    }, [isLoggedIn, user]);

   const importStrictly = useCallback(async (incomingData) => {
        setIsLoading(true);
        try {
            if (isLoggedIn && user) {
                let addedCount = 0;
                let skippedCount = 0;

                const validRows = incomingData.filter(row => {
                    const isDup = entries.some(e => isDuplicateEntry(e, row));
                    if (isDup) { skippedCount++; return false; }
                    return true;
                });

                if (validRows.length === 0) return { added: 0, skipped: skippedCount };

                const batch = validRows.map(row => ({
                    user_id: user.id, date: row.date, type: row.type,
                    unit_price: Number(row.unitPrice) || 0, round: Number(row.round) || 0,
                    memo: row.memo || null, custom_items: row.customItems || [],
                    is_edited: row.isEdited || false, created_at: row.timestamp || new Date().toISOString()
                }));

                const { error } = await supabase.from('entries').insert(batch);
                if (error) throw new Error(error.message);

                const { data: refreshed } = await supabase.from('entries').select('*').eq('user_id', user.id).order('date', { ascending: false });
                if (refreshed) setEntries(refreshed.map(toClientFormat));

                return { added: validRows.length, skipped: skippedCount };
            } else {
                return new Promise((resolve) => {
                    setEntries(prev => {
                        let currentEntries = [...prev];
                        let addedCount = 0; let skippedCount = 0;
                        const incomeGroup = incomingData.filter(d => d.type === 'income');
                        const expenseGroup = incomingData.filter(d => d.type === 'expense');

                        const processGroup = (group, prefix, ref) => {
                            group.forEach(row => {
                                if (currentEntries.some(e => isDuplicateEntry(e, row))) { skippedCount++; return; }
                                currentEntries.push({ ...row, id: `${prefix}${++ref.current}`, timestamp: row.timestamp || new Date().toISOString() });
                                addedCount++;
                            });
                        };
                        processGroup(incomeGroup, 's', lastSRef); processGroup(expenseGroup, 'z', lastZRef);
                        syncToStorage(currentEntries); resolve({ added: addedCount, skipped: skippedCount });
                        return currentEntries;
                    });
                });
            }
        } finally { setIsLoading(false); }
    }, [isLoggedIn, user, entries]);

    const getExportData = () => {
        const lang = isKoreanSystem ? 'ko' : 'en';
        return entries.map(({ id, ...rest }) => {
            const exportedRow = {};
            exportedRow[fieldMapping['date']?.[lang] || 'Date'] = rest.date;
            exportedRow[fieldMapping['type']?.[lang] || 'Type'] = rest.type === 'income' ? (lang === 'ko' ? '수익' : 'income') : (lang === 'ko' ? '지출' : 'expense');
            return exportedRow;
        });
    };

    // ✨ 1. 개별 삭제
    const deleteEntry = useCallback(async (id) => {
        setIsLoading(true);
        try {
            if (isLoggedIn && user) {
                await supabase.from('entries').delete().eq('id', id).eq('user_id', user.id);
                setEntries(prev => prev.filter(e => e.id !== id));
            } else {
                setEntries(prev => {
                    const filtered = prev.filter(e => e.id !== id);
                    syncToStorage(filtered); return filtered;
                });
            }
        } catch (err) { alert(err.message); } finally { setIsLoading(false); }
    }, [isLoggedIn, user]);

    // ✨ 2. 전체 초기화
    const clearAllEntries = useCallback(async () => {
        if (window.confirm("새로 만드시겠습니까?")) {
            setIsLoading(true);
            try {
                if (isLoggedIn && user) {
                    await supabase.from('entries').delete().eq('user_id', user.id);
                    setEntries([]);
                } else {
                    lastSRef.current = 0; lastZRef.current = 0; setEntries([]); localStorage.removeItem('deliveryEntries');
                }
            } catch (err) { alert(err.message); } finally { setIsLoading(false); }
        }
    }, [isLoggedIn, user]);

  const memoizedValue = useMemo(() => ({
        entries, saveEntry, deleteEntry, clearAllEntries, importStrictly, getExportData, isLoading, isDataLoaded
    }), [entries, saveEntry, deleteEntry, clearAllEntries, importStrictly, isLoading, isDataLoaded]); // ✨ 삭제 함수 2개 추가!
    return (
        <DeliveryContext.Provider value={memoizedValue}>
            {children}
        </DeliveryContext.Provider>
    );
}

export function useDelivery() { return useContext(DeliveryContext); }