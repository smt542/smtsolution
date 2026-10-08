-- org 전체로 열린 RLS를 persona·모듈 권한으로 좁힌다(문제점 개선 1차 P0-1).
--  - 쓰기: complaints·complaint_resolutions·notices·vendors 가 `org_id in my_org_ids()` 하나로 FOR ALL 이었다.
--    org 멤버(현장 파트너 포함)면 PostgREST로 직접 수정·삭제할 수 있어 모듈 권한과
--    partner_update/delete_complaint 의 "본인 담당만" 제한이 우회됐다.
--    → 사무실 직원 + 모듈 권한(민원은 수납관리·민원접수 화면 권한인 complaints 또는 payment).
--  - 조회: buildings·units·occupancies·payments·moving_settlements SELECT 가 my_org_ids() 뿐이라
--    파트너가 담당 외 건물의 입주자 PII·수납 내역을 직접 읽을 수 있었다.
--    → 직접 조회는 사무실 직원(manager_staff 또는 마스터)만. 파트너는 담당 범위를 거르는
--      partner_* RPC(SECURITY DEFINER)로만 읽는다.
--  - 기존 모듈 쓰기 정책(FOR ALL)은 SELECT 도 허용하므로 같은 사무실 직원 조건을 더한다.
--  - 파트너 화면(mobile-tenant)이 직접 읽던 occupancy id·정산 수납액(extra.paid)은 RPC 반환값으로 옮긴다.
--  - 입주민은 org 멤버가 아니라 원래 이 정책들을 통과하지 않으며 resident_*/public_* RPC만 쓴다.

-- 사무실 직원 판정: 활성 조직·활성 프로필의 manager_staff 또는 마스터(org_owner/platform_admin).
create or replace function public.current_user_is_office_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from org_members m
    join organizations o on o.id = m.org_id
    join profiles p on p.user_id = m.user_id
    where m.user_id = (select auth.uid())
      and o.status = 'active' and o.deleted_at is null and p.is_active
      and (m.staff_capabilities ? 'manager_staff' or m.role in ('org_owner', 'platform_admin'))
  );
$function$;

revoke execute on function public.current_user_is_office_staff() from public, anon;
grant execute on function public.current_user_is_office_staff() to authenticated, service_role;

-- ── 조회 + 기존 모듈 쓰기: 건물·세대·입주·수납·이사정산 ─────────────────────────

drop policy if exists bld_select on public.buildings;
drop policy if exists bld_write on public.buildings;
create policy bld_select on public.buildings for select to authenticated
  using (org_id in (select my_org_ids()) and (select current_user_is_office_staff()));
create policy bld_write on public.buildings for all to authenticated
  using (org_id in (select my_org_ids()) and (select current_user_is_office_staff())
         and (select current_user_has_module('buildings')))
  with check (org_id in (select my_org_ids()) and (select current_user_is_office_staff())
              and (select current_user_has_module('buildings')));

drop policy if exists unit_select on public.units;
drop policy if exists unit_write on public.units;
create policy unit_select on public.units for select to authenticated
  using (building_id in (select b.id from buildings b where b.org_id in (select my_org_ids()))
         and (select current_user_is_office_staff()));
create policy unit_write on public.units for all to authenticated
  using (building_id in (select b.id from buildings b where b.org_id in (select my_org_ids()))
         and (select current_user_is_office_staff()) and (select current_user_has_module('tenants')))
  with check (building_id in (select b.id from buildings b where b.org_id in (select my_org_ids()))
              and (select current_user_is_office_staff()) and (select current_user_has_module('tenants')));

drop policy if exists occ_select on public.occupancies;
drop policy if exists occ_write on public.occupancies;
create policy occ_select on public.occupancies for select to authenticated
  using (unit_id in (select u.id from units u join buildings b on b.id = u.building_id
                     where b.org_id in (select my_org_ids()))
         and (select current_user_is_office_staff()));
create policy occ_write on public.occupancies for all to authenticated
  using (unit_id in (select u.id from units u join buildings b on b.id = u.building_id
                     where b.org_id in (select my_org_ids()))
         and (select current_user_is_office_staff()) and (select current_user_has_module('tenants')))
  with check (unit_id in (select u.id from units u join buildings b on b.id = u.building_id
                          where b.org_id in (select my_org_ids()))
              and (select current_user_is_office_staff()) and (select current_user_has_module('tenants')));

drop policy if exists pay_select on public.payments;
drop policy if exists pay_write on public.payments;
create policy pay_select on public.payments for select to authenticated
  using (unit_id in (select u.id from units u join buildings b on b.id = u.building_id
                     where b.org_id in (select my_org_ids()))
         and (select current_user_is_office_staff()));
create policy pay_write on public.payments for all to authenticated
  using (unit_id in (select u.id from units u join buildings b on b.id = u.building_id
                     where b.org_id in (select my_org_ids()))
         and (select current_user_is_office_staff()) and (select current_user_has_module('payment')))
  with check (unit_id in (select u.id from units u join buildings b on b.id = u.building_id
                          where b.org_id in (select my_org_ids()))
              and (select current_user_is_office_staff()) and (select current_user_has_module('payment')));

drop policy if exists ms_select on public.moving_settlements;
drop policy if exists ms_write on public.moving_settlements;
create policy ms_select on public.moving_settlements for select to authenticated
  using (unit_id in (select u.id from units u join buildings b on b.id = u.building_id
                     where b.org_id in (select my_org_ids()))
         and (select current_user_is_office_staff()));
