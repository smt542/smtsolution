// prototype 원본(staging) / 앱(localhost) 스크린샷 캡처
// usage: node scripts/pixel-diff/capture.mjs <id|all> [--side=origin|app|both]
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const AUTH = process.env.AUTH_STATE || path.join(ROOT, '.auth', 'staff.json');

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
      // 정본 조각 문서가 폰트를 로드하지 않는 경우 앱과 동일한 폰트 스택을 주입(폰트-공정 비교)
      if (t.originStyle) {
        await page.addStyleTag({ content: t.originStyle }).catch(() => {});
      }
      if (Array.isArray(t.originActions)) {
        for (const action of t.originActions) {
          if (action.click) await page.click(action.click);
          if (typeof action.wait === 'number') await page.waitForTimeout(action.wait);
          if (action.waitFor) await page.waitForSelector(action.waitFor, { timeout: 15000 });
        }
      }
      const el = await page.waitForSelector(t.originSelector, { timeout: 15000 });
      await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
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
      // dev 전용 오버레이(next dev <nextjs-portal>·react-query devtools .tsqd-parent-container)가
      // 우하단 FAB 클릭을 가로채므로 제거(디자인 UI 아님, 전체 캡처에도 이롭다)
      await page
        .addStyleTag({
          content:
            'nextjs-portal,.tsqd-parent-container{display:none!important}',
        })
        .catch(() => {});
      if (t.appStyle) {
        await page.addStyleTag({ content: t.appStyle }).catch(() => {});
      }
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
