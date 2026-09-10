-- 0153: 협력업체 구분 8종을 조직별 고정 데이터로 프로비저닝한다.
-- 화면에서는 구분을 추가·수정·삭제하지 않으며, 업체만 해당 구분에 연결한다.

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

  for v_default in
    select *
    from (values
      (0, '청소 업체'),
      (1, '승강기보수업체'),
      (2, 'CCTV 업체'),
      (3, '인터넷 업체'),
      (4, '소방검사업체'),
      (5, '정화조 업체'),
      (6, '전기안전업체'),
      (7, '승강기정기검사업체')
    ) as defaults(sort_order, label)
  loop
    v_category_id := null;

    select id
      into v_category_id
      from public.vendor_categories
     where org_id = p_org_id
       and label = v_default.label
     limit 1;

    -- 과거에 저장된 '청소업체', 'CCTV업체' 같은 띄어쓰기·대소문자 변형은
    -- 기존 업체 연결을 유지한 채 프로토타입의 정본 라벨로 정규화한다.
    if v_category_id is null then
      select id
        into v_category_id
        from public.vendor_categories
       where org_id = p_org_id
         and regexp_replace(lower(label), '[[:space:]]+', '', 'g') =
             regexp_replace(lower(v_default.label), '[[:space:]]+', '', 'g')
       order by id
       limit 1;

      if v_category_id is not null then
        update public.vendor_categories
           set label = v_default.label,
               sort_order = v_default.sort_order
         where id = v_category_id;
      else
        insert into public.vendor_categories (org_id, label, sort_order)
        values (p_org_id, v_default.label, v_default.sort_order)
        on conflict (org_id, label) do update
          set sort_order = excluded.sort_order
        returning id into v_category_id;
        v_inserted := v_inserted + 1;
      end if;
    end if;

    -- 동일 구분의 변형 행이 여러 개면 업체를 정본 행으로 옮긴 뒤 중복을 제거한다.
    update public.vendors
       set category_id = v_category_id
     where org_id = p_org_id
       and category_id in (
         select id
           from public.vendor_categories
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
       set sort_order = v_default.sort_order
     where id = v_category_id;
  end loop;

  return v_inserted;
end
$$;

revoke all on function public.provision_default_vendor_categories(bigint)
  from public, anon, authenticated;

-- 기존 조직 백필
do $$
declare
  v_org record;
begin
  for v_org in
    select id from public.organizations where deleted_at is null
  loop
    perform public.provision_default_vendor_categories(v_org.id);
  end loop;
end
$$;

-- 신규 조직 자동 프로비저닝
create or replace function public.trg_provision_vendor_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.provision_default_vendor_categories(new.id);
  return new;
end
$$;

revoke all on function public.trg_provision_vendor_categories()
  from public, anon, authenticated;

drop trigger if exists trg_org_provision_vendor_categories on public.organizations;
create trigger trg_org_provision_vendor_categories
  after insert on public.organizations
  for each row
  execute function public.trg_provision_vendor_categories();
