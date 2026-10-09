# 배포본 비교 개선 3차 구현 계획

- Spec: `배포본비교_개선3차.md` (repo root). 각 항목 번호(1~44)의 「잘못된 점 / 개선 방향」이 요구사항이다. 해당 절을 직접 읽는다.
- 정책 원문: `policy/` — 각 항목 「배경」에 인용된 정책 파일·라인을 반드시 직접 열어 크로스체크하고, 리포트에 "정책 확인: <파일:라인> — 일치/차이" 를 남긴다.
- Branch: `fix/policy-issues-3` (현재 체크아웃, D:\000.FrontEnd\344.home_erp_from_me)

## Global Constraints

1. 퍼블리싱(레이아웃·스타일·문구)은 원칙적으로 건드리지 않고 기능만 고친다. 기능상 UI 요소가 꼭 필요하면 Tailwind + 기존 공용 컴포넌트(`components/common/`, `components/shell/`)를 재사용해 최소로 추가한다.
2. API 서버 상태는 `@tanstack/react-query`(useQuery/useMutation, 공용 query key·hook). API 응답을 useState/useEffect에 복제하지 않는다. mutation 후 관련 캐시 invalidate.
3. Next.js 16 — Next API(라우트 핸들러·서버 액션·proxy 등)를 건드릴 때는 `node_modules/next/dist/docs/`의 관련 가이드를 먼저 읽는다.
4. DB 변경은 `supabase/migrations/`에 새 파일로만 추가한다. 번호는 작업 시점의 마지막 번호 + 1 (현재 마지막 `0261_policy_issues_second_pass.sql`). 함수 재정의는 반드시 실DB `select pg_get_functiondef('<fn>'::regproc)`(오버로드면 regprocedure) 결과에서 출발한다 — 이전 수정(예: late_fee_factor)이 빠지는 회귀를 막는다.
5. 실DB 반영: Supabase MCP(project `amhtprmapxlizdnsgbeg`). `apply_migration`은 42P10으로 실패하므로 `execute_sql`로 `begin; <migration sql>; commit;`을 실행한다. 반영 후 SELECT로 정의·데이터를 검증하고 결과를 리포트에 적는다. 데이터 백필은 마이그레이션 파일 안에 포함한다. 파괴적 DELETE/DROP TABLE은 하지 않는다(정책·함수·트리거 교체는 허용).
6. 검증: `node ./node_modules/typescript/bin/tsc --noEmit` 통과, 변경 파일 `node ./node_modules/eslint/bin/eslint.js <files>` 통과. 가능하면 SQL 단위 검증(트랜잭션 + rollback)으로 동작을 증명한다. Playwright/브라우저는 구현 Task에서 쓰지 않는다(마지막 E2E Task에서만).
7. 커밋은 자기가 바꾼 파일만 `git add <path>`로 스테이징한다. 미추적 `previous_lhw/`, `로그인정보.md`, `배포본비교_개선3차.md`는 스테이징하지 않는다. `git checkout -- .`/`reset --hard`/`restore` 금지. push 금지. 커밋 메시지 한국어, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
8. `배포본비교_개선3차.md`는 구현 Task에서 수정하지 않는다(마지막 Task 14에서 일괄 반영). 대신 리포트에 항목별 "반영 내용"(무엇을, 어느 파일/마이그레이션, 검증 결과)을 문서에 바로 옮길 수 있는 형태로 적는다.
9. 개인정보 원문을 리포트·커밋에 적지 않는다(집계만).

## Task 1: 세입자 고지서 연체료·조인·알림 토글·온보딩 오류·퇴실신청 (항목 24 → 23, 25, 26, 27, 29, 30)

- 24 먼저: `public_bill_by_signed`(5인자) late_fee 식에 `* late_fee_factor(b.org_id, bc.occupancy_id)` 복구(실DB 정의에서 출발).
- 23: `BillDetailView.tsx` 연체료 = `carryoverLateFee + lateFee`, grandTotal·payableAmount 반영.
- 25: 홈 「상세 내역 보기」 → `/resident/bill/${currentMonth.period.slice(0,7)}`.
- 26: `resident_bill_months`·`resident_bill_detail`(+ 같은 패턴의 세 번째 RPC가 있으면 포함) 고지 조인에 `bc.occupancy_id = l.occupancy_id`, 수납 집계에 `p.occupancy_id = bc.occupancy_id` 추가. 기준 통일(입주일 이전 고지 43건 데이터 보정)은 보류 유지.
- 27: `NotifyStartButton.tsx`, `ResidentMeWorkspace.tsx`에서 sms 제거, `{ alimtalk }`만 전송.
- 29: `ResidentAuthFlow.tsx` run() 오류 처리 + 「다시 시도」 UI(기존 `ResidentAsyncState` 등 공용 컴포넌트 재사용). 가능하면 React Query로.
- 30: `resident_create_move_out` 중복검사 + 부분 유니크 인덱스를 `status in ('pending','confirmed')`로.

