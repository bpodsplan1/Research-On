// ══════════════════════════════════════════
// 리서치 결과 (n8n/Tavily 실제 검색 연동)
// ══════════════════════════════════════════
let resultDocs = [];
let currentResultKw = '';
const RESULT_HIST_MAX = 30;
let resultHistory = []; // loadUserData()에서 Supabase로 채워짐

function generateFallbackResults(kw){
  return [{
    title: `${kw} 검색 결과를 가져오지 못했습니다`,
    desc: 'n8n 연동이 안 되어 있거나 워크플로우가 비활성 상태일 수 있어요.',
    source: '연동 필요',
    score: 0,
    status: 'fail',
    body: `"${kw}" 검색 결과를 가져오지 못했습니다.\n\n가능한 원인:\n• 계정 설정에 뉴스 기사 검색 Webhook이 입력되지 않음\n• n8n 워크플로우가 비활성(Inactive) 상태\n• Serper/Naver API 키가 만료되었거나 호출 한도 초과\n\n계정 설정에서 뉴스 기사 검색 Webhook 주소를 확인해주세요.`
  }];
}

async function saveResultSession(kw, parts){
  const uid = await getUid(); if(!uid) return;
  const now = new Date();
  const p = parts || { front:[], core:[kw], back:[] };
  const dateStr = now.toLocaleDateString('ko-KR');
  const timeStr = now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  const entry = { kw, front:[...p.front], core:[...p.core], back:[...p.back], date:dateStr, time:timeStr, ts:now.getTime(), docs:resultDocs.map(d=>({...d})) };

  const idx = resultHistory.findIndex(h=>h.kw===kw);
  if(idx>=0) resultHistory.splice(idx,1);
  resultHistory.unshift(entry);
  if(resultHistory.length > RESULT_HIST_MAX) resultHistory.length = RESULT_HIST_MAX;

  // 반드시 "현재 계정 + 키워드"로 DB 조회 후 처리 (계정 간 오염 방지)
  const row = { profile_id:uid, keyword:kw, front:p.front, core:p.core, back:p.back, date_str:dateStr, time_str:timeStr, docs:resultDocs.map(d=>({...d})) };
  const { data: existRow } = await _sb.from('research_history').select('id').eq('profile_id', uid).eq('keyword', kw).maybeSingle();
  if(existRow){
    await _sb.from('research_history').update(row).eq('id', existRow.id).eq('profile_id', uid);
    resultHistory[0].id = existRow.id;
  } else {
    const { data } = await _sb.from('research_history').insert(row).select().single();
    if(data) resultHistory[0].id = data.id;
  }
}

