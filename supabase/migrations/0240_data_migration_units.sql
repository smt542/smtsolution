-- 0240_data_migration_units.sql
-- 셋업 > 데이터 이관 — 입주자·이력 kind 매핑 함수(0238 import_migration_rows 디스패처가 행마다 호출).
-- 정책: 사무실 관리자_셋업 설정 3.6 · 엑셀·외부연동 포맷(Data Exchange) 4절 · 데이터 사전 C1~C3 ·
--       사무실 관리자_입주민 등록 3.x · 관리비 부과 세팅 · 미납 관리.
-- 열 정의(한국어 헤더 키): app/(staff)/staff/(app)/setup/components/dataMigration/schemas.ts
--
-- 공통 규칙
--  - 시그니처 (p_org bigint, p_rec jsonb) returns void. 디스패처가 행마다 서브트랜잭션으로 호출하므로
--    여기서 raise 하면 그 행만 실패하고 SQLERRM(한국어 문구)이 화면 오류 내역에 그대로 보인다.
--  - 건물은 (org, 건물 코드, deleted_at is null)로 찾는다. 호실은 그 건물 안 (unit_no, deleted_at is null).
--  - 빈 칸은 nullif(btrim(..),'') 로 null 처리. 숫자는 천단위 쉼표 허용, 날짜 YYYY-MM-DD, 년월 YYYY-MM.
--  - 미래 년월은 받지 않는다(save_meter_readings·save_billing_charges 의 'future period is not allowed'와 동일).
--
-- 1) migrate_tenant (입주자) — 앱 입주자 등록(save_unit_occupancy_full · TenantForm 신규 기본값) 미러링
--    · 호실이 없으면 units 생성(building_id, unit_no, area_pyeong, usage_type='residential', floor=null — 폼 신규와 동일).
--      같은 호실이 삭제 상태로 남아 있으면(units unique(building_id, unit_no)) 오류.
--    · 해당 호실에 occupied/moving_out 입주가 있으면 오류 「호실 %에 이미 입주자가 있어요」.
--    · occupancies 신규 행(status='occupied')을 만든다. 직전 공실 행(퇴실 후 vacant)은 이전 입주자의
--      부과·수납 이력(occupancy_id 귀속)을 보존하기 위해 재사용하지 않는다(목록 RPC는 최신 created_at 행을 사용).
--    열 매핑
--      입주자명→tenant_name, 입금자명→payer_name, 룸→room_type_id(room_types.label, 조직), 인원→resident_count,
--      평형→units.area_pyeong(숫자만 추출, "18평"→18), 입주일→move_in_date, 입주예정일→expected_move_in_date,
--      할인 유형(일반/수급자할인/다자녀할인/기타할인→general/recipient/multichild/etc, 빈칸=general)·할인 금액(일반이면 null),
--      기타적요→etc_note, 이사정산시적요→settlement_note,
--      전화번호→phone/phone2/phone3/phones_extra(쉼표·슬래시로 여러 개), 차량번호→vehicle_no/vehicles_extra,
--      문자 수신·알림톡 수신(빈칸=동의 true, "거부"=false), 홈피 비번→homepage_password,
--      관리비→mgmt_fee_amount, 이사청소→move_cleaning_fee, 인상액→increase_amount,
--      부과금 여부(Y/N, 기본 Y)→billing_enabled, 부과일→billing_day,
--      이체 방식(지로/이체/자동이체/입금/없음, 빈칸=지로, 효성 회원번호만 있으면 자동이체)→transfer_method,
--      효성 회원번호(숫자 ≤8)→occupancies.cms_member_no + unit_accounts(kind='mgmt').cms_member_no
--        (자동이체 판정 list_payment_rows·list_cms_debit_rows·get_bill_documents 가 unit_accounts mgmt 를 본다),
--      계약번호(숫자 ≤3)→cms_contract_no — 둘 다 이체 방식이 자동이체일 때만(폼과 동일). 아니면 오류.
--      연체료 부과 여부(O/X, 기본 O)→late_fee_enabled, 단수 출력 여부(O/X, 기본 O — 폼 신규 기본값)→single_print,
--      부과시 참조사항→billing_note,
--      수도/전기/공용 전기/가스 고객번호·계량기 번호, 한전고객번호·한전계기번호
--        →unit_meters(water/elec/elec_shared/gas/kepco).customer_no·meter_no (값 있는 칸만 덮어씀),
--      고지서 출력 여부(Y/N, 기본=알림톡 미동의일 때만 출력 — 폼 신규 규칙)→print_enabled,
--      고지서 이름 출력 유형(이름 미출력/이름 출력/코드번호 출력, 기본 이름 미출력)→bill_name_display,
--      고지서 인증→bill_auth_info, bill_delivery = 알림톡 동의면 'alimtalk' 아니면 'post'(정책: 동의 세대는 알림톡 고지서),
--      임대구분(월세/전세/협의가능, 기본 월세)·임대 개시일·임대 만료일·보증금·보증금일·임대료·전세금·은행/계좌
--        →lease_contracts(lease_type/start_date/end_date/deposit/deposit_date/monthly_rent/jeonse_deposit/bank_account),
--      물건명·물건 주소·물건구분·거래형태·부동산 구분·면적(㎡)·부동산 보증금/전세금/월세·관리비 내용·입주가능일·위치
--        →unit_property_listings (부동산 열이 하나라도 있을 때만 upsert).
--    무시하는 열: 고지서 발송(정책상 알림톡 수신 동의 여부로 결정 — bill_delivery 는 알림톡 수신으로 산출).
--
-- 2) migrate_fee_item_charge (관리비 항목 단가)
--    세대별 「상시 단가」 테이블은 없다. 관리비 부과 세팅(list_billing)은 fee_item_charges(unit, item, period)를
--    그 달 금액으로 읽고, 이월(carry_over) 항목만 전월 금액을 기본값으로 이어받는다.
--    → 이관 시점의 당월(Asia/Seoul date_trunc('month'))을 period 로 fee_item_charges 에 기록한다
--      (save_billing_charges 와 같은 형태: charged=true, occupancy_id=최신 입주 행).
--    항목은 건물 유형(fee_items.type_id = buildings.type_id, 조직, 미삭제)에서 「항목 명칭」으로 찾는다.
--    중복: 같은 (세대, 항목, 당월) 행이 이미 있으면 오류.
--    무시하는 열: 반올림·일자계산·이월(항목 단위 설정이라 관리비 항목 설정에서 관리 — 세대 행으로 바꾸지 않음), 비고.
--
-- 3) migrate_meter_start (검침 시작지침)
--    앱의 전월지침 = coalesce(당월 행.previous_reading, 전월 행.current_reading) (list_utility_rows·save_meter_readings).
--    → 「기준 년월」(=이관 직전 달) 행의 current_reading 에 지침을 넣는다. 다음 달 검침 화면/저장이 이를 전월지침으로 상속한다.
--      usage·calc_charge·processed_at 은 비워 둔다(기준월 자체는 부과 대상이 아님). 비고→note.
--    값이 있는 공과금(수도 water·전기 elec·가스 gas)만 기록. 모두 비면 오류.
--    중복: 같은 (세대, 공과금, 기준 년월) 행이 이미 있으면 오류.
--
-- 4) migrate_unpaid (미납 잔액)
--    미납 = 확정된 billing_confirmations.total_amount − 유효 payments 합계(list_overdue_periods·list_payment_rows).
--    → 기준 년월로 billing_confirmations(confirmed_at=now(), occupancy_id=현재 입주 행, total_amount=미납액) 를 만들고
--      고지서·이력 조회용 billing_history 스냅샷(items=[{name:'이관 미납액', amount}])을 남긴다(charge_new_occupancies 와 동일 형태).
--    현재 입주 행 = 미삭제 occupancy 중 최신(created_at) 이면서 occupied/moving_out. 없으면 오류.
--    중복: 같은 (세대, 기준 년월)의 billing_confirmations 행이 이미 있으면 오류(unique(unit_id, period)).
--    무시하는 열: 연체료(연체료는 연체 요율표로 계산되는 값이라 저장할 곳이 없음 — 이관 후 서비스가 재계산), 비고.

