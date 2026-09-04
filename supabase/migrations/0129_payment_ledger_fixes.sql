-- 0129_payment_ledger_fixes.sql
-- 수납 원장 정합성 3종 보강 (payments 도메인 한정):
--   C1) record_bank_payments 멱등성 — 같은 은행 엑셀 재업로드 시 동일 입금 이중 반영 방지
--       (org·unit·period·source='bank_excel'·amount·paid_at·payer_name(memo) 논리키로 중복 스킵).
--   H11) record_payment_edit — 수정 시 원본의 fee·source·paid_at 유실 방지(미지정 시 원본값 승계).
-- 의존: 0015(payments·record_payment·cancel_payment), 0018(record_bank_payments·list_bank_payments),
--       0073(payments.fee), 0074(record_payment_edit).
-- 모듈 게이트: payment. 기존 record_payment/cancel_payment/list_* 불변, 대상 RPC만 재정의.
-- ※ H1(자동매칭 초과분 클램프)은 클라이언트(lib/payments/match.ts)에서 처리 — 초과 입금은 auto-post 대상에서 제외.

-- ===== C1) 은행 입금 멱등성: 부분 유니크 인덱스 =====
-- 활성(active) 은행수납만 대상. 취소분은 재기록 허용을 위해 인덱스에서 제외.
-- payer_name(입금자명)은 memo에 저장되며 NULL 가능 → coalesce로 안정 키화.
create unique index if not exists payments_bank_excel_dedup_uidx
  on payments (org_id, unit_id, period, amount, paid_at, coalesce(memo, ''))
  where source = 'bank_excel' and status = 'active';

-- ===== C1) record_bank_payments 재정의: ON CONFLICT DO NOTHING + duplicate 카운트 =====
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
    select o.id into v_occ from occupancies o where o.unit_id=v_unit and o.deleted_at is null
      order by o.created_at desc, o.id desc limit 1;

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

-- ===== H11) record_payment_edit 재정의: 원본 fee·source·paid_at 승계 =====
-- 변경점: p_fee·p_paid_at 기본값을 NULL(미지정=원본 승계)로, 신규 p_source(NULL=원본 승계) 추가.
--   · 수정 UI는 fee·paid_at을 명시 전달하므로 동작 불변.
--   · 은행/지로/CMS 수납을 수정해도 원본 source·fee·paid_at 유실 없음(기존엔 항상 manual·fee 0으로 덮어씀).
-- 기존 시그니처(…, int) 는 drop 후 NULL 기본값으로 재생성(호출부 인자 동일: p_old_payment_id…p_paid_at, p_fee).
drop function if exists record_payment_edit(bigint, bigint, date, int, text, text, text, date, int);
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
  select o.id into v_occ from occupancies o
   where o.unit_id=p_unit_id and o.deleted_at is null
   order by o.created_at desc, o.id desc limit 1;

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
