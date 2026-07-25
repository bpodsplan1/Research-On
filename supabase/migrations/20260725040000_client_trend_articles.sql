begin;

-- ══════════════════════════════════════════
-- 대시보드 "최근 클라이언트 동향" 캐러셀용 테이블
-- 매일 07시 n8n 워크플로우가 삼성전자 관련 최신 기사를 최대 5건 채워 넣는다.
-- (매일 실행 시 이전 행을 지우고 새로 채우는 방식이라 항상 5건 이하로 유지됨)
-- ══════════════════════════════════════════
create table public.client_trend_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  source text,
  published_at timestamptz,
  summary text,
  created_at timestamptz not null default now()
);

alter table public.client_trend_articles enable row level security;

-- 로그인 사용자는 전부 읽기만 가능 (개인화 없이 회사 전체가 같은 목록을 봄)
drop policy if exists cta_select on public.client_trend_articles;
create policy cta_select on public.client_trend_articles for select
  using (auth.role() = 'authenticated');

-- 이 프로젝트는 새 테이블에 기본 권한이 자동으로 붙지 않으므로(2026-07-25 발견) 명시적으로 GRANT.
-- 쓰기는 n8n의 service_role(secret 키)만 — RLS 정책 없이 GRANT만으로 authenticated의 쓰기는 막혀 있음.
grant select on public.client_trend_articles to authenticated;
grant select, insert, update, delete on public.client_trend_articles to service_role;
revoke all on public.client_trend_articles from anon;

commit;
