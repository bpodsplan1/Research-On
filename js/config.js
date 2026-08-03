// ══════════════════════════════════════════
// Supabase 초기화
// ══════════════════════════════════════════
const { createClient } = supabase;
const _sb = createClient(
  'https://aiftpranlfudkbobxyll.supabase.co',
  'sb_publishable_qnUFAiMRiJNzARP_FE12Bg_3zFEdc94'
);
// 관리자가 "새 계정 발급"으로 회원가입을 대신 처리할 때, 그 signUp 호출이 현재 로그인된
// 관리자의 세션을 새로 만든 계정 세션으로 덮어써버리는 것을 막기 위한 별도(격리된) 클라이언트.
// 세션을 저장하지 않으므로(persistSession:false) 발급 즉시 버려집니다.
const _sbAdmin = createClient(
  'https://aiftpranlfudkbobxyll.supabase.co',
  'sb_publishable_qnUFAiMRiJNzARP_FE12Bg_3zFEdc94',
  { auth: { storageKey: 'ro-admin-provisioning', persistSession: false, autoRefreshToken: false } }
);
// 현재 로그인 유저 ID — 캐싱하지 않고 항상 실시간 세션에서 조회 (계정 전환 버그 방지)
async function getUid(){
  const { data:{ session } } = await _sb.auth.getSession();
  return session?.user?.id || null;
}

// ══════════════════════════════════════════
// ★ n8n Webhook URL 설정 — 계정 설정 페이지에서도 변경 가능 ★
// ══════════════════════════════════════════
// n8n Webhook 주소는 계정 설정 화면에서 노출/수정되지 않도록 코드 내부에 고정합니다.
const N8N_NEWS_SEARCH_URL = 'https://n8n.mokai.kr/webhook/webhook/research/manual';
const N8N_INSIGHT_URL = 'https://n8n.mokai.kr/webhook/webhook/research/summarize-selected';
const N8N_NEWSLETTER_DRAFT_URL = 'https://n8n.mokai.kr/webhook/newsletter/draft';
const N8N_NEWSLETTER_QUEUE_URL = 'https://n8n.mokai.kr/webhook/newsletter/queue';
// 관리자가 4개 섹션을 최종 확정한 뒤, 발송 전에 그 확정 내용만 근거로 Executive Brief를 다시 쓰는 웹훅
const N8N_NEWSLETTER_SUMMARIZE_BRIEF_URL = 'https://n8n.mokai.kr/webhook/newsletter/summarize-brief';
// 신규 연동(관리자 전용 기능) — production 웹훅 주소
const N8N_ADMIN_RESET_PW_URL = 'https://n8n.mokai.kr/webhook/admin/reset-password';
const N8N_NEWSLETTER_FORCE_SEND_URL = 'https://n8n.mokai.kr/webhook/newsletter/force-send';
// 뉴스레터 1단계(후보 수집) 워크플로우를 스케줄(매주 화요일 08시)과 무관하게 즉시 실행 — 테스트 목적
const N8N_NEWSLETTER_FORCE_COLLECT_URL = 'https://n8n.mokai.kr/webhook/newsletter/force-collect';
// 로그인 화면의 셀프서비스 비밀번호 초기화(아이디·성명·이메일 일치 확인) — 관리자 토큰 불필요
const N8N_SELF_RESET_PW_URL = 'https://n8n.mokai.kr/webhook/user/self-reset-password';
// 신규 구독(본인 구독/타인 대리 등록) 성공 시 웰컴 메일 + 5분 뒤 최신호 발송을 트리거하는 웹훅
const N8N_NEWSLETTER_WELCOME_URL = 'https://n8n.mokai.kr/webhook/newsletter/welcome';
// 본인 구독 해지 성공 시 해지 안내 메일을 트리거하는 웹훅 (신규 워크플로우: "[Research On] 뉴스레터 - 구독 해지 안내 메일")
const N8N_NEWSLETTER_GOODBYE_URL = 'https://n8n.mokai.kr/webhook/newsletter/goodbye';
// 위 두 관리자 전용 웹훅 호출 시 함께 보내는 최소 방어용 토큰.
// n8n 워크플로우의 "입력 검증" 코드 노드에 있는 ADMIN_ACTION_TOKEN 값과 반드시 동일해야 하며,
// 완전한 인증 수단은 아니므로(프론트 JS에 노출됨) 값을 바꾸고 싶다면 양쪽을 함께 수정할 것.
const ADMIN_ACTION_TOKEN = 'ro-admin-8f2c1d9e41';


