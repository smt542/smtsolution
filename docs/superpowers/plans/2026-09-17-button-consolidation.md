# 버튼 공통 컴포넌트 수렴 Implementation Plan

> **상태: 조사 완료 · 구현 미착수.** 이 문서는 조사 결과와 계획만 담는다. 코드 변경은 사용자 지시 후 별도 착수.

**Goal:** 화면마다 제각각인 버튼 구현을 공통 컴포넌트(`components/common/Button.tsx`)로 수렴시킨다. **보이는 픽셀은 바꾸지 않는다** — 정본(`.dc.html`)이 화면별로 서로 다른 규격을 규정하고 있으므로, 통일 대상은 **작성 방식(구조)**뿐이다.

**Non-goal:** 버튼 높이·라운드·폰트를 앱 전역에서 동일하게 맞추는 것. 정본이 다르므로 이는 정합을 깨뜨린다.

---

## 조사 결과

### 1. 현황 수치 (측정 완료)

| 항목 | 값 |
|---|---|
| 공통 `Button` 사용 | **140개소 / 62파일** |
| raw `<button>` | **490개소 / 190파일** |
| 하드코딩 브랜드 hex | **138개소** |
| 클래스맵 파일(`*Classes.ts`) | **25개** |

raw `<button>` 분포 — staff 296 · components 69 · resident 42 · platform-admin 42 · partner 41

### 2. 핵심 발견: 작성 체제가 2개로 갈라져 있다

공통 `Button` 사용 140개소의 엔트리포인트별 분포:

| 엔트리포인트 | `<Button>` | `*Classes.ts` |
|---|---|---|
| staff | 119 | 2 |
| platform-admin | 17 | — |
| components | 4 | 2 |
| **resident** | **0** | **12** |
| **partner** | **0** | **9** |

resident·partner(모바일 2종)는 공통 `Button`을 **단 한 번도 쓰지 않는다.** 대신 화면별 `*Classes.ts` 클래스맵 객체에 Tailwind 문자열을 모아두는 방식이다. 즉 "채택률 28%"는 단일 체제의 저조한 채택이 아니라, **체제 A(staff·platform-admin: JSX 인라인 + 공통 Button)와 체제 B(모바일: 클래스맵 객체)의 병존** 결과다.

### 3. 근본 원인: 공통 `Button`은 호출부에서 덮어쓸 수 없다

`components/common/Button.tsx`의 현재 API:

```tsx
variant: "primary" | "ghost" | "danger"   // size 개념 없음
base: "h-11 rounded-xl px-4 text-sm font-bold disabled:opacity-70"   // 고정
```

클래스 결합이 `` `${base} ${v} ${className}` `` 단순 연결인데, **`tailwind-merge`·`clsx`·`class-variance-authority`가 모두 미설치**다(`package.json` 확인). 따라서 `<Button className="h-[50px]">`를 쓰면 `h-11`과 `h-[50px]`가 함께 남고, 승자는 클래스 문자열 순서가 아니라 생성된 CSS 규칙 순서로 결정된다 — 호출부가 base를 제어할 수 없다.

전역에서 base 오버라이드를 시도한 곳은 단 1개소이며, `!important`를 붙여야 했다:

```
app/(staff)/staff/(app)/buildings/[id]/components/TenantForm.tsx:493
<Button variant="ghost" className="!h-[40px] !rounded-[11px] !px-[15px]" />
```

정본이 화면마다 50/52/56px을 요구하는데 `Button`은 44px 단일 고정이고 우회로도 없다. **raw `<button>` 490개소는 회피가 아니라 API 한계의 필연적 결과다.**

### 4. 로그인 버튼 정본 대조 (5건 전수)

정본은 staging에서 직접 받아 대조했다.
`staff/login/login.dc.html` · `admin/login/login.dc.html` · `partner/mobile-login/mobile-login.dc.html` · `resident/resident-login/resident-login.dc.html`

