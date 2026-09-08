# 워크포스 겸직 Capabilities 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한 워크포스 계정이 사무실(`manager_staff`)과 현장(`field_staff`/`support_staff`) 자격을 동시에 보유(겸직)할 수 있게 하고, 두 앱(/staff·/partner)에 모두 로그인·접근하도록 한다.

**Architecture:** `org_members`에 `staff_capabilities jsonb`(값=`staff_type` 문자열 배열)를 추가한다. `staff_type`은 primary(표시·기본탭·display)로 유지하고, `staff_capabilities`가 "어느 앱 접근"의 authoritative 소스가 된다. persona 술어(`current_user_is_manager_staff`/`current_user_is_field_partner`, 0147)의 바디를 `staff_type` 단일검사 → `staff_capabilities` 보유검사로 바꾼다. 페이지·API 게이트는 술어를 호출하므로 무변경으로 연동된다(예외: partner 레이아웃이 술어를 우회 → 공유 헬퍼로 편입). 불변식 `staff_type ∈ staff_capabilities`는 마이그 백필과 RPC 정규화로 보장한다.

**Tech Stack:** Next.js(App Router, 서버컴포넌트 게이트), Supabase(Postgres RPC·jsonb, SECURITY DEFINER), TypeScript, react-hook-form + zod, vitest.

**선행 스펙:** `docs/superpowers/specs/2026-09-08-staff-capabilities-design.md`

## Global Constraints

