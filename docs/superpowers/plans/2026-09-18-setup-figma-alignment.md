# /staff/setup Figma 정합 구현 계획

작성 2026-09-18 · 워크트리 `PracLee/kahawai` · 기준 커밋 `def0af8`

Figma 파일 `0gVUin54nFd3QDZt73McqD`의 9개 노드를 `/staff/setup`에 구현한다.

## 0. 노드 판독

| 노드 | 크기 | 정체 |
|---|---|---|
| `72:72752` | 2324×921 | 회사 정보 (전체 화면) |
| `72:71961` | 2324×921 | 고지서 설정 (전체 화면) |
| `72:71689` | 1680×807 | 고지서 설정 본문 확대 |
| `72:70856` | 2324×921 | 이사정산 설정 (전체 화면) |
| `72:70542` | 1680×807 | 이사정산 설정 본문 확대 |
| `72:69948` | 2324×921 | A/S 설정 (전체 화면) |
| `72:69385` | 2324×921 | 알림 설정 (전체 화면) |
| `72:68647` | 2324×921 | 데이터 이관 (전체 화면) |
| `72:68428` | 1680×807 | 데이터 이관 본문 확대 |

실질 **6개 탭 + 본문 확대본 3장**이다. 프레임 규약(노드 `72:69385` 실측):

```
문서 프레임 1920×911 = 사이드바 240 + 본문 1680
                 911 = 헤더 62 + 탭바 43 + 본문 806
```

우측 A/S 레일(404)과 메신저 FAB은 문서 프레임 **밖으로** 나가는 형제 프레임이라 스크린샷 원본이
2324×921로 잡힌다. 프레임 크기로 오해하면 안 된다.

본문 확대본(1680×807)이 본문 컬럼과 정확히 일치한다. **px 사양은 확대본에서 실측, 배치 검증은 전체 화면에서** 한다. Figma 변수는 미정의(`get_variable_defs` → `{}`)라 색·치수는 노드별 `get_design_context`로 뽑는다.

## 1. 확정된 제품 결정 (2026-09-18 사용자 승인)

| # | 결정 | 영향 |
|---|---|---|
| D1 | `시스템 설정` 탭 **삭제** — Figma 6탭 그대로 | 아래 "삭제 영향" 참조 |
| D2 | 회사 정보의 `SMS·팩스 발신번호` 행 **제거** | `useSaveSetupSender` · `/api/setup/sender`가 호출부 없이 남는다 (컬럼·API는 보존) |
| D3 | 저장 모델: **폼만 헤더 저장 · 리스트는 즉시 저장 유지** | `setup_config` 계열만 헤더 버튼으로 일괄 커밋. A/S 유형·정산 체크 항목은 기존처럼 추가/수정/삭제 즉시 저장 |
| D4 | 연체 12단계는 **기존 `late_fee_rate_tiers`(마이그 0031) 재사용** | `/staff/overdue`와 단일 원장. overdue에서 임의 구간을 정의해 뒀으면 setup 저장 시 12구간으로 평탄화됨 |

### D1 삭제 영향 (실측)

| 마스터 | 다른 화면의 소비 | 삭제 영향 |
|---|---|---|
| AS 구분 | `A/S 설정` 탭 | **무손실** — 동일 편집 UI 중복이었음 |
| 룸타입 | `TenantForm`이 셀렉트로 읽음 | 신규 룸타입 **추가 UI 소실** (기존 값은 정상 동작) |
| 자주 보내는 문자 | `MessagingComposer`가 읽음 | 신규 템플릿 **추가 UI 소실** (기존 값은 정상 동작) |
| 정화조 업체 | 없음 | 실질 무영향 |
| 청소팀 | 없음 | 실질 무영향 |

→ 훅(`hooks/reactquery/roomTypes|septicVendors|cleaningTeams|quickMessages`)과 테이블은 **보존**한다. 탭만 제거하므로 되돌리려면 `SetupTabs`에 한 줄 복구면 된다. 룸타입·자주보내는문자 편집기를 각각 `TenantForm`·메시징 화면으로 옮기는 건 별건으로 남긴다.

