begin;

-- 계정 설정 > 문의/오류신고 내역에서 사용자가 본인이 올린 "접수됨"(미답변) 건을
-- 직접 삭제할 수 있도록 허용. "답변 완료"(resolved) 건은 프론트에서도 삭제 버튼을
-- 비활성화해 막지만, RLS로도 동일하게 막아 API를 직접 호출해도 삭제되지 않게 한다.
grant delete on public.support_requests to authenticated;

drop policy if exists sr_delete on public.support_requests;
create policy sr_delete on public.support_requests for delete
  using (user_id = auth.uid() and status is distinct from 'resolved');

commit;