- **신규 단위 test 작성 금지**(프로젝트 정책 [[unit-tests-postponed]]). 검증 = `tsc`/`lint`/`build`/**기존 vitest 그린** + 스팟체크. 동작·타입이 바뀌어 **깨지는 기존 테스트만** 갱신한다.
- **프로덕션 마이그 적용은 사용자가 `!`로 직접 실행**(classifier 차단). 에이전트는 SQL 파일 작성·커밋까지만. 적용: `node --env-file=.env.local scripts/db-query.mjs < supabase/migrations/<file>.sql` → `[]` 출력이면 성공.
- **마이그 번호**: 작업 파일명은 `0148_staff_capabilities.sql`. **커밋 직전** `git fetch` 후 `origin/master`의 `supabase/migrations` max + 로컬 미커밋 max를 재확인(remote에 이중 `0146` 이력 존재). 충돌 시 리네임.
- **타입은 optional additive**: `staffCapabilities?: StaffType[]`. 매퍼는 항상 채우되 타입은 optional이라 기존 리터럴 fixture가 tsc를 깨지 않는다.
- **staff_type은 폐기하지 않는다**(primary/display 유지). capabilities는 별개 축(어느 앱). `feature_permissions`(앱 내부 기능)와도 별개 축 — 무변경.
- 브랜치: `feat/staff-capabilities`. 모든 커밋 메시지 말미에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- 검증 명령: `npx tsc --noEmit` / `npx vitest run <path>` / `npm run lint` / `npx next build --webpack`(dev 서버가 `.next`를 잠그면 dev 중지 후 실행).

---

### Task 1: 마이그레이션 파일 (스키마 + 술어 + RPC)

한 파일에 컬럼·CHECK·백필·정규화 헬퍼·술어 2개·`provision_member`·`admin_update_member_basic`·`admin_set_member_permissions`·`get_my_context`·`list_accounts`를 담는다. 라이브 적용은 Task 8 체크포인트(사용자).

**Files:**
- Create: `supabase/migrations/0148_staff_capabilities.sql`

**Interfaces (Produces):**
- 컬럼 `org_members.staff_capabilities jsonb`(값=`staff_type` 문자열 배열, 불변식 primary 포함).
- `normalize_staff_capabilities(p_caps jsonb, p_primary staff_type) returns jsonb` — caps에 primary 주입 + dedup.
- `get_my_context()` 반환에 `staff_capabilities jsonb` 추가(컬럼 순서: …, permissions, **staff_capabilities**).
- `list_accounts()` 반환에 `staff_capabilities jsonb` 추가(마지막 컬럼).
- `provision_member(...)` 12번째 인자 `p_staff_capabilities jsonb default null`.
- `admin_update_member_basic(...)` 8번째 인자 `p_staff_capabilities jsonb default null`.
- 술어 `current_user_is_manager_staff`/`current_user_is_field_partner` — capabilities 보유 검사.

- [ ] **Step 1: 마이그 파일 작성**

`supabase/migrations/0148_staff_capabilities.sql`:

```sql
-- 0148_staff_capabilities.sql
-- 워크포스 겸직 capabilities: org_members에 staff_capabilities jsonb(값=staff_type 문자열 배열) 추가.
-- staff_type은 primary(표시/기본탭)로 유지, capabilities가 '앱 접근'의 authoritative 소스.
-- 불변식: staff_type ∈ staff_capabilities. persona 술어(0147) 바디를 capabilities로 교체.
-- 의존: 0002(staff_type enum, org_members 확장, get_my_context, list_accounts, admin_* RPC),
--       0033(provision_member 11-arg), 0011(current_user_is_platform_admin), 0147(persona 술어).

-- ── 1) 컬럼 + 배열 타입 가드 ──
alter table org_members
  add column if not exists staff_capabilities jsonb not null default '[]'::jsonb;

alter table org_members drop constraint if exists org_members_staff_capabilities_is_array;
alter table org_members
  add constraint org_members_staff_capabilities_is_array
  check (jsonb_typeof(staff_capabilities) = 'array');

-- ── 2) 백필: 기존 단일 staff_type → 1원소 배열(불변식 성립) ──
update org_members
  set staff_capabilities = jsonb_build_array(staff_type::text)
  where staff_capabilities = '[]'::jsonb;

-- ── 3) 정규화 헬퍼: caps에 primary 주입 + 중복제거(정렬) ──
create or replace function normalize_staff_capabilities(p_caps jsonb, p_primary staff_type)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(distinct e order by e), '[]'::jsonb)
  from jsonb_array_elements_text(
    coalesce(p_caps, '[]'::jsonb) || jsonb_build_array(p_primary::text)
  ) as e;
$$;

-- ── 4) persona 술어(0147 재정의): staff_type → staff_capabilities ──
create or replace function current_user_is_manager_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid()) and m.staff_capabilities ? 'manager_staff'
  )
  and exists (
    select 1 from profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  )
$$;
revoke execute on function current_user_is_manager_staff() from public, anon;
grant execute on function current_user_is_manager_staff() to authenticated;

create or replace function current_user_is_field_partner() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid())
      and m.staff_capabilities ?| array['field_staff','support_staff']
  )
  and exists (
    select 1 from profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  )
$$;
revoke execute on function current_user_is_field_partner() from public, anon;
grant execute on function current_user_is_field_partner() to authenticated;

-- ── 5) get_my_context: staff_capabilities 반환 추가(additive) ──
drop function if exists get_my_context();
create function get_my_context()
returns table (org_id bigint, role org_member_role, org_status org_status,
               username text, full_name text, is_active boolean, must_change_password boolean,
               staff_type staff_type, permissions jsonb, staff_capabilities jsonb)
language sql stable security definer set search_path = public as $$
  select m.org_id, m.role, o.status, p.username, p.full_name, p.is_active, p.must_change_password,
         m.staff_type, coalesce(m.feature_permissions, '[]'::jsonb),
         coalesce(m.staff_capabilities, '[]'::jsonb)
  from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid()
  order by (o.status = 'active') desc, m.created_at
  limit 1
$$;

-- ── 6) provision_member(0033 11-arg) → 12-arg(+p_staff_capabilities) ──
drop function if exists provision_member(uuid,text,text,text,text,org_member_role,staff_type,jsonb,text,bigint[],bigint);
create or replace function provision_member(
  p_user_id uuid, p_username text, p_full_name text, p_phone text, p_phone_sub text,
  p_role org_member_role, p_staff_type staff_type, p_permissions jsonb,
  p_affiliation text, p_role_ids bigint[], p_target_org_id bigint default null,
  p_staff_capabilities jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_caps jsonb;
begin
  if current_user_is_platform_admin() and p_target_org_id is not null then
    v_org := p_target_org_id;
  else
    v_org := current_user_org();
  end if;
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
  if not current_user_is_master() then p_role := 'staff'; p_permissions := '[]'::jsonb; end if;
  v_caps := normalize_staff_capabilities(p_staff_capabilities, p_staff_type);
  insert into profiles(user_id, username, full_name, phone, phone_sub, must_change_password)
    values (p_user_id, lower(p_username), p_full_name, nullif(p_phone,''), nullif(p_phone_sub,''), true);
  insert into org_members(org_id, user_id, role, staff_type, feature_permissions, affiliation, staff_capabilities)
    values (v_org, p_user_id, p_role, p_staff_type, coalesce(p_permissions,'[]'::jsonb), nullif(p_affiliation,''), v_caps);
  if p_role_ids is not null then
    insert into org_member_roles(org_id, user_id, role_id) select v_org, p_user_id, unnest(p_role_ids);
  end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'ACCOUNT_CREATE', 'org_members', p_user_id::text,
      jsonb_build_object('username',lower(p_username),'role',p_role,'staff_type',p_staff_type,'staff_capabilities',v_caps));
end $$;
revoke execute on function provision_member(uuid,text,text,text,text,org_member_role,staff_type,jsonb,text,bigint[],bigint,jsonb) from anon;

-- ── 7) admin_update_member_basic(0002) → +p_staff_capabilities ──
drop function if exists admin_update_member_basic(uuid,text,text,text,staff_type,text,bigint[]);
create or replace function admin_update_member_basic(
  p_user_id uuid, p_full_name text, p_phone text, p_phone_sub text,
  p_staff_type staff_type, p_affiliation text, p_role_ids bigint[],
  p_staff_capabilities jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if not current_user_has_module('accounts') then raise exception 'forbidden: accounts required'; end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  update profiles set full_name = p_full_name, phone = nullif(p_phone,''), phone_sub = nullif(p_phone_sub,'')
    where user_id = p_user_id;
  update org_members set staff_type = p_staff_type, affiliation = nullif(p_affiliation,''),
    staff_capabilities = normalize_staff_capabilities(coalesce(p_staff_capabilities, staff_capabilities), p_staff_type)
    where user_id = p_user_id and org_id = v_org;
  if p_role_ids is not null then
    delete from org_member_roles where user_id = p_user_id and org_id = v_org;
    insert into org_member_roles(org_id,user_id,role_id) select v_org,p_user_id,unnest(p_role_ids); end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk)
    values (v_org, auth.uid(), 'ACCOUNT_UPDATE', 'profiles', p_user_id::text);
end $$;
revoke execute on function admin_update_member_basic(uuid,text,text,text,staff_type,text,bigint[],jsonb) from anon;

-- ── 8) admin_set_member_permissions(0002): 시그니처 유지, caps 불변식 방어적 재주입 ──
create or replace function admin_set_member_permissions(
  p_user_id uuid, p_role org_member_role, p_staff_type staff_type,
  p_permissions jsonb, p_role_ids bigint[]
) returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint; v_other_masters int;
begin
  v_org := current_user_org();
  if not current_user_is_master() then raise exception 'forbidden: master only'; end if;
  if not exists (select 1 from org_members where user_id = p_user_id and org_id = v_org) then
    raise exception 'target not in org'; end if;
  if p_user_id = auth.uid() and p_role not in ('org_owner','platform_admin') then
    select count(*) into v_other_masters from org_members
      where org_id = v_org and role in ('org_owner','platform_admin') and user_id <> p_user_id;
    if v_other_masters = 0 then raise exception 'must keep at least one master'; end if;
  end if;
  update org_members set role = p_role, staff_type = p_staff_type,
    feature_permissions = coalesce(p_permissions,'[]'::jsonb),
    staff_capabilities = normalize_staff_capabilities(staff_capabilities, p_staff_type)
    where user_id = p_user_id and org_id = v_org;
  if p_role_ids is not null then
    delete from org_member_roles where user_id = p_user_id and org_id = v_org;
    insert into org_member_roles(org_id,user_id,role_id) select v_org,p_user_id,unnest(p_role_ids); end if;
  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'PERMISSION_CHANGE', 'org_members', p_user_id::text,
      jsonb_build_object('role',p_role,'staff_type',p_staff_type,'permissions',p_permissions));
end $$;
revoke execute on function admin_set_member_permissions(uuid,org_member_role,staff_type,jsonb,bigint[]) from anon;

-- ── 9) list_accounts(0002): staff_capabilities 반환 추가 ──
drop function if exists list_accounts(text, staff_type);
create or replace function list_accounts(p_search text default null, p_type staff_type default null)
returns table (user_id uuid, username text, full_name text, phone text, phone_sub text,
               role org_member_role, staff_type staff_type, affiliation text, is_active boolean,
               permissions jsonb, role_labels text[], staff_capabilities jsonb)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.username, p.full_name, p.phone, p.phone_sub,
         m.role, m.staff_type, m.affiliation, p.is_active,
         coalesce(m.feature_permissions,'[]'::jsonb),
         coalesce(array_agg(sr.label order by sr.sort_order) filter (where sr.id is not null), '{}'),
         coalesce(m.staff_capabilities, '[]'::jsonb)
  from org_members m
  join profiles p on p.user_id = m.user_id
  left join org_member_roles omr on omr.user_id = m.user_id and omr.org_id = m.org_id
  left join staff_roles sr on sr.id = omr.role_id and sr.deleted_at is null
  where m.org_id = current_user_org()
    and (p_type is null or m.staff_type = p_type)
    and (p_search is null or p.full_name ilike '%'||p_search||'%'
         or p.username ilike '%'||p_search||'%'
         or p.phone ilike '%'||p_search||'%' or p.phone_sub ilike '%'||p_search||'%')
  group by p.user_id, p.username, p.full_name, p.phone, p.phone_sub,
           m.role, m.staff_type, m.affiliation, p.is_active, m.feature_permissions, m.staff_capabilities
  order by p.full_name
$$;
revoke execute on function list_accounts(text,staff_type) from anon;
```

- [ ] **Step 2: SQL 정합 self-review (라이브 미적용)**

classifier가 라이브 적용을 막으므로 여기선 파일 정합만 검토한다. 확인:
- 술어 `?`/`?|`는 jsonb 배열 원소 검사(`'["manager_staff"]'::jsonb ? 'manager_staff'` = true).
- `get_my_context`·`list_accounts`는 반환 컬럼 변경이라 `drop function` 선행함.
- `provision_member`·`admin_update_member_basic`는 시그니처 변경이라 구 시그니처 `drop` 선행함. `admin_set_member_permissions`는 시그니처 유지라 `create or replace`.
- platform 호출자(`app/api/platform/accounts/route.ts`, `app/api/platform/organizations/route.ts`)는 named-arg라 `p_staff_capabilities` 미전달 시 default null → `[primary]`. 회귀 없음.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0148_staff_capabilities.sql
git commit -m "$(cat <<'EOF'
feat(security): org_members.staff_capabilities + 술어/RPC capabilities 전환 (겸직)

컬럼·CHECK·백필·normalize 헬퍼 + persona 술어 2개 capabilities 검사 전환 +
provision_member/admin_update_member_basic +p_staff_capabilities +
admin_set_member_permissions 불변식 재주입 + get_my_context/list_accounts 반환 확장.
라이브 적용은 사용자 실행(classifier 차단).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: partner 페이지 게이트를 술어 seam으로 편입

partner `(app)` 레이아웃이 `ctx.staff_type`을 직접 검사(술어 우회) → `requirePersona("field_partner")`로 전환. 겸직자가 partner 페이지를 통과하게 되고 게이트 통일이 완성된다.

**Files:**
- Modify: `app/(partner)/partner/(app)/layout.tsx` (전체 교체)

- [ ] **Step 1: 레이아웃 교체**

`app/(partner)/partner/(app)/layout.tsx` 전체를:

```tsx
import type { ReactNode } from "react";
import { requirePersona } from "@/lib/auth/requirePersona";

// 파트너 앱(로그인 제외) 공통 가드: 현장(field/support) capability 보유자만 통과.
// persona 술어 seam으로 편입(겸직 지원). 무세션→/partner/mobile-login, persona 불일치→중립 '/'.
export default async function PartnerAppLayout({ children }: { children: ReactNode }) {
  await requirePersona("field_partner", "/partner/mobile-login");
  return <>{children}</>;
}
```

- [ ] **Step 2: 검증**

Run: `npx tsc --noEmit`
Expected: 0 errors.
Run: `npx eslint app/(partner)/partner/(app)/layout.tsx`
Expected: clean.

- [ ] **Step 3: 커밋**

```bash
git add "app/(partner)/partner/(app)/layout.tsx"
git commit -m "$(cat <<'EOF'
feat(security): partner 페이지 게이트를 requirePersona(field_partner)로 편입

ctx.staff_type 직접검사 → 공유 헬퍼(술어 seam). 겸직자 partner 접근 허용.
불일치 리다이렉트 /staff → 중립 '/'(트랙 표준). 무세션 /partner/mobile-login 유지.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 타입 & 훅 (additive) + getMyContext 테스트

`staffCapabilities`를 optional로 추가하고 매퍼가 채운다. 편집폼 사전선택·배지·프로비저닝 전달의 기반.

**Files:**
- Modify: `hooks/reactquery/auth/apis.ts` (MyContext + getMyContext 매퍼)
- Modify: `hooks/reactquery/accounts/apis.ts` (Account/AccountRow/rowToAccount/AccountCreateInput/AccountBasicInput/updateAccountBasic)
- Modify: `hooks/reactquery/auth/apis.test.ts` (getMyContext 기대값)

**Interfaces (Produces):**
- `MyContext.staffCapabilities?: StaffType[]`
- `Account.staffCapabilities?: StaffType[]`, `AccountCreateInput.staffCapabilities?: StaffType[]`, `AccountBasicInput.staffCapabilities?: StaffType[]`
- `updateAccountBasic`가 `p_staff_capabilities` 전달.

- [ ] **Step 1: auth/apis.ts — MyContext + 매퍼**

`hooks/reactquery/auth/apis.ts`의 `MyContext` 인터페이스에 `permissions` 위(또는 아래)로 필드 추가:

```ts
  /** 계정 유형(PRD "유형"). role과 직교. */
  staffType: StaffType;
  /** 보유 앱 접근 자격(겸직). staffType(primary)을 항상 포함. 미설정 계정은 []. */
  staffCapabilities?: StaffType[];
  /** Module permission keys granted to this user (empty for org_owner who has all). */
  permissions: string[];