## 2. 탭별 작업 내용

### 회사 정보 — `CompanyInfoTab`
- 카드 `관리업체 정보` 1장, 7행: 상호 / 대표 전화 / 팩스 / 사업자등록번호 / 대표자 / 주소 / 운영 시간
- 레이아웃: 라벨 좌 + 설명 부제 + 인풋 **우측 정렬**, 인풋 폭이 필드별로 다름
- 발신번호 2행 + 검증 배지 제거 (D2)
- 데이터·훅 변경 없음 (`setup_config` 기존 컬럼)

### 고지서 설정 — `BillingSettingsTab` (가장 무거움)
카드 4장:
1. `관리비 입금 계좌` — 은행/계좌번호/예금주 × 2행 + `고지서 출력` **라디오**(정확히 1개). 현 `계좌 설정` 탭에서 이관. 컬럼 `mgmt_*1/2`, `mgmt_print1/2` 그대로
2. `고객 안내사항` — textarea + **250자 카운터** (`213 / 250자`). 현재 `maxLength` 없음 → UI 제한 추가
3. `출력 옵션` — 4행 **세그먼트(출력/미출력)**: 단전·단수(+`개월부터` 숫자 인풋 `cutoff_months`), 수도 단가, 관리비 기간, 증감량. 컬럼 4개 모두 존재
4. `관리비 연체 설정` — 카드 우측 **Switch** + 12칸 그리드(1~11개월차 + 12개월차 이후, % 인풋 36px). 8열 × 2행 배치
   - 값: `late_fee_rate_tiers` 어댑터 (D4)
   - on/off: `setup_config.late_fee_enabled` **신규 컬럼** (마이그 1건)

현재 탭에만 있고 Figma에 자리가 없는 `세대 표기 방식`(`unitLabelDefault`) · `연체료 합산`(`lateFeeMerge`) · `AS현황 메인표시`(`showAsOnMain`) **3개는 UI에서 제거**한다. 실측 결과 이 셋은 setup 화면 자신(`BillingSettingsTab`) · 폼 스키마 · API 매퍼 외에 **어느 화면도 읽지 않는다** — 값을 바꿔도 동작하는 곳이 없는 설정이다. 컬럼·매퍼·스키마는 보존하므로 되돌리기는 UI 복구뿐이다.

### 이사정산 설정 — `MovingSettlementSettingsTab`
카드 3장:
1. `이사정산 입금 계좌` — 현 `계좌 설정` 탭에서 이관 (`settle_*`)
2. `정산 체크 항목` — 번호 태그 **5열 그리드**(셀 312.39 × 52, gap 8), 최대 24개 + `24 / 24` 카운터 + `＋ 항목 추가`(101×38). 현재 `MasterListEditor` → `NumberedTagList`로 교체, 상한 24 추가
3. `정산 기준` — 3행, 앱 필드와 **1:1 대응**(실측 완료, 노드 `72:70798`):

   | Figma 행 | 부제 | 세그먼트 | 앱 컬럼 |
   |---|---|---|---|
   | 수도 단가 반영 | 정산 시 수도 단가를 금액에 반영 · **변경 불가** | 반영 / 안함 | `water_unit_reflect` |
   | 전기 단가 반영 | 정산 시 전기 단가를 금액에 반영 · **변경 불가** | 반영 / 안함 | `electric_unit_reflect` |
   | 공실 수납 처리 | 퇴실 후 공실 세대의 수납 처리 방식 · **변경 불가** | 수동 / 자동 | `vacancy_payment_mode` |

   → Figma는 세 행 부제에 `· 변경 불가`를 달고 세그먼트를 흐리게 그렸지만, **편집 가능하게 유지한다** (2026-09-18 사용자 결정 "정산기준은 살려놔야할것 같아"). 편집 가능한데 `변경 불가`라고 적으면 모순이므로 부제의 `· 변경 불가` 접미만 뺀다 — 그 3개 문자열은 Figma와 어긋나는 의도된 예외다.

