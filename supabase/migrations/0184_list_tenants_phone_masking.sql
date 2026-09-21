-- 0184: 입주자 카드 출력 경로를 서버 재조회로 이동한 뒤 입주자 목록 RPC의 전화번호를 마스킹한다.
--
-- 적용 전 확인한 소비자:
-- - TenantCardDocument 출력 경로: 이번 변경에서 서버 route가 occupancy에서 원본 전화번호를 조회하므로 안전하다.
-- - 메시지 발송: 0180에서 recipient ref id로 서버가 전화번호를 해석하므로 안전하다.
-- - 입주자 수정 폼: getUnitOccupancyFull로 occupancies를 직접 조회하므로 안전하다.
-- - app/api/buildings/[id]/tenant-cards XLSX 경로: 전화번호 컬럼을 반환하지 않으므로 안전하다.
-- - 수신자 선택기와 메시지 작성기: 표시와 필터링에만 사용하며 발송은 클라이언트 값을 신뢰하지 않으므로 안전하다.
--
-- list_tenants의 반환 열과 where 절은 유지하고 select 목록의 phone만 마스킹한다.

create or replace function list_tenants(p_building_id bigint)
returns table(
  unit_id bigint, occupancy_id bigint, unit_no text, tenant_name text, phone text,
  room_type_label text, resident_count int, move_in_date date,
  is_vacant boolean, is_overdue boolean,
  payer_name text, vehicle_no text, area_pyeong numeric,
  billing_enabled boolean, print_enabled boolean, bill_name_display text,
  move_out_date date, late_fee_enabled boolean, single_print boolean,
  transfer_method text, sms_opt_in boolean, billing_note text,
  bill_auth boolean, bill_delivery text, occupancy_created_at timestamptz,
  kepco_customer_no text, kepco_meter_no text,
  mgmt_account text, water_account text, elec_account text, gas_account text,
  common_elec_no text
) language sql stable security definer set search_path = public as $$
  select u.id, o.id, u.unit_no, o.tenant_name, public.mask_phone(o.phone), rt.label, o.resident_count, o.move_in_date,
    coalesce(o.status = 'vacant', true) as is_vacant,
    false as is_overdue,
    o.payer_name, o.vehicle_no, u.area_pyeong,
    o.billing_enabled, o.print_enabled, o.bill_name_display,
    o.move_out_date, o.late_fee_enabled, o.single_print,
    o.transfer_method, o.sms_opt_in, o.billing_note,
    o.bill_auth, o.bill_delivery, o.created_at,
    elec_meter.customer_no, elec_meter.meter_no,
    mgmt_account.account, water_account.account, elec_account.account, gas_account.account,
    common_elec.customer_no
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
    where um.unit_id = u.id and um.utility = 'elec'
    order by um.created_at desc, um.id desc
    limit 1
  ) elec_meter on true
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
