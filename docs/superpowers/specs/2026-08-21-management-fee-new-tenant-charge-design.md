# 관리비 세팅 마감 — §3.3 신규 입주자 당월 부과 팝업 + §3.4 건물 셋팅 확인 체크박스

- **상태**: approved (2026-08-21)
- **대상 화면**: 관리비 부과 셋팅 · `/staff/management-fee`
- **PRD 정본**: `docs/prototype/prd/management-fee-setting.md` §3.3, §3.4, §5
- **배경**: 두 기능은 2026-08-12 P5 부과확정 슬라이스에서 "다음 슬라이스"로 의식적으로 보류(`docs/superpowers/specs/2026-08-12-p5-billing-confirmation-design.md:34-35,342-343`) 후 미착수. 관리비 세팅 화면의 마지막 PRD 공백.
- **구현 방식**: codex 토큰 소진으로 Claude 직접 TDD 구현.

---

## 1. 목표 (PRD 요구)

### §3.3 신규 입주자 당월 부과 팝업
- 당월 부과 확정 **이후** 신규 입주자가 등록되면 자동으로 팝업 표시.
- 내용: "이번 달 관리비를 부과하시겠습니까?"
- 확인 → 해당 세대 당월 관리비 부과 적용 / 취소 → 미적용(다음달부터).
- §5 데이터표: "신규 입주자 감지 | 입주자 테이블 | 부과 확정 이후 신규 입주자 등록 시 트리거".

### §3.4 건물별 셋팅 확인 체크박스
- 특정 건물에 셋팅 시 반드시 확인이 필요한 경우 체크박스로 표시.
- 건물 상세 설정에서 활성화. 활성 건물 선택 시 "이 건물 셋팅 시 확인이 필요합니다" 팝업 → 확인 후 진행.

---

## 2. 확정된 설계 결정 (2026-08-21 사용자 승인)

| # | 결정 | 사유 |
|---|---|---|
| D1 | §3.3 재노출 = **진입마다** (미부과 신규세대 있으면 화면 진입/건물선택 때마다 팝업). localStorage/세션 억제 없음 | 신규입주 누락 실무 리스크 최소화. 미부과 세대 있을 때만 뜨므로 과다노출 아님 |
| D2 | §3.3 부과 범위 = **세대별 체크박스, 기본 전체선택** | 특정 세대만 보류 가능(오부과 방지). 취소=아무것도 부과 안 함 |
| D3 | §3.3 발동 위치 = **관리비 화면 진입/건물선택** (자기완결) | PRD가 이 화면 문서에 정의. 입주자 등록화면 실시간 교차 트리거는 과설계 |
| D4 | 신규 1세대 부과 시 **confirm_billing 재실행 금지**, **대상 세대 전용 RPC** | confirm_billing은 건물 전체 재확정 → 나머지 세대 billing_history 중복 append됨 |
| D5 | §3.4 확인 팝업 = **window.confirm** | 기존 부과확정(`handleConfirm`)이 window.confirm 사용 → 일관성. 신규 컴포넌트 불필요 |

---

## 3. 아키텍처

기존 부과 슬라이스(마이그 0012/0021, `hooks/reactquery/billing.ts`, `app/(staff)/staff/management-fee/`) 위에 얹는다. 새 테이블 없음(컬럼 1개 + RPC 2개 + 모달 1개 + 훅 2개).

### 3.1 DB 마이그레이션 — `00XX_management_fee_new_tenant_charge.sql`
> 번호는 **커밋 직전 `origin/master` max 재확인**. 작성 시점 max=`0091` → **0092** 예정 ([[migration-number-collision]]).

**(a) §3.4 컬럼**
```sql
alter table buildings add column if not exists setup_confirm_required boolean not null default false;
```

