// ══════════════════════════════════════════
// 리서치 허브 "새 리서치 만들기" 키워드 풀 (핵심 키워드 + 확장 키워드)
// 2026-08부터 Supabase `keywords` 테이블이 실 소스 — 이 파일은 빈 틀 + loadKeywordPool() 로더만 가짐.
// (기존 정적 배열은 마이그레이션 시 `keywords` 테이블로 1회 이관됨. 관리자가 "키워드 신청" 승인 시
//  이 테이블에 바로 추가되므로, 더 이상 이 파일을 코드로 수정할 필요가 없음)
// ══════════════════════════════════════════
const DATA = {
  "core": [],
  "ext": { "target": [], "scope": [], "industry": [], "intent": [], "content": [], "analysis": [], "type": [] }
};
let keywordPoolLoaded = false;
let keywordPoolLoadPromise = null;
const EXT_FRONT_KEYS = ['target', 'scope', 'industry'];
const EXT_BACK_KEYS = ['intent', 'content', 'analysis', 'type'];
// 키워드 Pool을 Supabase `keywords` 테이블에서 불러와 기존 DATA.core/DATA.ext 형태 그대로 채운다.
// (2026-08 관리자 승인형 "키워드 신청" 기능 도입 이후, 이 파일의 정적 배열 대신 DB가 실 소스가 됨)
async function loadKeywordPool(){
  if(keywordPoolLoadPromise) return keywordPoolLoadPromise;
  keywordPoolLoadPromise = (async () => {
    const { data, error } = await _sb.from('keywords').select('*').order('created_at', { ascending: true });
    if(error){ console.error('키워드 Pool 로드 실패:', error.message); return; }
    DATA.core.length = 0;
    for(const k of EXT_FRONT_KEYS.concat(EXT_BACK_KEYS)) DATA.ext[k].length = 0;
    for(const row of (data || [])){
      if(row.category === 'core'){
        DATA.core.push({ d1: row.d1, d2: row.d2, d3: row.d3, keyword: row.keyword, job: row.job });
      } else if(row.ext_type && DATA.ext[row.ext_type]){
        DATA.ext[row.ext_type].push(row.keyword);
      }
    }
    keywordPoolLoaded = true;
    // init()이 로그인 전(빈 DATA 상태)에 이미 한 번 그려둔 "새 리서치 만들기" 화면을
    // 실제 데이터로 다시 그린다. 아직 페이지를 안 열어봤어도 다음에 열 때 바로 채워져 있도록 미리 반영.
    if(typeof renderCore === 'function') renderCore();
    if(typeof renderExt === 'function') renderExt();
    if(typeof initPool === 'function') initPool();
  })();
  return keywordPoolLoadPromise;
}

