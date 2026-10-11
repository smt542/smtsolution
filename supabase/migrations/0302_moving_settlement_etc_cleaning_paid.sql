-- 이사정산 입력(개선3차 1-23·1-24·1-25): 기타 항목 목록·청소 6필드·수납액/최종 수납일/가수금 저장.
--
-- 저장 위치는 partner(mobile-ms-new/_ms.ts)가 이미 쓰는 moving_settlements.extra 키를 그대로 쓴다.
--   extra.etcItems     = [{name, amount}] (최대 15)          — ③ 기타
--   extra.cleaning     = {by, status(완료/미결), doneDate, acct, note} — 청소(금액은 cleaning_cost 컬럼)
--   extra.paid         = 수납액, extra.lastPaidDate = 최종 수납일, extra.adv = 가수금
-- 금액 계산·조회(전체 이사조회·내역서·공유 링크 public_settlement_by_token)가 쓰는 값은 기존 컬럼에 둔다:
--   repair_amount = 기타 소계(etcItems 합계, 서버에서 정규화) · repair_memo = 항목명 목록 · cleaning_cost = 청소금액.
-- 그래서 settlement_amount 트리거·list_settlement_inquiries·public_settlement_by_token(extra.paid 사용)은 바꾸지 않는다.

-- ③ 기타 소계: extra.etcItems 가 배열이면 그 합계, 아니면 null(= 기존 단일 repair_amount 를 쓴다).
create or replace function public.settlement_etc_total(p_extra jsonb)
returns integer
language sql
immutable
set search_path to 'public'
as $$
  select case
    when jsonb_typeof(p_extra -> 'etcItems') = 'array' then (
      select coalesce(sum(round(
               case when jsonb_typeof(e -> 'amount') in ('number', 'string')
                     and (e ->> 'amount') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
                    then (e ->> 'amount')::numeric else 0 end)), 0)::integer
        from jsonb_array_elements(p_extra -> 'etcItems') e
    )
  end
$$;

-- 기타 항목명 목록(repair_memo). 빈 이름은 뺀다.
create or replace function public.settlement_etc_memo(p_extra jsonb)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
    when jsonb_typeof(p_extra -> 'etcItems') = 'array' then (
      select nullif(string_agg(btrim(e ->> 'name'), ', ' order by ord), '')
        from jsonb_array_elements(p_extra -> 'etcItems') with ordinality as t(e, ord)
       where btrim(coalesce(e ->> 'name', '')) <> ''
    )
  end
$$;

