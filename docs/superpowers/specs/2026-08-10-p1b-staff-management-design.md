# P1b 계정·권한 (staff-management) 설계

**작성일:** 2026-08-10
**단계:** P1b (P0 인증 · P1a 기초정보 위에 얹음)
**목표:** 관리회사(org) 내 직원 계정을 발급·관리하고, 모듈 단위 권한을 **화면과 DB(RLS) 양쪽에서** 강제한다.

---

## 1. 범위

**포함**
- 직원 계정 CRUD 화면 `staff-management` (탭: 사무실 관리자 / 현장 관리자 / 입주자[조회만]).
- 권한 모델: `org_members.role` + `permissions`(jsonb 모듈키 배열). 마스터(org_owner)=전체.
- 계정 발급/수정/비번재발급 = **Supabase Edge Function**(service_role, 호출자 인가 검증).
- 정식 비밀번호(마스터가 초기비번 발급 → 최초 로그인 시 변경 강제, `must_change_password`).
- 모듈 권한의 **DB RLS 강제**(민감 테이블 쓰기 차단) + 화면 게이팅(nav/route).
- 입주자 탭: 호실-입주자 연결 상태 **조회 전용**.

**불포함(후속)**
- 입주자(tenant) 로그인 포털·인증(별도 단계).
- 모듈별 **읽기** 세분 차단(본 단계는 쓰기 차단까지; 아래 §4.5 참고).
- 장기수선/문자/서류발행/공과금 등 각 모듈의 실제 기능(권한 키만 정의, 기능은 각 단계에서).

---

## 2. 확정 결정 (사용자 승인)

| # | 결정 |
|---|------|
| 1 | 권한 = `role` + `permissions`(jsonb 모듈키 배열). org_owner=전체 |
| 2 | 정식 비번: 마스터 초기발급 + `must_change_password`로 최초변경 강제 |
| 3 | 계정 생성 = Supabase Edge Function(admin API, service_role) |
| 4 | 입주자 탭 = 조회만 |
| 5 | 권한 강제 = **화면 + DB(RLS)** 둘 다 |

---

## 3. 권한 모델

### 3.1 모듈 권한 키 (프로토타입 칩 기준)
```
관리업무: buildings(건물·입주자) · billing(관리비부과) · fee_items(항목등록)
          documents(서류발행) · arrears(미납) · vendors(협력업체)
          longterm(장기수선) · sms(문자)
공과금:   utilities
이사정산: move_settle
설정:     accounts(계정·직원) · setup(셋업)
```
`permissions`는 이 키들의 **부분집합 배열** (예: `["buildings","fee_items","arrears"]`).

### 3.2 role 매핑 (P0 enum 재사용: org_owner/manager/field/tenant)
| 화면 탭 | 유형 | role | permissions |
|---------|------|------|-------------|
| 사무실 관리자 | 마스터 | `org_owner` | (검사 안 함·전체) |
| 사무실 관리자 | 일반 | `manager` | 부여된 배열 |
| 현장 관리자 | 일반 | `field` | 부여된 배열 |
| 입주자(조회) | — | `tenant` | — (조회 전용, 본 단계 관리 안 함) |

- **org_owner = 전체 권한**: `permissions` 배열과 무관하게 항상 통과(short-circuit).
- 마스터는 org당 최소 1명 유지(마지막 org_owner 강등/비활성 금지 — §5.3).

---

## 4. DB 변경 — 마이그레이션 `0002_p1b_permissions.sql`

### 4.1 컬럼 추가
```sql
alter table org_members add column permissions jsonb not null default '[]'::jsonb;

-- 입주자 탭 '연결상태' 표시용(현재는 전부 미연결). tenant 포털 붙을 때 사용.
alter table occupancies add column tenant_user_id uuid references auth.users(id) on delete set null;
```

### 4.2 권한 검사 함수
```sql
create or replace function has_permission(p_module text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid())
      and m.org_id in (select my_org_ids())
      and (m.role = 'org_owner' or m.permissions ? p_module)  -- jsonb ? : 배열 원소 존재
  );
$$;
```

### 4.3 get_my_context 확장 (화면 게이팅용 permissions 반환)
`0000`의 `get_my_context()`를 `create or replace`로 갱신 — 반환에 `permissions jsonb` 추가:
```sql
create or replace function get_my_context()
returns table (org_id bigint, role org_member_role, org_status org_status,
               username text, full_name text, is_active boolean,
               must_change_password boolean, permissions jsonb)
language sql stable security definer set search_path = public as $$
  select m.org_id, m.role, o.status, p.username, p.full_name, p.is_active,
         p.must_change_password, m.permissions
  from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid()
  order by (o.status = 'active') desc, m.created_at
  limit 1
$$;
```
→ `MyContext`에 `permissions: string[]`, `useMe`로 전 화면에서 게이팅.

