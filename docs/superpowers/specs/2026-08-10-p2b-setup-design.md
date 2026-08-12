# 관리비서 — P2b 셋업·기타 설정(`/staff/setup`) 5탭 설계 (spec)

- **작성일:** 2026-08-10
- **스택:** Next.js 16(App Router) + Supabase(PostgreSQL·Auth) + React Query + TailwindCSS
- **기준 정본:** `docs/superpowers/specs/2026-08-10-prd-synthesis.md` §B.15/§C.4/§E, `docs/prototype/prd/setup.md`
- **로드맵:** `docs/superpowers/plans/2026-08-10-roadmap.md` — 로드맵 **P2를 P2a/P2b로 분해**한 것의 **P2b**(나머지 절반).
- **선행:** P0(인증·조직·`org_members`·`my_org_ids()`·`audit_log`·`set_updated_at`), P1a(마스터데이터·`attachments`·소프트삭제 패턴), **P2a**(`current_user_has_module()`·`current_user_is_master()` RLS 헬퍼, `org_members.affiliation`, `/accounts`).

> **브랜치 전제:** 본 문서는 현재 브랜치(=`origin/master`, 라우트 리네임 반영본)에 커밋된다. P2a는 `fulmar`에 있고 리네임 이전(`3f4ea4e`)에서 분기해 **PR #1이 CONFLICTING** 상태다. 실제 구현은 **`master`→`fulmar` 통합(별도 세션)으로 리네임+P2a를 합친 베이스** 위에서 `p2b` 브랜치를 떼어 진행한다. 그 통합 시 본 spec/plan 문서도 함께 `fulmar` 계열로 흘러간다. `navItems.ts`·라우트 편집(협력업체 이관)은 반드시 통합된 베이스 위에서 한다.

---

## 0. 배경 & 위치

로드맵의 **P2(계정·권한 & 셋업)**는 규모가 커서 둘로 분해했다: **P2a(`/accounts` + 권한 기반, 완료)** · **P2b(본 문서 — `/setup` 5탭)**.

P2b는 시스템 전반에 영향을 주는 전역 설정값을 관리하는 화면 하나(`/staff/setup`, 5탭)를 완성한다. 두 가지 횡단 의의가 있다:

1. **첫 module-permission RLS**: P2a가 확립한 헬퍼 `current_user_has_module('settings')`를 민감 config 테이블(`setup_config` 등)에 **처음으로 부착**한다(로드맵 횡단원칙 "P2에서 module-permission RLS 시작"). 이후 단계가 이 패턴을 참조한다.
2. **후속 단계의 설정 소비처 확립**: `room_types`(P3 입주자 룸타입), `septic_vendors`(P3 건물 협력업체), `as_categories`(P6 민원), `cleaning_teams`(스태프 소속), `quick_messages`(P4 발송 템플릿), 이사정산 설정·체크항목(P7), `long_term_repair_history`(P8 대시보드 요약) 등을 마스터로 미리 만든다.

P2a와 달리 **`auth.users`를 만들지 않으므로 service_role 서버 라우트가 불필요**하다 — 순수 RLS CRUD라 훨씬 단순하다.

---

## 1. 목표 & 범위

**In scope**
- **`/staff/setup` 화면**: 5탭(고지서 / 계좌 / 이사정산 / 시스템 / 장기수선비). 전체 화면 `settings` 권한 게이트.
  - **탭①-고지서**: 고객 안내사항, 세대 표기 기본값(코드/이름), 연체료 합산 구분, 단전·단수/수도단가/관리비기간/증감량 출력 Y/N, AS현황 메인표시 Y/N, 단수 개월 수. 하단 `저장`(배치 upsert).
  - **탭②-계좌**: 관리비 입금계좌 **최대 2개**(은행/계좌/예금주 + 계좌별 출력/미출력), 이사정산 입금계좌 1개. 하단 `저장`.
  - **탭③-이사정산**: 수도·전기 단가 반영 여부, 공실 처리 시 수납 방식(수동/자동), **이사정산 체크항목**(리스트 CRUD). config 부분은 하단 `저장`, 체크항목은 즉시 CRUD.
  - **탭④-시스템**: 룸타입 / 정화조업체 / AS구분명칭 / 청소팀 / 자주보내는문자 마스터(각 목록+추가·수정·삭제, 즉시 반영) + **협력업체(vendors) 통합 편입**.
  - **탭⑤-장기수선비**: 건물 선택 → 공사 이력(공사명/공사일/금액) 행 CRUD + 영수증·사진 파일 업로드(수 제한 없음).
