-- 0021_fix_billing_calc.sql
-- 계산규칙서(_calculation-rules.md) 정합화:
--   1.2 반올림 = 10원 단위(절상/4사5입/절하), 그대로(raw)는 반올림 미적용
--   1.1 일할 분모 = 그 달 일수와 무관하게 고정 30일
-- 0012_p5_billing.sql의 round_charge·confirm_billing 은 이미 라이브 적용되어 직접 수정하지 않고,
-- 여기서 create or replace 로 재정의한다(시그니처·권한 동일).

-- ===== 우수리 헬퍼: 10원 단위, raw(그대로)는 반올림 미적용 =====
create or replace function round_charge(p_value numeric, p_rounding text)
returns int language sql immutable as $$
  select case p_rounding
    when 'raw'  then p_value                     -- 그대로: 10원 반올림 미적용
    when 'up'   then ceil(p_value / 10.0) * 10   -- 절상: 무조건 10원 올림
    when 'down' then floor(p_value / 10.0) * 10  -- 절하: 무조건 10원 내림
    else round(p_value / 10.0) * 10              -- 4사5입: 10원 단위 반올림
  end::int;
$$;
revoke execute on function round_charge(numeric, text) from public, anon;
grant execute on function round_charge(numeric, text) to authenticated;

-- ===== 부과 확정: 일할 분모를 고정 30일로(302행 v_days → 30) =====
create or replace function confirm_billing(p_building_id bigint, p_period date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint; v_unit record; v_item record;
  v_items jsonb; v_total bigint; v_amt int;
  v_days int; v_occupied int; v_count int := 0; v_grand bigint := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('billing') then raise exception 'forbidden: billing required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed'; end if;

  v_days := extract(day from ((p_period + interval '1 month')::date - 1))::int;

  for v_unit in
    select u.id as unit_id, occ.id as occ_id, occ.tenant_name, occ.move_in_date, occ.status
    from units u
    left join lateral (
      select * from occupancies o where o.unit_id = u.id and o.deleted_at is null
      order by o.created_at desc, o.id desc limit 1
    ) occ on true
    where u.building_id = p_building_id and u.deleted_at is null
  loop
    if coalesce(v_unit.status = 'vacant', true) then continue; end if;  -- 공실 제외

    if v_unit.move_in_date is not null
       and v_unit.move_in_date between p_period and ((p_period + interval '1 month')::date - 1) then
      v_occupied := ((p_period + interval '1 month')::date - v_unit.move_in_date);  -- 입주일 포함
    else
      v_occupied := v_days;
    end if;

    v_items := '[]'::jsonb; v_total := 0;
    for v_item in
      select
        fi.id as fee_item_id,
        fi.name,
        coalesce(fic.amount, case when fi.carry_over then prev.amount else 0 end, 0) as amount,
        fi.daily_proration,
        fi.rounding
      from buildings b
      join fee_items fi
        on fi.type_id = b.type_id and fi.org_id = v_org and fi.deleted_at is null
      left join fee_item_charges fic
        on fic.unit_id = v_unit.unit_id and fic.fee_item_id = fi.id and fic.period = p_period
      left join fee_item_charges prev
        on prev.unit_id = v_unit.unit_id and prev.fee_item_id = fi.id
       and prev.period = (p_period - interval '1 month')::date
      where b.id = p_building_id and coalesce(fic.charged, true)
      order by fi.sort_order, fi.id
    loop
      if v_item.daily_proration and v_occupied < v_days then
        -- 계산규칙 1.1: 일할 분모 고정 30일(중간입주 판정은 v_days 유지)
        v_amt := round_charge(v_item.amount::numeric * v_occupied / 30, v_item.rounding);
      else
        v_amt := v_item.amount;
      end if;
      v_items := v_items || jsonb_build_object('fee_item_id', v_item.fee_item_id, 'name', v_item.name, 'charged', true, 'amount', v_amt);
      v_total := v_total + v_amt;
    end loop;

    insert into billing_confirmations(unit_id, period, occupancy_id, total_amount, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_total, now(), auth.uid())
      on conflict (unit_id, period) do update
        set occupancy_id = excluded.occupancy_id, total_amount = excluded.total_amount,
            confirmed_at = excluded.confirmed_at, confirmed_by = excluded.confirmed_by;

    insert into billing_history(unit_id, period, occupancy_id, tenant_name, total_amount, items, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_unit.tenant_name, v_total, v_items, now(), auth.uid());

    v_count := v_count + 1; v_grand := v_grand + v_total;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILLING_CONFIRM', 'billing_confirmations', p_building_id::text,
      jsonb_build_object('period', p_period, 'unit_count', v_count, 'total', v_grand));

  return jsonb_build_object('unit_count', v_count, 'total', v_grand);
end $$;
revoke execute on function confirm_billing(bigint, date) from public, anon;
grant execute on function confirm_billing(bigint, date) to authenticated;
