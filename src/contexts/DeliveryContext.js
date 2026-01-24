import React, { createContext, useState, useEffect, useContext } from 'react';

// 데이터 관리 전용 저장소 생성
const DeliveryContext = createContext();

export function DeliveryProvider({ children }) {
    const [entries, setEntries] = useState([]);

    // 1. 앱 켜질 때 데이터 불러오기
    useEffect(() => {
        const savedEntries = localStorage.getItem('deliveryEntries');
        if (savedEntries) {
            try {
                const parsed = JSON.parse(savedEntries);
                // 날짜 내림차순 정렬 (최신순)
                parsed.sort((a, b) => new Date(b.date) - new Date(a.date));
                setEntries(parsed);
            } catch (e) {
                console.error("데이터 로드 실패:", e);
            }
        }
    }, []);

    // 2. 내부 저장 함수 (localStorage 동기화)
    const saveToLocalStorage = (newEntries) => {
        // 날짜순 정렬
        newEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
        setEntries(newEntries);
        localStorage.setItem('deliveryEntries', JSON.stringify(newEntries));
    };

    // 3. 데이터 추가/수정 함수 (🔥 핵심 수정 완료)
    const saveEntry = (entryData) => {
        let newEntries = [...entries];
        const targetRound = entryData.round || 0;
        
        // 🔥 [수정된 로직]
        // 날짜나 회전이 같아도 신경 쓰지 않습니다.
        // 오직 'ID(주민번호)'가 일치할 때만 "수정"으로 처리합니다.
        // ID가 없으면 무조건 "새로운 데이터"로 추가합니다. (단가가 달라도 따로 저장됨)
        
        const existingIndex = entryData.id 
            ? newEntries.findIndex(e => e.id === entryData.id)
            : -1;

        if (existingIndex !== -1) {
            // 수정 (ID가 있어서 찾았을 때만)
            newEntries[existingIndex] = { 
                ...newEntries[existingIndex], 
                ...entryData, 
                round: targetRound 
            };
        } else {
            // 신규 추가 (ID가 없으면 무조건 여기로 옴)
            // 1회전 1개 입력 후 또 1회전 1개 입력해도, 따로 저장됩니다.
            newEntries.push({
                id: crypto.randomUUID(), // 새 ID 발급
                timestamp: new Date().toISOString(),
                ...entryData,
                round: targetRound
            });
        }

        saveToLocalStorage(newEntries);
    };

    // 4. 삭제 함수
    const deleteEntry = (id) => {
        const newEntries = entries.filter(e => e.id !== id);
        saveToLocalStorage(newEntries);
    };

    // 5. 전체 삭제 (초기화)
    const clearAllEntries = () => {
        saveToLocalStorage([]);
    };

    return (
        <DeliveryContext.Provider value={{ entries, saveEntry, deleteEntry, clearAllEntries, saveToLocalStorage }}>
            {children}
        </DeliveryContext.Provider>
    );
}

// 다른 파일에서 쉽게 쓰기 위한 커스텀 훅
export function useDelivery() {
    return useContext(DeliveryContext);
}