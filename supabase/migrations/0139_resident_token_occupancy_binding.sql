-- 0139_resident_token_occupancy_binding.sql
-- FINDING M13 — bind the public resident bill-share token to a specific occupancy
-- (not just unit+period) and add explicit revoke, so a tenant change (occupancy
-- turnover) or an explicit revoke invalidates the anon link before it can leak the
-- new occupant's billing PII.
--
-- Depends on 0001 (occupancies), 0040 (bill_share_tokens + resident/public RPCs),
-- 0100 (staff_mint_bill_tokens), 0134 (latest public_bill_by_token / resident_linked_unit).
-- ※ NOT applied live. Claude/user applies via Management API.
--
-- Idempotent where feasible: add column if not exists; create or replace functions;
-- backfill is guarded and safe to re-run.
--
-- Security summary (for review):
--   * verify (public_bill_by_token) is FAIL-CLOSED: a token exposes data only when
--       expires_at > now() AND revoked_at IS NULL AND occupancy_id IS NOT NULL AND the
--       bound occupancy is still the current/active occupant of the unit (see token_ok).
--   * A token minted after this change with NO occupancy binding is rejected.
--   * Minting a new active token for an occupancy revokes that occupancy's other active
--       tokens (one active link per occupancy).
--   * Explicit revoke RPC is service-role/staff only (org- and module-scoped).

-- =====================================================================
-- 1) Schema: bind to occupancy + explicit revoke
-- =====================================================================
alter table bill_share_tokens
  add column if not exists occupancy_id bigint references occupancies(id) on delete set null;

alter table bill_share_tokens
  add column if not exists revoked_at timestamptz;

create index if not exists bill_share_tokens_occupancy_active_idx
  on bill_share_tokens (occupancy_id)
  where revoked_at is null;

-- =====================================================================
-- 2) Helper: resolve the occupancy responsible for a unit during a period.
--    Tenure covers period → prefer active (occupied/moving_out), newest tenure.
--    If none covers → most recent occupancy for the unit as of that period.
--    Returns NULL only when the unit has no (non-deleted) occupancy at all.
-- =====================================================================
create or replace function resolve_bill_token_occupancy(p_unit_id bigint, p_period date)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with covering as (
    select o.id
    from occupancies o
    where o.unit_id = p_unit_id
      and o.deleted_at is null
      and o.move_in_date is not null
      and date_trunc('month', o.move_in_date)::date <= p_period
      and (
        o.move_out_date is null
        or p_period <= date_trunc('month', o.move_out_date)::date
      )
    order by
      (o.status in ('occupied', 'moving_out')) desc,
      o.move_in_date desc,
      o.id desc
    limit 1
  ),
  fallback as (
    -- No occupancy whose tenure covers the period: pick the most recent occupancy
    -- for the unit that had moved in on/before that period (as-of), else newest overall.
    select o.id
    from occupancies o
    where o.unit_id = p_unit_id
      and o.deleted_at is null
    order by
      (o.move_in_date is not null
         and date_trunc('month', o.move_in_date)::date <= p_period) desc,
      o.move_in_date desc nulls last,
      o.id desc
    limit 1
  )
  select coalesce(
    (select id from covering),
    (select id from fallback)
  );
$$;

-- Least-privilege: this helper is called ONLY from within the SECURITY DEFINER mint
-- RPCs below, which execute as the function owner — so no caller-facing grant is
-- needed. Not directly callable by clients, avoiding a leak of which occupancy is
-- active for an arbitrary unit_id.
revoke execute on function resolve_bill_token_occupancy(bigint, date) from anon, public, authenticated;

-- =====================================================================
-- 3) Mint (resident self-serve) — base 0040.
--    Binds the token to the resident's linked occupancy (authoritative), clears any
--    stale revoked_at on the (unit,period) row, and supersedes the occupancy's other
--    active tokens so there is one active link per occupancy.
--    Preserved: auth/linked gate, period-first-of-month check, tenure check,
--    confirmed-bill requirement, 1-year expiry, unique (unit_id, period) upsert.
-- =====================================================================
create or replace function resident_get_or_create_bill_token(p_period date)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link record;
  v_token uuid;
  v_occ bigint;