### 4.4 RLS 재구성 — 쓰기 권한 강제 (핵심)
P1a의 `for all` 단일 정책을 **select(조회: org 멤버 전체) + write(변경: 모듈 권한 필요)** 로 분리.
Postgres permissive 정책은 OR로 합쳐지므로, INSERT/UPDATE/DELETE는 write 정책만 적용되어 권한이 강제되고, SELECT는 select 정책으로 열린다.

민감 테이블 ↔ 모듈 매핑:
| 테이블 | 모듈 |
|--------|------|
| buildings / units / occupancies | `buildings` |
| fee_items | `fee_items` |
| vendors / vendor_categories | `vendors` |
| building_types | `buildings` (건물유형 config) |

예시(fee_items, 나머지 동형):
```sql
drop policy fi_all on fee_items;
create policy fi_select on fee_items for select
  using (org_id in (select my_org_ids()));
create policy fi_write on fee_items for all
  using (org_id in (select my_org_ids()) and has_permission('fee_items'))
  with check (org_id in (select my_org_ids()) and has_permission('fee_items'));
```
units/occupancies는 부모 org 스코프 유지 + `has_permission('buildings')` 결합:
```sql
drop policy unit_all on units;
create policy unit_select on units for select
  using (building_id in (select id from buildings where org_id in (select my_org_ids())));
create policy unit_write on units for all
  using (building_id in (select id from buildings where org_id in (select my_org_ids())) and has_permission('buildings'))
  with check (building_id in (select id from buildings where org_id in (select my_org_ids())) and has_permission('buildings'));
```
소프트삭제 RPC(`soft_delete_building/unit`, SECURITY INVOKER)도 이 write 정책을 그대로 통과해야 하므로, 권한 없는 사용자는 RPC 호출 시 0행 갱신(=차단)된다.

### 4.5 읽기 차단은 후속 (명시)
본 단계는 **쓰기(변경) 차단**까지 강제한다. 같은 org 내 **조회**는 열어 둔다(교차 모듈 화면이 데이터를 읽어야 함 — 예: 미납 화면이 부과 데이터 참조). org 간 격리는 P1a대로 유지. 모듈별 조회 차단이 필요하면 select 정책에 `has_permission` 추가로 후속 확장(스펙 리뷰에서 강도 조정 가능).

### 4.6 계정 테이블(profiles/org_members) 정책
- 계정 **변경**은 Edge Function(service_role)만 → profiles/org_members에 authenticated용 write 정책을 두지 않는다(= service_role 전용).
- 조회는 P0의 `member_select`/`profile_select`로 org 멤버가 자기 org 직원을 봄. `permissions` 컬럼도 `select *`로 함께 조회.

### 4.7 직원 리스트 RPC (PostgREST 임베드 회피)
`org_members`↔`profiles` 사이 직접 FK가 없어 PostgREST 자동조인이 불가 → 조인+org스코프를 담은 RPC로 처리:
```sql
create or replace function list_staff()
returns table (user_id uuid, role org_member_role, permissions jsonb,
               username text, full_name text, phone text,
               is_active boolean, must_change_password boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.role, m.permissions,
         p.username, p.full_name, p.phone, p.is_active, p.must_change_password
  from org_members m
  join profiles p on p.user_id = m.user_id
  where m.org_id in (select my_org_ids())
  order by (m.role = 'org_owner') desc, p.full_name
$$;
```
버킷(사무실/현장) 필터는 클라이언트에서 role로 분류.

---

## 5. 계정 프로비저닝 — Edge Functions (`supabase/functions/`)

공통: 요청 `Authorization: Bearer <user JWT>` → 사용자 스코프 클라이언트로 `getUser()` → service_role 클라이언트로 호출자의 `org_members`(org_id, role, permissions) 조회 → **인가**: `role='org_owner' OR permissions ? 'accounts'`. 대상 직원은 **호출자와 같은 org**여야 함.

### 5.1 `admin-create-staff`
입력: `{ username, fullName, phone, role, permissions[], initialPassword }`
1. 인가 확인, 호출자 org_id·slug 조회.
2. 같은 org 내 `username` 중복 확인(profiles ⨝ org_members, org_id=호출자org).
3. `admin.createUser({ email: loginEmail(slug, username), password: initialPassword, email_confirm: true })`.
4. `profiles` insert(username, full_name, phone, is_active=true, must_change_password=true).
5. `org_members` insert(org_id, user_id, role, permissions).
6. 실패 시 생성된 auth 유저 롤백(admin.deleteUser).
반환: `{ userId, username }`.

### 5.2 `admin-update-staff`
입력: `{ userId, fullName?, phone?, role?, permissions?, isActive? }`
- 인가 + 대상 동일 org 확인 → `profiles`(name/phone/is_active), `org_members`(role/permissions) 부분 갱신.

