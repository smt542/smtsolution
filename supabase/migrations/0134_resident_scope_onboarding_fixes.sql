-- 0134_resident_scope_onboarding_fixes.sql
-- 세입자앱 도메인 3건 수정(모두 drift-safe 재정의 · 검증/스코프/grant 보존).
-- ※ 라이브 미적용. Claude/사용자가 Management API로 적용한다.
--
--   H8  resident_linked_unit          ← 0040 위에 재정의. 점유(occupancy) 유효성 게이트 추가:
--                                        deleted_at is null + status in ('occupied','moving_out').
--                                        퇴실완료(vacant)/소프트삭제 세대는 더 이상 옛 세대 청구/공지/토큰을 열지 못한다.
--                                        (이 함수 1개가 모든 세입자 청구/공지/토큰 RPC의 스코프를 공급)
--   H9  resident_confirm              ← 0127(최신) 위에 재정의. linked upsert 전에 같은 resident의
--                                        pending 행을 삭제(유령 pending 제거). linked ON CONFLICT는 보존.
--       approve_res_claim             ← 0039 위에 재정의. 멱등화: resident 또는 occupancy(0132 인덱스)가
--                                        이미 linked면 hard-error 대신 중복 pending을 rejected 처리 후 정상 반환.
--   H10 resident_bill_detail          ← 0040 위에 재정의. billing_history 스냅샷이 없어 fee_item_charges로
--       public_bill_by_token             폴백할 때 항목 금액을 bc.total_amount에 비례하도록 스케일(합계 정합).
--                                        history.items 경로는 불변. 0나눗셈은 nullif로 가드.

