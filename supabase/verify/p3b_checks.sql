-- P3b 검증 (사용자 PC psql). 실패 시 raise.
do $$ begin
  perform 1 from information_schema.columns where table_name='occupancies' and column_name='room_type_id';
  if not found then raise exception 'occupancies.room_type_id missing'; end if;
  perform 1 from information_schema.columns where table_name='occupancies' and column_name='deposit';
  if found then raise exception 'legacy occupancies.deposit must be dropped (→ lease_contracts)'; end if;
  perform 1 from information_schema.columns where table_name='units' and column_name='elec_meter_no';
  if found then raise exception 'legacy units.elec_meter_no must be dropped (→ unit_meters)'; end if;
end $$;
do $$ begin
  perform 1 from information_schema.tables where table_name in ('unit_meters','unit_accounts','lease_contracts','occupancy_history');
  if (select count(*) from information_schema.tables where table_name in ('unit_meters','unit_accounts','lease_contracts','occupancy_history')) <> 4
    then raise exception 'P3b tables missing'; end if;
end $$;
do $$ begin
  perform 1 from pg_policies where tablename='occupancies' and policyname='occ_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'occ_write must gate by tenants module'; end if;
  perform 1 from pg_proc where proname in ('save_unit_occupancy','list_tenants');
  if (select count(*) from pg_proc where proname in ('save_unit_occupancy','list_tenants')) <> 2
    then raise exception 'P3b RPC missing'; end if;
end $$;
-- 수동: tenants 미보유 구성원 occupancies UPDATE 거부; save_unit_occupancy 신규 호실+입주+meters/accounts/lease upsert; 타 org building_id 거부.
