// ══════════════════════════════════════════
// 이벤트 바인딩
// ══════════════════════════════════════════
function bindEvents(){
  $$('.nav-item[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.go)));
  $('#mobileMenu')?.addEventListener('click',()=>{$('#sidebar')?.classList.toggle('open');$('#sidebarBackdrop')?.classList.toggle('open');});
  $('#sidebarBackdrop')?.addEventListener('click',()=>{$('#sidebar')?.classList.remove('open');$('#sidebarBackdrop')?.classList.remove('open');});
  $$('#sidebar .nav-item').forEach(el=>el.addEventListener('click',()=>{ if(window.innerWidth<=840){ $('#sidebar')?.classList.remove('open'); $('#sidebarBackdrop')?.classList.remove('open'); } }));
  $$('.tab[data-mode]').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));
  $$('[data-mode-go]').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.modeGo)));
  $('#prevStep')?.addEventListener('click',()=>setStep(step-1));
  $('#nextStep')?.addEventListener('click',()=>{ if(step<2) setStep(step+1); else switchMode('advanced'); });
  document.addEventListener('click',e=>{
    const cat=e.target.closest('.core-category-head'); if(cat) cat.closest('.core-category').classList.toggle('open');
    const d2=e.target.closest('.depth2-head'); if(d2) d2.closest('.depth2-box').classList.toggle('open');
    const fr=e.target.closest('[data-front]'); if(fr) toggleValue('front', fr.dataset.front);
    const ba=e.target.closest('[data-back]'); if(ba) toggleValue('back', ba.dataset.back);
    const rm=e.target.closest('[data-remove]'); if(rm) removeValue(rm.dataset.remove, rm.dataset.value);
    const pd1=e.target.closest('[data-pool-d1]'); if(pd1){ poolD1=pd1.dataset.poolD1; poolD2=null; renderPoolD2(); }
    const pd2=e.target.closest('[data-pool-d2]'); if(pd2){ poolD2=pd2.dataset.poolD2; renderPoolD3(); }
    const pkw=e.target.closest('[data-pool-kw]'); if(pkw){ toggleValue('core', pkw.dataset.poolKw); }
    const cs=e.target.closest('[data-chip-field]'); if(cs) selectInsightChip(cs.dataset.chipField, cs.dataset.chipValue);
  });
  $('#resetAll')?.addEventListener('click',()=>{selected.core=[]; selected.front=[]; selected.back=[]; comboOrder=[]; updateSelection(); renderCore(); renderExt(); updatePayload();});
  $('#copyQuery')?.addEventListener('click',()=>{navigator.clipboard?.writeText(getFinalQuery()); showToast('검색어가 복사되었습니다.');});
  ['startDate','endDate'].forEach(id=>$('#'+id)?.addEventListener('input',updatePayload));
  $('#includeDomInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); if(e.target.value.trim()){ includeDomains.push(e.target.value.trim()); e.target.value=''; renderDomTags('includeDomArea', includeDomains); updatePayload(); } }});
  $('#customExcludeDomInput')?.addEventListener('keydown', e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      if(!e.target.value.trim()) return;
      const raw = e.target.value.trim();
      if(isDomainAlreadyExcluded(raw)){ showToast('이미 제외 목록에 포함되어 있는 사이트입니다.'); }
      else { customExcludeDomains.push(raw); renderDomTags('customExcludeDomArea', customExcludeDomains); updatePayload(); }
      e.target.value='';
    }
  });
  $('#customExcludeKwInput')?.addEventListener('keydown', e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      if(!e.target.value.trim()) return;
      const raw = e.target.value.trim();
      if(isKeywordAlreadyExcluded(raw)){ showToast('이미 제외 목록에 포함되어 있는 키워드입니다.'); }
      else { customExcludeKeywords.push(raw); renderDomTags('customExcludeKwArea', customExcludeKeywords); updatePayload(); }
      e.target.value='';
    }
  });
  $('#excludeDomGroups')?.addEventListener('click', e=>{ const btn=e.target.closest('[data-domain-group]'); if(btn) toggleExcludeDomainGroup(btn.dataset.domainGroup); });
  $('#excludeKwGroups')?.addEventListener('click', e=>{ const btn=e.target.closest('[data-kw-group]'); if(btn) toggleExcludeKwGroup(btn.dataset.kwGroup); });
  $('#countryChips')?.addEventListener('click', e=>{ const btn=e.target.closest('[data-country]'); if(btn) selectCountry(btn.dataset.country); });
  $('#advancedSearchBtn')?.addEventListener('click', e=>simulateRun(e.currentTarget));

  // 전역 검색

  // 뉴스 요약
  // (구 "뉴스 기사 요약" 키워드 검색 기능은 "리서치 결과" 페이지와 중복되어 제거되었습니다)
  // (구 "뉴스 기사 요약" URL 직접 요약 기능은 AI 인사이트 리포트 페이지 개편으로 제거되었습니다)

  // 검색 히스토리
  $$('.tab[data-hist-filter]').forEach(b=>b.addEventListener('click', ()=>{ $$('.tab[data-hist-filter]').forEach(x=>x.classList.toggle('active',x===b)); histFilterMode=b.dataset.histFilter; renderHistoryPage(); }));
  $$('.tab[data-saved-filter]').forEach(b=>b.addEventListener('click', ()=>{ $$('.tab[data-saved-filter]').forEach(x=>x.classList.toggle('active',x===b)); savedFilterMode=b.dataset.savedFilter; renderSavedPage(); }));
  $$('.tab[data-acct-filter]').forEach(b=>b.addEventListener('click', ()=>{ $$('.tab[data-acct-filter]').forEach(x=>x.classList.toggle('active',x===b)); acctFilterMode=b.dataset.acctFilter; filterAccountsTable(); }));

  // 계정 설정 / 사용자 팝업
  $('#sidebarSettingsBtn')?.addEventListener('click', ()=>showPage('account'));
  $('#logoutBtn')?.addEventListener('click', e=>{ e.stopPropagation(); handleLogout(); });

  // 계정 설정 — 프로필 수정/저장
  $('#profileEditBtn')?.addEventListener('click', handleProfileEditClick);

  // 계정 설정 — 비밀번호 변경
  $('#pwNew')?.addEventListener('input', checkPwStrength);
  $('#pwChangeBtn')?.addEventListener('click', handlePasswordChange);

  // 계정 설정 — 지원 및 문의 모달
  $$('.support-trigger').forEach(el=>el.addEventListener('click', ()=>openSupportModal(el.dataset.support)));
  $$('.info-trigger').forEach(el=>el.addEventListener('click', ()=>openInfoModal(el.dataset.info)));
  $('#supportModalClose')?.addEventListener('click', closeSupportModal);
  $('#supportSubmitBtn')?.addEventListener('click', submitSupportRequest);
  $('#supportModalOverlay')?.addEventListener('click', e=>{ if(e.target.id==='supportModalOverlay') closeSupportModal(); });
  $('#infoModalClose')?.addEventListener('click', closeInfoModal);
  $('#infoModalOverlay')?.addEventListener('click', e=>{ if(e.target.id==='infoModalOverlay') closeInfoModal(); });

  // 관리자 — 계정 관리
  $('#acctMgmtSearch')?.addEventListener('input', filterAccountsTable);
  $('#createAccountBtn')?.addEventListener('click', openCreateAccountModal);
  $('#createAccountModalClose')?.addEventListener('click', closeCreateAccountModal);
  $('#createAccountModalOverlay')?.addEventListener('click', e=>{ if(e.target.id==='createAccountModalOverlay') closeCreateAccountModal(); });
  $('#createAccountSubmitBtn')?.addEventListener('click', submitCreateAccount);
  $('#nlSubMgmtSearch')?.addEventListener('input', filterSubscribersTable);

  // 대시보드 히스토리 행 클릭 → 재검색
  $('#dashSearchBtn')?.addEventListener('click', ()=>{ const v=$('#dashSearchInput').value.trim(); if(v){ useSearchKeywordForBuilder(v); $('#dashSearchInput').value=''; } });
  $('#dashSearchInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter' && e.target.value.trim()){ useSearchKeywordForBuilder(e.target.value.trim()); e.target.value=''; }});
  $('#dashRecentCard')?.addEventListener('click', e=>{ if(e.target.closest('#dashRecentBtn') && resultHistory.length) viewResearchKeyword(resultHistory[0].kw); });
  $('#dashSuggestChips')?.addEventListener('click', e=>{ const c=e.target.closest('[data-suggest-kw]'); if(c) useSuggestedKeyword(c.dataset.suggestKw); });

  // 리서치 결과
  $('#saveAllResultsBtn')?.addEventListener('click', saveAllResults);
  $('#deleteSelectedResultsBtn')?.addEventListener('click', deleteSelectedResults);
  $$('.select-all-results').forEach(el=>{
    el.addEventListener('change', e=>{
      $$('.select-all-results').forEach(o=>{ o.checked = e.target.checked; o.indeterminate = false; });
      $$('.result-chk').forEach(c=>{ c.checked=e.target.checked; });
      updateExportBtnLabel();
    });
  });
  $('#results')?.addEventListener('change', e=>{
    if(e.target.classList.contains('result-chk')){
      const all = $$('.result-chk'); const checked = $$('.result-chk:checked');
      $$('.select-all-results').forEach(selectAll=>{
        selectAll.indeterminate = checked.length>0 && checked.length<all.length;
        selectAll.checked = all.length>0 && checked.length===all.length;
      });
      updateExportBtnLabel();
    }
  });

  // 내보내기 드롭다운
  $('#exportResultsBtn')?.addEventListener('click', e=>{
    e.stopPropagation();
    const menu = $('#exportMenu');
    menu.style.display = menu.style.display==='none' ? 'block' : 'none';
  });
  document.addEventListener('click', e=>{ if(!$('#exportDropdownWrap')?.contains(e.target)) $('#exportMenu').style.display='none'; });
  document.addEventListener('click', e=>{ if(!$('#reportExportDropdownWrap')?.contains(e.target)){ const m=$('#reportExportMenu'); if(m) m.style.display='none'; } });

  $('#exportPdfBtn')?.addEventListener('click', async ()=>{
    $('#exportMenu').style.display='none';
    if(!displayedDocs.length){ showToast('내보낼 결과가 없습니다.'); return; }
    const exportDocs = getSelectedDocs();
    const label = $$('.result-chk:checked').length ? `선택한 ${exportDocs.length}건` : `전체 ${exportDocs.length}건`;
    showToast(`PDF 생성 중 (${label})...`);

    try {
      // 라이브러리 동적 로드
      const loadScript = src => new Promise((res, rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
      if(!window.html2canvas) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      if(!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

      const date = new Date().toLocaleDateString('ko-KR');

      // 인쇄용 임시 div 생성
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:1050px;background:#fff;padding:32px;font-family:Malgun Gothic,sans-serif;font-size:12px;color:#0f172a';
      const rows = exportDocs.map(d=>`<tr>
        <td style="padding:7px 9px;border-bottom:1px solid #e2e8f0;word-break:keep-all;width:120px">${d.kw||''}</td>
        <td style="padding:7px 9px;border-bottom:1px solid #e2e8f0;width:200px">${d.title||''}</td>
        <td style="padding:7px 9px;border-bottom:1px solid #e2e8f0;color:#475569">${(d.desc||'').slice(0,100)}${(d.desc||'').length>100?'...':''}</td>
        <td style="padding:7px 9px;border-bottom:1px solid #e2e8f0;width:90px">${d.source||''}</td>
        <td style="padding:7px 9px;border-bottom:1px solid #e2e8f0;text-align:center;width:60px;color:${d.score>=0.85?'#16a34a':d.score>=0.65?'#ea580c':'#dc2626'};font-weight:800">
          ${d.score>=0.85?'높음':d.score>=0.65?'중간':'낮음'}</td></tr>`).join('');
      const pdfDetails = exportDocs.filter(d=>d.body && d.body.trim()).map((d,i)=>`
        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e2e8f0">
          <div style="font-size:13px;font-weight:bold;color:#1d4ed8;margin-bottom:3px">${i+1}. ${d.title}</div>
          <div style="font-size:10px;color:#64748b;margin-bottom:6px">[${d.kw}] · ${d.source||''}</div>
          <div style="font-size:11px;line-height:1.6;white-space:pre-line">${d.body}</div>
        </div>`).join('');
      wrap.innerHTML = `
        <div style="margin-bottom:16px">
          <div style="font-size:18px;font-weight:bold;color:#1d4ed8;margin-bottom:4px">Research On — 리서치 결과</div>
          <div style="font-size:11px;color:#64748b">내보낸 날짜: ${date} · ${label}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr>
            <th style="padding:9px;background-color:#1d4ed8;color:#fff;text-align:left;font-weight:bold;width:120px">검색 키워드</th>
            <th style="padding:9px;background-color:#1d4ed8;color:#fff;text-align:left;font-weight:bold;width:200px">기사 제목</th>
            <th style="padding:9px;background-color:#1d4ed8;color:#fff;text-align:left;font-weight:bold">내용 요약</th>
            <th style="padding:9px;background-color:#1d4ed8;color:#fff;text-align:left;font-weight:bold;width:90px">출처</th>
            <th style="padding:9px;background-color:#1d4ed8;color:#fff;text-align:center;font-weight:bold;width:60px">관련성</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${pdfDetails ? `<div style="margin-top:24px"><div style="font-size:14px;font-weight:bold;color:#0f172a;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #e2e8f0">기사 상세 내용</div>${pdfDetails}</div>` : ''}`;
      document.body.appendChild(wrap);

      const canvas = await html2canvas(wrap, { scale:2, useCORS:true, allowTaint:true, backgroundColor:'#ffffff', logging:false });
      document.body.removeChild(wrap);

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
      const pageW = doc.internal.pageSize.getWidth() - 10;
      const pageH = doc.internal.pageSize.getHeight() - 10;

      // AI 인사이트 리포트 PDF 내보내기와 동일한 이유로 수정 — 예전 공식은 세로로 긴 콘텐츠에서
      // 전체 내용이 1페이지에 다 들어간다고 오판해 페이지 밖으로 나간 부분이 잘려 보이지 않는 버그가 있었음.
      const pxToMm = pageW / canvas.width;
      const sliceH = Math.floor(pageH / pxToMm);

      let y = 5;
      let remaining = canvas.height;

      let page = 0;
      while(remaining > 0){
        if(page > 0) doc.addPage();
        const srcY = page * sliceH;
        const thisSlice = Math.min(sliceH, remaining);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = thisSlice;
        sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, thisSlice, 0, 0, canvas.width, thisSlice);
        const sliceH_mm = pageW * thisSlice / canvas.width;
        doc.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 5, y, pageW, sliceH_mm);
        remaining -= thisSlice;
        page++;
      }

      doc.save(`research-on-결과-${date.replace(/\./g,'').trim()}.pdf`);
      showToast('PDF 파일이 다운로드되었습니다.');
    } catch(err) {
      console.error('PDF 생성 오류:', err);
      showToast('PDF 생성에 실패했습니다. Word 형식으로 저장해보세요.');
    }
  });

  $('#exportWordBtn')?.addEventListener('click', async ()=>{
    $('#exportMenu').style.display='none';
    if(!displayedDocs.length){ showToast('내보낼 결과가 없습니다.'); return; }
    const exportDocs = getSelectedDocs();
    const label = $$('.result-chk:checked').length ? `선택한 ${exportDocs.length}건` : `전체 ${exportDocs.length}건`;
    const date = new Date().toLocaleDateString('ko-KR');
    showToast('Word 파일 생성 중...');
    try{
      const docxLib = await loadDocxLib();
      const {
        Document, Packer, Paragraph, TextRun, HeadingLevel,
        Table, TableRow, TableCell, WidthType, ShadingType, VerticalAlign, AlignmentType, BorderStyle
      } = docxLib;

      const cellBorder = { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' };
      const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
      const headerBorder = { style: BorderStyle.SINGLE, size: 2, color: '1E40AF' };
      const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

      function headerCell(text, widthPct){
        return new TableCell({
          width: { size: widthPct, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
          verticalAlign: VerticalAlign.CENTER,
          borders: headerBorders,
          children: [new Paragraph({ children:[new TextRun({text, bold:true, color:'FFFFFF', size:18})] })]
        });
      }
      function bodyCell(text, widthPct, evenRow, center){
        return new TableCell({
          width: { size: widthPct, type: WidthType.PERCENTAGE },
          shading: evenRow ? { type: ShadingType.CLEAR, fill: 'F8FAFC' } : undefined,
          verticalAlign: VerticalAlign.CENTER,
          borders: cellBorders,
          children: [new Paragraph({
            alignment: center ? AlignmentType.CENTER : undefined,
            children:[new TextRun({ text:String(text||''), size:17 })]
          })]
        });
      }

      const headerRow = new TableRow({
        tableHeader: true,
        children: [
          headerCell('검색 키워드', 14), headerCell('기사 제목', 26), headerCell('내용 요약', 34),
          headerCell('출처', 14), headerCell('관련성', 12)
        ]
      });
      const dataRows = exportDocs.map((d, i) => new TableRow({
        children: [
          bodyCell(d.kw, 14, i%2===1),
          bodyCell(d.title, 26, i%2===1),
          bodyCell(d.desc||'', 34, i%2===1),
          bodyCell(d.source||'', 14, i%2===1),
          bodyCell(d.score>=0.85?'높음':d.score>=0.65?'중간':'낮음', 12, i%2===1, true)
        ]
      }));
      const table = new Table({ width:{ size:100, type:WidthType.PERCENTAGE }, rows:[headerRow, ...dataRows] });

      const children = [
        new Paragraph({ text:'Research On — 리서치 결과', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children:[new TextRun({ text:`내보낸 날짜: ${date}  ·  ${label}`, color:'64748b', size:18 })], spacing:{ after:200 } }),
        table
      ];

      const details = exportDocs.filter(d=>d.body && d.body.trim());
      if(details.length){
        children.push(new Paragraph({ text:'기사 상세 내용', heading: HeadingLevel.HEADING_2, spacing:{ before:400, after:150 } }));
        details.forEach((d,i)=>{
          children.push(new Paragraph({
            children:[new TextRun({ text:`${i+1}. ${d.title}`, bold:true, color:'1D4ED8', size:22 })],
            spacing:{ before:150 }
          }));
          children.push(new Paragraph({
            children:[new TextRun({ text:`[${d.kw}] · ${d.source||''}`, color:'64748b', size:16 })],
            spacing:{ after:80 }
          }));
          children.push(new Paragraph({ text:d.body, spacing:{ after:120 } }));
        });
      }

      const doc = new Document({
        sections: [{ properties:{ page:{ size:{ orientation:'landscape' } } }, children }]
      });
      const blob = await Packer.toBlob(doc);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `research-on-결과-${date.replace(/\./g,'').trim()}.docx`;
      a.click(); URL.revokeObjectURL(a.href);
      showToast('Word 파일이 다운로드되었습니다.');
    } catch(err){
      console.error('리서치 결과 Word 생성 오류:', err);
      showToast('Word 생성에 실패했습니다. PDF 형식으로 저장해보세요.');
    }
  });

  // 문서 상세 모달
  $('#docModalClose')?.addEventListener('click', closeDocModal);
  $('#docModalOverlay')?.addEventListener('click', e=>{ if(e.target.id==='docModalOverlay') closeDocModal(); });

  // 리서치 결과 상세 페이지
  $('#resultsDetailBackBtn')?.addEventListener('click', ()=>showPage('results'));
  $('#newssumDetailBackBtn')?.addEventListener('click', ()=>showPage('newssum'));
  $('#sidebarToggleBtn')?.addEventListener('click', ()=>{
    if(window.innerWidth<=840){
      $('#sidebar')?.classList.remove('open');
      $('#sidebarBackdrop')?.classList.remove('open');
    } else {
      toggleSidebarCollapsed();
    }
  });
  $('#selectAllDetail')?.addEventListener('change', e=>{
    $$('.detail-chk').forEach(c=>{ c.checked = e.target.checked; });
  });
  $('#generateInsightBtn')?.addEventListener('click', deriveInsight);
  $('#userLinkAddBtn')?.addEventListener('click', addUserLink);
  $('#userLinkUrlInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); addUserLink(); } });
  $('#userLinkTitleInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); addUserLink(); } });

  // 새 키워드 세트 만들기 버튼 (고급 옵션 JSON으로부터 세트 자동 생성)
  $('#newResearchBtn')?.addEventListener('click', ()=>{ showToast('새 리서치 만들기에서 키워드를 검색해보세요.'); });
  $('#newsletterDetailBackBtn')?.addEventListener('click', backToNewsletterList);
  $('#newsletterSubscribeBtn')?.addEventListener('click', openNewsletterSubModal);
  $('#newsletterSubModalCancel')?.addEventListener('click', closeNewsletterSubModal);
  $('#newsletterSubModalConfirm')?.addEventListener('click', confirmNewsletterSub);
  $('#newsletterSubModalOverlay')?.addEventListener('click', e=>{ if(e.target.id==='newsletterSubModalOverlay') closeNewsletterSubModal(); });

  // 뉴스레터 관리자 모드
  let nlLiveRefreshTimer = null;
  function nlLiveRefresh(){
    clearTimeout(nlLiveRefreshTimer);
    nlLiveRefreshTimer = setTimeout(()=>{ if(document.getElementById('nlPreviewFrame')) refreshNewsletterPreview(true); }, 400);
  }
  $('#nlIssueTitle')?.addEventListener('input', e=>{ newsletterDraft.issue_title=e.target.value; nlLiveRefresh(); });
  $('#nlPeriodStart')?.addEventListener('change', e=>{ applyNlPeriodStart(e.target.value); nlLiveRefresh(); });
  $('#nlPeriodEnd')?.addEventListener('input', e=>{
    newsletterDraft.period_end = e.target.value;
    if(newsletterDraft.period_start) newsletterDraft.period = newsletterDraft.period_start + ' ~ ' + newsletterDraft.period_end;
    updateNlPeriodHint();
    nlLiveRefresh();
  });
  $('#nlHeadline')?.addEventListener('input', e=>{ newsletterDraft.executive_brief.headline=e.target.value; nlLiveRefresh(); });
  $('#nlSummary')?.addEventListener('input', e=>{ newsletterDraft.executive_brief.summary=e.target.value; nlLiveRefresh(); });
  $('#nlEditorNote')?.addEventListener('input', e=>newsletterDraft.editor_note=e.target.value);
  $('#nlItemModalClose')?.addEventListener('click', closeNlItemModal);
  $('#nlItemModalCancel')?.addEventListener('click', closeNlItemModal);
  $('#nlItemModalSave')?.addEventListener('click', saveNlItemModal);
  $('#nlItemModalOverlay')?.addEventListener('click', e=>{ if(e.target.id==='nlItemModalOverlay') closeNlItemModal(); });
  $('#nlPreviewRefreshBtn')?.addEventListener('click', goBackToNewsletterPreview);
  $('#nlSendBtn')?.addEventListener('click', sendNewsletter);
  $('#nlFetchDraftBtn')?.addEventListener('click', fetchNewsletterDraft);
  $('#newsletterUnsubscribeBtn')?.addEventListener('click', unsubscribeNewsletter);
  $('#proxySubBtn')?.addEventListener('click', submitProxySubscribe);
}

async function init(){
  renderCore(); renderExt(); updateSelection(); setStep(0); renderExcludeDomainGroups(); renderExcludeKwGroups(); renderCountryChips(); updatePayload(); initPool(); bindEvents(); bindComboDragEvents();
  // 검색 시작일/종료일 기본값: 매번 새로 설정하는 번거로움을 줄이기 위해
  // 시작일은 올해 1월 1일, 종료일은 오늘 날짜로 자동으로 채워둔다. 특정 기간이
  // 필요하면 사용자가 직접 값을 바꿀 수 있다.
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const startEl = $('#startDate'), endEl = $('#endDate');
  if(startEl && !startEl.value) startEl.value = `${today.getFullYear()}-01-01`;
  if(endEl && !endEl.value) endEl.value = todayStr;
  applySidebarCollapsed();
  initNavTooltips();
  // 사용자 데이터 로드는 하단 인증 스크립트의 restoreSession → enterApp → loadUserData 단일 경로로만 실행
  renderDashboard();
}
document.addEventListener('DOMContentLoaded', init);
