-- 공지 다중 건물 대상: 공지 1건이 여러 건물을 대상으로 지정할 수 있도록 notice_buildings 연결 테이블 도입.
-- 링크 없음 = 전체(org-wide) 공지(현행 notices.building_id null 의미 유지), 링크 있음 = 지정 건물들.
-- 기존 단일 대상 notices.building_id 는 백필 후 레거시로 남긴다(앱은 더 이상 참조하지 않음).

create table if not exists public.notice_buildings (
  notice_id bigint not null references public.notices(id) on delete cascade,
  building_id bigint not null references public.buildings(id) on delete cascade,
  org_id bigint not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (notice_id, building_id)
);

create index if not exists notice_buildings_building_idx on public.notice_buildings (building_id);
create index if not exists notice_buildings_org_idx on public.notice_buildings (org_id);

comment on table public.notice_buildings is
  '공지 대상 건물(다중). 링크가 없으면 전체(org-wide) 공지.';
comment on column public.notices.building_id is
  '[레거시] 단일 대상 건물. 다중 대상은 notice_buildings 로 이관됨. 앱은 참조하지 않는다.';

-- org_id 는 항상 대상 공지의 org 로 강제(앱 입력값과 무관하게 일관성 보장).
create or replace function public.notice_buildings_set_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select n.org_id into new.org_id from public.notices n where n.id = new.notice_id;
  if new.org_id is null then
    raise exception 'notice % not found', new.notice_id;
  end if;
  return new;
end;
$$;

drop trigger if exists notice_buildings_set_org_trg on public.notice_buildings;
create trigger notice_buildings_set_org_trg
  before insert on public.notice_buildings
  for each row execute function public.notice_buildings_set_org();

-- 백필: 기존 단일 대상 공지 → 링크 1건(전체 공지=building_id null 은 링크 없음 유지).
insert into public.notice_buildings (notice_id, building_id, org_id)
select n.id, n.building_id, n.org_id
from public.notices n
where n.building_id is not null
on conflict do nothing;

-- RLS: 소속 org 링크만 접근(notices 와 동일 org 스코프).
alter table public.notice_buildings enable row level security;

drop policy if exists notice_buildings_all on public.notice_buildings;
create policy notice_buildings_all on public.notice_buildings
  for all
  using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));

revoke all on public.notice_buildings from anon;
grant select, insert, update, delete on public.notice_buildings to authenticated;

-- 전환기 호환: 레거시 경로가 notices.building_id(단일/전체)로 대상을 쓰면 링크와 동기화한다.
-- 신버전 경로는 building_id를 SET하지 않으므로(트리거 미발화) 다중 링크가 보존된다.
create or replace function public.notices_sync_building_link()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.building_id is not distinct from old.building_id then
    return new; -- building_id 변경 없음(신버전 경로): 링크 미변경
  end if;
  delete from public.notice_buildings where notice_id = new.id;
  if new.building_id is not null then
    insert into public.notice_buildings (notice_id, building_id, org_id)
    values (new.id, new.building_id, new.org_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists notices_sync_building_link_trg on public.notices;
create trigger notices_sync_building_link_trg
  after insert or update of building_id on public.notices
  for each row execute function public.notices_sync_building_link();

-- ===== 세입자/공개 조회 RPC: 대상 스코프를 notice_buildings 기준으로 재정의 =====

-- 목록: 세입자가 볼 수 있는 공지 = 전체 공지(링크 없음) 또는 본인 건물이 대상에 포함된 공지.
create or replace function public.resident_notices()
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
    case when exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
         then l.building_id else null end,
    case when exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
         then lb.name else null end,
    n.published_at,
    n.created_at
  from linked l
  join notices n
    on n.org_id = l.org_id
  left join buildings lb on lb.id = l.building_id
  where n.published_at is not null
    and n.deleted_at is null
    and (n.expires_at is null or n.expires_at > now())
    and (
      not exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
      or exists (select 1 from notice_buildings nb
                 where nb.notice_id = n.id and nb.building_id = l.building_id)
    )
  order by n.published_at desc;
$$;

-- 상세: 동일 스코프 + content_json(0158) 반환 유지.
create or replace function public.resident_notice_detail(p_id bigint)
returns table (
  id bigint,
  title text,
  content text,
  content_json jsonb,
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
    n.content_json,
    n.notice_type,
    case when exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
         then l.building_id else null end,
    case when exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
         then lb.name else null end,
    n.published_at,
    n.created_at
  from linked l
  join notices n
    on n.org_id = l.org_id
  left join buildings lb on lb.id = l.building_id
  where n.id = p_id
    and n.published_at is not null
    and n.deleted_at is null
    and (n.expires_at is null or n.expires_at > now())
    and (
      not exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
      or exists (select 1 from notice_buildings nb
                 where nb.notice_id = n.id and nb.building_id = l.building_id)
    );
$$;

revoke execute on function public.resident_notice_detail(bigint) from anon, public;
grant execute on function public.resident_notice_detail(bigint) to authenticated;

-- 공유 링크 공개: 대상 건물이 정확히 1곳이면 그 건물명, 그 외(전체/다중)는 null.
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
    'content_json', case when nst.expires_at > now() then n.content_json else null end,
    'notice_type', case when nst.expires_at > now() then n.notice_type else null end,
    'building_name', case when nst.expires_at > now() then (
        select case when count(*) = 1 then max(b.name) else null end
        from public.notice_buildings nb
        join public.buildings b on b.id = nb.building_id
        where nb.notice_id = n.id
      ) else null end,
    'published_at', case when nst.expires_at > now() then n.published_at else null end,
    'is_expired', nst.expires_at <= now()
  )
  from public.notice_share_tokens nst
  join public.notices n
    on n.id = nst.notice_id
   and n.org_id = nst.org_id
  where nst.token = p_token;
$$;

revoke all on function public.public_notice_by_token(uuid) from public;
grant execute on function public.public_notice_by_token(uuid) to anon, authenticated;
