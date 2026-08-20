-- 0073_receipts_edit.sql
-- P2 수납관리·민원접수 세대중심 재설계(편집): 건물 부과시 참조사항·입주자정보(문자/알림톡 동의 포함) 저장 + 수납이력 수수료(fee).
-- receipts 전용 경량 RPC로 공유 save_building/save_unit_occupancy 미변경(건물·입주자 등록 등 타 화면 무영향).
-- 의존: 0004(buildings·save_building), 0001/0023(occupancies·sms_opt_in·alimtalk_opt_in), 0015(payments·record_payment·list_unit_payments).
-- 모듈 게이트: payment. 기존 staff 객체 보존, 추가·확장만.

-- ===== 1. buildings 부과시 참조사항 =====
alter table buildings add column if not exists billing_note text;

-- ===== 2. payments 수수료(수료) =====
alter table payments add column if not exists fee integer not null default 0 check (fee >= 0);

-- ===== 3. record_payment 재정의(+ p_fee) =====
drop function if exists record_payment(bigint, date, int, text, text, text, date);
create or replace function record_payment(
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
    values (v_org, auth.uid(), 'PAYMENT_RECORD', 'payments', v_id::text,
      jsonb_build_object('unit_id',p_unit_id,'period',p_period,'amount',p_amount,'fee',coalesce(p_fee,0),'kind',p_kind,'method',p_method));

  return jsonb_build_object('ok',true,'payment_id',v_id,'charged',v_charged,'paid',v_paid,
    'unpaid', case when v_charged is null then null else v_charged - v_paid end);
end $$;
revoke execute on function record_payment(bigint, date, int, text, text, text, date, int) from public, anon;
grant execute on function record_payment(bigint, date, int, text, text, text, date, int) to authenticated;

-- ===== 4. list_unit_payments 재정의(+ fee) =====
drop function if exists list_unit_payments(bigint, date);
create or replace function list_unit_payments(p_unit_id bigint, p_period date)
returns table(id bigint, amount int, fee int, method text, kind text, memo text,
              paid_at date, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.amount, p.fee, p.method, p.kind, p.memo, p.paid_at, p.status, p.created_at
  from payments p
  join units u on u.id=p.unit_id
  join buildings b on b.id=u.building_id and b.org_id=current_user_org()
  where p.unit_id=p_unit_id and p.period=p_period
  order by p.created_at desc, p.id desc
$$;
revoke execute on function list_unit_payments(bigint, date) from public, anon;
grant execute on function list_unit_payments(bigint, date) to authenticated;

-- ===== 5. receipts 건물 수납메모(memo)·부과시 참조사항(billing_note) 저장 =====
create or replace function receipts_save_building_notes(
  p_building_id bigint, p_memo text, p_billing_note text
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  update buildings set memo = nullif(p_memo,''), billing_note = nullif(p_billing_note,'')
   where id = p_building_id and org_id = v_org and deleted_at is null;
  if not found then raise exception 'building not in org'; end if;
end $$;
revoke execute on function receipts_save_building_notes(bigint, text, text) from public, anon;
grant execute on function receipts_save_building_notes(bigint, text, text) to authenticated;

-- ===== 6. receipts 입주자정보(수납 화면 편집 필드) 저장 =====
-- 수납 화면은 입주자정보 일부만 편집(이름·입금자·전화·입퇴거·적요·부과/출력·문자/알림톡 동의).
-- 검침·계좌·계약 등 나머지는 건물·입주자 등록 화면(save_unit_occupancy)에서 관리 — 여기서 미변경.
create or replace function receipts_save_occupancy_fields(
  p_occupancy_id bigint, p_tenant_name text, p_payer_name text, p_phone text,
  p_move_in_date date, p_move_out_date date, p_note text,
  p_billing_enabled boolean, p_print_enabled boolean,
  p_sms_opt_in boolean, p_alimtalk_opt_in boolean
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  update occupancies o set
    tenant_name = p_tenant_name,
    payer_name = p_payer_name,
    phone = p_phone,
    move_in_date = p_move_in_date,
    move_out_date = p_move_out_date,
    billing_note = p_note,
    billing_enabled = coalesce(p_billing_enabled, o.billing_enabled),
    print_enabled = coalesce(p_print_enabled, o.print_enabled),
    sms_opt_in = coalesce(p_sms_opt_in, o.sms_opt_in),
    alimtalk_opt_in = coalesce(p_alimtalk_opt_in, o.alimtalk_opt_in)
  where o.id = p_occupancy_id and o.deleted_at is null
    and exists (select 1 from units u join buildings b on b.id=u.building_id
                where u.id=o.unit_id and b.org_id=v_org);
  if not found then raise exception 'occupancy not in org'; end if;
end $$;
revoke execute on function receipts_save_occupancy_fields(bigint, text, text, text, date, date, text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function receipts_save_occupancy_fields(bigint, text, text, text, date, date, text, boolean, boolean, boolean, boolean) to authenticated;