```

`getMyContext()`의 반환 매핑에 한 줄 추가(`staffType` 다음):

```ts
    staffType: row.staff_type,
    staffCapabilities: Array.isArray(row.staff_capabilities) ? row.staff_capabilities : [],
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
```

- [ ] **Step 2: accounts/apis.ts — Account 타입 + 매퍼 + 입력 + updateAccountBasic**

`Account`에 필드 추가:

```ts
export interface Account {
  userId: string; username: string; fullName: string;
  phone: string | null; phoneSub: string | null;
  role: OrgMemberRole; staffType: StaffType; affiliation: string | null;
  isActive: boolean; permissions: string[]; roleLabels: string[];
  staffCapabilities?: StaffType[];
}
```

`AccountCreateInput`·`AccountBasicInput`에 각각 `staffCapabilities?: StaffType[];` 추가:

```ts
export interface AccountCreateInput {
  username: string; password: string; fullName: string;
  phone?: string; phoneSub?: string;
  role: OrgMemberRole; staffType: StaffType;
  permissions: string[]; affiliation?: string; roleIds: number[];
  staffCapabilities?: StaffType[];
}
export interface AccountBasicInput {
  fullName: string; phone?: string; phoneSub?: string;
  staffType: StaffType; affiliation?: string; roleIds: number[] | null;
  staffCapabilities?: StaffType[];
}
```

`AccountRow`에 `staff_capabilities?: unknown;` 추가하고 `rowToAccount`가 매핑:

```ts
type AccountRow = {
  user_id: string; username: string; full_name: string;
  phone: string | null; phone_sub: string | null;
  role: OrgMemberRole; staff_type: StaffType; affiliation: string | null;
  is_active: boolean; permissions: unknown; role_labels: unknown;
  staff_capabilities?: unknown;
};

