# P6 수납 처리 Phase C (효성CMS 자동이체 세대 다운) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/staff/payment`에 자동이체(효성CMS) 세대의 회원번호·부과확정 청구금액을 회원번호 오름차순 XLSX로 다운로드하는 버튼을 추가한다.

**Architecture:** 검침대장 다운로드(`/api/utilities/ledger` + `rowsToXlsxBuffer`) 패턴을 미러링. 신규 RPC `list_cms_debit_rows`가 자동이체 세대(unit_accounts mgmt cms_member_no)를 부과확정액과 조인해 회원번호 오름차순 반환, GET 라우트가 XLSX로 내보낸다. 다운로드 전용(신규 테이블·쓰기 없음).

**Tech Stack:** Next.js Route Handler(GET), Supabase RPC + server client, `exceljs`(`rowsToXlsxBuffer`), React Query 헬퍼, vitest.

## Global Constraints

- 마이그레이션 = `supabase/migrations/0019_p6_cms_debit_download.sql` (0018 다음). 구현 시 master에 0019 없음 재확인. 라이브 적용 수동.
- `period`는 `date` 월초(`YYYY-MM-01`), 금액 `integer`, 모듈 `payment`.
- 자동이체 세대 = `unit_accounts`(kind='mgmt').`cms_member_no is not null`. 청구금액 = `billing_confirmations.total_amount`(선택 period, 미확정 null). **회원번호 오름차순 정렬**.
- 라우트·헬퍼·테스트는 `/api/utilities/ledger` 경로를 미러(`route.ts`, `route.test.ts`, `ledgerDownloadUrl`).
- 다운로드 전용, CMS API 직접연동 제외. 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: 마이그레이션 `0019_p6_cms_debit_download.sql`

**Files:**
- Create: `supabase/migrations/0019_p6_cms_debit_download.sql`

**Interfaces:**
- Consumes: `units`(id, unit_no, dong, building_id, deleted_at), `buildings`(org_id), `occupancies`(unit_id, tenant_name, deleted_at, created_at), `unit_accounts`(unit_id, kind, cms_member_no, holder), `billing_confirmations`(unit_id, period, total_amount), 헬퍼 `current_user_org()`.
- Produces: `list_cms_debit_rows(p_building_id bigint, p_period date) returns table(cms_member_no text, holder text, unit_no text, dong text, tenant_name text, charged int)`

- [ ] **Step 1: 마이그레이션 없음 재확인**

`supabase/migrations/`에 `0019*` 없음을 확인(0018이 최신). 있으면 다음 번호로.

- [ ] **Step 2: 마이그레이션 작성**

```sql
-- 0019_p6_cms_debit_download.sql
-- P6 Phase C: 효성CMS 자동이체 세대 다운로드용 조회 RPC
-- 의존: P1a(units), P3b(occupancies·unit_accounts), P5(billing_confirmations)
-- 모듈 게이트: payment(조회는 org 개방; 라우트/RLS가 접근제어)

create or replace function list_cms_debit_rows(p_building_id bigint, p_period date)
returns table(cms_member_no text, holder text, unit_no text, dong text, tenant_name text, charged int)
language sql stable security definer set search_path = public as $$
  with u as (
    select id, unit_no, dong from units
    where building_id=p_building_id and deleted_at is null
      and building_id in (select id from buildings where org_id=current_user_org())
  ),
  occ as (
    select distinct on (o.unit_id) o.unit_id, o.tenant_name
    from occupancies o join u on u.id=o.unit_id
    where o.deleted_at is null
    order by o.unit_id, o.created_at desc, o.id desc
  ),
  acct as (
    select distinct on (a.unit_id) a.unit_id, a.cms_member_no, a.holder
    from unit_accounts a join u on u.id=a.unit_id
    where a.kind='mgmt' and a.cms_member_no is not null
    order by a.unit_id, a.id desc
  )
  select acct.cms_member_no, acct.holder, u.unit_no, u.dong, occ.tenant_name, bc.total_amount as charged
  from acct
  join u on u.id=acct.unit_id
  left join occ on occ.unit_id=u.id
  left join billing_confirmations bc on bc.unit_id=u.id and bc.period=p_period
  order by acct.cms_member_no asc
$$;
revoke execute on function list_cms_debit_rows(bigint, date) from public, anon;
grant execute on function list_cms_debit_rows(bigint, date) to authenticated;
```

