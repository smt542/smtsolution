-- 0195: 룸 타입 5종(원룸·1.5룸·투룸·쓰리룸·기타)을 조직별 고정 데이터로 프로비저닝한다.
-- 시스템설정 탭 삭제로 룸 타입을 추가할 화면이 없어져 room_types가 비어 있었다(입주자 폼 '룸' 드롭다운이 빈 목록).
-- room_types는 0003부터 unique (org_id, label)이라 라벨당 행이 하나뿐이다 — 삭제된 행은 새로 넣지 않고 되살린다.

create or replace function public.provision_default_room_types(p_org_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default record;
begin
  if p_org_id is null then
    return;
  end if;

  for v_default in
    select *
    from (values
      (1, '원룸'),
      (2, '1.5룸'),
      (3, '투룸'),
      (4, '쓰리룸'),
      (5, '기타')
    ) as defaults(sort_order, label)
  loop
    -- 기존 활성 라벨은 유지하고, 삭제된 기본 라벨은 다시 활성화한다.
    update public.room_types
       set deleted_at = null,
           sort_order = v_default.sort_order
     where org_id = p_org_id
       and label = v_default.label
       and deleted_at is not null;

    insert into public.room_types (org_id, label, sort_order)
    select p_org_id, v_default.label, v_default.sort_order
     where not exists (
       select 1
         from public.room_types
        where org_id = p_org_id
          and label = v_default.label
          and deleted_at is null
     );
  end loop;
end
$$;

revoke all on function public.provision_default_room_types(bigint)
  from public, anon, authenticated;

do $$
declare
  v_org record;
begin
  for v_org in
    select id from public.organizations where deleted_at is null
  loop
    perform public.provision_default_room_types(v_org.id);
  end loop;
end
$$;

create or replace function public.trg_provision_default_room_types()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.provision_default_room_types(new.id);
  return new;
end
$$;

revoke all on function public.trg_provision_default_room_types()
  from public, anon, authenticated;

drop trigger if exists trg_org_provision_default_room_types on public.organizations;
create trigger trg_org_provision_default_room_types
  after insert on public.organizations
  for each row
  execute function public.trg_provision_default_room_types();
