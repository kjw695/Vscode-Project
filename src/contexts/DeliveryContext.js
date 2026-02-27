import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { isDuplicateEntry } from '../utils/calculator';

const DeliveryContext = createContext();

export function DeliveryProvider({ children }) {
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const lastSRef = useRef(0);
    const lastZRef = useRef(0);

    const isKoreanSystem = navigator.language?.startsWith('ko');

    const fieldMapping = {
        date: { ko: '날짜', en: 'Date' },
        type: { ko: '구분', en: 'Type' }, 
        timestamp: { ko: '기록시간', en: 'Timestamp' }
    };

    useEffect(() => {
        const loadData = async () => {
            const saved = localStorage.getItem('deliveryEntries');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    updateLastIdRefs(parsed);
                    setEntries(parsed);
                } catch (e) {
                    console.error("데이터 로드 실패", e);
                }
            }
            setIsDataLoaded(true);
        };
        loadData();
    }, []);

    const updateLastIdRefs = (data) => {
        const sNums = data.filter(e => e.id?.startsWith('s')).map(e => parseInt(e.id.slice(1)) || 0);
        const zNums = data.filter(e => e.id?.startsWith('z')).map(e => parseInt(e.id.slice(1)) || 0);
        lastSRef.current = sNums.length > 0 ? Math.max(...sNums) : 0;
        lastZRef.current = zNums.length > 0 ? Math.max(...zNums) : 0;
    };

    const syncToStorage = (data) => {
        const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem('deliveryEntries', JSON.stringify(sorted));
    };

    const saveEntry = useCallback((entryData) => {
        setIsLoading(true);
        try {
            setEntries(prev => {
                let nextEntries = [...prev];

                if (entryData.id) {
                    const idx = nextEntries.findIndex(e => e.id === entryData.id);
                    if (idx !== -1) {
                        nextEntries[idx] = { ...nextEntries[idx], ...entryData };
                        syncToStorage(nextEntries);
                        return nextEntries;
                    }
                }

                if (nextEntries.some(e => isDuplicateEntry(e, entryData))) {
                    throw new Error("이미 완전히 동일한 데이터가 존재합니다.");
                }

                const prefix = entryData.type === 'income' ? 's' : 'z';
                const nextNum = (entryData.type === 'income' ? ++lastSRef.current : ++lastZRef.current);
                const finalEntry = { ...entryData, id: `${prefix}${nextNum}`, timestamp: new Date().toISOString() };
                
                const updated = [...nextEntries, finalEntry];
                syncToStorage(updated);
                return updated;
            });
        } catch (error) {
            alert(error.message);
            throw error; 
        } finally {
            setIsLoading(false);
        }
    }, []);

    const importStrictly = useCallback((incomingData) => {
        setIsLoading(true);
        return new Promise((resolve, reject) => {
            try {
                setEntries(prev => {
                    let currentEntries = [...prev];
                    let addedCount = 0;
                    let skippedCount = 0;

                    const incomeGroup = incomingData.filter(d => d.type === 'income');
                    const expenseGroup = incomingData.filter(d => d.type === 'expense');

                    const processGroup = (group, prefix, ref) => {
                        group.forEach(row => {
                            if (currentEntries.some(e => isDuplicateEntry(e, row))) {
                                skippedCount++;
                                return;
                            }
                            currentEntries.push({ ...row, id: `${prefix}${++ref.current}`, timestamp: row.timestamp || new Date().toISOString() });
                            addedCount++;
                        });
                    };

                    processGroup(incomeGroup, 's', lastSRef);
                    processGroup(expenseGroup, 'z', lastZRef);

                    syncToStorage(currentEntries);
                    resolve({ added: addedCount, skipped: skippedCount });
                    return currentEntries;
                });
            } catch (error) {
                reject(error);
            } finally {
                setIsLoading(false);
            }
        });
    }, []);

    const getExportData = () => {
        const lang = isKoreanSystem ? 'ko' : 'en';
        return entries.map(({ id, ...rest }) => {
            const exportedRow = {};
            // 커스텀 항목 내보내기 로직은 필요에 따라 추가
            exportedRow[fieldMapping['date']?.[lang] || 'Date'] = rest.date;
            exportedRow[fieldMapping['type']?.[lang] || 'Type'] = rest.type === 'income' ? (lang === 'ko' ? '수익' : 'income') : (lang === 'ko' ? '지출' : 'expense');
            return exportedRow;
        });
    };

    const deleteEntry = (id) => {
        setEntries(prev => {
            const filtered = prev.filter(e => e.id !== id);
            syncToStorage(filtered);
            return filtered;
        });
    };

    const clearAllEntries = () => {
        if (window.confirm("장부를 새로 만드시겠습니까?")) {
            lastSRef.current = 0;
            lastZRef.current = 0;
            setEntries([]);
            localStorage.removeItem('deliveryEntries');
        }
    };

    const memoizedValue = useMemo(() => ({
        entries, saveEntry, deleteEntry, clearAllEntries, importStrictly, getExportData, isLoading, isDataLoaded
    }), [entries, saveEntry, importStrictly, isLoading, isDataLoaded]);

    return (
        <DeliveryContext.Provider value={memoizedValue}>
            {children}
        </DeliveryContext.Provider>
    );
}

export function useDelivery() { return useContext(DeliveryContext); }