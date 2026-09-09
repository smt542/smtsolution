# Messenger 빠른발송 FAB(.fmp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원본 `.fmp-fab`/`.fmp`(스태프 우하단 청록 FAB → 820px 빠른 메시지 발송 패널)을 픽셀 퍼펙트로 이식하고 Popbill 발송 인프라(SMS·알림톡, 즉시·1회예약·매월반복)에 실배선한다.

**Architecture:** `components/messenger/**`에 패널 서브컴포넌트를 두고 얇은 `MessengerFab` 진입점을 `app/(staff)` 셸(AppShell)에 전역 마운트. 표현은 원본 CSS를 CSS Module로 1:1 이식, 데이터/발송은 기존 messaging 인프라(`/api/messaging/send`·`schedule_messages`·`useMessagePointQuote`·`message_templates`) 재사용. 매월 반복만 그린필드(마이그 + drain enqueue-next).

**Tech Stack:** Next.js(앱 자체 버전 — `node_modules/next/dist/docs` 준수), React client components, TypeScript, Supabase(Postgres RPC, security definer), Popbill(SMS/LMS/알림톡), Vitest(기존), `scripts/pixel-diff`(headless 캡처/diff).

## Global Constraints

- **검증 = 정적·기존 테스트·시각·스모크** (프로젝트 정책: **신규 단위테스트 미작성**). 각 태스크는 test-first 아님 → `구현 → 검증(tsc/lint/build/기존 vitest/pixel-diff/스모크) → 커밋`. 기존 테스트가 깨지면 의도대로 갱신.
- **tsc 소스 에러만**: `npx tsc --noEmit 2>&1 | grep -vE '\.next' | grep -E ': error' | head` → 출력 없어야 통과.
- **lint**: `npm run lint 2>&1 | tail -20` → 신규 에러 0.
- **build**(PR 완료 게이트): `npm run build`(Turbopack 아님 — webpack). 워크트리엔 node_modules 없음 → 검증 전 `projects/home_erp`(node_modules 보유)에 정션 연결, 끝나면 `rmdir` 정션 제거. 
  - 정션: `cmd //c mklink /J C:\Users\leebj\orca\workspaces\home_erp\messenger-fab\node_modules C:\Users\leebj\orca\projects\home_erp\node_modules` (검증 후 `cmd //c rmdir C:\Users\leebj\orca\workspaces\home_erp\messenger-fab\node_modules`).
- **픽셀 정본**: `docs/prototype/staff/fee-item/Messenger.dc.html`(이 브랜치에 vendored). 원본 인라인 px·hex를 **그대로** 이식(눈대중 금지). 청록 `--blue:#14A497`. 전역 토큰은 `app/globals.css` 재사용.
- **범위 경계**: 정본 파일의 `.rnb-*`(A/S 우측패널)·`.asp-*`(A/S 인쇄)는 **이식 안 함**(as-status-rail 소관). `.fmp*`·`.ak-*`·`.ph-*`·`.dt-*`·`.cal-*`·`.si`·`.dot`·`.drag`·`.fmpc*`만.
- **발송 context** 값: `"빠른발송"`. **채널 게이팅**: SMS 실발송 유효 / 알림톡은 `POPBILL_KAKAO_SENDER`·승인 템플릿코드 완료 후 유효(배선은 완비, 미설정 시 우아한 안내).
- **마이그 번호**: 현 추정 `0150` — **커밋 직전** `git ls-remote/fetch 후 origin/master supabase/migrations max +1` 재확인. 충돌 시 재번호.
- **staff 전용 마운트**: `pathname.startsWith("/staff")`에서만 렌더.
- **커밋 메시지 끝**에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 필수. 브랜치 `feat/messenger-fab`(off `feat/prototype-pixel-alignment`).

---

# Phase 1 — 픽셀정합 셸 (PR1)

목표: FAB + 패널 셸의 완전 픽셀정합 + 열기/최소화/드래그/세그 전환(정적 콘텐츠). AppShell 전역 마운트 + QuickAccessRail teal 스텁 제거. 발송·실데이터 없음.

### Task 1.1: 원본 CSS를 CSS Module로 이식

**Files:**
- Create: `components/messenger/messenger.module.css`

**Interfaces:**
- Produces: `.fmpFab`, `.fmp`, `.fmpH`, `.fmpBody`, `.fmpF`, `.fmpSeg`, `.si`, `.fmpBubble`, … (CSS Module 클래스). 원본 케밥 클래스(`.fmp-fab`)를 CSS Module 카멜(`.fmpFab`)로 매핑하거나, `:global` 없이 파일 스코프 유지를 위해 **원본 클래스명 그대로 두고 컴포넌트에서 `styles["fmp-fab"]`로 참조**(권장 — 원본 대조 용이).

- [ ] **Step 1: 정본에서 `.fmp*` 스타일 블록 추출**

정본 `docs/prototype/staff/fee-item/Messenger.dc.html`의 `<style>`(L6–517)에서 **§Global Constraints 범위**의 선택자만 복사한다. `.rnb-*`·`.asp-*`·A/S 전용 키프레임은 제외. `:root` 토큰은 복사하지 말고 `var(--blue)` 등 참조를 그대로 둔다(globals.css 제공).

- [ ] **Step 2: `messenger.module.css` 작성**

원본 규칙을 파일에 붙여넣되:
- `.fmp-fab{position:fixed;right:22px;bottom:22px;width:52px;height:52px;…border-radius:999px;background:var(--blue);…box-shadow:0 12px 28px -8px rgba(20,164,151,.6);z-index:240;transition:.15s}` 등 **수치·hex·transition 그대로**.
- 원본 클래스명 유지(케밥). 컴포넌트에서 `import styles from "./messenger.module.css"` 후 `className={styles["fmp-fab"]}`.
- 원본이 `.fmp.show`/`.fmp-fab.hide` 등 상태 클래스를 쓰므로 그대로 이식(열림 트랜지션: opacity/transform).

