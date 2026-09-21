-- 0178: admin_set_member_permissions 오버로드 모호성 해소 + 두 본문 병합
--
-- (1) 모호성 — /staff/accounts 권한 저장이 라이브에서 깨져 있었다.
-- 0002가 5-arg를 만들고, 0034가 그것을 drop한 뒤 p_target_org_id(기본값 null)를 더한
-- 6-arg로 옮겼다. 그런데 0148이 5-arg를 `create or replace`로 되살렸다. 시그니처가
-- 다르면 replace가 아니라 새 오버로드 생성이므로 둘이 공존하게 됐고, 6-arg의
-- p_target_org_id에 기본값이 있어 앱의 5-key 호출
-- (hooks/reactquery/accounts/apis.ts 의 updatePermissions)이 두 후보를 모두 만족했다.
-- PostgREST는 인수 이름 집합으로 함수를 고르므로 PGRST203(HTTP 300)으로 거부했다.
--
-- (2) 본문 분기 — 되살아난 5-arg와 살아남은 6-arg가 서로 다른 것을 하나씩 갖고 있다.
--   6-arg(0034): platform_admin 자가승격·임의강등 차단 가드 O / staff_capabilities 정규화 X
--   5-arg(0148): platform_admin 가드 X / staff_capabilities 정규화 O
-- 5-arg를 지우기만 하면 겸직 capabilities 정규화가 사라지므로, 6-arg에 그 한 줄을
-- 병합한 뒤 5-arg를 제거한다. 5-key 호출은 p_target_org_id가 기본값 null로 채워져
-- 기존 staff 경로를 그대로 탄다(앱 코드 변경 불필요).

create or replace function admin_set_member_permissions(
  p_user_id uuid, p_role org_member_role, p_staff_type staff_type,
  p_permissions jsonb, p_role_ids bigint[], p_target_org_id bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_other_masters int; v_is_pa boolean;
begin
  v_is_pa := current_user_is_platform_admin();
  if v_is_pa and p_target_org_id is not null then
    v_org := p_target_org_id;                 -- platform_admin cross-org
  else
    if not current_user_is_master() then raise exception 'forbidden: master only'; end if;
    v_org := current_user_org();              -- 기존 staff 경로
  end if;
  -- platform_admin 부여/해제는 platform_admin만 가능(자가승격·임의 강등 차단)
  if not v_is_pa and (
    p_role = 'platform_admin'
    or exists (
      select 1 from org_members
      where user_id = p_user_id and org_id = v_org and role = 'platform_admin'
    )
  ) then
    raise exception 'forbidden: platform_admin role changes require platform_admin';
  end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  -- 최소 1 마스터 유지(본인 강등 방지)
  if p_user_id = auth.uid() and p_role not in ('org_owner','platform_admin') then
    select count(*) into v_other_masters from org_members
      where org_id = v_org and role in ('org_owner','platform_admin') and user_id <> p_user_id;
    if v_other_masters = 0 then raise exception 'must keep at least one master'; end if;
  end if;
  update org_members set role = p_role, staff_type = p_staff_type,
    feature_permissions = coalesce(p_permissions,'[]'::jsonb),
    -- 0148에서 5-arg에만 들어갔던 겸직 capabilities 정규화를 여기로 옮긴다.
    staff_capabilities = normalize_staff_capabilities(staff_capabilities, p_staff_type)
    where user_id = p_user_id and org_id = v_org;
  if p_role_ids is not null then
    delete from org_member_roles where user_id = p_user_id and org_id = v_org;
    insert into org_member_roles(org_id,user_id,role_id) select v_org,p_user_id,unnest(p_role_ids); end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PERMISSION_CHANGE', 'org_members', p_user_id::text,
      jsonb_build_object('role',p_role,'staff_type',p_staff_type,'permissions',p_permissions));
end $$;

-- 되살아난 5-arg 제거. 이것이 모호성의 원인이다.
drop function if exists admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[]);

revoke execute on function admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[],bigint)
  from public, anon;
grant execute on function admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[],bigint)
  to authenticated;