begin
  select * into v_link
  from resident_linked_unit();
  if not found then
    raise exception 'linked occupancy not found';
  end if;
  v_occ := v_link.occupancy_id;

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

  insert into bill_share_tokens (
    org_id, unit_id, period, occupancy_id, created_by, expires_at, revoked_at
  ) values (
    v_link.org_id, v_link.unit_id, p_period, v_occ,
    auth.uid(), now() + interval '1 year', null
  )
  on conflict (unit_id, period) do update
    set expires_at = excluded.expires_at,
        occupancy_id = excluded.occupancy_id,
        revoked_at = null
  returning bill_share_tokens.token into v_token;

  -- Supersede other active tokens for the SAME occupancy (one active link per occupancy).
  if v_occ is not null then
    update bill_share_tokens t
    set revoked_at = now()
    where t.occupancy_id = v_occ
      and t.token <> v_token
      and t.revoked_at is null;
  end if;

  return v_token;
end;
$$;

-- =====================================================================
-- 4) Mint (staff bulk) — base 0100.
--    Resolves + stores occupancy per unit, clears stale revoked_at, and supersedes
--    each occupancy's other active tokens. Preserved: org + bill_publish gate,
--    confirmed-bill filter, unique (unit_id, period) upsert, 1-year expiry.
-- =====================================================================
create or replace function public.staff_mint_bill_tokens(
  p_unit_ids bigint[],
  p_period date
)
returns table (
  unit_id bigint,
  token uuid
)
language plpgsql
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
  with target_units as (
    select distinct u.id as unit_id
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
     and bc.confirmed_at is not null
  ), inserted as (
    insert into public.bill_share_tokens (
      org_id,
      unit_id,
      period,
      occupancy_id,
      created_by,
      expires_at,
      revoked_at
    )
    select
      v_org,
      target_units.unit_id,
      p_period,
      public.resolve_bill_token_occupancy(target_units.unit_id, p_period),
      auth.uid(),
      now() + interval '1 year',
      null
    from target_units
    on conflict (unit_id, period) do update
      set expires_at = excluded.expires_at,
          occupancy_id = excluded.occupancy_id,
          revoked_at = null
    returning
      bill_share_tokens.unit_id,
      bill_share_tokens.token,
      bill_share_tokens.id,
      bill_share_tokens.occupancy_id
  ), superseded as (
    -- Revoke each freshly-minted occupancy's OTHER active tokens (one active link/occupancy).
    update public.bill_share_tokens t
    set revoked_at = now()
    from inserted
    where t.occupancy_id = inserted.occupancy_id
      and inserted.occupancy_id is not null
      and t.id <> inserted.id
      and t.revoked_at is null
    returning t.id
  )
  select inserted.unit_id, inserted.token
  from inserted;
end;
$$;

revoke all on function public.staff_mint_bill_tokens(bigint[], date) from public, anon;
grant execute on function public.staff_mint_bill_tokens(bigint[], date) to authenticated;

