-- 세입자 공지 목록 미리보기: 원본 resident-notice 목록은 제목 아래에 본문 앞부분을 한 줄(`.tx .p`)로 보여 준다.
-- resident_notices(0159)가 본문을 돌려주지 않아 목록에서 미리보기를 뺐던 것을 채운다(2026-09-30 사용자 요청, QA R12).
-- - preview = notices.content(평문 투영, 0158) 앞 120자. 줄바꿈·연속 공백은 한 칸으로 줄인다(화면은 한 줄 말줄임).
-- - 반환 칸이 늘어 create or replace가 안 되므로 drop + create(한 트랜잭션)하고 권한을 다시 선언한다.
--   조회 범위·정렬은 0159 그대로다.

drop function if exists public.resident_notices();

create function public.resident_notices()
returns table (
  id bigint,
  title text,
  notice_type text,
  building_id bigint,
  building_name text,
  published_at timestamptz,
  created_at timestamptz,
  preview text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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
    and n.deleted_at is null
    and (n.expires_at is null or n.expires_at > now())
    and (
      not exists (select 1 from notice_buildings nb where nb.notice_id = n.id)
      or exists (select 1 from notice_buildings nb
                 where nb.notice_id = n.id and nb.building_id = l.building_id)
    )
  order by n.published_at desc;
$$;

revoke execute on function public.resident_notices() from anon, public;
grant execute on function public.resident_notices() to authenticated;
