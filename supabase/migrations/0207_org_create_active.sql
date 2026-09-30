-- 0207: 새 조직은 처음부터 운영(active). 체험(trial) 상태를 쓰지 않는다(사용자 결정 09-30, QA W20).
--
-- 통합관리자 정본(admin/tenants)의 조직 상태는 운영·정지·해지뿐이다. 그런데 조직 생성 함수가 새 조직을
-- 'trial'로 넣어, 만든 관리자 계정이 직원 로그인(운영일 때만 허용)을 못 하고 화면에선 운영으로 바꿀 방법도
-- 없었다. 생성 함수와 칼럼 기본값을 'active'로 바꾼다. org_status 타입의 'trial' 값 자체는 남긴다
-- (enum 값 삭제는 타입을 다시 만들어야 하고, 지금 'trial'인 조직은 0개).

create or replace function public.platform_create_organization(p_name text, p_slug text, p_phone text default null::text)
returns organizations
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_org organizations;
begin
  if not current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin only';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  insert into organizations(name, slug, phone, status)
    values (trim(p_name), nullif(lower(trim(p_slug)),''), nullif(trim(p_phone),''), 'active')
    returning * into v_org;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org.id, auth.uid(), 'ORG_CREATE', 'organizations', v_org.id::text,
      jsonb_build_object('name', v_org.name, 'slug', v_org.slug));
  return v_org;
end $$;

alter table public.organizations alter column status set default 'active';
