// prototype 원본(staging) / 앱(localhost) 스크린샷 캡처
// usage: node scripts/pixel-diff/capture.mjs <id|all> [--side=origin|app|both]
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const AUTH = path.join(ROOT, '.auth', 'staff.json');

const targets = JSON.parse(await readFile(path.join(ROOT, 'targets.json'), 'utf8'));
const idArg = process.argv[2] || 'all';
const sideArg = process.argv.find((a) => a.startsWith('--side='));
const side = sideArg ? sideArg.split('=')[1] : 'both';
const list = idArg === 'all' ? targets : targets.filter((t) => t.id === idArg);
if (list.length === 0) {
  console.error(`no target matching "${idArg}"`);
  process.exit(1);
}

const browser = await chromium.launch();
try {
  for (const t of list) {
    if (side !== 'app') {
      const ctx = await browser.newContext({
        viewport: { width: t.viewport.w, height: t.viewport.h },
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      await page.goto(t.originUrl, { waitUntil: 'networkidle' });
      const el = await page.waitForSelector(t.originSelector, { timeout: 15000 });
      await mkdir(path.join(OUT, 'origin'), { recursive: true });
      await el.screenshot({ path: path.join(OUT, 'origin', `${t.id}.png`) });
      await ctx.close();
      console.log(`origin captured: ${t.id}`);
    }
    if (side !== 'origin') {
      const ctx = await browser.newContext({
        viewport: { width: t.viewport.w, height: t.viewport.h },
        deviceScaleFactor: 1,
        storageState: AUTH,
      });
      const page = await ctx.newPage();
      await page.goto(APP_ORIGIN + t.appPath, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500); // 폰트·데이터 안정화
      if (Array.isArray(t.appActions)) {
        for (const action of t.appActions) {
          if (action.click) await page.click(action.click);
          if (typeof action.wait === 'number') await page.waitForTimeout(action.wait);
          if (action.waitFor) await page.waitForSelector(action.waitFor, { timeout: 15000 });
        }
      }
      await mkdir(path.join(OUT, 'app'), { recursive: true });
      const shotTarget = t.appSelector
        ? await page.waitForSelector(t.appSelector, { timeout: 15000 })
        : page;
      await shotTarget.screenshot({ path: path.join(OUT, 'app', `${t.id}.png`) });
      await ctx.close();
      console.log(`app captured: ${t.id}`);
    }
  }
} finally {
  await browser.close();
}
