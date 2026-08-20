-- 0071_partner_complaints.sql
-- 파트너 모바일 AS: 유형목록·상세조회·신규접수·수정·삭제.
-- 담당 건물(partner_my_building_ids, 0062) 스코프 + 수정/삭제는 본인 담당(assigned_to)만.
-- 의존: 0062, 0002(current_user_org), 0003(as_categories), 0005(complaints/complaint_resolutions).
-- 기존 staff 객체·RLS 불변, 신규 함수만.

-- AS 유형(카테고리) 목록
create or replace function partner_list_as_categories()
returns table (id bigint, label text)
language sql stable security definer set search_path = public as $$
  select c.id, c.label
  from as_categories c
  where c.org_id = current_user_org() and c.deleted_at is null
  order by c.sort_order, c.label;
$$;
revoke execute on function partner_list_as_categories() from anon;

-- AS 상세
create or replace function partner_get_complaint(p_id bigint)
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
    and c.building_id in (select partner_my_building_ids());
$$;
revoke execute on function partner_get_complaint(bigint) from anon;

-- 신규 접수(담당 건물만, 접수자·담당자 = 호출자)
create or replace function partner_create_complaint(
  p_building_id bigint, p_unit_id bigint, p_category_id bigint,
  p_content text, p_status text, p_completed_at timestamptz,
  p_result_content text, p_reporter_phone text
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_id bigint; v_uid uuid := (select auth.uid());
begin
  if p_building_id not in (select partner_my_building_ids()) then
    raise exception 'forbidden: not your building';
  end if;
  select org_id into v_org from buildings where id = p_building_id;
  insert into complaints(org_id, building_id, unit_id, category_id, title, content, status,
                         reporter_phone, assigned_to, created_by, received_at, completed_at)
    values (v_org, p_building_id, p_unit_id, p_category_id,
            coalesce(nullif(left(regexp_replace(coalesce(p_content, ''), E'\\n.*', ''), 60), ''), '현장 접수'),
            nullif(p_content, ''), coalesce(nullif(p_status, ''), 'pending'),
            nullif(p_reporter_phone, ''), v_uid, v_uid, now(), p_completed_at)
    returning id into v_id;
  if nullif(trim(coalesce(p_result_content, '')), '') is not null then
    insert into complaint_resolutions(complaint_id, result_content, resolved_by, resolved_at)
      values (v_id, p_result_content, v_uid, coalesce(p_completed_at, now()));
  end if;
  return v_id;
end $$;
revoke execute on function partner_create_complaint(bigint,bigint,bigint,text,text,timestamptz,text,text) from anon;

-- 수정(본인 담당건만)
create or replace function partner_update_complaint(
  p_id bigint, p_category_id bigint, p_content text, p_status text,
  p_completed_at timestamptz, p_result_content text
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from complaints c
    where c.id = p_id and c.deleted_at is null
      and c.building_id in (select partner_my_building_ids()) and c.assigned_to = v_uid
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
end $$;
revoke execute on function partner_update_complaint(bigint,bigint,text,text,timestamptz,text) from anon;

-- 삭제(본인 담당건만, soft)
create or replace function partner_delete_complaint(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from complaints c
    where c.id = p_id and c.deleted_at is null
      and c.building_id in (select partner_my_building_ids()) and c.assigned_to = v_uid
  ) then
    raise exception 'forbidden: not your complaint';
  end if;
  update complaints set deleted_at = now() where id = p_id;
end $$;
revoke execute on function partner_delete_complaint(bigint) from anon;
