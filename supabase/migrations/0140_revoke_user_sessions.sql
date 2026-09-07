-- 0140_revoke_user_sessions.sql
-- L4 — 자격(비밀번호) 변경 시 대상 사용자의 기존 세션을 폐기한다.
-- 관리자 비밀번호 리셋(auth.admin.updateUserById)은 기존 세션/리프레시 토큰을 자동으로
-- 무효화하지 않는다. 계정관리 서버 라우트가 리셋 직후 이 함수를 service_role로 호출해
-- 대상 계정의 모든 세션을 폐기함으로써, 리셋(예: 자격 탈취 대응·출시 전 로테이션) 후에도
-- 구세션이 유효하게 남는 갭을 막는다. 라우트가 이미 대상 계정 권한을 검증하므로 이 함수는
-- service_role 게이팅만 한다.
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sessions integer;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'revoke_user_sessions requires service_role' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'revoke_user_sessions requires a user id' using errcode = '22004';
  end if;

  -- 리프레시 토큰(레거시 스키마상 user_id는 text)과 세션을 모두 제거한다.
  delete from auth.refresh_tokens where user_id = p_user_id::text;
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_sessions = row_count;
  return v_sessions;
end;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
