# 입주자카드·부과내역서 인쇄 양식 교체 (출력 모달 2단계)

- 작성일: 2026-09-23
- 선행: `2026-09-23-tenant-output-modal-multiselect-design.md`(1단계, 병합 61d52c9b)
- 정본: `building-list.dc.html`의 `cardForm`·`stmtForm`·`doPrint`(git `e26d4b4b` = staging). 인쇄본 = 사용자 제공 PDF 3종(둘다 인쇄 13쪽·카드만 인쇄 7쪽·내역서만 인쇄 6쪽, 햇살하이츠·중앙타워 2곳 선택)
- 정본 원문 발췌: 아래 §9(양식 마크업·CSS)

## 1. 목표

출력 모달의 종이 안 문서와 인쇄물을 정본 양식으로 바꾸고, 각 칸을 실제 데이터로 채운다. 1단계의 다중 선택·미리보기 틀·인쇄 순서는 그대로 둔다.

## 2. 결정 사항

### 2.1 사용자 확인(2026-09-23)

| 항목 | 결정 |
|---|---|
| 입주자카드 헤더 "전화번호" | 회사 대표전화(설정 > 회사 정보 `company_phone`), 없으면 조직 전화(`organizations.phone`) |
| 저장된 데이터가 없는 칸 | 빈칸. 키번호는 `입구{공동현관 비밀번호}`만, 인터넷 "명의자"는 빈칸. 입력 칸 신설 없음 |
| 부과내역서 "Y" | 항목 부과 여부 — 그 세대에 부과된 항목 Y, 부과되지 않은 항목 N, 항목 없는 칸 빈칸 |
| 필드 매핑표(§4) | 제안대로 진행(이의 없음) |

### 2.2 구현 중 정한 기본값(사용자 퇴근 중, 되돌리기 쉬운 쪽으로)

| # | 항목 | 기본값 | 이유 |
|---|---|---|---|
| D1 | 데이터 경로 | 연락처 원문이 필요한 **세대 행만 서버 인쇄 라우트**(`/api/buildings/[id]/tenant-cards/print`)에 필드를 **덧붙여** 받고(기존 호출과 호환), 건물·업체·고객번호·회사·부과 항목·검침은 **기존 클라이언트 조회**로 조합 | 건물 정보·업체·고객번호는 이미 클라이언트에서 읽는 데이터다. 업체 병합 규칙(정규화 행 ↔ `vendor_details` 키)을 서버에 다시 짜면 건물 편집 화면과 어긋나므로, 편집 화면의 `mergeVendors`를 그대로 재사용한다. 채팅에서 제안한 "새 서버 라우트 한 번에"보다 중복이 적다 |
| D2 | 입주자카드 세대 범위·순서 | 공실 포함 전 세대, 호수 숫자순. 쪽당 12세대. 마지막 쪽은 **있는 세대만** 그린다(빈 행 채우지 않음). 세대가 0이면 헤더만 있는 1쪽 | 정본 `pagesOf`는 최소 1쪽. 빈 행 채우기는 정본 더미 생성기의 부산물 |
| D3 | 부과내역서 세대 범위 | 확정된 세대만(지금 규칙, 정본도 입주 세대만). 쪽당 14세대. 확정이 없으면 0쪽(지금처럼 "확정된 부과 내역이 없습니다") | 확정 전 금액을 인쇄하지 않는다 |
| D4 | 부과내역서 항목 열 | 건물 유형의 부과 항목을 `sortOrder` 순으로 3개씩 한 열. 열 수 = `max(6, ⌈항목 수/3⌉)` — 6열 미만이면 빈 열로 정본 폭을 유지, 18개를 넘으면 열을 늘린다 | 정본은 6열 고정 |
| D5 | Y/N 판정 | 확정 문서(`billing_history` 스냅샷)에 그 세대의 항목이 있으면 Y(금액 표시), 건물 항목 목록에는 있는데 스냅샷에 없으면 N(금액 빈칸) | 확정 시 부과된 항목만 스냅샷에 남는다(`confirm_billing`) |
| D6 | 검침 전월·금월 | 전기·수도 `list_utility_rows`의 세대별 **첫 번째 행** `previousReading`·`currentReading`. 값이 없으면 빈칸 | 세대 계량기가 여럿이면 대표 계량기만 |
| D7 | "인상후" | 인상액이 0보다 클 때만 `관리비 + 인상액`, 아니면 빈칸. "인상폭" = 인상액(0·없음이면 빈칸) | 인상 계획이 없는 세대에 같은 금액을 두 번 찍지 않는다 |
| D8 | 고객번호 표가 비었을 때 | 머리행 + 빈 행 1줄 | 정본 양식 모양 유지 |
| D9 | 워터마크 | 제거 | 정본·PDF에 없음 |
| D10 | 업체 설정 금액(청소 금액·정화조 금액·인터넷 금액) | 저장된 글자를 그대로 인쇄(숫자로 다시 포맷하지 않음) | 자유 입력 칸이라 "60,000"·"월 6만" 등 형식이 섞일 수 있다 |
| D11 | 인쇄 격리 | 인쇄 시트를 `document.body` 직속 포털로 그리고, 인쇄 CSS에 `body > *:not([data-print-sheet]) { display: none !important }` + `html, body { background: #fff; height: auto; overflow: visible }`(모두 `!important`) | AppShell은 인쇄 때 사이드바·상단바만 숨기고 본문(main)은 찍는다 → 지금은 건물 화면 내용이 인쇄물 앞에 섞일 수 있다. 정본 `doPrint`의 `body>*:not(#cfPrintSheet){display:none}`·`html,body{…}`와 같은 방식. html·body 규칙이 없으면 마지막 쪽 빈자리에 앱 배경(회색)이 찍힌다(2026-09-23 PDF로 확인) |
| D12 | 호수 표기 | 두 양식 모두 호수 끝의 "호"를 뗀다(예: 101) | 정본·PDF 표기 |
| D13 | 항목 스냅샷이 없는 확정 세대 | Y/N 칸을 비운다(금액도 빈칸) | 확정 기록(`billing_confirmations`)은 있는데 `billing_history` 스냅샷이 없으면 부과 여부를 알 수 없다. 2026-09-23 확인: 현재 DB의 확정 37건(그린빌라·블루타워) 모두 스냅샷이 없다(시드 데이터). 정상 확정(`confirm_billing`)은 스냅샷을 함께 쓴다 |

