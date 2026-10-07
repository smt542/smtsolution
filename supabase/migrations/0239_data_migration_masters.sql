-- 0239_data_migration_masters.sql
-- 셋업 > 데이터 이관(정책서 사무실 관리자_셋업 설정 3.6 · Data Exchange 4절) kind별 매핑 함수 — 마스터·건물 하위 일부.
-- 0238 import_migration_rows(kind, rows)가 CSV 한 행마다 public.migrate_<kind>(org_id, rec)를 서브트랜잭션으로 호출한다.
-- 여기서 raise한 메시지(SQLERRM)가 그대로 화면 오류 모달·오류 내역에 「행 번호 + 사유」로 나가므로 한국어로 쓴다.
-- 모두 org를 인자로 받으므로 사용자가 직접 호출하면 안 된다 → public·anon·authenticated 실행 권한 회수
-- (security definer 디스패처가 소유자 권한으로 호출한다).
-- rec 키 = schemas.ts의 한국어 헤더. 빈 문자열은 null로 본다(nullif(trim(..),'')).
--
-- ■ migrate_vendor_master (거래처 → vendors)
--   구분 → vendor_categories.label(조직별 고정 8종, 0153. 띄어쓰기·대소문자 무시 매칭) → category_id
--   업체명 → name · 담당자 → manager · 전화번호 → phone · 계좌번호 → bank_account · 비고 → memo
--   중복: 같은 조직·같은 구분·같은 업체명(앞뒤 공백 무시) → 오류.
--
-- ■ migrate_building (건물 기본 → buildings) — save_building(0200)과 같은 저장 형태
--   건물 코드 → code(숫자 3자리. 엑셀이 앞자리 0을 지운 1~2자리 숫자는 0으로 채움) · 건물명 → name
--   건물 유형 → type_id(조직 building_types 라벨) + basic_extra.buildingTypeLabel
--     (조직 유형에 없어도 화면 기본 선택지 빌라·빌딩은 라벨만 저장, 그 밖의 라벨은 오류)
--   공동현관 → entrance_password · 주소 → address
--   상세주소/고지서 부과 그룹 유형/수도 고객번호 보유/계약일/해지일 → basic_extra.{addressDetail,groupType,waterCount,contractDate,terminationDate}
--   사무 담당자 → manager_user_id · 현장 관리자 → meter_user_id (조직 소속·활성 직원의 profiles.full_name 일치)
--   적립금 유형/적립금 메모 → reserve_fund.{type,memo}
--   건물주명 → owner_name · 건물주 전화번호(주) → owner_phone
--   건물주 전화번호(부)/건물주 주소/건물주 비고 → owner_extra.{phoneSub,address,memo}
--   가스회사/가스전화/가스 계좌번호 → extra_info.utilities.gas.extra.{가스회사,가스전화,계좌번호} (건물 등록 폼 가스 하단 필드)
--   부과시 참조사항 → billing_note · 건물 메모 → memo
--   무시(대응 컬럼 없음): 없음 — CSV 열은 모두 매핑된다. (건물 상시 공지문·청소 담당·시설 플래그는 CSV에 없어 빈 값)
--   중복: 같은 조직에 같은 건물 코드(삭제된 건물 포함 — buildings_org_id_code_key가 삭제 행도 막는다) → 오류.
--
-- ■ migrate_building_vendor (건물 협력업체 → building_vendors + buildings.vendor_details)
--   건물 코드 → 조직의 삭제되지 않은 건물 · 업체 구분+업체명 → 거래처(vendors) — 없으면 오류
--   building_vendors(vendor_type, name, phone=거래처 전화번호, memo=비고, sort_order=폼 업체 순서)
--   vendor_details.vendors.<폼 업체 키> = {fields: 구분별 보충 필드 + 계좌번호(거래처), assigned: true}
--     (건물 등록 폼 config/vendors.ts의 라벨로 저장. 정화조 날짜→날짜, 정화조 금액·검사 금액→금액)
--   해당 구분에 속하지 않는 열은 무시한다(양식 안내: 해당 구분에 없는 열은 비워 두세요).
--   중복: 같은 건물·같은 구분이 이미 지정됨 → 오류.
--
-- ■ migrate_building_util (건물 공과금 정보 → building_customer_numbers + buildings.extra_info)
--   구분(수도/공용 전기/전기/가스 정보) → kind(water/common_elec/elec/gas)
--   고객번호 → customer_no · 성명/계약명 → holder_name · 조회 → line_name · 메모 → note
--   검침일(“25일”·“25”) → meter_day · 고지기간 출력 Y/N → print_on_bill(공용 전기는 항상 출력)
--   계산(계산1) 「수동」 → calculation_method manual, 그 밖에는 auto(공용 전기는 항상 auto)
--   월분 「전월」 → billing_basis prev, 「당월」·빈 값 → current.
--     양식 열거가 「입금/보류」라 이 값은 이체 구분으로 보고 이체 칸이 비어 있으면 이체로 옮긴다.
--   입금·이체·고지기간·계산법(계산2) → extra_info.utilities.<kind>.cards[n] 보충 필드
--     (n = 그 건물·kind의 기존 고객번호 수 = 화면 카드 순서. 공용 전기는 계산법 칸이 없어 무시)
--   중복: 같은 건물·같은 kind·같은 고객번호(삭제 안 된 행) → 오류.

