-- 통합관리자(HQ) 감사 로그 조회.
--  - audit_log 는 RLS(audit_select)로 자기 org 행만 보이므로, HQ 전체 조회는 platform_admin 전용 SECURITY DEFINER RPC 로 연다.
--  - 분류(category)는 action 접두로 묶는다: login·payment·account·data·resident·platform·other.
--  - 조회 전용. 감사 로그는 append-only 이며 이 화면에서 수정·삭제하지 않는다.

create or replace function public.audit_log_category(p_action text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case
    when p_action = 'LOGIN' then 'login'
    when p_action like 'PAYMENT\_%' or p_action like 'BILL\_%' or p_action like 'BILLING\_%'
      or p_action like 'LONG\_TERM\_REPAIR\_%' or p_action like 'SETTLEMENT\_%' or p_action like 'UTILITY\_%'
      then 'payment'
    when p_action like 'ACCOUNT\_%' or p_action like 'PERMISSION\_%' or p_action like 'PLATFORM\_ACCOUNT\_%'
      or p_action = 'PLATFORM_ADMIN_MEMBER'
      then 'account'
    when p_action like 'INSERT\_%' or p_action like 'UPDATE\_%' or p_action like 'DELETE\_%'
      or p_action like 'EXPORT\_%' or p_action like 'COMPLAINT\_%'
      then 'data'
    when p_action like 'CLAIM\_%' or p_action like 'RESIDENT\_%' then 'resident'
    when p_action like 'PLATFORM\_%' or p_action like 'ORG\_%' or p_action like 'MESSAGE\_POINT\_%'
      or p_action like 'POINT%'
      then 'platform'
    else 'other'
  end
$function$;

create or replace function public.platform_list_audit_logs(
  p_search text default null,
  p_category text default null,
  p_from date default null,
  p_to date default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  id bigint,
  created_at timestamp with time zone,
  org_id bigint,
  org_name text,
  actor_id uuid,
  actor_username text,
  actor_name text,
  action text,
  category text,
  table_name text,
  row_pk text,
  before jsonb,
  after jsonb,
  ip text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;

  return query
  with filtered as (
    select
      log.id,
      log.created_at,
      log.org_id,
      org.name as org_name,
      log.actor_id,
      profile.username as actor_username,
      profile.full_name as actor_name,
      log.action,
      public.audit_log_category(log.action) as category,
      log.table_name,
      log.row_pk,
      log.before,
      log.after,
      host(log.ip) as ip
    from public.audit_log log
    left join public.organizations org on org.id = log.org_id
    left join public.profiles profile on profile.user_id = log.actor_id
    -- 날짜는 KST 기준 일자로 자른다.
    where (p_from is null or log.created_at >= (p_from::timestamp at time zone 'Asia/Seoul'))
      and (p_to is null or log.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Seoul'))
      and (v_category is null or public.audit_log_category(log.action) = v_category)
      and (
        v_search is null
        or log.action ilike '%' || v_search || '%'
        or coalesce(log.table_name, '') ilike '%' || v_search || '%'
        or coalesce(org.name, '') ilike '%' || v_search || '%'
        or coalesce(profile.username, '') ilike '%' || v_search || '%'
        or coalesce(profile.full_name, '') ilike '%' || v_search || '%'
      )
  ), counted as (
    select filtered.*, count(*) over ()::bigint as total_count
    from filtered
  )
  select
    counted.id,
    counted.created_at,
    counted.org_id,
    counted.org_name,
    counted.actor_id,
    counted.actor_username,
    counted.actor_name,
    counted.action,
    counted.category,
    counted.table_name,
    counted.row_pk,
    counted.before,
    counted.after,
    counted.ip,
    counted.total_count
  from counted
  order by counted.created_at desc, counted.id desc
  limit greatest(1, least(100, coalesce(p_limit, 20)))
  offset greatest(0, coalesce(p_offset, 0));
end
$function$;

revoke execute on function public.platform_list_audit_logs(text, text, date, date, integer, integer) from public, anon;
grant execute on function public.platform_list_audit_logs(text, text, date, date, integer, integer) to authenticated;
