-- 0155_tenant_cms_credentials.sql
-- 자동이체(효성 CMS) 조건부 필드: 세대(occupancy) 단위 효성 회원번호·계약번호.
--  · unit_accounts 는 kind(water/elec/gas/mgmt) 제한 + payer_no 없음이라 사용 불가 → occupancies 신규 컬럼.
--  · save_unit_occupancy_full 을 재정의(0117 본문 그대로 복사)하고 SET 목록에 두 컬럼만 추가한다.

-- ===== 1) occupancies 신규 컬럼 =====
alter table occupancies
  add column if not exists cms_member_no   text,   -- 효성 회원번호(숫자 8자리)
  add column if not exists cms_contract_no text;    -- 계약번호(숫자 3자리)

-- ===== 2) 통합 저장 RPC 재정의 (0117 본문 + cms_member_no/cms_contract_no) =====
create or replace function save_unit_occupancy_full(
  p_building_id bigint, p_unit_id bigint, p_occupancy_id bigint,
  p_unit jsonb, p_occupancy jsonb, p_meters jsonb, p_accounts jsonb, p_lease jsonb,
  p_fax_number text, p_property jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_unit_id bigint;
  v_occ_id bigint;
begin
  -- 코어 저장(권한/조직/건물 검증은 내부 함수가 수행: current_user_has_module('tenants') 등)
  v_result := save_unit_occupancy(
    p_building_id, p_unit_id, p_occupancy_id,
    p_unit, p_occupancy, p_meters, p_accounts, p_lease
  );
  v_unit_id := (v_result->>'unit_id')::bigint;
  v_occ_id  := (v_result->>'occupancy_id')::bigint;

  -- 확장 occupancy 컬럼(코어가 기록하지 않는 필드) + fax(값이 오면 갱신, 없으면 보존)
  update occupancies set
    fax_number            = case when p_fax_number is null then fax_number
                                 else nullif(btrim(p_fax_number), '') end,
    sms_opt_in            = coalesce((p_occupancy->>'sms_opt_in')::boolean, false),
    alimtalk_opt_in       = coalesce((p_occupancy->>'alimtalk_opt_in')::boolean, false),
    expected_move_in_date = nullif(p_occupancy->>'expected_move_in_date','')::date,
    discount_type         = coalesce(nullif(p_occupancy->>'discount_type',''), 'general'),
    discount_amount       = nullif(p_occupancy->>'discount_amount','')::bigint,
    homepage_password     = p_occupancy->>'homepage_password',
    mgmt_fee_amount       = nullif(p_occupancy->>'mgmt_fee_amount','')::bigint,
    move_cleaning_fee     = nullif(p_occupancy->>'move_cleaning_fee','')::bigint,
    increase_amount       = nullif(p_occupancy->>'increase_amount','')::bigint,
    billing_day           = p_occupancy->>'billing_day',
    etc_note              = p_occupancy->>'etc_note',
    bill_auth_info        = p_occupancy->>'bill_auth_info',
    cms_member_no         = nullif(p_occupancy->>'cms_member_no',''),
    cms_contract_no       = nullif(p_occupancy->>'cms_contract_no',''),
    phones_extra          = coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(p_occupancy->'phones_extra','[]'::jsonb)) x), '{}'),
    vehicles_extra        = coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(p_occupancy->'vehicles_extra','[]'::jsonb)) x), '{}')
  where id = v_occ_id;

  -- 확장 lease 컬럼(코어는 base 5필드만 upsert) — lease row가 있을 때만
  if p_lease is not null and p_lease <> 'null'::jsonb then
    update lease_contracts set
      lease_type     = nullif(p_lease->>'lease_type',''),
      deposit_date   = nullif(p_lease->>'deposit_date','')::date,
      jeonse_deposit = nullif(p_lease->>'jeonse_deposit','')::bigint,
      bank_account   = p_lease->>'bank_account'
    where occupancy_id = v_occ_id;
  end if;

  -- 부동산(매물)·시설 upsert
  if p_property is not null and p_property <> 'null'::jsonb then
    insert into unit_property_listings(
      unit_id, property_name, address, address_detail, property_type, deal_type, rent_type,
      area_m2, deposit, jeonse_deposit, monthly_rent, mgmt_fee_desc, available_date, location, facilities)
    values (
      v_unit_id, p_property->>'property_name', p_property->>'address', p_property->>'address_detail',
      p_property->>'property_type', p_property->>'deal_type', p_property->>'rent_type',
      nullif(p_property->>'area_m2','')::numeric, nullif(p_property->>'deposit','')::bigint,
      nullif(p_property->>'jeonse_deposit','')::bigint, nullif(p_property->>'monthly_rent','')::bigint,
      p_property->>'mgmt_fee_desc', nullif(p_property->>'available_date','')::date, p_property->>'location',
      coalesce(p_property->'facilities','[]'::jsonb))
    on conflict (unit_id) do update set
      property_name = excluded.property_name, address = excluded.address, address_detail = excluded.address_detail,
      property_type = excluded.property_type, deal_type = excluded.deal_type, rent_type = excluded.rent_type,
      area_m2 = excluded.area_m2, deposit = excluded.deposit, jeonse_deposit = excluded.jeonse_deposit,
      monthly_rent = excluded.monthly_rent, mgmt_fee_desc = excluded.mgmt_fee_desc,
      available_date = excluded.available_date, location = excluded.location, facilities = excluded.facilities,
      deleted_at = null;
  end if;

  return v_result;
end $$;
revoke execute on function save_unit_occupancy_full(bigint,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb) from public, anon;
grant  execute on function save_unit_occupancy_full(bigint,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb) to authenticated;