const rowToAccount = (r: AccountRow): Account => ({
  userId: r.user_id, username: r.username, fullName: r.full_name,
  phone: r.phone, phoneSub: r.phone_sub, role: r.role, staffType: r.staff_type,
  affiliation: r.affiliation, isActive: r.is_active,
  permissions: Array.isArray(r.permissions) ? r.permissions : [],
  roleLabels: Array.isArray(r.role_labels) ? r.role_labels : [],
  staffCapabilities: Array.isArray(r.staff_capabilities) ? (r.staff_capabilities as StaffType[]) : [],
});
```

`updateAccountBasic`가 `p_staff_capabilities` 전달:

```ts
export async function updateAccountBasic(userId: string, input: AccountBasicInput): Promise<void> {
  const { error } = await createClient().rpc("admin_update_member_basic", {
    p_user_id: userId, p_full_name: input.fullName, p_phone: input.phone ?? null,
    p_phone_sub: input.phoneSub ?? null, p_staff_type: input.staffType,
    p_affiliation: input.affiliation ?? null, p_role_ids: input.roleIds,
    p_staff_capabilities: input.staffCapabilities ?? null,
  });
  if (error) throw new Error(error.message);
}
```

> `createAccount`는 `JSON.stringify(input)`으로 body를 보내므로 `staffCapabilities`가 있으면 자동 포함 — 코드 변경 없음. `updatePermissions`는 caps를 다루지 않으므로 **변경하지 않는다**(불변식은 RPC 내부에서 방어적 재주입).

- [ ] **Step 3: getMyContext 테스트 기대값 갱신**

`hooks/reactquery/auth/apis.test.ts`의 "rpc 결과 첫 행을 카멜케이스로 매핑" 테스트에서 mock row와 기대값에 capabilities 추가:

mock(`rpc.mockResolvedValue`) row에 `staff_capabilities: ["manager_staff"],` 추가:

```ts
    rpc.mockResolvedValue({ data: [{
      org_id: 1, role: "staff", org_status: "active",
      username: "hong", full_name: "홍길동", is_active: true, must_change_password: false,
      staff_type: "manager_staff", permissions: ["buildings"], staff_capabilities: ["manager_staff"],
    }], error: null });
