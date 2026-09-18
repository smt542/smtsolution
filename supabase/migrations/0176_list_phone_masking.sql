-- C2: mask phone/fax values in list-only RPC payloads before they reach the browser.
-- Shared send/edit/print/export readers are intentionally not changed here.

drop function if exists public.partner_search_tenants(text);
create function public.partner_search_tenants(p_search text default null)
returns table (
  occupancy_id bigint, unit_id bigint, building_id bigint, building_name text,
  unit_no text, dong text, tenant_name text, phone text, move_in_date date
)
language sql stable security definer set search_path = public as $$
  select o.id, u.id, b.id, b.name, u.unit_no, u.dong, o.tenant_name,
    case
      when o.phone is null then null
      when tenant_phone_value.digits = '' then repeat('*', char_length(tenant_phone_value.raw))
      when char_length(tenant_phone_value.digits) <=
        (case when left(tenant_phone_value.digits, 2) = '02' then 2 else 3 end) + 4
        then repeat('*', char_length(tenant_phone_value.digits))
      else
        (case when left(tenant_phone_value.digits, 2) = '02' then left(tenant_phone_value.digits, 2)
              else left(tenant_phone_value.digits, 3) end)
        || '-' || repeat('*', char_length(tenant_phone_value.digits)
          - (case when left(tenant_phone_value.digits, 2) = '02' then 2 else 3 end) - 4)
        || '-' || right(tenant_phone_value.digits, 4)
    end,
    o.move_in_date
  from occupancies o
  join units u on u.id = o.unit_id
  join buildings b on b.id = u.building_id
  left join lateral (
    select btrim(o.phone) as raw,
           regexp_replace(btrim(coalesce(o.phone, '')), '[^0-9]', '', 'g') as digits
  ) tenant_phone_value on true
  where o.deleted_at is null and o.status = 'occupied' and u.deleted_at is null
    and b.id in (select partner_my_building_ids())
    and (p_search is null or o.tenant_name ilike '%'||p_search||'%'
         or o.phone ilike '%'||p_search||'%' or b.name ilike '%'||p_search||'%')
  order by o.tenant_name;
$$;

revoke execute on function public.partner_search_tenants(text) from anon;
grant execute on function public.partner_search_tenants(text) to authenticated;

create or replace function public.partner_list_building_vendors(p_building_id bigint)
returns table (id bigint, vendor_type text, name text, phone text, memo text)
language sql stable security definer set search_path = public as $$
  select v.id, v.vendor_type, v.name,
    case
      when v.phone is null then null
      when vendor_phone_value.digits = '' then repeat('*', char_length(vendor_phone_value.raw))
      when char_length(vendor_phone_value.digits) <=
        (case when left(vendor_phone_value.digits, 2) = '02' then 2 else 3 end) + 4
        then repeat('*', char_length(vendor_phone_value.digits))
      else
        (case when left(vendor_phone_value.digits, 2) = '02' then left(vendor_phone_value.digits, 2)
              else left(vendor_phone_value.digits, 3) end)
        || '-' || repeat('*', char_length(vendor_phone_value.digits)
          - (case when left(vendor_phone_value.digits, 2) = '02' then 2 else 3 end) - 4)
        || '-' || right(vendor_phone_value.digits, 4)
    end,
    v.memo
  from building_vendors v
  left join lateral (
    select btrim(v.phone) as raw,
           regexp_replace(btrim(coalesce(v.phone, '')), '[^0-9]', '', 'g') as digits
  ) vendor_phone_value on true
  where v.building_id = p_building_id
    and v.deleted_at is null
    and v.building_id in (select partner_my_building_ids())
  order by v.sort_order, v.id;
$$;