## Task 2: 관리비 일할·반올림·장기수선 정렬 (항목 1, 4, 5)

- 1: 택2 — `ensure_required_utility_fee_items` 기본값·on conflict에 `daily_proration=false` 강제, 기존 필수 항목 백필, `FeeItemManagement.tsx:39` placeholder `false`.
- 4: `lib/billing/proration.ts` raw 분기 `Math.round`.
- 5: `list_long_term_repair_ledger` 정렬을 숫자 우선(`nullif(regexp_replace(entry_no,'\D','','g'),'')::int nulls last, entry_no, id`)으로, 클라이언트 `compareRows`도 같은 규칙으로 맞춘다.

## Task 3: 지로·팩스 고지서 미납·연체료 + 셋업 출력 옵션 (항목 2, 3)

- 2: 고지서 데이터(`get_bill_documents` 또는 `lib/bill/document.ts` 로드 경로, 팩스 포함)에 이월 미납(`bill_carryover`)·연체료(당월+이월, Task 1의 세입자 상세와 같은 정의) 추가. `GiroPrintView`·`GiroPaper`·팩스 렌더러: 미납액 항상 표시, 연체료는 `late_fee_merge`에 따라 합산/구분(납기후연체·납기후금액). 기존 서식 행 구조를 재사용하고 레이아웃은 최소 변경.
- 3: `print_water_unit_price / print_billing_period / print_delta / late_fee_merge`를 `bill/data.ts` 조회 → 출력 컴포넌트 props로 전달해 반영(관리비 기간: billing_period_settings, 수도 단가·증감: meter_readings).

## Task 4: 사무실 이사정산 (항목 7, 8, 9)

- 7: 이사 지침 저장 자리 — `extra.util`을 staff·partner 공통 정본으로 사용(partner `mobile-ms-new/_ms.ts`의 구조와 동일 키). staff `UtilitySettlementSection` 전월·이사 지침 입력 가능, 금액 = `max(0, 이사−전월) × 단가`, 단가 반영 ON이면 단가만 `meter.unitPrice`로 채움. `save_moving_settlement`가 extra.util을 보존·저장. 공과금 `list_utility_rows`/`save_meter_readings`는 해당 월 행이 없을 때만 이사 지침을 previous_reading 기본값으로 사용. `list_settlement_inquiries` 최종·이주 검침도 이 값 우선.
- 8: `settlement_amount` = 수납 차감 전 ①+②+③(미납)+④. `save_moving_settlement`(및 트리거 경로)에서 `get_settlement_context`와 같은 식의 미납을 더하고 `unpaid_amount` 스냅샷 컬럼에 저장. 화면 total 정의와 일치시키고 주석에 정의 고정. partner 저장 경로(`partner_save_moving_settlement`)도 같은 정의를 쓰는지 확인해 맞춘다.
- 9: `mid_moveout_settlement` — `alimtalk_opt_in=true`, billing_note 덧붙이기(중복 방지), completed/mid_moveout 가드. 클라이언트도 completed·mid_moveout이면 액션 잠금.

## Task 5: 퇴실 초기화·예약 퇴실 자동화 (항목 12, 15, 16)

- 공용 `reset_occupancy_on_vacate(occupancy_id, date)`: 정책 `사무실 관리자_입주자 상세.md:65-71`의 25필드 + 15번 5컬럼 초기화, 전화 포함 occupancy_history 적재, lease_contracts 삭제. `execute_move_out`·`complete_moving_settlement`에서 호출(기존 동작 보존). 기존 공실 잔존값 일회성 보정.
- 16: `execute_due_move_outs_all()` SECURITY DEFINER + pg_cron 일 1회 KST 00:05(= UTC 15:05). 기존 조회 시 호출 유지.

## Task 6: 미납 독촉 판정·연체료 이전 행 수납 (항목 13, 14(b))

- 13: 세대 `maxOverdueMonths`(lateFeeByPeriod months 최댓값) 기준 독촉 판정 + 합계 ≥ 100,000.
- 14: (b)만 — split(「수.연」/lateOnly) 행의 수납 저장을 막고 안내. (a)는 보류(연체료 수납 저장 모델 결정 필요).

## Task 7: 공과금 배분·고지금액·계산 버튼 (항목 6, 10, 11)

- 6: 전기·수도 대상(가스 보류). 고객번호×월 청구총액 테이블 + 저장 RPC, 정본 배분 RPC(수동입력 분리 → gross-up 단가 → 할인 캡 수렴 → 원 단위 → 잔액 흡수 → 검산 반환). 총액 미입력 월은 기존 계산 유지(회귀 방지 — 기존 데이터 영향 없음)하도록 하고, 총액 입력 시에만 배분값으로 calc_charge·unit_price 갱신. 전기 고객번호 요약 부과액 입력을 테이블에 연결. 정본: `previous_lhw/staff/utility-electric/부과액-계산-정책.md`, `utility-electric.dc.html:1235-1302`.
- 10: 고지금액 = `Math.round(부과액*1.11/10)*10`(총액 있으면 총액 기준).
- 11: 전기·가스 「계산」이 서버 계산(또는 6의 배분 RPC)으로 갱신, 편집 상태 유지.

