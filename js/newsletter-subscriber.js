// ══════════════════════════════════════════
// 뉴스레터 (목록/상세보기, 구독 신청/해지)
// ══════════════════════════════════════════
// TODO: 사용자가 첨부할 실제 뉴스레터 콘텐츠(발행호별 제목/날짜/요약/본문)로 교체 예정.
// 배열 맨 앞이 최신호입니다. 예: { title, issueDate, summary, body }
let NEWSLETTER_ISSUES = [];
let currentNewsletterIssue = null;

async function getNewsletterSubStatus(){
  const uid = await getUid(); if(!uid) return { subscribed:false, subscribedAt:null };
  const { data: profile } = await _sb.from('profiles').select('newsletter_subscribed, newsletter_subscribed_at').eq('id', uid).maybeSingle();
  return { subscribed: !!(profile && profile.newsletter_subscribed), subscribedAt: profile ? profile.newsletter_subscribed_at : null };
}
async function isNewsletterSubscribed(){
  const s = await getNewsletterSubStatus();
  return s.subscribed;
}
// TODO: 실제 발송 스케줄이 확정되면 교체 예정. 지금은 매주 월요일 오전 발송을 가정한 예시입니다.
function computeNextNewsletterSchedule(){
  const now = new Date();
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  const next = new Date(now); next.setDate(now.getDate() + daysUntilMonday);
  return next.toLocaleDateString('ko-KR') + ' <span style="white-space:nowrap">(월요일 발송 예정)</span>';
}
async function renderNewsletterPage(){
  $('#newsletterDetailView').style.display = 'none';
  $('#newsletterListView').style.display = 'block';

  const { subscribed, subscribedAt } = await getNewsletterSubStatus();
  const latest = NEWSLETTER_ISSUES[0];

  // 내 대시보드 통계
  $('#nlSubscribedSince').textContent = (subscribed && subscribedAt) ? new Date(subscribedAt).toLocaleDateString('ko-KR') : '구독 전';
  $('#nlLastIssue').textContent = (subscribed && latest) ? latest.issueDate : '-';
  $('#nlNextSchedule').innerHTML = computeNextNewsletterSchedule();

  const latestCard = $('#newsletterLatestCard');
  if(!latest){
    latestCard.innerHTML = '<div class="empty-state"><h3>아직 발행된 뉴스레터가 없어요</h3><p>첫 뉴스레터가 발행되면 여기에서 바로 확인할 수 있습니다.</p></div>';
  } else if(!subscribed){
    latestCard.innerHTML = `
      <span class="badge blue">최신 발행</span>
      <h3 style="margin:10px 0 4px">${esc(latest.title)}</h3>
      <p style="color:var(--muted);font-size:13px;margin:0 0 12px">${esc(latest.issueDate)}</p>
      <p style="color:var(--muted)">${esc(latest.summary||'')}</p>
      <div class="insight-box" style="margin-top:14px">구독하면 이 호의 전체 내용과 뉴스레터 히스토리를 모두 볼 수 있어요. <a href="#" onclick="event.preventDefault();showPage('newsletter-subscribe')" style="color:var(--primary2);font-weight:800">구독 신청하기 →</a></div>`;
  } else {
    latestCard.innerHTML = latest.html
      ? `<span class="badge green">최신 발행</span>
         <h3 style="margin:10px 0 4px">${esc(latest.title)}</h3>
         <p style="color:var(--muted);font-size:13px;margin:0 0 12px">${esc(latest.issueDate)}</p>
         <p style="color:var(--muted)">${esc(latest.summary||'')}</p>
         <button class="btn dark" type="button" onclick="viewNewsletterIssue(0)" style="margin-top:10px">전체 내용 보기 →</button>`
      : `<span class="badge green">최신 발행</span>
         <h3 style="margin:10px 0 4px">${esc(latest.title)}</h3>
         <p style="color:var(--muted);font-size:13px;margin:0 0 12px">${esc(latest.issueDate)}</p>
         <div style="white-space:pre-line">${esc(latest.body || latest.summary || '')}</div>`;
  }

  const archiveSection = $('#newsletterArchiveSection');
  if(!subscribed){
    archiveSection.style.display = 'none';
  } else {
    archiveSection.style.display = 'block';
    const rest = NEWSLETTER_ISSUES.slice(1);
    const total = NEWSLETTER_ISSUES.length;
    $('#newsletterArchiveList').innerHTML = rest.length ? rest.map((iss,i)=>{
      const issueNo = total - (i+1);
      return `<div class="nl-archive-card">
        <div class="nl-archive-top">
          <span class="badge blue">${issueNo}호</span>
          <span class="nl-archive-date">${esc(iss.issueDate)}</span>
        </div>
        <div class="nl-archive-title">${esc(iss.title)}</div>
        <button class="btn line nl-archive-btn" type="button" onclick="viewNewsletterIssue(${i+1})">상세 보기</button>
      </div>`;
    }).join('') : '<div class="card" style="color:var(--muted);text-align:center;padding:24px">지난 발행 기록이 없어요</div>';
    $('#newsletterArchiveListTable').innerHTML = rest.length ? rest.map((iss,i)=>{
      const issueNo = total - (i+1);
      return `<tr>
        <td>${issueNo}호</td>
        <td>${esc(iss.issueDate)}</td>
        <td>${esc(iss.title)}</td>
        <td><button class="btn soft" type="button" onclick="viewNewsletterIssue(${i+1})">상세 보기</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:24px">지난 발행 기록이 없어요</td></tr>';
  }
}
function viewNewsletterIssue(idx){
  const issue = NEWSLETTER_ISSUES[idx]; if(!issue) return;
  currentNewsletterIssue = idx;
  $('#newsletterListView').style.display = 'none';
  $('#newsletterDetailView').style.display = 'block';
  $('#newsletterDetailTitle').textContent = issue.title;
  $('#newsletterDetailMeta').textContent = issue.issueDate;
  const bodyEl = $('#newsletterDetailBody');
  if(issue.html){
    bodyEl.style.padding = '0'; bodyEl.style.overflow = 'hidden';
    bodyEl.innerHTML = '';
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:100%;height:900px;border:0;background:#fff;display:block';
    bodyEl.appendChild(frame);
    frame.srcdoc = issue.html;
  } else {
    bodyEl.style.padding = ''; bodyEl.style.overflow = '';
    bodyEl.innerHTML = esc(issue.body || issue.summary || '').replace(/\n/g,'<br>');
  }
}
function backToNewsletterList(){
  $('#newsletterDetailView').style.display = 'none';
  $('#newsletterListView').style.display = 'block';
}

