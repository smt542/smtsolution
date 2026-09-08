-- 0146_resident_bill_signed_url.sql
-- 무로그인 관리비 상세 접근을 '건물·호수·월 + HMAC 서명' URL로 제공하고,
-- 기존 bill_share_tokens 기반 토큰 경로를 이 서명 URL로 **대체**한다.
--
-- 설계(사용자 확정 2026-09-08):
--   * 만료 = 고지월(부과월) + 12개월. 만료 시 금액·항목·계좌 마스킹(토큰과 동일 UX).
--   * 건물 식별 = building_id(전역 PK). 서명이 위조를 막으므로 id 노출 무해.
--   * 링크 발급은 자동(무상태) — staff/세입자 서명 RPC가 즉시 계산, 저장 단계 없음.
--   * 세입자 PII(이름·전화) 미노출 유지. 서명 없이는 위조·열거 불가.
--   * building_id는 정확히 한 org를 가리키므로 다른 org 데이터 교차 접근 불가.
--
-- 보안 참고: 현행 라이브 public_bill_by_token(0144)은 이미 0139의 점유 fail-close/
--   revoked_at 게이트를 잃고 `expires_at > now()`만으로 마스킹한다. 본 서명 URL은
--   (확정고지 + 고지월+12개월 만료 + PII 제외)로 그 유효 포스처와 동등하며, 토큰 경로를
--   통째로 제거하므로 미사용이 된 점유/폐기 기계(resolve_bill_token_occupancy,
--   bill_share_tokens.revoked_at/occupancy_id)는 고아로 남긴다(비파괴·되돌리기 용이).
--
-- 의존: 0002(current_user_org·current_user_has_module), 0040(resident_linked_unit·
--   bill_share_tokens·토큰 RPC), 0007(meter_readings), 0031(late_fee_rate_tiers),
--   0144(public_bill_by_token 항목/연체료 정본 SELECT).

create extension if not exists pgcrypto;

-- =====================================================================
-- 1) 서명 secret 잠금 테이블 (anon/authenticated deny-all)
-- =====================================================================
create table if not exists app_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

alter table app_secrets enable row level security;
-- 정책을 두지 않음 = anon/authenticated에게 전면 거부. security definer 함수만
-- (함수 소유자 권한으로) RLS를 우회해 읽는다. 클라이언트·Node에 절대 노출되지 않는다.
revoke all on table app_secrets from anon, authenticated, public;

-- secret 초기값: apply 시점 서버에서 생성(repo·anon·Node 어디에도 평문 없음). 멱등.
-- ⚠️ 이 INSERT는 auto-mode classifier가 막을 수 있음 → 사용자 `!` 직접 실행/승인 필요.
insert into app_secrets (key, value)
values ('bill_sign_hmac', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- =====================================================================
-- 2) 서명 헬퍼 — 서명(생성부)·검증(공개부) 단일 진실원.
--    HMAC-SHA256(secret, "building_id:unit_no:YYYY-MM") → base64url(패딩 제거).
--    definer 전용: 클라이언트가 직접 서명을 만들지 못하도록 실행 권한을 회수한다
--    (공개부/서명부 함수는 소유자 권한으로 실행되므로 이 헬퍼를 호출할 수 있다).
-- =====================================================================
create or replace function bill_signature(
  p_building_id bigint,
  p_unit_no text,
  p_period date
)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select translate(
    encode(
      extensions.hmac(
        p_building_id::text || ':' || p_unit_no || ':' || to_char(p_period, 'YYYY-MM'),
        (select value from app_secrets where key = 'bill_sign_hmac'),
        'sha256'
      ),
      'base64'
    ),
    '+/=', '-_'
  );
$$;

revoke all on function bill_signature(bigint, text, date) from anon, authenticated, public;

