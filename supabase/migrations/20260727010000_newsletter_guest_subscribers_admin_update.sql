begin;

-- newsletter_guest_subscribers: INSERT/SELECT 권한만 있고 UPDATE가 아예 없어서
-- 관리자 화면의 외부 구독자 "일시 정지"/"구독 취소"(js/admin.js handleTogglePause,
-- handleAdminUnsubscribe)가 항상 "permission denied for table" 오류로 실패하던 문제.
-- newsletter_send_history와 동일한 패턴으로 관리자(is_admin())에 한해 UPDATE 허용.
grant update on public.newsletter_guest_subscribers to authenticated;

drop policy if exists authenticated_update_guest_subscribers on public.newsletter_guest_subscribers;
create policy authenticated_update_guest_subscribers on public.newsletter_guest_subscribers for update
  using (public.is_admin())
  with check (public.is_admin());

commit;
