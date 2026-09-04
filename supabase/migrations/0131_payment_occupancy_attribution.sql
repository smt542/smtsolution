-- 0131_payment_occupancy_attribution.sql
-- C3) 수납 귀속 세대(occupancy_id) 오귀속 교정 (payments 도메인 한정)
--
-- 문제: record_payment / record_bank_payments / record_payment_edit 세 개의 수납 기록 RPC가
--   부과된 월분(period)과 무관하게 "가장 최근 occupancy"(order by created_at desc, id desc limit 1)로
--   payments.occupancy_id 를 스탬프했다. 세대가 월 중간에 교체(turnover)되면, 이전 입주자의 부과분을
--   납부한 수납이 새 입주자의 occupancy_id 로 찍힌다.
--   반면 list_overdue_periods / list_overdue_aggregates 는 payments 를 확정부과(billing_confirmations)에
--   occupancy_id 로 조인하므로, 이전 입주자 월분은 상쇄되지 않아 미납/연체료가 과대 집계되고
--   (세대 단위 화면은 납부됨으로 보여) 두 원장이 같은 돈에 대해 서로 다른 값을 보고한다.
--
-- 수정: (unit, period) 로 수납을 기록할 때, 그 월분에 확정부과가 존재하면 부과가 이뤄진 occupancy
--   (= billing_confirmations.occupancy_id, unit_id+period 유니크라 단일)로 귀속시킨다.
--   확정부과가 없는 월분(선납·미부과분)에 한해서만 기존 "가장 최근 occupancy" 로직으로 폴백한다
--   (미부과분/선납 수납 기록을 깨지 않기 위함).
--
-- 드리프트 안전: 각 함수는 최신 정의(record_payment=0073, record_bank_payments·record_payment_edit=0129)를
--   기준으로 재정의하며, occupancy 조회 부분만 교체한다. 나머지 검증·audit_log·반환형·grant/revoke·
--   멱등 인덱스(ON CONFLICT)·원본 provenance 승계 로직은 전부 보존한다.
-- 조회측(list_overdue_periods 0031 / list_overdue_aggregates 0022)은 이미 (occupancy_id, period) 로
--   조인하므로, 귀속만 바로잡히면 자동으로 정합해진다 → 조회 RPC는 변경하지 않는다.
--
-- 의존: 0012(billing_confirmations, unique(unit_id, period)), 0073(record_payment/payments.fee),
--       0129(record_bank_payments 멱등 인덱스·record_payment_edit provenance 승계).
-- 모듈 게이트: payment. 다른 도메인/화면 무영향.

-- ============================================================================
-- 1) record_payment 재정의 (기준: 0073). 수동 수납/원금/분할 + method='giro' 지로 수납의 기록 경로.
--    변경점: occupancy 조회를 "부과된 occupancy 우선 + 미부과 시 최근 occupancy 폴백"으로 교체.
-- ============================================================================
drop function if exists record_payment(bigint, date, int, text, text, text, date, int);
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

  -- 귀속: 해당 (unit, period) 확정부과가 있으면 그 부과 occupancy 로, 없으면 최근 occupancy 로 폴백.
  select bc.occupancy_id into v_occ from billing_confirmations bc
   where bc.unit_id=p_unit_id and bc.period=p_period;
  if v_occ is null then
    select o.id into v_occ from occupancies o
     where o.unit_id=p_unit_id and o.deleted_at is null
     order by o.created_at desc, o.id desc limit 1;
  end if;

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

-- ============================================================================
-- 2) record_bank_payments 재정의 (기준: 0129). 은행 입금내역 엑셀 자동매칭 수납.
--    변경점: 루프 내 occupancy 조회를 부과-우선 폴백으로 교체. 멱등 인덱스/ON CONFLICT/카운트 로직 불변.
-- ============================================================================
create or replace function record_bank_payments(p_building_id bigint, p_period date, p_entries jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_item jsonb; v_unit bigint; v_amount int; v_occ bigint;
        v_paid_at date; v_memo text; v_id bigint;
        v_recorded int := 0; v_skipped int := 0; v_duplicate int := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('payment') then raise exception 'forbidden: payment required'; end if;
  if not exists (select 1 from buildings where id=p_building_id and org_id=v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if jsonb_typeof(coalesce(p_entries,'[]'::jsonb)) is distinct from 'array' then
    raise exception 'entries must be an array'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_entries,'[]'::jsonb)) loop
    v_unit := nullif(v_item->>'unit_id','')::bigint;
    v_amount := nullif(v_item->>'amount','')::int;
    if v_unit is null or coalesce(v_amount,0) <= 0 then v_skipped := v_skipped + 1; continue; end if;
    if not exists (select 1 from units uu join buildings b on b.id=uu.building_id
                   where uu.id=v_unit and uu.building_id=p_building_id and b.org_id=v_org and uu.deleted_at is null) then
      v_skipped := v_skipped + 1; continue; end if;
    -- 귀속: 해당 (unit, period) 확정부과 occupancy 우선, 없으면 최근 occupancy 폴백.
    select bc.occupancy_id into v_occ from billing_confirmations bc
      where bc.unit_id=v_unit and bc.period=p_period;
    if v_occ is null then
      select o.id into v_occ from occupancies o where o.unit_id=v_unit and o.deleted_at is null
        order by o.created_at desc, o.id desc limit 1;
    end if;

    v_paid_at := coalesce(nullif(v_item->>'paid_at','')::date, current_date);
    v_memo := nullif(v_item->>'memo','');

    -- 멱등: 동일 논리키(org·unit·period·amount·paid_at·memo)의 active 은행수납이 이미 있으면 스킵(재업로드 이중 반영 방지).
    insert into payments(org_id, unit_id, period, occupancy_id, amount, method, kind, memo, paid_at, source, created_by)
      values (v_org, v_unit, p_period, v_occ, v_amount, 'transfer', 'full', v_memo,
              v_paid_at, 'bank_excel', auth.uid())
      on conflict (org_id, unit_id, period, amount, paid_at, coalesce(memo, ''))
        where source = 'bank_excel' and status = 'active'
      do nothing
      returning id into v_id;

    if v_id is null then
      v_duplicate := v_duplicate + 1;   -- 이미 존재 → 스킵
    else
      v_recorded := v_recorded + 1;
    end if;
    v_id := null;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_BANK_IMPORT', 'payments', p_building_id::text,
      jsonb_build_object('period', p_period, 'recorded', v_recorded,
                         'skipped', v_skipped, 'duplicate', v_duplicate));

  -- skipped = 무효행(단위 없음/금액 0/건물 밖) + 중복행. duplicate는 별도로도 노출해 UI가 "이미 반영됨"을 구분.
  return jsonb_build_object('recorded', v_recorded,
                            'skipped', v_skipped + v_duplicate,
                            'duplicate', v_duplicate);
