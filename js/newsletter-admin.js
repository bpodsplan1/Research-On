// ══════════════════════════════════════════
// 뉴스레터 관리자 모드 (작성 · 미리보기 · 발송)
// ══════════════════════════════════════════
let newsletterDraft = {
  issue_title: 'Research-On 주간 뉴스레터', period: '', period_start: '', period_end: '',
  executive_brief: { headline: '', summary: '' },
  editor_note: '',
  sections: { client_watch: [], research_on_insight: [], business_work: [], people_culture: [], people_culture_view: '' }
};
function renderNewsletterAdminPage(){
  $('#nlIssueTitle').value = newsletterDraft.issue_title;
  $('#nlPeriodStart').value = newsletterDraft.period_start || '';
  $('#nlPeriodEnd').value = newsletterDraft.period_end;
  updateNlPeriodHint();
  $('#nlHeadline').value = newsletterDraft.executive_brief.headline;
  $('#nlSummary').value = newsletterDraft.executive_brief.summary;
  $('#nlEditorNote').value = newsletterDraft.editor_note;
  refreshNewsletterPreview();
  loadNewsletterAdminStats();
}
// 시작일 변경 시 자동으로 일주일 뒤 날짜를 마감일로 채우고, "기간 표기" 문자열을 자동 생성한다
function updateNlPeriodHint(){
  const hint = $('#nlPeriodHint'); if(!hint) return;
  hint.textContent = newsletterDraft.period ? ('발행 기간: ' + newsletterDraft.period) : '시작일을 선택하면 마감일(1주일 후)이 자동으로 채워집니다.';
}
function applyNlPeriodStart(startStr){
  newsletterDraft.period_start = startStr;
  if(startStr){
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const endStr = end.toISOString().slice(0, 10);
    newsletterDraft.period_end = endStr;
    const endInput = $('#nlPeriodEnd'); if(endInput) endInput.value = endStr;
    newsletterDraft.period = startStr + ' ~ ' + endStr;
  } else {
    newsletterDraft.period = '';
  }
  updateNlPeriodHint();
}
async function loadNewsletterAdminStats(){
  try {
    const { count } = await _sb.from('profiles').select('id', { count:'exact', head:true }).eq('newsletter_subscribed', true);
    $('#nlSubscriberCount').textContent = (typeof count === 'number') ? count : '-';
  } catch(e){ $('#nlSubscriberCount').textContent = '-'; }
  $('#nlIssueCount').textContent = NEWSLETTER_ISSUES.length;
  $('#nlLastSentAt').textContent = NEWSLETTER_ISSUES[0] ? NEWSLETTER_ISSUES[0].issueDate : '발송 이력 없음';
}
// ── 뉴스레터 항목 실시간 편집: 미리보기 안의 편집·삭제·추가 버튼이 여기로 연결된다 ──
// nlItemModalContext: { kind:'item', section, idx } | { kind:'culture_view' } | null
let nlItemModalContext = null;
function openNlItemModal(ctx){
  nlItemModalContext = ctx;
  const isNew = ctx.kind === 'item' && ctx.idx === newsletterDraft.sections[ctx.section].length;
  const item = ctx.kind === 'item' ? (newsletterDraft.sections[ctx.section][ctx.idx] || {}) : null;
  $('#nlItemModalTitle').textContent = ctx.kind === 'item' ? (isNew ? '새 항목 추가' : '항목 편집') : '섹션 종합 코멘트 편집';
  $('#nlItemModalTitleField').style.display = ctx.kind === 'item' ? '' : 'none';
  $('#nlItemModalImplicationRow').style.display = ctx.kind === 'item' ? '' : 'none';
  $('#nlItemModalUrlsField').style.display = ctx.kind === 'item' ? '' : 'none';
  $('#nlItemModalSummaryLabel').textContent = ctx.kind === 'item' ? '요약 (**굵게** 지원)' : '종합 코멘트 (**굵게** 지원)';
  if(ctx.kind === 'item'){
    $('#nlItemModalTitleInput').value = item.title || '';
    $('#nlItemModalSummaryInput').value = item.summary || '';
    $('#nlItemModalImplicationLabelInput').value = item.implication_label || '시사점';
    $('#nlItemModalImplicationInput').value = item.implication || '';
    $('#nlItemModalUrlsInput').value = (item.source_urls||[]).join('\n');
  } else {
    $('#nlItemModalSummaryInput').value = newsletterDraft.sections.people_culture_view || '';
  }
  $('#nlItemModalOverlay').classList.add('open');
  $('#nlItemModalTitleField').style.display === 'none' ? $('#nlItemModalSummaryInput').focus() : $('#nlItemModalTitleInput').focus();
}
function closeNlItemModal(){
  $('#nlItemModalOverlay')?.classList.remove('open');
  nlItemModalContext = null;
}
function saveNlItemModal(){
  if(!nlItemModalContext) return;
  const ctx = nlItemModalContext;
  if(ctx.kind === 'item'){
    const title = $('#nlItemModalTitleInput').value.trim();
    const summary = $('#nlItemModalSummaryInput').value.trim();
    if(!title && !summary){ closeNlItemModal(); return; }
    const urls = $('#nlItemModalUrlsInput').value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,4);
    const newItem = {
      title, summary,
      implication_label: $('#nlItemModalImplicationLabelInput').value.trim() || '시사점',
      implication: $('#nlItemModalImplicationInput').value.trim(),
      source_urls: urls
    };
    const arr = newsletterDraft.sections[ctx.section];
    if(ctx.idx >= arr.length) arr.push(newItem); else arr[ctx.idx] = newItem;
  } else if(ctx.kind === 'culture_view'){
    newsletterDraft.sections.people_culture_view = $('#nlItemModalSummaryInput').value.trim();
  }
  closeNlItemModal();
  refreshNewsletterPreview(true);
}
function nlEditItem(section, idx){ openNlItemModal({kind:'item', section, idx}); }
function nlAddItem(section){ openNlItemModal({kind:'item', section, idx: newsletterDraft.sections[section].length}); }
function nlMoveItem(section, idx, dir){
  const arr = newsletterDraft.sections[section];
  const target = idx + dir;
  if(target < 0 || target >= arr.length) return;
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
  refreshNewsletterPreview(true);
}
function nlDeleteItem(section, idx){
  if(!confirm('이 항목을 삭제하시겠습니까?')) return;
  newsletterDraft.sections[section].splice(idx,1);
  refreshNewsletterPreview(true);
}
function nlEditCultureView(){ openNlItemModal({kind:'culture_view'}); }

