-- 현장 앱 A/S 현황을 같은 회사(조직)의 현장 파트너끼리 공유한다(2026-10-02 고객 결정, 2차 QA 현장 2).
--
-- 목록·상세가 partner_my_building_ids()(내가 관리·검침·청소 담당인 건물)의 A/S만 돌려줘서
-- 담당 건물이 다른 파트너가 접수한 A/S는 서로 보이지 않았다.
--   - 목록 partner_list_complaints · 상세 partner_get_complaint: 소속 조직 건물 전체의 A/S.
--   - 수정 partner_update_complaint · 삭제 partner_delete_complaint: 본인 담당(assigned_to)만은 그대로,
--     건물 조건만 조직 전체로 맞춘다(담당 건물 밖에서 나에게 배정된 A/S도 목록에 '내 담당'으로 보이므로).
--   - 신규 접수 partner_create_complaint와 조회·검침·이사정산은 담당 건물 범위 그대로.
-- 본문은 운영 DB 정의(0115 페이지 커서판 포함)에서 범위 조건만 바꿨다. 0115 파일은 저장소에 없어
-- 0062의 인자 없는 partner_list_complaints()가 새로 구축한 DB에 남지 않게 먼저 지운다(운영엔 이미 없음).

-- 내가 현장 파트너(field_staff·support_staff)로 속한 조직의 건물 전체
create or replace function public.partner_org_building_ids()
returns setof bigint
language sql stable security definer set search_path = '' as $$
  select building.id
  from public.buildings building
  join public.org_members member
    on member.org_id = building.org_id
   and member.user_id = (select auth.uid())
  join public.organizations organization
    on organization.id = member.org_id
   and organization.status = 'active'
  join public.profiles profile
    on profile.user_id = member.user_id
   and profile.is_active
  where building.deleted_at is null
    and member.staff_capabilities ?| array['field_staff', 'support_staff'];
$$;
revoke execute on function public.partner_org_building_ids() from public, anon;
grant execute on function public.partner_org_building_ids() to authenticated;

drop function if exists public.partner_list_complaints();

