# Track E 첫 슬라이스 — 즉시발송 실경로(SMS + 알림톡) 설계

- **상태**: approved (2026-08-21)
- **대상**: `/staff/messaging` 즉시발송 + 문자·알림톡 어댑터 + 템플릿 필드
- **구현 방식**: codex 토큰 소진 → Claude 직접 TDD. **키게이팅 유지**(실발송은 NCP 키/카카오 채널 확보 후 자동 ON).
- **관련 PRD/메모리**: messaging 실발송 stub → 실연동(Track E). 포인트 예약·정산·하드스톱은 0037에 기구현.

---

## 1. 배경 (검증된 현황)

- **기구현(0037)**: `quote_message_points`(authenticated)·`reserve_message_points`/`settle_message_points`(**service_role 전용**). reserve에 **하드스톱**(`INSUFFICIENT_POINTS`, 0037:647), 요청자 org·messaging 권한 검증(0037:582-595), 15분 예약 만료. settle은 성공분만 `point_transactions` 차감·`message_logs` result 확정(sent/partial/failed·released).
- **SMS 어댑터**(`lib/messaging/ncp.ts`): `isNcpConfigured()`·`sendSmsViaNcp({to,content,subject?})`. 키 없으면 미구성.
- **stub 발송**: `send_messages`(0037:439)는 `message_logs`에 result='stub'·point_status='quoted' INSERT만(외부 미호출). UI 즉시발송이 이걸 호출.
- **부재**: 서비스롤 실행 경로(API 라우트) 없음 → reserve/settle이 클라에서 도달 불가. 알림톡/팩스 어댑터 없음. 스케줄 소비 worker 없음(Amplify 내장 cron 없음). 템플릿 유형/버튼 필드 없음.
- **서버 클라**: `lib/supabase/server.ts`(세션·RLS) / `lib/supabase/admin.ts`(`createAdminClient()` = service_role).

---

## 2. 범위

### 포함 (이 슬라이스)
1. **SMS 즉시발송 실경로**: 서비스롤 API 라우트가 quote→reserve(하드스톱)→SMS 어댑터→settle.
2. **알림톡 어댑터**(`sendAlimtalkViaNcp`, 키/채널 게이팅) + 동일 라우트에서 채널 라우팅.
3. **템플릿 필드**: `message_templates`에 category·channel_type·alimtalk_template_code·buttons + 템플릿 모달 입력.

### 제외 (후속 슬라이스)
- 예약/반복 발송 worker(`message_schedules` 소비) — 외부 트리거 결정 필요.
- 팩스 어댑터.
- 카카오 발신프로필/템플릿 사전등록(외부·카카오 심사) — 본 슬라이스는 "코드 준비"까지.

---

## 3. 확정 설계 결정

| # | 결정 | 사유 |
|---|---|---|
| D1 | 즉시발송은 **서비스롤 API 라우트**(`app/api/messaging/send`)에서 reserve/settle(service_role) 호출 | reserve/settle이 service_role 전용, 클라 도달 불가 |
| D2 | **완전 미설정 → stub 경로 유지**(기존 send_messages), **채널 설정됨 → 실경로**(reserve→발송→settle) | 포인트 0 org가 실발송 없이 하드스톱에 막히는 것 방지 · 로그 정직(stub vs sent/failed) · "키만 꽂으면 ON" |
| D3 | 부분 설정(일부 채널만 키 있음): 미설정 채널 수신자는 settle에서 `failed`(reason=unconfigured), 라우트가 사유 반환 → UI "미발송(미설정)" | settle은 success/failed만 지원 |
| D4 | 인증/권한은 **RPC 계층이 정본**(quote=messaging 모듈, reserve=org_members+feature_permissions 'messaging'). 라우트는 세션 user·org 해석 후 위임 | 중복 방지·서버 신뢰경계 |
| D5 | 알림톡 어댑터는 SMS와 동형(별도 config gate `isAlimtalkConfigured`), 실발송은 카카오 채널ID·템플릿코드 확보 후 | 외부 의존 격리 |

---

## 4. 아키텍처

### 4.1 어댑터 (`lib/messaging/`)
- 기존 `ncp.ts`: `isNcpConfigured`, `sendSmsViaNcp`.
- **신규 `alimtalk.ts`**: `isAlimtalkConfigured()`(NCP_SENS_* + `NCP_ALIMTALK_SERVICE_ID` + `NCP_ALIMTALK_CHANNEL_ID` 존재), `sendAlimtalkViaNcp({to, templateCode, content, buttons?})` → NCP SENS 알림톡 API. 미설정이면 예외(실발송 방지).
- **신규 `dispatch.ts`**: `dispatchOne(channel, recipient, body)` → 채널별 어댑터 선택. 미설정 채널이면 `{status:'failed', reason:'unconfigured'}`. 성공 `{status:'success', providerId}`, 실패 `{status:'failed', reason}`.
- `anyChannelConfigured(modeOrChannels)` → 실경로 진입 여부 판단(D2).

### 4.2 발송 API 라우트 `app/api/messaging/send/route.ts` (POST, 서버 전용)
입력: `{ mode, body, context, recipients, templateId }`(현 SendMessagesInput에서 scheduledAt 제외; 예약은 기존 경로 유지).
1. `server` 클라 `auth.getUser()` — 미인증 401.
2. 세션으로 org_id 해석(+messaging 권한은 quote/reserve가 강제).
3. **분기(D2)**: `anyChannelConfigured` false →
   - 세션 클라로 기존 `send_messages`(stub) 호출 → `{billingMode:'stub', result:'stub', recipients:[...status:'skipped']}` 반환. (포인트 미사용)
