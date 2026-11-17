// Account-safe preparation of legacy local data.
// This phase never uploads legacy records or settings to Supabase.
import { supabase } from '../lib/supabaseClient';
import {
    getDeliveryEntriesStorageKey,
    getMigrationStateStorageKey,
    readJsonStorage,
    writeJsonStorage,
} from './accountDataStorage';

const LEGACY_ENTRIES_KEY = 'deliveryEntries';
const LEGACY_SETTINGS_KEY = 'appSettings';
const SNAPSHOT_PREFIX = 'legacy_snapshot:v2:';
const UNCLASSIFIED_KEY = 'legacy_unclassified:v2';

const stableJson = (value) => {
    if (Array.isArray(value)) return value.map(stableJson);
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = stableJson(value[key]);
            return result;
        }, {});
    }
    return value;
};

const sameValue = (a, b) =>
    JSON.stringify(stableJson(a ?? null)) === JSON.stringify(stableJson(b ?? null));

function matchesServerRecord(localEntry, serverRow) {
    // A server ID alone is not sufficient: compare the record contents as well.
    return String(localEntry.id) === String(serverRow.id) &&
        localEntry.date === serverRow.date &&
        localEntry.type === serverRow.type &&
        Number(localEntry.unitPrice ?? localEntry.unit_price ?? 0) === Number(serverRow.unit_price ?? 0) &&
        Number(localEntry.round ?? 0) === Number(serverRow.round ?? 0) &&
        (localEntry.memo ?? null) === (serverRow.memo ?? null) &&
        sameValue(localEntry.customItems ?? localEntry.custom_items ?? [], serverRow.custom_items ?? []);
}

function createLegacySnapshot() {
    const timestamp = new Date().toISOString();
    const rawValues = {};
    const otherPendingKeys = [];

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && (/pending/i.test(key) || /migration_completed_v1/.test(key))) {
            otherPendingKeys.push({ key, value: localStorage.getItem(key) });
        }
    }

    rawValues[LEGACY_ENTRIES_KEY] = localStorage.getItem(LEGACY_ENTRIES_KEY);
    rawValues[LEGACY_SETTINGS_KEY] = localStorage.getItem(LEGACY_SETTINGS_KEY);

    const snapshotKey = `${SNAPSHOT_PREFIX}${Date.now()}`;
    writeJsonStorage(snapshotKey, {
        createdAt: timestamp,
        rawValues,
        relatedPendingAndMigrationKeys: otherPendingKeys,
    });
    return snapshotKey;
}

/**
 * One-time, per-account classification.
 * Confirmed server matches are cached for this account; all ambiguous legacy
 * records remain in a device-level review bucket and are never uploaded here.
 */
export async function migrateLocalDataToServer(userId) {
    if (!userId) {
        return { success: false, prepared: false, unclassifiedCount: 0, error: '사용자 정보가 없습니다.' };
    }

    const stateKey = getMigrationStateStorageKey(userId);
    const pendingDeviceBucket = readJsonStorage(UNCLASSIFIED_KEY, null);
    if (pendingDeviceBucket?.reviewUserId === 'device' && pendingDeviceBucket.status === 'pending') {
        writeJsonStorage(UNCLASSIFIED_KEY, { ...pendingDeviceBucket, reviewUserId: userId });
    }
    const previousState = readJsonStorage(stateKey, null);
    if (previousState?.prepared === true) {
        const bucket = readJsonStorage(UNCLASSIFIED_KEY, null);
        return {
            success: true,
            prepared: true,
            alreadyPrepared: true,
            unclassifiedCount: bucket?.reviewUserId === userId && bucket.status === 'pending'
                ? (bucket.entries || []).length : 0,
        };
    }

    let snapshotKey;
    try {
        snapshotKey = createLegacySnapshot();
        const legacyEntries = readJsonStorage(LEGACY_ENTRIES_KEY, []);
        const safeLegacyEntries = Array.isArray(legacyEntries) ? legacyEntries : [];

        const { data: serverRows, error } = await supabase
            .from('entries')
            .select('*')
            .eq('user_id', userId);

        if (error) throw new Error(`현재 계정 서버 데이터 확인 실패: ${error.message}`);

        const accountKey = getDeliveryEntriesStorageKey(userId);
        const accountEntries = readJsonStorage(accountKey, []);
        const confirmed = [];
        const unclassified = [];

        safeLegacyEntries.forEach((entry) => {
            const matchingServerRow = (serverRows || []).find((row) =>
                matchesServerRecord(entry, row)
            );

            if (matchingServerRow) {
                confirmed.push({
                    ...entry,
                    id: matchingServerRow.id,
                    ownerId: userId,
                    isSynced: true,
                });
            } else {
                unclassified.push({ ...entry });
            }
        });

        if (confirmed.length > 0) {
            const merged = [...accountEntries];
            confirmed.forEach((entry) => {
                if (!merged.some((existing) => String(existing.id) === String(entry.id))) {
                    merged.push(entry);
                }
            });
            writeJsonStorage(accountKey, merged);
        }

        if (unclassified.length > 0) {
            const existingBucket = readJsonStorage(UNCLASSIFIED_KEY, null);
            if (!existingBucket) {
                writeJsonStorage(UNCLASSIFIED_KEY, {
                    reviewUserId: userId,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    entries: unclassified,
                });
            }
        }

        writeJsonStorage(stateKey, {
            prepared: true,
            preparedAt: new Date().toISOString(),
            snapshotKey,
            confirmedCount: confirmed.length,
            unclassifiedCount: unclassified.length,
        });

        return {
            success: true,
            prepared: true,
            snapshotKey,
            confirmedCount: confirmed.length,
            unclassifiedCount: unclassified.length,
        };
    } catch (error) {
        console.error('[Migration] 안전한 로컬 분류 준비 실패:', error);
        return {
            success: false,
            prepared: false,
            snapshotKey: snapshotKey || null,
            unclassifiedCount: 0,
            error: error.message,
        };
    }
}

