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
// AUTH_MODE=login 이면 storageState 대신 컨텍스트마다 STAFF_ID/STAFF_PW 로 로그인한다.
const LOGIN_IN_SESSION =
  process.env.AUTH_MODE === 'login' && !!process.env.STAFF_ID && !!process.env.STAFF_PW;

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
          if (action.fill) await page.fill(action.fill[0], action.fill[1]);
          if (action.press) await page.press(action.press[0], action.press[1]);
          if (typeof action.wait === 'number') await page.waitForTimeout(action.wait);
          if (action.waitFor) await page.waitForSelector(action.waitFor, { timeout: 15000 });
        }
      }
      const shotTarget = t.originSelector
        ? await page.waitForSelector(t.originSelector, { timeout: 15000 })
        : page;
      await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
      await mkdir(path.join(OUT, 'origin'), { recursive: true });
      await shotTarget.screenshot({ path: path.join(OUT, 'origin', `${t.id}.png`) });
      await ctx.close();
      console.log(`origin captured: ${t.id}`);
    }
    if (side !== 'origin') {
      const ctx = await browser.newContext({
        viewport: { width: t.viewport.w, height: t.viewport.h },
        deviceScaleFactor: 1,
        ...(LOGIN_IN_SESSION ? {} : { storageState: AUTH }),
      });
      const page = await ctx.newPage();
      // AUTH_MODE=login: 저장된 storageState 대신 이 컨텍스트에서 직접 로그인한다.
      // Supabase refresh token 로테이션 때문에 storageState는 캡처 1회 뒤 무효화되고,
      // 그때부터 클라 RPC가 anon 키로 나가 authenticated 전용 RPC가 401이 된다.
      if (LOGIN_IN_SESSION) {
        await page.goto(APP_ORIGIN + '/staff/login', { waitUntil: 'networkidle' });
        await page.fill('#username', process.env.STAFF_ID);
        await page.fill('#password', process.env.STAFF_PW);
        await page.click('button[type="submit"]');
        await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
      }
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
          if (action.fill) await page.fill(action.fill[0], action.fill[1]);
          if (action.press) await page.press(action.press[0], action.press[1]);
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
