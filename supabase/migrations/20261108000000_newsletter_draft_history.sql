-- AI 뉴스레터 초안 이력 (2026-11-08)
--
-- newsletter_draft_cache는 id='current' 한 행만 계속 덮어쓰기 때문에, 지난주 AI 초안이 남지 않아
-- "AI 초안 → 실제 발송본"이 어떻게 바뀌었는지 비교할 수 없었다. n8n 2단계 워크플로우(A7B)나
-- 관리 화면의 '지금 다시 생성'이 current 행을 status='ready'로 저장할 때마다, 이 트리거가 그 초안을
-- newsletter_draft_history에 한 줄씩 복사해 둔다. n8n 워크플로우는 바꾸지 않는다.
--
-- - 같은 초안(내용 해시 동일)은 한 번만 저장한다(updated_at만 바뀌는 재저장 등).
-- - 트리거 안에서 오류가 나도 원래 캐시 저장은 그대로 성공하도록 예외를 삼킨다.
-- - 발송본(newsletters)과는 period_end로 짝지어 비교한다.

create table if not exists public.newsletter_draft_history (
  id bigserial primary key,
  captured_at timestamptz not null default now(),
  period_start date,
  period_end date,
  generated_at timestamptz,
  draft_json jsonb not null,
  draft_hash text not null,
  source text not null default 'AI_DRAFT'
);

create unique index if not exists newsletter_draft_history_hash_uidx
  on public.newsletter_draft_history (draft_hash);
create index if not exists newsletter_draft_history_period_idx
  on public.newsletter_draft_history (period_end, captured_at desc);

alter table public.newsletter_draft_history enable row level security;

-- 읽기는 관리자만(추후 비교 화면용). 쓰기는 아래 security definer 트리거만 한다.
drop policy if exists ndh_admin_select on public.newsletter_draft_history;
create policy ndh_admin_select on public.newsletter_draft_history for select
  using (public.is_admin());

revoke all on public.newsletter_draft_history from anon;
grant select on public.newsletter_draft_history to authenticated;
grant select, insert, update, delete on public.newsletter_draft_history to service_role;
grant usage, select on sequence public.newsletter_draft_history_id_seq to service_role;

create or replace function public.capture_newsletter_draft()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id = 'current' and new.status = 'ready' and new.draft_json is not null then
    begin
      insert into public.newsletter_draft_history
        (period_start, period_end, generated_at, draft_json, draft_hash)
      values
        (new.period_start, new.period_end, new.generated_at, new.draft_json, md5(new.draft_json::text))
      on conflict (draft_hash) do nothing;
    exception when others then
      raise warning 'capture_newsletter_draft 실패(캐시 저장은 계속 진행): %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.capture_newsletter_draft() from public, anon, authenticated;

drop trigger if exists trg_capture_newsletter_draft on public.newsletter_draft_cache;
create trigger trg_capture_newsletter_draft
  after insert or update on public.newsletter_draft_cache
  for each row execute function public.capture_newsletter_draft();

-- 현재 남아 있는 마지막 AI 초안(current)을 첫 이력으로 백필한다.
insert into public.newsletter_draft_history (period_start, period_end, generated_at, draft_json, draft_hash, captured_at)
select period_start, period_end, generated_at, draft_json, md5(draft_json::text), coalesce(updated_at, now())
from public.newsletter_draft_cache
where id = 'current' and status = 'ready' and draft_json is not null
on conflict (draft_hash) do nothing;