-- ============ 내부 헬퍼 ============

create or replace function public._mig0240_num(p_rec jsonb, p_key text)
returns numeric
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  v text := nullif(btrim(p_rec->>p_key), '');
begin
  if v is null then return null; end if;
  v := replace(v, ',', '');
  if v !~ '^-?[0-9]+(\.[0-9]+)?$' then
    raise exception '「%」 값이 숫자가 아니에요: %', p_key, p_rec->>p_key;
  end if;
  return v::numeric;
end
$$;

create or replace function public._mig0240_int(p_rec jsonb, p_key text)
returns bigint
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  v numeric := public._mig0240_num(p_rec, p_key);
begin
  if v is null then return null; end if;
  if v <> trunc(v) then
    raise exception '「%」 값은 정수로 입력해 주세요: %', p_key, p_rec->>p_key;
  end if;
  if abs(v) > 2147483647 then
    raise exception '「%」 값이 너무 커요: %', p_key, p_rec->>p_key;
  end if;
  return v::bigint;
end
$$;

create or replace function public._mig0240_date(p_rec jsonb, p_key text)
returns date
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v text := nullif(btrim(p_rec->>p_key), '');
  d date;
begin
  if v is null then return null; end if;
  if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception '「%」 날짜 형식이 올바르지 않아요(YYYY-MM-DD): %', p_key, v;
  end if;
  begin
    d := v::date; -- 2024-02-30 같은 없는 날짜는 캐스트 오류
  exception when others then
    raise exception '「%」 존재하지 않는 날짜예요: %', p_key, v;
  end;
  return d;
