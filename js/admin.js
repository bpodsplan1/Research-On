// ══════════════════════════════════════════
// 관리자: 계정 관리 (전체 계정 목록)
// ══════════════════════════════════════════
let allAccountsCache = [];
let acctFilterMode = 'all';
async function loadAllAccounts(){
  const tbody = document.getElementById('acctMgmtTbody'); if(!tbody) return;
  const cardsWrap = document.getElementById('acctMgmtCards');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">불러오는 중...</td></tr>';
  if(cardsWrap) cardsWrap.innerHTML = '<div class="card" style="text-align:center;color:var(--muted);padding:30px">불러오는 중...</div>';
  const { data, error } = await _sb.from('profiles').select('*').order('name');
  if(error){
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);padding:30px">오류: ${error.message}</td></tr>`;
    if(cardsWrap) cardsWrap.innerHTML = `<div class="card" style="text-align:center;color:var(--red);padding:30px">오류: ${error.message}</div>`;
    return;
  }
  allAccountsCache = data || [];
  renderAccountsTable(allAccountsCache);
}
function renderAccountsTable(list){
  const cardsWrap = document.getElementById('acctMgmtCards');
  const tbody = document.getElementById('acctMgmtTbody'); if(!tbody) return;
  if(!list.length){
    if(cardsWrap) cardsWrap.innerHTML = '<div class="card" style="text-align:center;color:var(--muted);padding:30px">계정이 없습니다.</div>';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">계정이 없습니다.</td></tr>';
    return;
  }
  const rows = list.map((p,i)=>{
    const roleBadge = p.role==='admin' ? '<span class="badge blue">관리자</span>' : '<span class="badge gray">사용자</span>';
    const safeName = (p.name||'').replace(/'/g,"\\'");
    return { i, p, roleBadge, safeName };
  });

  if(cardsWrap){
    cardsWrap.innerHTML = rows.map(({p,roleBadge,safeName})=>`
      <div class="result-card">
        <div class="result-card-head">
          <div class="result-card-title"><span>${p.name||'-'}</span>${roleBadge}</div>
        </div>
        <div style="color:var(--muted);font-size:13px;margin:8px 0 2px"><code style="background:#f1f5f9;padding:2px 7px;border-radius:6px;font-size:12px">${p.user_id||'-'}</code></div>
        <div style="color:var(--muted);font-size:13px;margin-bottom:10px">${p.email||'-'}</div>
        <div class="result-card-actions">
          <button class="btn line" type="button" onclick="handleRoleChange('${p.id}','${p.role==='admin'?'user':'admin'}','${safeName}')">권한 변경</button>
          <button class="btn line" type="button" onclick="handlePwReset('${p.id}','${p.email}','${safeName}')">비밀번호 초기화</button>
          <button class="btn red" type="button" onclick="handleDeleteAccount('${p.id}','${safeName}')">삭제</button>
        </div>
      </div>
    `).join('');
  }

  tbody.innerHTML = rows.map(({i,p,roleBadge,safeName})=>`<tr>
      <td>${i+1}</td>
      <td><code style="background:#f1f5f9;padding:2px 7px;border-radius:6px;font-size:13px">${p.user_id||'-'}</code></td>
      <td><b>${p.name||'-'}</b></td>
      <td>${roleBadge}</td>
      <td style="font-size:13px">${p.email||'-'}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn line" style="min-height:32px;padding:0 10px;font-size:12.5px" onclick="handleRoleChange('${p.id}','${p.role==='admin'?'user':'admin'}','${safeName}')">권한 변경</button>
          <button class="btn line" style="min-height:32px;padding:0 10px;font-size:12.5px" onclick="handlePwReset('${p.id}','${p.email}','${safeName}')">비밀번호 초기화</button>
          <button class="btn red" style="min-height:32px;padding:0 10px;font-size:12.5px" onclick="handleDeleteAccount('${p.id}','${safeName}')">삭제</button>
        </div>
      </td>
    </tr>`).join('');
}
function filterAccountsTable(){
  const q = ($('#acctMgmtSearch')?.value || '').trim().toLowerCase();
  let list = allAccountsCache;
  if(acctFilterMode==='user') list = list.filter(p => p.role!=='admin');
  else if(acctFilterMode==='admin') list = list.filter(p => p.role==='admin');
  if(q){
    list = list.filter(p =>
      (p.user_id||'').toLowerCase().includes(q) ||
      (p.name||'').toLowerCase().includes(q) ||
      (p.email||'').toLowerCase().includes(q)
    );
  }
  renderAccountsTable(list);
}
async function handleRoleChange(id, newRole, name){
  const label = newRole==='admin' ? '관리자' : '사용자';
  if(!confirm(`${name}님의 권한을 "${label}"(으)로 변경하시겠습니까?`)) return;
  try{
    const { error } = await _sb.from('profiles').update({ role:newRole }).eq('id', id);
    if(error) throw error;
    showToast('권한이 변경되었습니다.');
    loadAllAccounts();
  } catch(e){ alert('오류: ' + e.message); }
}
async function handlePwReset(id, email, name){
  if(!id){ alert('계정 id 정보가 없습니다.'); return; }
  if(!confirm(`${name||email}님의 비밀번호를 기본 비밀번호(dlxmsjtm1!)로 초기화하시겠습니까?`)) return;
  // profiles 테이블에는 비밀번호가 저장되어 있지 않습니다 — 실제 로그인 비밀번호는
  // Supabase Auth(auth.users)가 별도로 관리하며, 클라이언트(anon key)로는 "본인 것"만 바꿀 수 있고
  // 관리자가 "다른 사람의" 비밀번호를 직접 지정하려면 service role key가 필요합니다.
  // service role key는 프론트엔드에 절대 넣으면 안 되므로, service role key(Supabase apikey 헤더)를
  // 보관하는 n8n 웹훅에서 auth.admin.updateUserById(id, {password:'dlxmsjtm1!'})를 호출합니다.
  // (n8n 워크플로우: [Research On] 관리자 - 계정 비밀번호 초기화)
  try{
    const resp = await fetch(N8N_ADMIN_RESET_PW_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ user_id:id, email, admin_token:ADMIN_ACTION_TOKEN })
    });
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok || data.success===false) throw new Error(data.message || 'n8n 응답 오류');
    showToast(data.message || '비밀번호가 초기화되었습니다.');
  } catch(e){
    alert('비밀번호 초기화에 실패했습니다: ' + e.message + '\n(n8n 워크플로우가 활성화되어 있는지, Supabase 서비스 키 자격증명이 설정되어 있는지 확인해주세요.)');
  }
}
async function handleDeleteAccount(id, name){
  if(!confirm(`${name}님의 계정을 삭제하시겠습니까?\n(프로필 정보가 삭제되어 더 이상 로그인할 수 없게 됩니다. 이 작업은 되돌릴 수 없습니다.)`)) return;
  try{
    const { error } = await _sb.from('profiles').delete().eq('id', id);
    if(error) throw error;
    showToast('계정이 삭제되었습니다.');
    loadAllAccounts();
  } catch(e){ alert('오류: ' + e.message); }
}

