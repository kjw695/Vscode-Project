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


const toLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Normalize date-only values and ISO timestamps to the same local calendar key.
// Database date columns normally arrive as YYYY-MM-DD; legacy local rows may
// contain a time suffix, which must not prevent the matching calendar day.
export function getGuestEntryDateKey(value) {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? '' : toLocalDateKey(value);
    }

    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const match = raw.match(/^(\d{4})[-/.]\s*(\d{1,2})[-/.]\s*(\d{1,2})/);
    if (match) {
        const [, year, month, day] = match;
        return `${year}-${String(Number(month)).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? '' : toLocalDateKey(parsed);
}

export function getGuestEntriesInRange(entries, startDate, endDate) {
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
        const dateKey = getGuestEntryDateKey(entry?.date);
        return dateKey && dateKey >= startDate && dateKey <= endDate;
    });
}

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Match the application's Settings > Aggregation Period calendar exactly.
// When startDay is later than endDay, the settlement period crosses months.
export function getGuestImportMonthlyPeriodRange(calendarDate, startDay, endDay) {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const start = Number(startDay) > Number(endDay)
        ? new Date(year, month - 1, Number(startDay))
        : new Date(year, month, Number(startDay));
    const end = new Date(year, month, Number(endDay));

    return {
        startDate: toLocalDateKey(start),
        endDate: toLocalDateKey(end)
    };
}

// Match App.js yearlyPeriod: a cross-month setting is treated as one
// accounting year from the prior December's start day to this December's end day.
export function getGuestImportYearlyPeriodRange(yearValue, startDay, endDay) {
    const year = Number(yearValue);
    const start = Number(startDay) > Number(endDay)
        ? new Date(year - 1, 11, Number(startDay))
        : new Date(year, 0, 1);
    const end = Number(startDay) > Number(endDay)
        ? new Date(year, 11, Number(endDay))
        : new Date(year, 11, 31);

    return {
        startDate: toLocalDateKey(start),
        endDate: toLocalDateKey(end)
    };
}