-- ───────────────────────── 거래처 ─────────────────────────
create or replace function public.migrate_vendor_master(p_org bigint, p_rec jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cat_label text := nullif(trim(p_rec->>'구분'), '');
  v_name text := nullif(trim(p_rec->>'업체명'), '');
  v_cat bigint;
begin
  if v_cat_label is null then
    raise exception '구분을 입력해 주세요';
  end if;
  if v_name is null then
    raise exception '업체명을 입력해 주세요';
  end if;

  select id into v_cat
    from vendor_categories
   where org_id = p_org
     and regexp_replace(lower(label), '[[:space:]]+', '', 'g')
         = regexp_replace(lower(v_cat_label), '[[:space:]]+', '', 'g')
   order by (label = v_cat_label) desc, id
   limit 1;
  if v_cat is null then
    raise exception '구분 「%」은(는) 협력업체 관리에 없는 구분이에요', v_cat_label;
  end if;

  if exists (
    select 1 from vendors
     where org_id = p_org and category_id = v_cat and trim(name) = v_name
  ) then
    raise exception '이미 등록된 거래처예요 (구분 %, 업체명 %)', v_cat_label, v_name;
  end if;

  insert into vendors(org_id, category_id, name, manager, phone, bank_account, memo)
  values (
    p_org, v_cat, v_name,
    nullif(trim(p_rec->>'담당자'), ''),
    nullif(trim(p_rec->>'전화번호'), ''),
    nullif(trim(p_rec->>'계좌번호'), ''),
    nullif(trim(p_rec->>'비고'), '')
  );
end
$$;

revoke execute on function public.migrate_vendor_master(bigint, jsonb) from public, anon, authenticated;

-- ───────────────────────── 건물 기본 ─────────────────────────
create or replace function public.migrate_building(p_org bigint, p_rec jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code text := nullif(trim(p_rec->>'건물 코드'), '');
  v_name text := nullif(trim(p_rec->>'건물명'), '');
  v_address text := nullif(trim(p_rec->>'주소'), '');
  v_type_label text := nullif(trim(p_rec->>'건물 유형'), '');
  v_group text := nullif(trim(p_rec->>'고지서 부과 그룹 유형'), '');
  v_water text := nullif(trim(p_rec->>'수도 고객번호 보유'), '');
  v_contract_raw text := nullif(trim(p_rec->>'계약일'), '');
  v_term_raw text := nullif(trim(p_rec->>'해지일'), '');
  v_mgr_name text := nullif(trim(p_rec->>'사무 담당자'), '');
  v_meter_name text := nullif(trim(p_rec->>'현장 관리자'), '');
  v_fund_type text := nullif(trim(p_rec->>'적립금 유형'), '');
  v_gas_company text := nullif(trim(p_rec->>'가스회사'), '');
  v_gas_phone text := nullif(trim(p_rec->>'가스전화'), '');
  v_gas_account text := nullif(trim(p_rec->>'가스 계좌번호'), '');
  v_contract date;
  v_term date;
  v_type bigint;
  v_mgr uuid;
  v_meter uuid;
  v_cnt integer;
  v_deleted timestamptz;
  v_gas_extra jsonb := '{}'::jsonb;
  v_extra_info jsonb;
begin
  -- 필수
  if v_code is null then raise exception '건물 코드를 입력해 주세요'; end if;
  if v_name is null then raise exception '건물명을 입력해 주세요'; end if;
  if v_address is null then raise exception '주소를 입력해 주세요'; end if;

  -- 건물 코드 = 숫자 3자리(0200). 엑셀이 앞자리 0을 지운 1~2자리 숫자는 0으로 채운다.
  if v_code ~ '^[0-9]{1,2}$' then
    v_code := lpad(v_code, 3, '0');
  end if;
  if v_code !~ '^[0-9]{3}$' then
    raise exception '건물 코드 「%」는 숫자 3자리로 적어 주세요', v_code;
  end if;

  select deleted_at into v_deleted from buildings where org_id = p_org and code = v_code;
  if found then
    if v_deleted is null then
      raise exception '건물 코드 %는 이미 등록되어 있어요', v_code;
    else
      raise exception '건물 코드 %는 삭제된 건물이 쓰고 있어 다시 쓸 수 없어요', v_code;
    end if;
  end if;

  -- 건물 유형: 조직 building_types 라벨. 화면 기본 선택지(빌라·빌딩)는 유형 행이 없어도 라벨만 저장한다.
  if v_type_label is not null then
    select id into v_type from building_types where org_id = p_org and label = v_type_label;
    if v_type is null and v_type_label not in ('빌라', '빌딩') then
      raise exception '건물 유형 「%」은(는) 등록되지 않은 유형이에요', v_type_label;
    end if;
  end if;

  if v_group is not null and v_group not in ('1', '2', '3', '4', '5') then
    raise exception '고지서 부과 그룹 유형은 1~5 중 하나로 적어 주세요 (입력값 %)', v_group;
  end if;
  if v_water is not null and v_water not in ('1', '2', '3', '4', '5', '6', '7', '8', '10') then
    raise exception '수도 고객번호 보유는 1~8 또는 10으로 적어 주세요 (입력값 %)', v_water;
  end if;

  if v_contract_raw is not null then
    begin
      v_contract := v_contract_raw::date;
    exception when others then
      raise exception '계약일 「%」은(는) YYYY-MM-DD 형식으로 적어 주세요', v_contract_raw;
    end;
  end if;
  if v_term_raw is not null then
    begin
      v_term := v_term_raw::date;
    exception when others then
      raise exception '해지일 「%」은(는) YYYY-MM-DD 형식으로 적어 주세요', v_term_raw;
    end;
  end if;
  if v_contract is not null and v_term is not null and v_term < v_contract then
    raise exception '해지일이 계약일보다 빨라요';
  end if;

  if v_fund_type is not null and v_fund_type not in ('적립금', '장기수선충당금', '기타', '없음') then
    raise exception '적립금 유형은 장기수선충당금·기타·없음 중 하나로 적어 주세요 (입력값 %)', v_fund_type;
  end if;

  -- 담당자: 조직 소속·활성 직원 이름(profiles.full_name) 일치. 동명이인은 구분할 수 없어 오류.
  if v_mgr_name is not null then
    select count(*), min(m.user_id::text)::uuid into v_cnt, v_mgr
      from org_members m join profiles p on p.user_id = m.user_id
     where m.org_id = p_org and p.is_active and trim(p.full_name) = v_mgr_name;
    if v_cnt = 0 then
      raise exception '사무 담당자 「%」을(를) 직원 목록에서 찾을 수 없어요', v_mgr_name;
    elsif v_cnt > 1 then
      raise exception '사무 담당자 「%」과(와) 이름이 같은 직원이 여러 명이라 구분할 수 없어요', v_mgr_name;
    end if;
  end if;
  if v_meter_name is not null then
    select count(*), min(m.user_id::text)::uuid into v_cnt, v_meter
      from org_members m join profiles p on p.user_id = m.user_id
     where m.org_id = p_org and p.is_active and trim(p.full_name) = v_meter_name;
    if v_cnt = 0 then
      raise exception '현장 관리자 「%」을(를) 직원 목록에서 찾을 수 없어요', v_meter_name;
    elsif v_cnt > 1 then
      raise exception '현장 관리자 「%」과(와) 이름이 같은 직원이 여러 명이라 구분할 수 없어요', v_meter_name;
    end if;
  end if;

  -- 가스 하단 공통 필드(건물 등록 폼 GAS_EXTRA) → extra_info.utilities.gas.extra
  if v_gas_company is not null then v_gas_extra := v_gas_extra || jsonb_build_object('가스회사', v_gas_company); end if;
  if v_gas_phone is not null then v_gas_extra := v_gas_extra || jsonb_build_object('가스전화', v_gas_phone); end if;
  if v_gas_account is not null then v_gas_extra := v_gas_extra || jsonb_build_object('계좌번호', v_gas_account); end if;
  if v_gas_extra <> '{}'::jsonb then
    v_extra_info := jsonb_build_object('utilities',
      jsonb_build_object('gas', jsonb_build_object('cards', '[]'::jsonb, 'extra', v_gas_extra)));
  end if;

  insert into buildings(
    org_id, code, name, address, type_id, entrance_password,
    manager_user_id, meter_user_id, facilities, memo, billing_note,
    owner_name, owner_phone,
    reserve_fund, owner_extra, basic_extra, extra_info)
  values (
    p_org, v_code, v_name, v_address, v_type, nullif(trim(p_rec->>'공동현관'), ''),
    v_mgr, v_meter, '{}'::jsonb,
    nullif(trim(p_rec->>'건물 메모'), ''),
    nullif(trim(p_rec->>'부과시 참조사항'), ''),
    nullif(trim(p_rec->>'건물주명'), ''),
    nullif(trim(p_rec->>'건물주 전화번호(주)'), ''),
    jsonb_build_object(
      'type', coalesce(v_fund_type, '적립금'),
      'memo', coalesce(nullif(trim(p_rec->>'적립금 메모'), ''), '')),
    jsonb_build_object(
      'phoneSub', coalesce(nullif(trim(p_rec->>'건물주 전화번호(부)'), ''), ''),
      'address', coalesce(nullif(trim(p_rec->>'건물주 주소'), ''), ''),
      'addressDetail', '',
      'memo', coalesce(nullif(trim(p_rec->>'건물주 비고'), ''), '')),
    jsonb_build_object(
      'groupType', coalesce(v_group, '1'),
      'waterCount', coalesce(v_water, '1'),
      'contractDate', coalesce(to_char(v_contract, 'YYYY-MM-DD'), ''),
      'terminationDate', coalesce(to_char(v_term, 'YYYY-MM-DD'), ''),
      'standingNotice', '',
      'addressDetail', coalesce(nullif(trim(p_rec->>'상세주소'), ''), ''),
      'buildingTypeLabel', coalesce(v_type_label, '')),
    v_extra_info
  );
end
$$;

revoke execute on function public.migrate_building(bigint, jsonb) from public, anon, authenticated;

-- ───────────────────────── 건물 협력업체 ─────────────────────────
create or replace function public.migrate_building_vendor(p_org bigint, p_rec jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code text := nullif(trim(p_rec->>'건물 코드'), '');
  v_cat_label text := nullif(trim(p_rec->>'업체 구분'), '');
  v_name text := nullif(trim(p_rec->>'업체명'), '');
  v_cat_norm text;
  v_building bigint;
  v_details jsonb;
  v_key text;          -- 건물 등록 폼 업체 키(config/vendors.ts)
  v_vendor_type text;  -- building_vendors.vendor_type
  v_sort integer;      -- 폼 업체 순서
  v_slots integer;     -- 같은 vendor_type을 쓰는 폼 업체 수
  v_vendor record;
  v_fields jsonb := '{}'::jsonb;
  v_col record;
  v_val text;
  v_date date;
begin
  if v_code is null then raise exception '건물 코드를 입력해 주세요'; end if;
  if v_cat_label is null then raise exception '업체 구분을 입력해 주세요'; end if;
  if v_name is null then raise exception '업체명을 입력해 주세요'; end if;
  if v_code ~ '^[0-9]{1,2}$' then v_code := lpad(v_code, 3, '0'); end if;

  select id, vendor_details into v_building, v_details
    from buildings where org_id = p_org and code = v_code and deleted_at is null;
  if v_building is null then
    raise exception '건물 코드 %를 찾을 수 없어요', v_code;
  end if;

  v_cat_norm := regexp_replace(lower(v_cat_label), '[[:space:]]+', '', 'g');
  select k, t, s, n into v_key, v_vendor_type, v_sort, v_slots
    from (values
      ('청소업체',         'cleaning',       'etc',      0, 4),
      ('정화조업체',       'septic',         'septic',   1, 1),
      ('인터넷업체',       'internet',       'etc',      2, 4),
      ('전기안전업체',     'elec_safety',    'electric', 3, 1),
      ('승강기보수업체',   'elevator_maint', 'elevator', 5, 2),
      ('승강기정기검사업체', 'elevator_insp', 'elevator', 6, 2),
      ('소방검사업체',     'fire',           'fire',     7, 1),
      ('cctv업체',         'cctv',           'etc',      8, 4)
    ) m(label, k, t, s, n)
   where m.label = v_cat_norm;
  if v_key is null then
    raise exception '업체 구분 「%」은(는) 사용할 수 없는 구분이에요', v_cat_label;
  end if;

  -- 거래처(구분 + 업체명)
  select v.id, v.name, v.phone, v.bank_account into v_vendor
    from vendors v join vendor_categories c on c.id = v.category_id
   where v.org_id = p_org
     and regexp_replace(lower(c.label), '[[:space:]]+', '', 'g') = v_cat_norm
     and trim(v.name) = v_name
   order by v.id
   limit 1;
  if v_vendor.id is null then
    raise exception '거래처에 「% / %」 업체가 없어요. 거래처를 먼저 등록해 주세요', v_cat_label, v_name;
  end if;

  -- 중복: 같은 구분이 이미 지정됐거나, 같은 vendor_type 칸이 모두 찼으면 오류
  if coalesce(v_details #>> array['vendors', v_key, 'assigned'], '') = 'true'
     or (select count(*) from building_vendors
          where building_id = v_building and vendor_type = v_vendor_type and deleted_at is null) >= v_slots then
    raise exception '건물 %에 % 업체가 이미 지정되어 있어요', v_code, v_cat_label;
  end if;

  -- 구분별 보충 필드: (CSV 열, 폼 라벨, 형식)
  for v_col in
    select csv, label, typ from (values
      ('cleaning',       '청소 횟수',    '청소 횟수',    'num'),
      ('cleaning',       '청소 요일',    '청소 요일',    'text'),
      ('cleaning',       '청소 금액',    '청소 금액',    'num'),
      ('septic',         '정화조 구분',  '정화조 구분',  'text'),
      ('septic',         '정화조 날짜',  '날짜',         'date'),
      ('septic',         '정화조 금액',  '금액',         'num'),
      ('septic',         '정화조 용량',  '정화조 용량',  'text'),
      ('internet',       '고객번호',     '고객번호',     'text'),
      ('internet',       '인터넷 전화',  '인터넷 전화',  'text'),
      ('internet',       '인터넷 금액',  '인터넷 금액',  'num'),
      ('internet',       '출력',         '출력',         'yn'),
      ('internet',       '납부일',       '납부일',       'text'),
      ('internet',       '만료일',       '만료일',       'date'),
      ('elec_safety',    '관리 금액',    '관리 금액',    'num'),
      ('elec_safety',    '안전 구분',    '안전 구분',    'text'),
      ('elevator_maint', '승강기 금액',  '승강기 금액',  'num'),
      ('elevator_maint', '설치일',       '설치일',       'date'),
      ('elevator_maint', '담당자',       '담당자',       'text'),
      ('elevator_maint', '승강기 구분',  '승강기 구분',  'text'),
      ('elevator_maint', '계약일자',     '계약일자',     'date'),
      ('elevator_insp',  '검사일',       '검사일',       'date'),
      ('elevator_insp',  '검사 금액',    '금액',         'num'),
      ('elevator_insp',  '안전관리',     '안전관리',     'text'),
      ('elevator_insp',  '선임일',       '선임일',       'date'),
      ('elevator_insp',  '일련번호',     '일련번호',     'text'),
      ('elevator_insp',  '고유번호',     '고유번호',     'text'),
      ('elevator_insp',  '운행층',       '운행층',       'text'),
      ('elevator_insp',  '비상통화',     '비상통화',     'text'),
      ('fire',           '검사일',       '검사일',       'date'),
      ('fire',           '검사 금액',    '금액',         'num'),
      ('fire',           '담당',         '담당',         'text'),
      ('fire',           '보고일자',     '보고일자',     'date'),
      ('fire',           '선임일자',     '선임일자',     'date'),
      ('cctv',           '카메라 대수',  '카메라 대수',  'num'),
      ('cctv',           '녹화 보관일수', '녹화 보관일수', 'num'),
      ('cctv',           '관리 금액',    '관리 금액',    'num'),
      ('cctv',           '담당자',       '담당자',       'text'),
      ('cctv',           '설치일',       '설치일',       'date'),
      ('cctv',           '계약일',       '계약일',       'date')
    ) f(vkey, csv, label, typ)
    where f.vkey = v_key
  loop
    v_val := nullif(trim(p_rec->>v_col.csv), '');
    continue when v_val is null;
    if v_col.typ = 'num' then
      v_val := replace(v_val, ',', '');
      if v_val !~ '^-?[0-9]+(\.[0-9]+)?$' then
        raise exception '% 「%」은(는) 숫자로 적어 주세요', v_col.csv, p_rec->>v_col.csv;
      end if;
    elsif v_col.typ = 'date' then
      begin
        v_date := v_val::date;
      exception when others then
        raise exception '% 「%」은(는) YYYY-MM-DD 형식으로 적어 주세요', v_col.csv, v_val;
      end;
      v_val := to_char(v_date, 'YYYY-MM-DD');
    elsif v_col.typ = 'yn' then
      v_val := upper(v_val);
      if v_val not in ('Y', 'N') then
        raise exception '% 값은 Y 또는 N으로 적어 주세요 (입력값 %)', v_col.csv, p_rec->>v_col.csv;
      end if;
    end if;
    v_fields := v_fields || jsonb_build_object(v_col.label, v_val);
  end loop;

  -- 계좌번호는 거래처 정보에서 가져온다(폼에서도 업체 선택 시 거래처 값으로 채운다).
  if nullif(trim(v_vendor.bank_account), '') is not null then
    v_fields := v_fields || jsonb_build_object('계좌번호', trim(v_vendor.bank_account));
  end if;

  insert into building_vendors(building_id, vendor_type, name, phone, memo, sort_order)
  values (v_building, v_vendor_type, v_vendor.name, nullif(trim(v_vendor.phone), ''),
          nullif(trim(p_rec->>'비고'), ''), v_sort);

  v_details := coalesce(v_details, '{}'::jsonb);
  update buildings
     set vendor_details = jsonb_set(
           v_details, '{vendors}',
           coalesce(v_details->'vendors', '{}'::jsonb)
             || jsonb_build_object(v_key, jsonb_build_object('fields', v_fields, 'assigned', true)))
   where id = v_building;
end
$$;

revoke execute on function public.migrate_building_vendor(bigint, jsonb) from public, anon, authenticated;

-- ───────────────────────── 건물 공과금 정보 ─────────────────────────
create or replace function public.migrate_building_util(p_org bigint, p_rec jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code text := nullif(trim(p_rec->>'건물 코드'), '');
  v_kind_label text := nullif(trim(p_rec->>'구분'), '');
  v_no text := nullif(trim(p_rec->>'고객번호'), '');
  v_month text := nullif(trim(p_rec->>'월분'), '');
  v_transfer text := nullif(trim(p_rec->>'이체'), '');
  v_calc text := coalesce(nullif(trim(p_rec->>'계산'), ''), nullif(trim(p_rec->>'계산1'), ''));
  v_method text := coalesce(nullif(trim(p_rec->>'계산법'), ''), nullif(trim(p_rec->>'계산2'), ''));
  v_day_raw text := nullif(trim(p_rec->>'검침일'), '');
  v_print_raw text := upper(nullif(trim(p_rec->>'고지기간 출력'), ''));
  v_deposit text := nullif(trim(p_rec->>'입금'), '');
  v_period text := nullif(trim(p_rec->>'고지기간'), '');
  v_kind text;
  v_building bigint;
  v_extra jsonb;
  v_basis text := 'current';
  v_day integer;
  v_print boolean := true;
  v_calc_method text := 'auto';
  v_sort integer;
  v_idx integer;
  v_card jsonb := '{}'::jsonb;
  v_cards jsonb;
begin
  if v_code is null then raise exception '건물 코드를 입력해 주세요'; end if;
  if v_kind_label is null then raise exception '구분을 입력해 주세요'; end if;
  if v_no is null then raise exception '고객번호를 입력해 주세요'; end if;
  if v_code ~ '^[0-9]{1,2}$' then v_code := lpad(v_code, 3, '0'); end if;

  select id, extra_info into v_building, v_extra
    from buildings where org_id = p_org and code = v_code and deleted_at is null;
  if v_building is null then
    raise exception '건물 코드 %를 찾을 수 없어요', v_code;
  end if;

  v_kind := case regexp_replace(v_kind_label, '[[:space:]]+', '', 'g')
    when '수도정보' then 'water' when '수도' then 'water'
    when '공용전기정보' then 'common_elec' when '공용전기' then 'common_elec'
    when '전기정보' then 'elec' when '전기' then 'elec'
    when '가스정보' then 'gas' when '가스' then 'gas'
  end;
  if v_kind is null then
    raise exception '구분 「%」은(는) 수도 정보·공용 전기정보·전기 정보·가스 정보 중 하나로 적어 주세요', v_kind_label;
  end if;

  if exists (
    select 1 from building_customer_numbers
     where building_id = v_building and kind = v_kind and customer_no = v_no and deleted_at is null
  ) then
    raise exception '건물 %에 % 고객번호 %가 이미 등록되어 있어요', v_code, v_kind_label, v_no;
  end if;

  -- 월분: 당월/전월 → billing_basis. 양식 열거(입금/보류)·이체 값은 이체 구분으로 본다.
  if v_month is not null then
    if v_month = '전월' then
      v_basis := 'prev';
    elsif v_month = '당월' then
      v_basis := 'current';
    elsif v_month in ('이체', '입금', '보류') then
      v_transfer := coalesce(v_transfer, v_month);
    else
      raise exception '월분 「%」은(는) 당월 또는 전월로 적어 주세요', v_month;
    end if;
  end if;

  if v_day_raw is not null then
    if v_day_raw !~ '^[0-9]{1,2}일?$' then
      raise exception '검침일 「%」은(는) 1~31일 사이로 적어 주세요', v_day_raw;
    end if;
    v_day := regexp_replace(v_day_raw, '[^0-9]', '', 'g')::integer;
    if v_day < 1 or v_day > 31 then
      raise exception '검침일 「%」은(는) 1~31일 사이로 적어 주세요', v_day_raw;
    end if;
  end if;

  if v_print_raw is not null and v_print_raw not in ('Y', 'N') then
    raise exception '고지기간 출력은 Y 또는 N으로 적어 주세요 (입력값 %)', p_rec->>'고지기간 출력';
  end if;
  if v_kind <> 'common_elec' then
    v_print := coalesce(v_print_raw, 'Y') <> 'N';
    if v_calc = '수동' then v_calc_method := 'manual'; end if;
  end if;

  -- 화면 카드의 보충 필드(정규화 컬럼이 없는 값)
  if v_deposit is not null then v_card := v_card || jsonb_build_object('입금', v_deposit); end if;
  if v_transfer is not null then v_card := v_card || jsonb_build_object('이체', v_transfer); end if;
  if v_period is not null then v_card := v_card || jsonb_build_object('고지기간', v_period); end if;
  if v_method is not null and v_kind <> 'common_elec' then
    v_card := v_card || jsonb_build_object(case when v_kind = 'water' then '계산법' else '계산2' end, v_method);
  end if;

  select count(*) filter (where kind = v_kind and deleted_at is null),
         coalesce(max(sort_order) filter (where deleted_at is null), -1) + 1
    into v_idx, v_sort
    from building_customer_numbers where building_id = v_building;

  insert into building_customer_numbers(
    building_id, kind, customer_no, meter_day, billing_basis, print_on_bill,
    holder_name, line_name, calculation_method, note, sort_order)
  values (
    v_building, v_kind, v_no, v_day, v_basis, v_print,
    nullif(trim(p_rec->>'성명/계약명'), ''),
    nullif(trim(p_rec->>'조회'), ''),
    v_calc_method,
    nullif(trim(p_rec->>'메모'), ''),
    v_sort);

  -- 카드 순서(= 같은 kind의 정규화 행 순서) n번째에 보충 필드를 둔다.
  if v_card <> '{}'::jsonb then
    v_extra := coalesce(v_extra, '{}'::jsonb);
    v_cards := v_extra #> array['utilities', v_kind, 'cards'];
    if v_cards is null or jsonb_typeof(v_cards) <> 'array' then
      v_cards := '[]'::jsonb;
    end if;
    while jsonb_array_length(v_cards) < v_idx loop
      v_cards := v_cards || jsonb_build_array('{}'::jsonb);
    end loop;
    if jsonb_array_length(v_cards) = v_idx then
      v_cards := v_cards || jsonb_build_array(v_card);
    else
      v_cards := jsonb_set(v_cards, array[v_idx::text], v_card);
    end if;

    update buildings
       set extra_info = jsonb_set(
             v_extra, '{utilities}',
             coalesce(v_extra->'utilities', '{}'::jsonb)
               || jsonb_build_object(v_kind, jsonb_build_object(
                    'cards', v_cards,
                    'extra', coalesce(v_extra #> array['utilities', v_kind, 'extra'], '{}'::jsonb))))
     where id = v_building;
  end if;
end
$$;

revoke execute on function public.migrate_building_util(bigint, jsonb) from public, anon, authenticated;
