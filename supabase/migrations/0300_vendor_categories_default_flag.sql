-- 0300: 협력업체 구분 기본 9종(유선방송정보업체 추가) + 기본/추가 구분 플래그(is_default) + 서버 보호.
-- 정책: 사무실 관리자_협력업체 관리.md 3.1 — 기본 9종은 이름 변경·삭제 불가, 사용자 추가 구분만 편집·삭제.
-- 판단: 업체가 연결된 추가 구분은 삭제를 막는다(vendors.category_id FK 는 ON DELETE SET NULL 이라 업체가 미분류로 풀리는 것을 방지).

alter table public.vendor_categories
  add column if not exists is_default boolean not null default false;

-- 기본 9종 시드(정책서 나열 순서). 프로비저닝 중에만 기본 구분 변경을 허용하도록 GUC 플래그를 켠다.
create or replace function public.provision_default_vendor_categories(p_org_id bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default record;
  v_category_id bigint;
  v_inserted integer := 0;
begin
  if p_org_id is null then
    return 0;
  end if;

  perform set_config('app.vc_provisioning', '1', true);

  for v_default in
    select *
    from (values
      (0, '청소 업체'),
      (1, '정화조 업체'),
      (2, '인터넷 업체'),
      (3, '전기안전업체'),
      (4, '유선방송정보업체'),
      (5, '승강기보수업체'),
      (6, '승강기정기검사업체'),
      (7, '소방검사업체'),
      (8, 'CCTV 업체')
    ) as defaults(sort_order, label)
  loop
    v_category_id := null;

    select id into v_category_id
      from public.vendor_categories
     where org_id = p_org_id and label = v_default.label
     limit 1;

    if v_category_id is null then
      select id into v_category_id
        from public.vendor_categories
       where org_id = p_org_id
         and regexp_replace(lower(label), '[[:space:]]+', '', 'g') =
             regexp_replace(lower(v_default.label), '[[:space:]]+', '', 'g')
       order by id
       limit 1;

      if v_category_id is not null then
        update public.vendor_categories
           set label = v_default.label
         where id = v_category_id;
      else
        insert into public.vendor_categories (org_id, label, sort_order, is_default)
        values (p_org_id, v_default.label, v_default.sort_order, true)
        on conflict (org_id, label) do update
          set sort_order = excluded.sort_order
        returning id into v_category_id;
        v_inserted := v_inserted + 1;
      end if;
    end if;

    update public.vendors
       set category_id = v_category_id
     where org_id = p_org_id
       and category_id in (
         select id from public.vendor_categories
          where org_id = p_org_id
            and id <> v_category_id
            and regexp_replace(lower(label), '[[:space:]]+', '', 'g') =
                regexp_replace(lower(v_default.label), '[[:space:]]+', '', 'g')
       );

    delete from public.vendor_categories
     where org_id = p_org_id
       and id <> v_category_id
       and regexp_replace(lower(label), '[[:space:]]+', '', 'g') =
           regexp_replace(lower(v_default.label), '[[:space:]]+', '', 'g');

    update public.vendor_categories
       set sort_order = v_default.sort_order,
           is_default = true
     where id = v_category_id;
  end loop;

  perform set_config('app.vc_provisioning', '', true);
  return v_inserted;
end
$$;

revoke all on function public.provision_default_vendor_categories(bigint)
  from public, anon, authenticated;

-- 서버 보호: 기본 구분 이름 변경·삭제·플래그 변경 불가, 추가 구분은 이름 검증·업체 있으면 삭제 불가.
create or replace function public.trg_vendor_categories_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provisioning boolean := coalesce(current_setting('app.vc_provisioning', true), '') = '1';
begin
  if v_provisioning then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- 조직 삭제 연쇄 삭제는 허용
    if not exists (select 1 from public.organizations where id = old.org_id) then
      return old;
    end if;
    if old.is_default then
      raise exception '기본 구분은 삭제할 수 없습니다.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.vendors where category_id = old.id) then
      raise exception '이 구분에 등록된 업체가 있어 삭제할 수 없습니다. 업체를 다른 구분으로 옮기거나 삭제한 뒤 다시 시도해 주세요.' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.is_default then
    if new.label is distinct from old.label
       or new.is_default is distinct from old.is_default
       or new.org_id is distinct from old.org_id then
      raise exception '기본 구분은 이름을 바꿀 수 없습니다.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- INSERT / 추가 구분 UPDATE
  if new.is_default then
    raise exception '기본 구분은 시스템이 관리합니다.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.org_id is distinct from old.org_id then
    raise exception '구분의 조직은 바꿀 수 없습니다.' using errcode = 'P0001';
  end if;
  new.label := btrim(new.label);
  if new.label = '' then
    raise exception '구분 이름을 입력해 주세요.' using errcode = 'P0001';
  end if;
  if char_length(new.label) > 30 then
    raise exception '구분 이름은 30자 이하로 입력해 주세요.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.vendor_categories c
     where c.org_id = new.org_id
       and c.id is distinct from new.id
       and regexp_replace(lower(c.label), '[[:space:]]+', '', 'g') =
           regexp_replace(lower(new.label), '[[:space:]]+', '', 'g')
  ) then
    raise exception '이미 같은 이름의 구분이 있습니다.' using errcode = 'P0001';
  end if;
  return new;
end
$$;

revoke all on function public.trg_vendor_categories_guard() from public, anon, authenticated;

drop trigger if exists trg_vendor_categories_guard on public.vendor_categories;
create trigger trg_vendor_categories_guard
  before insert or update or delete on public.vendor_categories
  for each row execute function public.trg_vendor_categories_guard();

-- 기존 모든 조직 백필(기본 9종 보장·정렬·is_default)
do $$
declare v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_default_vendor_categories(v_org.id);
  end loop;
end
$$;