### A/S 설정 — `AsSettingsTab`
- 카드 `A/S 접수 유형` 1장, 번호 태그 5열 그리드 + `6 / 6` 카운터 + `+ 유형 추가`
- 데이터·MAX=6 이미 일치 → **표현만 교체**

### 알림 설정 — `NotificationSettingsTab`
- 카드 1장, 2행: 입주 예정 세대 알림(Switch) / 임대 만료일 알림(`만료 [7일 ▾] 전부터` + Switch)
- 필드 3개 모두 존재 → 내부 `Toggle` 함수를 공용 `Switch`로 교체

### 데이터 이관 — `DataMigrationTab`
- **순수 시각 정합**. 그룹 3개·행 8개·문구·선행조건 칩이 `dataMigration/schemas.ts`와 문자 단위 100% 일치
- 로직(`localStorage` 진행 기록, CSV 검증, 선행 잠금) **손대지 않음**

## 3. 공용 컴포넌트 (CLAUDE.md 공용 우선)

신규 — `components/common/`:

| 컴포넌트 | 사용처 |
|---|---|
| `Switch` | 연체 설정 1, 알림 2. 현 `NotificationSettingsTab` 내부 함수 + `resident/notify/NotificationSwitch` 중복 해소 |
| `SegmentedControl` | 출력/미출력 4, 반영/안함 2+ |
| `Radio` | 고지서 출력 계좌 선택 (앱 전체에 공용 라디오 없음) |
| `NumberedTagList` | A/S 유형 6, 정산 체크 24. 번호 + 인풋 + × + 카운터 + 추가 버튼 |

확장 — 기존 호출부 무영향으로:
- `Panel` → `subtitle` prop (Figma 카드는 전부 제목+부제 52px 헤더)
- `Textarea` → 문자수 카운터
- `Input` → Figma 규격 사이즈(38 / 40 / 36px). 현재 `h-11`(44) 고정

## 4. 셸·헤더

Figma는 62px 바에 `셋업 설정` + 우측 teal `저장`. 현 `Topbar`엔 액션 슬롯이 없다.

→ **슬롯 메커니즘을 새로 만들지 않고** 기존 `AppShell.hasIntegratedHeader` 패턴을 쓴다. `/staff/buildings`·`/staff/notices`·`/staff/utilities`가 이미 자체 62px 헤더를 그리는 선례다.
- `AppShell.hasIntegratedHeader`에 `/staff/setup` 추가
- 헤더는 `SetupHeader` 전용이 아니라 **공용 `components/shell/PageHeader`**로 만든다 — 실측 결과 Figma 헤더가 기존 `Topbar`와 픽셀 단위로 같고 `저장` 버튼만 다르며, 이미 3개 화면이 같은 마크업을 손으로 복제해 뒀기 때문이다(`NoticesWorkspace`는 한 파일에서 두 번). 자세한 근거·사양은 토큰 문서의 셸 절
- 탭바는 공용 `Tabs`에 `size="page"` 변형을 추가해 쓴다. 기본값은 건드리지 않는다 — `Tabs` 호출부 9곳 중 여럿이 이미 픽셀 정합이 끝난 화면이다

## 5. 실행 순서

### Phase 0 — 기반 (단독, 선행 필수)
1. 6개 탭 노드 `get_design_context` 실측 → px·hex 사양 정리
2. 공용 컴포넌트 신규 4종 + 확장 3종
3. `SetupHeader` + `AppShell` 등록 + 탭바 정합

### Phase 1 — 탭 구현 (Phase 0 후 병렬 3워커, 파일 비중첩)
- **A**: 고지서 설정
- **B**: 이사정산 설정 + A/S 설정 (둘 다 `NumberedTagList`)
- **C**: 회사 정보 + 알림 설정 + 데이터 이관

