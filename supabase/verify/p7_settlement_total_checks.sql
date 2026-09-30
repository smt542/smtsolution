-- P7 정산 총액 회귀 검증. 마이그레이션 0191 적용 뒤 읽기 전용으로 실행한다.
begin;

do $$
declare
begin
  if calculate_moving_settlement_amount(
    jsonb_build_object(
      'mgmt_fee_prorated', 10000,
      'water_charge', 2000,
      'elec_charge', 3000,
      'gas_charge', 4000,
      'repair_amount', 5000,
      'cleaning_cost', 6000
    )
  ) <> 30000 then
    raise exception 'moving settlement total must include cleaning_cost';
  end if;

  if calculate_moving_settlement_amount('{}'::jsonb) <> 0 then
    raise exception 'moving settlement total must treat omitted values as zero';
  end if;

  if (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('save_moving_settlement', 'partner_save_moving_settlement')
      and position('calculate_moving_settlement_amount(p_data)' in pg_get_functiondef(p.oid)) > 0
  ) <> 2 then
    raise exception 'both settlement save RPCs must use the shared total calculation';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.moving_settlements'::regclass
      and tgname = 'trg_moving_settlement_amount'
      and not tgisinternal
  ) then
    raise exception 'moving settlement total trigger missing';
  end if;
end $$;

rollback;
