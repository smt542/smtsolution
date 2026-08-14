# P6 수납 처리 — Phase C (효성CMS 자동이체 세대 다운) 설계

| | |
|---|---|
| **화면** | 수납처리·자동이체 · `/staff/payment` (Phase A/B 확장) |
| **모듈/권한** | `payment` |
| **PRD** | `docs/prototype/prd/payment-processing.md` §3.4 (자동이체 세대 관리 — 효성CMS) |
| **단계** | P6 결제/수납 — **Phase C** |
| **상태/작성자** | `draft` · 2026-08-14 |

---

## 1. 목적 · 범위

자동이체(효성CMS) 등록 세대의 **회원번호·청구금액 목록을 엑셀로 다운로드**한다. 사용자는 이 파일로 효성CMS 대량청구 파일을 조립·업로드한다(외부). CMS API 직접 연동은 범위 밖 — **다운로드 전용**.

### 이번 범위 (In)
- 신규 RPC `list_cms_debit_rows` (자동이체 세대 + 부과확정액, 회원번호 오름차순)
- 다운로드 라우트 `/api/payment/cms` (XLSX)
- `/staff/payment`에 `자동이체 세대 다운` 버튼

### 이번 범위 밖 (Out)
- **D** 지로 수납·원장
- 효성CMS **수납결과 파일** 역업로드(성공/실패 반영)
- CMS API 직접 연동, 회원번호 등록 UI(이미 입주자 상세 `unit_accounts.cms_member_no`로 존재)

---

## 2. 확정 결정 (Decisions)

1. **청구금액 = 부과확정액 미리채움** — `billing_confirmations.total_amount`(선택 부과월). 미확정 세대는 청구금액 빈칸(null).
2. **회원번호 오름차순 정렬** — 효성CMS 업로드 포맷 정렬과 일치(PRD §3.4).
3. **자동이체 세대 = `unit_accounts`(kind='mgmt').`cms_member_no` 존재** 세대 전체 포함(미확정 포함).
4. **다운로드 전용** — 검침대장(`/api/utilities/ledger`) 라우트 패턴 미러(GET → RPC → `rowsToXlsxBuffer`).
5. 컬럼 = **회원번호 · 예금주 · 호실 · 입주자 · 청구금액**. 실제 효성CMS 템플릿과 다르면 조정.
6. 마이그레이션 = **`0019`**(0018 다음). 구현 시 충돌 재확인.

---

## 3. 데이터 모델 — `0019_p6_cms_debit_download.sql`

### 신규 RPC `list_cms_debit_rows(p_building_id bigint, p_period date) returns table(...)`
- 반환: `cms_member_no text, holder text, unit_no text, dong text, tenant_name text, charged int`
- 소스: `unit_accounts`(kind='mgmt', `cms_member_no is not null`) 기준 세대 → units(호실)·최신 occupancies(입주자)·billing_confirmations(부과확정액, 해당 period) left join.
- 필터: 대상 건물 org 소속(`current_user_org()`), 세대 미삭제.
- 정렬: **`cms_member_no` 오름차순**(NULLS LAST 무관 — not null 필터).
- security definer, `set search_path = public`, `revoke from public,anon` + `grant to authenticated`. list_utility_rows/list_payment_rows 패턴.

---

## 4. 다운로드 라우트 — `app/api/payment/cms/route.ts`

`/api/utilities/ledger/route.ts` 미러:
- `GET`: query `buildingId`(양의 정수)·`period`(`YYYY-MM-01` 정규식) 검증 → 400.
- 서버 supabase client로 `buildings.select('name').eq('id', buildingId).maybeSingle()` → null이면 403(RLS 접근검증).
- `sb.rpc("list_cms_debit_rows", { p_building_id, p_period })`.
- 행 매핑 → `rowsToXlsxBuffer`:
  - 회원번호(cmsMemberNo) · 예금주(holder) · 호실(dong+unit_no) · 입주자(tenantName) · 청구금액(charged ?? "")
- 파일명 `{building.name}_자동이체_{YYYYMM}.xlsx`, `Content-Disposition` UTF-8(ledger와 동일 방식).

---

## 5. UI

`app/(staff)/staff/payment/page.tsx`:
- 상단 액션 영역에 **`자동이체 세대 다운`** 버튼 추가(엑셀 업로드 버튼 옆).
- 클릭 → `cmsDownloadUrl(selectedBuildingId, period)`로 anchor href 생성·다운로드(utilities `ledgerDownloadUrl` 패턴). 실패 시 toast.
- `selectedBuildingId===null`이면 비활성. (자동이체 세대 0건이어도 빈 파일 다운은 허용 — 별도 카운트 조회 없이 단순화.)

훅: `hooks/reactquery/payments/apis.ts`에 `cmsDownloadUrl(buildingId: number, period: string): string` 헬퍼(쿼리스트링 생성, `ledgerDownloadUrl` 미러).

---

## 6. 화면 상태

| 상태 | 조건 | 동작 |
|---|---|---|
| 기본 | 건물·부과월 선택 | 버튼 활성 |
| 건물 없음 | selectedBuildingId null | 버튼 비활성 |
| 다운로드 | 클릭 | 브라우저 파일 저장(자동이체 세대·회원번호 오름차순·청구금액 확정액) |
| 실패 | 네트워크/서버 오류 | "다운로드하지 못했습니다" toast |

---

## 7. 테스트

- **라우트 단위테스트** `app/api/payment/cms/route.test.ts`: RPC mock → XLSX 응답 헤더(Content-Type·Content-Disposition 파일명)·본문 파싱(ExcelJS load)로 헤더행·회원번호 오름차순 검증(ledger route 테스트 있으면 미러; 없으면 최소 파라미터 검증·403·200).
- **훅** `cmsDownloadUrl` 순수 URL 생성 단위테스트.
- **페이지** 버튼 렌더·href·비활성 조건.
- SQL은 리뷰 검증, 라이브 수동.

---

## 8. 리스크 · 유의

- **마이그레이션 번호** `0019`(0018 다음) — 병렬 브랜치 충돌 재확인(Phase B에서 P5c 0016/0017 충돌 선례). 라이브 적용 수동·순서 준수.
- **효성CMS 템플릿 상이**: 컬럼/순서가 실제 효성CMS 업로드 양식과 다를 수 있음 — 사용자 확인 후 컬럼 조정 가능하도록 라우트 매핑을 단순 유지.
- **미확정 세대**: 청구금액 빈칸으로 포함 → 사용자가 누락 인지 가능. 효성CMS 업로드 전 확인 필요.
- **회원번호 중복**: 이론상 unit_accounts unique(unit_id, kind)이므로 세대당 mgmt 1행, 회원번호 자체 중복은 데이터 문제(정렬만 하고 별도 dedup 안 함).
