# 관리비서 — P5 고지서 발행 코어(A4) 슬라이스 (`/staff/bill`) 설계 (spec)

- **작성일:** 2026-08-13
- **스택:** Next.js 16(App Router, `"use client"`) + Supabase(PostgreSQL·Auth) + React Query(@tanstack) + zod + TailwindCSS + Vitest/RTL
- **기준 정본:** `docs/prototype/prd/bill-publish.md`, `docs/superpowers/plans/2026-08-10-roadmap.md` **P5**(검침·부과·고지서)의 **고지서 슬라이스**.
- **선행(구현 완료·병합):** 부과확정(0012 `billing_confirmations`·`billing_history`·`list_billing`/`confirm_billing`), 메시징 코어(0010 `message_logs`·`MessagingModal` 프리셋), P2b setup(`setup_config` 고지서/계좌 설정), P3b(occupancies·unit accounts).
- **모듈 게이트:** `bill_publish`(고지서 발행). 화면 `hasModule(me,"bill_publish")`, 쓰기 RLS/RPC `current_user_has_module('bill_publish')`.
- **브랜치:** `PracLee/bullhead`.

---

## 0. 배경 & 위치

로드맵 P5 = 검침(`/utilities`)·부과확정(`/management-fee`)·고지서(`/bill`) 3화면. 앞의 둘은 완료. 본 슬라이스는 **부과 확정된 관리비를 세대별 A4 고지서로 발행·인쇄**하는 최소 수직 슬라이스다. 고지서 PRD 전체(지로·카톡·팩스·예약·그룹분리·조정명세서)는 L규모이며 상당수가 미구현 의존에 막혀 있어, **A4 인쇄까지의 얇은 수직 슬라이스**만 세운다. 나머지는 후속.

## 1. 목표 & 범위

**In scope**
- **`bill_issues`** 발행 기록 테이블(마이그 `0013`) + RLS + 읽기/쓰기 RPC.
- **`/staff/bill` 화면**: 건물·기간 선택 → 부과 확정 세대 목록 로드 → 세대표기(코드/이름)·납기일 지정 → 대상 선택 → **A4 고지서 인쇄**(발행 기록 생성).
- **A4 고지서 출력**: 브라우저 인쇄(HTML `@media print` + `window.print()`). QR코드·회사명·계좌(setup)·고객안내(setup)·자동이체 표시·항목표·총액·납기일 포함.
- **발송 배선(proof)**: 기존 `MessagingModal` 프리셋(`context:'고지서'`, `channel:'sms'`, stub)으로 선택 세대 문자 발송.
- GNB `navItems`의 `/staff/bill` `built:false→true`.

**Out of scope(후속·의존 사유)**
- **지로 출력** — 지로 양식·지로번호 규칙 스펙 필요 → 후속.
- **카톡(알림톡) 발행** — 알림톡 채널·템플릿·실 NCP = P4b/P4d 미구현. `MessagingModal`은 현재 `channel:'sms'`만. 채널 열리면 `channel:'alimtalk'` 드롭인.
- **팩스 발행** — 외부 팩스 서비스 + 세대 팩스번호 스키마 없음.
- **예약 발송** — `scheduled_messages`·스케줄러 = P4c.
- **그룹별 분리 출력·조정명세서·자동이체 세대 출력** — 단일 그룹으로 단순화, 문서생성은 후속 슬라이스.
- **단수(단전·단수) 표기·해지** — 연체 계산(P6) 의존.

## 2. 확정된 결정
| # | 결정 | 값 |
|---|---|---|
| 1 | 슬라이스 경계 | **얕은 수직(A4 인쇄까지)** — 사용자 확정 |
| 2 | A4 출력 방식 | **브라우저 인쇄(HTML `@media print` + `window.print()`)**, 서버 PDF 미사용 — 사용자 확정 |
| 3 | 인쇄 뷰 구조 | **같은 페이지 내 숨김 print 컨테이너**(전용 라우트 아님) |
| 4 | 발송 | 기존 `MessagingModal` **SMS/stub** 프리셋 배선(발송 이력=`message_logs`). 실 카톡은 P4b 드롭인. `bill_issues.send_status` 연동은 후속 |
| 5 | QR 인코딩 대상 | 세입자앱(카카오 신청 URL) 미구축 → **설정/플레이스홀더 URL**(`buildQrPayload`) |
| 6 | QR 구현 | 새 의존 **`qrcode`**(검증된 npm) 클라이언트 렌더 |
| 7 | 자동이체 여부 | **세대 관리비 계좌(`unit_accounts` mgmt)에 CMS 회원번호 존재**로 파생. 실제 컬럼명 구현 시 확인 |
| 8 | 마이그 번호 | 라이브 0012까지 기준 → **`0013`** |
| 9 | 발행 이벤트 | `[A4 인쇄]` 클릭 = 인쇄 + `bill_issues` 기록(발행) 동시 |

