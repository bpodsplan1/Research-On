// ── Auth 유틸 ──
function showAuthStatus(id, type, msg){
  const el = document.getElementById(id); if(!el) return;
  el.className = 'auth-status ' + type; el.textContent = msg;
}
function clearAuthStatus(){
  document.getElementById('login-status').className  = 'auth-status';
  document.getElementById('signup-status').className = 'auth-status';
}
function switchAuthTab(tab){
  ['login','signup'].forEach(t=>{
    document.getElementById('panel-'+t).classList.toggle('active', t===tab);
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
  clearAuthStatus();
}

// ── 로그인 ──
async function handleLogin(){
  const userId = document.getElementById('login-id').value.trim();
  const pw     = document.getElementById('login-pw').value;
  if(!userId||!pw){ showAuthStatus('login-status','error','ID와 비밀번호를 입력해주세요.'); return; }
  const btn = document.getElementById('login-btn');
  btn.disabled = true; showAuthStatus('login-status','loading','로그인 중...');
  try{
    const { data:profile, error:profileErr } = await _sb.from('profiles').select('email').eq('user_id',userId).maybeSingle();
    if(profileErr) throw new Error('프로필 조회 실패: '+profileErr.message);
    if(!profile)   throw new Error('존재하지 않는 ID입니다.');
    const { data:authData, error:authErr } = await _sb.auth.signInWithPassword({ email:profile.email, password:pw });
    if(authErr) throw new Error('비밀번호가 올바르지 않습니다.');
    await enterApp(authData.user);
  } catch(e){
    showAuthStatus('login-status','error',e.message); btn.disabled=false;
  }
}

// ── 회원가입 ──
async function handleSignup(){
  const affiliation = document.getElementById('signup-affiliation').value;
  const position = document.getElementById('signup-position').value;
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const userId= document.getElementById('signup-id').value.trim();
  const pw    = document.getElementById('signup-pw').value;
  if(!affiliation||!name||!email||!userId||!pw){ showAuthStatus('signup-status','error','모든 항목을 입력해주세요.'); return; }
  if(!email.endsWith('@etners.com')){ showAuthStatus('signup-status','error','@etners.com 도메인 이메일만 가입 가능합니다.'); return; }
  if(!/^[a-zA-Z0-9]{4,}$/.test(userId)){ showAuthStatus('signup-status','error','ID는 영문/숫자 4자 이상이어야 합니다.'); return; }
  if(pw.length<8){ showAuthStatus('signup-status','error','비밀번호는 8자 이상이어야 합니다.'); return; }
  const btn = document.getElementById('signup-btn');
  btn.disabled=true; showAuthStatus('signup-status','loading','처리 중...');
  try{
    const { data:existId, error:idErr } = await _sb.from('profiles').select('user_id').eq('user_id',userId).maybeSingle();
    if(idErr)   throw new Error('중복 확인 오류: '+idErr.message);
    if(existId) throw new Error('이미 사용 중인 ID입니다.');
    const { data:existEmail, error:emailErr } = await _sb.from('profiles').select('email').eq('email',email).maybeSingle();
    if(emailErr)    throw new Error('중복 확인 오류: '+emailErr.message);
    if(existEmail)  throw new Error('이미 가입된 이메일입니다.');
    const { data:authData, error:authErr } = await _sb.auth.signUp({ email, password:pw });
    if(authErr)        throw new Error('계정 생성 실패: '+authErr.message);
    if(!authData.user) throw new Error('계정 생성에 실패했습니다. 다시 시도해주세요.');
    const { error:insertErr } = await _sb.from('profiles').insert({ id:authData.user.id, email, name, affiliation, position, user_id:userId, role:'user' });
    if(insertErr) throw new Error('프로필 저장 실패: '+insertErr.message);
    showAuthStatus('signup-status','success','회원가입 완료! 로그인해주세요.');
    setTimeout(()=>switchAuthTab('login'), 1500);
  } catch(e){
    showAuthStatus('signup-status','error',e.message); btn.disabled=false;
  }
}

// ── 앱 진입 ──
async function enterApp(user){
  try{
    const { data:profile, error } = await _sb.from('profiles').select('*').eq('id',user.id).single();
    if(error) throw new Error(error.message);
    const name        = profile.name        || user.email.split('@')[0];
    const affiliation = profile.affiliation || '';
    const role        = profile.role        || 'user';
    const roleLabel   = affiliation + ' · ' + (role==='admin' ? 'Admin' : 'Standard');
    currentUserEmail = profile.email || user.email || '';
    currentUserRole  = role;
    currentUserId    = user.id;
    currentUserProfile = { name, affiliation, position: profile.position || '', email: currentUserEmail };
    // 사이드바 상단 환영 문구
    const sidebarNameEl = document.getElementById('sidebarUserName');
    if(sidebarNameEl) sidebarNameEl.textContent = name;
    // 계정 설정 페이지(프로필 읽기전용 표시) 동기화
    renderProfileDisplay();
    // 역할별 사이드바 분기
    const navReqSection = document.getElementById('nav-section-account-request');
    if(role==='admin'){
      showAdminNav();
      if(navReqSection) navReqSection.style.display='none';
    } else {
      if(navReqSection) navReqSection.style.display='';
      loadMyRequestStatus(profile.user_id);
    }
    // 오버레이 숨기기
    document.getElementById('auth-overlay').classList.add('hidden');
    // 사용자 데이터 로드 (내부에서 상태 초기화 → 새 계정 데이터 로드 → 전체 페이지 재렌더링)
    await loadUserData();
  } catch(e){
    await _sb.auth.signOut();
    showAuthStatus('login-status','error','프로필 정보를 불러올 수 없습니다: '+e.message);
  }
}

// ── 로그아웃 ──
async function handleLogout(){
  await _sb.auth.signOut();
  // 페이지 전체 새로고침 → 빌더 선택 상태, 검색 결과, 모든 메모리 변수가 100% 초기화됨
  // 새로고침 후 세션이 없으므로 로그인 오버레이가 표시됨
  location.reload();
}

// ── 관리자 메뉴 ──
// ── 사이드바 접기/펼치기 (PC 전용) ──
let sidebarCollapsed = localStorage.getItem('ro_sidebar_collapsed') === '1';
function applySidebarCollapsed(){
  const isMobile = window.innerWidth<=840;
  document.querySelector('.app')?.classList.toggle('sidebar-collapsed', sidebarCollapsed && !isMobile);
  document.getElementById('sidebar')?.classList.toggle('collapsed', sidebarCollapsed && !isMobile);
  const icon = document.getElementById('sidebarToggleIcon');
  if(icon) icon.textContent = isMobile ? '✕' : (sidebarCollapsed ? '▶' : '◀');
}
function toggleSidebarCollapsed(){
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem('ro_sidebar_collapsed', sidebarCollapsed ? '1' : '0');
  applySidebarCollapsed();
  const tip = document.getElementById('sidebarTooltip'); if(tip) tip.style.display='none';
}
// 접힌 상태에서 아이콘에 마우스를 올렸을 때 보여줄 메뉴명을 각 버튼의 텍스트에서 추출해둔다.
function initNavTooltips(){
  const tip = document.getElementById('sidebarTooltip');
  document.querySelectorAll('.nav-item[data-page]').forEach(btn=>{
    if(!btn.dataset.tooltip){
      const labelEl = btn.querySelector('.nav-label');
      btn.setAttribute('data-tooltip', labelEl ? labelEl.textContent.trim() : btn.textContent.trim());
    }
    if(btn.dataset.tooltipBound) return;
    btn.dataset.tooltipBound = '1';
    btn.addEventListener('mouseenter', ()=>{
      if(!sidebarCollapsed || !tip) return;
      const rect = btn.getBoundingClientRect();
      tip.textContent = btn.dataset.tooltip;
      tip.style.top = (rect.top + rect.height/2) + 'px';
      tip.style.left = (rect.right + 12) + 'px';
      tip.style.transform = 'translateY(-50%)';
      tip.style.display = 'block';
    });
    btn.addEventListener('mouseleave', ()=>{ if(tip) tip.style.display='none'; });
  });
}

function showAdminNav(){
  if(document.getElementById('admin-nav')) return;
  const nav = document.querySelector('.sidebar nav'); if(!nav) return;
  const sec = document.createElement('div');
  sec.id='admin-nav'; sec.className='nav-section';
  sec.innerHTML=`<div class="nav-title" style="color:#2563eb">관리자 메뉴</div>
    <button class="nav-item" data-page="admin-approve" type="button"><span class="nav-icon">👥</span><span class="nav-label">계정 관리</span></button>
    <button class="nav-item" data-page="newsletter-manage" type="button"><span class="nav-icon">📰</span><span class="nav-label">뉴스레터 관리</span></button>
    <button class="nav-item" data-page="newsletter-subscribers" type="button"><span class="nav-icon">📬</span><span class="nav-label">뉴스레터 구독 관리</span></button>`;
  nav.appendChild(sec);
  sec.querySelectorAll('.nav-item[data-page]').forEach(btn=>{
    btn.addEventListener('click',()=>showPage(btn.dataset.page));
  });
  initNavTooltips();
  loadAdminRequests();
}

// ── 관리자 권한 신청 ──
async function handleAdminRequest(){
  const btn = document.getElementById('admin-request-btn');
  const statusEl = document.getElementById('admin-request-status');
  btn.disabled=true; statusEl.className='auth-status loading'; statusEl.style.display='block'; statusEl.textContent='신청 중...';
  try{
    const { data:{ session } } = await _sb.auth.getSession();
    if(!session?.user) throw new Error('로그인 상태를 확인해주세요.');
    const { data:profile, error:profileErr } = await _sb.from('profiles').select('*').eq('id',session.user.id).single();
    if(profileErr) throw new Error('프로필 조회 실패: '+profileErr.message);
    if(profile.role==='admin') throw new Error('이미 관리자 계정입니다.');
    const { data:existing, error:existErr } = await _sb.from('admin_requests').select('id').eq('user_id',profile.user_id).maybeSingle();
    if(existErr)  throw new Error('중복 확인 오류: '+existErr.message);
    if(existing)  throw new Error('이미 신청한 내역이 있습니다. 관리자 검토를 기다려주세요.');
    const { error:insertErr } = await _sb.from('admin_requests').insert({ user_id:profile.user_id, email:profile.email, name:profile.name, affiliation:profile.affiliation });
    if(insertErr) throw new Error('신청 저장 실패: '+insertErr.message);
    statusEl.className='auth-status success'; statusEl.textContent='✅ 관리자 권한 신청이 완료되었습니다.';
    btn.textContent='신청 완료';
    loadMyRequestStatus(profile.user_id);
  } catch(e){
    statusEl.className='auth-status error'; statusEl.textContent=e.message; btn.disabled=false;
  }
}

// ── 내 신청 현황 ──
async function loadMyRequestStatus(userId){
  const el = document.getElementById('my-request-status'); if(!el) return;
  const { data, error } = await _sb.from('admin_requests').select('*').eq('user_id',userId).maybeSingle();
  if(error||!data){ el.innerHTML='<div class="empty-state"><h3>신청 내역 없음</h3><p>아직 관리자 권한 신청 내역이 없습니다.</p></div>'; return; }
  const badge = data.status==='approved'?'<span class="badge green">승인됨</span>':data.status==='rejected'?'<span class="badge red">거절됨</span>':'<span class="badge orange">검토 중</span>';
  const date = new Date(data.requested_at).toLocaleString('ko-KR');
  el.innerHTML=`<div class="list-item"><div class="list-icon">🔐</div><div><h4>관리자 권한 신청 ${badge}</h4><p>신청일시: ${date}</p><p style="margin-top:4px">소속: ${data.affiliation} · ID: ${data.user_id}</p></div></div>`;
}

// ── 관리자: 대기 중인 신청 목록 ──
async function loadAdminRequests(){
  const tbody = document.getElementById('admin-requests-tbody'); if(!tbody) return;
  const card = document.getElementById('pendingAdminRequestsCard');
  const { data, error } = await _sb.from('admin_requests').select('*').or('status.is.null,status.eq.pending').order('requested_at',{ascending:false});
  if(error || !data || !data.length){ if(card) card.style.display='none'; return; }
  if(card) card.style.display='block';
  tbody.innerHTML = data.map(req=>{
    const date = new Date(req.requested_at).toLocaleString('ko-KR');
    return `<tr><td style="font-size:13px;color:var(--muted)">${date}</td><td><b>${req.name}</b></td><td>${req.affiliation}</td><td><code style="background:#f1f5f9;padding:2px 7px;border-radius:6px;font-size:13px">${req.user_id}</code></td><td style="font-size:13px">${req.email}</td><td><div style="display:flex;gap:6px"><button class="btn green" style="min-height:34px;padding:0 12px;font-size:13px" onclick="handleApprove('${req.id}','${req.user_id}')">승인</button><button class="btn red" style="min-height:34px;padding:0 12px;font-size:13px" onclick="handleReject('${req.id}')">거절</button></div></td></tr>`;
  }).join('');
}

// ── 관리자: 승인 ──
async function handleApprove(requestId, userId){
  if(!confirm('이 계정을 관리자로 승인하시겠습니까?')) return;
  try{
    const { error:e1 } = await _sb.from('profiles').update({role:'admin'}).eq('user_id',userId);
    if(e1) throw new Error(e1.message);
    const { error:e2 } = await _sb.from('admin_requests').update({status:'approved'}).eq('id',requestId);
    if(e2) throw new Error(e2.message);
    alert('✅ 승인 완료되었습니다.'); loadAdminRequests(); loadAllAccounts();
  } catch(e){ alert('오류: '+e.message); }
}

// ── 관리자: 거절 ──
async function handleReject(requestId){
  if(!confirm('이 신청을 거절하시겠습니까?')) return;
  try{
    const { error } = await _sb.from('admin_requests').update({status:'rejected'}).eq('id',requestId);
    if(error) throw new Error(error.message);
    alert('거절 처리되었습니다.'); loadAdminRequests();
  } catch(e){ alert('오류: '+e.message); }
}

