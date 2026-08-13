# 통합관리자(platform-admin) 콘솔 설계 — SaaS 운영자 (Scope A)

> 상태/작성자: `draft` · 2026-08-12
> 관련 뼈대 커밋: `f49bc9d`(Scope B 초안 — 본 설계로 Scope A 조정)

## 1. 목적·범위

플랫폼 운영자가 **모든 관리회사(organization = 테넌트)** 를 총괄하는 콘솔. 핵심은 org별 **발송 크레딧(포인트)** 충전·소모 관리와 그 **충전 결제(청구)** 기록.

- **Scope A (cross-org)**: `platform_admin` 역할이 자기 org 경계를 넘어 전체 org를 조회·관리.
- 발송(문자·알림톡·팩스) 사용량은 포인트로 차감 — 실제 차감은 **P4 발송모듈** 연동 후. 본 설계는 **운영자 관점의 잔액·충전·내역·상태 관리**에 집중.
- **YAGNI**: 구독료·PG 자동결제·인보이스 발행 없음. 충전은 운영자 수동 기록.

## 2. 아키텍처

- **route group**: `app/(platform-admin)/`(뼈대 재활용). 전용 셸(PlatformShell)·nav·platform_admin 가드.
- **cross-org 접근**: 기존 `my_org_ids()` RLS(자기 org)에 platform_admin 예외를 **추가**(기존 staff 정책은 불변).
  - 신규 함수 `current_user_is_platform_admin()` — 현재 사용자의 org_members에 `platform_admin` role이 있으면 true.
  - 통합관리자가 읽는 테이블(organizations, point_transactions, org_members, profiles)에 platform_admin 예외 정책을 얹어 전체 org 조회 허용.
- **포인트 도메인**: `point_transactions` 단일 테이블(충전 +/ 사용 −). 잔액은 집계.

## 3. 데이터 모델

### 3.1 organizations (기존, 재사용)
`0000_p0`의 organizations. `status org_status`(trial/active/suspended) 활용 — 운영자가 상태 변경. **추가 컬럼 없음.**

### 3.2 point_transactions (신규)
```sql
create type point_tx_type as enum ('charge','usage');
create table point_transactions (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  type point_tx_type not null,
  points integer not null,            -- charge: +, usage: −
  amount_krw integer,                 -- charge 시 결제금액(원), usage는 null
  memo text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on point_transactions (org_id, created_at desc);
```
- **잔액** = `sum(points)` per org (뷰 `org_point_balances` 또는 집계 쿼리).
- **충전**: 운영자 수동 INSERT(type=charge, points>0, amount_krw).
- **사용**: 향후 P4 발송모듈이 INSERT(type=usage, points<0). 본 트랙은 **스키마만** 제공.

### 3.3 RLS / 함수
```sql
create or replace function current_user_is_platform_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = auth.uid() and m.role = 'platform_admin'
  )
$$;

alter table point_transactions enable row level security;
create policy pt_platform on point_transactions for all
  using (current_user_is_platform_admin())
  with check (current_user_is_platform_admin());
-- organizations/org_members/profiles: 기존 정책 유지 + platform_admin 예외를 별도 정책으로 추가
```

### 3.4 마이그레이션 순번
신규 `00XX_platform_admin.sql`. 현재 `0004`(P3a)·`0005`(공지/AS) → **`0006` 예약**(세션 간 순번 조율 필요).

## 4. 화면 (6)

| 화면 | 라우트 | 기능 |
|---|---|---|
| 대시보드 | `/platform-admin` | 전체 org 수·상태별 분포, 총 포인트 잔액, 최근 충전 N건 요약 카드 |
| 테넌트 관리 | `/platform-admin/organizations` | org 목록(이름·상태·포인트잔액·건물/계정수·생성일), 상태 변경(trial/active/suspended), 상세 |
| 포인트 관리 | `/platform-admin/points` | org별 잔액 목록 + 충전 기록 모달(org·포인트·결제액·메모) + 충전/사용 내역 |
| 청구 관리 | `/platform-admin/billing` | 충전 결제(charge) 내역 — org·금액(amount_krw)·포인트·기록자·일시 |
| 계정·권한 | `/platform-admin/accounts` | platform_admin/org_owner 계정 목록·관리(뼈대 재사용) |
| 로그인 | — | staff 인증 재사용, 가드 리다이렉트 |

포인트/청구는 같은 `point_transactions`의 다른 뷰(포인트=잔액+전체 내역, 청구=charge만).

## 5. 뼈대(f49bc9d) 조정

- `hooks/reactquery/platform/apis.ts`: 코드는 유지하되 **cross-org RLS 확장으로 전체 org가 자동 조회**됨. organizations 목록에 포인트 잔액 집계 join 추가.
- 포인트/청구 화면: placeholder → `point_transactions` 조회·충전 기록 구현.
- 대시보드: org 집계에 포인트 잔액 추가.
- 신규 훅 `hooks/reactquery/platform/points`(잔액·내역 조회 + 충전 mutation).

## 6. 에러·테스트

- 충전 기록: `points>0`, `amount_krw≥0` zod 검증. 실패 토스트.
- 가드 + RLS 이중: platform_admin 아닌 사용자는 접근/조회 차단.
- vitest: 잔액 집계 로직, 충전 mutation, org 목록 훅 매핑, 접근 가드.
- `next build --webpack` 정적생성 통과.

## 7. 미정·결정 로그

- [2026-08-12] **Scope A**(cross-org SaaS 운영자) 확정 — 테넌트=관리회사 조직.
- [2026-08-12] 포인트=발송 크레딧, 청구=포인트 충전 결제(운영자 수동 기록, PG 없음).
- 발송 사용량 차감(usage INSERT)은 **P4 발송모듈** 연동 시(본 트랙은 스키마·운영자 충전까지).
- 로그인: 별도 platform 로그인 없이 staff 인증 재사용(추후 전용 로그인 필요 시 재검토).
