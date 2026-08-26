-- 0105_payment_statement_rpc.sql
-- 수납명세서의 기간×월×공과금 fan-out을 단일 RPC 응답으로 통합한다.
-- 결과는 payment_rows/payments/documents/utilities의 정규화 배열이다.

create or replace function get_payment_statement_data(
  p_building_id bigint,
  p_unit_id bigint,
  p_start_period date,
  p_end_period date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org bigint;
  v_result jsonb;
begin
  v_org := current_user_org();
  if v_org is null then
    raise exception 'no org for caller';
  end if;
  if not exists (
    select 1
    from buildings b
    where b.id = p_building_id
      and b.org_id = v_org
      and b.deleted_at is null
  ) then
    raise exception 'building not in org';
  end if;
  if p_start_period is null
     or p_end_period is null
     or p_start_period <> date_trunc('month', p_start_period)::date
     or p_end_period <> date_trunc('month', p_end_period)::date
     or p_start_period > p_end_period then
    raise exception 'invalid statement period range';
  end if;
  if p_unit_id is not null and not exists (
    select 1
    from units u
    where u.id = p_unit_id
      and u.building_id = p_building_id
      and u.deleted_at is null
  ) then
    raise exception 'unit not in building';
  end if;

  with periods as (
    select generate_series(
      p_start_period::timestamp,
      p_end_period::timestamp,
      interval '1 month'
    )::date as period
  ),
  payment_rows as (
    select periods.period, pr.*
    from periods
    cross join lateral list_payment_rows(p_building_id, periods.period) pr
    where p_unit_id is null or pr.unit_id = p_unit_id
  ),
  statement_units as (
    select pr.period, jsonb_agg(pr.unit_id order by pr.unit_no) as unit_ids
    from payment_rows pr
    group by pr.period
  ),
  documents as (
    select su.period, doc.*
    from statement_units su
    cross join lateral get_bill_documents(
      p_building_id,
      su.period,
      su.unit_ids
    ) doc
  ),
  payment_history as (
    select
      p.id,
      p.unit_id,
      p.period,
      p.amount,
      p.fee,
      p.method,
      p.kind,
      p.memo,
      p.paid_at,
      p.status,
      p.created_at
    from payments p
    join units u on u.id = p.unit_id
    join buildings b
      on b.id = u.building_id
     and b.org_id = v_org
    where u.building_id = p_building_id
      and (p_unit_id is null or p.unit_id = p_unit_id)
      and p.period between p_start_period and p_end_period
  ),
  utility_kinds as (
    select *
    from (values
      ('electricity'::text, 'elec'::text),
      ('water'::text, 'water'::text),
      ('gas'::text, 'gas'::text)
    ) as value(utility_type, db_utility)
  ),
  utility_rows as (
    select periods.period, uk.utility_type, ur.*
    from periods
    cross join utility_kinds uk
    cross join lateral list_utility_rows(
      p_building_id,
      uk.db_utility,
      periods.period
    ) ur
    where p_unit_id is null or ur.unit_id = p_unit_id
  )
  select jsonb_build_object(
    'payment_rows', coalesce((
      select jsonb_agg(to_jsonb(pr) order by pr.period, pr.unit_no)
      from payment_rows pr
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(
        to_jsonb(ph)
        order by
          case when p_unit_id is null then ph.paid_at end asc,
          case when p_unit_id is not null then ph.created_at end desc,
          ph.id desc
      )
      from payment_history ph
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(doc) order by doc.period, doc.unit_no)
      from documents doc
    ), '[]'::jsonb),
    'utilities', jsonb_build_object(
      'electricity', coalesce((
        select jsonb_agg(
          to_jsonb(ur) - 'utility_type'
          order by ur.period, ur.unit_no
        )
        from utility_rows ur
        where ur.utility_type = 'electricity'
      ), '[]'::jsonb),
      'water', coalesce((
        select jsonb_agg(
          to_jsonb(ur) - 'utility_type'
          order by ur.period, ur.unit_no
        )
        from utility_rows ur
        where ur.utility_type = 'water'
      ), '[]'::jsonb),
      'gas', coalesce((
        select jsonb_agg(
          to_jsonb(ur) - 'utility_type'
          order by ur.period, ur.unit_no
        )
        from utility_rows ur
        where ur.utility_type = 'gas'
      ), '[]'::jsonb)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function get_payment_statement_data(bigint, bigint, date, date) from public, anon;
grant execute on function get_payment_statement_data(bigint, bigint, date, date) to authenticated;

