const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const safeSignatureImage = (value) => (
    typeof value === 'string' && value.startsWith('data:image/png;base64,')
        ? escapeHtml(value)
        : ''
);

const OFFICIAL_ITEMS = [
    ['cleanliness', '외관점검', '번호판, 전면유리, 후사경 등의 청결상태'],
    ['lighting', '외관점검', '후미등, 차폭등 등 등화장치 작동상태'],
    ['wipers', '외관점검', '창닦이기 작동상태'],
    ['cargoBody', '외관점검', '적재함(보조지지대 포함), 측면 보호대, 후부반사판, 트레일러 연결장치의 부착 상태 및 훼손 여부'],
    ['tires', '상태점검', '타이어 손상 및 마모(1.6mm 이상) 여부'],
    ['cargoFixing', '상태점검', '화물, 적재함 지지대(판스프링) 등의 고정상태'],
    ['wheelNuts', '상태점검', '바퀴 너트 등 균열 여부'],
    ['fluidsAndWarning', '기타', '냉각수, 공기압, 엔진오일 등 차량 이상 여부(계기판 확인)'],
    ['seatBelt', '기타', '좌석 안전띠 상태'],
    ['fireExtinguisher', '기타', '소화기 비치 여부'],
    ['warningTriangle', '기타', '안전삼각대 등 비치 여부']
]; 

const dateLabel];

const dateLabel = (date) => {
    const [year, month, day] = String(date).split('-').map(Number);
    return `${year}년 ${month}월 ${day}일`;
};