- [ ] **Step 3: 셀프 체크**

`kind='mgmt' and cms_member_no is not null` 필터, org 검증(`current_user_org()`), `order by acct.cms_member_no asc`, revoke/grant 확인. `unit_accounts.holder` 컬럼명 실제와 일치하는지 0006에서 확인.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0019_p6_cms_debit_download.sql
git commit -m "feat(payment): 효성CMS 자동이체 다운 RPC 마이그(0019)"
```

---

### Task 2: 다운로드 라우트 + 헬퍼 + 페이지 버튼

**Files:**
- Create: `app/api/payment/cms/route.ts`
- Create: `app/api/payment/cms/route.test.ts`
- Modify: `hooks/reactquery/payments/apis.ts` (cmsDownloadUrl 헬퍼)
- Modify: `hooks/reactquery/payments/apis.test.ts` (헬퍼 테스트)
- Modify: `app/(staff)/staff/payment/page.tsx` (자동이체 세대 다운 버튼)

**Interfaces:**
- Consumes: Task 1 `list_cms_debit_rows`, `rowsToXlsxBuffer`(@/lib/export/xlsx), `@/lib/supabase/server` createClient.
- Produces: `cmsDownloadUrl(buildingId: number, period: string): string` → `/api/payment/cms?buildingId=..&period=..`; GET `/api/payment/cms`.

- [ ] **Step 1: cmsDownloadUrl 테스트 작성**

`hooks/reactquery/payments/apis.test.ts`에 추가(파일 상단 mock은 기존 유지):
```ts
import { cmsDownloadUrl } from "./apis";
describe("cmsDownloadUrl", () => {
  it("buildingId·period 쿼리스트링", () => {
    expect(cmsDownloadUrl(7, "2026-08-01")).toBe("/api/payment/cms?buildingId=7&period=2026-08-01");
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run hooks/reactquery/payments/apis.test.ts` → FAIL (cmsDownloadUrl 미정의).

- [ ] **Step 3: cmsDownloadUrl 구현**

`hooks/reactquery/payments/apis.ts` 하단에 추가(`utilities/apis.ts`의 `ledgerDownloadUrl` 미러):
```ts
export function cmsDownloadUrl(buildingId: number, period: string): string {
  const params = new URLSearchParams({ buildingId: String(buildingId), period });
  return `/api/payment/cms?${params.toString()}`;
}
```

- [ ] **Step 4: 통과 확인** — `npx vitest run hooks/reactquery/payments/apis.test.ts` → PASS.

- [ ] **Step 5: 라우트 작성**

`app/api/payment/cms/route.ts` (`app/api/utilities/ledger/route.ts` 미러):
```ts
import { rowsToXlsxBuffer } from "@/lib/export/xlsx";
import { createClient } from "@/lib/supabase/server";

interface CmsDebitRpcRow {
  cms_member_no: string; holder: string | null;
  unit_no: string; dong: string | null; tenant_name: string | null; charged: number | null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const buildingId = Number(params.get("buildingId"));
  const period = params.get("period") ?? "";

  if (
    !Number.isSafeInteger(buildingId)
    || buildingId <= 0
    || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(period)
  ) {
    return Response.json({ error: "invalid cms parameters" }, { status: 400 });
  }

  const sb = await createClient();
  const { data: building, error: buildingError } = await sb
    .from("buildings").select("name").eq("id", buildingId).maybeSingle();
  if (buildingError) return Response.json({ error: buildingError.message }, { status: 500 });
  if (!building) return Response.json({ error: "forbidden" }, { status: 403 });

  const { data, error } = await sb.rpc("list_cms_debit_rows", { p_building_id: buildingId, p_period: period });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const table = ((data ?? []) as CmsDebitRpcRow[]).map((r) => ({
    cmsMemberNo: r.cms_member_no,
    holder: r.holder ?? "",
    unitNo: r.dong ? `${r.dong} ${r.unit_no}` : r.unit_no,
    tenantName: r.tenant_name ?? "",
    charged: r.charged ?? "",
  }));

  const buffer = await rowsToXlsxBuffer(
    [
      { header: "회원번호", key: "cmsMemberNo", width: 18 },
      { header: "예금주", key: "holder", width: 14 },
      { header: "호실", key: "unitNo", width: 12 },
      { header: "입주자", key: "tenantName", width: 14 },
      { header: "청구금액", key: "charged", width: 14 },
    ],
    table,
  );

  const yyyymm = period.slice(0, 7).replace("-", "");
  const filename = `${building.name}_자동이체_${yyyymm}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="cms_debit_${yyyymm}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
```

- [ ] **Step 6: 라우트 테스트 작성**

`app/api/payment/cms/route.test.ts` — `app/api/utilities/ledger/route.test.ts`의 mock 패턴(서버 createClient mock)을 미러. 케이스:
```
1) 잘못된 파라미터(buildingId=0 또는 period 형식 오류) → 400
2) building maybeSingle → null → 403
3) 정상: rpc가 [{cms_member_no:"A2", ...},{cms_member_no:"A1", ...}] 반환 시 200,
   Content-Disposition 파일명에 자동이체·YYYYMM 포함, 응답 버퍼를 ExcelJS로 로드해
   헤더행 ["회원번호","예금주","호실","입주자","청구금액"] 확인.
```
(RPC는 이미 오름차순 정렬을 보장하므로 라우트 테스트는 헤더·파일명·200 중심. 정렬은 SQL 책임.)

- [ ] **Step 7: 페이지 버튼 배선**

`app/(staff)/staff/payment/page.tsx` 상단 액션 영역(엑셀 업로드 버튼 옆)에 추가. `cmsDownloadUrl` import.
```tsx
<Button
  type="button"
  variant="ghost"
  disabled={selectedBuildingId === null}
  onClick={() => {
    if (selectedBuildingId === null) return;
    const anchor = document.createElement("a");
    anchor.href = cmsDownloadUrl(selectedBuildingId, period);
    anchor.rel = "noopener";
    anchor.click();
  }}
>
  자동이체 세대 다운
</Button>
```
(utilities 페이지의 검침대장 다운 버튼과 동일 방식. 기존 엑셀 업로드 버튼 배치와 정렬.)

- [ ] **Step 8: 검증 + 커밋**

Run: `npx vitest run "app/api/payment/cms/route.test.ts" hooks/reactquery/payments/apis.test.ts` (PASS)
Run: `npx vitest run` (전체 그린) · `npm run lint` · `npx tsc --noEmit`
```bash
git add "app/api/payment/cms/route.ts" "app/api/payment/cms/route.test.ts" hooks/reactquery/payments/apis.ts hooks/reactquery/payments/apis.test.ts "app/(staff)/staff/payment/page.tsx"
git commit -m "feat(payment): 효성CMS 자동이체 세대 다운 라우트·버튼"
```

---

## Self-Review (작성자 체크 완료)

**Spec 커버리지**: §3 RPC=Task1 · §4 라우트=Task2(route) · §5 UI 버튼·헬퍼=Task2 · §7 테스트=Task2(헬퍼·라우트). 범위 밖(D·CMS결과·API연동) 제외 — 일치.

**플레이스홀더**: SQL·라우트·헬퍼·버튼 완전 코드. 라우트 테스트는 케이스 명시 + 미러 대상(ledger route.test.ts) 지정. "적절히" 류 없음.

**타입 일관성**: `cmsDownloadUrl(buildingId, period)` Task2 정의=사용 일치. RPC 반환 컬럼(cms_member_no/holder/unit_no/dong/tenant_name/charged) Task1↔라우트 `CmsDebitRpcRow` 일치. `list_cms_debit_rows` 인자(p_building_id, p_period) Task1↔라우트 rpc 호출 일치.

**유의**: `unit_accounts.holder` 컬럼명 Task1 Step3에서 확인. SQL 무단위테스트(라이브 수동). 라우트 테스트의 서버 client mock은 ledger route.test.ts 패턴 그대로.
