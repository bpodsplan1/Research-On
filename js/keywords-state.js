// ══════════════════════════════════════════
// 관심 키워드 / 저장 자료 / 키워드 세트
// ══════════════════════════════════════════
// ── Supabase 연동 데이터 (로컬 캐시) ──
let subscribedKws = [];
let savedDocs = [];
let keywordSets = [];

// ── 앱 상태 전체 초기화 ──
function resetAppState(){
  subscribedKws = []; savedDocs = []; keywordSets = [];
  searchHistory = []; resultHistory = [];
  resultDocs = []; currentResultKw = '';
  if(typeof insightHistory !== 'undefined') insightHistory = [];
  if(typeof currentReport !== 'undefined') currentReport = null;
  if(typeof newsletterDraft !== 'undefined'){
    newsletterDraft = { issue_title:'Research-On 주간 뉴스레터', period:'', period_start:'', period_end:'', executive_brief:{headline:'',summary:''}, editor_note:'', sections:{client_watch:[],research_on_insight:[],business_work:[],people_culture:[],people_culture_view:''} };
  }
  const rb = document.getElementById('resultsBody');
  if(rb) rb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">로그인 후 검색하면 결과가 여기에 표시됩니다.</td></tr>';
}

// ── 모든 페이지 재렌더링 ──
function renderAllPages(){
  try{ renderDashboard(); }catch(e){}
  try{ renderSavedPage(); }catch(e){}
  try{ renderHistoryPage(); }catch(e){}
  try{ renderKeywordsPage(); }catch(e){}
  try{ if(resultHistory.length){ viewResultSession(resultHistory[0].kw); } }catch(e){}
}

// ── 사용자 데이터 로드 ──
async function loadUserData(){
  resetAppState();
  const uid = await getUid();
  if(!uid){ console.log('[SB] 비로그인 - 로드 생략'); renderAllPages(); return; }

  const { data: sub } = await _sb.from('subscribed_keywords').select('keyword').eq('profile_id', uid);
  subscribedKws = (sub||[]).map(r=>r.keyword);

  const { data: docs } = await _sb.from('saved_docs').select('*').eq('profile_id', uid).order('created_at', {ascending:false});
  savedDocs = (docs||[]).map(r=>({ id:r.id, title:r.title, body:r.body, type:r.type, badge:r.badge||'blue' }));

  const { data: sets } = await _sb.from('keyword_sets').select('*').eq('profile_id', uid).order('created_at', {ascending:true});
  keywordSets = (sets||[]).map(r=>({ id:r.id, name:r.name, core:r.core||[], ext:r.ext||[] }));

  const { data: hist } = await _sb.from('search_history').select('*').eq('profile_id', uid).order('searched_at', {ascending:false}).limit(50);
  searchHistory = (hist||[]).map(r=>({ id:r.id, kw:r.keyword, date:r.date_str, time:r.time_str, count:r.search_count }));

  const { data: rh } = await _sb.from('research_history').select('*').eq('profile_id', uid).order('searched_at', {ascending:false}).limit(30);
  resultHistory = (rh||[]).map(r=>({ id:r.id, kw:r.keyword, front:r.front||[], core:r.core||[], back:r.back||[], date:r.date_str, time:r.time_str, docs:r.docs||[] }));

  // AI 인사이트 리포트 기록 (계정 단위로 누적 — Supabase 테이블 insight_reports)
  try {
    const { data: ir } = await _sb.from('insight_reports').select('*').eq('profile_id', uid).order('created_at', {ascending:false}).limit(30);
    insightHistory = (ir||[]).map(r=>({ id:r.id, kw:r.keyword, articleCount:r.article_count, report:r.report_json, createdAt: r.created_at ? new Date(r.created_at) : new Date() }));
  } catch(e){ /* insight_reports 테이블이 아직 없어도 앱은 정상 동작 */ }

  // 발송된 뉴스레터 (전사 공통 발행물 — profile_id 필터 없이 조회, Supabase 테이블 newsletter_send_history)
  try {
    const { data: nh } = await _sb.from('newsletter_send_history').select('*').order('sent_at', {ascending:false}).limit(50);
    if(nh && nh.length){
      NEWSLETTER_ISSUES = nh.map(r=>({
        title: r.issue_label,
        issueDate: r.sent_at ? new Date(r.sent_at).toLocaleDateString('ko-KR') : '',
        summary: r.subject || '',
        html: r.newsletter_html || '',
        id: r.id
      }));
    }
  } catch(e){ /* newsletter_send_history 테이블이 아직 없어도 앱은 정상 동작 (예시 데이터 유지) */ }

  renderAllPages();
  console.log('[SB] 사용자 데이터 로드 완료 (uid: '+uid+')');
}

