-- 1-26: 미납 관리 납기일을 list_payment_rows(0289)와 같은 우선순위로 통일한다.
--   발행 고지서 납기일 -> 건물·월 납기일 -> 회사 기본 납부일 -> 그 달 말일
-- 1-27: staff_sign_bill_urls 를 bill_publish 또는 overdue 보유자가 호출할 수 있게 한다(독촉 발송용).
--       org·건물 범위 검사는 그대로.

create or replace function public.billing_effective_due_date(p_unit_id bigint, p_period date)
returns date
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select x.due_date from bill_issues x
      where x.unit_id = p_unit_id and x.period = p_period and x.due_date is not null
      order by x.issued_at desc nulls last, x.id desc limit 1),
    (select s.due_date from billing_period_settings s
      join units u on u.building_id = s.building_id
      where u.id = p_unit_id and s.period = p_period),
    public.billing_default_due_date(p_unit_id, p_period)
  );
$$;

revoke all on function public.billing_effective_due_date(bigint, date) from public, anon, authenticated;

do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.list_overdue_periods(bigint,integer,integer,text)'::regprocedure) into v_def;
  v_new := replace(
    v_def,
    E'coalesce(\n      bps.due_date,\n      public.billing_default_due_date(pb.unit_id, pb.period)\n    ) as due_date',
    E'public.billing_effective_due_date(pb.unit_id, pb.period) as due_date'
  );
  if v_new = v_def then
    raise exception 'list_overdue_periods due_date pattern not found';
  end if;
  execute v_new;

  select pg_get_functiondef('public.staff_sign_bill_urls(bigint[],date)'::regprocedure) into v_def;
  v_new := replace(
    v_def,
    'if not public.current_user_has_module(''bill_publish'') then',
    'if not (public.current_user_has_module(''bill_publish'') or public.current_user_has_module(''overdue'')) then'
  );
  if v_new = v_def then
    raise exception 'staff_sign_bill_urls module check pattern not found';
  end if;
  execute v_new;
end $$;
