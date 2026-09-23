# 버튼 공통 컴포넌트 수렴 Implementation Plan

> **상태: 웹 배치 1~3 + 모바일 2종 완료 (2026-09-23).** 웹은 치환 가능한 raw 후보 0개소(§13), 모바일은 앱별 공용 버튼 `PartnerButton`·`ResidentButton`을 만들어 33개소를 치환했다(§14). 남은 raw 버튼은 전부 사유가 결정된 제외 대상이다.

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
- [x] `size` variant 신설 — `std`(정본 `.hf-btn`) · `sm`(26/r8/11.5) · `legacy`(구 44/r12/14). **정본 근거가 확실한 2종만 만들었다.** 32px·36px은 패딩 표본이 빈약해 보류.
- [x] **base 교정 완료** — 기본값 `legacy` → `std`. `<Button>` 140개소가 정본 표준 규격이 됐다.
- [x] `std` 패딩 18px → **15px** 교정. 18px은 `.mvq-b`·`.lg-print` 등 화면별 클래스의 값을 센 것이었고, 정본 표준 `.hf-btn`은 15px이다.
- [x] **롱테일 근접값 검증 완료** — `40px/r10/13px`(앱 4개소)는 이식 오차가 맞았다. 처리 결과:
  - `utilities/CarryOverDialog` → `<Button>` 전환(정본 `.hf-btn`). 취소=`ghost`, 이월=`primary` 정확히 일치.
  - `GasLedgerModal`·`MeterLedgerModal` 인쇄 버튼 → 정본은 `.lg-print`(40/r11/13.5, **padding 0 18px, 그림자 없음**)라 `<Button>`(px-15 + `shadow-pri`)과 다르다. **raw 유지하고 값만 교정.**
  - `gas/CarryOverDialog` → `bg-bg` 회색 버튼이라 기존 variant와 맞지 않고 정본 근거도 없어 **미변경**.
- [x] `TenantForm`의 `!important` 7개 제거. 강제하던 값이 `std` + `primary` 기본값과 동일해졌다.

### 10. 비활성 표시도 정본과 달랐다 (2026-09-17)

정본의 `:disabled` 규칙은 전부 한 패턴이다.

```css
background: var(--bg);  color: var(--t4);   /* .pri · .lg-print · .fmpc-btn · .uc-mini · .fmp-din */
```

**opacity 기반은 정본 전체에서 페이저 한 곳(`opacity:.4`)뿐이고 `0.7`은 어디에도 없다.** 그런데 공통 `Button`은 `disabled:opacity-70`을 썼고, 그 결과 호출부들이 opacity를 40·45·50·60·70 다섯 갈래로 각자 정하거나(76개소) 정본 패턴(`disabled:bg-*`/`disabled:text-t4`)을 손으로 다시 썼다(18개소). **geometry가 44 vs 40으로 어긋나 있던 것과 같은 구조다.**

교정: `disabled:opacity-70` → `disabled:bg-bg disabled:text-t4`.

### 11. 오버라이드 양보 규칙

호출부가 같은 유틸리티를 지정하면 컴포넌트 기본값을 문자열에서 뺀다(`dropOverridden`). 대상은 실제로 덮어써야 했던 `hover:bg-`와 비활성 표시 둘뿐이며, 색·크기 전반을 병합하지는 않는다 — 그건 `tailwind-merge`의 일이고 규격을 제한하려는 방침과 어긋난다.

- 비활성 표시는 속성별이 아니라 **통째로** 양보한다. 호출부가 직접 정의했다면 그쪽이 의도한 전체 표현이기 때문이다.
- 단 `disabled:cursor-*`는 양보를 유발하지 않는다. 커서는 시각 표현이 아니므로, 커서만 지정했다고 회색 처리를 잃으면 안 된다.

### 12. 치환 판정은 이름이 아니라 값으로 해야 한다

분석 초기에 `rounded-[11px]` vs `rounded-btn`, `bg-blue`/`bg-teal` vs `bg-brand`, `shadow-hf-btn` vs `shadow-pri`를 전부 충돌로 오판해 "안전 치환 0개소"가 나왔다. 전부 **값이 같은 다른 이름**이다(`--shadow-hf-btn`도 `--shadow-pri`와 값이 동일하다). 값 기준으로 비교하자 10개소가 드러났다.

→ 앞으로 치환 후보를 뽑을 때는 반드시 값으로 정규화해 비교한다.

### Phase 2 — 단계적 수렴

