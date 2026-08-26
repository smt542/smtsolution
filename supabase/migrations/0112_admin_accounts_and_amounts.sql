-- Batch 3b: platform account details and backend-owned per-channel billing amounts.
-- This migration is intentionally unapplied; the orchestrator applies it after review.

-- Account notes are membership-scoped because one profile may belong to more than one organization.
alter table public.org_members
  add column if not exists memo text;

-- Replace the paginated account RPC so profile fields no longer depend on a client-side RLS join.
drop function if exists public.platform_list_accounts(text, integer, integer);

create function public.platform_list_accounts(
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  org_id bigint,
  organization_name text,
  user_id uuid,
  username text,
  full_name text,
  phone text,
  memo text,
  role public.org_member_role,
  staff_type public.staff_type,
  feature_permissions jsonb,
  is_active boolean,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'limit must be between 1 and 100' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'offset must be zero or greater' using errcode = '22023';
  end if;

  return query
  select
    member.org_id,
    organization.name,
    member.user_id,
    profile.username,
    profile.full_name,
    profile.phone,
    member.memo,
    member.role,
    member.staff_type,
    member.feature_permissions,
    profile.is_active,
    member.created_at,
    count(*) over ()::bigint
  from public.org_members member
  join public.organizations organization on organization.id = member.org_id
  left join public.profiles profile on profile.user_id = member.user_id
  where nullif(btrim(coalesce(p_search, '')), '') is null
    or organization.name ilike '%' || btrim(p_search) || '%'
    or profile.full_name ilike '%' || btrim(p_search) || '%'
    or profile.username ilike '%' || btrim(p_search) || '%'
    or coalesce(profile.phone, '') ilike '%' || btrim(p_search) || '%'
    or coalesce(member.memo, '') ilike '%' || btrim(p_search) || '%'
  order by member.created_at desc, member.org_id, member.user_id
  limit p_limit
  offset p_offset;
end
$$;

revoke all on function public.platform_list_accounts(text, integer, integer)
  from public, anon;
grant execute on function public.platform_list_accounts(text, integer, integer)
  to authenticated;

-- Profile name/phone are identity fields; memo remains specific to the target membership.
create or replace function public.platform_update_account(
  p_org_id bigint,
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_memo text
)
returns table (
  org_id bigint,
  user_id uuid,
  full_name text,
  phone text,
  memo text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_org_id is null or p_user_id is null then
    raise exception 'organization and user are required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_full_name, '')), '') is null then
    raise exception 'full name required' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'full_name', profile.full_name,
      'phone', profile.phone
    ),
    'membership', jsonb_build_object(
      'org_id', member.org_id,
      'memo', member.memo
    )
  )
  into v_before
  from public.org_members member
  join public.profiles profile on profile.user_id = member.user_id
  where member.org_id = p_org_id
    and member.user_id = p_user_id;

  if v_before is null then
    raise exception 'account membership not found' using errcode = 'P0002';
  end if;

  update public.profiles profile
  set
    full_name = btrim(p_full_name),
    phone = nullif(btrim(coalesce(p_phone, '')), '')
  where profile.user_id = p_user_id;

  update public.org_members member
  set memo = nullif(btrim(coalesce(p_memo, '')), '')
  where member.org_id = p_org_id
    and member.user_id = p_user_id;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'full_name', profile.full_name,
      'phone', profile.phone
    ),
    'membership', jsonb_build_object(
      'org_id', member.org_id,
      'memo', member.memo
    )
  )
  into v_after
  from public.org_members member
  join public.profiles profile on profile.user_id = member.user_id
  where member.org_id = p_org_id
    and member.user_id = p_user_id;

  insert into public.audit_log (
    org_id,
    actor_id,
    action,
    table_name,
    row_pk,
    before,
    after
  )
  values (
    p_org_id,
    (select auth.uid()),
    'PLATFORM_ACCOUNT_UPDATE',
    'profiles,org_members',
    p_org_id::text || ':' || p_user_id::text,
    v_before,
    v_after
  );

  return query
  select
    member.org_id,
    profile.user_id,
    profile.full_name,
    profile.phone,
    member.memo
  from public.org_members member
  join public.profiles profile on profile.user_id = member.user_id
  where member.org_id = p_org_id
    and member.user_id = p_user_id;
