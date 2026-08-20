-- 0074_payment_edit_atomic.sql
-- 수납 '수정'을 단일 트랜잭션으로: 기존 수납 취소 + 새 수납 기록을 한 함수에서 원자적 처리.
-- (기존: 클라이언트에서 cancel_payment→record_payment 2회 호출 → 취소만 성공/재기록 실패 시 정합성 위험)
-- 의존: 0015(payments·cancel_payment·record_payment), 0073(payments.fee·record_payment+p_fee).
-- 모듈 게이트: payment. 기존 record_payment/cancel_payment 불변, 신규 함수만 추가.

create or replace function record_payment_edit(
  p_old_payment_id bigint,
  p_unit_id bigint, p_period date, p_amount int,
  p_method text, p_kind text, p_memo text, p_paid_at date, p_fee int default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_occ bigint; v_id bigint; v_charged int; v_paid int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if not exists (select 1 from units u join buildings b on b.id=u.building_id
                 where u.id=p_unit_id and b.org_id=v_org and u.deleted_at is null) then
    raise exception 'unit not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'amount must be positive'; end if;
  if coalesce(p_fee,0) < 0 then raise exception 'fee must be >= 0'; end if;
  if p_method not in ('cash','transfer','auto_debit','giro','card','other') then raise exception 'invalid method'; end if;
  if p_kind not in ('full','principal','partial') then raise exception 'invalid kind'; end if;

  -- 1) 기존 수납 취소 (본인 org·동일 세대·active만)
  update payments p set status='canceled', canceled_at=now(), canceled_by=auth.uid()
   where p.id=p_old_payment_id and p.status='active' and p.org_id=v_org and p.unit_id=p_unit_id
     and exists (select 1 from units u join buildings b on b.id=u.building_id
                 where u.id=p.unit_id and b.org_id=v_org);
  if not found then raise exception 'original payment not found or already canceled'; end if;

  -- 2) 새 수납 기록 (같은 트랜잭션 — 실패 시 취소도 롤백)
  select o.id into v_occ from occupancies o
   where o.unit_id=p_unit_id and o.deleted_at is null
   order by o.created_at desc, o.id desc limit 1;

  insert into payments(org_id, unit_id, period, occupancy_id, amount, fee, method, kind, memo, paid_at, source, created_by)
    values (v_org, p_unit_id, p_period, v_occ, p_amount, coalesce(p_fee,0), p_method, p_kind, nullif(p_memo,''),
            coalesce(p_paid_at, current_date), 'manual', auth.uid())
    returning id into v_id;

  select bc.total_amount into v_charged from billing_confirmations bc
    where bc.unit_id=p_unit_id and bc.period=p_period;
  select coalesce(sum(amount),0)::int into v_paid from payments
    where unit_id=p_unit_id and period=p_period and status='active';

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_EDIT', 'payments', v_id::text,
      jsonb_build_object('old_id',p_old_payment_id,'unit_id',p_unit_id,'period',p_period,
                         'amount',p_amount,'fee',coalesce(p_fee,0),'kind',p_kind,'method',p_method));

  return jsonb_build_object('ok',true,'payment_id',v_id,'canceled_id',p_old_payment_id,
    'charged',v_charged,'paid',v_paid,
    'unpaid', case when v_charged is null then null else v_charged - v_paid end);
end $$;
revoke execute on function record_payment_edit(bigint, bigint, date, int, text, text, text, date, int) from public, anon;
grant execute on function record_payment_edit(bigint, bigint, date, int, text, text, text, date, int) to authenticated;
