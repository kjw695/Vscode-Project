const STORAGE_PREFIX = 'dailyInspection:v2:user:';
const getOwnerKey = (userId) => encodeURIComponent(String(userId || 'guest').trim() || 'guest');
const getHistoryKey = (userId) => `${STORAGE_PREFIX}${getOwnerKey(userId)}:history`;
const getSavedDriverIdentityKey = (userId) => `${getDailyInspectionStoragePrefix(userId)}saved-driver-identity`;
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
    const history = readHistory(userId);
    const latestByDate = new Map();
    const undatedRecords = [];
    history.forEach((record) => {
        const recordDate = String(record.inspectionDate || record.date || '').slice(0, 10);
        if (recordDate) latestByDate.set(recordDate, record);
        else undatedRecords.push(record);
    });
    const deduplicatedHistory = [...latestByDate.values(), ...undatedRecords].sort((a, b) =>
        String(a.inspectionDate || a.date || '').localeCompare(String(b.inspectionDate || b.date || ''))
    );
    if (deduplicatedHistory.length < history.length) {
        try {
            localStorage.setItem(getHistoryKey(userId), JSON.stringify(deduplicatedHistory));
        } catch (error) {
            console.warn('[DailyInspection] 중복 이력 정리 실패:', error);
        }
    }
    return deduplicatedHistory.filter((record) =>
        String(record.inspectionDate || record.date || '').startsWith(prefix)
    );
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

export const saveDailyInspectionRecord = async (userId, date, record, options = {}) => {
    if (!date || !record || typeof record !== 'object') throw new Error('저장할 점검 날짜 또는 내용이 없습니다.');
    const history = readHistory(userId);
    const dayKey = String(date).slice(0, 10);
    const previousDayRecords = history.filter((item) =>
        String(item.inspectionDate || item.date || '').slice(0, 10) === dayKey
    );
    const previousRevision = previousDayRecords.reduce((max, item) =>
        Math.max(max, Number(item.revision) || 1), 0
    );
    const payload = {
        ...record,
        id: record.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inspection-${Date.now()}-${Math.random().toString(36).slice(2)}`),
        date: dayKey,
        inspectionDate: dayKey,
        completedAt: new Date().toISOString(),
        storageMode: options.storageMode || 'device-only',
        ...(options.syncStatus ? { syncStatus: options.syncStatus } : {}),
        revision: previousRevision + 1
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
        // 같은 날짜의 이전 완료본·정정본은 제거하고 최신 기록 하나만 보관합니다.
        const nextHistory = history.filter((item) =>
            String(item.inspectionDate || item.date || '').slice(0, 10) !== dayKey
        );
        nextHistory.push(payload);
        localStorage.setItem(getHistoryKey(userId), JSON.stringify(nextHistory));
        localStorage.setItem(getDailyInspectionStorageKey(userId, date), JSON.stringify(payload));
    } catch (error) {
        console.error('[DailyInspection] 점검 기록 저장 실패:', error);
        throw new Error('점검 기록을 기기에 저장하지 못했습니다. 저장 공간을 확인해주세요.');
    }
    return payload;
};

export const readSavedDriverIdentity = (userId) => {
    try {
        const parsed = JSON.parse(localStorage.getItem(getSavedDriverIdentityKey(userId)) || 'null');
        const cached = {
            driverName: String(parsed?.driverName || '').trim(),
            vehicleNumber: String(parsed?.vehicleNumber || '').trim()
        };
        if (cached.driverName || cached.vehicleNumber) return cached;

        // Older app versions did not keep a separate identity cache. Reuse the
        // most recent locally saved inspection record as a migration fallback.
        const latestRecord = readHistory(userId)
            .filter((record) => record && (record.driverName || record.vehicleNumber))
            .sort((a, b) =>
                String(b.inspectionDate || b.date || b.completedAt || '')
                    .localeCompare(String(a.inspectionDate || a.date || a.completedAt || ''))
            )[0];
        return {
            driverName: String(latestRecord?.driverName || '').trim(),
            vehicleNumber: String(latestRecord?.vehicleNumber || '').trim()
        };
    } catch (error) {
        console.warn('[DailyInspection] 저장된 운전자 정보를 읽지 못했습니다.', error);
        return { driverName: '', vehicleNumber: '' };
    }
};

export const saveSavedDriverIdentity = (userId, identity = {}) => {
    try {
        const previous = readSavedDriverIdentity(userId);
        const next = {
            driverName: String(identity.driverName || previous.driverName || '').trim(),
            vehicleNumber: String(identity.vehicleNumber || previous.vehicleNumber || '').trim(),
            updatedAt: new Date().toISOString()
        };
        if (!next.driverName && !next.vehicleNumber) return false;
        localStorage.setItem(getSavedDriverIdentityKey(userId), JSON.stringify(next));
        return true;
    } catch (error) {
        console.warn('[DailyInspection] 운전자 정보 기기 저장 실패:', error);
        return false;
    }
};

const getSavedTransportCompanyNameKey = (userId) => `${getDailyInspectionStoragePrefix(userId)}saved-transport-company-name`;

export const readSavedTransportCompanyName = (userId) => {
    try {
        return localStorage.getItem(getSavedTransportCompanyNameKey(userId)) || '';
    } catch (error) {
        console.warn('[DailyInspection] 저장된 운송사업자명을 읽지 못했습니다.', error);
        return '';
    }
};

export const saveSavedTransportCompanyName = (userId, companyName) => {
    try {
        const value = String(companyName || '').trim();
        if (value) localStorage.setItem(getSavedTransportCompanyNameKey(userId), value);
        else localStorage.removeItem(getSavedTransportCompanyNameKey(userId));
        return true;
    } catch (error) {
        console.warn('[DailyInspection] 운송사업자명 저장 실패:', error);
        throw new Error('운송사업자명을 기기에 저장하지 못했습니다.');
    }
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


// Logged-in records saved while offline are kept in a separate retry queue.
export const listPendingDailyInspectionRecords = (userId) =>
    readHistory(userId).filter((record) => record.syncStatus === 'pending');

export const markDailyInspectionRecordSynced = (userId, date, serverRecord) => {
    const dayKey = String(date || '').slice(0, 10);
    if (!dayKey) return false;

    let syncedRecord = null;
    const nextHistory = readHistory(userId).map((record) => {
        const recordDate = String(record.inspectionDate || record.date || '').slice(0, 10);
        if (recordDate !== dayKey) return record;
        syncedRecord = {
            ...record,
            ...(serverRecord || {}),
            driverSignature: serverRecord?.driverSignature || record.driverSignature || '',
            storageMode: 'server-cache',
            syncStatus: 'synced',
            syncedAt: new Date().toISOString()
        };
        return syncedRecord;
    });

    if (!syncedRecord) return false;
    try {
        localStorage.setItem(getHistoryKey(userId), JSON.stringify(nextHistory));
        localStorage.setItem(getDailyInspectionStorageKey(userId, dayKey), JSON.stringify(syncedRecord));
        return true;
    } catch (error) {
        console.warn('[DailyInspection] 서버 동기화 상태를 기기에 반영하지 못했습니다:', error);
        return false;
    }
};

// Used once when moving legacy device-only records to the cloud.
// Pending records are handled by the retry queue; synced records no longer need migration.
export const listAllLocalDailyInspectionRecords = (userId) =>
    readHistory(userId).filter((record) => !['pending', 'synced'].includes(record.syncStatus));

