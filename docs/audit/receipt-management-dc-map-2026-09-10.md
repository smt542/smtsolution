# receipt-management.dc.html — Desktop `.hf-app` Porting Map

**Source:** `docs/prototype/staff/receipt-management/receipt-management.dc.html` (3834 lines, ~335KB)
**App route this maps to:** `/staff/receipts`
**Target region only:** the `.hf-app` desktop app view. The file also contains a landing/card view (`.lc-*`) and a mobile phone view (`.phone`/`.screen`/`.ph-*`) — **both ignored** here.
**Generated:** 2026-09-10.

> This file is a single stacked document. The three views are:
> 1. Landing (`.lc-*`) — IGNORE
> 2. Mobile (`.phone`/`.screen`/`.mnav`/`.ph-*`) — IGNORE
> 3. **Desktop `.hf-app`** — the target (starts at line **812**, closes at **883**; RNB rail 884–977; auto-alert modal 978–987; JS `<script>` 989–3833).

---

## 0. Design tokens (line 6)

```
--blue:#14A497  --blue-d:#0E8677  --blue-t:#E2F5F1  --blue-t2:#EFFBF8
--bg:#F2F4F6    --surface:#fff    --line:#E8EBEE    --line2:#F1F3F5
--t1:#191F28    --t2:#4E5968      --t3:#8B95A1      --t4:#B0B8C1
--green:#12B886 --green-t:#E6F8F1 --red:#F04452     --red-t:#FDECEE
--amber:#FF922B --amber-t:#FFF3E6
```
Font: Pretendard. `.num`/`font-variant-numeric:tabular-nums` for all figures. **Primary color is teal `#14A497`, not blue.** Brand wordmark uses `#16375a` + `#17a493` (line 63–64).

---

## 1. Overall desktop layout

`.hf-app` (line 58): `width:100vw;height:100vh;background:#fff;overflow:hidden;display:flex`. Two direct flex children after two checkbox inputs + one RNB handle label:
- `<aside class="hf-side">` — 240px sidebar (lines 813–826)
- `<div class="hf-main">` — everything else (lines 827–883)

Plus, OUTSIDE `.hf-main` but inside/after `.hf-app`: the `.rnb` right rail (884–977), the `.up-scrim` auto-alert modal (978–987), and a `<dc-import name="Messenger">` FAB stub (988).

Top-to-bottom / left-to-right regions:
1. **Sidebar** `.hf-side` (240px, left) — shared shell, aligned separately.
2. **Topbar** `.hf-top` (62px min-height, top of main) — page title `수납관리·민원접수` + right-aligned `.rc-topacts` action toolbar.
3. **Body** `.hf-body` — a 2-column CSS grid `.rc-grid`:
   - **Left rail** `.rc-rail` (240–322px): building/unit list panel `.rc-bld` (top, flex-grow) + notes panel `.rc-note` (bottom, ~168px).
   - **Right column** `.rc-right`: `수납 이력` panel (flex-grow) + `입주자정보` panel + `A/S 현황` panel (320px fixed), stacked vertically.
4. **RNB rail** `.rnb` (404px, right edge, slides in/out) — "A/S 접수·퇴실 신청 현황" (shared, out of primary scope).
5. **Auto-alert modal** `.up-scrim` — auto-opens on load (see §9).
6. **Dynamic modals** — 7 built at runtime by JS (see §8).

---

## 2. Sidebar `.hf-side` (lines 813–826, CSS 59–74) — BRIEF (shared shell)

240px wide, `padding:18px 14px`, `border-right:1px solid var(--line)`.
- `.hf-brand` (60): logo `logo-mark.png` (34px) + wordmark `관리<span>비서</span>`.
- `.hf-nav` (66): nav items `.hf-item` (67, 14px/600, padding `10px 12px`, radius 11px). Active `.hf-item.on` = teal bg `#14A497` white text. **Active item on this screen = `수납관리·민원접수`** (line 815, first item, `class="hf-item on"`).
- Two collapsible groups `.hf-group` (공과금 관리, 이사정산).
- Full nav order: 수납관리·민원접수 / 건물·입주자 관리 / 공과금 관리▸(고객번호 조회·전기·수도·가스) / 관리비 부과 세팅 / 항목등록 관리 / 서류 발행·출력 / 미납 관리 / 이사정산▸(이사정산 입력·전체·전기·수도·가스 이사조회) / 협력업체 관리 / 장기수선비 관리 / 문자·알림톡 관리 / 공지 관리.
- Foot `.hf-profile` (816): avatar `김` + `김관리` / `마스터`; opens up-menu with 계정·직원 / 셋업 설정 / 로그아웃.

---

## 3. Topbar `.hf-top` (line 829, CSS 76–96) — **DEEP FOCUS on right actions**

`.hf-top`: `min-height:62px;padding:0 24px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line)`.

Contents left→right:
1. `<label class="lnb-btn">` hamburger (682: 36×36, radius 10, hover bg) — toggles sidebar via `#lnbToggle`.
2. `<div><div class="hf-h1">수납관리·민원접수</div></div>` — `.hf-h1` = 19px/800, letter-spacing −.02em.
3. `<div class="rc-topacts">` — the toolbar.

### 3.1 `.rc-topacts` toolbar (CSS 84–94)

`display:flex;align-items:center;gap:8px;flex:1 1 auto;justify-content:flex-end;flex-wrap:wrap;row-gap:6px`. First child gets `margin-left:auto` (84–86). All buttons are `.hf-btn` (591): `height:40px;padding:0 15px;radius:11px;font-size:13.5px;font-weight:700;gap:6px;white-space:nowrap`. `.hf-btn svg` = 16×16, stroke-width 2. Variants: `.sec` = white bg + `border:1px solid var(--line)` + `color:var(--t2)`; `.pri` = teal bg `#14A497` white + shadow.

**Button/dropdown order (exact, verbatim labels):**

