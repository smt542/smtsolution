# 문자·알림톡 확장 (1) — 알림톡 채널 · 템플릿 관리 · 탭 재구성

> **작성일** 2026-08-18 · **도메인** `/staff/messaging` · **마이그** `0030_p4b_messaging_templates.sql`
> **선행** P4a 메시징 코어(마이그 `0010`) · 입주자 동의 필드(마이그 `0023`, `occupancies.alimtalk_opt_in`/`sms_opt_in`/`bill_delivery`)
> **병렬 격리** WT1 `feat/mgmt-fee-duedate`(빌링·0024)·WT2 `feat/long-term-repair`(0025 예정)과 파일·마이그 무충돌. 본 스펙은 messaging 도메인에 한정하고 공유파일(navItems·AppShell·list_tenants)을 건드리지 않는다.

## 1. 배경 / 현황

현재 `/staff/messaging`는 단일 패널 Composer로 **SMS 즉시발송(stub)만** 지원한다.

- **DB(0010)**: `message_logs`(channel check=`'sms'`만, 주석에 `alimtalk` 예약), `send_messages`(stub, `result='stub'`), `list_message_logs`. RLS·org 격리 완비.
- **UI**: 채널 SMS 고정, 건물→세대/건물주/직원 체크박스 수신처, 자유본문, "자주 보내는 문자"(`quick_messages`, 0003·`settings` 모듈) 삽입, 발송=stub 토스트.
- **미구현(gap §6)**: 알림톡 채널·탭(예약/내역/템플릿)·예약발송·템플릿 관리·포인트 하드스톱.

본 스펙은 그중 **알림톡 채널 + 템플릿 관리 + 탭 재구성**을 첫 서브프로젝트로 다룬다.

## 2. 범위

**포함**
- `/staff/messaging`를 3탭(**발송 / 템플릿 / 내역**)으로 재구성.
- **알림톡 채널** 추가 — 세대별 `alimtalk_opt_in`에 따른 **자동 라우팅**(알림톡 우선·SMS 폴백).
- **알림톡 템플릿 CRUD** — 실용형(제목·본문) + **변수치환**(`#{...}`).
- 발송은 **stub 유지**(실제 provider 없음; `result='stub'`).

**제외 (후속)**
- 예약발송(scheduled_messages)·포인트 하드스톱(platform-admin 포인트 모델 제품 미결)·실제 provider(카카오/문자사) 연동·템플릿 승인 워크플로/버튼/링크.
- 금액·미납 등 **billing 파생 변수**(billing 조인 필요 → WT1 영역).

## 3. 결정 사항 (브레인스토밍 확정)

| # | 결정 | 근거 |
|---|---|---|
| D1 | 첫 스펙 = 알림톡 채널+템플릿+탭 | 알림톡은 템플릿이 전제 → 묶음. gap이 지목한 토대. messaging 도메인 완전 격리. |
| D2 | 템플릿 = **실용형+변수치환**, 알림톡 전용 **분리 테이블** | 개인화(변수) 가치 확보하되 승인/버튼은 과설계. `quick_messages`는 `settings`/setup 소속(WT2 인접) → 통합 시 충돌 → 분리. |
| D3 | 채널 = **자동 라우팅**(알림톡 우선·SMS 폴백) | 도메인 규칙("동의 세대는 알림톡"). staff는 자동/SMS/알림톡 모드 선택, 기본=자동. |
| D4 | SMS 폴백 내용 = **템플릿 본문 공용** | 실무 알림톡→SMS 대체발송 방식. 템플릿 하나로 두 채널, 입력 간단. |
| D5 | 구현 접근 = **클라이언트 렌더 + RPC 동의 권위판정** | 변수치환은 순수 TS(단위테스트 용이)·정확한 미리보기. 채널(동의)은 서버에서 재판정(스푸핑 방지). SQL 단순. |

## 4. 데이터 모델 — `0030_p4b_messaging_templates.sql` (idempotent)

### 4.1 신설 `message_templates` (quick_messages 패턴 미러)
```sql
create table if not exists message_templates (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  title text not null,
  body text not null,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, title)
);
create index if not exists message_templates_org_idx on message_templates (org_id, sort_order);
-- updated_at 트리거: 기존 set_updated_at() 재사용
-- RLS: select = org_id in my_org_ids(); ins/upd/del = org_id in my_org_ids() and current_user_has_module('messaging')
```
- **변수는 저장하지 않는다.** 본문의 `#{...}` 토큰에서 렌더/미리보기 시 파생.
- CRUD는 `quick_messages`처럼 **RLS 기반 직접 테이블 연산**(supabase-js)으로 처리 — 별도 CRUD RPC 불필요.

