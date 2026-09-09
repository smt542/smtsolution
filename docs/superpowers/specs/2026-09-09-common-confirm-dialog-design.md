# 공통 ConfirmDialog 신설 + window.confirm 통일 — 설계

- 날짜: 2026-09-09
- 브랜치: `feat/common-confirm-dialog` (base: `feat/prototype-pixel-alignment`)
- 관련: [프로토타입 픽셀 정합 설계](2026-09-09-prototype-pixel-alignment-design.md), `docs/audit/prototype-pixel-map-2026-09-09.md`, 메모리 `project-prototype-pixel-alignment`

## 1. 배경 · 목표

앱의 확인/삭제 팝업이 브라우저 기본 `window.confirm`(디자인 없음)으로 앱 전역 **19곳**에 흩어져 있다. 원본(정본)은 커스텀 디자인 팝업(`fmpc`)이다. 원본 디자인의 공통 `<ConfirmDialog>`를 신설하고 `window.confirm` 호출부를 교체해 **디자인 통일 + 픽셀 정합**을 달성한다.

정본: `docs/prototype/staff/fee-item/fee-item.dc.html`
- CSS: 327~347행 (`.fmpc-scrim` / `.fmpc` / `.fmpc-t` / `.fmpc-d` / `.fmpc-btns` / `.fmpc-btn[.cancel/.go/.danger]`)
- 단순 확인 마크업: 619행 JS (제목 "관리 항목 삭제" + 설명 + [취소][삭제(danger)])
- staging: https://staging.d2h12382xiksft.amplifyapp.com/staff/fee-item/fee-item.dc.html

### 결정된 범위 (사용자 승인 2026-09-09)
1. **API = Promise 훅 + Provider** (`useConfirm()` → `await confirm({...})`). 선언형 controlled 방식 아님.
2. **fmpc 단순형만** 구현. 경고아이콘형(좌측정렬 400px, solid red)은 범위 밖 — 기존 `DeleteBuildingTypeDialog.tsx` 유지.

## 2. 아키텍처

3개 조각(모두 `components/common/`, Tailwind 체제 = staff·platform-admin):

```
ConfirmDialog.tsx     presentational(controlled). fmpc 정확 이식 + a11y. open/onConfirm/onCancel.
ConfirmProvider.tsx   useConfirm() 훅 + <ConfirmProvider>. Promise 상태기계. ConfirmDialog를 1회 렌더.
                      Provider 미존재 시 window.confirm 폴백.
index/export          useConfirm, ConfirmProvider, ConfirmDialog, ConfirmOptions 타입.
```

데이터 흐름:
- 호출부: `const confirm = useConfirm();` (컴포넌트 최상단) → 핸들러에서 `const ok = await confirm(options); if (!ok) return;`
- `confirm(options)`는 새 `Promise<boolean>`을 반환하며 provider state에 `{options, resolve}` 저장 → `<ConfirmDialog open>` 표시.
- 확인 버튼 → `resolve(true)`, 취소/백드롭/Esc → `resolve(false)`. resolve 직후 state clear.
- **동시성**: 단일 활성. 열린 상태에서 재호출 시 이전 것을 `false`로 resolve 후 교체(문서화; `window.confirm`이 blocking이었으므로 실사용에서 동시 호출 없음).

### 폴백 (테스트 그린 유지의 핵심)
`useConfirm()`는 context가 없으면 다음을 반환한다:
```ts
(options) => Promise.resolve(window.confirm(
  typeof options.description === "string" ? options.description : options.title
))
```
- 프로덕션에선 layout에 provider가 마운트되므로 폴백은 **테스트/무-provider 렌더에서만** 동작.
- 기존 6개 테스트가 `window.confirm`을 mock/assert → 폴백 경로로 거의 무수정 통과. (정책: 신규 단위테스트 작성 안 함)
- 정확 문자열을 assert하는 2곳(AccountFormModal·MessagingComposer)은 마이그레이션 시 `description`을 **원문 그대로** 유지해 assertion 보존.

### Provider 배치
- `app/(staff)/staff/(app)/layout.tsx` — `<ConfirmProvider>{children}</ConfirmProvider>`
- `app/(platform-admin)/platform-admin/(app)/layout.tsx` — 동일

두 layout 모두 async 서버 컴포넌트이나, client `ConfirmProvider`로 서버가 넘긴 `children`을 감싸는 것은 정상. resident/partner(CSS 모듈 체제)는 건드리지 않는다.

## 3. 컴포넌트 API

