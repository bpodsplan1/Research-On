begin;

alter table public.support_requests
  add column if not exists admin_reply text,
  add column if not exists replied_at timestamptz,
  add column if not exists replied_by uuid references public.profiles(id);

grant update on public.support_requests to authenticated;

drop policy if exists sr_update on public.support_requests;
create policy sr_update on public.support_requests for update
  using (public.is_admin())
  with check (public.is_admin());

commit;
