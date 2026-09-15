-- 공지 본문 리치 텍스트(Tiptap JSON) 도입.
-- 기존 content(text, NOT NULL)는 평문 투영으로 유지하고, 신규 nullable content_json을 추가한다.
-- 레거시 공지는 content_json = null → 읽기 경로에서 content(평문)로 안전하게 폴백한다.
-- 기존 plain text의 일괄 파괴적 변환은 하지 않는다.

alter table public.notices
  add column if not exists content_json jsonb;

comment on column public.notices.content_json is
  'Tiptap JSON 원본. null이면 레거시 plain text(content)만 존재한다.';

-- 입주자 상세 RPC: 반환 컬럼에 content_json을 추가한다.
-- RETURNS TABLE 시그니처가 바뀌므로 CREATE OR REPLACE가 아닌 DROP 후 재생성한다.
drop function if exists public.resident_notice_detail(bigint);
create function public.resident_notice_detail(p_id bigint)
returns table (
  id bigint,
  title text,
  content text,
  content_json jsonb,
  notice_type text,
  building_id bigint,
  building_name text,
  published_at timestamptz,
  created_at timestamptz
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
    n.content,
    n.content_json,
    n.notice_type,
    n.building_id,
    nb.name,
    n.published_at,
    n.created_at
  from linked l
  join notices n
    on n.org_id = l.org_id
   and (n.building_id is null or n.building_id = l.building_id)
  left join buildings nb on nb.id = n.building_id
  where n.id = p_id
    and n.published_at is not null
    and n.deleted_at is null
    and (n.expires_at is null or n.expires_at > now());
$$;

revoke execute on function public.resident_notice_detail(bigint) from anon, public;
grant execute on function public.resident_notice_detail(bigint) to authenticated;

-- 공유 링크 공개 RPC: JSONB 반환(시그니처 불변)이므로 본문에 content_json 키만 추가한다.
create or replace function public.public_notice_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'title', case when nst.expires_at > now() then n.title else null end,
    'content', case when nst.expires_at > now() then n.content else null end,
    'content_json', case when nst.expires_at > now() then n.content_json else null end,
    'notice_type', case when nst.expires_at > now() then n.notice_type else null end,
    'building_name', case when nst.expires_at > now() then b.name else null end,
    'published_at', case when nst.expires_at > now() then n.published_at else null end,
    'is_expired', nst.expires_at <= now()
  )
  from public.notice_share_tokens nst
  join public.notices n
    on n.id = nst.notice_id
   and n.org_id = nst.org_id
  left join public.buildings b
    on b.id = n.building_id
   and b.org_id = nst.org_id
  where nst.token = p_token;
$$;

revoke all on function public.public_notice_by_token(uuid) from public;
grant execute on function public.public_notice_by_token(uuid) to anon, authenticated;
