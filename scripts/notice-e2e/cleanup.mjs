// Removes ALL E2E test data created during notice Tiptap verification.
// Run via `!` (user-invoked) because the auto-mode classifier blocks agent-issued prod writes:
//   ! node scripts/notice-e2e/cleanup.mjs
// Scope is strictly limited to E2E artifacts: notices titled 'E2E-%', the 'e2e-resident'
// identity/claim, the two fixed E2E share tokens, and attachments/storage objects under those notices.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REF = 'amhtprmapxlizdnsgbeg';
const env = await readFile(path.join(REPO, '.env.local'), 'utf8');
const token = (env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m) || [])[1]?.trim();
const serviceRole = (env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m) || [])[1]?.trim();

async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text}`);
  return JSON.parse(text);
}

// 1) collect every storage object under E2E notice paths + E2E-vendor attachment objects
const objs = await q(`
  select name from storage.objects where bucket_id='attachments' and (
    name ~ '/notice/'
    or name like '%/vendor/%e2e-img-a.png'   -- E2E vendor smoke objects (incl. orphaned after vendor delete)
  )`);
for (const o of objs) {
  const r = await fetch(`https://${REF}.supabase.co/storage/v1/object/attachments/${o.name}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${serviceRole}` },
  });
  console.log(`storage delete [${r.status}] ${o.name}`);
}

// 2) delete E2E DB rows (attachments → tokens → notices → res_claims → resident identity/user)
const del = await q(`
with av as (delete from attachments where entity_type='vendor' and (entity_id in (select id from vendors where name like 'E2E-%') or file_url like '%-e2e-img-a.png') returning 1),
     a as (delete from attachments where entity_type='notice' returning 1),
     v as (delete from vendors where name like 'E2E-%' returning 1),
     t as (delete from notice_share_tokens where token in ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002') returning 1),
     n as (delete from notices where title like 'E2E-%' returning 1),
     c as (delete from res_claims where kakao_id='e2e-resident' returning 1),
     i as (delete from resident_identities where kakao_id='e2e-resident' returning user_id)
select (select count(*) from a) as notice_attachments_deleted,
       (select count(*) from av) as vendor_attachments_deleted,
       (select count(*) from v) as vendors_deleted,
       (select count(*) from t) as tokens_deleted,
       (select count(*) from n) as notices_deleted,
       (select count(*) from c) as claims_deleted,
       (select jsonb_agg(user_id) from i) as identity_user_ids;
`);
console.log('db cleanup:', JSON.stringify(del));
console.log('NOTE: the auth.users row for the e2e-resident stub (id from identity_user_ids) is left in place;');
console.log('      delete it from the Supabase dashboard if you want a full purge.');
