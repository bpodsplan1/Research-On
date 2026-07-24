// ══════════════════════════════════════════
// 검색 히스토리 + Google Sheets 연동
// ══════════════════════════════════════════
let searchHistory = []; // loadUserData()에서 Supabase로 채워짐
let histFilterMode = 'all';
const HIST_MAX = 50;
async function saveSearchHistory(q){
  const uid = await getUid(); if(!uid) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR');
  const timeStr = now.toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
  const idx = searchHistory.findIndex(h=>h.kw===q);
  if(idx !== -1){
    const item = {...searchHistory[idx], count:searchHistory[idx].count+1, date:dateStr, time:timeStr};
    searchHistory.splice(idx,1); searchHistory.unshift(item);
  } else {
    searchHistory.unshift({kw:q, date:dateStr, time:timeStr, count:1});
    if(searchHistory.length > HIST_MAX) searchHistory.pop();
  }
  // 반드시 "현재 계정 + 키워드"로 DB 조회 후 처리 (계정 간 오염 방지)
  const { data: existRow } = await _sb.from('search_history').select('id, search_count').eq('profile_id', uid).eq('keyword', q).maybeSingle();
  if(existRow){
    await _sb.from('search_history').update({ search_count:(existRow.search_count||0)+1, date_str:dateStr, time_str:timeStr }).eq('id', existRow.id).eq('profile_id', uid);
    searchHistory[0].id = existRow.id; searchHistory[0].count = (existRow.search_count||0)+1;
  } else {
    const { data } = await _sb.from('search_history').insert({ profile_id:uid, keyword:q, date_str:dateStr, time_str:timeStr, search_count:1 }).select().single();
    if(data) searchHistory[0].id = data.id;
  }
  renderDashboard();
}
async function saveHistoryToSheets(q){ /* Supabase로 대체됨 */ }
function parseKoDate(str){
  if(!str) return null;
  const m = String(str).match(/(\d+)\D+(\d+)\D+(\d+)/);
  if(!m) return null;
  return new Date(+m[1], +m[2]-1, +m[3]);
}
function matchesHistFilter(dateStr){
  if(histFilterMode==='all') return true;
  const d = parseKoDate(dateStr); if(!d) return true;
  d.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  if(histFilterMode==='today') return d.getTime()===today.getTime();
  if(histFilterMode==='week'){ const weekAgo = new Date(today.getTime()-7*864e5); return d.getTime()>=weekAgo.getTime(); }
  if(histFilterMode==='month'){ const monthStart = new Date(today.getFullYear(), today.getMonth(), 1); return d.getTime()>=monthStart.getTime(); }
  return true;
}
function renderHistoryPage(){
  const today = new Date().toLocaleDateString('ko-KR');
  const todayItems = searchHistory.filter(h=>h.date===today);
  const topItem = [...searchHistory].sort((a,b)=>b.count-a.count)[0];
  $('#histTotalCount').textContent = searchHistory.length;
  $('#histTodayCount').textContent = todayItems.length;
  $('#histTopKw').textContent = topItem ? topItem.kw : '—';

  renderKeywordsPage();
}