```

기대 객체에 `staffCapabilities: ["manager_staff"],` 추가:

```ts
    expect(ctx).toEqual({
      orgId: 1, role: "staff", orgStatus: "active",
      username: "hong", fullName: "홍길동", isActive: true, mustChangePassword: false,
      staffType: "manager_staff", staffCapabilities: ["manager_staff"], permissions: ["buildings"],
    });
```

- [ ] **Step 4: 검증**

Run: `npx tsc --noEmit`
Expected: 0 errors.
Run: `npx vitest run hooks/reactquery/auth/apis.test.ts hooks/reactquery/accounts/apis.test.ts`
Expected: 전건 PASS (accounts/apis는 toMatchObject라 무변경 그린).

- [ ] **Step 5: 커밋**

```bash
git add hooks/reactquery/auth/apis.ts hooks/reactquery/accounts/apis.ts hooks/reactquery/auth/apis.test.ts
git commit -m "$(cat <<'EOF'
feat(security): staffCapabilities optional 타입 + 매퍼 + updateAccountBasic 전달

MyContext·Account·AccountCreate/BasicInput +staffCapabilities?(optional additive).
getMyContext/rowToAccount 매퍼 채움. updateAccountBasic p_staff_capabilities 전달.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: staff 로그인 — capability 기준 판정

멤버십 SQL `staff_type` 필터 제거 → `staff_capabilities` select 후 JS 검사. 세션 후 재검사도 caps 기반. 반환 컨텍스트에 `staffCapabilities` 포함.

**Files:**
- Modify: `app/api/staff/login/route.ts`
- Modify: `app/api/staff/login/route.test.ts`

- [ ] **Step 1: route.ts — 멤버십 쿼리 capability 기준으로**

`app/api/staff/login/route.ts`의 멤버십 조회 블록(현행 70–86행)을 교체:

```ts
  const { data: memberships, error: membershipError } = await admin
    .from("org_members")
    .select("user_id, staff_capabilities")
    .in("user_id", profileIds);

  if (membershipError) {
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }

  const officeUserIds = [
    ...new Set(
      (memberships ?? [])
        .filter(
          (m) => Array.isArray(m.staff_capabilities) && m.staff_capabilities.includes("manager_staff"),
        )
        .map((m) => m.user_id as string),
    ),
  ];
  if (officeUserIds.length === 0) {
    await recordLoginFailure(admin, { ip, username });
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }
```

- [ ] **Step 2: route.ts — 세션 후 재검사 + 반환 컨텍스트**

재검사·컨텍스트 블록(현행 108–123행)을 교체:

```ts
    const row = Array.isArray(contextData) ? contextData[0] : contextData;
    const caps = Array.isArray(row?.staff_capabilities) ? (row.staff_capabilities as string[]) : [];
    if (!row || !caps.includes("manager_staff")) return rejectAccess(NO_ACCESS);
    if (!row.is_active) return rejectAccess(INACTIVE);
    if (row.org_status !== "active") return rejectAccess(SUSPENDED);

    const context = {
      orgId: row.org_id,
      role: row.role,
      orgStatus: row.org_status,
      username: row.username,
      fullName: row.full_name,
      isActive: row.is_active,
      mustChangePassword: row.must_change_password,
      staffType: row.staff_type,
      staffCapabilities: caps,
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
    };
```

- [ ] **Step 3: route.test.ts — mock 체인 & fixture 갱신**

`app/api/staff/login/route.test.ts` 편집:

(a) hoisted mocks에서 `membershipStaffTypeEq: vi.fn(),` 줄 삭제.

(b) `CONTEXT_ROW`에 `staff_capabilities: ["manager_staff"],` 추가(예: `staff_type` 다음). `CONTEXT`에 `staffCapabilities: ["manager_staff"],` 추가(`staffType` 다음).

(c) beforeEach에서 멤버십 mock 체인 교체:

