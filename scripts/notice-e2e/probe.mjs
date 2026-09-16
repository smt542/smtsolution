// Minimal probe: FRESH login → create a PLAIN notice immediately → capture insert response.
// Isolates whether basic notice creation works against the live DB with a fresh session.
// usage: MARKER=E2E-PROBE node scripts/notice-e2e/probe.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const MARKER = process.env.MARKER || 'E2E-PROBE';
const ID = process.env.STAFF_ID || 'admin';
const PW = process.env.STAFF_PW || 'erp!12345';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1340, height: 900 } });
const page = await ctx.newPage();
const log = [];
page.on('response', async (resp) => {
  const u = resp.url();
  if (/\/rest\/v1\/(notices|attachments)|\/storage\/v1\/object\/|\/auth\/v1\/(token|user)/i.test(u)) {
    let body = '';
    if (resp.status() >= 400 || /\/rest\/v1\/notices/.test(u)) { try { body = (await resp.text()).slice(0, 500); } catch {} }
    const line = { status: resp.status(), method: resp.request().method(), url: u.replace(/^https?:\/\/[^/]+/, ''), body };
    log.push(line);
    console.log(`HTTP ${line.status} ${line.method} ${line.url}${body ? ' :: ' + body : ''}`);
  }
});

try {
  const t0 = Date.now();
  await page.goto(ORIGIN + '/staff/login', { waitUntil: 'networkidle' });
  await page.fill('#username', ID);
  await page.fill('#password', PW);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  console.log(`LOGIN ok, url=${page.url()} (+${Date.now() - t0}ms)`);

  await page.goto(ORIGIN + '/staff/notices', { waitUntil: 'networkidle' });
  const onLogin = page.url().includes('/login');
  console.log(`notices url=${page.url()} onLogin=${onLogin}`);
  if (onLogin) throw new Error('redirected to login — session invalid at notices load');

  await page.getByRole('button', { name: /공지 등록/ }).first().click();
  await page.getByText('공지 등록', { exact: true }).waitFor({ timeout: 10000 });
  const editor = page.getByRole('textbox', { name: '공지 내용' });
  await editor.waitFor({ timeout: 10000 });
  await editor.click();
  await page.keyboard.type('플레인 공지 본문입니다. 이미지·링크 없음.');
  await page.locator('#notice-title').fill(`${MARKER} 플레인`);

  console.log(`--- clicking save (+${Date.now() - t0}ms since login) ---`);
  await page.getByRole('button', { name: /^(등록|저장|수정)/ }).click();
  const ok = await page.getByText('공지가 등록되었습니다.').waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(500);
  console.log(`SUCCESS_TOAST=${ok}`);
} catch (err) {
  console.log('PROBE_ERROR', String(err && err.message || err));
} finally {
  await browser.close();
  console.log('=== response log ===');
  console.log(JSON.stringify(log, null, 2));
}