- [ ] **Step 3: 검증(tsc/lint — CSS는 빌드 시 검증)**

Run: `npx tsc --noEmit 2>&1 | grep -vE '\.next' | grep -E ': error' | head`
Expected: 출력 없음(CSS Module 타입은 소비 컴포넌트 작성 후 재검증).

- [ ] **Step 4: 커밋**

```bash
git add components/messenger/messenger.module.css
git commit -m "feat(messenger): 원본 .fmp* CSS를 CSS Module로 1:1 이식

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 1.2: 패널 상태 타입 + 훅

**Files:**
- Create: `components/messenger/types.ts`
- Create: `components/messenger/useMessengerState.ts`

**Interfaces:**
- Produces:
  - `type ChannelMode = "sms" | "alim"`
  - `type RecipientType = "staff" | "tenant" | "owner" | "cleaner"`
  - `interface MessengerUiState { open: boolean; minimized: boolean; pos: {x:number;y:number} | null; channel: ChannelMode }`
  - `function useMessengerState(): { ui: MessengerUiState; openPanel(): void; closePanel(): void; toggleMin(): void; setPos(p): void; setChannel(c): void }` — 열림/최소화/드래그 위치/채널을 `sessionStorage`("messenger:ui")에 지속.

- [ ] **Step 1: `types.ts` 작성**

```ts
export type ChannelMode = "sms" | "alim";
export type RecipientType = "staff" | "tenant" | "owner" | "cleaner";

export interface MessengerUiState {
  open: boolean;
  minimized: boolean;
  pos: { x: number; y: number } | null; // 드래그 위치(우하단 기준 offset). null=기본 위치
  channel: ChannelMode;
}
```

- [ ] **Step 2: `useMessengerState.ts` 작성**

```ts
"use client";
import { useCallback, useEffect, useState } from "react";
import type { ChannelMode, MessengerUiState } from "./types";

const KEY = "messenger:ui";
const DEFAULT: MessengerUiState = { open: false, minimized: false, pos: null, channel: "sms" };

export function useMessengerState() {
  const [ui, setUi] = useState<MessengerUiState>(DEFAULT);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setUi({ ...DEFAULT, ...JSON.parse(raw) });
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(ui)); } catch { /* noop */ }
  }, [ui]);

  const openPanel = useCallback(() => setUi((s) => ({ ...s, open: true, minimized: false })), []);
  const closePanel = useCallback(() => setUi((s) => ({ ...s, open: false, minimized: false })), []);
  const toggleMin = useCallback(() => setUi((s) => ({ ...s, minimized: !s.minimized })), []);
  const setPos = useCallback((pos: MessengerUiState["pos"]) => setUi((s) => ({ ...s, pos })), []);
  const setChannel = useCallback((channel: ChannelMode) => setUi((s) => ({ ...s, channel })), []);

  return { ui, openPanel, closePanel, toggleMin, setPos, setChannel };
}
```

- [ ] **Step 3: 검증**

Run: `npx tsc --noEmit 2>&1 | grep -vE '\.next' | grep -E ': error' | head`
Expected: 출력 없음.

- [ ] **Step 4: 커밋**

```bash
git add components/messenger/types.ts components/messenger/useMessengerState.ts
git commit -m "feat(messenger): 패널 UI 상태 타입 + sessionStorage 지속 훅

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 1.3: FAB + 패널 셸(정적) + 드래그/최소화/세그

**Files:**
- Create: `components/messenger/MessengerFab.tsx`
- Create: `components/messenger/MessengerPanel.tsx`

**Interfaces:**
- Consumes: `useMessengerState`(1.2), `messenger.module.css`(1.1).
- Produces: `export function MessengerFab(): JSX.Element | null` — staff 경로에서만 FAB+패널 렌더. `MessengerPanel`은 셸(헤더 드래그·세그·바디 자리·푸터·최소화 버블)만, 콘텐츠는 후속 태스크에서 채움.

- [ ] **Step 1: `MessengerPanel.tsx`(셸) 작성**

정본 마크업 L519–591을 JSX로 이식. FAB SVG(L519), 헤더(L522: `.dot`+타이틀 "문자·알림톡 발송"+sub "화면을 보면서 발송할 수 있어요"+최소화/닫기 `.fmp-ic`), `.fmp-body`(L523) 안에 세그(L524 `.fmp-seg`: "문자(SMS)"/"알림톡"), 그 아래 자리표시 슬롯, 푸터(L570 `.fmp-f`>`.fmp-send`), 최소화 버블(L573 `.fmp-bubble`). 드래그는 헤더에 pointer 핸들러:

```tsx
"use client";
import { useRef } from "react";
import styles from "./messenger.module.css";
import type { ChannelMode } from "./types";

interface Props {
  channel: ChannelMode;
  minimized: boolean;
  pos: { x: number; y: number } | null;
  onChannel: (c: ChannelMode) => void;
  onMin: () => void;
  onClose: () => void;
  onPos: (p: { x: number; y: number }) => void;
  children?: React.ReactNode; // 바디 슬롯(후속 태스크)
}

export function MessengerPanel({ channel, minimized, pos, onChannel, onMin, onClose, onPos, children }: Props) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    const base = pos ?? { x: 0, y: 0 };
    drag.current = { dx: e.clientX - base.x, dy: e.clientY - base.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    onPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };
  // 원본 위치(right:22 bottom:22) 기준 드래그 오프셋 적용
  const style = pos ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined;

  // 최소화 버블(원본 L573)
  if (minimized) {
    return (
      <div className={styles["fmp-bubble"]} onClick={onMin} role="button" aria-label="메신저 펼치기">
        {/* ring svg + "문자·알림톡 발송" / 상태 라벨 — 원본 L573 이식 */}
      </div>
    );
  }

  return (
    <div className={styles["fmp"]} style={style} role="dialog" aria-modal="false" aria-label="문자·알림톡 발송">
      <div className={`${styles["fmp-h"]} ${styles["drag"]}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        {/* .dot svg + 타이틀/서브 + 최소화/닫기 아이콘(원본 L522) */}
        <button type="button" aria-label="최소화" onClick={onMin} className={styles["fmp-ic"]}>{/* svg */}</button>
        <button type="button" aria-label="닫기" onClick={onClose} className={styles["fmp-ic"]}>{/* svg */}</button>
      </div>
      <div className={styles["fmp-body"]}>
        <div className={styles["fmp-seg"]}>
          <div className={channel === "sms" ? `${styles["si"]} ${styles["on"]}` : styles["si"]} onClick={() => onChannel("sms")}>문자(SMS)</div>
          <div className={channel === "alim" ? `${styles["si"]} ${styles["on"]}` : styles["si"]} onClick={() => onChannel("alim")}>알림톡</div>
        </div>
        {children}
      </div>
      <div className={styles["fmp-f"]}>
        <div className={styles["fmp-send"]}>{/* svg */}<span>수신자를 선택해 주세요</span></div>
      </div>
    </div>
  );
}
```

> SVG path·정확한 텍스트·아이콘 치수는 정본 L519·L522·L570에서 그대로 복사.

- [ ] **Step 2: `MessengerFab.tsx`(진입점) 작성**

```tsx
"use client";
import { usePathname } from "next/navigation";
import styles from "./messenger.module.css";
import { useMessengerState } from "./useMessengerState";
import { MessengerPanel } from "./MessengerPanel";