end
$$;

create or replace function public._mig0240_ym(p_rec jsonb, p_key text)
returns date
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v text := nullif(btrim(p_rec->>p_key), '');
begin
  if v is null then
    raise exception '「%」을(를) 입력해 주세요(YYYY-MM)', p_key;
  end if;
  if v !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception '「%」 년월 형식이 올바르지 않아요(YYYY-MM): %', p_key, v;
  end if;
  return to_date(v || '-01', 'YYYY-MM-DD');
end
$$;

-- Y/O/동의 → true, N/X/거부 → false, 빈칸 → p_default
create or replace function public._mig0240_bool(p_rec jsonb, p_key text, p_default boolean)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  v text := upper(nullif(btrim(p_rec->>p_key), ''));
begin
  if v is null then return p_default; end if;
  if v in ('Y', 'O', 'YES', 'TRUE', '1', '예', '동의', '출력', '부과') then return true; end if;
  if v in ('N', 'X', 'NO', 'FALSE', '0', '아니오', '거부', '미출력', '미부과') then return false; end if;
  raise exception '「%」 값은 Y/N(또는 O/X)으로 입력해 주세요: %', p_key, p_rec->>p_key;
end
$$;

-- 건물 코드 → 건물 (org 소속·미삭제)
create or replace function public._mig0240_building(p_org bigint, p_rec jsonb, out building_id bigint, out type_id bigint)
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v_code text := nullif(btrim(p_rec->>'건물 코드'), '');
begin
  if v_code is null then
    raise exception '건물 코드를 입력해 주세요';
  end if;
  select b.id, b.type_id into building_id, type_id
    from buildings b
   where b.org_id = p_org and b.code = v_code and b.deleted_at is null
   order by b.id
   limit 1;
  if building_id is null then
    raise exception '건물 코드 %인 건물을 찾을 수 없어요 — 건물 기본을 먼저 이관해 주세요', v_code;
  end if;
end
$$;

-- 건물 + 호실 → 세대 id (미삭제)
create or replace function public._mig0240_unit(p_building_id bigint, p_rec jsonb)
returns bigint
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v_no text := nullif(btrim(p_rec->>'호실'), '');
  v_id bigint;
begin
  if v_no is null then
    raise exception '호실을 입력해 주세요';
  end if;
  select u.id into v_id
    from units u
   where u.building_id = p_building_id and u.unit_no = v_no and u.deleted_at is null;
  if v_id is null then
    raise exception '호실 %을(를) 찾을 수 없어요 — 입주자를 먼저 이관해 주세요', v_no;
  end if;
  return v_id;
end
$$;

revoke execute on function public._mig0240_num(jsonb, text) from public, anon, authenticated;
revoke execute on function public._mig0240_int(jsonb, text) from public, anon, authenticated;
revoke execute on function public._mig0240_date(jsonb, text) from public, anon, authenticated;
revoke execute on function public._mig0240_ym(jsonb, text) from public, anon, authenticated;
revoke execute on function public._mig0240_bool(jsonb, text, boolean) from public, anon, authenticated;
revoke execute on function public._mig0240_building(bigint, jsonb) from public, anon, authenticated;
revoke execute on function public._mig0240_unit(bigint, jsonb) from public, anon, authenticated;

-- ============ 1) 입주자 ============

