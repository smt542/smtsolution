-- 0231_partner_complaint_resolution_keep.sql
-- 문제점 개선1차 #9: 파트너가 A/S를 저장하면 사무실 처리 이력이 전부 삭제됨.
-- 기존 partner_update_complaint는 `delete from complaint_resolutions where complaint_id = p_id`로
-- 사무실이 남긴 처리 결과까지 모두 지운 뒤 1건만 다시 넣었고, 감사 로그도 없었다.
--
-- 조치(처리 결과 행은 절대 일괄 삭제하지 않는다):
--  - 처리 결과(p_result_content)가 비어 있으면 complaint_resolutions는 건드리지 않는다.
--  - 최신 처리 결과 행(id desc 1건, partner_get_complaint가 보여주는 행)과 내용이 같으면 그대로 둔다.
--  - 최신 행이 본인(resolved_by = 호출자)이 쓴 것이면 그 행만 갱신한다.
--  - 최신 행이 없거나 다른 사람(사무실 등)이 쓴 것이면 새 행을 추가한다 → 사무실 이력 보존.
--  - audit_log에 COMPLAINT_PARTNER_UPDATE(before/after)를 남긴다(confirm_utilities 등과 같은 형식).
-- 권한 검사·complaints 갱신 본문은 실 DB 정의와 동일. create or replace는 기존 ACL을 유지한다.

create or replace function public.partner_update_complaint(p_id bigint, p_category_id bigint, p_content text, p_status text, p_completed_at timestamp with time zone, p_result_content text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_org bigint;
  v_before jsonb;
  v_res_id bigint;
  v_res_by uuid;
  v_res_content text;
  v_result text := nullif(trim(coalesce(p_result_content, '')), '');
  v_res_action text := 'none';
begin
  if not exists (
    select 1 from complaints c
    where c.id = p_id and c.deleted_at is null
      and c.building_id in (select partner_org_building_ids()) and c.assigned_to = v_uid
  ) then
    raise exception 'forbidden: not your complaint';
  end if;

  select c.org_id,
         jsonb_build_object('category_id', c.category_id, 'content', c.content,
                            'status', c.status, 'completed_at', c.completed_at)
    into v_org, v_before
    from complaints c where c.id = p_id
    for update;

  update complaints set category_id = p_category_id, content = nullif(p_content, ''),
    status = coalesce(nullif(p_status, ''), 'pending'), completed_at = p_completed_at
    where id = p_id;

  if v_result is not null then
    select r.id, r.resolved_by, r.result_content
      into v_res_id, v_res_by, v_res_content
      from complaint_resolutions r
      where r.complaint_id = p_id
      order by r.id desc
      limit 1;

    if v_res_id is not null and v_res_content is not distinct from p_result_content then
      v_res_action := 'unchanged';
    elsif v_res_id is not null and v_res_by = v_uid then
      update complaint_resolutions
        set result_content = p_result_content,
            resolved_at = coalesce(p_completed_at, now())
        where id = v_res_id;
      v_res_action := 'updated';
    else
      insert into complaint_resolutions(complaint_id, result_content, resolved_by, resolved_at)
        values (p_id, p_result_content, v_uid, coalesce(p_completed_at, now()))
        returning id into v_res_id;
      v_res_action := 'inserted';
    end if;
  end if;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
    values (
      v_org,
      v_uid,
      'COMPLAINT_PARTNER_UPDATE',
      'complaints',
      p_id::text,
      v_before,
      jsonb_build_object(
        'category_id', p_category_id,
        'content', nullif(p_content, ''),
        'status', coalesce(nullif(p_status, ''), 'pending'),
        'completed_at', p_completed_at,
        'resolution_action', v_res_action,
        'resolution_id', v_res_id
      )
    );
end
$function$;