```ts
  mocks.membershipSelect.mockReturnValue({ in: mocks.membershipIn });
  mocks.membershipIn.mockResolvedValue({
    data: [{ user_id: "office-1", staff_capabilities: ["manager_staff"] }],
    error: null,
  });
```
(기존 `mocks.membershipIn.mockReturnValue({ eq: mocks.membershipStaffTypeEq });`와 `mocks.membershipStaffTypeEq.mockResolvedValue(...)` 두 줄을 위로 대체.)

(d) "정규화한 아이디로 manager_staff를 찾아…" 테스트: `expect(mocks.membershipStaffTypeEq).toHaveBeenCalledWith("staff_type", "manager_staff");` 줄을 삭제하고 다음으로 대체:

```ts
    expect(mocks.membershipSelect).toHaveBeenCalledWith("user_id, staff_capabilities");
    expect(mocks.membershipIn).toHaveBeenCalledWith("user_id", ["office-1"]);
```

(e) "동일 아이디 후보 중…" 테스트: `mocks.membershipStaffTypeEq.mockResolvedValue(...)`를 교체:

```ts
    mocks.membershipIn.mockResolvedValue({
      data: [
        { user_id: "office-1", staff_capabilities: ["manager_staff"] },
        { user_id: "office-2", staff_capabilities: ["manager_staff"] },
      ],
      error: null,
    });
```

(f) "내근 계정이 아닌 후보에도…" 테스트: `mocks.membershipStaffTypeEq.mockResolvedValue({ data: [], error: null });`를 교체(현장 capability만 있는 후보 → JS 필터가 배제):

```ts
    mocks.membershipIn.mockResolvedValue({
      data: [{ user_id: "field-1", staff_capabilities: ["field_staff"] }],
      error: null,
    });
```

- [ ] **Step 4: 검증**

Run: `npx vitest run app/api/staff/login/route.test.ts`
Expected: 전건 PASS.
Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: 커밋**

```bash
git add app/api/staff/login/route.ts app/api/staff/login/route.test.ts
git commit -m "$(cat <<'EOF'
feat(security): staff 로그인 capability 기준 판정 + 재검사

멤버십 staff_type 필터 → staff_capabilities JS 검사. 세션 후 재검사 caps 기반
(field-primary 겸직자 오거부 방지). 반환 컨텍스트 staffCapabilities 포함.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: partner 로그인 — capability 기준 판정

**Files:**
- Modify: `app/api/partner/login/route.ts`

- [ ] **Step 1: route.ts — 현장 후보를 capability로**

`app/api/partner/login/route.ts`의 "2) 현장 계정 후보로 좁히기" 블록(현행 65–78행)을 교체:

```ts
  // 2) 현장 capability 보유 후보로 좁히기
  const { data: members, error: memberErr } = await admin
    .from("org_members")
    .select("user_id, staff_capabilities")
    .in("user_id", activeIds);
  if (memberErr) {
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
  const fieldIds = [
    ...new Set(
      (members ?? [])
        .filter(
          (m) =>
            Array.isArray(m.staff_capabilities) &&
            (m.staff_capabilities as string[]).some((c) => FIELD_TYPES.includes(c)),
        )
        .map((m) => m.user_id as string),
    ),
  ];
  if (fieldIds.length === 0) {
    await recordLoginFailure(admin, { ip, username });
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }
```

(`FIELD_TYPES` 상수·이후 세션 루프·반환 `{ userId }`는 그대로.)

- [ ] **Step 2: 검증**

Run: `npx tsc --noEmit`
Expected: 0 errors.
Run: `npx eslint app/api/partner/login/route.ts`
Expected: clean.

- [ ] **Step 3: 커밋**

```bash
git add app/api/partner/login/route.ts
git commit -m "$(cat <<'EOF'
feat(security): partner 로그인 capability 기준 판정

현장 후보 staff_type IN 필터 → staff_capabilities JS 검사(field/support 보유).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 계정 생성 API — p_staff_capabilities 전달

**Files:**
- Modify: `app/api/accounts/route.ts`

- [ ] **Step 1: route.ts — body 파싱 + RPC 전달**

`app/api/accounts/route.ts`의 body 구조분해(현행 30행)에 `staffCapabilities` 추가:

```ts
  const { username, password, fullName, phone, phoneSub, role, staffType, permissions, affiliation, roleIds, staffCapabilities } = body ?? {};
```

`provision_member` 호출(현행 55–61행)에 인자 추가:

```ts
  const { error: rpcErr } = await supabase.rpc("provision_member", {
    p_user_id: created.user.id, p_username: username, p_full_name: fullName,
    p_phone: phone ?? null, p_phone_sub: phoneSub ?? null,
    p_role: role ?? "staff", p_staff_type: staffType,
    p_permissions: permissions ?? [], p_affiliation: affiliation ?? null,
    p_role_ids: roleIds ?? null,
    p_staff_capabilities: staffCapabilities ?? null,
  });
```

- [ ] **Step 2: 검증**

Run: `npx vitest run app/api/accounts/route.test.ts`
Expected: 전건 PASS (기존 테스트는 `expect.objectContaining`이라 신규 인자에도 그린).
Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: 커밋**

```bash
git add app/api/accounts/route.ts
git commit -m "$(cat <<'EOF'
feat(security): 계정 생성 API에서 provision_member로 staffCapabilities 전달

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 프로비저닝 UI — 겸직 토글 + 목록 배지

계정 폼에 "다른 앱 접근 허용" 토글, 목록 행에 겸직 배지. primary는 현행 탭 기반 유지.

**Files:**
- Modify: `components/forms/schema/account.ts` (alsoCrossApp 필드)
- Modify: `app/(staff)/staff/(app)/accounts/components/AccountFormModal.tsx` (토글 + caps 계산)
- Modify: `app/(staff)/staff/(app)/accounts/components/AccountTable.tsx` (배지)

- [ ] **Step 1: 스키마에 alsoCrossApp 추가**

`components/forms/schema/account.ts`의 `base`에 필드 추가:

```ts
const base = {
  fullName: z.string().min(1, "이름을 입력해 주세요"),
  phone: z.string().optional(),
  phoneSub: z.string().optional(),
  staffType: z.enum(STAFF_TYPES),
  isMaster: z.boolean().default(false),
  isActive: z.boolean().default(true),
  affiliation: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  roleIds: z.array(z.number()).default([]),
  alsoCrossApp: z.boolean().default(false),
};
```

- [ ] **Step 2: AccountFormModal — FormValues + defaults + 토글 + onValid**

(a) `FormValues` 인터페이스에 `alsoCrossApp: boolean;` 추가.

(b) `makeDefaults`의 editing 분기에 `alsoCrossApp` 계산 추가, create 분기에 `alsoCrossApp: false` 추가:

```ts
      editing
        ? {
            username: editing.username,
            password: "",
            fullName: editing.fullName,
            phone: editing.phone ?? "",
            staffType: editing.staffType,
            isMaster: editing.role === "org_owner" || editing.role === "platform_admin",
            isActive: editing.isActive,
            permissions: editing.permissions,
            alsoCrossApp: (() => {
              const caps = editing.staffCapabilities ?? [];
              const primaryIsField =
                editing.staffType === "field_staff" || editing.staffType === "support_staff";
              return primaryIsField
                ? caps.includes("manager_staff")
                : caps.some((c) => c === "field_staff" || c === "support_staff");
            })(),
          }
        : {
            username: "",
            password: "",
            fullName: "",
            phone: "",
            staffType: createStaffType,
            isMaster: false,
            isActive: true,
            permissions: [],
            alsoCrossApp: false,
          },
```

(c) 토글 UI: 필드 grid `</div>`(현행 295행) 다음, "페이지별 권한" 섹션(`<div className="mt-5">`) 앞에 삽입:

```tsx
            <div className="mt-4 rounded-xl border border-line bg-bg/40 p-3">
              <Controller
                control={control}
                name="alsoCrossApp"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm font-semibold text-t2">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      aria-label="겸직 다른 앱 접근 허용"
                    />
                    {isField ? "사무실 앱도 접근 허용(겸직)" : "현장 앱도 접근 허용(겸직)"}
                  </label>
                )}
              />
              <p className="mt-1 text-xs text-t4">
                체크하면 이 계정이 {isField ? "사무실 웹앱(/staff)" : "현장 모바일앱(/partner)"}에도
                로그인·접근할 수 있습니다.
              </p>
            </div>
