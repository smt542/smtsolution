-- LOGIN audit entries are server-owned. Client roles must not be able to invoke
-- the legacy auth.uid()-based overload with a caller-supplied IP address.
revoke execute on function public.record_login(text) from public, anon, authenticated;

-- The login route handlers call this overload through the service-role client
-- after authentication succeeds. The actor ID and IP both come from server-side
-- state, and organization selection remains equivalent to the legacy function.
create or replace function public.record_login(
  p_actor_id uuid,
  p_ip text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org bigint;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'record_login requires service_role'
      using errcode = '42501';
  end if;

  if p_actor_id is null then
    raise exception 'record_login requires an actor ID'
      using errcode = '22004';
  end if;

  select m.org_id
    into v_org
    from public.org_members m
    join public.organizations o on o.id = m.org_id
   where m.user_id = p_actor_id
   order by (o.status = 'active') desc, m.created_at
   limit 1;

  insert into public.audit_log(org_id, actor_id, action, ip)
  values (v_org, p_actor_id, 'LOGIN', nullif(p_ip, '')::inet);
end;
$$;

revoke all on function public.record_login(uuid, text) from public, anon, authenticated;
grant execute on function public.record_login(uuid, text) to service_role;
