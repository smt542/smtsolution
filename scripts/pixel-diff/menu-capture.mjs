// 프로필 메뉴(드롭다운) 열림 상태 캡처 — origin(details 클릭) + app(profile 버튼 클릭)
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const AUTH = path.join(ROOT, '.auth', 'staff.json');
await mkdir(path.join(OUT, 'origin'), { recursive: true });
await mkdir(path.join(OUT, 'app'), { recursive: true });

const browser = await chromium.launch();
try {
  // origin
  {
    const ctx = await browser.newContext({ viewport: { width: 1340, height: 880 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto('https://staging.d2h12382xiksft.amplifyapp.com/staff/fee-item/fee-item.dc.html', { waitUntil: 'networkidle' });
    await page.click('.hf-profile > summary');
    await page.waitForTimeout(400);
    const el = await page.waitForSelector('.hf-menu', { timeout: 10000 });
    await el.screenshot({ path: path.join(OUT, 'origin', 'menu.png') });
    await ctx.close();
    console.log('origin menu captured');
  }
  // app
  {
    const ctx = await browser.newContext({ viewport: { width: 1340, height: 880 }, deviceScaleFactor: 1, storageState: AUTH });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/staff/fee-items', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.click('aside button[aria-haspopup="menu"]');
    await page.waitForTimeout(300);
    const el = await page.waitForSelector('aside [role="menu"]', { timeout: 10000 });
    await el.screenshot({ path: path.join(OUT, 'app', 'menu.png') });
    await ctx.close();
    console.log('app menu captured');
  }
} finally {
  await browser.close();
}
