-- Utility grid: expose the occupancy and previous-period fields used by the
-- reference utility-water grid. Phone numbers remain masked in list payloads.

drop function if exists public.list_utility_rows(bigint, text, date);

create function public.list_utility_rows(
  p_building_id bigint,
  p_utility text,
  p_period date
) returns table(
  unit_id bigint,
  unit_no text,
  dong text,
  occupancy_id bigint,
  tenant_name text,
  occupancy_status occupancy_status,
  move_in_date date,
  move_out_date date,
  move_out_scheduled_date date,
  phone text,
  resident_count integer,
  customer_no text,
  meter_no text,
  previous_reading numeric,
  current_reading numeric,
  usage numeric,
  previous_usage numeric,
  unit_price numeric,
  calc_charge integer,
  discount_amount integer,
  manual_charge integer,
  note text,
  processed_at timestamptz,
  discount_type text,
  resolved_unit_price numeric,
  needs_review boolean
) language sql stable security definer set search_path = public as $$
  select
    u.id,
    u.unit_no,
    u.dong,
    o.id,
    o.tenant_name,
    o.status,
    o.move_in_date,
    o.move_out_date,
    o.move_out_scheduled_date,
    public.mask_phone(o.phone),
    o.resident_count,
    m.customer_no,
    m.meter_no,
    coalesce(cur.previous_reading, prev.current_reading) as previous_reading,
    cur.current_reading,
    cur.usage,
    prev.usage as previous_usage,
    cur.unit_price,
    cur.calc_charge,
    coalesce(cur.discount_amount, wd.amount) as discount_amount,
    cur.manual_charge,
    cur.note,
    cur.processed_at,
    wd.discount_type,
    coalesce(
      (select uup.unit_price
       from unit_meters um
       join building_customer_numbers bcn
         on bcn.building_id = p_building_id
        and bcn.kind = p_utility
        and bcn.customer_no = um.customer_no
        and bcn.deleted_at is null
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where um.unit_id = u.id and um.utility = p_utility),
      (select usp.unit_price
       from utility_scoped_prices usp
       where usp.building_id = p_building_id
         and usp.utility = p_utility
         and usp.usage_type = u.usage_type
         and usp.floor = u.floor),
      (select usp.unit_price
       from utility_scoped_prices usp
       where usp.building_id = p_building_id
         and usp.utility = p_utility
         and usp.usage_type = u.usage_type
         and usp.floor is null),
      (select max(uup.unit_price)
       from building_customer_numbers bcn
       join utility_unit_prices uup on uup.building_customer_number_id = bcn.id
       where bcn.building_id = p_building_id
         and bcn.kind = p_utility
         and bcn.deleted_at is null
         and nullif(m.customer_no, '') is null
       having count(*) = 1)
    ) as resolved_unit_price,
    coalesce(cur.needs_review, false) as needs_review
  from units u
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select *
    from occupancies oc
    where oc.unit_id = u.id and oc.deleted_at is null
    order by oc.created_at desc, oc.id desc
    limit 1
  ) o on true
  left join unit_meters m on m.unit_id = u.id and m.utility = p_utility
  left join meter_readings cur
    on cur.unit_id = u.id and cur.utility = p_utility and cur.period = p_period
  left join meter_readings prev
    on prev.unit_id = u.id
   and prev.utility = p_utility
   and prev.period = (p_period - interval '1 month')::date
  left join water_discounts wd on wd.unit_id = u.id and p_utility = 'water'
  where u.building_id = p_building_id and u.deleted_at is null
  order by u.unit_no
$$;

revoke execute on function public.list_utility_rows(bigint, text, date) from public, anon;
grant execute on function public.list_utility_rows(bigint, text, date) to authenticated;
