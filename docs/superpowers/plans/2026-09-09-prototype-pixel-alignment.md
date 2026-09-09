# prototype 픽셀 퍼펙트 정합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** prototype 최신 원본(`.dc.html`)과 앱 화면을 완전 픽셀 퍼펙트로 정합하기 위한 기반(원본 확보·diff 하네스·전역 토큰)을 구축하고, 라우터↔원본 매핑을 전수 감사한 뒤, staff 파일럿 1화면으로 정합 워크플로우를 확립한다.

**Architecture:** 원본은 staging(`staging.d2h12382xiksft.amplifyapp.com`)에서 헤드리스로 캡처하고, 구현은 원본 소스의 인라인 px를 앱 컴포넌트에 직접 이식한다(왕도). 검증은 원본↔앱 스크린샷 오버레이 diff로 1px 수렴을 확인한다. 실행은 **단일 `master` 트리**에서 화면별 서브에이전트 병렬 이식 + 메인 단일 dev 서버 캡처/diff(워크트리 미사용).

**Tech Stack:** Next.js 16.3 / React 19.2 / Tailwind v4 · Playwright(캡처) · pixelmatch + pngjs(diff) · 원본 런타임 x-dc/`support.js`(staging).

## Global Constraints

- **정본 = 최신 개별 `.dc.html`** (청록 `#14A497`·"관리비서"·`x-dc`/`DCLogic`). `docs/prototype/_design-system.css`(구버전 파랑 `#3182F6`·"홈지기"·`sc-*`)는 **폐기 — 참조 금지**.
- **전역 토큰 정본값**: `--blue:#14A497; --blue-d:#0E8677; --blue-t:#E2F5F1; --blue-t2:#EFFBF8; --bg:#F2F4F6; --surface:#fff; --line:#E8EBEE; --line2:#F1F3F5; --t1:#191F28; --t2:#4E5968; --t3:#8B95A1; --t4:#B0B8C1; --green:#12B886; --green-t:#E6F8F1; --red:#F04452; --red-t:#FDECEE; --amber:#FF922B; --amber-t:#FFF3E6`. 폰트 `'Pretendard Variable','Pretendard',-apple-system,system-ui,sans-serif`.
- **단위 test 신규 작성 안 함**(프로젝트 정책). 검증 = `tsc`/`lint`/`build`/기존 `vitest` 그린 + 시각 오버레이 diff 스팟체크.
- **순수 표현 정합만** — 백엔드·데이터 모델·마이그레이션 변경 없음. 로직/데이터는 현 앱 유지.
- **수렴 기준**: 기본 뷰포트 오버레이에서 구조적 불일치 0 · 시각 픽스처 적용 시 diff 픽셀 비율 ≤ 0.5% · 데이터 텍스트 값 차이는 대상 제외(셀 치수·스타일만).
- **뷰포트 규약(데스크톱)**: 원본 `.hf-app` 프레임 `1340×880` 크롭 ↔ 앱은 뷰포트 `1340×880` 풀 캡처. DPR(deviceScaleFactor) `1` 고정. 사이드바 `240` / 상단 `62` 정합.
- **Next.js 특수 버전 주의**: 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인(AGENTS.md).
- **Codex 워커 제약**: 샌드박스라 git·네트워크·브라우저 불가 → 캡처/diff·커밋·`npm install`은 Claude가 수행. Codex/서브에이전트는 소스 px 이식(파일 편집)만.
- **범위**: 이 계획서 = Phase 0(Task 1–3) + Phase 1(Task 4) + staff 파일럿(Task 5). staff 나머지·HQ·resident·partner는 Task 4 매트릭스 확정 후 **후속 계획**에서 상세화.

---

## File Structure

