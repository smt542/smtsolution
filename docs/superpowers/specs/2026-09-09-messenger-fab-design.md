# 메신저 빠른발송 FAB(.fmp) — 설계 (2026-09-09)

## 1. 목표

원본 우하단 청록 원형 FAB(`.fmp-fab`)와 그것이 여는 **빠른 메시지 발송 패널**(`.fmp`)을
실제 기능으로 구현한다. 스태프 전역 공통 컴포넌트이며, 표현은 원본과 **완전 픽셀 퍼펙트**로
정합하고, 원본의 가짜 발송 스텁(`doSend`)을 실제 발송 인프라(Popbill)로 배선한다.

- 청록 원형 FAB(52px) → 820px 플로팅 패널: 드래그 헤더·최소화·세그 탭(문자/알림톡)·발신번호
  선택·수신자 3단 캐스케이드·템플릿·변수 치환 textarea·바이트 카운트·알림톡 승인 템플릿 폼·
  라이브 폰 미리보기·예약(날짜·시간·**매월 반복**)·발송 요약 확인.
- 실발송 배선: SMS는 현재 키로 즉시 유효, 알림톡은 카카오 발신 프로비저닝 완료 시 유효(§8).
- A/S·퇴실 우측 패널(`.rnb`)과는 **별개 기능** — 본 스펙은 `.fmp` 메신저에 한정(§4).

## 2. 정본 (Source of Truth)

| 구분 | 상태 | 비고 |
|---|---|---|
| ✅ `docs/prototype/staff/fee-item/Messenger.dc.html` | **정본** | staging서 vendoring, 본 브랜치에 추가(132KB). 전 스태프 화면이 `fee-item.dc.html`의 `<dc-import name="Messenger">`로 공유 |
| ⚠️ 동일 파일 내 `.rnb-*`·`.asp-*` | **범위 밖** | 공유 컴포넌트라 A/S 우측패널·A/S 인쇄가 같은 파일에 포함 → **본 태스크는 이식하지 않음**(as-status-rail 소관) |
| ❌ `docs/prototype/_design-system.css` | 폐기 | 구버전 파랑. 참조 금지 |

- 전역 토큰·폰트: `2026-09-09-prototype-pixel-alignment-design.md` §2와 동일(청록 `--blue:#14A497`, Pretendard). `globals.css` 재사용.
- 이식 대상 CSS: 원본 `<style>`(L6–517) 중 `.fmp*`·`.ak-*`·`.ph-*`·`.dt-*`·`.cal-*`·`.si`·`.dot`·`.drag`·`.fmpc*` 블록.
- 이식 대상 JS: 원본 `<script data-dc-script>`(L626–1158) 중 **메신저 서브셋**(아래 §6 심볼). `rnb`/`asp` 함수는 제외.
- staging 렌더: `https://staging.d2h12382xiksft.amplifyapp.com/staff/fee-item/fee-item.dc.html` (우하단 FAB).

## 3. 결정 (확정)

| 축 | 결정 | 함의 |
|---|---|---|
| 발송 배선 | **실 API 배선 + 우아한 게이팅** | `/api/messaging/send`·`schedule_messages` 실배선. 포인트 견적·`message_logs` 이력 자동. 키 미설정 시 안내. |
| 채널 가용 | SMS 즉시 · 알림톡 후속 | 코어+SMS 키 설정됨. `POPBILL_KAKAO_SENDER`·승인 템플릿코드는 미설정 → 알림톡은 프로비저닝 후 실발송(배선은 완비). |
| 매월 반복 | **포함** | `message_schedules` 그린필드 확장 + drain 워커 다음-발생 enqueue(§9). |
| 수신자 유형 | **원본 4종 전부**(입주자·건물주·직원·**청소담당**) | `kind:"cleaner"` 신규. 청소담당 = `buildings.cleaning_user_id`. |
| 반복 수신자 | **스냅샷 고정(v1)** | 예약 시점 수신자 이월. 중간 입주·퇴실 미반영(문서화). 재해석은 후속. |

## 4. 범위 경계

**포함**: `.fmp` FAB·패널의 전체 표현(픽셀 퍼펙트) + 수신자 4종 실배선 + 발신번호 + 템플릿 +
변수 치환 + 폰 미리보기 + 바이트 카운트 + 즉시/1회예약/매월반복 실발송 + 드래그·최소화 버블 +
발송 요약 다이얼로그 + 닫기 확인 다이얼로그.