| # | Element | Label (verbatim) | Style | Icon | id |
|---|---------|------------------|-------|------|----|
| 1 | button | `조회` | `.hf-btn sec` | none | `rcLookup` |
| 2 | button | `월별 부과금액` | `.hf-btn sec` | printer/tray svg (path `M7 8V4h10v4` + rect + `M7 16h10v4H7z`) | `rcAmtMonth` |
| 3 | dropdown `.rc-gdd#rcBldDd` | `빌라` + chevron | `.hf-btn sec` btn `#rcBldBtn` | chevron 15×15 | — |
| 4 | dropdown `.rc-gdd#rcUnitDd` | `호실` + chevron | `.hf-btn sec` btn `#rcUnitBtn` | chevron 15×15 | — |
| 5 | dropdown `.rc-gdd#rcGiroDd` | `자동수납` + chevron | **`.hf-btn pri`** btn `#rcGiroBtn` (`box-shadow:none` inline) | chevron 15×15 | — |

### 3.2 Dropdown menus (`.rc-gmenu`, CSS 87–94)

`.rc-gdd` = `position:relative`. `.rc-gmenu` = `position:fixed;min-width:172px;bg#fff;border 1px var(--line);radius:12px;shadow:0 14px 34px -10px rgba(23,31,40,.28);padding:6px;z-index:60` (shown only when `.rc-gdd.open`). Group title `.rc-gt` (91): `padding:7px 11px 3px;font-size:10.5px;font-weight:800;color:var(--t4);letter-spacing:.02em`. Item `.rc-gmenu a` (92): `display:block;padding:9px 11px;radius:8px;font-size:13px;font-weight:600;color:var(--t2)`; hover bg `var(--bg)` + `color var(--t1)`. Menus are positioned with fixed left/top by JS (`place()` at 3672–3675, 3133–3135).

**`빌라` menu (`#rcBldDd`, line 829, `data-b`):**
- `빌라 부과금액` (`data-b="amt"`) → `openAmtCheck('bldsum')`
- `빌라 미납내역` (`data-b="unpaid"`) → `openUnpaid()`
- `빌라 수납내역` (`data-b="paid"`) → `openPaid()`

**`호실` menu (`#rcUnitDd`, line 829, `data-u2`):**
- `호실 명세서` (`data-u2="stmt"`) → `openUnitStmt()`
- `영수증 출력` (`data-u2="receipt"`) → `openReceipt()`

**`자동수납` menu (`#rcGiroDd`, line 829, `data-g`):** — has two `.rc-gt` group titles
- Group `지로`:
  - `지로수납처리` (`data-g="pay"`) → `openGiro()`
  - `지로수납원장 보기` (`data-g="ledger"`) → `openGiro('ledger')`
  - `지로처리일자 확인` (`data-g="date"`) → `openGiro('date')`
- Group `은행 입금`:
  - `은행 입금내역 업로드` (`data-g="bank"`) → `openGiro('bank')`
  - `은행 양식 다운` (`data-g="bankForm"`) → `downBankForm()` (downloads `은행_입금내역_업로드양식.xlsx`)

**Gating (JS 3664–3690, 3140–3143):** clicking `빌라`/`호실`/`자동수납` buttons: `빌라` requires `selB` else toast `건물을 선택해 주세요`; `호실` requires `selU` else toast `호실을 선택해 주세요`. Menu items also re-check and toast `건물을 먼저 선택해 주세요` / `호실을 먼저 선택해 주세요`.

Related CSS: `.rc-gdd .hf-btn{gap:5px}` (88). `.rc-tdiv` (94) = 1px×20px divider (defined but not used in this toolbar).

---

## 4. Body `.hf-body` → `.rc-grid` (line 829→881, CSS 98, 339)

`.hf-body` (98): `flex:1;padding:18px 24px 22px;display:flex;flex-direction:column;gap:14px;overflow:hidden`.
`.rc-grid` (339): `flex:1;display:grid;grid-template-columns:minmax(240px,322px) minmax(0,1fr);gap:16px`. At ≤820px collapses to 1 column (364–366).

Shared panel primitives:
- `.hf-panel` (600): `bg#fff;border-radius:16px;box-shadow:0 1px 3px rgba(23,31,40,.05);overflow:hidden`.
- `.hf-panel-h` (601): `display:flex;align-items:center;gap:10px;padding:15px 18px;border-bottom:1px solid var(--line2)`.
- `.hf-panel-t` (602): `font-size:15px;font-weight:800`.
- `.hf-tbl` (603–608): full-width, border-collapse. `th` = `text-align:left;font-size:12px;font-weight:700;color:var(--t3);padding:11px 16px;border-bottom:1px solid var(--line);background:#FBFCFD;white-space:nowrap`. `td` = `padding:12px 16px;font-size:13.5px;border-bottom:1px solid var(--line2);white-space:nowrap`. Last row no border. Row hover `background:#FBFCFD;cursor:pointer`. `.rt` = right align. (Panel tables here override font-size to 12.5px inline.)
- `.uc-mini` (182–189): small button `height:26px;padding:0 10px;border 1px var(--line);radius:8px;font-size:11.5px;font-weight:700;color:var(--t2)`. `.pri` variant = teal. `.uc-x` = 26px square close, svg 14px.

### 4.1 LEFT RAIL `.rc-rail` (lines 834–855, CSS 343–347)

`.rc-rail` (343): `grid-column:1;display:flex;flex-direction:column;gap:16px;overflow:hidden`.

#### 4.1.1 Building/Unit list panel `.hf-panel.rc-bld` (835–847, CSS 368–382)

`.rc-bld` (368): `flex:1 1 0;min-height:0;display:flex;flex-direction:column;overflow:visible;position:relative;z-index:2`.

**Header** (836–842): `.hf-panel-h` with `flex-wrap:wrap;row-gap:8px;gap:8px`. Contains:
- `.rc-back#rcBack` (837, CSS 340–342, 376–377): 24×24 back button, `display:none` initially, shows in unit view. Icon `M15 6l-6 6 6 6`. Hover bg `#F2F4F6`.
- `.hf-panel-t#rcPanelT` (838): title, `white-space:nowrap`. Initial text **`전체 건물`**; becomes building name when a building is selected (JS `setView`, 1333).
- spacer `flex:1`.
- Search input `#rcSearch` (841): full-width row (`flex:0 0 100%`), `height:32px;border 1px var(--line);radius:9px;padding:0 11px 0 31px;font-size:13px;font-weight:600`, with a 15px magnifier svg absolutely positioned at left:11px. Placeholder `건물명·주소 검색` (bld view) / `호수·세대주 검색` (unit view, set by JS 1334).

