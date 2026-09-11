-- 0156_delete_unit.sql
-- 호수(세대) 소프트 삭제: 조직 스코프 + tenants 모듈 권한 게이트. units/occupancies/unit_property_listings 를 deleted_at 처리.
create or replace function delete_unit(p_unit_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  select exists(
    select 1 from units u join buildings b on b.id = u.building_id
    where u.id = p_unit_id and b.org_id in (select my_org_ids())
  ) into v_ok;
  if not v_ok then raise exception 'unit not found or not authorized'; end if;
  if not current_user_has_module('tenants') then raise exception 'permission denied'; end if;

  update units                  set deleted_at = now() where id      = p_unit_id and deleted_at is null;
  update occupancies            set deleted_at = now() where unit_id = p_unit_id and deleted_at is null;
  update unit_property_listings set deleted_at = now() where unit_id = p_unit_id and deleted_at is null;
end $$;
revoke execute on function delete_unit(bigint) from public, anon;
grant  execute on function delete_unit(bigint) to authenticated;
