-- 원문 열람의 persona 게이트를 함수 안으로 옮긴다 — 왕복 4회 → 1회.
--
-- 0185 로 "레코드 읽기 + 감사로그"를 한 왕복으로 합쳤지만, 라우트 앞단의 인증 게이트가
-- 아직 3회를 쓰고 있었다(`requirePersonaApi`: auth.getUser → current_user_is_* → get_my_context).
-- 실측 389~452ms 중 대부분이 이 셋이다.
--
-- persona 판정을 TS 로 옮겨 적는 방법도 있었지만(`get_my_context` 의 role·staff_capabilities 로
-- 재현), **인가 규칙을 두 언어에 복제하는 셈**이라 규칙이 갈라지면 구멍이 난다. 대신 이미
-- 같은 트랜잭션 안에서 도는 이 함수가 직접 판정한다 — 프레디킷(current_user_is_*)이 그대로
-- 유일한 기준으로 남는다.
--
-- 반환 status 에 'forbidden' 이 추가된다. 라우트는 이걸 403 으로 옮긴다.
--   ok        → 200
--   forbidden → 403 (로그인은 했지만 직원·파트너·플랫폼관리자가 아님. 예: 세입자)
--   not_found → 404 (행 없음 / 파트너 담당 건물 밖 — 존재 여부를 흘리지 않는다)
-- 세션이 아예 없으면 PostgREST 가 함수 실행 권한(authenticated)에서 막으므로 라우트가 401 로 옮긴다.
--
-- 본문은 0185 에서 **맨 앞 게이트만** 추가했다. 그 외는 동일하다.