**Body** `.rc-scroll#rcListWrap` (843–846, CSS 371, 382): scroll container, radius bottom corners 14px. Contains TWO stacked tables (only one visible at a time via `setView`):

**Table A — building list `#rcBldTbl`** (844): `table-layout:fixed;width:100%`. Columns:
| Header | Width |
|--------|-------|
| `코드` | 64px |
| `건물명` | 96px |
| `주소` | auto |

Rows rendered by `drawBld` (1185–1186): `<td class="num">코드</td><td font-weight:700>건물명</td><td>주소</td>`. Selected row `.on` → bg `var(--blue-t)` (542). Hover → `var(--blue-t2)` (541). Row `cursor:pointer` (540). First-col overflow visible; others ellipsis (379–381).

**Table B — unit list `#rcUnitTbl`** (845, `display:none` until building chosen): `table-layout:fixed`. Columns:
| Header | Width |
|--------|-------|
| `호수` | 64px |
| `세대주` | auto |

Rendered by `drawUnits` (1187–1190): `<td font-weight:700>호수</td><td>세대주 or 공실</td>`. Vacant (`nm` null) shows `공실` with `.dsh` class = `color:var(--t4);font-weight:400` (380). Empty states: no building → `건물을 선택해 주세요`; no search hits → `검색 결과가 없어요`.

Slide animations `rcInR`/`rcInL` (372–375) on view switch.

**Demo data** — `BLD` array (line 1153, 8 buildings, `[code, name, address]`):
`001 광원타운` / `002 해들빌` / `003 듄노아트빌` / `004 새한빌라C동` / `005 장훈아트빌라` / `006 솔향기` / `007 천사하우스` / `008 새봄하우스`.
`unitsOf(code)` (1181–1184) generates `4 + (code%5)` units, floor-based `호수` (101호…), some vacant, some overdue.

#### 4.1.2 Notes panel `.hf-panel.rc-note` (848–854, CSS 344–347, 348–356)

`.rc-note` (344): `flex:0 1 168px;min-height:90px;display:flex;flex-direction:column;overflow:hidden`.

**Tab strip** `.rc-ntab#rcNoteTab` (849, CSS 348–354): `display:flex;gap:16px;padding:0 16px;border-bottom:1px solid var(--line)`. Tabs `.rc-ntab a` (349): `padding:12px 0 10px;font-size:13.5px;font-weight:600;color:var(--t4)`. Active `.on` = teal + 2px teal underline (`::after`). Tabs:
- `수납 건물 메모` (`data-v="memo"`, active by default)
- `부과시 참조사항` (`data-v="ref"`)
- spacer `.sp` (flex:1)
- `수정` button `.uc-mini#rcNoteEdit`
- `저장` button `.uc-mini pri#rcNoteSave` (`display:none` until editing)

**Bodies** (852–853): two `<textarea class="mf-note rc-memo">` (`#rcBldMemo` shown, `#rcBldNote` hidden), `readonly` until edit. `.mf-note` (346): `padding:13px 16px 15px;font-size:13.5px;line-height:1.62;overflow:auto`. Placeholder `건물 단위 메모를 입력해 주세요`. Editable state (356): white bg + teal border + radius 10 + margin.

### 4.2 RIGHT COLUMN `.rc-right` (lines 856–880, CSS 345, 383–386)

`.rc-right` (383–384): `grid-column:2;display:flex;flex-direction:column;gap:12px;overflow:auto`.

#### 4.2.1 `수납 이력` panel `.hf-panel.rc-hist` (859–864, CSS 385, 543–584)

`.rc-hist` (385): `flex:1 1 auto;min-height:266px;display:flex;flex-direction:column;overflow:hidden`.

**Header** (860): `.hf-panel-h` with title `수납 이력` + spacer + action cluster:
- `추가` `.uc-mini#rcHistAdd`
- `수정` `.uc-mini#rcHistEdit`
- `저장` `.uc-mini pri#rcHistSave` (`display:none`)
- close `.uc-mini uc-x#rcHistCancel` (`display:none`, `title="취소"`)

**Empty state** `#rcHistEmpty` (861): centered, 54px teal-tinted icon box (card icon), heading `호수를 선택해 주세요` (15px/700), sub `선택한 세대의 월별 수납 이력이 / 여기에 표시돼요` (13px/400/`--t3`). **This is what renders on initial load** (selB/selU null).

**Foot** `#rcHistFoot .rc-hfoot` (862, CSS 543–548, `display:none` initially): stats + button — `미납` `<b#rcHfUnpaid>0`, `연체료` `<b#rcHfLate>0`, `미납합계` `<b#rcHfTotal>0`, then `문자 전송` `.uc-mini pri#rcHfSms` (disabled). `.rc-hfoot` = `padding:11px 14px;border-top:1px solid var(--line);background:#FBFCFD;font-size:12.5px`. `b` colored `var(--red)`.

**Table wrap** `#rcHistWrap` (863, `display:none` until unit selected, CSS 582): sticky header `#FBFCFD`. Table font 12.5px. Columns (exact order):
| # | Header | min-width | align |
|---|--------|-----------|-------|
| 1 | `처리` (`.rc-actth`) | 150px | — |
| 2 | `년 월` | 78px | — |
| 3 | `당월계` | 86px | rt |
| 4 | `연체` | 70px | rt |
| 5 | `수납액` | 86px | rt |
| 6 | `수료` | 56px | rt |
| 7 | `수납일자` | 92px | — |
| 8 | `은행` | 96px | — |
| 9 | `구분` | 60px | — |
| 10 | `비고` | 120px | — |
| 11 | `기한` | 80px | — |

Row states (567–584): unpaid rows `cursor:pointer` + red left inset bar (`box-shadow:inset 3px 0 0 var(--red)`, 583); selected `.sel` bg `var(--blue-t)`; checkbox `.lg-ck` 20px; `td.due` red text; `.rc-undo` small undo button; `.rc-ab`/`.as-sms` inline action chips (24px). The `처리` column shows editable controls in edit mode (`.hc-in`, `.hc-dd`, `.hc-dp` — CSS 554–560). `.rc-actth` hidden unless editing (JS 1393, 1439).

#### 4.2.2 `입주자정보` panel `.hf-panel.rc-tn` (865–875, CSS 387–413)

