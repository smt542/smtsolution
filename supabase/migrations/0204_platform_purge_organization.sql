-- 0204: 통합관리자 테넌트 완전 삭제(정본 admin/tenants 상세 모달 [삭제]). 되돌릴 수 없다.
--
-- 조직에 딸린 데이터(건물·세대·입주·부과·수납·메시지·공지·설정·직원 소속 등)는 organizations FK CASCADE로 지워진다.
-- CASCADE로 안 지워지는 것은 이 함수가 먼저 지운다:
--   - RESTRICT/NO ACTION: provider_dispatch_jobs(발송 작업), message_point_reservations(포인트 예약),
--     platform_billing_invoices(본사 월 청구서)
--   - append-only 포인트 원장 point_transactions: 트리거가 이 함수가 표시한 조직의 삭제만 통과시킨다
--   - FK 없는 audit_log·access_log(CASCADE 중 장기수선 원장 감사 트리거가 audit_log에 새로 쓴 행 포함)
-- 로그인 계정(auth.users)과 저장소 파일은 SQL로 지우지 않고 대상을 돌려준다 — 서버 라우트(service role)가 정리한다.
-- 통합관리자 계정이 속한 조직은 거절한다(지우면 그 계정의 통합관리자 권한도 사라진다).

create or replace function public.prevent_point_transaction_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 테넌트 완전 삭제(platform_purge_organization)가 같은 트랜잭션에서 표시한 조직의 삭제만 허용한다.
  if tg_op = 'DELETE'
     and old.org_id is not null
     and current_setting('app.purge_org_id', true) = old.org_id::text then
    return old;
  end if;
  raise exception 'point transactions are append-only' using errcode = '55000';
end
$$;

create or replace function public.platform_purge_organization(p_org_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract_path text;
  v_user_ids uuid[];
  v_contract_objects text[];
  v_attachment_objects text[];
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;

  select organization.contract_file_path
  into v_contract_path
  from public.organizations organization
  where organization.id = p_org_id
  for update;
  if not found then
    raise exception 'organization not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.org_members member
    where member.org_id = p_org_id
      and member.role = 'platform_admin'::public.org_member_role
  ) then
    raise exception 'organization has platform admin members'
      using errcode = 'P0001', hint = 'PLATFORM_ADMIN_MEMBER';
  end if;

  -- 로그인 계정까지 지울 직원: 이 조직에만 속하고 세입자 계정도 아닌 사람.
  select coalesce(array_agg(member.user_id), '{}')
  into v_user_ids
  from public.org_members member
  where member.org_id = p_org_id
    and not exists (
      select 1 from public.org_members other
      where other.user_id = member.user_id and other.org_id <> p_org_id
    )
    and not exists (
      select 1 from public.resident_identities identity
      where identity.user_id = member.user_id
    );

  select coalesce(array_agg(object.name), '{}')
  into v_contract_objects
  from storage.objects object
  where object.bucket_id = 'org-contracts'
    and (object.name like p_org_id::text || '/%' or object.name = v_contract_path);

  select coalesce(array_agg(object.name), '{}')
  into v_attachment_objects
  from storage.objects object
  where object.bucket_id = 'attachments'
    and object.name like p_org_id::text || '/%';

  perform set_config('app.purge_org_id', p_org_id::text, true);

  delete from public.provider_dispatch_jobs job where job.org_id = p_org_id;
  delete from public.point_transactions tx where tx.org_id = p_org_id;
  delete from public.message_point_reservations reservation where reservation.org_id = p_org_id;
  delete from public.platform_billing_invoices invoice where invoice.org_id = p_org_id;
  delete from public.organizations organization where organization.id = p_org_id;
  delete from public.audit_log log where log.org_id = p_org_id;
  delete from public.access_log log where log.org_id = p_org_id;

  return jsonb_build_object(
    'user_ids', to_jsonb(v_user_ids),
    'contract_objects', to_jsonb(v_contract_objects),
    'attachment_objects', to_jsonb(v_attachment_objects)
  );
end
$$;

revoke all on function public.platform_purge_organization(bigint) from public, anon;
grant execute on function public.platform_purge_organization(bigint) to authenticated;