```

(d) `onValid`에서 caps 계산 후 create·updateBasic 입력에 포함:

```ts
  const onValid = async (values: FormValues) => {
    const role = values.isMaster
      ? "org_owner"
      : values.staffType === "field_staff"
        ? "field"
        : "staff";

    const crossType: StaffType = isField ? "manager_staff" : "field_staff";
    const staffCapabilities: StaffType[] = values.alsoCrossApp
      ? [values.staffType, crossType]
      : [values.staffType];

    if (!isEdit) {
      const created = await onCreate({
        username: values.username,
        password: values.password,
        fullName: values.fullName,
        phone: values.phone || undefined,
        role,
        staffType: values.staffType,
        permissions: values.permissions,
        roleIds: [],
        staffCapabilities,
      });
      if (!values.isActive) await onSetActive(created.userId, false);
    } else if (editing) {
      await onUpdateBasic(editing.userId, {
        fullName: values.fullName,
        phone: values.phone || undefined,
        phoneSub: editing.phoneSub || undefined,
        staffType: values.staffType,
        affiliation: editing.affiliation || undefined,
        roleIds: null,
        staffCapabilities,
      });
      if (canEditPermissions) {
        await onUpdatePermissions(editing.userId, {
          role,
          staffType: values.staffType,
          permissions: values.permissions,
          roleIds: null,
        });
      }
      if (values.password) await onResetPassword(editing.userId, values.password);
      if (values.isActive !== editing.isActive) {
        await onSetActive(editing.userId, values.isActive);
      }
    }
    onClose();
  };
