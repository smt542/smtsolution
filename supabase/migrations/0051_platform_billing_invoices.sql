-- 0051_platform_billing_invoices.sql
-- HQ platform billing (PHASE 2): monthly post-paid snapshots and overview aggregates.
-- Depends on 0000(profiles/audit_log), 0001(buildings/units),
-- 0010(message_logs), 0011(current_user_is_platform_admin),
-- 0013/0032(bill_issues/fax delivery), 0033(organizations.deleted_at),
-- 0037(resolved message recipient channels), 0039(res_claims), and 0050(platform_settings).

create table public.platform_billing_invoices (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations(id),
  billing_month date not null
    check (billing_month = date_trunc('month', billing_month)::date),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  alimtalk_count int not null default 0,
  sms_count int not null default 0,
  fax_count int not null default 0,
  subtotal_krw bigint not null default 0,
  vat_krw bigint not null default 0,
  total_krw bigint not null default 0,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_by uuid references public.profiles(user_id),
  updated_at timestamptz not null default now(),
  unique (org_id, billing_month)
);

create index platform_billing_invoices_billing_month_idx
  on public.platform_billing_invoices (billing_month);

alter table public.platform_billing_invoices enable row level security;

create policy platform_billing_invoices_platform_select
  on public.platform_billing_invoices
  for select to authenticated
  using (public.current_user_is_platform_admin());

create policy platform_billing_invoices_platform_all
  on public.platform_billing_invoices
  for all to authenticated
  using (public.current_user_is_platform_admin())
  with check (public.current_user_is_platform_admin());

-- Aggregation source decisions:
-- * Direct SMS/alimtalk rows use message_logs.recipient_count. For channel='auto',
--   each recipients[] item is expanded and its server-resolved `channel` key is
--   counted. Both 0030 and the current 0037 send_messages implementation persist
--   that key, so there is no unresolved auto bucket in the product schema.
-- * message_logs is the requested usage ledger and retains routed recipients for
--   stub/queued/sent/partial/failed rows. In particular, partial provider results
--   are not written back per recipient, so a success-only per-channel split cannot
--   be reconstructed; these metrics count logged, routed recipients.
-- * Fax has no direct org_id: bill_issues -> units -> buildings supplies org_id.
--   Of the known statuses none/scheduled/sent/failed, only sent is counted as a
--   completed fax send. issued_at determines its billing month. bill_issues is
--   unique per (unit, bill period, issue type) and its send RPC upserts issued_at,
--   so repeated fax attempts are not an append-only history and cannot be counted
--   separately from the surviving sent issue row.
-- * profiles has no email column. The deterministic first org_owner membership is
--   joined to auth.users.email; organizations without a resolvable owner return NULL.
-- * Timestamp month boundaries use Asia/Seoul, matching the product's billing-date
--   convention and avoiding dependence on the database session time zone.

