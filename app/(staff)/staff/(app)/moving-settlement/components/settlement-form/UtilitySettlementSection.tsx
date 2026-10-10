import { Input } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CalendarIcon } from "@/components/icons";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import {
  utilityReadingCharge,
  type MeterSummary,
  type SettlementSettings,
  type SettlementUtility,
} from "@/hooks/reactquery/movingSettlement";
import { formatNumber } from "@/lib/format";

type ChargeKey = "waterCharge" | "elecCharge" | "gasCharge";
type ReadingKey =
  | "waterPrevReading" | "waterMoveReading" | "waterUnitPrice"
  | "elecPrevReading" | "elecMoveReading" | "elecUnitPrice"
  | "gasPrevReading" | "gasMoveReading" | "gasUnitPrice";

export const UTILITY_ROWS: Array<{
  utility: SettlementUtility;
  label: string;
  chargeKey: ChargeKey;
  paidDateKey: "elecPaidDate" | "gasPaidDate" | null;
  prevKey: ReadingKey;
  moveKey: ReadingKey;
  priceKey: ReadingKey;
}> = [
  { utility: "water", label: "수도", chargeKey: "waterCharge", paidDateKey: null, prevKey: "waterPrevReading", moveKey: "waterMoveReading", priceKey: "waterUnitPrice" },
  { utility: "elec", label: "전기", chargeKey: "elecCharge", paidDateKey: "elecPaidDate", prevKey: "elecPrevReading", moveKey: "elecMoveReading", priceKey: "elecUnitPrice" },
  { utility: "gas", label: "가스", chargeKey: "gasCharge", paidDateKey: "gasPaidDate", prevKey: "gasPrevReading", moveKey: "gasMoveReading", priceKey: "gasUnitPrice" },
];

function numericValue(raw: string): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 단가 반영 설정(`/staff/setup?tab=settlement`)이 걸린 유틸인지.
 * 설정은 수도·전기만 있다 — 가스는 외부 검침이라 앱이 단가를 모르므로 항상 수동이다.
 */
function reflectsUnitPrice(
  utility: SettlementUtility,
  settings: SettlementSettings,
): boolean {
  if (utility === "water") return settings.waterUnitReflect;
  if (utility === "elec") return settings.electricUnitReflect;
  return false;
}

/**
 * 단가 반영 ON 인 유틸은 **단가만** 검침 단가(meter.unitPrice)로 채운다(정책 3.5, 개선3차 7).
 * 금액은 월 부과액으로 덮어쓰지 않고 항상 `max(0, 이사 − 전월) × 단가` 로 계산한다.
 * 검침 단가가 없으면 null → 단가를 직접 입력한다.
 */
function reflectedUnitPrice(
  utility: SettlementUtility,
  meters: MeterSummary[],
  settings: SettlementSettings,
): number | null {
  if (!reflectsUnitPrice(utility, settings)) return null;
  return meters.find((meter) => meter.utility === utility)?.unitPrice ?? null;
}

/** 구분 한 행의 계산값: 단가(반영 ON 이면 검침 단가)·량·금액. 금액은 지침·단가가 다 있어야 계산된다. */
function utilityRowValues(
  row: (typeof UTILITY_ROWS)[number],
  value: MovingSettlementValues,
  meters: MeterSummary[],
  settings: SettlementSettings,
) {
  const reflectedPrice = reflectedUnitPrice(row.utility, meters, settings);
  const prev = value[row.prevKey] ?? null;
  const cur = value[row.moveKey] ?? null;
  const price = reflectedPrice ?? value[row.priceKey] ?? null;
  const usage = prev !== null && cur !== null ? Math.max(0, cur - prev) : null;
  return {
    prev,
    cur,
    price,
    usage,
    isReflected: reflectedPrice !== null,
    computedCharge: utilityReadingCharge(prev, cur, price),
  };
}

/**
 * 공과금 행의 계산값을 draft 에 되돌려 넣을 patch. SettlementForm 이 관리비 소계와 한 이펙트에서 적용해
 * 표시값·소계·요약바·저장값의 출처를 하나로 유지한다.
 * - 단가 반영 ON: 단가 = 검침 단가
 * - 금액: 지침·단가가 다 있으면 계산값(0이면 파트너 저장과 같이 null). 하나라도 비면 저장된 금액을 그대로 둔다.
 */