| 화면 | 정본 | 앱 | 판정 |
|---|---|---|---|
| staff | `h50 · r14 · 15px · w800 · var(--blue)` | `h-[50px] rounded-[14px] text-[15px] font-extrabold` + `bg-[#14A497]` | 수치 일치 · 색 하드코딩 |
| platform-admin | `h50 · r14 · 15px · w800 · var(--blue)` | 동일 + `bg-blue` | 일치 |
| partner | `h56 · r15 · 16px · w700 · var(--blue)` + shadow | `h-14 rounded-[15px] text-base font-bold bg-blue` + 동일 shadow | 일치 |
| resident 카카오 | `h56 · r16 · 16.5px · w700 · var(--kakao)` | `h-14 rounded-2xl text-[16.5px] font-bold bg-kakao` | 일치 |
| resident 시트 | `h52 · **r14** · 15.5px · w700 · var(--blue)` | `h-[52px] **rounded-btn** text-[15.5px] font-bold bg-blue` | **불일치 (3px)** |

**결함 1건** — `app/(resident)/resident/login/loginClasses.ts:44`가 `rounded-btn`을 쓰는데 `app/globals.css:62`의 `--radius-btn`은 **11px**이다. 정본은 14px. 토큰 이름이 그럴듯해 눈에 띄지 않은 케이스.

### 5. 색 토큰: 하드코딩 → 토큰 치환은 표시 불변

정본과 앱의 색 변수가 값까지 동일하다.

| | 정본 `.dc.html` | 앱 `globals.css` |
|---|---|---|
| 기본 | `--blue: #14A497` | `--color-blue: #14A497` / `--color-brand: #14A497` |
| 진한 | `--blue-d: #0E8677` | `--color-blue-d` / `--color-brand-dark` |
| 틴트 | `--blue-t: #E2F5F1` | `--color-blue-t` / `--color-brand-tint` |

앱의 `blue` 네이밍이 청록값을 담고 있는 것은 실수가 아니라 **정본을 그대로 미러링한 결과**다. 따라서 `blue`를 `brand`로 일괄 개명하면 오히려 정본 네이밍과 멀어진다 — 중복 토큰 정리는 별도 판단이 필요하며 이 계획의 범위 밖으로 둔다.

하드코딩 hex 138개소 내역: `#14A497` 56 · `#E2F5F1` 37 · `#F04452` 25 · `#0E8677` 20.

### 6. 규격 빈도표 (측정 완료)

Codex 워커가 메모리 부족으로 두 차례 중단되어, 파싱 스크립트로 직접 측정했다(`<button>` 여는 태그의 문자열 리터럴에서 `h-`/`rounded-`/`text-`/`font-` 추출).

raw `<button>` 490개소 중 **명시적 높이가 있는 것은 147개소뿐이고, 343개소(70%)는 높이 유틸리티가 없다.** 후자는 탭·토글·인라인 텍스트 버튼 등 **비대상**으로 본다.

| 엔트리포인트 | raw `<button>` | 높이 없음(비대상 추정) |
|---|---|---|
| staff | 296 | 187 |
| components | 69 | 48 |
| platform-admin | 42 | 31 |
| resident | 42 | 38 |
| partner | 41 | 39 |

높이 보유 147개소의 규격 조합은 **46종**이며, 분포는 지배적 클러스터 2개 + 롱테일이다.

| 순위 | 규격 (높이/라운드/폰트/굵기) | 개소 |
|---|---|---|
| 1 | **40px / r11 / 13.5px / w700** | **36** |
| 2 | 26px / r8 / 11.5px / w700 | 17 |
| 3 | 26px / r8 / — (아이콘) | 13 |
| 4 | 34px / r8 / 13px / w700 | 5 |
| 5 | 40px / r10 / 13px / w700 | 4 |
| — | 나머지 41종 | 대부분 1~3개소 |

### 7. 핵심 발견: 공통 `Button`의 기본 규격이 정본 표준과 다르다

정본(`staff/receipt-management/receipt-management.dc.html`)의 표준 액션 버튼 규칙을 확인했다. 서로 다른 5개 규칙이 **모두 동일한 수치**를 쓴다.

```css
height:40px; padding:0 18px; border-radius:11px;
font-size:13.5px; font-weight:700;
```

같은 정본의 `height:38px / radius:10px / font-weight:500`은 **입력 필드·셀렉트**이며 버튼이 아니다. 그리고 정본 전체에서 `height:44px`는 **단 1회** 등장한다.

| | 높이 | 라운드 | 폰트 | 굵기 |
|---|---|---|---|---|
| **정본 표준 버튼** | **40px** | **11px** | **13.5px** | 700 |
| **공통 `Button` base** | `h-11` = **44px** | `rounded-xl` = **12px** | `text-sm` = **14px** | 700 |
| 앱 raw 버튼 1위(36개소) | 40px | 11px | 13.5px | 700 |