async function generateResultsFor(kw, parts){
  currentResultKw = kw;
  $('#resultsSubtitle').textContent = `"${kw}" 검색 중...`;
  $('#resultsBody').innerHTML = `<div class="card" style="text-align:center;color:var(--muted);padding:30px"><span class="streaming-dot"></span>"${esc(kw)}" 관련 자료를 가져오는 중입니다...</div>`;
  $('#resultsBodyTable').innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px"><span class="streaming-dot"></span>"${esc(kw)}" 관련 자료를 가져오는 중입니다...</td></tr>`;

  try {
    const resp = await fetch(N8N_NEWS_SEARCH_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(buildSearchPayload(kw, parts))
    });
    if(!resp.ok) throw new Error('n8n 응답 오류');
    const data = await resp.json();
    // n8n 워크플로우([Research On] 뉴스 크롤링 - 1단계)는 결과를 data.list 배열로 반환함
    // (구버전 호환을 위해 data.articles도 함께 지원)
    const list = Array.isArray(data.list) ? data.list : (Array.isArray(data.articles) ? data.articles : []);
    if(!list.length) throw new Error('빈 응답');

    resultDocs = list.map(item=>{
      const score = typeof item.score === 'number' ? item.score
        : (typeof item.ai_relevance_score === 'number' ? item.ai_relevance_score/100 : 0.6);
      const title = decodeHtmlEntities(item.title || '');
      const summary = decodeHtmlEntities(item.summary || item.content || item.snippet || '');
      // 'naver_news'/'serper' 같은 검색 API 이름 대신, 실제 배포 주체(언론사명)를 우선 표시한다.
      // 언론사명을 알 수 없으면 도메인이라도 보여주고, 그마저 없으면 미확인으로 표기한다.
      const displaySource = item.publisher || item.domain || '';
      const bodyLines = [title, '', summary];
      if(item.recommendation_label) bodyLines.push('', `AI 추천도: ${item.recommendation_label}`);
      if(item.recommendation_reason) bodyLines.push(`추천 사유: ${item.recommendation_reason}`);
      if(item.risk_note) bodyLines.push('', `⚠ 주의사항: ${item.risk_note}`);
      const sourceLine = [displaySource, item.published_date].filter(Boolean).join(' · ');
      bodyLines.push('', `출처: ${sourceLine || '출처 미확인'}`);
      if(item.url) bodyLines.push(item.url);
      return {
        title: title || '(제목 없음)',
        desc: summary,
        source: displaySource || '출처 미확인',
        url: item.url || '',
        score,
        status: 'success',
        publishedDate: item.published_date || '',
        recommendationLabel: item.recommendation_label || '',
        body: bodyLines.join('\n')
      };
    });
  } catch(e){
    resultDocs = generateFallbackResults(kw);
  }
  saveResultSession(kw, parts);
}
let displayedDocs = [];
function viewResultSession(kw){
  currentResultKw = kw;
  const row = document.querySelector(`[data-row-kw="${CSS.escape(kw)}"]`);
  if(row){ row.scrollIntoView({behavior:'smooth', block:'center'}); row.classList.remove('row-flash'); void row.offsetWidth; row.classList.add('row-flash'); }
}
function renderResultsPage(){
  renderResults();
}
function relevanceBadge(score){
  if(score>=0.85) return '<span class="badge green">높음</span>';
  if(score>=0.65) return '<span class="badge orange">중간</span>';
  return '<span class="badge red">낮음</span>';
}
function computeKwStats(h){
  const successDocs = (h.docs||[]).filter(d=>d.status==='success');
  const count = successDocs.length;
  const avgScore = count ? successDocs.reduce((s,d)=>s+(d.score||0),0)/count : 0;
  return { count, avgScore, hasSuccess: count>0 };
}
function globalDocIndex(hidx, li){
  let idx = 0;
  for(let k=0;k<hidx;k++) idx += (resultHistory[k].docs||[]).length;
  return idx + li;
}
function renderResults(){
  $('#resultsSubtitle').textContent = resultHistory.length ? '지금까지 검색한 모든 키워드의 결과를 한 번에 확인할 수 있습니다.' : '새 리서치 만들기에서 검색했던 키워드별 결과를 언제든지 다시 확인할 수 있습니다.';
  displayedDocs = [];
  resultHistory.forEach((h,hi)=>{ (h.docs||[]).forEach(d=>{ displayedDocs.push({...d, kw:h.kw, hidx:hi}); }); });

  $('#resultsBody').innerHTML = resultHistory.length ? resultHistory.map((h,hi)=>{
    const { count, avgScore, hasSuccess } = computeKwStats(h);
    return `<div class="result-card" data-row-kw="${esc(h.kw)}">
      <div class="result-card-head">
        <input type="checkbox" class="result-chk" data-hidx="${hi}" />
        <div class="result-card-title">
          <span>${esc(h.kw)}</span>
          ${hasSuccess ? relevanceBadge(avgScore) : '<span class="badge red">낮음</span>'}
        </div>
      </div>
      <div class="result-card-foot">
        <span class="result-card-date">${esc(h.date)}</span>
        <div class="result-card-actions">
          <button class="btn soft" type="button" onclick="viewResultsDetail(${hi})">${count>0 ? count+'건 보기' : '결과 확인'}</button>
          <button class="btn line" type="button" onclick="retryKwSearch(${hi})">재검색</button>
        </div>
      </div>
    </div>`;
  }).join('') : '<div class="card" style="text-align:center;color:var(--muted);padding:30px">아직 검색한 결과가 없습니다.</div>';

  $('#resultsBodyTable').innerHTML = resultHistory.length ? resultHistory.map((h,hi)=>{
    const { count, avgScore, hasSuccess } = computeKwStats(h);
    return `<tr data-row-kw="${esc(h.kw)}">
      <td><input type="checkbox" class="result-chk" data-hidx="${hi}" /></td>
      <td><span class="badge blue">${esc(h.kw)}</span></td>
      <td style="color:var(--muted);font-size:13px">${esc(h.date)}</td>
      <td>${hasSuccess ? relevanceBadge(avgScore) : '<span class="badge red">낮음</span>'}</td>
      <td><button class="btn soft" type="button" onclick="viewResultsDetail(${hi})">${count>0 ? count+'건 보기' : '결과 확인'}</button></td>
      <td><button class="btn line" type="button" onclick="retryKwSearch(${hi})">재검색</button></td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">아직 검색한 결과가 없습니다.</td></tr>';
  updateExportBtnLabel();
}
let currentResultsDetailHidx = null;
function viewResultsDetail(hidx){
  const h = resultHistory[hidx]; if(!h) return;
  currentResultsDetailHidx = hidx;
  showPage('results-detail');
}
function renderResultsDetail(){
  const hidx = currentResultsDetailHidx;
  const h = hidx!==null ? resultHistory[hidx] : null;
  userSuppliedLinks = [];
  renderUserLinkList();
  if(!h){
    $('#resultsDetailTitle').textContent = '결과를 찾을 수 없습니다';
    $('#resultsDetailSub').textContent = '';
    $('#resultsDetailList').innerHTML = '<div class="empty-state"><h3>결과가 없습니다</h3><p>리서치 결과 목록에서 다시 선택해주세요.</p></div>';
    return;
  }
  $('#resultsDetailTitle').textContent = h.kw;
  $('#resultsDetailSub').textContent = `${h.date}${h.time?' '+h.time:''} · ${(h.docs||[]).length}건`;
  $('#resultsDetailList').innerHTML = (h.docs||[]).length ? h.docs.map((d,li)=>{
    const gi = globalDocIndex(hidx, li);
    return `<div class="list-item" data-gi="${gi}" onclick="handleResultCardClick(event, this)">
      <input type="checkbox" class="detail-chk" data-gi="${gi}" style="margin-top:4px;flex-shrink:0" />
      <div class="list-icon">📄</div>
      <div style="flex:1">
        <h4>${esc(d.title)}</h4>
        <p>${esc(d.desc||'')}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:10px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><small style="color:var(--muted)">${esc(d.source||'출처 미확인')}</small>${d.publishedDate?`<small style="color:var(--muted)">· ${esc(formatPublishedDate(d.publishedDate))}</small>`:''}${relevanceBadge(d.score||0)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <button class="btn line" type="button" onclick="openDocModal(${gi},'result')">상세보기</button>
            ${d.status==='success'?`<button class="btn soft" type="button" onclick="saveResultDoc(${gi})">저장</button>`:'<span class="badge red">수집 실패</span>'}
          </div>
        </div>
      </div>
    </div>`;
  }).join('') : '<div class="empty-state"><h3>결과가 없습니다</h3></div>';
  const selectAll = $('#selectAllDetail'); if(selectAll) selectAll.checked = false;
  renderAllChipSelects();
}
// 카드(체크박스/버튼 이외 영역) 클릭 시 체크박스를 토글한다.
// 작은 체크박스를 정확히 클릭해야 하는 번거로움을 없애기 위함 — input/button/a 요소 자체 클릭은
// 각자의 동작(체크박스 직접 토글, 상세보기, 저장)이 우선이므로 여기서는 건드리지 않는다.
function handleResultCardClick(e, card){
  if(e.target.closest('input,button,a')) return;
  const chk = card.querySelector('.detail-chk');
  if(chk) chk.checked = !chk.checked;
}
function getSelectedDetailDocs(){
  return $$('.detail-chk:checked').map(c=>displayedDocs[+c.dataset.gi]).filter(Boolean);
}

// ── 사용자 선정 자료 (직접 찾은 뉴스 기사 링크) ──
let userSuppliedLinks = []; // {url, title}
function renderUserLinkList(){
  const box = $('#userLinkList'); if(!box) return;
  if(!userSuppliedLinks.length){ box.innerHTML = ''; return; }
  box.innerHTML = userSuppliedLinks.map((u,i)=>`
    <div class="list-item" style="cursor:default">
      <div class="list-icon">🔗</div>
      <div style="flex:1;min-width:0">
        <h4 style="margin:0 0 2px;font-size:14px">${esc(u.title || u.url)}</h4>
        <p style="margin:0;font-size:12px;color:var(--muted);word-break:break-all">${esc(u.url)}</p>
      </div>
      <button class="btn line" type="button" onclick="removeUserLink(${i})" style="flex-shrink:0;min-height:34px;padding:0 12px;font-size:13px">삭제</button>
    </div>`).join('');
}
function addUserLink(){
  const urlInput = $('#userLinkUrlInput');
  const titleInput = $('#userLinkTitleInput');
  let url = (urlInput?.value || '').trim();
  const title = (titleInput?.value || '').trim();
  if(!url){ showToast('링크를 입력해주세요.'); return; }
  if(!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch(e){ showToast('올바른 링크 형식이 아닙니다.'); return; }
  if(userSuppliedLinks.some(u=>u.url===url)){ showToast('이미 추가한 링크입니다.'); return; }
  if(userSuppliedLinks.length >= 5){ showToast('사용자 선정 자료는 최대 5건까지 추가할 수 있습니다.'); return; }
  userSuppliedLinks.push({ url, title });
  if(urlInput) urlInput.value = '';
  if(titleInput) titleInput.value = '';
  renderUserLinkList();
  showToast('자료가 추가되었습니다.');
}
function removeUserLink(i){
  userSuppliedLinks.splice(i,1);
  renderUserLinkList();
}
let insightHistory = [];
async function deriveInsight(){
  const selected = getSelectedDetailDocs();
  const withUrl = selected.filter(d=>d.url);
  if(!withUrl.length && !userSuppliedLinks.length){ showToast('인사이트를 도출할 기사를 선택하거나, 사용자 선정 자료를 추가해주세요.'); return; }

  // n8n이 찾은 선택 기사 + 사용자가 직접 추가한 자료를 하나의 목록으로 합친다.
  // (원문 본문은 n8n [뉴스 크롤링 2단계] 워크플로우가 URL 기준으로 다시 추출하므로,
  //  사용자 자료는 summary/score 없이 url·title만 있어도 동일하게 처리된다.)
  const combined = [
    ...withUrl.map((d,i)=>({ url:d.url, title:d.title, summary:d.desc, score:d.score, rank:i+1, source:'n8n' })),
    ...userSuppliedLinks.map((u,i)=>({ url:u.url, title:u.title || u.url, summary:'', score:null, rank: withUrl.length+i+1, source:'user' }))
  ];
  if(combined.length > 10) showToast('최대 10건까지만 분석에 반영됩니다.');

  const h = currentResultsDetailHidx!==null ? resultHistory[currentResultsDetailHidx] : null;
  const kw = h?.kw || '';

  // "AI 분석 가이드"에서 선택한 리포트 방향성 값을 그대로 n8n [뉴스 크롤링 2단계]로 전달한다.
  const insightGuide = ($('#insightGuideInput')?.value || '').trim();
  const actionOrientation = !!$('#actionOrientationChk')?.checked;

  // 리포트 페이지로 즉시 이동해 로딩 상태를 보여준다.
  insightLoading = true; currentReport = null;
  showPage('newssum-detail');
  const bar = $('#insightLoadingBar');
  let pct = 0;
  const timer = setInterval(()=>{ if(pct<85 && bar){ pct+=12; bar.style.width = pct+'%'; } }, 350);

  let report;
  try {
    const resp = await fetch(N8N_INSIGHT_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        keyword: kw,
        insight_guide: insightGuide,
        analysis_viewpoint: insightSettings.viewpoint,
        report_type: insightSettings.reportType,
        audience_level: insightSettings.audience,
        report_depth: insightSettings.depth,
        action_orientation: actionOrientation,
        risk_sensitivity: insightSettings.risk,
        selected_results: combined.slice(0,10)
      })
    });
    const data = await resp.json();
    if(!resp.ok || data.success===false || !data.display) throw new Error(data.message || '리포트 생성 실패');
    report = data.display;
  } catch(e){
    report = generateFallbackReport(kw, withUrl);
  }

  clearInterval(timer);
  if(bar) bar.style.width = '100%';

  insightHistory.unshift({ kw, articleCount: combined.length, report, createdAt: new Date() });
  saveInsightSession(kw, combined.length, report);
  insightLoading = false; currentReport = report;
  renderInsightDetail();
  showToast('인사이트가 도출되었습니다.');
}
function generateFallbackReport(kw, docs){
  return {
    title: '종합 리서치 리포트',
    subtitle: `${kw} · 자료 ${docs.length}개 (n8n 미연동 - 예시)`,
    tabs: [
      { tab_id:'executive_brief', tab_label:'Executive Brief', type:'executive_brief', content:{
        one_line_conclusion: 'n8n 인사이트 도출 Webhook이 연동되지 않아 실제 분석 대신 예시가 표시됩니다.',
        importance: '확인 불가', urgency: '확인 불가',
        relevance_to_organization: '계정 설정에서 인사이트 도출 Webhook 주소를 확인해주세요.',
        recommended_owner: [], recommended_action: 'n8n 워크플로우를 활성화하고 다시 시도해주세요.'
      }},
      { tab_id:'sources', tab_label:'참고 자료', type:'sources',
        items: docs.map(d=>({ title:d.title, url:d.url||'', source_type:'기타', summary:d.desc||'', notable_points:[], reliability_note:'' })) }
    ],
    recommended_next_search: [],
    limitations: 'n8n 연동 전이라 실제 AI 분석 결과가 아닙니다.'
  };
}
function reportTabsHtml(report){
  if(!report || !Array.isArray(report.tabs)) return '';
  const body = report.tabs.map(tab=>{
    if(tab.type==='executive_brief'){
      const c = tab.content||{};
      return `<div style="margin-bottom:22px;padding-bottom:20px;border-bottom:1px solid var(--line)">
        <div style="font-weight:900;font-size:15px;color:var(--primary2);margin-bottom:10px;letter-spacing:.02em">${esc(tab.tab_label||'')}</div>
        ${c.one_line_conclusion?`<p style="margin:0 0 12px;font-weight:800;font-size:19px;line-height:1.5;color:#0f172a">${esc(c.one_line_conclusion)}</p>`:''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          ${c.importance?`<span class="badge orange" style="font-size:13px;padding:6px 11px">중요도 ${esc(c.importance)}</span>`:''}
          ${c.urgency?`<span class="badge red" style="font-size:13px;padding:6px 11px">${esc(c.urgency)}</span>`:''}
        </div>
        ${c.relevance_to_organization?`<p style="margin:0 0 10px;color:#334155;font-size:16px;line-height:1.7">${esc(c.relevance_to_organization)}</p>`:''}
        ${(c.recommended_owner&&c.recommended_owner.length)?`<p style="margin:0 0 10px;font-size:15px;line-height:1.7"><b>검토 부서:</b> ${c.recommended_owner.map(esc).join(', ')}</p>`:''}
        ${c.recommended_action?`<p style="margin:0;font-size:15px;line-height:1.7"><b>추천 액션:</b> ${esc(c.recommended_action)}</p>`:''}
      </div>`;
    }
    if(tab.type==='sections'){
      const secs = (tab.sections||[]).map(s=>`
        <div style="margin-bottom:16px">
          <div style="font-weight:800;font-size:15px;color:#1e293b;margin-bottom:8px">${esc(s.title||'')}</div>
          <ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.8;color:#334155">${(s.items||[]).map(it=>`<li style="margin-bottom:4px">${esc(it)}</li>`).join('')}</ul>
        </div>`).join('');
      return `<div style="margin-bottom:22px;padding-bottom:20px;border-bottom:1px solid var(--line)">
        <div style="font-weight:900;font-size:15px;color:var(--primary2);margin-bottom:10px;letter-spacing:.02em">${esc(tab.tab_label||'')}</div>
        ${secs}
      </div>`;
    }
    if(tab.type==='sources'){
      const items = (tab.items||[]).map(s=>`
        <div style="border-top:1px solid var(--line);padding-top:12px;margin-top:12px">
          <div style="font-weight:800;font-size:15px;color:#0f172a">${esc(s.title||'')}</div>
          ${s.summary?`<p style="margin:5px 0;font-size:14px;line-height:1.7;color:#475569">${esc(s.summary)}</p>`:''}
          ${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener" style="font-size:13px;color:var(--primary2)">${esc(s.url)}</a>`:''}
        </div>`).join('');
      return `<div style="margin-bottom:22px">
        <div style="font-weight:900;font-size:15px;color:var(--primary2);margin-bottom:10px;letter-spacing:.02em">${esc(tab.tab_label||'')}</div>
        ${items}
      </div>`;
    }
    return '';
  }).join('');
  const nextSearch = (report.recommended_next_search&&report.recommended_next_search.length)
    ? `<p style="margin:0 0 8px;font-size:14px;color:var(--muted)"><b>다음 추천 검색어:</b> ${report.recommended_next_search.map(esc).join(', ')}</p>` : '';
  const limitations = report.limitations ? `<p style="margin:0;font-size:14px;color:var(--muted)"><b>한계:</b> ${esc(report.limitations)}</p>` : '';
  return body + nextSearch + limitations;
}
// PDF 내보내기(html2canvas)용 렌더러. reportTabsHtml과 내용은 동일하지만,
// html2canvas가 CSS 변수(var(--x))를 안정적으로 읽지 못하는 경우가 있어(리서치 결과 PDF
// 내보내기에서도 동일한 이유로 처음부터 고정 hex 컬러를 써왔음) 색상을 전부 고정값으로 박아둔다.
function reportTabsPrintHtml(report){
  if(!report || !Array.isArray(report.tabs)) return '';
  const body = report.tabs.map(tab=>{
    if(tab.type==='executive_brief'){
      const c = tab.content||{};
      return `<div class="print-block" style="margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid #e5eaf2">
        <div style="font-weight:900;font-size:13px;color:#1d4ed8;margin-bottom:9px;letter-spacing:.02em">${esc(tab.tab_label||'')}</div>
        ${c.one_line_conclusion?`<p style="margin:0 0 11px;font-weight:800;font-size:16px;line-height:1.5;color:#0f172a">${esc(c.one_line_conclusion)}</p>`:''}
        <div style="margin-bottom:11px">
          ${c.importance?`<span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#fff7ed;color:#c2410c;font-size:11px;font-weight:800;margin-right:6px">중요도 ${esc(c.importance)}</span>`:''}
          ${c.urgency?`<span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#fee2e2;color:#dc2626;font-size:11px;font-weight:800">${esc(c.urgency)}</span>`:''}
        </div>
        ${c.relevance_to_organization?`<p style="margin:0 0 9px;color:#334155;font-size:12.5px;line-height:1.7">${esc(c.relevance_to_organization)}</p>`:''}
        ${(c.recommended_owner&&c.recommended_owner.length)?`<p style="margin:0 0 9px;font-size:12px;line-height:1.7"><b>검토 부서:</b> ${c.recommended_owner.map(esc).join(', ')}</p>`:''}
        ${c.recommended_action?`<p style="margin:0;font-size:12px;line-height:1.7"><b>추천 액션:</b> ${esc(c.recommended_action)}</p>`:''}
      </div>`;
    }
    if(tab.type==='sections'){
      // 소제목(예: "기회 요인", "리스크")마다 하나의 print-block으로 감싸서, PDF로 내보낼 때
      // 이 블록 중간에서 페이지가 끊기지 않고 통째로 다음 페이지로 넘어가게 한다.
      // 탭 제목(tab_label)은 첫 번째 소제목과 한 블록으로 묶어 헤더만 페이지 하단에 혼자 남지 않게 한다.
      const list = tab.sections||[];
      const secs = list.map((s,idx)=>{
        const secHtml = `<div style="margin-bottom:13px">
          <div style="font-weight:800;font-size:12.5px;color:#1e293b;margin-bottom:6px">${esc(s.title||'')}</div>
          <ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.8;color:#334155">${(s.items||[]).map(it=>`<li style="margin-bottom:4px">${esc(it)}</li>`).join('')}</ul>
        </div>`;
        const header = idx===0 ? `<div style="font-weight:900;font-size:13px;color:#1d4ed8;margin-bottom:9px;letter-spacing:.02em">${esc(tab.tab_label||'')}</div>` : '';
        return `<div class="print-block">${header}${secHtml}</div>`;
      }).join('');
      return `<div style="margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid #e5eaf2">${secs}</div>`;
    }
    if(tab.type==='sources'){
      // 참고자료도 자료 1건 단위로 print-block을 나눠, 제목/요약/URL이 페이지 경계에서 갈라지지 않게 한다.
      const list = tab.items||[];
      const items = list.map((s,idx)=>{
        const itemHtml = `<div style="border-top:1px solid #e5eaf2;padding-top:10px;margin-top:10px">
          <div style="font-weight:800;font-size:12px;color:#0f172a">${esc(s.title||'')}</div>
          ${s.summary?`<p style="margin:4px 0;font-size:11.5px;line-height:1.7;color:#475569">${esc(s.summary)}</p>`:''}
          ${s.url?`<div style="font-size:10.5px;color:#1d4ed8;word-break:break-all">${esc(s.url)}</div>`:''}
        </div>`;
        const header = idx===0 ? `<div style="font-weight:900;font-size:13px;color:#1d4ed8;margin-bottom:9px;letter-spacing:.02em">${esc(tab.tab_label||'')}</div>` : '';
        return `<div class="print-block">${header}${itemHtml}</div>`;
      }).join('');
      return `<div style="margin-bottom:20px">${items}</div>`;
    }
    return '';
  }).join('');
  const nextSearch = (report.recommended_next_search&&report.recommended_next_search.length)
    ? `<div class="print-block"><p style="margin:0 0 7px;font-size:11.5px;color:#697386"><b>다음 추천 검색어:</b> ${report.recommended_next_search.map(esc).join(', ')}</p></div>` : '';
  const limitations = report.limitations ? `<div class="print-block"><p style="margin:0;font-size:11.5px;color:#697386"><b>한계:</b> ${esc(report.limitations)}</p></div>` : '';
  return body + nextSearch + limitations;
}
async function retryKwSearch(hidx){
  const h = resultHistory[hidx]; if(!h) return;
  showToast('다시 검색 중입니다...');
  const parts = { front:[...(h.front||[])], core:[...(h.core||[])], back:[...(h.back||[])] };
  await generateResultsFor(h.kw, parts);
  renderResults();
}
function getSelectedDocs(){
  const checked = $$('.result-chk:checked');
  if(!checked.length) return displayedDocs; // 선택 없으면 전체
  const hidxSet = new Set([...checked].map(c=>+c.dataset.hidx));
  return displayedDocs.filter(d=>hidxSet.has(d.hidx));
}
function updateExportBtnLabel(){
  const checked = $$('.result-chk:checked');
  const btn = $('#exportResultsBtn');
  if(!btn) return;
  if(!checked.length){ btn.textContent = '⬇ 내보내기 ▾'; return; }
  const hidxSet = new Set([...checked].map(c=>+c.dataset.hidx));
  const count = displayedDocs.filter(d=>hidxSet.has(d.hidx)).length;
  btn.textContent = `⬇ ${checked.length}개 키워드(${count}건) 내보내기 ▾`;
}
async function saveResultDoc(i){
  const d = displayedDocs[i]; if(!d) return;
  const uid = await getUid(); if(!uid){ showToast('로그인이 필요합니다.'); return; }
  const row = { profile_id:uid, title:d.title, body:d.body, type:'리서치 결과', badge:'blue' };
  const { data } = await _sb.from('saved_docs').insert(row).select().single();
  savedDocs.unshift({ id:data?.id, ...row });
  showToast('저장되었습니다.');
}
async function deleteSelectedResults(){
  const checked = $$('.result-chk:checked');
  if(!checked.length){ showToast('삭제할 결과를 먼저 선택해주세요.'); return; }
  if(!confirm(`선택한 ${checked.length}개 키워드의 검색 결과를 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;

  const uid = await getUid(); if(!uid){ showToast('로그인이 필요합니다.'); return; }
  const hidxSet = new Set([...checked].map(c=>+c.dataset.hidx));
  const targets = resultHistory.filter((h,hi)=>hidxSet.has(hi));

  for(const h of targets){
    if(h.id) await _sb.from('research_history').delete().eq('id', h.id).eq('profile_id', uid);
  }
  const targetKws = new Set(targets.map(h=>h.kw));
  resultHistory = resultHistory.filter(h=>!targetKws.has(h.kw));

  renderResults();
  try{ renderDashboard(); }catch(e){}
  try{ renderKeywordsPage(); }catch(e){}
  showToast(`${targets.length}개 키워드의 결과가 삭제되었습니다.`);
}
async function saveAllResults(){
  const selected = getSelectedDocs();
  if(selected.length===0){ showToast('저장할 결과가 없습니다.'); return; }
  const uid = await getUid(); if(!uid){ showToast('로그인이 필요합니다.'); return; }
  const rows = selected.filter(d=>d.status==='success').map(d=>({ profile_id:uid, title:d.title, body:d.body, type:'리서치 결과', badge:'blue' }));
  if(!rows.length){ showToast('저장할 성공 결과가 없습니다.'); return; }
  const { data } = await _sb.from('saved_docs').insert(rows).select();
  (data||[]).reverse().forEach(r=>savedDocs.unshift({ id:r.id, profile_id:uid, title:r.title, body:r.body, type:r.type, badge:r.badge }));
  showToast(rows.length+'건이 저장되었습니다.');
}
function openDocModal(i, kind){
  let doc;
  if(kind==='result') doc = displayedDocs[i];
  if(kind==='saved') doc = savedDocs[i];
  if(!doc) return;
  $('#docModalTitle').textContent = doc.title;
  $('#docModalMeta').innerHTML = kind==='result'
    ? `<span class="badge blue">${esc(doc.kw)}</span> <span class="badge ${doc.badge||'gray'}">${esc(doc.type||'자료')}</span>`
    : `<span class="badge ${doc.badge||'blue'}">${esc(doc.type||'자료')}</span>`;
  $('#docModalBody').textContent = doc.body || doc.desc || '';
  $('#docModalOverlay').style.display = 'flex';
  $('#docModalSourceLink').innerHTML = doc.url
    ? `<a href="${esc(doc.url)}" target="_blank" rel="noopener noreferrer" class="btn soft" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px">🔗 원문 기사 바로가기${doc.source?` <span style="color:var(--muted);font-weight:700">· ${esc(doc.source)}</span>`:''}</a>`
    : '';
}
function closeDocModal(){ $('#docModalOverlay').style.display = 'none'; }


// ══════════════════════════════════════════
// 전역 검색 → 리서치 결과로 연결
// ══════════════════════════════════════════
async function doGlobalSearch(kw, parts){
  if(!kw) return;
  if(!parts){
    const prev = resultHistory.find(h=>h.kw===kw);
    parts = prev ? { front:[...prev.front], core:[...prev.core], back:[...prev.back] } : null;
  }
  saveSearchHistory(kw);
  showPage('results');
  await generateResultsFor(kw, parts);
  renderResults();
}