-- =====================================================================
-- 5) Explicit revoke (staff / service-role only) — org + bill_publish scoped.
--    Invalidates a link by token. Idempotent (already-revoked → still revoked).
-- =====================================================================
create or replace function public.staff_revoke_bill_token(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org bigint;
  v_found boolean;
begin
  v_org := public.current_user_org();
  if v_org is null then
    raise exception 'no org' using errcode = '42501';
  end if;
  if not public.current_user_has_module('bill_publish') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update bill_share_tokens
  set revoked_at = coalesce(revoked_at, now())
  where token = p_token
    and org_id = v_org
  returning true into v_found;

  return coalesce(v_found, false);
end;
$$;

revoke all on function public.staff_revoke_bill_token(uuid) from public, anon;
grant execute on function public.staff_revoke_bill_token(uuid) to authenticated;

-- =====================================================================
-- 6) Verify (anon public read) — base 0134. FAIL-CLOSED occupancy gate.
--    token_ok = (not expired) AND (not revoked) AND (occupancy_id is not null)
--               AND the bound occupancy is still the CURRENT/active occupant of the unit:
--                 - occupancy row exists, deleted_at is null, status in (occupied, moving_out)
--                 - AND no DIFFERENT occupancy now holds the unit as a newer active occupant
--                   (another occupancy on the same unit, deleted_at is null, status='occupied',
--                    with a later move_in_date, or equal move_in_date and greater id).
--    When token_ok is false, every data column is null and is_expired=true (link "dead"),
--    so the anon page shows the expired/invalid state and leaks no PII.
--    Preserved: return columns, anon/authenticated grant, history/charges item shaping,
--    proration scaling from 0134.
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
  with tok as (
    select
      bst.*,
      (
        bst.expires_at > now()
        and bst.revoked_at is null
        and bst.occupancy_id is not null
        and exists (
          select 1
          from occupancies bound
          where bound.id = bst.occupancy_id
            and bound.unit_id = bst.unit_id
            and bound.deleted_at is null
            and bound.status in ('occupied', 'moving_out')
        )
        and not exists (
          -- a different occupancy now actively holds the unit (tenant turnover)
          select 1
          from occupancies newer
          join occupancies bound on bound.id = bst.occupancy_id
          where newer.unit_id = bst.unit_id
            and newer.id <> bst.occupancy_id
            and newer.deleted_at is null
            and newer.status = 'occupied'
            and newer.move_in_date is not null
            and (
              bound.move_in_date is null
              or newer.move_in_date > bound.move_in_date
              or (newer.move_in_date = bound.move_in_date and newer.id > bound.id)
            )
        )
      ) as token_ok
    from bill_share_tokens bst
    where bst.token = p_token
  )
  select
    tok.period,
    b.name,
    u.unit_no,
    case when tok.token_ok then bc.total_amount else null end,
    case when tok.token_ok then coalesce(pay.paid_amount, 0)::int else null end,
    case
      when tok.token_ok
      then greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int
      else null
    end,
    case when tok.token_ok then issue.due_date else null end,
    case
      when tok.token_ok
      then coalesce(history.items, charges.items, '[]'::jsonb)
      else null
    end,
    case when tok.token_ok then sc.mgmt_bank1 else null end,
    case when tok.token_ok then sc.mgmt_acct1 else null end,
    case when tok.token_ok then sc.mgmt_holder1 else null end,
    tok.expires_at,
    not tok.token_ok
  from tok
  join units u on u.id = tok.unit_id
  join buildings b on b.id = u.building_id and b.org_id = tok.org_id
  left join billing_confirmations bc
    on bc.unit_id = tok.unit_id
   and bc.period = tok.period
   and bc.confirmed_at is not null
  left join setup_config sc on sc.org_id = tok.org_id
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from payments p
    where p.unit_id = tok.unit_id
      and p.period = tok.period
      and p.status = 'active'
  ) pay on true
  left join lateral (
    select bi.due_date
    from bill_issues bi
    where bi.unit_id = tok.unit_id
      and bi.period = tok.period
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
    where bh.unit_id = tok.unit_id
      and bh.period = tok.period
    order by bh.confirmed_at desc, bh.id desc
    limit 1
  ) history on true
  left join lateral (
    -- charges fallback (anon): name/amount only. amount scaled to bc.total_amount.
    -- bc missing (unconfirmed) → total_amount is null → where drops rows → coalesce '[]'.
    -- raw_total (sum() over ())=0 → cannot scale → dropped.
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
      where fic.unit_id = tok.unit_id
        and fic.period = tok.period
        and fic.charged = true
    ) scaled
    where bc.total_amount is not null
      and scaled.raw_total is not null
      and scaled.raw_total <> 0
  ) charges on true;
$$;

revoke execute on function public_bill_by_token(uuid) from public;
grant execute on function public_bill_by_token(uuid) to anon, authenticated;

-- =====================================================================
-- 7) Backfill existing rows' occupancy_id (best-effort, guarded, idempotent).
--    Only touches rows still missing a binding. Uses the same resolver as mint.
--    NOTE: production bill_share_tokens is currently EMPTY (0 rows), so this is a
--    no-op today; retained for defense-in-depth if rows appear before apply.
--    Legacy rows that cannot be mapped (unit has no occupancy at all → resolver
--    returns NULL) are LEFT with occupancy_id NULL and are therefore REJECTED by
--    the fail-closed verify above (safe default; forces a re-mint). This is
--    acceptable because there is no live usage to break.
-- =====================================================================
do $$
begin
  update bill_share_tokens t
  set occupancy_id = resolve_bill_token_occupancy(t.unit_id, t.period)
  where t.occupancy_id is null;
end $$;