create or replace function public.migrate_tenant(p_org bigint, p_rec jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_building_id bigint;
  v_type_id bigint;
  v_unit_no text := nullif(btrim(p_rec->>'호실'), '');
  v_unit_id bigint;
  v_occ_id bigint;
  v_area_txt text := nullif(btrim(p_rec->>'평형'), '');
  v_area numeric;
  v_name text := nullif(btrim(p_rec->>'입주자명'), '');
  v_payer text := nullif(btrim(p_rec->>'입금자명'), '');
  v_room text := nullif(btrim(p_rec->>'룸'), '');
  v_room_type_id bigint;
  v_phones text[];
  v_vehicles text[];
  v_sms boolean;
  v_alimtalk boolean;
  v_disc_txt text := nullif(btrim(p_rec->>'할인 유형'), '');
  v_disc_type text;
  v_transfer_txt text := nullif(btrim(p_rec->>'이체 방식'), '');
  v_transfer text;
  v_cms text := nullif(btrim(p_rec->>'효성 회원번호'), '');
  v_contract text := nullif(btrim(p_rec->>'계약번호'), '');
  v_name_disp_txt text := nullif(btrim(p_rec->>'고지서 이름 출력 유형'), '');
  v_name_disp text;
  v_lease_txt text := nullif(btrim(p_rec->>'임대구분'), '');
  v_lease_type text;
  v_prop_type_txt text := nullif(btrim(p_rec->>'물건구분'), '');
  v_deal_txt text := nullif(btrim(p_rec->>'거래형태'), '');
  v_rent_txt text := nullif(btrim(p_rec->>'부동산 구분'), '');
  v_prop_type text := 'oneroom';
  v_deal text := 'direct';
  v_rent text := 'month';
  v_meter record;
begin
  select b.building_id, b.type_id into v_building_id, v_type_id from public._mig0240_building(p_org, p_rec) b;

  if v_unit_no is null then
    raise exception '호실을 입력해 주세요';
  end if;
  if v_name is null then
    raise exception '입주자명을 입력해 주세요';
  end if;

  -- 전화번호(필수, 여러 개면 쉼표·슬래시 구분) / 차량번호
  select coalesce(array_agg(x order by ord), '{}') into v_phones
    from (select btrim(x) as x, ord
            from regexp_split_to_table(coalesce(p_rec->>'전화번호', ''), '[,/]') with ordinality as t(x, ord)) s
   where x <> '';
  if cardinality(v_phones) = 0 then
    raise exception '전화번호를 입력해 주세요';
  end if;
  select coalesce(array_agg(x order by ord), '{}') into v_vehicles
    from (select btrim(x) as x, ord
            from regexp_split_to_table(coalesce(p_rec->>'차량번호', ''), '[,/]') with ordinality as t(x, ord)) s
   where x <> '';

  -- 평형: "18평" 같은 표기 허용(숫자만 추출)
  if v_area_txt is not null then
    v_area_txt := substring(replace(v_area_txt, ',', '') from '[0-9]+(?:\.[0-9]+)?');
    if v_area_txt is null then
      raise exception '「평형」 값이 숫자가 아니에요: %', p_rec->>'평형';
    end if;
    v_area := v_area_txt::numeric;
  end if;

  -- 룸 → room_types(조직)
  if v_room is not null then
    select rt.id into v_room_type_id
      from room_types rt
     where rt.org_id = p_org and rt.label = v_room and rt.deleted_at is null
     order by rt.id limit 1;
    if v_room_type_id is null then
      raise exception '룸 「%」이(가) 룸 유형 설정에 없어요', v_room;
    end if;
  end if;

  -- 수신 동의(빈칸=동의, "거부"=false)
  v_sms := public._mig0240_bool(p_rec, '문자 수신', true);
  v_alimtalk := public._mig0240_bool(p_rec, '알림톡 수신', true);

  v_disc_type := case coalesce(v_disc_txt, '일반')
    when '일반' then 'general'
    when '수급자할인' then 'recipient'
    when '다자녀할인' then 'multichild'
    when '기타할인' then 'etc'
  end;
  if v_disc_type is null then
    raise exception '할인 유형 「%」을(를) 알 수 없어요(일반/수급자할인/다자녀할인/기타할인)', v_disc_txt;
  end if;

  if v_transfer_txt is null then
    v_transfer := case when v_cms is not null then 'auto_transfer' else 'giro' end;
  else
    v_transfer := case v_transfer_txt
      when '지로' then 'giro'
      when '이체' then 'transfer'
      when '자동이체' then 'auto_transfer'
      when '입금' then 'deposit'
      when '없음' then 'none'
    end;
    if v_transfer is null then
      raise exception '이체 방식 「%」을(를) 알 수 없어요(지로/이체/자동이체/입금/없음)', v_transfer_txt;
    end if;
  end if;

  if v_cms is not null then
    if v_cms !~ '^[0-9]{1,8}$' then
      raise exception '효성 회원번호는 숫자 8자리 이내로 입력해 주세요: %', v_cms;
    end if;
  end if;
  if v_contract is not null and v_contract !~ '^[0-9]{1,3}$' then
    raise exception '계약번호는 숫자 3자리 이내로 입력해 주세요: %', v_contract;
  end if;
  if (v_cms is not null or v_contract is not null) and v_transfer <> 'auto_transfer' then
    raise exception '효성 회원번호·계약번호는 이체 방식이 자동이체일 때만 입력할 수 있어요';
  end if;

  v_name_disp := case coalesce(v_name_disp_txt, '이름 미출력')
    when '이름 미출력' then 'none'
    when '이름 출력' then 'name'
    when '코드번호 출력' then 'code'
  end;
  if v_name_disp is null then
    raise exception '고지서 이름 출력 유형 「%」을(를) 알 수 없어요(이름 미출력/이름 출력/코드번호 출력)', v_name_disp_txt;
  end if;

  v_lease_type := case coalesce(v_lease_txt, '월세')
    when '월세' then 'month'
    when '전세' then 'jeonse'
    when '협의가능' then 'negotiable'
  end;
  if v_lease_type is null then
    raise exception '임대구분 「%」을(를) 알 수 없어요(월세/전세/협의가능)', v_lease_txt;
  end if;

  -- 세대: 없으면 생성(폼 신규 저장과 동일 — 층 미지정, 주거용)
  select u.id into v_unit_id
    from units u
   where u.building_id = v_building_id and u.unit_no = v_unit_no and u.deleted_at is null;
  if v_unit_id is null then
    if exists (select 1 from units u where u.building_id = v_building_id and u.unit_no = v_unit_no) then
      raise exception '호실 %은(는) 삭제된 호실로 남아 있어 등록할 수 없어요', v_unit_no;
    end if;
    insert into units(building_id, unit_no, area_pyeong, usage_type)
      values (v_building_id, v_unit_no, v_area, 'residential')
      returning id into v_unit_id;
  else
    if exists (
      select 1 from occupancies o
       where o.unit_id = v_unit_id and o.deleted_at is null
         and o.status in ('occupied', 'moving_out')
    ) then
      raise exception '호실 %에 이미 입주자가 있어요', v_unit_no;
    end if;
    if v_area is not null then
      update units set area_pyeong = v_area where id = v_unit_id;
    end if;
  end if;

  insert into occupancies(
    unit_id, tenant_name, payer_name, phone, phone2, phone3, phones_extra, vehicle_no, vehicles_extra,
    resident_count, room_type_id, move_in_date, expected_move_in_date, status,
    billing_enabled, print_enabled, late_fee_enabled, single_print,
    billing_note, settlement_note, etc_note,
    transfer_method, bill_name_display, bill_delivery, bill_auth, bill_auth_info,
    sms_opt_in, alimtalk_opt_in, discount_type, discount_amount, homepage_password,
    mgmt_fee_amount, move_cleaning_fee, increase_amount, billing_day,
    cms_member_no, cms_contract_no
  ) values (
    v_unit_id, v_name, v_payer, v_phones[1], v_phones[2], v_phones[3],
    coalesce(v_phones[4:], '{}'), v_vehicles[1], coalesce(v_vehicles[2:], '{}'),
    public._mig0240_int(p_rec, '인원')::int, v_room_type_id,
    public._mig0240_date(p_rec, '입주일'), public._mig0240_date(p_rec, '입주예정일'), 'occupied',
    public._mig0240_bool(p_rec, '부과금 여부', true),
    public._mig0240_bool(p_rec, '고지서 출력 여부', not v_alimtalk),
    public._mig0240_bool(p_rec, '연체료 부과 여부', true),
    public._mig0240_bool(p_rec, '단수 출력 여부', true),
    nullif(btrim(p_rec->>'부과시 참조사항'), ''),
    nullif(btrim(p_rec->>'이사정산시적요'), ''),
    nullif(btrim(p_rec->>'기타적요'), ''),
    v_transfer, v_name_disp,
    case when v_alimtalk then 'alimtalk' else 'post' end,
    false, nullif(btrim(p_rec->>'고지서 인증'), ''),
    v_sms, v_alimtalk, v_disc_type,
    case when v_disc_type = 'general' then null else public._mig0240_int(p_rec, '할인 금액') end,
    nullif(btrim(p_rec->>'홈피 비번'), ''),
    public._mig0240_int(p_rec, '관리비'), public._mig0240_int(p_rec, '이사청소'),
    public._mig0240_int(p_rec, '인상액'), nullif(btrim(p_rec->>'부과일'), ''),
    v_cms, v_contract
  ) returning id into v_occ_id;

  -- 자동이체 판정은 unit_accounts(kind='mgmt').cms_member_no 기준
  if v_cms is not null then
    insert into unit_accounts(unit_id, kind, holder, cms_member_no)
      values (v_unit_id, 'mgmt', coalesce(v_payer, v_name), v_cms)
      on conflict (unit_id, kind) do update
        set cms_member_no = excluded.cms_member_no,
            holder = coalesce(unit_accounts.holder, excluded.holder);
  end if;

  -- 고객번호·계량기 번호(값 있는 칸만 덮어씀)
  for v_meter in
    select * from (values
      ('water',       '수도 고객번호',      '수도 계량기 번호'),
      ('elec',        '전기 고객번호',      '전기 계량기 번호'),
      ('elec_shared', '공용 전기 고객번호', '공용 전기 계량기 번호'),
      ('gas',         '가스 고객번호',      '가스 계량기 번호'),
      ('kepco',       '한전고객번호',       '한전계기번호')
    ) as m(utility, cust_key, meter_key)
  loop
    if nullif(btrim(p_rec->>v_meter.cust_key), '') is not null
       or nullif(btrim(p_rec->>v_meter.meter_key), '') is not null then
      insert into unit_meters(unit_id, utility, customer_no, meter_no)
        values (v_unit_id, v_meter.utility,
                nullif(btrim(p_rec->>v_meter.cust_key), ''),
                nullif(btrim(p_rec->>v_meter.meter_key), ''))
        on conflict (unit_id, utility) do update
          set customer_no = coalesce(excluded.customer_no, unit_meters.customer_no),
              meter_no = coalesce(excluded.meter_no, unit_meters.meter_no);
    end if;
  end loop;

  -- 임대 정보(폼은 신규 저장 시 항상 lease 행을 만든다)
  insert into lease_contracts(
    occupancy_id, deposit, monthly_rent, start_date, end_date, expiry_alert,
    lease_type, deposit_date, jeonse_deposit, bank_account
  ) values (
    v_occ_id, public._mig0240_int(p_rec, '보증금'), public._mig0240_int(p_rec, '임대료'),
    public._mig0240_date(p_rec, '임대 개시일'), public._mig0240_date(p_rec, '임대 만료일'), false,
    v_lease_type, public._mig0240_date(p_rec, '보증금일'), public._mig0240_int(p_rec, '전세금'),
    nullif(btrim(p_rec->>'은행/계좌'), '')
  );

  -- 부동산(매물) 정보 — 관련 열이 하나라도 있을 때만
  if exists (
    select 1 from unnest(array['물건명', '물건 주소', '물건구분', '거래형태', '부동산 구분', '면적(㎡)',
                               '부동산 보증금', '부동산 전세금', '부동산 월세', '관리비 내용', '입주가능일', '위치']) k
     where nullif(btrim(p_rec->>k), '') is not null
  ) then
    if v_prop_type_txt is not null then
      v_prop_type := case v_prop_type_txt
        when '원룸' then 'oneroom' when '1.5룸' then 'oneandhalf' when '투룸' then 'tworoom'
        when '쓰리룸' then 'threeroom' when '기타' then 'etc' end;
      if v_prop_type is null then
        raise exception '물건구분 「%」을(를) 알 수 없어요(원룸/1.5룸/투룸/쓰리룸/기타)', v_prop_type_txt;
      end if;
    end if;
    -- 거래형태: 직거래/중개거래 → deal_type. 전세·전·월세는 부동산 구분(rent_type) 값으로 취급.
    if v_deal_txt is not null then
      case v_deal_txt
        when '직거래' then v_deal := 'direct';
        when '중개거래' then v_deal := 'agency';
        when '월세' then v_rent := 'month';
        when '전세' then v_rent := 'jeonse';
        when '전·월세' then v_rent := 'month_jeonse';
        else raise exception '거래형태 「%」을(를) 알 수 없어요(직거래/중개거래)', v_deal_txt;
      end case;
    end if;
    if v_rent_txt is not null then
      v_rent := case v_rent_txt when '월세' then 'month' when '전세' then 'jeonse'
                                when '전·월세' then 'month_jeonse' when '전월세' then 'month_jeonse' end;
      if v_rent is null then
        raise exception '부동산 구분 「%」을(를) 알 수 없어요(월세/전세/전·월세)', v_rent_txt;
      end if;
    end if;

    insert into unit_property_listings(
      unit_id, property_name, address, property_type, deal_type, rent_type,
      area_m2, deposit, jeonse_deposit, monthly_rent, mgmt_fee_desc, available_date, location, facilities)
    values (
      v_unit_id, nullif(btrim(p_rec->>'물건명'), ''), nullif(btrim(p_rec->>'물건 주소'), ''),
      v_prop_type, v_deal, v_rent,
      public._mig0240_num(p_rec, '면적(㎡)'), public._mig0240_int(p_rec, '부동산 보증금'),
      public._mig0240_int(p_rec, '부동산 전세금'), public._mig0240_int(p_rec, '부동산 월세'),
      nullif(btrim(p_rec->>'관리비 내용'), ''), public._mig0240_date(p_rec, '입주가능일'),
      nullif(btrim(p_rec->>'위치'), ''), '[]'::jsonb)
    on conflict (unit_id) do update set
      property_name = excluded.property_name, address = excluded.address,
      property_type = excluded.property_type, deal_type = excluded.deal_type, rent_type = excluded.rent_type,
      area_m2 = excluded.area_m2, deposit = excluded.deposit, jeonse_deposit = excluded.jeonse_deposit,
      monthly_rent = excluded.monthly_rent, mgmt_fee_desc = excluded.mgmt_fee_desc,
      available_date = excluded.available_date, location = excluded.location,
      deleted_at = null;
  end if;
end
$$;

revoke execute on function public.migrate_tenant(bigint, jsonb) from public, anon, authenticated;

-- ============ 2) 관리비 항목 단가 ============

