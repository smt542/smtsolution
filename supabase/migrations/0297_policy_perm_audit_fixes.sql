-- 정책 위배 승인 항목 반영(3차): DB 권한·감사 로그.
--  4-1  platform_settings 직접 쓰기 차단(쓰기는 platform_update_settings RPC만)
--  1-22 billing_period_settings 쓰기를 utilities 또는 billing 보유자에게 허용
--  1-28 late_fee_rate_tiers 쓰기 권한을 settings 기준으로 + 요율표 교체 단일 RPC
--  3-2  partner_create_complaint / partner_delete_complaint 감사 로그(audit_log) 기록

-- 4-1 ---------------------------------------------------------------------
drop policy if exists platform_settings_platform_all on public.platform_settings;
revoke insert, update, delete, truncate on public.platform_settings from authenticated;

-- 1-22 --------------------------------------------------------------------
drop policy if exists bps_write on public.billing_period_settings;
create policy bps_write on public.billing_period_settings
  for all
  using (
    building_id in (select b.id from public.buildings b where b.org_id in (select public.my_org_ids()))
    and (public.current_user_has_module('utilities') or public.current_user_has_module('billing'))
  )
  with check (
    building_id in (select b.id from public.buildings b where b.org_id in (select public.my_org_ids()))
    and (public.current_user_has_module('utilities') or public.current_user_has_module('billing'))
  );

-- 1-28 --------------------------------------------------------------------
drop policy if exists lfrt_write on public.late_fee_rate_tiers;
create policy lfrt_write on public.late_fee_rate_tiers
  for all
  using (org_id in (select public.my_org_ids()) and public.current_user_has_module('settings'))
  with check (org_id in (select public.my_org_ids()) and public.current_user_has_module('settings'));

-- org 요율표 전체 교체(삭제+삽입)를 한 트랜잭션으로. p_tiers: [{tierOrder, fromMonth, toMonth, monthlyRate}]
create or replace function public.replace_late_fee_rate_tiers(p_org_id bigint, p_tiers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_org_id is null or p_org_id not in (select public.my_org_ids()) then
    raise exception 'forbidden: not your organization';
  end if;
  if not public.current_user_has_module('settings') then
    raise exception 'forbidden: settings permission required';
  end if;
  if p_tiers is not null and jsonb_typeof(p_tiers) <> 'array' then
    raise exception 'p_tiers must be a json array';
  end if;

  delete from public.late_fee_rate_tiers where org_id = p_org_id;

  insert into public.late_fee_rate_tiers(org_id, tier_order, from_month, to_month, monthly_rate)
  select p_org_id,
         (t->>'tierOrder')::int,
         (t->>'fromMonth')::int,
         nullif(t->>'toMonth', '')::int,
         (t->>'monthlyRate')::numeric
  from jsonb_array_elements(coalesce(p_tiers, '[]'::jsonb)) t;
end
$$;

revoke all on function public.replace_late_fee_rate_tiers(bigint, jsonb) from public, anon;
grant execute on function public.replace_late_fee_rate_tiers(bigint, jsonb) to authenticated;

-- 3-2 ---------------------------------------------------------------------
do $migration$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.partner_create_complaint(bigint,bigint,bigint,text,text,timestamptz,text,text)'::regprocedure);
  v_new := replace(v_def,
    'return v_id;',
    $$-- 0297: 등록 감사 로그(partner_update_complaint 와 같은 방식)
  insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
  values (v_org, v_uid, 'COMPLAINT_PARTNER_CREATE', 'complaints', v_id::text, null,
    jsonb_build_object('building_id', p_building_id, 'unit_id', p_unit_id, 'category_id', p_category_id,
      'content', nullif(p_content, ''), 'status', coalesce(nullif(p_status, ''), 'pending'),
      'completed_at', p_completed_at));

  return v_id;$$);
  if v_new = v_def then raise exception 'partner_create_complaint patch failed'; end if;
  execute v_new;
end
$migration$;

create or replace function public.partner_delete_complaint(p_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_org bigint;
  v_before jsonb;
begin
  if not exists (
    select 1 from complaints c
    where c.id = p_id and c.deleted_at is null
      and c.building_id in (select partner_org_building_ids()) and c.assigned_to = v_uid
  ) then
    raise exception 'forbidden: not your complaint';
  end if;
  select c.org_id, jsonb_build_object('building_id', c.building_id, 'unit_id', c.unit_id,
      'category_id', c.category_id, 'content', c.content, 'status', c.status, 'completed_at', c.completed_at)
    into v_org, v_before from complaints c where c.id = p_id for update;
  update complaints set deleted_at = now() where id = p_id;
  -- 0297: 삭제 감사 로그
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
    values (v_org, v_uid, 'COMPLAINT_PARTNER_DELETE', 'complaints', p_id::text, v_before, null);
end
$function$;