// ── n8n 뉴스레터 2단계 워크플로우에서 AI 초안 가져오기 ──
// 워크플로우 노드 "6. Code - AI JSON 정리"가 반환하는 구조를 그대로 매핑한다:
// { period_end, newsletter:{ issue_title, period, executive_brief:{headline,summary},
//   sections:{ client_watch[], research_on_insight[], business_work[], people_culture[], people_culture_view }, editor_note } }
async function fetchNewsletterDraft(){
  const btn = $('#nlFetchDraftBtn');
  const statusEl = $('#nlDraftFetchStatus');
  if(btn){ btn.disabled = true; btn.textContent = '불러오는 중...'; }
  if(statusEl){ statusEl.className = 'auth-status loading'; statusEl.style.display = 'block'; statusEl.textContent = 'n8n에서 최근 7일 자료를 가공한 초안을 가져오는 중입니다...'; }

  try {
    const resp = await fetch(N8N_NEWSLETTER_DRAFT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    if(!resp.ok) throw new Error('n8n 응답 오류 (상태코드 ' + resp.status + ')');
    const data = await resp.json();
    const nl = data.newsletter || data; // 워크플로우가 배열로 감싸서 줄 수도 있어 최대한 유연하게 처리
    if(!nl || !nl.sections) throw new Error('초안 데이터 형식이 올바르지 않습니다.');

    newsletterDraft = {
      issue_title: nl.issue_title || 'Research-On 주간 뉴스레터',
      period: nl.period || '',
      period_start: data.period_start || '',
      period_end: data.period_end || '',
      executive_brief: {
        headline: nl.executive_brief?.headline || '',
        summary: nl.executive_brief?.summary || ''
      },
      editor_note: nl.editor_note || '',
      sections: {
        client_watch: (nl.sections.client_watch || []).map(x=>({ title:x.title||'', summary:x.summary||'', implication_label:x.implication_label||'시사점', implication:x.implication||'', source_urls:(x.source_urls||[]).slice(0,4) })),
        research_on_insight: (nl.sections.research_on_insight || []).map(x=>({ title:x.title||'', summary:x.summary||'', implication_label:x.implication_label||'시사점', implication:x.implication||'', source_urls:(x.source_urls||[]).slice(0,4) })),
        business_work: (nl.sections.business_work || []).map(x=>({ title:x.title||'', summary:x.summary||'', implication_label:x.implication_label||'시사점', implication:x.implication||'', source_urls:(x.source_urls||[]).slice(0,4) })),
        people_culture: (nl.sections.people_culture || []).map(x=>({ title:x.title||'', summary:x.summary||'', implication_label:x.implication_label||'조직 관점', implication:x.implication||'', source_urls:(x.source_urls||[]).slice(0,4) })),
        people_culture_view: nl.sections.people_culture_view || ''
      }
    };

    renderNewsletterAdminPage();
    if(statusEl){ statusEl.className = 'auth-status success'; statusEl.textContent = '✅ AI 초안을 불러왔습니다. 아래 내용을 확인하고 필요한 부분을 수정·추가해주세요.'; }
  } catch(e){
    if(statusEl){ statusEl.className = 'auth-status error'; statusEl.textContent = '초안을 가져오지 못했습니다: ' + e.message + ' (n8n 워크플로우에 Webhook 트리거가 연결되어 있는지, 계정 설정의 초안 Webhook 주소가 맞는지 확인해주세요.)'; }
  }
  if(btn){ btn.disabled = false; btn.textContent = '✨ AI 초안 가져오기'; }
}

// ── n8n 코드 노드와 동일한 로직으로 이식한 HTML 템플릿 빌더 ──
function nlP(v){ return esc(v||'').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>'); }
// 인스타그램/틱톡/X/Threads 등은 자기 페이지가 다른 사이트의 iframe 안에 뜨는 걸 서버 차원에서 막는다(X-Frame-Options).
// 이런 도메인만 새 탭으로 열고, 그 외 일반 기사 링크는 기존처럼 미리보기 iframe 안에서 그대로 열리게 둔다.
const NL_NEW_TAB_DOMAINS = ['instagram.com','tiktok.com','x.com','twitter.com','threads.net','facebook.com','youtube.com'];
function nlNeedsNewTab(url){
  try{ const host = new URL(url).hostname.replace(/^www\./,''); return NL_NEW_TAB_DOMAINS.some(d => host === d || host.endsWith('.'+d)); }
  catch(e){ return false; }
}
function nlSourceLinks(urls){
  const safe = Array.isArray(urls) ? urls.filter(Boolean).slice(0,4) : [];
  if(!safe.length) return '';
  const links = safe.map((url,i)=>{
    const attr = nlNeedsNewTab(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${esc(url)}"${attr} style="color:#64748B;text-decoration:underline;">원문 ${i+1}</a>`;
  }).join('&nbsp;&nbsp;');
  return `<div style="margin-top:13px;font-size:12px;line-height:19px;color:#64748B;">${links}</div>`;
}
function nlDivider(){
  return `<tr><td style="padding:0 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #E5E7EB;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>`;
}
function nlItemBlock(item, section, idx, isFirst, isLast, culture, last){
  const bg = culture ? '#F2F7F4' : '#EEF3FF';
  const labelColor = culture ? '#2F6B4F' : '#274690';
  const textColor = culture ? '#3F5B4C' : '#35415E';
  const implicationHtml = item.implication ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-collapse:collapse;">
      <tr><td style="padding:15px 17px;background-color:${bg};">
        <div style="font-size:12px;line-height:18px;font-weight:bold;color:${labelColor};">${esc(item.implication_label||'시사점')}</div>
        <div style="margin-top:5px;font-size:14px;line-height:24px;color:${textColor};">${nlP(item.implication)}</div>
      </td></tr>
    </table>` : '';
  const upBtnStyle = isFirst
    ? 'border:1px solid #EDF1F5;background:#F8FAFC;color:#CBD5E1;font-size:11px;padding:5px 9px;border-radius:999px;cursor:default;font-family:inherit;'
    : 'border:1px solid #DBE2EA;background:#fff;color:#475569;font-size:11px;padding:5px 9px;border-radius:999px;cursor:pointer;font-family:inherit;';
  const downBtnStyle = isLast
    ? 'border:1px solid #EDF1F5;background:#F8FAFC;color:#CBD5E1;font-size:11px;padding:5px 9px;border-radius:999px;cursor:default;font-family:inherit;'
    : 'border:1px solid #DBE2EA;background:#fff;color:#475569;font-size:11px;padding:5px 9px;border-radius:999px;cursor:pointer;font-family:inherit;';
  const block = `
    <tr><td style="padding:26px 40px ${last?'32px':'26px'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;">
        <div style="font-size:20px;line-height:30px;font-weight:bold;color:#111827;flex:1;min-width:0;">${esc(item.title)}</div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" ${isFirst?'disabled':`onclick="parent.nlMoveItem('${section}',${idx},-1)"`} style="${upBtnStyle}" title="위로">▲</button>
          <button type="button" ${isLast?'disabled':`onclick="parent.nlMoveItem('${section}',${idx},1)"`} style="${downBtnStyle}" title="아래로">▼</button>
          <button type="button" onclick="parent.nlEditItem('${section}',${idx})" style="border:1px solid #DBE2EA;background:#fff;color:#475569;font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px;cursor:pointer;font-family:inherit;">편집</button>
          <button type="button" onclick="parent.nlDeleteItem('${section}',${idx})" style="border:1px solid #FBD5D5;background:#fff;color:#DC2626;font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px;cursor:pointer;font-family:inherit;">삭제</button>
        </div>
      </div>
      <div style="margin-top:12px;font-size:15px;line-height:26px;color:#3F4652;">${nlP(item.summary)}</div>
      ${implicationHtml}
      ${nlSourceLinks(item.source_urls)}
    </td></tr>`;
  return block + (last ? '' : nlDivider());
}
function nlCultureViewBlock(view){
  const hasView = !!view;
  return `
    <tr><td style="padding:0 40px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr><td style="padding:15px 17px;background-color:#F2F7F4;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div style="font-size:12px;line-height:18px;font-weight:bold;color:#2F6B4F;">종합 코멘트</div>
            <button type="button" onclick="parent.nlEditCultureView()" style="border:1px solid #C7DFD0;background:#fff;color:#2F6B4F;font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px;cursor:pointer;font-family:inherit;flex-shrink:0;">편집</button>
          </div>
          <div style="margin-top:5px;font-size:14px;line-height:24px;color:${hasView?'#3F5B4C':'#94A3B8'};">${hasView ? nlP(view) : '아직 종합 코멘트가 없습니다. 편집 버튼을 눌러 추가하세요.'}</div>
        </td></tr>
      </table>
    </td></tr>`;
}
function nlSectionBlock(no, code, title, description, sectionKey, items, culture, trailingView){
  const list = Array.isArray(items) ? items : [];
  const hasTrailing = culture;
  const lastIdx = list.length-1;
  const itemsHtml = list.map((x,i)=>nlItemBlock(x, sectionKey, i, i===0, i===lastIdx, culture, hasTrailing?false:i===lastIdx)).join('');
  const emptyHtml = list.length ? '' : `<tr><td style="padding:8px 40px 20px;"><p style="margin:0;font-size:13px;color:#94A3B8;">아직 추가된 항목이 없습니다.</p></td></tr>`;
  const addBtnHtml = `<tr><td style="padding:${list.length?'0':'0'} 40px 26px;"><button type="button" onclick="parent.nlAddItem('${sectionKey}')" style="width:100%;border:1.5px dashed #CBD5E1;background:#F8FAFC;color:#475569;font-size:13px;font-weight:700;padding:13px;border-radius:12px;cursor:pointer;font-family:inherit;">+ 항목 추가</button></td></tr>`;
  const trailingHtml = hasTrailing ? nlCultureViewBlock(trailingView) : '';
  return `
    <tr><td style="padding:26px 40px 12px;background-color:#F8FAFC;border-top:1px solid #E5E7EB;">
      <div style="font-size:12px;line-height:18px;letter-spacing:1.2px;font-weight:bold;color:#274690;">${no} · ${esc(code)}</div>
      <div style="margin-top:7px;font-size:22px;line-height:32px;font-weight:bold;color:#111827;">${esc(title)}</div>
      <div style="margin-top:8px;font-size:14px;line-height:23px;color:#6B7280;">${esc(description)}</div>
    </td></tr>
    ${itemsHtml}${emptyHtml}${addBtnHtml}${trailingHtml}`;
}
function buildNewsletterHtml(nl){
  const sections = nl.sections || {};
  const sectionHtml = [
    nlSectionBlock('01','CLIENT WATCH','주요 클라이언트와 고객 산업 동향','핵심 고객사의 사업·조직·AI·운영 변화를 중심으로 정리했습니다.', 'client_watch', sections.client_watch||[], false),
    nlSectionBlock('02','RESEARCH ON INSIGHT','지난주 내부 리서치에서 발견한 핵심 흐름','사용자들이 직접 수행한 리서치에서 반복적으로 나타난 관심사를 정리했습니다.', 'research_on_insight', sections.research_on_insight||[], false),
    nlSectionBlock('03','BUSINESS & WORK','BPO·AI·조직 운영의 주요 변화','본부 사업과 운영에 영향을 줄 수 있는 외부 변화를 정리했습니다.', 'business_work', sections.business_work||[], false),
    nlSectionBlock('04','PEOPLE & CULTURE','요즘 구성원은 무엇에 반응하는가','젊은 세대의 행동과 가치관을 조직 운영 관점에서 해석했습니다.', 'people_culture', sections.people_culture||[], true, sections.people_culture_view||'')
  ].join('');
  const subject = `[Research On Weekly] ${nl.period_end||''} 주간 뉴스레터`;
  const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#111827;word-break:keep-all;overflow-wrap:break-word;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;">클라이언트 동향, 내부 리서치 인사이트, BPO·AI 변화, 구성원 문화 트렌드를 정리했습니다.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0;padding:0;background-color:#F3F4F6;border-collapse:collapse;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:680px;background-color:#FFFFFF;border-collapse:collapse;">
        <tr><td style="padding:34px 40px 30px;background-color:#111827;">
          <div style="font-size:12px;line-height:18px;letter-spacing:1.4px;font-weight:bold;color:#AAB4C4;">RESEARCH ON WEEKLY</div>
          <div style="margin-top:12px;font-size:30px;line-height:41px;font-weight:bold;color:#FFFFFF;">${esc(nl.issue_title)}</div>
          <div style="margin-top:14px;font-size:13px;line-height:20px;color:#C9D1DD;">${esc(nl.period)}</div>
        </td></tr>
        <tr><td style="padding:34px 40px 30px;">
          <div style="font-size:12px;line-height:18px;letter-spacing:1.2px;font-weight:bold;color:#274690;">EXECUTIVE BRIEF</div>
          <div style="margin-top:10px;font-size:23px;line-height:34px;font-weight:bold;color:#111827;">${esc(nl.executive_brief?.headline||'')}</div>
          <div style="margin-top:14px;font-size:15px;line-height:26px;color:#3F4652;">${nlP(nl.executive_brief?.summary||'')}</div>
        </td></tr>
        ${sectionHtml}
        <tr><td style="padding:28px 40px;background-color:#111827;">
          <div style="font-size:13px;line-height:20px;font-weight:bold;color:#FFFFFF;">Research On</div>
          <div style="margin-top:8px;font-size:12px;line-height:20px;color:#AAB4C4;">본 뉴스레터는 내부 리서치 결과와 뉴스레터 전용 모니터링 자료를 바탕으로 작성되었습니다.</div>
          <div style="margin-top:12px;font-size:11px;line-height:18px;color:#7F8A9B;">AI가 생성한 시사점은 제공된 자료를 기반으로 한 해석이며, 주요 의사결정 전 원문 확인이 필요합니다.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}
// 미리보기 iframe 안에서 사용자가 마지막으로 스크롤한 위치 (원문 링크를 누르기 직전 값을 계속 갱신해둔다)
let nlPreviewScrollY = 0;
// srcdoc을 다시 세팅한 직후의 "초안 콘텐츠 최초 로드"인지, 그 후 사용자가 링크를 눌러 다른 페이지로 이탈한 로드인지 구분하는 플래그
let nlPreviewInitialLoadPending = false;
// 다음 로드가 끝난 직후 복원해야 할 스크롤 위치 ("돌아가기" 또는 항목 편집/삭제/추가 후 제자리 유지용)
let nlPreviewRestoreScrollY = null;
function setupNlPreviewFrameHandlers(){
  const frame = $('#nlPreviewFrame');
  if(!frame || frame.dataset.nlHandlersBound) return;
  frame.dataset.nlHandlersBound = '1';
  frame.addEventListener('load', ()=>{
    if(nlPreviewInitialLoadPending){
      // 초안 콘텐츠가 (다시) 로드된 시점: 원문 이탈 상태를 해제하고, 필요하면 스크롤 위치를 복원한다
      nlPreviewInitialLoadPending = false;
      $('#nlPreviewRefreshBtn').style.display = 'none';
      try{
        const win = frame.contentWindow;
        if(nlPreviewRestoreScrollY != null){
          win.scrollTo(0, nlPreviewRestoreScrollY);
          nlPreviewRestoreScrollY = null;
        }
        win.addEventListener('scroll', ()=>{ nlPreviewScrollY = win.scrollY; });
      }catch(e){ /* cross-origin 등으로 접근 불가하면 조용히 무시 */ }
    } else {
      // 초안이 아닌 외부 페이지(원문 기사)로 이동한 경우 → "돌아가기" 버튼 노출
      $('#nlPreviewRefreshBtn').style.display = 'inline-flex';
    }
  });
}
// 미리보기 iframe 내용을 최신 draft 기준으로 다시 그린다.
// preserveScroll=true면 다시 그리기 전 스크롤 위치를 기억해뒀다가 그대로 복원한다 (항목 편집·삭제·추가 시 사용).
// preserveScroll=false(기본값)면 맨 위에서 시작한다 (AI 초안을 새로 불러왔을 때 등).
function refreshNewsletterPreview(preserveScroll){
  setupNlPreviewFrameHandlers();
  if(preserveScroll) nlPreviewRestoreScrollY = nlPreviewScrollY;
  const { subject, html } = buildNewsletterHtml(newsletterDraft);
  $('#nlPreviewSubject').textContent = subject;
  $('#nlPreviewRefreshBtn').style.display = 'none';
  nlPreviewInitialLoadPending = true;
  $('#nlPreviewFrame').srcdoc = html;
}
// "돌아가기" 버튼: 원문으로 이탈했던 iframe을 최신 초안으로 되돌리고, 이탈 직전 스크롤 위치를 복원한다
function goBackToNewsletterPreview(){
  refreshNewsletterPreview(true);
}
async function sendNewsletter(){
  if(!newsletterDraft.issue_title.trim()){ showToast('발행 회차 제목을 입력해주세요.'); return; }
  if(!confirm('정말 이 뉴스레터를 발송하시겠어요? 발송 후에는 되돌릴 수 없습니다.')) return;
  const { subject, html } = buildNewsletterHtml(newsletterDraft);
  const btn = $('#nlSendBtn'); btn.disabled=true; btn.textContent='발송 중...';

  // n8n으로 실제 발송 트리거 (best-effort — 연동 안 돼있어도 히스토리 저장은 계속 진행)
  try {
    await fetch(N8N_NEWSLETTER_QUEUE_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ newsletter: newsletterDraft, period_end: newsletterDraft.period_end, subject, newsletter_html: html })
    });
  } catch(e){ /* n8n 미연동이어도 계속 진행 */ }

  // Supabase 발송 이력 저장 (테이블: newsletter_send_history)
  let saved = false;
  try {
    const { data } = await _sb.from('newsletter_send_history').insert({ issue_label: newsletterDraft.issue_title, subject, newsletter_html: html }).select().single();
    if(data) saved = true;
  } catch(e){ /* 테이블이 아직 없어도 구독자 화면에는 즉시 반영됨 */ }

  // 구독자 화면(뉴스레터 탭)에 즉시 반영
  NEWSLETTER_ISSUES.unshift({
    title: newsletterDraft.issue_title,
    issueDate: newsletterDraft.period_end || newsletterDraft.period,
    summary: newsletterDraft.executive_brief.summary,
    html
  });

  btn.disabled=false; btn.textContent='📮 발송하기';
  showToast(saved ? '뉴스레터가 발송되었습니다.' : '발송 요청은 전달됐지만 히스토리 저장에는 실패했어요 (테이블 확인 필요).');
  loadNewsletterAdminStats();
}
async function renderNewsletterSubscribePage(){
  const subBtn = $('#newsletterSubscribeBtn');
  const statusText = $('#newsletterSubStatusText');
  const unsubCard = $('#newsletterUnsubscribeCard');
  const uid = await getUid();
  if(!uid){ if(statusText) statusText.textContent='로그인이 필요합니다.'; return; }
  const subscribed = await isNewsletterSubscribed();
  if(subscribed){
    if(statusText) statusText.innerHTML = '<span class="badge green" style="margin-right:6px">구독 중</span>새 뉴스레터가 발행되면 알려드릴게요.';
    if(subBtn){ subBtn.textContent='구독 중'; subBtn.className='btn line'; subBtn.disabled=true; }
    if(unsubCard) unsubCard.style.display='block';
  } else {
    if(statusText) statusText.textContent = '아직 구독 중이 아니에요. 구독하면 새 뉴스레터가 발행될 때마다 알림을 받을 수 있어요.';
    if(subBtn){ subBtn.textContent='구독 신청'; subBtn.className='btn dark'; subBtn.disabled=false; }
    if(unsubCard) unsubCard.style.display='none';
  }
}
function openNewsletterSubModal(){
  $('#newsletterSubModalTitle').textContent = '뉴스레터 신규 신청';
  $('#newsletterSubModalDesc').textContent = '아래 이메일 주소로 매주 뉴스레터를 받아보시겠습니까? 다른 주소로 받고 싶다면 수정할 수 있습니다.';
  $('#newsletterSubEmailInput').value = currentUserEmail || '';
  $('#newsletterSubModalOverlay').style.display = 'flex';
}
function closeNewsletterSubModal(){ $('#newsletterSubModalOverlay').style.display = 'none'; }
// 신규 구독(본인/대리) 성공 직후 호출 — 웰컴 메일 발송 + 5분 뒤 최신호 발송을 트리거한다.
// best-effort로 처리: 이 호출이 실패해도 구독 자체는 이미 완료된 상태이므로 사용자에게 별도 에러를 띄우지 않는다.
async function triggerNewsletterWelcome(email, name){
  try{
    await fetch(N8N_NEWSLETTER_WELCOME_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email, name })
    });
  } catch(e){ /* 웰컴 메일 웹훅 미연동/실패 시에도 구독 처리는 계속 진행 */ }
}
async function confirmNewsletterSub(){
  const email = ($('#newsletterSubEmailInput').value || '').trim();
  if(!email || !email.includes('@')){ showToast('올바른 이메일 주소를 입력해주세요.'); return; }
  const uid = await getUid(); if(!uid){ showToast('로그인이 필요합니다.'); return; }
  await _sb.from('profiles').update({ newsletter_subscribed: true, newsletter_subscribed_at: new Date().toISOString(), newsletter_email: email }).eq('id', uid);
  triggerNewsletterWelcome(email, currentUserProfile?.name || '');
  closeNewsletterSubModal();
  showToast('뉴스레터 구독이 신청되었습니다.');
  renderNewsletterSubscribePage();
}
async function unsubscribeNewsletter(){
  const uid = await getUid(); if(!uid){ showToast('로그인이 필요합니다.'); return; }
  if(!confirm('정말 뉴스레터 구독을 해지하시겠어요?')) return;
  await _sb.from('profiles').update({ newsletter_subscribed: false }).eq('id', uid);
  showToast('뉴스레터 구독이 해지되었습니다.');
  renderNewsletterSubscribePage();
}

// ── 타인 대신 구독 신청 (임원/보직자 대리, 타 본부, 한시적 구독 등) ──
async function submitProxySubscribe(){
  const name = $('#proxySubName').value.trim();
  const email = $('#proxySubEmail').value.trim().toLowerCase();
  if(!name || !email){ showAuthStatus('proxySubStatus','error','이름과 이메일을 모두 입력해주세요.'); return; }
  const btn = $('#proxySubBtn'); btn.disabled = true;
  showAuthStatus('proxySubStatus','loading','처리 중...');
  try{
    // 1) 이미 Research On 계정이 있는 사람이면 → 바로 구독 처리
    const { data:existing, error:findErr } = await _sb.from('profiles').select('id,name').eq('email', email).maybeSingle();
    if(findErr) throw findErr;
    if(existing){
      const { error } = await _sb.from('profiles').update({ newsletter_subscribed:true, newsletter_subscribed_at: new Date().toISOString() }).eq('id', existing.id);
      if(error) throw error;
      triggerNewsletterWelcome(email, existing.name || name);
      showAuthStatus('proxySubStatus','success', `${existing.name || name}님을 구독자로 등록했습니다.`);
    } else {
      // 2) 계정이 없는 외부/타본부 인원 → 별도 외부 구독자 명단에 등록
      const { error } = await _sb.from('newsletter_guest_subscribers').insert({
        email, name, requested_by: currentUserId, requested_by_name: currentUserProfile.name, status:'active'
      });
      if(error) throw error;
      triggerNewsletterWelcome(email, name);
      showAuthStatus('proxySubStatus','success', `${name}님은 Research On 계정이 없어 외부 구독자 명단에 등록했습니다.`);
    }
    $('#proxySubName').value=''; $('#proxySubEmail').value='';
  } catch(e){
    showAuthStatus('proxySubStatus','error','등록에 실패했습니다: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}
