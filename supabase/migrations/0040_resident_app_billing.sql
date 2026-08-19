-- Resident app billing, notices, profile, and public bill sharing.
-- Depends on 0001 (master data), 0003 (setup_config), 0005 (notices),
-- 0012 (billing), 0013 (bill issues), 0015 (payments), and 0039 (res_claims).

-- ===== Linked resident context =====
create function resident_linked_unit()
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
  join units u on u.id = o.unit_id
  join buildings b on b.id = u.building_id
  where rc.resident_user_id = auth.uid()
    and rc.status = 'linked'
  order by rc.created_at desc, rc.id desc
  limit 1;
$$;

-- ===== Public bill share tokens =====
create table bill_share_tokens (
  id bigint generated always as identity primary key,
  token uuid not null unique default gen_random_uuid(),
  org_id bigint not null references organizations(id) on delete cascade,
  unit_id bigint not null references units(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (unit_id, period)
);

alter table bill_share_tokens enable row level security;

-- Direct table access is intentionally unavailable; callers use the RPCs below.

-- ===== Resident billing RPCs =====
create function resident_bill_months()
returns table (
  period date,
  total_amount int,
  paid_amount int,
  unpaid_amount int,
  pay_status text,
  due_date date,
  confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with linked as (
    select * from resident_linked_unit()
  ), amounts as (
    select
      bc.period,
      bc.total_amount,
      coalesce(pay.paid_amount, 0)::int as paid_amount,
      greatest(bc.total_amount - coalesce(pay.paid_amount, 0), 0)::int as unpaid_amount,
      issue.due_date,
      bc.confirmed_at
    from linked l
    join billing_confirmations bc
      on bc.unit_id = l.unit_id
     and bc.confirmed_at is not null
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
    where l.move_in is not null
      and bc.period >= date_trunc('month', l.move_in)::date
      and (
        l.move_out is null
        or bc.period <= date_trunc('month', l.move_out)::date
      )
  )
  select
    a.period,
    a.total_amount,
    a.paid_amount,
    a.unpaid_amount,
    case
      when a.total_amount > 0 and a.unpaid_amount = 0 then 'paid'
      when a.paid_amount > 0 and a.paid_amount < a.total_amount then 'partial'
      when a.paid_amount = 0 and a.total_amount > 0 then 'unpaid'
      else 'none'
    end,
    a.due_date,
    a.confirmed_at
  from amounts a
  order by a.period desc;
$$;

create function resident_bill_detail(p_period date)
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
    select jsonb_agg(
      jsonb_build_object(
        'fee_item_id', fic.fee_item_id,
        'name', fi.name,
        'amount', fic.amount,
        'charged', fic.charged
      ) order by fi.sort_order, fi.id
    ) as items
    from fee_item_charges fic
    join fee_items fi on fi.id = fic.fee_item_id
    where fic.unit_id = l.unit_id
      and fic.period = bc.period
      and fic.charged = true
  ) charges on true
  where l.move_in is not null
    and p_period >= date_trunc('month', l.move_in)::date
    and (
      l.move_out is null
      or p_period <= date_trunc('month', l.move_out)::date
    );
$$;

create function resident_get_or_create_bill_token(p_period date)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link record;
  v_token uuid;
begin
  select * into v_link
  from resident_linked_unit();
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

  insert into bill_share_tokens (
    org_id, unit_id, period, created_by, expires_at
  ) values (
    v_link.org_id, v_link.unit_id, p_period, auth.uid(), now() + interval '1 year'
  )
  on conflict (unit_id, period) do update
    set expires_at = excluded.expires_at
  returning bill_share_tokens.token into v_token;

  return v_token;
end;
$$;

create function public_bill_by_token(p_token uuid)
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
    select jsonb_agg(
      jsonb_build_object('name', fi.name, 'amount', fic.amount)
      order by fi.sort_order, fi.id
    ) as items
    from fee_item_charges fic
    join fee_items fi on fi.id = fic.fee_item_id
    where fic.unit_id = bst.unit_id
      and fic.period = bst.period
      and fic.charged = true
  ) charges on true
  where bst.token = p_token;
$$;