## 3. DB 스키마 — `supabase/migrations/0013_p5_bill_publish.sql`

```sql
-- P5: 고지서 발행 (bill_issues)
-- 의존: P0(profiles·audit_log·set_updated_at), P1a(units), P2a(current_user_org·current_user_has_module·my_org_ids),
--       P3b(occupancies·unit_accounts), P5-billing(billing_confirmations·billing_history)
-- 모듈 게이트: bill_publish

create table bill_issues (
  id bigint generated always as identity primary key,
  unit_id bigint not null references units(id) on delete cascade,
  period date not null check (period = date_trunc('month', period)::date),
  occupancy_id bigint references occupancies(id) on delete set null,
  issue_type text not null check (issue_type in ('a4','giro','kakao','fax')),  -- 이번 슬라이스: 'a4'
  group_no int not null default 1,
  due_date date,
  unit_label_mode text not null default 'code' check (unit_label_mode in ('code','name')),
  auto_debit boolean not null default false,
  total_amount integer not null default 0,                                     -- 발행 시점 확정 총액 스냅샷
  send_status text not null default 'none' check (send_status in ('none','sent','failed')),
  issued_at timestamptz not null default now(),
  issued_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, period, issue_type)
);
create index on bill_issues (unit_id, period);

-- updated_at 트리거
create trigger trg_bill_issues_updated before update on bill_issues
  for each row execute function set_updated_at();

-- RLS: SELECT org 개방 / 쓰기 bill_publish 모듈
alter table bill_issues enable row level security;
create policy bi_select on bill_issues for select
  using (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())));
create policy bi_write on bill_issues for all
  using      (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('bill_publish'))
  with check (unit_id in (select u.id from units u join buildings b on b.id=u.building_id where b.org_id in (select my_org_ids())) and current_user_has_module('bill_publish'));
```

**RPC** (definer, `set search_path = public`, anon revoke / authenticated grant):

- `list_bill_targets(p_building_id bigint, p_period date)` → 확정 세대 목록(화면 테이블).
  반환: `unit_id, unit_no, dong, tenant_name, total_amount, auto_debit boolean, issue_type text, due_date date, send_status text, issued_at timestamptz`.
  로직: `buildings.org_id = current_user_org()` 스코프. `billing_confirmations bc`에서 `bc.period = p_period and bc.confirmed_at is not null and unit ∈ building`인 세대. `occupancies`(bc.occupancy_id)로 tenant_name. `auto_debit` = `exists(unit_accounts where unit_id=u.id and kind='mgmt' and nullif(cms_member_no,'') is not null)`(실제 스키마 구현 시 확인). 최신 `bill_issues`(issue_type/due_date/send_status/issued_at) `left join`. `order by unit_no`.

- `get_bill_documents(p_building_id bigint, p_period date, p_unit_ids jsonb)` → 선택 세대 A4 렌더 데이터.
  반환: `unit_id, unit_no, dong, tenant_name, total_amount, auto_debit boolean, items jsonb, billing_note, unit_notice`.
  로직: org 스코프. `p_unit_ids`(bigint 배열 jsonb) ⊂ building. `billing_confirmations`(확정·총액·note) + 기간별 최신 `billing_history`(items 스냅샷: `[{fee_item_id,name,charged,amount}]`) `distinct on (unit_id) ... order by unit_id, confirmed_at desc`. `auto_debit`은 `list_bill_targets`와 동일 파생.

- `issue_bills(p_building_id bigint, p_period date, p_unit_ids jsonb, p_issue_type text, p_due_date date, p_unit_label_mode text)` → `jsonb {count}`.
  검증: org·`bill_publish` 모듈·building∈org·period=월1일. 각 unit_id는 building 소속 + **확정(confirmed_at not null)** 이어야 함(미확정 세대 발행 거부). `bill_issues` upsert(`on conflict (unit_id, period, issue_type)`), `total_amount`=billing_confirmations 스냅샷, `auto_debit` 파생, `issued_by=auth.uid()`, `issued_at=now()`. `audit_log`(`action='BILL_ISSUE'`) 1행. 반환 `{count}`.

