const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const OFFICIAL_ITEMS = [
 ['cleanliness','번호판·전면유리·후사경 등의 청결상태'],
 ['lighting','후미등·차폭등 등 등화장치 작동상태'],
 ['wipers','창닦이기(와이퍼) 작동상태'],
 ['cargoBody','적재함(보조지지대 포함)·측면보호대·후부반사판·트레일러 연결장치 부착 및 훼손 여부'],
 ['tires','타이어 손상 및 마모(1.6mm 이상) 여부'],
 ['cargoFixing','화물 및 적재함 지지대(판스프링) 등의 고정상태'],
 ['wheelNuts','바퀴 너트 등의 균열 여부'],
 ['fluidsAndWarning','냉각수·공기압·엔진오일 등 차량 이상 여부(계기판 확인)'],
 ['seatBelt','좌석 안전띠 상태'],
 ['fireExtinguisher','소화기 비치 여부'],
 ['warningTriangle','안전삼각대 등 비치 여부']
];
const dateLabel = (date) => { const [y,m,d]=String(date).split('-').map(Number); return `${y}년 ${m}월 ${d}일`; };

export const printDailyInspectionMonth = (records, year, month) => {
 const monthRecords=[...(records||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const latestByDay=new Map(); monthRecords.forEach(r=>latestByDay.set(Number(String(r.date).slice(8,10)),r));
 const first=monthRecords[0]||{};
 const days=new Date(Number(year),Number(month),0).getDate();
 const headers=Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
 const officialRows=OFFICIAL_ITEMS.map(([id,label],index)=>{
  const cells=Array.from({length:days},(_,i)=>{const r=latestByDay.get(i+1);const a=r?.answers?.[id];return `<td>${a==='good'?'○':a==='bad'?'×':r?.isNotOperated?'미':''}</td>`;}).join('');
  return `<tr><th class="item">${index+1}. ${escapeHtml(label)}</th>${cells}</tr>`;
 }).join('');
 const detailPages=monthRecords.map(record=>{
  const rows=OFFICIAL_ITEMS.map(([id,label],i)=>`<tr><td>${i+1}</td><td>${escapeHtml(label)}</td><td>${record.answers?.[id]==='good'?'양호':record.answers?.[id]==='bad'?'불량(정비필요)':'미기재'}</td></tr>`).join('');
  const extras=[['제동장치','brakes'],['원동기 누유·냉각계통 추가 확인','engineLeak'],['불법 부착물·개조 여부','illegalAttachments']].map(([label,key])=>`<tr><td>${escapeHtml(label)}</td><td>${record.answers?.[key]==='good'?'양호':record.answers?.[key]==='bad'?'불량(정비필요)':'미기재'}</td></tr>`).join('');
  return `<section class="detail page-break"><h2>일일 점검 상세 기록 - ${escapeHtml(dateLabel(record.date))}</h2>
   <div class="meta"><span>차량번호: ${escapeHtml(record.vehicleNumber)}</span><span>운전자: ${escapeHtml(record.driverName)}</span><span>완료 시각(기기): ${escapeHtml(record.completedAt||'-')}</span></div>
   <table><thead><tr><th>No.</th><th>공식 점검 항목</th><th>점검 결과</th></tr></thead><tbody>${rows}</tbody></table>
   <h3>추가 안전점검 항목</h3><table><tbody>${extras}</tbody></table><h3>불량상태 조치 기록</h3><p class="notes">${escapeHtml(record.actionNotes||'해당 없음')}</p>
   <div class="signatures"><div><b>운전자(점검자) 서명</b><img src="${record.driverSignature||''}" alt="운전자 서명"/></div></div>
   <p class="footnote">기기 로컬 저장 기록이며, 기기 기록 시각은 서버 공인 타임스탬프가 아닙니다.</p></section>`;
 }).join('');
 const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>운수종사자 일상점검표 ${year}-${String(month).padStart(2,'0')}</title>
 <style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,'Malgun Gothic',sans-serif;color:#111;font-size:9px;margin:0}h1{text-align:center;font-size:17px;margin:0 0 8px}h2{font-size:15px;margin:0 0 8px}h3{font-size:11px;margin:12px 0 5px}.summary{display:flex;gap:18px;margin:8px 0}.summary span{border-bottom:1px solid #333;padding:3px 5px;min-width:130px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #555;padding:3px 1px;text-align:center;overflow-wrap:anywhere}.item{width:220px;text-align:left;padding:4px}.summary-table th:not(.item),.summary-table td{font-size:7px}.summary-table .item{font-size:8px}.legend{text-align:right;margin:5px 0}.page-break{break-before:page;page-break-before:always}.detail table{margin:7px 0}.detail th,.detail td{padding:5px;font-size:9px}.meta{display:flex;gap:18px;flex-wrap:wrap;margin:8px 0}.notes{border:1px solid #777;min-height:35px;padding:7px;white-space:pre-wrap}.signatures{display:flex;gap:20px;margin-top:12px}.signatures>div{width:50%;border:1px solid #777;padding:6px;height:95px}.signatures img{display:block;max-width:100%;height:60px;object-fit:contain}.footnote{font-size:8px;color:#555;margin-top:8px}@media print{.page-break{break-before:page}}</style></head><body>
 <h1>운수종사자 일상점검표</h1><div class="summary"><span>점검 연월: ${year}년 ${month}월</span><span>차량번호: ${escapeHtml(first.vehicleNumber||'')}</span><span>운수종사자명: ${escapeHtml(first.driverName||'')}</span></div>
 <div class="legend">○ 양호　× 불량　미 미운행</div><table class="summary-table"><thead><tr><th class="item">점검 항목 / 일자</th>${headers}</tr></thead><tbody>${officialRows}</tbody></table>
 <p class="footnote">공식 월간 점검표 형식의 날짜별 요약입니다. 각 날짜의 상세 점검 결과와 운전자 서명은 뒤쪽 상세 페이지를 확인하세요.</p>${detailPages}
 <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));</script></body></html>`;
 const printWindow=window.open('','_blank');
 if(!printWindow) throw new Error('인쇄 창이 차단되었습니다. 브라우저의 팝업 허용 후 다시 시도해주세요.');
 printWindow.document.open();printWindow.document.write(html);printWindow.document.close();
};
