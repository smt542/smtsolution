# P6 수납 처리 Phase D (지로 수납·원장) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/staff/payment`에 지로(method='giro') 수납 빠른입력과 지로 원장(조회) 뷰를 추가한다.

**Architecture:** Phase A `payments`(method='giro') 재사용. 신규는 지로 원장 조회 RPC `list_giro_payments` + `GiroLedgerModal`, 그리고 수납표 `지로` 행 액션이 `PaymentAmountModal`을 method='giro' 프리셋으로 연다. 신규 세대 데이터 없음.

**Tech Stack:** Supabase RPC + RLS, React Query, Next.js(app router), vitest, `@/components/common`.

## Global Constraints

- 마이그레이션 = `supabase/migrations/0020_p6_giro_ledger.sql` (0019 다음). 구현 시 master에 0020 없음 재확인. 라이브 수동.
- `period`는 `date` 월초, 금액 `integer`, 모듈 `payment`. 지로 수납 = `record_payment(method='giro', kind='full')` 재사용, 취소 = `cancel_payment` 재사용(마이그 변경 없음).
- 지로 원장 = `method='giro'` 수납(취소 포함) 조회. 세대 플래그·지로번호 없음(YAGNI).
- 신규 파일은 기존 payment 컴포넌트/훅 패턴 미러(PaymentHistoryModal·usePaymentRows 등).
- 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: 마이그레이션 `0020_p6_giro_ledger.sql`

**Files:**
- Create: `supabase/migrations/0020_p6_giro_ledger.sql`

**Interfaces:**
- Consumes: `payments`(method, period, unit_id, status, amount, paid_at, memo), `units`, `buildings`, `occupancies`, `current_user_org()`.
- Produces: `list_giro_payments(p_building_id bigint, p_period date) returns table(id bigint, unit_no text, dong text, tenant_name text, amount int, paid_at date, status text, memo text)`

- [ ] **Step 1: 0020 없음 재확인** — `supabase/migrations/`에 `0020*` 없음 확인(0019 최신).

- [ ] **Step 2: 마이그레이션 작성**

```sql
-- 0020_p6_giro_ledger.sql
-- P6 Phase D: 지로 수납 원장 조회 RPC (method='giro' 재사용)
-- 의존: P6 Phase A(payments), P1a(units), P3b(occupancies)
-- 모듈 게이트: payment(조회 org 개방)

create or replace function list_giro_payments(p_building_id bigint, p_period date)
returns table(id bigint, unit_no text, dong text, tenant_name text, amount int, paid_at date, status text, memo text)
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
  )
  select p.id, u.unit_no, u.dong, occ.tenant_name, p.amount, p.paid_at, p.status, p.memo
  from payments p
  join u on u.id=p.unit_id
  left join occ on occ.unit_id=u.id
  where p.period=p_period and p.method='giro'
  order by p.paid_at desc, p.id desc
$$;
revoke execute on function list_giro_payments(bigint, date) from public, anon;
grant execute on function list_giro_payments(bigint, date) to authenticated;
```