### 4.2 `message_logs` 확장
```sql
alter table message_logs add column if not exists template_id bigint references message_templates(id);
alter table message_logs drop constraint if exists message_logs_channel_check;
alter table message_logs add constraint message_logs_channel_check
  check (channel in ('sms','alimtalk','auto'));
```
- 최상위 `channel` = **요청 모드**('auto'|'sms'|'alimtalk'). 수신처별 실제 채널은 `recipients` jsonb에 기록.
- `recipients` jsonb 계약 확장(스키마 변경 아님): 각 항목에 `channel`('sms'|'alimtalk')·`renderedBody`·`result` 추가.

### 4.3 동의 조회 RPC 신설 (공유 `list_tenants` 미변경 = 격리)
```sql
create or replace function list_tenant_alimtalk_consent(p_building_id bigint)
returns table(occupancy_id bigint, alimtalk_opt_in boolean, sms_opt_in boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not current_user_has_module('messaging') then
    raise exception 'forbidden: messaging required';
  end if;
  return query
    select o.id, coalesce(o.alimtalk_opt_in,false), coalesce(o.sms_opt_in,false)
    from occupancies o
    join units u on u.id = o.unit_id
    join buildings b on b.id = u.building_id and b.org_id = current_user_org()
    where u.building_id = p_building_id and o.deleted_at is null;
end $$;
-- revoke from public/anon; grant to authenticated.
```
- 미리보기·발송 라우팅에 필요한 동의값만 반환. 클라이언트가 occupancyId로 머지.
- 모듈 게이트를 RPC 내부에서 raise(다른 messaging RPC와 일관). org 격리는 `current_user_org()` 조인으로 이중 보장.

### 4.4 `send_messages` 확장 (4-arg 하위호환 유지)
```sql
send_messages(p_channel text, p_body text, p_context text, p_recipients jsonb,
              p_template_id bigint default null) returns jsonb
```
- `p_channel`(모드) 허용값 = 'sms'|'alimtalk'|'auto'.
- `p_template_id` 지정 시 caller org 소속 검증(아니면 raise).
- 모드='alimtalk'|'auto'이면 `p_template_id` 필수(아니면 raise).
- **수신처별 채널 서버 재판정**: `recipients[].ref.occupancyId`로 `occupancies.alimtalk_opt_in` 조회.
  - 모드=auto → `alimtalk_opt_in ? 'alimtalk' : 'sms'`.
  - 모드=alimtalk → 동의 세대만 'alimtalk', 미동의는 **제외**(로그에 미포함, 반환 count에서 제외).
  - 모드=sms → 전부 'sms'.
  - occupancyId 없는 수신처(건물주·직원) → 'sms'.
- 각 수신처에 `channel`·`renderedBody`(클라이언트 제공, stub이므로 신뢰)·`result:'stub'` 병합 저장.

## 5. 발송 로직 (자동 라우팅) — 요약 흐름

1. 클라이언트: 모드·템플릿(또는 자유본문)·수신처 선택.
2. 동의 RPC로 수신처별 예상 채널 산출 → 미리보기(치환 본문+채널 뱃지).
3. 각 수신처 `renderedBody`(TS 렌더) 포함 payload 구성 → `send_messages` 호출.
4. RPC가 동의 재판정으로 채널 확정·제외 처리 후 로그 1건(수신처별 채널 포함) 기록, `{log_id,count}` 반환.

## 6. 변수 치환 (v1)

- 지원 변수: `#{이름}`→수신처명 · `#{호실}`→`unitNo`(세대만; 건물주·직원은 공백) · `#{건물명}`→선택 건물명.
- `lib/messaging/render.ts`:
  - `extractVariables(body: string): string[]` — 본문의 `#{키}` 수집(중복 제거).
  - `renderTemplate(body: string, vars: Record<string,string>): string` — 알려진 변수 치환, **미정의 변수는 리터럴 유지**.
- 미리보기 UI는 미정의 변수 존재 시 경고 표시.

## 7. 화면·컴포넌트

- **발송 탭** `SendTab`(기존 `MessagingComposer` 리팩터):
  - 채널 모드 셀렉트(자동/SMS/알림톡, 기본 자동).
  - 자동·알림톡 → **템플릿 선택 필수**. 선택 시 템플릿 본문이 작성란에 채워지고(토큰 포함) 편집 가능 — **미리보기·발송의 렌더 소스는 (편집 가능한) 작성란 본문**. SMS → 기존 자유본문(+템플릿 삽입 허용).
  - 수신처 옆 **예상 채널 뱃지**(동의 RPC 기반) · 선택 수신처 **미리보기**(치환 본문+채널).