### Phase 2 — 탭 구성 정리
- `SetupTabs` 6탭으로, `page.tsx`의 `SETUP_TAB_IDS`·기본 탭 정리
- 삭제: `AccountSettingsTab.tsx`, `SystemSettingsTab.tsx`, `QuickMessageEditor.tsx`, `MasterListEditor.tsx`(정산 체크가 `NumberedTagList`로 가면 사용처 0)
- `?tab=accounts|system` 유입 시 기본 탭 폴백 (기존 `?tab=repair` → redirect 선례)

### Phase 3 — DB
- 마이그 1건(0170): `setup_config.late_fee_enabled boolean not null default true`
- 번호는 **커밋 직전** `git ls-tree origin/master supabase/migrations/`로 재확인 (병렬 세션 선점 이력 있음)
- `late_fee_rate_tiers` ↔ 12구간 어댑터 (`useLateFeeRateTiers` / `useReplaceLateFeeRateTiers` 재사용)

### Phase 4 — 검증·병합
- `node ./node_modules/typescript/bin/tsc --noEmit` + lint (워크트리 정션 절차, 끝나면 `rmdir` 필수)
- 픽셀 검증: Figma PNG 6장을 origin으로, 앱을 2324×921 뷰포트로 캡처해 오버레이. 현 `scripts/pixel-diff`는 staging HTML origin 전제(`originUrl`)라 **로컬 PNG origin 모드**를 추가하거나 수동 비교
- master 병합 + push (CLAUDE.md 워크트리 규칙)

## 6. 미해결

1. **데이터 이관 실제 등록** — `BulkImportModal.register()`가 DB insert를 하지 않는다(CSV 검증·미리보기까지). 이번 정합 범위 밖이지만 별건으로 남아 있음
2. **발신번호 편집기의 새 거처** — D2로 회사 정보에서 제거되면 org별 SMS/팩스 발신번호를 설정할 UI가 앱에 없다. 컬럼(`0125`)·API(`/api/setup/sender`)·훅은 살아 있으므로 어디에 붙일지만 정하면 된다 (출시 전 필요)

3. **룸타입·자주 보내는 문자 편집기의 새 거처** — D1로 시스템 설정 탭이 사라지면서 두 마스터를
   추가할 UI가 없다. 읽는 화면(`TenantForm`·`MessagingComposer`)은 그대로 동작한다.

### 해소된 항목
- ~~고지서 설정의 앱 전용 필드 3개~~ → 제거 확정 (§2, 다른 화면이 읽지 않음)
- ~~정산 기준 항목 전체~~ → 3행 실측 완료, 앱 필드와 1:1 (§2)
- ~~정산 기준이 `변경 불가`인지~~ → 편집 가능 유지로 결정 (§2)

## 7. 실제 검증 결과 (2026-09-18)

워크트리 dev(:3100)에 admin으로 로그인해 6개 탭을 1920×911로 캡처했다. 전부 정본대로 렌더되고
콘솔 에러 0건. 연체 12칸이 0031 시드 `(0,1] (1,3] (3,∞)`를 `1 / 1.2 / 1.2 / 1.5×9`로 정확히
읽는 것까지 확인했다.

정적 검사로 못 잡고 실제 렌더에서만 드러난 결함 3건:
- `SetupSaveContext`가 렌더마다 새 클로저를 state에 등록해 무한 렌더 루프 → 로컬 ref + 고정 래퍼로 수정
- `Input`의 기본 `w-full`이 호출부의 `w-[240px]`를 이겨 회사 정보 라벨 칼럼이 짓눌림 →
  `dropOverridden`이 폭도 양보하도록 수정
- `NumberedTagList`가 키 입력마다 저장을 날려 `(org_id, label)` 유니크 제약과 충돌 →
  `onChange`/`onCommit` 분리
