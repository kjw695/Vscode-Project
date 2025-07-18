// src/utils/dataHandlers.js

import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * 데이터를 CSV 파일로 내보내는 함수 (웹/모바일 호환)
 */
export const exportDataAsCsv = async (db, appId, userId, showMessage) => {
    if (!userId) {
        showMessage("로그인이 필요합니다.");
        return;
    }
    
    try {
        const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
        const querySnapshot = await getDocs(entriesCollectionRef);
        const dataToExport = querySnapshot.docs.map(doc => doc.data());

        if (dataToExport.length === 0) {
            showMessage("내보낼 데이터가 없습니다.");
            return;
        }

        const headers = ["날짜", "단가", "배송 수량", "반품 수량", "배송중단", "프레시백 수량", "패널티", "산재", "유류비", "유지보수비", "부가세", "종합소득세", "세무사 비용", "타임스탬프"];
        const csvRows = dataToExport.map(entry => {
            const row = [
                entry.date, entry.unitPrice || 0, entry.deliveryCount || 0, entry.returnCount || 0,
                entry.deliveryInterruptionAmount || 0, entry.freshBagCount || 0, entry.penaltyAmount || 0,
                entry.industrialAccidentCost || 0, entry.fuelCost || 0, entry.maintenanceCost || 0,
                entry.vatAmount || 0, entry.incomeTaxAmount || 0, entry.taxAccountantFee || 0,
                entry.timestamp?.seconds ? new Date(entry.timestamp.seconds * 1000).toISOString() : ''
            ];
            return row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',');
        });

        const csvString = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
        const fileName = `delivery_data_${new Date().toISOString().slice(0, 10)}.csv`;

        // 웹 브라우저 환경일 경우 (기존 방식 유지)
      if (!Capacitor.isNativePlatform()) {
          const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          showMessage("CSV 파일 다운로드가 완료되었습니다.");
          return; // 여기서 함수 종료
      }
      
      // 모바일(네이티브) 환경일 경우 (새로운 공유 방식)
      // 1. 앱의 안전한 임시 공간(Cache)에 파일 저장
      const result = await Filesystem.writeFile({
          path: fileName,
          data: csvString,
          directory: Directory.Cache, // 저장 위치를 Cache로 변경
          encoding: Encoding.UTF8,
      });

      // 2. 저장된 파일을 안드로이드 '공유' 메뉴로 전달
      await Share.share({
          title: fileName,
          text: '배송 수익 데이터 내보내기',
          url: result.uri, // 저장된 파일의 시스템 경로를 사용
          dialogTitle: '파일 공유 또는 저장하기'
      });

    showMessage("파일 내보내기가 완료되었습니다.");


    } catch (error) {
        showMessage(`내보내기 실패: ${error.message}`);
        console.error(error);
    }
};

/**
 * CSV 파일로부터 데이터를 가져오는 함수 (중복 방지 및 결과 카운트 기능 포함)
 */
export const importDataFromCsv = async (file, db, appId, userId, showMessage, setIsLoading) => {
    if (!userId || !file) {
        showMessage("로그인 후 파일을 선택해주세요.");
        return;
    }

    setIsLoading(true); 
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
            const querySnapshot = await getDocs(entriesCollectionRef);
            
            const existingEntries = new Set(querySnapshot.docs.map(d => {
                const data = d.data();
                return `${data.date}-${data.deliveryCount || 0}-${data.returnCount || 0}-${data.penaltyAmount || 0}`;
            }));

            const csvText = e.target.result;
            const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) throw new Error("유효한 CSV 파일이 아닙니다.");

            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const headerMap = { "날짜": "date", "단가": "unitPrice", "배송 수량": "deliveryCount", "반품 수량": "returnCount", "배송중단": "deliveryInterruptionAmount", "프레시백 수량": "freshBagCount", "패널티": "penaltyAmount", "산재": "industrialAccidentCost", "유류비": "fuelCost", "유지보수비": "maintenanceCost", "부가세": "vatAmount", "종합소득세": "incomeTaxAmount", "세무사 비용": "taxAccountantFee" };
            
            const batch = writeBatch(db);
            let newEntryCount = 0;
            let duplicateCount = 0;

            lines.slice(1).forEach(line => {
                const values = line.match(/(".*?"|[^",]+)(,|$)/g).map(v => v.replace(/,$/, '').replace(/"/g, ''));
                const item = {};
                headers.forEach((header, index) => {
                    const fieldName = headerMap[header];
                    if (fieldName) {
                        const value = values[index];
                        const numFields = ['unitPrice', 'deliveryCount', 'returnCount', 'deliveryInterruptionAmount', 'freshBagCount', 'penaltyAmount', 'industrialAccidentCost', 'fuelCost', 'maintenanceCost', 'vatAmount', 'incomeTaxAmount', 'taxAccountantFee'];
                        item[fieldName] = numFields.includes(fieldName) ? parseFloat(value) || 0 : value;
                    }
                });
                const entryIdentifier = `${item.date}-${item.deliveryCount || 0}-${item.returnCount || 0}-${item.penaltyAmount || 0}`;
                if (item.date && !existingEntries.has(entryIdentifier)) {
                    item.timestamp = new Date();
                    batch.set(doc(entriesCollectionRef), item);
                    newEntryCount++;
                } else if (item.date) {
                    duplicateCount++;
                }
            });

            if (newEntryCount > 0) {
                await batch.commit();
            }
            let resultMessage = `총 ${lines.length - 1}건 중 ${newEntryCount}개의 새 데이터를 추가했습니다.`;
            if (duplicateCount > 0) {
                resultMessage += `\n(중복된 데이터 ${duplicateCount}건은 제외)`;
            }
            showMessage(resultMessage);

        } catch (error) {
            showMessage(`가져오기 실패: ${error.message}`);
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };
    reader.readAsText(file, "EUC-KR");
};

/**
 * 사용자의 모든 데이터를 삭제하는 함수
 */
export const deleteAllData = async (db, appId, userId, showMessage, setIsLoading) => {
    if (!userId) {
        showMessage("로그인이 필요합니다.");
        return;
    }
    
    setIsLoading(true);

    try {
        const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
        const querySnapshot = await getDocs(entriesCollectionRef);
        if (querySnapshot.empty) {
            showMessage("삭제할 데이터가 없습니다.");
            return;
        }
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        showMessage("모든 데이터가 성공적으로 삭제되었습니다.");
    } catch (error) {
        showMessage(`삭제 실패: ${error.message}`);
        console.error(error);
    } finally {
        setIsLoading(false);
    }
};