const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const selected = {core:[], front:[], back:[]};
let currentUserRole = 'user';
let currentUserEmail = '';
let currentUserId = '';
let currentUserProfile = { name:'', affiliation:'', position:'', email:'' };
let profileEditing = false;
// 최종 조합에 실제로 표시·정렬되는 순서. { group, value } 형태이며
// 드래그로 자유롭게 순서를 바꿀 수 있다 (front/core/back 구분과 무관하게 섞일 수 있음).
let comboOrder = [];
let step = 0;
let currentPage = 'dashboard';
let poolD1 = null;
let poolD2 = null;
// 시점 키워드(2024, 지난 3년 등)는 "고급 옵션"의 검색 시작일/종료일과 역할이 겹쳐
// 사용자 혼란을 줄 수 있어 전방 확장 키워드 조합 화면에서는 제외한다.
const frontKeys = [['target','대상 키워드'],['scope','범위 키워드'],['industry','산업 키워드']];
const backKeys = [['intent','의도 키워드'],['content','콘텐츠 유형 키워드'],['analysis','분석 키워드'],['type','유형 키워드']];

function esc(s){ return String(s).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
// 부서 select는 목록을 훑어보기 편하도록 옵션 텍스트를 들여쓰기된 짧은 이름("1팀")으로만 표시하는데,
// 그러면 선택 후 닫힌 select 박스에도 "1팀"만 보여서 어느 센터 소속인지 알 수 없다.
// select의 value에는 이미 전체 경로("BPO사업본부 > DS지원사업부 > GA센터 > 1팀")가 들어있으므로,
// select 아래 작은 미리보기 텍스트로 그 값을 그대로 보여준다.
function updateDeptPathPreview(selectId, previewId){
  const sel = document.getElementById(selectId);
  const prev = document.getElementById(previewId);
  if(!sel || !prev) return;
  const v = sel.value;
  if(!v){ prev.style.display = 'none'; prev.innerHTML = ''; return; }
  prev.style.display = 'block';
  prev.innerHTML = '선택됨: <b style="color:var(--primary2)">' + esc(v) + '</b>';
}
// 네이버 등 일부 API가 제목/요약에 &quot; 같은 HTML 엔티티를 인코딩된 채로 내려보내는 경우가 있어
// 화면에 그대로 노출되지 않도록 디코딩한다. (n8n 쪽에서도 정리하지만, 프론트에서도 한 번 더 방어)
function decodeHtmlEntities(s){
  return String(s || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
function formatPublishedDate(v){
  if(!v) return '';
  const d = new Date(v);
  if(!isNaN(d.getTime())) return d.toLocaleDateString('ko-KR', {year:'numeric', month:'2-digit', day:'2-digit'});
  return String(v); // n8n이 이미 "2026-07-14" 등 읽기 쉬운 형식으로 보낸 경우 그대로 표시
}
function groupCore(rows){
  const obj={};
  rows.forEach(r=>{
    obj[r.d1] ??= {count:0, d2:{}};
    obj[r.d1].count++;
    obj[r.d1].d2[r.d2] ??= {count:0, d3:{}};
    obj[r.d1].d2[r.d2].count++;
    obj[r.d1].d2[r.d2].d3[r.d3] ??= [];
    obj[r.d1].d2[r.d2].d3[r.d3].push(r.keyword);
  });
  return obj;
}
function showToast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); }

// ── 페이지 전환 ──
function showPage(id){
  if((id==='newsletter-manage'||id==='admin-approve'||id==='newsletter-subscribers'||id==='admin-support') && currentUserRole!=='admin'){ showToast('관리자만 접근할 수 있는 페이지입니다.'); id='dashboard'; }
  const target = document.getElementById(id); if(!target) return;
  $$('.page').forEach(p=>p.classList.toggle('active', p.id===id));
  $$('.nav-item[data-page]').forEach(b=>b.classList.toggle('active', b.dataset.page===id));
  currentPage=id; $('#sidebar')?.classList.remove('open');
  if(id==='dashboard') renderDashboard();
  if(id==='newssum') renderInsightHistoryPage();
  if(id==='newssum-detail') renderInsightDetail();
  if(id==='newsletter') renderNewsletterPage();
  if(id==='newsletter-subscribe') renderNewsletterSubscribePage();
  if(id==='newsletter-manage') renderNewsletterAdminPage();
  if(id==='history'){ renderHistoryPage(); }
  if(id==='results') renderResultsPage();
  if(id==='results-detail') renderResultsDetail();
  if(id==='saved') renderSavedPage();
  if(id==='account') renderAccountPage();
  if(id==='admin-approve'){ loadAdminRequests(); loadAllAccounts(); }
  if(id==='newsletter-subscribers') loadNewsletterSubscribers();
  if(id==='admin-support') loadSupportRequestsAdmin(supportAdminFilter);
  window.scrollTo({top:0, behavior:'smooth'});
}
function switchMode(mode){
  $$('.tab[data-mode]').forEach(t=>t.classList.toggle('active', t.dataset.mode===mode));
  $$('.mode-panel').forEach(p=>p.classList.toggle('active', p.id==='mode-'+mode));
  updatePayload();
}
function setStep(n){
  step = Math.max(0, Math.min(2, n));
  $$('.builder-step').forEach(p=>p.classList.toggle('active', Number(p.dataset.step)===step));
  $$('.step-dot').forEach(d=>d.classList.toggle('active', Number(d.dataset.stepDot)===step));
  $('#prevStep').disabled = step===0;
  $('#nextStep').textContent = step===2 ? '고급 옵션으로 이동 →' : '다음 →';
}
// 대시보드 "오늘의 추천 키워드"(핵심+핵심/핵심+확장 2개 조합)를 클릭하면 바로 검색을
// 실행하지 않고, 조합을 이루는 각 항목을 종류(core/front/back)에 맞게 선택한 채
// "새 리서치 만들기"의 전방 확장 단계로 이동시켜, 사용자가 조합을 이어서 완성할 수 있게 한다.
function useSuggestedCombo(idx){
  const combo = SUGGESTED_COMBOS[idx];
  if(!combo) return;
  combo.parts.forEach(({v,k})=>{
    if(!selected[k].includes(v)){ selected[k].push(v); addToCombo(k, v); }
  });
  showPage('new-research');
  switchMode('detail');
  setStep(1);
  updateSelection(); renderCore(); renderExt(); updatePayload();
  showToast(`"${combo.label}" 조합이 선택되었습니다. 이어서 조합을 완성해보세요.`);
}
// 대시보드 검색창에 키워드를 입력하면 바로 웹훅 검색을 실행하지 않고,
// 키워드 Pool·전방·후방 확장 데이터에서 유사한 항목을 찾아 자동으로 조합한 뒤
// "새 리서치 만들기"로 이동시켜, 사용자가 조합을 확인·보완할 수 있게 한다.
function useSearchKeywordForBuilder(raw){
  const kw = (raw||'').trim();
  if(!kw) return;
  const q = kw.toLowerCase();
  let addedCore = 0, addedFront = 0, addedBack = 0;

  // 1) 전방/후방 확장 키워드 풀에서 유사 항목 탐색 — 핵심 키워드 매칭보다 먼저 해서,
  // 아래에서 "원문을 통째로 핵심 키워드로 담을지" 판단할 때 이 결과를 참고한다.
  // 확장 키워드는 대체로 짧은 수식어(예: "리스크")라서, 긴 입력어(예: AI가 만든 추천 검색어
  // 문구) 안에 그 수식어가 포함된 경우가 실제로 훨씬 많다. 핵심 키워드 매칭과 마찬가지로
  // 양방향(v가 q를 포함 OR q가 v를 포함)으로 확인해야 이런 케이스를 놓치지 않는다.
  frontKeys.forEach(([key])=>{
    DATA.ext[key].forEach(v=>{
      const vl = v.toLowerCase();
      if((vl.includes(q) || q.includes(vl)) && !selected.front.includes(v)){ selected.front.push(v); addToCombo('front', v); addedFront++; }
    });
  });
  backKeys.forEach(([key])=>{
    DATA.ext[key].forEach(v=>{
      const vl = v.toLowerCase();
      if((vl.includes(q) || q.includes(vl)) && !selected.back.includes(v)){ selected.back.push(v); addToCombo('back', v); addedBack++; }
    });
  });

  // 2) 핵심 키워드 Pool에서 유사 키워드 탐색 (완전일치 우선, 없으면 부분일치 최대 5개)
  const exact = DATA.core.filter(r => r.keyword.toLowerCase() === q);
  const partial = DATA.core.filter(r => r.keyword.toLowerCase().includes(q) || q.includes(r.keyword.toLowerCase()));
  const coreMatches = (exact.length ? exact : partial).slice(0, 5);
  coreMatches.forEach(r=>{
    if(!selected.core.includes(r.keyword)){ selected.core.push(r.keyword); addToCombo('core', r.keyword); addedCore++; }
  });
  // 핵심·전방·후방 어디에도 매칭되는 게 하나도 없을 때만 입력어 원문 그대로를 핵심 키워드로
  // 담아준다. 전방/후방만 뽑혔는데 원문 전체를 통째로 또 핵심 키워드로 넣으면 이미 분해된
  // 조각과 원문 전체가 중복으로 같이 들어가 지저분해진다(실사용 중 발견된 문제).
  if(!coreMatches.length && !addedFront && !addedBack && !selected.core.includes(kw)){
    selected.core.push(kw); addToCombo('core', kw); addedCore++;
  }

  showPage('new-research');
  switchMode('detail');
  setStep((addedCore || addedFront || addedBack) ? 1 : 0);
  updateSelection(); renderCore(); renderExt(); updatePayload();
  const parts = [];
  if(addedCore) parts.push(`핵심 키워드 ${addedCore}개`);
  if(addedFront) parts.push(`전방 확장 ${addedFront}개`);
  if(addedBack) parts.push(`후방 확장 ${addedBack}개`);
  showToast(parts.length ? `"${kw}"와(과) 관련된 ${parts.join(', ')}를 자동으로 담았어요. 조합을 확인해보세요.` : `"${kw}"을(를) 핵심 키워드로 담았어요.`);
}
function toggleValue(group, value){
  const arr = selected[group]; const i = arr.indexOf(value);
  if(i>=0){ arr.splice(i,1); removeFromCombo(group, value); }
  else { arr.push(value); addToCombo(group, value); }
  updateSelection(); renderCore(); renderExt(); updatePayload();
}
function removeValue(group, value){
  const arr=selected[group]; const i=arr.indexOf(value); if(i>=0) arr.splice(i,1);
  removeFromCombo(group, value);
  updateSelection(); renderCore(); renderExt(); updatePayload();
}
function addToCombo(group, value){
  if(comboOrder.some(o=>o.group===group && o.value===value)) return;
  // 같은 그룹(front/core/back)의 마지막 항목 바로 뒤에 이어붙인다.
  // 해당 그룹이 아직 comboOrder에 하나도 없으면, front→core→back 순서를 지키는
  // 위치(즉 자기보다 뒤 그룹의 첫 항목 앞)에 삽입한다.
  // (드래그로 순서를 자유롭게 바꾼 뒤에도, 새로 추가되는 항목은 항상 이 규칙을 따른다)
  const order = {front:0, core:1, back:2};
  let lastSameGroupIdx = -1;
  for(let i=comboOrder.length-1; i>=0; i--){
    if(comboOrder[i].group===group){ lastSameGroupIdx = i; break; }
  }
  let insertAt;
  if(lastSameGroupIdx >= 0){
    insertAt = lastSameGroupIdx + 1;
  } else {
    insertAt = comboOrder.length;
    for(let i=0;i<comboOrder.length;i++){
      if(order[comboOrder[i].group] > order[group]){ insertAt = i; break; }
    }
  }
  comboOrder.splice(insertAt, 0, {group, value});
}
function removeFromCombo(group, value){
  const i = comboOrder.findIndex(o=>o.group===group && o.value===value);
  if(i>=0) comboOrder.splice(i,1);
}
function getFinalQuery(){ return comboOrder.map(o=>o.value).join(' '); }
const COMBO_CLASS = {front:'combo-front', core:'combo-core', back:'combo-back'};
function updateSelection(){
  const tagBox=$('#selectedTags');
  // Front·Core·Back 접두 텍스트 대신, 역할별로 색만 다르게 표현한다.
  // Core(핵심 키워드)만 눈에 띄게 강조하고 Front/Back은 차분한 색으로 구분하며,
  // 사용자가 드래그로 자유롭게 순서를 바꿀 수 있다.
  const items = comboOrder.map((o,idx)=>`<span class="chip ${COMBO_CLASS[o.group]} selected" data-combo-idx="${idx}">${esc(o.value)} <button class="x" type="button" data-remove="${o.group}" data-value="${esc(o.value)}">×</button></span>`);
  tagBox.innerHTML = items.length ? items.join('') : '<span style="color:#94a3b8;font-weight:800">아직 선택한 키워드가 없습니다.</span>';
}
function reorderCombo(fromIdx, toIdx){
  if(fromIdx===toIdx || fromIdx==null || toIdx==null) return;
  const moved = comboOrder.splice(fromIdx,1)[0];
  comboOrder.splice(toIdx, 0, moved);
  updateSelection(); updatePayload();
}
let comboDragSrcIdx = null;
// Pointer Events(mouse/touch/pen 공용)로 구현 — 터치 기기에서도 드래그로 순서 변경 가능.
function bindComboDragEvents(){
  const box = $('#selectedTags'); if(!box) return;
  box.addEventListener('pointerdown', e=>{
    if(e.target.closest('.x')) return; // × 버튼 클릭은 드래그로 취급하지 않음
    const chip = e.target.closest('[data-combo-idx]');
    if(!chip) return;
    e.preventDefault();
    chip.setPointerCapture(e.pointerId);
    comboDragSrcIdx = +chip.dataset.comboIdx;
    let targetIdx = null;
    chip.classList.add('dragging');

    function onMove(ev){
      if(ev.pointerId !== e.pointerId) return;
      const overEl = document.elementFromPoint(ev.clientX, ev.clientY);
      const overChip = overEl && overEl.closest('[data-combo-idx]');
      $$('.chip', box).forEach(c=>c.classList.remove('drop-before','drop-after'));
      if(overChip && overChip !== chip){
        const rect = overChip.getBoundingClientRect();
        const before = (ev.clientX - rect.left) < rect.width/2;
        overChip.classList.toggle('drop-before', before);
        overChip.classList.toggle('drop-after', !before);
        targetIdx = +overChip.dataset.comboIdx + (before ? 0 : 1);
      } else {
        targetIdx = null;
      }
    }
    function onUp(ev){
      if(ev.pointerId !== e.pointerId) return;
      chip.releasePointerCapture(e.pointerId);
      chip.removeEventListener('pointermove', onMove);
      chip.removeEventListener('pointerup', onUp);
      chip.removeEventListener('pointercancel', onUp);
      $$('.chip', box).forEach(c=>c.classList.remove('dragging','drop-before','drop-after'));
      if(targetIdx !== null){
        let t = targetIdx;
        if(comboDragSrcIdx < t) t -= 1;
        reorderCombo(comboDragSrcIdx, t);
      }
      comboDragSrcIdx = null;
    }
    chip.addEventListener('pointermove', onMove);
    chip.addEventListener('pointerup', onUp);
    chip.addEventListener('pointercancel', onUp);
  });
}
function renderCore(){
  // 키워드 Pool 탐색(리스트형)의 선택 상태를 최신화합니다.
  if(poolD1 && poolD2) renderPoolD3();
}
function renderExt(){
  const front = frontKeys.map(([key,title])=>`<div class="exp-box"><h4>${title}</h4>${DATA.ext[key].map(v=>`<button class="chip ${selected.front.includes(v)?'selected':''}" type="button" data-front="${esc(v)}">${esc(v)}</button>`).join('')}</div>`).join('');
  const back = backKeys.map(([key,title])=>`<div class="exp-box"><h4>${title}</h4>${DATA.ext[key].map(v=>`<button class="chip ${selected.back.includes(v)?'selected':''}" type="button" data-back="${esc(v)}">${esc(v)}</button>`).join('')}</div>`).join('');
  $('#frontList').innerHTML = front; $('#backList').innerHTML = back;
}
let includeDomains = [];
const DOMAIN_GROUPS = {
  encyclopedia: { label:'📚 백과사전', domains:['namu.wiki','wikipedia.org','terms.naver.com'] },
  blog:         { label:'✍️ 블로그', domains:['blog.naver.com','tistory.com','brunch.co.kr','velog.io'] },
  sns:          { label:'📱 SNS', domains:['instagram.com','facebook.com','youtube.com','tiktok.com','twitter.com','x.com','threads.net'] },
  community:    { label:'💬 커뮤니티', domains:['dcinside.com','clien.net','ruliweb.com','theqoo.net','fmkorea.com','mlbpark.donga.com'] },
  shopping:     { label:'🛒 쇼핑/광고', domains:['coupang.com','gmarket.co.kr','11st.co.kr','auction.co.kr'] },
  job:          { label:'💼 채용', domains:['jobkorea.co.kr','saramin.co.kr','wanted.co.kr','work.go.kr'] }
};
let excludeDomains = [...DOMAIN_GROUPS.encyclopedia.domains, ...DOMAIN_GROUPS.blog.domains, ...DOMAIN_GROUPS.sns.domains, ...DOMAIN_GROUPS.community.domains, ...DOMAIN_GROUPS.shopping.domains, ...DOMAIN_GROUPS.job.domains];

// 사용자가 직접 추가하는 제외 사이트/키워드 — 프리셋 그룹과는 별개로 보관해서
// 그룹 on/off 토글이 사용자가 직접 넣은 값을 건드리지 않게 한다.
let customExcludeDomains = [];
let customExcludeKeywords = [];
function normalizeDomainForCompare(v){
  return String(v||'').trim().toLowerCase()
    .replace(/^https?:\/\//,'')
    .replace(/^www\./,'')
    .split(/[\/?#]/)[0];
}
function isDomainAlreadyExcluded(input){
  const norm = normalizeDomainForCompare(input);
  if(!norm) return true;
  return excludeDomains.some(d=>normalizeDomainForCompare(d)===norm) || customExcludeDomains.some(d=>normalizeDomainForCompare(d)===norm);
}
function normalizeKeywordForCompare(v){ return String(v||'').trim().toLowerCase(); }
function isKeywordAlreadyExcluded(input){
  const norm = normalizeKeywordForCompare(input);
  if(!norm) return true;
  return excludeKeywords.some(k=>normalizeKeywordForCompare(k)===norm) || customExcludeKeywords.some(k=>normalizeKeywordForCompare(k)===norm);
}
function renderDomTags(containerId, arr){
  const container = $('#'+containerId); const input = container.querySelector('input');
  container.querySelectorAll('.tag-pill').forEach(e=>e.remove());
  arr.forEach((d,i)=>{
    const tag = document.createElement('span'); tag.className='tag-pill';
    tag.innerHTML = esc(d) + ' <span class="rm">×</span>';
    tag.querySelector('.rm').addEventListener('click', ()=>{ arr.splice(i,1); renderDomTags(containerId, arr); updatePayload(); });
    container.insertBefore(tag, input);
  });
}
const COUNTRY_OPTIONS = [
  {code:'KR', label:'🇰🇷 한국'},
  {code:'US', label:'🇺🇸 미국'},
  {code:'JP', label:'🇯🇵 일본'},
  {code:'CN', label:'🇨🇳 중국'},
  {code:'DE', label:'🇩🇪 독일'},
  {code:'GB', label:'🇬🇧 영국'}
];
let selectedCountry = 'KR';
function renderCountryChips(){
  const el = $('#countryChips'); if(!el) return;
  const noneSelected = !COUNTRY_OPTIONS.some(c=>c.code===selectedCountry);
  el.innerHTML = `<button class="chip ${!selectedCountry||noneSelected?'selected':''}" type="button" data-country="">전체 (제한 없음)</button>`
    + COUNTRY_OPTIONS.map(c=>`<button class="chip ${selectedCountry===c.code?'selected':''}" type="button" data-country="${c.code}">${esc(c.label)}</button>`).join('');
}
function selectCountry(code){ selectedCountry = code; renderCountryChips(); updatePayload(); }

// 제외 키워드 — 제외 사이트와 동일한 카테고리 그룹 방식
const KEYWORD_GROUPS = {
  ad:      { label:'📢 광고·협찬', keywords:['광고','협찬','제공받아','체험단','서포터즈'] },
  event:   { label:'🎉 행사·이벤트', keywords:['이벤트','경품','응모','당첨자 발표'] },
  recruit: { label:'💼 채용공고', keywords:['채용공고','모집공고','인턴 모집'] },
  celeb:   { label:'🎬 연예·스포츠', keywords:['열애설','컴백','예능','프로야구','아이돌'] },
  notice:  { label:'🙏 부고·인사', keywords:['부고','별세','인사발령'] }
};
let excludeKeywords = Object.values(KEYWORD_GROUPS).flatMap(g=>g.keywords);
function renderExcludeKwGroups(){
  const el = $('#excludeKwGroups'); if(!el) return;
  el.innerHTML = Object.entries(KEYWORD_GROUPS).map(([key,g])=>{
    const allOn = g.keywords.every(k=>excludeKeywords.includes(k));
    const titleAttr = esc(g.keywords.join(', '));
    return `<button class="domain-group-btn ${allOn?'on':''}" type="button" data-kw-group="${key}" title="${titleAttr}">${g.label} <span class="dg-count">${g.keywords.length}</span></button>`;
  }).join('');
}
function toggleExcludeKwGroup(key){
  const g = KEYWORD_GROUPS[key]; if(!g) return;
  const allOn = g.keywords.every(k=>excludeKeywords.includes(k));
  if(allOn) excludeKeywords = excludeKeywords.filter(k=>!g.keywords.includes(k));
  else g.keywords.forEach(k=>{ if(!excludeKeywords.includes(k)) excludeKeywords.push(k); });
  renderExcludeKwGroups(); updatePayload();
}
// ══════════════════════════════════════════
// AI 분석 가이드 (인사이트 도출 옵션)
// n8n [뉴스 크롤링 2단계] "5. Code" 노드의 viewpointMap/reportTypeMap/
// audienceLevelMap/depthMap 과 정확히 값이 일치해야 한다.
// ══════════════════════════════════════════
const REPORT_TYPE_OPTIONS = [
  {value:'trend_brief', label:'트렌드 브리프'},
  {value:'business_opportunity', label:'사업기회 분석'},
  {value:'internal_strategy_memo', label:'내부전략 메모'}
];
const VIEWPOINT_OPTIONS = [
  {value:'business_expansion', label:'신규 사업 방향성'},
  {value:'internal_management', label:'내부 인력 통제'}
];
const AUDIENCE_OPTIONS = [
  {value:'executive', label:'임원 대상 보고'},
  {value:'division_head', label:'사업부장급'},
  {value:'team_lead', label:'센터장·그룹장급'}
];
const DEPTH_OPTIONS = [
  {value:'short', label:'간결하게'},
  {value:'standard', label:'표준'},
  {value:'deep', label:'상세하게'}
];
const RISK_OPTIONS = [
  {value:'normal', label:'보통'},
  {value:'high', label:'높음 · 리스크 상세 식별'}
];
const insightSettings = { reportType:'trend_brief', viewpoint:'business_expansion', audience:'division_head', depth:'standard', risk:'normal' };
function renderChipSelect(containerId, options, field){
  const el = $('#'+containerId); if(!el) return;
  el.innerHTML = options.map(o=>`<button class="chip ${insightSettings[field]===o.value?'selected':''}" type="button" data-chip-field="${field}" data-chip-value="${o.value}">${esc(o.label)}</button>`).join('');
}
function renderAllChipSelects(){
  renderChipSelect('reportTypeChips', REPORT_TYPE_OPTIONS, 'reportType');
  renderChipSelect('viewpointChips', VIEWPOINT_OPTIONS, 'viewpoint');
  renderChipSelect('audienceChips', AUDIENCE_OPTIONS, 'audience');
  renderChipSelect('depthChips', DEPTH_OPTIONS, 'depth');
  renderChipSelect('riskChips', RISK_OPTIONS, 'risk');
}
function selectInsightChip(field, value){ insightSettings[field] = value; renderAllChipSelects(); }

function renderExcludeDomainGroups(){
  const el = $('#excludeDomGroups'); if(!el) return;
  el.innerHTML = Object.entries(DOMAIN_GROUPS).map(([key,g])=>{
    const allOn = g.domains.every(d=>excludeDomains.includes(d));
    const titleAttr = esc(g.domains.join(', '));
    return `<button class="domain-group-btn ${allOn?'on':''}" type="button" data-domain-group="${key}" title="${titleAttr}">${g.label} <span class="dg-count">${g.domains.length}</span></button>`;
  }).join('');
}
function toggleExcludeDomainGroup(key){
  const g = DOMAIN_GROUPS[key]; if(!g) return;
  const allOn = g.domains.every(d=>excludeDomains.includes(d));
  if(allOn) excludeDomains = excludeDomains.filter(d=>!g.domains.includes(d));
  else g.domains.forEach(d=>{ if(!excludeDomains.includes(d)) excludeDomains.push(d); });
  renderExcludeDomainGroups(); updatePayload();
}
function buildSearchPayload(queryOverride, parts){
  // n8n [뉴스 크롤링 1단계] "2. Code - 입력 정리" 노드가 실제로 읽는 필드만 전달한다.
  // (Tavily 전용 파라미터는 Serper+Naver 전환 이후 더 이상 쓰이지 않아 전부 제거)
  const query = (typeof queryOverride === 'string' && queryOverride.trim()) ? queryOverride.trim() : getFinalQuery();
  const startDate = $('#startDate')?.value || '';
  const endDate = $('#endDate')?.value || '';

  const payload = {
    keyword: query || '키워드를 선택해주세요',
    max_results: 20
  };
  if(startDate) payload.start_date = startDate;
  if(endDate) payload.end_date = endDate;
  if(selectedCountry) payload.country = selectedCountry;
  if(includeDomains.length) payload.include_domains = [...includeDomains];
  const allExcludeDomains = [...excludeDomains, ...customExcludeDomains];
  const allExcludeKeywords = [...excludeKeywords, ...customExcludeKeywords];
  if(allExcludeDomains.length) payload.exclude_domains = allExcludeDomains;
  if(allExcludeKeywords.length) payload.exclude_keywords = allExcludeKeywords;

  // 키워드 Pool(core) / 전방·후방 확장(expansion) 구성을 그대로 함께 전달해
  // n8n의 검색어 생성 프롬프트 품질을 높인다.
  const p = parts !== undefined ? parts : { front:[...selected.front], core:[...selected.core], back:[...selected.back] };
  if(p){
    if(p.core && p.core.length) payload.core_keywords = [...p.core];
    const expansion = [...(p.front||[]), ...(p.back||[])];
    if(expansion.length) payload.expansion_keywords = expansion;
  }

  payload.requested_at = new Date().toISOString();
  return payload;
}
function updatePayload(){
  const el=$('#payloadPreview'); if(el) el.textContent = JSON.stringify(buildSearchPayload(),null,2);
}
function initPool(){
  const g=groupCore(DATA.core);
  $('#poolDepth1').innerHTML = Object.keys(g).map(d1=>`<button class="pool-item" type="button" data-pool-d1="${esc(d1)}"><span>${esc(d1)}</span><span>${g[d1].count}</span></button>`).join('');
}
function renderPoolD2(){
  const g=groupCore(DATA.core); if(!poolD1) return;
  $$('.pool-item[data-pool-d1]').forEach(b=>b.classList.toggle('active', b.dataset.poolD1===poolD1));
  $('#poolDepth2').className=''; $('#poolDepth2').innerHTML=Object.entries(g[poolD1].d2).map(([d2,v])=>`<button class="pool-item" type="button" data-pool-d2="${esc(d2)}"><span>${esc(d2)}</span><span>${v.count}</span></button>`).join('');
  $('#poolDepth3').className='empty-state'; $('#poolDepth3').textContent='2-Depth를 선택하세요.';
}
function renderPoolD3(){
  const g=groupCore(DATA.core); if(!poolD1||!poolD2) return;
  $$('.pool-item[data-pool-d2]').forEach(b=>b.classList.toggle('active', b.dataset.poolD2===poolD2));
  const d3s=g[poolD1].d2[poolD2].d3;
  $('#poolDepth3').className=''; $('#poolDepth3').innerHTML=Object.entries(d3s).map(([d3,kws])=>`<div class="depth3-row"><div class="depth3-title">${esc(d3)}</div>${kws.map(kw=>`<button class="chip ${selected.core.includes(kw)?'selected':''}" type="button" data-pool-kw="${esc(kw)}">${esc(kw)}</button>`).join('')}</div>`).join('');
}
async function simulateRun(triggerBtn){
  const kw = getFinalQuery();
  if(!kw){ showToast('먼저 새 리서치 만들기에서 키워드를 선택해주세요.'); return; }

  const btn = triggerBtn || null;
  const originalLabel = btn ? btn.innerHTML : '';
  if(btn){ btn.disabled = true; btn.innerHTML = '검색 중...'; }
  const statusEl = $('#runStatus'); const progEl = $('#runProgress');
  let pct=0; if(statusEl) statusEl.textContent='n8n 워크플로우 실행 중...'; if(progEl) progEl.style.width='0%';
  const timer=setInterval(()=>{ if(pct<85){ pct+=15; if(progEl) progEl.style.width=pct+'%'; } },300);

  saveSearchHistory(kw);
  await generateResultsFor(kw, { front:[...selected.front], core:[...selected.core], back:[...selected.back] });

  clearInterval(timer);
  if(progEl) progEl.style.width='100%';
  const successCount = resultDocs.filter(d=>d.status==='success').length;
  const statusMsg = successCount>0
    ? `완료: 검색 결과 ${resultDocs.length}건 수집, 본문 ${successCount}건 추출 성공`
    : '완료: 결과를 가져오지 못했습니다. n8n 연동 상태를 확인해주세요.';
  if(statusEl) statusEl.textContent = statusMsg;

  if(btn){ btn.disabled = false; btn.innerHTML = originalLabel; }

  showToast('리서치 결과 페이지로 이동합니다.');
  setTimeout(()=>{ showPage('results'); }, 600);
}