## 3. 범위

| 포함 | 제외 |
|---|---|
| 입주자카드·부과내역서 양식 컴포넌트(미리보기·인쇄 겸용) | 1단계 모달 틀·선택·인쇄 순서(유지) |
| 인쇄 라우트 세대 행 필드 추가(호환) | 공실 키·인터넷 명의자 입력 칸 신설 |
| 클라이언트 조회 추가(건물 상세·부과 항목·검침·회사 설정·직원) | 기존 `getTenantCardPrintData`·`useTenantCardPrintData`(다른 세션 파일 `hooks/reactquery/occupancies/apis.ts`) 변경 |
| 종이 틀(미리보기 안쪽 여백 40/34, 축소 제거)·인쇄 CSS(A4 여백 11mm) | 부과 확정 로직·스키마 변경(마이그레이션 없음) |

## 4. 필드 매핑

### 4.1 입주자카드(건물 1곳 = 1~N쪽, 헤더는 쪽마다 반복)

| 칸 | 값 |
|---|---|
| 코드번호 | `building.code`(굵게) |
| 동명칭 | `building.address.split(" ")[1]`, 없으면 `—`(정본 렌더 규칙) |
| 주소 | `building.address` |
| 빌라명칭 | `building.name`(굵게) |
| 전화번호 | `setupConfig.companyPhone` → `orgContact.phone` → 빈칸 |
| 관리업체 | `setupConfig.companyName` → 조직명(`useBillOrganizationName`) → 빈칸 |
| 키번호 | `entrancePassword`가 있으면 `입구{entrancePassword}`, 없으면 빈칸 |
| 기타사항 | `building.memo` |
| 청소사항 | `담당자: {청소 담당자 이름}   횟수: {cleaning.fields["청소 횟수"]}   요일: {…["청소 요일"]}   청소금액: {…["청소 금액"]}` 줄바꿈 `비 고: {cleaning.memo}`. 담당자 = `building.cleaningUserId`의 계정 표시 이름(`useStaffOptions`) |
| 정화조 | `업체: {septic.업체명} {septic.전화번호}   금액: {septic.fields["금액"]}   청구구분: {septic.fields["정화조 구분"]}` |
| 인터넷 | `업체: {internet.업체명}   명의자:    금액: {internet.fields["인터넷 금액"]}` |
| 수도고객번호 표 | `customerNumbers` 중 `kind==="water"`, `sortOrder` 순. LIN=순번(1부터) · 수도고객번호=`customerNo` · 계약성명=`holderName` · 구분=`billingBasis` prev→전월/current→당월 · 계산=`calculationMethod` auto→자동/manual→수동 · 검침=`meterDay` · 출력=`printOnBill` Y/N · 기타적요=`note` |
| 공용전기고객번호 표 | `kind==="common_elec"`, 같은 규칙. LIN·번호·계약성명·구분·계산·기타적요 |
| 세대 표 | 호수=`unitNo`(표시용 호수) · 이 름=`tenantName` · 분류=`roomTypeLabel` · 인원=`residentCount` · 평형=`areaPyeong` · 집전화=`phone3`(앱 관행: 연락처3=집전화) · 핸드폰=`phone`(대표 연락처) · 입주일자=`moveInDate` `YYYY.MM.DD` · 관리비=`mgmtFeeAmount`(천 단위 쉼표) · 인상후·인상폭=D7 · 현관키=입주 중 `Y` / 공실 `N 공실`(정본 렌더 규칙). 공실 행은 이름·연락처·입주일자 빈칸 |
| 하단 | `{건물명} · {YYYY}년 {M}월 기준 · {쪽} / {전체 쪽} 쪽`(건물 안 쪽수) |

