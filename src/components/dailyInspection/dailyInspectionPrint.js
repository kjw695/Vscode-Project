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
    ['tires', '상태점검', '타이어 손상 및 마모(1.6mm이상) 여부'],
    ['cargoFixing', '상태점검', '화물, 적재함 지지대(판스프링) 등의 고정상태'],
    ['wheelNuts', '상태점검', '바퀴 너트 등 균열 여부'],
    ['fluidsAndWarning', '기타', '냉각수, 공기압, 엔진오일 등 차량 이상 여부(계기판 확인)'],
    ['seatBelt', '기타', '좌석 안전띠 상태'],
    ['fireExtinguisher', '기타', '소화기 비치 여부'],
    ['warningTriangle', '기타', '안전삼각대 등 비치 여부']
];

// 월간 점검표는 실제 날짜와 일치하도록 1일부터 31일까지 모두 표시합니다.
const FORM_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

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
    const companyRecord = [...monthRecords].reverse().find((record) => String(record.transportCompanyName || record.companyName || record.organizationName || record.vendorName || '').trim()) || first;
    const companyName = companyRecord.transportCompanyName || companyRecord.companyName || companyRecord.organizationName || companyRecord.vendorName || '';
    const dateHeaders = FORM_DAYS.map((day) => `<th class="day-header">${day}</th>`).join('');
    const itemGroups = [
        { category: '외관점검', items: OFFICIAL_ITEMS.slice(0, 4) },
        { category: '상태점검', items: OFFICIAL_ITEMS.slice(4, 7) },
        { category: '기타', items: OFFICIAL_ITEMS.slice(7, 11) }
    ];
    const officialRows = itemGroups.map(({ category, items }) => items.map(([id, , label], itemIndex) => {
        const cells = FORM_DAYS.map((day) => {
            const record = latestByDay.get(day);
            const answer = record?.answers?.[id];
            const result = answer === 'good' ? '○' : answer === 'bad' ? '×' : record?.isNotOperated ? '미' : '';
            return `<td class="result-cell">${result}</td>`;
        }).join('');
        const categoryCell = itemIndex === 0
            ? `<td class="category" rowspan="${items.length}">${category}</td>`
            : '';
        return `<tr class="inspection-row${['cargoBody','cargoFixing','fluidsAndWarning'].includes(id) ? ' long-item' : ''}">${categoryCell}<td class="item">${escapeHtml(label)}</td>${cells}</tr>`;
    }).join('')).join('');

    const signatureCells = FORM_DAYS.map((day) => {
        const record = latestByDay.get(day);
        const signature = safeSignatureImage(record?.driverSignature);
        return `<td class="signature-cell">${signature ? `<img src="${signature}" alt="점검자 서명" />` : ''}</td>`;
    }).join('');

    const actionEntries = monthRecords
        .filter((record) => String(record.actionNotes || '').trim())
        .map((record) => `${Number(String(record.date).slice(8, 10))}일: ${String(record.actionNotes).trim()}`);
    const actionNotes = actionEntries.length
        ? escapeHtml(actionEntries.join('\n'))
        : '<span class="example-text">(예시) 00일 창닦이기 불량 - 00일 창닦이기 교체</span>';

        const detailPages = monthRecords.map((record) => {
        const badItems = [
            ...OFFICIAL_ITEMS.map(([id, , label]) => ({ id, label })),
            { id: 'brakes', label: '제동장치' },
            { id: 'engineLeak', label: '원동기 누유·냉각계통 추가 확인' },
            { id: 'illegalAttachments', label: '불법 부착물·개조 여부' }
        ].filter((item) => record.answers?.[item.id] === 'bad');

        const badRows = badItems.map((item, index) =>
            `<tr><td>${index + 1}</td><td>${escapeHtml(item.label)}</td><td>불량</td></tr>`
        ).join('');
        const badItemsContent = badItems.length
            ? `<h3>불량 점검 항목</h3><table class="detail-table"><thead><tr><th>No.</th><th>불량 내용</th><th>점검 결과</th></tr></thead><tbody>${badRows}</tbody></table>`
            : '<p class="no-defects">불량 항목 없음</p>';
        const actionNotes = String(record.actionNotes || '').trim();
        const actionContent = actionNotes
            ? `<h3>조치 기록</h3><p class="notes">${escapeHtml(actionNotes)}</p>`
            : '';

        return `
            <section class="detail page-break">
                <h2>일일 점검 상세 기록 - ${escapeHtml(dateLabel(record.date))}</h2>
                <div class="meta">
                    <span>차량번호: ${escapeHtml(record.vehicleNumber)}</span>
                    <span>운전자: ${escapeHtml(record.driverName)}</span>
                    <span>완료 시각(기기): ${escapeHtml(record.completedAt || '-')}</span>
                </div>
                ${badItemsContent}
                ${actionContent}
                <div class="signatures">
                    <div>
                        <b>운전자(점검자) 서명</b>
                        <img class="signature-detail-image" src="${safeSignatureImage(record.driverSignature)}" alt="운전자 서명" />
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
    body { width: 297mm; min-width: 297mm; max-width: none; margin: 0 auto; padding: 0; background: #fff; color: #111; font-family: Arial, 'Malgun Gothic', sans-serif; font-size: 9pt; }
    .toolbar { position: sticky; top: 0; left: 0; z-index: 5; display: flex; flex-direction: column; gap: 6px; width: 100vw; max-width: 100vw; box-sizing: border-box; padding: 7px 8px 6px; margin: 0 0 3mm; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; }
    .toolbar-controls { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; width: 100%; }
    .toolbar button { display: block; width: 100%; min-width: 0; border: 0; border-radius: 7px; padding: 9px 2px; background: #1d4ed8; color: #fff; font-size: clamp(9px, 2.7vw, 12px); line-height: 1.1; font-weight: 700; white-space: nowrap; }
    .toolbar button.secondary { background: #475569; }
    .toolbar button:disabled { opacity: .55; }
    .toolbar .zoom-hint { width: 100%; margin: 0; color: #475569; font-size: 11px; line-height: 1.25; text-align: center; }
    .toolbar .print-status { display: none; }
    #preview-content { width: 297mm; min-width: 297mm; box-sizing: border-box; padding: 5mm; transform-origin: top left; }
    .form-caption { min-height: 5mm; margin: 0 0 1mm 1mm; font-family: 'Malgun Gothic', sans-serif; font-size: 8.5pt; line-height: 1.2; white-space: nowrap; }
    .form-caption .new-date { color: #0645ad; }
    h1 { margin: 0 0 3mm; text-align: center; font-size: 12pt; line-height: 1.25; font-weight: 400; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; }
    .identity-table { width: 100%; margin: 0 0 3mm; border: 0.45mm solid #111; font-family: 'Malgun Gothic', sans-serif; }
    .identity-table td { height: 8mm; border: 0.25mm solid #333; padding: 0.7mm 0.5mm; text-align: center; vertical-align: middle; font-size: 9pt; line-height: 1.2; white-space: nowrap; }
    .identity-table .identity-label { width: 12.5%; background: #fff; font-weight: 400; }
    .identity-table .identity-value { width: 12.5%; min-width: 0; }
    .inspection-table { border: 0.5mm solid #111; font-family: 'Malgun Gothic', sans-serif; font-size: 8.5pt; break-inside: avoid; page-break-inside: avoid; }
    .inspection-table th, .inspection-table td { border: 0.2mm solid #777; color: #111; background: #fff; text-align: center; vertical-align: middle; padding: 0.8mm 0.3mm; font-weight: 400; }
    .inspection-table .main-heading { font-size: 10pt; height: 8mm; }
    .inspection-table .result-heading { height: 7mm; font-size: 9pt; }
    .inspection-table .day-header { height: 7mm; font-size: 8.5pt; padding: 0; }
    .inspection-table .category { width: 9mm; padding: 1mm 0.5mm; font-size: 9.5pt; line-height: 1.4; writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 1mm; }
    .inspection-table .item { width: 53mm; text-align: left; padding: 1.2mm 1.8mm; line-height: 1.35; font-size: 8.5pt; overflow-wrap: anywhere; }
    .inspection-row td.result-cell { height: 9.5mm; padding: 0; font-size: 9pt; }
    .inspection-row.long-item td { height: 12mm; }
    .inspection-table .signature-title { height: 15mm; font-size: 9pt; }
    .inspection-table .signature-cell { height: 15mm; padding: 0.5mm; }
    .signature-cell img { display: block; width: 100%; height: 13mm; object-fit: contain; background: #fff; }
    .signature-detail-image { display: block; width: 100%; max-width: 700px; height: 145px; object-fit: contain; object-position: left center; background: #fff; margin-top: 8px; }
    .inspection-table .action-title { height: 15mm; font-size: 9pt; padding: 1.5mm; }
    .inspection-table .action-content { height: 15mm; text-align: left; vertical-align: middle; padding: 2mm 3mm; font-size: 9pt; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
    .example-text { color: #999; }
    .page-break { break-before: page; page-break-before: always; }
    #preview-content { width: 297mm; min-width: 297mm; box-sizing: border-box; padding: 5mm; transform-origin: top left; }
    .detail { margin: 0; padding: 0; font-family: Arial, 'Malgun Gothic', sans-serif; }
    .detail h2 { font-size: 15px; margin: 0 0 8px; }
    .detail h3 { font-size: 11px; margin: 12px 0 5px; }
    .detail-table { margin: 7px 0; }
    .detail-table th, .detail-table td { border: 1px solid #555; padding: 6px 8px; text-align: center; font-size: 10px; }\n    .no-defects { margin: 14px 0; padding: 12px; border: 1px solid #999; text-align: center; font-size: 11px; }
    .meta { display: flex; gap: 18px; flex-wrap: wrap; margin: 8px 0; }
    .notes { border: 1px solid #777; min-height: 35px; padding: 7px; white-space: pre-wrap; font-size: 9px; }
    .signatures { display: flex; gap: 20px; margin-top: 16px; }
    .signatures > div { width: 100%; border: 1px solid #777; padding: 10px; min-height: 210px; }
    .signature-detail-image { display: block; width: 100%; max-width: 850px; height: 165px; object-fit: contain; object-position: left center; background: #fff; margin-top: 8px; }
    .footnote { font-size: 8px; color: #555; margin-top: 8px; }
    @page { size: A4 landscape; margin: 0; }
    @media screen { body { width: 297mm; min-width: 297mm; max-width: none; margin: 0 auto; padding: 0; } .inspection-table { min-width: 0; } .detail { border-top: 2px dashed #cbd5e1; padding-top: 12px; margin-top: 24px; } }
    @media print { html, body { width: 297mm; min-width: 297mm; min-height: 210mm; padding: 0; margin: 0; background: #fff !important; color: #111 !important; } #preview-content { width: 297mm; min-width: 297mm; padding: 5mm; zoom: 1 !important; } .toolbar { display: none !important; } .form-caption, h1, .identity-table, .inspection-table { break-inside: avoid; page-break-inside: avoid; } .page-break { break-before: page; page-break-before: always; } .detail { margin: 0; padding: 0; border: 0; } table, tr, img { break-inside: avoid; page-break-inside: avoid; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
    <div class="toolbar">
        <div class="toolbar-controls">
            <button id="daily-inspection-print-button" type="button" onclick="window.printDailyInspectionPdf()" disabled>저장/공유</button>
            <button type="button" class="secondary" onclick="window.adjustDailyInspectionZoom(-0.1)">축소</button>
            <button type="button" class="secondary" onclick="window.adjustDailyInspectionZoom(0.1)">확대</button>
            <button type="button" class="secondary" onclick="window.parent.document.getElementById('daily-inspection-print-frame')?.remove()">미리보기 닫기</button>
        </div>
        <div class="zoom-hint"><span id="preview-zoom-label">맞춤</span> · 두 손가락으로 벌리거나 모아 확대·축소</div>
        <span id="daily-inspection-print-status" class="print-status" aria-live="polite"></span>
    </div>

    <div id="preview-content">
    <div class="form-caption">■ 화물자동차 운수사업법 시행규칙 [별지 제14호의5서식] <span class="new-date">&lt;신설 2025. 12. 29.&gt;</span></div>
    <h1>운수종사자 일상점검표</h1>

    <table class="identity-table">
        <colgroup>
            <col style="width:12.5%"><col style="width:12.5%">
            <col style="width:12.5%"><col style="width:12.5%">
            <col style="width:12.5%"><col style="width:12.5%">
            <col style="width:12.5%"><col style="width:12.5%">
        </colgroup>
        <tbody><tr>
            <td class="identity-label">점검연월</td>
            <td class="identity-value">20　${String(year).slice(-2)}년　${month}월</td>
            <td class="identity-label">운송사업자명</td>
            <td class="identity-value">${escapeHtml(companyName)}</td>
            <td class="identity-label">차량번호</td>
            <td class="identity-value">${escapeHtml(first.vehicleNumber || '')}</td>
            <td class="identity-label">운수종사자명</td>
            <td class="identity-value">${escapeHtml(first.driverName || '')}</td>
        </tr></tbody>
    </table>

    <table class="inspection-table">
        <colgroup>
            <col style="width:9mm" />
            <col style="width:53mm" />
            ${FORM_DAYS.map(() => '<col />').join('')}
        </colgroup>
        <thead>
            <tr>
                <th class="main-heading" rowspan="2" colspan="2">점검항목</th>
                <th class="result-heading" colspan="31">점검결과(양호 ○, 불량 ×, 미운행시 “미” 기입)</th>
            </tr>
            <tr>${dateHeaders}</tr>
        </thead>
        <tbody>
            ${officialRows}
            <tr><td class="signature-title" colspan="2">점검자 확인(서명)</td>${signatureCells}</tr>
            <tr><td class="action-title" colspan="2">불량상태 조치 기록</td><td class="action-content" colspan="31">${actionNotes}</td></tr>
        </tbody>
    </table>

    ${detailPages}
    </div>
    <script>
        (function () {
            let zoom = 1;
            let pinchStartDistance = 0;
            let pinchStartZoom = 1;
            let isPinching = false;
            let printReady = false;
            const content = () => document.getElementById('preview-content');
            const label = () => document.getElementById('preview-zoom-label');
            const printButton = () => document.getElementById('daily-inspection-print-button');
            const printStatus = () => document.getElementById('daily-inspection-print-status');
            const getTouchDistance = (touches) => {
                const dx = touches[0].clientX - touches[1].clientX;
                const dy = touches[0].clientY - touches[1].clientY;
                return Math.hypot(dx, dy);
            };
            const startPinchZoom = (event) => {
                if (event.touches.length !== 2 || event.target.closest('.toolbar')) return;
                pinchStartDistance = getTouchDistance(event.touches);
                pinchStartZoom = zoom;
                isPinching = pinchStartDistance > 0;
                if (isPinching && event.cancelable) event.preventDefault();
            };
            const movePinchZoom = (event) => {
                if (!isPinching || event.touches.length !== 2) return;
                if (event.cancelable) event.preventDefault();
                const currentDistance = getTouchDistance(event.touches);
                if (!pinchStartDistance || !currentDistance) return;
                zoom = Math.max(0.25, Math.min(2.5, pinchStartZoom * (currentDistance / pinchStartDistance)));
                applyZoom();
            };
            const endPinchZoom = (event) => {
                if (event.touches.length < 2) {
                    isPinching = false;
                    pinchStartDistance = 0;
                }
            };
            const applyZoom = () => {
                const target = content();
                if (!target) return;
                target.style.zoom = String(zoom);
                if (label()) label().textContent = Math.round(zoom * 100) + '%';
            };
            const waitForImage = (image) => new Promise((resolve) => {
                if (image.complete) { resolve(); return; }
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
            });
            const cropSignatureImage = async (image) => {
                if (image.dataset.signatureCropped === 'true' || !image.naturalWidth || !image.naturalHeight) return;
                try {
                    const source = document.createElement('canvas');
                    source.width = image.naturalWidth;
                    source.height = image.naturalHeight;
                    const sourceContext = source.getContext('2d', { willReadFrequently: true });
                    sourceContext.drawImage(image, 0, 0);
                    const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
                    let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
                    for (let y = 0; y < source.height; y += 1) {
                        for (let x = 0; x < source.width; x += 1) {
                            const index = (y * source.width + x) * 4;
                            const alpha = pixels[index + 3];
                            const isInk = alpha > 12 && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245);
                            if (isInk) {
                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (y < minY) minY = y;
                                if (y > maxY) maxY = y;
                            }
                        }
                    }
                    if (maxX < minX || maxY < minY) return;
                    const padX = Math.max(8, Math.round((maxX - minX + 1) * 0.08));
                    const padY = Math.max(8, Math.round((maxY - minY + 1) * 0.18));
                    minX = Math.max(0, minX - padX);
                    minY = Math.max(0, minY - padY);
                    maxX = Math.min(source.width - 1, maxX + padX);
                    maxY = Math.min(source.height - 1, maxY + padY);
                    const cropped = document.createElement('canvas');
                    cropped.width = maxX - minX + 1;
                    cropped.height = maxY - minY + 1;
                    cropped.getContext('2d').drawImage(source, minX, minY, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
                    image.dataset.signatureCropped = 'true';
                    image.src = cropped.toDataURL('image/png');
                    await waitForImage(image);
                } catch (error) {
                    console.warn('[DailyInspection] 서명 이미지 자르기 실패:', error);
                }
            };
            const preparePrint = async () => {
                const images = Array.from(document.querySelectorAll('.signature-cell img, .signature-detail-image'));
                await Promise.all(images.map(async (image) => {
                    await waitForImage(image);
                    await cropSignatureImage(image);
                }));
                printReady = true;
                if (printButton()) printButton().disabled = false;
                if (printStatus()) printStatus().textContent = '서명 준비 완료';
            };
            window.printDailyInspectionPdf = () => {
                if (!printReady) {
                    if (printStatus()) printStatus().textContent = '서명 이미지를 준비하고 있습니다.';
                    return;
                }
                // 사용자 클릭 이벤트 안에서 동기적으로 호출해야 Android 인쇄 창이 차단되지 않습니다.
                window.focus();
                window.print();
            };
            window.adjustDailyInspectionZoom = (delta) => {
                zoom = Math.max(0.25, Math.min(2.5, Math.round((zoom + delta) * 100) / 100));
                applyZoom();
            };
            window.fitDailyInspectionPreview = () => {
                const target = content();
                if (!target) return;
                target.style.zoom = '1';
                const availableWidth = Math.max(240, window.innerWidth - 12);
                const contentWidth = 297 * (96 / 25.4);
                zoom = Math.max(0.25, Math.min(1, availableWidth / contentWidth));
                applyZoom();
            };
            document.addEventListener('touchstart', startPinchZoom, { passive: false });
            document.addEventListener('touchmove', movePinchZoom, { passive: false });
            document.addEventListener('touchend', endPinchZoom, { passive: false });
            document.addEventListener('touchcancel', endPinchZoom, { passive: false });
            window.addEventListener('resize', window.fitDailyInspectionPreview);
            window.addEventListener('beforeprint', () => {
                if (content()) content().style.zoom = '1';
            });
            window.addEventListener('afterprint', applyZoom);
            window.addEventListener('load', window.fitDailyInspectionPreview);
            window.fitDailyInspectionPreview();
            preparePrint();
        })();
    </script>
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
