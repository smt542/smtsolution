-- Allow bill-publishing staff to mint public bill tokens in bulk.
-- Depends on 0002 (staff org/module helpers), 0013 (confirmed bills),
-- and 0040 (bill_share_tokens).

create or replace function public.staff_mint_bill_tokens(
  p_unit_ids bigint[],
  p_period date
)
returns table (
  unit_id bigint,
  token uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_org bigint;
begin
  v_org := public.current_user_org();
  if v_org is null then
    raise exception 'no org' using errcode = '42501';
  end if;

  if not public.current_user_has_module('bill_publish') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with target_units as (
    select distinct u.id as unit_id
    from unnest(p_unit_ids) as requested(unit_id)
    join public.units u
      on u.id = requested.unit_id
     and u.deleted_at is null
    join public.buildings b
      on b.id = u.building_id
     and b.org_id = v_org
    join public.billing_confirmations bc
      on bc.unit_id = u.id
     and bc.period = p_period
     and bc.confirmed_at is not null
  ), inserted as (
    insert into public.bill_share_tokens (
      org_id,
      unit_id,
      period,
      created_by,
      expires_at
    )
    select
      v_org,
      target_units.unit_id,
      p_period,
      auth.uid(),
      now() + interval '1 year'
    from target_units
    on conflict (unit_id, period) do update
      set expires_at = excluded.expires_at
    returning bill_share_tokens.unit_id, bill_share_tokens.token
  )
  select inserted.unit_id, inserted.token
  from inserted;
end;
$$;

revoke all on function public.staff_mint_bill_tokens(bigint[], date) from public, anon;
grant execute on function public.staff_mint_bill_tokens(bigint[], date) to authenticated;
