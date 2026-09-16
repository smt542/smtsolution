// Blast-radius smoke: confirm migration 0157 fixed the SHARED uploadAttachment path for a
// NON-notice entity (vendor). Exercises §8 "신규 첨부 선택→미리보기→저장→재조회→삭제" self-cleaning.
// usage: MARKER="E2E-업체-xxx" node scripts/notice-e2e/vendor.mjs
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const FIX = path.join(ROOT, 'fixtures');
await mkdir(OUT, { recursive: true });
const ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const MARKER = process.env.MARKER || `E2E-업체-${Date.now()}`;
const STAFF_ID = process.env.STAFF_ID || 'admin';
const STAFF_PW = process.env.STAFF_PW || 'erp!12345';

const results = [];
const net = [];
let phase = 'init';
const check = (name, pass, ev) => { results.push({ scenario: name, pass: !!pass, evidence: ev ?? null }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${ev ? '  :: ' + JSON.stringify(ev).slice(0, 240) : ''}`); };
const shot = (page, n) => page.screenshot({ path: path.join(OUT, `${n}.png`) }).catch(() => {});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1340, height: 950 } });
const page = await ctx.newPage();
page.on('request', (r) => { const u = r.url(); if (/\/storage\/v1\/object\/|\/rest\/v1\/(vendors|attachments)/i.test(u)) net.push({ phase, method: r.method(), url: u.replace(/^https?:\/\/[^/]+/, '') }); });
const errResp = [];
page.on('response', async (resp) => { const u = resp.url(); if (/\/rest\/v1\/(vendors|attachments)|\/storage\/v1\/object\//i.test(u) && resp.status() >= 400) { let b = ''; try { b = (await resp.text()).slice(0, 300); } catch {} errResp.push({ phase, status: resp.status(), url: u.replace(/^https?:\/\/[^/]+/, ''), body: b }); console.log(`HTTP ${resp.status()} ${u.replace(/^https?:\/\/[^/]+/, '')} :: ${b}`); } });
const signedImg = () => page.evaluate(() => { const h = [...document.querySelectorAll('img')].map((i) => i.currentSrc || i.src).find((s) => /\/storage\/v1\/object\/sign\/attachments\//.test(s)); return h || null; });

try {
  // fresh inline login (storageState rotates stale in minutes)
  await page.goto(`${ORIGIN}/staff/login`, { waitUntil: 'networkidle' });
  await page.fill('#username', STAFF_ID); await page.fill('#password', STAFF_PW);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });

  phase = 'open';
  await page.goto(`${ORIGIN}/staff/vendor-management`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '업체 추가' }).first().click();
  await page.getByRole('dialog').waitFor({ timeout: 10000 });

  // category FIRST (gates the rest of the form), then name
  await page.getByRole('combobox', { name: '구분' }).waitFor({ timeout: 10000 });
  await page.getByRole('combobox', { name: '구분' }).click();
  await page.getByRole('option', { name: '청소 업체' }).first().click();
  await page.locator('#vendor-name').fill(MARKER);

  // attach image → blob preview only, no upload yet
  phase = 'select';
  const before = net.length;
  await page.locator('input[aria-label="계약서 사진 선택"]').setInputFiles(path.join(FIX, 'e2e-img-a.png'));
  await page.waitForTimeout(500);
  const uploadedOnSelect = net.slice(before).filter((n) => /\/storage\/v1\/object\/(?!sign)/i.test(n.url) && n.method === 'POST');
  check('V1: selecting image shows blob preview, NO storage upload yet', (await page.locator('img[src^="blob:"]').count()) >= 1 && uploadedOnSelect.length === 0, { uploadedOnSelect });

  // save → the 0157 code path
  phase = 'save';
  const beforeSave = net.length;
  await page.getByRole('dialog').locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);
  const saveReqs = net.slice(beforeSave);
  const vendorPost = saveReqs.find((n) => /\/rest\/v1\/vendors/i.test(n.url) && n.method === 'POST');
  const storageUp = saveReqs.find((n) => /\/storage\/v1\/object\/attachments\/1\/vendor\//i.test(n.url) && n.method === 'POST' && !/\/sign\//.test(n.url));
  const attachPost = saveReqs.find((n) => /\/rest\/v1\/attachments/i.test(n.url) && n.method === 'POST');
  const attachErr = errResp.find((e) => /\/rest\/v1\/attachments/i.test(e.url));
  check('V2: vendor INSERT fires', !!vendorPost, vendorPost || null);
  check('V3: Storage upload to {org}/vendor/{id}/ fires', !!storageUp, storageUp || null);
  check('V4: attachments INSERT fires AND does NOT 400 (0157 fix confirmed for entity_type=vendor)', !!attachPost && !attachErr, { attachPost: attachPost || null, error: attachErr || null });
  await shot(page, 'v-saved');

  // re-open vendor → signed thumbnail renders
  phase = 'reopen';
  await page.waitForTimeout(800);
  await page.getByText(MARKER, { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const img = await signedImg();
  check('V5: re-open shows attachment via signed Storage URL (RLS client signing)', !!img, { img: img ? img.slice(0, 90) : null });
  await shot(page, 'v-reopen');

  // NOTE: the created E2E vendor + attachment are left for cleanup.mjs (removed by name
  // 'E2E-%' / fixture filename). The vendor delete-confirm UI (nested Modal + ConfirmProvider)
  // is intentionally not driven here — the smoke's point is the INSERT/read path (V1–V5),
  // and the delete path is covered by the notice S3c flow.

} catch (err) {
  check('FATAL', false, { error: String(err && err.stack || err).slice(0, 400) });
} finally {
  await writeFile(path.join(OUT, 'vendor-results.json'), JSON.stringify({ marker: MARKER, results, net, errResp }, null, 2));
  console.log(`\n=== VENDOR RESULTS: ${results.filter((r) => r.pass).length}/${results.length} passed ===`);
  await browser.close();
}
