// src/utils/dataHandlers.js

import { collection, getDocs, addDoc } from 'firebase/firestore';
import React from 'react'; // JSX를 사용하기 위해 React를 import 합니다.
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

// 데이터를 CSV 파일로 내보내는 함수 (네이티브 저장 방식)
export const exportDataAsCsv = async (db, appId, userId, showMessage) => {
  try {
    const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
    const querySnapshot = await getDocs(entriesCollectionRef);
    const dataToExport = querySnapshot.docs.map(doc => doc.data());

    if (dataToExport.length === 0) {
        showMessage("백업할 데이터가 없습니다.");
        return;
    }

    const headers = ["날짜", "단가", "배송 수량", "반품 수량", "배송중단", "프레시백 수량", "패널티", "산재", "유류비", "유지보수비", "부가세", "종합소득세", "세무사 비용", "타임스탬프"];
    const csvRows = dataToExport.map(entry => {
        const row = [
            entry.date, entry.unitPrice || 0, entry.deliveryCount || 0, entry.returnCount || 0,
            entry.deliveryInterruptionAmount || 0, entry.freshBagCount || 0, entry.penaltyAmount || 0,
            entry.industrialAccidentCost || 0, entry.fuelCost || 0, entry.maintenanceCost || 0,
            entry.vatAmount || 0, entry.incomeTaxAmount || 0, entry.taxAccountantFee || 0,
            entry.timestamp ? new Date(entry.timestamp.seconds * 1000).toISOString() : ''
        ];
        return row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
    });

    // 엑셀에서 한글이 깨지지 않도록 BOM 추가
    const csvString = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `delivery_data_${today}.csv`;

    // 스마트폰 파일 시스템에 직접 저장
    await Filesystem.writeFile({
        path: fileName,
        data: csvString,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
    });
    
    showMessage(`'${fileName}' 파일이 '내 파일' 또는 '문서' 폴더에 저장되었습니다.`);
    
  } catch (error) {
      console.error("Error exporting data:", error);
      showMessage("파일 저장에 실패했습니다. 앱의 저장 공간 권한을 확인해주세요.");
  }
};

// CSV 파일로부터 데이터를 가져오는 함수
export const importDataFromCsv = (event, db, appId, userId, showMessage) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const csvText = e.target.result;
            const lines = csvText.split('\n').filter(line => line.trim() !== '');
            if (lines.length < 2) {
                showMessage("유효한 CSV 파일이 아닙니다 (헤더와 데이터 필요).");
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const headerMap = {
                "날짜": "date", "단가": "unitPrice", "배송 수량": "deliveryCount",
                "반품 수량": "returnCount", "배송중단": "deliveryInterruptionAmount",
                "프레시백 수량": "freshBagCount", "패널티": "penaltyAmount",
                "산재": "industrialAccidentCost", "유류비": "fuelCost",
                "유지보수비": "maintenanceCost", "부가세": "vatAmount",
                "종합소득세": "incomeTaxAmount", "세무사 비용": "taxAccountantFee",
                "타임스탬프": "timestamp"
            };

            const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const item = {};
                headers.forEach((header, index) => {
                    const fieldName = headerMap[header];
                    if (fieldName) {
                        const value = values[index];
                        const numberFields = ['unitPrice', 'deliveryCount', 'returnCount', 'deliveryInterruptionAmount', 'freshBagCount', 'penaltyAmount', 'industrialAccidentCost', 'fuelCost', 'maintenanceCost', 'vatAmount', 'incomeTaxAmount', 'taxAccountantFee'];
                        if (numberFields.includes(fieldName)) {
                            item[fieldName] = parseFloat(value) || 0;
                        } else {
                            item[fieldName] = value;
                        }
                    }
                });
                if (item.date) {
                    item.timestamp = new Date();
                    await addDoc(entriesCollectionRef, item);
                }
            }
            showMessage("데이터 백업(CSV)가 완료되었습니다.");
        } catch (error) {
            console.error("Error importing data:", error);
            showMessage("데이터 복원(CSV)에 실패했습니다. 파일 형식을 확인해주세요.");
        } finally {
            event.target.value = null;
        }
    };
    reader.readAsText(file, 'EUC-KR');
};