### 5.3 `admin-reset-password`
입력: `{ userId, newPassword }` → `admin.updateUserById(userId, { password })` + `profiles.must_change_password=true`.

### 5.4 자기보호 가드(공통)
- 자기 자신 비활성화·강등 금지.
- org의 **마지막 org_owner** 강등/비활성 금지(org당 마스터 ≥ 1).
- 삭제는 제공 안 함 → **비활성화(is_active=false)** 로 대체(로그인 차단은 P0 `useLogin` INACTIVE 가드가 이미 처리).

---

## 6. 데이터 계층 — `hooks/reactquery/staff/`
도메인 패턴(apis/keys/queries/mutations/index, rowToX/inputToRow) 준수.
- `listStaff()` → `rpc('list_staff')` (§4.7), camel 매핑; 버킷(사무실=org_owner+manager / 현장=field)은 클라이언트에서 role로 분류.
- `createStaff` / `updateStaff` / `resetStaffPassword` → `supabase.functions.invoke('admin-…', { body })`.
- `toggleStaffActive(userId, isActive)` → updateStaff 경유.
- `listTenantOverview()` (입주자 탭, 조회) → `from('occupancies').select('id,tenant_name,phone,tenant_user_id, units(unit_no, buildings(name))').is('deleted_at', null)`; 연결상태 = `tenant_user_id != null`.

## 7. 화면 — `app/(staff)/staff/staff-management/`
- 탭: 사무실 관리자 / 현장 관리자 / 입주자(조회).
- 리스트 컬럼: **이름 · 아이디 · 연락처 · 유형 · 상태**. (비밀번호 컬럼 없음 — §8)
- 계정 모달: 아이디 · 이름 · 연락처 · 유형(마스터/일반) · 상태(활성/비활성) · **권한 칩(모듈별 토글)** · 초기 비밀번호(신규 발급 시). 마스터 선택 시 권한 칩 비활성(전체).
- 비번 재발급 버튼(모달 내) → `admin-reset-password`.
- 입주자 탭: 건물 · 호실 · 입주자 · 연락처 · **연결상태(연결/미연결)** 읽기 전용 리스트.
- **게이팅**: 화면·좌측 nav 진입은 `useMe().permissions ⊇ {accounts}` 또는 role=org_owner. 각 모듈 nav 링크도 permissions로 표시/숨김.

## 8. 보안 결정
- **비밀번호는 표시·저장하지 않는다**(Supabase Auth 해시 보관). 프로토타입의 "비밀번호" 리스트 컬럼은 제외.
- service_role 키는 **Edge Function 내부(Deno)만**. 클라이언트/커밋 금지.
- Edge Function은 반드시 호출자 JWT를 검증(§5 공통). service_role로 무검증 실행 금지.

## 9. 테스트 전략
- 유닛: `has_permission` 매핑 로직은 통합(런타임)이지만, 데이터계층 래퍼(`functions.invoke` 모킹), zod 스키마, camel 매핑, 자기보호 가드(순수 함수로 분리해 테스트), 컴포넌트 RTL(권한 칩 토글·탭·게이팅 분기).
- Edge Function 본체 + RLS 강제 검증은 **런타임(pending-user)** — 로컬 `supabase functions serve` 또는 배포 후 E2E.

## 10. pending-user (배포·적용)
1. 마이그레이션 `0002_p1b_permissions.sql` 적용.
2. Edge Functions 배포: `supabase functions deploy admin-create-staff admin-update-staff admin-reset-password`.
3. seed의 org_owner에는 permissions 불필요(전체). 일반 직원 발급은 화면에서.
4. E2E: 마스터 로그인 → 일반계정 발급(초기비번) → 재로그인 시 비번변경 안내 → 권한 없는 모듈 쓰기 차단(RLS) 확인.

## 11. 범위 외 / 후속(리뷰 리스트와 연결)
- fee_items 부과방식/단가 모델(P1c/P3), 세대당 활성입주 유일제약(P3/P4), 모듈별 **읽기** 차단(필요 시), 감사로그를 변경(CUD)까지 확장(P3).

## 12. 스펙 리뷰에서 확인할 열린 결정
- **A. 계정 관리 권한 위임**: 계정관리를 org_owner 전용으로 할지, `accounts` 권한을 가진 일반도 허용할지. (본 설계: **둘 다 허용** = org_owner OR accounts 권한. 프로토타입 '계정·직원' 칩과 일치.)
- **B. 읽기 차단 강도**: 본 단계 쓰기 차단만(권장) vs 특정 민감 모듈은 읽기까지 차단.
- **C. role 세분**: 사무실=manager / 현장=field 2종으로 충분한지(프로토타입 '유형'은 마스터/일반뿐; 탭이 사무실/현장 구분).
