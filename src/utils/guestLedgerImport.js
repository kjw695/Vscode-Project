import { getDeliveryEntriesStorageKey, readJsonStorage } from './accountDataStorage';

export const GUEST_ENTRIES_STORAGE_KEY = getDeliveryEntriesStorageKey(null);
export const GUEST_ENTRIES_IMPORT_BACKUP_KEY = 'deliveryEntries:v2:guest:imported-backup';

const readArray = (key) => {
    const value = readJsonStorage(key, []);
    return Array.isArray(value) ? value : [];
};

export function getAvailableGuestEntries(userId) {
    if (!userId) return [];

    const guestEntries = readArray(GUEST_ENTRIES_STORAGE_KEY);
    const accountEntries = readArray(getDeliveryEntriesStorageKey(userId));
    const importedByThisAccount = new Set(
        accountEntries
            .filter((entry) => entry?.guestSourceAccountId === userId && entry?.guestSourceId != null)
            .map((entry) => String(entry.guestSourceId))
    );
    const importedSourceIds = new Set(
        readArray(GUEST_ENTRIES_IMPORT_BACKUP_KEY)
            .filter((entry) => entry?.importedAccountId)
            .map((entry) => String(entry.sourceId))
    );

    return guestEntries
        .filter((entry) => (
            entry &&
            entry.id != null &&
            (entry.ownerId === null || entry.ownerId === undefined) &&
            !importedByThisAccount.has(String(entry.id)) &&
            !importedSourceIds.has(String(entry.id))
        ))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export function buildGuestImportBatch({
    guestEntries,
    accountEntries,
    userId,
    selectedEntryIds,
    now = Date.now()
}) {
    if (!userId) throw new Error('로그인한 계정이 필요합니다.');

    const selectedIds = new Set((selectedEntryIds || []).map(String));
    const selectedSourceEntries = (Array.isArray(guestEntries) ? guestEntries : []).filter((entry) => (
        entry &&
        entry.id != null &&
        selectedIds.has(String(entry.id)) &&
        (entry.ownerId === null || entry.ownerId === undefined)
    ));

    const existingSourceIds = new Set(
        (Array.isArray(accountEntries) ? accountEntries : [])
            .filter((entry) => entry?.guestSourceAccountId === userId && entry?.guestSourceId != null)
            .map((entry) => String(entry.guestSourceId))
    );

    const timestamp = new Date(now).toISOString();
    const importedEntries = selectedSourceEntries
        .filter((entry) => !existingSourceIds.has(String(entry.id)))
        .map((entry, index) => {
            const sourceId = String(entry.id);
            const prefix = entry.type === 'expense' ? 'z' : 's';
            return {
                ...entry,
                id: `${prefix}guest_${now}_${index}_${encodeURIComponent(sourceId)}`,
                ownerId: userId,
                guestSourceId: sourceId,
                guestSourceAccountId: userId,
                guestImportedAt: timestamp,
                timestamp: entry.timestamp || timestamp,
                isEdited: Boolean(entry.isEdited),
                isSynced: false
            };
        });

    return {
        selectedSourceEntries,
        importedEntries,
        skippedCount: selectedSourceEntries.length - importedEntries.length
    };
}
