-- 개선3차 18·19·38: 권한·보안
-- 18) vendor_categories RLS: vc_all(조직 전체 개방) 제거 → 조회=사무직원, 쓰기=사무직원+vendors 모듈(vendors의 vnd_* 와 동일 기준).
--     기본 구분 보호용 is_default 컬럼은 현재 테이블에 없음(기본 9종은 클라이언트 상수) → 컬럼·트리거는 추가하지 않는다.
-- 19) trg_office_default_permissions: INSERT 시에만 payment/complaints 기본 부여. UPDATE 시 되살리지 않는다.
--     기존 멤버 권한은 그대로 유지(백필·회수 없음).
-- 38) 본사 6개 RPC 첫머리 가드를 current_user_can_manage_hq_accounts()(master·operations)로 교체(42501).

begin;

-- 18
drop policy if exists vc_all on public.vendor_categories;
drop policy if exists vc_select on public.vendor_categories;
drop policy if exists vc_write on public.vendor_categories;
create policy vc_select on public.vendor_categories for select
  using (org_id in (select public.my_org_ids()) and (select public.current_user_is_office_staff()));
create policy vc_write on public.vendor_categories for all
  using (org_id in (select public.my_org_ids()) and (select public.current_user_is_office_staff())
         and (select public.current_user_has_module('vendors')))
  with check (org_id in (select public.my_org_ids()) and (select public.current_user_is_office_staff())
         and (select public.current_user_has_module('vendors')));

-- 19
drop trigger if exists trg_org_members_office_default_permissions on public.org_members;
create trigger trg_org_members_office_default_permissions
  before insert on public.org_members
  for each row execute function public.trg_office_default_permissions();

-- 38: 실DB 정의에서 가드 한 줄만 치환(다른 수정분 보존)
do $$
declare
  v_fn text;
  v_def text;
  v_new text;
begin
  foreach v_fn in array array[
    'platform_record_point_charge','platform_update_point_charge','platform_delete_point_charge',
    'platform_record_point_adjustment','platform_set_message_point_rates','platform_update_settings'
  ] loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = v_fn;
    if v_def is null then raise exception 'function % not found', v_fn; end if;
    if v_def like '%current_user_can_manage_hq_accounts()%' then continue; end if;
    v_new := replace(v_def,
      'if not public.current_user_is_platform_admin() then',
      'if not public.current_user_can_manage_hq_accounts() then');
    if v_new = v_def then raise exception 'guard not found in %', v_fn; end if;
    v_new := replace(v_new, 'forbidden: platform_admin required', 'forbidden: hq master/operations required');
    execute v_new;
  end loop;
end $$;

commit;
