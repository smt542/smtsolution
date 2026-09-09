// 앱 staff 로그인 세션을 storageState로 저장(캡처 시 재사용)
// usage: STAFF_ID=<아이디> STAFF_PW=<비번> node scripts/pixel-diff/save-auth.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const ID = process.env.STAFF_ID;
const PW = process.env.STAFF_PW;
if (!ID || !PW) {
  console.error('set STAFF_ID and STAFF_PW env');
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(APP_ORIGIN + '/staff/login', { waitUntil: 'networkidle' });
await page.fill('#username', ID);
await page.fill('#password', PW);
await page.click('button[type="submit"]');
// 로그인 페이지를 벗어나면 성공
await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
await mkdir(path.join(ROOT, '.auth'), { recursive: true });
await ctx.storageState({ path: path.join(ROOT, '.auth', 'staff.json') });
await browser.close();
console.log('saved .auth/staff.json');
