# 입주자카드·부과내역 출력 모달 — 다중 선택·미리보기 정본 정합 (1단계)

- 작성일: 2026-09-23
- 화면: `/staff/buildings` → [입주자카드 및 부과내역 출력] 모달 (`TenantOutputModal`)
- 정본: `building-list.dc.html` `#printModal` (staging `staff/building-list/building-list.dc.html`, git `e26d4b4b`에 동일본)
- 출력물 정본: 사용자 제공 PDF 3종(둘다 인쇄 13쪽·카드만 인쇄 7쪽·내역서만 인쇄 6쪽, 2곳 선택 상태)

## 1. 목표와 범위

모달을 정본처럼 **여러 건물을 골라 한 번에 미리 보고 인쇄**하는 화면으로 바꾼다. 1단계는 모달 UI·다중 선택·미리보기 틀·인쇄 순서다. 종이 안의 문서(입주자카드·부과내역서 양식)는 2단계에서 PDF 양식으로 교체한다(§8).

| 구분 | 1단계(이 문서) | 2단계(별도 스펙) |
|---|---|---|
| 건물 목록 | 체크박스 다중 선택·건물 전체·N곳 선택 | — |
| 미리보기 | 문서 카드 틀(헤더·건물 줄·페이지 줄·종이), 건물을 이어 붙인 페이지 | — |
| 종이 안 문서 | 현재 앱 문서(세대별 입주자카드·부과내역서) 그대로 | PDF 양식으로 교체 + 필드 데이터 매핑 |
| 인쇄 | 선택한 건물 전부, 정본 순서 | 인쇄 CSS를 양식에 맞춤 |

## 2. 결정 사항 (사용자 확인 완료)

1. **다중 선택은 실제로 동작한다.** 선택한 건물의 페이지가 목록 순서대로 이어지고, "총 N장"은 합계, 건물 줄은 현재 페이지의 건물이다.
2. **모달은 빈 선택으로 열린다**(정본 `openModal`이 선택을 비운다). 본화면 선택 건물을 초기값으로 넘기던 `initialBuildingId`는 제거한다.
3. **데이터는 방식 A**: 선택한 건물마다 기존 쿼리 3개(입주자카드 인쇄 데이터·부과 대상·부과 문서)를 `useQueries`로 병렬 조회한다. 기존 query key·API 함수를 그대로 써서 캐시를 공유한다(선례: `hooks/reactquery/bill/useAdjustmentStatements.ts`). 백엔드 변경 없음.
4. **2단계 분리**: 양식은 필드 매핑을 확정한 뒤 교체한다.

## 3. 선택 모델

- 상태: 선택한 건물 id 집합. 표시·조회·인쇄 순서는 항상 **건물 목록 순서**다(정본 `selBlds()` = `blds.filter(selMap)`). 클릭 순서가 아니다.
- 건물 항목 클릭 = 토글.
- **건물 전체** 클릭 = 목록 전체가 이미 선택돼 있으면 모두 해제, 아니면 전체 선택. 검색으로 좁힌 목록이 아니라 **전체 목록**이 대상이다(정본 `blds.forEach`).
- 검색은 목록 표시만 거른다. 선택은 유지된다.
- 선택이 바뀌면 두 미리보기의 현재 페이지를 1쪽으로 되돌린다(정본 `syncSel`의 `pg={card:1,stmt:1}`). 연·월이 바뀌면 페이지를 유지하되 범위를 넘으면 마지막 쪽으로 당긴다(정본 `renderDocs`의 clamp).

## 4. UI (정본 값)

### 4.1 좌측 목록 `.pm-left`

| 요소 | 정본 규칙 |
|---|---|
| 목록 `.pm-list` | `padding:8px; gap:2px` |
| 항목 `.pm-item` | `padding:12px 14px; border-radius:12px; border:1px solid transparent; transition:.1s` · hover `#fff`+`--line` 테두리 · 선택 `--blue-t` 배경+`--blue` 테두리 (이미 적용됨) |
| 윗줄 `.pm-item-top` | `display:flex; align-items:center; gap:8px` → [체크박스][코드칩][건물명] |
| 체크박스 `.pm-ck` | 17×17, `border-radius:5px; border:1.6px solid var(--line); background:#fff` · 선택 시 `--blue` 배경·테두리 + 흰 체크(4×8, `border-width:0 2px 2px 0`, 45° 회전, left 5px·top 1.5px) |
| 주소 `.pm-addr` | `margin-left:26px; margin-top:5px; font-size:12px; font-weight:600; color:var(--t3); line-height:1.4` |
| **건물 전체** `.pm-all` | 검색창과 목록 사이(스크롤 밖). `display:flex; align-items:center; gap:9px; padding:9px 14px; margin-bottom:4px; border-bottom:1px solid var(--line2)` · [체크박스][`b` "건물 전체" 13.5px/700 `--t2`, 전체 선택·hover 시 `--t1`][`i` 우측 "N곳 선택" 12px/700 `--t3` tabular-nums, 0곳이면 빈칸] · 전체 선택이면 체크 |
| 검색 결과 없음 | "검색 결과가 없어요" — `padding:28px 14px; 가운데; --t3; 13px/600` |

