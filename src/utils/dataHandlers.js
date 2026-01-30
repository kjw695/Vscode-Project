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

// 시스템 언어 감지 헬퍼
const getSystemLanguage = () => {
    const lang = navigator.language || navigator.userLanguage || 'ko';
    return lang.toLowerCase().includes('ko') ? 'ko' : 'en';
};

// 필드 정의 및 다국어 헤더 맵
const FIELD_DEFINITIONS = [
    { key: "date", ko: "날짜", en: "Date", type: "string" },
    { key: "round", ko: "회전", en: "Round", type: "number" },
    { key: "unitPrice", ko: "단가", en: "Unit Price", type: "number" },
    { key: "deliveryCount", ko: "배송 수량", en: "Delivery Count", type: "number" },
    { key: "returnCount", ko: "반품 수량", en: "Return Count", type: "number" },
    { key: "deliveryInterruptionAmount", ko: "배송중단", en: "Interruption Amount", type: "number" },
    { key: "freshBagCount", ko: "프레시백 수량", en: "Fresh Bag Count", type: "number" },
    { key: "penaltyAmount", ko: "패널티", en: "Penalty", type: "number" },
    { key: "industrialAccidentCost", ko: "산재", en: "Ind. Accident Cost", type: "number" },
    { key: "fuelCost", ko: "유류비", en: "Fuel Cost", type: "number" },
    { key: "maintenanceCost", ko: "유지보수비", en: "Maintenance Cost", type: "number" },
    { key: "vatAmount", ko: "부가세", en: "VAT", type: "number" },
    { key: "incomeTaxAmount", ko: "종합소득세", en: "Income Tax", type: "number" },
    { key: "taxAccountantFee", ko: "세무사 비용", en: "Tax Accountant Fee", type: "number" },
    { key: "timestamp", ko: "타임스탬프", en: "Timestamp", type: "string" }
];

// 헤더 매핑 (불러오기용)
const getMappedField = (headerName) => {
    const normHeader = String(headerName).replace(/\s/g, '').toLowerCase();
    
    // 정의된 필드 매핑 확인
    for (const def of FIELD_DEFINITIONS) {
        const keywords = [def.key.toLowerCase(), def.ko, def.en.toLowerCase().replace(/\s/g,'')];
        // 추가 키워드 매핑
        if (def.key === 'round') keywords.push('회차', 'turn');
        if (def.key === 'unitPrice') keywords.push('가격', 'price', 'unit');
        if (def.key === 'deliveryCount') keywords.push('배송', 'count', 'delivery');
        
        if (keywords.some(k => normHeader.includes(k))) return def.key;
    }
    return null;
};