```

- [ ] **Step 3: AccountTable — 겸직 배지**

`app/(staff)/staff/(app)/accounts/components/AccountTable.tsx`의 `rows` 매핑을 교체(name 셀에 배지):

```tsx
  const rows = accounts.map((a) => {
    const caps = a.staffCapabilities ?? [];
    const primaryIsField = a.staffType === "field_staff" || a.staffType === "support_staff";
    const hasCross = primaryIsField
      ? caps.includes("manager_staff")
      : caps.some((c) => c === "field_staff" || c === "support_staff");
    return {
      name: (
        <span className="inline-flex items-center gap-1.5">
          {a.fullName}
          {hasCross && (
            <span
              title="겸직 계정"
              className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-bold text-brand"
            >
              {primaryIsField ? "사무실" : "현장"}
            </span>
          )}
        </span>
      ),
      username: a.username,
      password: PASSWORD_MASK,
      phone: a.phone ?? "-",
      type: isMaster(a.role) ? "마스터" : "일반",
      status: (
        <Button
          type="button"
          variant="ghost"
          aria-label={`${a.fullName} ${a.isActive ? "비활성화" : "활성화"}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleActive(a);
          }}
          className={a.isActive ? "text-brand" : "text-t4"}
        >
          {a.isActive ? "활성화" : "비활성화"}
        </Button>
      ),
    };
  });
```

- [ ] **Step 4: 검증**

Run: `npx vitest run "app/(staff)/staff/(app)/accounts/components/AccountFormModal.test.tsx" "app/(staff)/staff/(app)/accounts/page.test.tsx"`
Expected: 전건 PASS (optional 타입 + objectContaining + 토글/배지에 대한 부재 단언 없음 → 무편집 그린).
Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: 커밋**

```bash
git add "components/forms/schema/account.ts" "app/(staff)/staff/(app)/accounts/components/AccountFormModal.tsx" "app/(staff)/staff/(app)/accounts/components/AccountTable.tsx"
git commit -m "$(cat <<'EOF'
feat(security): /staff/accounts 겸직 토글 + 목록 겸직 배지

계정 폼 '다른 앱 접근 허용' 토글(primary 반대 persona를 caps에 추가),
목록 행에 겸직 배지. primary는 탭 기반 유지.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 전체 검증 + 라이브 마이그(사용자) + 수동 e2e

**Files:** 없음(검증·적용 단계).

- [ ] **Step 1: 정적 전수 검증**

Run: `npx tsc --noEmit`  → 0 errors.
Run: `npm run lint`  → clean(신규 위반 0).
Run: `npx vitest run`  → 그린(사전 실패 6건은 무관: kakao scope·GiroLedgerModal 2건 — 이번 변경과 무관함을 diff로 확인).
Run: `npx next build --webpack`  → 성공(dev 서버가 `.next` 잠그면 중지 후 실행).

- [ ] **Step 2: 마이그 번호 재확인 (커밋 전 이미 했다면 스킵)**

```bash
git fetch origin
git ls-tree --name-only origin/master supabase/migrations/ | sort | tail -3
```
`0148`이 충돌하면 파일·본문의 `revoke`/의존 주석 번호를 다음 값으로 리네임 후 Task 1 커밋을 수정.

- [ ] **Step 3: 라이브 마이그 적용 (사용자 `!` 실행)**

> ⚠️ classifier가 막으므로 **사용자가** 실행한다. 프롬프트에 다음 안내:
```
! node --env-file=.env.local scripts/db-query.mjs < supabase/migrations/0148_staff_capabilities.sql
```
`[]` 출력이면 성공. 이어서 검증 쿼리:
```
! node --env-file=.env.local scripts/db-query.mjs <<'SQL'
select staff_type, staff_capabilities from org_members order by staff_type limit 20;
SQL
```
기대: 각 행 `staff_capabilities`가 최소 `[staff_type]`을 포함(백필 성립).

- [ ] **Step 4: 수동 e2e (겸직 계정)**

1. `/staff/accounts` 사무실 탭 → 계정 등록, "현장 앱도 접근 허용(겸직)" 체크 → 저장. 목록에 "현장" 배지 확인.
2. 해당 계정으로 `/staff/login` 로그인 성공 → `/staff` 페이지 진입(게이트 통과).
3. 같은 계정으로 `/partner/mobile-login` 로그인 성공 → `/partner` 페이지 진입(게이트 통과).
4. 회귀: 겸직 아님 사무실 계정 → `/partner` 접근 시 `/`로 리다이렉트(거부). 겸직 아님 현장 계정 → `/staff` 접근 시 `/staff/login` 또는 `/`로 거부.

- [ ] **Step 5: 완료 처리**

`finishing-a-development-branch` 스킬로 PR 생성·머지 옵션 진행. WBS 동기화(`wbs-commit-sync`)는 커밋이 건드린 화면(/staff/accounts·로그인) 대상.

---

## Self-Review (플랜 작성자 체크 — 완료)

- **스펙 커버리지**: 스키마(§4→T1)·술어(§5.1→T1)·RPC(§5.2–5.5→T1)·partner 예외(§3→T2)·로그인(§6→T4·T5)·타입/UI(§7→T3·T7)·API(§7→T6)·검증(§10→T8) 전부 태스크 매핑됨. 스펙 §5.3의 `admin_set_member_permissions` "param 수용"은 **param 미추가·내부 방어 재주입**으로 정제(테스트·platform 호출자 보존). 스펙 §7·§11의 `[userId]` PATCH 언급은 **오류**(그 라우트는 비번리셋 전용) — 편집 basic은 클라 RPC `admin_update_member_basic` 경로(T3에서 처리)로 정정.
- **Placeholder 스캔**: TBD/TODO 없음. 모든 코드 스텝에 완전 코드.
- **타입 일관성**: `staffCapabilities?: StaffType[]`(optional) 전 파일 일관. `normalize_staff_capabilities(jsonb, staff_type)` 시그니처 T1 내 일관. 로그인 JS 필터는 `staff_capabilities` 배열 가정(매퍼·RPC가 배열 보장).