### 4.2 우측 미리보기 `.pm-right`

| 요소 | 정본 규칙 |
|---|---|
| 선택 없음 `.pm-empty` | 세로 가운데 `gap:6px`, 아이콘 26px(`--blue`, 획 1.8, 문서 아이콘 `rect 5,3,14×18 rx2` + `M9 8h6M9 12h6M9 16h4`) · "왼쪽에서 건물을 선택해 주세요" 14px/600 `--t2` · "입주자카드와 관리비부과내역서 미리보기가 좌우로 표시돼요" 12.5px/500 `--t3` |
| 미리보기 영역 `.pm-preview` | `display:flex; gap:16px; padding:18px` — 두 카드 1:1 |
| 문서 카드 `.pm-doc` | `background:#fff; border:1px solid var(--line); border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(23,31,40,.06)` |
| 헤더 `.pm-doc-h` | `gap:7px; padding:11px 15px; border-bottom:1px solid var(--line2); 12.5px/800 --t2; background:#FBFCFD` · 아이콘 15px 획 2 `--blue`(입주자카드: `rect 6,3,12×18 rx2`+`circle 12,9 r2.2`+`M8.5 17a3.5 3.5 0 0 1 7 0` / 부과내역서: 위 문서 아이콘) · 우측 "총 N장" 배지 `.pm-pgbadge` 10.5px/700, `padding:2px 8px`, `--bg` 배경, `--t3` |
| 건물 줄 `.pm-doc-b` | 현재 페이지 건물 "코드 · 건물명" — 12px/700 `--t3`, `padding:7px 15px 0`, 흰 배경. 페이지가 없으면 줄(높이)은 남기고 글자만 비운다 — 헤더 높이가 흔들리지 않게 |
| 페이지 줄 | `display:flex; align-items:center; gap:8px; padding:8px 15px; border-bottom:1px solid var(--line2)` · [페이저][여백][개별 인쇄] — 페이저·개별 인쇄는 이미 정본 적용됨 |
| 종이 영역 `.pm-paper` | `flex:1; position:relative; overflow:hidden; background:var(--bg)` |
| 종이 `.pm-page` | 가운데 420×594, `background:#fff; border:1px solid var(--line); border-radius:3px; box-shadow:0 6px 20px -4px rgba(23,31,40,.18); overflow:hidden`, 배율 `s = min((W−28)/420, (H−28)/594)`(W·H = 종이 영역 크기, 리사이즈 시 재계산) |

- 1단계의 종이 안 문서는 현재 앱 문서(190mm 폭)를 **종이 폭 420px에 맞춰 축소**해 넣는다. 정본 `.pm-page`의 `padding:40px 34px`는 2단계 양식용이라 1단계에선 쓰지 않는다.
- 로딩·빈 상태는 종이 영역 안에 둔다: 로딩 스피너 / 입주자카드 "등록된 세대가 없습니다" / 부과내역서 "확정된 부과 내역이 없습니다" + "관리비 부과 확정(P5) 후 표시됩니다" / 조회 실패 "데이터를 불러오지 못했습니다. 다시 시도해 주세요."

### 4.3 하단 `.pm-f`

- 안내 문구(정본 `pmHint`): 선택 없음 "건물을 선택해 주세요" · 1곳 "{건물명} 선택됨 · 카드 X장 · 내역서 Y장" · 여러 곳 "N곳 선택됨 · 카드 X장 · 내역서 Y장".
- [취소] [둘 다 인쇄] — 버튼 hover는 앱 공용 Button 동작 유지(정본엔 규칙 없음, 미결정 사항).

### 4.4 모달 크기

정본 `.pm{width:min(1120px,96vw);height:min(760px,92vh)}`로 맞춘다(현재 `max-w-[calc(100vw-40px)]`·`max-h-[calc(100vh-40px)]`).

## 5. 데이터 흐름

새 훅 `useTenantOutputData(buildingIds: number[], period: string)` — `hooks/reactquery/bill/`에 둔다(`useAdjustmentStatements`와 같은 자리·같은 패턴).

```
buildingIds(목록 순서) ──┬─ useQueries: occupancyKeys.tenantCardPrint(id) / getTenantCardPrintData(id), gcTime 0 (원문 연락처)
                        ├─ useQueries: billKeys.targets(id, period) / listBillTargets(id, period)
                        └─ useQueries: billKeys.documents(id, period, unitIds) / getBillDocuments(...)
                                       (unitIds = 그 건물 targets, 비어 있으면 enabled:false)
반환: 건물별 { buildingId, tenants, cardStatus, statement(buildChargeStatement), statementPages(paginate 14), statementStatus }
```

모달은 반환값을 건물 순서대로 펼쳐 두 페이지 배열을 만든다.

