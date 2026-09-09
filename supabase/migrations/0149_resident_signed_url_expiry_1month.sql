-- 0149_resident_signed_url_expiry_1month.sql
-- 무로그인 관리비 상세 서명 URL(0146)의 열람 만료(보관기간)를
-- '부과월(고지월) 1일 + 12개월'(=1년)에서 '납기일 + 1개월'로 단축한다.
--
-- 배경/설계(사용자 재확정 2026-09-09):
--   * 0146은 만료를 부과월 1일 기준 +12개월로 잡았으나, 실제 보관기간은 한 달이면 충분.
--   * 기준점을 '납기일(due_date) + 1개월'로 바꿔, 세입자가 링크를 받는 시점(고지·납기)에서
--     안정적으로 약 한 달간 열람 가능하도록 한다(부과월 1일 기준이면 월 중·후반 고지 시
--     열람 창이 며칠로 짧아지거나, 익월 고지 시 발급 즉시 만료될 수 있어 회피).
--   * 납기일이 없는 경우(bill_issues 미존재)에는 부과월 1일로 폴백해 +1개월을 보장한다.
--   * 만료 후 UX(금액·항목·계좌 마스킹, is_expired)와 반환 시그니처는 0146과 동일.
--
-- 변경점: public_bill_by_signed 만 재정의(HMAC 서명원 bill_signature·app_secrets·발급 RPC 무변경).
--   만료 계산을 sig CTE(함수 파라미터만 접근)에서 빼고, due_date가 확정된 뒤의 lateral(exp)로
--   옮겨 납기일을 참조한다. 나머지 SELECT/조인은 0146과 동일.
--
-- 의존: 0146(public_bill_by_signed·bill_signature), 0144(항목/연체료 정본 SELECT).

create or replace function public_bill_by_signed(
  p_building_id bigint,
  p_unit_no text,
  p_period date,
  p_sig text
)
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
  with sig as (
    select
      (p_sig is not null and p_sig = bill_signature(p_building_id, p_unit_no, p_period)) as ok
  )
  select
    bc.period,
    b.name,
    u.unit_no,
    case when now() < exp.expires_at then bc.total_amount else null end,
    case when now() < exp.expires_at then coalesce(pay.paid_amount, 0)::int else null end,
    case
      when now() < exp.expires_at
      then greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int
      else null
    end,
    case
      when now() < exp.expires_at
      then round(
        greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate / 100.0
      )::int
      else null
    end,
    case when now() < exp.expires_at then issue.due_date else null end,
    case
      when now() < exp.expires_at
      then coalesce(charges.items, '[]'::jsonb)
      else null
    end,
    case when now() < exp.expires_at then sc.mgmt_bank1 else null end,
    case when now() < exp.expires_at then sc.mgmt_acct1 else null end,
    case when now() < exp.expires_at then sc.mgmt_holder1 else null end,
    exp.expires_at,
    now() >= exp.expires_at
  from sig
  join buildings b on b.id = p_building_id
  join units u
    on u.building_id = b.id
   and u.unit_no = p_unit_no
   and u.deleted_at is null
  join billing_confirmations bc
    on bc.unit_id = u.id
   and bc.period = p_period
   and bc.confirmed_at is not null
  left join setup_config sc on sc.org_id = b.org_id
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from payments p
    where p.unit_id = u.id
      and p.period = bc.period
      and p.status = 'active'
  ) pay on true
  left join lateral (
    select bi.due_date
    from bill_issues bi
    where bi.unit_id = u.id
      and bi.period = bc.period
    order by bi.issued_at desc, bi.id desc
    limit 1
  ) issue on true
  left join lateral (
    -- 열람 만료 = 납기일 + 1개월. 납기일이 없으면 부과월 1일로 폴백해 ~1개월 창을 보장.
    -- (0146의 '부과월 1일 + 12개월'을 사용자 재확정 2026-09-09로 대체)
    select (
      coalesce(issue.due_date, date_trunc('month', p_period)::date) + interval '1 month'
    )::timestamptz as expires_at
  ) exp on true
  left join lateral (
    -- 누적요율(%) = Σ_{k=1..months_overdue} rateForMonth(k); tier_order 순 첫 매칭 (0144와 동일)
    select coalesce(sum(
      (
        select t.monthly_rate
        from late_fee_rate_tiers t
        where t.org_id = b.org_id
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
    -- 항목: fee_item_charges(charged=true) + 개별 사용료 검침(당월/전월). 0144와 동일 shape.
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
    where fic.unit_id = u.id
      and fic.period = bc.period
      and fic.charged = true
  ) charges on true
  where sig.ok;
$$;

revoke execute on function public_bill_by_signed(bigint, text, date, text) from public;
grant execute on function public_bill_by_signed(bigint, text, date, text) to anon, authenticated;
