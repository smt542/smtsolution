// Live DB helper via Supabase Management API. Ref-guarded to the known live project.
// usage:
//   node scripts/notice-e2e/db.mjs q "select 1"
//   node scripts/notice-e2e/db.mjs f supabase/migrations/0157_attachment_metadata_and_image_policy.sql
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REF = 'amhtprmapxlizdnsgbeg'; // live project ref (guarded)

const envText = await readFile(path.join(REPO, '.env.local'), 'utf8');
const token = (envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!token) { console.error('SUPABASE_ACCESS_TOKEN not found in .env.local'); process.exit(1); }

const mode = process.argv[2];
let sql;
if (mode === 'q') sql = process.argv[3];
else if (mode === 'f') sql = await readFile(path.resolve(REPO, process.argv[3]), 'utf8');
else { console.error('usage: db.mjs <q|f> <sql|file>'); process.exit(1); }
if (!sql) { console.error('no SQL'); process.exit(1); }

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
console.log(`[HTTP ${res.status}]`);
console.log(text);
process.exit(res.ok ? 0 : 1);
