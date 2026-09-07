# 세입자앱 관리비 상세(`/resident/bill/[period]`) 완전 정본 정합 — 이어서 작업(핸드오프)

> 2026-09-07 세션 중단 핸드오프. 홈·관리비 목록은 완료(머지). **관리비 상세 = 완전 정본(검침 포함) 진행 중, 코드 미착수 + 테스트 시드 classifier 차단**.

## 0. 현재 상태
- ✅ **세입자 홈** 정본 정합 + 연체료(마이그 0142) — PR #154/#155/#156 머지
- ✅ **세입자 관리비 목록** 정본 정합 + 납부일(마이그 0143) — PR #157/#158 머지
- 🚧 **세입자 관리비 상세** = 이 문서. 사용자가 **"완전 정본(검침 포함)"** 선택. **코드 미착수.**
- 🧪 **테스트 데이터**: unit 3(201호, occ 6, org 1)에 부과확정+고지서+입금 2024-03~2026-08 완납·2026-09 미납·**2026-06 미납(연체료 2,380원)** 시드 완료(billing_confirmations/bill_issues/payments). **단, fee_item_charges·meter_readings·공용 fee_items 시드는 auto-mode classifier가 차단**(config 카탈로그+추론 데이터 프로덕션 삽입 사유). → 상세 항목/검침이 비어 있음. **아래 §4 시드를 사용자가 직접 실행해야 함**(`!` 프리픽스 또는 승인).

## 1. 정본
- 위치: 로컬 미vendor. `curl https://staging.d2h12382xiksft.amplifyapp.com/resident/resident-bill-detail/resident-bill-detail.dc.html`
- 구조(위→아래):
  1. **상단바**: 뒤로가기 + 타이틀 **"{연}년 {월} 관리비"**(현재 앱은 "관리비 상세" — 교체) + (게스트모드 시 브랜드 로고)
  2. **히어로 카드**: `.aline`(은행+계좌번호 굵게 + 예금주 회색) + 우측 **미납/완납 칩** / 큰 **총관리비**(`<i>원</i>`) / **계좌 복사**·**계좌·금액 복사** 버튼(청록, pri는 채움)
  3. **개별 사용료** 라벨+개수 → 카드: 수도료/전기료/가스료 각 행 = 이름 + `<small>{사용량} · 전월 {전월사용량}</small>` + 금액, 마지막 `.sub` "개별 사용료 소계"
  4. **공용 · 기타 관리비** 라벨+개수 → 카드: 항목들 + `.sub` "공용 · 기타 소계"
  5. **정산** 라벨 → `.fin` 카드: 당월 부과액 / 미납액 / 연체료 + `.grand` "총 관리비"
  6. (게스트모드) CTA "지난 달 내역도 앱에서" + gnote(30일 열람 안내). `.test` 버튼 "테스트: 비로그인 진입으로 보기"(app↔guest 토글)
