-- P7b: 수도·전기·가스·전체 이사조회 4화면
-- 의존: P2a(current_user_org, current_user_has_module), P7a(moving_settlements)

create index moving_settlements_move_out_date_idx
  on moving_settlements (move_out_date desc, created_at desc);

create or replace function list_settlement_inquiries(
  p_type text,
  p_building_id bigint,
  p_from date,
  p_to date,
  p_search text,
  p_status text,
  p_limit integer,
  p_offset integer
) returns table(
  settlement_id bigint,
  building_id bigint,
  building_name text,
  unit_id bigint,
  occupancy_id bigint,
  dong text,
  unit_no text,
  tenant_name text,
  status text,
  move_out_date date,
  mgmt_fee_prorated integer,
  water_charge integer,
  elec_charge integer,
  gas_charge integer,
  elec_paid_date date,
  gas_paid_date date,
  repair_amount integer,
  settlement_amount integer,
  processed_at timestamptz,
  created_at timestamptz,
  total_count bigint
) language plpgsql stable security definer set search_path = public as $$
declare
  v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then
    raise exception 'forbidden: moving required';
  end if;
  if p_type not in ('water', 'elec', 'gas', 'all') then
    raise exception 'invalid inquiry type';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid date range';
  end if;
  if p_status is not null and p_status not in ('draft', 'saved', 'mid_moveout', 'completed') then
    raise exception 'invalid settlement status';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'limit must be between 1 and 100';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'offset must be zero or greater';
  end if;

  return query
  select
    s.id,
    b.id,
    b.name,
    u.id,
    s.occupancy_id,
    u.dong,
    u.unit_no,
    o.tenant_name,
    s.status,
    s.move_out_date,
    s.mgmt_fee_prorated,
    s.water_charge,
    s.elec_charge,
    s.gas_charge,
    s.elec_paid_date,
    s.gas_paid_date,
    s.repair_amount,
    s.settlement_amount,
    s.processed_at,
    s.created_at,
    count(*) over ()
  from moving_settlements s
  join units u on u.id = s.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.org_id = v_org and b.deleted_at is null
  left join occupancies o on o.id = s.occupancy_id
  where s.move_out_date between p_from and p_to
    and (p_building_id is null or b.id = p_building_id)
    and (p_status is null or s.status = p_status)
    and (
      p_search is null
      or nullif(btrim(p_search), '') is null
      or b.name ilike '%' || btrim(p_search) || '%'
      or coalesce(u.dong, '') ilike '%' || btrim(p_search) || '%'
      or u.unit_no ilike '%' || btrim(p_search) || '%'
      or coalesce(o.tenant_name, '') ilike '%' || btrim(p_search) || '%'
    )
    and (
      p_type = 'all'
      or (p_type = 'water' and s.water_charge is not null)
      or (p_type = 'elec' and s.elec_charge is not null)
      or (p_type = 'gas' and s.gas_charge is not null)
    )
  order by s.move_out_date desc, s.created_at desc, s.id desc
  limit p_limit offset p_offset;
end $$;

revoke execute on function list_settlement_inquiries(text,bigint,date,date,text,text,integer,integer)
  from public, anon;
grant execute on function list_settlement_inquiries(text,bigint,date,date,text,text,integer,integer)
  to authenticated;
