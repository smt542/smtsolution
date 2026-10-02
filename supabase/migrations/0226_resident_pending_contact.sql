-- 0226_resident_pending_contact.sql
-- 세입자 확인 요청 완료 화면(/resident/pending)의 '급하면 바로 문의하세요' 카드.
-- 정본 resident-pending `.call`(Figma 1029:256582)은 관리 조직 상호 · 대표 전화와 [전화] 버튼을 보여 준다.
--
-- 로그인한 세입자 본인의 확인 대기(pending) 신청이 속한 조직의 연락처를 돌려준다.
--   · 상호 = 셋업 > 회사 정보 '상호'(setup_config.company_name), 비어 있으면 organizations.name
--   · 전화 = 셋업 > 회사 정보 '대표 전화'(setup_config.company_phone — 안내문 "세입자 문의 안내에 노출돼요"),
--            비어 있으면 organizations.phone. 대체 순서는 입주자카드 출력과 같다.
--   · pending 신청은 세입자당 1건(res_claims_one_pending_per_resident_idx)이라 최대 1행, 없으면 0행.
--   · 인자가 없어 다른 조직의 연락처는 조회할 수 없다.

create or replace function resident_pending_contact()
returns table (
  company_name text,
  company_phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(btrim(sc.company_name), ''), o.name),
    coalesce(nullif(btrim(sc.company_phone), ''), nullif(btrim(o.phone), ''))
  from res_claims c
  join organizations o
    on o.id = c.org_id
   and o.deleted_at is null
  left join setup_config sc
    on sc.org_id = c.org_id
  where c.resident_user_id = auth.uid()
    and c.status = 'pending';
$$;

revoke execute on function resident_pending_contact() from anon, public;
grant execute on function resident_pending_contact() to authenticated;
