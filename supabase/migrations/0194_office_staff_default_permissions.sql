-- 사무실 직원은 수납관리·민원접수 화면 권한(payment·complaints)을 항상 가진다.
--
-- 계정 등록·수정 모달에서 두 권한 칩이 빠져(정본 정합 b63269da) 새 사무실 계정은 이 화면을
-- 열 수 없었다. 칩은 되살리지 않고 DB가 채운다. 등록(provision_member)·권한 저장
-- (admin_set_member_permissions)·통합관리자 콘솔 등 어느 경로로 저장해도 트리거가 다시 넣으므로
-- 회수되지 않는다(콘솔에서 체크를 꺼도 저장하면 다시 켜진다).
-- 사무실 직원 = staff_type 이 manager_staff 이거나 겸직 capability 에 manager_staff 가 있는 계정.

create or replace function public.trg_office_default_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.staff_type = 'manager_staff' or new.staff_capabilities ? 'manager_staff' then
    new.feature_permissions := coalesce(new.feature_permissions, '[]'::jsonb);
    if not new.feature_permissions ? 'payment' then
      new.feature_permissions := new.feature_permissions || '["payment"]'::jsonb;
    end if;
    if not new.feature_permissions ? 'complaints' then
      new.feature_permissions := new.feature_permissions || '["complaints"]'::jsonb;
    end if;
  end if;
  return new;
end
$$;

revoke all on function public.trg_office_default_permissions()
  from public, anon, authenticated;

drop trigger if exists trg_org_members_office_default_permissions on public.org_members;
create trigger trg_org_members_office_default_permissions
  before insert or update of feature_permissions, staff_type, staff_capabilities
  on public.org_members
  for each row execute function public.trg_office_default_permissions();

-- 기존 사무실 계정 백필: 같은 값을 다시 써서 위 트리거가 채우게 한다.
update public.org_members
   set feature_permissions = feature_permissions
 where (staff_type = 'manager_staff' or staff_capabilities ? 'manager_staff')
   and not (coalesce(feature_permissions, '[]'::jsonb) ?& array['payment', 'complaints']);
