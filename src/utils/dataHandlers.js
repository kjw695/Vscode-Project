import Papa from 'papaparse';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const CSV_HEADERS = [
    '날짜', '회차', '구분', '항목명', '수량', '단가', '금액', '메모',
    '기록ID', '기록구분', '공통단가', '기록시간', '수정여부',
    '항목키', '직접금액', '항목순서', '행종류', '형식버전'
];
const CSV_VERSION = '2';

const LEGACY_INCOME_FIELDS = [
    { key: 'deliveryCount', label: '배송' },
    { key: 'returnCount', label: '반품' },
    { key: 'deliveryInterruptionAmount', label: '배송중단' },
    { key: 'freshBagCount', label: '프레시백' }
];

const LEGACY_EXPENSE_FIELDS = [
    { key: 'penaltyAmount', label: '패널티' },
    { key: 'industrialAccidentCost', label: '산재보험' },
    { key: 'fuelCost', label: '유류비' },
    { key: 'maintenanceCost', label: '정비비' },
    { key: 'vatAmount', label: '부가세' },
    { key: 'incomeTaxAmount', label: '소득세' },
    { key: 'taxAccountantFee', label: '세무사비' }
];

const ITEM_KEY_BY_LABEL = new Map([
    ['배송', 'deliveryCount'],
    ['반품', 'returnCount'],
    ['배송중단', 'deliveryInterruptionAmount'],
    ['중단', 'deliveryInterruptionAmount'],
    ['프레시백', 'freshBagCount'],
    ['패널티', 'penaltyAmount'],
    ['산재보험', 'industrialAccidentCost'],
    ['산재비', 'industrialAccidentCost'],
    ['산재', 'industrialAccidentCost'],
    ['유류비', 'fuelCost'],
    ['정비비', 'maintenanceCost'],
    ['유지보수비', 'maintenanceCost'],
    ['부가세', 'vatAmount'],
    ['소득세', 'incomeTaxAmount'],
    ['종합소득세', 'incomeTaxAmount'],
    ['세무사비', 'taxAccountantFee'],
    ['세무사 비용', 'taxAccountantFee']
]);

