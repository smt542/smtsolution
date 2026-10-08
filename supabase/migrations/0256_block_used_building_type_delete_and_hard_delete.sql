-- 0256: 건물 유형 물리삭제 서버 차단 + 건물·세대 직접 물리삭제(DELETE) 차단
-- 정책: 항목등록 관리 45행(사용 중 유형 삭제 차단), 건물 상세 53행·입주자 상세 75행(과거 데이터 보존)
-- 앱은 건물·세대를 soft_delete_*로만 삭제하므로 DELETE 정책을 두지 않는다.
begin;

create or replace function public.guard_building_type_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 테넌트 완전삭제(platform_purge_organization)는 허용된 예외
  if current_setting('app.purge_org_id', true) = old.org_id::text then
    return old;
  end if;
  if exists (select 1 from buildings where type_id = old.id)
     or exists (
       select 1 from fee_item_charges fic
       join fee_items fi on fi.id = fic.fee_item_id
       where fi.type_id = old.id
     ) then
    raise exception '건물 또는 부과 내역에 사용 중인 유형은 삭제할 수 없습니다.' using errcode = '23503';
  end if;
  return old;
end $$;

drop trigger if exists trg_building_types_guard_delete on public.building_types;
create trigger trg_building_types_guard_delete
  before delete on public.building_types
  for each row execute function public.guard_building_type_delete();

-- buildings: FOR ALL -> INSERT + UPDATE (DELETE 없음)
drop policy if exists bld_write on public.buildings;
create policy bld_insert on public.buildings for insert to authenticated
  with check ((org_id in (select my_org_ids())) and (select current_user_is_office_staff()) and (select current_user_has_module('buildings'::text)));
create policy bld_update on public.buildings for update to authenticated
  using ((org_id in (select my_org_ids())) and (select current_user_is_office_staff()) and (select current_user_has_module('buildings'::text)))
  with check ((org_id in (select my_org_ids())) and (select current_user_is_office_staff()) and (select current_user_has_module('buildings'::text)));

-- units: FOR ALL -> INSERT + UPDATE (DELETE 없음)
drop policy if exists unit_write on public.units;
create policy unit_insert on public.units for insert to authenticated
  with check ((building_id in (select b.id from buildings b where b.org_id in (select my_org_ids()))) and (select current_user_is_office_staff()) and (select current_user_has_module('tenants'::text)));
create policy unit_update on public.units for update to authenticated
  using ((building_id in (select b.id from buildings b where b.org_id in (select my_org_ids()))) and (select current_user_is_office_staff()) and (select current_user_has_module('tenants'::text)))
  with check ((building_id in (select b.id from buildings b where b.org_id in (select my_org_ids()))) and (select current_user_is_office_staff()) and (select current_user_has_module('tenants'::text)));

commit;
