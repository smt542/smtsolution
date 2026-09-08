-- 0144_resident_bill_detail_usage_late.sql
-- 세입자앱 관리비 상세(/resident/bill/[period]) 완전 정본 정합.
-- resident_bill_detail·public_bill_by_token 두 RPC에 다음을 부착한다:
--   (1) late_fee — 월 목록 RPC(0142/0143)와 정확히 동일한 산식.
--       months = max((asOf.y-due.y)*12 + (asOf.m-due.m), 0)  (미납원금>0·납기 있는 월만),
--       누적요율(%) = Σ_{k=1..months} (k에 매칭되는 late_fee_rate_tiers.monthly_rate;
--                     tier_order 순 첫 매칭, 없으면 0),
--       late_fee = round(unpaid_principal * 누적요율 / 100). asOf = 현재 Asia/Seoul.
--   (2) items(부과 항목)에 검침/분류 부착 —
--       utility: fee_items.name 매칭(수도→water/전기→elec/가스→gas, else null),
--       usage:      당월 meter_readings.usage,
--       prev_usage: 전월 meter_readings.usage.
--       프런트가 utility≠null→개별 사용료, null→공용·기타로 분리 렌더한다.
-- 항목 소스는 fee_item_charges(charged=true)로 통일한다. billing_history.items 경로는
--   fee_item_id·검침을 담지 못하므로 상세에서는 사용하지 않는다(정본=최신 확정 기준).
-- 반환 시그니처가 바뀌므로 create or replace 불가 → drop 후 재생성.
-- 의존: 0040(resident_bill_detail·public_bill_by_token·resident_linked_unit·bill_share_tokens),
--       0007(meter_readings), 0031(late_fee_rate_tiers), 0142/0143(월 RPC late_fee 산식).

-- ===== resident_bill_detail (로그인 세입자) =====
drop function if exists resident_bill_detail(date);

create function resident_bill_detail(p_period date)
returns table (
  period date,
  building_name text,
  unit_no text,
  tenant_name text,
  total_amount int,
  paid_amount int,
  unpaid_amount int,
  late_fee int,
  due_date date,
  confirmed_at timestamptz,
  items jsonb,
  mgmt_bank text,
  mgmt_acct text,
  mgmt_holder text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with linked as (
    select * from resident_linked_unit()
  )
  select
    bc.period,
    b.name,
    u.unit_no,
    l.tenant_name,
    bc.total_amount,
    coalesce(pay.paid_amount, 0)::int,
    greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int,
    round(
      greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate / 100.0
    )::int as late_fee,
    issue.due_date,
    bc.confirmed_at,
    coalesce(charges.items, '[]'::jsonb),
    sc.mgmt_bank1,
    sc.mgmt_acct1,
    sc.mgmt_holder1
  from linked l
  join units u on u.id = l.unit_id
  join buildings b on b.id = l.building_id and b.org_id = l.org_id
  join billing_confirmations bc
    on bc.unit_id = l.unit_id
   and bc.period = p_period
   and bc.confirmed_at is not null
  left join setup_config sc on sc.org_id = l.org_id
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
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
  left join lateral (
    -- 누적요율(%) = Σ_{k=1..months_overdue} rateForMonth(k); tier_order 순 첫 매칭
    select coalesce(sum(
      (
        select t.monthly_rate
        from late_fee_rate_tiers t
        where t.org_id = l.org_id
          and k.k > t.from_month
          and (t.to_month is null or k.k <= t.to_month)
        order by t.tier_order
        limit 1
      )
    ), 0)::numeric as cumulative_rate
    from generate_series(1,
      case
        when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0
             and issue.due_date is not null
        then greatest(
          (extract(year from timezone('Asia/Seoul', now()))::int - extract(year from issue.due_date)::int) * 12
          + (extract(month from timezone('Asia/Seoul', now()))::int - extract(month from issue.due_date)::int),
          0
        )
        else 0
      end
    ) as k(k)
  ) lf on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'fee_item_id', fic.fee_item_id,
        'name', fi.name,
        'amount', fic.amount,
        'charged', fic.charged,
        'utility', util.u,
        'usage', mr.usage,
        'prev_usage', prev.usage
      ) order by fi.sort_order, fi.id
    ) as items
    from fee_item_charges fic
    join fee_items fi on fi.id = fic.fee_item_id
    cross join lateral (
      select case
        when fi.name like '%수도%' then 'water'
        when fi.name like '%전기%' then 'elec'
        when fi.name like '%가스%' then 'gas'
        else null
      end as u
    ) util
    left join meter_readings mr
      on mr.unit_id = fic.unit_id
     and mr.period = fic.period
     and mr.utility = util.u
    left join meter_readings prev
      on prev.unit_id = fic.unit_id
     and prev.period = (fic.period - interval '1 month')::date
     and prev.utility = util.u
    where fic.unit_id = l.unit_id
      and fic.period = bc.period
      and fic.charged = true
  ) charges on true
  where l.move_in is not null
    and p_period >= date_trunc('month', l.move_in)::date
    and (
      l.move_out is null
      or p_period <= date_trunc('month', l.move_out)::date
    );