verify: `supabase/verify/p5_bill_checks.sql` — `bill_issues` 존재·`bi_write`가 `bill_publish` 게이팅·RPC 3종(`list_bill_targets`·`get_bill_documents`·`issue_bills`) 존재·anon revoke.

## 4. 순수 유틸 — `lib/bill/document.ts` (+ `.test.ts`)
- `unitLabel(mode: "code"|"name", unitNo: string, tenantName: string|null): string` — 세대 표기(이름 없으면 코드 폴백).
- `buildQrPayload(unitId: number, period: string, base?: string|null): string` — 카카오 고지서 신청 URL. `base` 없으면 플레이스홀더(`BILL_QR_PLACEHOLDER_BASE`). `?unit={unitId}&period={period}`.
- `printableAccounts(config): {bank,acct,holder}[]` — setup `mgmtPrint1/2`가 true인 관리비 계좌만.
- `billDocumentTotal(items): number` — items의 `charged` 항목 amount 합(총액 표시 교차검증; 서버 total_amount와 일치 확인용).

## 5. 데이터 계층 — `hooks/reactquery/bill/{apis,keys,queries,mutations,index}` (+ `apis.test.ts`)
- `listBillTargets(buildingId, period) → BillTarget[]` (snake→camel).
- `getBillDocuments(buildingId, period, unitIds) → BillDocument[]` (items 매핑 `{feeItemId,name,charged,amount}`).
- `issueBills({buildingId, period, unitIds, issueType, dueDate, unitLabelMode}) → {count}`.
- hooks: `useBillTargets(buildingId, period)` · `useBillDocuments(buildingId, period, unitIds)`(enabled=선택 있음) · `useIssueBills()`. 성공 시 `billKeys` 무효화.
- RPC 호출 규약: `createClient().rpc("fn", { p_… })` → `{data,error}`, 에러 throw. billing 도메인 매퍼 스타일 그대로.

## 6. 페이지 & 컴포넌트 — `app/(staff)/staff/bill/`
- **`page.tsx`** (`"use client"`): 게이트 `hasModule(me,'bill_publish')`(미보유 시 "접근할 권한이 없습니다"). 상단 컨트롤 — 건물 `Select` + 기간 `<input type="month">`(기본=현재월) + 세대표기 `Select`(code/name, 기본=setup `unitLabelDefault`) + 납기일 `<input type="date">`. 하단 `BillTargetTable`. 인쇄용 `BillPrintView`(숨김) + 발송 `MessagingModal`.
- **`components/BillTargetTable.tsx`** (+ `.test.tsx`): 확정 세대 표(호실[표기모드]/입주자명/총액/자동이체/발행상태[issued_at 유무]). 전체·개별 체크박스. 액션 `[A4 인쇄]`(선택≥1) · `[문자 발송]`(선택≥1). 빈 상태 "부과 확정된 세대가 없습니다 — 관리비 부과셋팅에서 확정 후 발행". (발송상태 컬럼은 후속.)
- **`components/BillPrintView.tsx`** (+ `.test.tsx`): 선택 세대별 A4 고지서 블록(세대당 1페이지, `break-after: page`). 내용: 제목(건물명·`YYYY년 MM월` 관리비 고지서) · 세대 식별(`unitLabel`) · 항목표(items name/amount) · 총액 · 납기일 · 자동이체 표시 · 계좌(`printableAccounts`) · 고객안내(`customerNotice`) · `QrCode` · 하단 회사명(소자). `@media print`로 화면 요소 숨김, `window.print()` 트리거. 인쇄 실행 시 `issueBills` 호출로 발행 기록.
- **`components/QrCode.tsx`**: `qrcode`로 payload → data URL `<img>`. 프레젠테이션 전용.
- **발송**: `[문자 발송]` → 선택 세대를 `MessageRecipient[]`(`kind:'tenant'`, `ref.occupancyId`, phone=occupancy) 매핑 → `MessagingModal preset={{context:'고지서', channel:'sms', body:고지서 기본문구, recipients}}`. 성공 시 결과 토스트(발송 이력은 `message_logs`가 기록).
- **navItems**: `/staff/bill` `built:false→true`.
> Tailwind 토큰은 기존 실존 토큰만(utilities/billing 컴포넌트 참조). 인쇄 CSS는 전역 `globals.css`에 `@media print` 규칙 추가 또는 컴포넌트 scoped.

## 7. 데이터 흐름
건물·기간 선택 → `useBillTargets` → 표에서 대상 체크 → `[A4 인쇄]` → `useBillDocuments`(선택 세대) → `BillPrintView` 렌더 → `window.print()` + `issueBills`(기록) → 표 새로고침(발행상태 갱신). `[문자 발송]` → `MessagingModal`(stub) → 성공 시 `markBillsSent` → 발송상태 갱신.

