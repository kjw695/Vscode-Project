import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';

const DeliveryContext = createContext();

export function DeliveryProvider({ children }) {
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // [추가] 초기 데이터 로딩이 끝났는지 확인하는 상태
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const lastSRef = useRef(0);
    const lastZRef = useRef(0);

    const isKoreanSystem = navigator.language?.startsWith('ko');

    const fieldMapping = {
        date: { ko: '날짜', en: 'Date' },
        type: { ko: '구분', en: 'Type' }, 
        round: { ko: '회전', en: 'Round' },
        unitPrice: { ko: '단가', en: 'UnitPrice' },
        deliveryCount: { ko: '배송건수', en: 'DeliveryCount' },
        returnCount: { ko: '반품건수', en: 'ReturnCount' },
        freshBagCount: { ko: '프레시백', en: 'FreshBagCount' },
        deliveryInterruptionAmount: { ko: '중단금액', en: 'InterruptionAmount' },
        timestamp: { ko: '기록시간', en: 'Timestamp' }
    };

    // 초기 로드
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
            // [핵심] 데이터를 다 불러온 뒤에 "로딩 끝!" 도장을 찍음
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

    const zeroIfEmpty = (val) => (val === null || val === undefined || val === '') ? 0 : Number(val);

    const isDuplicate = (existing, incoming) => {
        return existing.date === incoming.date &&
               existing.type === incoming.type && 
               zeroIfEmpty(existing.round) === zeroIfEmpty(incoming.round) && 
               zeroIfEmpty(existing.unitPrice) === zeroIfEmpty(incoming.unitPrice) &&
               zeroIfEmpty(existing.deliveryCount) === zeroIfEmpty(incoming.deliveryCount) &&
               zeroIfEmpty(existing.returnCount) === zeroIfEmpty(incoming.returnCount) &&
               zeroIfEmpty(existing.freshBagCount) === zeroIfEmpty(incoming.freshBagCount) &&
               zeroIfEmpty(existing.deliveryInterruptionAmount) === zeroIfEmpty(incoming.deliveryInterruptionAmount);
    };

    const saveEntry = useCallback((entryData) => {
        setIsLoading(true);
        try {
            const numericFields = ['unitPrice', 'deliveryCount', 'returnCount', 'freshBagCount', 'deliveryInterruptionAmount', 'round'];
            numericFields.forEach(field => {
                if (entryData[field] && isNaN(Number(entryData[field]))) {
                    throw new Error(`${fieldMapping[field]?.ko || field} 항목에 잘못된 값이 있습니다.`);
                }
            });

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

                if (nextEntries.some(e => isDuplicate(e, entryData))) {
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

                    incomeGroup.forEach(row => {
                        if (currentEntries.some(e => isDuplicate(e, row))) {
                            skippedCount++;
                            return;
                        }
                        currentEntries.push({
                            ...row,
                            id: `s${++lastSRef.current}`, 
                            timestamp: row.timestamp || new Date().toISOString()
                        });
                        addedCount++;
                    });

                    expenseGroup.forEach(row => {
                        if (currentEntries.some(e => isDuplicate(e, row))) {
                            skippedCount++;
                            return;
                        }
                        currentEntries.push({
                            ...row,
                            id: `z${++lastZRef.current}`,
                            timestamp: row.timestamp || new Date().toISOString()
                        });
                        addedCount++;
                    });

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
            Object.keys(rest).forEach(sysKey => {
                const label = fieldMapping[sysKey] ? fieldMapping[sysKey][lang] : sysKey;
                let value = rest[sysKey];
                
                if (sysKey === 'type') {
                    value = value === 'income' ? (lang === 'ko' ? '수익' : 'income') : (lang === 'ko' ? '지출' : 'expense');
                }
                exportedRow[label] = value;
            });
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
        entries,
        saveEntry,
        deleteEntry,
        clearAllEntries,
        importStrictly,
        getExportData,
        isLoading,
        isDataLoaded // [공개] App.js에서 로딩 상태 확인용
    }), [entries, saveEntry, importStrictly, isLoading, isDataLoaded]);

    return (
        <DeliveryContext.Provider value={memoizedValue}>
            {children}
        </DeliveryContext.Provider>
    );
}

export function useDelivery() { return useContext(DeliveryContext); }