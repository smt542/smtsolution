# 통합관리자(platform-admin) CUD 설계 — SaaS 운영자 관리 액션

> 상태/작성일: `approved` · 2026-08-18
> 선행 문서: `2026-08-12-platform-admin-design.md`(Scope A — 조회+포인트 콘솔, 구현 완료)
> 이 문서: 그 위에 **관리(Create/Update/Delete) 액션**을 얹는 설계.

## 0. 배경

통합관리자 콘솔(`app/(platform-admin)/`)은 현재 **조회 중심 + 최소 액션**(조직 상태변경, 포인트 충전)만 있다. 실 DB 연동은 완비돼 있으나(`hooks/reactquery/platform/apis.ts` 직접 조회, `chargePoints`/`updateOrganizationStatus` mutation), 조직 입점·계정 발급·포인트 정정 같은 **운영자 관리 액션이 없다**.

통합관리자 CUD를 정의한 PRD는 없다(`docs/prototype/prd/*`·`prd-synthesis.md`는 전부 관리회사 내부 staff 화면용). 본 문서가 통합관리자 CUD의 요구사항 정본이다.

## 1. 목적·범위

플랫폼 운영자(`platform_admin` role)가 **모든 관리회사(organization=테넌트)를 가로질러** 조직·계정·포인트를 관리한다.

### 확정된 제품 결정 (2026-08-18, 사용자 승인)
1. **조직 입점 시 첫 owner 계정 동시 발급** — 빈 회사 방지, 생성 직후 운영 가능.
2. **조직 해지 = soft-delete** — `organizations.deleted_at` 컬럼 신설(건물/입주자와 동일 패턴). 데이터 보존·복구 가능.
3. **건물/세대는 조회 유지(범위 밖)** — 각 회사 staff의 업무. 통합관리자는 드릴다운 조회만.

### 범위 밖 (YAGNI)
- 건물/세대 대행 편집 · 구독료·PG·인보이스 · platform 전용 로그인 · 세입자 계정.

## 2. 아키텍처 전략

### 2.1 cross-org 계정 RPC 확장 (핵심 결정)
계정 인프라는 이미 완비돼 있으나 **자기 org 경계 기준**으로 설계돼 있다:
- `lib/supabase/admin.ts` `createAdminClient()` (service_role)
- `app/api/accounts/route.ts` POST — `admin.auth.admin.createUser()` + `provision_member` RPC
- `lib/auth/email.ts` `loginEmail(companyCode, username)` = `${slug}.${username}@${domain}`
- RPC(모두 `0002_p2a_accounts_permissions.sql`): `provision_member`(생성), `admin_set_member_permissions`(권한), `admin_update_member_basic`(기본정보), `admin_set_active`(활성토글), `list_accounts`(조회)

**전략**: 기존 RPC에 `p_target_org_id bigint default null` 파라미터를 추가한다.
- `current_user_is_platform_admin()` = true → `p_target_org_id`로 지정한 임의 org 대상 허용.
- 아니면(일반 staff) → `p_target_org_id`는 무시하고 기존처럼 호출자 자신의 org로 강제(기본값 null).
- **결과: staff `/accounts` 호출은 시그니처·동작 불변(하위호환)**, 통합관리자만 cross-org 확장을 사용.

> 대안(“platform 전용 신규 RPC 세트”)은 검증·감사 로직이 이원화·중복되어 비채택. 단일 RPC에 분기를 두어 **감사·검증 일원화**.

### 2.2 조직 원자 생성
신규 Route Handler `app/api/platform/organizations/route.ts` (POST):
1. 인증 + `platform_admin` 인가 확인(아니면 403).
2. 입력 검증(zod): 회사명·slug(유니크·소문자·영숫자)·연락처, owner(아이디·이름·연락처). 임시 비밀번호는 서버에서 자동 생성.
3. Route Handler가 아래 3스텝을 순서대로 오케스트레이션(각 단계 실패 시 앞 단계 보상):
   - (a) `platform_create_organization(p_name, p_slug, p_phone)` RPC → **조직만 INSERT**하고 새 org 반환(slug 유니크 확정, `security definer`·platform_admin 확인).
   - (b) `admin.auth.admin.createUser(email=loginEmail(slug, username), 임시비번)` → owner Auth user 생성.
   - (c) `provision_member(p_target_org_id=새 org, p_user_id=새 auth uid, role=owner, …)` → owner의 org_members/profiles INSERT.
   - **보상(compensation)**: (c) 실패 → (b) Auth user 삭제 후 (a) 조직 삭제 · (b) 실패 → (a) 조직 삭제 · (a) 실패 → 즉시 중단.