## Task 8: 권한·보안 (항목 18, 19, 38)

- 18: `vendor_categories` RLS `vc_all` 제거 → `vc_select`(office staff) / `vc_write`(+ vendors 모듈). 기본 구분 보호 필요 여부는 컬럼 존재 여부 확인 후 판단.
- 19: 트리거를 INSERT 시 기본 부여로만 축소, `PermissionChecklist`에 「수납관리·민원접수」 칩(`payment`,`complaints`) 추가.
- 38: 본사 6개 RPC에 `current_user_can_manage_hq_accounts()` 가드(42501), 포인트·설정 화면 버튼 `useCanManageHqAccounts()` false면 disabled.

## Task 9: 건물 정렬·문자 수신 범위·예약 반복·로그인 (항목 17, 20, 21, 22)

- 17: 정렬 키를 서버 RPC/쿼리로 넘겨 DB 정렬·페이지네이션.
- 20: owner·cleaner 전 건물 다중 선택(「전체 (N명)」), 요약 "건물주 / 전체 / N명".
- 21: weekly 반복 + 종료 횟수(`recurrence_end_count`/remaining), enqueue weekly 분기, SchedulePicker·ScheduledTab 유형/필터, 반복 전환 RPC(messaging 모듈 검사).
- 22: staff 로그인 — 자동 로그인 체크 = 아이디 localStorage 저장/삭제, 마운트 시 채움, 성공 토스트. 영구 세션 플래그는 더 이상 설정하지 않는다(정책 2026-08-12 우선). platform-admin LoginForm도 아이디 기억으로 동일 처리.

## Task 10: 세대 연결 승인 알림 (항목 28)

- 승인 성공 후 공용 메신저 경로(서버)로 요청자 `claimed_phone`에 「세대 연결 완료」 안내 발송(알림톡 템플릿이 없으면 문자). 포인트 과금 정책 준수. 발송 실패가 승인 자체를 롤백하지 않게.

## Task 11: 현장 관리자 (항목 31, 32, 33, 34, 35)

- 31: 저장 버튼·doSave에서 `totals.balance < 0` 확인 전용 모달 후 저장 중단 + 서버 RPC 가드.
- 32: `done = s.status === "completed" || due <= 0`.
- 33: `partner_list_meter_cards`에 phones 배열, `MeterUnitCard`에서 `PartnerPhoneLink` 반복.
- 34: (a) `meter_readings.prev_usage_override` 컬럼 + 저장·조회 RPC 우선 사용.
- 35: `toNumber` → `replace(/[^0-9]/g,"")`, 서버 음수 거부.

## Task 12: 통합 관리자 포인트 (항목 36, 39, 40)

- 36: `platform_purge_organization`에서 point_transactions 삭제 제거, FK `ON DELETE SET NULL`(org_id nullable), 충전은 org_id null(본사)로 기록 — `PointsWorkspace.tsx:206-213` 대체, `point_pool_balance()` 및 관련 조회가 null org 행을 정상 포함하는지 확인.
- 39: `platform_get_point_pool_balance` RPC + React Query로 현재 잔액·경고 판정.
- 40: `faxPoints = faxPageCount × rate`.

## Task 13: 통합 관리자 청구·대시보드 (항목 37, 41, 42, 43, 44)

- 37: 4개 함수에서 `deleted_at is null` 필터 제거, 「그 달 발송량 또는 청구서가 있는 조직」 대상, 해지 상태 표시 정보 반환.
- 41: 문자 행 SMS·LMS 분리 + `platform_billing_invoices` 단가 스냅샷 컬럼(입금 확인 시 저장, 표시 시 스냅샷 우선).
- 42: 전체 발행은 `rows` 기준.
- 43: 진행 중인 달은 `platform_mark_org_billing_paid`에서 거절(+ 화면 안내).
- 44: 현재 연월 이후만 미도래, 집계 개월은 경과 월(0원 포함).

## Task 14: E2E 검증 + 문서 반영

- 로컬 dev 서버(`npm run dev`, localhost:3000)를 띄우고 Playwright(node 스크립트, headless)로 `로그인정보.md` 계정(staff admin / HQ hqadmin / partner field1)으로 각 수정 화면을 실제 조작·확인. 세입자는 계정이 없으므로 공개 공유 링크와 DB RPC 검증으로 대체.
- Supabase MCP로 수정 결과 데이터 정합성 크로스체크.
- `배포본비교_개선3차.md`: 수정한 항목은 제목~연관까지 항목 본문 전체를 취소선 처리하고, 그 밑에 「반영 내용」(파일·마이그레이션·검증/E2E 결과)을 기재. 보류 항목은 그대로 두되 부분 반영은 명시.