// 📤 CSV 내보내기 함수 (언어 자동 대응)
export const exportDataAsCsv = async (entries, showMessage) => {
    if (!entries || entries.length === 0) {
        showMessage("내보낼 데이터가 없습니다.");
        return;
    }
    try {
        const lang = getSystemLanguage();
        // ID 제외, 언어에 맞는 헤더 생성
        const headers = FIELD_DEFINITIONS.map(f => lang === 'ko' ? f.ko : f.en);
        
        const csvRows = entries.map(entry => {
            const row = FIELD_DEFINITIONS.map(def => {
                let val = entry[def.key];
                // 빈칸은 0과 동일 취급 (숫자 필드인 경우)
                if (def.type === 'number') {
                    val = val || 0;
                }
                
                // 타임스탬프 처리
                if (def.key === 'timestamp') {
                    return typeof val === 'string' ? val : 
                           (val?.seconds ? new Date(val.seconds * 1000).toISOString() : new Date().toISOString());
                }
                
                return `"${String(val ?? '').replace(/"/g, '""')}"`;
            });
            return row.join(',');
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

// 📥 CSV 불러오기 함수 (엄격한 검증 & 완벽 일치 중복 검사)
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
            const decoderUtf8 = new TextDecoder('utf-8');
            const textUtf8 = decoderUtf8.decode(buffer);

            if (textUtf8.includes('날짜') || textUtf8.includes('date') || textUtf8.includes('Date')) {
                text = textUtf8;
            } else {
                const decoderEucKr = new TextDecoder('euc-kr');
                text = decoderEucKr.decode(buffer);
            }

            const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');
            if (lines.length < 2) throw new Error("유효한 데이터가 없습니다.");

            const rawHeaders = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const mappedFields = rawHeaders.map(h => getMappedField(h));
            
            // 매핑되지 않은 필수 필드 확인 (최소 날짜는 있어야 함)
            if (!mappedFields.includes('date')) {
                 throw new Error("CSV 헤더에서 '날짜(Date)' 필드를 찾을 수 없습니다.");
            }

            const parsedData = [];

            // 데이터 파싱 및 유효성 검사 (Row 단위)
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const regex = /("((?:[^"]|"")*)"|([^,]*))(,|$)/g;
                let match;
                const values = [];
                
                while ((match = regex.exec(line)) !== null) {
                    if (match.index === regex.lastIndex) regex.lastIndex++;
                    if (match[1] !== undefined) {
                        let val = match[2] !== undefined ? match[2].replace(/""/g, '"') : match[3];
                        values.push(val.trim());
                    }
                }
                if (values.length === 0) continue;

                const item = {};
                
                for (let j = 0; j < mappedFields.length; j++) {
                    const fieldKey = mappedFields[j];
                    if (!fieldKey) continue; // 매핑 안된 컬럼 무시

                    let val = values[j];
                    const def = FIELD_DEFINITIONS.find(f => f.key === fieldKey);

                    // [원칙 준수] 숫자 필드 검증: 글자가 들어오면 즉시 중단
                    if (def && def.type === 'number') {
                        if (val === '') {
                            item[fieldKey] = 0; // 빈칸은 0 취급
                        } else {
                            // 콤마 제거
                            const numStr = val.replace(/,/g, '');
                            if (isNaN(numStr)) {
                                throw new Error(`${i+1}번째 줄 오류: '${def.ko}' 항목에 숫자가 아닌 값('${val}')이 있습니다. 저장을 중단합니다.`);
                            }
                            item[fieldKey] = parseFloat(numStr);
                        }
                    } else {
                        item[fieldKey] = val;
                    }
                }

                if (item.date) {
                    const normDate = normalizeDate(item.date);
                    if (normDate) {
                        item.date = normDate;
                        // ID 부여 (기존 ID가 파일에 없으므로 새로 생성)
                        // 원칙상 '새 ID' 부여. 현재 시스템이 UUID를 쓴다면 UUID 유지. 
                        // 만약 s1, z1 포맷을 원하시면 포맷 생성 로직으로 교체 필요.
                        item.id = crypto.randomUUID(); 
                        if (!item.timestamp) item.timestamp = new Date().toISOString();
                        parsedData.push(item);
                    }
                }
            }

            if (parsedData.length === 0) throw new Error("파싱 가능한 데이터가 없습니다.");

            // [원칙 준수] 중복 검사: ID를 제외한 '모든 데이터'가 일치해야 중복
            let duplicateCount = 0;
            const uniqueEntries = parsedData.filter(newEntry => {
                const isDuplicate = existingEntries.some(existingEntry => {
                    // 비교할 키 목록 (id, timestamp 제외)
                    const keysToCompare = FIELD_DEFINITIONS
                        .filter(f => f.key !== 'timestamp') // timestamp는 생성 시점따라 다를 수 있음
                        .map(f => f.key);

                    return keysToCompare.every(key => {
                        // 값 비교 (null/undefined/0 처리 주의)
                        const val1 = existingEntry[key] ?? (FIELD_DEFINITIONS.find(f=>f.key===key).type === 'number' ? 0 : "");
                        const val2 = newEntry[key] ?? (FIELD_DEFINITIONS.find(f=>f.key===key).type === 'number' ? 0 : "");
                        return String(val1) === String(val2);
                    });
                });

                if (isDuplicate) {
                    duplicateCount++;
                    return false; // 중복이면 제외
                }
                return true; // 중복 아니면 추가
            });

            const mergedEntries = [...existingEntries, ...uniqueEntries];
            mergedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

            const resultMsg = `검증 및 복원 완료!\n총 ${parsedData.length}개 데이터 중\n✅ ${uniqueEntries.length}개 추가됨\n⛔ ${duplicateCount}개 완전 중복 제외됨`;
            showMessage(resultMsg);

            onSuccess(mergedEntries);

        } catch (error) {
            showMessage(`가져오기 중단: ${error.message}`);
            console.error("Import Error:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    reader.onerror = () => {
        showMessage("파일을 읽는 데 실패했습니다.");
        setIsLoading(false);
    };
};