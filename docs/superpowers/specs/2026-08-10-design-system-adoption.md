# 디자인 시스템 도입 (프로토타입 "홈지기" → 앱 전체) 설계

**작성일:** 2026-08-10
**출처:** `docs/prototype/주택관리ERP 프로토타입 (오프라인).html` → 추출본 `docs/prototype/_design-system.css`(토큰+컴포넌트 CSS는 line 1~118, PC 앱 마크업은 341~514).

## 1. 배경·범위

프로토타입은 **앱 3개**(사무실 PC / 현장관리자 모바일 / 세입자 앱)로 구성. 우리가 만드는 **staff = "사무실 PC" 데스크톱 앱**(`.hf-*` 클래스군: 240px 사이드바 + 상단바 + 테이블/패널). 사용자 결정 = **반응형**(데스크톱 우선 + 좁은 화면 대응).

**이 단계 범위:** 프로토타입 디자인 토큰을 `globals.css`에 이식 + 공용 컴포넌트를 프로토타입 스타일로 통일 + **앱 셸(사이드바+상단바) 신설**. 이후 P1b/기존 화면이 이 위에 올라감.
**불포함(후속):** 각 기존 화면(로그인·건물·부과·거래처·수납) 개별 리스타일은 셸/컴포넌트 완成 후 별도 진행.

**결정 필요(스펙 리뷰):** 제품명 — 프로토타입은 **"홈지기"**, 메모/기존 코드는 "관리비서". 어느 쪽으로 통일할지.

## 2. 디자인 토큰 → `app/globals.css` (Tailwind v4 `@theme`)

프로토타입 `:root`(line 1) 전량 이식. 기존 brand(teal `#14A497`) → **blue `#3182F6`**로 대체.

```
색:  --color-blue:#3182F6  --color-blue-d:#1B64DA  --color-blue-t:#EAF2FE  --color-blue-t2:#F4F8FF
     --color-bg:#F2F4F6    --color-surface:#fff
     --color-line:#E8EBEE  --color-line2:#F1F3F5
     --color-t1:#191F28    --color-t2:#4E5968  --color-t3:#8B95A1  --color-t4:#B0B8C1
     --color-green:#12B886 --color-green-t:#E6F8F1
     --color-red:#F04452   --color-red-t:#FDECEE
     --color-amber:#FF922B --color-amber-t:#FFF3E6
반경: --radius-btn:13px  --radius-in:12px  --radius-card:16px  --radius-panel:16px  --radius-pill:999px
그림자: --shadow-pri:0 8px 16px -6px rgba(49,130,246,.5)   (파란 버튼 글로우)
        --shadow-card:0 1px 3px rgba(23,31,40,.05)
        --shadow-pop:0 22px 60px -20px rgba(23,31,40,.28)  (모달/팝오버)
폰트: Pretendard(이미 사용 중) 유지. body color=t1, tabular-nums 유틸(.num) 추가.
```
- 기존 `text-t1` 등 이미 쓰이는 토큰과 호환 유지(이름 그대로 t1~t4).
- `--color-brand` 참조가 남아있으면 blue로 매핑하거나 교체.

## 3. 앱 셸 (신설) — `app/(staff)/staff/(shell)/layout.tsx` + 컴포넌트

프로토타입 `.hf-app`(line 56) 구조: `[사이드바 240px] [메인(상단바+본문)]`.

**Sidebar (`components/shell/Sidebar.tsx`)** — `.hf-side`(57):
- 브랜드: 로고(그라디언트 사각+home 아이콘) + "홈**지기**"(지기=blue).
- 그룹 라벨 "관리업무"(`.hf-navlbl` 62) + nav 항목(`.hf-item` 64):
  | 라벨 | route | 권한 모듈 |
  |------|-------|-----------|
  | 건물·입주자 | /staff/building-list | buildings |
  | 지침·부과 | /staff/metering (후속) | billing |
  | 관리비 셋팅 | /staff/fee-item | fee_items |
  | 고지서 발행 | /staff/billing (후속) | billing |
  | 수납·민원 | /staff/receipt-management | arrears |
  | 수납처리 | /staff/payment (후속) | arrears |
  | 미납관리 | /staff/overdue (후속) | arrears |
  | 이사정산 | /staff/move-settle (후속) | move_settle |
  | 셋업 설정 | /staff/setup (후속) | setup |
  - 별도 하단 그룹 "설정": 계정·권한 /staff/staff-management (accounts). 협력업체 /staff/vendor-management (vendors).
  - **권한 게이팅**: `useMe().permissions`로 항목 표시/숨김(org_owner=전체). 아직 미구현 route는 "준비중" 비활성.
  - 활성 항목 하이라이트(현재 경로 기준, `usePathname`).