// ══════════════════════════════════════════
// 대시보드 "오늘의 추천 키워드" — 핵심+핵심 / 핵심+확장 / 확장+핵심 2개 조합으로
// 실제 말이 되는 검색어처럼 보이도록 사람이 직접 큐레이션한 50개 목록.
// (DATA.core × DATA.ext 전체 조합을 기계적으로 생성하면 대부분 말이 안 되는
//  조합이 나와서, 자연스러운 조합만 골라 고정 목록으로 관리한다)
// 각 항목의 kind: 'core'(DATA.core 키워드) | 'front'(target/scope/industry) |
// 'back'(intent/content/analysis/type) — front/back 구분만 있으면 되고
// 세부 ext 카테고리(target인지 scope인지 등)는 선택 로직에서 필요 없다.
// ══════════════════════════════════════════
const SUGGESTED_COMBOS = [
  { label: '삼성전자 주재원', parts: [{ v: '삼성전자', k: 'front' }, { v: '주재원', k: 'core' }] },
  { label: '반도체 수출 규제', parts: [{ v: '반도체', k: 'front' }, { v: '수출 규제', k: 'core' }] },
  { label: '대기업 조직문화', parts: [{ v: '대기업', k: 'front' }, { v: '조직문화', k: 'core' }] },
  { label: '스타트업 유연 근무제', parts: [{ v: '스타트업', k: 'front' }, { v: '유연 근무제', k: 'core' }] },
  { label: '판교 지식산업센터', parts: [{ v: '판교', k: 'front' }, { v: '지식산업센터', k: 'core' }] },
  { label: '수원 공유오피스', parts: [{ v: '수원', k: 'front' }, { v: '공유오피스', k: 'core' }] },
  { label: 'SK하이닉스 온프레미스', parts: [{ v: 'SK하이닉스', k: 'front' }, { v: '온프레미스', k: 'core' }] },
  { label: '글로벌 기업 리텐션', parts: [{ v: '글로벌 기업', k: 'front' }, { v: '리텐션', k: 'core' }] },
  { label: '공유오피스 화재예방', parts: [{ v: '공유오피스', k: 'core' }, { v: '화재예방', k: 'core' }] },
  { label: '외국인 근로자 온보딩', parts: [{ v: '외국인 근로자', k: 'core' }, { v: '온보딩', k: 'core' }] },
  { label: '외국인 근로자 리텐션', parts: [{ v: '외국인 근로자', k: 'core' }, { v: '리텐션', k: 'core' }] },
  { label: '관리감독자 직무 교육', parts: [{ v: '관리감독자', k: 'core' }, { v: '직무 교육', k: 'core' }] },
  { label: '방사선안전관리자 위험성평가', parts: [{ v: '방사선안전관리자', k: 'core' }, { v: '위험성평가', k: 'core' }] },
  { label: '산업안전보건법 중대재해처벌법', parts: [{ v: '산업안전보건법', k: 'core' }, { v: '중대재해처벌법', k: 'core' }] },
  { label: '소방법 비상대응', parts: [{ v: '소방법', k: 'core' }, { v: '비상대응', k: 'core' }] },
  { label: '스마트오피스(AIoT) 하이브리드워크', parts: [{ v: '스마트오피스(AIoT)', k: 'core' }, { v: '하이브리드워크', k: 'core' }] },
  { label: '로봇배송 무인택배함', parts: [{ v: '로봇배송', k: 'core' }, { v: '무인택배함', k: 'core' }] },
  { label: '키오스크 무인화 서비스', parts: [{ v: '키오스크', k: 'core' }, { v: '무인화 서비스', k: 'core' }] },
  { label: '스마트 물류 로봇배송', parts: [{ v: '스마트 물류', k: 'core' }, { v: '로봇배송', k: 'core' }] },
  { label: '지식산업센터 임대관리', parts: [{ v: '지식산업센터', k: 'core' }, { v: '임대관리', k: 'core' }] },
  { label: '보증금 관리 임대차 계약', parts: [{ v: '보증금 관리', k: 'core' }, { v: '임대차 계약', k: 'core' }] },
  { label: '주재원 온보딩', parts: [{ v: '주재원', k: 'core' }, { v: '온보딩', k: 'core' }] },
  { label: '노란봉투법 도급', parts: [{ v: '노란봉투법', k: 'core' }, { v: '도급', k: 'core' }] },
  { label: '통상임금 4대 보험', parts: [{ v: '통상임금', k: 'core' }, { v: '4대 보험', k: 'core' }] },
  { label: '유연 근무제 하이브리드워크', parts: [{ v: '유연 근무제', k: 'core' }, { v: '하이브리드워크', k: 'core' }] },
  { label: '웰컴키트 오리엔테이션', parts: [{ v: '웰컴키트', k: 'core' }, { v: '오리엔테이션', k: 'core' }] },
  { label: '공채 인턴십', parts: [{ v: '공채', k: 'core' }, { v: '인턴십', k: 'core' }] },
  { label: 'AI 에이전트 RAG', parts: [{ v: 'AI 에이전트', k: 'core' }, { v: 'RAG', k: 'core' }] },
  { label: '온프레미스 AI 거버넌스', parts: [{ v: '온프레미스', k: 'core' }, { v: 'AI 거버넌스', k: 'core' }] },
  { label: '개인정보보호 기업보안', parts: [{ v: '개인정보보호', k: 'core' }, { v: '기업보안', k: 'core' }] },
  { label: '출입통제 물리보안', parts: [{ v: '출입통제', k: 'core' }, { v: '물리보안', k: 'core' }] },
  { label: '위험성평가 안전관리', parts: [{ v: '위험성평가', k: 'core' }, { v: '안전관리', k: 'core' }] },
  { label: '휴양소 기업 복리후생', parts: [{ v: '휴양소', k: 'core' }, { v: '기업 복리후생', k: 'core' }] },
  { label: '노란봉투법 동향', parts: [{ v: '노란봉투법', k: 'core' }, { v: '동향', k: 'back' }] },
  { label: 'AI 에이전트 사례', parts: [{ v: 'AI 에이전트', k: 'core' }, { v: '사례', k: 'back' }] },
  { label: '키오스크 시장 조사', parts: [{ v: '키오스크', k: 'core' }, { v: '시장 조사', k: 'back' }] },
  { label: '중대재해처벌법 사례', parts: [{ v: '중대재해처벌법', k: 'core' }, { v: '사례', k: 'back' }] },
  { label: '인턴십 프로그램', parts: [{ v: '인턴십', k: 'core' }, { v: '프로그램', k: 'back' }] },
  { label: '조직문화 트렌드', parts: [{ v: '조직문화', k: 'core' }, { v: '트렌드', k: 'back' }] },
  { label: '학자금 사례', parts: [{ v: '학자금', k: 'core' }, { v: '사례', k: 'back' }] },
  { label: '기업 복리후생 트렌드', parts: [{ v: '기업 복리후생', k: 'core' }, { v: '트렌드', k: 'back' }] },
  { label: '부동산 시세 분석', parts: [{ v: '부동산 시세', k: 'core' }, { v: '분석', k: 'back' }] },
  { label: '자산실사 대행', parts: [{ v: '자산실사', k: 'core' }, { v: '대행', k: 'back' }] },
  { label: '도급 리스크', parts: [{ v: '도급', k: 'core' }, { v: '리스크', k: 'back' }] },
  { label: '소방법 이슈 모니터링', parts: [{ v: '소방법', k: 'core' }, { v: '이슈 모니터링', k: 'back' }] },
  { label: '취업 비자 제도', parts: [{ v: '취업 비자', k: 'core' }, { v: '제도', k: 'back' }] },
  { label: '온라인 교육 사례', parts: [{ v: '온라인 교육', k: 'core' }, { v: '사례', k: 'back' }] },
  { label: 'Physical AI 산업 분석', parts: [{ v: 'Physical AI', k: 'core' }, { v: '산업 분석', k: 'back' }] },
  { label: '에이전틱 AI 사업 확장', parts: [{ v: '에이전틱 AI', k: 'core' }, { v: '사업 확장', k: 'back' }] },
  { label: '기업보안 사례', parts: [{ v: '기업보안', k: 'core' }, { v: '사례', k: 'back' }] }
];
