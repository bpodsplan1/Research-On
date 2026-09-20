-- '뉴스레터 관리' 화면 접속마다 n8n AI 파이프라인이 재실행되던 비효율을 없애기 위한
-- 초안 캐시 테이블. 매주 월요일 08시 정기 스케줄(또는 관리자의 강제 실행)이 딱 한 번
-- 이 테이블에 최신 초안을 저장하고, 화면은 이 저장분을 읽기만 한다(AI 재호출 없음).
-- id는 항상 'current' 한 행만 사용하는 싱글턴 캐시 — 과거 발행본 이력은 이미
-- newsletters 테이블이 담당하므로 여기서는 "지금 편집 중인 최신 초안"만 다룬다.
-- n8n 쪽 참고: [Research On] 뉴스레터 - 2단계 워크플로우의 A0H/A7B(쓰기), R0~R3(읽기).
create table if not exists newsletter_draft_cache (
  id text primary key,
  status text not null default 'idle',  -- 'idle' | 'generating' | 'ready'
  draft_json jsonb,
  period_start date,
  period_end date,
  generated_at timestamptz,
  error_message text,
  updated_at timestamptz not null default now()
);

alter table newsletter_draft_cache enable row level security;
-- 정책을 의도적으로 추가하지 않음 — n8n이 서비스 롤 키(Supabase 헤더 인증)로만 접근하고,
-- 프론트엔드는 이 테이블을 직접 조회하지 않고 반드시 n8n 웹훅(R0)을 거친다.