- **DB 스키마(`0003`)**: `setup_config`(단일행) + `settlement_check_items` + 마스터 5종(`room_types`·`septic_vendors`·`as_categories`·`cleaning_teams`·`quick_messages`) + `long_term_repair_history`.
- **첫 module-permission RLS**: `setup_config`·`settlement_check_items` 쓰기를 `current_user_has_module('settings')`로 게이트.
- **협력업체 이관**: `/staff/vendor-management` UI를 탭④로 편입, 기존 라우트 리다이렉트, `navItems.ts`에서 항목 제거.
- reactquery 도메인 8종, zod 스키마, 컴포넌트, 테스트, 검증 SQL(`p2b_checks.sql`).

**Out of scope (후속 단계)**
- **cleaning_teams ↔ `org_members.affiliation` FK 승격** → 후속(accounts 재방문/P3). P2b는 **마스터 테이블만** 만들고 `affiliation`은 free-text 유지(사용자 확정).
- **이사정산 체크리스트 *결과* 저장**(`settlement_checklist_results`) → **P7**. P2b는 체크항목 **마스터**(항목명 목록)만.
- **장기수선비 대시보드 요약** → **P8**. P2b는 테이블 + 탭⑤ CRUD(파일첨부)까지만(사용자 확정).
- **설정값의 실제 소비**(고지서 출력 반영·부과 계산·이사정산 계산 등) → P5·P6·P7. P2b는 저장·조회까지만.
- **기존 P1a 도메인 테이블 모듈 게이팅 소급** → 이후 단계. P2b는 신규 config 테이블에만 최초 부착.

---

## 2. 확정된 결정

| # | 결정 | 값 | 근거 |
|---|---|---|---|
| 1 | 협력업체 위치 | **탭④로 통합**(기존 vendors 훅·컴포넌트 재사용, 독립 라우트 리다이렉트) | 사용자 확정 · PRD 정본 §C.4 "위치 불일치" 해소 |
| 2 | cleaning_teams FK | **마스터만**. `org_members.affiliation`은 free-text 유지, FK 승격은 후속 | 사용자 확정 · P2a 스키마·PR #1 재오픈 회피 |
| 3 | 장기수선비 범위 | **테이블 + 탭⑤ CRUD(파일첨부)까지만**. 대시보드 요약은 P8 | 사용자 확정 · 로드맵 P8 공유 |
| 4 | 문서 분할 | **단일 spec + 단일 plan**. plan 내부만 3그룹(config / 시스템마스터 / 장기수선비) 단계화 | 사용자 확정 · 화면 1개 응집 |
| A | 계좌 저장 모델 | **`setup_config` 컬럼 임베드**(관리비 2 + 정산 1 고정). 자식 테이블 아님 | 최대 2 하드캡 · 단일행 upsert 일관 |
| B | RLS 게이트 범위 | **config만 `settings`-gate**(`setup_config`·`settlement_check_items`). 참조 마스터는 P1a 개방 CRUD | 드롭다운 SELECT 개방 필요 · vendors 기존 RLS 불변 · "마스터는 통과"(헬퍼가 org_owner 자동 통과) |
| C | 마스터 모듈 형태 | **도메인별 파일 유지**(관례·일관성) + 내부 공용 label-master 헬퍼로 보일러플레이트 축소 | 하우스 컨벤션 · 5종 구조 동일 |
| 5 | service_role | **불필요**(auth.users 미생성, 순수 RLS CRUD) | P2a와 차이점 |
| 6 | 파일 저장 | 기존 `attachments` 테이블·버킷 재사용. `entity_type='long_term_repair'`, `kind='repair'`(enum 기존값) | P1a `attachment_kind` enum 재사용, 마이그레이션 churn 회피 |
| 7 | 소프트삭제 | 신규 테이블 전부 `deleted_at`(목록은 `is null` 필터), 물리삭제 없음 | 로드맵 이력보존 원칙 · staff_roles 패턴 |
| 8 | 금액 컬럼 | `long_term_repair_history.amount bigint`(원 단위 정수) | 로드맵 "금액 정수" |

