-- supabase/verify/p5_overpayment_checks.sql — QA #31 전월과수납(0350) 검증. 실패 시 raise.

-- (a) 모든 building_type 에 전월과수납 시스템 항목 1건·잠금 상태
do $$ begin
  if exists (
    select 1 from building_types bt
     where (select count(*) from fee_items fi
             where fi.type_id = bt.id and fi.system_code = 'prev_overpay' and fi.name = '전월과수납'
               and fi.deleted_at is null and not fi.is_required and not fi.carry_over and not fi.daily_proration) <> 1
  ) then raise exception '(a) 전월과수납 시스템 항목이 없거나 잠금 조건과 다른 건물 유형이 있음'; end if;
  if exists (select 1 from fee_item_charges fic join fee_items fi on fi.id = fic.fee_item_id where fi.system_code is not null)
    then raise exception '(a) 시스템 항목 금액이 fee_item_charges 에 저장됨'; end if;
end $$;

-- (b) 이름 변경은 예외, 소프트삭제는 체크 제약 위반, 하드삭제는 즉시 복구(롤백 블록)
do $$
declare v_type bigint; v_ok boolean;
begin
  select type_id into v_type from fee_items where system_code = 'prev_overpay' limit 1;
  if v_type is null then return; end if;
  begin
    update fee_items set name = '__rename' where type_id = v_type and system_code = 'prev_overpay';
    v_ok := true;
  exception when others then v_ok := false; end;
  if v_ok then raise exception '(b) 시스템 항목 이름 변경이 허용됨'; end if;
  begin
    update fee_items set deleted_at = now() where type_id = v_type and system_code = 'prev_overpay';
    v_ok := true;
  exception when check_violation then v_ok := false; end;
  if v_ok then raise exception '(b) 시스템 항목 소프트삭제가 허용됨'; end if;
  begin
    delete from fee_items where type_id = v_type and system_code = 'prev_overpay';
    if not exists (select 1 from fee_items where type_id = v_type and system_code = 'prev_overpay' and deleted_at is null)
      then raise exception '(b) 하드삭제 후 복구 안 됨'; end if;
    raise exception 'rollback_probe';
  exception when raise_exception then
    if sqlerrm <> 'rollback_probe' then raise; end if;
  end;
end $$;

-- (c) 원장 금액 = 그 달 초과 수납(수납 − 당월계 − 연체료) 재계산 값과 일치(환급 건 제외)
do $$ begin
  if exists (
    select 1 from unit_overpayments o
     where o.status <> 'refunded' and o.amount <> greatest(overpayment_excess(o.unit_id, o.source_period), 0)
  ) then raise exception '(c) unit_overpayments.amount 가 overpayment_excess 재계산과 다름'; end if;
end $$;

-- (d) 같은 과수납이 적용 금액 합계로 원 금액을 넘지 않고, (과수납, 적용월) 은 한 건
do $$ begin
  if exists (
    select 1 from unit_overpayments o
      join (select overpayment_id, sum(amount) s from unit_overpayment_applications group by 1) a on a.overpayment_id = o.id
     where a.s > o.amount and o.status <> 'canceled'
  ) then raise exception '(d) 과수납 적용 합계가 원 금액을 초과(취소 후 재확정 필요 건 제외)'; end if;
  if exists (select 1 from unit_overpayment_applications group by overpayment_id, applied_period having count(*) > 1)
    then raise exception '(d) 같은 과수납이 같은 달에 두 번 적용됨'; end if;
end $$;

-- (e) 확정 고지 총액은 음수가 아니고, 전월과수납 항목 금액 = 그 달 적용 합계(최신 스냅샷 기준)
do $$ begin
  if exists (select 1 from billing_confirmations where confirmed_at is not null and total_amount < 0)
    then raise exception '(e) 확정 총액이 음수인 세대가 있음'; end if;
  if exists (
    select 1
      from (select distinct on (h.unit_id, h.period) h.unit_id, h.period, h.items
              from billing_history h order by h.unit_id, h.period, h.confirmed_at desc, h.id desc) bh
      join (select unit_id, applied_period, sum(amount) s from unit_overpayment_applications group by 1, 2) a
        on a.unit_id = bh.unit_id and a.applied_period = bh.period
     where coalesce((select sum((e->>'amount')::int) from jsonb_array_elements(bh.items) e
                      where e->>'name' = '전월과수납'), 0) <> -a.s
  ) then raise exception '(e) 고지 스냅샷 전월과수납 금액과 적용 원장이 다름'; end if;
end $$;

-- 수동 점검(롤백 트랜잭션, report 참고):
--  1) 미납 27만 세대에 30만 수납(납기일 수납) → unit_overpayments open 30,000.
--  2) 익월 confirm_billing → billing_history.items 에 전월과수납 -30000, total 30,000 감소, status applied.
--  3) 같은 달 재확정 → 적용 1건·금액 동일(멱등). 그 달 다른 항목 합계 < 잔액이면 합계만큼만 차감, 잔여 open.
--  4) 수납 취소 → canceled, list_billing.is_dirty=true. 재확정 → 전월과수납 0, 적용 0건. 되살리기 → 다시 open.
--  5) 이전 달 미납이 있는 세대에 선택 달 미납 초과 입금 → 오래된 달부터 「YYYY-MM 입금 배분」 행으로 나눠 기록.
