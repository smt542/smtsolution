-- 세입자 관리비 상세(앱·공유 링크)의 항목을 건물 유형의 관리비 항목 전체로 보여준다.
--
-- 기존: 그 달 부과된 항목(fee_item_charges.charged)만 내려, 부과 데이터가 없거나 일부만 있으면
--       「개별 사용료」·「공용 · 기타 관리비」가 통째로 사라져 오류처럼 보였다.
-- 변경: 건물 유형(fee_items org_id·type_id)의 항목을 모두 내리고, 부과가 없으면 0원.
--       부과됐다가 나중에 지워진 항목도 금액이 있으면 남긴다.
--       개별 사용료(수도·전기·가스) 분류는 필수 공과금 항목(is_required)만 — '공용전기료' 등 공용 항목이
--       이름에 '전기'가 들어 있다고 개별 사용료로 잡히지 않게 한다.
-- 대상: resident_bill_detail(date), public_bill_by_signed(bigint,text,date,text,integer)
--       (4인자 public_bill_by_signed 는 5인자를 그대로 호출한다)
-- 방식: 두 함수의 items 서브쿼리(charges) 블록만 교체한다. 이미 교체돼 있으면 건너뛴다.

do $$
declare
  v_sig text;
  v_def text;
  v_new text;
  v_block text := $blk$left join lateral (
    -- 0286: 건물 유형의 관리비 항목 전체를 보여준다(그 달 부과가 없으면 0원). 부과됐다가 지워진 항목도 남긴다.
    -- 개별 사용료(수도·전기·가스)는 필수 공과금 항목만 — '공용전기료' 같은 공용 항목이 개별로 잡히지 않게.
    select jsonb_agg(
      jsonb_build_object(
        'fee_item_id', fi.id,
        'name', fi.name,
        'amount', coalesce(fic.amount, 0),
        'charged', coalesce(fic.charged, false),
        'utility', util.u,
        'usage', mr.usage,
        'prev_usage', prev.usage
      ) order by fi.sort_order, fi.id
    ) as items
    from public.fee_items fi
    left join public.fee_item_charges fic
      on fic.fee_item_id = fi.id
     and fic.unit_id = u.id
     and fic.period = bc.period
     and fic.charged = true
    cross join lateral (
      select case
        when not fi.is_required then null
        when fi.name like '%수도%' then 'water'
        when fi.name like '%전기%' then 'elec'
        when fi.name like '%가스%' then 'gas'
        else null
      end as u
    ) util
    left join public.meter_readings mr
      on mr.unit_id = u.id and mr.period = bc.period and mr.utility = util.u
    left join public.meter_readings prev
      on prev.unit_id = u.id
     and prev.period = (bc.period - interval '1 month')::date
     and prev.utility = util.u
    where (fi.org_id = b.org_id and fi.type_id = b.type_id and fi.deleted_at is null)
       or fic.id is not null
  ) charges on true$blk$;
begin
  foreach v_sig in array array[
    'public.resident_bill_detail(date)',
    'public.public_bill_by_signed(bigint,text,date,text,integer)'
  ] loop
    v_def := pg_get_functiondef(v_sig::regprocedure);
    if position('0286:' in v_def) > 0 then
      continue; -- 이미 적용됨
    end if;
    v_new := regexp_replace(v_def, 'left join lateral \(\s*select jsonb_agg\(.*?\) charges on true', v_block, 's');
    if v_new = v_def then
      raise exception 'charges block not found in %', v_sig;
    end if;
    execute v_new;
  end loop;
end $$;