- `scripts/pixel-diff/capture.mjs` — Playwright 캡처(원본 staging + 앱 localhost). 단일 책임: 스냅샷 생성.
- `scripts/pixel-diff/diff.mjs` — pixelmatch 오버레이 diff + 불일치 비율 리포트.
- `scripts/pixel-diff/targets.json` — 화면별 캡처 대상(원본 URL·셀렉터·앱 URL·뷰포트·픽스처).
- `scripts/pixel-diff/README.md` — 사용법·수렴 기준.
- `scripts/pixel-diff/.auth/` — Playwright `storageState`(로그인 세션). git 무시.
- `docs/prototype/staff/**` — staging에서 확보한 vendored staff 원본.
- `app/globals.css` — 전역 토큰 정합(수정).
- `docs/audit/prototype-pixel-map-2026-09-09.md` — 라우터↔원본 매핑 감사 매트릭스.

---

### Task 1: staff 원본 vendoring

staging에 배포된 staff 화면 원본을 로컬로 확보한다(감사·오프라인 대조 기반). 원본은 `x-dc` 런타임 의존이므로 렌더는 staging으로 하되, **소스 대조**는 로컬 파일로 한다.

**Files:**
- Create: `docs/prototype/staff/<screen>/<screen>.dc.html` (다수)
- Create: `docs/prototype/staff/_sitemap.json` (수집된 staff 화면 경로 목록)

**Interfaces:**
- Produces: `docs/prototype/staff/_sitemap.json` = `[{ "id": string, "path": "/staff/<screen>/<screen>.dc.html" }]` — Task 4 감사가 원본 목록으로 소비.

- [ ] **Step 1: staff 진입 화면의 네비에서 화면 목록 추출**

`receipt-management`(staff 첫 화면)의 사이드바 링크/스크립트에서 staff 화면 경로를 모은다.

```bash
base=https://staging.d2h12382xiksft.amplifyapp.com
mkdir -p docs/prototype/staff
curl -s "$base/staff/receipt-management/receipt-management.dc.html" -o /tmp/staff-entry.html
# 사이드바 hf-item 및 스크립트 내 화면 경로 후보 추출
grep -oE '[a-z0-9-]+/[a-z0-9-]+\.dc\.html' /tmp/staff-entry.html | sort -u
grep -oE "location\.href='[^']+'" /tmp/staff-entry.html | sort -u
```

Expected: `management-fee/...`, `bill/...`, `overdue/...` 등 staff 화면 경로 후보 목록.

- [ ] **Step 2: 화면 경로 목록을 `_sitemap.json`으로 확정**

Step 1 출력 + 앱 라우트명(참고: `buildings`, `management-fee`, `utilities`, `overdue`, `receipts`, `messaging`, `moving-settlement`, `notices`, `setup`, `fee-items`, `customer-numbers`, `long-term-repair`, `vendor-management`, `accounts`, 대시보드)으로 후보 경로를 만들어 각 URL의 HTTP 코드를 확인, 200만 채택.

```bash
base=https://staging.d2h12382xiksft.amplifyapp.com
for s in receipt-management management-fee bill overdue utilities buildings tenants messaging moving-settlement notices setup fee-items customer-numbers long-term-repair vendor-management accounts dashboard staff-management; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 8 "$base/staff/$s/$s.dc.html")
  echo "$code  $s"
done
```

채택된 경로를 `docs/prototype/staff/_sitemap.json`에 기록.

- [ ] **Step 3: 각 원본 `.dc.html` 다운로드**

```bash
base=https://staging.d2h12382xiksft.amplifyapp.com
# _sitemap.json의 각 id에 대해:
#   mkdir -p docs/prototype/staff/<id> && curl -s "$base/staff/<id>/<id>.dc.html" -o docs/prototype/staff/<id>/<id>.dc.html
```

- [ ] **Step 4: 정본 검증 (청록·x-dc 확인)**

```bash
grep -l '#14A497' docs/prototype/staff/*/*.dc.html | wc -l   # 다수여야
grep -rL 'x-dc' docs/prototype/staff/*/*.dc.html              # 비어야(모두 x-dc)
grep -rl '#3182F6\|홈지기' docs/prototype/staff/*/*.dc.html    # 비어야(구버전 혼입 없음)
```

Expected: 모든 파일이 청록·`x-dc`. 구버전 마커 0건.

- [ ] **Step 5: Commit**