**(b) 감지 RPC** `list_uncharged_new_occupancies(p_building_id bigint, p_period date)`
- 반환: `table(unit_id bigint, unit_no text, dong text, tenant_name text, move_in_date date)`
- `security definer`, `set search_path = public`, org 스코프(`buildings.org_id = current_user_org()`).
- 로직:
  1. `v_confirmed_at := max(bc.confirmed_at)` — 해당 건물 units의 billing_confirmations 중 `period=p_period and confirmed_at is not null`. **null이면 즉시 빈 결과**(건물 미확정 → 정상 부과확정 플로우, 팝업 없음).
  2. 각 unit의 **최신 활성 occupancy**(`distinct on (unit_id) ... order by created_at desc, id desc`, `deleted_at is null`)가:
     - `status = 'occupied'` (공실 아님)
     - `occupancy.created_at > v_confirmed_at` (부과확정 이후 등록)
     - 해당 unit+period에 **확정행 없음**(`not exists billing_confirmations where confirmed_at is not null`)
  3. 조건 충족 세대만 반환.
- `revoke execute ... from public, anon; grant ... to authenticated;`

**(c) 부과 RPC** `charge_new_occupancies(p_building_id bigint, p_period date, p_unit_ids bigint[])`
- 반환: `jsonb {unit_count, total}`
- `security definer`, 가드 = confirm_billing과 동일(org null 거부·`current_user_has_module('billing')`·건물 org 소속·period 1일·미래 금지).
- **안전장치**: `p_unit_ids` 중 실제 (b) 감지 대상인 세대만 부과(임의 unit 차단). 즉 내부에서 (b)와 동일 필터 재적용 후 교집합만 처리.
- 세대별 계산 = **confirm_billing(0021) 세대 루프 본문과 동일**:
  - fee_items(type_id 일치·org·미삭제) × fee_item_charges(당월) LEFT JOIN, 이월 prefill(`coalesce(fic.amount, case when fi.carry_over then prev.amount else 0 end, 0)`), `charged` 필터.
  - 일할: `daily_proration and v_occupied < v_days`면 `round_charge(amount * v_occupied / 30, rounding)` (분모 고정 30).
  - `billing_confirmations` upsert(`confirmed_at=now(), confirmed_by=auth.uid()`), `billing_history` append.
  - audit_log action `BILLING_CHARGE_NEW`.
- `revoke ... from public, anon; grant ... to authenticated;`
- **패리티**: (c)의 세대 계산은 confirm_billing과 반드시 동일 결과. 미러링임을 주석 명시 + 테스트로 방어(§6).

### 3.2 훅 — `hooks/reactquery/billing.ts`
- `useUnchargedNewOccupancies(buildingId: number | null, period: string)` — `enabled: !!buildingId`. `rpc('list_uncharged_new_occupancies', {...})`. queryKey `["billing","new-occ",buildingId,period]`. 반환 `{unitId, unitNo, dong, tenantName, moveInDate}[]`.
- `useChargeNewOccupancies()` — mutation `rpc('charge_new_occupancies', {p_building_id, p_period, p_unit_ids})`. onSuccess: `invalidateQueries` for `["billing"]`(list_billing) + new-occ.
- 감지 쿼리 에러는 **비차단**(팝업 미표시). 부과 뮤테이션 에러는 toast.

### 3.3 건물 필드 (§3.4)
- `hooks/reactquery/buildings.ts`: 건물 타입에 `setupConfirmRequired: boolean` 매핑(select에 `setup_confirm_required` 포함), 저장 RPC/payload에 컬럼 반영.
- 건물 상세 폼(`app/(staff)/staff/buildings/components/BuildingForm.tsx` + 적절 섹션, 예: `sections/BasicInfoSection.tsx` 또는 `MemoSection.tsx`): 체크박스 "관리비 셋팅 시 확인 필요" 바인딩·저장 배선.

### 3.4 UI — `app/(staff)/staff/management-fee/page.tsx`
- **§3.4 게이트**: `selectBuilding(v)`에서 선택 건물 `setupConfirmRequired === true`면 `window.confirm("이 건물은 셋팅 시 확인이 필요합니다. 계속하시겠습니까?")`. 취소면 early-return(선택 롤백, Select는 buildingId로 제어되어 자동 원복). 확인이면 기존대로 setBuildingId + draft 초기화.
- **§3.3 팝업**: `useUnchargedNewOccupancies(buildingId, period)` 결과가 있으면 `NewTenantChargeModal` 자동 오픈.
  - 진입마다(D1): `useEffect`가 `[buildingId, period]` 기준으로 "이번 진입에서 아직 안 열었으면" 오픈(데이터 도착 시). 렌더 루프 방지 위해 열림 트리거는 selection 단위 1회, 취소 후 같은 selection 내 재오픈 안 함(단 건물/월 재진입 시 다시 오픈).
  - 확인 → `useChargeNewOccupancies` (체크된 unitId) → toast(`n세대 · 금액`) → 무효화(부과된 세대는 감지결과에서 빠짐) → 모달 닫힘.
  - 취소 → 닫기(부과 없음).

