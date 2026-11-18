import { supabase } from '../lib/supabaseClient';
import {
    getDeliveryEntriesStorageKey,
    getAppSettingsStorageKey,
    getMigrationStateStorageKey,
    readJsonStorage,
    writeJsonStorage,
} from './accountDataStorage';
import {
    migrateLocalDataToServer,
    prepareLegacyDataForGuest,
    reserveUnclassifiedLegacyDataForAccount,
    getUnclassifiedLegacyData,
    getUnclassifiedLegacySettings,
    importUnclassifiedLegacyDataToAccount,
    keepUnclassifiedLegacyDataOnDevice,
} from './migration';

jest.mock('../lib/supabaseClient', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

const LEGACY_ENTRIES_KEY = 'deliveryEntries';
const LEGACY_SETTINGS_KEY = 'appSettings';
const UNCLASSIFIED_KEY = 'legacy_unclassified:v2';

const makeEntry = (overrides = {}) => ({
    id: 's-legacy-1',
    date: '2026-11-10',
    type: 'income',
    unitPrice: 1200,
    round: 1,
    memo: null,
    customItems: [{ key: 'deliveryCount', value: 1 }],
    timestamp: '2026-11-10T10:00:00.000Z',
    ...overrides,
});

const makeServerRow = (entry, overrides = {}) => ({
    id: entry.id,
    date: entry.date,
    type: entry.type,
    unit_price: entry.unitPrice,
    round: entry.round,
    memo: entry.memo,
    custom_items: entry.customItems,
    ...overrides,
});

function mockServerRows(rows = [], error = null) {
    const eq = jest.fn().mockResolvedValue({ data: rows, error });
    const select = jest.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ select });
    return { select, eq };
}

function setLegacyData(entries, settings = null) {
    localStorage.setItem(LEGACY_ENTRIES_KEY, JSON.stringify(entries));
    if (settings) localStorage.setItem(LEGACY_SETTINGS_KEY, JSON.stringify(settings));
}

function setPendingReview(userId, entries, hasSettings = false) {
    writeJsonStorage(UNCLASSIFIED_KEY, {
        reviewUserId: userId,
        status: 'pending',
        createdAt: '2026-11-01T00:00:00.000Z',
        entries,
        hasSettings,
    });
}

describe('account-scoped local storage', () => {
    test('uses a different local storage key for every account and for guest data', () => {
        expect(getDeliveryEntriesStorageKey('account-a')).not.toBe(getDeliveryEntriesStorageKey('account-b'));
        expect(getDeliveryEntriesStorageKey(null)).not.toBe(getDeliveryEntriesStorageKey('account-a'));
        expect(getAppSettingsStorageKey('account-a')).not.toBe(getAppSettingsStorageKey('account-b'));
        expect(getMigrationStateStorageKey('account-a')).not.toBe(getMigrationStateStorageKey('account-b'));
    });
});

