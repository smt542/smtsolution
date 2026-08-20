-- Resident self-service account withdrawal (회원 탈퇴).
-- Depends on 0039 (res_claims, resident_identities) and 0040 (resident_linked_unit).
--
-- Scope: the caller removes ONLY their own household link and Kakao identity.
--   * res_claims (pending / linked / rejected rows for the caller) are deleted.
--   * resident_identities (the caller's Kakao identity mapping) is deleted.
-- The auth.users account is intentionally RETAINED: real Kakao OAuth is still
-- stubbed, so a later re-login recreates the identity and restarts onboarding.
-- Household data on occupancies (name/phone/notify prefs) and any move_out_requests
-- are org-owned records and are left untouched.
--
-- Security: SECURITY DEFINER, self-only via auth.uid(); res_claims has no resident
-- UPDATE/DELETE RLS policy, so this RPC is the only resident path to release a link.

create function resident_withdraw()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id bigint;
  v_building_id bigint;
  v_unit_id bigint;
  v_occupancy_id bigint;
  v_claim_count int;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Best-effort linked context for the audit trail (null when only a pending claim exists).
  select org_id, building_id, unit_id, occupancy_id
    into v_org_id, v_building_id, v_unit_id, v_occupancy_id
  from resident_linked_unit();

  select count(*) into v_claim_count
  from res_claims
  where resident_user_id = v_uid;

  insert into audit_log (org_id, actor_id, action, table_name, row_pk, before, after)
  values (
    v_org_id,
    v_uid,
    'RESIDENT_WITHDRAW',
    'res_claims',
    v_uid::text,
    jsonb_build_object(
      'claim_count', v_claim_count,
      'building_id', v_building_id,
      'unit_id', v_unit_id,
      'occupancy_id', v_occupancy_id
    ),
    jsonb_build_object('withdrawn', true)
  );

  delete from res_claims where resident_user_id = v_uid;
  delete from resident_identities where user_id = v_uid;
end
$$;

revoke execute on function resident_withdraw() from anon, public;
grant execute on function resident_withdraw() to authenticated;