**공통 `Button`은 정본에 사실상 존재하지 않는 규격으로 만들어져 있다.** 앱 전역에서 `44px/r12/14px` 규격의 raw 버튼은 2개소뿐인 반면, 정본 표준(40/11/13.5)을 손으로 다시 쓴 버튼이 36개소다. 채택을 막은 것은 API 한계(§3)만이 아니라 **기본값 자체가 틀렸다는 점**이다.

부수 확인: `--radius-btn: 11px`는 정본 표준 버튼 라운드와 정확히 일치하므로 **토큰 값은 옳다.** §4의 resident 시트 버튼 건은 해당 화면 정본이 예외적으로 14px인 개별 사례다.

### 8. 미측정 잔여

- 하드코딩 hex 138개소의 파일별 분포 및 `rgba()` 등 alpha 변형 유무 판정

---

## 계획

### Phase 0 — 무해한 선행 수정 (표시 불변 + 결함 1건) — **완료**

- [x] `loginClasses.ts` resident 시트 버튼 `rounded-btn`(11px) → 정본값 `rounded-[14px]`로 교정. **유일하게 픽셀이 바뀌는 변경이며, 정본 방향으로의 교정이다.**
- [x] staff 로그인 하드코딩 hex 5개 → 토큰. `bg-[#14A497]`→`bg-blue`, `hover:bg-[#0E8677]`→`hover:bg-blue-d`, `text-[#14A497]`→`text-blue`, 체크박스 `peer-checked:border/bg-[#14A497]`→`-blue`, `ring-[#14A497]/40`→`ring-blue/40`. 값 동일, 표시 불변.
- [ ] `rounded-btn`을 쓰는 나머지 13개소가 각자 정본과 맞는지 확인(11px이 정본 표준 버튼 라운드이므로 대부분 옳다. 토큰 값 자체는 건드리지 않는다).

### Phase 1 — `Button`에 `size` variant 신설

**결정(2026-09-17): `size` variant 단독으로 간다. `tailwind-merge`는 도입하지 않는다.**

근거 — 이 프로젝트는 정본 정합이 정책이므로, `tailwind-merge`의 "호출부가 아무 값이나 통과"는 장점이 아니라 단점이다. 틀린 값도 그대로 통과한다. 반대로 `size` variant는 롱테일 41종을 정본과 하나씩 대조하도록 강제하며, 그 과정에서 숨은 정합 오류가 드러난다(§4 resident 3px 건이 그렇게 발견됐다).

**대가로 부분 수렴을 받아들인다.** 상위 5개 규격을 사이즈로 만들면 높이 보유 147개소 중 75개소(51%)를 흡수하고, 나머지 72개소는 raw `<button>`으로 남는다. 이는 미완성이 아니라 **의도된 경계**다.

- [x] **선결 과제 — 정본 대조 완료.** 호출부를 하나씩 대조하는 대신 정본 화면들이 규격을 공유하는지 확인하는 방식으로 수행했다. 결과는 §9.
- [x] `size` variant 신설 — `std`(정본 표준 40/r11/13.5) · `sm`(26/r8/11.5) · `legacy`(현행 44/r12/14, 기본값). **정본 근거가 확실한 2종만 만들었다.** 32px·36px은 패딩 표본이 빈약해 보류.
- [ ] **base 교정** — `size`의 기본값을 `legacy`에서 `std`로 바꾸는 한 줄. 근거는 확보됐으나(§9) 140개소 표시가 바뀌므로 **사용자 결정 대기**.
- [ ] **롱테일 근접값 검증(진행 중)** — `40px/r10/13px`(앱 4개소)는 의심이 확인됐다. 정본에서 `r10 + 13px` 조합의 높이는 36px(10회)·38px(4회)·42px(1회)이며 **40px은 0회**다. 대상: `utilities/components/CarryOverDialog.tsx`, `gas/CarryOverDialog.tsx`, `GasLedgerModal.tsx`, `MeterLedgerModal.tsx`. 각 모달의 정본 규격을 확인해 교정 여부를 정한다.
- [ ] `TenantForm.tsx:493`의 `!important` 3개 제거. 해당 규격은 40px/r11 = 신설한 `std`와 높이·라운드가 같으므로 `size="std"`로 교체 가능한지 확인한다.

### Phase 2 — 단계적 수렴