$$;

-- ===== public_bill_by_token (무로그인 공개 링크) =====
-- 만료 시 금액·항목·계좌를 null 마스킹(원본 0040 동작 유지). tenant PII 미노출.
drop function if exists public_bill_by_token(uuid);

create function public_bill_by_token(p_token uuid)
returns table (
  period date,
  building_name text,
  unit_no text,
  total_amount int,
  paid_amount int,
  unpaid_amount int,
  late_fee int,
  due_date date,
  items jsonb,
  mgmt_bank text,
  mgmt_acct text,
  mgmt_holder text,
  expires_at timestamptz,
  is_expired boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    bst.period,
    b.name,
    u.unit_no,
    case when bst.expires_at > now() then bc.total_amount else null end,
    case when bst.expires_at > now() then coalesce(pay.paid_amount, 0)::int else null end,
    case
      when bst.expires_at > now()
      then greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int
      else null
    end,
    case
      when bst.expires_at > now()
      then round(
        greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate / 100.0
      )::int
      else null
    end,
    case when bst.expires_at > now() then issue.due_date else null end,
    case
      when bst.expires_at > now()
      then coalesce(charges.items, '[]'::jsonb)
      else null
    end,
    case when bst.expires_at > now() then sc.mgmt_bank1 else null end,
    case when bst.expires_at > now() then sc.mgmt_acct1 else null end,
    case when bst.expires_at > now() then sc.mgmt_holder1 else null end,
    bst.expires_at,
    bst.expires_at <= now()
  from bill_share_tokens bst
  join units u on u.id = bst.unit_id
  join buildings b on b.id = u.building_id and b.org_id = bst.org_id
  left join billing_confirmations bc
    on bc.unit_id = bst.unit_id
   and bc.period = bst.period
   and bc.confirmed_at is not null
  left join setup_config sc on sc.org_id = bst.org_id
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from payments p
    where p.unit_id = bst.unit_id
      and p.period = bst.period
      and p.status = 'active'
  ) pay on true
  left join lateral (
    select bi.due_date
    from bill_issues bi
    where bi.unit_id = bst.unit_id
      and bi.period = bst.period
    order by bi.issued_at desc, bi.id desc
    limit 1
  ) issue on true
  left join lateral (
    -- 누적요율(%) = Σ_{k=1..months_overdue} rateForMonth(k); tier_order 순 첫 매칭
    select coalesce(sum(
      (
        select t.monthly_rate
        from late_fee_rate_tiers t
        where t.org_id = bst.org_id
          and k.k > t.from_month
          and (t.to_month is null or k.k <= t.to_month)
        order by t.tier_order
        limit 1
      )
    ), 0)::numeric as cumulative_rate
    from generate_series(1,
      case
        when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0
             and issue.due_date is not null
        then greatest(
          (extract(year from timezone('Asia/Seoul', now()))::int - extract(year from issue.due_date)::int) * 12
          + (extract(month from timezone('Asia/Seoul', now()))::int - extract(month from issue.due_date)::int),
          0
        )
        else 0
      end
    ) as k(k)
  ) lf on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'name', fi.name,
        'amount', fic.amount,
        'utility', util.u,
        'usage', mr.usage,
        'prev_usage', prev.usage
      ) order by fi.sort_order, fi.id
    ) as items
    from fee_item_charges fic
    join fee_items fi on fi.id = fic.fee_item_id
    cross join lateral (
      select case
        when fi.name like '%수도%' then 'water'
        when fi.name like '%전기%' then 'elec'
        when fi.name like '%가스%' then 'gas'
        else null
      end as u
    ) util
    left join meter_readings mr
      on mr.unit_id = fic.unit_id
     and mr.period = fic.period
     and mr.utility = util.u
    left join meter_readings prev
      on prev.unit_id = fic.unit_id
     and prev.period = (fic.period - interval '1 month')::date
     and prev.utility = util.u
    where fic.unit_id = bst.unit_id
      and fic.period = bst.period
      and fic.charged = true
  ) charges on true
  where bst.token = p_token;
$$;

-- ===== RPC privileges (drop 후 재생성이므로 재부여) =====
revoke execute on function resident_bill_detail(date) from anon, public;
grant execute on function resident_bill_detail(date) to authenticated;
revoke execute on function public_bill_by_token(uuid) from public;
grant execute on function public_bill_by_token(uuid) to anon, authenticated;