```bash
git add docs/prototype/staff
git commit -m "chore(prototype): vendor staff 원본 dc.html from staging for pixel alignment"
```

---

### Task 2: 픽셀 diff 하네스

원본(staging)과 앱(localhost)을 동일 프레임으로 캡처하고 오버레이 diff를 산출하는 재사용 스크립트.

**Files:**
- Create: `scripts/pixel-diff/capture.mjs`
- Create: `scripts/pixel-diff/diff.mjs`
- Create: `scripts/pixel-diff/targets.json`
- Create: `scripts/pixel-diff/README.md`
- Modify: `package.json` (devDependency: `playwright`, `pixelmatch`, `pngjs`)
- Modify: `.gitignore` (`scripts/pixel-diff/.auth/`, `scripts/pixel-diff/out/`)

**Interfaces:**
- `targets.json` 항목: `{ "id": string, "originUrl": string, "originSelector": string, "appPath": string, "viewport": {"w": number, "h": number}, "device": "desktop"|"mobile" }`
- `capture.mjs` CLI: `node scripts/pixel-diff/capture.mjs <id|all> [--side=origin|app|both]` → `scripts/pixel-diff/out/{origin,app}/<id>.png`
- `diff.mjs` CLI: `node scripts/pixel-diff/diff.mjs <id|all>` → `out/diff/<id>.png` + stdout `<id>: <mismatchPct>%`

- [ ] **Step 1: 의존성 설치 (Claude 수행)**

```bash
npm install -D playwright pixelmatch pngjs
npx playwright install chromium
```

Expected: 3개 devDependency 추가, chromium 다운로드 완료.

- [ ] **Step 2: `targets.json` 초기 작성 (파일럿 1개 항목)**

```json
[
  {
    "id": "staff-receipt-management",
    "originUrl": "https://staging.d2h12382xiksft.amplifyapp.com/staff/receipt-management/receipt-management.dc.html",
    "originSelector": ".hf-app",
    "appPath": "/staff/receipts",
    "viewport": { "w": 1340, "h": 880 },
    "device": "desktop"
  }
]
```

- [ ] **Step 3: `capture.mjs` 작성**

```js
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'out');
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const AUTH = path.join(ROOT, '.auth', 'staff.json');

const targets = JSON.parse(await readFile(path.join(ROOT, 'targets.json'), 'utf8'));

const idArg = process.argv[2] || 'all';
const side = (process.argv.find(a => a.startsWith('--side=')) || '--side=both').split('=')[1];
const list = idArg === 'all' ? targets : targets.filter(t => t.id === idArg);

const browser = await chromium.launch();
for (const t of list) {
  const ctx = await browser.newContext({
    viewport: { width: t.viewport.w, height: t.viewport.h },
    deviceScaleFactor: 1,
  });
  if (side !== 'app') {
    const page = await ctx.newPage();
    await page.goto(t.originUrl, { waitUntil: 'networkidle' });
    const el = await page.waitForSelector(t.originSelector, { timeout: 15000 });
    await mkdir(path.join(OUT, 'origin'), { recursive: true });
    await el.screenshot({ path: path.join(OUT, 'origin', `${t.id}.png`) });
    await page.close();
  }
  if (side !== 'origin') {
    // 앱은 로그인 세션(storageState) 재사용
    const appCtx = await browser.newContext({
      viewport: { width: t.viewport.w, height: t.viewport.h },
      deviceScaleFactor: 1,
      storageState: AUTH,
    });
    const page = await appCtx.newPage();
    await page.goto(APP_ORIGIN + t.appPath, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400); // 폰트·데이터 안정화
    await mkdir(path.join(OUT, 'app'), { recursive: true });
    await page.screenshot({ path: path.join(OUT, 'app', `${t.id}.png`) });
    await page.close();
    await appCtx.close();
  }
  await ctx.close();
  console.log(`captured ${t.id}`);
}
await browser.close();
```

- [ ] **Step 4: `diff.mjs` 작성**

