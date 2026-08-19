-- O1: resident Kakao identities, occupancy claims, and onboarding RPCs.
-- Depends on 0000 (auth/RLS helpers), 0001 (buildings/units/occupancies),
-- 0002 (current_user_org/current_user_has_module), and 0011 (platform admin helper).

-- ===== Tables =====
create table resident_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kakao_id text not null unique,
  kakao_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table res_claims (
  id bigint generated always as identity primary key,
  org_id bigint references organizations(id) on delete cascade,
  resident_user_id uuid not null references auth.users(id) on delete cascade,
  kakao_id text,
  kakao_name text,
  claimed_name text,
  claimed_phone text,
  building_id bigint references buildings(id) on delete set null,
  unit_id bigint references units(id) on delete set null,
  claimed_unit_text text,
  occupancy_id bigint references occupancies(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'linked', 'rejected')),
  kind text not null
    check (kind in ('auto', 'manual', 'search')),
  memo text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index res_claims_resident_user_idx on res_claims (resident_user_id);
create index res_claims_org_idx on res_claims (org_id);
create index res_claims_status_idx on res_claims (status);
create unique index res_claims_one_linked_per_resident_idx
  on res_claims (resident_user_id) where status = 'linked';
create unique index res_claims_one_pending_per_resident_idx
  on res_claims (resident_user_id) where status = 'pending';

-- ===== RLS =====
alter table resident_identities enable row level security;
alter table res_claims enable row level security;

create policy resident_identities_self_select
  on resident_identities for select to authenticated
  using (user_id = (select auth.uid()));

create policy res_claims_resident_select
  on res_claims for select to authenticated
  using (resident_user_id = (select auth.uid()));
create policy res_claims_resident_insert
  on res_claims for insert to authenticated
  with check (
    resident_user_id = (select auth.uid())
    and exists (
      select 1 from resident_identities ri
      where ri.user_id = (select auth.uid())
    )
    and status = 'pending'
  );
create policy res_claims_staff_select
  on res_claims for select to authenticated
  using (org_id in (select my_org_ids()));
create policy res_claims_staff_write
  on res_claims for all to authenticated
  using (
    org_id in (select my_org_ids())
    and current_user_has_module('tenants')
  )
  with check (
    org_id in (select my_org_ids())
    and current_user_has_module('tenants')
  );
create policy res_claims_platform_select
  on res_claims for select to authenticated
  using (current_user_is_platform_admin());

-- ===== Resident RPCs =====
create function resident_automatch()
returns table (
  org_id bigint,
  building_id bigint,
  building_name text,
  unit_id bigint,
  unit_no text,
  occupancy_id bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select b.org_id, b.id, b.name, u.id, u.unit_no, o.id
  from resident_identities ri
  join occupancies o
    on o.phone = ri.phone
   and o.phone is not null
   and o.status = 'occupied'
   and o.deleted_at is null
  join units u
    on u.id = o.unit_id
   and u.deleted_at is null
  join buildings b
    on b.id = u.building_id
   and b.deleted_at is null
  where ri.user_id = auth.uid()
  order by b.name, u.unit_no, o.id;
end
$$;

create function resident_confirm(p_occupancy_id bigint)
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
    and o.phone = v_identity.phone
    and o.phone is not null
    and o.status = 'occupied'
    and o.deleted_at is null;
  if not found then
    raise exception 'occupancy does not match resident phone';
  end if;

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

create function resident_request_claim(p_building_id bigint, p_unit_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity resident_identities%rowtype;
  v_org_id bigint;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_unit_text, '')), '') is null then
    raise exception 'unit text required';
  end if;

  select * into v_identity
  from resident_identities
  where user_id = auth.uid();
  if not found then
    raise exception 'resident identity not found';
  end if;

  select org_id into v_org_id
  from buildings
  where id = p_building_id and deleted_at is null;
  if not found then
    raise exception 'building not found';
  end if;

  insert into res_claims (
    org_id, resident_user_id, kakao_id, kakao_name,
    claimed_name, claimed_phone, building_id, claimed_unit_text,
    status, kind
  ) values (
    v_org_id, auth.uid(), v_identity.kakao_id, v_identity.kakao_name,
    v_identity.kakao_name, v_identity.phone, p_building_id, btrim(p_unit_text),
    'pending', 'manual'
  );
end
$$;