async function toggleSubscribe(kw){
  const uid = await getUid();
  if(!uid){ showToast('로그인이 필요합니다.'); return; }
  const i = subscribedKws.indexOf(kw);
  if(i>=0){
    subscribedKws.splice(i,1);
    await _sb.from('subscribed_keywords').delete().eq('profile_id', uid).eq('keyword', kw);
    showToast('"'+kw+'" 관심 키워드에서 제거되었습니다.');
  } else {
    subscribedKws.push(kw);
    await _sb.from('subscribed_keywords').insert({ profile_id:uid, keyword:kw });
    showToast('"'+kw+'" 관심 키워드에 추가되었습니다.');
  }
  renderKeywordsPage(); renderDashboard();
}
function getCoreOrderIndex(coreArr){
  let best = Infinity;
  (coreArr||[]).forEach(kw=>{
    const i = DATA.core.findIndex(r=>r.keyword===kw);
    if(i>=0 && i<best) best = i;
  });
  return best;
}
function renderKeywordsPage(){
  // 키워드 Pool(핵심 키워드)이 같으면 전방/후방 구성이 달라도 하나의 그룹으로 묶고, 기간 필터를 적용함
  const groups = [];
  const groupIndex = {};
  resultHistory.forEach((h,idx)=>{
    if(typeof histFilterMode!=='undefined' && !matchesHistFilter(h.date)) return;
    const poolKey = (h.core && h.core.length) ? h.core.join(', ') : h.kw;
    if(!(poolKey in groupIndex)){ groupIndex[poolKey] = groups.length; groups.push({ poolKey, core:h.core, items:[] }); }
    groups[groupIndex[poolKey]].items.push({h,idx});
  });
  groups.sort((a,b)=>{
    const ai = getCoreOrderIndex(a.core), bi = getCoreOrderIndex(b.core);
    if(ai!==bi) return ai-bi;
    return a.poolKey.localeCompare(b.poolKey,'ko');
  });

  $('#researchKeywordsBody').innerHTML = groups.length ? groups.map((g,gi)=>{
    const latest = g.items[0].h;
    const itemsHtml = g.items.map(({h,idx})=>{
      const front = h.front || [], back = h.back || [];
      return `<div class="kw-item">
        <div class="kw-item-row"><span class="kw-item-label">전방 키워드</span><span class="kw-item-val">${esc(front.join(', ') || '-')}</span></div>
        <div class="kw-item-row"><span class="kw-item-label">후방 키워드</span><span class="kw-item-val">${esc(back.join(', ') || '-')}</span></div>
        <div class="kw-item-row"><span class="kw-item-label">검색 날짜</span><span class="kw-item-val">${esc(h.date)}${h.time?' '+esc(h.time):''}</span></div>
        <div class="kw-item-actions">
          <button class="btn soft" type="button" onclick="event.stopPropagation();viewResearchKeywordAt(${idx})">결과 보기</button>
          <button class="btn line" type="button" onclick="event.stopPropagation();researchKeywordResearchAt(${idx})">재검색</button>
          <button class="btn red" type="button" onclick="event.stopPropagation();deleteResearchKeywordAt(${idx})">삭제</button>
        </div>
      </div>`;
    }).join('');
    return `<div class="kw-group-card">
      <button type="button" class="kw-group-header" onclick="toggleKwGroup(${gi})">
        <span id="kwGroupArrow-${gi}" class="kw-group-arrow">▸</span>
        <b class="kw-group-title">${esc(g.poolKey)}</b>
        <span class="badge blue">${g.items.length}건</span>
        <span class="kw-group-date">최근 검색 ${esc(latest.date)}${latest.time?' '+esc(latest.time):''}</span>
      </button>
      <div class="kw-group-body" data-group-item="${gi}" style="display:none">${itemsHtml}</div>
    </div>`;
  }).join('') : '<div class="card" style="color:var(--muted);text-align:center;padding:30px">아직 새 리서치 만들기에서 검색한 키워드가 없습니다.</div>';

  $('#researchKeywordsBodyTable').innerHTML = groups.length ? groups.map((g,gi)=>{
    const latest = g.items[0].h;
    const headerRow = `<tr class="kw-group-toggle" onclick="toggleKwGroup(${gi})" style="cursor:pointer;background:#f8fafc">
      <td colspan="5">
        <div style="display:flex;align-items:center;gap:10px">
          <span id="kwGroupArrowTable-${gi}" style="display:inline-block;width:14px;color:var(--muted)">▸</span>
          <b>${esc(g.poolKey)}</b>
          <span class="badge blue">${g.items.length}건</span>
          <span style="color:var(--muted);font-size:12px;white-space:nowrap;margin-left:auto">최근 검색 ${esc(latest.date)}${latest.time?' '+esc(latest.time):''}</span>
        </div>
      </td>
    </tr>`;
    const itemRows = g.items.map(({h,idx})=>{
      const front = h.front || [], back = h.back || [];
      return `<tr class="kw-group-item" data-group-item="${gi}" style="display:none">
        <td style="padding-left:34px;color:var(--muted);white-space:nowrap">└ 검색 기록</td>
        <td>${esc(front.join(', ') || '-')}</td>
        <td>${esc(back.join(', ') || '-')}</td>
        <td style="white-space:nowrap">${esc(h.date)}${h.time?' '+esc(h.time):''}</td>
        <td><div style="display:flex;gap:6px;flex-wrap:nowrap">
          <button class="btn soft" type="button" onclick="event.stopPropagation();viewResearchKeywordAt(${idx})" style="min-height:34px;padding:0 12px;font-size:13px">결과 보기</button>
          <button class="btn line" type="button" onclick="event.stopPropagation();researchKeywordResearchAt(${idx})" style="min-height:34px;padding:0 12px;font-size:13px">재검색</button>
          <button class="btn red" type="button" onclick="event.stopPropagation();deleteResearchKeywordAt(${idx})" style="min-height:34px;padding:0 12px;font-size:13px">삭제</button>
        </div></td>
      </tr>`;
    }).join('');
    return headerRow + itemRows;
  }).join('') : '<tr><td colspan="5" style="color:var(--muted)">아직 새 리서치 만들기에서 검색한 키워드가 없습니다.</td></tr>';
}
function toggleKwGroup(gi){
  const cardBody = $(`.kw-group-body[data-group-item="${gi}"]`);
  if(cardBody){
    const arrow = $(`#kwGroupArrow-${gi}`);
    const opening = cardBody.style.display === 'none';
    cardBody.style.display = opening ? 'block' : 'none';
    if(arrow) arrow.textContent = opening ? '▾' : '▸';
  }
  const rows = $$(`tr[data-group-item="${gi}"]`);
  if(rows.length){
    const arrowT = $(`#kwGroupArrowTable-${gi}`);
    const openingT = rows[0].style.display === 'none';
    rows.forEach(tr=>{ tr.style.display = openingT ? 'table-row' : 'none'; });
    if(arrowT) arrowT.textContent = openingT ? '▾' : '▸';
  }
}
function viewResearchKeyword(kw){
  const idx = resultHistory.findIndex(h=>h.kw===kw);
  if(idx>=0){ viewResultsDetail(idx); } else { showPage('results'); viewResultSession(kw); }
}
function viewResearchKeywordAt(idx){ const h = resultHistory[idx]; if(!h) return; viewResultsDetail(idx); }
function researchKeywordResearchAt(idx){ const h = resultHistory[idx]; if(!h) return; doGlobalSearch(h.kw, {front:[...h.front], core:[...h.core], back:[...h.back]}); }
async function deleteResearchKeywordAt(idx){
  const uid = await getUid(); if(!uid) return;
  const entry = resultHistory[idx]; if(!entry) return;
  if(entry.id) await _sb.from('research_history').delete().eq('id', entry.id).eq('profile_id', uid);
  resultHistory.splice(idx,1);
  renderKeywordsPage();
  showToast('키워드 기록이 삭제되었습니다.');
}
function searchKeywordSet(i){
  const s = keywordSets[i]; if(!s) return;
  const front = s.ext.slice(0,2), back = s.ext.slice(2);
  const q = [...front, ...s.core, ...back].join(' ');
  doGlobalSearch(q, { front, core:[...s.core], back });
}
async function deleteKeywordSet(i){
  const uid = await getUid(); if(!uid) return;
  const set = keywordSets[i];
  if(set?.id) await _sb.from('keyword_sets').delete().eq('id', set.id).eq('profile_id', uid);
  keywordSets.splice(i,1); renderKeywordsPage(); showToast('키워드 세트가 삭제되었습니다.');
}
let savedFilterMode = 'all'; // 'all' | 'article' | 'report'
function renderSavedPage(){
  const isReport = d => d.type === 'AI 인사이트 리포트';
  const filtered = savedDocs
    .map((d,i)=>({d,i}))
    .filter(({d}) => savedFilterMode==='all' ? true : savedFilterMode==='report' ? isReport(d) : !isReport(d));
  $('#savedGrid').innerHTML = filtered.length ? filtered.map(({d,i})=>`
    <div class="card" style="cursor:pointer" onclick="openDocModal(${i},'saved')"><span class="badge ${d.badge||'blue'}">${esc(d.type||'자료')}</span><h3>${esc(d.title)}</h3><p style="color:var(--muted)">${esc((d.body||'').slice(0,80))}${(d.body||'').length>80?'...':''}</p>
    <button class="btn line" type="button" onclick="event.stopPropagation();deleteSavedDoc(${i})">삭제</button></div>
  `).join('') : '<div class="empty-state"><h3>저장한 자료가 없어요</h3><p>리서치 결과나 AI 인사이트 리포트에서 저장해보세요.</p></div>';
}
async function deleteSavedDoc(i){
  const uid = await getUid(); if(!uid) return;
  const doc = savedDocs[i];
  if(doc?.id) await _sb.from('saved_docs').delete().eq('id', doc.id).eq('profile_id', uid);
  savedDocs.splice(i,1); renderSavedPage(); showToast('자료가 삭제되었습니다.');
}