-- ④ 청소비·기타: 기타는 etcItems 합계 우선, 없으면 기존 repair_amount(트리거는 컬럼만 넘기므로 repair_amount).
create or replace function public.calculate_moving_settlement_amount(p_data jsonb)
returns integer
language sql
immutable
set search_path to 'public'
as $function$
  select
    coalesce(nullif(p_data->>'mgmt_fee_prorated','')::integer, 0) +
    coalesce(nullif(p_data->>'water_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'elec_charge','')::integer, 0) +
    coalesce(nullif(p_data->>'gas_charge','')::integer, 0) +
    coalesce(settlement_etc_total(p_data->'extra'), nullif(p_data->>'repair_amount','')::integer, 0) +
    coalesce(nullif(p_data->>'cleaning_cost','')::integer, 0)
$function$;

-- staff save_moving_settlement: p_data.extra(etcItems·cleaning·paid·lastPaidDate·adv)를 기존 extra 에 병합하고,
-- 기타 목록이 오면 repair_amount/repair_memo 를 그 합계·항목명으로 맞춘다. 0296(중도퇴실 저장 허용)은 그대로 둔다.
do $migration$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb)'::regprocedure);
  v_new := v_def;

  v_new := replace(v_new,
    $$  v_util jsonb;
$$,
    $$  v_util jsonb;
  v_extra jsonb;
  v_etc integer;
$$);

  v_new := replace(v_new,
    $$  v_unpaid := settlement_billing_unpaid(p_unit_id, p_occupancy_id)::integer;
  v_amount := calculate_moving_settlement_amount(p_data) + v_unpaid;
  -- 이사 지침(extra.util) — partner 와 같은 키. 오지 않으면 기존 extra 를 그대로 둔다.
  v_util := case when jsonb_typeof(p_data->'util') = 'array' then p_data->'util' else null end;
$$,
    $$  -- 이사 지침(extra.util) — partner 와 같은 키. 오지 않으면 기존 extra 를 그대로 둔다.
  v_util := case when jsonb_typeof(p_data->'util') = 'array' then p_data->'util' else null end;
  -- 0302: 기타 목록·청소·수납액·최종 수납일·가수금(partner 와 같은 extra 키). 온 키만 기존 extra 에 병합한다.
  v_extra := case when jsonb_typeof(p_data->'extra') = 'object' then p_data->'extra' else '{}'::jsonb end
    || case when v_util is null then '{}'::jsonb else jsonb_build_object('util', v_util) end;
  if jsonb_typeof(v_extra->'etcItems') = 'array' and jsonb_array_length(v_extra->'etcItems') > 15 then
    raise exception '기타 항목은 최대 15개까지 저장할 수 있어요.';
  end if;
  if exists (
       select 1
         from jsonb_array_elements(case when jsonb_typeof(v_extra->'etcItems') = 'array' then v_extra->'etcItems' else '[]'::jsonb end) e
        where nullif(btrim(e->>'amount'), '')::numeric < 0
     )
     or nullif(btrim(v_extra->>'paid'), '')::numeric < 0
     or nullif(btrim(v_extra->>'adv'), '')::numeric < 0
     or nullif(p_data->>'cleaning_cost', '')::numeric < 0
  then
    raise exception '입력값을 다시 확인해 주세요. 금액은 0 이상만 저장할 수 있어요.';
  end if;
  -- ③ 기타 소계 = etcItems 합계. repair_amount·repair_memo 컬럼(전체 이사조회·트리거가 읽는 값)을 같은 값으로 맞춘다.
  v_etc := settlement_etc_total(v_extra);
  if v_etc is not null then
    p_data := p_data || jsonb_build_object(
      'repair_amount', nullif(v_etc, 0),
      'repair_memo', settlement_etc_memo(v_extra)
    );
  end if;

  v_unpaid := settlement_billing_unpaid(p_unit_id, p_occupancy_id)::integer;
  v_amount := calculate_moving_settlement_amount(p_data) + v_unpaid;
$$);

  v_new := replace(v_new,
    $$      case when v_util is null then null else jsonb_build_object('util', v_util) end,
      'saved'$$,
    $$      nullif(v_extra, '{}'::jsonb),
      'saved'$$);

  v_new := replace(v_new,
    $$      extra = case
        when v_util is null then extra
        else coalesce(extra, '{}'::jsonb) || jsonb_build_object('util', v_util)
      end,$$,
    $$      extra = case
        when v_extra = '{}'::jsonb then extra
        else coalesce(extra, '{}'::jsonb) || v_extra
      end,$$);

  if v_new = v_def
     or position('v_etc := settlement_etc_total(v_extra);' in v_new) = 0
     or position('nullif(v_extra, ''{}''::jsonb),' in v_new) = 0
     or position('coalesce(extra, ''{}''::jsonb) || v_extra' in v_new) = 0
     or position('v_extra jsonb;' in v_new) = 0
  then
    raise exception 'save_moving_settlement patch failed';
  end if;
  execute v_new;
end
$migration$;

-- partner_save_moving_settlement: 같은 규칙으로 repair_amount/repair_memo 를 etcItems 에서 맞춘다(클라이언트도 같은 값을 보내므로
-- 현재 동작은 같고, 두 저장 경로의 기타 소계 원천을 서버에서 하나로 고정한다). extra 는 partner 가 아는 키 전체를 보낸다.
do $migration$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.partner_save_moving_settlement(bigint,bigint,bigint,jsonb,jsonb)'::regprocedure);

  v_new := replace(v_def,
    $$  v_extra := case when jsonb_typeof(p_data->'extra') = 'object' then p_data->'extra' else null end;
$$,
    $$  v_extra := case when jsonb_typeof(p_data->'extra') = 'object' then p_data->'extra' else null end;
  -- 0302: ③ 기타 소계 = etcItems 합계(staff save_moving_settlement 와 같은 규칙).
  if settlement_etc_total(v_extra) is not null then
    p_data := p_data || jsonb_build_object(
      'repair_amount', nullif(settlement_etc_total(v_extra), 0),
      'repair_memo', settlement_etc_memo(v_extra)
    );
  end if;
$$);

  if v_new = v_def then raise exception 'partner_save_moving_settlement patch failed'; end if;
  execute v_new;
end
$migration$;
