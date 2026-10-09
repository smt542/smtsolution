-- 0270: 배포본비교 개선3차 17·21
--  17) 건물 목록 정렬(등록일 최신·오래된 순 / 항목별 검침일 빠른·늦은 순)을 DB에서 정렬한 뒤 페이지네이션한다.
--      (기존: 서버는 항상 등록일 최신순, 화면이 현재 페이지 20건 안에서만 뒤집거나 정렬)
--  21) 예약 반복에 「매주」와 「종료(횟수 지정)」를 추가하고, 예약 탭의 「반복 설정」 전환 RPC를 둔다.
--      정책: 사무실 관리자_문자·알림톡 관리.md 결정 로그 2026-08-13 "예약 · 예약(매월) · 예약(매주)",
--            "주기(매월/매주) · 발송일 · 종료(계속 반복/횟수 지정)".

-- ───────────────────────────── 17. list_buildings 정렬 ─────────────────────────────
-- 시그니처가 바뀌므로(p_sort, p_meter_kind 추가) 기존 오버로드를 지우고 다시 만든다(이름 인자 호출은 그대로 호환).
drop function if exists public.list_buildings(text, uuid, uuid, uuid, integer, integer);

create or replace function public.list_buildings(
  p_search text default null::text,
  p_manager uuid default null::uuid,
  p_meter uuid default null::uuid,
  p_cleaning uuid default null::uuid,
  p_limit integer default 20,
  p_offset integer default 0,
  p_sort text default 'created_desc',
  p_meter_kind text default null::text
)
 returns table(id bigint, code text, name text, address text, manager_user_id uuid, meter_user_id uuid, cleaning_user_id uuid, manager_name text, meter_name text, cleaning_name text, total_units bigint, occupied_units bigint, min_meter_day integer, total bigint, type_label text, owner_name text, owner_phone text, entrance_password text, created_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with base as (
    select b.*,
      -- 검침일 정렬 키: 지정 항목(수도·전기·가스·공용전기)의 고객번호 검침일 중 가장 이른 날. 항목 미지정이면 전체 항목.
      (select min(bcn.meter_day) from building_customer_numbers bcn
         where bcn.building_id = b.id and bcn.deleted_at is null
           and (p_meter_kind is null or bcn.kind = p_meter_kind)) as sort_meter_day
    from buildings b
    where b.org_id = current_user_org() and b.deleted_at is null
      and (p_search   is null or b.name ilike '%'||p_search||'%' or b.address ilike '%'||p_search||'%')
      and (p_manager  is null or b.manager_user_id  = p_manager)
      and (p_meter    is null or b.meter_user_id    = p_meter)
      and (p_cleaning is null or b.cleaning_user_id = p_cleaning)
  )
  select base.id, base.code, base.name, base.address,
    base.manager_user_id, base.meter_user_id, base.cleaning_user_id,
    mp.full_name, tp.full_name, cp.full_name,
    (select count(*) from units u where u.building_id = base.id and u.deleted_at is null),
    (select count(*) from units u join occupancies o on o.unit_id = u.id
       where u.building_id = base.id and u.deleted_at is null and o.deleted_at is null and o.status = 'occupied'),
    (select min(bcn.meter_day) from building_customer_numbers bcn where bcn.building_id = base.id and bcn.deleted_at is null),
    count(*) over(),
    bt.label, base.owner_name, base.owner_phone, base.entrance_password, base.created_at
  from base
  left join profiles mp on mp.user_id = base.manager_user_id
  left join profiles tp on tp.user_id = base.meter_user_id
  left join profiles cp on cp.user_id = base.cleaning_user_id
  left join building_types bt on bt.id = base.type_id and bt.org_id = current_user_org()
  order by
    -- 검침일이 없는 건물은 방향과 관계없이 뒤로 보낸다.
    case when p_sort = 'meter_day_asc'  then base.sort_meter_day end asc  nulls last,
    case when p_sort = 'meter_day_desc' then base.sort_meter_day end desc nulls last,
    case when p_sort in ('meter_day_asc', 'meter_day_desc') then base.code end asc,
    case when p_sort = 'created_asc' then base.created_at end asc,
    case when p_sort = 'created_asc' then base.id end asc,
    base.created_at desc,
    base.id desc
  limit p_limit offset p_offset
$function$;

revoke all on function public.list_buildings(text, uuid, uuid, uuid, integer, integer, text, text) from public, anon;
grant execute on function public.list_buildings(text, uuid, uuid, uuid, integer, integer, text, text) to authenticated, service_role;

-- ───────────────────────────── 21. 예약 반복(매주·종료 횟수) ─────────────────────────────
alter table public.message_schedules
  add column if not exists recurrence_end_count integer,
  add column if not exists recurrence_seq integer;

comment on column public.message_schedules.recurrence_end_count is
  '반복 종료 회차(이 회차까지 발송 후 다음 회차를 만들지 않음). null = 계속 반복';
comment on column public.message_schedules.recurrence_seq is
  '반복 시리즈 안에서의 회차 번호(1부터). null(과거 행)은 1회차로 본다';

alter table public.message_schedules drop constraint if exists message_schedules_recurrence_mode_check;
alter table public.message_schedules add constraint message_schedules_recurrence_mode_check
  check (recurrence_mode is null or recurrence_mode in ('monthly', 'weekly'));
alter table public.message_schedules drop constraint if exists message_schedules_recurrence_end_count_check;
alter table public.message_schedules add constraint message_schedules_recurrence_end_count_check
  check (recurrence_end_count is null or recurrence_end_count >= 1);
alter table public.message_schedules drop constraint if exists message_schedules_recurrence_seq_check;
alter table public.message_schedules add constraint message_schedules_recurrence_seq_check
  check (recurrence_seq is null or recurrence_seq >= 1);

-- schedule_messages: 'weekly' 허용 + 종료 횟수 인자. 시그니처 변경이므로 기존 오버로드 삭제 후 재생성.
drop function if exists public.schedule_messages(text, text, text, jsonb, bigint, timestamp with time zone, text, integer);

create or replace function public.schedule_messages(
  p_channel text, p_body text, p_context text, p_recipients jsonb, p_template_id bigint,
  p_scheduled_at timestamp with time zone,
  p_recurrence_mode text default null::text,
  p_recurrence_anchor_day integer default null::integer,
  p_recurrence_end_count integer default null::integer
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v_schedule_id bigint;
  v_count int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;
  if p_channel not in ('sms','alimtalk','auto') then
    raise exception 'invalid channel: sms|alimtalk|auto required';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'invalid body: nonempty text required';
  end if;
  if p_channel in ('alimtalk','auto') and p_template_id is null then
    raise exception 'invalid template: template required for alimtalk/auto';
  end if;
  if p_recipients is null or jsonb_typeof(p_recipients) <> 'array'
    or jsonb_array_length(p_recipients) = 0 then
    raise exception 'invalid recipients: nonempty JSON array required';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_recipients) r(recipient)
    where nullif(regexp_replace(r.recipient->>'phone', '[^0-9]', '', 'g'), '') is null
  ) then
    raise exception 'invalid recipients: every recipient phone must contain digits';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_recipients) r(recipient)
    where r.recipient->>'channel' = 'alimtalk'
      and not exists (
        select 1
        from occupancies o
        join units u on u.id = o.unit_id
        join buildings b on b.id = u.building_id and b.org_id = v_org
        where o.id = nullif(r.recipient->'ref'->>'occupancyId', '')::bigint
          and o.deleted_at is null
          and coalesce(o.alimtalk_opt_in, false)
      )
  ) then
    raise exception 'invalid recipients: alimtalk consent required';
  end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'invalid schedule: future time required';
  end if;
  if p_recurrence_mode is not null and p_recurrence_mode not in ('monthly', 'weekly') then
    raise exception 'invalid recurrence: null|monthly|weekly required';
  end if;
  if p_recurrence_end_count is not null and (p_recurrence_mode is null or p_recurrence_end_count < 1) then
    raise exception 'invalid recurrence end: positive count with recurrence required';
  end if;

  v_count := jsonb_array_length(p_recipients);
  insert into message_schedules(
    org_id, channel, body, context, recipient_count, recipients,
    template_id, scheduled_at, recurrence_mode, recurrence_anchor_day,
    recurrence_end_count, recurrence_seq, created_by
  ) values (
    v_org, p_channel, p_body, coalesce(p_context, 'manual'), v_count, p_recipients,
    p_template_id, p_scheduled_at, p_recurrence_mode,
    case
      when p_recurrence_mode = 'monthly' then coalesce(
        p_recurrence_anchor_day,
        extract(day from (p_scheduled_at at time zone 'Asia/Seoul'))::int
      )
      else null
    end,
    p_recurrence_end_count,
    case when p_recurrence_mode is null then null else 1 end,
    auth.uid()
  ) returning id into v_schedule_id;

  return jsonb_build_object(
    'schedule_id', v_schedule_id,
    'count', v_count,
    'scheduled_at', p_scheduled_at
  );