create or replace function reveal_pii_fields(
  p_target_kind text,
  p_target_id text,
  p_fields text[],
  p_ip text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  v_from text;
  v_id_expr text;
  v_id_is_uuid boolean := false;
  v_org_expr text;
  v_building_expr text;
  v_allowed text[];
  v_field text;
  v_json_args text := '';
  v_sql text;
  v_org_id bigint;
  v_building_id bigint;
  v_values jsonb;
begin
  -- 인력 persona 만 원문을 열 수 있다. 판정 기준은 기존 라우트가 쓰던 프레디킷 그대로다.
  if not (
    current_user_is_manager_staff()
    or current_user_is_platform_admin()
    or current_user_is_field_partner()
  ) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if p_fields is null or array_length(p_fields, 1) is null then
    raise exception 'fields required' using errcode = '22023';
  end if;
  -- 한 레코드에서 한 번에 열람할 수 있는 필드 수 상한(라우트의 MAX_REVEAL_FIELDS 와 같다).
  if array_length(p_fields, 1) > 8 then
    raise exception 'too many fields' using errcode = '22023';
  end if;

  -- 열람 대상 화이트리스트. route.ts 의 REVEAL_TARGETS 와 짝이며, 라우트가 1차로 거르고
  -- 여기서 한 번 더 막는다(어느 한쪽만 고치면 여기서 22023 으로 떨어진다).
  -- org/building 은 행이 늘어나지 않도록 스칼라 서브쿼리로 뽑는다.
  case p_target_kind
    when 'occupancy' then
      v_from := 'occupancies o'; v_id_expr := 'o.id';
      v_org_expr := '(select b.org_id from units u join buildings b on b.id = u.building_id where u.id = o.unit_id)';
      v_building_expr := '(select u.building_id from units u where u.id = o.unit_id)';
      v_allowed := array['phone', 'phone2', 'phone3', 'fax_number'];
    when 'occupancy_history' then
      v_from := 'occupancy_history o'; v_id_expr := 'o.id';
      v_org_expr := '(select b.org_id from units u join buildings b on b.id = u.building_id where u.id = o.unit_id)';
      v_building_expr := '(select u.building_id from units u where u.id = o.unit_id)';
      v_allowed := array['phone', 'phone2', 'phone3'];
    when 'complaint' then
      v_from := 'complaints o'; v_id_expr := 'o.id';
      v_org_expr := 'o.org_id'; v_building_expr := 'o.building_id';
      v_allowed := array['reporter_phone'];
    when 'building' then
      v_from := 'buildings o'; v_id_expr := 'o.id';
      v_org_expr := 'o.org_id'; v_building_expr := 'o.id';
      v_allowed := array['owner_phone'];
    when 'vendor' then
      -- 거래처는 org 자산이라 건물에 매이지 않는다 → 파트너는 열 수 없다.
      v_from := 'vendors o'; v_id_expr := 'o.id';
      v_org_expr := 'o.org_id'; v_building_expr := 'null::bigint';
      v_allowed := array['phone'];
    when 'building_vendor' then
      v_from := 'building_vendors o'; v_id_expr := 'o.id';
      v_org_expr := '(select b.org_id from buildings b where b.id = o.building_id)';
      v_building_expr := 'o.building_id';
      v_allowed := array['phone'];
    when 'profile' then
      -- profiles 는 org_members 와 FK가 없다. 소속이 여러 개면 가장 작은 org_id(기존 라우트의
      -- order by org_id limit 1 과 동일). 소속이 끊긴 뒤에도 프로필은 남으므로 null 일 수 있다.
      v_from := 'profiles o'; v_id_expr := 'o.user_id'; v_id_is_uuid := true;
      v_org_expr := '(select min(m.org_id) from org_members m where m.user_id = o.user_id)';
      v_building_expr := 'null::bigint';
      v_allowed := array['phone', 'phone_sub'];
    else
      raise exception 'unknown target kind' using errcode = '22023';
  end case;

  foreach v_field in array p_fields loop
    if not (v_field = any (v_allowed)) then
      raise exception 'unknown field' using errcode = '22023';
    end if;
    -- 화이트리스트를 통과한 이름만 식별자로 쓴다(quote_ident 로 한 번 더 감싼다).
    v_json_args := v_json_args
      || case when v_json_args = '' then '' else ', ' end
      || quote_literal(v_field) || ', o.' || quote_ident(v_field);
  end loop;

  v_sql := format(
    'select %s, %s, jsonb_build_object(%s) from %s where %s = %s',
    v_org_expr,
    v_building_expr,
    v_json_args,
    v_from,
    v_id_expr,
    case when v_id_is_uuid then quote_literal(p_target_id) || '::uuid'
         else quote_literal(p_target_id) || '::bigint' end
  );

  -- security invoker 라 이 select 는 호출자 권한으로 돈다 → RLS 가 그대로 경계를 지킨다.
  execute v_sql into v_org_id, v_building_id, v_values;

  if v_values is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- 현장 파트너는 담당 건물 밖을 열 수 없다. occupancies 등의 RLS 는 org 단위라 이 경계를
  -- 막지 못한다(파트너도 org 구성원이다). 매니저·플랫폼 관리자는 이 검사를 받지 않는다.
  if current_user_is_field_partner()
     and not current_user_is_manager_staff()
     and not current_user_is_platform_admin() then
    if v_building_id is null
       or not exists (select 1 from partner_my_building_ids() b(id) where b.id = v_building_id) then
      return jsonb_build_object('status', 'not_found');
    end if;
  end if;

  -- profiles 처럼 소속이 끊긴 대상은 행위자의 org 를 감사 범위로 쓴다(기존 라우트와 동일).
  if v_org_id is null then
    v_org_id := current_user_org();
  end if;
  if v_org_id is null then
    raise exception 'owner organization could not be resolved' using errcode = '22023';
  end if;

  -- 같은 트랜잭션이다 — 기록이 실패하면 함수가 통째로 롤백돼 원문이 나가지 않는다.
  perform log_pii_reveal(
    v_org_id, p_target_kind, p_target_id,
    array_to_string(p_fields, ','), array_length(p_fields, 1),
    p_ip, p_user_agent
  );

  return jsonb_build_object('status', 'ok', 'org_id', v_org_id, 'values', v_values);
end;
$$;

revoke execute on function reveal_pii_fields(text, text, text[], text, text) from public, anon;
grant execute on function reveal_pii_fields(text, text, text[], text, text) to authenticated;

notify pgrst, 'reload schema';