### 3.5 신규 컴포넌트 — `NewTenantChargeModal.tsx`
- props: `{ open, units: {unitId,unitNo,dong,tenantName,moveInDate}[], pending: boolean, onConfirm(unitIds:number[]), onClose() }`.
- 세대 목록(동/호실 · 이름 · 입주일) 각 행 체크박스(기본 전체 체크), 상단 문구 "이번 달 관리비를 부과하시겠습니까?", 하단 확인/취소. 확인 시 체크된 unitId만 onConfirm. 전부 해제 시 확인 비활성. Escape=닫기.

---

## 4. 데이터 흐름

```
건물 선택
  └ setupConfirmRequired? → window.confirm (취소=롤백)               [§3.4]
  └ useBilling → BillingTable (기존)
  └ useUnchargedNewOccupancies(building, period)
        └ rows>0 → NewTenantChargeModal 자동 오픈                      [§3.3]
              └ 확인 → charge_new_occupancies(checked units)
                    └ billing_confirmations upsert + billing_history append
                    └ invalidate → 감지결과 비어짐 → 모달 닫힘
              └ 취소 → 닫기 (다음 진입 시 재노출)
```

---

## 5. 화면 상태 / 에러

- 건물 미확정(v_confirmed_at null) → 감지 빈 결과 → 팝업 없음(정상 부과확정 플로우만).
- 감지 쿼리 실패 → 팝업 미표시(비차단), 화면 정상.
- 부과 RPC 실패 → toast 에러, 모달 유지.
- 권한: 이 화면은 `hasModule(me,'billing')` 게이트(기존). RPC도 `current_user_has_module('billing')` 가드.

---

## 6. 테스트 (TDD, vitest)

- `NewTenantChargeModal.test.tsx`: 렌더·기본 전체체크·개별토글·전부해제 시 확인 비활성·확인이 체크 unitId로 onConfirm·취소가 onClose.
- `page.test.tsx` 추가: (i) `setupConfirmRequired` 건물 선택 시 window.confirm 호출·취소 시 미선택 (window.confirm 목킹); (ii) 감지결과 있을 때 모달 자동 오픈; (iii) 확인 시 charge 뮤테이션 호출 (훅 목킹).
- 건물 폼 섹션 테스트: 체크박스 렌더 + onChange 저장 배선.
- (선택) 훅 테스트: supabase rpc 목킹으로 파라미터·매핑 검증(기존 billing 훅 테스트 패턴 준수).
- **RPC 금액 패리티**: SQL 직접 테스트 인프라 없음 → (c) 계산 로직을 confirm_billing과 1:1 미러링하고 주석 명시. TS `lib/billing/proration.ts`의 `effectiveAmount`로 동일 규칙(30일 분모) 이미 검증됨.

---

## 7. 범위 밖 (YAGNI)

- 입주자 등록화면(건물 상세)에서의 실시간 교차 팝업 트리거(D3).
- 신규세대 부과 취소 이력/사유 기록.
- 알림톡/문자 자동 발송(Track E, 별도).

---

## 8. 파일 변경 요약

| 파일 | 변경 |
|---|---|
| `supabase/migrations/00XX_management_fee_new_tenant_charge.sql` | 신규: 컬럼 + RPC 2 |
| `hooks/reactquery/billing.ts` | 훅 2개 추가 |
| `hooks/reactquery/buildings.ts` | `setupConfirmRequired` 매핑·저장 |
| `app/(staff)/staff/management-fee/page.tsx` | §3.4 게이트 + §3.3 모달 연결 |
| `app/(staff)/staff/management-fee/components/NewTenantChargeModal.tsx` | 신규 |
| `app/(staff)/staff/buildings/components/.../*Section.tsx` | 체크박스 |
| 각 `*.test.tsx` | 테스트 추가 |