export function MessengerFab() {
  const pathname = usePathname();
  const { ui, openPanel, closePanel, toggleMin, setPos, setChannel } = useMessengerState();
  if (!pathname.startsWith("/staff")) return null;

  return (
    <>
      {!ui.open && (
        <button type="button" aria-label="문자·알림톡 발송" className={styles["fmp-fab"]} onClick={openPanel}>
          {/* 원본 L519 채팅 svg */}
        </button>
      )}
      {ui.open && (
        <MessengerPanel
          channel={ui.channel}
          minimized={ui.minimized}
          pos={ui.pos}
          onChannel={setChannel}
          onMin={toggleMin}
          onClose={closePanel}
          onPos={setPos}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: 검증(tsc/lint)**

Run: `npx tsc --noEmit 2>&1 | grep -vE '\.next' | grep -E ': error' | head` → 출력 없음.
Run: `npm run lint 2>&1 | tail -20` → 신규 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add components/messenger/MessengerFab.tsx components/messenger/MessengerPanel.tsx
git commit -m "feat(messenger): FAB + 패널 셸(드래그/최소화/세그, 정적)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 1.4: AppShell 전역 마운트 + QuickAccessRail teal 스텁 제거

**Files:**
- Modify: `components/shell/AppShell.tsx:53-56` (main 뒤에 마운트)
- Modify: `components/shell/QuickAccessRail.tsx:27-39` (teal FAB 버튼 제거)

**Interfaces:**
- Consumes: `MessengerFab`(1.3).

- [ ] **Step 1: AppShell에 마운트**

`AppShell.tsx` 상단 import 추가: `import { MessengerFab } from "@/components/messenger/MessengerFab";`
`</main>` 닫힘(현 L55) 다음, 메인 컬럼 `</div>`(L56) 뒤(모바일 drawer 앞, 현 L57)에 삽입:

```tsx
      </div>

      {/* 스태프 전역 빠른발송 FAB */}
      <MessengerFab />

      {/* Mobile drawer */}
```

- [ ] **Step 2: QuickAccessRail teal FAB 스텁 제거**

`QuickAccessRail.tsx`에서 두 번째 `<button>`(현 L27–39, "도움말 열기" teal 원형)만 삭제. 사이드 패널 버튼(L14–26)은 유지. 남은 `<aside>`가 사이드패널 버튼만 렌더.

- [ ] **Step 3: 검증(tsc/lint + 개발서버 육안)**

Run: `npx tsc --noEmit 2>&1 | grep -vE '\.next' | grep -E ': error' | head` → 출력 없음.
개발서버(`projects/home_erp`에서 실행 중인 localhost:3000, 이 브랜치 병합 전이라 정션/수동 확인) 또는 build로 마운트 확인. fee-items·moving-settlement에서 teal FAB 중복 없음 확인.

- [ ] **Step 4: 커밋**

```bash
git add components/shell/AppShell.tsx components/shell/QuickAccessRail.tsx
git commit -m "feat(messenger): AppShell 전역 마운트 + QuickAccessRail teal 스텁 제거

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 1.5: pixel-diff 인터랙션 + 수렴 검증

**Files:**
- Modify: `scripts/pixel-diff/capture.mjs` (FAB 클릭→패널 열림 캡처 스텝)
- Modify: `scripts/pixel-diff/targets.json` (messenger 타겟 추가)

- [ ] **Step 1: capture.mjs에 인터랙션 추가**

앱 캡처 시 우하단 `.fmp-fab`(또는 `[aria-label="문자·알림톡 발송"]`) 클릭 → 패널(`.fmp`) 가시 후 캡처하는 옵션(예: target에 `click` 셀렉터·`waitFor`)을 추가. 원본은 `staff/fee-item/fee-item.dc.html` 로드 후 `#fmpFab` 클릭 → `#fmp` 표시.

- [ ] **Step 2: targets.json에 messenger 타겟**

```json
{ "name": "messenger-panel", "origin": "/staff/fee-item/fee-item.dc.html", "app": "/staff/fee-items", "click": "#fmpFab", "appClick": "[aria-label=\"문자·알림톡 발송\"]", "waitFor": ".fmp" }
```
(스키마는 기존 targets.json 형식에 맞춰 조정.)

- [ ] **Step 3: diff 실행·수렴 확인**

Run: `node scripts/pixel-diff/save-auth.mjs` (필요 시, 세션 ~1h) → `node scripts/pixel-diff/capture.mjs` → `node scripts/pixel-diff/diff.mjs`
Expected: 패널 구조적 불일치 0, 픽스처 diff ≤0.5%(pixel-alignment §6). 잔차는 messenger.module.css 수치 수정으로 수렴.

- [ ] **Step 4: 커밋 + PR1**

```bash
git add scripts/pixel-diff/capture.mjs scripts/pixel-diff/targets.json
git commit -m "test(messenger): pixel-diff에 FAB→패널 인터랙션 타겟 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
PR1 게이트: `npm run build` 통과(정션 후, 끝나면 rmdir). PR 생성(base master 또는 pixel-alignment 정책에 따름 — 사용자 확인).

---

# Phase 2 — 실데이터·실발송 (PR2)

목표: 수신자 4종·발신번호·템플릿·변수·폰 미리보기·바이트·포인트 견적·즉시/1회예약 실발송. `kind:"cleaner"`.

### Task 2.1: 순수 유틸 — 바이트 계산 + 변수 토큰

**Files:**
- Create: `lib/messenger/bytes.ts`
- Create: `lib/messenger/tokens.ts`

**Interfaces:**
- Produces:
  - `function byteLen(s: string): number` — EUC-KR 근사(한글 2, 그 외 1).
  - `function smsProduct(bytes: number): "SMS" | "LMS"` — `bytes <= 90 ? "SMS" : "LMS"`.
  - `const SMS_VARS: readonly string[]` = `["건물명","입주자명","호실","건물주명","청소담당자명"]` (원본 `TVARS`).
  - `function toRealToken(label: string): string` — `` `#{${label}}` ``.
  - `function insertToken(body: string, caret: number, label: string): { body: string; caret: number }`.

- [ ] **Step 1: `bytes.ts`**

```ts
export function byteLen(s: string): number {
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  return n;
}
export function smsProduct(bytes: number): "SMS" | "LMS" {
  return bytes <= 90 ? "SMS" : "LMS";
}
```

- [ ] **Step 2: `tokens.ts`**

```ts
// 원본 SMS 변수(TVARS, Messenger.dc.html L825)
export const SMS_VARS = ["건물명", "입주자명", "호실", "건물주명", "청소담당자명"] as const;

export function toRealToken(label: string): string {
  return `#{${label}}`; // 서버 renderTemplate(#{key})와 정합
}

export function insertToken(body: string, caret: number, label: string): { body: string; caret: number } {
  const tok = toRealToken(label);
  const next = body.slice(0, caret) + tok + body.slice(caret);
  return { body: next, caret: caret + tok.length };
}
```

- [ ] **Step 3: 검증** — `npx tsc --noEmit 2>&1 | grep -vE '\.next' | grep -E ': error' | head` → 없음.

- [ ] **Step 4: 커밋**

```bash
git add lib/messenger/bytes.ts lib/messenger/tokens.ts
git commit -m "feat(messenger): 바이트 계산 + 변수 토큰 유틸

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2.2: `kind:"cleaner"` + 렌더 변수 확장

**Files:**
- Modify: `lib/messaging/preset.ts:18` (kind union)
- Modify: `lib/messaging/preset.ts:46-59` (`buildRecipientRenderVariables`)

**Interfaces:**
- Produces: `MessageRecipient.kind` 에 `"cleaner"` 추가. 렌더 변수에 `입주자명·건물주명·청소담당자명`(= recipient.name 별칭) 추가.

- [ ] **Step 1: kind union에 cleaner 추가**

`preset.ts:18`:
```ts
  kind: "tenant" | "owner" | "staff" | "cleaner" | "vendor" | "etc";
```

- [ ] **Step 2: 렌더 변수 확장**

`buildRecipientRenderVariables` 반환 객체에 별칭 추가(원본 SMS 토큰 해석용):
```ts
  return {
    이름: recipient.name ?? "",
    입주자명: recipient.name ?? "",
    건물주명: recipient.name ?? "",
    청소담당자명: recipient.name ?? "",
    호수: recipient.unitNo ?? "",
    호실: recipient.unitNo ?? "",
    건물명: buildingName ?? "",
    ...(commonVariables ?? {}),
    ...(recipient.variables ?? {}),
  };
```

- [ ] **Step 3: 검증** — `npx tsc --noEmit …` 없음. `npx vitest run lib/messaging 2>&1 | tail -15` → 기존 그린(kind allowlist 없어 회귀 없음).

- [ ] **Step 4: 커밋**

```bash
git add lib/messaging/preset.ts
git commit -m "feat(messaging): recipient kind \"cleaner\" + 렌더 변수 별칭(입주자명/건물주명/청소담당자명)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2.3: 수신자 캐스케이드(4종 실배선)

**Files:**
- Create: `components/messenger/RecipientCascade.tsx`

**Interfaces:**
- Consumes: `useBuildings`(`hooks/reactquery/buildings/queries`), `useTenantList`(`occupancies/queries`), `useAccounts`(`accounts/queries`), `MessageRecipient`(preset), `ChannelMode`/`RecipientType`(types).
- Produces: `function RecipientCascade({ channel, onChange }: { channel: ChannelMode; onChange: (r: MessageRecipient[]) => void }): JSX.Element` — 유형→건물/직원→입주자/전체 캐스케이드. 선택 결과를 `MessageRecipient[]`로 상향.

- [ ] **Step 1: 유형 옵션(채널별)·캐스케이드 골격**

원본 `setTypeOpts`(L969): 알림톡 = `[tenant, owner]`, SMS = `[staff, tenant, owner, cleaner]`. 마크업은 정본 L534–538(`.fmp-casc`/`.fmp-dd2`) 이식.

```tsx
"use client";
import { useMemo, useState } from "react";
import { useBuildings } from "@/hooks/reactquery/buildings/queries";
import { useTenantList } from "@/hooks/reactquery/occupancies/queries";
import { useAccounts } from "@/hooks/reactquery/accounts/queries";
import type { MessageRecipient } from "@/lib/messaging/preset";
import type { ChannelMode, RecipientType } from "./types";
import styles from "./messenger.module.css";

const TYPE_LABEL: Record<RecipientType, string> = { staff: "직원", tenant: "입주자", owner: "건물주", cleaner: "청소 담당자" };

export function RecipientCascade({ channel, onChange }: { channel: ChannelMode; onChange: (r: MessageRecipient[]) => void }) {
  const [type, setType] = useState<RecipientType | "">("");
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const types: RecipientType[] = channel === "alim" ? ["tenant", "owner"] : ["staff", "tenant", "owner", "cleaner"];
  const { data: buildings = [] } = useBuildings();
  const { data: accounts = [] } = useAccounts();
  const { data: tenants = [] } = useTenantList(type === "tenant" && buildingId ? buildingId : 0);
  // …상태·메뉴 렌더(원본 L940–1025 로직 이식). 아래 Step 2에서 수신자 빌드.
  return <div className={styles["fmp-casc"]}>{/* 유형/2차/3차 dd + 전체(auto) */}</div>;
}
```

- [ ] **Step 2: 4종 수신자 빌드**

선택 확정 시 `MessageRecipient[]` 생성:
```ts
// tenant: 건물 → 입주자(또는 전체)
const tenantRecip = (t: { tenantName: string|null; phone: string|null; unitNo: string|null; occupancyId: number|null }): MessageRecipient =>
  ({ name: t.tenantName, phone: t.phone, unitNo: t.unitNo, kind: "tenant", ref: { occupancyId: t.occupancyId ?? undefined, buildingId: buildingId ?? undefined } });

// owner: 건물 → 건물주
const b = buildings.find((x) => x.id === buildingId);
const ownerRecip: MessageRecipient | null = b ? { name: b.ownerName, phone: b.ownerPhone, kind: "owner", ref: { buildingId: b.id } } : null;

// staff: 직원 목록(active)
const staffRecip = (a: { fullName: string; phone: string|null; userId: string }): MessageRecipient =>
  ({ name: a.fullName, phone: a.phone, kind: "staff", ref: { userId: a.userId } });

// cleaner: 건물.cleaningUserId → accounts에서 phone 해소
const cleanerId = b?.cleaningUserId ?? null;
const cleanerAcc = cleanerId ? accounts.find((a) => a.userId === cleanerId) : null;
const cleanerRecip: MessageRecipient | null = cleanerAcc
  ? { name: cleanerAcc.fullName, phone: cleanerAcc.phone, kind: "cleaner", ref: { userId: cleanerAcc.userId, buildingId: b?.id } }
  : null;
```
phone 없는 대상은 비활성/제외(원본 disabled 패턴). 선택 변경마다 `onChange(validRecipients(dedupeRecipients(selected)))` 호출(preset 헬퍼 재사용).

- [ ] **Step 3: 검증** — `npx tsc --noEmit …` 없음. 개발서버에서 유형별 캐스케이드·전화 표기 육안(정션 후).

- [ ] **Step 4: 커밋**

```bash
git add components/messenger/RecipientCascade.tsx
git commit -m "feat(messenger): 수신자 4종 캐스케이드(입주자/건물주/직원/청소담당) 실배선

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2.4: 발신번호 선택

**Files:**
- Create: `components/messenger/SenderSelect.tsx`

**Interfaces:**
- Produces: `function SenderSelect({ value, onChange }): JSX.Element` — 등록 org 발신번호(setup_config sms_sender + 기본) 목록 + 직접입력. 값은 발신번호 문자열.

- [ ] **Step 1: 등록 발신번호 소스 확인·훅**

`setup_config`의 sms_sender(및 기본 발신번호)를 읽는 기존 훅/쿼리를 찾아 사용(`org-sender-numbers` 메모리: `COALESCE(org setup_config.sms/fax_sender, env 기본)`). 없으면 setup 조회 훅 재사용. 마크업은 정본 L527–530(`.fmp-fromsel`/`.fmp-frommenu`) 이식.

- [ ] **Step 2: 직접입력 검증(미등록 차단)**

직접입력 발신번호는 저장/발송 전 `checkSenderNumber`(팝빌 등록검증, `lib/popbill` 또는 기존 저장검증 경로) 통과해야 사용. 미등록 시 안내(원본 `.fmp-fromadd`).

- [ ] **Step 3: 검증** — `npx tsc --noEmit …` 없음.

- [ ] **Step 4: 커밋**

```bash
git add components/messenger/SenderSelect.tsx
git commit -m "feat(messenger): 발신번호 선택(등록번호 + 직접입력 검증)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2.5: 메시지 작성(SMS) + 알림톡 폼

**Files:**
- Create: `components/messenger/MessageComposer.tsx`
- Create: `components/messenger/AlimtalkForm.tsx`

**Interfaces:**
- Consumes: `useMessageTemplates`(`messageTemplates/queries`), `byteLen`/`smsProduct`(bytes), `SMS_VARS`/`insertToken`(tokens).
- Produces:
  - `MessageComposer({ body, onBody, templateId, onTemplate })` — textarea(`.fmp-ta`) + 변수칩(`.fmp-vars`) + 바이트(`.fmp-bytes` "N자 · SMS/LMS") + SMS 템플릿 메뉴.
  - `AlimtalkForm({ templateId, onTemplate, vars, onVars })` — 승인 템플릿 선택(`status` 심사중 비활성) + 사용자입력 변수 폼(자동변수 제외).

- [ ] **Step 1: `MessageComposer.tsx`(SMS)**

정본 L552–556 이식. 변수칩 클릭 시 `insertToken(body, caret, label)`로 `#{라벨}` 삽입. 바이트 표시:
```tsx
const bytes = byteLen(body);
// <div className={styles["fmp-bytes"]}>{bytes}자 · <b>{smsProduct(bytes)}</b></div>  // LMS면 .lms 색
```
템플릿 선택 시 `message_templates.body`를 textarea에 주입.

- [ ] **Step 2: `AlimtalkForm.tsx`(알림톡)**

정본 L558–559·L864–899(`AKTPLS`/`renderAKForm`) 이식하되 데이터는 `useMessageTemplates()`(alimtalk_template_code 있는 것). `status` 심사중(미승인)은 비활성. 사용자입력 변수만 폼 노출(자동변수 `AUTO_VARS`는 서버 해석 — 폼 제외). 선택 시 `templateId` 상향, 본문/버튼은 서버가 template_code로 처리.

- [ ] **Step 3: 검증** — `npx tsc --noEmit …` 없음. 바이트/LMS 전환·템플릿 주입 육안.

- [ ] **Step 4: 커밋**

```bash
git add components/messenger/MessageComposer.tsx components/messenger/AlimtalkForm.tsx
git commit -m "feat(messenger): 메시지 작성(SMS 바이트·변수칩) + 알림톡 승인템플릿 폼

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2.6: 폰 미리보기

**Files:**
- Create: `components/messenger/PhonePreview.tsx`

**Interfaces:**
- Consumes: `ChannelMode`, 본문·수신자 컨텍스트.
- Produces: `PhonePreview({ channel, body, sampleRecipient, template })` — 정본 L562–564·L852–905(`updatePrev`/`resolveVars`) 이식. SMS=문자 버블, 알림톡=카카오 버블(`.ph-ak-*`). 변수는 첫 수신자 값으로 치환 미리보기.

- [ ] **Step 1: 미리보기 렌더**

`{라벨}`/`#{라벨}` 토큰을 표본 수신자 렌더 변수(`buildRecipientRenderVariables`)로 치환해 표시. 원본은 `<b>`로 강조. 빈 상태(`.ph-empty`) 처리.

- [ ] **Step 2: 검증** — `npx tsc --noEmit …` 없음. SMS/알림톡 미리보기 전환 육안.

- [ ] **Step 3: 커밋**

```bash
git add components/messenger/PhonePreview.tsx
git commit -m "feat(messenger): 라이브 폰 미리보기(SMS/카카오)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2.7: 예약(즉시 + 1회 날짜·시간)

**Files:**
- Create: `components/messenger/SchedulePicker.tsx`

**Interfaces:**
- Produces: `SchedulePicker({ value, onChange }: { value: { scheduledAt: string | null }; onChange }): JSX.Element` — 예약 체크(`.fmp-ck`) + 날짜(`.fmp-cal`)·시간(`.fmp-tlist`) 피커. **반복(매월)은 Phase 3에서 추가** — 이 태스크는 즉시/1회만. `scheduledAt` ISO(KST) 또는 null(즉시).

- [ ] **Step 1: 예약 UI(반복 제외)**

정본 L543–547 중 날짜·시간만 이식(반복 `.fmp-rplist`는 P3). 예약 체크 해제 시 `scheduledAt=null`(즉시). 달력·시간 로직은 정본 `dpRender`/`renderTP` 이식.

- [ ] **Step 2: 검증** — `npx tsc --noEmit …` 없음.

- [ ] **Step 3: 커밋**

```bash
git add components/messenger/SchedulePicker.tsx
git commit -m "feat(messenger): 예약 발송(즉시 + 1회 날짜·시간)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2.8: 발송 요약 + 실발송 배선 + 닫기 확인

**Files:**
- Create: `components/messenger/SendSummaryDialog.tsx`
- Modify: `components/messenger/MessengerPanel.tsx` (조립 — 바디에 서브컴포넌트 배치, 견적·발송·에러 UX)

**Interfaces:**
- Consumes: `useSendMessages`(`messaging/mutations`), `useMessagePointQuote`(`messaging/queries`), `useTenantAlimtalkConsent`, `MessageSendError`.
- Produces: `SendSummaryDialog({ recipients, channel, body, templateId, scheduledAt, onCancel, onConfirm })` — 정본 L582–591 요약(수신자 목록·유형(SMS/LMS byte)·미해결 변수 경고) + `.fmpc-scrim` 닫기 확인(L574–579).

- [ ] **Step 1: 요약 다이얼로그 + 미해결 변수 경고**

정본 `openSummary`(L1103–1129) 이식. SMS는 `byteLen`으로 SMS/LMS·byte 표기, 알림톡은 템플릿·버튼. 본문에 `#{…}` 미해결 토큰(자동변수 아님) 있으면 경고(`.fmp-sum-warn`).

- [ ] **Step 2: 견적 카드 + 발송 배선**

패널 조립부에서:
```ts
const quote = useMessagePointQuote(recipients.length ? { mode: channel === "alim" ? "alimtalk" : "sms", recipients, templateId: templateId ?? null, body } : null);
const send = useSendMessages();
// 발송:
await send.mutateAsync({ mode: channel === "alim" ? "alimtalk" : "sms", body, context: "빠른발송", templateId: templateId ?? null, recipients, scheduledAt });
```

- [ ] **Step 3: 에러/게이팅 UX**

`MessageSendError.code` 분기: `PROVIDER_NOT_CONFIGURED`→"발송 설정 준비 중"·발송 비활성 / `INSUFFICIENT_POINTS`→포인트 부족+잔액 / `SENDER_NOT_REGISTERED`(알림톡)→"알림톡 발신 설정 준비 중"(SMS 정상). 알림톡 모드는 `useTenantAlimtalkConsent`로 미동의 대상 표시/제외.

- [ ] **Step 4: 검증** — `npx tsc --noEmit …` 없음. `npm run lint` 신규 0.
스모크: 개발서버(정션)에서 SMS 1건 본인번호 발송 → 202/`message_logs` 기록 확인(`IS_TEST`면 팝빌 테스트서버 receiptNum).

- [ ] **Step 5: 커밋 + PR2**

```bash
git add components/messenger/SendSummaryDialog.tsx components/messenger/MessengerPanel.tsx
git commit -m "feat(messenger): 발송 요약 + 실발송 배선(즉시/1회예약) + 견적·에러 게이팅

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
PR2 게이트: `npm run build`(정션→rmdir), 기존 vitest 그린.

---

# Phase 3 — 매월 반복 백엔드 (PR3)

목표: `message_schedules` 반복 확장 + drain enqueue-next + 반복 UI. 스냅샷 고정(v1).

### Task 3.1: 마이그레이션 0150 — 반복 컬럼 + RPC

**Files:**
- Create: `supabase/migrations/0150_messenger_recurrence.sql` (**번호는 커밋 직전 재확인**)

**Interfaces:**
- Produces: `message_schedules.recurrence_mode/recurrence_anchor_day/recurrence_parent_id`; `schedule_messages(...,p_recurrence_mode,p_recurrence_anchor_day)`; `enqueue_next_message_occurrence(bigint)`; `complete_message_schedule`가 'sent'+monthly 시 enqueue.

- [ ] **Step 1: 기존 RPC 원문 확보**

`schedule_messages`(migration `0032_bill_fax_suspend.sql`)·`complete_message_schedule`(`0094_scheduled_message_worker.sql`) 현재 정의를 그대로 읽어 둔다(아래 CREATE OR REPLACE 시 기존 검증·본문을 **보존**하고 추가분만 삽입).

- [ ] **Step 2: 마이그 작성 — ALTER + enqueue_next(그린필드)**

```sql
-- 0150_messenger_recurrence.sql — 매월 반복 예약 발송
alter table message_schedules
  add column if not exists recurrence_mode text
    check (recurrence_mode is null or recurrence_mode in ('monthly')),
  add column if not exists recurrence_anchor_day int
    check (recurrence_anchor_day is null or (recurrence_anchor_day between 1 and 31)),
  add column if not exists recurrence_parent_id bigint
    references message_schedules(id) on delete set null;

-- 다음 달 발생분 enqueue(스냅샷 복사, KST 기준, 말일 클램프, 시리즈 멱등)
create or replace function enqueue_next_message_occurrence(p_schedule_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v message_schedules%rowtype;
  v_tz text := 'Asia/Seoul';
  v_root bigint; v_anchor int; v_month date; v_last int; v_day int;
  v_next timestamptz; v_existing bigint; v_new_id bigint;
begin
  select * into v from message_schedules where id = p_schedule_id;
  if not found or v.recurrence_mode is distinct from 'monthly' then return null; end if;

  v_root := coalesce(v.recurrence_parent_id, v.id);
  v_anchor := coalesce(v.recurrence_anchor_day, extract(day from (v.scheduled_at at time zone v_tz))::int);
  v_month := (date_trunc('month', (v.scheduled_at at time zone v_tz)) + interval '1 month')::date;
  v_last := extract(day from (v_month + interval '1 month' - interval '1 day'))::int;
  v_day := least(v_anchor, v_last);
  v_next := ((v_month + (v_day - 1)) + (v.scheduled_at at time zone v_tz)::time) at time zone v_tz;

  -- 멱등: 같은 시리즈·같은 시각 발생분이 이미 있으면 재생성 금지
  select id into v_existing from message_schedules
    where coalesce(recurrence_parent_id, id) = v_root and scheduled_at = v_next and status <> 'cancelled'
    limit 1;
  if v_existing is not null then return v_existing; end if;

  insert into message_schedules(
    org_id, channel, body, context, recipient_count, recipients,
    template_id, scheduled_at, status,
    recurrence_mode, recurrence_anchor_day, recurrence_parent_id, created_by
  ) values (
    v.org_id, v.channel, v.body, v.context, v.recipient_count, v.recipients,
    v.template_id, v_next, 'scheduled',
    v.recurrence_mode, v_anchor, v_root, v.created_by
  ) returning id into v_new_id;
  return v_new_id;
end $$;
grant execute on function enqueue_next_message_occurrence(bigint) to service_role;
```

- [ ] **Step 3: `schedule_messages` CREATE OR REPLACE (기존 본문 보존 + 추가)**

Step 1 원문 그대로 재작성하되: 시그니처 끝에 `, p_recurrence_mode text default null, p_recurrence_anchor_day int default null` 추가. `recurrence_mode`가 'monthly'가 아니고 null도 아니면 예외. insert의 컬럼/값에 `recurrence_mode, recurrence_anchor_day`(anchor = `coalesce(p_recurrence_anchor_day, extract(day from (p_scheduled_at at time zone 'Asia/Seoul'))::int)`, 단 mode null이면 둘 다 null) 추가. **나머지 검증·반환은 원문 유지.**

- [ ] **Step 4: `complete_message_schedule` CREATE OR REPLACE (기존 + enqueue 호출)**

Step 1 원문 그대로 재작성하되, `p_final='sent'` 처리 끝에 추가:
```sql
  if p_final = 'sent' then
    perform enqueue_next_message_occurrence(p_schedule_id);
  end if;
```
(monthly 아니면 enqueue가 내부에서 null 반환 — 무해. bill_issues 동기화 등 원문 로직은 유지.)

- [ ] **Step 5: 검증(정적)** — SQL 문법 self-review. 날짜 클램프 사고검증: anchor=31, 다음달=2월 → `v_last=28/29`, `v_day=28/29`. anchor=15 → 15일. 시각 유지 확인.

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/0150_messenger_recurrence.sql
git commit -m "feat(messaging): message_schedules 매월 반복 확장 + enqueue_next + complete 훅

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3.2: apis.ts 반복 파라미터 배선

**Files:**
- Modify: `hooks/reactquery/messaging/apis.ts:31-38` (`SendMessagesInput`)
- Modify: `hooks/reactquery/messaging/apis.ts:195-205` (`schedule_messages` 호출)

**Interfaces:**
- Produces: `SendMessagesInput`에 `recurrenceMode?: "monthly" | null; recurrenceAnchorDay?: number | null`. `sendMessages`가 예약 분기에서 `p_recurrence_mode`·`p_recurrence_anchor_day` 전달.

- [ ] **Step 1: 입력 타입 확장**

`SendMessagesInput`에 추가:
```ts
  recurrenceMode?: "monthly" | null;
  recurrenceAnchorDay?: number | null;
```

- [ ] **Step 2: RPC 호출에 파라미터 추가**

`apis.ts:196` `rpc("schedule_messages", {...})` 객체에 추가:
```ts
      p_recurrence_mode: input.recurrenceMode ?? null,
      p_recurrence_anchor_day: input.recurrenceAnchorDay ?? null,
```

- [ ] **Step 3: 검증** — `npx tsc --noEmit …` 없음. `npx vitest run hooks/reactquery/messaging 2>&1 | tail -15` → 그린(기존 테스트는 `objectContaining`이라 추가 파라미터에 불변).

- [ ] **Step 4: 커밋**

```bash
git add hooks/reactquery/messaging/apis.ts
git commit -m "feat(messaging): sendMessages에 매월 반복 파라미터 배선

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3.3: drain 워커 — 반복은 complete 경유(무변경 확인) + 회귀 점검

**Files:**
- (검토) `lib/messaging/drainSchedules.ts`

**Interfaces:**
- enqueue는 `complete_message_schedule`(3.1 Step4)에서 발생 → drain 코드 변경 불필요. 단, drain이 'sent' 최종화를 호출하는 경로(reconcile 포함)가 complete를 통과함을 확인.

- [ ] **Step 1: 경로 확인**

`complete_message_schedule`를 호출하는 모든 곳(reconcile/drain replay)이 3.1의 enqueue를 자동 상속함을 코드에서 확인(추가 코드 없음). 만약 어떤 경로가 message_schedules.status를 complete RPC 없이 직접 'sent'로 바꾼다면 그 지점에 `perform enqueue_next_message_occurrence` 동등 처리 필요 — 확인 후 없으면 무변경.

- [ ] **Step 2: 검증** — `npx tsc --noEmit …` 없음. `npx vitest run lib/messaging 2>&1 | tail -15` → 그린.

- [ ] **Step 3: 커밋(변경 있을 때만)** — 무변경이면 스킵.

### Task 3.4: 반복(매월) UI + 패널 배선 + 뱃지

**Files:**
- Modify: `components/messenger/SchedulePicker.tsx` (반복 셀렉트 추가)
- Modify: `components/messenger/MessengerPanel.tsx` (발송 시 recurrence 전달)

**Interfaces:**
- Produces: SchedulePicker `value`에 `recurrenceMode: "monthly" | null` 추가. 발송 payload에 `recurrenceMode`·`recurrenceAnchorDay`(예약일 KST day) 포함.

- [ ] **Step 1: 반복 셀렉트(정본 L547)**

`.fmp-rplist`(반복 없음/매월) 이식. 예약 켜짐일 때만 노출. 선택 시 `recurrenceMode` 설정. `recurrenceAnchorDay`는 선택 날짜의 KST 일자.

- [ ] **Step 2: 발송 배선 + 요약 뱃지**

`send.mutateAsync({ ..., scheduledAt, recurrenceMode, recurrenceAnchorDay })`. 요약/예약 표기에 "매월 반복"(원본 L1108 `· 매월 반복`) 뱃지.

- [ ] **Step 3: 검증** — `npx tsc --noEmit …` 없음. 스모크: 예약+매월로 1건 예약 → `message_schedules`에 `recurrence_mode='monthly'` 행 생성 확인(개발/DB 조회, 읽기 전용).

- [ ] **Step 4: 커밋**

```bash
git add components/messenger/SchedulePicker.tsx components/messenger/MessengerPanel.tsx
git commit -m "feat(messenger): 매월 반복 예약 UI + 발송 배선 + 요약 뱃지

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3.5: 마이그 라이브 적용 + PR3

- [ ] **Step 1: 번호 재확인**

`git fetch origin master` 후 `origin/master`의 `supabase/migrations` 최대 번호 확인. 0150 충돌 시 파일명·주석 재번호(내용 동일).

- [ ] **Step 2: 라이브 적용(사용자 확인)**

Claude가 Management API `/database/query`(ref `amhtprmapxlizdnsgbeg`, ref가드+DDL검증)로 0150 적용. **데이터 UPDATE 아님(DDL/함수)** — classifier 통과 예상. 적용 후 `list_migrations` 또는 함수 존재 확인.

- [ ] **Step 3: 최종 검증 + PR3**

`npm run build`(정션→rmdir), 기존 vitest 그린. 스모크: 매월 예약 1건 → drain 1회전 후(또는 수동 dispatch-scheduled 호출) 다음달 발생분 생성 확인. PR3 생성.

---

## Self-Review (작성자 체크)

- **스펙 커버리지**: FAB/패널 픽셀정합(1.1–1.5) · 수신자 4종+cleaner(2.2–2.3) · 발신번호(2.4) · SMS/알림톡 작성·템플릿·변수(2.1,2.5) · 미리보기(2.6) · 즉시/1회예약(2.7) · 발송·견적·에러게이팅(2.8) · 매월반복 백엔드+UI(3.1–3.5) · 통합/스텁제거(1.4) · pixel-diff(1.5) → 스펙 §4–§12 전부 대응.
- **플레이스홀더**: 백엔드 SQL·유틸·배선은 완전 코드. UI 포팅은 정본 라인 참조 + 핵심 인터랙션 코드(정본이 in-repo이므로 "코드=정본 해당 라인 이식"이 실행가능). "적절한 에러처리" 류 모호표현 없음 — 에러코드 분기 명시(2.8 Step3).
- **타입 일관성**: `MessageRecipient.kind`("cleaner") · `SendMessagesInput.recurrenceMode/recurrenceAnchorDay` · `schedule_messages` 파라미터명(`p_recurrence_mode`/`p_recurrence_anchor_day`)이 2.2/3.2/3.1에서 일치. `ChannelMode`("sms"/"alim") ↔ 발송 mode("sms"/"alimtalk") 변환 지점(2.8 Step2) 명시.
- **정책 정합**: 신규 단위테스트 미작성 — 각 태스크 검증은 tsc/lint/build/기존 vitest/pixel-diff/스모크.
