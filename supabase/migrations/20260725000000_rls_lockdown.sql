begin;

-- ══════════════════════════════════════════
-- 1) is_admin() 헬퍼 (security definer로 RLS 재귀 회피)
-- ══════════════════════════════════════════
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- ══════════════════════════════════════════
-- 2) profiles: 본인이 아닌 이상 role 컬럼 스스로 변경 금지 (트리거)
-- ══════════════════════════════════════════
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_prevent_self_role_escalation on public.profiles;
create trigger trg_prevent_self_role_escalation
before update on public.profiles
for each row execute function public.prevent_self_role_escalation();

-- ══════════════════════════════════════════
-- 3) 로그인/회원가입 화면에서 로그인 전(anon)에 필요한 조회를
--    PII 노출 없이 처리하는 전용 RPC
-- ══════════════════════════════════════════
create or replace function public.get_email_by_user_id(p_user_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.profiles where user_id = p_user_id;
$$;
grant execute on function public.get_email_by_user_id(text) to anon, authenticated;

create or replace function public.check_user_id_available(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists(select 1 from public.profiles where user_id = p_user_id);
$$;
grant execute on function public.check_user_id_available(text) to anon, authenticated;

create or replace function public.check_email_available(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists(select 1 from public.profiles where email = p_email);
$$;
grant execute on function public.check_email_available(text) to anon, authenticated;

-- ══════════════════════════════════════════
-- 4) 뉴스레터 "타인 대신 구독 신청" 대상 조회/구독처리 RPC
--    (로그인 사용자가 다른 사람의 profiles 행을 직접 update하지 않고, 이 좁은 통로로만 처리)
-- ══════════════════════════════════════════
create or replace function public.find_profile_by_email(p_email text)
returns table(id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select id, name from public.profiles where email = p_email;
$$;
grant execute on function public.find_profile_by_email(text) to authenticated;

create or replace function public.subscribe_profile_newsletter(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  select id into target_id from public.profiles where email = p_email;
  if target_id is null then
    return false;
  end if;
  update public.profiles
    set newsletter_subscribed = true, newsletter_subscribed_at = now()
    where id = target_id;
  return true;
end;
$$;
grant execute on function public.subscribe_profile_newsletter(text) to authenticated;

-- ══════════════════════════════════════════
-- 5) profiles 정책
-- ══════════════════════════════════════════
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete
  using (public.is_admin());

-- ══════════════════════════════════════════
-- 6) 개인 데이터 테이블: 본인 행만 CRUD
-- ══════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['research_history','saved_docs','search_history','subscribed_keywords','keyword_sets','insight_reports','news_summary_history']
  loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all using (profile_id = auth.uid()) with check (profile_id = auth.uid())', t);
  end loop;
end $$;

-- ══════════════════════════════════════════
-- 7) newsletter_send_history: 로그인 사용자 읽기만 허용 (쓰기는 n8n service_role 전용, RLS 우회)
-- ══════════════════════════════════════════
drop policy if exists nsh_select on public.newsletter_send_history;
create policy nsh_select on public.newsletter_send_history for select
  using (auth.role() = 'authenticated');

-- ══════════════════════════════════════════
-- 8) admin_requests
-- ══════════════════════════════════════════
drop policy if exists ar_select on public.admin_requests;
create policy ar_select on public.admin_requests for select
  using (
    public.is_admin()
    or user_id = (select p.user_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists ar_insert on public.admin_requests;
create policy ar_insert on public.admin_requests for insert
  with check (
    user_id = (select p.user_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists ar_update on public.admin_requests;
create policy ar_update on public.admin_requests for update
  using (public.is_admin())
  with check (public.is_admin());

-- ══════════════════════════════════════════
-- 9) support_requests: GRANT 누락분 보강 + 정책
-- ══════════════════════════════════════════
grant insert, select on public.support_requests to authenticated;

drop policy if exists sr_insert on public.support_requests;
create policy sr_insert on public.support_requests for insert
  with check (user_id = auth.uid());

drop policy if exists sr_select on public.support_requests;
create policy sr_select on public.support_requests for select
  using (public.is_admin() or user_id = auth.uid());

-- ══════════════════════════════════════════
-- 10) RLS 활성화 (정책이 이미 준비된 상태이므로 켜지는 순간 바로 의도한 대로 동작)
-- ══════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.research_history enable row level security;
alter table public.saved_docs enable row level security;
alter table public.search_history enable row level security;
alter table public.subscribed_keywords enable row level security;
alter table public.keyword_sets enable row level security;
alter table public.insight_reports enable row level security;
alter table public.news_summary_history enable row level security;
alter table public.newsletter_send_history enable row level security;
alter table public.admin_requests enable row level security;

-- ══════════════════════════════════════════
-- 11) anon 롤 권한 전면 회수 (로그인 없이는 어떤 테이블도 접근 불가)
-- ══════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['profiles','research_history','saved_docs','search_history','subscribed_keywords','keyword_sets','insight_reports','news_summary_history','newsletter_send_history','admin_requests','support_requests','newsletter_guest_subscribers']
  loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

commit;
