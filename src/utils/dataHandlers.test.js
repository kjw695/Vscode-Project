import Papa from 'papaparse';
import { parseCsvData } from './dataHandlers';

jest.mock('@capacitor/share', () => ({
    Share: { share: jest.fn() }
}));

jest.mock('@capacitor/filesystem', () => ({
    Filesystem: { writeFile: jest.fn() },
    Directory: { Cache: 'CACHE' },
    Encoding: { UTF8: 'utf8' }
}));

jest.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => false }
}));

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