업체 블록의 `업체명`·`전화번호`·`memo`·`fields`는 건물 편집 화면과 같은 병합 규칙(`app/(staff)/staff/(app)/buildings/new-v2/_components/config/formState.ts`의 `mergeVendors(vendorDetails.vendors, vendors)`)으로 얻는다. 키: `cleaning`·`septic`·`internet`.

### 4.2 관리비부과내역서(건물 1곳 = 0~N쪽)

| 칸 | 값 |
|---|---|
| 제목 | `[ {건물명} ]` |
| 머리행 | `호<br>수` · 열마다 항목 이름 3개를 `<br>`로(빈 슬롯은 `&nbsp;`) · `전기전월<br>수도전월` · `전기금월<br>수도금월` |
| 세대 | 확정 세대(D3), 호수 숫자순, 세대당 3행(`tbody.ug`). 1행째에 호수(`rowspan=3`)·검침 2칸(`rowspan=3`) |
| 항목 칸 | 열 g·행 r = 항목 `g*3+r`. 금액 칸(오른쪽 정렬·천 단위 쉼표, 0·없음은 빈칸) + Y 칸(D5: Y/N/빈칸) |
| 검침 칸 | 전월 칸 = `{전기 previousReading}<br>{수도 previousReading}`, 금월 칸 = `{전기 currentReading}<br>{수도 currentReading}`(D6) |
| 하단 | `{건물명} · {YYYY}년 {M}월분 · {쪽} / {전체 쪽} 쪽` |

## 5. 데이터 계약

### 5.1 인쇄 라우트 세대 행(추가 필드, 기존 필드 유지)

`GET /api/buildings/[id]/tenant-cards/print` 응답 배열의 각 원소에 추가: `areaPyeong: number | null`(numeric 문자열이면 숫자로), `mgmtFeeAmount: number | null`, `increaseAmount: number | null`, `phone3: string | null`(원문). 원문 재조회는 `occupancies.select("id, phone, phone3")`. 권한·PRINT 기록은 그대로.

### 5.2 클라이언트 조회(선택 건물마다, 1단계 훅 확장)