4. 설정됨 → 실경로:
   - 세션 클라 `quote_message_points(mode, recipients, templateId)` → `rate_ids, estimated_points, resolved_recipients(recipient_key·phone·channel·body), sufficient`. `ok:false`면 그대로 반환.
   - `createAdminClient()` `reserve_message_points(org_id, user_id, idempotencyKey(uuid), payloadHash, mode, body, context, recipients, templateId, rate_ids, estimated_points)`.
     - `ok:false` code `INSUFFICIENT_POINTS`/`QUOTE_CHANGED`/... → 라우트가 코드·필요포인트 반환(발송 중단).
   - 예약 성공 → `resolved_recipients` 순회 `dispatchOne` → 수신자별 `{recipient_key, status}` 수집.
   - `settle_message_points(reservation_id, providerRequestId, results)` → 최종 result·charged.
   - 반환: `{billingMode:'live', messageLogId, result, chargedPoints, recipients:[{recipient_key,status,reason?}]}`.

멱등: `idempotencyKey`는 요청당 생성(재시도 시 동일 키 재전송은 향후). `payloadHash` = mode+body+recipients 해시.

### 4.3 UI (`app/(staff)/staff/messaging`)
- `hooks/reactquery/messaging/apis.ts`의 `sendMessages`: `scheduledAt` 없을 때 **`fetch('/api/messaging/send', POST)`** 로 교체(기존 `send_messages` RPC 직접호출 제거). 예약(scheduledAt)은 그대로 `schedule_messages`.
- 결과 매핑: `billingMode`, 수신자별 status. 컴포저 성공 토스트를 **성공/실패/미발송(미설정)** 카운트로 표기. 포인트 부족(`INSUFFICIENT_POINTS`)이면 발송 차단 + "포인트가 부족합니다" 토스트.

### 4.4 템플릿 필드 (마이그 **0093**, 커밋 직전 origin max 재확인 — 현재 0092)
```sql
alter table message_templates
  add column if not exists category text,
  add column if not exists channel_type text not null default 'sms',   -- 'sms'|'alimtalk'
  add column if not exists alimtalk_template_code text,
  add column if not exists buttons jsonb not null default '[]'::jsonb;  -- [{name,type,url}]
```
- 템플릿 저장 RPC/apis + 모달에 필드 추가(유형·구분·알림톡 템플릿코드·버튼). 기존 템플릿 목록/변수삽입 무회귀.

---

## 5. 데이터 흐름
```
UI 즉시발송 → POST /api/messaging/send
  ├ 미설정: send_messages(stub) → result='stub'(미발송)         [D2]
  └ 설정됨: quote → reserve(하드스톱) → dispatchOne×N → settle
             └ 성공분 point_transactions 차감, log result=sent/partial/failed
UI 예약발송 → schedule_messages (기존, 변경 없음)
```

## 6. 에러 처리
- 401(미인증)·403(org/권한 — RPC가 반환)·409(QUOTE_CHANGED)·402류(INSUFFICIENT_POINTS: 코드+필요/가용 포인트).
- 어댑터 예외(네트워크·NCP 4xx/5xx) → 해당 수신자 `failed`(reason), 나머지 계속. 전건 실패 → settle이 released(포인트 환원)·result='failed'.
- 미설정 채널 수신자 → `failed`(reason=unconfigured), UI는 "미발송(미설정)" 라벨.

## 7. 테스트 (TDD, vitest — 라우트는 핸들러 단위테스트, supabase 클라·fetch·env 목킹)
- `lib/messaging/alimtalk.ts`: isAlimtalkConfigured(env 유무), sendAlimtalkViaNcp(미설정 예외·설정 시 fetch 페이로드·성공/실패 매핑).
- `lib/messaging/dispatch.ts`: 채널 라우팅(sms/alimtalk/auto), 미설정→failed(unconfigured), 성공/실패 매핑.
- `app/api/messaging/send/route.ts`: (a) 미인증 401 (b) 미설정→stub 경로(send_messages 호출·reserve 미호출) (c) 설정+충분→reserve→dispatch→settle 순서·결과 (d) INSUFFICIENT_POINTS 차단 (e) 부분 실패 매핑. (admin/server 클라·어댑터 목킹)
- messaging apis `sendMessages`: scheduledAt 없으면 `/api/messaging/send` fetch 호출·결과 매핑 / 있으면 기존 schedule.
- 템플릿: 새 필드 저장·로드 매핑, 모달 렌더·입력.

## 8. 파일 변경 요약
| 파일 | 변경 |
|---|---|
| `supabase/migrations/0093_message_template_fields.sql` | 신규: message_templates 4컬럼 + 저장 RPC 갱신 |
| `lib/messaging/alimtalk.ts` (+test) | 신규 알림톡 어댑터 |
| `lib/messaging/dispatch.ts` (+test) | 신규 채널 디스패치 |
| `app/api/messaging/send/route.ts` (+test) | 신규 서비스롤 발송 라우트 |
| `hooks/reactquery/messaging/apis.ts` (+test) | sendMessages → 라우트 fetch |
| `app/(staff)/staff/messaging/**` | 결과 표기(성공/실패/미발송)·템플릿 모달 필드 |
| `hooks/reactquery/messageTemplates*` | 템플릿 필드 매핑·저장 |

## 9. 범위 밖 (YAGNI)
- 예약 worker·팩스·카카오 발신프로필 등록·재발송 UI·수신거부 세그먼트 고도화.
