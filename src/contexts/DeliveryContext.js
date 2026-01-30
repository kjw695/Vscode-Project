import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';

const DeliveryContext = createContext();

export function DeliveryProvider({ children }) {
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const lastSRef = useRef(0);
    const lastZRef = useRef(0);

    // ✨ 원칙 2: 핸드폰 시스템 언어 확인
    const isKoreanSystem = navigator.language?.startsWith('ko');

    // 필드명 매핑
    const fieldMapping = {
        date: { ko: '날짜', en: 'Date' },
        type: { ko: '구분', en: 'Type' }, 
        unitPrice: { ko: '단가', en: 'UnitPrice' },
        deliveryCount: { ko: '배송건수', en: 'DeliveryCount' },
        returnCount: { ko: '반품건수', en: 'ReturnCount' },
        freshBagCount: { ko: '프레시백', en: 'FreshBagCount' },
        deliveryInterruptionAmount: { ko: '중단금액', en: 'InterruptionAmount' },
        timestamp: { ko: '기록시간', en: 'Timestamp' }
    };

    // 초기 로딩: 마지막 번호 파악
    useEffect(() => {
        const saved = localStorage.getItem('deliveryEntries');
        if (saved) {
            const parsed = JSON.parse(saved);
            updateLastIdRefs(parsed);
            setEntries(parsed);
        }
    }, []);

    const updateLastIdRefs = (data) => {
        const sNums = data.filter(e => e.id?.startsWith('s')).map(e => parseInt(e.id.slice(1)) || 0);
        const zNums = data.filter(e => e.id?.startsWith('z')).map(e => parseInt(e.id.slice(1)) || 0);
        lastSRef.current = sNums.length > 0 ? Math.max(...sNums) : 0;
        lastZRef.current = zNums.length > 0 ? Math.max(...zNums) : 0;
    };

    const translateToSystemKey = (fileKey) => {
        for (const [sysKey, labels] of Object.entries(fieldMapping)) {
            if (fileKey === labels.ko || fileKey === labels.en || fileKey === sysKey) return sysKey;
        }
        return fileKey;
    };

    const translateToSystemValue = (val) => {
        if (val === '수익' || val === 'income') return 'income';
        if (val === '지출' || val === 'expense') return 'expense';
        return val;
    };

    // ✨ 원칙 3: 빈칸을 0으로 간주하는 변환기 추가
    const zeroIfEmpty = (val) => (val === null || val === undefined || val === '') ? 0 : Number(val);

    // ✨ 원칙 3: 모든 데이터 값이 일치할 때만 중복 (빈칸=0 포함)
    const isDuplicate = (existing, incoming) => {
        const incomingType = translateToSystemValue(incoming.type);
        return existing.date === incoming.date &&
               existing.type === incomingType &&
               zeroIfEmpty(existing.unitPrice) === zeroIfEmpty(incoming.unitPrice) &&
               zeroIfEmpty(existing.deliveryCount) === zeroIfEmpty(incoming.deliveryCount) &&
               zeroIfEmpty(existing.returnCount) === zeroIfEmpty(incoming.returnCount) &&
               zeroIfEmpty(existing.freshBagCount) === zeroIfEmpty(incoming.freshBagCount) &&
               zeroIfEmpty(existing.deliveryInterruptionAmount) === zeroIfEmpty(incoming.deliveryInterruptionAmount);
    };

    const saveEntry = useCallback((entryData) => {
        setIsLoading(true);
        try {
            // ✨ 원칙 4: 숫자가 필요한 칸에 글자 유입 시 즉시 중단
            const numericFields = ['unitPrice', 'deliveryCount', 'returnCount', 'freshBagCount', 'deliveryInterruptionAmount'];
            numericFields.forEach(field => {
                if (entryData[field] && isNaN(Number(entryData[field]))) {
                    throw new Error(`${fieldMapping[field]?.ko || field} 항목에 숫자가 아닌 값이 들어있습니다.`);
                }
            });

            setEntries(prev => {
                let nextEntries = [...prev];

                // 수정 시 ID 유지
                if (entryData.id) {
                    const idx = nextEntries.findIndex(e => e.id === entryData.id);
                    if (idx !== -1) {
                        nextEntries[idx] = { ...nextEntries[idx], ...entryData };
                        syncToStorage(nextEntries);
                        return nextEntries;
                    }
                }

                if (nextEntries.some(e => isDuplicate(e, entryData))) {
                    throw new Error("이미 동일한 내용의 데이터가 존재합니다.");
                }

                // 신규 ID 발급
                const prefix = entryData.type === 'income' ? 's' : 'z';
                const nextNum = (entryData.type === 'income' ? ++lastSRef.current : ++lastZRef.current);
                const finalEntry = { ...entryData, id: `${prefix}${nextNum}`, timestamp: new Date().toISOString() };
                
                const updated = [...nextEntries, finalEntry];
                syncToStorage(updated);
                return updated;
            });
        } catch (error) {
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ✨ 원칙 1: 복원 시 무조건 새 ID 지급 및 중복 검사
    const importStrictly = (incomingData) => {
        setIsLoading(true);
        try {
            setEntries(prev => {
                let currentEntries = [...prev];
                let addedCount = 0;
                let skippedCount = 0;

                incomingData.forEach((row) => {
                    const sanitizedRow = {};
                    Object.keys(row).forEach(fileKey => {
                        const sysKey = translateToSystemKey(fileKey);
                        let val = row[fileKey];
                        if (sysKey === 'type') val = translateToSystemValue(val);
                        sanitizedRow[sysKey] = val;
                    });

                    if (currentEntries.some(e => isDuplicate(e, sanitizedRow))) {
                        skippedCount++;
                        return;
                    }

                    // 무조건 현재 장부 기준 새 ID 부여
                    const prefix = sanitizedRow.type === 'income' ? 's' : 'z';
                    const nextNum = (sanitizedRow.type === 'income' ? ++lastSRef.current : ++lastZRef.current);
                    
                    currentEntries.push({
                        ...sanitizedRow,
                        id: `${prefix}${nextNum}`,
                        timestamp: sanitizedRow.timestamp || new Date().toISOString()
                    });
                    addedCount++;
                });

                syncToStorage(currentEntries);
                alert(`복원 완료: ${addedCount}건 추가 (중복 ${skippedCount}건 제외)`);
                return currentEntries;
            });
        } catch (error) {
            alert("복원 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    // ✨ 원칙 2: 언어 설정에 따른 필드명 한글/영어 변환 (ID 삭제 포함)
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

    const syncToStorage = (data) => {
        const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem('deliveryEntries', JSON.stringify(sorted));
    };

    const deleteEntry = (id) => {
        const filtered = entries.filter(e => e.id !== id);
        setEntries(filtered);
        syncToStorage(filtered);
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
        isLoading
    }), [entries, saveEntry, isLoading]);

    return (
        <DeliveryContext.Provider value={memoizedValue}>
            {children}
        </DeliveryContext.Provider>
    );
}

export function useDelivery() { return useContext(DeliveryContext); }