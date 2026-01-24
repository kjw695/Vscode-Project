import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// 날짜 정규화 헬퍼
const normalizeDate = (dateStr) => {
    if (!dateStr) return "";
    const str = String(dateStr).replace(/["']/g, '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const numbers = str.match(/\d+/g);
    if (!numbers || numbers.length < 3) return ""; 
    let y = numbers[0];
    const m = numbers[1].padStart(2, '0');
    const d = numbers[2].padStart(2, '0');
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
};

// 한글 헤더 매핑 (🔥 회전 추가됨)
const getMappedField = (headerName) => {
    const normHeader = String(headerName).replace(/\s/g, '').toLowerCase();
    const mapping = {
        'date': ['날짜', '일자', 'date', 'day'],
        'round': ['회전', '회차', 'round', 'turn'], // 🔥 [필수] 회전 필드 추가
        'unitPrice': ['단가', '가격', 'price', 'unit'],
        'deliveryCount': ['배송수량', '배송', 'count', 'delivery'],
        'returnCount': ['반품수량', '반품', 'return'],
        'freshBagCount': ['프레시백수량', '프레시백', 'freshbag'],
        'deliveryInterruptionAmount': ['배송중단', '중단', 'interruption'],
        'penaltyAmount': ['패널티', '벌금', 'penalty'],
        'industrialAccidentCost': ['산재', '보험', 'accident'],
        'fuelCost': ['유류비', '기름값', 'fuel'],
        'maintenanceCost': ['유지보수', '정비', 'maintenance'],
        'vatAmount': ['부가세', 'vat'],
        'incomeTaxAmount': ['종합소득세', '소득세', 'incometax'],
        'taxAccountantFee': ['세무사', '기장료', 'accountant'],
        'timestamp': ['타임스탬프', '생성일', 'timestamp']
    };
    for (const [field, keywords] of Object.entries(mapping)) {
        if (keywords.some(k => normHeader.includes(k))) return field;
    }
    return null;
};

// 📤 CSV 내보내기 함수 (🔥 회전 정보 포함)
export const exportDataAsCsv = async (entries, showMessage) => {
    if (!entries || entries.length === 0) {
        showMessage("내보낼 데이터가 없습니다.");
        return;
    }
    try {
        // 🔥 헤더에 '회전' 추가
        const headers = ["날짜", "회전", "단가", "배송 수량", "반품 수량", "배송중단", "프레시백 수량", "패널티", "산재", "유류비", "유지보수비", "부가세", "종합소득세", "세무사 비용", "타임스탬프"];
        
        const csvRows = entries.map(entry => {
            const row = [
                entry.date, 
                entry.round || 0, // 🔥 회전 데이터 저장 (매우 중요)
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
                typeof entry.timestamp === 'string' ? entry.timestamp : 
                (entry.timestamp?.seconds ? new Date(entry.timestamp.seconds * 1000).toISOString() : new Date().toISOString())
            ];
            return row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',');
        });

        const csvString = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
        const fileName = `delivery_data_${new Date().toISOString().slice(0, 10)}.csv`;

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
            return;
        }
        
        const result = await Filesystem.writeFile({
            path: fileName,
            data: csvString,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
        });

        await Share.share({
            title: fileName,
            text: '배송 수익 데이터 내보내기',
            url: result.uri,
            dialogTitle: '파일 공유 또는 저장하기'
        });

        showMessage("파일 내보내기가 완료되었습니다.");
    } catch (error) {
        if (error.message && error.message.includes('Share canceled')) return;
        showMessage(`내보내기 실패: ${error.message}`);
        console.error("Export Error:", error);
    }
};

