# P5c 공과금 혼합건물 대응 — 용도/층 단가 + 상가 고정사용량 (설계)

- 날짜: 2026-08-14
- 브랜치: `PracLee/cachalot`
- 로드맵: P5 공과금 후속(P5a 검침·P5b 단가 이후). 상가+주거 혼합(주상복합) 건물 대응.
- 선행: PR #17(P5a `meter_readings`/`water_discounts`), PR #20(P5b `utility_unit_prices` 고객번호별 단가·`save_meter_readings` 자동요금). 둘 다 master 머지·라이브 적용 완료.

## 1. 배경 / 현황

현재 공과금 단가·부과 흐름(`/staff/utilities`):

- 단가는 `utility_unit_prices(building_customer_number_id, unit_price)` — **고객번호별 1단가**.
- 사용량은 항상 실검침: `usage = 당월지침 − 전월지침`.
- 자동요금은 RPC `save_meter_readings()`(`0014_p5b_utility_pricing.sql`, ~L255-378)에서 계산.
  단가 해석은 ① 세대 커스텀(`unit_meters.customer_no` 매칭) → ② 건물에 고객번호가 유일하면 그 단가 → ③ null (동 파일 ~L323-340).
  요금 = `max(0, round_charge(usage × price, 'round') − discount)`.
- `units`(`0001` L24-32)에는 **층(floor)·용도(주거/상가) 컬럼이 없음**.
- `unit_meters`(`0006` L27-36): `(unit_id, utility)` unique, `meter_no`·`customer_no` 보유. **고정사용량 개념 없음**.
- `meter_readings`(`0007`+`0014`): `usage`, `unit_price`, `calc_charge`, `discount_amount`, `manual_charge`, `note`, `processed_at`.

## 2. 목표 / 비목표

### 목표
1. 세대를 **용도(주거/상가)** 로 구분하고 **층(floor)** 을 보유한다.
2. 단가를 **용도별 + 층별**로 세분해 지정·해석한다(기존 고객번호별 단가와 공존).
3. **상가 고정사용량**: 특정 (세대·유형)은 검침 대신 월 고정 사용량으로 부과한다.

### 비목표 (YAGNI)
- 순수 정액요금(단가 무관 월정액) 전용 설정 — 기존 `manual_charge`로 임시 커버, 필요 시 후속.
- 누진제·구간 단가, 층별 공용요금 배분.
- 세입자앱/현장 모바일 노출.
- 기존 고객번호별 단가 테이블의 통합 리팩터(회귀 위험 회피).

## 3. 데이터 모델 변경 (마이그 `0015_p5c_utility_mixeduse.sql`)

### 3.1 `units` 확장
```
ALTER TABLE units
  ADD COLUMN floor int,                         -- null 허용, 지하 등은 음수 허용
  ADD COLUMN usage_type text NOT NULL DEFAULT 'residential'
    CHECK (usage_type IN ('residential','commercial'));
```
- **백필**: `unit_no`에서 층 자동 추정 — 숫자 프리픽스 규칙(`301`→3, `1502`→15, `B101`/`지하`류는 null 두고 수기 보정). 백필은 마이그레이션 말미 `UPDATE ... WHERE floor IS NULL` 1회.
- `usage_type` 기본 `residential` → 기존 데이터 무해.

### 3.2 `unit_meters` 확장
```
ALTER TABLE unit_meters
  ADD COLUMN fixed_usage numeric(12,2);          -- null=검침, 값=고정사용량
```
- `fixed_usage`가 not null이면 그 (세대·유형)은 검침 스킵, `usage = fixed_usage`.

### 3.3 신규 `utility_scoped_prices`
```
CREATE TABLE utility_scoped_prices (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  building_id   bigint NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  utility       text   NOT NULL CHECK (utility IN ('water','elec','gas')),
  usage_type    text   NOT NULL CHECK (usage_type IN ('residential','commercial')),
  floor         int,                              -- null=용도 전체 기본단가
  unit_price    numeric(12,2) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (building_id, utility, usage_type, floor)
);
```
- `floor = null` → 해당 용도 전체 기본단가. `floor` 지정 → 층별 세분화.
- **`NULLS NOT DISTINCT`**(PG15+, Supabase 지원): floor=null 기본단가 행이 용도당 1개로 유일하게 강제(기본 UNIQUE는 NULL을 서로 다르게 취급해 중복 허용됨).
- RLS: 기존 utilities 모듈 정책 패턴 재사용(org 스코프, staff 권한). `utility_unit_prices`와 동일 정책 적용.
- 기존 `utility_unit_prices`(고객번호별)는 **유지**.

## 4. 단가 해석 우선순위 (RPC `save_meter_readings` 확장)

세대별 단가 결정 우선순위(위에서 아래로, 첫 매칭 채택):

1. **세대 커스텀** — `unit_meters.customer_no` ↔ 고객번호 단가 매칭 *(기존)*
2. **`(용도, 층)` 정확 매칭** — `utility_scoped_prices(usage_type=세대용도, floor=세대층)` *(신규)*
3. **`(용도, 층=null)` 용도 기본** — `utility_scoped_prices(usage_type=세대용도, floor IS NULL)` *(신규)*
4. **고객번호 단가** — 건물 고객번호가 유일하면 그 단가 *(기존 fallback)*
5. 없음 → `null` (요금 미산정, 화면에서 단가 미설정 표시)

