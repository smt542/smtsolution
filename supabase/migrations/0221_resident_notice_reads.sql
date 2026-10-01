-- Resident notice read state, scoped to the authenticated resident and visible notices.

create table public.resident_notice_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  notice_id bigint not null references public.notices(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

create index resident_notice_reads_notice_idx
  on public.resident_notice_reads (notice_id);

alter table public.resident_notice_reads enable row level security;

-- Residents must use the visibility-checked RPCs below rather than accessing this
-- table directly. This also keeps the read history private from other roles.
revoke all on public.resident_notice_reads from public, anon, authenticated;

create or replace function public.resident_mark_notice_read(
  p_notice_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_notice_id is null or auth.uid() is null then
    return;
  end if;

  insert into public.resident_notice_reads (user_id, notice_id, read_at)
  select auth.uid(), n.id, now()
  from public.resident_linked_unit() l
  join public.notices n on n.org_id = l.org_id
  where n.id = p_notice_id
    and n.published_at is not null
    and n.deleted_at is null
    and (n.expires_at is null or n.expires_at > now())
    and (
      not exists (
        select 1
        from public.notice_buildings nb
        where nb.notice_id = n.id
      )
      or exists (
        select 1
        from public.notice_buildings nb
        where nb.notice_id = n.id
          and nb.building_id = l.building_id
      )
    )
  limit 1
  on conflict (user_id, notice_id) do update
    set read_at = excluded.read_at;
end;
$$;

create or replace function public.resident_notice_read_ids()
returns table (notice_id bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with linked as (
    select * from public.resident_linked_unit()
  )
  select r.notice_id
  from public.resident_notice_reads r
  join public.notices n on n.id = r.notice_id
  join linked l on l.org_id = n.org_id
  where r.user_id = auth.uid()
    and n.published_at is not null
    and n.deleted_at is null
    and (n.expires_at is null or n.expires_at > now())
    and (
      not exists (
        select 1
        from public.notice_buildings nb
        where nb.notice_id = n.id
      )
      or exists (
        select 1
        from public.notice_buildings nb
        where nb.notice_id = n.id
          and nb.building_id = l.building_id
      )
    )
  order by r.notice_id;
$$;

revoke execute on function public.resident_mark_notice_read(bigint) from public, anon;
grant execute on function public.resident_mark_notice_read(bigint) to authenticated;
revoke execute on function public.resident_notice_read_ids() from public, anon;
grant execute on function public.resident_notice_read_ids() to authenticated;
