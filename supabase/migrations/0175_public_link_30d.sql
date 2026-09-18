-- 0175: Anchor public-link lifetimes to issuance and audit successful views.
-- This migration is intentionally additive for bill signatures so links issued
-- before 0175 remain verifiable through the existing four-argument function.

-- =====================================================================
-- 1) Bill HMAC signatures: add the UTC issuance day to new signatures.
-- =====================================================================
create or replace function public.bill_signature(
  p_building_id bigint,
  p_unit_no text,
  p_period date,
  p_issued_day integer
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
        p_building_id::text || ':' || p_unit_no || ':'
          || to_char(p_period, 'YYYY-MM') || ':' || p_issued_day::text,
        (select value from public.app_secrets where key = 'bill_sign_hmac'),
        'sha256'
      ),
      'base64'
    ),
    '+/=', '-_'
  );
$$;

revoke all on function public.bill_signature(bigint, text, date, integer)
  from anon, authenticated, public;

-- =====================================================================
-- 2) Verifier. The four-argument entry point remains for old URLs and
-- delegates to this body with a null issuance day.
-- =====================================================================
create or replace function public.public_bill_by_signed(
  p_building_id bigint,
  p_unit_no text,
  p_period date,
  p_sig text,
  p_issued_day integer
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
      (
        p_sig is not null
        and case
          when p_issued_day is null
          then p_sig = public.bill_signature(p_building_id, p_unit_no, p_period)
          else p_sig = public.bill_signature(
            p_building_id,
            p_unit_no,
            p_period,
            p_issued_day
          )
        end
      ) as ok
  )
  select
    bc.period,
    b.name,
    u.unit_no,
    case when now() < exp.expires_at then bc.total_amount else null end,
    case when now() < exp.expires_at then coalesce(pay.paid_amount, 0)::int else null end,
    case
      when now() < exp.expires_at
      then greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int
      else null
    end,
    case
      when now() < exp.expires_at
      then round(
        greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0) * lf.cumulative_rate / 100.0
      )::int
      else null
    end,
    case when now() < exp.expires_at then issue.due_date else null end,
    case
      when now() < exp.expires_at
      then coalesce(charges.items, '[]'::jsonb)
      else null
    end,
    case when now() < exp.expires_at then sc.mgmt_bank1 else null end,
    case when now() < exp.expires_at then sc.mgmt_acct1 else null end,
    case when now() < exp.expires_at then sc.mgmt_holder1 else null end,
    exp.expires_at,
    now() >= exp.expires_at
  from sig
  join public.buildings b on b.id = p_building_id
  join public.units u
    on u.building_id = b.id
   and u.unit_no = p_unit_no
   and u.deleted_at is null
  join public.billing_confirmations bc
    on bc.unit_id = u.id
   and bc.period = p_period
   and bc.confirmed_at is not null
  left join public.setup_config sc on sc.org_id = b.org_id
  left join lateral (
    select coalesce(sum(p.amount), 0)::int as paid_amount
    from public.payments p
    where p.unit_id = u.id
      and p.period = bc.period
      and p.status = 'active'
  ) pay on true
  left join lateral (
    select bi.due_date
    from public.bill_issues bi
    where bi.unit_id = u.id
      and bi.period = bc.period
    order by bi.issued_at desc, bi.id desc
    limit 1
  ) issue on true
  left join lateral (
    select case
      when p_issued_day is not null
      then (
        to_timestamp(p_issued_day::double precision * 86400)
          + interval '30 days'
      )::timestamptz
      -- This legacy branch exists only for links issued before 0175 and can
      -- be removed once the longest legacy window has passed. It preserves
      -- the exact 0149 due-date-or-period-month-start expiry rule.
      else (
        coalesce(issue.due_date, date_trunc('month', p_period)::date)
          + interval '1 month'
      )::timestamptz
    end as expires_at
  ) exp on true
  left join lateral (
    select coalesce(sum(
      (
        select t.monthly_rate
        from public.late_fee_rate_tiers t
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
    select jsonb_agg(
      jsonb_build_object(
        'name', fi.name,
        'amount', fic.amount,
        'utility', util.u,
        'usage', mr.usage,
        'prev_usage', prev.usage
      ) order by fi.sort_order, fi.id
    ) as items
    from public.fee_item_charges fic
    join public.fee_items fi on fi.id = fic.fee_item_id
    cross join lateral (
      select case
        when fi.name like '%수도%' then 'water'
        when fi.name like '%전기%' then 'elec'
        when fi.name like '%가스%' then 'gas'
        else null
      end as u
    ) util
    left join public.meter_readings mr
      on mr.unit_id = fic.unit_id
     and mr.period = fic.period
     and mr.utility = util.u
    left join public.meter_readings prev
      on prev.unit_id = fic.unit_id
     and prev.period = (fic.period - interval '1 month')::date
     and prev.utility = util.u
    where fic.unit_id = u.id
      and fic.period = bc.period
      and fic.charged = true
  ) charges on true
  where sig.ok;
$$;

-- Keep the old RPC shape working for URLs issued before 0175. Omitting the
-- issuance day therefore selects the old payload verification and expiry
-- branch above instead of making already-delivered links invalid.
create or replace function public.public_bill_by_signed(
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
  select *
  from public.public_bill_by_signed(
    p_building_id,
    p_unit_no,
    p_period,
    p_sig,
    null::integer
  );
$$;

revoke execute on function public.public_bill_by_signed(
  bigint, text, date, text, integer
) from public;
grant execute on function public.public_bill_by_signed(
  bigint, text, date, text, integer
) to anon, authenticated;
revoke execute on function public.public_bill_by_signed(
  bigint, text, date, text
) from public;
grant execute on function public.public_bill_by_signed(
  bigint, text, date, text
) to anon, authenticated;

-- =====================================================================
-- 3) New bill issuers return the issuance day used in the HMAC payload.
-- =====================================================================
drop function if exists public.resident_sign_bill_url(date);
create function public.resident_sign_bill_url(p_period date)
returns table (
  building_id bigint,
  unit_no text,
  sig text,
  issued_day integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_link record;
  v_unit_no text;
  v_issued_day integer;
begin
  select * into v_link from public.resident_linked_unit();
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
    from public.billing_confirmations bc
    where bc.unit_id = v_link.unit_id
      and bc.period = p_period
      and bc.confirmed_at is not null
  ) then
    raise exception 'confirmed bill not found';
  end if;

  select u.unit_no into v_unit_no
  from public.units u
  where u.id = v_link.unit_id;
  v_issued_day := floor(extract(epoch from now()) / 86400)::integer;

  return query
  select
    v_link.building_id,
    v_unit_no,
    public.bill_signature(v_link.building_id, v_unit_no, p_period, v_issued_day),
    v_issued_day;
end;
$$;

revoke execute on function public.resident_sign_bill_url(date) from public, anon;
grant execute on function public.resident_sign_bill_url(date) to authenticated;

drop function if exists public.staff_sign_bill_urls(bigint[], date);
create function public.staff_sign_bill_urls(
  p_unit_ids bigint[],
  p_period date
)
returns table (
  unit_id bigint,
  building_id bigint,
  unit_no text,
  sig text,
  issued_day integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_org bigint;
  v_issued_day integer;
begin
  v_org := public.current_user_org();
  if v_org is null then
    raise exception 'no org' using errcode = '42501';
  end if;
  if not public.current_user_has_module('bill_publish') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_issued_day := floor(extract(epoch from now()) / 86400)::integer;

  return query
  select
    u.id as unit_id,
    b.id as building_id,
    u.unit_no,
    public.bill_signature(b.id, u.unit_no, p_period, v_issued_day) as sig,
    v_issued_day
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

revoke all on function public.staff_sign_bill_urls(bigint[], date) from public, anon;
grant execute on function public.staff_sign_bill_urls(bigint[], date) to authenticated;

-- =====================================================================
-- 4) Notice and settlement share tokens: newly minted links last 30 days.
-- =====================================================================
update public.notice_share_tokens
set expires_at = least(expires_at, now() + interval '30 days');

update public.settlement_share_tokens
set expires_at = least(expires_at, now() + interval '30 days');

create or replace function public.mint_notice_share_token(p_notice_id bigint)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org bigint;
  v_token uuid;
begin
  v_org := public.current_user_org();
  if v_org is null then
    raise exception 'no org' using errcode = '42501';
  end if;

  if not public.current_user_has_module('messaging') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.notice_share_tokens (
    org_id,
    notice_id,
    created_by,
    expires_at
  )
  select
    v_org,
    n.id,
    auth.uid(),
    now() + interval '30 days'
  from public.notices n
  where n.id = p_notice_id
    and n.org_id = v_org
    and n.deleted_at is null
    and n.published_at is not null
    and n.published_at <= now()
    and (n.expires_at is null or n.expires_at > now())
  on conflict (notice_id) do update
    set expires_at = excluded.expires_at
  returning notice_share_tokens.token into v_token;

  if v_token is null then
    raise exception 'published notice not found' using errcode = 'P0002';
  end if;

  return v_token;
end;
$$;

create or replace function public.mint_settlement_share_token(p_settlement_id bigint)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org bigint;
  v_token uuid;
begin
  v_org := public.current_user_org();
  if v_org is null then
    raise exception 'no org' using errcode = '42501';
  end if;

  if not public.current_user_has_module('moving') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.settlement_share_tokens (
    org_id,
    settlement_id,
    created_by,
    expires_at
  )
  select
    v_org,
    s.id,
    auth.uid(),
    now() + interval '30 days'
  from public.moving_settlements s
  join public.units u
    on u.id = s.unit_id
   and u.deleted_at is null
  join public.buildings b
    on b.id = u.building_id
   and b.org_id = v_org
  where s.id = p_settlement_id
    and s.status = 'completed'
  on conflict (settlement_id) do update
    set expires_at = excluded.expires_at
  returning settlement_share_tokens.token into v_token;

  if v_token is null then
    raise exception 'completed settlement not found' using errcode = 'P0002';
  end if;

  return v_token;
end;
$$;

revoke all on function public.mint_notice_share_token(bigint) from public, anon;
grant execute on function public.mint_notice_share_token(bigint) to authenticated;

revoke all on function public.mint_settlement_share_token(bigint) from public, anon;
grant execute on function public.mint_settlement_share_token(bigint) to authenticated;