4. 응답: 생성된 조직 + **owner 임시 비밀번호(1회 노출)**.

> Auth user 생성은 `provision_member`(org_members INSERT)보다 반드시 선행해야 하므로(user_id 필요) 셋을 한 트랜잭션에 묶을 수 없다 → **Route Handler가 3스텝 + 보상으로 원자성을 보장**. 각 RPC는 `security definer`로 platform_admin을 확인한다.

## 3. 데이터 모델 / 마이그레이션

**신규 마이그레이션 1개** — 번호는 잠정 `0031`(또는 그 이상). ⚠️ **커밋 직전 `origin/master`의 실제 max 마이그 번호를 재확인**해 충돌을 피한다(병렬 워크트리 선점 함정; `overdue-late-fee` 브랜치가 `0031` 미머지 선점 중일 수 있음).

### 3.1 organizations 컬럼 추가
```sql
alter table organizations add column if not exists deleted_at timestamptz;
alter table organizations add column if not exists phone text;
```
- `deleted_at`: soft-delete. 조회는 `deleted_at is null` 기본 필터.
- `phone`: 관리회사 대표 연락처(입점/수정 시 입력, 선택).

### 3.2 point_transactions — 조정 타입 추가
```sql
-- enum value 추가는 트랜잭션 제약이 있어 별도 문/사전 커밋 처리
alter type point_tx_type add value if not exists 'adjustment';
```
- `charge`(+, 결제충전) / `usage`(−, 발송모듈 자동차감, 예약) / **`adjustment`(±, 운영자 수동 정정·차감·환불)**.
- 운영자 수동 가감은 `usage`와 구분해 `adjustment`로 기록(감사 명확성). 잔액 = `sum(points)` 불변.
- `amount_krw`: 환불 시 실제 환급액(원) 기록 가능(선택).

### 3.3 RLS
- **organizations INSERT**: platform_admin 허용 정책 신설.
  ```sql
  create policy org_platform_insert on organizations for insert
    with check (current_user_is_platform_admin());
  ```
- **organizations UPDATE**: 기존 `org_platform_update`가 `deleted_at`·`phone`·`status`·`name`·`slug` UPDATE를 커버(해지=UPDATE deleted_at).
- **org_members/profiles 쓰기**: RLS 정책 없이 `security definer` RPC로만(기존 방식 유지). cross-org는 RPC 내부 platform_admin 분기로 허용.
- **point_transactions**: 기존 `pt_platform`(for all, platform_admin)이 adjustment INSERT 커버.

## 4. RPC 명세

### 4.1 cross-org 확장 (기존 수정 — 하위호환)
| RPC | 추가 | platform_admin | staff(기존) |
|---|---|---|---|
| `provision_member` | `p_target_org_id default null` | 지정 org에 멤버/계정 생성 | 무시, 자기 org (불변) |
| `admin_set_member_permissions` | 동일 | 임의 org 멤버 권한변경 | 자기 org (불변) |
| `admin_update_member_basic` | 동일 | 임의 org 멤버 정보수정 | 자기 org (불변) |
| `admin_set_active` | 동일 | 임의 org 멤버 활성토글 | 자기 org (불변) |

각 RPC 진입부 로직:
```
v_org := case when current_user_is_platform_admin() and p_target_org_id is not null
              then p_target_org_id
              else <기존 방식으로 도출한 호출자 org> end;
-- 이후 v_org 기준으로 기존 검증(마스터 최소 1명 등) 수행
```

### 4.2 신규
- `platform_create_organization(p_name, p_slug, p_phone)` → 조직 INSERT 후 org row 반환(`security definer`, platform_admin 확인). owner Auth 생성·provision은 Route Handler가 연쇄.
- 포인트 조정: 기존 `chargePoints` 패턴을 확장한 `adjustPoints(org_id, points, amount_krw?, memo)` — `type='adjustment'` INSERT. mutation은 `hooks/reactquery/platform/`에 추가.

## 5. 보안

- **platform_admin 임명 통제**: `admin_set_member_permissions`에서 대상 role을 `platform_admin`으로 설정(또는 해제)하는 것은 **호출자가 이미 platform_admin일 때만** 허용. 아니면 예외.
  - 이는 기존 "org 마스터가 `admin_set_member_permissions`로 자신을 platform_admin으로 자가승격" 벡터를 차단한다(선행 문서 §보안 관찰 이슈 해소).
- **Route Handler 인가**: `/api/platform/*`는 진입 시 platform_admin 확인. service_role admin client는 이 확인 이후에만 사용.
- **UI·RLS·RPC 3중**: 가드(isMaster/platform_admin) + RLS + RPC 내부 검증.

