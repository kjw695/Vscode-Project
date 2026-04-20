import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// 1. 날짜 정규화 헬퍼 (기존 유지)
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

// 2. 타입 정규화 (유동적 항목 대응을 위해 필수)
const normalizeType = (val) => {
    const s = String(val).trim().toLowerCase();
    if (['수익', '수입', 'income', 'inc', 's', 'rev'].some(k => s.includes(k))) return 'income';
    if (['지출', '비용', 'expense', 'exp', 'z', 'cost'].some(k => s.includes(k))) return 'expense';
    return null;
};

// 3. 필드명 매핑 (한글 -> 시스템 영문 변환)
const getMappedField = (headerName) => {
    const normHeader = String(headerName).replace(/\s/g, '').toLowerCase();
    
    // 시스템에서 사용하는 고정 키 매핑
    const mapping = {
        'date': ['날짜', '일자', 'date'],
        'round': ['회전', '회차', 'round'],
        'type': ['구분', '유형', 'type'],
        'unitPrice': ['단가', '가격', 'unitprice'],
        'deliveryCount': ['배송수량', 'deliverycount'],
        'returnCount': ['반품수량', 'returncount'],
        'freshBagCount': ['프레시백', 'freshbag'],
        'deliveryInterruptionAmount': ['배송중단', 'interruption'],
        'customItems': ['개별항목', '추가항목', 'customitems', 'details'], // [중요] 개별 항목 매핑
        'timestamp': ['타임스탬프', 'timestamp']
    };

    for (const [field, keywords] of Object.entries(mapping)) {
        if (keywords.some(k => normHeader.includes(k))) return field;
    }
    
    // [핵심] 매핑에 없으면 그냥 그 헤더 이름 그대로 사용 (유동적 항목 지원)
    return headerName.trim();
};

// 📥 CSV 불러오기 (파싱 전담)
export const parseCsvData = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error("파일을 선택해주세요."));
            return;
        }

        const reader = new FileReader();
        reader.readAsArrayBuffer(file);

        reader.onload = (e) => {
            try {
                const buffer = e.target.result;
                let text = '';
                
                // 인코딩 감지 (UTF-8 vs EUC-KR)
                const decoderUtf8 = new TextDecoder('utf-8');
                const textUtf8 = decoderUtf8.decode(buffer);
                text = (textUtf8.includes('날짜') || textUtf8.includes('date')) ? textUtf8 : new TextDecoder('euc-kr').decode(buffer);

                const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');
                if (lines.length < 2) throw new Error("데이터가 없습니다.");

                // 헤더 파싱 및 매핑
                const rawHeaders = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                const headers = rawHeaders.map(h => getMappedField(h)); // 시스템 키로 변환

                const parsedData = [];

                lines.slice(1).forEach(line => {
                    // CSV 정규식 파싱
                    const regex = /("((?:[^"]|"")*)"|([^,]*))(,|$)/g;
                    let match;
                    const values = [];
                    while ((match = regex.exec(line)) !== null) {
                        if (match.index === regex.lastIndex) regex.lastIndex++;
                        if (match[1] !== undefined) values.push(match[2] !== undefined ? match[2].replace(/""/g, '"') : match[3]);
                    }
                    if (values.length === 0) return;

                    const item = {};
                    headers.forEach((key, index) => {
                        if (key && index < values.length) {
                            let val = values[index];
                            
                            // [중요] 개별 항목(customItems)은 JSON 파싱 시도
                            if (key === 'customItems' && val && val.startsWith('[')) {
                                try { item[key] = JSON.parse(val.replace(/""/g, '"')); } catch { item[key] = []; }
                            } 
                            // 숫자형 데이터 변환 (날짜/타입/타임스탬프 제외)
                            else if (!['date', 'type', 'timestamp', 'customItems'].includes(key)) {
                                item[key] = val ? parseFloat(String(val).replace(/,/g, '')) || 0 : 0;
                            } 
                            // 문자열 데이터
                            else {
                                item[key] = val;
                            }
                        }
                    });

                    // 필수 데이터 정규화
                    if (item.date) item.date = normalizeDate(item.date);
                    
                    // 타입 추론 (없으면 지출 항목 값 확인)
                    if (item.type) {
                        item.type = normalizeType(item.type);
                    } else {
                        // 만약 타입이 없으면 '패널티'나 '유류비' 같은 지출 키워드 값이 있는지 확인
                        const expenseKeys = ['penaltyAmount', 'fuelCost', 'maintenanceCost', 'industrialAccidentCost', 'vatAmount'];
                        const isExpense = expenseKeys.some(k => item[k] > 0);
                        item.type = isExpense ? 'expense' : 'income';
                    }

                    if (item.date && item.type) parsedData.push(item);
                });

                resolve(parsedData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error("파일 읽기 실패"));
    });
};

// 📤 CSV 내보내기 (모든 동적 항목 포함)
export const exportDataAsCsv = async (entries, showMessage) => {
    if (!entries || entries.length === 0) {
        showMessage("내보낼 데이터가 없습니다.");
        return;
    }
    try {
        // 1. 모든 데이터에서 사용된 '모든 키' 수집 (동적 항목 대응)
        const allKeys = new Set(['date', 'round', 'type']); // 필수 키 먼저
        entries.forEach(e => Object.keys(e).forEach(k => {
            if (k !== 'id' && k !== 'timestamp') allKeys.add(k);
        }));
        
        // 정렬: 필수 키 -> 나머지 키 -> customItems -> timestamp
        const sortedKeys = Array.from(allKeys).filter(k => k !== 'customItems');
        sortedKeys.push('customItems', 'timestamp'); // 맨 뒤로

        // 2. 한글 헤더 생성
        const reverseMapping = {
            'date': '날짜', 'round': '회전', 'type': '구분',
            'unitPrice': '단가', 'deliveryCount': '배송수량', 'returnCount': '반품수량',
            'freshBagCount': '프레시백', 'deliveryInterruptionAmount': '배송중단',
            'customItems': '개별항목', 'timestamp': '타임스탬프'
            // 나머지는 키값 그대로 영어로 나감 (유동적 항목)
        };
        const headers = sortedKeys.map(k => reverseMapping[k] || k);

        // 3. 데이터 행 생성
        const csvRows = entries.map(entry => {
            return sortedKeys.map(key => {
                let val = entry[key];
                
                // 타입 한글 변환
                if (key === 'type') val = (val === 'income' ? '수익' : '지출');
                // 개별 항목 JSON 문자열 변환 (콤마 충돌 방지)
                if (key === 'customItems' && val) val = JSON.stringify(val).replace(/"/g, '""'); 
                
                if (val === undefined || val === null) val = '';
                return `"${val}"`; // 모든 값 따옴표 감싸기
            }).join(',');
        });

        const csvString = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
        const fileName = `delivery_backup_${new Date().toISOString().slice(0, 10)}.csv`;

        // ... (파일 저장/공유 로직 기존과 동일) ...
        if (!Capacitor.isNativePlatform()) {
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
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
            text: '배송 장부 백업',
            url: result.uri,
            dialogTitle: '파일 공유'
        });

        showMessage("파일 내보내기가 완료되었습니다.");

    } catch (error) {
        if (error.message?.includes('canceled')) return;
        showMessage(`내보내기 실패: ${error.message}`);
    }
};