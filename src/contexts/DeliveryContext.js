import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { isDuplicateEntry } from '../utils/calculator';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const DeliveryContext = createContext();

// ✨ DB 데이터를 변환할 때, 서버에 있는 건 무조건 '전송 완료(isSynced: true)' 취급합니다.
const toClientFormat = (row) => ({
    id: row.id, 
    date: row.date,
    type: row.type,
    unitPrice: row.unit_price,
    round: row.round,
    memo: row.memo,
    customItems: row.custom_items || [],
    isEdited: row.is_edited,
    timestamp: row.created_at,
    isSynced: true // DB에서 가져온 건 무조건 전송 성공한 데이터!
});

export function DeliveryProvider({ children }) {
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

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

    const updateLastIdRefs = (data) => {
        const sNums = data.filter(e => typeof e.id === 'string' && e.id.startsWith('s')).map(e => parseInt(e.id.split('_')[0].slice(1)) || 0);
        const zNums = data.filter(e => typeof e.id === 'string' && e.id.startsWith('z')).map(e => parseInt(e.id.split('_')[0].slice(1)) || 0);
        lastSRef.current = sNums.length > 0 ? Math.max(...sNums) : 0;
        lastZRef.current = zNums.length > 0 ? Math.max(...zNums) : 0;
    };

    const syncToStorage = (data) => {
        const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem('deliveryEntries', JSON.stringify(sorted));
    };

    // ✨ 데이터 로드 (로컬 + DB 혼합)
    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            setIsLoading(true);
            try {
                // 1. 기기에 저장된 데이터(미전송 데이터 포함) 먼저 불러오기
                const saved = localStorage.getItem('deliveryEntries');
                let localData = saved ? JSON.parse(saved) : [];
                updateLastIdRefs(localData);

                if (isLoggedIn && user) {
                    // 2. 서버에서 데이터 긁어오기
                    const { data: dbData, error } = await supabase
                        .from('entries')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('date', { ascending: false });

                    if (!error && isMounted) {
                        const parsedDbData = (dbData || []).map(toClientFormat);
                        
                        // 3. 서버 데이터와 기기의 '미전송(isSynced: false)' 데이터를 하나로 합치기
                        const unsyncedLocal = localData.filter(e => e.isSynced === false);
                        const merged = [...unsyncedLocal];
                        
                        parsedDbData.forEach(dbItem => {
                            if (!merged.some(m => m.id === dbItem.id)) merged.push(dbItem);
                        });
                        
                        merged.sort((a, b) => new Date(b.date) - new Date(a.date));
                        setEntries(merged);
                        syncToStorage(merged); 
                    }
                } else {
                    if (isMounted) setEntries(localData);
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
    }, [isLoggedIn, user]);

    // ✨ 실시간 동기화
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
                            const newEntries = [toClientFormat(payload.new), ...prev].sort((a, b) => new Date(b.date) - new Date(a.date));
                            syncToStorage(newEntries);
                            return newEntries;
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setEntries(prev => {
                            const newEntries = prev.map(e => e.id === payload.new.id ? toClientFormat(payload.new) : e);
                            syncToStorage(newEntries);
                            return newEntries;
                        });
                    } else if (payload.eventType === 'DELETE') {
                        setEntries(prev => {
                            const newEntries = prev.filter(e => e.id !== payload.old.id);
                            syncToStorage(newEntries);
                            return newEntries;
                        });
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isLoggedIn, user]);

   // ✨ 서버로 조용히 데이터를 쏴주는 백그라운드 함수 (ID 충돌 해결버전)
    const sendToSupabase = async (entry) => {
        if (!isLoggedIn || !user) return;
        try {
            const payload = {
                user_id: user.id, date: entry.date, type: entry.type,
                unit_price: Number(entry.unitPrice) || 0, round: Number(entry.round) || 0,
                memo: entry.memo || null, custom_items: entry.customItems || [],
                is_edited: entry.isEdited, created_at: entry.timestamp
            };

            // ✨ 핵심: 임시로 만든 문자 ID(s1, z1 등)인지, 기존 서버 숫자 ID인지 구분
            const isLocalId = String(entry.id).startsWith('s') || String(entry.id).startsWith('z');

            let res;
            if (isLocalId) {
                // 1. 임시 ID면 insert로 서버에 넣고 '진짜 숫자 번호' 발급받기
                res = await supabase.from('entries').insert(payload).select().single();
            } else {
                // 2. 원래 있던 데이터면 기존 번호 그대로 update(수정) 하기
                res = await supabase.from('entries').update(payload).eq('id', entry.id).select().single();
            }

            if (!res.error && res.data) {
                // 성공하면 진짜 번호로 교체하고 '미전송' 꼬리표 떼기
                setEntries(prev => {
                    const updated = prev.map(e => e.id === entry.id ? { ...e, id: res.data.id, isSynced: true } : e);
                    syncToStorage(updated);
                    return updated;
                });
            }
        } catch (e) {
            console.warn("오프라인 상태: 서버 전송 대기열에 남겨둡니다.", e);
        }
    };

    // ✨ [오프라인 우선 저장소] saveEntry
