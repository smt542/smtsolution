-- 관리회사(org)별 기본 납부기한 설정.
--
-- 지금까지 납기일은 건물·월 설정(billing_period_settings.due_date) 또는 발행 고지서 납기일만 있었고,
-- 둘 다 없으면 시스템이 「그 달 말일」로 처리했다. 사무실 관리자가 셋업 > 고지서 설정에서
-- 「당월 25일」「익월 5일」처럼 회사 기본 납부일을 정하고, 미설정 달은 그 값을 쓰게 한다.
--
-- 1) org_billing_due_settings: org 당 1행. month_offset 0=당월·1=익월, due_day 1~31(31=말일, 짧은 달은 말일로 맞춤).
-- 2) billing_default_due_date(unit, period): 그 세대가 속한 org 설정으로 기본 납부일 계산, 설정 없으면 그 달 말일(기존과 동일).
-- 3) 「그 달 말일」 대체값을 쓰던 함수 5개를 이 함수로 바꾼다
--    (bill_carryover · list_overdue_periods · partner_list_meter_cards · partner_list_unit_payments · settlement_billing_unpaid).
--    우선순위는 그대로: 발행 고지서 납기일 → 건물·월 납기일 → (이번에 추가) 회사 기본 납부일 → 그 달 말일.

create table if not exists public.org_billing_due_settings (
  org_id bigint primary key references public.organizations(id) on delete cascade,
  month_offset smallint not null default 0 check (month_offset in (0, 1)),
  due_day smallint not null check (due_day between 1 and 31),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

comment on table public.org_billing_due_settings is '관리회사 기본 납부기한(셋업 > 고지서 설정). month_offset 0=당월·1=익월, due_day 31=말일.';

alter table public.org_billing_due_settings enable row level security;

drop policy if exists obds_select on public.org_billing_due_settings;
create policy obds_select on public.org_billing_due_settings
  for select using (org_id in (select my_org_ids()));
drop policy if exists obds_insert on public.org_billing_due_settings;
create policy obds_insert on public.org_billing_due_settings
  for insert with check (org_id in (select my_org_ids()) and current_user_has_module('settings'));
drop policy if exists obds_update on public.org_billing_due_settings;
create policy obds_update on public.org_billing_due_settings
  for update using (org_id in (select my_org_ids()) and current_user_has_module('settings'))
  with check (org_id in (select my_org_ids()) and current_user_has_module('settings'));
drop policy if exists obds_delete on public.org_billing_due_settings;
create policy obds_delete on public.org_billing_due_settings
  for delete using (org_id in (select my_org_ids()) and current_user_has_module('settings'));

grant select, insert, update, delete on public.org_billing_due_settings to authenticated;

drop trigger if exists trg_org_billing_due_settings_updated on public.org_billing_due_settings;
create trigger trg_org_billing_due_settings_updated
  before update on public.org_billing_due_settings
  for each row execute function set_updated_at();

create or replace function public.billing_default_due_date(p_unit_id bigint, p_period date)
 returns date
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(
    (
      select (
        date_trunc('month', p_period) + make_interval(months => s.month_offset)
      )::date
      + (
        least(
          s.due_day::int,
          extract(day from (
            date_trunc('month', p_period) + make_interval(months => s.month_offset + 1) - interval '1 day'
          ))::int
        ) - 1
      )
      from units u
      join buildings b on b.id = u.building_id
      join org_billing_due_settings s on s.org_id = b.org_id
      where u.id = p_unit_id
    ),
    (date_trunc('month', p_period) + interval '1 month' - interval '1 day')::date
  );
$function$;

revoke all on function public.billing_default_due_date(bigint, date) from public, anon;
grant execute on function public.billing_default_due_date(bigint, date) to authenticated, service_role;

do $$
declare
  v_item record;
  v_fn record;
  v_new text;
  v_hits int;
begin
  for v_item in
    select * from (values
      ('bill_carryover',             'bc.period',    'bc.unit_id'),
      ('list_overdue_periods',       'pb.period',    'pb.unit_id'),
      ('partner_list_meter_cards',   'pb.period',    'u.id'),
      ('partner_list_unit_payments', 'month.period', 'unit.id'),
      ('settlement_billing_unpaid',  'pp.period',    'pp.unit_id')
    ) as t(fn, period_expr, unit_expr)
  loop
    v_hits := 0;
    -- 오버로드가 여럿일 수 있다(예: settlement_billing_unpaid 1인자·2인자) — 대체값이 있는 것만 바꾼다.
    for v_fn in
      select pg_get_functiondef(p.oid) as def
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = v_item.fn
    loop
      if position('billing_default_due_date(' in v_fn.def) > 0 then
        v_hits := v_hits + 1; -- 이미 적용됨
        continue;
      end if;
      v_new := replace(
        v_fn.def,
        format('(date_trunc(''month'', %s) + interval ''1 month'' - interval ''1 day'')::date', v_item.period_expr),
        format('public.billing_default_due_date(%s, %s)', v_item.unit_expr, v_item.period_expr)
      );
      if v_new <> v_fn.def then
        execute v_new;
        v_hits := v_hits + 1;
      end if;
    end loop;
    if v_hits = 0 then raise exception 'month-end fallback not found in %', v_item.fn; end if;
  end loop;
end $$;
