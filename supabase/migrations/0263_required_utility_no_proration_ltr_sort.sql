-- 개선3차 항목 1: 필수 공과금(전기·수도료·가스)은 월중 입·퇴실 일할(÷30) 대상이 아니다.
--   policy: 사무실 관리자_수도/전기/가스공과금 "일수 안분 없음", 계산규칙 8절.
-- 개선3차 항목 5: 장기수선 원장 정렬을 entry_no 숫자 우선으로 통일(클라이언트 compareRows와 동일).

create or replace function public.ensure_required_utility_fee_items(p_type_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org_id bigint;
begin
  select org_id into v_org_id
  from public.building_types
  where id = p_type_id;

  if not found then
    return;
  end if;

  insert into public.fee_items (
    org_id,
    type_id,
    name,
    rounding,
    daily_proration,
    carry_over,
    is_required,
    sort_order,
    deleted_at
  )
  select
    v_org_id,
    p_type_id,
    required_item.name,
    'round'::fee_rounding,
    false,
    true,
    true,
    required_item.sort_order,
    null
  from (values
    ('전기'::text, 0),
    ('수도료'::text, 1),
    ('가스'::text, 2)
  ) as required_item(name, sort_order)
  on conflict (type_id, name) do update set
    is_required = true,
    daily_proration = false,
    deleted_at = null,
    sort_order = excluded.sort_order;
end;
$function$;

-- 기존 필수 항목 백필
update public.fee_items
set daily_proration = false
where is_required and daily_proration;

create or replace function public.list_long_term_repair_ledger(p_building_id bigint, p_start_date date, p_end_date date)
returns table(id bigint, org_id bigint, building_id bigint, entry_date date, entry_no text, fund_note text, deposit bigint, withdrawal bigint, running_balance numeric, memo text, created_at timestamp with time zone, updated_at timestamp with time zone)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then
    raise exception 'no org for caller';
  end if;
  if not current_user_has_module('long_term_repair') then
    raise exception 'forbidden: long_term_repair required';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'invalid date range';
  end if;
  if not exists (
    select 1 from buildings b
    where b.id = p_building_id and b.org_id = v_org and b.deleted_at is null
  ) then
    raise exception 'building not in org';
  end if;

  return query
  with balanced as (
    select
      l.id,
      l.org_id,
      l.building_id,
      l.entry_date,
      l.entry_no,
      l.fund_note,
      l.deposit,
      l.withdrawal,
      sum(l.deposit - l.withdrawal) over (
        partition by l.building_id
        order by l.entry_date,
          nullif(regexp_replace(l.entry_no, '\D', '', 'g'), '')::bigint nulls last,
          l.entry_no, l.id
        rows between unbounded preceding and current row
      ) as running_balance,
      l.memo,
      l.created_at,
      l.updated_at
    from long_term_repair_ledger l
    where l.building_id = p_building_id
      and l.org_id = v_org
      and l.deleted_at is null
  )
  select
    b.id,
    b.org_id,
    b.building_id,
    b.entry_date,
    b.entry_no,
    b.fund_note,
    b.deposit,
    b.withdrawal,
    b.running_balance,
    b.memo,
    b.created_at,
    b.updated_at
  from balanced b
  where b.entry_date between p_start_date and p_end_date
  order by b.entry_date,
    nullif(regexp_replace(b.entry_no, '\D', '', 'g'), '')::bigint nulls last,
    b.entry_no, b.id;
end
$function$;