- [x] **배치 1 (6개소)** — 정본 `.hf-btn`/소형 규격과 클래스가 정확히 일치하는 지점. TenantOutputModal·UtilityWorkspaceHeader×2·ElectricityPeriodBar·UtilityWorkspaceBar·GasBillingToolbar.
- [x] **양보 규칙 도입 후 2개소** — PreviewPane·GasBillingToolbar 계산(자체 `disabled:opacity`).
- [x] **배치 2 (10개소)** — 값 기준 재분석으로 드러난 지점. platform-admin 3 · FeeItemFormDialog 2 · BillingPeriodSettingsBar · SettlementExtrasSection · SettlementDecisionDialog · ElectricityPeriodBar · UtilityWorkspaceBar.

**누적 18개소 치환. `<Button>` 142 → 160개소.** 남은 raw 후보 36개소의 사유별 내역:

| 사유 | 개소 | 성격 |
|---|---|---|
| variant 불명(정본에 없는 색 조합) | 20 | 디자인 판단 필요 |
| 클래스 충돌 | 10 | 대부분 `px-[18px]`(정본 `.lg-print` 계열) · `flex` |
| `sm` + 채움 | 6 | 정본에 규격 없음 — 유지 결정됨 |

`px-[18px]` 충돌 6개소는 정본이 `.hf-btn`(15px)이 아니라 `.lg-print`(18px) 계열일 가능성이 있다. 다음 배치 전에 각 지점의 정본 카운터파트를 확인해야 한다.

- [x] 남은 36개소는 위 표의 사유별로 개별 판단 → **배치 3에서 완료(§13)**. 위 표는 배치 2 시점 기록이며, 분석 도구의 사각지대 때문에 분류 일부가 틀려 있었다.
- [x] **배치 3 (2026-09-23)** — 분석 도구 v2로 재분석하고 지점별로 정본과 대조했다. 치환 26 · 원복 4 · 회귀 수정 1 · Figma 변환 오류 그림자 교정 2. `<Button>` 150 → 172개소(배치 2 이후 다른 세션의 화면 재구현으로 160 → 150이 됐었다).
- [ ] 높이 없는 343개소는 **원칙적으로 비대상**. 다만 표본 검수로 액션 버튼 오분류가 없는지 확인한다.
- [ ] 하드코딩 hex 138개소 토큰 치환(§8 잔여 측정 후).
- [x] 모바일 2종(resident·partner)의 클래스맵 체제는 **별도 트랙** → 2026-09-23 결정: **엔트리포인트별 공용 버튼**. 웹 Button에 합치지 않고 앱마다 `_components`에 둔다(§14).

### 13. 배치 3 — 분석 도구 사각지대, 회귀, 정본 대조 결과 (2026-09-23)

#### 분석 도구(`btn-safe.mjs`) v1의 사각지대 3개

