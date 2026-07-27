begin;

-- newsletter_send_history: SELECT만 열려 있고 INSERT 정책이 없어서(2026-07-25 RLS 잠금,
-- "쓰기는 n8n service_role 전용"으로 설계) 관리자 화면의 "발송하기"(js/newsletter-admin.js
-- sendNewsletter)가 프론트에서 직접 insert를 시도할 때마다 RLS에 막혀
-- "히스토리 저장에는 실패했어요" 토스트가 뜨던 문제. 관리자(is_admin())에 한해 INSERT 허용.
grant insert on public.newsletter_send_history to authenticated;

drop policy if exists nsh_insert on public.newsletter_send_history;
create policy nsh_insert on public.newsletter_send_history for insert
  with check (public.is_admin());

commit;
