-- QA #6: 삭제된 건물 코드 재사용. (org_id, code) 유니크를 "삭제되지 않은 건물" 기준 부분 유니크로 바꾼다.
-- 자동 채번 next_building_code() 는 삭제 건 포함 최댓값+1 을 유지한다(지로 납부자번호 = 건물코드+호실이 과거 고지서와 섞이지 않게).
begin;

alter table buildings drop constraint buildings_org_id_code_key;
create unique index buildings_org_id_code_active_key on buildings (org_id, code) where deleted_at is null;

-- migrate_building: 중복 검사를 활성 건물 기준으로 (라이브 정의의 검사 쿼리만 교체)
do $mig$
declare
  v_def text := pg_get_functiondef('public.migrate_building(bigint, jsonb)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_def,
    'from buildings where org_id = p_org and code = v_code;',
    'from buildings where org_id = p_org and code = v_code and deleted_at is null;');
  if v_new = v_def then raise exception 'migrate_building: 교체 대상 문장을 찾지 못했어요'; end if;
  execute v_new;
end
$mig$;

-- 삭제 건물 복구(deleted_at -> null) 시 같은 코드의 활성 건물이 있으면 명확한 오류
create or replace function buildings_guard_undelete_code() returns trigger
language plpgsql as $$
begin
  if old.deleted_at is not null and new.deleted_at is null
     and exists (select 1 from buildings b
                  where b.org_id = new.org_id and b.code = new.code
                    and b.deleted_at is null and b.id <> new.id) then
    raise exception '건물 코드 %는 이미 사용 중인 건물이 있어 복구할 수 없어요', new.code using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists buildings_guard_undelete_code on buildings;
create trigger buildings_guard_undelete_code
  before update of deleted_at on buildings
  for each row execute function buildings_guard_undelete_code();

commit;
