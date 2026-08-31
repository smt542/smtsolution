-- Figma 673-61422 / 673-63860: 고객번호 조회 화면 정합화
-- 고객번호 원장에 조회 화면 전용 필드를 보강하고, 검색/페이지네이션을
-- 한 번에 처리하는 org-scoped RPC를 제공한다.

alter table building_customer_numbers
  add column if not exists line_name text,
  add column if not exists calculation_method text not null default 'auto',
  add column if not exists note text;

alter table building_customer_numbers
  drop constraint if exists building_customer_numbers_calculation_method_check;
alter table building_customer_numbers
  add constraint building_customer_numbers_calculation_method_check
  check (calculation_method in ('auto', 'manual'));

create or replace function list_customer_number_lookup(
  p_kind text,
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns table(
  id bigint,
  building_id bigint,
  building_code text,
  building_name text,
  address text,
  kind text,
  customer_no text,
  line_name text,
  meter_day integer,
  billing_basis text,
  calculation_method text,
  note text,
  sort_order integer,
  total_count bigint
) language sql stable security definer set search_path = public as $$
  with filtered as (
    select
      bcn.id,
      bcn.building_id,
      b.code as building_code,
      b.name as building_name,
      b.address,
      bcn.kind,
      bcn.customer_no,
      nullif(trim(bcn.line_name), '') as line_name,
      bcn.meter_day,
      bcn.billing_basis,
      case when bcn.kind = 'common_elec' then 'auto' else bcn.calculation_method end
        as calculation_method,
      bcn.note,
      bcn.sort_order
    from building_customer_numbers bcn
    join buildings b
      on b.id = bcn.building_id
     and b.org_id = current_user_org()
     and b.deleted_at is null
    where bcn.deleted_at is null
      and current_user_has_module('utilities')
      and p_kind in ('water', 'common_elec')
      and bcn.kind = p_kind
      and (
        nullif(trim(coalesce(p_query, '')), '') is null
        or concat_ws(
          ' ',
          b.code,
          b.name,
          b.address,
          bcn.customer_no,
          bcn.holder_name,
          bcn.line_name,
          case bcn.billing_basis when 'prev' then '전월' else '당월' end,
          case
            when bcn.kind = 'common_elec' then '자동'
            when bcn.calculation_method = 'manual' then '수동'
            else '자동'
          end,
          bcn.note
        ) ilike '%' || trim(p_query) || '%'
      )
  )
  select
    filtered.*,
    count(*) over() as total_count
  from filtered
  order by building_code, building_id, sort_order, id
  limit least(greatest(coalesce(p_limit, 50), 1), 10000)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke execute on function list_customer_number_lookup(text,text,integer,integer) from anon;

-- 기존 공개 시그니처를 유지하면서 고객번호 JSON의 신규 필드를 함께 저장한다.
create or replace function save_building(
  p_id bigint, p_code text, p_name text, p_address text,
  p_manager_user_id uuid, p_meter_user_id uuid, p_cleaning_user_id uuid,
  p_facilities jsonb, p_memo text,
  p_customer_numbers jsonb, p_vendors jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_id bigint := p_id;
  v_code text := nullif(trim(coalesce(p_code,'')), '');
  v_mgr uuid; v_meter uuid; v_clean uuid;
  v_item jsonb;
  v_vendor_map jsonb := '[]'::jsonb;
  v_new_id bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('buildings') then raise exception 'forbidden: buildings required'; end if;

  select user_id into v_mgr   from org_members where org_id = v_org and user_id = p_manager_user_id;
  select user_id into v_meter from org_members where org_id = v_org and user_id = p_meter_user_id;
  select user_id into v_clean from org_members where org_id = v_org and user_id = p_cleaning_user_id;

  if v_id is null then
    if v_code is null then
      select 'B' || lpad((coalesce(max(nullif(regexp_replace(code,'\D','','g'),''))::int,0)+1)::text, 4, '0')
        into v_code from buildings where org_id = v_org;
    end if;
    insert into buildings(org_id, code, name, address, manager_user_id, meter_user_id, cleaning_user_id, facilities, memo)
      values (v_org, v_code, p_name, nullif(p_address,''), v_mgr, v_meter, v_clean,
              coalesce(p_facilities,'{}'::jsonb), nullif(p_memo,''))
      returning id into v_id;
  else
    update buildings set
      code = coalesce(v_code, code), name = p_name, address = nullif(p_address,''),
      manager_user_id = v_mgr, meter_user_id = v_meter, cleaning_user_id = v_clean,
      facilities = coalesce(p_facilities,'{}'::jsonb), memo = nullif(p_memo,'')
      where id = v_id and org_id = v_org;
    if not found then raise exception 'building not found in org'; end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_customer_numbers,'[]'::jsonb)) loop
    if coalesce((v_item->>'_deleted')::boolean, false) and (v_item->>'id') is not null then
      update building_customer_numbers set deleted_at = now()
        where id = (v_item->>'id')::bigint and building_id = v_id;
    elsif (v_item->>'id') is not null then
      update building_customer_numbers set
        kind = v_item->>'kind', customer_no = v_item->>'customer_no',
        meter_day = nullif(v_item->>'meter_day','')::int,
        billing_basis = coalesce(v_item->>'billing_basis','current'),
        print_on_bill = coalesce((v_item->>'print_on_bill')::boolean, true),
        holder_name = v_item->>'holder_name',
        line_name = nullif(trim(v_item->>'line_name'), ''),
        calculation_method = case
          when v_item->>'kind' = 'common_elec' then 'auto'
          else coalesce(nullif(v_item->>'calculation_method', ''), 'auto')
        end,
        note = nullif(trim(v_item->>'note'), ''),
        sort_order = coalesce((v_item->>'sort_order')::int, 0)
        where id = (v_item->>'id')::bigint and building_id = v_id;
    else
      insert into building_customer_numbers(
        building_id, kind, customer_no, meter_day, billing_basis, print_on_bill,
        holder_name, line_name, calculation_method, note, sort_order
      ) values (
        v_id, v_item->>'kind', v_item->>'customer_no', nullif(v_item->>'meter_day','')::int,
        coalesce(v_item->>'billing_basis','current'),
        coalesce((v_item->>'print_on_bill')::boolean, true),
        v_item->>'holder_name', nullif(trim(v_item->>'line_name'), ''),
        case
          when v_item->>'kind' = 'common_elec' then 'auto'
          else coalesce(nullif(v_item->>'calculation_method', ''), 'auto')
        end,
        nullif(trim(v_item->>'note'), ''),
        coalesce((v_item->>'sort_order')::int, 0)
      );
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_vendors,'[]'::jsonb)) loop
    if coalesce((v_item->>'_deleted')::boolean, false) and (v_item->>'id') is not null then
      update building_vendors set deleted_at = now()
        where id = (v_item->>'id')::bigint and building_id = v_id;
    elsif (v_item->>'id') is not null then
      update building_vendors set
        vendor_type = v_item->>'vendor_type', name = v_item->>'name', phone = v_item->>'phone',
        memo = v_item->>'memo', sort_order = coalesce((v_item->>'sort_order')::int, 0)
        where id = (v_item->>'id')::bigint and building_id = v_id;
    else
      insert into building_vendors(building_id, vendor_type, name, phone, memo, sort_order)
        values (v_id, v_item->>'vendor_type', v_item->>'name', v_item->>'phone', v_item->>'memo',
                coalesce((v_item->>'sort_order')::int, 0))
        returning id into v_new_id;
      if (v_item->>'client_key') is not null then
        v_vendor_map := v_vendor_map || jsonb_build_object('client_key', v_item->>'client_key', 'id', v_new_id);
      end if;
    end if;
  end loop;

  return jsonb_build_object('building_id', v_id, 'vendors', v_vendor_map);
end $$;

revoke execute on function save_building(bigint,text,text,text,uuid,uuid,uuid,jsonb,text,jsonb,jsonb) from anon;
