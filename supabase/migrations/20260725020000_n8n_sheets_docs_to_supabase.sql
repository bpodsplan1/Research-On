begin;

-- ══════════════════════════════════════════
-- n8n 워크플로우가 쓰던 Google Sheets 4탭 + Google Docs 맥락 문서 3종을
-- Supabase로 이관하기 위한 백엔드 전용 테이블.
-- 프론트엔드(리서치허브)는 이 테이블들을 직접 조회/수정하지 않고 n8n만 접근하므로
-- anon/authenticated 권한은 아예 주지 않고 n8n의 secret 키(RLS 우회)로만 접근한다.
-- ══════════════════════════════════════════

-- 1) context_docs — 회사/본부 맥락 문서 3종 (예전: Google Docs)
create table public.context_docs (
  id text primary key,
  label text not null,
  content text not null,
  updated_at timestamptz not null default now()
);

-- 2) newsletter_keywords — 뉴스레터 1단계 검색 Job 생성용 키워드 목록 (예전: newsletter_keywords 탭)
create table public.newsletter_keywords (
  id uuid primary key default gen_random_uuid(),
  active boolean not null default true,
  section text not null,
  category text,
  target text,
  keyword text not null,
  include_terms text[] not null default '{}',
  exclude_terms text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 3) newsletter_candidates — 뉴스레터 1단계가 쌓는 후보, 2단계가 조회 (예전: newsletter_research 탭)
create table public.newsletter_candidates (
  item_id text primary key,
  collected_at timestamptz,
  research_period text,
  section text,
  source_pipeline text,
  category text,
  target text,
  keyword text,
  title text,
  summary text,
  implication text,
  source_urls text,
  evidence_level text,
  priority numeric,
  raw_json jsonb
);

-- 4) research_reports — 뉴스크롤링 2단계가 쌓는 리포트, 뉴스레터 2단계가 RESEARCH_ON_INSIGHT 후보로 조회 (예전: research_results 탭)
--    주의: 사용자 개인 저장함인 insight_reports(profile_id 스코프)와는 용도가 다른 별개 테이블.
--    이쪽은 리포트가 생성될 때마다 전부 쌓이는 전체 피드.
create table public.research_reports (
  research_id text primary key,
  created_at timestamptz,
  keyword text,
  report_type text,
  analysis_viewpoint text,
  audience_level text,
  source_count integer,
  newsletter_candidate boolean,
  newsletter_priority numeric,
  newsletter_reason text,
  one_line_conclusion text,
  raw_json jsonb
);

-- 5) newsletters — 발송 큐/이력 (예전: newsletters 탭)
create table public.newsletters (
  issue_id text primary key,
  generated_at timestamptz,
  period_start date,
  period_end date,
  status text,
  subject text,
  issue_title text,
  research_count integer,
  newsletter_json jsonb,
  newsletter_html text,
  editor_note text,
  gmail_id text,
  gmail_thread_id text,
  gmail_label_ids text[]
);

-- ══════════════════════════════════════════
-- RLS 활성화 + anon/authenticated 권한 전면 회수
-- (n8n은 secret 키로 접근하므로 RLS를 우회함 — 정책을 따로 만들 필요 없음)
-- ══════════════════════════════════════════
alter table public.context_docs enable row level security;
alter table public.newsletter_keywords enable row level security;
alter table public.newsletter_candidates enable row level security;
alter table public.research_reports enable row level security;
alter table public.newsletters enable row level security;

revoke all on public.context_docs from anon, authenticated;
revoke all on public.newsletter_keywords from anon, authenticated;
revoke all on public.newsletter_candidates from anon, authenticated;
revoke all on public.research_reports from anon, authenticated;
revoke all on public.newsletters from anon, authenticated;

commit;
