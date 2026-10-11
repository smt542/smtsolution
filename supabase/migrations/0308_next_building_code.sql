-- 건물 코드: 순차 자동 채번 후 수정 가능, 형식은 숫자 3자리 유지(사용자 결정 2026-10-11, 정책 미결정 1번 종결).
--
-- 3자리인 이유: 지로수납처리(수납관리 3.6)가 은행 지로 고객조회번호 7~9번째 3자리를 건물 코드로 보고 세대를 찾는다
-- (lib/payments/giroFile.ts · lib/payments/depositPreview.ts giroMatch). 3자리가 아닌 코드의 건물은 지로 수납이
-- 자동 처리될 수 없어, 0200(save_building 3자리 강제)·0239(migrate_building) 검사를 그대로 둔다.
--
-- next_building_code(): 등록 화면의 건물 코드 기본값.
--   · 조직의 3자리 숫자 코드 최댓값 + 1 (삭제된 건물 포함 — 유니크 인덱스 (org_id, code)가 삭제 건도 포함)
--   · 999를 넘으면 비어 있는 가장 작은 3자리 번호(001~999)
--   · 3자리 번호가 모두 쓰였으면 null(직원이 직접 입력 — 저장 검사에서 막힌다)
-- 이 파일의 이전 판(같은 날)은 자릿수 제한을 풀었으나 지로 매칭 문제로 되돌렸다. 아래 블록이 save_building·
-- migrate_building 의 3자리 검사를 원래(0200·0239) 상태로 복구한다(이미 원래 상태면 아무것도 하지 않음).

create or replace function public.next_building_code()
 returns text
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_max int;
  v_next int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_is_office_staff() then raise exception 'forbidden: office staff only'; end if;

  select max(b.code::int) into v_max
    from buildings b
   where b.org_id = v_org and b.code ~ '^\d{3}$';

  v_next := coalesce(v_max, 0) + 1;
  if v_next > 999 then
    select min(n) into v_next
      from generate_series(1, 999) n
     where not exists (
       select 1 from buildings b where b.org_id = v_org and b.code = lpad(n::text, 3, '0'));
  end if;

  return case when v_next is null then null else lpad(v_next::text, 3, '0') end;
end $function$;

revoke all on function public.next_building_code() from public, anon;
grant execute on function public.next_building_code() to authenticated;

do $migration$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.save_building'::regproc);
  v_new := replace(v_def,
    $$  if v_code is null or v_code !~ '^[0-9]{1,10}$' then
    raise exception '건물 코드는 숫자로 입력해 주세요(최대 10자리).' using errcode = '22023';$$,
    $$  if v_code is null or v_code !~ '^[0-9]{3}$' then
    raise exception 'invalid building code: 3 digits required' using errcode = '22023';$$);
  if v_new <> v_def then execute v_new; end if;

  v_def := pg_get_functiondef('public.migrate_building'::regproc);
  v_new := replace(v_def,
    $$  if v_code !~ '^[0-9]{1,10}$' then
    raise exception '건물 코드 「%」는 숫자(최대 10자리)로 적어 주세요', v_code;$$,
    $$  if v_code !~ '^[0-9]{3}$' then
    raise exception '건물 코드 「%」는 숫자 3자리로 적어 주세요', v_code;$$);
  if v_new <> v_def then execute v_new; end if;
end
$migration$;
