# 개인정보 서버 마스킹 이관 — 잔여 작업 인수인계

- 2026-09-21 작업. **여기 적힌 것은 전부 라이브 적용·실측 검증까지 끝난 상태다.** 남은 건 아래 5절.
- 선행 문서: `2026-09-18-pii-privacy-track.md`. 다만 그 문서는 09-18 시점이라 마이그 미적용·B가 discus에 있다는 서술이 낡았다. **이 문서가 최신이다.**

## 1. 왜 이 작업이 남았나

목록 응답에 연락처 원문이 담겨 화면에서만 별표로 가리면, 개발자도구 Network 탭에서 조직 전원의
연락처가 한 번에 보인다. 목적은 "직원에게 숨기기"가 아니라 **한 번에 많이 퍼가는 표면 줄이기**다.
단건 열람은 정당한 업무이므로 `[원문]` 버튼 + 감사기록으로 열어 준다.

## 2. ⚠️ 순서를 반드시 지킬 것

목록을 먼저 마스킹하면 **되돌릴 수 없는 사고**가 난다.

```
① 발송이 목록 번호에 의존하지 않게  →  ② 그 목록의 소비자들이 원문을 따로 받게  →  ③ 목록 마스킹
```

- ①을 건너뛰면 발송이 마스킹된 번호로 나간다.
- ②를 건너뛰면 편집 폼에 `010-****-5678`이 들어가고, 저장 RPC가 값을 **직접 대입**하므로
  DB 원문이 마스킹 문자열로 **영구 파괴**된다. (`admin_update_member_basic`,
  `platform_update_account` 등은 부분 보존이 아니다.)

①은 이미 끝났다(마이그 0180). ②가 목록마다 다르고, 그게 5절의 잔여 작업이다.

## 3. 지금까지 된 것

| 마이그 | 내용 |
|---|---|
| 0174 | `access_log` + `lib/audit/accessLog.ts` |
| 0175 | 공개 링크 30일 |
| 0176 | 목록 마스킹 1차(파트너·이력 4개 RPC) |
| 0177 | 0176이 만든 `partner_search_tenants` 오버로드 모호성 해소 + PUBLIC execute 회수 |
| 0178 | `admin_set_member_permissions` 오버로드 해소(두 본문 병합) |
| 0179 | 감사로그 2년 보존 `purge_access_log()` + `/api/cron/purge-access-log` |
| 0180 | **발송 번호를 클라이언트 값이 아니라 `ref`의 id로 서버 해석** |
| 0181 | 계정 목록 마스킹(`list_accounts`, `platform_list_accounts`) |
| 0182 | 건물·파트너세대 목록 마스킹(`list_buildings.owner_phone`, `partner_list_units.phone`) |

**서버 마스킹 완료 8개**: `partner_search_tenants` · `partner_list_building_vendors` ·
`list_message_logs` · `list_occupancy_history` · `list_accounts` · `platform_list_accounts` ·
`list_buildings` · `partner_list_units`

**기반 도구**(이미 있음, 재사용할 것):
- `POST /api/pii/reveal` — 화이트리스트·org 소유 검증·파트너 담당건물 게이트·fail-closed 감사.
  `{ targetKind, targetId, fields: ['phone','phone_sub'] }` → `{ values: {...} }` (최대 8개).
  단건 `{ field }` → `{ value }`. 훅: `useRevealPii`, `useRevealPiiBatch`(`gcTime:0`).
- SQL `public.mask_phone(text)` — `010-1234-5678` → `010-****-5678`, `02-` 접두 처리, service 전용 아님(authenticated).
- 계정 2화면이 **레퍼런스 구현**이다. `AccountFormModal.tsx`와 platform `AccountEditModal.tsx`:
  폼 기본값 `phone: ""` → 열릴 때 reveal로 원문 수령 → 조회 전·실패 시 **저장 차단** → 저장 직전 재확인.

## 4. 마스킹하면 안 되는 것

- **`organizations.phone` / `fax`** — 법인 대표번호이고, `useOrgContact`가 읽어 `관리사무소연락처`
  템플릿 변수로 **발송 문자 본문에 들어간다**. 마스킹하면 입주민이 받는 문자에 별표가 찍힌다.
  그래서 `platform_list_organizations`는 의도적으로 제외했다.
- **엑셀·인쇄물·고지서·지로·팩스** — 정책상 원문. 반출 자체를 `access_log`에 기록하는 것으로 갈음한다.
- **편집 폼 input** — 마스킹 값이 저장되면 데이터 파괴.
- 대상 필드는 **휴대폰·전화·팩스만**. 계좌번호·예금주·입주자명·차량번호는 사용자 지시로 범위 밖(2026-09-21 재확인).

## 5. 남은 작업 — 각각 소비 경로 이관이 선행돼야 한다