**제외 — 동일 파일 내 타 기능**: `.rnb-*`(A/S·퇴실 우측 패널)·`.asp-*`(A/S 인쇄). as-status-rail 소관.

**제외 — 후속 트랙**:
- 반복 발송 수신자 **재해석**(선택 의도 저장 → 매월 재조회). v1은 스냅샷 고정.
- 알림톡 카카오 발신·승인 프로비저닝(`KAKAO_SENDER` env·승인 템플릿코드·버튼 URL 등록).
- 원본 발신번호 드롭다운의 임의 직원 휴대폰 → 실발송은 **등록 발신번호만** 가능하므로 미이식.

## 5. 아키텍처

**파일 배치** (신규 `components/messenger/` 도메인 + 얇은 shell 진입점):

| 파일 | 역할 |
|---|---|
| `components/messenger/MessengerFab.tsx` | 진입점(client). FAB 버튼 + 패널 열림/최소화 오케스트레이션. AppShell이 마운트. |
| `components/messenger/MessengerPanel.tsx` | 패널 셸: 드래그 헤더·세그·바디·푸터·진행바. |
| `components/messenger/RecipientCascade.tsx` | 유형→건물/직원→입주자/전체 3단 캐스케이드(4종). |
| `components/messenger/SenderSelect.tsx` | 발신번호 선택(등록번호 + 직접입력 검증). |
| `components/messenger/MessageComposer.tsx` | textarea·변수칩·바이트·템플릿 선택(SMS). |
| `components/messenger/AlimtalkForm.tsx` | 승인 템플릿 선택 + 사용자입력 변수 폼. |
| `components/messenger/PhonePreview.tsx` | 라이브 폰 미리보기(SMS/카카오). |
| `components/messenger/SchedulePicker.tsx` | 예약 체크 + 날짜·시간·반복(없음/매월). |
| `components/messenger/SendSummaryDialog.tsx` | 발송 요약 확인 + 미해결 변수 경고. |
| `components/messenger/useMessengerState.ts` | 패널 상태(채널·수신자·본문·예약·최소화·드래그 위치·초안). |
| `components/messenger/messenger.module.css` | 원본 `.fmp*` CSS 1:1 이식(§6). |
| `lib/messenger/tokens.ts` | 변수 라벨↔실 토큰(`#{…}`) 매핑·삽입. |
| `lib/messenger/bytes.ts` | EUC-KR 바이트 계산(SMS≤90 / LMS). |

- **상태 지속**: 열림/최소화/드래그 위치/초안 본문·수신자 선택을 `sessionStorage`(세션 한정). 원본의
  `SHARED_KEY`(localStorage 템플릿 공유)는 실앱이 `message_templates`를 쓰므로 불필요.
- **마운트 게이트**: AppShell 비-bare(스태프) 전역. `current_user_is_manager_staff`(또는 셸이 이미 아는
  persona)로 스태프 세션에만 렌더. 세입자/파트너/HQ persona엔 미렌더.

## 6. 픽셀 퍼펙트 포팅

**원칙**(pixel-alignment §3 동일): 원본 인라인 수치를 **직접 이식**(스크린샷 눈대중 금지) →
스크린샷 오버레이 diff로 1px 수렴 검증.

**CSS 방식 — CSS Module 권장.** 원본이 500줄 세밀 CSS라 `messenger.module.css`에 `.fmp*` 규칙을
**1:1 이식**(전역 토큰 `var(--blue)` 등은 globals.css 재사용)하는 것이 픽셀 퍼펙트·리뷰(원본 대조)에
가장 안전. 스태프 앱은 Tailwind 관례이나, 본 컴포넌트는 레이아웃 흐름 밖 **독립 오버레이**라
스코프드 CSS Module은 의도적·국소적 예외(공통-ui 메모리의 모바일 CSS모듈 관례와 정합).
→ *대안: Tailwind arbitrary values. 500줄 변환은 오류·리뷰비용 큼 → 비권장. (스펙 리뷰서 확정)*