export function prepareLegacyDataForGuest() {
    const existingBucket = readJsonStorage(UNCLASSIFIED_KEY, null);
    if (existingBucket) {
        return {
            prepared: true,
            unclassifiedCount: existingBucket.reviewUserId === 'device' && existingBucket.status === 'pending'
                ? (existingBucket.entries || []).length : 0,
        };
    }

    try {
        const snapshotKey = createLegacySnapshot();
        const legacyEntries = readJsonStorage(LEGACY_ENTRIES_KEY, []);
        const entries = Array.isArray(legacyEntries) ? legacyEntries : [];
        if (entries.length > 0) {
            writeJsonStorage(UNCLASSIFIED_KEY, {
                reviewUserId: 'device',
                status: 'pending',
                createdAt: new Date().toISOString(),
                snapshotKey,
                entries,
            });
        }
        return { prepared: true, snapshotKey, unclassifiedCount: entries.length };
    } catch (error) {
        console.error('[Migration] 게스트 기존 데이터 보관 준비 실패:', error);
        return { prepared: false, unclassifiedCount: 0, error: error.message };
    }
}

export function getUnclassifiedLegacyData(userId) {
    const bucket = readJsonStorage(UNCLASSIFIED_KEY, null);
    if (!userId || !bucket || bucket.reviewUserId !== userId || bucket.status !== 'pending') {
        return [];
    }
    return Array.isArray(bucket.entries) ? bucket.entries : [];
}

/**
 * Explicit user choice: classify legacy records into this account's LOCAL
 * queue only. This function intentionally does not call Supabase.
 */
export function importUnclassifiedLegacyDataToAccount(userId) {
    const entries = getUnclassifiedLegacyData(userId);
    if (!entries.length) return { imported: 0 };

    const accountKey = getDeliveryEntriesStorageKey(userId);
    const current = readJsonStorage(accountKey, []);
    const imported = entries.map((entry, index) => ({
        ...entry,
        id: `${entry.type === 'expense' ? 'z' : 's'}legacy_${Date.now()}_${index}`,
        legacyId: entry.id ?? null,
        ownerId: userId,
        timestamp: entry.timestamp || new Date().toISOString(),
        isEdited: entry.isEdited || false,
        isSynced: false,
    }));

    writeJsonStorage(accountKey, [...current, ...imported]);
    writeJsonStorage(UNCLASSIFIED_KEY, {
        reviewUserId: userId,
        status: 'imported_locally',
        resolvedAt: new Date().toISOString(),
        entries,
    });

    return { imported: imported.length };
}

export function keepUnclassifiedLegacyDataOnDevice(userId) {
    const bucket = readJsonStorage(UNCLASSIFIED_KEY, null);
    if (!bucket || bucket.reviewUserId !== userId || bucket.status !== 'pending') return false;

    if (userId === 'device') {
        const guestKey = getDeliveryEntriesStorageKey(null);
        const current = readJsonStorage(guestKey, []);
        const guestEntries = (bucket.entries || []).map((entry, index) => ({
            ...entry,
            id: `${entry.type === 'expense' ? 'z' : 's'}legacy_guest_${Date.now()}_${index}`,
            legacyId: entry.id ?? null,
            ownerId: null,
            timestamp: entry.timestamp || new Date().toISOString(),
            isEdited: entry.isEdited || false,
            isSynced: false,
        }));
        writeJsonStorage(guestKey, [...current, ...guestEntries]);
        writeJsonStorage(UNCLASSIFIED_KEY, {
            ...bucket,
            status: 'guest_local',
            resolvedAt: new Date().toISOString(),
        });
        return true;
    }

    writeJsonStorage(UNCLASSIFIED_KEY, {
        ...bucket,
        status: 'device_only',
        resolvedAt: new Date().toISOString(),
    });
    return true;
}

export function deferUnclassifiedLegacyData(userId) {
    const bucket = readJsonStorage(UNCLASSIFIED_KEY, null);
    return !!(bucket && bucket.reviewUserId === userId && bucket.status === 'pending');
}

export function listSnapshots() {
    const snapshots = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.startsWith(SNAPSHOT_PREFIX)) snapshots.push(key);
    }
    return snapshots.sort().reverse();
}

export function getSnapshot(snapshotKey) {
    return readJsonStorage(snapshotKey, null);
}