- 사이드바 하단(`.hf-side-foot` 67): 아바타 + 이름/회사·역할(`useMe`).

**Topbar (`components/shell/Topbar.tsx`)** — `.hf-top`(70): 크럼브(`.hf-crumb`) + 제목(`.hf-h1`) + 우측 아바타. 제목/크럼브는 각 페이지가 prop 또는 컨텍스트로 제공.

**반응형:**
- `md` 이상: 사이드바 고정 240px.
- `md` 미만: 사이드바 → 상단 햄버거로 여는 drawer(오프캔버스). 본문 full-width. (프로토타입 모바일 하단탭은 현장/세입자 앱 것이므로 staff엔 drawer 방식 채택.)
- 본문 `.hf-body`(74): padding 22~24px, 폭 자동. 폼 상세는 max-width 820px.

## 4. 공용 컴포넌트 통일 (`components/common/*`)

프로토타입 클래스 → 우리 컴포넌트 스타일 매핑(정확한 값은 `_design-system.css` 참조). Tailwind 유틸로 재작성, **props/시그니처는 최대한 유지**(기존 화면 깨지지 않게), 스타일만 교체. 신규는 추가.

| 컴포넌트 | 프로토타입 | 핵심 스타일 |
|----------|-----------|-------------|
| Button(기존) | `.hf-btn` (81) + pri/sec/ghost | h40, radius11, 700; pri=blue+글로우, sec=흰+line, ghost=투명 |
| Input(기존) | `.hf-in2` (103) | h42, radius10, border line, 13.5px; placeholder=t4 |
| Select(기존) | `.hf-select`(76)/`.hf-in2` | 드롭다운 chevron(t3) |
| Checkbox(기존) | `.hf-ckb` (111) | 19px radius6, on=blue+체크 |
| Tabs(기존) | `.hf-tab2` (116) | 밑줄 탭, on=blue+하단보더 |
| Modal(기존) | 팝오버 그림자 `--shadow-pop` | radius16, 흰 배경 |
| **Badge(신규)** | `.badge`+변형 (36) | radius7, 12px 700; b-blue/green/red/gray/amber |
| **Panel(신규)** | `.hf-panel`(90) | 흰 radius16, panel-h(제목+badge) + 본문 |
| **DataTable 재스타일** | `.hf-tbl`(93) | th=12px t3 배경#FBFCFD, td=13.5px line2, hover 행배경, .rt 우측정렬 |
| **Segmented(신규)** | `.hf-seg`(78)/`.hf-seg2`(107) | 회색 트랙, on=흰+그림자(또는 blue) |
| **StatCard(신규)** | `.hf-stat`(87) | 흰 radius15, lb(t3)+vl(24px 800) |
| **FormSection(신규)** | `.hf-fsec`(100) | 번호 badge + 제목 + 그리드 본문 |

- 기존 컴포넌트가 teal/`bg-teal-600` 등을 하드코딩한 곳 → blue 토큰으로 교체.
- `components/common/index.ts`에 신규 export 추가.

## 5. 테스트 전략
- 컴포넌트 RTL: 신규(Badge/Panel/Segmented/StatCard/FormSection) 렌더·변형·상호작용. 기존(Button/Input/Select/Checkbox/Tabs/Modal) 기존 테스트 유지 + 스타일 교체로 깨진 셀렉터 보정.
- Sidebar: 권한별 항목 표시/숨김, 활성 경로 하이라이트, 반응형 drawer 토글.
- 각 태스크 `tsc`·`vitest`·`build` green 후 커밋.

## 6. 구현 순서(플랜 개요)
1. globals.css 토큰(§2) — 시각 기준 확립.
2. 공용 컴포넌트 재스타일 + 신규(§4).
3. 앱 셸(사이드바+상단바, 권한 게이팅, 반응형)(§3) + `(shell)` 라우트 그룹에 기존 staff 화면 편입.
4. (후속) 기존 화면 개별 정렬 + P1b 화면을 셸/컴포넌트로.

## 7. 범위 외 / 후속
- 각 화면의 정확한 레이아웃 재현(건물상세 탭·폼섹션, 부과 테이블 등)은 §6-4 후속.
- 현장관리자/세입자 모바일 앱은 이 프로젝트 staff 범위 밖(별도).
- 다크모드 없음(프로토타입 라이트 단일).
