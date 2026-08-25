-- Public notice and moving-settlement share tokens.
-- Depends on 0002 (staff org/module helpers), 0005 (notices),
-- 0008 (moving_settlements), and 0040 (public bill token pattern).

create table public.notice_share_tokens (
  id bigint generated always as identity primary key,
  token uuid not null unique default gen_random_uuid(),
  org_id bigint not null references public.organizations(id) on delete cascade,
  notice_id bigint not null references public.notices(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (notice_id)
);

create table public.settlement_share_tokens (
  id bigint generated always as identity primary key,
  token uuid not null unique default gen_random_uuid(),
  org_id bigint not null references public.organizations(id) on delete cascade,
  settlement_id bigint not null references public.moving_settlements(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (settlement_id)
);

alter table public.notice_share_tokens enable row level security;
alter table public.settlement_share_tokens enable row level security;

-- Direct table access is intentionally unavailable; callers use the RPCs below.
revoke select, insert, update, delete on table public.notice_share_tokens
  from public, anon, authenticated;
revoke select, insert, update, delete on table public.settlement_share_tokens
  from public, anon, authenticated;

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
    now() + interval '1 year'
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
    now() + interval '1 year'
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

create or replace function public.public_notice_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'title', case when nst.expires_at > now() then n.title else null end,
    'content', case when nst.expires_at > now() then n.content else null end,
    'notice_type', case when nst.expires_at > now() then n.notice_type else null end,
    'building_name', case when nst.expires_at > now() then b.name else null end,
    'published_at', case when nst.expires_at > now() then n.published_at else null end,
    'is_expired', nst.expires_at <= now()
  )
  from public.notice_share_tokens nst
  join public.notices n
    on n.id = nst.notice_id
   and n.org_id = nst.org_id
  left join public.buildings b
    on b.id = n.building_id
   and b.org_id = nst.org_id
  where nst.token = p_token;
$$;

create or replace function public.public_settlement_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'move_out_date',
      case when sst.expires_at > now() then s.move_out_date else null end,
    'settlement_kind',
      case
        when sst.expires_at <= now() or s.settlement_amount is null then null
        when s.settlement_amount < 0 then '환급'
        else '추가납부'
      end,
    'settlement_amount',
      case when sst.expires_at > now() then s.settlement_amount else null end,
    'unit_label',
      case
        when sst.expires_at > now()
        then concat_ws(' ', nullif(trim(u.dong), ''), u.unit_no)
        else null
      end,
    'building_name',
      case when sst.expires_at > now() then b.name else null end,
    'is_expired', sst.expires_at <= now()
  )
  from public.settlement_share_tokens sst
  join public.moving_settlements s on s.id = sst.settlement_id
  join public.units u on u.id = s.unit_id
  join public.buildings b
    on b.id = u.building_id
   and b.org_id = sst.org_id
  where sst.token = p_token;
$$;

revoke all on function public.mint_notice_share_token(bigint)
  from public, anon;
grant execute on function public.mint_notice_share_token(bigint)
  to authenticated;

revoke all on function public.mint_settlement_share_token(bigint)
  from public, anon;
grant execute on function public.mint_settlement_share_token(bigint)
  to authenticated;

revoke all on function public.public_notice_by_token(uuid) from public;
grant execute on function public.public_notice_by_token(uuid)
  to anon, authenticated;

revoke all on function public.public_settlement_by_token(uuid) from public;
grant execute on function public.public_settlement_by_token(uuid)
  to anon, authenticated;