// ✨ [오프라인 우선 저장소] saveEntry
    const saveEntry = useCallback(async (entryData) => {
        try {
            const now = Date.now();
            
            // ✨ 휴무 데이터인 경우(연속 선택 저장)는 2초 간격 중복 검사 팝업을 띄우지 않고 통과시킵니다!
            const isDayOff = entryData.memo === '[휴무]' || (entryData.customItems && entryData.customItems.some(i => i.key === 'dayOff'));

            if (!isDayOff && !entryData.id && (now - lastSaveTimeRef.current < 2000)) {
                if (!window.confirm("방금 저장이 완료되었습니다.\n정말로 한 번 더 똑같이 저장하시겠습니까?")) throw new Error("SAVE_CANCELLED"); 
            }

            const currentTimestamp = new Date().toISOString();
            let isEditing = !!entryData.id;
            
            // 1. 서버/로컬 공통 고유 ID (오프라인 충돌 방지를 위해 시간 꼬리표 추가)
            let localId = entryData.id;
            if (!localId) {
                const prefix = entryData.type === 'income' ? 's' : 'z';
                const nextNum = entryData.type === 'income' ? ++lastSRef.current : ++lastZRef.current;
                localId = `${prefix}${nextNum}_${Date.now()}`; 
            }

            // 2. 무조건 기기에 저장할 새 데이터 덩어리 만들기
            const newEntry = { 
                ...entryData, 
                id: localId, 
                timestamp: currentTimestamp, 
                isEdited: isEditing,
                isSynced: false // ✨ 핵심: 서버 확인 전까지 무조건 미전송 상태!
            };

            // 3. 서버 응답 안 기다리고 기기에 즉시 저장! (화면 바로 넘어감)
            setEntries(prev => {
                const nextEntries = isEditing 
                    ? prev.map(e => e.id === localId ? newEntry : e) 
                    : [newEntry, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date));
                syncToStorage(nextEntries); 
                return nextEntries;
            });
            lastSaveTimeRef.current = Date.now();

            // 4. 비동기로 서버에 조용히 쏴보기
            sendToSupabase(newEntry);

        } catch (error) {
            if (error.message !== "SAVE_CANCELLED") alert(error.message);
            throw error; 
        }
    }, [isLoggedIn, user]);

   // ✨ [동기화 버튼용] 쌓여있는 미전송 데이터를 한 번에 서버로 올리는 함수 (ID 충돌 해결버전)
    const syncPendingData = useCallback(async () => {
        if (!isLoggedIn || !user) return { success: false, message: '로그인이 필요합니다.' };
        
        const pendingEntries = entries.filter(e => e.isSynced === false);
        if (pendingEntries.length === 0) return { success: true, message: '동기화할 데이터가 없습니다.' };

        setIsLoading(true);
        try {
            let successCount = 0;
            let currentEntries = [...entries]; // 실시간 상태 반영을 위한 복사본

            for (const entry of pendingEntries) {
                const payload = {
                    user_id: user.id, date: entry.date, type: entry.type,
                    unit_price: Number(entry.unitPrice) || 0, round: Number(entry.round) || 0,
                    memo: entry.memo || null, custom_items: entry.customItems || [],
                    is_edited: entry.isEdited, created_at: entry.timestamp
                };

                const isLocalId = String(entry.id).startsWith('s') || String(entry.id).startsWith('z');
                
                let res;
                if (isLocalId) {
                    res = await supabase.from('entries').insert(payload).select().single();
                } else {
                    res = await supabase.from('entries').update(payload).eq('id', entry.id).select().single();
                }

                if (!res.error && res.data) {
                    successCount++;
                    // 개별 성공 시 진짜 번호로 바꿔주고 꼬리표 떼기
                    const idx = currentEntries.findIndex(e => e.id === entry.id);
                    if (idx !== -1) {
                        currentEntries[idx] = { ...currentEntries[idx], id: res.data.id, isSynced: true };
                    }
                } else {
                    console.error("개별 동기화 에러:", res.error);
                }
            }

            // 모두 처리 후 화면에 전체 덮어쓰기
            setEntries(currentEntries);
            syncToStorage(currentEntries);

            if (successCount === pendingEntries.length) {
                return { success: true, message: `✅ ${successCount}건 서버 전송 완료!` };
            } else {
                return { success: false, message: `⚠️ ${successCount}건 성공, ${pendingEntries.length - successCount}건 실패` };
            }
        } catch (error) {
            console.error(error);
            return { success: false, message: '❌ 동기화 실패. 통신 상태를 확인해주세요.' };
        } finally {
            setIsLoading(false);
        }
    }, [entries, isLoggedIn, user]);

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
                                currentEntries.push({ ...row, id: `${prefix}${++ref.current}_${Date.now()}`, timestamp: row.timestamp || new Date().toISOString(), isSynced: false });
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
        return entries.map(({ id, isSynced, ...rest }) => {
            const exportedRow = {};
            exportedRow[fieldMapping['date']?.[lang] || 'Date'] = rest.date;
            exportedRow[fieldMapping['type']?.[lang] || 'Type'] = rest.type === 'income' ? (lang === 'ko' ? '수익' : 'income') : (lang === 'ko' ? '지출' : 'expense');
            return exportedRow;
        });
    };

    const deleteEntry = useCallback(async (id) => {
        setIsLoading(true);
        try {
            if (isLoggedIn && user) {
                await supabase.from('entries').delete().eq('id', id).eq('user_id', user.id);
                setEntries(prev => {
                    const filtered = prev.filter(e => e.id !== id);
                    syncToStorage(filtered);
                    return filtered;
                });
            } else {
                setEntries(prev => {
                    const filtered = prev.filter(e => e.id !== id);
                    syncToStorage(filtered); return filtered;
                });
            }
        } catch (err) { alert(err.message); } finally { setIsLoading(false); }
    }, [isLoggedIn, user]);

    const clearAllEntries = useCallback(async () => {
        if (window.confirm("새로 만드시겠습니까?")) {
            setIsLoading(true);
            try {
                if (isLoggedIn && user) {
                    await supabase.from('entries').delete().eq('user_id', user.id);
                    setEntries([]);
                    localStorage.removeItem('deliveryEntries');
                } else {
                    lastSRef.current = 0; lastZRef.current = 0; setEntries([]); localStorage.removeItem('deliveryEntries');
                }
            } catch (err) { alert(err.message); } finally { setIsLoading(false); }
        }
    }, [isLoggedIn, user]);

    // ✨ 화면(App.js)에 미전송 건수와 동기화 함수를 전달!
    const pendingSyncCount = entries.filter(e => e.isSynced === false).length;

    const memoizedValue = useMemo(() => ({
        entries, saveEntry, deleteEntry, clearAllEntries, importStrictly, getExportData, isLoading, isDataLoaded,
        syncPendingData, pendingSyncCount // ✨ 미전송 처리용 신규 무기 장착
    }), [entries, saveEntry, deleteEntry, clearAllEntries, importStrictly, isLoading, isDataLoaded, syncPendingData, pendingSyncCount]); 

    return (
        <DeliveryContext.Provider value={memoizedValue}>
            {children}
        </DeliveryContext.Provider>
    );
}

export function useDelivery() { return useContext(DeliveryContext); }