```ts
export type ConfirmVariant = "default" | "danger";

export interface ConfirmOptions {
  title: string;                 // fmpc-t (필수)
  description?: React.ReactNode; // fmpc-d. 문자열/JSX(강조 <b>·<strong>) 및 멀티라인(\n) 지원
  confirmLabel?: string;         // 기본 "확인"
  cancelLabel?: string;          // 기본 "취소"
  variant?: ConfirmVariant;      // 기본 "default"(teal go). "danger" → red-tint 확인버튼
}

// presentational
function ConfirmDialog(props: ConfirmOptions & {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;         // 취소/백드롭/Esc 공통
}): JSX.Element | null;

// provider + hook
function ConfirmProvider(props: { children: React.ReactNode }): JSX.Element;
function useConfirm(): (options: ConfirmOptions) => Promise<boolean>;
```

## 4. 스타일 (fmpc 정확 이식 · Tailwind v4 토큰)

토큰 대응: `--blue`=`bg-blue`(#14A497), `--blue-d`=`bg-blue-d`, `--bg`=`bg-bg`, `--line2`=`bg-line2`, `--red`/`--red-t`=`text-red`/`bg-red-t`, `--t1~t3`=`text-t1~t3`.

- **scrim**: `fixed inset-0 z-[100] flex items-center justify-center bg-[#171f28]/50 p-6` (rgba(23,31,40,.5), padding 24px). z-[100] = 앱 모달(z-50) 위. 백드롭 클릭 → onCancel.
- **dialog**: `role="alertdialog" aria-modal aria-labelledby aria-describedby` + `w-[min(360px,92%)] max-h-[88vh] overflow-auto rounded-[20px] bg-white pt-7 px-[26px] pb-6 text-center shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)]` (padding 28/26/24).
- **title** `.fmpc-t`: `text-[17px] font-extrabold tracking-[-0.02em] text-t1`
- **desc** `.fmpc-d`: `mt-2 whitespace-pre-line text-[13.5px] font-semibold leading-[1.6] text-t3 [&_b]:font-bold [&_b]:text-t1 [&_strong]:font-bold [&_strong]:text-t1` (강조는 t1, `.fmpc-d b` 재현)
- **btns** `.fmpc-btns`: `mt-[26px] flex gap-[9px]`
- **btn** 공통 `.fmpc-btn`: `flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[11px] text-[13.5px] font-bold tracking-[-0.01em]`
  - cancel: `bg-bg text-t2 hover:bg-line2`
  - go(default): `bg-blue text-white hover:bg-blue-d`
  - danger: `bg-red-t text-red hover:bg-[#fbdbe0]`

### 동작 · a11y
- Esc → onCancel. 열려있는 동안 `document.body.style.overflow = "hidden"` (기존 `Modal.tsx` 패턴 재사용).
- 오픈 시 포커스: default variant는 확인 버튼, **danger variant는 취소 버튼**(파괴적 오작동 방지). 포커스 트랩은 최소(확인/취소 2버튼 + Esc)로 충분.
- `useId()`로 title/desc id 연결.

## 5. 교체 대상 19곳 (variant · 제목 · 확인라벨)

`window.confirm(msg)` → `title`(신규 짧은 명사) + `description`(원문 유지) 구조로 매핑. 아래 표의 description은 원문 보존(문구 리라이트 안 함; fee-item만 정본 존재).

### danger (7) — 확인버튼 red-tint
| # | 파일:행 | title | confirm | 비고 |
|---|---|---|---|---|
|1|messaging/TemplatesTab.tsx:55|템플릿 삭제|삭제| desc `‘{title}’ 템플릿을 삭제하시겠습니까?` |
|2|accounts/AccountFormModal.tsx:181|계정 삭제|삭제| **desc="계정을 삭제할까요?" 원문 고정(test)** |
|3|fee-items/FeeItemManagement.tsx:166|관리 항목 삭제|삭제| desc `‘{name}’ 항목을 삭제할까요?` (정본 fmpc 대응) |
|4|long-term-repair/LongTermRepairLedger.tsx:280|행 삭제|삭제| desc "행을 삭제할까요?" |
|5|long-term-repair/AttachmentViewer.tsx:94|첨부파일 삭제|삭제| desc "첨부파일을 삭제할까요?" |
|6|platform-admin organizations/OrgRowActions.tsx:35|조직 해지|해지| desc 원문(복구가능 안내) |
|7|receipts/payment/PaymentHistoryModal.tsx:34|수납 취소|수납 취소| **cancelLabel="닫기"**(취소 라벨 충돌 회피) |

### 이탈경고 (5) — variant default, 확인=teal
| # | 파일:행 | title | confirm |
|---|---|---|---|
|8|long-term-repair/LongTermRepairLedger.tsx:409|저장하지 않고 건물 변경|건물 변경|
|9|buildings/TenantManagementCardModal.tsx:19|저장하지 않고 닫기|닫기|
|10|buildings/[id]/TenantForm.tsx:456|저장하지 않고 나가기|나가기|
|11|buildings/new-v2/BuildingRegisterForm.tsx:100|저장하지 않고 나가기|나가기|
|12|buildings/BuildingForm.tsx:170|저장하지 않고 나가기|나가기|

### 일반확인 (7) — variant default
| # | 파일:행 | title | confirm | 비고 |
|---|---|---|---|---|
|13|messaging/MessagingComposer.tsx:622|문자 발송|발송(actionLabel)| **desc=원문 `{pointNotice}\n{actionLabel}하시겠습니까?` 고정(test)**, whitespace-pre-line |
|14|platform-admin organizations/OrgStatusControl.tsx:29|조직 상태 변경|변경| **select 되돌림 특수처리(§6)** |
|15|buildings/[id]/tenant-sections/MoveOutControl.tsx:34|공실 처리|공실 처리| |
|16|platform-admin accounts/page.tsx:441|플랫폼 관리자 권한 부여|권한 부여| |
|17|platform-admin accounts/page.tsx:450|플랫폼 관리자 권한 해제|권한 해제| |
|18|platform-admin accounts/AccountRowActions.tsx:53|{action}(활성화/비활성화)|{action}| |
|19|platform-admin accounts/AccountRowActions.tsx:63|비밀번호 초기화|초기화| |

## 6. async 전환 특수 케이스

- **핸들러 async화**: 대부분 `onClick`/함수는 `async`로 바꾸고 `if (!(await confirm(...))) return;`. window.confirm(sync)→await(async)로 바뀌므로 후속 로직 순서 검증.
- **OrgStatusControl (select 되돌림)**: `onChange`는 async로 못 만든다(취소 시 `e.currentTarget.value` 복원 필요, await 후 currentTarget null화). → 이벤트 요소를 **await 이전에 캡처**하고 IIFE로 처리:
  ```tsx
  onChange={(e) => {
    const next = e.target.value as OrganizationStatus;
    if (next === status) return;
    const selectEl = e.currentTarget;      // 캡처
    const message = ...;
    void (async () => {
      const ok = await confirm({ title: "조직 상태 변경", description: message, confirmLabel: "변경" });
      if (!ok) { selectEl.value = status; return; }
      void onChange(next);
    })();
  }}
  ```
- **MessagingComposer**: desc에 `\n` 포함 → `whitespace-pre-line`으로 렌더. 폴백/테스트 문자열 동일 유지.
- **accounts/page.tsx**: 441·450이 컴포넌트 본문 핸들러인지 확인 후 `useConfirm()`를 최상단 배치(훅 규칙). 모듈 헬퍼면 컴포넌트로 끌어올림.
- **TenantManagementCardModal.requestClose**(useCallback): async화 무해(호출측 await 불필요, confirm resolve 후 onClose 실행).

## 7. 테스트 처리 (정책: 신규 작성 안 함)

`window.confirm`을 mock/assert하는 기존 6파일 — 폴백 경로로 통과 목표:
- OrgStatusControl.test.tsx (true/false mock), AccountFormModal.test.tsx (**문자열 assert**), LongTermRepairLedger.test.tsx (true), MoveOutControl.test.tsx (true), MessagingComposer.test.tsx (**문자열 assert** ×2 + not.toHaveBeenCalled), TemplatesTab.test.tsx (true).
- 조치: description 원문 보존으로 문자열 assert 유지. async 전환으로 타이밍이 어긋나는 테스트만 `await`/`findBy`/`waitFor` **최소 보정**(신규 아님, 유지보수). 실제 깨짐 여부는 vitest 실행으로 확인.

## 8. 범위 밖 (Out of scope)

- 경고아이콘형 팝업 / `DeleteBuildingTypeDialog` 통합 — 후속.
- resident·partner(CSS 모듈 체제) — `PartnerConfirmDialog` 유지, 미변경.
- 문구 리라이트(제목 신설 외).

## 9. 검증

- **Claude 담당**: `tsc` (소스만; `.next` validator 노이즈는 `grep -vE '\.next'`), `lint`, `build`, 기존 `vitest` 그린.
- 워크트리엔 node_modules 없음 → 검증은 master 체크아웃 node_modules 정션 연결 후 실행, 끝나면 `rmdir` (Turbopack 정션 거부 → webpack build).
- **픽셀 정합 증빙 = 사용자 직접 수행** (2026-09-09 결정). `scripts/pixel-diff` 하네스로 열린 상태 다이얼로그 캡처 vs staging 정본. Claude는 하네스 개조는 요청 시에만.

## 10. 커밋 배치

1. **C1** ConfirmDialog + ConfirmProvider + useConfirm 신설 + 2개 layout 마운트.
2. **C2** danger 7곳 교체.
3. **C3** 이탈경고 5곳 교체.
4. **C4** 일반확인 7곳 교체(OrgStatusControl·MessagingComposer 특수 포함).
5. **C5** 테스트 보정(필요시). 픽셀 정합 증빙은 사용자 직접 수행.

각 배치 후 tsc/lint/(관련)vitest 스팟 검증. 커밋 직후 `wbs-commit-sync`로 관련 화면 dev 동기화.