-- =====================================================================
-- 3) public_bill_by_signed (anon 공개 읽기)
--    서명 검증 후, 0144 public_bill_by_token의 SELECT를 building_id+unit_no+period
--    lookup으로 재사용한다. 반환 시그니처는 public_bill_by_token과 정렬(프런트
--    PublicBillDetail·rowToPublicBillDetail 재사용). 만료 시 금액/항목/계좌 null 마스킹.
--    잘못된 서명 → 0행. 미확정/기간밖 월 → 0행(inner join billing_confirmations).
-- =====================================================================
create or replace function public_bill_by_signed(
  p_building_id bigint,
  p_unit_no text,
  p_period date,
  p_sig text
)
returns table (
  period date,
  building_name text,
  unit_no text,
  total_amount int,
  paid_amount int,
  unpaid_amount int,
  late_fee int,
  due_date date,
  items jsonb,
  mgmt_bank text,
  mgmt_acct text,
  mgmt_holder text,
  expires_at timestamptz,
  is_expired boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with sig as (
    select
      (p_sig is not null and p_sig = bill_signature(p_building_id, p_unit_no, p_period)) as ok,
      (date_trunc('month', p_period) + interval '12 months')::timestamptz as expires_at
  )
  select
    bc.period,
    b.name,
    u.unit_no,
    case when now() < sig.expires_at then bc.total_amount else null end,
    case when now() < sig.expires_at then coalesce(pay.paid_amount, 0)::int else null end,
    case
      when now() < sig.expires_at
      then greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int
      else null
    end,
    case
      when now() < sig.expires_at
      then round(
        greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate / 100.0
      )::int
      else null
    end,
    case when now() < sig.expires_at then issue.due_date else null end,
    case
      when now() < sig.expires_at
      then coalesce(charges.items, '[]'::jsonb)
      else null
    end,
    case when now() < sig.expires_at then sc.mgmt_bank1 else null end,
    case when now() < sig.expires_at then sc.mgmt_acct1 else null end,
    case when now() < sig.expires_at then sc.mgmt_holder1 else null end,
    sig.expires_at,
    now() >= sig.expires_at
  from sig
  join buildings b on b.id = p_building_id
  join units u
    on u.building_id = b.id
   and u.unit_no = p_unit_no
   and u.deleted_at is null
  join billing_confirmations bc
    on bc.unit_id = u.id
   and bc.period = p_period
   and bc.confirmed_at is not null
  left join setup_config sc on sc.org_id = b.org_id
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from payments p
    where p.unit_id = u.id
      and p.period = bc.period
      and p.status = 'active'
  ) pay on true
  left join lateral (
    select bi.due_date
    from bill_issues bi
    where bi.unit_id = u.id
      and bi.period = bc.period
    order by bi.issued_at desc, bi.id desc
    limit 1
  ) issue on true
  left join lateral (
    -- 누적요율(%) = Σ_{k=1..months_overdue} rateForMonth(k); tier_order 순 첫 매칭 (0144와 동일)
    select coalesce(sum(
      (
        select t.monthly_rate
        from late_fee_rate_tiers t
        where t.org_id = b.org_id
          and k.k > t.from_month
          and (t.to_month is null or k.k <= t.to_month)
        order by t.tier_order
        limit 1
      )
    ), 0)::numeric as cumulative_rate
    from generate_series(1,
      case
        when greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) > 0
             and issue.due_date is not null
        then greatest(
          (extract(year from timezone('Asia/Seoul', now()))::int - extract(year from issue.due_date)::int) * 12
          + (extract(month from timezone('Asia/Seoul', now()))::int - extract(month from issue.due_date)::int),
          0
        )
        else 0
      end
    ) as k(k)
  ) lf on true
  left join lateral (
    -- 항목: fee_item_charges(charged=true) + 개별 사용료 검침(당월/전월). 0144와 동일 shape.
    select jsonb_agg(
      jsonb_build_object(
        'name', fi.name,
        'amount', fic.amount,
        'utility', util.u,
        'usage', mr.usage,
        'prev_usage', prev.usage
      ) order by fi.sort_order, fi.id
    ) as items
    from fee_item_charges fic
    join fee_items fi on fi.id = fic.fee_item_id
    cross join lateral (
      select case
        when fi.name like '%수도%' then 'water'
        when fi.name like '%전기%' then 'elec'
        when fi.name like '%가스%' then 'gas'
        else null
      end as u
    ) util
    left join meter_readings mr
      on mr.unit_id = fic.unit_id
     and mr.period = fic.period
     and mr.utility = util.u
    left join meter_readings prev
      on prev.unit_id = fic.unit_id
     and prev.period = (fic.period - interval '1 month')::date
     and prev.utility = util.u
    where fic.unit_id = u.id
      and fic.period = bc.period
      and fic.charged = true
  ) charges on true
  where sig.ok;
