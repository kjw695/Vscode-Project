import {
    listAllLocalDailyInspectionRecords,
    listPendingDailyInspectionRecords,
    markDailyInspectionRecordSynced,
    readDailyInspectionRecord,
    saveDailyInspectionRecord
} from './dailyInspectionService';

describe('dailyInspectionService offline persistence', () => {
    const userId = 'daily-inspection-test-user';
    const date = '2026-11-23';
    const sampleRecord = {
        answers: { cleanliness: 'good' },
        actionNotes: '',
        transportCompanyName: '테스트 운송사',
        driverName: '테스트 운전자',
        vehicleNumber: '12가3456',
        driverSignature: 'data:image/png;base64,dGVzdA==',
        completed: true
    };

    beforeEach(() => {
        localStorage.clear();
    });

    test('keeps an authenticated offline record in the pending queue', async () => {
        const saved = await saveDailyInspectionRecord(userId, date, sampleRecord, {
            storageMode: 'device-pending',
            syncStatus: 'pending'
        });

        expect(saved.storageMode).toBe('device-pending');
        expect(saved.syncStatus).toBe('pending');
        expect(listPendingDailyInspectionRecords(userId)).toHaveLength(1);
        expect(readDailyInspectionRecord(userId, date).driverSignature).toBe(sampleRecord.driverSignature);
    });

    test('marks a pending record as synced and excludes it from future migration', async () => {
        await saveDailyInspectionRecord(userId, date, sampleRecord, {
            storageMode: 'device-pending',
            syncStatus: 'pending'
        });

        const didMark = markDailyInspectionRecordSynced(userId, date, {
            id: 'server-record-id',
            date,
            inspectionDate: date,
            storageMode: 'server',
            completedAt: '2026-11-23T04:00:00.000Z'
        });

        expect(didMark).toBe(true);
        expect(listPendingDailyInspectionRecords(userId)).toHaveLength(0);
        expect(listAllLocalDailyInspectionRecords(userId)).toHaveLength(0);
        expect(readDailyInspectionRecord(userId, date)).toMatchObject({
            id: 'server-record-id',
            storageMode: 'server-cache',
            syncStatus: 'synced',
            driverSignature: sampleRecord.driverSignature
        });
    });

    test('keeps legacy device-only records eligible for the one-time migration', async () => {
        await saveDailyInspectionRecord(userId, date, sampleRecord);

        expect(listAllLocalDailyInspectionRecords(userId)).toHaveLength(1);
        expect(listPendingDailyInspectionRecords(userId)).toHaveLength(0);
    });
});
