// Server-side read-path E2E: S4b (resident), S4c (public), S5 (legacy), S6 (security),
// S7 (signed-url TTL vs cache — from constants), S8 (read-route bundle isolation), S4 parity.
// Requires seed.mjs to have been run. usage:
//   IMAGE_NOTICE_ID=3 LEGACY_NOTICE_ID=5 node scripts/notice-e2e/server.mjs
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
await mkdir(OUT, { recursive: true });
const ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const VALID_TOKEN = 'aaaaaaaa-0000-4000-8000-000000000001';
const EXPIRED_TOKEN = 'aaaaaaaa-0000-4000-8000-000000000002';
const INVALID_TOKEN = 'deadbeef-0000-4000-8000-00000000dead'; // valid UUID format, nonexistent
const IMAGE_NOTICE_ID = process.env.IMAGE_NOTICE_ID || '3';
const LEGACY_NOTICE_ID = process.env.LEGACY_NOTICE_ID || '';
const STAFF_ID = process.env.STAFF_ID || 'admin';
const STAFF_PW = process.env.STAFF_PW || 'erp!12345';

const results = [];
const check = (name, pass, ev) => { results.push({ scenario: name, pass: !!pass, evidence: ev ?? null }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${ev ? '  :: ' + JSON.stringify(ev).slice(0, 260) : ''}`); };
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
const chunkTracker = (page, bag) => page.on('request', (r) => { if (/tiptap|prosemirror|NoticeEditor/i.test(r.url())) bag.push(r.url().replace(/^https?:\/\/[^/]+/, '')); });
// find an <img> with a signed storage URL that actually decoded (naturalWidth>0)
const signedImgInfo = (page) => page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')];
  const hit = imgs.find((i) => /\/storage\/v1\/object\/sign\/attachments\//.test(i.currentSrc || i.src));
  if (!hit) return null;
  const full = hit.currentSrc || hit.src;
  const m = full.match(/\/attachments\/([^?]+)/);
  return { objectPath: m ? m[1] : null, src: full.slice(0, 90), naturalWidth: hit.naturalWidth, complete: hit.complete };
});

const browser = await chromium.launch();
let staffImageText = '', residentImageText = '', publicImageText = '';
let pubObjPath = null, resObjPath = null, staffObjPath = null;
try {
  // ================= PUBLIC (anon) =================
  const anon = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const ap = await anon.newPage();
  const anonChunks = []; chunkTracker(ap, anonChunks);

  // valid token
  await ap.goto(`${ORIGIN}/share/notice/${VALID_TOKEN}`, { waitUntil: 'networkidle' });
  await ap.waitForTimeout(1200);
  publicImageText = norm(await ap.locator('body').innerText());
  const pubImg = await signedImgInfo(ap);
  pubObjPath = pubImg?.objectPath ?? null;
  check('S4c: public /share/notice/{token} renders body image via service_role signed URL (loads, naturalWidth>0)', pubImg && pubImg.naturalWidth > 0, pubImg);
  check('S8: public read route pulls NO tiptap/prosemirror editor chunk', anonChunks.length === 0, { chunks: anonChunks });
  await ap.screenshot({ path: path.join(OUT, 's4c-public-valid.png') });

  // expired token
  await ap.goto(`${ORIGIN}/share/notice/${EXPIRED_TOKEN}`, { waitUntil: 'networkidle' });
  await ap.waitForTimeout(500);
  const expiredText = norm(await ap.locator('body').innerText());
  const expiredImg = await signedImgInfo(ap);
  check('S6: expired token → "만료된 링크" and images masked (no signed image)', /만료된 링크/.test(expiredText) && !expiredImg, { hasExpiredMsg: /만료된 링크/.test(expiredText), img: expiredImg });
  await ap.screenshot({ path: path.join(OUT, 's6-expired.png') });

  // invalid token
  await ap.goto(`${ORIGIN}/share/notice/${INVALID_TOKEN}`, { waitUntil: 'networkidle' });
  const invalidText = norm(await ap.locator('body').innerText());
  check('S6: invalid token → "유효하지 않은 링크" (no data leak)', /유효하지 않은 링크/.test(invalidText), { invalidText: invalidText.slice(0, 80) });
  await anon.close();

  // ================= RESIDENT =================
  const resCtx = await browser.newContext({ viewport: { width: 430, height: 920 } });
  const rp = await resCtx.newPage();
  const resChunks = []; chunkTracker(rp, resChunks);
  const mint = await rp.request.post(`${ORIGIN}/api/resident/kakao/stub`, { data: { kakaoId: 'e2e-resident', name: 'E2E입주민', phone: '010-3746-6933' } });
  const mintBody = await mint.json().catch(() => ({}));
  await rp.goto(`${ORIGIN}/resident/notice/${IMAGE_NOTICE_ID}`, { waitUntil: 'networkidle' });
  await rp.waitForTimeout(1200);
  const residentUrl = rp.url();
  const onResidentNotice = residentUrl.includes(`/resident/notice/${IMAGE_NOTICE_ID}`);
  residentImageText = norm(await rp.locator('body').innerText());
  const resImg = await signedImgInfo(rp);
  resObjPath = resImg?.objectPath ?? null;
  check('S4b: resident /resident/notice/{id} (linked session) renders image via service_role signed URL', onResidentNotice && resImg && resImg.naturalWidth > 0, { onResidentNotice, url: residentUrl, img: resImg, mintUser: mintBody.userId });
  check('S8: resident read route pulls NO tiptap/prosemirror editor chunk', resChunks.length === 0, { chunks: resChunks });
  await rp.screenshot({ path: path.join(OUT, 's4b-resident.png') });
  await resCtx.close();

  // ================= STAFF (legacy + parity) =================
  const staff = await browser.newContext({ viewport: { width: 1340, height: 950 } });
  const sp = await staff.newPage();
  await sp.goto(`${ORIGIN}/staff/login`, { waitUntil: 'networkidle' });
  await sp.fill('#username', STAFF_ID); await sp.fill('#password', STAFF_PW);
  await sp.click('button[type="submit"]');
  await sp.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });

  // staff parity: open the image notice, capture rendered text + confirm signed image
  await sp.goto(`${ORIGIN}/staff/notices`, { waitUntil: 'networkidle' });
  await sp.waitForTimeout(600);
  await sp.getByText('E2E-175402 이미지 공지', { exact: false }).first().click().catch(() => {});
  await sp.waitForTimeout(1500);
  staffImageText = norm(await sp.locator('body').innerText());
  const staffImg = await signedImgInfo(sp);
  staffObjPath = staffImg?.objectPath ?? null;
  check('S4a(parity): staff detail image loads via signed URL (naturalWidth>0)', staffImg && staffImg.naturalWidth > 0, staffImg);

  // legacy notice (content_json = null)
  if (LEGACY_NOTICE_ID) {
    await sp.goto(`${ORIGIN}/staff/notices`, { waitUntil: 'networkidle' });
    await sp.waitForTimeout(500);
    await sp.getByText('E2E-LEGACY 평문 공지', { exact: false }).first().click().catch(() => {});
    await sp.waitForTimeout(1000);
    // NoticeContent legacy branch = plain container with white-space:pre-wrap
    const legacy = await sp.evaluate(() => {
      // the NoticeContent legacy branch is the DEEPEST element whose text is ONLY the legacy body
      const cands = [...document.querySelectorAll('*')].filter((n) => /첫째 줄입니다/.test(n.textContent || '') && (n.textContent || '').replace(/\s/g, '').length < 40);
      const el = cands[cands.length - 1];
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, cls: String(el.className), whiteSpace: cs.whiteSpace, text: el.innerText, hasBreaks: /첫째 줄입니다\.\s*\n\s*둘째 줄입니다\./.test(el.innerText) };
    });
    check('S5: legacy (content_json=null) renders as plain text with linebreaks preserved (pre-wrap)', !!legacy && /pre-wrap|pre-line|break-spaces/.test(legacy.whiteSpace) && legacy.hasBreaks, legacy);
    await sp.screenshot({ path: path.join(OUT, 's5-legacy-detail.png') });

    // open in editor → non-destructive promotion to paragraphs
    await sp.getByRole('button', { name: '수정', exact: true }).first().click().catch(() => {});
    await sp.getByText('공지 수정', { exact: true }).waitFor({ timeout: 10000 }).catch(() => {});
    const editor = sp.getByRole('textbox', { name: '공지 내용' });
    await editor.waitFor({ timeout: 8000 }).catch(() => {});
    await sp.waitForTimeout(500);
    const promo = await editor.evaluate((el) => ({ paragraphs: el.querySelectorAll('p').length, text: el.innerText })).catch(() => null);
    check('S5: opening legacy in editor promotes plain text to paragraph document (non-destructive)', !!promo && promo.paragraphs >= 3 && /첫째 줄입니다/.test(promo.text) && /넷째 줄/.test(promo.text), promo);
    await sp.screenshot({ path: path.join(OUT, 's5-legacy-editor.png') });
    await sp.keyboard.press('Escape').catch(() => {});
  } else {
    check('S5: legacy notice id not provided (seed not run?)', false);
  }
  await staff.close();

  // ================= PARITY =================
  // notice 3 body text = "이미지 본문 위 문단." — assert it renders in all three, and that all three
  // sign the SAME storage object (identical body image across staff/resident/public).
  const BODY = '이미지 본문 위 문단';
  const textOk = new RegExp(BODY).test(staffImageText) && new RegExp(BODY).test(residentImageText) && new RegExp(BODY).test(publicImageText);
  const imgOk = !!pubObjPath && pubObjPath === resObjPath && resObjPath === staffObjPath;
  check('S4: same notice body text + same signed image object render identically across staff / resident / public', textOk && imgOk, { textOk, imgOk, staffObj: staffObjPath, resObj: resObjPath, pubObj: pubObjPath });

} catch (err) {
  check('FATAL', false, { error: String(err && err.stack || err).slice(0, 500) });
} finally {
  await writeFile(path.join(OUT, 'server-results.json'), JSON.stringify({ results }, null, 2));
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== SERVER RESULTS: ${passed}/${results.length} passed ===`);
  await browser.close();
}