---

## 3. DB 스키마 — `supabase/migrations/0003_p2b_setup.sql`

> P0(`organizations`·`set_updated_at`·`my_org_ids`), P1a(`attachments`·`attachment_kind`), P2a(`current_user_has_module`)에 의존. **단일 파일**에 아래 전부 포함(§10의 "3그룹"은 구현 태스크 순서일 뿐, 마이그레이션은 하나).

### 3.1 `setup_config` — 조직당 단일행(고지서·계좌·이사정산 플래그)

```sql
create table setup_config (
  org_id bigint primary key references organizations(id) on delete cascade,
  -- 탭① 고지서
  customer_notice        text,                       -- 고객 안내사항(고지서 인쇄 문구)
  unit_label_default     text not null default 'code' check (unit_label_default in ('code','name')),
  late_fee_merge         boolean not null default false,  -- 연체료 합산 구분 ❓(의미·값 P5에서 확정, 우선 Y/N)
  print_utility_cutoff   boolean not null default false,  -- 단전·단수 출력
  print_water_unit_price boolean not null default false,  -- 수도 단가 출력
  print_billing_period   boolean not null default false,  -- 관리비 기간 출력
  print_delta            boolean not null default false,  -- 증감량 표시
  show_as_on_main        boolean not null default false,  -- AS현황 메인표시
  cutoff_months          int,                        -- 단수 개월 수 ❓(기본값 미정, nullable)
  -- 탭② 계좌 (관리비 최대 2 + 정산 1, 임베드)
  mgmt_bank1  text, mgmt_acct1  text, mgmt_holder1 text, mgmt_print1 boolean not null default true,
  mgmt_bank2  text, mgmt_acct2  text, mgmt_holder2 text, mgmt_print2 boolean not null default true,
  settle_bank text, settle_acct text, settle_holder text,
  -- 탭③ 이사정산
  water_unit_reflect     boolean not null default false,  -- 수도 단가 반영
  electric_unit_reflect  boolean not null default false,  -- 전기 단가 반영
  vacancy_payment_mode   text not null default 'manual' check (vacancy_payment_mode in ('manual','auto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- **단일행 upsert**: `insert ... on conflict (org_id) do update set ...`. 탭①②③ 각 `저장`은 자기 슬라이스 컬럼만 upsert(부분 저장, 나머지 컬럼 보존).
- 모든 설정 컬럼 nullable/기본값 → 최초 진입 시 행 없어도 UI는 기본값 렌더, 첫 저장에서 insert.

### 3.2 `settlement_check_items` — 이사정산 체크항목 리스트(config 성격)

```sql
create table settlement_check_items (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, label)
);
```

> P7(`moving-settlement`)이 세대별 점검 **결과**를 이 마스터의 항목으로 기록한다. P2b는 항목 목록만.

### 3.3 시스템 설정 마스터 5종 — `staff_roles` 템플릿(org 격리·소프트삭제)

```sql
-- room_types / septic_vendors / as_categories / cleaning_teams : 동일 label 마스터
create table room_types (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, label)
);
-- septic_vendors, as_categories, cleaning_teams : 위와 동일 구조

