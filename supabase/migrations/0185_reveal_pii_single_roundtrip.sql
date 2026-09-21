-- (최초 0184로 작성했으나 병렬 세션이 0184를 선점해 0185로 재번호했다. 라이브에는 이미
--  적용돼 있고 번호는 파일명 라벨일 뿐이다.)
-- 원문 열람(PII_REVEAL)을 "레코드 읽기 + 감사로그 기록" 한 번의 왕복으로 합친다.
--
-- 기존 /api/pii/reveal 은 순차 왕복이 5회였다(auth.getUser → persona RPC → get_my_context →
-- 레코드 select → access_log insert). 실측 470~680ms. 이 마이그는 뒤의 두 개(select+insert)를
-- 함수 하나로 합쳐 왕복을 1회 줄이고, 동시에 "감사로그가 남아야만 원문을 반환한다"는 보증을
-- 같은 트랜잭션 안으로 넣는다(기존엔 두 단계라 원자적이지 않았다).
--
-- ⚠️ 설계 핵심: 바깥 함수는 **security invoker**(기본값)다.
--    레코드 읽기가 호출자 권한으로 실행돼야 **RLS가 그대로 인가의 권위**로 남는다
--    (라우트 주석의 "RLS is the authority" 를 유지 — definer 로 만들면 org/건물 경계를
--    SQL에 복제해야 하고, 플랫폼 관리자의 교차 org 열람까지 재현해야 해 위험하다).
--    access_log 에는 INSERT 정책이 없으므로(기존엔 service_role 로 넣었다) 기록만
--    security definer 헬퍼로 분리한다.
--
-- 현장 파트너 건물 경계 검사도 함수 안으로 들어와, 파트너의 경우 왕복이 하나 더 줄어든다
-- (기존 route.ts 의 partner_my_building_ids 별도 호출).

-- =====================================================================
-- 감사로그 기록기 (security definer)
--   호출자가 직접 부를 수도 있으므로 위조 여지를 줄인다: event/actor/persona 는 인자로
--   받지 않고 내부에서 결정한다. 직접 호출해봐야 "자기 자신에 대한" PII_REVEAL 행이
--   한 줄 더 생길 뿐이고, 기존 행을 숨기거나 남의 행을 위조할 수는 없다.
-- =====================================================================
create or replace function log_pii_reveal(
  p_org_id bigint,
  p_target_kind text,
  p_target_id text,
  p_field text,
  p_row_count int,
  p_ip text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona text;
begin
  v_persona := case
    when current_user_is_manager_staff() then 'manager_staff'
    when current_user_is_platform_admin() then 'platform_admin'
    when current_user_is_field_partner() then 'field_partner'
    else null
  end;

  insert into access_log (
    org_id, actor_id, persona, event, target_kind, target_id, field, row_count, ip, user_agent
  ) values (
    p_org_id, auth.uid(), v_persona, 'PII_REVEAL',
    p_target_kind, p_target_id, p_field, p_row_count, p_ip, p_user_agent
  );
end;
$$;

revoke execute on function log_pii_reveal(bigint, text, text, text, int, text, text) from public, anon;
grant execute on function log_pii_reveal(bigint, text, text, text, int, text, text) to authenticated;

-- =====================================================================
-- 원문 열람 (security invoker — RLS가 그대로 적용된다)
--   반환: {"status":"ok","org_id":n,"values":{...}} | {"status":"not_found"}
--   not_found 는 "행이 없음"과 "파트너 담당 건물 밖"을 구분하지 않는다 — 존재 여부가
--   새지 않도록 라우트가 둘 다 404 로 응답하던 기존 동작 그대로다.
-- =====================================================================
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
      v_allowed := array['phone'];
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
