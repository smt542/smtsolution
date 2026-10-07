-- resolve_fax_bill_issues: 42702 "column reference unit_id is ambiguous" 수정.
-- RETURNS TABLE(bill_issue_id, unit_id)의 OUT 변수 unit_id가 ON CONFLICT (unit_id, ...) 컬럼명과 충돌했다.
-- #variable_conflict use_column으로 동일 이름은 컬럼으로 해석하게 해 모호성을 제거한다(동작은 동일).
create or replace function public.resolve_fax_bill_issues(
  p_building_id bigint, p_period date, p_unit_ids jsonb
)
returns table(bill_issue_id bigint, unit_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_org bigint;
  v_unit bigint;
  v_total integer;
  v_occ bigint;
  v_auto boolean;
  v_id bigint;
begin
  v_org := public.current_user_org();
  if v_org is null then
    raise exception 'no org for caller' using errcode = '42501';
  end if;
  if not public.current_user_has_module('bill_publish') then
    raise exception 'forbidden: bill_publish required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org' using errcode = '42501';
  end if;

  for v_unit in select jsonb_array_elements_text(coalesce(p_unit_ids, '[]'::jsonb))::bigint loop
    select bc.total_amount, bc.occupancy_id into v_total, v_occ
    from public.billing_confirmations bc
    join public.units u on u.id = bc.unit_id and u.building_id = p_building_id and u.deleted_at is null
    where bc.unit_id = v_unit and bc.period = p_period and bc.confirmed_at is not null;
    if not found then
      continue;
    end if;
    v_auto := exists (
      select 1 from public.unit_accounts ua
      where ua.unit_id = v_unit and ua.kind = 'mgmt' and nullif(ua.cms_member_no, '') is not null
    );
    insert into public.bill_issues as bi(
      unit_id, period, occupancy_id, issue_type, group_no, unit_label_mode, auto_debit, total_amount, issued_by
    ) values (
      v_unit, p_period, v_occ, 'fax', 1, 'name', v_auto, coalesce(v_total, 0), (select auth.uid())
    )
    on conflict (unit_id, period, issue_type) do update
      set total_amount = excluded.total_amount, occupancy_id = excluded.occupancy_id,
          auto_debit = excluded.auto_debit, issued_by = excluded.issued_by, issued_at = now()
    returning bi.id into v_id;
    bill_issue_id := v_id;
    unit_id := v_unit;
    return next;
  end loop;
end
$$;

revoke all on function public.resolve_fax_bill_issues(bigint, date, jsonb) from public, anon;
grant execute on function public.resolve_fax_bill_issues(bigint, date, jsonb) to authenticated;
