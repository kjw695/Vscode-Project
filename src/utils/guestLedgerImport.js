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

// Normalize date-only values and ISO timestamps to the same calendar key.
// Legacy local rows can contain a time suffix or a dotted date representation.
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


export function addGuestEntrySelection(currentIds, targetIds) {
    const next = new Set((currentIds || []).map(String));
    (targetIds || []).forEach((id) => next.add(String(id)));
    return Array.from(next);
}

export function removeGuestEntrySelection(currentIds, targetIds) {
    const next = new Set((currentIds || []).map(String));
    (targetIds || []).forEach((id) => next.delete(String(id)));
    return Array.from(next);
}

export function toggleGuestEntrySelection(currentIds, targetIds) {
    const normalizedTargets = Array.from(new Set((targetIds || []).map(String)));
    const current = new Set((currentIds || []).map(String));
    const allSelected = normalizedTargets.length > 0 && normalizedTargets.every((id) => current.has(id));

    normalizedTargets.forEach((id) => {
        if (allSelected) current.delete(id);
        else current.add(id);
    });

    return Array.from(current);
}

// Build the month cards used inside year mode. Cross-month settings follow
// the configured settlement periods; same-month settings partition the
// calendar year by actual calendar months so every date belongs to a card.
export function getGuestImportYearMonthRange(yearValue, monthIndex, startDay, endDay) {
    const year = Number(yearValue);
    const month = Number(monthIndex);
    if (Number(startDay) > Number(endDay)) {
        return getGuestImportMonthlyPeriodRange(new Date(year, month, 1), startDay, endDay);
    }

    return {
        startDate: toLocalDateKey(new Date(year, month, 1)),
        endDate: toLocalDateKey(new Date(year, month + 1, 0))
    };
}


const LEGACY_GUEST_ENTRY_COLUMNS = [
    { key: 'deliveryCount', label: '배송', kind: 'quantity' },
    { key: 'deliveryInterruptionAmount', label: '중단', kind: 'quantity' },
    { key: 'returnCount', label: '반품', kind: 'quantity' },
    { key: 'freshBagCount', label: '프레시백', kind: 'quantity' },
    { key: 'penaltyAmount', label: '패널티', kind: 'amount' },
    { key: 'industrialAccidentCost', label: '산재비', kind: 'amount' },
    { key: 'fuelCost', label: '유류비', kind: 'amount' },
    { key: 'maintenanceCost', label: '정비비', kind: 'amount' },
    { key: 'vatAmount', label: '부가세', kind: 'amount' },
    { key: 'incomeTaxAmount', label: '소득세', kind: 'amount' },
    { key: 'taxAccountantFee', label: '세무사 비용', kind: 'amount' }
];

// The spreadsheet columns are inferred from fields that actually occur in
// the currently displayed guest entries. Custom item labels remain dynamic.
export function getGuestEntryTableColumns(entries) {
    const columns = new Map();

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
        const customItems = Array.isArray(entry?.customItems) ? entry.customItems : [];
        customItems.forEach((item) => {
            if (!item?.key) return;
            const key = String(item.key);
            if (!columns.has(key)) {
                columns.set(key, {
                    key,
                    label: item.name || key,
                    kind: item.type === 'expense' || (Number(item.count) <= 0 && Number(item.amount) > 0)
                        ? 'amount'
                        : 'quantity'
                });
            }
        });

        LEGACY_GUEST_ENTRY_COLUMNS.forEach((column) => {
            if (Number(entry?.[column.key]) > 0 && !columns.has(column.key)) {
                columns.set(column.key, column);
            }
        });
    });

    return Array.from(columns.values());
}