create policy ms_write on public.moving_settlements for all to authenticated
  using (unit_id in (select u.id from units u join buildings b on b.id = u.building_id
                     where b.org_id in (select my_org_ids()))
         and (select current_user_is_office_staff()) and (select current_user_has_module('moving')))
  with check (unit_id in (select u.id from units u join buildings b on b.id = u.building_id
                          where b.org_id in (select my_org_ids()))
              and (select current_user_is_office_staff()) and (select current_user_has_module('moving')));

-- ── 조회/쓰기 분리: 민원·처리결과·공지·협력업체 ───────────────────────────────

drop policy if exists cpl_all on public.complaints;
create policy cpl_select on public.complaints for select to authenticated
  using (org_id in (select my_org_ids()) and (select current_user_is_office_staff()));
-- 민원 등록·처리는 수납관리·민원접수 화면(payment 또는 complaints 권한)에서 한다.
create policy cpl_write on public.complaints for all to authenticated
  using (org_id in (select my_org_ids()) and (select current_user_is_office_staff())
         and ((select current_user_has_module('complaints')) or (select current_user_has_module('payment'))))
  with check (org_id in (select my_org_ids()) and (select current_user_is_office_staff())
              and ((select current_user_has_module('complaints')) or (select current_user_has_module('payment'))));

drop policy if exists cr_all on public.complaint_resolutions;
create policy cr_select on public.complaint_resolutions for select to authenticated
  using (complaint_id in (select c.id from complaints c where c.org_id in (select my_org_ids()))
         and (select current_user_is_office_staff()));
create policy cr_write on public.complaint_resolutions for all to authenticated
  using (complaint_id in (select c.id from complaints c where c.org_id in (select my_org_ids()))
         and (select current_user_is_office_staff())
         and ((select current_user_has_module('complaints')) or (select current_user_has_module('payment'))))
  with check (complaint_id in (select c.id from complaints c where c.org_id in (select my_org_ids()))
              and (select current_user_is_office_staff())
              and ((select current_user_has_module('complaints')) or (select current_user_has_module('payment'))));

drop policy if exists ntc_all on public.notices;
create policy ntc_select on public.notices for select to authenticated
  using (org_id in (select my_org_ids()) and (select current_user_is_office_staff()));
create policy ntc_write on public.notices for all to authenticated
  using (org_id in (select my_org_ids()) and (select current_user_is_office_staff())
         and (select current_user_has_module('notices')))
  with check (org_id in (select my_org_ids()) and (select current_user_is_office_staff())
              and (select current_user_has_module('notices')));

drop policy if exists vnd_all on public.vendors;
create policy vnd_select on public.vendors for select to authenticated
  using (org_id in (select my_org_ids()) and (select current_user_is_office_staff()));
create policy vnd_write on public.vendors for all to authenticated
  using (org_id in (select my_org_ids()) and (select current_user_is_office_staff())
         and (select current_user_has_module('vendors')))
  with check (org_id in (select my_org_ids()) and (select current_user_is_office_staff())
              and (select current_user_has_module('vendors')));

-- ── 파트너 RPC: 화면이 직접 읽던 값을 반환값으로 옮긴다 ──────────────────────────

-- occupancy_id 추가(반환 타입 변경이라 재생성).
drop function if exists public.partner_get_occupancy(bigint);
create function public.partner_get_occupancy(p_unit_id bigint)
returns table(unit_id bigint, building_id bigint, building_name text, unit_no text, dong text,
              tenant_name text, payer_name text, phone text, resident_count integer, vehicle_no text,
              move_in_date date, status text, occupancy_id bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select u.id, b.id, b.name, u.unit_no, u.dong, o.tenant_name, o.payer_name, o.phone,
         o.resident_count, o.vehicle_no, o.move_in_date, coalesce(o.status::text, 'vacant'), o.id
  from units u
  join buildings b on b.id = u.building_id
  left join occupancies o
    on o.unit_id = u.id and o.deleted_at is null and o.status = 'occupied'
  where u.id = p_unit_id and b.id in (select partner_my_building_ids());
$function$;

revoke execute on function public.partner_get_occupancy(bigint) from public, anon;
grant execute on function public.partner_get_occupancy(bigint) to authenticated, service_role;

-- paid_amount(파트너 이사정산 등록 화면이 저장한 수납액 extra.paid) 추가.
drop function if exists public.partner_list_unit_settlements(bigint);
create function public.partner_list_unit_settlements(p_unit_id bigint)
returns table(id bigint, tenant_name text, status text, settlement_amount integer,
              move_out_date date, created_at timestamptz, paid_amount numeric)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select s.id, o.tenant_name, s.status, s.settlement_amount, s.move_out_date, s.created_at,
         coalesce(case when jsonb_typeof(s.extra->'paid') = 'number' then (s.extra->>'paid')::numeric
                       when (s.extra->>'paid') ~ '^-?[0-9]+(\.[0-9]+)?$' then (s.extra->>'paid')::numeric
                  end, 0)
  from moving_settlements s
  join units u on u.id = s.unit_id and u.building_id in (select partner_my_building_ids())
  left join occupancies o on o.id = s.occupancy_id
  where s.unit_id = p_unit_id
  order by s.created_at desc;
$function$;

revoke execute on function public.partner_list_unit_settlements(bigint) from public, anon;
grant execute on function public.partner_list_unit_settlements(bigint) to authenticated, service_role;
