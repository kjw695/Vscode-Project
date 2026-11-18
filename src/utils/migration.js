// Account-safe preparation of legacy local data.
// This phase never uploads legacy records or settings to Supabase.
import { supabase } from '../lib/supabaseClient';
import {
    getDeliveryEntriesStorageKey,
    getAppSettingsStorageKey,
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

function getPreparedMigrationStates() {
    const prefix = 'migration_state:v2:';
    const states = [];
    try {
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key || !key.startsWith(prefix)) continue;
            const state = readJsonStorage(key, null);
            if (state?.prepared === true) {
                states.push({
                    userId: key.slice(prefix.length),
                    preparedAt: state.preparedAt || '1970-01-01T00:00:00.000Z',
                });
            }
        }
    } catch (error) {
        console.warn('[Migration] 계정별 이관 상태 확인 실패:', error);
    }
    return states.sort((a, b) => String(a.preparedAt).localeCompare(String(b.preparedAt)));
}

function getPreparedMigrationUserIds() {
    return getPreparedMigrationStates().map((state) => state.userId);
}

function isFirstPreparedMigrationAccount(userId) {
    const preparedStates = getPreparedMigrationStates();
    return preparedStates.length === 0 || preparedStates[0].userId === userId;
}

function legacyEntryFingerprint(entry) {
    return JSON.stringify(stableJson({
        id: entry?.id ?? null,
        date: entry?.date ?? null,
        type: entry?.type ?? null,
        unitPrice: Number(entry?.unitPrice ?? entry?.unit_price ?? 0),
        round: Number(entry?.round ?? 0),
        memo: entry?.memo ?? null,
        customItems: entry?.customItems ?? entry?.custom_items ?? [],
        timestamp: entry?.timestamp ?? null,
    }));
}