-- ===== Resident notice RPCs =====
create function resident_notices()
returns table (
  id bigint,
  title text,
  notice_type text,
  building_id bigint,
  building_name text,
  published_at timestamptz,
  created_at timestamptz
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
    n.id,
    n.title,
    n.notice_type,
    n.building_id,
    nb.name,
    n.published_at,
    n.created_at
  from linked l
  join notices n
    on n.org_id = l.org_id
   and (n.building_id is null or n.building_id = l.building_id)
  left join buildings nb on nb.id = n.building_id
  where n.published_at is not null
    and n.deleted_at is null
    and (n.expires_at is null or n.expires_at > now())
  order by n.published_at desc;
$$;

create function resident_notice_detail(p_id bigint)
returns table (
  id bigint,
  title text,
  content text,
  notice_type text,
  building_id bigint,
  building_name text,
  published_at timestamptz,
  created_at timestamptz
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
    n.id,
    n.title,
    n.content,
    n.notice_type,
    n.building_id,
    nb.name,
    n.published_at,
    n.created_at
  from linked l
  join notices n
    on n.org_id = l.org_id
   and (n.building_id is null or n.building_id = l.building_id)
  left join buildings nb on nb.id = n.building_id
  where n.id = p_id
    and n.published_at is not null
    and n.deleted_at is null
    and (n.expires_at is null or n.expires_at > now());
$$;

-- ===== Resident profile RPCs =====
create function resident_get_profile()
returns table (
  tenant_name text,
  phone text,
  building_name text,
  unit_no text,
  move_in_date date,
  org_id bigint,
  org_name text,
  transfer_method text,
  bill_delivery text,
  alimtalk_opt_in bool,
  sms_opt_in bool,
  linked_at timestamptz
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
    o.tenant_name,
    o.phone,
    b.name,
    u.unit_no,
    o.move_in_date,
    l.org_id,
    org.name,
    o.transfer_method,
    o.bill_delivery,
    o.alimtalk_opt_in,
    o.sms_opt_in,
    coalesce(rc.resolved_at, rc.created_at)
  from linked l
  join occupancies o on o.id = l.occupancy_id and o.unit_id = l.unit_id
  join units u on u.id = l.unit_id and u.building_id = l.building_id
  join buildings b on b.id = l.building_id and b.org_id = l.org_id
  join organizations org on org.id = l.org_id
  join res_claims rc
    on rc.resident_user_id = auth.uid()
   and rc.status = 'linked'
   and rc.org_id = l.org_id
   and rc.building_id = l.building_id
   and rc.unit_id = l.unit_id
   and rc.occupancy_id = l.occupancy_id
  order by rc.created_at desc, rc.id desc
  limit 1;
$$;

create function resident_set_notify_prefs(
  p_alimtalk boolean default null,
  p_sms boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link record;
begin
  select * into v_link
  from resident_linked_unit();
  if not found then
    raise exception 'linked occupancy not found';
  end if;

  if p_alimtalk is null and p_sms is null then
    return;
  end if;

  update occupancies
  set alimtalk_opt_in = coalesce(p_alimtalk, alimtalk_opt_in),
      sms_opt_in = coalesce(p_sms, sms_opt_in)
  where id = v_link.occupancy_id
    and unit_id = v_link.unit_id;
  if not found then
    raise exception 'linked occupancy not found';
  end if;
end;
$$;

-- ===== RPC privileges =====
revoke execute on function resident_linked_unit() from anon, public;
grant execute on function resident_linked_unit() to authenticated;
revoke execute on function resident_bill_months() from anon, public;
grant execute on function resident_bill_months() to authenticated;
revoke execute on function resident_bill_detail(date) from anon, public;
grant execute on function resident_bill_detail(date) to authenticated;
revoke execute on function resident_get_or_create_bill_token(date) from anon, public;
grant execute on function resident_get_or_create_bill_token(date) to authenticated;
revoke execute on function public_bill_by_token(uuid) from public;
grant execute on function public_bill_by_token(uuid) to anon, authenticated;
revoke execute on function resident_notices() from anon, public;
grant execute on function resident_notices() to authenticated;
revoke execute on function resident_notice_detail(bigint) from anon, public;
grant execute on function resident_notice_detail(bigint) to authenticated;
revoke execute on function resident_get_profile() from anon, public;
grant execute on function resident_get_profile() to authenticated;
revoke execute on function resident_set_notify_prefs(boolean, boolean) from anon, public;
grant execute on function resident_set_notify_prefs(boolean, boolean) to authenticated;