end $function$;

revoke all on function public.schedule_messages(text, text, text, jsonb, bigint, timestamp with time zone, text, integer, integer) from public, anon;
grant execute on function public.schedule_messages(text, text, text, jsonb, bigint, timestamp with time zone, text, integer, integer) to authenticated, service_role;

-- 다음 회차 생성: monthly(기존, 앵커일·말일 보정) + weekly(+7일, KST 시각 유지). 종료 회차에 도달하면 만들지 않는다.
create or replace function public.enqueue_next_message_occurrence(p_schedule_id bigint)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v message_schedules%rowtype;
  v_tz text := 'Asia/Seoul';
  v_root bigint; v_anchor int; v_month date; v_last int; v_day int;
  v_seq int;
  v_next timestamptz; v_existing bigint; v_new_id bigint;
begin
  select * into v from message_schedules where id = p_schedule_id;
  if not found or v.recurrence_mode is null or v.recurrence_mode not in ('monthly', 'weekly') then return null; end if;

  v_seq := coalesce(v.recurrence_seq, 1);
  if v.recurrence_end_count is not null and v_seq >= v.recurrence_end_count then
    return null;  -- 지정 횟수 발송 완료: 반복 종료
  end if;

  v_root := coalesce(v.recurrence_parent_id, v.id);
  if v.recurrence_mode = 'weekly' then
    v_anchor := null;
    v_next := ((v.scheduled_at at time zone v_tz) + interval '7 days') at time zone v_tz;
  else
    v_anchor := coalesce(v.recurrence_anchor_day, extract(day from (v.scheduled_at at time zone v_tz))::int);
    v_month := (date_trunc('month', (v.scheduled_at at time zone v_tz)) + interval '1 month')::date;
    v_last := extract(day from (v_month + interval '1 month' - interval '1 day'))::int;
    v_day := least(v_anchor, v_last);
    v_next := ((v_month + (v_day - 1)) + (v.scheduled_at at time zone v_tz)::time) at time zone v_tz;
  end if;

  select id into v_existing from message_schedules
    where coalesce(recurrence_parent_id, id) = v_root and scheduled_at = v_next and status <> 'cancelled'
    limit 1;
  if v_existing is not null then return v_existing; end if;

  insert into message_schedules(
    org_id, channel, body, context, recipient_count, recipients,
    template_id, scheduled_at, status,
    recurrence_mode, recurrence_anchor_day, recurrence_parent_id,
    recurrence_end_count, recurrence_seq, created_by
  ) values (
    v.org_id, v.channel, v.body, v.context, v.recipient_count, v.recipients,
    v.template_id, v_next, 'scheduled',
    v.recurrence_mode, v_anchor, v_root,
    v.recurrence_end_count, v_seq + 1, v.created_by
  ) returning id into v_new_id;
  return v_new_id;
