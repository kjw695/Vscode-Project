const STORAGE_PREFIX = 'dailyInspection:v1:user:';

const getOwnerKey = (userId) => {
    const normalized = String(userId || 'guest').trim() || 'guest';
    return encodeURIComponent(normalized);
};

export const getDailyInspectionStoragePrefix = (userId) =>
    `${STORAGE_PREFIX}${getOwnerKey(userId)}:`;

export const getDailyInspectionStorageKey = (userId, date) =>
    `${getDailyInspectionStoragePrefix(userId)}${String(date || '').slice(0, 10)}`;

export const readDailyInspectionRecord = (userId, date) => {
    if (!date) return null;
    try {
        const raw = localStorage.getItem(getDailyInspectionStorageKey(userId, date));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        console.warn('[DailyInspection] 점검 기록을 읽지 못했습니다.', error);
        return null;
    }
};

export const saveDailyInspectionRecord = (userId, date, record) => {
    if (!date || !record || typeof record !== 'object') {
        throw new Error('저장할 점검 날짜 또는 내용이 없습니다.');
    }
    const payload = {
        ...record,
        date: String(date).slice(0, 10),
        updatedAt: new Date().toISOString()
    };
    try {
        localStorage.setItem(
            getDailyInspectionStorageKey(userId, date),
            JSON.stringify(payload)
        );
    } catch (error) {
        console.error('[DailyInspection] 점검 기록 저장 실패:', error);
        throw new Error('점검 기록을 기기에 저장하지 못했습니다. 저장 공간을 확인해주세요.');
    }
    return payload;
};