**포팅 클래스 인벤토리**:
- FAB/셸: `.fmp-fab` `.fmp` `.fmp-h` `.dot` `.drag` `.fmp-ic` `.fmp-body` `.fmp-f` `.fmp-prog` `.fmp-bubble`
- 세그/발신: `.fmp-seg` `.si` `.fmp-fromsel` `.fmp-deftag` `.fmp-frommenu` `.fmp-fromadd` `.fmp-fromlist` `.fmp-fromrow` `.fmp-fromhd`
- 수신자: `.fmp-casc` `.fmp-dd2` `.fmp-auto` `.fmp-recip` `.fmp-picker` `.fmp-plist` `.fmp-prow` `.fmp-pall` `.fmp-pempty` `.fmp-psrch` `.fmp-rtabs`
- 예약: `.fmp-ck` `.fmp-dt` `.fmp-dpick` `.fmp-cal` `.cal-h` `.cal-nav` `.cal-grid` `.cal-dow` `.cal-d` `.fmp-tlist` `.fmp-rplist` `.fmp-din`
- 작성: `.fmp-lbl` `.fmp-smswrap` `.fmp-ta` `.fmp-varsrow` `.fmp-bytes`(`.lms`) `.fmp-vars` `.fmp-var` `.fmp-chips` `.fmp-chip` `.fmp-tplsel` `.fmp-tplmenu` `.fmp-tpllist`
- 알림톡: `.fmp-akwrap` `.fmp-akform` `.fmp-aksel` `.fmp-akmenu` `.ak-opt`(`-h`/`-b`) `.ak-type` `.ak-status` `.ak-fhead` `.ak-fname` `.ak-vars` `.ak-vrow` `.ak-autobox` `.ak-autochip(s)` `.ak-btnbox` `.ak-btnview` `.ak-emptyhint` `.ak-readonly` `.ak-tok`
- 미리보기: `.fmp-phonewrap` `.fmp-phone` `.ph-screen` `.ph-head` `.ph-from` `.ph-ch` `.ph-bubble` `.ph-daysep` `.ph-time` `.ph-empty` `.ph-ak-head` `.ph-ak-body` `.ph-akbtn`
- 다이얼로그: `.fmpc-scrim` `.fmpc` `.fmpc-t` `.fmpc-d` `.fmpc-btns` `.fmpc-btn` `.fmp-sum`(`-warn`/`-prev`) `.dt-lbl` `.dt-list` `.dt-msg`

**JS→React 매핑**: 드래그(`fmpHead` pointer→위치 상태) · 최소화(`.fmp-bubble` 토글) · 세그(`chanMode`) ·
캐스케이드(`wireDD`/`onType`/`onSecond`→상태) · 바이트(`byteLen`) · 미리보기(`updatePrev`→렌더) ·
요약(`openSummary`→다이얼로그) · 발송(`doSend`→실 API). 원본 심볼 참조: `st_`(수신자 상태)·`selectedAK`·
`resvOn`·`repMode`·`fromCur`·`TVARS`·`AUTO_VARS`·`AKTPLS`·`VARMAP`·`previewCtx`.

## 7. 데이터 배선

**수신자 4종**:

| 유형 | 원본 배열 | 실 데이터소스 | kind | 캐스케이드 |
|---|---|---|---|---|
| 입주자 | `RTEN` | `list_tenants(building).phone` (`useTenantList`) | `tenant` | 3단(유형→건물→입주자/전체) |
| 건물주 | `ROWNER` | `buildings.owner_name/owner_phone` (`useBuildings`) | `owner` | 2단(유형→건물) |
| 직원 | `RSTAFF` | `list_accounts.phone` active (`useAccounts`) | `staff` | 2단(유형→직원) |
| 청소담당 | `RCLEAN` | `buildings.cleaning_user_id → profiles.phone` | `cleaner`(신규) | 2단(유형→건물) |

- **채널별 유형**(원본 `setTypeOpts`): 알림톡 = 입주자·건물주만 / SMS = 4종.
- `MessageRecipient.kind`에 `"cleaner"` 추가(`lib/messaging/preset.ts`). quote/send RPC는 kind allowlist가
  없어 기본 SMS 라우팅으로 즉시 동작. cleaner `ref={userId}`. *(선택: `resolve_message_point_quote`에
  cleaner ref 검증 추가는 후속.)*