```js
import { readFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'out');

async function load(p) { return PNG.sync.read(await readFile(p)); }

const idArg = process.argv[2] || 'all';
const ids = idArg === 'all'
  ? (await readdir(path.join(OUT, 'origin'))).map(f => f.replace('.png', ''))
  : [idArg];

await mkdir(path.join(OUT, 'diff'), { recursive: true });
for (const id of ids) {
  const a = await load(path.join(OUT, 'origin', `${id}.png`));
  const b = await load(path.join(OUT, 'app', `${id}.png`));
  const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
  const diff = new PNG({ width: w, height: h });
  // 크기 상이 시 좌상단 정렬 비교(프레임 규약상 동일해야 함)
  const crop = (img) => {
    if (img.width === w && img.height === h) return img;
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(img, out, 0, 0, w, h, 0, 0);
    return out;
  };
  const ca = crop(a), cb = crop(b);
  const mismatch = pixelmatch(ca.data, cb.data, diff.data, w, h, { threshold: 0.1 });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(OUT, 'diff', `${id}.png`), PNG.sync.write(diff));
  const pct = ((mismatch / (w * h)) * 100).toFixed(3);
  console.log(`${id}: ${pct}%  (${mismatch}px / ${w}x${h})`);
}
```

- [ ] **Step 5: 앱 로그인 세션 생성(1회) + `README.md` 작성**

staff 계정으로 로그인해 `storageState`를 저장하는 절차를 README에 기록하고 실행. (테스트 계정: `admin` / 메모리 참조 — org_owner)

```js
// scripts/pixel-diff/save-auth.mjs (README에 포함)
import { chromium } from 'playwright';
const b = await chromium.launch();
const c = await b.newContext();
const p = await c.newPage();
await p.goto('http://localhost:3000/staff/login');
// 아이디/비번 입력 후 로그인 성공까지 대기 — 계정은 실행자가 주입
await p.fill('#lgId, input[autocomplete=username]', process.env.STAFF_ID);
await p.fill('input[type=password]', process.env.STAFF_PW);
await p.click('button:has-text("로그인")');
await p.waitForURL('**/staff/**', { timeout: 15000 });
await c.storageState({ path: 'scripts/pixel-diff/.auth/staff.json' });
await b.close();
```

`README.md`엔 수렴 기준(구조 0 · ≤0.5%)과 CLI 사용법을 명시.

- [ ] **Step 6: 하네스 자기검증 실행**

dev 서버가 `localhost:3000`에서 실행 중인 상태에서:

```bash
node scripts/pixel-diff/save-auth.mjs        # STAFF_ID/STAFF_PW env 주입
node scripts/pixel-diff/capture.mjs staff-receipt-management --side=both
node scripts/pixel-diff/diff.mjs staff-receipt-management
```

Expected: `out/origin/`·`out/app/`·`out/diff/`에 PNG 생성, stdout에 불일치 % 출력(값 자체는 아직 큼 — 하네스 동작 확인이 목적).

- [ ] **Step 7: Commit**

```bash
git add scripts/pixel-diff package.json package-lock.json .gitignore
git commit -m "feat(pixel-diff): add origin/app screenshot capture + overlay diff harness"
```

---

### Task 3: 전역 토큰 정합

`app/globals.css`의 디자인 토큰을 정본값(§Global Constraints)과 정밀 대조해 잔여 드리프트만 교정한다. teal pivot으로 대부분 청록화되어 있으므로 **차이 나는 값만** 수정.

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: 정합된 `:root` 토큰 — 이후 모든 화면 정합의 공유 기반.

- [ ] **Step 1: 현재 토큰과 정본 대조**

```bash
grep -nE -- '--blue|--bg|--line|--t[1-4]|--green|--red|--amber|--surface|Pretendard|shadow' app/globals.css
```

정본값(§Global Constraints)과 1:1 대조해 **불일치 항목 목록**을 만든다(특히 그림자·중간톤·폰트 스택).

- [ ] **Step 2: 불일치 토큰 교정**

대조에서 나온 차이만 정본값으로 교체. 예(실제 diff는 Step 1 결과에 따름):