end $function$;

revoke execute on function public.enqueue_next_message_occurrence(bigint) from public, anon, authenticated;
grant execute on function public.enqueue_next_message_occurrence(bigint) to service_role;

-- 발송 확정 트리거가 weekly 도 다음 회차를 만들도록 조건을 넓힌다.
drop trigger if exists trg_message_schedules_enqueue_next on public.message_schedules;
create trigger trg_message_schedules_enqueue_next
  after update of status on public.message_schedules
  for each row
  when (
    new.status in ('sent', 'partial')
    and old.status is distinct from new.status
    and new.recurrence_mode in ('monthly', 'weekly')
  )
  execute function public.message_schedules_enqueue_next_occurrence();

-- 예약 탭 「반복 설정」: 대기 중(scheduled) 예약의 반복 주기·종료를 바꾼다. p_mode null = 반복 해제(1회 예약).
-- p_end_count = 이 예약을 1회차로 센 총 발송 횟수(null = 계속 반복).
create or replace function public.set_message_schedule_recurrence(
  p_schedule_id bigint,
  p_mode text,
  p_end_count integer default null
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_org bigint;
  v message_schedules%rowtype;
  v_seq int;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;
  if p_mode is not null and p_mode not in ('monthly', 'weekly') then
    raise exception 'invalid recurrence: null|monthly|weekly required';
  end if;
  if p_end_count is not null and (p_mode is null or p_end_count < 1) then
    raise exception 'invalid recurrence end: positive count with recurrence required';
  end if;

  select * into v from message_schedules
    where id = p_schedule_id and org_id = v_org and status = 'scheduled'
    for update;
  if not found then raise exception 'scheduled message not found or already processed'; end if;

  if p_mode is null then
    update message_schedules
      set recurrence_mode = null, recurrence_anchor_day = null,
          recurrence_end_count = null, recurrence_seq = null
      where id = v.id;
    return;
  end if;

  v_seq := coalesce(v.recurrence_seq, 1);
  update message_schedules
    set recurrence_mode = p_mode,
        recurrence_anchor_day = case when p_mode = 'monthly'
          then extract(day from (v.scheduled_at at time zone 'Asia/Seoul'))::int else null end,
        recurrence_seq = v_seq,
        recurrence_end_count = case when p_end_count is null then null else v_seq + p_end_count - 1 end
    where id = v.id;
end $function$;

revoke all on function public.set_message_schedule_recurrence(bigint, text, integer) from public, anon;
grant execute on function public.set_message_schedule_recurrence(bigint, text, integer) to authenticated, service_role;