- [ ] **Step 3: 셀프 체크** — `method='giro'` 필터, org 검증, `order by p.paid_at desc, p.id desc`, revoke/grant 확인.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0020_p6_giro_ledger.sql
git commit -m "feat(payment): 지로 원장 조회 RPC 마이그(0020)"
```

---

### Task 2: 지로 원장 훅

**Files:**
- Modify: `hooks/reactquery/payments/apis.ts` (listGiroPayments + GiroPayment)
- Modify: `hooks/reactquery/payments/apis.test.ts` (매핑 테스트)
- Modify: `hooks/reactquery/payments/queries.ts` (useGiroPayments)
- Modify: `hooks/reactquery/payments/keys.ts` (giro 키)

**Interfaces:**
- Consumes: Task 1 `list_giro_payments`.
- Produces:
  - `interface GiroPayment { id: number; unitNo: string; dong: string | null; tenantName: string | null; amount: number; paidAt: string; status: "active" | "canceled"; memo: string | null }`
  - `listGiroPayments(buildingId: number, period: string): Promise<GiroPayment[]>`
  - `useGiroPayments(buildingId: number | null, period: string)`
  - `paymentKeys.giro(buildingId, period)`

- [ ] **Step 1: 실패 테스트 추가**

`hooks/reactquery/payments/apis.test.ts`에 추가:
```ts
import { listGiroPayments } from "./apis";
describe("listGiroPayments", () => {
  it("giro 원장 행 매핑", async () => {
    rpc.mockResolvedValue({ data: [{
      id: 5, unit_no: "101", dong: "A", tenant_name: "김철수",
      amount: 30000, paid_at: "2026-08-10", status: "active", memo: "지로",
    }], error: null });
    const rows = await listGiroPayments(3, "2026-08-01");
    expect(rpc).toHaveBeenCalledWith("list_giro_payments", { p_building_id: 3, p_period: "2026-08-01" });
    expect(rows[0]).toEqual({
      id: 5, unitNo: "101", dong: "A", tenantName: "김철수",
      amount: 30000, paidAt: "2026-08-10", status: "active", memo: "지로",
    });
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run hooks/reactquery/payments/apis.test.ts` → FAIL.

- [ ] **Step 3: apis.ts 구현**

`apis.ts`에 추가:
```ts
export interface GiroPayment {
  id: number; unitNo: string; dong: string | null; tenantName: string | null;
  amount: number; paidAt: string; status: "active" | "canceled"; memo: string | null;
}
type GiroPaymentDb = {
  id: number; unit_no: string; dong: string | null; tenant_name: string | null;
  amount: number; paid_at: string; status: "active" | "canceled"; memo: string | null;
};

export async function listGiroPayments(buildingId: number, period: string): Promise<GiroPayment[]> {
  const { data, error } = await createClient().rpc("list_giro_payments", { p_building_id: buildingId, p_period: period });
  if (error) throw new Error(error.message);
  return ((data ?? []) as GiroPaymentDb[]).map((r) => ({
    id: r.id, unitNo: r.unit_no, dong: r.dong, tenantName: r.tenant_name,
    amount: r.amount, paidAt: r.paid_at, status: r.status, memo: r.memo,
  }));
}
```

- [ ] **Step 4: keys/queries**

`keys.ts`: `giro: (buildingId: number, period: string) => ["payments","giro",buildingId,period] as const`.
`queries.ts`:
```ts
import { listGiroPayments } from "./apis";
export function useGiroPayments(buildingId: number | null, period: string) {
  return useQuery({
    queryKey: paymentKeys.giro(buildingId ?? 0, period),
    queryFn: () => listGiroPayments(buildingId as number, period),
    enabled: buildingId !== null && Boolean(period),
  });
}
```

- [ ] **Step 5: 통과 + 커밋**

Run: `npx vitest run hooks/reactquery/payments/apis.test.ts` (PASS) · `npm run lint`
```bash
git add hooks/reactquery/payments
git commit -m "feat(payment): 지로 원장 훅(listGiroPayments·useGiroPayments)"
```

---

### Task 3: UI — 지로 행 액션·금액모달 프리셋·지로 원장 모달

**Files:**
- Modify: `app/(staff)/staff/payment/components/PaymentAmountModal.tsx` (defaultMethod prop)
- Modify: `app/(staff)/staff/payment/components/PaymentTable.tsx` (지로 액션)
- Create: `app/(staff)/staff/payment/components/GiroLedgerModal.tsx`
- Modify: `app/(staff)/staff/payment/page.tsx` (지로 원장 버튼·지로 액션 배선)
- Test: `app/(staff)/staff/payment/components/GiroLedgerModal.test.tsx`
- Test: 기존 `PaymentTable`/`page` 테스트에 지로 케이스 추가(있으면)

**Interfaces:**
- Consumes: Task 2 `useGiroPayments`·`GiroPayment`, 기존 `useCancelPayment`·`PaymentMethod`·`PaymentRow`·`useRecordPayment`, `KIND_LABEL`/`METHOD_LABEL`/`PAY_STATUS_*` 상수, `ComplaintDialog`·`@/components/common`.
- Produces: `GiroLedgerModal`(props `{ open; buildingId: number; period: string; onClose(): void }`).

- [ ] **Step 1: PaymentAmountModal에 defaultMethod prop**

`PaymentAmountModalProps`에 `defaultMethod?: PaymentMethod;` 추가. 내부 `PaymentAmountForm`의 method state 초기값을 `defaultMethod ?? "transfer"`로:
```tsx
const [method, setMethod] = useState<PaymentMethod>(defaultMethod ?? "transfer");
```
`PaymentAmountModal`이 `defaultMethod`를 `PaymentAmountForm`에 전달. 테스트: `defaultMethod="giro"` 렌더 시 수납방법 Select value가 "giro"인지 단언(`app/(staff)/staff/payment/components/PaymentAmountModal.test.tsx` 있으면 추가; 없으면 GiroLedgerModal 테스트로 갈음하고 page 통합에서 확인).

- [ ] **Step 2: PaymentTable에 지로 액션**

`PaymentAction` 타입에 `"giro"` 추가: `type PaymentAction = PaymentKind | "cancel" | "giro"`. 취소 버튼 앞에 `지로` 버튼 추가(수납/원금과 동일 비활성 규칙 `disabled={paid || unbilled}`):
```tsx
<Button type="button" variant="ghost" className="h-9 px-3 text-xs"
  disabled={paid || unbilled} onClick={() => onAction(row, "giro")}>지로</Button>
```
`onAction` prop 타입도 `(row, action: PaymentAction) => void`로 확장(기존 시그니처 유지되면 자동).

- [ ] **Step 3: GiroLedgerModal 작성**

`PaymentHistoryModal.tsx`(세대 수납이력+취소) 구조를 미러하되 건물 전체 지로 목록:
```tsx
"use client";
import { Button, EmptyState, Spinner } from "@/components/common";
import { useGiroPayments, type GiroPayment } from "@/hooks/reactquery/payments";
import { ComplaintDialog } from "../../receipts/components/ComplaintDialog";

interface GiroLedgerModalProps {
  open: boolean; buildingId: number; period: string;
  isPending: boolean; onClose: () => void; onCancel: (paymentId: number) => void;
}
export function GiroLedgerModal({ open, buildingId, period, isPending, onClose, onCancel }: GiroLedgerModalProps) {
  const { data: rows = [], isLoading } = useGiroPayments(buildingId, period);
  if (!open) return null;
  return (
    <ComplaintDialog open onClose={onClose} title="지로 원장" size="large">
      {isLoading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState message="지로 수납 내역이 없습니다" />
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs font-bold text-t3">
            <th className="px-3 py-2">호실</th><th className="px-3 py-2">입주자</th>
            <th className="px-3 py-2 text-right">금액</th><th className="px-3 py-2">처리일</th>
            <th className="px-3 py-2">상태</th><th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {rows.map((r: GiroPayment) => (
              <tr key={r.id} className={`border-b border-line ${r.status === "canceled" ? "opacity-50" : ""}`}>
                <td className="px-3 py-2">{r.dong ? `${r.dong} ${r.unitNo}` : r.unitNo}</td>
                <td className="px-3 py-2">{r.tenantName ?? "-"}</td>
                <td className="num px-3 py-2 text-right">{r.amount.toLocaleString()}</td>
                <td className="px-3 py-2">{r.paidAt}</td>
                <td className="px-3 py-2">{r.status === "canceled" ? "취소" : "완료"}</td>
                <td className="px-3 py-2 text-right">
                  {r.status === "active" && (
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs"
                      disabled={isPending} onClick={() => onCancel(r.id)}>취소</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ComplaintDialog>
  );
}
```

- [ ] **Step 4: page.tsx 배선**

- import `GiroLedgerModal`, `cmsDownloadUrl` 옆.
- state: `const [giroOpen, setGiroOpen] = useState(false);`
- `AmountModalState`에 `method?: PaymentMethod` 추가. `openAction`에서 `action === "giro"`이면 `setAmountModal({ row, kind: "full", method: "giro" })`; 그 외 기존대로. (cancel은 기존 history 분기 유지.)
- `PaymentAmountModal`에 `defaultMethod={amountModal.method ?? "transfer"}` 전달. `defaultAmount`는 kind='full'이므로 `unpaid ?? 0`.
- 상단 액션에 `지로 원장` 버튼(`variant="ghost"`, `disabled={selectedBuildingId === null}`) → `setGiroOpen(true)`.
- 렌더:
```tsx
{giroOpen && selectedBuildingId !== null && (
  <GiroLedgerModal open buildingId={selectedBuildingId} period={period}
    isPending={cancelPayment.isPending} onClose={() => setGiroOpen(false)}
    onCancel={cancelRecordedPayment} />
)}
```
(`cancelRecordedPayment`는 기존 함수 재사용.)

- [ ] **Step 5: GiroLedgerModal 테스트**

`GiroLedgerModal.test.tsx`: `vi.mock`으로 `useGiroPayments`(고정 rows) 반환. 케이스:
```
1) rows 렌더(호실·금액·처리일·상태) 확인
2) active행 취소 버튼 클릭 → onCancel(paymentId) 호출
3) 빈 배열 → "지로 수납 내역이 없습니다"
```

- [ ] **Step 6: 실패→구현→통과 + 전체 검증 + 커밋**

Run: `npx vitest run "app/(staff)/staff/payment"` (PASS)
Run: `npx vitest run` (전체 그린; 사전 실패는 무관 범위 명시) · `npm run lint` · `npx tsc --noEmit`
```bash
git add "app/(staff)/staff/payment/components/PaymentAmountModal.tsx" "app/(staff)/staff/payment/components/PaymentTable.tsx" "app/(staff)/staff/payment/components/GiroLedgerModal.tsx" "app/(staff)/staff/payment/components/GiroLedgerModal.test.tsx" "app/(staff)/staff/payment/page.tsx"
git commit -m "feat(payment): 지로 행 액션·금액모달 method 프리셋·지로 원장 모달"
```

---

## Self-Review (작성자 체크 완료)

**Spec 커버리지**: §3 RPC=T1 · §4 훅=T2 · §5 UI(PaymentAmountModal defaultMethod·PaymentTable 지로·GiroLedgerModal·page)=T3 · §7 테스트=T2·T3. 범위 밖(지로 세대 플래그·고지서·연체료) 제외 — 일치.

**플레이스홀더**: SQL·훅·GiroLedgerModal 완전 코드. PaymentAmountModal/PaymentTable/page 변경은 정확한 지점·코드 조각 제시. "적절히" 류 없음.

**타입 일관성**: `GiroPayment`(id/unitNo/dong/tenantName/amount/paidAt/status/memo) T1(SQL)↔T2(apis)↔T3(GiroLedgerModal) 일치. `PaymentAction`에 'giro' 추가 T3 PaymentTable↔page `openAction` 일치. `defaultMethod: PaymentMethod` T3 PaymentAmountModal↔page 일치. `list_giro_payments` 인자(p_building_id,p_period) T1↔T2 일치.

**유의**: 지로 액션은 kind='full'(방법만 giro) — page openAction이 `{kind:'full', method:'giro'}` 설정, submitPayment는 amountModal.kind(=full)·모달 method(=giro 프리셋, 사용자가 onSubmit로 전달) 기록. SQL 무단위테스트(라이브 수동). GiroLedgerModal onCancel/isPending은 page의 `cancelRecordedPayment`·`cancelPayment.isPending` 재사용.
