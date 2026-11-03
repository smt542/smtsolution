# QA 대응필수 수정 계획 (2026-11-01)

Spec: `대응필수.md` (repo root, untracked) — 각 항목의 "개선 방안" 섹션이 요구사항이다.
상세 조사 결과(원인·파일:라인·SQL): `C:/Users/Jay/AppData/Local/Temp/claude/D--000-FrontEnd-344-home-erp-from-me/8009461a-b9fc-4e9c-ac37-1b589c755a23/scratchpad/research/itemNN.md`

범위: 협의 불필요 8건(#1 #2 #16 #19 #25 #42 #55 #56) + 사용자가 승인한 5건(#41 #48 #49 #59 #60). 나머지 13건은 고객 결정 대기로 이번 범위 밖.

## Global Constraints

- 퍼블리싱(UI 디자인·레이아웃)은 바꾸지 않는다. 기능(데이터·로직·기본값·쿼리·검증)만 수정한다. 새 입력이 필요하면 기존 공용 컴포넌트(`components/common/`)를 재사용한다. 라벨 문구 변경은 #16에 한해 허용.
- 서버 상태는 `@tanstack/react-query`. mutation 후 관련 query key 를 invalidate 한다. API 응답을 useState/useEffect 로 복제하지 않는다.
- Next.js 는 이 저장소 버전에 breaking change 가 있다. Next API(proxy, cookies, route handler 등)를 건드리면 먼저 `node_modules/next/dist/docs/` 의 해당 문서를 읽는다.
- 정책: `policy/` 를 근거로 한다. 이번 승인으로 정책과 달라지는 항목(#41 #48 #49 #60)은 해당 policy 문서의 해당 문장도 함께 갱신한다(한두 줄, "2026-11-01 QA 반영" 표기).
- DB 변경: `supabase/migrations/` 에 다음 번호(현재 마지막 0331)로 새 파일을 추가하고, 원격 Supabase 에 `mcp__supabase__execute_sql` 로 `begin; … commit;` 트랜잭션 적용한다(`apply_migration` 은 이 프로젝트에서 42P10 오류). 적용 전후 SELECT 로 데이터 정합성을 크로스체크하고 결과를 report 에 남긴다. 기존 함수를 재정의할 때는 라이브 정의(`pg_get_functiondef`)를 기준으로 수정한다(마이그레이션 파일과 라이브가 다를 수 있음).
- 테스트 러너가 없다. 검증 = `npx tsc --noEmit -p .`(변경 관련 오류 0) + `npx eslint <변경 파일>` + SQL 검증(롤백 트랜잭션). 순수 함수 로직은 `npx tsx -e` 로 경계값 확인. Playwright 는 implementer 가 쓰지 않는다(controller 가 마지막에 수행).
- 커밋: 태스크당 1개 이상, 메시지 형식 `fix: <한국어 요약> (QA #NN)` 또는 `feat: …`, 마지막 줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. untracked 인 `video/`, `검수 QA_*.xlsx`, `대응필수.md`, `docs/superpowers/plans/2026-11-01-qa-must-fix.md` 는 커밋하지 않는다(`git add -A` 금지, 파일 지정).
- 다른 태스크 범위의 파일은 건드리지 않는다.

## Task 1: #60 현장관리자 조직 전체 건물 조회

요구: 현장 모바일(partner)에서 현장관리자가 담당 건물뿐 아니라 같은 조직의 모든 건물을 본다. 조사: research/item60.md.
- 마이그레이션으로 `partner_my_building_ids()` 를 조직 전체 건물(미삭제) 반환으로 재정의(`partner_org_building_ids()` 와 같은 조건 재사용 가능). 이를 쓰는 RPC 17개의 읽기·쓰기(검침, 이사정산, AS 신규 접수)가 조직 전체로 넓어진다 — Ruling: 쓰기도 넓힌다.
- 유지: AS 수정·삭제는 담당자 본인만, 조직 경계, 읽기 전용·발송 금지 규칙. 다른 사람이 만든 이사정산 draft 삭제는 기존 작성자 제한이 있으면 유지.
- SQL 검증: field1 계정(또는 org23 테스트 계정) jwt 시뮬레이션으로 before/after 건물 수(조직 전체 수와 일치).
- 정책 갱신: `policy/02_현장 관리자/` 의 "담당 건물" 조회 범위 문장 → 조직 전체.

## Task 2: #48 이사정산 미납 소계 — 납기 경과분만, 퇴실월 제외

요구: 이사정산 미납 소계는 기준일(오늘, KST) 기준 납기일이 지난 미납만 포함하고, 퇴실월 고지분은 ② 관리비에서 일할 계산되므로 미납에서 제외한다. 예: 미납 55,000 / 납기 2026-10-31 / 오늘 10-26 → 0. 조사: research/item48.md.
- `settlement_billing_unpaid` 라이브 정의 기준으로 마이그레이션 재정의: `due_date < 기준일` 조건 + 퇴실월(period = 퇴실일의 월) 제외. 연체료 계산은 기존 유지(포함된 행에만).
- 프론트 변경은 필요할 때만.
- SQL 검증: 광원타운 101(unit 104) 등 10월 미납 세대에서 함수 결과가 0 / 9월 이전 미납 세대는 기존과 동일.
- 이미 저장된 이사정산은 건드리지 않는다(report 에 영향 건수만 기록).
- 정책 갱신: `policy/03_사무실 관리자/사무실 관리자_이사정산 입력.md` 미납 소계 규칙.

## Task 3: #49 중도퇴실 소계 수기 수정 / 수납액 없이 처리

요구: 사무실 이사정산(staff)에서 공과금 소계·관리비 소계·기타 소계·미납 소계를 직접 수정할 수 있고, 수정값이 합계·저장·출력·이력에 반영된다. 중도퇴실은 미수금(수납액 미입력)이 있어도 처리 가능. 조사: research/item49.md.
- Ruling: 수기 수정은 staff 화면만(partner 는 범위 밖). 퇴실(만기) 처리의 미수금 차단은 유지, 중도퇴실만 예외.
- 수정값 저장: 조사안대로 `extra.subtotalOverride`(필드별 nullable) + 저장 RPC·`settlement_amount` 트리거가 override 를 우선 사용. 자동 계산값은 초기값, override 없으면 기존과 동일.
- 표시용 소계 4개를 기존 공용 `Input`(숫자 입력 패턴은 화면의 다른 금액 입력과 동일)으로 교체, 관리비를 자동값으로 되돌리는 effect 가 override 를 덮어쓰지 않게 수정.
- `SettlementActions.tsx` 중도퇴실 버튼의 미수금 > 0 차단 제거(퇴실 버튼은 유지).
- 출력물·상세에서 저장된 값(override 반영)을 읽는지 확인.
- 정책 갱신: 이사정산 입력 정책의 "미수금 > 0 이면 중도퇴실 불가" 문장.

## Task 4: #41 총관리비에 공과금 합산

요구: 관리비 부과 세팅 세대별 현황의 총관리비 = 기존(건물관리비+고정관리비) + 해당 월 수도·전기·가스 금액. 조사: research/item41.md.
- 세대별 공과금 금액은 화면에 이미 있는 수도/전기/가스 열과 같은 값을 사용(같은 데이터 소스, 중복 조회 금지). 합계 행이 있으면 같이 반영.
- 정책 갱신: `policy/03_사무실 관리자/사무실 관리자_관리비 부과 세팅.md` 총관리비 정의.

## Task 5: #42 관리비 부과 세팅 전체자료추가

요구: 전체자료추가 시 전월 부과기준일·납기일이 익월로(+1개월, 말일 보정) 이월된다. 조사: research/item42.md.
- Ruling(최소 수정): DB 미래월 금액 저장 차단은 유지. `copyPreviousBilling` 에서 부과기준일·납기일 저장을 먼저 하고, 대상 월이 미래월이면 금액 이월은 건너뛴다. `Promise.all` → `Promise.allSettled` 로 바꿔 부분 실패를 집계·안내하고 기준일만 이월된 건물도 반영 건물 수에 포함.
- 그룹 필터: 레일의 그룹 필터 상태를 상위로 끌어올려 전체자료추가 대상 = 현재 그룹 필터의 건물(그룹 미선택이면 전체). UI 모양은 그대로.
- 날짜 계산 함수(`carryDate` 등)를 `lib/billing/period.ts` 공용으로 이동(#37 재사용 대비), `npx tsx` 로 경계값 검증: 10/1→11/1, 10/31→11/30, 1/31→2/28, 2024-01-31→2024-02-29, 2/28→3/31, 9/16→10/16.
- 이월 후 `billingKeys`(list/periodSetting)와 공과금 쪽 `utilityKeys.billingPeriod` 모두 invalidate.

## Task 6: #55 지로·서류 고지서 출력에서 출력 여부 N 제외

요구: 입주자 `occupancies.print_enabled = false` 인 세대는 지로 고지서·서류 발행 고지서 출력 대상에서 빠진다. 팩스는 Ruling: 수신번호를 수동 입력하므로 필터하지 않는다. 조사: research/item55.md.
- `list_bill_targets`(또는 출력 대상 조회 경로)에 print_enabled 를 포함해 필터. 서버 쪽 발행 함수에도 같은 조건이 필요한지 조사안 따라 판단.
- 입주자 저장(출력 여부 변경) 후 지로 출력 목록 query 를 invalidate.
- SQL 검증: 10월 print_enabled=false 인 5세대가 대상 목록에서 빠지는지.

## Task 7: #56 단전·단수 예고 자동 표시

요구: 셋업 설정 > 출력 옵션 > 단전·단수 출력(개월 N, 출력 여부)에 따라 연체 개월 수 ≥ N 인 세대의 고지서에 단전·단수 스탬프가 자동으로 찍히고, 알림톡 고지서는 장기미납 템플릿(026100000608)으로 간다. 스탬프 문구 "단전·단수·예고", 오타 "단수 목수 있습니다" 수정. 조사: research/item56.md.
- 원인: 저장된 `water_cutoff=false` 가 자동 판정을 덮어씀 → 자동 판정이 항상 우선(저장값은 수동 강제 true 일 때만 의미)하도록 수정. 출력 여부 off 이면 표시 안 함.
- Ruling: N = 납기가 지난 미납 개월 수 기준. 설정 2 → 직전 2개월(예: 8·9월) 미납이면 10월 고지서에 표시.
- 지로/서류 고지서 템플릿과 알림톡 템플릿 선택이 같은 판정 함수를 쓰게 한다.

## Task 8: #25 팩스 발송 결과 추적 / 1페이지

요구: 팩스가 실제로 안 갔는데 성공 토스트가 뜨지 않게 하고, 실패 사유를 기록·표시하며, 팩스 출력물을 미리보기와 같은 A4 1페이지로 만든다. 조사: research/item25.md.
- `sendBillFaxes` 가 API 응답의 skipped/needs-check 를 버리지 않고 결과 안내에 반영(성공 0건이면 성공 토스트 금지). 기존 토스트/안내 컴포넌트 재사용.
- 접수번호 없이 timeout 된 job 이 영원히 "진행 중"으로 막히지 않게(다음 확인 시각 설정 또는 실패 처리 후 재발송 허용).
- 결과 조회(`delivery-reconcile`)에서 실패 코드(error code)를 저장.
- 팩스 PDF 템플릿을 A4 1페이지에 맞춤(여백·스케일·page-break). 미리보기 레이아웃 기준.
- 실제 팩스 발송은 하지 않는다.

## Task 9: #1 #2 A/S 드로어 연결·시행일 정렬

요구 #1: 우측 A/S 드로어 카드 클릭 → `/staff/receipts?buildingId=&unitId=&complaintId=` 로 이동해 해당 건물·호실 선택 + 해당 민원 상세 모달 열기. 이미 receipts 페이지에 있을 때도 URL 변경을 따라가야 함. 조사: research/item01.md.
요구 #2: "오래된순" 정렬 키 = 시행일(최근 `complaint_resolutions.resolved_at`, 없으면 `completed_at`, 둘 다 없으면 접수일). 드로어·수납관리 A/S 현황·A/S 리포트가 같은 공용 정렬 함수를 사용. 조사: research/item02.md.

## Task 10: #16 라벨 변경 / #19 입주자카드·부과내역 다중 건물 출력

#16: 입주자 폼 "부과시 참조사항" → "적요", "기타 적요" → "기타 메모"; 이사정산 안내 문구 2곳 동일 반영. 건물 단위 "부과시 참조사항"·데이터 이관 엑셀 헤더는 바꾸지 않는다. 조사: research/item16.md.
#19: `TenantOutputModal` 건물 선택을 다중 선택 + 전체 선택으로(검침 대장 출력 모달의 기존 다중 선택 패턴 재사용), 건물 코드 오름차순 정렬, 선택 건물 순서대로 이어서 출력. 조사: research/item19.md.

## Task 11: #59 화면 영역별 로그인 세션 분리

요구: 같은 브라우저에서 사무실(staff)과 현장(partner) 계정이 동시에 로그인 상태를 유지한다. 조사: research/item59.md.
- `@supabase/ssr` `cookieOptions.name` 으로 영역별 쿠키 이름(staff / partner / platform / resident) 분리. 공용 scope 헬퍼(경로 → scope), `lib/supabase/client.ts`·`server.ts`·`middleware.ts` 를 scope 인지형으로.
- `proxy.ts` 가 scope 를 요청 헤더(`x-auth-scope`)로 전달, 공용 API(`change-password`, `switch-entry` 등)는 scope 를 명시적으로 받는다. API route 28개 전부가 올바른 scope 클라이언트를 쓰는지 점검(누락 시 401).
- `EntryPersonaWatcher` 의 "다른 계정으로 로그인되어 로그아웃" 흐름은 같은 영역 안에서 계정이 바뀐 경우에만 동작.
- 공유 링크(`app/(resident)/share/`)·OAuth 콜백(카카오) 경로의 scope 처리 확인.
- 배포 직후 전원 재로그인 1회 필요 — report 에 명시.
