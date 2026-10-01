-- 2026-10-01 사용자 결정 — 전화번호 마스킹 전면 제거(개인정보 트랙 0176·0181·0182·0184 되돌림), 원문 보기 함수 삭제.

drop function if exists public.reveal_pii_fields(text, text, text[], text, text);
drop function if exists public.log_pii_reveal(bigint, text, text, text, int, text, text);

create or replace function public.partner_search_tenants(p_search text default null)
returns table (
  occupancy_id bigint, unit_id bigint, building_id bigint, building_name text,
  unit_no text, dong text, tenant_name text, phone text, move_in_date date
)
language sql stable security definer set search_path = public as $$
  select o.id, u.id, b.id, b.name, u.unit_no, u.dong, o.tenant_name,
    o.phone,
    o.move_in_date
  from occupancies o
  join units u on u.id = o.unit_id
  join buildings b on b.id = u.building_id
  where o.deleted_at is null and o.status = 'occupied' and u.deleted_at is null
    and b.id in (select partner_my_building_ids())
    and (p_search is null or o.tenant_name ilike '%'||p_search||'%'
         or o.phone ilike '%'||p_search||'%' or b.name ilike '%'||p_search||'%')
  order by o.tenant_name;
$$;

revoke execute on function public.partner_search_tenants(text) from public, anon;
grant execute on function public.partner_search_tenants(text) to authenticated;

create or replace function public.partner_list_building_vendors(p_building_id bigint)
returns table (id bigint, vendor_type text, name text, phone text, memo text)
language sql stable security definer set search_path = public as $$
  select v.id, v.vendor_type, v.name,
    v.phone,
    v.memo
  from building_vendors v
  where v.building_id = p_building_id
    and v.deleted_at is null
    and v.building_id in (select partner_my_building_ids())
  order by v.sort_order, v.id;
$$;

revoke execute on function public.partner_list_building_vendors(bigint) from public, anon;
grant execute on function public.partner_list_building_vendors(bigint) to authenticated;