`.rc-tn` (388/397): `flex:0 0 auto;max-height:210px;display:flex;flex-direction:column;overflow:hidden`.

**Header** (866): title `입주자정보` + spacer + `수정` `.uc-mini#rcTnEdit` + `저장` `.uc-mini pri#rcTnSave`(hidden) + close `.uc-mini uc-x#rcTnCancel`(hidden).

**Table** `.rc-tn-wrap` (867–874, CSS 389–391): sticky header. Single data row `#rcTnBody`. Columns:
| Header | min-width |
|--------|-----------|
| `입주자명` | 80px |
| `입금자명` | 80px |
| `전화번호` | 118px |
| `입주일` | 92px |
| `퇴거일` | 92px |
| `적요` | 180px |
| `문자` | 60px |
| `알림톡` | 66px |
| `부과` | 48px |
| `출력` | 48px |

Cells use inline inputs `.tc-in` (394: 26px, radius 7), dropdowns `.tc-dd` (396), date-pickers `.tc-dp` (400–405) when in edit mode. `문자`/`알림톡` columns use Y/N or 동의/비동의 dropdowns (`TN_SMS`/`TN_YN`, 1191). Readonly cells greyed (407). Saving a newly-filled vacant unit triggers the "이번달 관리비 부과" confirm modal (§8.1, JS 1273–1290).

#### 4.2.3 `A/S 현황` panel `.hf-panel.rc-as` (876–879, CSS 386, 290–299, 414–527)

`.rc-as` (386): `flex:0 0 320px;height:320px;min/max-height:320px;display:flex;flex-direction:column;overflow:hidden`.

**Header** `.hf-panel-h.as-head` (877, CSS 290–296): `padding-left/right:12px;gap:6px`. Contains:
- title `A/S 현황`
- scope segmented `.adj-seg2#rcAsScope` (CSS 297–299): pill toggle, `호실` (active) / `건물 전체`. `.adj-seg2` = `bg#EDF0F3;radius:9px;padding:3px`. Active `a.on` = white.
- result-filter dropdown `.uc-dd.as-resdd#rcAsRes` (CSS 294–296): options `전체`(on)/`미결`/`보류`/`완결`/`반복`, each with a check svg.
- spacer
- `접수 추가` `.uc-mini#rcAsAdd` with plus icon.

**Table** `.rc-as-wrap` (878, CSS 414–421): sticky header. Row height 38px, rows clickable (`tr[data-as]`), memo cell wraps. Columns:
| # | Header | width | align |
|---|--------|-------|-------|
| 1 | `No` | 38px | rt |
| — | `호수` (`.as-noth`, `display:none`) | 58px | — |
| 2 | `접수일시` | 86px | — |
| 3 | `유형` | 80px | — |
| 4 | `접수내용` | 240–300px | — |
| 5 | `입주자 전화번호` | 112px | — |
| 6 | `처리결과` | 70px | — |
| 7 | `처리결과 내용` | 200–260px | — |
| 8 | `시행일자` | 86px | — |
| 9 | `시간` | 52px | — |
| 10 | `접수자` | 66px | — |
| 11 | `담당자` | 66px | — |

`호수` column revealed only when scope = `건물 전체`. Status badge `.rc-as-st` (519–527): `미결/보류/완결/반복` → red/amber/green/blue tint variants (`.st-open`/`.st-bor`/`.st-done`/`.st-rep`). Empty state (JS 1569): `건물과 호수를 선택해 주세요`. Row click → opens A/S detail modal (§8.2).

---

## 5. RNB right rail `.rnb` (lines 884–977, CSS 688–698) — ADJACENT (shared, brief)