export function derivedUtilityPatch(
  value: MovingSettlementValues,
  meters: MeterSummary[],
  settings: SettlementSettings,
): Partial<MovingSettlementValues> {
  const patch: Partial<MovingSettlementValues> = {};
  for (const row of UTILITY_ROWS) {
    const derived = utilityRowValues(row, value, meters, settings);
    if (derived.isReflected && (value[row.priceKey] ?? null) !== derived.price) {
      patch[row.priceKey] = derived.price;
    }
    if (derived.computedCharge === null) continue;
    const nextCharge = derived.computedCharge === 0 ? null : derived.computedCharge;
    if ((value[row.chargeKey] ?? null) !== nextCharge) patch[row.chargeKey] = nextCharge;
  }
  return patch;
}

export function UtilitySettlementSection({
  value,
  meters,
  settings,
  onChange,
}: {
  value: MovingSettlementValues;
  meters: MeterSummary[];
  settings: SettlementSettings;
  onChange: (next: MovingSettlementValues) => void;
}) {
  // 소계는 계산값을 즉시 반영한다(draft 되돌려넣기의 한 프레임 지연을 타지 않도록).
  const rows = UTILITY_ROWS.map((row) => {
    const derived = utilityRowValues(row, value, meters, settings);
    return { row, ...derived, shownCharge: derived.computedCharge ?? value[row.chargeKey] ?? 0 };
  });
  const utilityTotal = rows.reduce((total, item) => total + item.shownCharge, 0);
  const inputClassName =
    "h-[34px] w-full rounded-[9px] border border-[#dee3e8] px-[8px] text-right text-[12.5px] font-semibold text-t1 outline-none focus:border-teal";

  const reversedLabels = rows
    .filter(({ prev, cur }) => prev !== null && cur !== null && cur > 0 && cur < prev)
    .map(({ row }) => row.label);

  return (
    <section className="rounded-[14px] border border-[#dce1e7] bg-white px-[16px] pb-[16px] pt-[15px]">
      <div className="flex h-[18px] items-center pb-px">
        <h3 className="text-[14px] font-extrabold leading-[17px] text-t1">공과금 정산</h3>
      </div>
      <div className="mt-[10px]">
        <div className="grid grid-cols-[86.609fr_127.641fr_132.188fr_109.406fr_77.484fr_154.984fr_237.047fr_200.641fr]">
          <div className="col-span-8 grid h-[21px] grid-cols-subgrid text-[11.5px] font-bold leading-[14px] text-t2">
            <span className="pb-[7px] pr-[7px] text-left">구분</span>
            <span className="px-[7px] pb-[7px] text-right">전월</span>
            <span className="px-[7px] pb-[7px] text-right">이사</span>
            <span className="px-[7px] pb-[7px] text-right">단가</span>
            <span className="px-[7px] pb-[7px] text-right">량</span>
            <span className="px-[7px] pb-[7px] text-right">금액</span>
            <span className="px-[7px] pb-[7px] text-left">입금계좌</span>
            <span className="pb-[7px] pl-[7px] text-left">입금일</span>
          </div>
        {rows.map(({ row, prev, cur, price, usage, isReflected, shownCharge }) => {
          // 정본(정책 3.5): 전월 지침 · 이사 지침 · 단가는 입력, 량=이사−전월, 금액=량×단가(자동).
          // 단가 반영 ON 이면 단가만 검침 단가(읽기전용)로 채운다.
          return (
            <div key={row.utility} className="col-span-8 grid h-[42px] grid-cols-subgrid items-center">
              <span className="py-[4px] pr-[4px] text-left text-[12.5px] font-bold text-t1">{row.label}</span>
              <div className="p-[4px]">
                <Input
                  unstyled
                  aria-label={`${row.label} 전월 지침`}
                  type="number"
                  min={0}
                  step="any"
                  value={prev ?? ""}
                  onChange={(event) => onChange({ ...value, [row.prevKey]: numericValue(event.target.value) })}
                  className={inputClassName}
                />
              </div>
              <div className="p-[4px]">
                <Input
                  unstyled
                  aria-label={`${row.label} 이사 지침`}
                  type="number"
                  min={0}
                  step="any"
                  value={cur ?? ""}
                  onChange={(event) => onChange({ ...value, [row.moveKey]: numericValue(event.target.value) })}
                  className={inputClassName}
                />
              </div>
              <div className="p-[4px]">
                {isReflected ? (
                  <span
                    aria-label={`${row.label} 단가`}
                    className="flex h-[34px] w-full items-center justify-end rounded-[9px] border border-line2 bg-[#f7f9fa] px-[8px] text-right text-[12.5px] font-semibold text-t2"
                  >
                    {formatNumber(price, { nullText: "-" })}
                  </span>
                ) : (
                  <Input
                    unstyled
                    aria-label={`${row.label} 단가`}
                    type="number"
                    min={0}
                    step="any"
                    value={price ?? ""}
                    onChange={(event) => onChange({ ...value, [row.priceKey]: numericValue(event.target.value) })}
                    className={inputClassName}
                  />
                )}
              </div>
              <div className="p-[4px]">
                <span className="flex h-[34px] items-center justify-end text-right text-[12.5px] font-bold text-t1">
                  {formatNumber(usage ?? 0)}
                </span>
              </div>
              <div className="p-[4px]">
                <span
                  aria-label={`${row.label} 금액`}
                  className="flex h-[34px] items-center justify-end text-right text-[12.5px] font-bold text-t1"
                >
                  {formatNumber(shownCharge)}
                </span>
              </div>
              <div className="p-[4px]">
                <Input
                  unstyled
                  aria-label={`${row.label} 입금계좌`}
                  value={value.settleAcct ?? ""}
                  onChange={(event) => onChange({ ...value, settleAcct: event.target.value })}
                  placeholder="입금계좌"
                  className="h-[34px] w-full rounded-[9px] border border-[#dee3e8] px-[8px] text-[13px] text-t1 outline-none placeholder:text-t4 focus:border-teal"
                />
              </div>
              <div className="py-[4px] pl-[4px]">
                <DpDatePicker
                  ariaLabel={`${row.label} 입금일`}
                  value={row.paidDateKey ? (value[row.paidDateKey] ?? "") : ""}
                  onChange={(next) => row.paidDateKey && onChange({ ...value, [row.paidDateKey]: next })}
                  disabled={!row.paidDateKey}
                  placeholder="날짜 선택"
                  className="w-full"
                  triggerClassName="flex h-[34px] w-full cursor-pointer items-center justify-between gap-[6px] rounded-[9px] border border-[#dee3e8] px-[8px] text-[12px] text-t1 outline-none"
                  triggerOpenClassName="!border-teal ring-[3px] ring-teal-t"
                  endAdornment={<CalendarIcon className="size-[14px] shrink-0 text-t3" aria-hidden="true" />}
                />
              </div>
            </div>
          );
        })}
        </div>
      </div>
      {/* 이사 지침 < 전월 지침(역전): 누적 계량기라 정상이면 없다. 량은 0으로 계산하고 경고만 한다(저장은 막지 않음, 계산 규칙 6절 ②). */}
      {reversedLabels.length > 0 ? (
        <p role="alert" className="mt-[8px] rounded-[9px] bg-red-t px-[10px] py-[7px] text-[12px] font-semibold leading-[1.5] text-red">
          {reversedLabels.join("·")} 이사 지침이 전월 지침보다 작아 량을 0으로 계산했어요. 검침값을 확인해 주세요. 계량기를 교체했거나 한 바퀴 돌았다면 전월 지침을 고쳐 실제 사용량이 나오게 해 주세요.
        </p>
      ) : null}
      <div className="mt-[10px] flex h-[32px] items-baseline justify-center border-t border-line pt-[11px]">
        {/* items-baseline 기준선은 가장 큰 금액(17/21)이 잡는다. 라벨 leading 을 정본 박스값(17)로
            내리면 오히려 기준선이 1.6px 밀리므로 20 을 유지한다(정본 글리프 위치와 일치). */}
        <span className="text-[14px] font-medium leading-[20px] text-t1">① 공과금 소계</span>
        <strong className="ml-[10px] text-[17px] font-extrabold leading-[21px] tracking-[-0.17px] text-teal-d">{formatNumber(utilityTotal)}</strong>
        <span className="ml-[3px] text-[12px] font-bold leading-[15px] text-teal-d opacity-[0.62]">원</span>
      </div>
    </section>
  );
}
