-- 0143_resident_bill_paid_date.sql
-- resident_bill_months에 완납월 납부일(paid_date) 컬럼 추가.
--   paid_date = 해당 월 active 납부(payments)의 max(paid_at); 납부 없으면 null.
-- 세입자앱 관리비 목록의 '{납부일} 납부' 표시용. 0142(late_fee)의 계산은 그대로 보존.
-- 반환 시그니처가 바뀌므로 create or replace 불가 → drop 후 재생성.
-- 의존: 0142(resident_bill_months), 0015(payments.paid_at), 0031(late_fee_rate_tiers).

drop function if exists resident_bill_months();

create function resident_bill_months()
returns table (
  period date,
  total_amount int,
  paid_amount int,
  unpaid_amount int,
  late_fee int,
  paid_date date,
  pay_status text,
  due_date date,
  confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with linked as (
    select * from resident_linked_unit()
  ), amounts as (
    select
      l.org_id,
      bc.period,
      bc.total_amount,
      coalesce(pay.paid_amount, 0)::int as paid_amount,
      greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int as unpaid_amount,
      pay.paid_date,
      issue.due_date,
      bc.confirmed_at
    from linked l
    join billing_confirmations bc
      on bc.unit_id = l.unit_id
     and bc.confirmed_at is not null
    left join lateral (
      select coalesce(sum(p.amount), 0)::int as paid_amount,
             max(p.paid_at) as paid_date
      from payments p
      where p.unit_id = l.unit_id
        and p.period = bc.period
        and p.status = 'active'
    ) pay on true
    left join lateral (
      select bi.due_date
      from bill_issues bi
      where bi.unit_id = l.unit_id
        and bi.period = bc.period
      order by bi.issued_at desc, bi.id desc
      limit 1
    ) issue on true
    where l.move_in is not null
      and bc.period >= date_trunc('month', l.move_in)::date
      and (
        l.move_out is null
        or bc.period <= date_trunc('month', l.move_out)::date
      )
  ), scored as (
    select
      a.*,
      case
        when a.unpaid_amount > 0 and a.due_date is not null then
          greatest(
            (extract(year from timezone('Asia/Seoul', now()))::int - extract(year from a.due_date)::int) * 12
            + (extract(month from timezone('Asia/Seoul', now()))::int - extract(month from a.due_date)::int),
            0
          )
        else 0
      end as months_overdue
    from amounts a
  )
  select
    s.period,
    s.total_amount,
    s.paid_amount,
    s.unpaid_amount,
    round(s.unpaid_amount * lf.cumulative_rate / 100.0)::int as late_fee,
    s.paid_date,
    case
      when s.total_amount > 0 and s.unpaid_amount = 0 then 'paid'
      when s.paid_amount > 0 and s.paid_amount < s.total_amount then 'partial'
      when s.paid_amount = 0 and s.total_amount > 0 then 'unpaid'
      else 'none'
    end as pay_status,
    s.due_date,
    s.confirmed_at
  from scored s
  left join lateral (
    -- 누적요율(%) = Σ_{k=1..months_overdue} rateForMonth(k); tier_order 순 첫 매칭
    select coalesce(sum(
      (
        select t.monthly_rate
        from late_fee_rate_tiers t
        where t.org_id = s.org_id
          and k.k > t.from_month
          and (t.to_month is null or k.k <= t.to_month)
        order by t.tier_order
        limit 1
      )
    ), 0)::numeric as cumulative_rate
    from generate_series(1, greatest(s.months_overdue, 0)) as k(k)
  ) lf on true
  order by s.period desc;
$$;

revoke execute on function resident_bill_months() from anon, public;
grant execute on function resident_bill_months() to authenticated;