⚠️ **"편집 폼이 상세를 따로 조회하니 마이그 한 줄이면 된다"는 판단은 틀렸다.** 편집 외 소비자
(인쇄·클라이언트 검색·선택 UI)를 반드시 같이 훑어야 한다. 실제로 이 오판으로 4개 중 2개만 가능했다.

### 5-1. `list_tenants.phone`
- **블로커**: 입주자카드 **인쇄**. `TenantCardDocument`가 `tenant: TenantListRow`(= `list_tenants` 행)를
  그대로 받는다. `TenantOutputModal`이 `useTenantList()`로 넘긴다.
- **필요한 일**: 인쇄 데이터를 서버에서 조회하도록 이관. `app/api/buildings/export/route.ts`가
  이미 그 방식이다(클라이언트 payload를 안 쓰고 RPC로 재조회 + `logAccess`).
- 발송 소비자(`useNoticeMessaging`·`useNoticeAlimtalkSend`)는 0180으로 **이미 해소됐다**.

### 5-2. `list_receipts_workspace.phone` (+ nested `occupancy.phone`)
- **블로커**: `UnifiedSearchModal.tsx`가 **클라이언트에서 번호를 필터링**한다 —
  `digitsOf(row.phone).includes(dv)`. 마스킹하면 `digitsOf("010-****-5678")="0105678"`이라 검색이 죽는다.
- **필요한 일**: 번호 검색을 서버 검색으로 이관(RPC의 `p_search`가 원문 컬럼을 비교하게).
- 결제내역 메시지 소비자는 0180으로 해소됐다.

### 5-3. `list_bill_targets` (`phone`, `phone2`, `fax_number`)
- **블로커**: 지로 인쇄(`GiroPrintView`)와 팩스 대상 선택·확인 UI(`DocumentOutputModal`,
  `OutputSelectionPane`)가 직접 쓴다.
- **참고**: 실제 팩스 발송은 이미 서버에서 재조회한다(`resolve_fax_bill_issues`, `loadFaxDocumentData`).
  남은 건 화면 표시와 인쇄 시트다.

### 5-4. `list_res_claims` (`resident_phone`, `claimed_phone`, `occupancy_phone`)
- **미조사**. `ResidentClaimsPanel`이 표·연결 모달에 표시만 하고 저장은 ID 연결이라는 정찰 결과가
  있으나 직접 확인하지 않았다. 먼저 소비자 전수 확인부터 할 것.

### 5-5. RPC가 아닌 raw PostgREST 목록 6개
`listComplaints` · `listVendors` · `listBuildingVendorsByBuilding` · `listOccupancies` ·
`listOverdueHouseholds` · `listAllBuildings` (각 `hooks/reactquery/<도메인>/apis.ts`)
- 이들은 RPC가 아니라 테이블을 직접 select 하므로 `mask_phone()`을 붙일 자리가 없다.
  **마스킹하려면 RPC로 감싸야 한다.**
- 폼 바인딩이 있어 ②가 선행돼야 하는 것: 민원(`AsComplaintForm`의 `reporterPhone`),
  거래처(`VendorFormModal`의 `phone`), 건물 거래처(`getBuildingFull` → `BuildingForm` → `save_building`).
- 미납 목록은 메시지 발송(0180으로 해소)과 **클라이언트 CSV/출력**에 쓰인다 — 5-2와 같은 유형.

### 권장 순서
1. **5-1 `list_tenants`** — 효과 대비 명확하고(입주자 연락처가 가장 민감·건수 최다), 이관 방식의
   본보기가 이미 있다(엑셀 라우트).
2. 5-2 → 5-3 → 5-5(민원·거래처) → 5-4

## 6. 작업 환경 — 이것 모르면 시간 날린다

### DB 적용
- **프로덕션 DB 쓰기는 Claude Code auto 모드 분류기에 차단된다.** 사용자가 `!` 로 직접 실행해야 한다.
  `UPDATE` 문이 들어간 명령은 파일 작성조차 막히므로, 픽스처는 프롬프트에 인라인으로 주고 사용자가 실행한다.
- 적용기: `node --env-file=.env.local scripts/db-query.mjs <sql파일>` (master에 있음, ref 가드 내장).
  출력이 `[]` 면 성공. Supabase MCP는 **무관한 프로젝트**만 붙어 있으니 쓰지 말 것.
- 커밋 직전 `git ls-tree origin/master supabase/migrations/` 로 번호 재확인(병렬 세션이 선점한다).
- ⚠️ Git Bash에서 `%TEMP%` 는 안 풀린다. 절대경로를 쓸 것.

