-- P5a 검증 (사용자 PC psql). 실패 시 raise.
do $$ begin
  if (select count(*) from information_schema.tables where table_name in ('meter_readings','water_discounts')) <> 2
    then raise exception 'P5a tables missing'; end if;
  perform 1 from information_schema.columns where table_name='meter_readings' and column_name='period';
  if not found then raise exception 'meter_readings.period missing'; end if;
end $$;
do $$ begin
  perform 1 from pg_policies where tablename='meter_readings' and policyname='mr_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'mr_write must gate by utilities module'; end if;
  perform 1 from pg_policies where tablename='water_discounts' and policyname='wd_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'wd_write must gate by utilities module'; end if;
  if (select count(*) from pg_proc where proname in ('list_utility_rows','save_meter_readings')) <> 2
    then raise exception 'P5a RPC missing'; end if;
end $$;
-- 수동: utilities 미보유 구성원 meter_readings SELECT 가능·INSERT 거부; save_meter_readings 로 usage=당월−전월·할인 스냅샷 확인;
--       list_utility_rows 전월 previous_reading 채움·water 할인만; 타 org building_id 거부.