## 6. 화면 (기존 조회 화면에 액션 추가)

### 6.1 조직 관리 `/platform-admin/organizations`
- 상단 **[입점] 버튼** → 모달: 회사명·회사코드(slug)·연락처 + owner(아이디·이름·연락처). 생성 성공 시 **임시 비밀번호 1회 표시**.
- 행 액션: **정보수정**(모달), **해지**(확인 다이얼로그 → `deleted_at` set), 상태변경(기존 `OrgStatusControl`).
- 목록 기본 필터 `deleted_at is null`. **[해지 포함]** 토글 시 해지 조직 표시 + **복구** 액션.
- `listPlatformOrganizations`에 `deleted_at is null` 필터 추가.

### 6.2 계정 관리 `/platform-admin/accounts`
- 상단 **[계정 발급] 버튼** → 모달: **org 드롭다운**(활성 조직) + 계정정보(아이디·이름·연락처·role). 성공 시 임시 비밀번호 표시.
- 행 액션: **권한변경**(role; platform_admin 임명은 가드), **활성/비활성** 토글, **비밀번호 초기화**(임시비번 재발급, admin API).
- 기존 staff `/accounts`의 훅(`useCreateAccount`·`useUpdatePermissions`·`useSetActive`)을 **org 지정 가능 형태로 확장·재사용**하거나 platform용 얇은 래퍼 추가.

### 6.3 포인트 관리 `/platform-admin/points`
- 상단 **[조정] 버튼** → 모달: org·구분(정정/차감/환불)·포인트(±)·메모(필수). `type='adjustment'`로 기록.
- 기존 충전(`PointChargeModal`)·내역 유지, 조정 내역도 같은 목록에 표기(구분 뱃지).

## 7. 에러·테스트

- **zod 검증**: slug 형식·유니크(사전 체크+DB 제약), 필수값, 포인트 부호.
- **vitest**:
  - cross-org RPC 분기(platform_admin=임의 org / staff=자기 org 강제).
  - 조직 원자 생성: owner 동시 발급, 중간 실패 시 보상.
  - 포인트 조정: 부호·잔액 합산.
  - 보안: 비-platform_admin의 platform_admin 임명 차단, org 마스터 자가승격 차단.
  - 조직 soft-delete 후 목록 제외 + 복구.
  - **회귀**: staff `/accounts` 생성·권한·활성 동작 불변.
- **build**: `next build --webpack` 통과.

## 8. 단계 분할 (독립 구현·머지 — 병렬 가능)

| 단계 | 내용 | 마이그/코드 |
|---|---|---|
| **P1 조직 CUD** | 입점(+owner)·정보수정·해지(soft-delete)·복구 | `deleted_at`/`phone` 컬럼, org INSERT 정책, `platform_create_organization`, `/api/platform/organizations`, 조직 화면 액션 |
| **P2 계정 CUD** | cross-org 계정 발급·권한·활성·비번초기화 + 보안 통제 | 기존 4 RPC cross-org 확장 + platform_admin 임명 가드, 계정 화면 액션, `/api/platform/accounts`(발급/비번) |
| **P3 포인트 조정** | 정정·차감·환불 | `adjustment` enum, `adjustPoints` mutation, 포인트 화면 조정 모달 |

- 의존: P1은 owner 발급에 `provision_member`의 cross-org(P2 RPC 확장)를 사용 → **P2의 RPC 확장을 P1보다 먼저 하거나 함께** 진행. 순서 권장: **P2(RPC 확장) → P1(조직) → P3(포인트)**, 또는 P1에서 필요한 RPC 확장만 선반영.
- 각 단계 독립 브랜치·PR. 마이그 번호는 각자 커밋 직전 재확인.

## 9. 결정 로그

- [2026-08-18] 통합관리자 CUD 요구사항 정본 = 본 문서(전용 PRD 부재).
- [2026-08-18] 조직 입점 시 owner 계정 동시 발급.
- [2026-08-18] 조직 해지 = `deleted_at` soft-delete(hard delete·상태갈음 아님).
- [2026-08-18] 건물/세대 대행편집 범위 밖(조회 유지).
- [2026-08-18] cross-org = 기존 RPC에 `p_target_org_id` 추가·platform_admin 분기(신규 RPC 세트 비채택).
- [2026-08-18] 운영자 수동 포인트 가감 = `adjustment` 타입(usage와 구분).
- [2026-08-18] platform_admin 임명은 platform_admin만(자가승격 벡터 차단).