- **발신번호**: 등록 org 발신번호(`setup_config.sms_sender` + env 기본)로 채움. 직접입력은
  `checkSenderNumber`로 등록 검증(미등록 차단). 원본의 임의 직원 휴대폰 목록은 미이식(실발송 불가).
- **템플릿**: `message_templates`(`useMessageTemplates`). SMS=본문 삽입 / 알림톡=`alimtalk_template_code`+
  `buttons`+변수. 심사중(`status`) 템플릿은 비활성.
- **변수 토큰 매핑**: 원본 `{건물명}` → 실 `#{건물명}`. 변수칩 클릭 시 실 토큰 삽입. 서버측
  `renderTemplate`(`#{key}`)·`buildRecipientRenderVariables` 확장(입주자명→`이름` 별칭, 건물주명·
  청소담당자명 추가). `AUTO_VARS`(당월관리비·미납·고객번호·링크토큰 등)는 서버 컨텍스트(Track E
  Phase3 기계)로 해석 — 패널은 **사용자입력 변수만** 폼 노출.

## 8. 발송 흐름

- **즉시**: `POST /api/messaging/send` (`mode`·`body`·`context:"빠른발송"`·`templateId`·`recipients`·
  `Idempotency-Key`). 202 queued → `message_logs` 자동 기록.
- **1회 예약**: `schedule_messages(...scheduledAt)`.
- **매월 반복**: `schedule_messages` + `recurrence_mode:"monthly"`(§9).
- **견적**: `useMessagePointQuote` 카드(예상 포인트·부족 여부).
- **상태/에러 UX**(원본 가짜 스텁 대체):

| 상황 | 처리 |
|---|---|
| `PROVIDER_NOT_CONFIGURED`(503) | "발송 설정 준비 중" 안내 · 발송 비활성 |
| `INSUFFICIENT_POINTS`(402) | 포인트 부족 · 잔액 표시 |
| 알림톡 미동의 | `list_tenant_alimtalk_consent` 필터 · 대상 제외 표시 |
| 알림톡 발신 미설정 | `SENDER_NOT_REGISTERED` → "알림톡 발신 설정 준비 중"(SMS는 정상) |
| 채널 게이팅 | SMS=실발송(단 `IS_TEST`면 팝빌 테스트서버) / 알림톡=프로비저닝 후 |

## 9. 반복(매월) 백엔드 — 그린필드

`message_schedules`(0032+0094)에 반복 개념 없음. 최소 확장:

- **마이그레이션**(번호는 커밋 직전 `origin/master` max +1 재확인; 현 추정 **0150**):
  - `recurrence_mode text null check (recurrence_mode in ('monthly'))`
  - `recurrence_anchor_day int null` (1–31, 예약일 기준)
  - `recurrence_parent_id bigint null references message_schedules(id)` (시리즈 루트 추적)
- **`schedule_messages` 확장**: `p_recurrence_mode`·`p_recurrence_anchor_day`(기본 null=1회성) 추가·저장.
- **drain 워커 확장**(`drainSchedules.processRow`): `complete_message_schedule(status='sent')` 직후
  `recurrence_mode='monthly'`이면 `enqueue_next_message_occurrence(schedule_id)` 호출.
- **신규 RPC `enqueue_next_message_occurrence(p_schedule_id)`**: 다음 달 동일일(단월 클램프: anchor_day가
  말일 초과면 말일) `scheduled_at`로 새 `message_schedules` 행 insert — `channel`·`body`·`context`·
  `recipients`(스냅샷)·`template_id`·`recurrence_mode`·`recurrence_anchor_day`·`recurrence_parent_id`(루트) 복사,
  `status='scheduled'`.
- **취소**: `cancel_scheduled_message`가 대기중 미래 발생분을 취소 → 시리즈 종료(항상 미래 발생 1개만
  존재하므로 충분). UI에 "매월 반복" 뱃지.
- **멱등**: 발생분마다 distinct `schedule_id` → 기존 `idempotency_key = md5('scheduled-message:'||id)` 안전.
- **스냅샷 한계**(문서화): 예약 시점 수신자 이월 → 중간 입주·퇴실 미반영. 재해석은 후속 트랙.

## 10. 통합 & 커플링

