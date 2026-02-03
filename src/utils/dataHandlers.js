import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { parse } from 'papaparse'; 

// 1. CSV 내보내기 (Capacitor Native 공유 적용)
export const exportDataAsCsv = async (entries, showMessage) => {
    try {
        if (!entries || entries.length === 0) {
            showMessage("내보낼 데이터가 없습니다.");
            return;
        }

        // 헤더 생성
        let csvContent = "날짜,회차,구분,항목명,수량,단가,금액,메모\n";

        // 데이터 조립
        entries.forEach(entry => {
            const date = entry.date;
            const round = entry.round || 0;
            const note = ""; 

            // [1] 기본 수익 항목
            if (entry.deliveryCount > 0) csvContent += `${date},${round},수익,배송,${entry.deliveryCount},${entry.unitPrice},${entry.deliveryCount * entry.unitPrice},${note}\n`;
            if (entry.returnCount > 0) csvContent += `${date},${round},수익,반품,${entry.returnCount},${entry.unitPrice},${entry.returnCount * entry.unitPrice},${note}\n`;
            if (entry.deliveryInterruptionAmount > 0) csvContent += `${date},${round},수익,배송중단,${entry.deliveryInterruptionAmount},${entry.unitPrice},${entry.deliveryInterruptionAmount * entry.unitPrice},${note}\n`;
            if (entry.freshBagCount > 0) csvContent += `${date},${round},수익,프레시백,${entry.freshBagCount},${entry.unitPrice},${entry.freshBagCount * entry.unitPrice},${note}\n`;

            // [2] 커스텀 항목
            if (entry.customItems && Array.isArray(entry.customItems)) {
                entry.customItems.forEach(item => {
                    const typeLabel = item.type === 'income' ? '수익' : '지출';
                    const amount = Number(item.amount) || 0;
                    const count = Number(item.count) || 0;
                    const unitPrice = Number(item.unitPrice) || 0;
                    
                    let total = amount;
                    if (count > 0 && unitPrice > 0) total += (count * unitPrice);
                    else if (amount === 0 && count > 0 && unitPrice === 0) total = amount;

                    csvContent += `${date},${round},${typeLabel},${item.name || item.key},${count},${unitPrice},${total},${note}\n`;
                });
            }

            // [3] 기본 지출 항목
            const legacyExpenses = [
                { key: 'penaltyAmount', label: '패널티' },
                { key: 'industrialAccidentCost', label: '산재보험' },
                { key: 'fuelCost', label: '유류비' },
                { key: 'maintenanceCost', label: '정비비' },
                { key: 'vatAmount', label: '부가세' },
                { key: 'incomeTaxAmount', label: '소득세' },
                { key: 'taxAccountantFee', label: '세무사비' }
            ];

            legacyExpenses.forEach(exp => {
                const val = entry[exp.key];
                if (val > 0) csvContent += `${date},${round},지출,${exp.label},1,${val},${val},${note}\n`;
            });
        });

        const date = new Date().toISOString().split('T')[0];
        const fileName = `배달장부_상세내역_${date}.csv`;

        // ---------------------------------------------------------
        // [핵심 변경] Capacitor Native 공유 기능 사용
        // ---------------------------------------------------------
        if (Capacitor.isNativePlatform()) {
            try {
                // 1. 캐시 디렉토리에 파일 쓰기 (한글 깨짐 방지 BOM 추가)
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: "\uFEFF" + csvContent,
                    directory: Directory.Cache,
                    encoding: Encoding.UTF8,
                });

                // 2. 해당 파일 공유하기 (공유 창 띄우기)
                await Share.share({
                    title: '배달장부 엑셀 파일',
                    text: `${date} 기준 상세 내역 파일입니다.`,
                    url: savedFile.uri, // 파일 경로 전달
                    dialogTitle: '엑셀 파일 공유하기'
                });
                
            } catch (nativeError) {
                console.error("Native Share Failed:", nativeError);
                // 사용자가 취소한 경우 등은 무시
                if (nativeError.message !== 'Share canceled') {
                    showMessage("공유 창을 여는 데 실패했습니다.");
                }
            }
        } else {
            // [웹/PC 환경] 기존 다운로드 방식 유지
            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            if(showMessage) showMessage("PC/웹: 다운로드 폴더에 저장되었습니다.");
        }

    } catch (error) {
        console.error("CSV Export Error:", error);
        if(showMessage) showMessage("CSV 내보내기 오류: " + error.message);
    }
};