| 데이터 | 조회(기존 key 재사용) |
|---|---|
| 세대 행(원문 연락처) | 인쇄 라우트 — 새 타입 `TenantCardSheetRow`로 받는 새 함수(같은 URL), 키는 새 네임스페이스 |
| 건물 상세 | `getBuildingFull(id)` / `buildingKeys.full(id)` |
| 부과 대상·문서 | 1단계 그대로 |
| 부과 항목 | `listFeeItems(typeId)` / `feeItemKeys.list(typeId)` (건물 `typeId` 없으면 빈 목록) |
| 검침 | `listUtilityRows(id, "electricity"|"water", period)` / `utilityKeys.rows(...)` |
| 조직 단위(1회) | `useSetupConfig(orgId)`·`useOrgContact()`·`useBillOrganizationName(orgId)`·`useStaffOptions()` |

패널 상태: 입주자카드 = 세대 행·건물 상세, 부과내역서 = 대상·문서·부과 항목·검침(전기·수도). 하나라도 로딩이면 로딩, 실패면 실패(1단계 규칙).

## 6. 미리보기·인쇄

- 미리보기: 1단계 종이(420×594, 영역에 맞춰 축소)에 **안쪽 여백 40px 34px**을 주고, 양식을 정본 화면 CSS(§9.2) 크기 그대로 넣는다(1단계의 190mm 문서 축소 zoom 제거).
- 인쇄: `@page { size: A4 portrait; margin: 11mm }`, 쪽마다 `break-after: page`(마지막 쪽 제외), 정본 인쇄 CSS(§9.3) 값. 머리행 회색 배경은 `print-color-adjust: exact`.
- 같은 컴포넌트를 미리보기·인쇄에 쓰고, 인쇄 값은 Tailwind `print:` 변형으로 준다(미리보기 모달은 `print:hidden`, 인쇄 영역은 `hidden print:block`).

## 7. 검증

- `tsc --noEmit`·ESLint(변경 파일). 단위 테스트 금지(회사 정책).
- 헤드리스 인쇄 PDF: 앱에서 2곳 선택 → 세 버튼 각각 인쇄 영역을 `page.pdf()`(A4)로 뽑아, 쪽수·쪽 순서·쪽별 머리(건물명·쪽 번호)·표 머리행 글자를 정본 PDF(사용자 제공)와 대조한다. 앱 데이터 기준 기대 쪽수 = D2·D3 규칙.
- 미리보기: 정본과 같은 방식으로 종이 안 양식 치수(제목 글자 크기·표 머리행 높이·세대 행 높이)를 대조한다.
- 데이터 스모크: 협력업체·고객번호가 입력된 건물에서 청소/정화조/인터넷 블록과 고객번호 표가 채워지는지, 공실 행이 `N 공실`인지, 부과 항목 N 칸이 나오는지.

## 8. 위험·후속

- `useStaffOptions`는 전체 계정 목록이라 청소 담당자 이름만 쓰기엔 넓다(이미 건물 화면이 쓰는 조회라 추가 요청 없음).
- 건물 전체 선택 시 건물당 조회가 1단계보다 늘어난다(건물 상세·부과 항목·검침 2종). 느리면 후속으로 일괄 조회.
- 기존 `useTenantCardPrintData`는 모달에서 쓰지 않게 되지만 다른 세션 파일이라 이번엔 두고, 정리는 후속.

## 9. 정본 원문 발췌

### 9.1 마크업(`cardForm`·`stmtForm`)

입주자카드: `.cf` > `.cf-t`("<< 입 주 자 카 드 출 력 >>") > `table.cf-hd`(3열 3행: 코드번호·동명칭·주소 / 빌라명칭·전화번호·관리업체 / 키번호 colspan 3) > `.cf-box`×4(`.cf-lb` 라벨 + `.cf-memo`·`.cf-in` 내용: 기타사항 / 청소사항 >> / 정화조 >> / 인터넷 >>) > `table.cf-tb`(수도고객번호 8열) > `table.cf-tb`(공용전기고객번호 6열) > `table.cf-tb.cf-units`(12열, colgroup w1~w12) > `.cf-f`.

부과내역서: `.cf` > `.cf-t2`("[ 건물명 ]") > `table.cf-tb.cf-stmt`(`table-layout:fixed; width:100%`; thead 1행: `th.hno` + `th.hg` colspan 2 ×열수 + `th.hm`×2; 세대마다 `tbody.ug` 3행) > `.cf-f`.

### 9.2 미리보기 CSS(정본 화면)