create function resident_my_link()
returns table (
  claim_id bigint,
  org_id bigint,
  building_id bigint,
  building_name text,
  unit_id bigint,
  unit_no text,
  occupancy_id bigint,
  tenant_name text,
  occupancy_phone text,
  linked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select
    rc.id,
    rc.org_id,
    rc.building_id,
    b.name,
    rc.unit_id,
    u.unit_no,
    rc.occupancy_id,
    o.tenant_name,
    o.phone,
    coalesce(rc.resolved_at, rc.created_at)
  from res_claims rc
  left join buildings b on b.id = rc.building_id
  left join units u on u.id = rc.unit_id
  left join occupancies o on o.id = rc.occupancy_id
  where rc.resident_user_id = auth.uid()
    and rc.status = 'linked'
  order by rc.created_at desc
  limit 1;
end
$$;

-- ===== Staff RPCs =====
create function list_res_claims(p_status text default null)
returns table (
  claim_id bigint,
  org_id bigint,
  resident_user_id uuid,
  kakao_id text,
  kakao_name text,
  resident_phone text,
  claimed_name text,
  claimed_phone text,
  building_id bigint,
  building_name text,
  unit_id bigint,
  unit_no text,
  claimed_unit_text text,
  occupancy_id bigint,
  occupancy_tenant_name text,
  occupancy_phone text,
  status text,
  kind text,
  memo text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id bigint;
begin
  v_org_id := current_user_org();
  if v_org_id is null then
    raise exception 'no org for caller' using errcode = '42501';
  end if;
  if not current_user_has_module('tenants') then
    raise exception 'forbidden: tenants required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('pending', 'linked', 'rejected') then
    raise exception 'invalid claim status' using errcode = '22023';
  end if;

  return query
  select
    rc.id,
    rc.org_id,
    rc.resident_user_id,
    rc.kakao_id,
    rc.kakao_name,
    ri.phone,
    rc.claimed_name,
    rc.claimed_phone,
    rc.building_id,
    b.name,
    rc.unit_id,
    u.unit_no,
    rc.claimed_unit_text,
    rc.occupancy_id,
    o.tenant_name,
    o.phone,
    rc.status,
    rc.kind,
    rc.memo,
    rc.created_at,
    rc.resolved_at,
    rc.resolved_by
  from res_claims rc
  left join resident_identities ri on ri.user_id = rc.resident_user_id
  left join buildings b on b.id = rc.building_id
  left join units u on u.id = rc.unit_id
  left join occupancies o on o.id = rc.occupancy_id
  where rc.org_id = v_org_id
    and (p_status is null or rc.status = p_status)
  order by rc.created_at desc, rc.id desc;
end
$$;

create function approve_res_claim(p_claim_id bigint, p_occupancy_id bigint)
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

create function reject_res_claim(p_claim_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id bigint;
  v_claim res_claims%rowtype;
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

  update res_claims
  set status = 'rejected',
      resolved_at = now(),
      resolved_by = auth.uid()
  where id = p_claim_id;

  insert into audit_log (org_id, actor_id, action, table_name, row_pk, before, after)
  values (
    v_org_id,
    auth.uid(),
    'CLAIM_REJECT',
    'res_claims',
    p_claim_id::text,
    jsonb_build_object('status', v_claim.status),
    jsonb_build_object('status', 'rejected')
  );
end
$$;

-- ===== RPC privileges =====
revoke execute on function resident_automatch() from anon, public;
grant execute on function resident_automatch() to authenticated;
revoke execute on function resident_confirm(bigint) from anon, public;
grant execute on function resident_confirm(bigint) to authenticated;
revoke execute on function resident_request_claim(bigint, text) from anon, public;
grant execute on function resident_request_claim(bigint, text) to authenticated;
revoke execute on function resident_my_link() from anon, public;
grant execute on function resident_my_link() to authenticated;
revoke execute on function list_res_claims(text) from anon, public;
grant execute on function list_res_claims(text) to authenticated;
revoke execute on function approve_res_claim(bigint, bigint) from anon, public;
grant execute on function approve_res_claim(bigint, bigint) to authenticated;
revoke execute on function reject_res_claim(bigint) from anon, public;
grant execute on function reject_res_claim(bigint) to authenticated;

-- ===== Resident building search (manual claim: resident is not org-scoped, so buildings RLS does not apply) =====
create function resident_search_buildings(p_q text default null)
returns table (
  building_id bigint,
  org_id bigint,
  name text,
  address text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.org_id, b.name, b.address
  from buildings b
  where b.deleted_at is null
    and (
      nullif(btrim(coalesce(p_q, '')), '') is null
      or b.name ilike '%' || btrim(p_q) || '%'
      or b.address ilike '%' || btrim(p_q) || '%'
    )
  order by b.name
  limit 50;
$$;
revoke execute on function resident_search_buildings(text) from anon, public;
grant execute on function resident_search_buildings(text) to authenticated;
