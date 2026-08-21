-- 0090_partner_tenant_billing.sql
-- 파트너 모바일 입주자 상세: 수납정보·이사정산 이력 읽기 RPC (뷰어 전용).
-- 기존 staff 테이블(payments/billing_confirmations/bill_issues/moving_settlements)을
-- 담당 건물(partner_my_building_ids, 0062) 스코프로 읽기만 한다. 기존 staff RLS/정책/화면 불변, 신규 함수만.
-- 의존: 0062(partner_my_building_ids), P1a(units/occupancies), P5(billing_confirmations),
--       P5 bill_publish(bill_issues), P6(payments), P7a(moving_settlements).

-- 세대 월별 수납 이력(당월계·기한·수납액·연체·수납일자·구분·비고).
-- 기간 = 부과확정(billing_confirmations) ∪ 수납(payments) 월의 합집합.
-- 참고: payments 스키마에는 수수료/은행 컬럼이 없어 해당 항목은 반환하지 않는다(구분=method로 대체).
create or replace function partner_list_unit_payments(p_unit_id bigint)
returns table (
  period date,
  due_date date,
  charged integer,
  paid integer,
  unpaid integer,
  last_paid_at date,
  methods text,
  memo text
)
language sql stable security definer set search_path = public as $$
  with authz as (
    select u.id as unit_id
    from units u
    where u.id = p_unit_id
      and u.building_id in (select partner_my_building_ids())
  ),
  months as (
    select distinct period from (
      select bc.period from billing_confirmations bc
        where bc.unit_id in (select unit_id from authz)
      union all
      select p.period from payments p
        where p.unit_id in (select unit_id from authz) and p.status = 'active'
    ) x
  )
  select
    m.period,
    (select min(bi.due_date) from bill_issues bi
       where bi.unit_id in (select unit_id from authz) and bi.period = m.period),
    coalesce((select bc.total_amount from billing_confirmations bc
       where bc.unit_id in (select unit_id from authz) and bc.period = m.period), 0),
    coalesce((select sum(pp.amount)::int from payments pp
       where pp.unit_id in (select unit_id from authz) and pp.period = m.period and pp.status = 'active'), 0),
    greatest(
      coalesce((select bc.total_amount from billing_confirmations bc
         where bc.unit_id in (select unit_id from authz) and bc.period = m.period), 0)
      - coalesce((select sum(pp.amount)::int from payments pp
         where pp.unit_id in (select unit_id from authz) and pp.period = m.period and pp.status = 'active'), 0),
      0),
    (select max(pp.paid_at) from payments pp
       where pp.unit_id in (select unit_id from authz) and pp.period = m.period and pp.status = 'active'),
    (select string_agg(distinct pp.method, ',') from payments pp
       where pp.unit_id in (select unit_id from authz) and pp.period = m.period and pp.status = 'active'),
    (select string_agg(mm.memo, ' / ') from (
        select nullif(pp.memo, '') as memo
        from payments pp
        where pp.unit_id in (select unit_id from authz) and pp.period = m.period
          and pp.status = 'active' and nullif(pp.memo, '') is not null
        order by pp.paid_at
      ) mm)
  from months m
  order by m.period desc;
$$;
revoke execute on function partner_list_unit_payments(bigint) from anon;

-- 세대 이사정산 이력(상태·정산액·퇴실일·등록일자). 이름은 정산 시점 입주자명(occupancies).
-- 상태: completed = 완료, 그 외(draft/saved/mid_moveout) = 미결.
create or replace function partner_list_unit_settlements(p_unit_id bigint)
returns table (
  id bigint,
  tenant_name text,
  status text,
  settlement_amount integer,
  move_out_date date,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, o.tenant_name, s.status, s.settlement_amount, s.move_out_date, s.created_at
  from moving_settlements s
  join units u on u.id = s.unit_id and u.building_id in (select partner_my_building_ids())
  left join occupancies o on o.id = s.occupancy_id
  where s.unit_id = p_unit_id
  order by s.created_at desc;
$$;
revoke execute on function partner_list_unit_settlements(bigint) from anon;