// 📥 CSV 불러오기 함수 (🔥 회전 정보 포함 & 중복 제거)
export const importDataFromCsv = async (file, existingEntries, onSuccess, showMessage, setIsLoading) => {
    if (!file) {
        showMessage("파일을 선택해주세요.");
        return;
    }

    setIsLoading(true); 
    
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);

    reader.onload = async (e) => {
        try {
            const buffer = e.target.result;
            let text = '';
            
            // 인코딩 감지
            const decoderUtf8 = new TextDecoder('utf-8');
            const textUtf8 = decoderUtf8.decode(buffer);

            if (textUtf8.includes('날짜') || textUtf8.includes('date')) {
                text = textUtf8;
            } else {
                const decoderEucKr = new TextDecoder('euc-kr');
                text = decoderEucKr.decode(buffer);
            }

            const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');
            if (lines.length < 2) throw new Error("유효한 데이터가 없습니다.");

            const rawHeaders = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const mappedFields = rawHeaders.map(h => getMappedField(h));
            const hasValidMapping = mappedFields.some(f => f !== null);
            
            // 🔥 round 필드 포함
            const fallbackFields = [
                "date", "round", "unitPrice", "deliveryCount", "returnCount", 
                "deliveryInterruptionAmount", "freshBagCount", "penaltyAmount", 
                "industrialAccidentCost", "fuelCost", "maintenanceCost", 
                "vatAmount", "incomeTaxAmount", "taxAccountantFee", "timestamp"
            ];

            const finalFields = hasValidMapping ? mappedFields : fallbackFields;
            const parsedData = [];

            lines.slice(1).forEach(line => {
                const regex = /("((?:[^"]|"")*)"|([^,]*))(,|$)/g;
                let match;
                const values = [];
                
                while ((match = regex.exec(line)) !== null) {
                    if (match.index === regex.lastIndex) regex.lastIndex++;
                    if (match[1] !== undefined) {
                        let val = match[2] !== undefined ? match[2].replace(/""/g, '"') : match[3];
                        values.push(val);
                    }
                }
                if (values.length === 0) return;

                const item = {};
                finalFields.forEach((field, index) => {
                    if (field && index < values.length) {
                        const val = values[index];
                        // 🔥 round도 숫자로 처리
                        const numFields = ['round', 'unitPrice', 'deliveryCount', 'returnCount', 'deliveryInterruptionAmount', 'freshBagCount', 'penaltyAmount', 'industrialAccidentCost', 'fuelCost', 'maintenanceCost', 'vatAmount', 'incomeTaxAmount', 'taxAccountantFee'];
                        if (numFields.includes(field)) {
                            item[field] = parseFloat(String(val).replace(/,/g, '')) || 0;
                        } else {
                            item[field] = val;
                        }
                    }
                });

                if (item.date) {
                    const normDate = normalizeDate(item.date);
                    if (normDate) {
                        item.date = normDate;
                        if (!item.id) item.id = crypto.randomUUID();
                        if (!item.timestamp) item.timestamp = new Date().toISOString();
                        parsedData.push(item);
                    }
                }
            });

            if (parsedData.length === 0) throw new Error("파싱 가능한 데이터가 없습니다.");

            // 🔥 중복 검사 (날짜 + 회전이 같으면 중복)
            let duplicateCount = 0;
            const uniqueEntries = parsedData.filter(newEntry => {
                const isDuplicate = existingEntries.some(existingEntry => {
                    const existingRound = existingEntry.round || 0;
                    const newRound = newEntry.round || 0;
                    
                    // 날짜와 회전이 같으면 중복으로 간주
                    if (existingEntry.date === newEntry.date && existingRound === newRound) {
                        return true; 
                    }
                    return false;
                });

                if (isDuplicate) {
                    duplicateCount++;
                    return false;
                }
                return true;
            });

            const mergedEntries = [...existingEntries, ...uniqueEntries];
            mergedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

            const resultMsg = `복원 완료!\n총 ${parsedData.length}개 중 ${uniqueEntries.length}개가 추가되었습니다.\n(${duplicateCount}개 중복 제외)`;
            showMessage(resultMsg);

            onSuccess(mergedEntries);

        } catch (error) {
            showMessage(`가져오기 실패: ${error.message}`);
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };
    
    reader.onerror = () => {
        showMessage("파일을 읽는 데 실패했습니다.");
        setIsLoading(false);
    };
};