| 사각지대 | 결과 |
|---|---|
| variant를 **이름**으로 판정 | `bg-surface`(=#fff)를 흰 배경으로 못 알아봐 ghost 버튼 9개소를 "variant 불명"으로 분류. `bg-red-t`(연빨강)는 `\bbg-red\b` 오탐으로 danger로 분류 |
| 컴포넌트가 **추가**하는 속성 미검사 | 호출부와 값이 다른 것(충돌)만 봐서, 그림자 없던 버튼에 `shadow-pri`가 새로 붙는 경우를 통과시킴 → 아래 회귀 3건 |
| 태그 끝을 첫 `>`로 판정 | `onClick={() => …}`의 `>`에서 끊겨 className을 못 읽음 → 치환 가능 버튼 11개소가 아예 안 보였음 |

v2는 값 기준 variant 판정, 추가·소실 속성 검사, 문자열·중괄호를 인식하는 태그 파싱으로 고쳤다. 치환 사양은 따로 "원래 className vs (Button이 내보낼 클래스 + 새 className)"을 속성 단위로 대조하는 사전 검증을 거쳤다. 이 검증에서 `disabled:hover:bg-teal`의 "hover:bg-"가 hover 양보를 유발해 활성 hover가 사라지는 경우(TenantOccupancyCard)를 잡았다.

#### 이전 배치의 회귀 3건 — 정본이 그림자를 끈 버튼에 `shadow-pri`가 붙었다

| 지점 | 정본 | 조치 |
|---|---|---|
| 공과금 헤더 "전체 이월"(배치 1) | `.hf-btn pri` + 인라인 `style="box-shadow:none"` | 그림자 양보 규칙 신설 + `className="shadow-none …"` |
| FeeItemFormDialog "수정"·"추가"(배치 2) | `.fmpc-btn go`(그림자 없음) | raw로 원복 — 모달 계열 결정(아래) |

#### 원래 36개소의 정본 대조 결과

- **충돌 10개소**: 치환 가능은 건물 등록 헤더 "등록 저장" 1개소(`.hf-btn pri`). 나머지는 정본이 모달 전용 클래스(`.fmpc-btn` 4 · `.asp-btn` 2 · `.mvq-b` 1)이거나, `.hf-btn`에 문맥 규칙 `.ms-actbar .hf-btn{padding:0 10px}`이 걸린 이사정산 액션바 2개소였다. `.lg-print`는 아니었지만 18px·그림자 없음이라는 성격은 같다.
- **variant 불명 20개소**: 9개소는 가짜 분류(정본 `.hf-btn sec`·`.uc-mini` 그대로 → 치환). 나머지는 정본 모달 계열(`.fmpc-btn` 회색 채움 취소 등).
- **sm + 채움 6개소**: 결정대로 미변경. 단 **정본에 채움형 `.uc-mini.pri`가 있다**(공과금 바 `ucBarSave`, 수납 `rcTnSave`·`rcNoteSave`·`rcHistSave` 등, 인라인 덮어쓰기 없이 26px). "정본에 대응 규격 없음"이라는 기존 결정의 전제와 다르므로 재검토가 필요하다. `Button.tsx` 주석의 "정본 26px 버튼은 전부 흰 배경+테두리" 문장도 그때 함께 고친다. 배치 2 이후 같은 유형이 1개소 늘어 지금은 7개소다(BillingPeriodSettingsBar, 정본 `mfSave`).

#### Figma MCP 변환 오류 그림자 교정

`shadow-[0_6px_7px_rgba(20,164,151,0.5)]`는 Figma MCP가 `drop-shadow`로 내보내면서 blur가 절반이 되고 spread가 사라진 값이다. 정본 `.hf-btn.pri`는 `0 6px 14px -4px`(= `shadow-pri`)다. 이사정산 "저장"(raw 유지, 값만 교정)과 건물 출력 모달 "둘 다 인쇄"(Button 치환으로 교정) 2개소.

#### 남은 raw 후보 (v2 기준)

| 분류 | 개소 |
|---|---|
| 치환 가능 | **0** |
| sm + 채움 — 유지 결정(재검토 필요) | 7 |
| 정본 모달 계열 — raw 유지 결정 | 32 |
| 문맥 패딩(`.ms-actbar`) — size로 표현 불가 | 2 |
| Button에 없는 색(연빨강 1 · 투명 2) — raw 유지 결정 | 3 |

제외 대상은 `btn-safe.mjs`의 `EXCLUDE` 목록에 사유와 함께 들어 있어, 다음 분석에서도 따로 표시된다.

#### 로그인 버튼

리뷰 지적("로그인 버튼이 별도 버튼")을 반영했다. 전에 공통화하지 못한 이유는 정본 로그인 버튼이 `.hf-btn`이 아닌 인라인 1회용 규격(50/r14/15/굵기 800, 그림자 없음)이었고, Button이 크기·굵기를 고정해 표현할 수 없었기 때문이다. `size="login"`을 신설하고 굵기를 size로 옮겨 staff·admin 로그인 2개소를 치환했다. partner·resident 로그인은 클래스맵 체제라 여전히 별도 트랙이다.

### 14. 모바일 공용 버튼 — 현장관리자·세입자 (2026-09-23)

**결정(사용자)**: 엔트리포인트마다 공통을 둔다. staff·admin은 정본 버튼 규격이 같아 `components/common/Button` 하나를 같이 쓰고, 현장·세입자는 정본이 달라 앱별 `_components`에 둔다. 두 모바일 앱끼리도 합치지 않는다(9/2 결정 유지). API(`variant`·`size`, className 양보 규칙)는 세 컴포넌트가 같고, 양보 규칙 자체는 `components/common/buttonOverride.ts` 한 곳에서 관리한다.

**정정 두 가지**: ① 모바일은 CSS 모듈이 아니라 이미 Tailwind 클래스맵(`*Classes.ts`) 체제다(`.module.css` 0개). ② §6의 "모바일 버튼 대부분 높이 없음(비대상)"은 측정 오류였다 — className이 `styles.x` 클래스맵 참조라 태그 안 문자열만 보는 파서에 안 잡혔다. 클래스맵까지 따라가면 현장 21개·세입자 15개가 액션 버튼이다.

**정본**: 현장 10화면은 git 이력에 없어 staging에서 받았다(`partner/<화면>/<화면>.dc.html`). 세입자 14화면은 git 7 + staging 7(me·bill·bill-detail·notice·notice-detail·terms·privacy).

| 컴포넌트 | size | 정본 | variant |
|---|---|---|---|
| `PartnerButton` | `std` 52/r15/15.5 | 하단 액션 `.btn` | `primary`(`.pri`·`.k`) · `secondary` 회색(`.sec2`·`.c`) · `danger`(`.r`·`.del`) · `ghost` 흰 배경+테두리(`#pfOut`, 웹 ghost와 같은 뜻) |
| | `md` 48/r14/15 | 확인창 `.cf-btn` | |
| | `sm` 46/r13/14.5 | 프로필 확인창 `.cf-btn`·`.rc-f .btn` | |
| | `login` 56/r15/16 + 청록 그림자 | `#mlSubmit` | |
| `ResidentButton` | `std` 52/r14/15.5 | `.sheet-btn`·`.nm-btn` | `primary` · `secondary` · `danger` · `kakao` — hover는 정본대로 |
| | `md` 50/r14/15 | 확인창 `.cf-btn` | |
| | `lg` 54/r15/16 | `.sbtn` | |
| | `xl` 56/r16/16.5, 자간 -.02em, 누름 98.5% | 온보딩 `.btn`·`.kakao` | |

- 현장 정본에는 비활성 규칙이 없어, 앱이 써 온 `opacity .7`을 `PartnerButton` 기본값으로 뒀다. 세입자는 정본 `.sbtn:disabled`(회색 배경+흐린 글자).
- 카카오 로그인은 운영에서 `<a>`(실 OAuth 링크)라 컴포넌트로 못 덮는다. `residentButtonClass()`를 내보내 링크도 같은 규격을 쓴다.

**치환**: 현장 20개소(AS·AS 접수·검침·이사정산 등록·공용 확인창·프로필·로그인), 세입자 13개소 + 카카오 링크(홈 공지 확인·내 정보 확인창 6·로그인 2·매칭 실패·승인 대기·본인인증 2). 안 쓰게 된 클래스맵 키 23개 삭제.

**raw 유지**:
- 현장 AS "삭제" — 정본 `.btn.del` 연빨강판. 웹 퇴실처리와 같은 이유(색 variant를 1개소 위해 늘리지 않음).
- 세입자 퇴실 버튼 2개(`MoveOutSection`, 48/r13/14/800) — 정본 근거 없음. 정본의 퇴실 버튼은 홈의 `.ms-btn`(52/r14/15.5/800)인데 앱은 내 정보 화면에 다른 규격으로 있다. **정본 드리프트 — 재검토 필요.**
- 세입자 본인인증 `.btn.alt`(투명 밑줄 링크), 관리비 상세 `.ab`(42px 연청록, 1화면 전용 체계).

**버그 수정**: 세입자 내 정보 확인창의 청록·빨강 버튼이 PC에서 hover 시 연회색 배경에 흰 글자로 바뀌었다. 회색 기본 클래스(`hover:bg-line`) 위에 색을 덧붙이는 구조였고, 생성 CSS에서 `hover:bg-line`이 `hover:bg-blue-d`보다 뒤라 이겼다(휴대폰은 `@media (hover:hover)` 밖이라 안 보임). variant 분리로 해소.

**보이는 변화**: 위 hover 버그 수정 · 빨강 hover 밝기 .95→.94(정본) · 현장 프로필 로그아웃 확인창 버튼이 로그아웃 중 opacity .7 · 세입자 본인인증 "확인 요청하기"에 hover 진한 청록 추가(정본 `.sbtn`엔 없지만 세입자의 다른 청록 버튼과 일관) · 본인인증 "네, 맞아요" 전환 효과가 전체→transform(정본).

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

### 정본에는 이미 디자인시스템 버튼이 있었다 — `.hf-btn`

```css
.hf-btn{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 15px;
        border-radius:11px;font-size:13.5px;font-weight:700;cursor:pointer;
        border:1px solid transparent;white-space:nowrap}
.hf-btn.pri  {background:var(--blue);color:#fff;box-shadow:0 6px 14px -4px rgba(20,164,151,.5)}
.hf-btn.sec  {background:#fff;color:var(--t2);border-color:var(--line)}
.hf-btn.ghost{background:transparent;color:var(--t2)}
```

**7개 화면에서 69회 사용**되며 값이 전부 동일하다. 앱 `Button`의 `primary`/`ghost` variant는 `.hf-btn.pri`/`.sec`와 이미 일치했고(`--shadow-pri`가 `.pri`의 box-shadow와 정확히 같은 값), **어긋나 있던 것은 geometry뿐이었다.** `size="std"`가 이 클래스의 등가물이다.

주의: 모든 40px 버튼이 `.hf-btn`은 아니다. `.lg-print`(검침대장 인쇄)는 같은 40/r11/13.5지만 **padding 18px에 그림자가 없어** `<Button>` 대상이 아니다. 화면별 일회성 클래스(`.mvq-b`·`.fmpc-btn`·`.asp-btn`)도 마찬가지다.

### 검증

pixel-diff `staff-building-register`(= `/staff/buildings/new`, `<Button>`이 보이는 화면) **0.068% / 804px**. diff 이미지에서 "등록 저장"·"뒤로가기" 버튼에 불일치 픽셀이 없다. 교정 후 재측정도 동일해 회귀 없음.

측정 시 주의: 저장된 스태프 세션이 캡처 1~2회 만에 만료된다. `save-auth.mjs` 직후 연달아 캡처해야 하며, 그렇지 않으면 로그인 화면이 잡혀 58.8%가 나온다(정합 문제 아님).

### 추가 발견: 브랜드 토큰이 3중 중복

`--color-brand` · `--color-blue` · `--color-teal`이 모두 `#14A497`이다(각각 `-dark`/`-d`, `-tint`/`-t` 계열까지). 정본이 쓰는 이름은 `--blue`다. 정리는 이 계획의 범위 밖이지만 기록해 둔다.

## 결정 로그

| 날짜 | 결정 | 근거 |
|---|---|---|
| 2026-09-17 | 정본 유지 · 구조만 통일 (픽셀 통일 안 함) | 정본이 화면별로 규격을 다르게 규정 |
| 2026-09-17 | `size` variant 단독 · `tailwind-merge` 미도입 | 정본 정합이 정책인 환경에서 "아무 값이나 통과"는 단점 |
| 2026-09-17 | base 교정 여부는 **140개소 정본 대조 후** 결정 | 대조 없이 교정하면 정합 개선과 회귀가 뒤섞임 |
| 2026-09-17 | 대조 결과 base를 `std`로 교정 **실행** | 정본 `.hf-btn`이 7화면 69회 표준, 구 기본값 44px은 팝업 1곳 전용 |
| 2026-09-17 | `.lg-print` 계열은 공통 Button 대상에서 제외 | 정본이 그림자 없는 별도 규격 — 넣으면 정합이 깨진다 |
| 2026-09-23 | 정본 모달 계열(`.fmpc-btn`·`.mvq-b`·`.asp-btn`·`.lg-print`) 전부 raw 유지, 이미 Button으로 바뀐 4개소는 원복 | 패딩 18px·채움 버튼 그림자 없음·회색 채움 취소 등 화면별 별도 규격. 규칙을 하나로 유지 |
| 2026-09-23 | Button에 없는 색(연빨강·투명) 3개소 raw 유지 | 1~2개소를 위해 variant를 늘리지 않는다. 앱 `ghost`가 정본 `.sec`라 정본 `.ghost`를 넣으면 이름이 헷갈린다 |
| 2026-09-23 | `size="login"` 신설, 굵기를 size로 이동 | 정본 staff·admin 로그인 `#lgSubmit`이 동일 규격. 리뷰 지적 반영 |
| 2026-09-23 | 그림자 양보 규칙 추가 | 정본 `.hf-btn.pri`에 인라인 `box-shadow:none`을 주는 곳이 있다(전체 이월) |
| 2026-09-23 | 치환 판정 도구 v2 + 사양 사전 검증 | v1 사각지대가 회귀 3건을 통과시켰다. tsc·lint는 이런 표시 변경을 잡지 못한다 |
| 2026-09-23 | 엔트리포인트별 공용 버튼(`PartnerButton`·`ResidentButton`), 양보 규칙은 `buttonOverride.ts`로 공유 | 모바일 정본이 웹·서로 다름. API는 통일, 겉모양만 앱별 |
| 2026-09-23 | `PartnerButton` 비활성 기본값 = opacity .7 | 현장 정본에 비활성 규칙이 없어 앱 관례를 따름 |