$$;

revoke execute on function public_bill_by_signed(bigint, text, date, text) from public;
grant execute on function public_bill_by_signed(bigint, text, date, text) to anon, authenticated;

-- =====================================================================
-- 4) resident_sign_bill_url (세입자 — 본인 세대 무로그인 링크 자동 발급)
--    resident_get_or_create_bill_token와 동일 게이트(점유 기간·확정 고지)를 유지하되,
--    토큰을 저장하지 않고 서명만 계산해 반환한다. URL 조립·인코딩은 클라이언트가 수행.
-- =====================================================================
create or replace function resident_sign_bill_url(p_period date)
returns table (
  building_id bigint,
  unit_no text,
  sig text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_link record;
  v_unit_no text;
begin
  select * into v_link from resident_linked_unit();
  if not found then
    raise exception 'linked occupancy not found';
  end if;

  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month' using errcode = '22023';
  end if;
  if v_link.move_in is null
     or p_period < date_trunc('month', v_link.move_in)::date
     or (
       v_link.move_out is not null
       and p_period > date_trunc('month', v_link.move_out)::date
     ) then
    raise exception 'period is outside occupancy tenure' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from billing_confirmations bc
    where bc.unit_id = v_link.unit_id
      and bc.period = p_period
      and bc.confirmed_at is not null
  ) then
    raise exception 'confirmed bill not found';
  end if;

  select u.unit_no into v_unit_no from units u where u.id = v_link.unit_id;

  return query
  select
    v_link.building_id,
    v_unit_no,
    bill_signature(v_link.building_id, v_unit_no, p_period);
end;
$$;

revoke execute on function resident_sign_bill_url(date) from anon, public;
grant execute on function resident_sign_bill_url(date) to authenticated;

-- =====================================================================
-- 5) staff_sign_bill_urls (staff 대량 — 미납/문자·알림톡 봉투 링크 자동 발급)
--    staff_mint_bill_tokens와 동일 게이트(org + bill_publish + 확정 고지)를 유지하되,
--    토큰을 저장하지 않고 세대별 서명을 계산해 반환한다. building_id·unit_no를 함께
--    반환하므로 클라이언트가 서명 대상과 동일 값으로 URL을 조립·인코딩한다.
-- =====================================================================
create or replace function staff_sign_bill_urls(
  p_unit_ids bigint[],
  p_period date
)
returns table (
  unit_id bigint,
  building_id bigint,
  unit_no text,
  sig text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_org bigint;
begin
  v_org := public.current_user_org();
  if v_org is null then
    raise exception 'no org' using errcode = '42501';
  end if;
  if not public.current_user_has_module('bill_publish') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    u.id as unit_id,
    b.id as building_id,
    u.unit_no,
    public.bill_signature(b.id, u.unit_no, p_period) as sig
  from unnest(p_unit_ids) as requested(unit_id)
  join public.units u
    on u.id = requested.unit_id
   and u.deleted_at is null
  join public.buildings b
    on b.id = u.building_id
   and b.org_id = v_org
  join public.billing_confirmations bc
    on bc.unit_id = u.id
   and bc.period = p_period
   and bc.confirmed_at is not null;
end;
$$;

revoke all on function staff_sign_bill_urls(bigint[], date) from public, anon;
grant execute on function staff_sign_bill_urls(bigint[], date) to authenticated;

-- =====================================================================
-- 6) 토큰 경로 제거(대체) — 공개 API 함수만 드롭. bill_share_tokens 테이블과
--    resolve_bill_token_occupancy 헬퍼는 고아로 보존(비파괴; 필요 시 되돌리기 용이).
-- =====================================================================
drop function if exists public_bill_by_token(uuid);
drop function if exists staff_mint_bill_tokens(bigint[], date);
drop function if exists staff_revoke_bill_token(uuid);
drop function if exists resident_get_or_create_bill_token(date);