function timeAgo(h){
  if(!h.ts) return `${h.date} ${h.time}`;
  const mins = Math.floor((Date.now()-h.ts)/60000);
  if(mins < 1) return '방금 전';
  if(mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins/60);
  if(hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs/24);
  if(days < 7) return `${days}일 전`;
  return h.date;
}
function renderDashboard(){
  const recentEl = $('#dashRecentBody');
  if(resultHistory.length){
    const h = resultHistory[0];
    const successCount = h.docs.filter(d=>d.status==='success').length;
    recentEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><div style="font-size:17px;font-weight:900">${esc(h.kw)}</div><button class="btn soft" type="button" id="dashRecentBtn" style="flex-shrink:0">이어보기 →</button></div><p style="color:var(--muted);font-size:13px;margin:4px 0 0">${esc(timeAgo(h))} · 기사 ${successCount}건</p>`;
  } else {
    recentEl.innerHTML = '<p style="color:var(--muted);font-size:13px">아직 검색한 리서치가 없어요. 새 리서치를 만들어보세요.</p>';
  }

  const searchedKw = new Set();
  resultHistory.forEach(h=>(h.core||[]).forEach(k=>searchedKw.add(k)));
  const allKw = DATA.core.map(r=>r.keyword);
  const unexplored = allKw.filter(k=>!searchedKw.has(k));
  const pool = unexplored.length ? unexplored : allKw;
  const picks = [...pool].sort(()=>Math.random()-0.5).slice(0,3);
  $('#dashSuggestChips').innerHTML = picks.map(k=>`<button class="chip" type="button" data-suggest-kw="${esc(k)}">${esc(k)}</button>`).join('');
}