end
$$;

revoke all on function public.platform_update_account(bigint, uuid, text, text, text)
  from public, anon;
grant execute on function public.platform_update_account(bigint, uuid, text, text, text)
  to authenticated;

-- Preserve channel amount snapshots once a post-paid ledger row is finalized.
alter table public.platform_billing_invoices
  add column if not exists alimtalk_amount_krw bigint not null default 0,
  add column if not exists sms_amount_krw bigint not null default 0,
  add column if not exists fax_amount_krw bigint not null default 0;

-- Existing snapshots predate channel amounts. Allocate their recorded subtotal using the
-- current channel-rate weights, while keeping the original subtotal exactly unchanged.
with weighted as (
  select
    invoice.id,
    invoice.subtotal_krw,
    invoice.alimtalk_count::bigint * setting.rate_krw_alimtalk as alimtalk_weight,
    (
      invoice.sms_count::bigint * setting.rate_krw_sms
      + invoice.lms_count::bigint * setting.rate_krw_lms
    ) as sms_weight,
    invoice.fax_page_count::bigint * setting.rate_krw_fax as fax_weight
  from public.platform_billing_invoices invoice
  cross join public.platform_settings setting
  where setting.id = 1
), allocated as (
  select
    weighted.id,
    case
      when weighted.alimtalk_weight + weighted.sms_weight + weighted.fax_weight = 0 then 0::bigint
      else round(
        weighted.subtotal_krw::numeric * weighted.alimtalk_weight
        / (weighted.alimtalk_weight + weighted.sms_weight + weighted.fax_weight)
      )::bigint
    end as alimtalk_amount_krw,
    case
      when weighted.alimtalk_weight + weighted.sms_weight + weighted.fax_weight = 0 then 0::bigint
      else round(
        weighted.subtotal_krw::numeric * weighted.sms_weight
        / (weighted.alimtalk_weight + weighted.sms_weight + weighted.fax_weight)
      )::bigint
    end as sms_amount_krw,
    weighted.subtotal_krw
  from weighted
)
update public.platform_billing_invoices invoice
set
  alimtalk_amount_krw = allocated.alimtalk_amount_krw,
  sms_amount_krw = allocated.sms_amount_krw,
  fax_amount_krw = allocated.subtotal_krw
    - allocated.alimtalk_amount_krw
    - allocated.sms_amount_krw
from allocated
where allocated.id = invoice.id;

-- Return canonical backend amounts for each channel. Live rows use the billing settings
-- used by this RPC; finalized rows use their immutable amount snapshot.
drop function if exists public.platform_list_org_billing(date);

