// ══════════════════════════════════════════
// "새 리서치 만들기" — 키워드 신청 (사용자가 검색 Pool에 없는 키워드를 요청 → 관리자 승인)
// 관리자 승인 시 Supabase `keywords` 테이블에 바로 추가되어 즉시 검색 Pool에 반영된다.
// ══════════════════════════════════════════
let krqCategory = 'core';
const KRQ_CATEGORY_LABEL = { core: '핵심 키워드', ext_front: '전방 확장', ext_back: '후방 확장' };
const KRQ_EXT_TYPE_LABEL = { target: '대상 키워드', scope: '범위 키워드', industry: '산업 키워드',
  intent: '의도 키워드', content: '콘텐츠 유형 키워드', analysis: '분석 키워드', type: '유형 키워드' };

function openKeywordRequestModal(){
  krqResetForm();
  switchKeywordRequestTab('new');
  document.getElementById('keywordRequestModalOverlay')?.classList.add('open');
}
function closeKeywordRequestModal(){
  document.getElementById('keywordRequestModalOverlay')?.classList.remove('open');
}
function switchKeywordRequestTab(tab){
  document.querySelectorAll('.tab[data-krq-tab]').forEach(b=>b.classList.toggle('active', b.dataset.krqTab===tab));
  const newPanel = document.getElementById('krqNewPanel');
  const historyPanel = document.getElementById('krqHistoryPanel');
  if(newPanel) newPanel.style.display = tab==='new' ? 'block' : 'none';
  if(historyPanel) historyPanel.style.display = tab==='history' ? 'block' : 'none';
  if(tab==='history') loadMyKeywordRequests();
}
function krqResetForm(){
  krqCategory = 'core';
  document.querySelectorAll('.tab[data-krq-category]').forEach(b=>b.classList.toggle('active', b.dataset.krqCategory==='core'));
  const kwInput = document.getElementById('krqKeywordInput'); if(kwInput) kwInput.value = '';
  ['krqD1Input','krqD2Input','krqD3Input','krqNoteInput'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const status = document.getElementById('krqStatus'); if(status){ status.className='auth-status'; status.textContent=''; }
  krqUpdateFieldVisibility();
  krqPopulateExtTypeSelect();
}
function selectKeywordRequestCategory(cat){
  krqCategory = cat;
  document.querySelectorAll('.tab[data-krq-category]').forEach(b=>b.classList.toggle('active', b.dataset.krqCategory===cat));
  krqUpdateFieldVisibility();
  krqPopulateExtTypeSelect();
}
function krqUpdateFieldVisibility(){
  const coreFields = document.getElementById('krqCoreFields');
  const extFields = document.getElementById('krqExtFields');
  if(coreFields) coreFields.style.display = krqCategory==='core' ? 'block' : 'none';
  if(extFields) extFields.style.display = krqCategory==='core' ? 'none' : 'block';
}
function krqPopulateExtTypeSelect(){
  const sel = document.getElementById('krqExtTypeSelect'); if(!sel) return;
  const keys = krqCategory==='ext_back' ? EXT_BACK_KEYS : EXT_FRONT_KEYS;
  sel.innerHTML = '<option value="">선택 안 함</option>' + keys.map(k=>`<option value="${k}">${esc(KRQ_EXT_TYPE_LABEL[k])}</option>`).join('');
}
async function submitKeywordRequest(){
  const keyword = (document.getElementById('krqKeywordInput')?.value || '').trim();
  if(!keyword){ showAuthStatus('krqStatus','error','신청할 키워드를 입력해주세요.'); return; }
  const payload = {
    user_id: currentUserId, category: krqCategory, keyword,
    requester_name: currentUserProfile.name, requester_email: currentUserEmail,
    note: (document.getElementById('krqNoteInput')?.value || '').trim() || null,
  };
  if(krqCategory === 'core'){
    payload.d1 = (document.getElementById('krqD1Input')?.value || '').trim() || null;
    payload.d2 = (document.getElementById('krqD2Input')?.value || '').trim() || null;
    payload.d3 = (document.getElementById('krqD3Input')?.value || '').trim() || null;
  } else {
    payload.ext_type = document.getElementById('krqExtTypeSelect')?.value || null;
  }
  const btn = document.getElementById('krqSubmitBtn'); btn.disabled = true;
  showAuthStatus('krqStatus','loading','제출 중...');
  try{
    const { error } = await _sb.from('keyword_requests').insert(payload);
    if(error) throw error;
    showAuthStatus('krqStatus','success','신청이 접수되었습니다. 관리자 승인 후 검색 Pool에 등록됩니다.');
    setTimeout(()=>{ krqResetForm(); }, 1200);
  } catch(e){
    showAuthStatus('krqStatus','error','제출에 실패했습니다: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}
async function loadMyKeywordRequests(){
  const box = document.getElementById('krqHistoryList'); if(!box) return;
  box.innerHTML = '<div class="card" style="text-align:center;color:var(--muted);padding:24px">불러오는 중...</div>';
  const { data, error } = await _sb.from('keyword_requests').select('*').eq('user_id', currentUserId).order('created_at', {ascending:false});
  if(error){
    box.innerHTML = `<div class="card" style="text-align:center;color:var(--red);padding:24px">오류: ${error.message}</div>`;
    return;
  }
  renderMyKeywordRequests(data || []);
}
function krqStatusBadge(status){
  if(status==='approved') return '<span class="badge green">승인됨</span>';
  if(status==='rejected') return '<span class="badge red">반려됨</span>';
  return '<span class="badge orange">대기중</span>';
}
function krqDetailLine(r){
  if(r.category === 'core'){
    const parts = [r.d1, r.d2, r.d3].filter(Boolean);
    return parts.length ? `뎁스: ${esc(parts.join(' > '))}` : '뎁스 미지정 (관리자 검토 예정)';
  }
  return r.ext_type ? `구분: ${esc(KRQ_EXT_TYPE_LABEL[r.ext_type] || r.ext_type)}` : '구분 미지정 (관리자 검토 예정)';
}
function renderMyKeywordRequests(list){
  const box = document.getElementById('krqHistoryList'); if(!box) return;
  box.innerHTML = list.length ? list.map(r=>`
    <div class="list-item" style="cursor:default;flex-direction:column;align-items:stretch;gap:6px">
      <div style="display:flex;align-items:flex-start;gap:8px">
        ${krqStatusBadge(r.status)}
        <span class="badge" style="background:var(--soft);color:var(--primary2)">${esc(KRQ_CATEGORY_LABEL[r.category]||r.category)}</span>
        <b style="flex:1">${esc(r.keyword)}</b>
        <span style="color:var(--muted);font-size:12px;white-space:nowrap">${esc((r.created_at||'').slice(0,10))}</span>
      </div>
      <p style="margin:0;color:var(--muted);font-size:12.5px">${krqDetailLine(r)}</p>
      ${r.note ? `<p style="margin:0;color:#334155;font-size:13px;white-space:pre-line">메모: ${esc(r.note)}</p>` : ''}
      ${r.status==='rejected' && r.admin_note ? `<div style="background:var(--redSoft);border-radius:12px;padding:10px 12px;margin-top:2px">
        <p style="margin:0;font-size:12px;font-weight:900;color:var(--red)">반려 사유</p>
        <p style="margin:2px 0 0;white-space:pre-line;font-size:13px">${esc(r.admin_note)}</p>
      </div>` : ''}
    </div>`).join('') : '<div class="empty-state"><h3>신청한 키워드가 없어요</h3></div>';
}