- 입주자카드 페이지 = 건물별 `tenants` 각 1장(현재 문서 모델 유지) → `{ building, tenant, pageIndex, pageCount }`
- 부과내역서 페이지 = 건물별 `statementPages` 각 1장, 그 건물의 마지막 장에만 합계 → `{ building, rows, feeNames, totals?, pageIndex, pageCount }`
- `pageIndex/pageCount`는 **건물 안에서의** 쪽수(문서 하단 쪽 표기용), 헤더 "총 N장"·페이저는 **펼친 배열 전체** 기준.
- 패널 상태: 선택한 건물 중 하나라도 그 패널 쿼리가 로딩이면 로딩, 실패가 있으면 실패, 아니면 페이지/빈 상태.
- `useBuildings`·`useMe`·`useBillOrganizationName`은 지금처럼 그대로.

## 6. 인쇄

기존 방식(`printScope` 상태 → 숨은 `print:block` 영역 렌더 → `window.print()` → `afterprint`에서 해제)을 유지하고, 렌더 대상만 선택 건물 전체로 넓힌다. 순서는 PDF와 정본 `doPrint`를 따른다.

| 버튼 | 인쇄 순서 | 비활성 조건 |
|---|---|---|
| 둘 다 인쇄 | 건물1 카드 → 건물1 내역서 → 건물2 카드 → 건물2 내역서 … | 선택 없음 또는 카드·내역서 모두 0장 |
| 카드만 인쇄 | 건물1 카드 → 건물2 카드 … | 카드 0장 |
| 내역서만 인쇄 | 건물1 내역서 → 건물2 내역서 … | 내역서 0장 |

## 7. 검증

- `tsc --noEmit`·ESLint 통과(변경 파일).
- 헤드리스 정본↔앱 대조(1305×888): ① 목록(체크박스·건물 전체·N곳 선택·주소 들여쓰기) ② 2곳 선택 시 "총 N장"·건물 줄·페이저가 건물 경계를 넘을 때 건물 줄이 바뀌는지 ③ 문서 카드 헤더·건물 줄·페이지 줄·종이 치수와 배율 ④ 하단 안내 문구 ⑤ 인쇄 영역 DOM의 건물·문서 순서(세 버튼 각각).
- 단위 테스트는 쓰지 않는다(회사 정책: 프론트 테스트는 E2E만).
- PRD 문서(`docs/prototype/prd/`)는 2026-09-16 `368793d6`에서 리포에서 제거돼 갱신할 파일이 없다. 결정은 이 스펙과 WBS 비고에 남긴다.

## 8. 2단계 개요 (PDF에서 확인한 사실)

- **입주자카드**: 건물 단위 양식. 제목 "<< 입 주 자 카 드 출 력 >>" → 건물 정보(코드번호·동명칭·주소 / 빌라명칭·전화번호·관리업체 / 키번호) → 기타사항 → 청소사항(담당자·횟수·요일·청소금액·비고) → 정화조(업체·전화·금액·청구구분) → 인터넷(업체·명의자·금액) → 수도고객번호 표(LIN·번호·계약성명·구분·계산·검침·출력·기타적요) → 공용전기고객번호 표(LIN·번호·계약성명·구분·계산·기타적요) → 세대 표(호수·이름·분류·인원·평형·집전화·핸드폰·입주일자·관리비·인상후·인상폭·현관키) **쪽당 12세대**. 하단 "{건물} · {YYYY}년 {M}월 기준 · n / N 쪽".
- **관리비부과내역서**: 제목 "[ {건물} ]" → 세대당 3행, 부과 항목 18개를 3개씩 6열(금액 + Y) + 전기전월/수도전월·전기금월/수도금월, **쪽당 14세대**. 하단 "{건물} · {YYYY}년 {M}월분 · n / N 쪽". 합계 행 없음.
- 인쇄 정본 CSS: `@page{size:A4 portrait;margin:11mm}`, `.cf` 계열 규칙(정본 `doPrint`). PDF 위아래의 날짜·URL·"1/13"은 브라우저 머리글이라 양식이 아니다.
- 매핑을 확정해야 할 항목(예): 동명칭·전화번호·관리업체·키번호 출처, 청소사항·정화조·인터넷(협력업체 데이터 연결 여부), 고객번호 표의 구분·계산·검침·출력·기타적요, 세대 표의 분류·집전화·인상후·인상폭·현관키, 내역서의 "Y" 의미와 18개 항목의 순서(건물 유형별 항목 설정 기준), 전기·수도 전월/금월 값. 정본 더미 값(전화 010-8227-6496·"(주)스마일종합관리"·"입구1313 · 공실131" 등)은 업무 규칙이 아니다.

## 9. 위험·메모

- **건물 전체**를 누르면 선택 건물 수 N에 대해 요청이 3N개로 늘고, 입주자카드 인쇄 데이터 조회가 건물마다 PRINT 열람 기록을 남긴다(미리보기 조회도 지금과 같이 기록됨). 건물이 많은 조직에서 느리면 후속으로 일괄 조회 API를 검토한다.
- 입주자카드 인쇄 데이터는 `gcTime:0`이라 선택을 풀었다 다시 고르면 재조회한다(원문 연락처 캐시 금지 의도 유지).
- 1단계의 입주자카드는 세대별 1장이라 "총 N장"이 PDF(건물별 12세대/쪽)와 다르다. 2단계 양식 교체 때 페이지 계산이 바뀐다.