create or replace function public.migrate_fee_item_charge(p_org bigint, p_rec jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_building_id bigint;
  v_type_id bigint;
  v_unit_id bigint;
  v_item_name text := nullif(btrim(p_rec->>'항목 명칭'), '');
  v_item_id bigint;
  v_item_count int;
  v_amount bigint;
  v_period date := date_trunc('month', now() at time zone 'Asia/Seoul')::date;
  v_occ_id bigint;
begin
  select b.building_id, b.type_id into v_building_id, v_type_id from public._mig0240_building(p_org, p_rec) b;
  v_unit_id := public._mig0240_unit(v_building_id, p_rec);

  if v_item_name is null then
    raise exception '항목 명칭을 입력해 주세요';
  end if;
  if v_type_id is null then
    raise exception '건물 유형이 지정되지 않은 건물이에요 — 건물 유형을 먼저 설정해 주세요';
  end if;

  select min(fi.id), count(*) into v_item_id, v_item_count
    from fee_items fi
   where fi.org_id = p_org and fi.type_id = v_type_id and fi.name = v_item_name and fi.deleted_at is null;
  if v_item_count = 0 then
    raise exception '관리비 항목 「%」이(가) 이 건물 유형의 관리비 항목 설정에 없어요', v_item_name;
  end if;
  if v_item_count > 1 then
    raise exception '관리비 항목 「%」이(가) 여러 개라 구분할 수 없어요', v_item_name;
  end if;

  v_amount := public._mig0240_int(p_rec, '금액');
  if v_amount is null then
    raise exception '금액을 입력해 주세요';
  end if;

  if exists (
    select 1 from fee_item_charges c
     where c.unit_id = v_unit_id and c.fee_item_id = v_item_id and c.period = v_period
  ) then
    raise exception '호실 %의 「%」 금액이 이미 등록돼 있어요(%)', p_rec->>'호실', v_item_name, to_char(v_period, 'YYYY-MM');
  end if;

  select o.id into v_occ_id
    from occupancies o
   where o.unit_id = v_unit_id and o.deleted_at is null
   order by o.created_at desc, o.id desc
   limit 1;

  insert into fee_item_charges(unit_id, fee_item_id, period, occupancy_id, charged, amount)
    values (v_unit_id, v_item_id, v_period, v_occ_id, true, v_amount::int);
end
$$;

revoke execute on function public.migrate_fee_item_charge(bigint, jsonb) from public, anon, authenticated;

-- ============ 3) 검침 시작지침 ============

