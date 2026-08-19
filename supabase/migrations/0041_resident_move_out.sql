-- Resident move-out requests and resident-facing request RPCs.
-- Depends on 0039 (res_claims) and 0040 (resident_linked_unit).

-- ===== Move-out requests =====
create table move_out_requests (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  resident_user_id uuid not null references auth.users(id) on delete cascade,
  occupancy_id bigint references occupancies(id) on delete set null,
  unit_id bigint references units(id) on delete set null,
  building_id bigint references buildings(id) on delete set null,
  desired_date date not null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'canceled', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canceled_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create unique index move_out_one_pending_per_resident
  on move_out_requests (resident_user_id)
  where status = 'pending';
create index move_out_requests_org_status_idx
  on move_out_requests (org_id, status);
create index move_out_requests_resident_user_idx
  on move_out_requests (resident_user_id);

create trigger trg_move_out_requests_updated
  before update on move_out_requests
  for each row execute function set_updated_at();

-- ===== RLS =====
alter table move_out_requests enable row level security;

create policy move_out_requests_resident_select
  on move_out_requests for select to authenticated
  using (resident_user_id = (select auth.uid()));

create policy move_out_requests_resident_insert
  on move_out_requests for insert to authenticated
  with check (
    resident_user_id = (select auth.uid())
    and status = 'pending'
  );

create policy move_out_requests_resident_update
  on move_out_requests for update to authenticated
  using (
    resident_user_id = (select auth.uid())
    and status = 'pending'
  )
  with check (
    resident_user_id = (select auth.uid())
    and status = 'pending'
  );

create policy move_out_requests_staff_select
  on move_out_requests for select to authenticated
  using (
    org_id in (select my_org_ids())
    and current_user_has_module('tenants')
  );

create policy move_out_requests_staff_update
  on move_out_requests for update to authenticated
  using (
    org_id in (select my_org_ids())
    and current_user_has_module('tenants')
  )
  with check (
    org_id in (select my_org_ids())
    and current_user_has_module('tenants')
  );

create policy move_out_requests_platform_select
  on move_out_requests for select to authenticated
  using (current_user_is_platform_admin());

-- ===== Resident move-out RPCs =====
create function resident_create_move_out(
  p_desired_date date,
  p_reason text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link record;
  v_request_id bigint;
begin
  select * into v_link
  from resident_linked_unit();
  if not found then
    raise exception 'linked occupancy not found';
  end if;
  if p_desired_date is null then
    raise exception 'desired date required' using errcode = '22023';
  end if;
  if exists (
    select 1
    from move_out_requests mor
    where mor.resident_user_id = auth.uid()
      and mor.status = 'pending'
  ) then
    raise exception 'pending move-out request already exists';
  end if;

  insert into move_out_requests (
    org_id,
    resident_user_id,
    occupancy_id,
    unit_id,
    building_id,
    desired_date,
    reason
  ) values (
    v_link.org_id,
    auth.uid(),
    v_link.occupancy_id,
    v_link.unit_id,
    v_link.building_id,
    p_desired_date,
    p_reason
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create function resident_get_move_out()
returns table (
  id bigint,
  desired_date date,
  reason text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  canceled_at timestamptz,
  resolved_at timestamptz
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
    mor.id,
    mor.desired_date,
    mor.reason,
    mor.status,
    mor.created_at,
    mor.updated_at,
    mor.canceled_at,
    mor.resolved_at
  from linked l
  join move_out_requests mor
    on mor.resident_user_id = auth.uid()
   and mor.org_id = l.org_id
   and mor.occupancy_id = l.occupancy_id
   and mor.unit_id = l.unit_id
   and mor.building_id = l.building_id
  order by mor.created_at desc, mor.id desc
  limit 1;
$$;

create function resident_update_move_out(p_desired_date date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_desired_date is null then
    raise exception 'desired date required' using errcode = '22023';
  end if;

  update move_out_requests mor
  set desired_date = p_desired_date
  from resident_linked_unit() l
  where mor.resident_user_id = auth.uid()
    and mor.org_id = l.org_id
    and mor.occupancy_id = l.occupancy_id
    and mor.unit_id = l.unit_id
    and mor.building_id = l.building_id
    and mor.status = 'pending';
  if not found then
    raise exception 'pending move-out request not found';
  end if;
end;
$$;

create function resident_cancel_move_out()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update move_out_requests mor
  set status = 'canceled',
      canceled_at = now()
  from resident_linked_unit() l
  where mor.resident_user_id = auth.uid()
    and mor.org_id = l.org_id
    and mor.occupancy_id = l.occupancy_id
    and mor.unit_id = l.unit_id
    and mor.building_id = l.building_id
    and mor.status = 'pending';
  if not found then
    raise exception 'pending move-out request not found';
  end if;
end;
$$;

-- ===== RPC privileges =====
revoke execute on function resident_create_move_out(date, text) from anon, public;
grant execute on function resident_create_move_out(date, text) to authenticated;
revoke execute on function resident_get_move_out() from anon, public;
grant execute on function resident_get_move_out() to authenticated;
revoke execute on function resident_update_move_out(date) from anon, public;
grant execute on function resident_update_move_out(date) to authenticated;
revoke execute on function resident_cancel_move_out() from anon, public;
grant execute on function resident_cancel_move_out() to authenticated;