- [ ] 높이 보유 147개소를 규격 클러스터 단위로 배치 PR 분할. 엔트리포인트별 순차 진행(선례: `common-ui-extraction` 백로그의 9PR 방식).
- [ ] 높이 없는 343개소는 **원칙적으로 비대상**. 다만 표본 검수로 액션 버튼 오분류가 없는지 확인한다.
- [ ] 하드코딩 hex 138개소 토큰 치환(§8 잔여 측정 후).
- [ ] 모바일 2종(resident·partner)의 클래스맵 체제는 **별도 트랙**. 공통 Button 수렴 전에 체제 통합 여부를 먼저 결정해야 한다.

### Phase 3 — 재발 방지 (선택)

- [ ] `eslint.config.mjs`에 `no-restricted-syntax` 추가 — `className` 내 raw hex 리터럴 금지. flat config에 커스텀 규칙 전례 있음(`no-restricted-imports`).

---

## 검증

- **표시 불변 증명**: `scripts/pixel-diff` 하네스 사용. `targets.json`에 로그인 4건을 추가하면 정본 대비 불일치 비율이 수치로 나온다. 로그인 화면은 인증이 불필요해 캡처 난이도가 가장 낮다.
- **정적 검증**: `tsc --noEmit` · `lint` · `build`.
- 단위 test 신규 작성 안 함(프로젝트 정책 — E2E만).

## 리스크

- **base 교정 시** 기존 `<Button>` 140개소의 높이가 일괄 4px 바뀐다. 140개소 정본 대조를 건너뛰고 교정하면 정합을 개선하는 대신 다른 곳을 깨뜨릴 수 있다. **대조가 선결 조건인 이유.**
- **`size` 단독의 구조적 한계** — 롱테일 72개소는 흡수되지 않는다. 시간이 지나며 "공통 Button으로 안 되는 버튼"이 다시 늘어날 수 있으므로, variant 목록이 46종으로 번지기 시작하면 `tailwind-merge` 재검토가 필요하다.
- **`blue`/`brand` 중복 토큰**을 정리하려는 시도는 정본 네이밍과 충돌한다. 이 계획에서는 손대지 않는다.

## 9. 정본 전수 대조 결과 (2026-09-17)

staff 정본 9개 화면 + 로그인 4개 화면을 내려받아 액션 버튼 CSS 규칙(굵기 700 이상 + `cursor:pointer`/`inline-flex`, 정사각 아이콘 제외)을 전수 추출했다.

| 규격 | 등장 | 등장 화면 |
|---|---|---|
| **40px / r11 / 13.5px / w700** | **27회** | **staff 9개 화면 전부** |
| 36px / r10 / 13px / w700 | 8회 | 8개 화면 |
| 32px / r9 / 13px / w700 | 7회 | 4개 화면 |
| 26px / r8 / 11.5px / w700 | 5회 | 4개 화면 |
| 44px / r12 / 14px / w700 | 2회 | staff-receipt 1개 화면뿐 |

**`40/r11/13.5`이 정본 표준임이 확정됐다** — 조사한 staff 화면 9개 전부에 등장한다.

그리고 **공통 `Button`의 현행 규격 `44/r12/14`는 업데이트 팝업 전용이었다.** staff-receipt 정본의 해당 2건은 `upClose`("오늘 그만보기") 등 팝업 하단 버튼의 인라인 스타일이며, 일반 액션 버튼이 아니다. 즉 공통 `Button`은 **팝업 예외 규격을 기본값으로 삼고 있다.**

→ base를 `std`로 교정할 근거는 충분하다. 다만 기존 `<Button>` 140개소의 높이가 일괄 -4px 되므로 사용자 결정 사항으로 남긴다. 사용처 상위: receipts 37 · setup · utilities · buildings · points.

## 결정 로그

| 날짜 | 결정 | 근거 |
|---|---|---|
| 2026-09-17 | 정본 유지 · 구조만 통일 (픽셀 통일 안 함) | 정본이 화면별로 규격을 다르게 규정 |
| 2026-09-17 | `size` variant 단독 · `tailwind-merge` 미도입 | 정본 정합이 정책인 환경에서 "아무 값이나 통과"는 단점 |
| 2026-09-17 | base 교정 여부는 **140개소 정본 대조 후** 결정 | 대조 없이 교정하면 정합 개선과 회귀가 뒤섞임 |
| 2026-09-17 | 이번 라운드는 계획서 확정까지. 구현 미착수 | 사용자 지시 |