revoke execute on function public.partner_list_building_vendors(bigint) from anon;
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
              case
                when recipient.value->>'phone' is null then null
                when history_phone_value.digits = '' then repeat('*', char_length(history_phone_value.raw))
                when char_length(history_phone_value.digits) <=
                  (case when left(history_phone_value.digits, 2) = '02' then 2 else 3 end) + 4
                  then repeat('*', char_length(history_phone_value.digits))
                else
                  (case when left(history_phone_value.digits, 2) = '02' then left(history_phone_value.digits, 2)
                        else left(history_phone_value.digits, 3) end)
                  || '-' || repeat('*', char_length(history_phone_value.digits)
                    - (case when left(history_phone_value.digits, 2) = '02' then 2 else 3 end) - 4)
                  || '-' || right(history_phone_value.digits, 4)
              end
            )
            else recipient.value
          end
          order by recipient.ordinality
        )
        from jsonb_array_elements(coalesce(ml.recipients, '[]'::jsonb))
          with ordinality as recipient(value, ordinality)
        left join lateral (
          select btrim(recipient.value->>'phone') as raw,
                 regexp_replace(btrim(coalesce(recipient.value->>'phone', '')), '[^0-9]', '', 'g') as digits
        ) history_phone_value on true
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
    case
      when h.phone is null then null
      when history_phone_value.digits = '' then repeat('*', char_length(history_phone_value.raw))
      when char_length(history_phone_value.digits) <=
        (case when left(history_phone_value.digits, 2) = '02' then 2 else 3 end) + 4
        then repeat('*', char_length(history_phone_value.digits))
      else
        (case when left(history_phone_value.digits, 2) = '02' then left(history_phone_value.digits, 2)
              else left(history_phone_value.digits, 3) end)
        || '-' || repeat('*', char_length(history_phone_value.digits)
          - (case when left(history_phone_value.digits, 2) = '02' then 2 else 3 end) - 4)
        || '-' || right(history_phone_value.digits, 4)
    end,
    case
      when h.phone2 is null then null
      when history_phone2_value.digits = '' then repeat('*', char_length(history_phone2_value.raw))
      when char_length(history_phone2_value.digits) <=
        (case when left(history_phone2_value.digits, 2) = '02' then 2 else 3 end) + 4
        then repeat('*', char_length(history_phone2_value.digits))
      else
        (case when left(history_phone2_value.digits, 2) = '02' then left(history_phone2_value.digits, 2)
              else left(history_phone2_value.digits, 3) end)
        || '-' || repeat('*', char_length(history_phone2_value.digits)
          - (case when left(history_phone2_value.digits, 2) = '02' then 2 else 3 end) - 4)
        || '-' || right(history_phone2_value.digits, 4)
    end,
    case
      when h.phone3 is null then null
      when history_phone3_value.digits = '' then repeat('*', char_length(history_phone3_value.raw))
      when char_length(history_phone3_value.digits) <=
        (case when left(history_phone3_value.digits, 2) = '02' then 2 else 3 end) + 4
        then repeat('*', char_length(history_phone3_value.digits))
      else
        (case when left(history_phone3_value.digits, 2) = '02' then left(history_phone3_value.digits, 2)
              else left(history_phone3_value.digits, 3) end)
        || '-' || repeat('*', char_length(history_phone3_value.digits)
          - (case when left(history_phone3_value.digits, 2) = '02' then 2 else 3 end) - 4)
        || '-' || right(history_phone3_value.digits, 4)
    end,
    h.move_in_date, h.move_out_date, h.room_type_label
  from occupancy_history h
  join units u on u.id = h.unit_id
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  left join lateral (
    select btrim(h.phone) as raw, regexp_replace(btrim(coalesce(h.phone, '')), '[^0-9]', '', 'g') as digits
  ) history_phone_value on true
  left join lateral (
    select btrim(h.phone2) as raw, regexp_replace(btrim(coalesce(h.phone2, '')), '[^0-9]', '', 'g') as digits
  ) history_phone2_value on true
  left join lateral (
    select btrim(h.phone3) as raw, regexp_replace(btrim(coalesce(h.phone3, '')), '[^0-9]', '', 'g') as digits
  ) history_phone3_value on true
  where h.unit_id = p_unit_id
  order by h.move_out_date desc;
$$;

revoke execute on function public.list_occupancy_history(bigint) from public, anon;
grant execute on function public.list_occupancy_history(bigint) to authenticated;
