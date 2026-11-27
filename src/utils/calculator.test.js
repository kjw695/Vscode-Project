import { isDuplicateEntry } from './calculator';

describe('isDuplicateEntry', () => {
    const baseEntry = {
        date: '2026-11-28',
        type: 'income',
        unitPrice: 700,
        round: 1,
        memo: '오전 배송',
        timestamp: '2026-11-28T02:00:00.000Z',
        customItems: [
            {
                id: 'local-item-id',
                key: 'deliveryCount',
                name: '배송',
                type: 'income',
                count: 10,
                unitPrice: 700,
                amount: 0
            }
        ]
    };

    test('recognizes the same record even if server JSON item key order and local item IDs differ', () => {
        const incoming = {
            ...baseEntry,
            timestamp: '2026-11-28T11:00:00+09:00',
            customItems: [{
                amount: 0,
                unitPrice: 700,
                count: 10,
                type: 'income',
                name: '배송',
                key: 'deliveryCount',
                id: 'another-local-id'
            }]
        };

        expect(isDuplicateEntry(baseEntry, incoming)).toBe(true);
    });

    test('does not treat different rounds as duplicates', () => {
        expect(isDuplicateEntry(baseEntry, { ...baseEntry, round: 2 })).toBe(false);
    });

    test('does not treat different memos as duplicates', () => {
        expect(isDuplicateEntry(baseEntry, { ...baseEntry, memo: '오후 배송' })).toBe(false);
    });

    test('uses timestamps to distinguish otherwise identical records when both timestamps exist', () => {
        expect(isDuplicateEntry(baseEntry, {
            ...baseEntry,
            timestamp: '2026-11-28T03:00:00.000Z'
        })).toBe(false);
    });

    test('keeps compatibility with older records that do not have timestamps', () => {
        const { timestamp, ...olderEntry } = baseEntry;
        expect(isDuplicateEntry(olderEntry, { ...olderEntry, timestamp: undefined })).toBe(true);
    });
});