describe('legacy data classification and account isolation', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    test('places only an exact server-record match in the matching account cache', async () => {
        const ownedEntry = makeEntry();
        const unrelatedEntry = makeEntry({
            id: 's-legacy-2',
            date: '2026-11-11',
            unitPrice: 2400,
        });
        setLegacyData([ownedEntry, unrelatedEntry]);
        mockServerRows([makeServerRow(ownedEntry)]);

        const result = await migrateLocalDataToServer('account-a');

        expect(result.success).toBe(true);
        expect(result.confirmedCount).toBe(1);
        expect(readJsonStorage(getDeliveryEntriesStorageKey('account-a'), [])).toEqual([
            expect.objectContaining({ id: ownedEntry.id, ownerId: 'account-a', isSynced: true }),
        ]);
        expect(readJsonStorage(getDeliveryEntriesStorageKey('account-b'), [])).toEqual([]);
        expect(readJsonStorage(UNCLASSIFIED_KEY, null)).toEqual(expect.objectContaining({
            reviewUserId: 'device',
            status: 'pending',
            entries: [unrelatedEntry],
        }));
        expect(supabase.from).toHaveBeenCalledWith('entries');
        expect(mockServerRows).toBeDefined();
    });

    test('does not treat a reused server ID as ownership when record contents differ', async () => {
        const legacyEntry = makeEntry();
        setLegacyData([legacyEntry]);
        mockServerRows([makeServerRow(legacyEntry, { unit_price: 9999 })]);

        await migrateLocalDataToServer('account-a');

        expect(readJsonStorage(getDeliveryEntriesStorageKey('account-a'), [])).toEqual([]);
        expect(readJsonStorage(UNCLASSIFIED_KEY, null)?.entries).toEqual([legacyEntry]);
    });

    test('reserves unclassified guest data for the first prepared account only', async () => {
        const guestEntry = makeEntry();
        setLegacyData([guestEntry]);
        mockServerRows([]);

        await migrateLocalDataToServer('account-a');

        expect(reserveUnclassifiedLegacyDataForAccount('account-a')).toBe(true);
        expect(getUnclassifiedLegacyData('account-a')).toEqual([guestEntry]);

        mockServerRows([]);
        await migrateLocalDataToServer('account-b');

        expect(reserveUnclassifiedLegacyDataForAccount('account-b')).toBe(false);
        expect(getUnclassifiedLegacyData('account-b')).toEqual([]);
        expect(getUnclassifiedLegacyData('account-a')).toEqual([guestEntry]);
        expect(readJsonStorage(getDeliveryEntriesStorageKey('account-b'), [])).toEqual([]);
    });

    test('does not reclassify legacy account data as guest data after an account migration', () => {
        const legacyEntry = makeEntry();
        setLegacyData([legacyEntry]);
        writeJsonStorage(getMigrationStateStorageKey('account-a'), {
            prepared: true,
            preparedAt: '2026-11-18T10:00:00.000Z',
        });

        const result = prepareLegacyDataForGuest();

        expect(result).toEqual(expect.objectContaining({
            prepared: true,
            unclassifiedCount: 0,
            alreadyAccountScoped: true,
        }));
        expect(readJsonStorage(UNCLASSIFIED_KEY, null)).toBeNull();
    });

    test('does not overwrite settings already stored for the destination account', () => {
        const guestEntry = makeEntry();
        setLegacyData([guestEntry], { homeCalendarDesign: 'classic', goalAmount: 5000000 });
        setPendingReview('account-a', [guestEntry], true);
        writeJsonStorage(getAppSettingsStorageKey('account-a'), {
            homeCalendarDesign: 'current',
            goalAmount: 7000000,
        });

        const result = importUnclassifiedLegacyDataToAccount('account-a');

        expect(result).toEqual({ imported: 1, importedSettings: false });
        expect(readJsonStorage(getAppSettingsStorageKey('account-a'), null)).toEqual({
            homeCalendarDesign: 'current',
            goalAmount: 7000000,
        });
        expect(readJsonStorage(getDeliveryEntriesStorageKey('account-a'), [])[0]).toEqual(expect.objectContaining({
            ownerId: 'account-a',
            isSynced: false,
            legacyId: guestEntry.id,
        }));
        expect(supabase.from).not.toHaveBeenCalled();
    });

    test('imports guest settings only when the destination account has none', () => {
        const guestSettings = { homeCalendarDesign: 'classic', goalAmount: 5000000 };
        setLegacyData([], guestSettings);
        setPendingReview('account-a', [], true);

        const result = importUnclassifiedLegacyDataToAccount('account-a');

        expect(result).toEqual({ imported: 0, importedSettings: true });
        expect(readJsonStorage(getAppSettingsStorageKey('account-a'), null)).toEqual(guestSettings);
        expect(supabase.from).not.toHaveBeenCalled();
    });

    test('keeps unclassified data on the device without assigning it to another account', () => {
        const guestEntry = makeEntry();
        setPendingReview('account-a', [guestEntry], true);

        expect(keepUnclassifiedLegacyDataOnDevice('account-a')).toBe(true);

        expect(readJsonStorage(UNCLASSIFIED_KEY, null)).toEqual(expect.objectContaining({
            reviewUserId: 'account-a',
            status: 'device_only',
            entries: [guestEntry],
        }));
        expect(getUnclassifiedLegacyData('account-a')).toEqual([]);
        expect(readJsonStorage(getDeliveryEntriesStorageKey('account-b'), [])).toEqual([]);
    });

    test('preserves source data and does not mark migration complete when the server check fails', async () => {
        const legacyEntry = makeEntry();
        setLegacyData([legacyEntry], { goalAmount: 5000000 });
        mockServerRows([], { message: 'network unavailable' });

        const result = await migrateLocalDataToServer('account-a');

        expect(result.success).toBe(false);
        expect(result.prepared).toBe(false);
        expect(localStorage.getItem(LEGACY_ENTRIES_KEY)).toBe(JSON.stringify([legacyEntry]));
        expect(localStorage.getItem(LEGACY_SETTINGS_KEY)).toBe(JSON.stringify({ goalAmount: 5000000 }));
        expect(readJsonStorage(getMigrationStateStorageKey('account-a'), null)).toBeNull();
        expect(readJsonStorage(getDeliveryEntriesStorageKey('account-a'), [])).toEqual([]);

        const snapshotKeys = Object.keys(localStorage).filter(key => key.startsWith('legacy_snapshot:v2:'));
        expect(snapshotKeys.length).toBeGreaterThan(0);
        expect(readJsonStorage(snapshotKeys[0], null)?.rawValues).toEqual({
            [LEGACY_ENTRIES_KEY]: JSON.stringify([legacyEntry]),
            [LEGACY_SETTINGS_KEY]: JSON.stringify({ goalAmount: 5000000 }),
        });
    });

    test('skips another server lookup after an account is already prepared and no review is pending', async () => {
        writeJsonStorage(getMigrationStateStorageKey('account-a'), {
            prepared: true,
            preparedAt: '2026-11-18T10:00:00.000Z',
        });

        const result = await migrateLocalDataToServer('account-a');

        expect(result).toEqual(expect.objectContaining({
            success: true,
            prepared: true,
            alreadyPrepared: true,
        }));
        expect(supabase.from).not.toHaveBeenCalled();
    });
});