### 검증 계정·세션
- 계정 `admin`(사무실)·`hqadmin`(통합관리자)·`field1`(현장, 담당건물 1·2) / 비번 `erp!12345`.
- ⚠️ auth 이메일은 `demo.<username>@staff.gwanribiseo.app` 이다. GoTrue 직접 로그인 시 `demo.` 접두가 필요하다.
- 더 쉬운 길: 앱 로그인 API에 `{username, password}` 를 POST 해 쿠키를 받는다 —
  `/api/staff/login`, `/api/partner/login`, `/api/platform/login`.
  쿠키(`sb-<ref>-auth-token`)는 `base64-` 접두를 떼고 JSON 파싱하면 `access_token` 이 나와,
  PostgREST RPC를 세션 권한으로 직접 부를 수 있다.
- dev 서버는 master 체크아웃(`localhost:3000`)에서 돈다. 소스 변경은 HMR로 자동 반영된다.

### ⚠️ 검증용 데이터가 없다
이 환경의 `profiles`·`buildings` 에는 전화번호가 **0건**이다(`occupancies`만 37건 전부 있음).
그래서 계정·건물 목록은 값으로 마스킹을 확인할 수 없다. 실측하려면 데모 계정에 임시 번호를 넣었다
빼야 한다. 0181 검증 때 쓴 방식:
```
넣기: update public.profiles set phone='010-1234-5678', phone_sub='02-987-6543' where username='field1';
빼기: update public.profiles set phone=null, phone_sub=null where username in ('admin','field1');
```
**반드시 원복할 것.** 원래 전부 null이었다.

### 검증 레시피 (이번에 효과를 본 방식)
1. **적용 전 기준선을 먼저 찍는다.** 마스킹 전 목록이 원문을 내리는 것을 기록해 두면 적용 후
   "뒤집혔다"가 증명된다. 구조 확인만으로는 약하다.
2. **편집 왕복을 반드시 실측한다**: 목록(마스킹) → reveal(원문) → 저장 RPC 호출 → reveal 재조회.
   저장 후에도 원문이면 통과. 이게 이 트랙에서 가장 중요한 검증이다.
3. **번호 검색이 살아있는지 확인한다.** 마스킹된 값에 없는 숫자로 검색해 결과가 나오면
   WHERE가 원문을 비교한다는 증명이다.
4. **엑셀·인쇄물에 별표가 샜는지 확인한다.** 응답 바이트에서 `\*{3,}` 를 센다.
5. RPC를 새로 만들거나 교체했으면 **PostgREST 오버로드 스윕**을 돌린다. 자세한 함정은
   `postgrest-function-overload-ambiguity` 메모 참고(0176이 이걸로 프로덕션을 깼다).

### 워크트리
- 워크트리엔 `node_modules` 가 없다. master 것을 정션 연결해 쓰고 **끝나면 반드시 제거**한다
  (`cmd //c "rmdir node_modules"`). 정션을 남긴 채 워크트리에서 `npm install` 하면 master가 날아간다.
- 검증은 `node ./node_modules/typescript/bin/tsc --noEmit` 와
  `node ./node_modules/eslint/bin/eslint.js .` (npm run·npx는 전역으로 끌려가 실패).
- ⚠️ master는 여러 세션이 공유하는 라이브 트리다. 다른 세션의 미커밋 변경이 보여도 건드리지 말 것.

### Codex 위임
- 유효하다. 다만 **메모리 부족으로 시스템이 중단시킬 수 있다.** 이번에 통합관리자 모달이
  미완성 상태로 남았고(원문 주입 effect·저장 가드·오류 UI 누락) 그대로 뒀다면 번호가 빈 채 저장돼
  **원문이 지워졌을** 코드였다. **Codex 결과는 반드시 diff로 끝까지 확인할 것.**
- 프롬프트에 큰따옴표를 넣지 말고 파일+리다이렉트로 넘긴다. 정션이 없으면 tsc/lint를 못 돌리므로
  정션을 먼저 만들거나, 검증은 Claude가 직접 한다.

## 7. 재개 프롬프트

```
docs/superpowers/plans/2026-09-21-pii-masking-rollout.md 를 읽고 개인정보 서버 마스킹 이관을 이어가줘.

지금 8개 목록이 서버 마스킹돼 있고, 남은 5개는 각각 원문이 필요한 소비자가 있어서
마이그레이션 한 줄로는 안 된다. 문서 5절에 목록별 블로커와 필요한 작업이 정리돼 있다.

5-1 list_tenants 부터 하자. 입주자카드 인쇄가 목록 행을 그대로 받는 게 블로커이고,
엑셀 라우트(app/api/buildings/export)가 이미 서버 재조회 방식이니 그걸 본보기로 삼으면 된다.

지켜야 할 순서: 소비 경로를 서버로 옮긴 다음에 목록을 마스킹한다. 반대로 하면
편집 폼에 마스킹 값이 들어가 DB 원문이 파괴된다.

프로덕션 DB 쓰기는 네 권한으로 막히니 적용 명령은 나한테 하나씩 알려줘.
검증은 문서 6절 레시피대로 적용 전 기준선부터 찍고, 편집 왕복을 실측해줘.
```