create or replace function public.list_message_logs(p_limit int default 50)
returns table(
  id bigint,
  org_id bigint,
  channel text,
  body text,
  context text,
  recipient_count int,
  recipients jsonb,
  result text,
  sent_by uuid,
  sent_at timestamptz,
  created_at timestamptz,
  template_id bigint,
  estimated_points integer,
  charged_points integer,
  point_status text,
  notice_id bigint,
  is_scheduled boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;

  return query
    select
      ml.id,
      ml.org_id,
      ml.channel,
      ml.body,
      ml.context,
      ml.recipient_count,
      coalesce((
        select jsonb_agg(
          case
            when recipient.value ? 'phone' then recipient.value || jsonb_build_object(
              'phone',
              recipient.value->>'phone'
            )
            else recipient.value
          end
          order by recipient.ordinality
        )
        from jsonb_array_elements(coalesce(ml.recipients, '[]'::jsonb))
          with ordinality as recipient(value, ordinality)
      ), '[]'::jsonb),
      ml.result,
      ml.sent_by,
      ml.sent_at,
      ml.created_at,
      ml.template_id,
      ml.estimated_points,
      ml.charged_points,
      ml.point_status,
      ml.notice_id,
      exists (
        select 1
        from public.message_schedules ms
        where ms.message_log_id = ml.id
      ) as is_scheduled
    from public.message_logs ml
    where ml.org_id in (select my_org_ids())
    order by ml.sent_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end
$$;

revoke execute on function public.list_message_logs(int) from public, anon;
grant execute on function public.list_message_logs(int) to authenticated;

create or replace function public.list_occupancy_history(p_unit_id bigint)
returns table (
  id bigint, unit_id bigint, tenant_name text, phone text, phone2 text, phone3 text,
  move_in_date date, move_out_date date, room_type_label text
)
language sql stable security definer set search_path = public as $$
  select h.id, h.unit_id, h.tenant_name,
    h.phone,
    h.phone2,
    h.phone3,
    h.move_in_date, h.move_out_date, h.room_type_label
  from occupancy_history h
  join units u on u.id = h.unit_id
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  where h.unit_id = p_unit_id
  order by h.move_out_date desc;
$$;

revoke execute on function public.list_occupancy_history(bigint) from public, anon;
grant execute on function public.list_occupancy_history(bigint) to authenticated;

create or replace function list_accounts(p_search text default null, p_type staff_type default null)
returns table (user_id uuid, username text, full_name text, phone text, phone_sub text,
               role org_member_role, staff_type staff_type, affiliation text, is_active boolean,
               permissions jsonb, role_labels text[], staff_capabilities jsonb)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.full_name,
         p.phone, p.phone_sub,
         m.role, m.staff_type, m.affiliation, p.is_active,
         coalesce(m.feature_permissions,'[]'::jsonb),
         coalesce(array_agg(sr.label order by sr.sort_order) filter (where sr.id is not null), '{}'),
         coalesce(m.staff_capabilities, '[]'::jsonb)
  from org_members m
  join profiles p on p.user_id = m.user_id
  left join org_member_roles omr on omr.user_id = m.user_id and omr.org_id = m.org_id
  left join staff_roles sr on sr.id = omr.role_id and sr.deleted_at is null
  where m.org_id = current_user_org()
    and (p_type is null or m.staff_type = p_type)
    and (p_search is null or p.full_name ilike '%'||p_search||'%'
         or p.username ilike '%'||p_search||'%'
         or p.phone ilike '%'||p_search||'%' or p.phone_sub ilike '%'||p_search||'%')
  group by p.user_id, p.username, p.full_name, p.phone, p.phone_sub,
           m.role, m.staff_type, m.affiliation, p.is_active, m.feature_permissions, m.staff_capabilities
  order by p.full_name
$$;

revoke execute on function public.list_accounts(text, public.staff_type) from public, anon;
grant execute on function public.list_accounts(text, public.staff_type) to authenticated, service_role;

create or replace function public.platform_list_accounts(
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  org_id bigint,
  organization_name text,
  user_id uuid,
  username text,
  full_name text,
  phone text,
  memo text,
  role public.org_member_role,
  staff_type public.staff_type,
  feature_permissions jsonb,
  is_active boolean,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'limit must be between 1 and 100' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'offset must be zero or greater' using errcode = '22023';
  end if;

  return query
  select
    member.org_id,
    organization.name,
    member.user_id,
    profile.username,
    profile.full_name,
    profile.phone,
    member.memo,
    member.role,
    member.staff_type,
    member.feature_permissions,
    profile.is_active,
    member.created_at,
    count(*) over ()::bigint
  from public.org_members member
  join public.organizations organization on organization.id = member.org_id
  left join public.profiles profile on profile.user_id = member.user_id
  where nullif(btrim(coalesce(p_search, '')), '') is null
    or organization.name ilike '%' || btrim(p_search) || '%'
    or profile.full_name ilike '%' || btrim(p_search) || '%'
    or profile.username ilike '%' || btrim(p_search) || '%'
    or coalesce(profile.phone, '') ilike '%' || btrim(p_search) || '%'
    or coalesce(member.memo, '') ilike '%' || btrim(p_search) || '%'
  order by member.created_at desc, member.org_id, member.user_id
  limit p_limit
  offset p_offset;
end
$$;

revoke all on function public.platform_list_accounts(text, integer, integer) from public, anon;
grant execute on function public.platform_list_accounts(text, integer, integer) to authenticated;

create or replace function list_buildings(
  p_search text default null, p_manager uuid default null, p_meter uuid default null,
  p_cleaning uuid default null, p_limit int default 20, p_offset int default 0
) returns table(
  id bigint, code text, name text, address text,
  manager_user_id uuid, meter_user_id uuid, cleaning_user_id uuid,
  manager_name text, meter_name text, cleaning_name text,
  total_units bigint, occupied_units bigint, min_meter_day int, total bigint,
  type_label text, owner_name text, owner_phone text, entrance_password text,
  created_at timestamptz
) language sql stable security definer set search_path = public as $$
  with base as (
    select b.* from buildings b
    where b.org_id = current_user_org() and b.deleted_at is null
      and (p_search   is null or b.name ilike '%'||p_search||'%' or b.address ilike '%'||p_search||'%')
      and (p_manager  is null or b.manager_user_id  = p_manager)
      and (p_meter    is null or b.meter_user_id    = p_meter)
      and (p_cleaning is null or b.cleaning_user_id = p_cleaning)
  )
  select base.id, base.code, base.name, base.address,
    base.manager_user_id, base.meter_user_id, base.cleaning_user_id,
    mp.full_name, tp.full_name, cp.full_name,
    (select count(*) from units u where u.building_id = base.id and u.deleted_at is null),
    (select count(*) from units u join occupancies o on o.unit_id = u.id
       where u.building_id = base.id and u.deleted_at is null and o.deleted_at is null and o.status = 'occupied'),
    (select min(bcn.meter_day) from building_customer_numbers bcn where bcn.building_id = base.id and bcn.deleted_at is null),
    count(*) over(),
    bt.label, base.owner_name, base.owner_phone, base.entrance_password, base.created_at
  from base
  left join profiles mp on mp.user_id = base.manager_user_id
  left join profiles tp on tp.user_id = base.meter_user_id
  left join profiles cp on cp.user_id = base.cleaning_user_id
  left join building_types bt on bt.id = base.type_id and bt.org_id = current_user_org()
  order by base.created_at desc
  limit p_limit offset p_offset
$$;

-- PUBLIC 실행권한이 남아 비로그인(anon)도 실행 가능했다(10-01 확인) → public·anon 둘 다 회수.
revoke execute on function list_buildings(text,uuid,uuid,uuid,int,int) from public, anon;
grant execute on function list_buildings(text,uuid,uuid,uuid,int,int) to authenticated, service_role;

create or replace function partner_list_units(p_building_id bigint)
returns table (unit_id bigint, unit_no text, dong text, tenant_name text,
               phone text, move_in_date date, status text)
language sql stable security definer set search_path = public as $$
  select u.id, u.unit_no, u.dong, o.tenant_name, o.phone, o.move_in_date,
         coalesce(o.status::text, 'vacant')
  from units u
  left join occupancies o
    on o.unit_id = u.id and o.deleted_at is null and o.status = 'occupied'
  where u.building_id = p_building_id and u.deleted_at is null
    and u.building_id in (select partner_my_building_ids())
  order by nullif(regexp_replace(u.unit_no, '\D', '', 'g'), '')::int nulls last, u.unit_no;
$$;

-- 위와 같은 이유로 public·anon 둘 다 회수.
revoke execute on function partner_list_units(bigint) from public, anon;
grant execute on function partner_list_units(bigint) to authenticated, service_role;

create or replace function list_tenants(p_building_id bigint)
returns table(
  unit_id bigint, occupancy_id bigint, unit_no text, tenant_name text, phone text,
  room_type_label text, resident_count int, move_in_date date,
  is_vacant boolean, is_overdue boolean,
  payer_name text, vehicle_no text, area_pyeong numeric, mgmt_fee_amount bigint,
  billing_enabled boolean, print_enabled boolean, bill_name_display text,
  move_out_date date, expected_move_in_date date, increase_amount bigint, billing_day text,
  late_fee_enabled boolean, single_print boolean,
  transfer_method text, sms_opt_in boolean, billing_note text,
  bill_auth boolean, bill_delivery text, occupancy_created_at timestamptz,
  water_customer_no text, water_meter_no text,
  elec_customer_no text, elec_meter_no text,
  common_elec_customer_no text, common_elec_meter_no text,
  gas_customer_no text, gas_meter_no text,
  kepco_customer_no text, kepco_meter_no text,
  mgmt_account text, water_account text, elec_account text, gas_account text,
  common_elec_no text,
  phones_more text[], vehicles_more text[]
) language sql stable security definer set search_path = public as $$
  select u.id, o.id, u.unit_no, o.tenant_name, o.phone, rt.label, o.resident_count, o.move_in_date,
    coalesce(o.status = 'vacant', true) as is_vacant,
    false as is_overdue,
    o.payer_name, o.vehicle_no, u.area_pyeong, o.mgmt_fee_amount,
    o.billing_enabled, o.print_enabled, o.bill_name_display,
    o.move_out_date, o.expected_move_in_date, o.increase_amount, o.billing_day,
    o.late_fee_enabled, o.single_print,
    o.transfer_method, o.sms_opt_in, o.billing_note,
    o.bill_auth, o.bill_delivery, o.created_at,
    water_meter.customer_no, water_meter.meter_no,
    elec_meter.customer_no, elec_meter.meter_no,
    coalesce(common_elec_meter.customer_no, common_elec.customer_no),
    common_elec_meter.meter_no,
    gas_meter.customer_no, gas_meter.meter_no,
    coalesce(kepco_meter.customer_no, elec_meter.customer_no),
    coalesce(kepco_meter.meter_no, elec_meter.meter_no),
    mgmt_account.account, water_account.account, elec_account.account, gas_account.account,
    common_elec.customer_no,
    array(
      select btrim(p.v)
      from unnest(array[o.phone2, o.phone3] || coalesce(o.phones_extra, '{}'::text[])) with ordinality as p(v, ord)
      where nullif(btrim(p.v), '') is not null
      order by p.ord
    ),
    array(
      select btrim(v.v)
      from unnest(coalesce(o.vehicles_extra, '{}'::text[])) with ordinality as v(v, ord)
      where nullif(btrim(v.v), '') is not null
      order by v.ord
    )
  from units u
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select * from occupancies oc where oc.unit_id = u.id and oc.deleted_at is null
    order by oc.created_at desc limit 1
  ) o on true
  left join room_types rt on rt.id = o.room_type_id
  left join lateral (
    select um.customer_no, um.meter_no
    from unit_meters um
    where um.unit_id = u.id and um.utility = 'water'
    order by um.created_at desc, um.id desc
    limit 1
  ) water_meter on true
  left join lateral (
    select um.customer_no, um.meter_no
    from unit_meters um
    where um.unit_id = u.id and um.utility = 'elec'
    order by um.created_at desc, um.id desc
    limit 1
  ) elec_meter on true
  left join lateral (
    select um.customer_no, um.meter_no
    from unit_meters um
    where um.unit_id = u.id and um.utility = 'elec_shared'
    order by um.created_at desc, um.id desc
    limit 1
  ) common_elec_meter on true
  left join lateral (
    select um.customer_no, um.meter_no
    from unit_meters um
    where um.unit_id = u.id and um.utility = 'gas'
    order by um.created_at desc, um.id desc
    limit 1
  ) gas_meter on true
  left join lateral (
    select um.customer_no, um.meter_no
    from unit_meters um
    where um.unit_id = u.id and um.utility = 'kepco'
    order by um.created_at desc, um.id desc
    limit 1
  ) kepco_meter on true
  left join lateral (
    select ua.account
    from unit_accounts ua
    where ua.unit_id = u.id and ua.kind = 'mgmt'
    order by ua.created_at desc, ua.id desc
    limit 1
  ) mgmt_account on true
  left join lateral (
    select ua.account
    from unit_accounts ua
    where ua.unit_id = u.id and ua.kind = 'water'
    order by ua.created_at desc, ua.id desc
    limit 1
  ) water_account on true
  left join lateral (
    select ua.account
    from unit_accounts ua
    where ua.unit_id = u.id and ua.kind = 'elec'
    order by ua.created_at desc, ua.id desc
    limit 1
  ) elec_account on true
  left join lateral (
    select ua.account
    from unit_accounts ua
    where ua.unit_id = u.id and ua.kind = 'gas'
    order by ua.created_at desc, ua.id desc
    limit 1
  ) gas_account on true
  left join lateral (
    select bcn.customer_no
    from building_customer_numbers bcn
    where bcn.building_id = u.building_id
      and bcn.kind = 'common_elec'
      and bcn.deleted_at is null
    order by bcn.sort_order, bcn.id
    limit 1
  ) common_elec on true
  where u.building_id = p_building_id and u.deleted_at is null
  order by u.unit_no
$$;

revoke execute on function list_tenants(bigint) from public, anon;
grant execute on function list_tenants(bigint) to authenticated;

create or replace function public.list_utility_rows(
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
    o.phone,
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

create or replace function partner_list_meter_cards(p_building_id bigint, p_period date)
returns table (
  unit_id bigint,
  occupancy_id bigint,
  move_in_date date,
  phone text,
  notes jsonb,
  usage_history jsonb,
  overdue_periods jsonb
)
language sql stable security definer set search_path = public as $$
  with u as (
    select un.id, o.id as occupancy_id, o.move_in_date, o.phone
    from units un
    left join occupancies o
      on o.unit_id = un.id and o.deleted_at is null and o.status = 'occupied'
    where un.building_id = p_building_id and un.deleted_at is null
      and un.building_id in (select partner_my_building_ids())
  )
  select
    u.id,
    u.occupancy_id,
    u.move_in_date,
    u.phone,
    coalesce((
      select jsonb_object_agg(mr.utility, btrim(mr.note))
      from meter_readings mr
      where mr.unit_id = u.id
        and mr.period = p_period
        and nullif(btrim(mr.note), '') is not null
    ), '{}'::jsonb),
    (
      select jsonb_object_agg(k.utility, (
        select jsonb_agg(h.usage order by h.back)
        from (
          select b.back, (
            select mr.usage
            from meter_readings mr
            where mr.unit_id = u.id
              and mr.utility = k.utility
              and mr.period = (p_period - make_interval(months => b.back))::date
          ) as usage
          from generate_series(1, 3) as b(back)
        ) h
      ))
      from (values ('water'), ('elec'), ('gas')) as k(utility)
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object(
          'period', pb.period,
          'unpaid_principal', pb.outstanding,
          'due_date', coalesce(
            bps.due_date,
            (date_trunc('month', pb.period) + interval '1 month' - interval '1 day')::date
          )
        ) order by pb.period)
      from (
        select
          bc.period,
          greatest(bc.total_amount::bigint - coalesce(sum(p.amount), 0)::bigint, 0::bigint) as outstanding
        from billing_confirmations bc
        left join payments p
          on p.occupancy_id = bc.occupancy_id
         and p.unit_id = bc.unit_id
         and p.period = bc.period
         and p.status = 'active'
        where bc.occupancy_id = u.occupancy_id
          and bc.unit_id = u.id
          and bc.confirmed_at is not null
          and bc.period <= p_period
        group by bc.period, bc.total_amount
      ) pb
      left join billing_period_settings bps
        on bps.building_id = p_building_id
       and bps.period = pb.period
      where pb.outstanding > 0
    ), '[]'::jsonb)
  from u
  order by u.id;
$$;

revoke execute on function partner_list_meter_cards(bigint, date) from public, anon;
grant execute on function partner_list_meter_cards(bigint, date) to authenticated;

notify pgrst, 'reload schema';