// ── 관리자: 새 계정 발급 ──
function openCreateAccountModal(){
  $('#newAcctId').value = '';
  $('#newAcctName').value = '';
  $('#newAcctEmailLocal').value = '';
  $('#newAcctDept').value = '';
  $('#newAcctPosition').value = '';
  updateDeptPathPreview('newAcctDept','newAcctDept-preview');
  $('#newAcctRole').value = 'user';
  $('#newAcctPw').value = 'dlxmsjtm1!';
  $('#createAccountStatus').className = 'auth-status';
  $('#createAccountStatus').textContent = '';
  $('#createAccountModalOverlay').classList.add('open');
}
function closeCreateAccountModal(){ $('#createAccountModalOverlay')?.classList.remove('open'); }
async function submitCreateAccount(){
  const userId = $('#newAcctId').value.trim();
  const name = $('#newAcctName').value.trim();
  const emailLocal = $('#newAcctEmailLocal').value.trim();
  const email = emailLocal ? (emailLocal + '@' + $('#newAcctEmailDomain').value) : '';
  const dept = $('#newAcctDept').value;
  const position = $('#newAcctPosition').value;
  const role = $('#newAcctRole').value;
  const pw = $('#newAcctPw').value;
  if(!userId || !name || !emailLocal || !pw){ showAuthStatus('createAccountStatus','error','모든 항목을 입력해주세요.'); return; }
  if(!dept){ showAuthStatus('createAccountStatus','error','부서를 선택해주세요.'); return; }
  if(!/^[a-zA-Z0-9]{4,}$/.test(userId)){ showAuthStatus('createAccountStatus','error','아이디는 영문/숫자 4자 이상이어야 합니다.'); return; }
  if(pw.length < 8){ showAuthStatus('createAccountStatus','error','초기 비밀번호는 8자 이상이어야 합니다.'); return; }
  const btn = $('#createAccountSubmitBtn'); btn.disabled = true;
  showAuthStatus('createAccountStatus','loading','발급 중...');
  try{
    const { data:existId } = await _sb.from('profiles').select('user_id').eq('user_id',userId).maybeSingle();
    if(existId) throw new Error('이미 사용 중인 아이디입니다.');
    const { data:existEmail } = await _sb.from('profiles').select('email').eq('email',email).maybeSingle();
    if(existEmail) throw new Error('이미 가입된 이메일입니다.');
    // 관리자의 현재 로그인 세션을 건드리지 않는 격리된 클라이언트로 계정을 생성합니다.
    const { data:authData, error:authErr } = await _sbAdmin.auth.signUp({ email, password: pw });
    if(authErr) throw authErr;
    if(!authData.user) throw new Error('계정 생성에 실패했습니다.');
    const { error:insertErr } = await _sb.from('profiles').insert({ id:authData.user.id, email, name, user_id:userId, role, affiliation:dept, position });
    if(insertErr) throw insertErr;
    await _sbAdmin.auth.signOut(); // 격리 클라이언트 세션 정리 (관리자의 실제 세션과는 무관)
    showAuthStatus('createAccountStatus','success','계정이 발급되었습니다.');
    showToast(`${name}님 계정이 발급되었습니다.`);
    loadAllAccounts();
    setTimeout(closeCreateAccountModal, 1200);
  } catch(e){
    showAuthStatus('createAccountStatus','error', e.message);
  } finally {
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════
// 관리자: 뉴스레터 구독 관리
// ══════════════════════════════════════════
let allSubscribersCache = [];
async function loadNewsletterSubscribers(){
  const tbody = document.getElementById('nlSubMgmtTbody'); if(!tbody) return;
  const cardsWrap = document.getElementById('nlSubMgmtCards');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">불러오는 중...</td></tr>';
  if(cardsWrap) cardsWrap.innerHTML = '<div class="card" style="text-align:center;color:var(--muted);padding:30px">불러오는 중...</div>';
  const { data, error } = await _sb.from('profiles').select('*').eq('newsletter_subscribed', true).order('newsletter_subscribed_at', {ascending:false});
  if(error){
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);padding:30px">오류: ${error.message}</td></tr>`;
    if(cardsWrap) cardsWrap.innerHTML = `<div class="card" style="text-align:center;color:var(--red);padding:30px">오류: ${error.message}</div>`;
    return;
  }
  allSubscribersCache = data || [];
  renderSubscribersTable(allSubscribersCache);
}
function renderSubscribersTable(list){
  const cardsWrap = document.getElementById('nlSubMgmtCards');
  const tbody = document.getElementById('nlSubMgmtTbody');
  if(!tbody) return;
  if(!list.length){
    if(cardsWrap) cardsWrap.innerHTML = '<div class="card" style="text-align:center;color:var(--muted);padding:30px">구독 중인 계정이 없습니다.</div>';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">구독 중인 계정이 없습니다.</td></tr>';
    return;
  }
  const rows = list.map((p,i)=>{
    const date = p.newsletter_subscribed_at ? new Date(p.newsletter_subscribed_at).toLocaleDateString('ko-KR') : '-';
    let statusBadge;
    if(p.newsletter_paused) statusBadge = '<span class="badge orange">일시정지</span>';
    else if(p.newsletter_last_send_status==='success') statusBadge = '<span class="badge green">발송 성공</span>';
    else if(p.newsletter_last_send_status==='failed') statusBadge = '<span class="badge red">발송 실패</span>';
    else statusBadge = '<span class="badge gray">발송 이력 없음</span>';
    const safeName = (p.name||'').replace(/'/g,"\\'");
    const pauseLabel = p.newsletter_paused ? '정지 해제' : '일시 정지';
    return { i, p, date, statusBadge, safeName, pauseLabel };
  });

  if(cardsWrap){
    cardsWrap.innerHTML = rows.map(({i,p,date,statusBadge,safeName,pauseLabel})=>`
      <div class="result-card">
        <div class="result-card-head">
          <div class="result-card-title"><span>${p.name||'-'}</span>${statusBadge}</div>
        </div>
        <div style="color:var(--muted);font-size:13px;margin:8px 0 2px">${p.email||'-'}</div>
        <div style="color:var(--muted);font-size:12px;margin-bottom:10px">구독일 ${date}</div>
        <div class="result-card-actions">
          <button class="btn line" type="button" onclick="handleForceSend('${p.email}','${safeName}')">뉴스레터 발송</button>
          <button class="btn line" type="button" onclick="handleTogglePause('${p.id}',${!p.newsletter_paused},'${safeName}')">${pauseLabel}</button>
          <button class="btn red" type="button" onclick="handleAdminUnsubscribe('${p.id}','${safeName}')">구독 취소</button>
        </div>
      </div>
    `).join('');
  }

  tbody.innerHTML = rows.map(({i,p,date,statusBadge,safeName,pauseLabel})=>`<tr>
      <td>${i+1}</td>
      <td><b>${p.name||'-'}</b></td>
      <td style="font-size:13px">${p.email||'-'}</td>
      <td style="font-size:13px;color:var(--muted)">${date}</td>
      <td>${statusBadge}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn line" style="min-height:32px;padding:0 10px;font-size:12.5px" onclick="handleForceSend('${p.email}','${safeName}')">뉴스레터 발송</button>
          <button class="btn line" style="min-height:32px;padding:0 10px;font-size:12.5px" onclick="handleTogglePause('${p.id}',${!p.newsletter_paused},'${safeName}')">${pauseLabel}</button>
          <button class="btn red" style="min-height:32px;padding:0 10px;font-size:12.5px" onclick="handleAdminUnsubscribe('${p.id}','${safeName}')">구독 취소</button>
        </div>
      </td>
    </tr>`).join('');
}
function filterSubscribersTable(){
  const q = ($('#nlSubMgmtSearch')?.value || '').trim().toLowerCase();
  if(!q){ renderSubscribersTable(allSubscribersCache); return; }
  const filtered = allSubscribersCache.filter(p =>
    (p.name||'').toLowerCase().includes(q) || (p.email||'').toLowerCase().includes(q)
  );
  renderSubscribersTable(filtered);
}
async function handleForceSend(email, name){
  if(!confirm(`${name}님(${email})에게 최신 뉴스레터를 즉시 발송하시겠습니까?`)) return;
  // 최근 발송(SENT) 이력이 있으면 그중 가장 최근 호를, 없으면 예약(QUEUED) 중인 가장 최근 호를
  // 골라 해당 구독자 1인에게 즉시 재발송합니다.
  // (n8n 워크플로우: [Research On] 뉴스레터 - 2단계, D0~D6 "개별 구독자 강제 발송" 분기)
  try{
    const resp = await fetch(N8N_NEWSLETTER_FORCE_SEND_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email, name, admin_token:ADMIN_ACTION_TOKEN })
    });
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok || data.success===false) throw new Error(data.message || 'n8n 응답 오류');
    showToast(data.message || '뉴스레터를 발송했습니다.');
  } catch(e){
    alert('뉴스레터 발송에 실패했습니다: ' + e.message + '\n(n8n 워크플로우가 활성화되어 있는지 확인해주세요.)');
  }
}
async function handleTogglePause(id, pause, name){
  const label = pause ? '일시 정지' : '정지 해제';
  if(!confirm(`${name}님의 뉴스레터 수신을 ${label}하시겠습니까?`)) return;
  try{
    const { error } = await _sb.from('profiles').update({ newsletter_paused: pause }).eq('id', id);
    if(error) throw error;
    showToast(`${label}되었습니다.`);
    loadNewsletterSubscribers();
  } catch(e){ alert('오류: ' + e.message); }
}
async function handleAdminUnsubscribe(id, name){
  if(!confirm(`${name}님의 뉴스레터 구독을 취소하시겠습니까?`)) return;
  try{
    const { error } = await _sb.from('profiles').update({ newsletter_subscribed: false }).eq('id', id);
    if(error) throw error;
    showToast('구독이 취소되었습니다.');
    loadNewsletterSubscribers();
  } catch(e){ alert('오류: ' + e.message); }
}

// ── 세션 복원 ──
(async function restoreSession(){
  const { data:{ session } } = await _sb.auth.getSession();
  if(session?.user) await enterApp(session.user);
})();

// ── 세션 변화 감지 (다른 탭에서 로그아웃 시에도 완전 초기화) ──
_sb.auth.onAuthStateChange((event)=>{
  if(event === 'SIGNED_OUT'){
    // 앱에 진입한 상태에서 로그아웃이 감지되면 새로고침으로 완전 초기화
    const overlay = document.getElementById('auth-overlay');
    if(overlay && overlay.classList.contains('hidden')){
      location.reload();
    }
  }
});

// ── 엔터키 ──
document.addEventListener('keydown', e=>{
  if(e.key!=='Enter') return;
  const overlay = document.getElementById('auth-overlay');
  if(!overlay||overlay.classList.contains('hidden')) return;
  if(document.getElementById('panel-login').classList.contains('active')) handleLogin();
  else handleSignup();
});