-- 자주 보내는 문자: 제목 + 본문
create table quick_messages (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  title text not null,
  body  text not null,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, title)
);
```

- 소비처(후속): `room_types`→P3 입주자 룸타입, `septic_vendors`→P3 건물 협력업체, `as_categories`→P6 민원 분류, `cleaning_teams`→스태프 소속 표시, `quick_messages`→P4 발송 템플릿.
- **협력업체(vendors)는 이미 P1a에 존재** → 신규 테이블 없음. 탭④는 기존 `vendors`/`vendor_categories`를 그대로 소비.

### 3.4 `long_term_repair_history` — 건물별 장기수선 공사 이력

```sql
create table long_term_repair_history (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  building_id bigint not null references buildings(id) on delete cascade,
  work_name text not null,
  work_date date,
  amount bigint,            -- 원 단위 정수
  memo text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on long_term_repair_history (org_id, building_id);
```

- 파일: 기존 `attachments`(`entity_type='long_term_repair'`, `entity_id=id`, `kind='repair'`). 영수증/사진 구분은 UI 업로드 슬롯 기준(별도 컬럼 미persist; 엄격 분리 필요 시 후속에서 `attachment_kind` enum 확장).

### 3.5 updated_at 트리거

```sql
do $$ declare t text; begin
  foreach t in array array['setup_config','settlement_check_items','room_types','septic_vendors',
                           'as_categories','cleaning_teams','quick_messages','long_term_repair_history'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop; end $$;
```

---

## 4. RLS — 첫 module-permission

### 4.1 민감 config: `setup_config` · `settlement_check_items` (`settings` 게이트)

```sql
alter table setup_config            enable row level security;
alter table settlement_check_items  enable row level security;

-- SELECT: org 구성원 누구나(설정값은 여러 화면 드롭다운·출력에서 읽음)
create policy sc_select on setup_config for select
  using (org_id in (select my_org_ids()));
-- INSERT/UPDATE: settings 권한(또는 마스터 — 헬퍼가 org_owner 자동 통과)
create policy sc_insert on setup_config for insert
  with check (org_id in (select my_org_ids()) and current_user_has_module('settings'));
create policy sc_update on setup_config for update
  using (org_id in (select my_org_ids()) and current_user_has_module('settings'))
  with check (org_id in (select my_org_ids()) and current_user_has_module('settings'));

-- settlement_check_items: 동일 패턴(select 개방, write=settings)
create policy sci_select on settlement_check_items for select
  using (org_id in (select my_org_ids()));
create policy sci_insert on settlement_check_items for insert
  with check (org_id in (select my_org_ids()) and current_user_has_module('settings'));
create policy sci_update on settlement_check_items for update
  using (org_id in (select my_org_ids()) and current_user_has_module('settings'))
  with check (org_id in (select my_org_ids()) and current_user_has_module('settings'));
create policy sci_delete on settlement_check_items for delete
  using (org_id in (select my_org_ids()) and current_user_has_module('settings'));
```

> **이것이 로드맵에서 예고한 "첫 module-permission RLS"**다. 이후 신규 민감 테이블은 이 select-개방 / write-`current_user_has_module(키)` 패턴을 재사용한다. `settlement_check_items`의 소프트삭제는 UPDATE(`deleted_at`)로 처리하나, 하드 DELETE 경로도 `settings`로 막아 둔다.

### 4.2 참조 마스터: P1a 개방 CRUD (결정 B)

```sql
alter table room_types               enable row level security;
alter table septic_vendors           enable row level security;
alter table as_categories            enable row level security;
alter table cleaning_teams           enable row level security;
alter table quick_messages           enable row level security;
alter table long_term_repair_history enable row level security;

-- P1a 마스터와 동일 수준(활성 org 구성원 CRUD). 화면 접근은 어차피 /setup 'settings' UI 게이트 뒤.
create policy rt_all  on room_types               for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy sv_all  on septic_vendors           for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy asc_all on as_categories            for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy ct_all  on cleaning_teams           for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy qm_all  on quick_messages           for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
create policy ltr_all on long_term_repair_history for all using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
```

- **근거**: 이 마스터들은 여러 화면 드롭다운의 소스라 SELECT가 넓게 열려야 하고, `vendors`(P1a)의 기존 개방 CRUD와 일관돼야 한다. 쓰기까지 `settings`로 조이면 P1a 회귀 위험 + 소비 화면 조회가 깨질 수 있다. 화면 진입 자체가 `settings` UI 게이트 뒤이므로 실질 노출은 제한된다.
- **대안(미채택)**: 탭④ 마스터 write도 `settings` 게이트 → vendors RLS 변경·드롭다운 SELECT 영향으로 회귀 위험.

### 4.3 audit_log (선택)

설정 변경 감사는 P2b 필수 아님(로드맵 감사로그는 권한변경·부과확정·수납·이사 중심). 필요 시 `SETTINGS_UPDATE` 액션 후속 추가.

---

## 5. 데이터 계층 (reactquery)

하우스 컨벤션: 도메인별 `apis/keys/queries/mutations/index` + `apis.test`. snake↔camel 매핑은 `apis.ts`. 클라이언트는 `createClient()`(anon, RLS 적용).

### 5.1 공용 헬퍼 (결정 C — 보일러플레이트 축소)

`hooks/reactquery/_shared/labelMaster.ts`:
- `makeLabelMasterApis(table)` → `{ list, create, rename, softDelete, reorder }` 반환(공용 row 매퍼 `{id, orgId, label, sortOrder}` + `deleted_at is null` 필터 + `order('sort_order')`).
- 각 도메인 `apis.ts`는 이 팩토리를 호출해 export만 감싼다(공개 모듈은 도메인별 유지).

`hooks/reactquery/_shared/attachments.ts`(선택): vendors의 업로드/삭제/서명URL 로직을 `{entityType, entityId, orgId, kind, file}` 파라미터로 일반화. `longTermRepair`가 재사용. **vendors 리팩터는 스코프 밖** → 우선 `longTermRepair`에 vendors 패턴을 미러링하고, 공용화는 후속(회귀 최소화).

### 5.2 신규 도메인 8종

| 도메인 | 주요 함수 | 게이트 |
|---|---|---|
| `setupConfig` | `getSetupConfig()`(단일행 or null), `upsertSetupConfig(orgId, patch)` | select 개방 / write `settings` |
| `settlementCheckItems` | `list/create/rename/softDelete/reorder` | write `settings` |
| `roomTypes` | label-master(위 팩토리) | 개방 |
| `septicVendors` | label-master | 개방 |
| `asCategories` | label-master | 개방 |
| `cleaningTeams` | label-master | 개방 |
| `quickMessages` | `list/create/update(title,body)/softDelete` | 개방 |
| `longTermRepair` | `listByBuilding(buildingId)`, `create/update/softDelete` + `list/upload/deleteAttachment/signedUrl` | 개방 |

- **키 팩토리** 예: `setupConfigKeys = { all:['setupConfig'], detail:()=>['setupConfig','detail'] }`; label 마스터는 `{ all:[t], list:()=>[t,'list'] }`; `longTermRepairKeys = { all:['longTermRepair'], byBuilding:(id)=>['longTermRepair', id], attachments:(id)=>['longTermRepair','attachments', id] }`.
- 뮤테이션 `onSuccess` → 해당 `keys.all` 무효화(vendors 패턴).
- `upsertSetupConfig`는 부분 patch만 전달 → `apis.ts`의 `inputToRow`가 `undefined` 스킵(vendors `set()` 패턴 그대로).

---

## 6. zod 스키마 — `components/forms/schema/setup.ts` (+ `setup.test.ts`)

- `setupBillingSchema`(탭①): `customerNotice?`, `unitLabelDefault∈{code,name}`, `lateFeeMerge:boolean`, 출력 4종 boolean, `showAsOnMain:boolean`, `cutoffMonths:number.int.min(0).optional()`.
- `setupAccountsSchema`(탭②): 관리비 2계좌·정산 1계좌 필드(전부 optional 문자열) + `mgmtPrint1/2:boolean`. 부분입력 허용(빈 계좌 = 미등록).
- `setupSettlementSchema`(탭③): `waterUnitReflect:boolean`, `electricUnitReflect:boolean`, `vacancyPaymentMode∈{manual,auto}`.
- `labelMasterSchema`: `{ label: z.string().min(1) }` — 마스터 4종·체크항목 공용.
- `quickMessageSchema`: `{ title: min(1), body: min(1) }`.
- `longTermRepairSchema`: `{ workName: min(1), workDate?: date-string, amount?: z.number().int().min(0), memo? }`.

---

## 7. 페이지 & 컴포넌트

### 7.1 `app/(staff)/staff/setup/page.tsx` (`"use client"`)
- **게이트**: `useMe()` → `hasModule(me,'settings')`(신규 편의 `canManageSettings(ctx)`를 `lib/auth/permissions.ts`에 추가) 아니면 접근 불가 안내(현장직원·미권한 직원 차단, `/accounts` 게이트와 동형).
- **탭 상태**: `useState<TabKey>` + `?tab=` 동기화(딥링크·협력업체 리다이렉트 타깃). 탭 키: `billing|accounts|settlement|system|repair`.
- 상단 탭 네비 + 활성 탭 컴포넌트 렌더.

### 7.2 `components/` (setup 하위)
- `BillingSettingsTab`(탭①): `useSetupConfig` 로드 → 로컬 폼 → `저장`(`useUpsertSetupConfig` 슬라이스 patch). 성공 토스트.
- `AccountSettingsTab`(탭②): 관리비 계좌 2블록(각 출력/미출력 토글) + 정산 계좌 → `저장`.
- `MovingSettlementSettingsTab`(탭③): 단가 반영 토글 2 + 공실 수납 방식 라디오 → config `저장`; 하단 **이사정산 체크항목** = `MasterListEditor`(`settlementCheckItems`, 즉시 CRUD).
- `SystemSettingsTab`(탭④): 세로 섹션 — 룸타입/정화조업체/AS구분/청소팀 = 각 `MasterListEditor`; 자주보내는문자 = `QuickMessageEditor`(제목+본문); **협력업체** = 편입한 vendors UI(§7.3).
- `LongTermRepairTab`(탭⑤): 건물 선택 드롭다운(`useBuildings`) → `useLongTermRepairByBuilding` 이력 테이블 → 행 추가/수정/삭제 모달 + 파일 업로드(vendors `AttachmentLoader` 패턴 미러). 금액 정수 입력.
- `MasterListEditor`(공용): props `{ items, onAdd, onRename, onDelete }` — 목록 + `+ 추가` + 행별 인라인 수정/삭제. 룸타입·정화조·AS구분·청소팀·체크항목 공용(UI 보일러플레이트 축소).

### 7.3 협력업체 통합 (결정 1)
- `app/(staff)/staff/vendor-management/components/{VendorList,VendorCategorySidebar,VendorFormModal}.tsx` → `components/vendors/`로 **이동**(공용화). setup 탭④에서 import.
- 기존 `app/(staff)/staff/vendor-management/page.tsx` → `redirect('/staff/setup?tab=system')`(Next `redirect`). `page.test.tsx`는 리다이렉트 검증으로 갱신.
- `components/shell/navItems.ts`: `/staff/vendor-management` 항목 **제거**(module `settings` 하위로 흡수), `/staff/setup` `built:true`. ⚠ **리네임×P2a 충돌 지점** → 통합된 베이스 위에서 수행.

---

## 8. 테스트 전략 (TDD)

- **단위(Vitest)**:
  - 각 도메인 `apis.test.ts`: snake↔camel 매핑, `upsertSetupConfig` 부분 patch row 생성, label-master 팩토리(`deleted_at is null` 필터·정렬), `longTermRepair` byBuilding 필터·첨부 경로.
  - `setup.test.ts`: 슬라이스별 zod(경계값·enum·정수).
- **컴포넌트(RTL)**:
  - `page` 게이트: `settings` 없음/있음/마스터 → 접근 차단·허용.
  - `MasterListEditor`: 추가·수정·삭제 콜백, 빈 목록.
  - `BillingSettingsTab`/`AccountSettingsTab`: 로드→편집→저장 호출, 계좌 출력 토글.
  - `LongTermRepairTab`: 건물 선택 시 목록 로드, 파일 업로드 콜백.
  - vendor-management 리다이렉트.
- **RLS·RPC(SQL 검증, `supabase/verify/p2b_checks.sql`)**:
  - `settings` 없는 구성원: `setup_config` **SELECT 가능 / UPDATE 거부**. `settings` 보유·마스터: UPDATE 가능.
  - `settlement_check_items` write 게이트 동일.
  - 마스터 5종·`long_term_repair_history`: **타 org 격리**(다른 org 행 조회·수정 불가).
  - `setup_config` 단일행 upsert(on conflict) 동작.
- **정적**: `tsc --noEmit` + `npm run lint`.
- **라이브 미적용**: 원격 Supabase 호스트 DNS 미해석(ERR_NAME_NOT_RESOLVED)으로 런타임 스모크 불가 → 검증은 vitest + tsc + verify SQL 정적 리뷰까지. **런타임 적용·E2E는 사용자 PC 몫.**

---

## 9. 마이그레이션 / 환경

- `supabase/migrations/0003_p2b_setup.sql`(§3·§4 전부) + `supabase/verify/p2b_checks.sql`.
- **신규 env 없음**(service_role 불필요). 파일 스토리지는 P1a `attachments` 버킷 재사용.
- 적용(사용자): `0003` 실행 → `p2b_checks.sql`로 정책·컬럼·upsert 검증. **DB는 pending-user**(0002 포함 미적용) — 순서: 0002(P2a) → 0003(P2b).

---

## 10. plan 내부 3그룹 단계화 (단일 plan)

> 마이그레이션은 `0003` 하나. 아래는 **구현 태스크 순서**. 각 태스크 TDD+커밋(트레일러 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`).

1. **그룹1 — config**: `0003`의 `setup_config`+`settlement_check_items`+**첫 module-permission RLS** → `setupConfig`·`settlementCheckItems` 도메인 + `setup.ts` zod → 페이지 셸·게이트 + 탭①②③ UI(`MasterListEditor` 포함).
2. **그룹2 — 시스템 마스터**: `0003`의 마스터 5종+개방 RLS+트리거 → `_shared/labelMaster` + 도메인 5종 → 탭④(`SystemSettingsTab`) + **vendors 편입·리다이렉트·navItems**.
3. **그룹3 — 장기수선비**: `0003`의 `long_term_repair_history`+RLS+트리거 → `longTermRepair` 도메인(+첨부) → 탭⑤(`LongTermRepairTab`).

---

## 11. 열린 항목 / 향후

- **연체료 합산 구분(`late_fee_merge`) 의미·값 ❓** — 우선 Y/N boolean. 부과(P5) 소비 시 확정.
- **단수 개월 수 기본값 ❓** — nullable, UI 기본 표기 미정.
- **cleaning_teams ↔ affiliation FK 승격** → accounts 재방문/P3.
- **이사정산 체크리스트 결과 저장** → P7(`settlement_checklist_results`).
- **장기수선비 대시보드 요약** → P8.
- **설정값 실제 소비**(출력 반영·계산) → P5·P6·P7.
- **영수증/사진 kind 세분** → 필요 시 `attachment_kind` enum 확장 후속.
- **`_shared/attachments` 공용화(vendors 포함)** → 회귀 리스크로 후속 리팩터.

---

## 부록. PRD `setup.md` → P2b 배치

| PRD §3 | 배치 |
|---|---|
| 3.0 탭 네비 | `page.tsx` 탭 상태(`billing/accounts/settlement/system/repair`) + 탭별 `저장` |
| 3.1 고지서 설정 | `setup_config` 탭① 컬럼 + `BillingSettingsTab` + `setupBillingSchema` |
| 3.2 계좌 설정 | `setup_config` 계좌 임베드(최대 2 + 정산) + `AccountSettingsTab` |
| 3.3 이사정산 설정 | `setup_config` 탭③ + `settlement_check_items` + `MovingSettlementSettingsTab` |
| 3.4 시스템 설정 | 마스터 5종 + `vendors` 편입 + `SystemSettingsTab`/`MasterListEditor`/`QuickMessageEditor` |
| 3.5 장기수선비 | `long_term_repair_history` + `attachments` + `LongTermRepairTab` |
| 3.4 주석(직원·담당자 이관) | P2a `/accounts`에서 이미 처리(본 화면 대상 아님) |