create function public.platform_list_org_billing(p_month date)
returns table (
  org_id bigint,
  org_name text,
  org_email text,
  status text,
  alimtalk_count int,
  sms_count int,
  lms_count int,
  fax_count int,
  fax_page_count int,
  alimtalk_amount_krw bigint,
  sms_amount_krw bigint,
  fax_amount_krw bigint,
  subtotal_krw bigint,
  vat_krw bigint,
  total_krw bigint,
  prev_total_krw bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date;
  v_prev_month date;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_month is null then
    raise exception 'billing month is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.platform_settings setting where setting.id = 1) then
    raise exception 'platform settings singleton is missing' using errcode = '55000';
  end if;

  v_month := date_trunc('month', p_month)::date;
  v_prev_month := (v_month - interval '1 month')::date;

  return query
  with setting as (
    select * from public.platform_settings where id = 1
  ), live as (
    select
      usage.org_id,
      usage.billing_month,
      usage.alimtalk_count,
      usage.sms_count,
      usage.lms_count,
      usage.fax_sends as fax_count,
      usage.fax_pages as fax_page_count,
      (usage.alimtalk_count::bigint * setting.rate_krw_alimtalk)::bigint
        as alimtalk_amount_krw,
      (
        usage.sms_count::bigint * setting.rate_krw_sms
        + usage.lms_count::bigint * setting.rate_krw_lms
      )::bigint as sms_amount_krw,
      (usage.fax_pages::bigint * setting.rate_krw_fax)::bigint
        as fax_amount_krw,
      setting.vat_rate
    from (
      select v_month as billing_month, usage.*
      from public.platform_org_usage(v_month) usage
      union all
      select v_prev_month as billing_month, usage.*
      from public.platform_org_usage(v_prev_month) usage
    ) usage
    cross join setting
  ), live_amounts as (
    select
      live.*,
      (live.alimtalk_amount_krw + live.sms_amount_krw + live.fax_amount_krw)::bigint
        as subtotal_krw,
      round(
        (live.alimtalk_amount_krw + live.sms_amount_krw + live.fax_amount_krw)
        * live.vat_rate / 100
      )::bigint as vat_krw
    from live
  ), live_totals as (
    select
      live_amounts.*,
      (live_amounts.subtotal_krw + live_amounts.vat_krw)::bigint as total_krw
    from live_amounts
  )
  select
    organization.id,
    organization.name,
    owner.email,
    case
      when current_invoice.id is not null then current_invoice.status
      when current_live.total_krw > 0 then 'unpaid'
      else 'none'
    end,
    case when current_invoice.id is not null then current_invoice.alimtalk_count else current_live.alimtalk_count end,
    case when current_invoice.id is not null then current_invoice.sms_count else current_live.sms_count end,
    case when current_invoice.id is not null then current_invoice.lms_count else current_live.lms_count end,
    case when current_invoice.id is not null then current_invoice.fax_count else current_live.fax_count end,
    case when current_invoice.id is not null then current_invoice.fax_page_count else current_live.fax_page_count end,
    case when current_invoice.id is not null then current_invoice.alimtalk_amount_krw else current_live.alimtalk_amount_krw end,
    case when current_invoice.id is not null then current_invoice.sms_amount_krw else current_live.sms_amount_krw end,
    case when current_invoice.id is not null then current_invoice.fax_amount_krw else current_live.fax_amount_krw end,
    case when current_invoice.id is not null then current_invoice.subtotal_krw else current_live.subtotal_krw end,
    case when current_invoice.id is not null then current_invoice.vat_krw else current_live.vat_krw end,
    case when current_invoice.id is not null then current_invoice.total_krw else current_live.total_krw end,
    case when previous_invoice.id is not null then previous_invoice.total_krw else previous_live.total_krw end
  from public.organizations organization
  join live_totals current_live
    on current_live.org_id = organization.id and current_live.billing_month = v_month
  join live_totals previous_live
    on previous_live.org_id = organization.id and previous_live.billing_month = v_prev_month
  left join public.platform_billing_invoices current_invoice
    on current_invoice.org_id = organization.id and current_invoice.billing_month = v_month
  left join public.platform_billing_invoices previous_invoice
    on previous_invoice.org_id = organization.id and previous_invoice.billing_month = v_prev_month
  left join lateral (
    select auth_user.email::text as email
    from public.org_members membership
    join auth.users auth_user on auth_user.id = membership.user_id
    where membership.org_id = organization.id
      and membership.role = 'org_owner'
      and auth_user.email is not null
    order by membership.created_at, membership.user_id
    limit 1
  ) owner on true
  where organization.deleted_at is null
  order by organization.name, organization.id;
end
$$;

revoke all on function public.platform_list_org_billing(date)
  from public, anon;
grant execute on function public.platform_list_org_billing(date)
  to authenticated;

-- Snapshot the same per-channel amounts whenever the post-paid row is finalized as paid.
create or replace function public.platform_mark_org_billing_paid(
  p_org_id bigint,
  p_month date,
  p_paid boolean
)
returns public.platform_billing_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date;
  v_usage record;
  v_rate record;
  v_alimtalk_amount bigint;
  v_sms_amount bigint;
  v_fax_amount bigint;
  v_subtotal bigint;
  v_vat bigint;
  v_total bigint;
  v_before jsonb;
  v_invoice public.platform_billing_invoices%rowtype;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_month is null then
    raise exception 'billing month is required' using errcode = '22023';
  end if;
  if p_paid is null then
    raise exception 'paid flag is required' using errcode = '22023';
  end if;

  v_month := date_trunc('month', p_month)::date;

  if not exists (
    select 1 from public.organizations organization where organization.id = p_org_id
  ) then
    raise exception 'organization not found' using errcode = '22023';
  end if;

  if not p_paid then
    delete from public.platform_billing_invoices invoice
    where invoice.org_id = p_org_id and invoice.billing_month = v_month
    returning * into v_invoice;

    insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
    values (
      p_org_id,
      (select auth.uid()),
      'PLATFORM_BILLING_REVERT_TO_UNPAID',
      'platform_billing_invoices',
      p_org_id::text || ':' || v_month::text,
      to_jsonb(v_invoice),
      null
    );
    return v_invoice;
  end if;

  if not exists (select 1 from public.platform_settings setting where setting.id = 1) then
    raise exception 'platform settings singleton is missing' using errcode = '55000';
  end if;

  select * into v_rate from public.platform_settings where id = 1;
  select * into v_usage from public.platform_org_usage(v_month) where org_id = p_org_id;

  v_alimtalk_amount := coalesce(v_usage.alimtalk_count, 0)::bigint * v_rate.rate_krw_alimtalk;
  v_sms_amount := (
    coalesce(v_usage.sms_count, 0)::bigint * v_rate.rate_krw_sms
    + coalesce(v_usage.lms_count, 0)::bigint * v_rate.rate_krw_lms
  )::bigint;
  v_fax_amount := coalesce(v_usage.fax_pages, 0)::bigint * v_rate.rate_krw_fax;
  v_subtotal := v_alimtalk_amount + v_sms_amount + v_fax_amount;
  v_vat := round(v_subtotal * v_rate.vat_rate / 100)::bigint;
  v_total := v_subtotal + v_vat;

  select to_jsonb(invoice) into v_before
  from public.platform_billing_invoices invoice
  where invoice.org_id = p_org_id and invoice.billing_month = v_month;

  insert into public.platform_billing_invoices(
    org_id,
    billing_month,
    status,
    alimtalk_count,
    sms_count,
    lms_count,
    fax_count,
    fax_page_count,
    alimtalk_amount_krw,
    sms_amount_krw,
    fax_amount_krw,
    subtotal_krw,
    vat_krw,
    total_krw,
    paid_at,
    updated_by,
    updated_at
  ) values (
    p_org_id,
    v_month,
    'paid',
    coalesce(v_usage.alimtalk_count, 0),
    coalesce(v_usage.sms_count, 0),
    coalesce(v_usage.lms_count, 0),
    coalesce(v_usage.fax_sends, 0),
    coalesce(v_usage.fax_pages, 0),
    v_alimtalk_amount,
    v_sms_amount,
    v_fax_amount,
    v_subtotal,
    v_vat,
    v_total,
    now(),
    (select auth.uid()),
    now()
  )
  on conflict (org_id, billing_month) do update
  set
    status = 'paid',
    alimtalk_count = excluded.alimtalk_count,
    sms_count = excluded.sms_count,
    lms_count = excluded.lms_count,
    fax_count = excluded.fax_count,
    fax_page_count = excluded.fax_page_count,
    alimtalk_amount_krw = excluded.alimtalk_amount_krw,
    sms_amount_krw = excluded.sms_amount_krw,
    fax_amount_krw = excluded.fax_amount_krw,
    subtotal_krw = excluded.subtotal_krw,
    vat_krw = excluded.vat_krw,
    total_krw = excluded.total_krw,
    paid_at = now(),
    updated_by = (select auth.uid()),
    updated_at = now()
  returning * into v_invoice;

  insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
  values (
    p_org_id,
    (select auth.uid()),
    'PLATFORM_BILLING_MARK_PAID',
    'platform_billing_invoices',
    p_org_id::text || ':' || v_month::text,
    v_before,
    to_jsonb(v_invoice)
  );

  return v_invoice;
end
$$;

revoke all on function public.platform_mark_org_billing_paid(bigint, date, boolean)
  from public, anon;
grant execute on function public.platform_mark_org_billing_paid(bigint, date, boolean)
  to authenticated;
