-- 0128_login_rate_limit.sql
-- Security: brute-force / credential-stuffing protection for the four login endpoints.
-- Sliding-window failure counters + temporary lockout, keyed independently by client IP
-- and by username. Touched ONLY by the login route handlers via the service_role (admin)
-- client, which bypasses RLS. The RPC is SECURITY DEFINER so it never depends on the
-- (anonymous, pre-auth) caller's own privileges.

create table if not exists public.login_rate_limit (
  bucket_key        text primary key,            -- e.g. 'ip:203.0.113.4' or 'user:hqadmin'
  fail_count        int         not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until      timestamptz,
  updated_at        timestamptz not null default now()
);

comment on table public.login_rate_limit is
  'Login brute-force throttling buckets. Written only by service_role via login_rate_limit_hit(). Rows are self-expiring by window; safe to periodically delete where updated_at < now() - interval ''1 day''.';

alter table public.login_rate_limit enable row level security;
-- Intentionally NO policies: only the RLS-bypassing service_role touches this table.
revoke all on table public.login_rate_limit from anon, authenticated;

-- Atomic check-and-record. Returns whether the caller may attempt now, and if not, how long to wait.
--   p_action = 'check' : peek only (no mutation) — used before the credential check.
--   p_action = 'fail'  : record one failed attempt (may set a lockout when threshold reached).
--   p_action = 'reset' : clear the bucket on a successful login.
-- Thresholds are passed by the caller so IP and username buckets can differ.
create or replace function public.login_rate_limit_hit(
  p_key            text,
  p_max_fails      int,
  p_window_seconds int,
  p_lock_seconds   int,
  p_action         text
) returns table(allowed boolean, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r      public.login_rate_limit;
  now_ts timestamptz := now();
begin
  select * into r from public.login_rate_limit where bucket_key = p_key for update;

  -- Currently locked out? (applies to every action, incl. a fresh 'check')
  if r.bucket_key is not null and r.locked_until is not null and r.locked_until > now_ts then
    return query select false, greatest(1, ceil(extract(epoch from (r.locked_until - now_ts)))::int);
    return;
  end if;

  if p_action = 'reset' then
    delete from public.login_rate_limit where bucket_key = p_key;
    return query select true, 0;
    return;
  end if;

  if p_action = 'fail' then
    if r.bucket_key is null then
      insert into public.login_rate_limit(bucket_key, fail_count, window_started_at, updated_at)
      values (p_key, 1, now_ts, now_ts);
    elsif r.window_started_at < now_ts - make_interval(secs => p_window_seconds) then
      -- window elapsed → start a fresh window
      update public.login_rate_limit
         set fail_count = 1, window_started_at = now_ts, locked_until = null, updated_at = now_ts
       where bucket_key = p_key;
    else
      update public.login_rate_limit
         set fail_count   = fail_count + 1,
             updated_at   = now_ts,
             locked_until = case when fail_count + 1 >= p_max_fails
                                 then now_ts + make_interval(secs => p_lock_seconds)
                                 else locked_until end
       where bucket_key = p_key;
    end if;
    return query select true, 0;
    return;
  end if;

  -- p_action = 'check' and not locked → allowed
  return query select true, 0;
end;
$$;

revoke all on function public.login_rate_limit_hit(text,int,int,int,text) from public, anon, authenticated;
grant execute on function public.login_rate_limit_hit(text,int,int,int,text) to service_role;
