-- 계약 만료 테넌트 접속 차단.
--
-- 접속 게이트(org_is_operational·my_org_ids·get_my_context·staff 로그인 등)는 모두
-- organizations.status = 'active' 만 본다. contract_end_date 는 표시·KPI 용도뿐이라
-- 만료일이 지나도 로그인이 됐다.
--
-- 게이트 함수를 하나하나 고치는 대신, 만료된 운영 테넌트를 '정지(suspended)'로 전환해
-- 기존 게이트를 그대로 재사용한다(사무·현장 관리자·세입자 모두 차단).
--   - 만료일 당일까지는 허용, 다음 날(KST)부터 차단.
--   - pg_cron 'suspend-expired-orgs' 매일 UTC 15:00 = KST 00:00.
--   - 트리거: 만료일이 지난 상태로 '운영' 저장 시 즉시 '정지'로 보정(연장 없이 재활성화 방지).
--   - 재개는 플랫폼 관리자가 계약 만료일을 연장하고 상태를 '운영'으로 저장한다.

create or replace function public.org_contract_expired(p_contract_end_date date)
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select p_contract_end_date is not null
     and p_contract_end_date < (now() at time zone 'Asia/Seoul')::date;
$function$;

create or replace function public.organizations_suspend_if_expired()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.status = 'active' and public.org_contract_expired(new.contract_end_date) then
    new.status := 'suspended';
  end if;
  return new;
end;
$function$;

drop trigger if exists organizations_suspend_if_expired on public.organizations;
create trigger organizations_suspend_if_expired
  before insert or update of status, contract_end_date on public.organizations
  for each row execute function public.organizations_suspend_if_expired();

create or replace function public.suspend_expired_organizations()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  update public.organizations
     set status = 'suspended',
         updated_at = now()
   where status = 'active'
     and deleted_at is null
     and public.org_contract_expired(contract_end_date);
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.suspend_expired_organizations() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'suspend-expired-orgs') then
    perform cron.unschedule('suspend-expired-orgs');
  end if;
  perform cron.schedule('suspend-expired-orgs', '0 15 * * *', 'select public.suspend_expired_organizations()');
end $$;

-- 일회성 보정: 이미 만료된 운영 테넌트 즉시 정지.
select public.suspend_expired_organizations();