-- =====================================================================
-- H8) resident_linked_unit — 점유 유효성 게이트 (base 0040)
--   변경점: occupancies 조인에 `o.deleted_at is null and o.status in ('occupied','moving_out')` 추가.
--   나머지(반환 컬럼·최신 linked 선택·security definer·search_path)는 0040과 동일.
-- =====================================================================
create or replace function resident_linked_unit()
returns table (
  org_id bigint,
  building_id bigint,
  unit_id bigint,
  occupancy_id bigint,
  move_in date,
  move_out date,
  tenant_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.org_id,
    b.id,
    u.id,
    o.id,
    o.move_in_date,
    o.move_out_date,
    o.tenant_name
  from res_claims rc
  join occupancies o on o.id = rc.occupancy_id
    and o.deleted_at is null
    and o.status in ('occupied', 'moving_out')
  join units u on u.id = o.unit_id
  join buildings b on b.id = u.building_id
  where rc.resident_user_id = auth.uid()
    and rc.status = 'linked'
  order by rc.created_at desc, rc.id desc
  limit 1;
$$;

-- =====================================================================
-- H9a) resident_confirm — pending 유령행 제거 (base 0127 최신본)
--   변경점: linked insert 직전에 같은 resident_user_id의 pending 행을 DELETE.
--           (0039 부분 유니크 res_claims_one_pending_per_resident_idx 로 최대 1건이지만 방어적으로 전부 삭제)
--   보존: auth 게이트, resident_identities 조회, occupancy 전화일치·status='occupied' 검증,
--         normalize_phone 사용, linked ON CONFLICT (resident_user_id) where status='linked' upsert.
--   순서: 같은 트랜잭션에서 pending 삭제 → linked upsert. 0132 occupancy 유니크는 linked만 대상이므로
--         pending 삭제가 인덱스를 건드리지 않는다. resident당 linked 1건 유니크도 upsert가 유지.
-- =====================================================================
create or replace function resident_confirm(p_occupancy_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity resident_identities%rowtype;
  v_org_id bigint;
  v_building_id bigint;
  v_unit_id bigint;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_identity
  from resident_identities
  where user_id = auth.uid();
  if not found then
    raise exception 'resident identity not found';
  end if;

  select b.org_id, b.id, u.id
    into v_org_id, v_building_id, v_unit_id
  from occupancies o
  join units u on u.id = o.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.deleted_at is null
  where o.id = p_occupancy_id
    and normalize_phone(o.phone) = normalize_phone(v_identity.phone)
    and normalize_phone(o.phone) is not null
    and o.status = 'occupied'
    and o.deleted_at is null;
  if not found then
    raise exception 'occupancy does not match resident phone';
  end if;

  -- 자동확정으로 linked가 생기면 기존 pending(스태프 승인 대기)은 무의미해지므로 제거한다.
  -- (제거하지 않으면 pending+linked 공존 → 유령 pending)
  delete from res_claims
  where resident_user_id = auth.uid()
    and status = 'pending';

  insert into res_claims (
    org_id, resident_user_id, kakao_id, kakao_name,
    claimed_name, claimed_phone, building_id, unit_id, occupancy_id,
    status, kind, resolved_at
  ) values (
    v_org_id, auth.uid(), v_identity.kakao_id, v_identity.kakao_name,
    v_identity.kakao_name, v_identity.phone, v_building_id, v_unit_id, p_occupancy_id,
    'linked', 'auto', now()
  )
  on conflict (resident_user_id) where status = 'linked'
  do update set
    org_id = excluded.org_id,
    kakao_id = excluded.kakao_id,
    kakao_name = excluded.kakao_name,
    claimed_name = excluded.claimed_name,
    claimed_phone = excluded.claimed_phone,
    building_id = excluded.building_id,
    unit_id = excluded.unit_id,
    occupancy_id = excluded.occupancy_id,
    kind = 'auto',
    memo = null,
    resolved_at = now(),
    resolved_by = null;
end
$$;

-- =====================================================================
-- H9b) approve_res_claim — 멱등화 (base 0039)
--   변경점: pending→linked 승격 전에 (a) 이 resident가 이미 linked인지, (b) 대상 occupancy가 이미
--           다른 resident에게 linked인지(0132 res_claims_one_linked_per_occupancy 인덱스)를 검사한다.
--           둘 중 하나라도 이미 linked면 hard-error 대신 이 pending claim을 'rejected'로 정리하고 정상 반환.
--   보존: current_user_org / current_user_has_module('tenants') 게이트, org 스코프, claim FOR UPDATE,
--         status='pending' 요구, occupancy org·status='occupied' 검증, audit_log 기록.
--   근거: 0132 인덱스는 status='linked'인 (occupancy_id)만 유니크 → 승격 시점에 이미 존재하면 UPDATE가
--         유니크 위반으로 실패했다. 승격 자체를 no-op(redundant reject)로 만들어 오류를 제거한다.
-- =====================================================================
create or replace function approve_res_claim(p_claim_id bigint, p_occupancy_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id bigint;
  v_claim res_claims%rowtype;
  v_building_id bigint;
  v_unit_id bigint;
  v_already_linked boolean;
begin
  v_org_id := current_user_org();
  if v_org_id is null then
    raise exception 'no org for caller' using errcode = '42501';
  end if;
  if not current_user_has_module('tenants') then
    raise exception 'forbidden: tenants required' using errcode = '42501';
  end if;

  select * into v_claim
  from res_claims
  where id = p_claim_id and org_id = v_org_id
  for update;
  if not found then
    raise exception 'claim not found';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'claim is not pending';
  end if;

  select b.id, u.id
    into v_building_id, v_unit_id
  from occupancies o
  join units u on u.id = o.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.deleted_at is null
  where o.id = p_occupancy_id
    and b.org_id = v_org_id
    and o.status = 'occupied'
    and o.deleted_at is null;
  if not found then
    raise exception 'occupancy not found in caller org';
  end if;

  -- 멱등 가드: 이 resident가 이미 linked이거나(0039 resident 유니크),
  -- 대상 occupancy가 이미 linked면(0132 occupancy 유니크) 승격은 중복이므로 이 pending을 rejected 처리하고 종료.
  select exists (
    select 1 from res_claims other
    where other.status = 'linked'
      and other.id <> p_claim_id
      and (
        other.resident_user_id = v_claim.resident_user_id
        or other.occupancy_id = p_occupancy_id
      )
  ) into v_already_linked;

  if v_already_linked then
    update res_claims
    set status = 'rejected',
        resolved_at = now(),
        resolved_by = auth.uid()
    where id = p_claim_id;

    insert into audit_log (org_id, actor_id, action, table_name, row_pk, before, after)
    values (
      v_org_id,
      auth.uid(),
      'CLAIM_LINK_REDUNDANT',
      'res_claims',
      p_claim_id::text,
      jsonb_build_object(
        'status', v_claim.status,
        'building_id', v_claim.building_id,
        'unit_id', v_claim.unit_id,
        'occupancy_id', v_claim.occupancy_id
      ),
      jsonb_build_object(
        'status', 'rejected',
        'reason', 'already_linked',
        'occupancy_id', p_occupancy_id
      )
    );
    return;
  end if;

  update res_claims
  set building_id = v_building_id,
      unit_id = v_unit_id,
      occupancy_id = p_occupancy_id,
      status = 'linked',
      resolved_at = now(),
      resolved_by = auth.uid()
  where id = p_claim_id;

  insert into audit_log (org_id, actor_id, action, table_name, row_pk, before, after)
  values (
    v_org_id,
    auth.uid(),
    'CLAIM_LINK',
    'res_claims',
    p_claim_id::text,
    jsonb_build_object(
      'status', v_claim.status,
      'building_id', v_claim.building_id,
      'unit_id', v_claim.unit_id,
      'occupancy_id', v_claim.occupancy_id
    ),
    jsonb_build_object(
      'status', 'linked',
      'building_id', v_building_id,
      'unit_id', v_unit_id,
      'occupancy_id', p_occupancy_id
    )
  );
end
$$;

-- =====================================================================
-- H10a) resident_bill_detail — 항목 미분(proration) 정합 (base 0040)
--   변경점: billing_history 스냅샷이 없어 fee_item_charges로 폴백할 때, 원시 amount 합이
--           bc.total_amount(일할/조정 반영된 확정액)와 어긋난다. 항목별로
--           amount * bc.total_amount / nullif(sum(amount over charged), 0) 로 스케일해 합계를 맞춘다.
--   보존: history.items 경로(이미 정합) 불변, 반환 컬럼·조인·점유 기간 필터·grant 동일.
--   0가드: charged 항목 합이 0이면 스케일 불가 → coalesce(history, scaled_charges, '[]') 에서
--          scaled_charges가 빈 배열/0금액이 되도록 nullif로 division 자체를 방지.
-- =====================================================================
create or replace function resident_bill_detail(p_period date)
returns table (
  period date,
  building_name text,
  unit_no text,
  tenant_name text,
  total_amount int,
  paid_amount int,
  unpaid_amount int,
  due_date date,
  confirmed_at timestamptz,
  items jsonb,
  mgmt_bank text,
  mgmt_acct text,
  mgmt_holder text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with linked as (
    select * from resident_linked_unit()
  )
  select
    bc.period,
    b.name,
    u.unit_no,
    l.tenant_name,
    bc.total_amount,
    coalesce(pay.paid_amount, 0)::int,
    greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int,
    issue.due_date,
    bc.confirmed_at,
    coalesce(history.items, charges.items, '[]'::jsonb),
    sc.mgmt_bank1,
    sc.mgmt_acct1,
    sc.mgmt_holder1
  from linked l
  join units u on u.id = l.unit_id
  join buildings b on b.id = l.building_id and b.org_id = l.org_id
  join billing_confirmations bc
    on bc.unit_id = l.unit_id
   and bc.period = p_period
   and bc.confirmed_at is not null
  left join setup_config sc on sc.org_id = l.org_id
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from payments p
    where p.unit_id = l.unit_id
      and p.period = bc.period
      and p.status = 'active'
  ) pay on true
  left join lateral (
    select bi.due_date
    from bill_issues bi
    where bi.unit_id = l.unit_id
      and bi.period = bc.period
    order by bi.issued_at desc, bi.id desc
    limit 1
  ) issue on true
  left join lateral (
    select bh.items
    from billing_history bh
    where bh.unit_id = l.unit_id
      and bh.period = bc.period
    order by bh.confirmed_at desc, bh.id desc
    limit 1
  ) history on true
  left join lateral (
    -- fee_item_charges 폴백: 항목 amount를 bc.total_amount에 비례 스케일해 합계를 확정액에 맞춘다.
    -- raw_total = 이 세대/기간 charged 항목 amount 합(sum() over ()). 0이면 스케일 불가 → nullif로 null.
    -- 결과가 null이면 상위 coalesce(history, charges, '[]')가 '[]'로 대체.
    select jsonb_agg(
      jsonb_build_object(
        'fee_item_id', scaled.fee_item_id,
        'name', scaled.name,
        'amount', round(scaled.amount::numeric * bc.total_amount::numeric
                        / nullif(scaled.raw_total, 0)),
        'charged', scaled.charged
      ) order by scaled.sort_order, scaled.fee_item_id
    ) as items
    from (
      select
        fic.fee_item_id,
        fi.name,
        fic.amount,
        fic.charged,
        fi.sort_order,
        sum(fic.amount) over ()::numeric as raw_total
      from fee_item_charges fic
      join fee_items fi on fi.id = fic.fee_item_id
      where fic.unit_id = l.unit_id
        and fic.period = bc.period
        and fic.charged = true
    ) scaled
    where scaled.raw_total is not null
      and scaled.raw_total <> 0
  ) charges on true
  where l.move_in is not null
    and p_period >= date_trunc('month', l.move_in)::date
    and (
      l.move_out is null
      or p_period <= date_trunc('month', l.move_out)::date
    );
