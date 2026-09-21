-- 클라이언트가 보낸 전화번호를 신뢰하지 않고 ref의 ID로 서버에서 해석한다.
-- 서버 마스킹을 선행할 수 있게 하며, 해석 실패는 빈 번호로 처리해 fail-closed 한다.
create or replace function public.resolve_message_point_quote(
  p_org_id bigint,
  p_mode text,
  p_recipients jsonb,
  p_template_id bigint default null,
  p_body text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_original_count integer;
  v_resolved_recipients jsonb;
  v_recipient_costs jsonb;
  v_resolved_count integer;
  v_sms_count integer;
  v_lms_count integer;
  v_alimtalk_count integer;
  v_estimated_points bigint;
  v_too_long_count integer;
  v_sms_rate_id bigint;   v_sms_points integer;
  v_lms_rate_id bigint;   v_lms_points integer;
  v_alimtalk_rate_id bigint; v_alimtalk_points integer;
begin
  if p_mode not in ('sms', 'alimtalk', 'auto') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MODE',
      'message', '발송 모드는 SMS, 알림톡, 자동 중 하나여야 합니다.');
  end if;
  if p_recipients is null or jsonb_typeof(p_recipients) <> 'array'
    or jsonb_array_length(p_recipients) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_RECIPIENTS',
      'message', '수신처가 한 명 이상 필요합니다.');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_recipients) recipient(value)
    where jsonb_typeof(recipient.value) <> 'object'
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_RECIPIENTS',
      'message', '수신처 형식이 올바르지 않습니다.');
  end if;
  if p_mode in ('alimtalk', 'auto') and p_template_id is null then
    return jsonb_build_object('ok', false, 'code', 'TEMPLATE_REQUIRED',
      'message', '알림톡 또는 자동 모드는 템플릿이 필요합니다.');
  end if;
  if p_template_id is not null and not exists (
    select 1 from public.message_templates template
    where template.id = p_template_id and template.org_id = p_org_id
      and template.deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'TEMPLATE_NOT_FOUND',
      'message', '사용 가능한 템플릿을 찾지 못했습니다.');
  end if;

  -- 세대/건물주/직원 참조가 조직 소속인지 검증(0037과 동일 규칙)
  if exists (
    select 1 from jsonb_array_elements(p_recipients) recipient(value)
    where nullif(recipient.value->'ref'->>'occupancyId', '') is not null
      and recipient.value->'ref'->>'occupancyId' !~ '^[0-9]+$'
  ) or exists (
    select 1 from jsonb_array_elements(p_recipients) recipient(value)
    where nullif(recipient.value->'ref'->>'occupancyId', '') is not null
      and not exists (
        select 1 from public.occupancies occupancy
        join public.units unit on unit.id = occupancy.unit_id
        join public.buildings building on building.id = unit.building_id and building.org_id = p_org_id
        where occupancy.id = case
          when recipient.value->'ref'->>'occupancyId' ~ '^[0-9]+$'
            then (recipient.value->'ref'->>'occupancyId')::bigint else null end
          and occupancy.deleted_at is null and unit.deleted_at is null
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'RECIPIENT_OUTSIDE_ORG',
      'message', '다른 조직이거나 존재하지 않는 세대 수신처가 포함되어 있습니다.');
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_recipients) recipient(value)
    where recipient.value->>'kind' = 'owner'
      and (
        nullif(recipient.value->'ref'->>'buildingId', '') is null
        or recipient.value->'ref'->>'buildingId' !~ '^[0-9]+$'
        or not exists (
          select 1 from public.buildings building
          where building.id = case
            when recipient.value->'ref'->>'buildingId' ~ '^[0-9]+$'
              then (recipient.value->'ref'->>'buildingId')::bigint else null end
            and building.org_id = p_org_id and building.deleted_at is null
        )
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'RECIPIENT_OUTSIDE_ORG',
      'message', '다른 조직이거나 존재하지 않는 건물주 수신처가 포함되어 있습니다.');
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_recipients) recipient(value)
    where recipient.value->>'kind' = 'staff'
      and (
        nullif(recipient.value->'ref'->>'userId', '') is null
        or not exists (
          select 1 from public.org_members member
          join public.profiles profile on profile.user_id = member.user_id
          where member.org_id = p_org_id
            and member.user_id::text = recipient.value->'ref'->>'userId'
            and profile.is_active
        )
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'RECIPIENT_OUTSIDE_ORG',
      'message', '다른 조직이거나 비활성인 직원 수신처가 포함되어 있습니다.');
  end if;

  -- 문자 제품(sms/lms) 판정은 아래 CTE에서 수신자별 최종 본문(renderedBody, 없으면 공통 p_body)으로 수행한다.
  -- 2000바이트 초과 수신자는 집계 후 접수 전 거절한다.
  select rate.id, rate.points into v_sms_rate_id, v_sms_points
  from public.message_point_rates rate where rate.channel = 'sms' and rate.effective_to is null;
  select rate.id, rate.points into v_lms_rate_id, v_lms_points
  from public.message_point_rates rate where rate.channel = 'lms' and rate.effective_to is null;
  select rate.id, rate.points into v_alimtalk_rate_id, v_alimtalk_points
  from public.message_point_rates rate where rate.channel = 'alimtalk' and rate.effective_to is null;

  v_original_count := jsonb_array_length(p_recipients);

  with raw as (
    select recipient.value, recipient.ordinality,
      regexp_replace(
        coalesce(
          case
            when recipient.value->>'kind' = 'tenant' then (
              select case
                when recipient.value->>'phoneType' = 'secondary' then o.phone2
                else o.phone
              end
              from public.occupancies o
              join public.units u on u.id = o.unit_id
              join public.buildings b on b.id = u.building_id and b.org_id = p_org_id
              where o.id = case
                when recipient.value->'ref'->>'occupancyId' ~ '^[0-9]+$'
                  then (recipient.value->'ref'->>'occupancyId')::bigint else null end
                and o.deleted_at is null
            )
            when recipient.value->>'kind' = 'owner' then (
              select b.owner_phone
              from public.buildings b
              where b.id = case
                when recipient.value->'ref'->>'buildingId' ~ '^[0-9]+$'
                  then (recipient.value->'ref'->>'buildingId')::bigint else null end
                and b.org_id = p_org_id and b.deleted_at is null
            )
            when recipient.value->>'kind' in ('staff', 'cleaner') then (
              select p.phone
              from public.profiles p
              join public.org_members m on m.user_id = p.user_id and m.org_id = p_org_id
              where p.user_id::text = recipient.value->'ref'->>'userId'
            )
            else null
          end,
          ''
        ),
        '[^0-9]', '', 'g'
      ) as normalized_phone
    from jsonb_array_elements(p_recipients) with ordinality as recipient(value, ordinality)
  ),
  deduplicated as (
    select raw.* from (
      select raw.*,
        row_number() over (partition by raw.normalized_phone order by raw.ordinality) as duplicate_rank
      from raw where raw.normalized_phone <> ''
    ) raw where raw.duplicate_rank = 1
  ),
  routed as (
    select deduplicated.value, deduplicated.ordinality, deduplicated.normalized_phone,
      case
        when p_mode = 'sms' then 'sms'
        when deduplicated.value->>'kind' in ('owner', 'staff', 'vendor', 'etc') then 'sms'
        when coalesce((
          select occupancy.alimtalk_opt_in
          from public.occupancies occupancy
          join public.units unit on unit.id = occupancy.unit_id
          join public.buildings building on building.id = unit.building_id and building.org_id = p_org_id
          where occupancy.id = case
            when deduplicated.value->'ref'->>'occupancyId' ~ '^[0-9]+$'
              then (deduplicated.value->'ref'->>'occupancyId')::bigint else null end
            and occupancy.deleted_at is null
        ), false) then 'alimtalk'
        when p_mode = 'alimtalk' then null
        else 'sms'
      end as resolved_channel
    from deduplicated
  ),
  producted as (
    -- 수신자별 최종 본문(renderedBody 우선, 없으면 공통 p_body)으로 sms/lms를 판정한다.
    -- recipient_costs.product가 실제 접수 본문과 일치하도록 per-recipient로 분류한다.
    select routed.*,
      case
        when routed.resolved_channel = 'alimtalk' then 'alimtalk'
        when routed.resolved_channel = 'sms'
          then public.classify_message_product(
                 coalesce(nullif(routed.value->>'renderedBody', ''), p_body))
        else null
      end as product
    from routed
  ),
  priced as (
    select producted.*,
      case producted.product
        when 'sms' then v_sms_rate_id
        when 'lms' then v_lms_rate_id
        when 'alimtalk' then v_alimtalk_rate_id
      end as rate_id,
      case producted.product
        when 'sms' then v_sms_points
        when 'lms' then v_lms_points
        when 'alimtalk' then v_alimtalk_points
      end as recipient_points,
      encode(extensions.digest(producted.normalized_phone, 'sha256'), 'hex') as recipient_key
    from producted
    where producted.resolved_channel is not null
  )
  select
    coalesce(jsonb_agg(
      priced.value || jsonb_build_object('channel', priced.resolved_channel, 'product', priced.product, 'phone', priced.normalized_phone)
      order by priced.ordinality), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'recipient_key', priced.recipient_key,
      'phone_hash', priced.recipient_key,
      'ref', coalesce(priced.value->'ref', '{}'::jsonb),
      'channel', priced.resolved_channel,
      'product', priced.product,
      'rate_id', priced.rate_id,
      'points', priced.recipient_points
    ) order by priced.ordinality), '[]'::jsonb),
    count(*)::integer,
    count(*) filter (where priced.product = 'sms')::integer,
    count(*) filter (where priced.product = 'lms')::integer,
    count(*) filter (where priced.product = 'alimtalk')::integer,
    coalesce(sum(priced.recipient_points), 0)::bigint,
    count(*) filter (where priced.product = 'too_long')::integer
  into v_resolved_recipients, v_recipient_costs, v_resolved_count,
       v_sms_count, v_lms_count, v_alimtalk_count, v_estimated_points,
       v_too_long_count
  from priced;

  -- 어느 수신자의 최종 본문이든 2000바이트를 초과하면 접수 전 거절한다.
  if v_too_long_count > 0 then
    return jsonb_build_object('ok', false, 'code', 'MESSAGE_TOO_LONG',
      'message', '본문이 2,000바이트를 초과했습니다. 내용을 줄여 주세요.');
  end if;

  if v_resolved_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'NO_ELIGIBLE_RECIPIENTS',
      'message', '발송 가능한 수신처가 없습니다.', 'excluded_count', v_original_count);
  end if;

  -- 실제 사용되는 제품의 단가가 없으면 명시적으로 실패한다(LMS 미설정 포함).
  if (v_sms_count > 0 and v_sms_rate_id is null)
     or (v_lms_count > 0 and v_lms_rate_id is null)
     or (v_alimtalk_count > 0 and v_alimtalk_rate_id is null) then
    return jsonb_build_object('ok', false, 'code', 'RATE_NOT_CONFIGURED',
      'message', '사용하려는 메시지 제품의 단가가 설정되지 않았습니다.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'resolved_recipients', v_resolved_recipients,
    'recipient_costs', v_recipient_costs,
    'excluded_count', v_original_count - v_resolved_count,
    'counts', jsonb_build_object('total', v_resolved_count,
      'sms', v_sms_count, 'lms', v_lms_count, 'alimtalk', v_alimtalk_count),
    'rate_ids', jsonb_build_object(
      'sms', v_sms_rate_id, 'lms', v_lms_rate_id, 'alimtalk', v_alimtalk_rate_id),
    'rate_snapshot', jsonb_build_object(
      'sms', jsonb_build_object('id', v_sms_rate_id, 'points', v_sms_points),
      'lms', jsonb_build_object('id', v_lms_rate_id, 'points', v_lms_points),
      'alimtalk', jsonb_build_object('id', v_alimtalk_rate_id, 'points', v_alimtalk_points)),
    'estimated_points', v_estimated_points
  );
end
$$;
