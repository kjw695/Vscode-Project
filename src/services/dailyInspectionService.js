const STORAGE_PREFIX = 'dailyInspection:v2:user:';
const getOwnerKey = (userId) => encodeURIComponent(String(userId || 'guest').trim() || 'guest');
const getHistoryKey = (userId) => `${STORAGE_PREFIX}${getOwnerKey(userId)}:history`;
export const getDailyInspectionStoragePrefix = (userId) => `${STORAGE_PREFIX}${getOwnerKey(userId)}:`;
export const getDailyInspectionStorageKey = (userId, date) => `${getDailyInspectionStoragePrefix(userId)}${String(date || '').slice(0, 10)}`;

const readHistory = (userId) => {
    try {
        const parsed = JSON.parse(localStorage.getItem(getHistoryKey(userId)) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('[DailyInspection] 점검 이력을 읽지 못했습니다.', error);
        return [];
    }
};

export const listDailyInspectionRecords = (userId, year, month) => {
    const prefix = `${String(year)}-${String(month).padStart(2, '0')}-`;
    return readHistory(userId)
        .filter((record) => String(record.inspectionDate || record.date || '').startsWith(prefix))
        .sort((a, b) => String(a.inspectionDate || a.date).localeCompare(String(b.inspectionDate || b.date))
            || String(a.completedAt || '').localeCompare(String(b.completedAt || '')));
};

export const readDailyInspectionRecord = (userId, date) => {
    if (!date) return null;
    const records = readHistory(userId).filter((record) =>
        String(record.inspectionDate || record.date || '').slice(0, 10) === String(date).slice(0, 10)
    );
    if (records.length) return records[records.length - 1];
    try {
        const legacyKey = `dailyInspection:v1:user:${getOwnerKey(userId)}:${String(date).slice(0, 10)}`;
        const parsed = JSON.parse(localStorage.getItem(legacyKey) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        console.warn('[DailyInspection] 이전 점검 기록을 읽지 못했습니다.', error);
        return null;
    }
};

export const saveDailyInspectionRecord = async (userId, date, record) => {
    if (!date || !record || typeof record !== 'object') throw new Error('저장할 점검 날짜 또는 내용이 없습니다.');
    const history = readHistory(userId);
    const payload = {
        ...record,
        id: record.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inspection-${Date.now()}-${Math.random().toString(36).slice(2)}`),
        date: String(date).slice(0, 10),
        inspectionDate: String(date).slice(0, 10),
        completedAt: new Date().toISOString(),
        storageMode: 'device-only',
        revision: history.filter((item) => String(item.inspectionDate || item.date).slice(0, 10) === String(date).slice(0, 10)).length + 1
    };
    try {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const bytes = new TextEncoder().encode(JSON.stringify(payload));
            const digest = await crypto.subtle.digest('SHA-256', bytes);
            payload.contentHash = Array.from(new Uint8Array(digest)).map((v) => v.toString(16).padStart(2, '0')).join('');
        }
    } catch (error) {
        console.warn('[DailyInspection] 무결성 보조 해시 생성 실패:', error);
    }
    try {
        history.push(payload);
        localStorage.setItem(getHistoryKey(userId), JSON.stringify(history));
        localStorage.setItem(getDailyInspectionStorageKey(userId, date), JSON.stringify(payload));
    } catch (error) {
        console.error('[DailyInspection] 점검 기록 저장 실패:', error);
        throw new Error('점검 기록을 기기에 저장하지 못했습니다. 저장 공간을 확인해주세요.');
    }
    return payload;
};

const getSavedDriverSignatureKey = (userId) => `${getDailyInspectionStoragePrefix(userId)}saved-driver-signature`;

export const readSavedDriverSignature = (userId) => {
    try {
        return localStorage.getItem(getSavedDriverSignatureKey(userId)) || '';
    } catch (error) {
        console.warn('[DailyInspection] 저장된 서명을 읽지 못했습니다.', error);
        return '';
    }
};

export const saveSavedDriverSignature = (userId, signatureDataUrl) => {
    if (!signatureDataUrl || typeof signatureDataUrl !== 'string' || !signatureDataUrl.startsWith('data:image/png;base64,')) {
        throw new Error('저장할 서명이 올바르지 않습니다. 다시 서명해주세요.');
    }
    try {
        localStorage.setItem(getSavedDriverSignatureKey(userId), signatureDataUrl);
        return true;
    } catch (error) {
        console.error('[DailyInspection] 서명 저장 실패:', error);
        throw new Error('서명을 기기에 저장하지 못했습니다. 저장 공간을 확인해주세요.');
    }
};

export const clearSavedDriverSignature = (userId) => {
    try {
        localStorage.removeItem(getSavedDriverSignatureKey(userId));
        return true;
    } catch (error) {
        console.warn('[DailyInspection] 저장된 서명을 삭제하지 못했습니다.', error);
        return false;
    }
};
