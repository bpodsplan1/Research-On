// ══════════════════════════════════════════
// ══════════════════════════════════════════
// AI 인사이트 리포트 표시 (구 "뉴스 기사 요약" 페이지)
// ══════════════════════════════════════════
let currentReport = null;
let insightLoading = false;

function renderInsightHistoryPage(){
  const tbody = $('#insightHistoryBody'); if(!tbody) return;
  tbody.innerHTML = insightHistory.length ? insightHistory.map((ins,i)=>`
    <div class="insight-card">
      <div class="insight-card-top">
        <span class="badge blue">${esc(ins.kw||'(키워드 없음)')}</span>
        <span class="insight-card-date">${esc(ins.createdAt.toLocaleString('ko-KR'))}</span>
      </div>
      <div class="insight-card-mid">선택 자료 ${Number(ins.articleCount)||0}건</div>
      <button class="btn soft" type="button" onclick="viewInsightHistory(${i})">리포트 확인</button>
    </div>
  `).join('') : '<div class="card" style="text-align:center;color:var(--muted);padding:30px">아직 도출한 리포트가 없습니다. "리서치 결과"에서 자료를 선택하고 인사이트를 도출해보세요.</div>';

  const tbodyTable = $('#insightHistoryBodyTable'); if(!tbodyTable) return;
  tbodyTable.innerHTML = insightHistory.length ? insightHistory.map((ins,i)=>`
    <tr>
      <td><span class="badge blue">${esc(ins.kw||'(키워드 없음)')}</span></td>
      <td style="color:var(--muted);font-size:13px">${esc(ins.createdAt.toLocaleString('ko-KR'))}</td>
      <td style="color:var(--muted);font-size:13px">${Number(ins.articleCount)||0}건</td>
      <td><button class="btn soft" type="button" onclick="viewInsightHistory(${i})">리포트 확인</button></td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:30px">아직 도출한 리포트가 없습니다. "리서치 결과"에서 자료를 선택하고 인사이트를 도출해보세요.</td></tr>';
}
function renderInsightDetail(){
  const loadingEl = $('#insightReportLoading');
  const emptyEl = $('#insightReportEmpty');
  const bodyEl = $('#insightReportBody');
  if(!loadingEl || !emptyEl || !bodyEl) return;
  loadingEl.style.display = insightLoading ? 'block' : 'none';
  if(insightLoading){ emptyEl.style.display='none'; bodyEl.style.display='none'; return; }
  if(!currentReport){ emptyEl.style.display='block'; bodyEl.style.display='none'; return; }
  emptyEl.style.display='none'; bodyEl.style.display='block';
  bodyEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:18px">
      <div><h3 style="margin:0 0 4px;font-size:21px">${esc(currentReport.title||'종합 리서치 리포트')}</h3><p style="margin:0;color:var(--muted);font-size:14px">${esc(currentReport.subtitle||'')}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="position:relative;display:inline-block" id="reportExportDropdownWrap">
          <button class="btn soft" type="button" onclick="toggleReportExportMenu(event)">⬇ 내보내기 ▾</button>
          <div id="reportExportMenu" style="display:none;position:absolute;right:0;top:calc(100% + 6px);background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:100;overflow:hidden;min-width:160px">
            <button class="export-menu-item" type="button" onclick="exportReportPdf()">📄 PDF로 저장</button>
            <button class="export-menu-item" type="button" onclick="exportReportWord()">📝 Word로 저장</button>
          </div>
        </div>
        <button class="btn soft" type="button" onclick="saveCurrentReport()">리포트 저장</button>
      </div>
    </div>
    ${reportTabsHtml(currentReport)}
  `;
}
function toggleReportExportMenu(e){
  e.stopPropagation();
  const menu = $('#reportExportMenu');
  if(menu) menu.style.display = menu.style.display==='none' ? 'block' : 'none';
}
function viewInsightHistory(i){
  const ins = insightHistory[i]; if(!ins) return;
  currentReport = ins.report; insightLoading = false;
  showPage('newssum-detail');
}
function reportToPlainText(report){
  if(!report || !Array.isArray(report.tabs)) return '';
  const lines = [];
  report.tabs.forEach(tab=>{
    lines.push(`■ ${tab.tab_label||''}`);
    if(tab.type==='executive_brief'){
      const c = tab.content||{};
      if(c.one_line_conclusion) lines.push(c.one_line_conclusion);
      if(c.importance||c.urgency) lines.push(`중요도: ${c.importance||''}  긴급도: ${c.urgency||''}`);
      if(c.relevance_to_organization) lines.push(c.relevance_to_organization);
      if(c.recommended_action) lines.push(`추천 액션: ${c.recommended_action}`);
    } else if(tab.type==='sections'){
      (tab.sections||[]).forEach(s=>{ lines.push(s.title||''); (s.items||[]).forEach(it=>lines.push('- '+it)); });
    } else if(tab.type==='sources'){
      (tab.items||[]).forEach(s=>{ lines.push(s.title||''); if(s.summary) lines.push(s.summary); if(s.url) lines.push(s.url); });
    }
    lines.push('');
  });
  if(report.limitations) lines.push('한계: '+report.limitations);
  return lines.join('\n');
}
async function saveCurrentReport(){
  if(!currentReport){ showToast('저장할 리포트가 없습니다.'); return; }
  const uid = await getUid(); if(!uid){ showToast('로그인이 필요합니다.'); return; }
  const title = '[AI 리포트] ' + (currentReport.subtitle || currentReport.title || '리포트');
  const row = { profile_id:uid, title, body: reportToPlainText(currentReport), type:'AI 인사이트 리포트', badge:'purple' };
  const { data } = await _sb.from('saved_docs').insert(row).select().single();
  savedDocs.unshift({ id:data?.id, ...row });
  showToast('리포트가 저장되었습니다.');
}
// 파일명에 못 쓰는 문자를 정리하고, 리포트 subtitle("키워드 · 리포트유형 · 관점 · 자료 N개")에서
// 앞부분(키워드)만 뽑아 파일명에 붙인다.
function reportExportFileLabel(){
  const raw = (currentReport?.subtitle || currentReport?.title || '리포트').split('·')[0].trim();
  return raw.replace(/[\\/:*?"<>|]/g,'').slice(0,30) || '리포트';
}
// docx.js(진짜 .docx 바이너리를 만들어주는 라이브러리) 동적 로드 — 리포트/리서치 결과 Word 내보내기 공용.
// 예전에는 "HTML 문서를 .doc 확장자로 저장"하는 방식(오래된 MS Word 전용 트릭)을 썼는데,
// 이 방식은 데스크톱 Word에서는 열려도 모바일 Word 앱·구글독스·한컴오피스 등에서는
// 열리지 않는 경우가 있어(실제 파일이 열리지 않는다는 제보 확인 후) 표준 OOXML(.docx) 바이너리를
// 직접 생성하는 라이브러리로 교체함 — 어떤 프로그램으로 열어도 정상 동작한다.
let _docxLibPromise = null;
function loadDocxLib(){
  if(window.docx) return Promise.resolve(window.docx);
  if(_docxLibPromise) return _docxLibPromise;
  _docxLibPromise = new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
    s.onload = ()=>res(window.docx);
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return _docxLibPromise;
}
async function exportReportPdf(){
  const menu = $('#reportExportMenu'); if(menu) menu.style.display='none';
  if(!currentReport){ showToast('내보낼 리포트가 없습니다.'); return; }
  showToast('PDF 생성 중...');
  try {
    // 라이브러리 동적 로드 (리서치 결과 내보내기와 동일한 방식 재사용)
    const loadScript = src => new Promise((res, rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    if(!window.html2canvas) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    if(!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

    const date = new Date().toLocaleDateString('ko-KR');

    // 인쇄용 임시 div 생성 (보고서 형식이라 리서치 결과 PDF와 달리 세로 A4)
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:760px;background:#fff;padding:32px;font-family:Malgun Gothic,sans-serif;font-size:12px;color:#0f172a';
    wrap.innerHTML = `
      <div style="margin-bottom:18px;padding-bottom:16px;border-bottom:2px solid #e5eaf2">
        <div style="font-size:11px;font-weight:800;color:#1d4ed8;letter-spacing:.06em;margin-bottom:6px">RESEARCH ON · AI 인사이트 리포트</div>
        <div style="font-size:19px;font-weight:900;color:#0f172a;margin-bottom:6px">${esc(currentReport.title||'종합 리서치 리포트')}</div>
        <div style="font-size:11.5px;color:#697386">${esc(currentReport.subtitle||'')}</div>
        <div style="font-size:10.5px;color:#94a3b8;margin-top:6px">내보낸 날짜: ${date}</div>
      </div>
      ${reportTabsPrintHtml(currentReport)}`;
    document.body.appendChild(wrap);

    // PDF 페이지 경계가 섹션(예: "기회 요인", "리스크") 중간을 지나가지 않도록,
    // reportTabsPrintHtml()이 표시해둔 print-block 하나하나의 세로 위치를 미리 재둔다.
    // html2canvas의 scale 옵션(2)만큼 캔버스 픽셀 좌표로 환산해서 저장.
    const SCALE = 2;
    const blocks = Array.from(wrap.querySelectorAll('.print-block')).map(el => ({
      top: el.offsetTop * SCALE,
      bottom: (el.offsetTop + el.offsetHeight) * SCALE
    }));

    const canvas = await html2canvas(wrap, { scale:SCALE, useCORS:true, allowTaint:true, backgroundColor:'#ffffff', logging:false });
    document.body.removeChild(wrap);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const pageW = doc.internal.pageSize.getWidth() - 10;
    const pageH = doc.internal.pageSize.getHeight() - 10;

    // px→mm 환산은 "캔버스 폭을 pageW에 맞춘다"는 기준 하나로 고정한다.
    // (예전 공식은 canvas.width/height 비율에 따라 sliceH가 실제 페이지 높이(mm)와 무관하게
    //  커지거나 작아져서, 세로로 긴 콘텐츠(리포트처럼 표보다 텍스트/목록이 긴 경우)에서
    //  전체 내용이 "1페이지에 다 들어간다"고 잘못 계산 → 페이지 경계 밖으로 나간 부분이
    //  그냥 잘려서 화면에 보이지 않는 버그였음. 아래처럼 pageH를 px로 역산해서 슬라이스해야 안전함.)
    const pxToMm = pageW / canvas.width;
    const sliceH = Math.floor(pageH / pxToMm);

    // 페이지를 나눌 때, 원래 자르려던 지점(naiveEnd)이 어떤 print-block 중간을 지나가면
    // 그 블록 시작 지점에서 페이지를 끊어 블록 전체를 다음 페이지로 넘긴다.
    // (블록 하나가 페이지 한 장보다 큰 극단적인 경우는 어쩔 수 없이 그대로 자른다 — 무한루프 방지)
    function nextSliceEnd(cursor, canvasHeight){
      const naiveEnd = Math.min(cursor + sliceH, canvasHeight);
      for(const b of blocks){
        if(b.top > cursor && b.top < naiveEnd && b.bottom > naiveEnd){
          return b.top;
        }
      }
      return naiveEnd;
    }

    let y = 5;
    let cursor = 0;
    let page = 0;
    while(cursor < canvas.height){
      if(page > 0) doc.addPage();
      const srcY = cursor;
      const end = nextSliceEnd(cursor, canvas.height);
      const thisSlice = end - srcY;
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = thisSlice;
      sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, thisSlice, 0, 0, canvas.width, thisSlice);
      const sliceH_mm = pageW * thisSlice / canvas.width;
      doc.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 5, y, pageW, sliceH_mm);
      cursor = end;
      page++;
    }

    doc.save(`research-on-인사이트리포트-${reportExportFileLabel()}-${date.replace(/\./g,'').trim()}.pdf`);
    showToast('PDF 파일이 다운로드되었습니다.');
  } catch(err) {
    console.error('리포트 PDF 생성 오류:', err);
    showToast('PDF 생성에 실패했습니다. Word 형식으로 저장해보세요.');
  }
}
async function exportReportWord(){
  const menu = $('#reportExportMenu'); if(menu) menu.style.display='none';
  if(!currentReport){ showToast('내보낼 리포트가 없습니다.'); return; }
  showToast('Word 파일 생성 중...');
  try{
    const docxLib = await loadDocxLib();
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink } = docxLib;
    const date = new Date().toLocaleDateString('ko-KR');

    const children = [];
    children.push(new Paragraph({ text: currentReport.title || '종합 리서치 리포트', heading: HeadingLevel.HEADING_1 }));
    if(currentReport.subtitle) children.push(new Paragraph({
      children:[new TextRun({ text: currentReport.subtitle, color:'697386', size:20 })],
      spacing:{ after:80 }
    }));
    children.push(new Paragraph({
      children:[new TextRun({ text:`내보낸 날짜: ${date}`, color:'94a3b8', size:16 })],
      spacing:{ after:300 }
    }));

    (currentReport.tabs||[]).forEach(tab=>{
      children.push(new Paragraph({ text: tab.tab_label||'', heading: HeadingLevel.HEADING_2, spacing:{before:300, after:120} }));
      if(tab.type==='executive_brief'){
        const c = tab.content||{};
        if(c.one_line_conclusion) children.push(new Paragraph({
          children:[new TextRun({text:c.one_line_conclusion, bold:true, size:26})], spacing:{after:150}
        }));
        if(c.importance||c.urgency) children.push(new Paragraph({
          children:[new TextRun({text:`중요도: ${c.importance||''}   긴급도: ${c.urgency||''}`, bold:true, color:'C2410C'})],
          spacing:{after:120}
        }));
        if(c.relevance_to_organization) children.push(new Paragraph({ text:c.relevance_to_organization, spacing:{after:120} }));
        if(c.recommended_owner && c.recommended_owner.length) children.push(new Paragraph({
          children:[new TextRun({text:'검토 부서: ', bold:true}), new TextRun(c.recommended_owner.join(', '))],
          spacing:{after:120}
        }));
        if(c.recommended_action) children.push(new Paragraph({
          children:[new TextRun({text:'추천 액션: ', bold:true}), new TextRun(c.recommended_action)],
          spacing:{after:120}
        }));
      } else if(tab.type==='sections'){
        (tab.sections||[]).forEach(s=>{
          children.push(new Paragraph({ text:s.title||'', heading:HeadingLevel.HEADING_3, spacing:{before:150, after:80} }));
          (s.items||[]).forEach(it=> children.push(new Paragraph({ text: it, bullet:{level:0} })));
        });
      } else if(tab.type==='sources'){
        (tab.items||[]).forEach(s=>{
          children.push(new Paragraph({ children:[new TextRun({text:s.title||'', bold:true})], spacing:{before:120} }));
          if(s.summary) children.push(new Paragraph({ text:s.summary, spacing:{after:40} }));
          if(s.url) children.push(new Paragraph({
            children:[new ExternalHyperlink({ link:s.url, children:[new TextRun({text:s.url, style:'Hyperlink'})] })],
            spacing:{after:120}
          }));
        });
      }
    });

    if(currentReport.recommended_next_search && currentReport.recommended_next_search.length){
      children.push(new Paragraph({
        children:[new TextRun({text:'다음 추천 검색어: ', bold:true}), new TextRun(currentReport.recommended_next_search.join(', '))],
        spacing:{before:200}
      }));
    }
    if(currentReport.limitations){
      children.push(new Paragraph({
        children:[new TextRun({text:'한계: ', bold:true}), new TextRun(currentReport.limitations)],
        spacing:{before:100}
      }));
    }

    const doc = new Document({ sections:[{ properties:{}, children }] });
    const blob = await Packer.toBlob(doc);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `research-on-인사이트리포트-${reportExportFileLabel()}-${date.replace(/\./g,'').trim()}.docx`;
    a.click(); URL.revokeObjectURL(a.href);
    showToast('Word 파일이 다운로드되었습니다.');
  } catch(err){
    console.error('리포트 Word 생성 오류:', err);
    showToast('Word 생성에 실패했습니다. PDF 형식으로 저장해보세요.');
  }
}
// 리서치 결과(research_history)와 동일한 패턴으로, 도출한 리포트를 전부 Supabase에
// 자동 기록해서 "이전 리포트" 목록이 세션이 아니라 계정 단위로 누적되게 한다.
// (Supabase 테이블 insight_reports: profile_id, keyword, article_count, report_json, created_at)
async function saveInsightSession(kw, articleCount, report){
  const uid = await getUid(); if(!uid) return;
  const row = { profile_id:uid, keyword:kw, article_count:articleCount, report_json:report, created_at:new Date().toISOString() };
  try {
    const { data } = await _sb.from('insight_reports').insert(row).select().single();
    if(data && insightHistory[0]) insightHistory[0].id = data.id;
  } catch(e){ /* Supabase 테이블 미연동 시에도 화면 동작에는 영향 없음 */ }
}

