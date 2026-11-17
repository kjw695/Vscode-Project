// Account-scoped local storage keys. The user ID is the Supabase Auth UID.
export const getDeliveryEntriesStorageKey = (userId) =>
    userId ? `deliveryEntries:v2:user:${userId}` : 'deliveryEntries:v2:guest';

export const getAppSettingsStorageKey = (userId) =>
    userId ? `appSettings:v2:user:${userId}` : 'appSettings:v2:guest';

export const getMigrationStateStorageKey = (userId) =>
    `migration_state:v2:${userId}`;

export function readJsonStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
        console.warn(`[AccountStorage] ${key} 읽기 실패:`, error);
        return fallback;
    }
}

export function writeJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
