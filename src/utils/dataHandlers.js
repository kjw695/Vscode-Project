import { collection, getDocs, addDoc, writeBatch, doc } from 'firebase/firestore';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

// 데이터를 CSV 파일로 내보내는 함수 (백업 기능)
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
            entry.date || '',
            entry.unitPrice || 0,
            entry.deliveryCount || 0,
            entry.returnCount || 0,
            entry.deliveryInterruptionAmount || 0,
            entry.freshBagCount || 0,
            entry.penaltyAmount || 0,
            entry.industrialAccidentCost || 0,
            entry.fuelCost || 0,
            entry.maintenanceCost || 0,
            entry.vatAmount || 0,
            entry.incomeTaxAmount || 0,
            entry.taxAccountantFee || 0,
            entry.timestamp ? new Date(entry.timestamp.seconds * 1000).toISOString() : new Date().toISOString()
        ];
        return row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
    });

    const csvString = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `delivery_data_${today}.csv`;

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

// CSV/TSV 파일을 자동으로 감지하여 가져오는 함수 (복원 기능)
export const importDataFromCsv = async (event, db, appId, userId, showMessage, setIsLoading, setModalContent) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setModalContent('데이터를 복원 중입니다. 잠시만 기다려주세요...');

   const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
            const querySnapshot = await getDocs(entriesCollectionRef);
            // '날짜' 필드만으로 중복을 확인하여 더 빠르고 정확함
            const existingDates = new Set(querySnapshot.docs.map(doc => doc.data().date));

            let fileContent = e.target.result;
            if (fileContent.charCodeAt(0) === 0xFEFF) {
                fileContent = fileContent.substring(1);
            }

            const lines = fileContent.split(/\r\n|\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                throw new Error("유효한 데이터 파일이 아닙니다.");
            }

            const headerLine = lines[0];
            const delimiter = (headerLine.match(/\t/g) || []).length > (headerLine.match(/,/g) || []).length ? '\t' : ',';
            
            const fieldOrder = ["date", "unitPrice", "deliveryCount", "returnCount", "deliveryInterruptionAmount", "freshBagCount", "penaltyAmount", "industrialAccidentCost", "fuelCost", "maintenanceCost", "vatAmount", "incomeTaxAmount", "taxAccountantFee", "timestamp"];
            
            // 데이터를 한 번에 쓰기 위한 Batch 작업 생성
            const batch = writeBatch(db);
            let importedCount = 0;
            let skippedCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // 데이터에 쉼표나 따옴표가 있어도 안전하게 파싱하는 정규표현식
                const regex = new RegExp(`(\\"(?:[^\\"]|\\"\\")*\\"|[^\\"${delimiter}\\r\\n]*)(?=\\s*\\${delimiter}|\\s*$)`, 'g');
                const values = (line.match(regex) || []).map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));

                const item = {};
                let hasValidData = false;

                fieldOrder.forEach((fieldName, index) => {
                    const value = values[index] || '';
                    if (value && fieldName !== 'date') hasValidData = true;

                    const numberFields = ['unitPrice', 'deliveryCount', 'returnCount', 'deliveryInterruptionAmount', 'freshBagCount', 'penaltyAmount', 'industrialAccidentCost', 'fuelCost', 'maintenanceCost', 'vatAmount', 'incomeTaxAmount', 'taxAccountantFee'];
                    
                    if (numberFields.includes(fieldName)) {
                        item[fieldName] = parseFloat(value) || 0;
                    } else if (fieldName === 'timestamp' && value) {
                        item[fieldName] = new Date(value);
                    } else {
                        item[fieldName] = value;
                    }
                });
                
                // 날짜가 유효하고, 중복되지 않으며, 다른 데이터가 하나라도 있을 경우에만 추가
                if (item.date && hasValidData && !existingDates.has(item.date)) {
                    if (!item.timestamp) item.timestamp = new Date();
                    
                    // Batch에 쓰기 작업을 추가 (아직 서버로 전송 안 함)
                    const newDocRef = doc(entriesCollectionRef); // 새 문서 참조 생성
                    batch.set(newDocRef, item);
                    importedCount++;
                } else {
                    skippedCount++;
                }
            }

            // Batch 작업을 한 번에 서버로 전송하여 성능 대폭 향상
            if (importedCount > 0) {
                await batch.commit();
            }
            
            let resultMessage = `${importedCount}개의 새로운 데이터를 추가했습니다.`;
            if (skippedCount > 0) {
                resultMessage += `\n(중복 및 빈 데이터 ${skippedCount}개는 건너뛰었습니다.)`;
            }
            
            showMessage(resultMessage);

        } catch (error) {
            console.error("Error importing data:", error);
            showMessage("데이터 복원에 실패했습니다. 파일 형식을 확인해주세요.");
        } finally {
            setIsLoading(false);
            event.target.value = null;
        }
    };
    reader.readAsText(file, 'UTF-8');
};

// 모든 데이터를 삭제하는 함수
export const deleteAllData = async (db, appId, userId, showMessage) => {
    try {
        const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/deliveryEntries`);
        const querySnapshot = await getDocs(entriesCollectionRef);
        
        if (querySnapshot.empty) {
            showMessage("삭제할 데이터가 없습니다.");
            return;
        }

        const batch = writeBatch(db);
        querySnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        showMessage("모든 데이터가 성공적으로 삭제되었습니다.");

    } catch (error) {
        console.error("Error deleting all data:", error);
        showMessage("데이터 삭제에 실패했습니다.");
    }
};