create or replace function public.migrate_meter_start(p_org bigint, p_rec jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_building_id bigint;
  v_type_id bigint;
  v_unit_id bigint;
  v_period date;
  v_note text := nullif(btrim(p_rec->>'비고'), '');
  v_m record;
  v_val numeric;
  v_count int := 0;
begin
  select b.building_id, b.type_id into v_building_id, v_type_id from public._mig0240_building(p_org, p_rec) b;
  v_unit_id := public._mig0240_unit(v_building_id, p_rec);
  v_period := public._mig0240_ym(p_rec, '기준 년월');
  if v_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception '기준 년월 %은(는) 미래 달이라 등록할 수 없어요', to_char(v_period, 'YYYY-MM');
  end if;

  for v_m in
    select * from (values ('water', '수도 전월지침', '수도'), ('elec', '전기 전월지침', '전기'), ('gas', '가스 전월지침', '가스'))
      as t(utility, col, label)
  loop
    v_val := public._mig0240_num(p_rec, v_m.col);
    continue when v_val is null;
    if v_val < 0 then
      raise exception '「%」 값은 0 이상이어야 해요: %', v_m.col, p_rec->>v_m.col;
    end if;
    if exists (
      select 1 from meter_readings r
       where r.unit_id = v_unit_id and r.utility = v_m.utility and r.period = v_period
    ) then
      raise exception '호실 %의 % %월 검침이 이미 있어요', p_rec->>'호실', v_m.label, to_char(v_period, 'YYYY-MM');
    end if;
    -- 기준월 current_reading = 다음 달 전월지침(list_utility_rows: coalesce(cur.previous_reading, prev.current_reading))
    insert into meter_readings(unit_id, utility, period, current_reading, note)
      values (v_unit_id, v_m.utility, v_period, v_val, v_note);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception '등록할 지침이 없어요 — 수도·전기·가스 전월지침 중 하나 이상 입력해 주세요';
  end if;
end
$$;

revoke execute on function public.migrate_meter_start(bigint, jsonb) from public, anon, authenticated;

-- ============ 4) 미납 잔액 ============