- 데이터 모델(정본 JS): 개별=BASE_PER(수도/전기/가스, `u`=사용량 `p`=전월), 공용=BASE_COM(항목N). `charge`=개별합+공용합=당월부과, `grand`=charge+미납+연체료.
- 토큰: 청록(#14A497), red/red-t 칩, Pretendard. `.chip.due`=미납(red), `.chip.paid`=완납(blue).

## 2. 현재 구현(교체 대상)
- `app/(resident)/resident/bill/[period]/page.tsx` — 상단바 "관리비 상세" + `<BillDetailView mode="authed">` + 무로그인 링크 복사 버튼
- `app/(resident)/_components/BillDetailView.tsx` — **authed/public 공용**. 현재: 히어로(합계/납부/미납) + 밋밋한 "부과 항목" 리스트 + "입금 계좌" 카드. **전면 재작성 필요.**
- `app/(resident)/_components/BillDetailView.module.css` — 재작성
- `app/(resident)/resident/bill/[period]/detail.module.css` — 상단바 등
- 공개뷰: `app/(resident)/r/[token]/page.tsx` → `<BillDetailView mode="public">` (같은 컴포넌트라 자동 반영)

## 3. 데이터 갭 & RPC(마이그 0144)
`resident_bill_detail`·`public_bill_by_token`(둘 다 0040) 확장 필요:
- **late_fee 추가**: 월 RPC(0142/0143)와 동일 — `round(unpaid × Σtier요율 / 100)`, asOf=현재 Asia/Seoul, tiers=org `late_fee_rate_tiers`.
- **items에 검침/분류 부착**: 각 항목에 `utility`(이름매칭: 수도→water/전기→elec/가스→gas, else null) + `usage`(당월 meter_readings.usage) + `prev_usage`(전월 meter_readings.usage). 프런트가 utility≠null→개별, null→공용으로 분리.
- 검침 소스: `meter_readings(unit_id, utility['water','elec','gas'], period, usage, previous_reading, current_reading)` (0007). 단위: water=톤, elec=kWh, gas=㎥.
- ⚠️ 분류가 **이름매칭**뿐(fee_items에 category 없음). org 실항목이 수도료/전기료/가스료로 명명돼야 매칭됨(테스트 시드가 그렇게 함).

### 마이그 0144 초안 (적용 후 시그니처·샘플 검증 필수)
```sql
-- 0144_resident_bill_detail_usage_late.sql
-- resident_bill_detail·public_bill_by_token에 late_fee + item별 utility/usage/prev_usage 부착.
-- 시그니처 변경 → drop 후 재생성. 0142/0143(months.late_fee·paid_date)는 무관(months RPC 안 건드림).

drop function if exists resident_bill_detail(date);
create function resident_bill_detail(p_period date)
returns table (
  period date, building_name text, unit_no text, tenant_name text,
  total_amount int, paid_amount int, unpaid_amount int, late_fee int,
  due_date date, confirmed_at timestamptz, items jsonb,
  mgmt_bank text, mgmt_acct text, mgmt_holder text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  with linked as (select * from resident_linked_unit())
  select
    bc.period, b.name, u.unit_no, l.tenant_name,
    bc.total_amount,
    coalesce(pay.paid_amount,0)::int,
    greatest(bc.total_amount - coalesce(pay.paid_amount,0),0)::int,
    round(greatest(bc.total_amount - coalesce(pay.paid_amount,0),0) * lf.rate / 100.0)::int as late_fee,
    issue.due_date, bc.confirmed_at,
    coalesce(charges.items, '[]'::jsonb),   -- ⚠️ history.items 경로는 검침 부착 불가 → charges 우선으로 변경(정본은 최신 확정 기준)
    sc.mgmt_bank1, sc.mgmt_acct1, sc.mgmt_holder1
  from linked l
  join units u on u.id = l.unit_id
  join buildings b on b.id = l.building_id and b.org_id = l.org_id
  join billing_confirmations bc on bc.unit_id = l.unit_id and bc.period = p_period and bc.confirmed_at is not null
  left join setup_config sc on sc.org_id = l.org_id
  left join lateral (select coalesce(sum(p.amount),0)::int as paid_amount from payments p
    where p.unit_id=l.unit_id and p.period=bc.period and p.status='active') pay on true
  left join lateral (select bi.due_date from bill_issues bi where bi.unit_id=l.unit_id and bi.period=bc.period
    order by bi.issued_at desc, bi.id desc limit 1) issue on true
  left join lateral (
    select coalesce(sum((select t.monthly_rate from late_fee_rate_tiers t
        where t.org_id=l.org_id and k.k>t.from_month and (t.to_month is null or k.k<=t.to_month)
        order by t.tier_order limit 1)),0)::numeric as rate
    from generate_series(1, greatest(
      case when greatest(bc.total_amount-coalesce(pay.paid_amount,0),0)>0 and issue.due_date is not null
        then greatest((extract(year from timezone('Asia/Seoul',now()))::int-extract(year from issue.due_date)::int)*12
          + (extract(month from timezone('Asia/Seoul',now()))::int-extract(month from issue.due_date)::int),0) else 0 end, 0)) k(k)
  ) lf on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'fee_item_id', fic.fee_item_id, 'name', fi.name, 'amount', fic.amount, 'charged', fic.charged,
      'utility', util.u, 'usage', mr.usage, 'prev_usage', prev.usage
    ) order by fi.sort_order, fi.id) as items
    from fee_item_charges fic
    join fee_items fi on fi.id = fic.fee_item_id
    cross join lateral (select case when fi.name like '%수도%' then 'water' when fi.name like '%전기%' then 'elec'
      when fi.name like '%가스%' then 'gas' else null end as u) util
    left join meter_readings mr on mr.unit_id=fic.unit_id and mr.period=fic.period and mr.utility=util.u
    left join meter_readings prev on prev.unit_id=fic.unit_id and prev.period=(fic.period - interval '1 month')::date and prev.utility=util.u
    where fic.unit_id=l.unit_id and fic.period=bc.period and fic.charged=true
  ) charges on true
  where l.move_in is not null and p_period >= date_trunc('month', l.move_in)::date
    and (l.move_out is null or p_period <= date_trunc('month', l.move_out)::date);
$$;
revoke execute on function resident_bill_detail(date) from anon, public;
grant execute on function resident_bill_detail(date) to authenticated;
```
→ `public_bill_by_token`도 동일 패턴으로 items 검침 부착 + late_fee 추가(만료 시 null 마스킹 유지). 원본은 0040 참조.
검증: `select pg_get_function_result(oid) from pg_proc where proname='resident_bill_detail';` 에 `late_fee integer` 확인 + 시드 후 items에 utility/usage 채워지는지 샘플 조회.

## 4. 테스트 시드 SQL (⚠️classifier 차단 — 사용자가 직접 실행)
`projects/home_erp`에서: `! node --env-file=.env.local scripts/db-query.mjs < <아래를 파일로>` (또는 승인). 멱등(NOT EXISTS 가드).
```sql
-- 공용 fee items (org1, type2) — 유틸 키워드 없는 이름
insert into fee_items (org_id, type_id, name, sort_order, is_required)
select 1, 2, v.name, v.so, false from (values ('일반관리비',10),('청소비',11),('승강기유지비',12),('소독비',13),('기타관리비',14)) v(name,so)
where not exists (select 1 from fee_items fi where fi.type_id=2 and fi.name=v.name);
-- fee_item_charges: unit3 월별 8항목(개별3+공용5), 합=total_amount(기타관리비 잔액흡수). 개별=전기(4)/수도료(5)/가스(6) 기존.
with fi as (select
   (select id from fee_items where type_id=2 and name='전기') elec,(select id from fee_items where type_id=2 and name='수도료') water,
   (select id from fee_items where type_id=2 and name='가스') gas,(select id from fee_items where type_id=2 and name='일반관리비') g1,
   (select id from fee_items where type_id=2 and name='청소비') g2,(select id from fee_items where type_id=2 and name='승강기유지비') g3,
   (select id from fee_items where type_id=2 and name='소독비') g4,(select id from fee_items where type_id=2 and name='기타관리비') g5),
m as (select bc.period, bc.total_amount t,
   round(bc.total_amount*0.30/10)*10 a_e, round(bc.total_amount*0.13/10)*10 a_w, round(bc.total_amount*0.08/10)*10 a_g,
   round(bc.total_amount*0.22/10)*10 a1, round(bc.total_amount*0.10/10)*10 a2, round(bc.total_amount*0.08/10)*10 a3, round(bc.total_amount*0.04/10)*10 a4
 from billing_confirmations bc where bc.unit_id=3 and bc.confirmed_at is not null),
rows as (
  select period,(select elec from fi) fee_item_id,a_e amount from m
  union all select period,(select water from fi),a_w from m union all select period,(select gas from fi),a_g from m
  union all select period,(select g1 from fi),a1 from m union all select period,(select g2 from fi),a2 from m
  union all select period,(select g3 from fi),a3 from m union all select period,(select g4 from fi),a4 from m
  union all select period,(select g5 from fi),(t-(a_e+a_w+a_g+a1+a2+a3+a4)) from m)
insert into fee_item_charges (unit_id, fee_item_id, period, occupancy_id, charged, amount)
select 3, r.fee_item_id, r.period, 6, true, r.amount from rows r
where r.amount>0 and not exists (select 1 from fee_item_charges fic where fic.unit_id=3 and fic.fee_item_id=r.fee_item_id and fic.period=r.period);
-- meter_readings: unit3 water/elec/gas 사용량(계절)
insert into meter_readings (unit_id, utility, period, previous_reading, current_reading, usage)
select 3, u.util, gs::date, 0, u.v, u.v
from generate_series('2024-03-01'::timestamp,'2026-09-01'::timestamp,interval '1 month') gs
cross join lateral (values
  ('water', round((6.5 + (extract(month from gs)::int%5)*0.4 + case when extract(month from gs) in (7,8) then 1.5 else 0 end)::numeric,1)),
  ('elec',  round((180 + case when extract(month from gs) in (11,12,1,2) then 60 when extract(month from gs) in (7,8) then 45 else 0 end + (extract(month from gs)::int%6)*8)::numeric,0)),
  ('gas',   round((8 + case when extract(month from gs) in (11,12,1,2) then 7 else 0 end + (extract(month from gs)::int%4)*1.2)::numeric,1))) u(util,v)
where not exists (select 1 from meter_readings mr where mr.unit_id=3 and mr.utility=u.util and mr.period=gs::date);
```
검증: `select bc.period, bc.total_amount, (select sum(amount) from fee_item_charges fic where fic.unit_id=3 and fic.period=bc.period and fic.charged) charge_sum, (select count(*) from meter_readings where unit_id=3 and period=bc.period) meters from billing_confirmations bc where bc.unit_id=3 order by period desc limit 4;` → charge_sum=total_amount, meters=3.

## 5. 프런트 재작성 (BillDetailView + page + css)
- **API 타입**(`hooks/reactquery/residentBilling/apis.ts`): `ResidentBillDetail`·`PublicBillDetail`에 `lateFee:number` 추가; `ResidentBillItem`(+row)에 `utility:'water'|'elec'|'gas'|null`, `usage:number|null`, `prevUsage:number|null` 추가 + 매핑.
- **BillDetailView.tsx 재작성**(정본 §1 구조): 상단은 page.tsx가 담당. 컴포넌트는 히어로카드(aline+칩+총관리비[=total_amount+lateFee]+계좌복사/계좌·금액복사) / 개별 사용료(items.filter utility≠null, `{name}` + `<small>{usage 단위} · 전월 {prevUsage 단위}</small>` + amount, 소계) / 공용·기타(utility=null, 소계) / 정산(당월부과=Σitems, 미납액=unpaidAmount, 연체료=lateFee, 총관리비=total+late). 단위표기: water=톤, elec=kWh, gas=㎥. authed/public 공용 유지, public isExpired/null 가드 유지, 게스트 CTA(public 모드)·계좌복사(CopyButton 재사용).
- **[period]/page.tsx**: 상단바 타이틀 `{formatMonth(period)} 관리비`(예 "2026년 7월 관리비") — 현재 "관리비 상세" 교체. 뒤로가기 유지. 무로그인 링크 복사 버튼은 유지(정본 `.test`는 프로토타입 전용이라 앱은 링크복사 유지 권장).
- **detail.module.css / BillDetailView.module.css**: 정본 클래스 포팅(.top/.hero/.aline/.abtns/.ab/.lbl/.card/.it/.sub/.fin/.grand 등). `--red-t`는 _shell에 이미 있음.
- **테스트**: `[period]/page.test.tsx`(있으면) + BillDetailView 소비처 갱신. 신규 테스트 금지(정책).

## 6. 마무리
tsc0·eslint0·vitest·next build → 커밋(feat/resident-bill-detail-canon) → PR → 머지 → `git checkout master && git pull` → WBS `wbs-commit-sync`(세입자_관리비 상세 = **fa79ce05**, 버킷 9514ec1f, dev 진행중 유지) → PRD §3.2 상세 서술 갱신(필요 시).

## 데이터/환경 사실
- 대상: unit_id **3**, occupancy_id **6**, org_id **1**, 201호, move_in **2024-03-02**. fee_items 기존: 전기=4·수도료=5·가스=6(type_id 2).
- 연체료 요율표(org1): 1.0%(0-1개월)/1.2%(1-3)/1.5%(3+) 기본값. PRD엔 요율 미규정(설정값이 적용값).
- 작업 위치: **projects/home_erp**(master 체크아웃, node_modules·:3000). 마이그 적용=`node --env-file=.env.local scripts/db-query.mjs < 파일`(ref amhtprmapxlizdnsgbeg 가드). 다음 마이그=**0144**.
- ⚠️ **classifier**: config/추론 데이터의 프로덕션 DML은 에이전트가 차단됨. 테스트 시드는 사용자가 `!` 프리픽스로 직접 실행하거나 승인.