## 8. 화면 상태
| 상태 | 조건 | 노출 |
|---|---|---|
| 초기 | 건물 미선택 | "건물을 선택해 주세요", 표 비표시 |
| 로딩 | 대상 조회 중 | 로딩 인디케이터 |
| 빈 | 확정 세대 없음 | "부과 확정된 세대가 없습니다 …" |
| 발행 대기 | 대상 로드 완료 | 표 표시, 대상 선택 대기 |
| 발행 완료 | 인쇄+기록 성공 | "N세대 고지서를 발행했습니다" 토스트, 발행상태 갱신 |
| 발송 완료 | 문자(stub) 성공 | "N세대에 발송(stub)했습니다" 토스트 |
| 에러 | RPC/발송 실패 | 에러 토스트 |

## 9. 테스트 전략
- **SQL(`p5_bill_checks.sql`)**: `bill_issues` 존재·RLS `bi_write` `bill_publish` 게이팅·RPC 4종 존재·anon revoke. (수동: 미확정 세대 `issue_bills` 거부, 타 org building 거부, `bill_publish` 미보유 write 거부.)
- **단위(Vitest)**: `lib/bill/document`(unitLabel·buildQrPayload·printableAccounts·billDocumentTotal), `hooks/reactquery/bill/apis` 매퍼(3 RPC snake↔camel·에러 throw).
- **컴포넌트(RTL)**: `BillTargetTable`(선택·상태·빈), `BillPrintView`(항목/총액/납기일/QR/자동이체/setup 계좌·안내 반영·`window.print` 호출·`issueBills` 트리거 — `window.print` mock), `page`(게이트·초기·빈), 발송 배선(프리셋 전달).
- **정적**: `npx vitest run`·`tsc --noEmit`·`npm run lint` 그린.

## 10. 마이그레이션 / 환경
- `0013_p5_bill_publish.sql` + `supabase/verify/p5_bill_checks.sql`. 라이브 적용은 사용자 PC(0012 다음). 신규 npm 의존 **`qrcode`**(+ `@types/qrcode` devDep). 신규 env 없음(QR base URL은 향후 setup/building 설정).

## 11. 커밋·WBS
- 한국어 conventional(`feat`/`fix`/`test`/`docs`). 모든 커밋 끝에 트레일러:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 화면 커밋 직후 `wbs-commit-sync`(dev 트랙, 완료 자동변경 금지). 단, 현재 브랜치 `PracLee/bullhead`는 sync `config.branches` 밖 → master 병합 후 반영.

## 12. 열린 항목 / 향후
- 지로 출력(양식·번호) / 카톡=알림톡(P4b) / 팩스(외부·세대 팩스번호) / 예약(P4c) / 그룹 분리·조정명세서·자동이체 세대 출력 / 단수 표기(연체 P6).
- QR 실 URL — 세입자앱(카카오 고지서 신청) 슬라이스에서 `base` 연결.
- `auto_debit`·`unit_accounts` 실제 테이블/컬럼명 — 구현 착수 시 스키마 확인(없으면 `auto_debit=false` 폴백).
- 납기일 기본값 규칙 — 현재 사용자 입력. 후속에서 setup 기본값 도입 가능.
- 회사명(고지서 하단) = 프로그램 제공사명 상수(`PROGRAM_COMPANY_NAME`); 설정화는 후속.
- `bill_issues.send_status`·화면 발송상태 — 이번 미표시(발송은 `message_logs`). `message_logs`↔bill 연동은 후속.

## 부록. PRD(bill-publish.md) → 본 슬라이스 배치
| PRD | 배치 |
|---|---|
| 3.0 상단(건물·발행유형·그룹·세대표기) | `page.tsx` 컨트롤 (발행유형=A4, 그룹 단일, 세대표기 code/name) |
| 3.1 세대 목록 테이블 | `BillTargetTable`(발송상태 포함) |
| 3.2 지로·A4 출력(QR·회사명·자동이체) | `BillPrintView`(A4만; 지로 후속) |
| 3.3 카톡 발송 | `MessagingModal`(SMS/stub; 알림톡 P4b 후속) |
| 3.4 팩스 | 후속 |
| 3.5 단수·납기일 | 납기일=출력 시 지정. 단수 후속(P6) |
| 5 데이터(부과 확정 참조) | `billing_confirmations`·`billing_history` 읽기 RPC |
