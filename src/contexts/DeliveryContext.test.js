import React, { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { DeliveryProvider, useDelivery } from './DeliveryContext';
import { supabase } from '../lib/supabaseClient';
import { getDeliveryEntriesStorageKey, writeJsonStorage } from '../utils/accountDataStorage';
import { GUEST_ENTRIES_STORAGE_KEY, GUEST_ENTRIES_IMPORT_BACKUP_KEY } from '../utils/guestLedgerImport';

let mockAuthState = {
    user: { id: 'account-a' },
    isLoggedIn: true,
    isAuthLoading: false,
};

jest.mock('./AuthContext', () => ({
    useAuth: () => mockAuthState,
}));

jest.mock('../lib/supabaseClient', () => ({
    supabase: {
        from: jest.fn(),
        rpc: jest.fn(),
        channel: jest.fn(),
        removeChannel: jest.fn(),
    },
}));

function GuestImportProbe() {
    const { importGuestEntries, entries, isDataLoaded } = useDelivery();
    const [result, setResult] = useState(null);
    return (
        <div>
            <output data-testid="guest-import-loaded">{String(isDataLoaded)}</output>
            <output data-testid="guest-import-result">{result ? JSON.stringify(result) : ''}</output>
            <output data-testid="guest-import-entries">{JSON.stringify(entries.map(entry => entry.id))}</output>
            <button type="button" onClick={async () => setResult(await importGuestEntries(['guest-source-1']))}>
                가져오기 실행
            </button>
        </div>
    );
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function makeServerRow(id, date) {
    return {
        id,
        user_id: id === 101 ? 'account-a' : 'account-b',
        date,
        type: 'income',
        unit_price: 1200,
        round: 1,
        memo: null,
        custom_items: [],
        is_edited: false,
        created_at: `${date}T10:00:00.000Z`,
    };
}

function DeliveryProbe() {
    const { entries, isDataLoaded, isLoading } = useDelivery();
    return (
        <div>
            <output data-testid="entry-ids">{JSON.stringify(entries.map(entry => entry.id))}</output>
            <output data-testid="loaded">{String(isDataLoaded)}</output>
            <output data-testid="loading">{String(isLoading)}</output>
        </div>
    );
}

describe('DeliveryContext account switching', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        mockAuthState = {
            user: { id: 'account-a' },
            isLoggedIn: true,
            isAuthLoading: false,
        };
    });

    test('does not expose a previous account response after switching accounts during a pending request', async () => {
        const accountARequest = deferred();
        const accountBRequest = deferred();
        const requests = {
            'account-a': accountARequest,
            'account-b': accountBRequest,
        };

        writeJsonStorage(getDeliveryEntriesStorageKey('account-a'), [{
            id: 'local-a',
            ownerId: 'account-a',
            date: '2026-11-10',
            type: 'income',
            unitPrice: 1000,
            round: 1,
            isSynced: false,
        }]);
        writeJsonStorage(getDeliveryEntriesStorageKey('account-b'), [{
            id: 'local-b',
            ownerId: 'account-b',
            date: '2026-11-11',
            type: 'income',
            unitPrice: 1000,
            round: 1,
            isSynced: false,
        }]);

        supabase.from.mockImplementation(() => ({
            select: () => ({
                eq: (_column, userId) => ({
                    order: () => requests[userId].promise,
                }),
            }),
        }));
        supabase.rpc.mockResolvedValue({ data: null, error: null });

        const channel = {
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn().mockReturnThis(),
        };
        supabase.channel.mockReturnValue(channel);

        const view = render(
            <DeliveryProvider>
                <DeliveryProbe />
            </DeliveryProvider>
        );

        await waitFor(() => expect(supabase.from).toHaveBeenCalledTimes(1));
        expect(screen.getByTestId('entry-ids')).toHaveTextContent('[]');

        mockAuthState = {
            user: { id: 'account-b' },
            isLoggedIn: true,
            isAuthLoading: false,
        };
        view.rerender(
            <DeliveryProvider>
                <DeliveryProbe />
            </DeliveryProvider>
        );

        await waitFor(() => expect(supabase.from).toHaveBeenCalledTimes(2));
        expect(screen.getByTestId('entry-ids')).toHaveTextContent('[]');
        expect(screen.getByTestId('loaded')).toHaveTextContent('false');

        await act(async () => {
            accountBRequest.resolve({ data: [makeServerRow(202, '2026-11-11')], error: null });
            await accountBRequest.promise;
        });

        await waitFor(() => {
            expect(screen.getByTestId('entry-ids')).toHaveTextContent('202');
            expect(screen.getByTestId('loaded')).toHaveTextContent('true');
        });

        await act(async () => {
            accountARequest.resolve({ data: [makeServerRow(101, '2026-11-10')], error: null });
            await accountARequest.promise;
        });

        expect(screen.getByTestId('entry-ids')).toHaveTextContent('202');
        expect(screen.getByTestId('entry-ids')).not.toHaveTextContent('101');

        const accountBCache = JSON.parse(localStorage.getItem(getDeliveryEntriesStorageKey('account-b')));
        expect(accountBCache).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 202, ownerId: 'account-b' }),
        ]));
        expect(localStorage.getItem(getDeliveryEntriesStorageKey('account-a'))).toContain('local-a');
    });

    test('imports selected guest entries into only the active account and archives the guest originals', async () => {
        mockAuthState = {
            user: { id: 'account-a' },
            isLoggedIn: true,
            isAuthLoading: false,
        };

        writeJsonStorage(getDeliveryEntriesStorageKey('account-a'), [{
            id: 'account-a-existing',
            ownerId: 'account-a',
            date: '2026-11-16',
            type: 'income',
            isSynced: true,
        }]);
        writeJsonStorage(GUEST_ENTRIES_STORAGE_KEY, [{
            id: 'guest-source-1',
            ownerId: null,
            date: '2026-11-17',
            type: 'income',
            unitPrice: 1000,
            round: 1,
            customItems: [{ key: 'deliveryCount', name: '배송', type: 'income', count: 10, unitPrice: 1000 }],
            timestamp: '2026-11-17T09:00:00.000Z',
            isSynced: false,
        }]);

        supabase.from.mockImplementation(() => ({
            select: () => ({
                eq: () => ({
                    order: () => Promise.resolve({ data: [], error: null }),
                }),
            }),
            insert: () => ({
                select: () => ({
                    single: () => Promise.resolve({
                        data: { id: 909, created_at: '2026-11-17T09:00:00.000Z' },
                        error: null,
                    }),
                }),
            }),
        }));
        supabase.rpc.mockResolvedValue({ data: null, error: null });

        const channel = {
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn().mockReturnThis(),
        };
        supabase.channel.mockReturnValue(channel);

        render(
            <DeliveryProvider>
                <GuestImportProbe />
            </DeliveryProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('guest-import-loaded')).toHaveTextContent('true');
        });

        await act(async () => {
            screen.getByRole('button', { name: '가져오기 실행' }).click();
        });

        await waitFor(() => {
            expect(screen.getByTestId('guest-import-result')).toHaveTextContent('"importedCount":1');
        });

        const accountRows = JSON.parse(localStorage.getItem(getDeliveryEntriesStorageKey('account-a')));
        expect(accountRows).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 909,
                ownerId: 'account-a',
                guestSourceId: 'guest-source-1',
                guestSourceAccountId: 'account-a',
                isSynced: true,
            }),
        ]));
        expect(accountRows).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'account-a-existing' }),
        ]));

        expect(JSON.parse(localStorage.getItem(GUEST_ENTRIES_STORAGE_KEY))).toEqual([]);
        expect(JSON.parse(localStorage.getItem(GUEST_ENTRIES_IMPORT_BACKUP_KEY))).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    sourceId: 'guest-source-1',
                    importedAccountId: 'account-a',
                }),
            ])
        );
        expect(localStorage.getItem(getDeliveryEntriesStorageKey('account-b'))).toBeNull();
    });
});
