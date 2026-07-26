begin;

-- 로그인 화면 "아이디 찾기": 성명+이메일이 일치하면 아이디를 마스킹해서 반환.
-- profiles는 RLS로 잠겨있어(anon 접근 불가) 로그인 전(anon)에도 쓸 수 있는 좁은 RPC로 제공.
create or replace function public.find_masked_user_id(p_name text, p_email text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_len int;
begin
  select user_id into v_user_id
    from public.profiles
    where name = p_name and email = p_email
    limit 1;

  if v_user_id is null then
    return null;
  end if;

  v_len := length(v_user_id);
  if v_len <= 4 then
    return left(v_user_id, 1) || repeat('*', v_len - 1);
  end if;

  return left(v_user_id, 2) || repeat('*', v_len - 4) || right(v_user_id, 2);
end;
$$;
grant execute on function public.find_masked_user_id(text, text) to anon, authenticated;

commit;
