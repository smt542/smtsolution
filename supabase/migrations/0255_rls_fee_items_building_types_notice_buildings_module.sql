-- 항목등록·건물유형·공지-건물 연결의 직접 쓰기를 모듈 권한 보유자로 제한한다.
-- 기존 *_all(FOR ALL, org 멤버면 모두 허용)을 SELECT(org)와 쓰기(org + 모듈)로 분리.
-- notices는 0249에서 이미 처리됨. SECURITY DEFINER 함수(ensure_required_utility_fee_items,
-- notices_sync_building_link)는 RLS를 우회하므로 영향 없음.

drop policy if exists fi_all on public.fee_items;
create policy fi_select on public.fee_items for select to authenticated
  using (org_id in (select my_org_ids()));
create policy fi_write on public.fee_items for all to authenticated
  using (org_id in (select my_org_ids()) and (select current_user_has_module('fee_items')))
  with check (org_id in (select my_org_ids()) and (select current_user_has_module('fee_items')));

drop policy if exists bt_all on public.building_types;
create policy bt_select on public.building_types for select to authenticated
  using (org_id in (select my_org_ids()));
create policy bt_write on public.building_types for all to authenticated
  using (org_id in (select my_org_ids()) and (select current_user_has_module('fee_items')))
  with check (org_id in (select my_org_ids()) and (select current_user_has_module('fee_items')));

drop policy if exists notice_buildings_all on public.notice_buildings;
create policy notice_buildings_select on public.notice_buildings for select to authenticated
  using (org_id in (select my_org_ids()));
create policy notice_buildings_write on public.notice_buildings for all to authenticated
  using (org_id in (select my_org_ids()) and (select current_user_has_module('notices')))
  with check (org_id in (select my_org_ids()) and (select current_user_has_module('notices')));