// 2. CSV 불러오기 (기존 유지)
export const parseCsvData = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const csvText = event.target.result;
            const lines = csvText.split(/\r\n|\n/);
            const groupedData = {};

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cols = line.split(',');
                if (cols.length < 7) continue;

                const date = cols[0];
                const round = Number(cols[1]) || 0;
                const type = cols[2]; 
                const name = cols[3];
                const count = Number(cols[4]) || 0;
                const unitPrice = Number(cols[5]) || 0;
                const total = Number(cols[6]) || 0;

                const key = `${date}_${round}`;

                if (!groupedData[key]) {
                    groupedData[key] = {
                        id: Date.now() + Math.random().toString(),
                        date: date,
                        round: round,
                        type: 'income', 
                        unitPrice: 0, 
                        customItems: [],
                        deliveryCount: 0, returnCount: 0, deliveryInterruptionAmount: 0, freshBagCount: 0,
                        fuelCost: 0, maintenanceCost: 0, 
                    };
                }
                const entry = groupedData[key];
                
                // 데이터 매핑 로직 (기존과 동일)
                if (name === '배송') {
                    entry.deliveryCount += count;
                    if (unitPrice > 0) entry.unitPrice = unitPrice;
                } else if (name === '반품') {
                    entry.returnCount += count;
                } else if (name === '배송중단') {
                    entry.deliveryInterruptionAmount += count;
                } else if (name === '프레시백') {
                    entry.freshBagCount += count;
                } else if (['패널티','산재보험','유류비','정비비','부가세','소득세','세무사비'].includes(name)) {
                    entry.customItems.push({ id: Date.now() + Math.random(), type: 'expense', name: name, amount: total, count: 1 });
                } else {
                    entry.customItems.push({
                        id: Date.now() + Math.random(), type: type === '수익' ? 'income' : 'expense',
                        name: name, count: count, unitPrice: unitPrice, amount: total - (count * unitPrice) 
                    });
                }
            }
            const parsedEntries = Object.values(groupedData);
            if (parsedEntries.length > 0) resolve(parsedEntries);
            else reject(new Error("유효한 데이터가 없습니다."));
        };
        reader.onerror = () => reject(new Error("파일 읽기 실패"));
        reader.readAsText(file);
    });
};

// [스마트 백업 - JSON] (Capacitor Native 공유 적용)
export const shareBackupData = async (entries) => {
    try {
        const jsonString = JSON.stringify(entries, null, 2);
        const date = new Date().toISOString().split('T')[0];
        const fileName = `delivery_backup_${date}.json`;

        if (Capacitor.isNativePlatform()) {
            // [앱 환경] Filesystem + Share 플러그인 사용
            try {
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: jsonString,
                    directory: Directory.Cache,
                    encoding: Encoding.UTF8,
                });

                await Share.share({
                    title: '배달 앱 데이터 백업',
                    text: `${date} 기준 배달 데이터 백업 파일입니다.`,
                    url: savedFile.uri,
                });
                return true;
            } catch (err) {
                if (err.message !== 'Share canceled') throw err;
                return true; 
            }
        } else {
            // [웹 환경] 기존 방식
            const file = new File([jsonString], fileName, { type: 'application/json' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: '배달 앱 데이터 백업',
                    text: `${date} 기준 배달 데이터 백업 파일입니다.`,
                    files: [file]
                });
                return true;
            } else {
                const url = URL.createObjectURL(file);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
                return 'downloaded';
            }
        }
    } catch (error) {
        console.error('Backup failed:', error);
        return false;
    }
};

// [스마트 복원 - JSON] (기존 유지)
export const parseJsonData = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) resolve(data);
                else reject(new Error("올바른 백업 파일 형식이 아닙니다."));
            } catch (err) {
                reject(new Error("파일을 읽을 수 없습니다."));
            }
        };
        reader.onerror = () => reject(new Error("파일 읽기 실패"));
        reader.readAsText(file);
    });
};