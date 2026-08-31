-- 0117_tenant_registration_redesign.sql
-- 입주자 등록/상세(호수·입주민 등록) — Figma node 673-58897, 8섹션 재구성 백엔드.
--  · occupancies / lease_contracts 신규 컬럼(평형·할인·입주예정일·관리비/이사청소/인상액·부과일·홈피비번·인증·복수 전화/차량 등)
--  · unit_meters 공과 확장(공용전기 elec_shared / 한전 kepco)
--  · unit_property_listings 신규(부동산 매물 + 시설정보)
--  · save_unit_occupancy_full: fax + 신규 컬럼 + 부동산까지 원자적 통합 저장 RPC
-- 주의: discount_type/discount_amount/expected_move_in_date 는 0038에서 "PRD 미반영"으로 제거됐던 개념을
--       PRD(tenant-detail.md) 재정의에 따라 재도입한다.

-- ===== 1) occupancies 신규 컬럼 =====
alter table occupancies
  add column if not exists expected_move_in_date date,                   -- 입주예정일
  add column if not exists discount_type         text,                   -- 할인 유형 (기본 general)
  add column if not exists discount_amount       bigint,                 -- 할인 금액
  add column if not exists homepage_password     text,                   -- 홈피 비번
  add column if not exists mgmt_fee_amount        bigint,                 -- 관리비(정액)
  add column if not exists move_cleaning_fee      bigint,                 -- 이사청소비
  add column if not exists increase_amount        bigint,                 -- 인상액
  add column if not exists billing_day            text,                   -- 부과일 (예: 매월 1일)
  add column if not exists etc_note               text,                   -- 기타적요
  add column if not exists bill_auth_info         text,                   -- 고지서 인증 정보
  add column if not exists phones_extra           text[] not null default '{}',   -- 4번째+ 전화번호
  add column if not exists vehicles_extra         text[] not null default '{}';    -- 2번째+ 차량번호

-- ===== 2) lease_contracts 신규 컬럼 =====
alter table lease_contracts
  add column if not exists bank_account text;                            -- 은행/계좌

-- ===== 3) unit_meters 공과 확장(공용전기·한전) =====
alter table unit_meters drop constraint if exists unit_meters_utility_check;
alter table unit_meters add constraint unit_meters_utility_check
  check (utility in ('water','elec','gas','elec_shared','kepco'));

-- ===== 4) 부동산(매물)·시설 정보 =====
create table if not exists unit_property_listings (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  property_name  text,        -- 물건명
  address        text,        -- 물건 주소
  address_detail text,        -- 상세주소
  property_type  text,        -- 물건구분 (원룸 등)
  deal_type      text,        -- 거래형태 (직거래 등)
  rent_type      text,        -- 구분 (월세/전세/매매)
  area_m2        numeric(10,2),-- 면적(㎡)
  deposit        bigint,      -- 보증금
  jeonse_deposit bigint,      -- 전세금
  monthly_rent   bigint,      -- 월세
  mgmt_fee_desc  text,        -- 관리비 내용
  available_date date,        -- 입주가능일
  location       text,        -- 위치
  facilities     jsonb not null default '[]'::jsonb,  -- 시설정보 항목(문자열 배열)
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(unit_id)
);
create index if not exists idx_unit_property_listings_unit on unit_property_listings(unit_id);
create trigger trg_unit_property_listings_updated before update on unit_property_listings
  for each row execute function set_updated_at();

alter table unit_property_listings enable row level security;
create policy upl_select on unit_property_listings for select
  using (unit_id in (
    select u.id from units u join buildings b on b.id = u.building_id
    where b.org_id in (select my_org_ids())
  ));
create policy upl_write on unit_property_listings for all
  using (unit_id in (
    select u.id from units u join buildings b on b.id = u.building_id
    where b.org_id in (select my_org_ids())
  ) and current_user_has_module('tenants'))
  with check (unit_id in (
    select u.id from units u join buildings b on b.id = u.building_id
    where b.org_id in (select my_org_ids())
  ) and current_user_has_module('tenants'));

-- ===== 5) 통합 저장 RPC (fax + 신규 컬럼 + 부동산) =====
-- 코어(save_unit_occupancy)는 그대로 재사용하고, 그 함수가 다루지 않는 확장 컬럼을
-- 뒤이어 같은 트랜잭션에서 갱신한다(기존 save_unit_occupancy_with_fax 패턴 확장).
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
-- 읽기는 unit_property_listings 직접 select(upl_select RLS로 org 스코프) — meters/accounts/lease와 동일 패턴.
