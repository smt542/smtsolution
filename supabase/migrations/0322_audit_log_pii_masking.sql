-- 본사 감사 로그 상세의 개인정보 마스킹(서버 측).
--
-- platform_list_audit_logs 가 audit_log.before/after(행 스냅샷 jsonb)를 원문 그대로 내려
-- 감사 로그 상세에서 입주자 이름·연락처·주소·계좌 등이 그대로 보였다.
-- 클라이언트 마스킹은 응답에 원문이 남아 의미가 없으므로, RPC 응답 단계에서 키 이름 기준으로 마스킹한다.
--   - 원본 audit_log 는 그대로 둔다(감사 원장 불변). 본사 조회 경로(이 RPC)만 가린다.
--   - 하위 객체·배열까지 재귀(owner_extra, vendor_details.fields, phones_extra 등).
--   - 규칙: 이름 박O호 · 전화 010-****-7788(mask_phone) · 이메일 ab***@도메인 ·
--     주소 앞 2어절만 · 상세주소 *** · 계좌·차량번호 끝 4자리만 · 비밀번호·인증정보 ****.
--   - memo 등 자유 입력 텍스트·건물명·업체명(name)은 감사 판단에 필요해 가리지 않는다.

-- 키 이름 → 마스킹 종류. null = 마스킹 안 함.
create or replace function public.audit_pii_kind(p_key text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when p_key is null then null
    when p_key ~* '(password|passwd|pwd|secret|token|birth|rrn|ssn|bill_auth_info)'
      or p_key ~ '(비밀번호|주민|생년월일|인증)' then 'secret'
    when p_key ~* '(^|_)e_?mail$' or p_key ~ '이메일' then 'email'
    -- 전화를 이름보다 먼저 본다('담당자 연락처' 같은 키는 전화 규칙으로).
    when p_key ~* '(^|_)(phone|phones|mobile|tel|telephone|fax)(\d+|sub|_?number|_?no|_extra)?$'
      or p_key ~ '(전화|연락처|휴대폰|팩스)' then 'phone'
    when p_key ~* '^(holder|contact_person|depositor|representative|billing_account_holder|account_holder)$'
      or p_key ~* '(^|_)(tenant|payer|owner|holder|contact|representative|kakao|resident|depositor|full|guardian|emergency)_?name$'
      or p_key ~ '(예금주|성명|이름|대표자|입주자|납부자|소유자|담당자)' then 'name'
    when p_key ~* '(^|_)address_?detail$' or p_key ~ '상세주소' then 'address_detail'
    when p_key ~* '(^|_)(address|addr)$' or p_key ~ '주소' then 'address'
    when p_key ~* '(^|_)(bank_)?account(_no|_number)?$' or p_key ~ '계좌' then 'tail4'
    when p_key ~* 'vehicle' or p_key ~ '차량' then 'tail4'
    else null
  end;
$function$;

-- 끝 4자리(숫자·문자 무관, 공백·하이픈 제외)만 남기고 가린다. 구분자는 유지한다.
create or replace function public.audit_mask_tail4(p_value text)
 returns text
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare
  v_out text := '';
  v_keep integer := 4;
  v_ch text;
  i integer;
begin
  if p_value is null then return null; end if;
  for i in reverse char_length(p_value)..1 loop
    v_ch := substr(p_value, i, 1);
    if v_ch ~ '[\s\-]' then
      v_out := v_ch || v_out;
    elsif v_keep > 0 then
      v_out := v_ch || v_out;
      v_keep := v_keep - 1;
    else
      v_out := '*' || v_out;
    end if;
  end loop;
  return v_out;
end;
$function$;

create or replace function public.audit_mask_text(p_kind text, p_value text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when p_value is null or btrim(p_value) = '' then p_value
    when p_kind = 'secret' then '****'
    when p_kind = 'name' then
      case char_length(btrim(p_value))
        when 1 then 'O'
        when 2 then left(btrim(p_value), 1) || 'O'
        else left(btrim(p_value), 1) || repeat('O', char_length(btrim(p_value)) - 2) || right(btrim(p_value), 1)
      end
    when p_kind = 'phone' then public.mask_phone(p_value)
    when p_kind = 'email' then
      case when position('@' in p_value) > 1
        then left(split_part(p_value, '@', 1), 2) || '***@' || split_part(p_value, '@', 2)
        else '***'
      end
    when p_kind = 'address' then
      (select case when count(*) <= 2 then min(t.w) filter (where t.n = 1) || ' ***'
                   else string_agg(t.w, ' ' order by t.n) filter (where t.n <= 2) || ' ***' end
         from regexp_split_to_table(btrim(p_value), '\s+') with ordinality t(w, n))
    when p_kind = 'address_detail' then '***'
    when p_kind = 'tail4' then public.audit_mask_tail4(p_value)
    else p_value
  end;
$function$;

-- jsonb 를 재귀로 돌며 키 이름 기준으로 값을 가린다. 배열 원소는 부모 키를 따른다.
create or replace function public.audit_mask_jsonb(p_value jsonb, p_key text default null)
 returns jsonb
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare
  v_kind text;
  v_out jsonb;
begin
  if p_value is null then return null; end if;
  case jsonb_typeof(p_value)
    when 'object' then
      select coalesce(jsonb_object_agg(e.key, public.audit_mask_jsonb(e.value, e.key)), '{}'::jsonb)
        into v_out from jsonb_each(p_value) e;
      return v_out;
    when 'array' then
      select coalesce(jsonb_agg(public.audit_mask_jsonb(e.value, p_key) order by e.ord), '[]'::jsonb)
        into v_out from jsonb_array_elements(p_value) with ordinality e(value, ord);
      return v_out;
    when 'string' then
      v_kind := public.audit_pii_kind(p_key);
      if v_kind is null then return p_value; end if;
      return to_jsonb(public.audit_mask_text(v_kind, p_value #>> '{}'));
    when 'number' then
      -- 숫자로 저장된 계좌·비밀번호류만 가린다(요금·건수 등 숫자는 그대로).
      v_kind := public.audit_pii_kind(p_key);
      if v_kind in ('secret', 'tail4') then
        return to_jsonb(public.audit_mask_text(v_kind, p_value #>> '{}'));
      end if;
      return p_value;
    else
      return p_value;
  end case;
end;
$function$;

revoke all on function public.audit_pii_kind(text) from public, anon;
revoke all on function public.audit_mask_tail4(text) from public, anon;
revoke all on function public.audit_mask_text(text, text) from public, anon;
revoke all on function public.audit_mask_jsonb(jsonb, text) from public, anon;
grant execute on function public.audit_pii_kind(text) to authenticated;
grant execute on function public.audit_mask_tail4(text) to authenticated;
grant execute on function public.audit_mask_text(text, text) to authenticated;
grant execute on function public.audit_mask_jsonb(jsonb, text) to authenticated;

-- 응답 단계(페이지 행만)에서 before/after 를 마스킹한다. 나머지는 기존 정의와 동일.
create or replace function public.platform_list_audit_logs(p_search text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id bigint, created_at timestamp with time zone, org_id bigint, org_name text, actor_id uuid, actor_username text, actor_name text, action text, category text, table_name text, row_pk text, before jsonb, after jsonb, ip text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  return query
  with filtered as (
    select log.id, log.created_at, log.org_id, org.name as org_name, log.actor_id,
      profile.username as actor_username, profile.full_name as actor_name, log.action,
      public.audit_log_category(log.action) as category, log.table_name, log.row_pk,
      log.before, log.after, host(log.ip) as ip
    from public.audit_log log
    left join public.organizations org on org.id = log.org_id
    left join public.profiles profile on profile.user_id = log.actor_id
    where (p_from is null or log.created_at >= (p_from::timestamp at time zone 'Asia/Seoul'))
      and (p_to is null or log.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Seoul'))
      and (v_category is null or public.audit_log_category(log.action) = v_category)
      and (v_search is null or log.action ilike '%' || v_search || '%'
        or coalesce(log.table_name, '') ilike '%' || v_search || '%'
        or coalesce(org.name, '') ilike '%' || v_search || '%'
        or coalesce(profile.username, '') ilike '%' || v_search || '%'
        or coalesce(profile.full_name, '') ilike '%' || v_search || '%')
    union all
    select (- al.id) as id, al.created_at, al.org_id, org.name as org_name, al.actor_id,
      profile.username as actor_username, coalesce(profile.full_name, al.actor_label) as actor_name,
      al.event as action, public.audit_log_category(al.event) as category,
      al.target_kind as table_name, al.target_id as row_pk, null::jsonb as before,
      jsonb_strip_nulls(jsonb_build_object('field', al.field, 'row_count', al.row_count, 'detail', al.detail)) as after,
      al.ip as ip
    from public.access_log al
    left join public.organizations org on org.id = al.org_id
    left join public.profiles profile on profile.user_id = al.actor_id
    where al.event like 'EXPORT\_%'
      and (p_from is null or al.created_at >= (p_from::timestamp at time zone 'Asia/Seoul'))
      and (p_to is null or al.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Seoul'))
      and (v_category is null or public.audit_log_category(al.event) = v_category)
      and (v_search is null or al.event ilike '%' || v_search || '%'
        or coalesce(al.target_kind, '') ilike '%' || v_search || '%'
        or coalesce(org.name, '') ilike '%' || v_search || '%'
        or coalesce(profile.username, '') ilike '%' || v_search || '%'
        or coalesce(profile.full_name, '') ilike '%' || v_search || '%'
        or coalesce(al.actor_label, '') ilike '%' || v_search || '%')
  ), counted as (select filtered.*, count(*) over ()::bigint as total_count from filtered)
  select counted.id, counted.created_at, counted.org_id, counted.org_name, counted.actor_id,
    counted.actor_username, counted.actor_name, counted.action, counted.category,
    counted.table_name, counted.row_pk,
    public.audit_mask_jsonb(counted.before), public.audit_mask_jsonb(counted.after),
    counted.ip, counted.total_count
  from counted
  order by counted.created_at desc, counted.id desc
  limit greatest(1, least(100, coalesce(p_limit, 20)))
  offset greatest(0, coalesce(p_offset, 0));
end $function$;
