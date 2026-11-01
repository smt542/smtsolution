-- 0336 (QA #49): 사무실 이사정산 소계 수기 수정(extra.subtotalOverride).
--  extra.subtotalOverride = { utility, management, etc, unpaid } (각 0 이상 정수, null/없음 = 자동값).
--  - settlement_amount = coalesce(공과금 override, water+elec+gas) + coalesce(관리비 override, mgmt_fee_prorated)
--                        + coalesce(기타 override, etcItems 합계/repair_amount) + cleaning_cost + unpaid_amount
--  - save_moving_settlement: unpaid_amount = coalesce(미납 override, settlement_billing_unpaid(...)), override 음수 차단.
--  - 트리거는 extra 변경에도 다시 계산한다(override 만 고친 저장도 반영).
--  컬럼(구분별 금액·mgmt_fee_prorated·repair_amount)은 자동 계산값 그대로 둔다. partner 저장은 extra 를 통째로 쓰므로
--  partner 가 다시 저장하면 override 가 없어지고 자동값으로 돌아간다(partner 편집은 범위 밖).
begin;

create or replace function public.settlement_subtotal_override(p_extra jsonb, p_key text)
returns integer
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when jsonb_typeof(p_extra -> 'subtotalOverride') = 'object'
     and jsonb_typeof(p_extra -> 'subtotalOverride' -> p_key) in ('number', 'string')
     and (p_extra -> 'subtotalOverride' ->> p_key) ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
    then round((p_extra -> 'subtotalOverride' ->> p_key)::numeric)::integer
  end
$function$;

create or replace function public.calculate_moving_settlement_amount(p_data jsonb)
returns integer
language sql
immutable
set search_path to 'public'
as $function$
  select
    coalesce(
      settlement_subtotal_override(p_data->'extra', 'management'),
      nullif(p_data->>'mgmt_fee_prorated','')::integer,
      0
    ) +
    coalesce(
      settlement_subtotal_override(p_data->'extra', 'utility'),
      coalesce(nullif(p_data->>'water_charge','')::integer, 0) +
      coalesce(nullif(p_data->>'elec_charge','')::integer, 0) +
      coalesce(nullif(p_data->>'gas_charge','')::integer, 0)
    ) +
    coalesce(
      settlement_subtotal_override(p_data->'extra', 'etc'),
      settlement_etc_total(p_data->'extra'),
      nullif(p_data->>'repair_amount','')::integer,
      0
    ) +
    coalesce(nullif(p_data->>'cleaning_cost','')::integer, 0)
$function$;

create or replace function public.set_moving_settlement_amount()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- settlement_amount = 수납 차감 전 정산요금 = ①공과금 + ②관리비 + ③미납(unpaid_amount 스냅샷) + ④청소비·기타 (0266)
  -- 0336: 소계 수기 수정(extra.subtotalOverride)이 있으면 ①②③기타 는 그 값을 쓴다.
  new.settlement_amount := calculate_moving_settlement_amount(
    jsonb_build_object(
      'mgmt_fee_prorated', new.mgmt_fee_prorated,
      'water_charge', new.water_charge,
      'elec_charge', new.elec_charge,
      'gas_charge', new.gas_charge,
      'repair_amount', new.repair_amount,
      'cleaning_cost', new.cleaning_cost,
      'extra', jsonb_build_object('subtotalOverride', new.extra -> 'subtotalOverride')
    )
  ) + coalesce(new.unpaid_amount, 0);
  return new;
end $function$;

drop trigger if exists trg_moving_settlement_amount on public.moving_settlements;
create trigger trg_moving_settlement_amount
  before insert or update of mgmt_fee_prorated, water_charge, elec_charge, gas_charge,
    repair_amount, cleaning_cost, unpaid_amount, extra
  on public.moving_settlements
  for each row execute function public.set_moving_settlement_amount();

-- save_moving_settlement: 라이브 정의 치환(미납 override · override 음수 검증).
do $do$
declare
  v_def text;
  v_new text;
  r record;
begin
  v_def := pg_get_functiondef('public.save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb)'::regprocedure);
  v_new := v_def;
  for r in select * from (values
    ($q$     or nullif(btrim(v_extra->>'adv'), '')::numeric < 0$q$,
     $q$     or nullif(btrim(v_extra->>'adv'), '')::numeric < 0
     or settlement_subtotal_override(v_extra, 'utility') < 0
     or settlement_subtotal_override(v_extra, 'management') < 0
     or settlement_subtotal_override(v_extra, 'etc') < 0
     or settlement_subtotal_override(v_extra, 'unpaid') < 0$q$),
    ($q$  v_unpaid := settlement_billing_unpaid(p_unit_id, p_occupancy_id, nullif(p_data->>'move_out_date','')::date)::integer;$q$,
     $q$  -- 0336: 미납 소계 수기 수정(extra.subtotalOverride.unpaid)이 있으면 그 값을 스냅샷한다.
  v_unpaid := coalesce(
    settlement_subtotal_override(v_extra, 'unpaid'),
    settlement_billing_unpaid(p_unit_id, p_occupancy_id, nullif(p_data->>'move_out_date','')::date)::integer
  );$q$),
    ($q$  v_amount := calculate_moving_settlement_amount(p_data) + v_unpaid;$q$,
     $q$  v_amount := calculate_moving_settlement_amount(p_data || jsonb_build_object('extra', v_extra)) + v_unpaid;$q$)
  ) t(o, n)
  loop
    if position(r.o in v_new) = 0 then raise exception 'save patch target not found: %', left(r.o, 60); end if;
    v_new := replace(v_new, r.o, r.n);
  end loop;
  execute v_new;
end $do$;

commit;