create or replace function public.partner_list_complaints(
  p_before_received_at timestamptz default null,
  p_before_id bigint default null,
  p_status text default null,
  p_search text default null,
  p_sort_direction text default 'desc',
  p_limit integer default 40
)
returns table (
  id bigint,
  building_id bigint,
  building_name text,
  unit_label text,
  category_label text,
  title text,
  content text,
  status text,
  received_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid,
  assigned_name text,
  is_mine boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_sort_direction text := lower(btrim(coalesce(p_sort_direction, '')));
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'limit must be between 1 and 100' using errcode = '22023';
  end if;
  if (p_before_received_at is null) <> (p_before_id is null) then
    raise exception 'cursor timestamp and id must be provided together' using errcode = '22023';
  end if;
  if v_sort_direction not in ('asc', 'desc') then
    raise exception 'sort direction must be asc or desc' using errcode = '22023';
  end if;

  return query
  select
    complaint.id,
    complaint.building_id,
    building.name,
    nullif(trim(coalesce(unit.dong, '') || ' ' || coalesce(unit.unit_no, '')), ''),
    category.label,
    complaint.title,
    complaint.content,
    complaint.status,
    complaint.received_at,
    complaint.completed_at,
    complaint.assigned_to,
    assignee.full_name,
    complaint.assigned_to = (select auth.uid())
  from public.complaints complaint
  join public.buildings building on building.id = complaint.building_id
  left join public.units unit
    on unit.id = complaint.unit_id
   and unit.building_id = complaint.building_id
  left join public.as_categories category on category.id = complaint.category_id
  left join public.profiles assignee on assignee.user_id = complaint.assigned_to
  where complaint.deleted_at is null
    and complaint.building_id in (select public.partner_org_building_ids())
    and (v_status is null or complaint.status = v_status)
    and (
      v_search is null
      or strpos(
        lower(concat_ws(
          ' ',
          building.name,
          nullif(trim(coalesce(unit.dong, '') || ' ' || coalesce(unit.unit_no, '')), ''),
          complaint.content,
          category.label
        )),
        lower(v_search)
      ) > 0
    )
    and (
      p_before_received_at is null
      or (
        v_sort_direction = 'desc'
        and (complaint.received_at, complaint.id) < (p_before_received_at, p_before_id)
      )
      or (
        v_sort_direction = 'asc'
        and (complaint.received_at, complaint.id) > (p_before_received_at, p_before_id)
      )
    )
  order by
    case when v_sort_direction = 'asc' then complaint.received_at end asc,
    case when v_sort_direction = 'asc' then complaint.id end asc,
    case when v_sort_direction = 'desc' then complaint.received_at end desc,
    case when v_sort_direction = 'desc' then complaint.id end desc
  limit p_limit;
end
$$;
revoke execute on function public.partner_list_complaints(timestamptz, bigint, text, text, text, integer) from public, anon;
grant execute on function public.partner_list_complaints(timestamptz, bigint, text, text, text, integer) to authenticated;

create or replace function public.partner_get_complaint(p_id bigint)
returns table (
  id bigint, building_id bigint, building_name text, unit_id bigint, unit_label text,
  category_id bigint, category_label text, content text, status text,
  reporter_phone text, logger_name text, assigned_to uuid, assigned_name text,
  received_at timestamptz, completed_at timestamptz, result_content text, is_mine boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.building_id, b.name, c.unit_id,
    nullif(trim(coalesce(u.dong, '') || ' ' || coalesce(u.unit_no, '')), ''),
    c.category_id, cat.label, c.content, c.status,
    c.reporter_phone, lp.full_name, c.assigned_to, ap.full_name,
    c.received_at, c.completed_at,
    (select r.result_content from complaint_resolutions r where r.complaint_id = c.id order by r.id desc limit 1),
    (c.assigned_to = (select auth.uid()))
  from complaints c
  join buildings b on b.id = c.building_id
  left join units u on u.id = c.unit_id
  left join as_categories cat on cat.id = c.category_id
  left join profiles lp on lp.user_id = c.created_by
  left join profiles ap on ap.user_id = c.assigned_to
  where c.id = p_id and c.deleted_at is null
    and c.building_id in (select partner_org_building_ids());
$$;
revoke execute on function public.partner_get_complaint(bigint) from public, anon;
grant execute on function public.partner_get_complaint(bigint) to authenticated;

create or replace function public.partner_update_complaint(
  p_id bigint, p_category_id bigint, p_content text, p_status text,
  p_completed_at timestamptz, p_result_content text
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from complaints c
    where c.id = p_id and c.deleted_at is null
      and c.building_id in (select partner_org_building_ids()) and c.assigned_to = v_uid
  ) then
    raise exception 'forbidden: not your complaint';
  end if;
  update complaints set category_id = p_category_id, content = nullif(p_content, ''),
    status = coalesce(nullif(p_status, ''), 'pending'), completed_at = p_completed_at
    where id = p_id;
  delete from complaint_resolutions where complaint_id = p_id;
  if nullif(trim(coalesce(p_result_content, '')), '') is not null then
    insert into complaint_resolutions(complaint_id, result_content, resolved_by, resolved_at)
      values (p_id, p_result_content, v_uid, coalesce(p_completed_at, now()));
  end if;
end
$$;
revoke execute on function public.partner_update_complaint(bigint, bigint, text, text, timestamptz, text) from public, anon;
grant execute on function public.partner_update_complaint(bigint, bigint, text, text, timestamptz, text) to authenticated;

create or replace function public.partner_delete_complaint(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from complaints c
    where c.id = p_id and c.deleted_at is null
      and c.building_id in (select partner_org_building_ids()) and c.assigned_to = v_uid
  ) then
    raise exception 'forbidden: not your complaint';
  end if;
  update complaints set deleted_at = now() where id = p_id;
end
$$;
revoke execute on function public.partner_delete_complaint(bigint) from public, anon;
grant execute on function public.partner_delete_complaint(bigint) to authenticated;