- **AppShell**: 비-bare 전역에 `<MessengerFab/>` 추가.
- **QuickAccessRail**: teal 채팅 FAB 스텁("도움말 채팅 준비 중") 제거(중복 방지). 사이드패널 스텁은 최소
  변경(별도 판단). 사용부(`FeeItemRightRail`·`SettlementInquiryPage`) 영향 확인.
- **as-status-rail 조정**: 그 브랜치는 AppShell에 `<AsReceptionRail/>` 추가 + `QuickAccessRail` 제거 예정.
  본 브랜치는 pixel-alignment 기반이라 현재 미충돌. **머지 시** 두 브랜치 모두 AppShell 인접 라인을
  편집 → 수동 해결. 순서: as-status-rail 먼저 머지되면 rebase 후 인접 조정 / 아니면 본 브랜치 머지 후
  as-status-rail이 흡수.

## 11. 레이어 PR 계획 (`feat/messenger-fab`)

1. **PR1 — 셸·표현**: `MessengerFab` + 패널 픽셀정합 CSS + 열기/최소화/드래그/세그 + 정적·목 콘텐츠 +
   AppShell 전역 마운트 + QuickAccessRail teal 스텁 제거. 발송 없음. 검증: pixel-diff.
2. **PR2 — 실배선**: 수신자 4종·발신번호·템플릿·변수·폰 미리보기·바이트·견적·즉시/1회예약 실발송.
   `kind:"cleaner"` enum + `buildRecipientRenderVariables` 확장.
3. **PR3 — 반복 백엔드**: 마이그(0150) + `schedule_messages`/`drainSchedules`/`enqueue_next` + 반복 UI 배선.

각 PR: `tsc`(`.next` 노이즈 `grep -vE '\.next'`)·lint·build·기존 vitest 그린. 마이그는 라이브 적용
사용자 확인(Claude가 Management API `/database/query`로 적용; 데이터 UPDATE는 classifier 차단 주의).

## 12. 검증

- **pixel-diff**: `scripts/pixel-diff/capture.mjs`에 FAB 클릭→패널 열림 인터랙션 추가. 원본 staging
  fee-item(FAB) ↔ 앱. 수렴 기준 pixel-alignment §6(구조적 불일치 0, 픽스처 diff ≤0.5%).
- `tsc`·lint·build·기존 vitest. **신규 단위 테스트 미작성**(정책).
- **실발송 스모크**: SMS 1건 본인 번호(테스트/실). 알림톡은 프로비저닝 후.
- **워크트리 검증**: node_modules 없음 → `projects/home_erp` 정션 연결 후 검증, 끝나면 `rmdir`(정션 제거).
  Turbopack은 정션 거부 → webpack 빌드.

## 13. 리스크 & 완화

| 리스크 | 완화 |
|---|---|
| 공유 canon에 rnb/asp 혼입 | `.fmp`만 추출(범위경계 §4) |
| AppShell 이중 편집 충돌(as-status-rail) | 인접 라인 수동 조정(§10) |
| 알림톡 실발송 미완(kakao env) | SMS 우선 · 알림톡 게이팅 안내(§8) |
| 반복 스냅샷 스테일 | 문서화 · 후속 재해석 트랙 |
| 마이그 번호 충돌(병렬 세션) | 커밋 직전 `origin/master` max 재확인 |
| 원본 x-dc 상태 다수(캐스케이드·달력·메뉴) | 상태별 캡처 · 상호작용 스크립트 |
| 미등록 발신번호 실발송 실패 | `checkSenderNumber` 저장검증(미등록 차단) |

## 14. 산출물

- `components/messenger/**` · `components/messenger/messenger.module.css` · `lib/messenger/**`
- `components/shell/AppShell.tsx`(마운트) · `components/shell/QuickAccessRail.tsx`(스텁 제거)
- `lib/messaging/preset.ts`(`kind:"cleaner"`) · `buildRecipientRenderVariables` 확장
- `supabase/migrations/0150_*`(반복) · `schedule_messages`/`drainSchedules`/`enqueue_next_message_occurrence`
- `docs/prototype/staff/fee-item/Messenger.dc.html`(vendored canon)
- `scripts/pixel-diff/capture.mjs`(FAB 인터랙션)