```
.cf{font-family:'Pretendard',sans-serif;color:#000;font-size:8.4px;line-height:1.45}
.cf-t{text-align:center;font-size:15px;font-weight:800;letter-spacing:.22em;margin-bottom:8px}
.cf table{width:100%;border-collapse:collapse}
.cf-hd{border:1px solid #444;margin-bottom:0}
.cf-hd td{padding:3px 6px;font-size:8.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cf-box{border:1px solid #444;border-top:0;display:flex;gap:8px;padding:4px 6px}
.cf-lb{flex:none;border:1px solid #444;border-radius:2px;padding:1px 5px;font-weight:700;height:fit-content}
.cf-in,.cf-memo{flex:1;min-width:0}
.cf-memo{min-height:34px;color:#666}
.cf-tb{border:1px solid #444;border-top:0}
.cf-tb th,.cf-tb td{border:1px solid #999;padding:2px 4px;font-size:8px;white-space:nowrap}
.cf-units{table-layout:fixed;width:100%}
.cf-units th,.cf-units td{overflow:hidden;text-overflow:ellipsis;padding:2px 2px;font-size:7.4px}
.cf-units col.w1..w12 = 7% 11% 6% 6% 6% 12% 16% 13% 7% 6% 6% 9%
.cf-tb th{background:#F2F3F5;font-weight:700;text-align:center}
.cf-tb td.c{text-align:center}
.cf-tb td.r{text-align:right;font-variant-numeric:tabular-nums}
.cf-f{margin-top:6px;text-align:right;font-size:8px;color:#666}
.pm-page{… padding:40px 34px …}
```

부과내역서 화면 전용 규칙은 정본에 없다(인쇄 규칙만 있음). 미리보기는 인쇄 규칙(§9.3의 `.cf-t2`·`.cf-stmt`)을 화면 크기 비율(인쇄 9pt ↔ 화면 8.4px)로 옮겨 쓴다: `.cf-t2` 12px/800 가운데 margin-bottom 6px, `.cf-stmt th,td` 6px·padding 1px 2px·line-height 1.3, `th.hg` 왼쪽 600, `th.hm` 가운데 600, `tbody.ug` 아래 테두리 1px #000.

### 9.3 인쇄 CSS(정본 `doPrint`)

```
@page{size:A4 portrait;margin:11mm}
.cf-page{page-break-after:always}.cf-page:last-child{page-break-after:auto}
.cf{font-size:9pt;line-height:1.5;color:#000}
.cf-t{text-align:center;font-size:17pt;font-weight:800;letter-spacing:.2em;margin-bottom:4mm}
.cf table{width:100%;border-collapse:collapse}
.cf-hd{border:.8pt solid #000}
.cf-hd td{padding:1.4mm 2mm;font-size:9pt}
.cf-box{border:.8pt solid #000;border-top:0;display:flex;gap:3mm;padding:1.4mm 2mm}
.cf-lb{flex:none;border:.7pt solid #000;padding:.4mm 1.6mm;font-weight:700;height:fit-content}
.cf-memo{min-height:14mm;color:#000}
.cf-tb{border:.8pt solid #000;border-top:0}
.cf-tb th,.cf-tb td{border:.5pt solid #000;padding:1mm 1.4mm;font-size:8.4pt}
.cf-tb th{background:#EDEDED;text-align:center;font-weight:700;print-color-adjust:exact}
.cf-tb td.c{text-align:center}.cf-tb td.r{text-align:right}
.cf-units{table-layout:fixed;width:100%}.cf-units th,.cf-units td{overflow:hidden;font-size:7.6pt;padding:.8mm 1mm}
.cf-t2{text-align:center;font-size:13pt;font-weight:800;margin-bottom:3mm}
.cf-stmt{table-layout:fixed;width:100%;border-top:.8pt solid #000}
.cf-stmt th,.cf-stmt td{font-size:6.6pt;padding:.5mm 1mm;line-height:1.3}
.cf-stmt th.hg{text-align:left;font-weight:600}.cf-stmt th.hm{text-align:center;font-weight:600}
.cf-stmt td.r{text-align:right}.cf-stmt td.y{text-align:center}
.cf-stmt tbody.ug{border-bottom:1pt solid #000}
.cf-f{margin-top:2mm;text-align:right;font-size:8pt}
```