create or replace function public.migrate_unpaid(p_org bigint, p_rec jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_building_id bigint;
  v_type_id bigint;
  v_unit_id bigint;
  v_period date;
  v_amount bigint;
  v_occ_id bigint;
  v_occ_status occupancy_status;
  v_tenant text;
begin
  select b.building_id, b.type_id into v_building_id, v_type_id from public._mig0240_building(p_org, p_rec) b;
  v_unit_id := public._mig0240_unit(v_building_id, p_rec);
  v_period := public._mig0240_ym(p_rec, '기준 년월');
  if v_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception '기준 년월 %은(는) 미래 달이라 등록할 수 없어요', to_char(v_period, 'YYYY-MM');
  end if;

  v_amount := public._mig0240_int(p_rec, '미납액');
  if v_amount is null then
    raise exception '미납액을 입력해 주세요';
  end if;
  if v_amount <= 0 then
    raise exception '미납액은 0보다 커야 해요: %', p_rec->>'미납액';
  end if;
  -- 연체료 열은 숫자 형식만 확인하고 저장하지 않는다(연체료는 연체 요율표로 계산).
  perform public._mig0240_num(p_rec, '연체료');

  select o.id, o.status, o.tenant_name into v_occ_id, v_occ_status, v_tenant
    from occupancies o
   where o.unit_id = v_unit_id and o.deleted_at is null
   order by o.created_at desc, o.id desc
   limit 1;
  if v_occ_id is null or v_occ_status not in ('occupied', 'moving_out') then
    raise exception '호실 %에 입주자가 없어요 — 입주자를 먼저 이관해 주세요', p_rec->>'호실';
  end if;

  if exists (select 1 from billing_confirmations bc where bc.unit_id = v_unit_id and bc.period = v_period) then
    raise exception '호실 %의 %월 부과 내역이 이미 있어요', p_rec->>'호실', to_char(v_period, 'YYYY-MM');
  end if;

  insert into billing_confirmations(unit_id, period, occupancy_id, total_amount, confirmed_at, confirmed_by)
    values (v_unit_id, v_period, v_occ_id, v_amount::int, now(), auth.uid());

  insert into billing_history(unit_id, period, occupancy_id, tenant_name, total_amount, items, confirmed_at, confirmed_by)
    values (v_unit_id, v_period, v_occ_id, v_tenant, v_amount::int,
            jsonb_build_array(jsonb_build_object('fee_item_id', null, 'name', '이관 미납액', 'charged', true, 'amount', v_amount)),
            now(), auth.uid());
end
$$;

revoke execute on function public.migrate_unpaid(bigint, jsonb) from public, anon, authenticated;