Fixed 404px panel on right edge, `z-index:70`, slides via `.rnb-off` transform (default OFF/hidden; toggled by `#rnbToggle` + `.rnb-handle` label at line 812). Title `A/S 접수·퇴실 신청 현황` + refresh icon. Two tabs `.rnb-tabs`: `A/S 접수`(on) / `퇴실 신청`.
- **A/S tab** — a filter bar `.asf-bar` (7 `.dd` dropdowns: building / result-multi / manager / receiver / type / sort) then `#asList` of `.rnb-card` items (demo #128…#119). Building dropdown demo list includes 그린빌라/한빛상가/푸른아파트/대전유성테크노밸리센트럴/미래스퀘어/정든빌라/한빛레지던스/새봄하우스.
- **퇴실 tab** — `#mvList` of `.mv-card` items (R-2026-xxx) each with `처리 완료` button. Move-out confirm dialog `.mvq-scrim` built in JS (1019–1035): title `퇴실 신청을 처리 완료할까요?`, buttons `취소`/`처리 완료`. Persists to `localStorage['erp_moveout_done']`.

> This rail is a cross-screen shared component. It renders but is default-hidden (`off=true`, JS 1058). Not part of the receipts-specific porting depth, but present in the DOM.

---

## 6. Key screen-specific CSS classes (full values)

Cited by line. All under the `<style>` block (6–810).

```css
/* 58 */  .hf-app{width:100vw;height:100vh;background:#fff;overflow:hidden;display:flex}
/* 76 */  .hf-top{min-height:62px;flex:none;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;padding:0 24px}
/* 84 */  .rc-topacts{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0;flex-wrap:wrap;justify-content:flex-end;row-gap:6px}
/* 85 */  .rc-topacts>:first-child{margin-left:auto}
/* 87 */  .rc-gdd{position:relative;flex:none}
/* 89 */  .rc-gmenu{position:fixed;min-width:172px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 34px -10px rgba(23,31,40,.28);padding:6px;display:none;z-index:60}
/* 90 */  .rc-gdd.open .rc-gmenu{display:block}
/* 91 */  .rc-gt{padding:7px 11px 3px;font-size:10.5px;font-weight:800;color:var(--t4);letter-spacing:.02em}
/* 92 */  .rc-gmenu a{display:block;padding:9px 11px;border-radius:8px;font-size:13px;font-weight:600;color:var(--t2);cursor:pointer;white-space:nowrap}
/* 98 */  .hf-body{flex:1;min-height:0;padding:18px 24px 22px;display:flex;flex-direction:column;gap:14px;overflow:hidden}
/* 339 */ .rc-grid{flex:1;min-height:0;display:grid;grid-template-columns:minmax(240px,322px) minmax(0,1fr);gap:16px}
/* 343 */ .rc-rail{grid-column:1;min-width:0;min-height:0;display:flex;flex-direction:column;gap:16px;overflow:hidden}
/* 344 */ .rc-note{flex:0 1 168px;min-height:90px;min-width:0;display:flex;flex-direction:column;overflow:hidden}
/* 345 */ .rc-right{grid-column:2}
/* 348 */ .rc-ntab{display:flex;gap:16px;padding:0 16px;border-bottom:1px solid var(--line);flex:none}
/* 368 */ .hf-panel.rc-bld{flex:1 1 0;min-height:0;display:flex;flex-direction:column;overflow:visible;position:relative;z-index:2}
/* 383 */ .rc-right{min-width:0;min-height:0;display:flex;flex-direction:column;gap:12px}
/* 385 */ .rc-right>.hf-panel.rc-hist{flex:1 1 auto;min-height:266px;display:flex;flex-direction:column;overflow:hidden}
/* 386 */ .rc-as{flex:0 0 320px;height:320px;min-height:320px;max-height:320px}
/* 397 */ .rc-tn{flex:0 0 auto;max-height:210px}
/* 528 */ .rc-headbar{...border-radius:14px;padding:10px 14px;flex-wrap:wrap}   /* used inside print/other; not in main body */
/* 543 */ .rc-hfoot{order:2;flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;row-gap:8px;padding:11px 14px;border-top:1px solid var(--line);background:#FBFCFD}
/* 591 */ .hf-btn{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 15px;border-radius:11px;font-size:13.5px;font-weight:700;cursor:pointer;border:1px solid transparent;white-space:nowrap}
/* 593 */ .hf-btn.pri{background:var(--blue);color:#fff;box-shadow:0 6px 14px -4px rgba(20,164,151,.5)}
/* 594 */ .hf-btn.sec{background:#fff;color:var(--t2);border-color:var(--line)}
/* 600 */ .hf-panel{background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(23,31,40,.05);overflow:hidden}
/* 601 */ .hf-panel-h{display:flex;align-items:center;gap:10px;padding:15px 18px;border-bottom:1px solid var(--line2)}
/* 602 */ .hf-panel-t{font-size:15px;font-weight:800}
/* 604 */ .hf-tbl th{text-align:left;font-size:12px;font-weight:700;color:var(--t3);padding:11px 16px;border-bottom:1px solid var(--line);background:#FBFCFD;white-space:nowrap}
/* 605 */ .hf-tbl td{padding:12px 16px;font-size:13.5px;border-bottom:1px solid var(--line2);white-space:nowrap}
/* 182 */ .uc-mini{height:26px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:11.5px;font-weight:700;color:var(--t2);cursor:pointer}
/* 186 */ .uc-mini.pri{background:var(--blue);border-color:var(--blue);color:#fff}
/* 297 */ .adj-seg2{display:inline-flex;background:#EDF0F3;border-radius:9px;padding:3px;gap:2px;flex:none}
/* 298 */ .adj-seg2 a{padding:5px 11px;border-radius:7px;font-size:12px;font-weight:700;color:var(--t3);cursor:pointer;white-space:nowrap}
/* 299 */ .adj-seg2 a.on{background:#fff;color:var(--t1)}
/* 523 */ .rc-as-st{display:inline-flex;align-items:center;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700}
```

Modal primitives:
```css
/* 116 */ .fmpc-scrim{position:absolute;inset:0;background:rgba(23,31,40,.45);display:flex;align-items:center;justify-content:center;z-index:120}
/* 117 */ .fmpc{background:#fff;border-radius:20px;padding:24px 26px 22px;box-shadow:0 30px 70px -20px rgba(0,0,0,.4);max-height:88vh;overflow:auto}
/* 120 */ .fmpc-btn{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;padding:0 18px;border:1px solid var(--line);border-radius:11px;background:#fff;color:var(--t2);font-size:13.5px;font-weight:700;cursor:pointer}
/* 121 */ .fmpc-btn.pri{background:var(--blue);border-color:var(--blue);color:#fff}
/* 126 */ .fmpc-scrim.show{display:flex}
/* 176 */ .lg-scrim{position:fixed;inset:0;background:rgba(23,31,40,.45);display:flex;align-items:center;justify-content:center;z-index:300;padding:24px}
/* 177 */ .lg-modal{background:#fff;border-radius:20px;width:min(1020px,96%);height:min(660px,92%);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 70px -20px rgba(0,0,0,.4)}
/* 178 */ .lg-h{flex:none;display:flex;align-items:center;gap:10px;padding:17px 20px;border-bottom:1px solid var(--line)}
/* 179 */ .lg-t{font-size:16px;font-weight:800;letter-spacing:-.02em}
/* 201 */ .lg-print{...height:40px;padding:0 18px;border:none;border-radius:11px;background:var(--blue);color:#fff;font-size:13.5px;font-weight:700}
/* 629 */ .up-scrim{position:fixed;inset:0;background:rgba(23,31,40,.45);display:none;align-items:center;justify-content:center;z-index:600;padding:24px}
/* 631 */ .up-modal{background:#fff;border-radius:20px;width:min(440px,92%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;overflow:hidden}
```

---

## 7. Initial render / boot (JS `componentDidMount` 991, `boot` 1127, final line 3831)

- `componentDidMount` wires RNB tabs, filter dropdowns, RNB toggle (default OFF), then `setTimeout(40ms)` calls `window.__asApply()`, `this.boot()`, `this.upAlerts()` (line 1100).
- **`selB` and `selU` start null** (declared/reset in boot). Therefore on first paint:
  - Rail shows building list (`전체 건물`, Table A) — `setView('bld')` (3831).
  - `수납 이력` shows empty state `호수를 선택해 주세요` (`#rcHistEmpty`).
  - `입주자정보` table body empty.
  - `A/S 현황` shows `건물과 호수를 선택해 주세요` (1569).
  - Notes panel shows empty memo textarea.
- `boot` end (3831): `syncListBtns(); drawBld(); drawUnits(); setView('bld'); drawHist(); drawTenant(); drawAs(); syncNote();`.
- Selecting a building (row click 1315–1320): sets `selB`, `selU=null`, switches to unit view. Selecting a unit (1321–1324): sets `selU`, redraws hist/tenant/AS.

---

## 8. Dynamic modals (built by JS at runtime)

All appended to `.hf-app` or `document.body`. **`.fmpc`** modals use `.fmpc-scrim`; **`.lg-modal`** report modals use `.lg-scrim`. Dismiss = backdrop click, an `X` (`.uc-x`), a footer close button, and/or `Escape`.

### 8.1 "이번달 관리비 부과" confirm — `.fmpc` (JS 1280–1290)
- **Trigger:** saving `입주자정보` for a vacant unit that is newly filled AND the building's current month is already confirmed / has history.
- Width `min(420px,92%)`. Teal 34px icon (₩-ish path). Title **`이번달 관리비 부과를 하시겠습니까?`**. Body: `{building} {unit} · {Y}년 {M}월분 부과가 이미 확정된 건물입니다.` + `부과하면 입주일 기준으로 일할 계산되어 반영됩니다.`
- Footer: `다음달부터` (`.fmpc-btn`, `data-c="n"`) / `이번 달 부과` (`.fmpc-btn pri`, `data-c="y"`). Toasts accordingly.

### 8.2 A/S 접수 상세 / 추가 — `.fmpc` (JS 1616–1645+)
- **Trigger:** `접수 추가` (`#rcAsAdd`) → add mode; clicking an A/S row → detail mode.
- Width `min(680px,94%)`. Header title `A/S 접수 추가` or `A/S 접수 상세` + `.uc-x` close.
- Body `.as-grid` (494, 3-col grid). Fields (CSS 495–518, `as-req` red `*`):
  `건물`* (dd) / `호수`* (dd) / `접수자` (readonly input) / `담당자` (dd) / `접수일시`* (date `.as-dp`) / `유형`* (dd) / `입주자 전화번호` (input) / `접수내용`* (full-width textarea `.as-ta`) / `처리결과` (dd) / `시행일자`* (date) / `시간` (input, placeholder `00:00`) / `처리결과 내용` (full-width textarea).
- Footer: `삭제` (red, detail only, `data-x="del"`) · spacer · `확인문자 보내기` (detail only, `data-x="sms"`) · `저장`/`추가` (`.lg-print`, `data-x="ok"`).

### 8.3 A/S 문자 전송 — `.fmpc` (JS 1743–1764)
- **Trigger:** `확인문자 보내기` in A/S detail modal (opens `openAsSms(row)`).
- Width `min(480px,94%)`. Title `문자 전송` + subtitle `No.{no} · {memo}`. Fields: `수신번호` (input, prefilled tel), `템플릿` (segmented `.adj-seg2` — templates `접수 확인`/`처리 완료` from `AS_TPL` 1735), `내용` (120px textarea, filled from template). Footer `취소`/`전송` (`.fmpc-btn`/`.fmpc-btn pri`, `data-m="c"`/`data-m="s"`).

### 8.4 자동수납 / 지로 / 은행 — `.fmpc.gr` (JS `openGiro(mode)` 2826–3128)
- **Trigger:** `자동수납` dropdown items. `mode` ∈ `pay|ledger|date|bank|bankLedger`. Title map (2830): `지로수납처리`/`지로수납원장`/`지로처리일자 확인`/`은행 입금내역 업로드`/`은행수납원장`.
- Width `min(1080px,96%)`, `.fmpc.gr` (422) = flex column, `max-height:90vh`. Header title + subtitle (per mode) + `.uc-x`.
- **pay/bank modes:** dropzone `.gr-drop#grDrop` (483–492) with file input (`.txt` for pay, `.xlsx,.xls,.csv` for bank), text `파일을 끌어다 놓거나 클릭해 선택`; results table hidden until file; footer `처리` primary button (disabled until rows).
- **ledger/bankLedger modes:** date-range bar `.gr-bar` (467–482) `조회일 [from]~[to]` + `에러` segmented `전체/정상/이중수납` (`#grErr`); results table `.gr-wrap`/`.gr-tbl` (423–429).
- **date mode:** `.gd-bar` month nav + `.gd-body` (432) = calendar `.gd-cal` + bar chart `.gd-chart` (`수납일자별 그래프`).
- Table columns vary by mode (2849–2861). Examples:
  - `ledger`: `No / 지로일자 / 수납일 / 코드 / 건물명 / 호수 / 년월 / 수납액 / 수수료 / 실입금액 / 부과금액 / 에러 / 고객번호 / 수납구분 / 장표`
  - `bank`: `No / 지로입금일 / 수납일 / 구분 / 동 / 빌라명 / 호 / 년 / 월 / 수납액 / 에러체크`
  - `date`: `처리일자 / 건수 / 수납액 합계`
  - default(pay preview): `NO / 지로입금일 / 수납일 / 구분 / 동 / 빌라명 / 호 / 년 / 월 / 수납액 / 에러체크 / 수수료 / 이중수납일 / 연체 / 연체료`
- Foot `.gr-foot#grFoot`: `수납액 합계 {sum}원` · `처리 대상 {n}건` + `처리` or `닫기`.
- **Nested confirm** (3114–3125): pressing `처리` builds a second `.fmpc` (`z-index:400`, width `min(400px,92%)`): teal check icon, title **`지로 수납을 반영하시겠습니까?`**, body `처리 대상 {n}건 · 수납액 {sum}원` + `반영하면 해당 세대의 수납 이력에 기록됩니다.`, buttons `취소`/`반영`. Toast `{n}건을 수납 반영했어요`.

### 8.5 조회 (통합 검색) — `.fmpc.lk` (JS `#rcLookup` handler 3706–3826)
- **Trigger:** `조회` button (`#rcLookup`). No selection required.
- Width `min(1180px,96%)`, `.fmpc.lk` (163) = flex column, `height:92vh`, `padding:18px 20px 14px`.
- Header `.lk-title`: `조회 구간` + two date pickers (`#lkFrom`~`#lkTo`) + spacer + `.uc-x` close.
- Scroll body `.lk-scroll` holds **two `.lk-track` cards**, each a `.lk-grid` (304, 2-col) of two `.lk-pan` (305) tables:
  - **Track 1 `금액으로 찾기`** (`.lk-tt`): search input `금액` + `조회` button. Panels:
    - `청구금액 조회` — cols: `코드 / 빌라명칭 / 호 / 세입자명 / 년월 / 당월계 / 납기내금액 / 납기후금액 / 수납일자`
    - `이사정산 금액조회` — cols: `코드 / 빌라명칭 / 호수 / 년월 / 일 / 금액 / 수납일`
  - **Track 2 `입금자명 · 전화번호 · 동호로 찾기`**: three inputs (`입금자명 (세입자 · 건물주)`, `전화번호`, `동호 (코드 또는 호수)`) each with `조회`. Panels:
    - `세입자 조회` — cols: `이름 / 입금자 / 코드 / 빌라명 / 호수 / 핸드폰 / 년월 / 납기내금액 / 수납일자`
    - `건물주 조회` — cols: `코드 / 동명칭 / 주소 / 거래처명 / 구분 / 건물주명 / 연락처`
- Panel header `.lk-ph` (306): `#FBFCFD` bg, 12.5px/800, with `{n}건` counter. Empty rows show `조회 버튼을 눌러 주세요` / `검색 조건을 입력해 주세요` / `조회 결과가 없어요` (`.lk-empty` 311).
- Foot `.lk-foot`: `닫기` (`.hf-btn sec`, `data-l="c"`).

### 8.6 월별 부과금액 / 빌라 부과금액 — `.lg-modal` (JS `openAmtCheck(mode)` 2403–2440+)
- **Trigger:** `월별 부과금액` toolbar button → `openAmtCheck('month')`; `빌라 부과금액` menu item → `openAmtCheck('bldsum')` (requires `selB`).
- Width `min(1240px,97%)`, height `min(720px,93%)`. Title `월별 부과금액` (month) or `빌라 부과금액` (bldsum).
- Filter bar `.auto-bar.ac-bar` (245): (month only) `건물 유형` dd (빌라/빌딩/오피스텔/상가) + `그룹` dd (전체/1–5); both modes: `기준월 [mp]~[mp]` (month-pickers `.mp` 224–236) + `수납일 [시작일]~[종료일]` (date `.ac-dp` 237–241) + `검색` primary button (`#acGo`).
- KPI head `.ac-head` (246–255): centered title `[ 월별 총 부과금액 및 수납자료 ]` or `[ {building} 부과금액 및 수납자료 ]`; `.ac-kpi` strip: `총당월수납액` / `총연체료` / `총수수료` / `총수납액` (ids acK1–4).
- Table `.ac-tbl` (256–271): dynamically-built `<thead#acHead>`/`<tbody#acBody>`/`<tfoot#acFoot>` (fee-item columns per building type). Sticky header `#F7F9FA`; sticky footer total row `.ac-tot`.
- Foot `.lg-f`: `인쇄` (`.lg-print`, `data-a="p"`).

### 8.7 빌라 미납내역 — `.lg-modal` (JS `openUnpaid` 1811–1859+)
- **Trigger:** `빌라 미납내역` menu item (requires `selB`).
- Width `min(1180px,96%)`, height `min(700px,92%)`. Title `빌라 미납내역`.
- Bar `.auto-bar`: year dd + month dd + `까지` + `연체` count dd (00–36) + `.adj-seg2#upScope` `전체`/`당계`.
- Table `.up-tbl` (221–223, 274–289): cols `동호 / 거래처명 / 년월 / 연체 / 미납액 / 납.연체료 / 납.후연체 / 연체료계 / 합계 / 비고 / 전화 / 이름`. Subtotal rows `.up-sub` (`[호합]`). Hover row → `var(--blue-t2)`.
- Foot: `.up-sum#upSum` summary + `인쇄` (`.lg-print`, `data-u="p"`).

### 8.8 빌라 수납내역 — `.lg-modal` (JS `openPaid` 2118–2162+)
- **Trigger:** `빌라 수납내역` menu item (requires `selB`).
- Width `min(1120px,96%)`, height `min(700px,92%)`. Title `빌라 수납내역`.
- Bar `.auto-bar`: from year/month dd + `~` + to year/month dd + `.adj-seg2#pdScope` `전체`/`수납`.
- Table `.up-tbl`: cols `호수 / 년월 / 당월계 / 수납액 / 수납일자 / 은행 / chk / C / 비고`. Sticky footer total `#pdFoot` (272–273, `.pd-tot`).
- Foot: `인쇄` (`.lg-print`, `data-p="p"`).

### 8.9 호실 명세서 — print sheet (JS `openUnitStmt` 3351–…)
- **Trigger:** `호실 명세서` menu item (requires `selU`). Builds an A4 print sheet (`#rcPrintSheet`) with a management-fee statement; 7 fee-item column groups (COLS, 3360–3361) matching the paper form. Uses year/month/kind/discount filters. Renders to `@media print` and calls `window.print()`.

### 8.10 영수증 출력 — print sheet (JS `openReceipt` 3302–3349)
- **Trigger:** `영수증 출력` menu item (requires `selU`). Builds `#rcPrintSheet` receipt (`영 수 증` title, building/호실/세대주 table, then rows `년월 / 당월계 / 연체료 / 수납액 / 수납일자 / 은행` + `합계` row + issuer `(주)스마일종합관리`). A4 portrait, 16mm margin. `window.print()`. Toasts `수납 내역이 없어요` if none.

---

## 9. AUTO-OPEN ON LOAD — `.up-scrim` alert modal (CRITICAL for screenshot diffs)

**DOM:** lines 978–987 (static, `#upScrim`, `style="display:none"`).
**Driver:** `upAlerts()` (JS 1102–1126), called ~40ms after mount (line 1100).

```
#upScrim  (.up-scrim, z-index:600, dim rgba(23,31,40,.45))
  .up-modal (width min(440px,92%))
    .up-h  → <div class="t" id="upT">오늘 입주 예정 세대</div> + .up-x close (X)
    .up-b  → .up-sub ( <div id="upCount"> + <a href="../setup/setup.dc.html#alarm">알림 설정 ›</a> )
             .up-list#upList (rows injected)
    .up-f  → #upSkip "오늘 그만보기" (grey) + #upClose "닫기" (teal)
```

**Behavior (1108–1125):** a `QUEUE` of **two** alerts is shown sequentially:
1. `t:'오늘 입주 예정 세대'`, `c:'입주예정일이 오늘인 세대가 2건 있어요.'`, rows: `그린빌라 302 · 정민수` (입주예정 {today}), `햇살하이츠 1104 · 오세라` (입주예정 {today}).
2. `t:'임대 만료 예정 세대'`, `c:'임대 계약 만료가 다가온 세대가 2건 있어요.'`, rows: `그린빌라 201 · 박정호` (만료예정 2026.08.31 · D-25, badge `만료 임박`), `중앙타워 505 · 이수민` (만료예정 2026.09.05 · D-30, badge `만료 임박`).

Each row: `.up-row` (642–644) `<div><b>{n}</b><i>{s}</i></div>` + optional `<span class="badge b-amber">{b}</span>`.

**Auto-show gate:** `render()` runs only if `localStorage['erp_upcoming'] !== todayISO` (line 1125). So **the first alert dims the whole screen on every fresh load** (clean localStorage).

**Dismissal:**
- `닫기` (`#upClose`) → `next()` → advances to alert #2, then hides after the last.
- `X` (`#upX`) → `upHide()` immediately (closes all, does NOT set skip).
- `오늘 그만보기` (`#upSkip`) → writes `localStorage['erp_upcoming']=todayISO` then hides (suppresses for the rest of the day).

**→ Screenshot-diff guidance:** to capture the clean receipts screen, set `localStorage.setItem('erp_upcoming', <YYYY-MM-DD today>)` before load (or click `오늘 그만보기` / the `X`). Otherwise the teal-dimmed `오늘 입주 예정 세대` modal will overlay the page and pollute the diff. Note there is also `localStorage['erp_moveout_done']` used by the RNB move-out tab (not a blocking overlay).

---

## 10. Region → line-range index

| Region | dc.html lines | Description |
|--------|---------------|-------------|
| `<style>` block (all CSS) | 6–810 | tokens + every class |
| `.hf-app` open + toggles + RNB handle | 812 | root flex; `#lnbToggle`, `#rnbToggle`, `.rnb-handle` |
| Sidebar `.hf-side` | 813–826 | shared 240px nav (active=수납관리·민원접수) |
| `.hf-main` open | 827 | main column |
| Topbar `.hf-top` + `.rc-topacts` | 829 | title + 5 toolbar actions (single long line) |
| `.hf-body` open + `.rc-grid` | 829→833 | 2-col grid |
| Left rail `.rc-rail` | 834–855 | building/unit list + notes |
| — `.rc-bld` panel | 835–847 | list panel (Table A bld / Table B unit) |
| — `.rc-note` panel | 848–854 | memo tabs |
| Right column `.rc-right` | 856–880 | history + tenant + A/S |
| — `수납 이력` `.rc-hist` | 859–864 | empty state + foot + 11-col table |
| — `입주자정보` `.rc-tn` | 865–875 | 10-col single-row table |
| — `A/S 현황` `.rc-as` | 876–879 | scope seg + filter dd + 11/12-col table |
| `.hf-body`/`.hf-main`/`.hf-app` close | 881–883 | |
| RNB rail `.rnb` | 884–977 | shared A/S·퇴실 rail (default hidden) |
| Auto-alert `#upScrim` (static DOM) | 978–987 | move-in / lease-expiry alert modal |
| Messenger FAB stub | 988 | `<dc-import name="Messenger">` |
| JS `componentDidMount` | 989–1101 | RNB/filter wiring; schedules boot+upAlerts |
| JS `upAlerts()` | 1102–1126 | **auto-open alert queue** |
| JS `boot()` | 1127–3832 | all data, draw fns, modals |
| — `printHTML` | 1128–~1160 | print helper |
| — `BLD` data | 1153 | 8 demo buildings |
| — `unitsOf` | 1181–1184 | demo unit generator |
| — `drawBld`/`drawUnits` | 1185–1190 | rail tables |
| — tenant edit + `askChargeNow` modal | 1259–1334 | §8.1 confirm |
| — `setView` | 1325–1334 | bld/unit view switch |
| — `drawHist` | 1371–~1534 | history table + empty/foot |
| — `drawAs` | 1535–~1610 | A/S table |
| — A/S detail/add modal | 1616–~1730 | §8.2 |
| — `openAsSms` modal | 1737–1810 | §8.3 |
| — `openUnpaid` modal | 1811–~2117 | §8.7 |
| — `openPaid` modal | 2118–~2402 | §8.8 |
| — `openAmtCheck` modal | 2403–~2800 | §8.6 |
| — `downBankForm` | 2803–2825 | xlsx download |
| — `openGiro` modal (+ nested confirm) | 2826–3129 | §8.4 |
| — bld/unit dropdown wiring | 3130–3146 | menu open/route |
| — `openReceipt` print | 3302–3349 | §8.10 |
| — `openUnitStmt` print | 3351–~3500 | §8.9 |
| — toolbar/dropdown delegates + `#rcLookup` modal | 3657–3826 | §8.5 + action routing |
| — boot final render | 3831 | initial `setView('bld')` etc. |

---

## 11. Porting cautions

- **Primary color is teal `#14A497`** everywhere (buttons `.pri`, active nav, badges, focus rings `box-shadow:0 0 0 3px var(--blue-t)`). Do not substitute the app-wide blue on this screen — the token IS teal here.
- **Toolbar wraps** (`flex-wrap:wrap;row-gap:6px`) — at narrow widths the 5 actions wrap to a second line; first action keeps `margin-left:auto`.
- Dropdown menus (`.rc-gmenu`) are `position:fixed` and JS-placed under the button — they are NOT normal-flow. Reproduce the fixed-position placement or they'll mis-anchor.
- The three panels in `.rc-right` have hard flex constraints: history grows (`min-height:266px`), tenant is capped (`max-height:210px`), A/S is locked (`height:320px`). Preserve these or the column overflows.
- On first load nothing is selected — the correct baseline is: building list + three empty right-panels + empty memo. Only the auto-alert modal overlays it.
- Report modals split into TWO scrim systems: light `.fmpc-scrim`/`.fmpc` (small confirms, A/S, giro, lookup) vs heavy `.lg-scrim`/`.lg-modal` (부과금액/미납/수납 big report grids). Different z-index (120 vs 300) and sizing.
- `.rc-headbar`, `.rc-kpi`, `.us-tbl`, `.rr-tbl`, `.ac-*`, `.gw-*`, `.gd-*` classes exist for modal/print internals, not the main body — don't wire them into the page shell.
