-- 0230_notice_visibility.sql
-- 문제점 개선1차 #5: 삭제·종료된 공지가 공개 링크로 노출되고, 예약 공지가 게시 전에 노출됨.
-- 조회 시점에 원본 공지 상태(삭제·게시기간·예약)를 다시 검증한다. 본문은 실 DB 정의와 동일.
--
--  - public_notice_by_token
--      · 삭제(deleted_at)되었거나 미게시·예약(published_at null 또는 미래) 공지는 행을 돌려주지 않는다
--        → 클라이언트(share/notice/[token]/data.ts)는 null을 "없는 공지"로 처리한다.
--      · 게시 종료(notices.expires_at <= now())는 토큰 만료와 같게 is_expired=true로 보고하고 내용을 가린다.
--  - resident_notices / resident_notice_detail
--      · published_at is not null 에 더해 published_at <= now() 를 요구한다(예약 공지 선노출 차단).
-- create or replace는 기존 ACL을 유지한다.

create or replace function public.public_notice_by_token(p_token uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'title', case when v.live then n.title else null end,
    'content', case when v.live then n.content else null end,
    'content_json', case when v.live then n.content_json else null end,
    'notice_type', case when v.live then n.notice_type else null end,
    'building_name', case when v.live then (
        select case when count(*) = 1 then max(b.name) else null end
        from public.notice_buildings nb
        join public.buildings b on b.id = nb.building_id
        where nb.notice_id = n.id
      ) else null end,
    'published_at', case when v.live then n.published_at else null end,
    'is_expired', not v.live
  )
  from public.notice_share_tokens nst
  join public.notices n
    on n.id = nst.notice_id
   and n.org_id = nst.org_id
  cross join lateral (
    select (nst.expires_at > now() and (n.expires_at is null or n.expires_at > now())) as live
  ) v
  where nst.token = p_token
    and n.deleted_at is null
    and n.published_at is not null
    and n.published_at <= now();
$function$;

create or replace function public.resident_notices()
 returns table(id bigint, title text, notice_type text, building_id bigint, building_name text, published_at timestamp with time zone, created_at timestamp with time zone, preview text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with linked as (
    select * from resident_linked_unit()
  )
  select
    n.id,
    n.title,
    n.notice_type,
    case when exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
         then l.building_id else null end,
    case when exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
         then lb.name else null end,
    n.published_at,
    n.created_at,
    nullif(left(btrim(regexp_replace(coalesce(n.content, ''), '\s+', ' ', 'g')), 120), '')
  from linked l
  join notices n
    on n.org_id = l.org_id
  left join buildings lb on lb.id = l.building_id
  where n.published_at is not null
    and n.published_at <= now()
    and n.deleted_at is null
    and (n.expires_at is null or n.expires_at > now())
    and (
      not exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
      or exists (select 1 from notice_buildings nb
                 where nb.notice_id = n.id and nb.building_id = l.building_id)
    )
  order by n.published_at desc;
$function$;

create or replace function public.resident_notice_detail(p_id bigint)
 returns table(id bigint, title text, content text, content_json jsonb, notice_type text, building_id bigint, building_name text, published_at timestamp with time zone, created_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with linked as (
    select * from resident_linked_unit()
  )
  select
    n.id,
    n.title,
    n.content,
    n.content_json,
    n.notice_type,
    case when exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
         then l.building_id else null end,
    case when exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
         then lb.name else null end,
    n.published_at,
    n.created_at
  from linked l
  join notices n
    on n.org_id = l.org_id
  left join buildings lb on lb.id = l.building_id
  where n.id = p_id
    and n.published_at is not null
    and n.published_at <= now()
    and n.deleted_at is null
    and (n.expires_at is null or n.expires_at > now())
    and (
      not exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
      or exists (select 1 from notice_buildings nb
                 where nb.notice_id = n.id and nb.building_id = l.building_id)
    );
$function$;
