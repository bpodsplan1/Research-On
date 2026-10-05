begin;

-- newsletter_draft_cache는 2026-09-20 RLS 잠금 때 "쓰기는 n8n service_role 전용"으로
-- 정책을 아예 안 넣어뒀음(id='current' 행만 사용). 이번에 뉴스레터 관리 화면에 "임시저장"
-- 기능을 추가하면서, id='admin_autosave' 행에 한해서만 관리자(is_admin())가 프론트에서
-- 직접 읽고 쓸 수 있도록 허용한다. id='current' 행(n8n 자동 생성 파이프라인 전용)은
-- 이 정책으로는 여전히 손댈 수 없다(id 조건으로 분리).
grant select, insert, update on public.newsletter_draft_cache to authenticated;

drop policy if exists ndc_admin_autosave_select on public.newsletter_draft_cache;
create policy ndc_admin_autosave_select on public.newsletter_draft_cache for select
  using (id = 'admin_autosave' and public.is_admin());

drop policy if exists ndc_admin_autosave_insert on public.newsletter_draft_cache;
create policy ndc_admin_autosave_insert on public.newsletter_draft_cache for insert
  with check (id = 'admin_autosave' and public.is_admin());

drop policy if exists ndc_admin_autosave_update on public.newsletter_draft_cache;
create policy ndc_admin_autosave_update on public.newsletter_draft_cache for update
  using (id = 'admin_autosave' and public.is_admin())
  with check (id = 'admin_autosave' and public.is_admin());

commit;