$$;

-- =====================================================================
-- H10b) public_bill_by_token — 항목 미분(proration) 정합 (base 0040)
--   resident_bill_detail와 동일한 스케일을 무로그인 토큰 경로의 charges 폴백에도 적용.
--   보존: expires_at 게이트로 만료 시 전 컬럼 null, history.items(name/amount) 경로 불변,
--         반환 컬럼·anon/authenticated grant 동일.
-- =====================================================================
create or replace function public_bill_by_token(p_token uuid)
returns table (
  period date,
  building_name text,
  unit_no text,
  total_amount int,
  paid_amount int,
  unpaid_amount int,
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
  select
    bst.period,
    b.name,
    u.unit_no,
    case when bst.expires_at > now() then bc.total_amount else null end,
    case when bst.expires_at > now() then coalesce(pay.paid_amount, 0)::int else null end,
    case
      when bst.expires_at > now()
      then greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int
      else null
    end,
    case when bst.expires_at > now() then issue.due_date else null end,
    case
      when bst.expires_at > now()
      then coalesce(history.items, charges.items, '[]'::jsonb)
      else null
    end,
    case when bst.expires_at > now() then sc.mgmt_bank1 else null end,
    case when bst.expires_at > now() then sc.mgmt_acct1 else null end,
    case when bst.expires_at > now() then sc.mgmt_holder1 else null end,
    bst.expires_at,
    bst.expires_at <= now()
  from bill_share_tokens bst
  join units u on u.id = bst.unit_id
  join buildings b on b.id = u.building_id and b.org_id = bst.org_id
  left join billing_confirmations bc
    on bc.unit_id = bst.unit_id
   and bc.period = bst.period
   and bc.confirmed_at is not null
  left join setup_config sc on sc.org_id = bst.org_id
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from payments p
    where p.unit_id = bst.unit_id
      and p.period = bst.period
      and p.status = 'active'
  ) pay on true
  left join lateral (
    select bi.due_date
    from bill_issues bi
    where bi.unit_id = bst.unit_id
      and bi.period = bst.period
    order by bi.issued_at desc, bi.id desc
    limit 1
  ) issue on true
  left join lateral (
    select coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', entry.item->>'name',
          'amount', entry.item->'amount'
        ) order by entry.ordinality
      )
      from jsonb_array_elements(bh.items) with ordinality as entry(item, ordinality)
    ), '[]'::jsonb) as items
    from billing_history bh
    where bh.unit_id = bst.unit_id
      and bh.period = bst.period
    order by bh.confirmed_at desc, bh.id desc
    limit 1
  ) history on true
  left join lateral (
    -- charges 폴백(무로그인): name/amount만 노출. amount를 bc.total_amount에 비례 스케일.
    -- bc가 없으면(미확정) total_amount is null → where 절이 전 행 제거 → 결과 null → 상위 coalesce로 '[]'.
    -- raw_total(sum() over ())=0이면 스케일 불가 → 동일하게 제거.
    select jsonb_agg(
      jsonb_build_object(
        'name', scaled.name,
        'amount', round(scaled.amount::numeric * bc.total_amount::numeric
                        / nullif(scaled.raw_total, 0))
      ) order by scaled.sort_order, scaled.fee_item_id
    ) as items
    from (
      select
        fic.fee_item_id,
        fi.name,
        fic.amount,
        fi.sort_order,
        sum(fic.amount) over ()::numeric as raw_total
      from fee_item_charges fic
      join fee_items fi on fi.id = fic.fee_item_id
      where fic.unit_id = bst.unit_id
        and fic.period = bst.period
        and fic.charged = true
    ) scaled
    where bc.total_amount is not null
      and scaled.raw_total is not null
      and scaled.raw_total <> 0
  ) charges on true
  where bst.token = p_token;
$$;

-- ===== Privileges (재정의 후 재부여 — 0040/0039/0127과 동일) =====
revoke execute on function resident_linked_unit() from anon, public;
grant execute on function resident_linked_unit() to authenticated;
revoke execute on function resident_confirm(bigint) from anon, public;
grant execute on function resident_confirm(bigint) to authenticated;
revoke execute on function approve_res_claim(bigint, bigint) from anon, public;
grant execute on function approve_res_claim(bigint, bigint) to authenticated;
revoke execute on function resident_bill_detail(date) from anon, public;
grant execute on function resident_bill_detail(date) to authenticated;
revoke execute on function public_bill_by_token(uuid) from public;
grant execute on function public_bill_by_token(uuid) to anon, authenticated;
