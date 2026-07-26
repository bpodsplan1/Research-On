// ══════════════════════════════════════════
// 계정 설정 — 프로필 표시/수정
// ══════════════════════════════════════════
function renderAccountPage(){
  // 페이지에 들어올 때마다 수정 모드는 항상 초기화(보기 모드)
  profileEditing = false;
  setProfileEditUI(false);
  renderProfileDisplay();
}
function renderProfileDisplay(){
  $('#profileNameStatic').textContent = currentUserProfile.name || '—';
  $('#profileDeptStatic').textContent = currentUserProfile.affiliation || '—';
  $('#profilePositionStatic').textContent = currentUserProfile.position || '—';
  $('#profileEmailStatic').textContent = currentUserProfile.email || '—';
}
function setProfileEditUI(editing){
  $$('.profile-static[data-field]').forEach(el=>el.style.display = editing ? 'none' : 'block');
  $$('.profile-input[data-field]').forEach(el=>el.style.display = editing ? 'block' : 'none');
  const btn = $('#profileEditBtn');
  if(btn){ btn.textContent = editing ? '저장' : '수정'; btn.classList.toggle('dark', editing); btn.classList.toggle('line', !editing); }
}
async function handleProfileEditClick(){
  if(!profileEditing){
    // 보기 → 수정 모드 전환: 현재 값을 드롭다운에 채워넣는다 (이름·이메일은 항상 읽기전용이라 건드리지 않음)
    $('#acctDept').value = currentUserProfile.affiliation || '';
    $('#acctPosition').value = currentUserProfile.position || '';
    updateDeptPathPreview('acctDept','acctDept-preview');
    profileEditing = true;
    setProfileEditUI(true);
    return;
  }
  // 수정 → 저장
  const dept = $('#acctDept').value;
  const position = $('#acctPosition').value;
  if(!dept){ showToast('부서를 선택해주세요.'); return; }
  const btn = $('#profileEditBtn'); btn.disabled = true;
  try{
    const { error } = await _sb.from('profiles').update({ affiliation: dept, position }).eq('id', currentUserId);
    if(error) throw error;
    currentUserProfile.affiliation = dept;
    currentUserProfile.position = position;
    renderProfileDisplay();
    profileEditing = false;
    setProfileEditUI(false);
    showToast('프로필이 저장되었습니다.');
  } catch(e){
    showToast('저장에 실패했습니다: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════
// 계정 설정 — 로그인 및 보안(비밀번호 변경)
// ══════════════════════════════════════════
function checkPwStrength(){
  const el = $('#pwNew'); if(!el) return;
  const val = el.value;
  if(!val){ el.style.borderColor=''; return; }
  const hasNum = /[0-9]/.test(val);
  const hasSpecial = /[^A-Za-z0-9가-힣]/.test(val);
  el.style.borderColor = (hasNum && hasSpecial) ? 'var(--green)' : 'var(--red)';
}
async function handlePasswordChange(){
  const cur = $('#pwCurrent').value;
  const next = $('#pwNew').value;
  const confirmPw = $('#pwConfirm').value;
  if(!cur || !next || !confirmPw){ showAuthStatus('pwStatus','error','모든 항목을 입력해주세요.'); return; }
  if(next.length < 8){ showAuthStatus('pwStatus','error','새 비밀번호는 8자 이상이어야 합니다.'); return; }
  const hasNum = /[0-9]/.test(next);
  const hasSpecial = /[^A-Za-z0-9가-힣]/.test(next);
  if(!hasNum || !hasSpecial){ showAuthStatus('pwStatus','error','새 비밀번호는 숫자와 특수문자를 모두 포함해야 합니다.'); return; }
  if(next !== confirmPw){ showAuthStatus('pwStatus','error','새 비밀번호가 서로 일치하지 않습니다.'); return; }
  if(next === cur){ showAuthStatus('pwStatus','error','현재 사용 중인 비밀번호와 동일하게는 설정할 수 없습니다.'); return; }
  const btn = $('#pwChangeBtn'); btn.disabled = true;
  showAuthStatus('pwStatus','loading','변경 중...');
  try{
    const { error: signInErr } = await _sb.auth.signInWithPassword({ email: currentUserEmail, password: cur });
    if(signInErr) throw new Error('현재 비밀번호가 올바르지 않습니다.');
    const { error: updateErr } = await _sb.auth.updateUser({ password: next });
    if(updateErr) throw updateErr;
    showAuthStatus('pwStatus','success','비밀번호가 변경되었습니다.');
    $('#pwCurrent').value=''; $('#pwNew').value=''; $('#pwConfirm').value='';
    $('#pwNew').style.borderColor='';
  } catch(e){
    showAuthStatus('pwStatus','error', e.message);
  } finally {
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════
// 계정 설정 — 지원 및 문의 모달
// ══════════════════════════════════════════
const SUPPORT_TITLES = { account:'계정 관련 문의', bug:'오류 신고' };
let currentSupportType = 'account';
function openSupportModal(type){
  currentSupportType = type;
  $('#supportModalTitle').textContent = SUPPORT_TITLES[type] || '문의하기';
  $('#supportTitleInput').value = '';
  $('#supportContentInput').value = '';
  $('#supportModalStatus').className = 'auth-status';
  $('#supportModalStatus').textContent = '';
  $('#supportModalOverlay').classList.add('open');
}
function closeSupportModal(){ $('#supportModalOverlay')?.classList.remove('open'); }
async function submitSupportRequest(){
  const title = $('#supportTitleInput').value.trim();
  const content = $('#supportContentInput').value.trim();
  if(!title || !content){ showAuthStatus('supportModalStatus','error','제목과 내용을 모두 입력해주세요.'); return; }
  const btn = $('#supportSubmitBtn'); btn.disabled = true;
  showAuthStatus('supportModalStatus','loading','제출 중...');
  try{
    const { error } = await _sb.from('support_requests').insert({
      user_id: currentUserId, type: currentSupportType, title, content,
      requester_name: currentUserProfile.name, requester_email: currentUserEmail
    });
    if(error) throw error;
    showAuthStatus('supportModalStatus','success','접수되었습니다. 확인 후 조치하겠습니다.');
    setTimeout(closeSupportModal, 1200);
  } catch(e){
    showAuthStatus('supportModalStatus','error','제출에 실패했습니다: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}
async function openSupportHistoryModal(type){
  $('#supportHistoryModalTitle').textContent = (SUPPORT_TITLES[type] || '문의') + ' 내역';
  $('#supportHistoryList').innerHTML = '<div class="card" style="text-align:center;color:var(--muted);padding:24px">불러오는 중...</div>';
  $('#supportHistoryModalOverlay').classList.add('open');
  const { data, error } = await _sb.from('support_requests').select('*').eq('user_id', currentUserId).eq('type', type).order('created_at', {ascending:false});
  if(error){
    $('#supportHistoryList').innerHTML = `<div class="card" style="text-align:center;color:var(--red);padding:24px">오류: ${error.message}</div>`;
    return;
  }
  renderSupportHistoryList(data || []);
}
function closeSupportHistoryModal(){ $('#supportHistoryModalOverlay')?.classList.remove('open'); }
function renderSupportHistoryList(list){
  $('#supportHistoryList').innerHTML = list.length ? list.map(r=>{
    const resolved = r.status === 'resolved';
    const replyText = resolved
      ? (r.admin_reply && r.admin_reply.trim()
          ? esc(r.admin_reply)
          : '관리자가 답변을 남기지 않고 처리 완료하였습니다. 추가 문의 또는 요청 사항이 있을 경우 다시 작성해 주시기를 바랍니다.')
      : '';
    return `<div class="list-item" style="cursor:default;flex-direction:column;align-items:stretch;gap:8px">
      <div style="display:flex;align-items:flex-start;gap:8px">
        <span class="badge ${resolved?'green':'orange'}">${resolved?'답변 완료':'접수됨'}</span>
        <b style="flex:1">${esc(r.title||'(제목 없음)')}</b>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
          <span style="color:var(--muted);font-size:12px;white-space:nowrap">${esc((r.created_at||'').slice(0,10))}</span>
          ${resolved
            ? `<button class="btn line" type="button" disabled style="min-height:28px;padding:0 10px;font-size:12px;opacity:.45;cursor:not-allowed">삭제 불가</button>`
            : `<button class="btn line" type="button" style="min-height:28px;padding:0 10px;font-size:12px;color:var(--red);border-color:var(--red)" onclick="handleDeleteSupportRequest('${r.id}')">삭제</button>`}
        </div>
      </div>
      <p style="white-space:pre-line;margin:0;color:#334155">${esc(r.content||'')}</p>
      ${resolved ? `<div style="background:var(--soft);border-radius:12px;padding:10px 12px;margin-top:4px">
        <p style="margin:0 0 4px;font-size:12px;font-weight:900;color:var(--primary2)">관리자 답변</p>
        <p style="margin:0;white-space:pre-line${r.admin_reply && r.admin_reply.trim() ? '' : ';color:var(--muted);font-style:italic'}">${replyText}</p>
      </div>` : ''}
    </div>`;
  }).join('') : '<div class="empty-state"><h3>제출한 내역이 없어요</h3></div>';
}
async function handleDeleteSupportRequest(id){
  if(!confirm('이 문의 내역을 삭제하시겠습니까?')) return;
  try{
    const { error } = await _sb.from('support_requests').delete().eq('id', id).eq('user_id', currentUserId);
    if(error) throw error;
    openSupportHistoryModal(currentSupportType);
  } catch(e){
    alert('삭제에 실패했습니다: ' + e.message);
  }
}
function openInfoModal(type){
  $('#infoModalTitle').textContent = type==='privacy' ? '개인정보 처리방침' : '이용 가이드';
  $('#infoGuideBody').style.display = type==='guide' ? 'block' : 'none';
  $('#infoPrivacyBody').style.display = type==='privacy' ? 'block' : 'none';
  $('#infoModalOverlay').classList.add('open');
}
function closeInfoModal(){ $('#infoModalOverlay')?.classList.remove('open'); }

// handleLogout()은 하단 Supabase 인증 스크립트에서 정의됩니다.

