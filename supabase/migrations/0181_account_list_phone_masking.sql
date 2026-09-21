-- 0181: 계정 목록(직원·통합관리자)의 연락처를 서버에서 마스킹한다.
--
-- 지금까지 이 두 목록은 응답에 원문을 담고 화면에서만 별표로 가렸다. 개발자도구를 열면
-- 조직 전원의 연락처가 한 번에 보였다. 서버에서 잘라 내려 대량 수집 표면을 없앤다.
--
-- 선행 조건 두 가지가 이미 갖춰졌기에 지금 적용할 수 있다.
--  1) 편집 폼이 목록 행의 번호를 재사용하지 않고 /api/pii/reveal 로 원문을 따로 받는다.
--     (그 전에 마스킹하면 admin_update_member_basic·platform_update_account 가 값을 직접
--      대입하므로 DB에 마스킹 문자열이 저장돼 원문이 파괴된다.)
--  2) 발송은 0180 에서 서버가 ref 의 id 로 번호를 해석한다. 목록 번호에 의존하지 않는다.
--
-- 검색 조건(where 절)은 원문 컬럼을 그대로 비교하므로 번호로 찾는 기능은 그대로 동작한다.
-- 마스킹은 select 목록에만 적용한다.

create or replace function list_accounts(p_search text default null, p_type staff_type default null)
returns table (user_id uuid, username text, full_name text, phone text, phone_sub text,
               role org_member_role, staff_type staff_type, affiliation text, is_active boolean,
               permissions jsonb, role_labels text[], staff_capabilities jsonb)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.full_name,
         public.mask_phone(p.phone), public.mask_phone(p.phone_sub),
         m.role, m.staff_type, m.affiliation, p.is_active,
         coalesce(m.feature_permissions,'[]'::jsonb),
         coalesce(array_agg(sr.label order by sr.sort_order) filter (where sr.id is not null), '{}'),
         coalesce(m.staff_capabilities, '[]'::jsonb)
  from org_members m
  join profiles p on p.user_id = m.user_id
  left join org_member_roles omr on omr.user_id = m.user_id and omr.org_id = m.org_id
  left join staff_roles sr on sr.id = omr.role_id and sr.deleted_at is null
  where m.org_id = current_user_org()
    and (p_type is null or m.staff_type = p_type)
    and (p_search is null or p.full_name ilike '%'||p_search||'%'
         or p.username ilike '%'||p_search||'%'
         or p.phone ilike '%'||p_search||'%' or p.phone_sub ilike '%'||p_search||'%')
  group by p.user_id, p.username, p.full_name, p.phone, p.phone_sub,
           m.role, m.staff_type, m.affiliation, p.is_active, m.feature_permissions, m.staff_capabilities
  order by p.full_name
$$;

create or replace function public.platform_list_accounts(
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  org_id bigint,
  organization_name text,
  user_id uuid,
  username text,
  full_name text,
  phone text,
  memo text,
  role public.org_member_role,
  staff_type public.staff_type,
  feature_permissions jsonb,
  is_active boolean,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'limit must be between 1 and 100' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'offset must be zero or greater' using errcode = '22023';
  end if;

  return query
  select
    member.org_id,
    organization.name,
    member.user_id,
    profile.username,
    profile.full_name,
    public.mask_phone(profile.phone),
    member.memo,
    member.role,
    member.staff_type,
    member.feature_permissions,
    profile.is_active,
    member.created_at,
    count(*) over ()::bigint
  from public.org_members member
  join public.organizations organization on organization.id = member.org_id
  left join public.profiles profile on profile.user_id = member.user_id
  where nullif(btrim(coalesce(p_search, '')), '') is null
    or organization.name ilike '%' || btrim(p_search) || '%'
    or profile.full_name ilike '%' || btrim(p_search) || '%'
    or profile.username ilike '%' || btrim(p_search) || '%'
    or coalesce(profile.phone, '') ilike '%' || btrim(p_search) || '%'
    or coalesce(member.memo, '') ilike '%' || btrim(p_search) || '%'
  order by member.created_at desc, member.org_id, member.user_id
  limit p_limit
  offset p_offset;
end
$$;