- **템플릿 탭** `TemplatesTab` + `TemplateFormModal` + `TemplateList`: 목록·생성·수정·삭제(soft), 본문 편집기에 **사용 가능 변수 도움말**.
- **내역 탭** `HistoryTab`: 기존 `MessageLogList` 재사용 + 필터(기간·채널·context) · 상세에 수신처별 채널 분포.
- 탭 전환은 `/staff/messaging` **내부 상태**(쿼리스트링 `?tab=`) — **라우트/네비 변경 없음**.

**신규/수정 파일(예상)**
- 신규: `lib/messaging/render.ts`(+test), `hooks/reactquery/messageTemplates/*`(apis/keys/queries/mutations/index +test), `app/(staff)/staff/messaging/components/{TemplatesTab,TemplateFormModal,TemplateList,HistoryTab}.tsx`(+test).
- 수정: `app/(staff)/staff/messaging/page.tsx`(탭 셸), `components/MessagingComposer.tsx`→`SendTab`(채널모드·템플릿·미리보기), `components/MessageLogList.tsx`(필터 수용), `hooks/reactquery/messaging/apis.ts`(send 시그니처·동의 조회), `lib/messaging/preset.ts`(`MessageChannel`에 'alimtalk' 추가).
- 마이그: `supabase/migrations/0030_p4b_messaging_templates.sql`.

## 8. 테스트 전략

- `render.test.ts`: 치환·미정의 변수 유지·무변수·중복 변수.
- `messageTemplates/apis.test.ts`: CRUD 계약(기존 mock 패턴).
- `messaging/apis.test.ts`: send 시그니처(template_id·모드)·동의 조회.
- `SendTab`/`TemplatesTab`/`HistoryTab` RTL: 모드 전환·템플릿 필수 가드·미리보기·필터.
- (선택) 라우팅 계약 테스트: 모드별 채널 확정·미동의 제외.
- `tsc --noEmit` / `vitest` / `eslint` / `next build` 통과.

## 9. 에러 처리 · 엣지케이스

- 자동/알림톡 모드인데 템플릿 미선택 → 발송 차단(안내).
- 빈 본문/수신처 → 기존 가드 유지.
- 알림톡 모드에서 전원 미동의 → 발송 대상 0 → 차단 안내.
- 템플릿 삭제(soft) 후에도 과거 로그 `template_id`는 dangling 허용(FK nullable, 표시 시 "삭제된 템플릿").
- SMS 본문 길이 초과(폴백 포함) → 미리보기 경고(하드스톱 아님).
- occupancyId 없는 수신처는 동의정보 없음 → SMS 처리(자동/알림톡 모드에서 건물주·직원 대상은 SMS).

## 10. 격리 · 충돌 · 마이그 번호

- **마이그 `0030`**(여유 버퍼): master=0023, WT1=0024, WT2=0025(예정). 다른 세션 2개가 추가 마이그를 만들 수 있어 번호 충돌 방지로 0030 선점(번호 자체는 무의미·여유 확보).
- **공유파일 무변경**: `navItems.ts`·`AppShell`·`list_tenants` 미변경 → 공유파일 충돌 0.
- WT1/WT2 델타에 messaging 도메인 파일 없음(확인됨) → 파일 충돌 없음.

## 11. 수용 기준

1. 발송/템플릿/내역 3탭 렌더·전환.
2. 템플릿 생성·수정·삭제(soft)·목록, 본문 변수 도움말.
3. 자동 모드: 동의 세대=알림톡·미동의=SMS(동일 렌더 본문)로 로그의 수신처별 채널이 정확.
4. 알림톡 모드: 미동의 제외. SMS 모드: 전부 SMS(자유본문 허용).
5. 변수 `#{이름}·#{호실}·#{건물명}` 치환, 미정의 변수 리터럴 유지+경고.
6. 발송은 stub(`result='stub'`), 내역 탭에서 채널·기간·context 필터.
7. 마이그 0030 idempotent, `tsc`/`vitest`/`eslint`/`next build` 통과.

## 12. 후속 로드맵 (참고, 별도 스펙)

- (2) 예약발송: `scheduled_messages` + 진입 스윕(+선택적 pg_cron, WT2 퇴실 스윕 패턴).
- (3) 포인트 하드스톱: platform-admin 포인트 모델(단일풀 vs 조직별) 제품결정 선행.
- (4) 실제 provider 연동(카카오 비즈메시지/문자사) + 템플릿 승인상태·버튼/링크.
- (5) billing 파생 변수(금액·미납월 등) — billing 조인.
