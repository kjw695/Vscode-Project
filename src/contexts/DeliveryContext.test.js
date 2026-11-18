import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { DeliveryProvider, useDelivery } from './DeliveryContext';
import { supabase } from '../lib/supabaseClient';
import { getDeliveryEntriesStorageKey, writeJsonStorage } from '../utils/accountDataStorage';

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
            expect(screen.getByTestId('entry-ids')).toHaveTextContent('[202]');
            expect(screen.getByTestId('loaded')).toHaveTextContent('true');
        });

        await act(async () => {
            accountARequest.resolve({ data: [makeServerRow(101, '2026-11-10')], error: null });
            await accountARequest.promise;
        });

        expect(screen.getByTestId('entry-ids')).toHaveTextContent('[202]');
        expect(screen.getByTestId('entry-ids')).not.toHaveTextContent('101');

        const accountBCache = JSON.parse(localStorage.getItem(getDeliveryEntriesStorageKey('account-b')));
        expect(accountBCache).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 202, ownerId: 'account-b' }),
        ]));
        expect(localStorage.getItem(getDeliveryEntriesStorageKey('account-a'))).toContain('local-a');
    });
});
