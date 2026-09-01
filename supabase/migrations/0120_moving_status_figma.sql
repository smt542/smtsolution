-- Figma 673:185236 — 전체 이사조회 통합표/즉시필터/인라인 저장.

drop function if exists list_settlement_inquiries(text,bigint,date,date,text,text,integer,integer);

create or replace function list_settlement_inquiries(
  p_type text,
  p_building_id bigint,
  p_from date,
  p_to date,
  p_search text,
  p_status text,
  p_sort text,
  p_limit integer,
  p_offset integer
) returns table(
  settlement_id bigint,
  building_id bigint,
  building_code text,
  building_address text,
  building_name text,
  unit_id bigint,
  occupancy_id bigint,
  dong text,
  unit_no text,
  tenant_name text,
  move_in_date date,
  status text,
  move_out_date date,
  mgmt_fee_prorated integer,
  water_charge integer,
  elec_final_reading numeric,
  elec_move_reading numeric,
  elec_usage numeric,
  elec_charge integer,
  elec_paid_date date,
  gas_final_reading numeric,
  gas_move_reading numeric,
  gas_usage numeric,
  gas_charge integer,
  gas_paid_date date,
  repair_amount integer,
  inspector_name text,
  cleaning_cost bigint,
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
  if p_status is not null and p_status not in ('completed', 'unresolved') then
    raise exception 'invalid settlement status';
  end if;
  if p_sort not in ('code', 'date') then
    raise exception 'invalid settlement sort';
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
    b.code,
    b.address,
    b.name,
    u.id,
    s.occupancy_id,
    u.dong,
    u.unit_no,
    o.tenant_name,
    o.move_in_date,
    s.status,
    s.move_out_date,
    s.mgmt_fee_prorated,
    s.water_charge,
    er.previous_reading,
    er.current_reading,
    coalesce(er.usage, er.current_reading - er.previous_reading),
    s.elec_charge,
    s.elec_paid_date,
    gr.previous_reading,
    gr.current_reading,
    coalesce(gr.usage, gr.current_reading - gr.previous_reading),
    s.gas_charge,
    s.gas_paid_date,
    s.repair_amount,
    inspector.full_name,
    o.move_cleaning_fee,
    s.settlement_amount,
    s.processed_at,
    s.created_at,
    count(*) over ()
  from moving_settlements s
  join units u on u.id = s.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.org_id = v_org and b.deleted_at is null
  left join occupancies o on o.id = s.occupancy_id
  left join profiles inspector on inspector.user_id = b.meter_user_id
  left join lateral (
    select mr.previous_reading, mr.current_reading, mr.usage
    from meter_readings mr
    where mr.unit_id = s.unit_id
      and mr.utility = 'elec'
      and mr.period <= date_trunc('month', coalesce(s.move_out_date, s.created_at::date))::date
    order by mr.period desc
    limit 1
  ) er on true
  left join lateral (
    select mr.previous_reading, mr.current_reading, mr.usage
    from meter_readings mr
    where mr.unit_id = s.unit_id
      and mr.utility = 'gas'
      and mr.period <= date_trunc('month', coalesce(s.move_out_date, s.created_at::date))::date
    order by mr.period desc
    limit 1
  ) gr on true
  where s.move_out_date between p_from and p_to
    and (p_building_id is null or b.id = p_building_id)
    and (
      p_status is null
      or (p_status = 'completed' and s.status = 'completed')
      or (p_status = 'unresolved' and s.status <> 'completed')
    )
    and (
      p_search is null
      or nullif(btrim(p_search), '') is null
      or b.name ilike '%' || btrim(p_search) || '%'
      or b.address ilike '%' || btrim(p_search) || '%'
    )
    and (
      p_type = 'all'
      or (p_type = 'water' and s.water_charge is not null)
      or (p_type = 'elec' and s.elec_charge is not null)
      or (p_type = 'gas' and s.gas_charge is not null)
    )
  order by
    b.code asc nulls last,
    b.name asc,
    case when p_sort = 'date' then s.move_out_date end desc nulls last,
    case when p_sort = 'code' then u.unit_no end asc,
    s.id desc
  limit p_limit offset p_offset;
end $$;

revoke execute on function list_settlement_inquiries(text,bigint,date,date,text,text,text,integer,integer)
  from public, anon;
grant execute on function list_settlement_inquiries(text,bigint,date,date,text,text,text,integer,integer)
  to authenticated;

create or replace function save_settlement_inquiry_edits(p_edits jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_item jsonb;
  v_changed integer;
  v_count integer := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then
    raise exception 'forbidden: moving required';
  end if;
  if jsonb_typeof(coalesce(p_edits, 'null'::jsonb)) <> 'array' then
    raise exception 'edits must be an array';
  end if;

  for v_item in select value from jsonb_array_elements(p_edits)
  loop
    if nullif(v_item->>'settlement_id', '') is null then
      raise exception 'settlement_id is required';
    end if;
    if v_item->>'cleaning_cost' is not null
       and (v_item->>'cleaning_cost')::bigint < 0 then
      raise exception 'cleaning_cost must be zero or greater';
    end if;

    update moving_settlements s
       set elec_paid_date = case
             when v_item ? 'elec_paid_date' then nullif(v_item->>'elec_paid_date', '')::date
             else s.elec_paid_date
           end,
           gas_paid_date = case
             when v_item ? 'gas_paid_date' then nullif(v_item->>'gas_paid_date', '')::date
             else s.gas_paid_date
           end
     where s.id = (v_item->>'settlement_id')::bigint
       and exists (
         select 1
         from units u
         join buildings b on b.id = u.building_id
         where u.id = s.unit_id and b.org_id = v_org
       );
    get diagnostics v_changed = row_count;
    if v_changed <> 1 then
      raise exception 'settlement not found or forbidden';
    end if;

    if v_item ? 'cleaning_cost' then
      update occupancies o
         set move_cleaning_fee = nullif(v_item->>'cleaning_cost', '')::bigint
       where o.id = (
         select s.occupancy_id
         from moving_settlements s
         where s.id = (v_item->>'settlement_id')::bigint
       );
    end if;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('count', v_count);
end $$;

revoke execute on function save_settlement_inquiry_edits(jsonb) from public, anon;
grant execute on function save_settlement_inquiry_edits(jsonb) to authenticated;
