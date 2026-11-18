import {
    buildGuestImportBatch,
    getAvailableGuestEntries,
    GUEST_ENTRIES_STORAGE_KEY,
    GUEST_ENTRIES_IMPORT_BACKUP_KEY
} from './guestLedgerImport';

describe('guest ledger import', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('only exposes guest-owned entries that have not already been imported', () => {
        const guestEntries = [
            { id: 's1', date: '2026-11-01', ownerId: null },
            { id: 's2', date: '2026-11-02', ownerId: null },
            { id: 's3', date: '2026-11-03', ownerId: 'account-a' }
        ];
        localStorage.setItem(GUEST_ENTRIES_STORAGE_KEY, JSON.stringify(guestEntries));
        localStorage.setItem('deliveryEntries:v2:user:account-a', JSON.stringify([
            { id: 's1_imported', guestSourceId: 's1', guestSourceAccountId: 'account-a' }
        ]));
        localStorage.setItem(GUEST_ENTRIES_IMPORT_BACKUP_KEY, JSON.stringify([
            { sourceId: 's2', importedAccountId: 'account-b' }
        ]));

        expect(getAvailableGuestEntries('account-a')).toEqual([]);
    });

    test('creates account-owned pending records and preserves original source fields', () => {
        const source = {
            id: 's7_123',
            ownerId: null,
            date: '2026-11-17',
            type: 'income',
            customItems: [{ key: 'deliveryCount', count: 12, type: 'income' }],
            timestamp: '2026-11-17T09:00:00.000Z',
            isEdited: true
        };

        const result = buildGuestImportBatch({
            guestEntries: [source],
            accountEntries: [],
            userId: 'account-a',
            selectedEntryIds: ['s7_123'],
            now: Date.parse('2026-11-18T00:00:00.000Z')
        });

        expect(result.importedEntries).toHaveLength(1);
        expect(result.importedEntries[0]).toMatchObject({
            ownerId: 'account-a',
            guestSourceId: 's7_123',
            guestSourceAccountId: 'account-a',
            date: '2026-11-17',
            customItems: source.customItems,
            timestamp: source.timestamp,
            isEdited: true,
            isSynced: false
        });
        expect(result.importedEntries[0].id.startsWith('s')).toBe(true);
        expect(source.ownerId).toBeNull();
        expect(result.skippedCount).toBe(0);
    });

    test('does not duplicate a source entry already imported into the same account', () => {
        const result = buildGuestImportBatch({
            guestEntries: [{ id: 'z2', ownerId: null, type: 'expense', date: '2026-11-12' }],
            accountEntries: [{ id: 'z_existing', guestSourceId: 'z2', guestSourceAccountId: 'account-a' }],
            userId: 'account-a',
            selectedEntryIds: ['z2']
        });

        expect(result.importedEntries).toHaveLength(0);
        expect(result.skippedCount).toBe(1);
    });

    test('does not import entries owned by another account or unselected entries', () => {
        const result = buildGuestImportBatch({
            guestEntries: [
                { id: 's1', ownerId: null, type: 'income' },
                { id: 's2', ownerId: 'account-b', type: 'income' },
                { id: 's3', ownerId: null, type: 'income' }
            ],
            accountEntries: [],
            userId: 'account-a',
            selectedEntryIds: ['s1', 's2']
        });

        expect(result.selectedSourceEntries.map((entry) => entry.id)).toEqual(['s1']);
        expect(result.importedEntries).toHaveLength(1);
    });

    test('does not reuse local IDs and marks expense entries with z prefix', () => {
        const result = buildGuestImportBatch({
            guestEntries: [{ id: 'expense-1', ownerId: null, type: 'expense' }],
            accountEntries: [],
            userId: 'account-a',
            selectedEntryIds: ['expense-1'],
            now: 12345
        });

        expect(result.importedEntries[0].id).toMatch(/^zguest_12345_0_/);
    });
});
