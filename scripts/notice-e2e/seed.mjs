// Deterministic, idempotent E2E seed for the server-side read-path scenarios.
// Run via `!` (user-invoked) because the auto-mode classifier blocks agent-issued prod writes:
//   ! node scripts/notice-e2e/seed.mjs
// Creates: (1) a linked res_claims for the stub resident 'e2e-resident',
//          (2) a VALID share token (fixed UUID) for the image notice,
//          (3) an EXPIRED share token (fixed UUID) for another notice,
//          (4) a legacy plain-text notice (content_json = null).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REF = 'amhtprmapxlizdnsgbeg';
const env = await readFile(path.join(REPO, '.env.local'), 'utf8');
const token = (env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m) || [])[1]?.trim();

const OWNER = '56375fe1-35d0-4b67-94bb-ac79659af79a'; // org1 owner (created_by)
const VALID_TOKEN = 'aaaaaaaa-0000-4000-8000-000000000001';
const EXPIRED_TOKEN = 'aaaaaaaa-0000-4000-8000-000000000002';

const SQL = `
-- (1) link the stub resident (resolved by kakao_id) to a free org-1 occupancy, idempotently
insert into res_claims (org_id, resident_user_id, kakao_id, kakao_name, claimed_name, claimed_phone, building_id, unit_id, occupancy_id, status, kind)
select 1, ri.user_id, 'e2e-resident', 'E2E입주민', '김철수', '010-1234-5678', 1, 2, 2, 'linked', 'auto'
from resident_identities ri
where ri.kakao_id = 'e2e-resident'
  and not exists (select 1 from res_claims rc where rc.resident_user_id = ri.user_id and rc.status = 'linked');

-- (2) VALID token for the image notice (the notice that has a live attachments row)
insert into notice_share_tokens (token, org_id, notice_id, created_by, expires_at)
select '${VALID_TOKEN}', 1, a.entity_id, '${OWNER}', now() + interval '30 days'
from (select entity_id from attachments where entity_type = 'notice' order by id desc limit 1) a
on conflict (notice_id) do update set token = excluded.token, expires_at = excluded.expires_at;

-- (3) EXPIRED token for a different E2E notice (any notice without an attachments row)
insert into notice_share_tokens (token, org_id, notice_id, created_by, expires_at)
select '${EXPIRED_TOKEN}', 1, n.id, '${OWNER}', now() - interval '1 day'
from (
  select id from notices
  where title like 'E2E-%' and deleted_at is null
    and id not in (select entity_id from attachments where entity_type = 'notice')
  order by id limit 1
) n
on conflict (notice_id) do update set token = excluded.token, expires_at = excluded.expires_at;

-- (4) legacy plain-text notice (content_json stays null) — for the compatibility scenario
insert into notices (org_id, title, content, notice_type, published_at, created_by)
select 1, 'E2E-LEGACY 평문 공지', E'첫째 줄입니다.\n둘째 줄입니다.\n\n넷째 줄(빈 줄 뒤).', 'normal', now(), '${OWNER}'
where not exists (select 1 from notices where title = 'E2E-LEGACY 평문 공지' and deleted_at is null);

-- report what now exists for the harness
select
  (select jsonb_agg(jsonb_build_object('token', token, 'notice_id', notice_id, 'expired', expires_at <= now())) from notice_share_tokens where token in ('${VALID_TOKEN}','${EXPIRED_TOKEN}')) as tokens,
  (select id from notices where title = 'E2E-LEGACY 평문 공지' and deleted_at is null limit 1) as legacy_notice_id,
  (select entity_id from attachments where entity_type = 'notice' order by id desc limit 1) as image_notice_id,
  (select count(*) from res_claims where kakao_id = 'e2e-resident' and status = 'linked') as resident_links;
`;

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: SQL }),
});
const text = await res.text();
console.log(`[HTTP ${res.status}]`);
console.log(text);