const normalizeHeader = (value) => String(value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase();

const parseCsvNumber = (value, fieldName, rowNumber) => {
    const normalized = String(value ?? '').replace(/,/g, '').trim();
    if (!normalized) return 0;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${rowNumber}행의 ${fieldName} 값이 숫자가 아닙니다.`);
    }
    return parsed;
};

const parseCsvBoolean = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    return ['true', '1', 'yes', 'y', '예', '수정'].includes(normalized);
};

const normalizeEntryType = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (['수익', 'income', 'revenue', '매출'].includes(normalized)) return 'income';
    if (['지출', 'expense', 'expenses'].includes(normalized)) return 'expense';
    return null;
};

const normalizeCsvDate = (value, rowNumber) => {
    const raw = String(value ?? '').trim();
    const match = raw.match(/^(\d{4})[-/.]\s*(\d{1,2})[-/.]\s*(\d{1,2})/);
    if (!match) throw new Error(`${rowNumber}행의 날짜 형식이 올바르지 않습니다.`);

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        throw new Error(`${rowNumber}행의 날짜가 실제 달력에 존재하지 않습니다.`);
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const getEntryTypeLabel = (type) => type === 'expense' ? '지출' : '수익';

const getItemTotal = (item) => {
    const amount = Number(item.amount) || 0;
    if (item.type === 'expense') return amount;
    const count = Number(item.count) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return amount === 0 ? count * unitPrice : amount;
};

const createCsvRow = (entry, entryIndex, item, itemOrder, rowKind = 'item') => {
    const itemType = item?.type === 'expense' ? 'expense' : 'income';
    const count = Number(item?.count) || 0;
    const unitPrice = Number(item?.unitPrice) || 0;
    const amount = Number(item?.amount) || 0;
    const recordId = entry.id != null ? String(entry.id) : `record-${entryIndex}`;

    return [
        entry.date ?? '',
        Number(entry.round) || 0,
        getEntryTypeLabel(itemType),
        item?.name || item?.label || item?.key || '',
        count,
        unitPrice,
        rowKind === 'record' ? 0 : getItemTotal({ ...item, type: itemType }),
        entry.memo || '',
        recordId,
        normalizeEntryType(entry.type) || itemType,
        Number(entry.unitPrice) || 0,
        entry.timestamp || '',
        entry.isEdited ? 'true' : 'false',
        item?.key || '',
        amount,
        itemOrder,
        rowKind,
        CSV_VERSION
    ];
};

// 1. CSV 내보내기
export const exportDataAsCsv = async (entries, showMessage) => {
    try {
        if (!Array.isArray(entries) || entries.length === 0) {
            showMessage?.('내보낼 데이터가 없습니다.');
            return;
        }

        const rows = [];
        entries.forEach((entry, entryIndex) => {
            if (!entry || !entry.date) return;

            let itemOrder = 0;
            let rowCount = 0;
            const processedKeys = new Set();
            const customItems = Array.isArray(entry.customItems) ? entry.customItems : [];

            customItems.forEach((item) => {
                if (!item) return;
                if (item.key) processedKeys.add(item.key);
                rows.push(createCsvRow(entry, entryIndex, item, itemOrder++));
                rowCount++;
            });

            LEGACY_INCOME_FIELDS.forEach(({ key, label }) => {
                const count = Number(entry[key]) || 0;
                if (processedKeys.has(key) || count <= 0) return;
                rows.push(createCsvRow(entry, entryIndex, {
                    key, name: label, type: 'income', count,
                    unitPrice: Number(entry.unitPrice) || 0, amount: 0
                }, itemOrder++));
                rowCount++;
            });

            LEGACY_EXPENSE_FIELDS.forEach(({ key, label }) => {
                const amount = Number(entry[key]) || 0;
                if (processedKeys.has(key) || amount <= 0) return;
                rows.push(createCsvRow(entry, entryIndex, {
                    key, name: label, type: 'expense', count: 0, unitPrice: 0, amount
                }, itemOrder++));
                rowCount++;
            });

            if (rowCount === 0) {
                rows.push(createCsvRow(entry, entryIndex, {
                    name: '',
                    type: normalizeEntryType(entry.type) || 'income',
                    count: 0,
                    unitPrice: 0,
                    amount: 0
                }, 0, 'record'));
            }
        });

        if (rows.length === 0) {
            showMessage?.('CSV로 내보낼 수 있는 날짜별 기록이 없습니다.');
            return;
        }

        // 쉼표·따옴표·셀 내부 줄바꿈도 CSV 규칙에 맞게 인용 처리합니다.
        const csvContent = Papa.unparse(
            { fields: CSV_HEADERS, data: rows },
            { delimiter: ',', newline: '\r\n', skipEmptyLines: false }
        );

        const date = new Date().toISOString().split('T')[0];
        const fileName = `배달장부_상세내역_${date}.csv`;
        const csvWithBom = '\uFEFF' + csvContent;

        if (Capacitor.isNativePlatform()) {
            try {
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: csvWithBom,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                });

                // 파일을 문서 폴더에 먼저 저장한 다음 공유창을 엽니다.
                // 공유창을 닫거나 취소해도 문서 폴더의 파일은 그대로 남습니다.
                try {
                    await Share.share({
                        title: '배달장부 CSV 파일',
                        text: `${date} 기준 배달장부 상세 내역 파일입니다.`,
                        url: savedFile.uri,
                        dialogTitle: 'CSV 파일 공유하기'
                    });
                } catch (shareError) {
                    if (shareError?.message !== 'Share canceled') {
                        console.error('CSV Share Failed:', shareError);
                        showMessage?.('CSV 파일은 문서 폴더에 저장했지만 공유창을 열지 못했습니다. 내 파일 > 문서에서 확인하세요.');
                        return;
                    }
                }

                showMessage?.('✅ CSV 파일을 휴대폰 문서 폴더에 저장했습니다. 공유창에서 앱을 선택하거나 내 파일 > 문서에서 확인하세요.');
            } catch (nativeError) {
                console.error('Native CSV Save Failed:', nativeError);
                showMessage?.('CSV 파일을 휴대폰 문서 폴더에 저장하지 못했습니다.');
            }
        } else {
            const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showMessage?.('PC/웹: 다운로드 폴더에 저장되었습니다.');
        }
    } catch (error) {
        console.error('CSV Export Error:', error);
        showMessage?.('CSV 내보내기 오류: ' + error.message);
    }
};

// 2. CSV 불러오기
// 새 형식(v2)은 원래 기록 단위와 항목 키를 유지하고,
// 구형 8열 CSV도 이전 파일 호환을 위해 계속 지원합니다.
export const parseCsvData = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('가져올 CSV 파일을 선택해주세요.'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const csvText = String(event.target?.result ?? '').replace(/^\uFEFF/, '');
                const parsed = Papa.parse(csvText, {
                    header: true,
                    delimiter: ',',
                    skipEmptyLines: 'greedy',
                    transformHeader: (header) => String(header).trim()
                });

                if (parsed.errors?.length) {
                    const firstError = parsed.errors[0];
                    const rowNumber = Number.isInteger(firstError.row) ? firstError.row + 2 : '확인할 수 없는';
                    throw new Error(`CSV ${rowNumber}행을 읽을 수 없습니다. 파일 내용을 확인해주세요.`);
                }

                const fields = parsed.meta?.fields || [];
                if (!fields.length) throw new Error('CSV 제목 행을 찾을 수 없습니다.');

                const fieldMap = new Map(fields.map((field) => [normalizeHeader(field), field]));
                const hasColumn = (aliases) => aliases.some((alias) => fieldMap.has(normalizeHeader(alias)));
                const getValue = (row, aliases) => {
                    const actualField = aliases
                        .map((alias) => fieldMap.get(normalizeHeader(alias)))
                        .find(Boolean);
                    return actualField ? row[actualField] : '';
                };

                const dateAliases = ['날짜', 'Date'];
                const roundAliases = ['회차', 'Round'];
                const typeAliases = ['구분', 'Type'];
                const nameAliases = ['항목명', '항목', 'Item', 'Name'];
                const countAliases = ['수량', 'Count', 'Quantity'];
                const unitPriceAliases = ['단가', 'Unit Price', 'UnitPrice'];
                const totalAliases = ['금액', 'Amount', 'Total'];
                const memoAliases = ['메모', 'Memo', 'Note'];
                const recordIdAliases = ['기록ID', 'Record ID', 'RecordId'];
                const recordTypeAliases = ['기록구분', 'Record Type'];
                const commonPriceAliases = ['공통단가', 'Common Unit Price'];
                const timestampAliases = ['기록시간', 'Timestamp'];
                const editedAliases = ['수정여부', 'Is Edited'];
                const itemKeyAliases = ['항목키', 'Item Key'];
                const directAmountAliases = ['직접금액', 'Direct Amount', 'Item Amount'];
                const itemOrderAliases = ['항목순서', 'Item Order'];
                const rowKindAliases = ['행종류', 'Row Kind'];
                const versionAliases = ['형식버전', 'Format Version'];

                if (
                    !hasColumn(dateAliases) ||
                    !hasColumn(nameAliases) ||
                    !hasColumn(typeAliases) ||
                    !hasColumn(countAliases) ||
                    !hasColumn(unitPriceAliases) ||
                    !hasColumn(totalAliases)
                ) {
                    throw new Error('지원하지 않는 CSV 형식입니다. 날짜·구분·항목명·수량·단가·금액 열이 필요합니다.');
                }

                const v2MetadataColumns = [
                    recordIdAliases,
                    recordTypeAliases,
                    commonPriceAliases,
                    timestampAliases,
                    editedAliases,
                    itemKeyAliases,
                    directAmountAliases,
                    itemOrderAliases,
                    rowKindAliases,
                    versionAliases
                ];
                const hasAnyV2Metadata = v2MetadataColumns.some(hasColumn);
                const hasV2Metadata = v2MetadataColumns.every(hasColumn);

                if (hasAnyV2Metadata && !hasV2Metadata) {
                    throw new Error('새 CSV 백업의 복원 정보 열이 일부 누락되었습니다. 파일을 원본 그대로 가져와주세요.');
                }

                const groupedData = new Map();
                const rows = Array.isArray(parsed.data) ? parsed.data : [];

                rows.forEach((row, index) => {
                    const rowNumber = index + 2;
                    const rawDate = getValue(row, dateAliases);
                    if (!String(rawDate ?? '').trim()) {
                        const hasAnyCellValue = Object.values(row).some((value) => String(value ?? '').trim() !== '');
                        if (hasAnyCellValue) {
                            throw new Error(`${rowNumber}행에 날짜가 비어 있습니다.`);
                        }
                        return;
                    }

                    const date = normalizeCsvDate(rawDate, rowNumber);
                    const round = parseCsvNumber(getValue(row, roundAliases), '회차', rowNumber);
                    const name = String(getValue(row, nameAliases) ?? '').trim();
                    const rowTypeValue = getValue(row, typeAliases);
                    const recordTypeValue = hasV2Metadata ? getValue(row, recordTypeAliases) : '';
                    const itemType = normalizeEntryType(rowTypeValue || recordTypeValue);
                    if (!itemType) {
                        throw new Error(`${rowNumber}행의 구분은 수익 또는 지출이어야 합니다.`);
                    }

                    const memo = String(getValue(row, memoAliases) ?? '');
                    const recordId = String(getValue(row, recordIdAliases) ?? '').trim();
                    const recordType = normalizeEntryType(recordTypeValue) || itemType;
                    const groupKey = hasV2Metadata && recordId
                        ? `record:${recordId}`
                        : `legacy:${date}:${round}:${recordType}:${memo}`;

                    if (hasV2Metadata && String(getValue(row, versionAliases) ?? '').trim() !== CSV_VERSION) {
                        throw new Error(`${rowNumber}행의 CSV 형식 버전이 지원되지 않습니다.`);
                    }

                    const commonUnitPrice = hasV2Metadata
                        ? parseCsvNumber(getValue(row, commonPriceAliases), '공통단가', rowNumber)
                        : 0;
                    const timestamp = String(getValue(row, timestampAliases) ?? '').trim();
                    const isEdited = hasV2Metadata
                        ? parseCsvBoolean(getValue(row, editedAliases))
                        : false;

                    if (!groupedData.has(groupKey)) {
                        groupedData.set(groupKey, {
                            entry: {
                                id: `csv-${Date.now()}-${groupedData.size}`,
                                date,
                                round,
                                type: recordType,
                                unitPrice: commonUnitPrice,
                                memo,
                                customItems: [],
                                isEdited,
                                ...(timestamp ? { timestamp } : {})
                            },
                            itemRows: [],
                            nextSequence: 0
                        });
                    }

                    const group = groupedData.get(groupKey);
                    const entry = group.entry;
                    if (
                        entry.date !== date ||
                        Number(entry.round) !== Number(round) ||
                        entry.type !== recordType ||
                        (entry.memo || '') !== memo
                    ) {
                        throw new Error(`${rowNumber}행의 기록 정보가 같은 기록ID의 다른 행과 일치하지 않습니다.`);
                    }

                    const rowKind = String(getValue(row, rowKindAliases) ?? 'item').trim().toLowerCase();
                    if (rowKind === 'record') return;
                    if (!name) throw new Error(`${rowNumber}행에 항목명이 없습니다.`);

                    const count = parseCsvNumber(getValue(row, countAliases), '수량', rowNumber);
                    const unitPrice = parseCsvNumber(getValue(row, unitPriceAliases), '단가', rowNumber);
                    const total = parseCsvNumber(getValue(row, totalAliases), '금액', rowNumber);
                    const directAmount = hasV2Metadata
                        ? parseCsvNumber(getValue(row, directAmountAliases), '직접금액', rowNumber)
                        : (itemType === 'expense' ? total : total - (count * unitPrice));

                    const rawItemKey = String(getValue(row, itemKeyAliases) ?? '').trim();
                    const itemKey = rawItemKey || ITEM_KEY_BY_LABEL.get(name) || '';
                    const itemOrderValue = hasV2Metadata
                        ? parseCsvNumber(getValue(row, itemOrderAliases), '항목순서', rowNumber)
                        : group.nextSequence;

                    const item = {
                        ...(itemKey ? { key: itemKey } : {}),
                        name,
                        type: itemType,
                        count,
                        unitPrice,
                        amount: directAmount
                    };

                    group.itemRows.push({
                        order: itemOrderValue,
                        sequence: group.nextSequence++,
                        item
                    });

                    if (!hasV2Metadata && entry.unitPrice <= 0 && itemType === 'income' && unitPrice > 0) {
                        entry.unitPrice = unitPrice;
                    }
                });

                const parsedEntries = Array.from(groupedData.values()).map(({ entry, itemRows }) => ({
                    ...entry,
                    customItems: itemRows
                        .sort((a, b) => a.order - b.order || a.sequence - b.sequence)
                        .map((row) => row.item)
                }));

                if (parsedEntries.length > 0) resolve(parsedEntries);
                else reject(new Error('유효한 데이터가 없습니다.'));
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('CSV 파일 읽기에 실패했습니다.'));
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
            try {
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: jsonString,
                    directory: Directory.Cache,
                    encoding: Encoding.UTF8
                });

                await Share.share({
                    title: '배달 앱 데이터 백업',
                    text: `${date} 기준 배달 데이터 백업 파일입니다.`,
                    url: savedFile.uri
                });
                return true;
            } catch (err) {
                if (err.message !== 'Share canceled') throw err;
                return true;
            }
        }

        const file = new File([jsonString], fileName, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: '배달 앱 데이터 백업',
                text: `${date} 기준 배달 데이터 백업 파일입니다.`,
                files: [file]
            });
            return true;
        }

        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        return 'downloaded';
    } catch (error) {
        console.error('Backup failed:', error);
        return false;
    }
};

// [스마트 복원 - JSON] (기존 유지)
export const parseJsonData = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (Array.isArray(data)) resolve(data);
                else reject(new Error('올바른 백업 파일 형식이 아닙니다.'));
            } catch (error) {
                reject(new Error('파일을 읽을 수 없습니다.'));
            }
        };
        reader.onerror = () => reject(new Error('파일 읽기 실패'));
        reader.readAsText(file);
    });
};