export const printDailyInspectionMonth = (records, year, month) => {
    const monthRecords = [...(records || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!monthRecords.length) {
        throw new Error('출력할 점검 기록이 없습니다.');
    }

    const latestByDay = new Map();
    monthRecords.forEach((record) => latestByDay.set(Number(String(record.date).slice(8, 10)), record));
    const first = monthRecords[0] || {};
    const dateHeaders = Array.from({ length: 31 }, (_, index) => `<th>${index + 1}</th>`).join('');
    const itemGroups = [
        { category: '외관점검', items: OFFICIAL_ITEMS.slice(0, 4) },
        { category: '상태점검', items: OFFICIAL_ITEMS.slice(4, 7) },
        { category: '기타', items: OFFICIAL_ITEMS.slice(7, 11) }
    ];
    const officialRows = itemGroups.map(({ category, items }) => items.map(([id, , label], itemIndex) => {
        const cells = Array.from({ length: 31 }, (_, dayIndex) => {
            const record = latestByDay.get(dayIndex + 1);
            const answer = record?.answers?.[id];
            return `<td>${answer === 'good' ? '○' : answer === 'bad' ? '×' : record?.isNotOperated ? '미' : ''}</td>`;
        }).join('');
        const categoryCell = itemIndex === 0
            ? `<th class="category" rowspan="${items.length}">${category}</th>`
            : '';
        return `<tr>${categoryCell}<th class="item">${escapeHtml(label)}</th>${cells}</tr>`;
    }).join('')).join('');

    const signatureCells = Array.from({ length: 31 }, (_, dayIndex) => {
        const record = latestByDay.get(dayIndex + 1);
        const signature = safeSignatureImage(record?.driverSignature);
        return `<td>${signature ? `<img class="signature-cell" src="${signature}" alt="점검자 서명" />` : ''}</td>`;
    }).join('');

    const actionEntries = monthRecords
        .filter((record) => String(record.actionNotes || '').trim())
        .map((record) => `${Number(String(record.date).slice(8, 10))}일: ${String(record.actionNotes).trim()}`);
    const actionNotes = actionEntries.length ? actionEntries.join(' / ') : '해당 없음';

        const detailPages = monthRecords.map((record) => {
        const rows = OFFICIAL_ITEMS.map(([id, , label], index) => {
            const answer = record.answers?.[id];
            const result = answer === 'good' ? '양호' : answer === 'bad' ? '불량(정비필요)' : '미기재';
            return `<tr><td>${index + 1}</td><td>${escapeHtml(label)}</td><td>${result}</td></tr>`;
        }).join('');
        const extras = [
            ['제동장치', 'brakes'],
            ['원동기 누유·냉각계통 추가 확인', 'engineLeak'],
            ['불법 부착물·개조 여부', 'illegalAttachments']
        ].map(([label, key]) => {
            const answer = record.answers?.[key];
            const result = answer === 'good' ? '양호' : answer === 'bad' ? '불량(정비필요)' : '미기재';
            return `<tr><td>${escapeHtml(label)}</td><td>${result}</td></tr>`;
        }).join('');

        return `
            <section class="detail page-break">
                <h2>일일 점검 상세 기록 - ${escapeHtml(dateLabel(record.date))}</h2>
                <div class="meta">
                    <span>차량번호: ${escapeHtml(record.vehicleNumber)}</span>
                    <span>운전자: ${escapeHtml(record.driverName)}</span>
                    <span>완료 시각(기기): ${escapeHtml(record.completedAt || '-')}</span>
                </div>
                <table>
                    <thead><tr><th>No.</th><th>공식 점검 항목</th><th>점검 결과</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <h3>추가 안전점검 항목</h3>
                <table><tbody>${extras}</tbody></table>
                <h3>불량상태 조치 기록</h3>
                <p class="notes">${escapeHtml(record.actionNotes || '해당 없음')}</p>
                <div class="signatures">
                    <div>
                        <b>운전자(점검자) 서명</b>
                        <img src="${safeSignatureImage(record.driverSignature)}" alt="운전자 서명" />
                    </div>
                </div>
                <p class="footnote">기기 로컬 저장 기록이며, 기기 기록 시각은 서버 공인 타임스탬프가 아닙니다.</p>
            </section>
        `;
    }).join('');

    const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>운수종사자 일상점검표 ${year}-${String(month).padStart(2, '0')}</title>
<style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { background: #fff !important; color: #111 !important; }
    body { font-family: Arial, 'Malgun Gothic', sans-serif; font-size: 9px; margin: 0; padding: 16px; }
    .toolbar { position: sticky; top: 0; z-index: 5; display: flex; justify-content: flex-end; gap: 8px; padding: 10px; margin: -16px -16px 16px; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; }
    .toolbar button { border: 0; border-radius: 8px; padding: 10px 14px; background: #1d4ed8; color: #fff; font-size: 14px; font-weight: 700; }
    .toolbar button.secondary { background: #475569; }
    h1 { text-align: center; font-size: 17px; margin: 0 0 8px; }
    h2 { font-size: 15px; margin: 0 0 8px; }
    h3 { font-size: 11px; margin: 12px 0 5px; }
    .summary { display: flex; gap: 18px; margin: 8px 0; flex-wrap: wrap; }
    .summary span { border-bottom: 1px solid #333; padding: 3px 5px; min-width: 130px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; }
    th, td { border: 1px solid #555; padding: 3px 1px; text-align: center; overflow-wrap: anywhere; color: #111; background: #fff; }
    .summary { display: grid; grid-template-columns: 1fr 1.2fr 1fr 1fr; gap: 8px; margin: 8px 0; }
    .summary span { border-bottom: 1px solid #333; padding: 3px 4px; min-width: 0; white-space: nowrap; }
    .category { width: 18mm; font-weight: 700; }
    .item { width: 77mm; text-align: left; padding: 3px 4px; font-weight: 400; }
    .summary-table th, .summary-table td { border: 1px solid #333; }
    .summary-table th:not(.item):not(.category), .summary-table td { font-size: 6.5pt; padding: 2px 0.5px; }
    .summary-table .item, .summary-table .category { font-size: 7pt; }
    .summary-table .signature-row td { height: 13mm; padding: 1px; }
    .signature-cell { display: block; width: 100%; max-height: 10mm; object-fit: contain; }
    .summary-table .action-row td { text-align: left; padding: 5px; font-size: 7pt; white-space: pre-wrap; }
    .legend { text-align: right; margin: 5px 0; }
    .page-break { break-before: page; page-break-before: always; }
    .detail { margin-top: 24px; padding-top: 12px; }
    .detail table { margin: 7px 0; }
    .detail th, .detail td { padding: 5px; font-size: 9px; }
    .meta { display: flex; gap: 18px; flex-wrap: wrap; margin: 8px 0; }
    .notes { border: 1px solid #777; min-height: 35px; padding: 7px; white-space: pre-wrap; }
    .signatures { display: flex; gap: 20px; margin-top: 12px; }
    .signatures > div { width: 50%; border: 1px solid #777; padding: 6px; min-height: 95px; }
    .signatures img { display: block; width: 100%; max-width: 420px; height: 60px; object-fit: contain; background: #fff; }
    .footnote { font-size: 8px; color: #555; margin-top: 8px; }
    @page { size: 297mm 210mm; margin: 10mm; }
    @media screen { body { max-width: 1200px; margin: 0 auto; } .detail { border-top: 2px dashed #cbd5e1; } }
    @media print {
        html, body { background: #fff !important; color: #111 !important; padding: 0; }
        .toolbar { display: none !important; }
        .page-break { break-before: page; page-break-before: always; }
        .detail { margin-top: 0; padding-top: 0; border: 0; }
        table, tr, img { break-inside: avoid; page-break-inside: avoid; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
</style>
</head>
<body>
    <div class="toolbar">
        <button type="button" onclick="window.print()">PDF 저장 / 인쇄</button>
        <button type="button" class="secondary" onclick="window.parent.document.getElementById('daily-inspection-print-frame')?.remove()">닫기</button>
    </div>
    <h1>운수종사자 일상점검표</h1>
    <div class="summary">
        <span>점검연월: ${year}년 ${month}월</span>
        <span>운송사업자명: __________________</span>
        <span>차량번호: ${escapeHtml(first.vehicleNumber || '')}</span>
        <span>운수종사자명: ${escapeHtml(first.driverName || '')}</span>
    </div>
    <div class="legend">점검결과: ○ 양호　× 불량　미 미운행</div>
    <table class="summary-table">
        <thead><tr><th class="category">점검 항목 구분</th><th class="item">점검 항목</th>${dateHeaders}</tr></thead>
        <tbody>
            ${officialRows}
            <tr class="signature-row"><th colspan="2">점검자 확인(서명)</th>${signatureCells}</tr>
            <tr class="action-row"><th colspan="2">불량상태 조치 기록</th><td colspan="31">${escapeHtml(actionNotes)}</td></tr>
        </tbody>
    </table>
    <p class="footnote">국토교통부 서식에 따른 월간 점검표입니다. 앱의 추가 안전점검 3개 항목과 일별 상세 이력은 뒤쪽 상세 페이지에 별도로 표시합니다.</p>
    ${detailPages}
</body>
</html>`;

    const existing = document.getElementById('daily-inspection-print-frame');
    if (existing) existing.remove();

    const frame = document.createElement('iframe');
    frame.id = 'daily-inspection-print-frame';
    frame.title = '일상점검표 인쇄 미리보기';
    Object.assign(frame.style, {
        position: 'fixed',
        inset: '0',
        width: '100%',
        height: '100%',
        border: '0',
        zIndex: '2147483000',
        background: '#fff'
    });
    document.body.appendChild(frame);

    const previewDocument = frame.contentDocument || frame.contentWindow?.document;
    if (!previewDocument) {
        frame.remove();
        throw new Error('인쇄 미리보기를 열 수 없습니다. 앱을 최신 버전으로 다시 실행해주세요.');
    }

    previewDocument.open();
    previewDocument.write(html);
    previewDocument.close();
};
