# 공통 ConfirmDialog 신설 + window.confirm 통일 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원본 fmpc 디자인의 공통 `<ConfirmDialog>` + `useConfirm()` 훅을 신설하고, 앱 전역 19곳의 `window.confirm`을 교체해 확인/삭제 팝업 디자인을 통일한다.

**Architecture:** Tailwind presentational `ConfirmDialog`(controlled) + `ConfirmProvider`/`useConfirm()`(Promise 상태기계, provider 미존재 시 `window.confirm` 폴백). Provider는 (staff)·(platform-admin) `(app)` 레이아웃에 마운트, 다이얼로그는 z-[100]로 모달 위에 렌더.

**Tech Stack:** Next 16 (App Router), React 19, TypeScript, Tailwind v4(`@theme` 토큰), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-common-confirm-dialog-design.md`

## Global Constraints

- **신규 단위테스트 작성 금지**(프로젝트 정책이 TDD 스킬보다 우선). 검증 = `tsc`(소스만) + `lint` + `build` + **기존** `vitest` 그린. 픽셀 정합 증빙은 사용자 직접.
- 경로 별칭 `@/*` = 레포 루트. 공통 컴포넌트는 `components/common/`.
- Tailwind v4 토큰: `bg-blue`=#14A497(teal primary), `bg-blue-d`, `bg-bg`, `bg-line2`, `text-red`/`bg-red-t`, `text-t1`/`text-t2`/`text-t3`. scrim = `bg-[#171f28]/50`. 다이얼로그 z-index = `z-[100]`(앱 모달 z-50 위).
- **문자열 원문 고정**(폴백/테스트 assertion 보존): AccountFormModal description = `"계정을 삭제할까요?"`, MessagingComposer description = `` `${pointNotice}\n${actionLabel}하시겠습니까?` ``.
- 폴백 계약: provider 없으면 `window.confirm(typeof description === "string" ? description : title)`.
- 워크트리(`workspaces/home_erp/confirm-dialog`)엔 node_modules 없음 → master 체크아웃(`projects/home_erp`) node_modules를 **junction**으로 연결해 검증, 종료 시 `rmdir`(링크만 제거). build는 webpack(Turbopack은 junction 거부).
- 커밋 직후 `wbs-commit-sync`로 관련 화면 dev 동기화(주택관리ERP 버킷).

---

### Task 0: 검증 환경 준비 (junction)

**Files:** 없음(환경만)

- [ ] **Step 1: node_modules junction 생성**

PowerShell:
```powershell
New-Item -ItemType Junction `
  -Path "C:\Users\leebj\orca\workspaces\home_erp\confirm-dialog\node_modules" `
  -Target "C:\Users\leebj\orca\projects\home_erp\node_modules"
```

- [ ] **Step 2: 베이스라인 tsc 확인 (0 에러 기대)**

Run (worktree에서):
```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && npx tsc --noEmit 2>&1 | grep -vE '\.next' | tail -20
```
Expected: 소스 관련 에러 없음(빈 출력 또는 `.next` 노이즈만 필터됨).

> **주의(teardown):** 모든 작업 종료 후 Task 7에서 `cmd //c rmdir "...\confirm-dialog\node_modules"`로 **링크만** 제거. `Remove-Item -Recurse`는 target(실제 node_modules) 삭제 위험 → 쓰지 말 것.

---

### Task 1: ConfirmDialog + ConfirmProvider + useConfirm 신설 · 레이아웃 마운트

**Files:**
- Create: `components/common/ConfirmDialog.tsx`
- Create: `components/common/ConfirmProvider.tsx`
- Modify: `app/(staff)/staff/(app)/layout.tsx`
- Modify: `app/(platform-admin)/platform-admin/(app)/layout.tsx`

**Interfaces:**
- Produces:
  - `ConfirmOptions { title: string; description?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; variant?: "default" | "danger" }`
  - `ConfirmDialog(props: ConfirmOptions & { open: boolean; onConfirm: () => void; onCancel: () => void }): JSX.Element | null`
  - `ConfirmProvider({ children }): JSX.Element`
  - `useConfirm(): (options: ConfirmOptions) => Promise<boolean>`

- [ ] **Step 1: `ConfirmDialog.tsx` 작성**

```tsx
"use client";

import { useEffect, useId, useRef } from "react";

export type ConfirmVariant = "default" | "danger";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmOptions & {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // 파괴적 확인은 취소 버튼에 포커스(오작동 방지), 그 외 확인 버튼에 포커스
    (variant === "danger" ? cancelRef : confirmRef).current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel, variant]);

  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-red-t text-red hover:bg-[#fbdbe0]"
      : "bg-blue text-white hover:bg-blue-d";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#171f28]/50 p-6"
      onMouseDown={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description != null ? descId : undefined}
        className="max-h-[88vh] w-[min(360px,92%)] overflow-auto rounded-[20px] bg-white px-[26px] pb-6 pt-7 text-center shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-[17px] font-extrabold tracking-[-0.02em] text-t1">
          {title}
        </h2>
        {description != null && (
          <p
            id={descId}
            className="mt-2 whitespace-pre-line text-[13.5px] font-semibold leading-[1.6] text-t3 [&_b]:font-bold [&_b]:text-t1 [&_strong]:font-bold [&_strong]:text-t1"
          >
            {description}
          </p>
        )}
        <div className="mt-[26px] flex gap-[9px]">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[11px] bg-bg text-[13.5px] font-bold tracking-[-0.01em] text-t2 hover:bg-line2"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[11px] text-[13.5px] font-bold tracking-[-0.01em] ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ConfirmProvider.tsx` 작성**

```tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ConfirmDialog, type ConfirmOptions } from "./ConfirmDialog";

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false); // 열려 있던 확인창은 취소로 정리
      resolverRef.current = resolve;
      setOptions(next);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={options !== null}
        title={options?.title ?? ""}
        description={options?.description}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        variant={options?.variant}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

const fallbackConfirm: ConfirmFn = (options) =>
  Promise.resolve(
    typeof window !== "undefined"
      ? window.confirm(
          typeof options.description === "string" ? options.description : options.title,
        )
      : false,
  );

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext) ?? fallbackConfirm;
}
```

- [ ] **Step 3: (staff) 레이아웃에 Provider 마운트**

`app/(staff)/staff/(app)/layout.tsx` 전체를 아래로 교체:
```tsx
import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";
import { ConfirmProvider } from "@/components/common/ConfirmProvider";

export default async function StaffGuardedLayout({ children }: { children: ReactNode }) {
  await requirePersona("manager_staff", "/staff/login");
  return <ConfirmProvider>{children}</ConfirmProvider>;
}
```

- [ ] **Step 4: (platform-admin) 레이아웃에 Provider 마운트**

`app/(platform-admin)/platform-admin/(app)/layout.tsx` 전체를 아래로 교체:
```tsx
import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";
import { ConfirmProvider } from "@/components/common/ConfirmProvider";

export default async function PlatformAdminGuardedLayout({ children }: { children: ReactNode }) {
  await requirePersona("platform_admin", "/platform-admin/login");
  return <ConfirmProvider>{children}</ConfirmProvider>;
}
```

- [ ] **Step 5: tsc 검증**

Run:
```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && npx tsc --noEmit 2>&1 | grep -vE '\.next' | tail -20
```
Expected: 소스 에러 없음.

- [ ] **Step 6: 커밋 (C1)**

```bash
git add components/common/ConfirmDialog.tsx components/common/ConfirmProvider.tsx "app/(staff)/staff/(app)/layout.tsx" "app/(platform-admin)/platform-admin/(app)/layout.tsx"
git commit -m "feat(common): fmpc 디자인 공통 ConfirmDialog + useConfirm 신설, staff·PA 레이아웃 마운트"
```

---

### Task 2: messaging 2곳 교체

**Files:**
- Modify: `app/(staff)/staff/(app)/messaging/components/TemplatesTab.tsx:55` (danger)
- Modify: `app/(staff)/staff/(app)/messaging/components/MessagingComposer.tsx:622` (일반, 멀티라인)
- Test(기존): `messaging/components/TemplatesTab.test.tsx`, `messaging/components/MessagingComposer.test.tsx`

**Interfaces:** Consumes `useConfirm` from `@/components/common/ConfirmProvider`.

- [ ] **Step 1: TemplatesTab.tsx 교체**

import 추가: `import { useConfirm } from "@/components/common/ConfirmProvider";`
컴포넌트 최상단에 `const confirm = useConfirm();` 추가.
`remove` 핸들러의 가드 교체:
```tsx
// before: if (!window.confirm(`'${template.title}' 템플릿을 삭제하시겠습니까?`)) { return; }
const ok = await confirm({
  title: "템플릿 삭제",
  description: `'${template.title}' 템플릿을 삭제하시겠습니까?`,
  confirmLabel: "삭제",
  variant: "danger",
});
if (!ok) return;
```
(`remove`는 이미 `async`.)

- [ ] **Step 2: MessagingComposer.tsx 교체**

import + `const confirm = useConfirm();` 최상단 추가.
`window.confirm` 가드(라인 622) 교체 — **description 원문 고정**:
```tsx
// before: if (!window.confirm(`${pointNotice}\n${actionLabel}하시겠습니까?`)) return;
const ok = await confirm({
  title: "문자 발송",
  description: `${pointNotice}\n${actionLabel}하시겠습니까?`,
  confirmLabel: actionLabel,
});
if (!ok) return;
```
(핸들러가 async인지 확인; 아니면 async로 전환. `\n`은 다이얼로그의 `whitespace-pre-line`으로 표시됨.)

- [ ] **Step 3: tsc + 관련 vitest**

```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && npx tsc --noEmit 2>&1 | grep -vE '\.next' | tail -20 && \
npx vitest run "app/(staff)/staff/(app)/messaging/components/TemplatesTab.test.tsx" "app/(staff)/staff/(app)/messaging/components/MessagingComposer.test.tsx"
```
Expected: tsc 0, 두 테스트 PASS(폴백 경로: `confirmSpy`가 원문 문자열로 호출됨).

- [ ] **Step 4: 커밋 (C2)**

```bash
git add "app/(staff)/staff/(app)/messaging/components/TemplatesTab.tsx" "app/(staff)/staff/(app)/messaging/components/MessagingComposer.tsx"
git commit -m "feat(messaging): 템플릿 삭제·문자 발송 확인을 공통 ConfirmDialog로 통일"
```

---

### Task 3: long-term-repair 3곳 교체

**Files:**
- Modify: `app/(staff)/staff/(app)/long-term-repair/components/LongTermRepairLedger.tsx:280` (danger) 및 `:409` (이탈경고)
- Modify: `app/(staff)/staff/(app)/long-term-repair/components/AttachmentViewer.tsx:94` (danger)
- Test(기존): `long-term-repair/components/LongTermRepairLedger.test.tsx`

- [ ] **Step 1: LongTermRepairLedger.tsx — 훅 추가 + 2곳 교체**

import + `const confirm = useConfirm();` 최상단.
행 삭제(280) `removeRow`를 async로:
```tsx
// before: if (!window.confirm("행을 삭제할까요?")) return;
const ok = await confirm({ title: "행 삭제", description: "행을 삭제할까요?", confirmLabel: "삭제", variant: "danger" });
if (!ok) return;
```
건물 변경(409) 인라인 onClick을 async로:
```tsx
// before: onClick={() => { if (editing && dirty && !window.confirm("저장하지 않은 변경을 취소하고 건물을 바꿀까요?")) return; setBuildingId(building.id); ... }}
onClick={async () => {
  if (editing && dirty) {
    const ok = await confirm({
      title: "저장하지 않고 건물 변경",
      description: "저장하지 않은 변경을 취소하고 건물을 바꿀까요?",
      confirmLabel: "건물 변경",
    });
    if (!ok) return;
  }
  setBuildingId(building.id);
}}
```
(onClick 본문의 나머지 로직은 그대로 유지.)

- [ ] **Step 2: AttachmentViewer.tsx 교체**

import + `const confirm = useConfirm();`. onClick(94, 이미 async):
```tsx
// before: if (!window.confirm("첨부파일을 삭제할까요?")) return;
const ok = await confirm({ title: "첨부파일 삭제", description: "첨부파일을 삭제할까요?", confirmLabel: "삭제", variant: "danger" });
if (!ok) return;
```

- [ ] **Step 3: tsc + 관련 vitest**

```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && npx tsc --noEmit 2>&1 | grep -vE '\.next' | tail -20 && \
npx vitest run "app/(staff)/staff/(app)/long-term-repair/components/LongTermRepairLedger.test.tsx"
```
Expected: tsc 0, PASS. (async 전환으로 타이밍 이슈 시 기존 테스트에 `await`/`waitFor` 최소 보정 — 신규 아님.)

- [ ] **Step 4: 커밋 (C3)**

```bash
git add "app/(staff)/staff/(app)/long-term-repair/components/LongTermRepairLedger.tsx" "app/(staff)/staff/(app)/long-term-repair/components/AttachmentViewer.tsx"
git commit -m "feat(long-term-repair): 행/첨부 삭제·건물변경 확인을 공통 ConfirmDialog로 통일"
```

---

### Task 4: buildings 5곳 교체

**Files:**
- Modify: `app/(staff)/staff/(app)/buildings/components/BuildingForm.tsx:170` (이탈)
- Modify: `app/(staff)/staff/(app)/buildings/new-v2/_components/BuildingRegisterForm.tsx:100` (이탈)
- Modify: `app/(staff)/staff/(app)/buildings/components/TenantManagementCardModal.tsx:19` (이탈)
- Modify: `app/(staff)/staff/(app)/buildings/[id]/components/TenantForm.tsx:456` (이탈)
- Modify: `app/(staff)/staff/(app)/buildings/[id]/components/tenant-sections/MoveOutControl.tsx:34` (일반)
- Test(기존): `buildings/[id]/components/tenant-sections/MoveOutControl.test.tsx`

- [ ] **Step 1: BuildingForm.tsx (onLeave)**

import + `const confirm = useConfirm();`. `onLeave` async로:
```tsx
// before: if (dirty && !window.confirm("저장하지 않고 나가시겠습니까?")) return;
if (dirty) {
  const ok = await confirm({ title: "저장하지 않고 나가기", description: "저장하지 않고 나가시겠습니까?", confirmLabel: "나가기" });
  if (!ok) return;
}
router.push("/staff/buildings");
```

- [ ] **Step 2: BuildingRegisterForm.tsx (onBack)** — Step 1과 동일 패턴

import + 훅. `onBack` async로:
```tsx
if (dirty) {
  const ok = await confirm({ title: "저장하지 않고 나가기", description: "저장하지 않고 나가시겠습니까?", confirmLabel: "나가기" });
  if (!ok) return;
}
router.push("/staff/buildings");
```

- [ ] **Step 3: TenantManagementCardModal.tsx (requestClose)**

import + 훅. `requestClose`(useCallback) async로, 의존성 배열에 `confirm` 추가:
```tsx
const requestClose = useCallback(async () => {
  if (dirty) {
    const ok = await confirm({ title: "저장하지 않고 닫기", description: "저장하지 않고 닫으시겠습니까?", confirmLabel: "닫기" });
    if (!ok) return;
  }
  onClose();
}, [dirty, onClose, confirm]);
```

- [ ] **Step 4: TenantForm.tsx (라인 456)**

import + 훅. 해당 핸들러 async로:
```tsx
// before: if (dirty && !window.confirm("저장하지 않고 나가시겠습니까?")) return;
if (dirty) {
  const ok = await confirm({ title: "저장하지 않고 나가기", description: "저장하지 않고 나가시겠습니까?", confirmLabel: "나가기" });
  if (!ok) return;
}
router.push(`/staff/buildings/${buildingId}/tenants`);
```

- [ ] **Step 5: MoveOutControl.tsx (handleExecute)**

import + 훅. `handleExecute`(이미 async):
```tsx
// before: if (!window.confirm("현재 입주자 정보를 전출 이력에 남기고 지금 공실 처리하시겠습니까?")) return;
const ok = await confirm({
  title: "공실 처리",
  description: "현재 입주자 정보를 전출 이력에 남기고 지금 공실 처리하시겠습니까?",
  confirmLabel: "공실 처리",
});
if (!ok) return;
```

- [ ] **Step 6: tsc + 관련 vitest**

```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && npx tsc --noEmit 2>&1 | grep -vE '\.next' | tail -20 && \
npx vitest run "app/(staff)/staff/(app)/buildings/[id]/components/tenant-sections/MoveOutControl.test.tsx"
```
Expected: tsc 0, PASS.

- [ ] **Step 7: 커밋 (C4)**

```bash
git add "app/(staff)/staff/(app)/buildings/components/BuildingForm.tsx" "app/(staff)/staff/(app)/buildings/new-v2/_components/BuildingRegisterForm.tsx" "app/(staff)/staff/(app)/buildings/components/TenantManagementCardModal.tsx" "app/(staff)/staff/(app)/buildings/[id]/components/TenantForm.tsx" "app/(staff)/staff/(app)/buildings/[id]/components/tenant-sections/MoveOutControl.tsx"
git commit -m "feat(buildings): 이탈 경고·공실 처리 확인을 공통 ConfirmDialog로 통일"
```

---

### Task 5: staff accounts·fee-items·receipts 3곳 교체

**Files:**
- Modify: `app/(staff)/staff/(app)/accounts/components/AccountFormModal.tsx:181` (danger, 문자열 고정)
- Modify: `app/(staff)/staff/(app)/fee-items/components/FeeItemManagement.tsx:166` (danger)
- Modify: `app/(staff)/staff/(app)/receipts/components/payment/PaymentHistoryModal.tsx:34` (danger)
- Test(기존): `accounts/components/AccountFormModal.test.tsx`

- [ ] **Step 1: AccountFormModal.tsx (deactivate) — 문자열 원문 고정**

import + 훅. `deactivate`(async):
```tsx
// before: if (!editing || !window.confirm("계정을 삭제할까요?")) return;
if (!editing) return;
const ok = await confirm({
  title: "계정 삭제",
  description: "계정을 삭제할까요?", // 원문 고정 (test assertion)
  confirmLabel: "삭제",
  variant: "danger",
});
if (!ok) return;
```

- [ ] **Step 2: FeeItemManagement.tsx (라인 166)**

import + 훅. 핸들러 async:
```tsx
// before: if (!editingItem || !activeType) return; if (!window.confirm(`‘${editingItem.name}’ 항목을 삭제할까요?`)) return;
if (!editingItem || !activeType) return;
const ok = await confirm({
  title: "관리 항목 삭제",
  description: `‘${editingItem.name}’ 항목을 삭제할까요?`,
  confirmLabel: "삭제",
  variant: "danger",
});
if (!ok) return;
```

- [ ] **Step 3: PaymentHistoryModal.tsx (handleCancel) — 확인/취소 라벨 충돌 회피**

import + 훅. `handleCancel` async:
```tsx
// before: if (window.confirm("이 수납 내역을 취소하시겠습니까?")) { onCancel(payment.id); }
const ok = await confirm({
  title: "수납 취소",
  description: "이 수납 내역을 취소하시겠습니까?",
  confirmLabel: "수납 취소",
  cancelLabel: "닫기",
  variant: "danger",
});
if (ok) onCancel(payment.id);
```

- [ ] **Step 4: tsc + 관련 vitest**

```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && npx tsc --noEmit 2>&1 | grep -vE '\.next' | tail -20 && \
npx vitest run "app/(staff)/staff/(app)/accounts/components/AccountFormModal.test.tsx"
```
Expected: tsc 0, PASS(`window.confirm` 폴백이 `"계정을 삭제할까요?"`로 호출됨 → assertion 유지).

- [ ] **Step 5: 커밋 (C5)**

```bash
git add "app/(staff)/staff/(app)/accounts/components/AccountFormModal.tsx" "app/(staff)/staff/(app)/fee-items/components/FeeItemManagement.tsx" "app/(staff)/staff/(app)/receipts/components/payment/PaymentHistoryModal.tsx"
git commit -m "feat(staff): 계정·항목·수납 삭제 확인을 공통 ConfirmDialog로 통일"
```

---

### Task 6: platform-admin 6곳 교체

**Files:**
- Modify: `app/(platform-admin)/platform-admin/(app)/accounts/page.tsx:441,450` (일반 ×2)
- Modify: `app/(platform-admin)/platform-admin/(app)/accounts/components/AccountRowActions.tsx:53,63` (일반 ×2)
- Modify: `app/(platform-admin)/platform-admin/(app)/organizations/components/OrgRowActions.tsx:35` (danger)
- Modify: `app/(platform-admin)/platform-admin/(app)/organizations/components/OrgStatusControl.tsx:29` (일반, select 되돌림 특수)
- Test(기존): `organizations/components/OrgStatusControl.test.tsx`

- [ ] **Step 1: accounts/page.tsx (441·450)**

import + 훅(컴포넌트 본문 최상단; 두 가드가 모듈 헬퍼면 컴포넌트로 끌어올림). 각 핸들러 async로:
```tsx
// 441: 플랫폼 관리자 권한 부여
if (account.role !== "platform_admin") {
  const ok = await confirm({
    title: "플랫폼 관리자 권한 부여",
    description: "이 계정에 모든 조직을 관리할 수 있는 플랫폼 관리자 권한을 부여할까요? 매우 높은 권한입니다.",
    confirmLabel: "권한 부여",
  });
  if (!ok) return;
}
// 450: 강등
if (role !== "platform_admin") {
  const ok = await confirm({
    title: "플랫폼 관리자 권한 해제",
    description: "플랫폼 관리자 권한을 해제하고 일반 조직 역할로 강등할까요?",
    confirmLabel: "권한 해제",
  });
  if (!ok) return;
}
```
(원래의 `&&` 조건 결합을 위 형태로 풀어 쓰되 나머지 조건/로직은 보존.)

- [ ] **Step 2: AccountRowActions.tsx (53·63)**

import + 훅. 두 onClick을 async로:
```tsx
// 53: 활성/비활성
onClick={async () => {
  const action = account.isActive ? "비활성화" : "활성화";
  const ok = await confirm({ title: action, description: `'${accountName}' 계정을 ${action}할까요?`, confirmLabel: action });
  if (ok) onToggleActive();
}}
// 63: 비밀번호 초기화
onClick={async () => {
  const ok = await confirm({ title: "비밀번호 초기화", description: `'${accountName}' 계정의 비밀번호를 초기화할까요?`, confirmLabel: "초기화" });
  if (ok) onResetPassword();
}}
```

- [ ] **Step 3: OrgRowActions.tsx (35) — danger**

import + 훅. onClick async:
```tsx
onClick={async () => {
  const ok = await confirm({
    title: "조직 해지",
    description: `'${org.name}' 조직을 해지할까요? 사용자 접속이 제한되고 목록에서 숨겨집니다. 데이터는 삭제되지 않으며 복구할 수 있습니다.`,
    confirmLabel: "해지",
    variant: "danger",
  });
  if (!ok) return;
  // 기존 해지 실행 로직
}}
```

- [ ] **Step 4: OrgStatusControl.tsx (29) — select 되돌림 특수처리**

import + 훅. `onChange`는 **async로 만들지 않고** 요소를 캡처 후 IIFE:
```tsx
onChange={(e) => {
  const next = e.target.value as OrganizationStatus;
  if (next === status) return;
  const selectEl = e.currentTarget; // await 이전 캡처 (currentTarget null화 방지)
  const message =
    next === "suspended"
      ? "조직을 정지하면 해당 업체의 사무·현장 관리자와 세입자 앱 접속이 제한됩니다. 계속할까요?"
      : `조직 상태를 '${OPTIONS.find((option) => option.value === next)?.label}'(으)로 변경할까요?`;
  void (async () => {
    const ok = await confirm({ title: "조직 상태 변경", description: message, confirmLabel: "변경" });
    if (!ok) {
      selectEl.value = status;
      return;
    }
    void onChange(next);
  })();
}}
```

- [ ] **Step 5: tsc + 관련 vitest**

```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && npx tsc --noEmit 2>&1 | grep -vE '\.next' | tail -20 && \
npx vitest run "app/(platform-admin)/platform-admin/(app)/organizations/components/OrgStatusControl.test.tsx"
```
Expected: tsc 0, PASS. 취소 테스트(동기)가 async 전환으로 깨지면 해당 테스트에 `await`/`waitFor` 최소 보정(신규 아님) — 폴백은 동기 `window.confirm`이라 대개 그대로 통과.

- [ ] **Step 6: 커밋 (C6)**

```bash
git add "app/(platform-admin)/platform-admin/(app)/accounts/page.tsx" "app/(platform-admin)/platform-admin/(app)/accounts/components/AccountRowActions.tsx" "app/(platform-admin)/platform-admin/(app)/organizations/components/OrgRowActions.tsx" "app/(platform-admin)/platform-admin/(app)/organizations/components/OrgStatusControl.tsx"
git commit -m "feat(platform-admin): 계정·조직 확인 팝업을 공통 ConfirmDialog로 통일"
```

---

### Task 7: 전체 검증 · 잔여 window.confirm 확인 · 정리

**Files:** 필요 시 기존 테스트 파일 최소 보정만.

- [ ] **Step 1: 잔여 window.confirm 0건 확인**

```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && grep -rn "window.confirm" app/ | grep -v ".test." || echo "남은 window.confirm 없음(테스트 mock 제외)"
```
Expected: 소스에 `window.confirm` 없음(테스트의 mock/spy는 존재 가능).

- [ ] **Step 2: 전체 vitest**

```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && npx vitest run 2>&1 | tail -30
```
Expected: 전건 PASS(베이스라인 ~1054+). FAIL이 있으면 async 타이밍 관련만 최소 보정(신규 테스트 금지).

- [ ] **Step 3: lint**

```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && npm run lint 2>&1 | tail -20
```
Expected: 0 error.

- [ ] **Step 4: build (webpack)**

```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && npx next build 2>&1 | tail -30
```
Expected: 성공. (Turbopack 옵션이 붙은 `npm run build`가 junction에서 실패하면 `npx next build`(webpack)로 실행.)

- [ ] **Step 5: (필요 시) 테스트 보정 커밋 (C7)**

```bash
git add -A && git commit -m "test: ConfirmDialog 비동기 전환에 맞춰 기존 테스트 타이밍 보정"
```
(보정이 없으면 이 스텝 생략.)

- [ ] **Step 6: junction 정리 (링크만 제거)**

```bash
cmd //c rmdir "C:\Users\leebj\orca\workspaces\home_erp\confirm-dialog\node_modules"
```
> `Remove-Item -Recurse` 금지(target 삭제 위험). `rmdir`은 junction 링크만 제거.

- [ ] **Step 7: 최종 확인 · 브랜치 상태**

```bash
cd C:/Users/leebj/orca/workspaces/home_erp/confirm-dialog && git log --oneline feat/prototype-pixel-alignment..HEAD && git status
```
Expected: C1~C6(+C7) 커밋 확인, 워킹트리 클린.

---

## Self-Review (작성자 점검)

- **Spec coverage:** ConfirmDialog/Provider/useConfirm(Task 1) · 폴백(Task 1 Step 2) · 19곳 매핑(Task 2~6, 디렉터리별) · async 특수(OrgStatusControl Task6-S4, MessagingComposer Task2-S2) · 테스트 보존(각 태스크 vitest + Task7) · 검증/정리(Task 0·7) — 스펙 §2~§10 전부 태스크로 커버.
- **Placeholder scan:** "기존 해지 실행 로직"(OrgRowActions)만 서술형 — 원 파일의 해지 mutate 호출부를 그대로 유지한다는 의미(실행 시 파일에서 확인). 그 외 모든 코드 스텝은 실제 코드 포함.
- **Type consistency:** `ConfirmOptions`/`useConfirm`/`ConfirmDialog` 시그니처가 Task 1 정의와 Task 2~6 사용에서 일치. `confirm(options): Promise<boolean>` 계약 통일.
- **문자열 고정:** AccountFormModal `"계정을 삭제할까요?"`, MessagingComposer `` `${pointNotice}\n${actionLabel}하시겠습니까?` `` — 각 태스크 스텝에 명시.