```css
/* 예시 — 실제로는 Step 1에서 확인된 불일치만 수정 */
:root {
  --blue:#14A497; --blue-d:#0E8677; --blue-t:#E2F5F1; --blue-t2:#EFFBF8;
  /* 폰트 스택에 'Pretendard Variable' 우선 포함 확인 */
}
```

- [ ] **Step 3: 검증 — 빌드·시각 스팟체크**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

dev 서버에서 대표 화면 2–3개(로그인·대시보드·목록)를 육안 확인 — 색/폰트 회귀 없음.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "fix(design-tokens): align globals.css :root with prototype teal canon"
```

---

### Task 4: 라우터↔원본 매핑 감사 (전수)

앱 라우터 전수(~63)를 원본 화면과 1:1 매핑하고 3방향 갭을 매트릭스로 산출한다. **이 산출물이 후속 정합 계획의 백로그가 된다.**

**Files:**
- Create: `docs/audit/prototype-pixel-map-2026-09-09.md`

**Interfaces:**
- Consumes: `docs/prototype/staff/_sitemap.json`(Task 1), staging 원본(HTTP 확인).
- Produces: 매핑 매트릭스(persona별 표) — 각 행 `앱 라우트 | 대응 원본 | 원본 위치 | 현 정합상태 | px갭 요약 | 작업량(S/M/L)`.

- [ ] **Step 1: 앱 라우터 전수 열거**

```bash
find app -name 'page.tsx' | sed 's#/page.tsx##; s#^app/##' | sort
```

persona별(staff/platform-admin/partner/resident/공개)로 그룹핑.

- [ ] **Step 2: 원본 화면 목록 수집(persona별)**

각 persona 진입 화면의 네비/스크립트에서 원본 경로를 수집(Task 1의 staff 방식과 동일). HTTP 200 확인으로 존재 검증. HQ는 로컬 `docs/prototype/admin/*`, resident는 `docs/prototype/resident/*` 병행.

- [ ] **Step 3: 매트릭스 작성**

각 앱 라우트에 대응 원본을 매핑하고 3방향 갭을 표기:
- (a) 원본 없는 앱 라우트 → "원본 없음(추가 구현)"
- (b) 앱 없는 원본 → "미구현"
- (c) 매핑되나 미정합 → px갭 요약 + 작업량

현 정합상태는 메모리/기존 PR 이력 참고(예: receipts·buildings·HQ·resident 다수는 이미 개별 정합됨 → "정합됨(재검증 대상)").

`docs/audit/prototype-pixel-map-2026-09-09.md`에 persona별 표로 기록. 표 상단에 요약(전체 N / 정합됨 / 미정합 / 원본없음 / 미구현).

- [ ] **Step 4: 감사 정합성 검증**

```bash
# 앱 라우트 수와 매트릭스 행 수 일치 확인
find app -name 'page.tsx' | wc -l
grep -c '^| /' docs/audit/prototype-pixel-map-2026-09-09.md   # 표 행 수(형식에 맞게)
```

라우트 누락 0 확인.

- [ ] **Step 5: Commit**

```bash
git add docs/audit/prototype-pixel-map-2026-09-09.md
git commit -m "docs(audit): router↔prototype mapping matrix for pixel alignment"
```

---

### Task 5: staff 파일럿 화면 정합 (워크플로우 확립)

Task 4 매트릭스에서 **미정합 + 중간 복잡도** staff 화면 1개를 선정(후보: `management-fee` 또는 `buildings` 상세 — 사이드바+테이블+폼 등 대표 컴포넌트 포함)해 정합하고, 이후 서브에이전트에 위임할 **정합 절차 템플릿**을 확립한다.

**Files:**
- Modify: 선정 화면의 앱 컴포넌트(들) — 예 `app/(staff)/staff/(app)/management-fee/**`
- Modify: `scripts/pixel-diff/targets.json` (선정 화면 항목 추가)

**Interfaces:**
- Consumes: 하네스(Task 2), 정합 토큰(Task 3), 매트릭스(Task 4).
- Produces: 정합된 화면 + `README.md`에 확립된 **정합 워크플로우 절차**(후속 화면·서브에이전트가 그대로 따름).

- [ ] **Step 1: 파일럿 화면 선정 + `targets.json` 추가**

매트릭스에서 선정. 원본 URL·앱 경로·셀렉터를 `targets.json`에 추가.

- [ ] **Step 2: 원본 소스에서 px 사양 추출**

```bash
# 선정 화면 원본을 열어 인라인/클래스 치수 확보
grep -oE '(height|width|padding|margin|gap|border-radius|font-size|font-weight|flex|line-height):[^;"]+' docs/prototype/staff/<id>/<id>.dc.html | sort | uniq -c | sort -rn
```

컴포넌트별 정확한 px·색·타이포 목록을 만든다.

- [ ] **Step 3: 베이스라인 캡처·diff**

```bash
node scripts/pixel-diff/capture.mjs <id> --side=both
node scripts/pixel-diff/diff.mjs <id>
```

`out/diff/<id>.png`를 열어 불일치 영역을 식별(간격·정렬·크기·색·타이포·컴포넌트 형태).

- [ ] **Step 4: 원본 px를 앱 컴포넌트에 이식**

Step 2 사양·Step 3 diff를 근거로 앱 컴포넌트의 Tailwind 클래스/스타일을 원본 치수와 일치시킨다. **데이터/로직은 건드리지 않음**(표현만).

- [ ] **Step 5: 재캡처·diff — 수렴까지 반복**

```bash
node scripts/pixel-diff/capture.mjs <id> --side=app
node scripts/pixel-diff/diff.mjs <id>
```

수렴 기준(구조 불일치 0 · diff ≤0.5%) 충족까지 Step 4–5 반복. 데이터 텍스트 차이로 인한 잔차는 픽스처/마스킹으로 제외.

- [ ] **Step 6: 코드 검증**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 그린. (build는 배치 말미에 일괄 수행 가능)

- [ ] **Step 7: 워크플로우 절차 문서화 + Commit**

`scripts/pixel-diff/README.md`에 Step 2–6을 **재사용 절차**로 정리(후속 화면·서브에이전트 위임용). 커밋:

```bash
git add app scripts/pixel-diff
git commit -m "feat(pixel-align): align staff <id> to prototype (pilot) + workflow template"
```

---

## 후속 (이 계획 밖 — Task 4 매트릭스 확정 후 별도 계획)

- **Phase 2 확대**: staff 나머지 화면을 매트릭스 우선순위대로 **화면별 서브에이전트 병렬 이식**(파일 비겹침 스케줄링) → 메인이 단일 dev 서버로 순차 캡처/diff 검증 → 배치 커밋. 절차는 Task 5에서 확립한 README 템플릿을 따름.
- **persona 확대**: HQ / resident / partner (모바일 뷰포트 규약 추가: 원본 `.phone .screen` ↔ 앱 모바일 뷰포트).
- 공통 컴포넌트 대수술이 여러 화면과 겹치면 그 건만 워크트리 격리(예외).

## Self-Review

- **Spec coverage**: 정본 정의(Task 1·3·Global) · 원본 확보(Task 1) · 하네스(Task 2) · 전역 토큰(Task 3) · 매핑 감사(Task 4) · 픽셀 정합 워크플로우(Task 5) · 뷰포트/데이터 처리(Global·Task 2·5) — spec 각 절이 태스크로 커버됨. Phase 2 대량 화면은 의도적으로 후속 계획(감사 의존)으로 분리.
- **Placeholder scan**: 파일럿 대상 화면은 "매트릭스에서 선정"으로 파라미터화했으나 선정 기준·절차는 구체 기술(placeholder 아님, 순차 의존). 하네스 코드는 실동작 코드로 제공.
- **Type consistency**: `targets.json` 스키마가 `capture.mjs`(originUrl/originSelector/appPath/viewport)·`diff.mjs`(id)에서 일관. `_sitemap.json` 형식이 Task 1↔4에서 일관.