create or replace function public.platform_list_org_billing(p_month date)
returns table (
  org_id bigint,
  org_name text,
  org_email text,
  status text,
  alimtalk_count int,
  sms_count int,
  fax_count int,
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
  v_next_month date;
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
  v_next_month := (v_month + interval '1 month')::date;

  return query
  with message_usage as (
    select
      log.org_id,
      date_trunc('month', log.sent_at at time zone 'Asia/Seoul')::date as billing_month,
      sum(
        case when log.channel = 'alimtalk' then log.recipient_count else 0 end
        + case when log.channel = 'auto' then (
            select count(*)::integer
            from jsonb_array_elements(log.recipients) recipient(value)
            where recipient.value->>'channel' = 'alimtalk'
          ) else 0 end
      )::integer as alimtalk_count,
      sum(
        case when log.channel = 'sms' then log.recipient_count else 0 end
        + case when log.channel = 'auto' then (
            select count(*)::integer
            from jsonb_array_elements(log.recipients) recipient(value)
            where recipient.value->>'channel' = 'sms'
          ) else 0 end
      )::integer as sms_count
    from public.message_logs log
    where log.sent_at >= (v_prev_month::timestamp at time zone 'Asia/Seoul')
      and log.sent_at < (v_next_month::timestamp at time zone 'Asia/Seoul')
    group by
      log.org_id,
      date_trunc('month', log.sent_at at time zone 'Asia/Seoul')::date
  ),
  fax_usage as (
    select
      building.org_id,
      date_trunc('month', issue.issued_at at time zone 'Asia/Seoul')::date as billing_month,
      count(*)::integer as fax_count
    from public.bill_issues issue
    join public.units unit on unit.id = issue.unit_id
    join public.buildings building on building.id = unit.building_id
    where issue.issue_type = 'fax'
      and issue.send_status = 'sent'
      and issue.issued_at >= (v_prev_month::timestamp at time zone 'Asia/Seoul')
      and issue.issued_at < (v_next_month::timestamp at time zone 'Asia/Seoul')
    group by
      building.org_id,
      date_trunc('month', issue.issued_at at time zone 'Asia/Seoul')::date
  ),
  live_counts as (
    select
      organization.id as org_id,
      month_value.billing_month,
      coalesce(messages.alimtalk_count, 0)::integer as alimtalk_count,
      coalesce(messages.sms_count, 0)::integer as sms_count,
      coalesce(faxes.fax_count, 0)::integer as fax_count,
      (
        coalesce(messages.alimtalk_count, 0)::bigint * setting.rate_krw_alimtalk
        + coalesce(messages.sms_count, 0)::bigint * setting.rate_krw_sms
        + coalesce(faxes.fax_count, 0)::bigint * setting.rate_krw_fax
      )::bigint as subtotal_krw,
      setting.vat_rate
    from public.organizations organization
    cross join (
      values (v_month), (v_prev_month)
    ) as month_value(billing_month)
    cross join public.platform_settings setting
    left join message_usage messages
      on messages.org_id = organization.id
      and messages.billing_month = month_value.billing_month
    left join fax_usage faxes
      on faxes.org_id = organization.id
      and faxes.billing_month = month_value.billing_month
    where organization.deleted_at is null
      and setting.id = 1
  ),
  live_amounts as (
    select
      counts.org_id,
      counts.billing_month,
      counts.alimtalk_count,
      counts.sms_count,
      counts.fax_count,
      counts.subtotal_krw,
      round(counts.subtotal_krw * counts.vat_rate / 100)::bigint as vat_krw,
      (
        counts.subtotal_krw
        + round(counts.subtotal_krw * counts.vat_rate / 100)::bigint
      )::bigint as total_krw
    from live_counts counts
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
    case when current_invoice.id is not null
      then current_invoice.alimtalk_count else current_live.alimtalk_count end,
    case when current_invoice.id is not null
      then current_invoice.sms_count else current_live.sms_count end,
    case when current_invoice.id is not null
      then current_invoice.fax_count else current_live.fax_count end,
    case when current_invoice.id is not null
      then current_invoice.subtotal_krw else current_live.subtotal_krw end,
    case when current_invoice.id is not null
      then current_invoice.vat_krw else current_live.vat_krw end,
    case when current_invoice.id is not null
      then current_invoice.total_krw else current_live.total_krw end,
    case when previous_invoice.id is not null
      then previous_invoice.total_krw else previous_live.total_krw end
  from public.organizations organization
  join live_amounts current_live
    on current_live.org_id = organization.id
    and current_live.billing_month = v_month
  join live_amounts previous_live
    on previous_live.org_id = organization.id
    and previous_live.billing_month = v_prev_month
  left join public.platform_billing_invoices current_invoice
    on current_invoice.org_id = organization.id
    and current_invoice.billing_month = v_month
  left join public.platform_billing_invoices previous_invoice
    on previous_invoice.org_id = organization.id
    and previous_invoice.billing_month = v_prev_month
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

create or replace function public.platform_get_overview_metrics(p_month date)
returns table (
  org_active int,
  org_suspended int,
  org_terminated int,
  building_count int,
  building_added_this_month int,
  unit_count int,
  linked_unit_count int,
  send_cost_krw bigint,
  send_cost_prev_krw bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date;
  v_prev_month date;
  v_next_month date;
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
  v_next_month := (v_month + interval '1 month')::date;

  -- send_cost_* is deliberately the pre-VAT subtotal. Stored invoice snapshots
  -- win once present; otherwise the same live usage calculation as the billing
  -- list is used. The billing page's total_krw remains VAT-inclusive.
  return query
  with message_usage as (
    select
      log.org_id,
      date_trunc('month', log.sent_at at time zone 'Asia/Seoul')::date as billing_month,
      sum(
        case when log.channel = 'alimtalk' then log.recipient_count else 0 end
        + case when log.channel = 'auto' then (
            select count(*)::integer
            from jsonb_array_elements(log.recipients) recipient(value)
            where recipient.value->>'channel' = 'alimtalk'
          ) else 0 end
      )::integer as alimtalk_count,
      sum(
        case when log.channel = 'sms' then log.recipient_count else 0 end
        + case when log.channel = 'auto' then (
            select count(*)::integer
            from jsonb_array_elements(log.recipients) recipient(value)
            where recipient.value->>'channel' = 'sms'
          ) else 0 end
      )::integer as sms_count
    from public.message_logs log
    where log.sent_at >= (v_prev_month::timestamp at time zone 'Asia/Seoul')
      and log.sent_at < (v_next_month::timestamp at time zone 'Asia/Seoul')
    group by
      log.org_id,
      date_trunc('month', log.sent_at at time zone 'Asia/Seoul')::date
  ),
  fax_usage as (
    select
      building.org_id,
      date_trunc('month', issue.issued_at at time zone 'Asia/Seoul')::date as billing_month,
      count(*)::integer as fax_count
    from public.bill_issues issue
    join public.units unit on unit.id = issue.unit_id
    join public.buildings building on building.id = unit.building_id
    where issue.issue_type = 'fax'
      and issue.send_status = 'sent'
      and issue.issued_at >= (v_prev_month::timestamp at time zone 'Asia/Seoul')
      and issue.issued_at < (v_next_month::timestamp at time zone 'Asia/Seoul')
    group by
      building.org_id,
      date_trunc('month', issue.issued_at at time zone 'Asia/Seoul')::date
  ),
  live_amounts as (
    select
      organization.id as org_id,
      month_value.billing_month,
      (
        coalesce(messages.alimtalk_count, 0)::bigint * setting.rate_krw_alimtalk
        + coalesce(messages.sms_count, 0)::bigint * setting.rate_krw_sms
        + coalesce(faxes.fax_count, 0)::bigint * setting.rate_krw_fax
      )::bigint as subtotal_krw
    from public.organizations organization
    cross join (
      values (v_month), (v_prev_month)
    ) as month_value(billing_month)
    cross join public.platform_settings setting
    left join message_usage messages
      on messages.org_id = organization.id
      and messages.billing_month = month_value.billing_month
    left join fax_usage faxes
      on faxes.org_id = organization.id
      and faxes.billing_month = month_value.billing_month
    where organization.deleted_at is null
      and setting.id = 1
  ),
  effective_amounts as (
    select
      live.org_id,
      live.billing_month,
      case when invoice.id is not null
        then invoice.subtotal_krw else live.subtotal_krw end as subtotal_krw
    from live_amounts live
    left join public.platform_billing_invoices invoice
      on invoice.org_id = live.org_id
      and invoice.billing_month = live.billing_month
  )
  select
    (select count(*)::integer
      from public.organizations organization
      where organization.status = 'active'
        and organization.deleted_at is null),
    (select count(*)::integer
      from public.organizations organization
      where organization.status = 'suspended'
        and organization.deleted_at is null),
    (select count(*)::integer
      from public.organizations organization
      where organization.deleted_at is not null),
    (select count(*)::integer
      from public.buildings building
      where building.deleted_at is null),
    (select count(*)::integer
      from public.buildings building
      where building.created_at >= (v_month::timestamp at time zone 'Asia/Seoul')
        and building.created_at < (v_next_month::timestamp at time zone 'Asia/Seoul')),
    (select count(*)::integer
      from public.units unit
      join public.buildings building
        on building.id = unit.building_id and building.deleted_at is null
      where unit.deleted_at is null),
    (select count(distinct claim.unit_id)::integer
      from public.res_claims claim
      join public.units unit
        on unit.id = claim.unit_id and unit.deleted_at is null
      join public.buildings building
        on building.id = unit.building_id and building.deleted_at is null
      where claim.status = 'linked'),
    coalesce((
      select sum(effective.subtotal_krw)::bigint
      from effective_amounts effective
      where effective.billing_month = v_month
    ), 0::bigint),
    coalesce((
      select sum(effective.subtotal_krw)::bigint
      from effective_amounts effective
      where effective.billing_month = v_prev_month
    ), 0::bigint);
end
$$;

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
  v_next_month date;
  v_alimtalk_count integer;
  v_sms_count integer;
  v_fax_count integer;
  v_subtotal_krw bigint;
  v_vat_krw bigint;
  v_total_krw bigint;
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
  v_next_month := (v_month + interval '1 month')::date;

  if not exists (
    select 1
    from public.organizations organization
    where organization.id = p_org_id
  ) then
    raise exception 'organization not found' using errcode = '22023';
  end if;

  if not p_paid then
    delete from public.platform_billing_invoices invoice
    where invoice.org_id = p_org_id
      and invoice.billing_month = v_month
    returning * into v_invoice;

    insert into public.audit_log(
      org_id, actor_id, action, table_name, row_pk, before, after
    ) values (
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

  with message_usage as (
    select
      coalesce(sum(
        case when log.channel = 'alimtalk' then log.recipient_count else 0 end
        + case when log.channel = 'auto' then (
            select count(*)::integer
            from jsonb_array_elements(log.recipients) recipient(value)
            where recipient.value->>'channel' = 'alimtalk'
          ) else 0 end
      ), 0)::integer as alimtalk_count,
      coalesce(sum(
        case when log.channel = 'sms' then log.recipient_count else 0 end
        + case when log.channel = 'auto' then (
            select count(*)::integer
            from jsonb_array_elements(log.recipients) recipient(value)
            where recipient.value->>'channel' = 'sms'
          ) else 0 end
      ), 0)::integer as sms_count
    from public.message_logs log
    where log.org_id = p_org_id
      and log.sent_at >= (v_month::timestamp at time zone 'Asia/Seoul')
      and log.sent_at < (v_next_month::timestamp at time zone 'Asia/Seoul')
  ),
  fax_usage as (
    select count(*)::integer as fax_count
    from public.bill_issues issue
    join public.units unit on unit.id = issue.unit_id
    join public.buildings building on building.id = unit.building_id
    where building.org_id = p_org_id
      and issue.issue_type = 'fax'
      and issue.send_status = 'sent'
      and issue.issued_at >= (v_month::timestamp at time zone 'Asia/Seoul')
      and issue.issued_at < (v_next_month::timestamp at time zone 'Asia/Seoul')
  ),
  live_values as (
    select
      messages.alimtalk_count,
      messages.sms_count,
      faxes.fax_count,
      (
        messages.alimtalk_count::bigint * setting.rate_krw_alimtalk
        + messages.sms_count::bigint * setting.rate_krw_sms
        + faxes.fax_count::bigint * setting.rate_krw_fax
      )::bigint as subtotal_krw,
      setting.vat_rate
    from message_usage messages
    cross join fax_usage faxes
    cross join public.platform_settings setting
    where setting.id = 1
  )
  select
    live.alimtalk_count,
    live.sms_count,
    live.fax_count,
    live.subtotal_krw,
    round(live.subtotal_krw * live.vat_rate / 100)::bigint,
    (
      live.subtotal_krw
      + round(live.subtotal_krw * live.vat_rate / 100)::bigint
    )::bigint
  into
    v_alimtalk_count,
    v_sms_count,
    v_fax_count,
    v_subtotal_krw,
    v_vat_krw,
    v_total_krw
  from live_values live;

  select to_jsonb(invoice)
    into v_before
  from public.platform_billing_invoices invoice
  where invoice.org_id = p_org_id
    and invoice.billing_month = v_month;

  insert into public.platform_billing_invoices(
    org_id,
    billing_month,
    status,
    alimtalk_count,
    sms_count,
    fax_count,
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
    v_alimtalk_count,
    v_sms_count,
    v_fax_count,
    v_subtotal_krw,
    v_vat_krw,
    v_total_krw,
    now(),
    (select auth.uid()),
    now()
  )
  on conflict (org_id, billing_month) do update
    set status = 'paid',
        alimtalk_count = excluded.alimtalk_count,
        sms_count = excluded.sms_count,
        fax_count = excluded.fax_count,
        subtotal_krw = excluded.subtotal_krw,
        vat_krw = excluded.vat_krw,
        total_krw = excluded.total_krw,
        paid_at = now(),
        updated_by = (select auth.uid()),
        updated_at = now()
  returning * into v_invoice;

  insert into public.audit_log(
    org_id, actor_id, action, table_name, row_pk, before, after
  ) values (
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

revoke all on function public.platform_list_org_billing(date)
  from public, anon;
grant execute on function public.platform_list_org_billing(date)
  to authenticated;

revoke all on function public.platform_get_overview_metrics(date)
  from public, anon;
grant execute on function public.platform_get_overview_metrics(date)
  to authenticated;

revoke all on function public.platform_mark_org_billing_paid(bigint, date, boolean)
  from public, anon;
grant execute on function public.platform_mark_org_billing_paid(bigint, date, boolean)
  to authenticated;
