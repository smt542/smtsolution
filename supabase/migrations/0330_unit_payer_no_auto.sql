-- 납부자번호(= 고지서 「코드번호」) 자동 부여(2026-10-19 결정).
--
-- 납부자번호(unit_accounts kind='mgmt'.payer_no)는 지로 고지서 납부자번호, 지로·은행 입금 자동 매칭,
-- 카카오 고지 고객번호(뒤 6자리), 고지서 이름 출력 유형 「코드번호 출력」에 쓰이는데, 앱에 부여 경로가 없어
-- 시드로 넣은 세대 외에는 비어 있었다.
--   규칙: 건물코드 3자리 + 호실 3자리(숫자만, 앞 0 채움) — 예: 그린빌라(001) 101호 → 001101.
--         건물코드는 조직 안에서 유일(buildings_org_id_code_key)이고 호실은 숫자 3자리로 받으므로 조직 안에서 겹치지 않는다.
--   - 호실 생성 시 관리비 계좌(mgmt) 행에 기본값을 넣는다(직원이 입주자 상세에서 고칠 수 있다).
--   - 호실·건물이 바뀌면 자동값 그대로인 경우만 새 자동값으로 바꾼다(직접 입력한 번호는 유지).
--   - save_unit_occupancy: 관리비 계좌 납부자번호를 비워 저장하면 자동값으로 채운다.
--   - 기존 세대: 비어 있는 납부자번호만 채운다(이미 있는 번호는 바꾸지 않는다).

create or replace function public.default_payer_no(p_building_code text, p_unit_no text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when nullif(regexp_replace(coalesce(p_building_code, ''), '\D', '', 'g'), '') is null
      or nullif(regexp_replace(coalesce(p_unit_no, ''), '\D', '', 'g'), '') is null
      then null
    else lpad(regexp_replace(p_building_code, '\D', '', 'g'), 3, '0')
      || lpad(regexp_replace(p_unit_no, '\D', '', 'g'), 3, '0')
  end;
$function$;

create or replace function public.units_ensure_payer_no()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_new text;
  v_old text;
begin
  if new.deleted_at is not null then return new; end if;
  select public.default_payer_no(b.code, new.unit_no) into v_new from buildings b where b.id = new.building_id;
  if v_new is null then return new; end if;
  if tg_op = 'UPDATE' then
    select public.default_payer_no(b.code, old.unit_no) into v_old from buildings b where b.id = old.building_id;
  end if;
  insert into unit_accounts(unit_id, kind, payer_no)
    values (new.id, 'mgmt', v_new)
    on conflict (unit_id, kind) do update
      set payer_no = excluded.payer_no
      where nullif(btrim(coalesce(unit_accounts.payer_no, '')), '') is null
         or unit_accounts.payer_no = v_old;
  return new;
end;
$function$;

revoke all on function public.units_ensure_payer_no() from public, anon, authenticated;

drop trigger if exists units_ensure_payer_no on public.units;
create trigger units_ensure_payer_no
  after insert or update of unit_no, building_id on public.units
  for each row execute function public.units_ensure_payer_no();

-- save_unit_occupancy: 관리비 계좌 납부자번호가 비어 오면 자동값으로 채운다(해당 줄만 치환).
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.save_unit_occupancy'::regproc) into v_def;
  v_new := replace(v_def,
    $old$v_item->>'cms_member_no', v_item->>'payer_no')$old$,
    $new$v_item->>'cms_member_no',
              -- 0330: 관리비 계좌 납부자번호가 비면 건물코드 3자리 + 호실 3자리
              coalesce(nullif(btrim(coalesce(v_item->>'payer_no', '')), ''),
                case when v_item->>'kind' = 'mgmt' then (
                  select public.default_payer_no(bb.code, uu.unit_no)
                  from units uu join buildings bb on bb.id = uu.building_id where uu.id = v_unit_id
                ) end))$new$);
  if v_new = v_def then raise exception '0330: save_unit_occupancy 치환 대상 없음'; end if;
  execute v_new;
end
$migration$;

-- 기존 세대 보정: 관리비 계좌가 없거나 납부자번호가 비어 있는 세대만.
insert into public.unit_accounts(unit_id, kind, payer_no)
select u.id, 'mgmt', public.default_payer_no(b.code, u.unit_no)
from public.units u join public.buildings b on b.id = u.building_id
where u.deleted_at is null and b.deleted_at is null
  and public.default_payer_no(b.code, u.unit_no) is not null
on conflict (unit_id, kind) do update
  set payer_no = excluded.payer_no
  where nullif(btrim(coalesce(unit_accounts.payer_no, '')), '') is null;
