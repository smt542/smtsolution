-- 0238_data_migration_framework.sql
-- 셋업 > 데이터 이관(정책서 사무실 관리자_셋업 설정 3.6 · Data Exchange 4절) 서버 저장 경로.
-- 지금까지 「N건 등록」은 localStorage 기록만 남기고 서버에 저장하지 않았다(문제점 개선1차 #12).
--
--  - data_migration_runs: 조직별 이관 실행 기록(대상·전체/성공/실패 건수·실행자·시각). 상태 「완료」의 근거.
--  - import_migration_rows(kind, rows): 행 단위로 kind별 매핑 함수(migrate_<kind>)를 호출한다.
--      행마다 서브트랜잭션(BEGIN … EXCEPTION)이라 한 행이 실패해도 다른 행과 기존 데이터는 그대로다.
--      실패 행은 {line, message}로 돌려준다(화면 오류 모달·오류 내역 다운로드).
--  - reset_migration_runs(): 「진행 기록 초기화」 — 기록만 지우고 이관된 데이터는 건드리지 않는다.
--  kind별 매핑 함수는 0239(마스터·건물 하위 일부)·0240(입주자·이력)에 있다.
--  권한: 셋업 설정(settings) 모듈.

create table if not exists public.data_migration_runs (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('vendorMaster', 'building', 'vendor', 'util', 'feeitem', 'tenant', 'meter', 'unpaid')),
  total_count integer not null default 0,
  ok_count integer not null default 0,
  fail_count integer not null default 0,
  run_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_data_migration_runs_org_kind
  on public.data_migration_runs(org_id, kind, created_at desc);

alter table public.data_migration_runs enable row level security;

drop policy if exists dmr_select on public.data_migration_runs;
create policy dmr_select on public.data_migration_runs
  for select using (org_id in (select public.my_org_ids()) and public.current_user_has_module('settings'));
-- 쓰기는 아래 security definer RPC로만 한다(직접 insert/update/delete 정책 없음).

create or replace function public.import_migration_rows(p_kind text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org bigint := current_user_org();
  v_fn text;
  v_item jsonb;
  v_line integer;
  v_ok integer := 0;
  v_total integer := 0;
  v_failures jsonb := '[]'::jsonb;
  v_message text;
begin
  if v_org is null then
    raise exception 'no org for caller' using errcode = '42501';
  end if;
  if not current_user_has_module('settings') then
    raise exception 'forbidden: settings required' using errcode = '42501';
  end if;

  v_fn := case p_kind
    when 'vendorMaster' then 'migrate_vendor_master'
    when 'building' then 'migrate_building'
    when 'vendor' then 'migrate_building_vendor'
    when 'util' then 'migrate_building_util'
    when 'feeitem' then 'migrate_fee_item_charge'
    when 'tenant' then 'migrate_tenant'
    when 'meter' then 'migrate_meter_start'
    when 'unpaid' then 'migrate_unpaid'
  end;
  if v_fn is null then
    raise exception 'unknown migration kind: %', p_kind using errcode = '22023';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'too many rows in one request (max 1000)' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_total := v_total + 1;
    v_line := nullif(v_item->>'line', '')::integer;
    begin
      execute format('select public.%I($1, $2)', v_fn) using v_org, coalesce(v_item->'rec', '{}'::jsonb);
      v_ok := v_ok + 1;
    exception when others then
      v_message := sqlerrm;
      v_failures := v_failures || jsonb_build_object('line', v_line, 'message', v_message);
    end;
  end loop;

  insert into data_migration_runs(org_id, kind, total_count, ok_count, fail_count)
    values (v_org, p_kind, v_total, v_ok, v_total - v_ok);

  return jsonb_build_object('total', v_total, 'ok', v_ok, 'failed', v_total - v_ok, 'failures', v_failures);
end
$$;

revoke execute on function public.import_migration_rows(text, jsonb) from public, anon;
grant execute on function public.import_migration_rows(text, jsonb) to authenticated;

create or replace function public.reset_migration_runs()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org bigint := current_user_org();
begin
  if v_org is null or not current_user_has_module('settings') then
    raise exception 'forbidden: settings required' using errcode = '42501';
  end if;
  delete from data_migration_runs where org_id = v_org;
end
$$;

revoke execute on function public.reset_migration_runs() from public, anon;
grant execute on function public.reset_migration_runs() to authenticated;