> 아키텍처 결정: 기존 고객번호 테이블과 **공존 + 우선순위 체인**. 대안(단일 통합 단가테이블 리팩터)은 방금 머지된 P5b를 헤집어 회귀 위험이 커 채택하지 않음.

## 5. 사용량·요금 계산

`save_meter_readings()` 각 행 처리 변경:

```
-- 사용량
if unit_meters.fixed_usage is not null:
    usage := unit_meters.fixed_usage        -- 검침 스킵(고정)
else:
    usage := current_reading - previous_reading   -- 기존

-- 단가: 위 §4 우선순위로 price 해석
-- 요금 (기존 로직 동일)
calc_charge := max(0, round_charge(usage * price, 'round') - discount)
```

- 고정사용량 세대도 `unit_price`·`calc_charge` 스냅샷은 동일하게 저장.
- 순수 정액요금은 기존 `manual_charge`(수동요금)로 덮어쓰기 가능(월별 입력). "항상 정액"은 비목표.

## 6. UI 변경

### 6.1 세대 용도/층 지정 — `/staff/buildings` 세대 편집
- 세대 편집 폼에 `용도`(주거/상가 셀렉트)·`층`(숫자) 필드 추가.
- 마스터데이터 원 위치이므로 buildings 도메인에 배치(utilities로 끌어오지 않음).
- 저장 RPC/매퍼에 두 필드 반영.

### 6.2 단가 모달 확장 — `UnitPriceModal.tsx`
- 기존 **고객번호별 단가** 섹션 유지.
- **용도/층별 단가** 섹션 추가: 용도(주거/상가) × 층(또는 "전체") 매트릭스 입력. 층 미지정 행 = 용도 기본단가.
- 저장은 `utility_scoped_prices` upsert(배열 원자적 저장, 기존 `save_utility_unit_prices` 패턴 재사용).

### 6.3 검침표 — `UtilityTable.tsx`
- 고정사용량 세대: 사용량 셀에 `고정` 뱃지, 당월지침 입력 비활성, `usage`는 `fixed_usage` 표시.
- 고정사용량 값 설정: 세대별 버튼 → 소형 모달(수도할인 모달 `WaterDiscountModal` 패턴 재사용). 유형별로 `fixed_usage` set/clear.
- 요약 카드(`UtilitySummaryCards`)의 예상요금 합계는 고정사용량 반영 자동.

## 7. 테스트 전략

- **RPC/단가해석 (vitest)**: §4 우선순위 5케이스(세대커스텀 / 용도+층 / 용도기본 / 고객번호 fallback / 없음) + 고정사용량 분기(fixed 있음/없음) + `floor` 백필 파서 유닛.
- **매퍼/훅**: `utility_scoped_prices` upsert 라운드트립, units 용도/층 매퍼.
- **회귀**: 기존 고객번호 단가 경로 불변 확인(P5b 케이스 유지).
- 게이트: `vitest` 전건 pass · `tsc` 0 · `lint` 0.
- 원격 DB 미접속 시 `verify/p5c_checks.sql` 정적 리뷰 스크립트 동봉(테이블·컬럼·정책 존재 확인).

## 8. 확정된 기본값 (결정 로그)

- **⚑ 고정부과 방식** = "고정사용량 × 단가"(정액 사용량, 단가 로직 유지). 순수 정액요금은 비목표.
- **⚑ 세대 용도/층 편집 위치** = `/staff/buildings` 세대 편집.
- **⚑ floor 자동추정** = `unit_no` 숫자 프리픽스 파싱 후 수기 보정 가능.
- **⚑ 단가 아키텍처** = 기존 고객번호 테이블과 공존 + 우선순위 체인(통합 리팩터 비채택).

## 9. 마이그레이션·롤아웃

- 신규 `0015_p5c_utility_mixeduse.sql`(0014 다음. 0013은 기존 번호중복 존재하므로 0015로 건너뜀).
- `supabase_migrations.schema_migrations`에 version/name 기록 필요(CLI `db push` 재적용 방지, P5a와 동일 운영).
- 라이브 적용은 사용자 PC에서 Management API/PAT로 수행(기존 운영 방식). 상세 [[supabase-connection]].

## 10. 구현 단계 분할 제안 (Codex 위임 단위)

1. **마이그 + RPC**: `0015` 스키마 3변경 + `save_meter_readings` 단가해석/고정사용량 분기 + 백필. (+ vitest RPC 케이스)
2. **단가 데이터층/모달**: `utility_scoped_prices` 매퍼·훅·upsert + `UnitPriceModal` 용도/층 섹션.
3. **검침표 고정사용량 UI**: `UtilityTable` 뱃지·비활성 + 고정사용량 설정 모달.
4. **세대 용도/층 편집**: `/staff/buildings` 폼 필드 + 저장 반영.

각 단계 종료마다 `vitest`/`tsc`/`lint` 게이트. 1→2→3은 순차 의존, 4는 1 이후 독립.

## 관련
- 현황 메모리: P5a utilities status, P5b(PR #20 tarpon).
- 선행 스펙: `docs/superpowers/specs/2026-08-12-p5a-utilities-meter-design.md`.
- WBS: 공과금 관리_전기/수도/가스 dev 반영 예정.
