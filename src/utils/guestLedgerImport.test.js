import {
    buildGuestImportBatch,
    getAvailableGuestEntries,
    GUEST_ENTRIES_STORAGE_KEY,
    GUEST_ENTRIES_IMPORT_BACKUP_KEY,
    getGuestImportMonthlyPeriodRange,
    getGuestImportYearlyPeriodRange,
    getGuestEntryDateKey,
    getGuestEntriesInRange,
    addGuestEntrySelection,
    removeGuestEntrySelection,
    toggleGuestEntrySelection,
    getGuestImportYearMonthRange,
    getGuestEntryTableColumns
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

describe('guest import aggregation period helpers', () => {
    test('uses the configured cross-month aggregation dates for monthly selection', () => {
        expect(getGuestImportMonthlyPeriodRange(new Date(2026, 10, 1), 26, 25)).toEqual({
            startDate: '2026-10-26',
            endDate: '2026-11-25'
        });
    });

    test('uses same-month boundaries when aggregation start is not later than end', () => {
        expect(getGuestImportMonthlyPeriodRange(new Date(2026, 10, 1), 1, 30)).toEqual({
            startDate: '2026-11-01',
            endDate: '2026-11-30'
        });
    });

    test('matches the app yearly aggregation period for a cross-month setting', () => {
        expect(getGuestImportYearlyPeriodRange(2026, 26, 25)).toEqual({
            startDate: '2025-12-26',
            endDate: '2026-12-25'
        });
    });

    test('uses the calendar year when aggregation start is not later than end', () => {
        expect(getGuestImportYearlyPeriodRange(2026, 1, 31)).toEqual({
            startDate: '2026-01-01',
            endDate: '2026-12-31'
        });
    });
});



describe('guest import entry date matching', () => {
    test('normalizes date-only values and ISO timestamps to the same calendar date', () => {
        expect(getGuestEntryDateKey('2026-11-02')).toBe('2026-11-02');
        expect(getGuestEntryDateKey('2026-11-02T00:00:00.000Z')).toBe('2026-11-02');
        expect(getGuestEntryDateKey('2026. 11. 2.')).toBe('2026-11-02');
    });

    test('includes all entries within a cross-month accounting period', () => {
        const entries = [
            { id: 'before', date: '2026-10-25' },
            { id: 'start', date: '2026-10-26T00:00:00.000Z' },
            { id: 'middle', date: '2026-11-02' },
            { id: 'end', date: '2026-11-25' },
            { id: 'after', date: '2026-11-26' }
        ];

        expect(getGuestEntriesInRange(entries, '2026-10-26', '2026-11-25').map((entry) => entry.id))
            .toEqual(['start', 'middle', 'end']);
    });
});


describe('guest import selection helpers', () => {
    test('toggles a fully selected date off and a partially selected date fully on', () => {
        expect(toggleGuestEntrySelection(['a', 'b', 'outside'], ['a', 'b']))
            .toEqual(['outside']);
        expect(toggleGuestEntrySelection(['a', 'outside'], ['a', 'b']))
            .toEqual(['a', 'outside', 'b']);
    });

    test('adds and clears one period without changing selections outside it', () => {
        expect(addGuestEntrySelection(['outside'], ['a', 'b']))
            .toEqual(['outside', 'a', 'b']);
        expect(removeGuestEntrySelection(['outside', 'a', 'b'], ['a', 'b']))
            .toEqual(['outside']);
    });

    test('year month cards cover full calendar months for same-month settings', () => {
        expect(getGuestImportYearMonthRange(2026, 1, 1, 31)).toEqual({
            startDate: '2026-02-01',
            endDate: '2026-02-28'
        });
    });

    test('year month cards follow configured settlement periods for cross-month settings', () => {
        expect(getGuestImportYearMonthRange(2026, 0, 26, 25)).toEqual({
            startDate: '2025-12-26',
            endDate: '2026-01-25'
        });
    });
});


describe('guest ledger spreadsheet columns', () => {
    test('uses custom item names as dynamic columns and only includes legacy fields with values', () => {
        const columns = getGuestEntryTableColumns([
            {
                customItems: [
                    { key: 'deliveryCount', name: '배송', type: 'income', count: 12, unitPrice: 1000 },
                    { key: 'deliveryInterruptionAmount', name: '중단', type: 'income', count: 2, unitPrice: 700 }
                ]
            },
            {
                penaltyAmount: 5000,
                fuelCost: 0
            }
        ]);

        expect(columns).toEqual([
            { key: 'deliveryCount', label: '배송', kind: 'quantity' },
            { key: 'deliveryInterruptionAmount', label: '중단', kind: 'quantity' },
            { key: 'penaltyAmount', label: '패널티', kind: 'amount' }
        ]);
    });

    test('shows amount-only custom items as amount columns', () => {
        expect(getGuestEntryTableColumns([{
            customItems: [{ key: 'fuel', name: '주유비', type: 'expense', amount: 35000 }]
        }])).toEqual([
            { key: 'fuel', label: '주유비', kind: 'amount' }
        ]);
    });
});
