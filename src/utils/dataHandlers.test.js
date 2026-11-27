import Papa from 'papaparse';
import { parseCsvData, exportDataAsCsv } from './dataHandlers';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
jest.mock('@capacitor/share', () => ({
    Share: { share: jest.fn() }
}));

jest.mock('@capacitor/filesystem', () => ({
    Filesystem: { writeFile: jest.fn() },
    Directory: { Documents: 'DOCUMENTS' },
    Encoding: { UTF8: 'utf8' }
}));

jest.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: jest.fn(() => false) }
}));

beforeEach(() => {
    jest.clearAllMocks();
    Capacitor.isNativePlatform.mockReturnValue(false);
});

const parseFile = (csv) => {
    const file = new File([csv], 'ledger.csv', { type: 'text/csv;charset=utf-8' });
    return parseCsvData(file);
};

describe('CSV ledger import', () => {
    test('preserves separate records, item keys, memo, timestamp, and quoted multiline cells in v2 CSV', async () => {
        const fields = [
            '날짜', '회차', '구분', '항목명', '수량', '단가', '금액', '메모',
            '기록ID', '기록구분', '공통단가', '기록시간', '수정여부',
            '항목키', '직접금액', '항목순서', '행종류', '형식버전'
        ];
        const rows = [
            [
                '2026-11-28', 1, '수익', '배송, A구역', 10, 700, 7000,
                '메모, 첫 줄\n둘째 줄', 'record-income', '수익', 700,
                '2026-11-28T02:00:00.000Z', 'true', 'deliveryCount', 0, 0, 'item', '2'
            ],
            [
                '2026-11-28', 1, '지출', '유류비', 0, 0, 30000,
                '지출 메모', 'record-expense', '지출', 700,
                '2026-11-28T03:00:00.000Z', 'false', 'fuelCost', 30000, 0, 'item', '2'
            ]
        ];
        const csv = '\uFEFF' + Papa.unparse({ fields, data: rows }, { newline: '\r\n' });

        const result = await parseFile(csv);

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            date: '2026-11-28',
            round: 1,
            type: 'income',
            memo: '메모, 첫 줄\n둘째 줄',
            timestamp: '2026-11-28T02:00:00.000Z',
            isEdited: true
        });
        expect(result[0].customItems).toEqual([
            expect.objectContaining({
                key: 'deliveryCount',
                name: '배송, A구역',
                type: 'income',
                count: 10,
                unitPrice: 700,
                amount: 0
            })
        ]);
        expect(result[1]).toMatchObject({
            date: '2026-11-28',
            round: 1,
            type: 'expense',
            memo: '지출 메모'
        });
        expect(result[1].customItems).toEqual([
            expect.objectContaining({
                key: 'fuelCost',
                name: '유류비',
                type: 'expense',
                amount: 30000
            })
        ]);
    });

    test('continues to import the previous eight-column CSV format and separates income from expense records', async () => {
        const csv = [
            '날짜,회차,구분,항목명,수량,단가,금액,메모',
            '2026-11-28,1,수익,배송,10,700,7000,',
            '2026-11-28,1,지출,유류비,1,30000,30000,'
        ].join('\n');

        const result = await parseFile(csv);

        expect(result).toHaveLength(2);
        expect(result.find((entry) => entry.type === 'income').customItems[0]).toMatchObject({
            key: 'deliveryCount',
            type: 'income',
            count: 10,
            unitPrice: 700,
            amount: 0
        });
        expect(result.find((entry) => entry.type === 'expense').customItems[0]).toMatchObject({
            key: 'fuelCost',
            type: 'expense',
            amount: 30000
        });
    });

    test('round-trips app records through the generated Android CSV file', async () => {
        Capacitor.isNativePlatform.mockReturnValue(true);
        Filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/ledger.csv' });

        const source = [{
            id: 's18_1790000000000',
            date: '2026-11-28',
            type: 'income',
            unitPrice: 700,
            round: 1,
            memo: '메모, "중요"\n두 번째 줄',
            timestamp: '2026-11-28T02:00:00.000Z',
            isEdited: false,
            customItems: [
                {
                    key: 'deliveryCount',
                    name: '배송, A구역',
                    type: 'income',
                    count: 3,
                    unitPrice: 700,
                    amount: 0
                },
                {
                    key: 'specialBonus',
                    name: '보너스 "특별"',
                    type: 'income',
                    count: 0,
                    unitPrice: 0,
                    amount: 1200
                }
            ]
        }];

        const showMessage = jest.fn();
        await exportDataAsCsv(source, showMessage);

        expect(Filesystem.writeFile).toHaveBeenCalledTimes(1);
        expect(Share.share).not.toHaveBeenCalled();
        expect(Filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({
            path: expect.stringMatching(/^배달장부_상세내역_.*\.csv$/),
            directory: 'DOCUMENTS',
            encoding: 'utf8'
        }));
        expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
            url: 'file:///cache/ledger.csv',
            dialogTitle: 'CSV 파일 공유하기'
        }));
        expect(Share.share.mock.invocationCallOrder[0]).toBeGreaterThan(
            Filesystem.writeFile.mock.invocationCallOrder[0]
        );
        expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('내 파일 > 문서'));
        const exportedCsv = Filesystem.writeFile.mock.calls[0][0].data;
        expect(exportedCsv.startsWith('\uFEFF')).toBe(true);

        const restored = await parseFile(exportedCsv);
        expect(restored).toHaveLength(1);
        expect(restored[0]).toMatchObject({
            date: source[0].date,
            round: source[0].round,
            type: source[0].type,
            unitPrice: source[0].unitPrice,
            memo: source[0].memo,
            timestamp: source[0].timestamp
        });
        expect(restored[0].customItems).toEqual(source[0].customItems);
    });

    test('rejects malformed rows instead of silently importing a partial file', async () => {
        const csv = [
            '날짜,회차,구분,항목명,수량,단가,금액,메모',
            '2026-11-28,1,수익,배송,10,700,7000,정상',
            '2026-11-28,1,수익,이름에,쉼표가,있는,항목,10,700,7000,오류'
        ].join('\n');

        await expect(parseFile(csv)).rejects.toThrow(/CSV .*행을 읽을 수 없습니다/);
    });

    test('rejects invalid dates before restoring any rows', async () => {
        const csv = [
            '날짜,회차,구분,항목명,수량,단가,금액,메모',
            '2026-02-30,1,수익,배송,10,700,7000,'
        ].join('\n');

        await expect(parseFile(csv)).rejects.toThrow(/달력에 존재하지 않습니다/);
    });
});