function mergeLegacyEntries(...entryLists) {
    const merged = new Map();
    entryLists.flat().forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const fingerprint = legacyEntryFingerprint(entry);
        if (!merged.has(fingerprint)) merged.set(fingerprint, entry);
    });
    return [...merged.values()];
}

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
    const previousState = readJsonStorage(stateKey, null);
    const bucketAtStart = readJsonStorage(UNCLASSIFIED_KEY, null);
    const hasPendingBucketForThisAccount = bucketAtStart?.status === 'pending' &&
        (bucketAtStart.reviewUserId === userId || bucketAtStart.reviewUserId === 'device');

    // 이미 처리한 계정이라도 검토 대기 장부가 남아 있으면 서버 소유권을 다시 확인해
    // 실제 해당 계정의 기록만 미분류 목록에서 제거합니다.
    if (previousState?.prepared === true && !hasPendingBucketForThisAccount) {
        return {
            success: true,
            prepared: true,
            alreadyPrepared: true,
            unclassifiedCount: bucketAtStart?.reviewUserId === userId && bucketAtStart.status === 'pending'
                ? (bucketAtStart.entries || []).length : 0,
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
        const existingBucket = readJsonStorage(UNCLASSIFIED_KEY, null);
        const existingBucketEntries = existingBucket?.status === 'pending' && Array.isArray(existingBucket.entries)
            ? existingBucket.entries : [];
        const candidateEntries = mergeLegacyEntries(safeLegacyEntries, existingBucketEntries);
        const confirmed = [];
        const unclassified = [];

        candidateEntries.forEach((entry) => {
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

        const legacySettings = readJsonStorage(LEGACY_SETTINGS_KEY, null);
        const hasLegacySettings = !!(legacySettings && typeof legacySettings === 'object' && Object.keys(legacySettings).length);
        const isFirstPreparedAccount = isFirstPreparedMigrationAccount(userId);
        const canManageReviewBucket = !existingBucket
            ? isFirstPreparedAccount
            : existingBucket.status === 'pending' && (
                existingBucket.reviewUserId === userId ||
                (existingBucket.reviewUserId === 'device' && isFirstPreparedAccount)
            );
        const hasLegacySource = candidateEntries.length > 0 || hasLegacySettings || !!existingBucket;

        if (canManageReviewBucket) {
            const hasSettingsToReview = !!existingBucket?.hasSettings || hasLegacySettings;
            if (unclassified.length > 0 || hasSettingsToReview) {
                writeJsonStorage(UNCLASSIFIED_KEY, {
                    ...(existingBucket || {}),
                    // 'device'는 검토 대기 상태일 뿐 소유권이 아닙니다.
                    // 실제 계정 소유권은 사용자 확인 버튼을 눌렀을 때만 지정합니다.
                    reviewUserId: existingBucket?.reviewUserId === userId ? userId : 'device',
                    status: 'pending',
                    createdAt: existingBucket?.createdAt || new Date().toISOString(),
                    snapshotKey: existingBucket?.snapshotKey || snapshotKey,
                    entries: unclassified,
                    hasSettings: hasSettingsToReview,
                });
            } else if (hasLegacySource) {
                // 모든 기존 장부가 현재 계정의 서버 기록과 일치한 경우에도
                // 원본 legacy 키를 나중에 게스트 데이터로 다시 포장하지 않도록 완료 표시를 남깁니다.
                writeJsonStorage(UNCLASSIFIED_KEY, {
                    ...(existingBucket || {}),
                    reviewUserId: userId,
                    status: 'classified',
                    createdAt: existingBucket?.createdAt || new Date().toISOString(),
                    snapshotKey: existingBucket?.snapshotKey || snapshotKey,
                    entries: [],
                    hasSettings: false,
                    resolvedAt: new Date().toISOString(),
                });
            }
        } else if (existingBucket?.status === 'pending' && existingBucketEntries.length > 0) {
            // 다른 계정의 검토 대기함에 현재 계정 서버 소유로 확인된 항목이 섞여 있으면
            // 그 항목만 현재 계정 저장소로 옮기고 원래 검토 대기함에서는 제외합니다.
            const verifiedFingerprints = new Set(
                existingBucketEntries
                    .filter((entry) => (serverRows || []).some((row) => matchesServerRecord(entry, row)))
                    .map(legacyEntryFingerprint)
            );
            if (verifiedFingerprints.size > 0) {
                const remainingEntries = existingBucketEntries.filter(
                    (entry) => !verifiedFingerprints.has(legacyEntryFingerprint(entry))
                );
                writeJsonStorage(UNCLASSIFIED_KEY, {
                    ...existingBucket,
                    status: remainingEntries.length > 0 || existingBucket.hasSettings ? 'pending' : 'classified',
                    entries: remainingEntries,
                    resolvedAt: remainingEntries.length === 0 && !existingBucket.hasSettings
                        ? new Date().toISOString()
                        : existingBucket.resolvedAt,
                });
            }
        }

        const savedBucket = readJsonStorage(UNCLASSIFIED_KEY, null);
        const savedUnclassifiedCount = savedBucket?.reviewUserId === userId && savedBucket.status === 'pending'
            ? (savedBucket.entries || []).length : 0;

        writeJsonStorage(stateKey, {
            prepared: true,
            preparedAt: new Date().toISOString(),
            snapshotKey,
            confirmedCount: confirmed.length,
            unclassifiedCount: savedUnclassifiedCount,
        });

        return {
            success: true,
            prepared: true,
            snapshotKey,
            confirmedCount: confirmed.length,
            unclassifiedCount: savedUnclassifiedCount,
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

    // 계정 이관이 한 번이라도 완료됐다면, 남아 있는 구버전 전역 키는
    // 이미 계정 소유권 확인에 사용된 원본입니다. 로그아웃 후 게스트 데이터로 재분류하지 않습니다.
    if (getPreparedMigrationUserIds().length > 0) {
        return { prepared: true, unclassifiedCount: 0, alreadyAccountScoped: true };
    }

    try {
        const snapshotKey = createLegacySnapshot();
        const legacyEntries = readJsonStorage(LEGACY_ENTRIES_KEY, []);
        const entries = Array.isArray(legacyEntries) ? legacyEntries : [];
        const legacySettings = readJsonStorage(LEGACY_SETTINGS_KEY, null);
        const hasSettings = !!(legacySettings && typeof legacySettings === 'object' && Object.keys(legacySettings).length);
        if (entries.length > 0 || hasSettings) {
            writeJsonStorage(UNCLASSIFIED_KEY, {
                reviewUserId: 'device',
                status: 'pending',
                createdAt: new Date().toISOString(),
                snapshotKey,
                entries,
                hasSettings,
            });
        }
        return { prepared: true, snapshotKey, unclassifiedCount: entries.length, hasSettings };
    } catch (error) {
        console.error('[Migration] 게스트 기존 데이터 보관 준비 실패:', error);
        return { prepared: false, unclassifiedCount: 0, error: error.message };
    }
}

/**
 * Reserve the review prompt for the first authenticated account that encounters
 * this device-level bucket. This is NOT ownership attribution: records stay in
 * the unclassified bucket until the user explicitly accepts the import.
 */
export function reserveUnclassifiedLegacyDataForAccount(userId) {
    if (!userId) return false;
    const bucket = readJsonStorage(UNCLASSIFIED_KEY, null);
    if (!bucket || bucket.status !== 'pending') return false;
    if (bucket.reviewUserId === 'device') {
        // 다른 계정의 이관이 이미 완료됐다면 새 계정에 검토 권한을 넘기지 않습니다.
        if (!isFirstPreparedMigrationAccount(userId)) return false;
        writeJsonStorage(UNCLASSIFIED_KEY, {
            ...bucket,
            reviewUserId: userId,
            reviewAssignedAt: new Date().toISOString(),
        });
        return true;
    }
    return bucket.reviewUserId === userId;
}

function getPendingAttributionBucket(userId) {
    const bucket = readJsonStorage(UNCLASSIFIED_KEY, null);
    if (!userId || !bucket || bucket.status !== 'pending') return null;
    // Device-level guest data can be offered to the signed-in user, but is not
    // assigned until that user explicitly confirms the attribution.
    return bucket.reviewUserId === userId ? bucket : null;
}

export function getUnclassifiedLegacyData(userId) {
    const bucket = getPendingAttributionBucket(userId);
    return Array.isArray(bucket?.entries) ? bucket.entries : [];
}

export function getUnclassifiedLegacySettings(userId) {
    const bucket = getPendingAttributionBucket(userId);
    if (!bucket) return null;
    const settings = readJsonStorage(LEGACY_SETTINGS_KEY, null);
    return settings && typeof settings === 'object' && Object.keys(settings).length > 0 ? settings : null;
}

/**
 * Explicit user choice: classify legacy records into this account's LOCAL
 * queue only. This function intentionally does not call Supabase.
 */
export function importUnclassifiedLegacyDataToAccount(userId) {
    const bucket = getPendingAttributionBucket(userId);
    if (!bucket) return { imported: 0, importedSettings: false };

    const entries = Array.isArray(bucket.entries) ? bucket.entries : [];
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

    if (imported.length > 0) writeJsonStorage(accountKey, [...current, ...imported]);

    // Preserve existing account settings. Import guest settings only when the
    // destination account has no settings yet; never overwrite an account.
    const legacySettings = readJsonStorage(LEGACY_SETTINGS_KEY, null);
    const settingsKey = getAppSettingsStorageKey(userId);
    const currentSettings = readJsonStorage(settingsKey, null);
    let importedSettings = false;
    if (legacySettings && typeof legacySettings === 'object' &&
        Object.keys(legacySettings).length > 0 &&
        (!currentSettings || Object.keys(currentSettings).length === 0)) {
        writeJsonStorage(settingsKey, legacySettings);
        importedSettings = true;
    }

    writeJsonStorage(UNCLASSIFIED_KEY, {
        ...bucket,
        reviewUserId: userId,
        status: 'imported_locally',
        resolvedAt: new Date().toISOString(),
        entries,
        settingsImportedToAccount: importedSettings,
    });

    return { imported: imported.length, importedSettings };
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