end $$;
revoke execute on function record_bank_payments(bigint, date, jsonb) from public, anon;
grant execute on function record_bank_payments(bigint, date, jsonb) to authenticated;

-- ============================================================================
-- 3) record_payment_edit 재정의 (기준: 0129). 수납 수정(원본 취소 + 신규 기록 원자화).
--    변경점: 신규 수납의 occupancy 조회를 부과-우선 폴백으로 교체.
--    원본 fee·source·paid_at 승계 및 provenance 캡처 로직 불변.
--    시그니처 동일(…, int, text) → drop 없이 create or replace.
-- ============================================================================
create or replace function record_payment_edit(
  p_old_payment_id bigint,
  p_unit_id bigint, p_period date, p_amount int,
  p_method text, p_kind text, p_memo text,
  p_paid_at date default null, p_fee int default null, p_source text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_occ bigint; v_id bigint; v_charged int; v_paid int;
        v_old_fee int; v_old_source text; v_old_paid_at date;
        v_fee int; v_source text; v_paid_at date;
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
  if p_fee is not null and p_fee < 0 then raise exception 'fee must be >= 0'; end if;
  if p_method not in ('cash','transfer','auto_debit','giro','card','other') then raise exception 'invalid method'; end if;
  if p_kind not in ('full','principal','partial') then raise exception 'invalid kind'; end if;
  if p_source is not null and p_source not in ('manual','bank_excel','cms') then raise exception 'invalid source'; end if;

  -- 1) 기존 수납 취소 (본인 org·동일 세대·active만) + 원본 provenance 캡처
  update payments p set status='canceled', canceled_at=now(), canceled_by=auth.uid()
   where p.id=p_old_payment_id and p.status='active' and p.org_id=v_org and p.unit_id=p_unit_id
     and exists (select 1 from units u join buildings b on b.id=u.building_id
                 where u.id=p.unit_id and b.org_id=v_org)
   returning p.fee, p.source, p.paid_at into v_old_fee, v_old_source, v_old_paid_at;
  if not found then raise exception 'original payment not found or already canceled'; end if;

  -- 미지정 필드는 원본값 승계(은행/지로/CMS 수납 수정 시 fee·source·paid_at 유실 방지).
  v_fee := coalesce(p_fee, v_old_fee, 0);
  v_source := coalesce(p_source, v_old_source, 'manual');
  v_paid_at := coalesce(p_paid_at, v_old_paid_at, current_date);

  -- 2) 새 수납 기록 (같은 트랜잭션 — 실패 시 취소도 롤백)
  --    귀속: 해당 (unit, period) 확정부과 occupancy 우선, 없으면 최근 occupancy 폴백.
  select bc.occupancy_id into v_occ from billing_confirmations bc
   where bc.unit_id=p_unit_id and bc.period=p_period;
  if v_occ is null then
    select o.id into v_occ from occupancies o
     where o.unit_id=p_unit_id and o.deleted_at is null
     order by o.created_at desc, o.id desc limit 1;
  end if;

  insert into payments(org_id, unit_id, period, occupancy_id, amount, fee, method, kind, memo, paid_at, source, created_by)
    values (v_org, p_unit_id, p_period, v_occ, p_amount, v_fee, p_method, p_kind, nullif(p_memo,''),
            v_paid_at, v_source, auth.uid())
    returning id into v_id;

  select bc.total_amount into v_charged from billing_confirmations bc
    where bc.unit_id=p_unit_id and bc.period=p_period;
  select coalesce(sum(amount),0)::int into v_paid from payments
    where unit_id=p_unit_id and period=p_period and status='active';

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PAYMENT_EDIT', 'payments', v_id::text,
      jsonb_build_object('old_id',p_old_payment_id,'unit_id',p_unit_id,'period',p_period,
                         'amount',p_amount,'fee',v_fee,'kind',p_kind,'method',p_method,'source',v_source));

  return jsonb_build_object('ok',true,'payment_id',v_id,'canceled_id',p_old_payment_id,
    'charged',v_charged,'paid',v_paid,
    'unpaid', case when v_charged is null then null else v_charged - v_paid end);
end $$;
revoke execute on function record_payment_edit(bigint, bigint, date, int, text, text, text, date, int, text) from public, anon;
grant execute on function record_payment_edit(bigint, bigint, date, int, text, text, text, date, int, text) to authenticated;
