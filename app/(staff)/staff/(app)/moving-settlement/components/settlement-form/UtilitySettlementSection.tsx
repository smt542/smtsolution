import { Input } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CalendarIcon } from "@/components/icons";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import type {
  MeterSummary,
  SettlementSettings,
  SettlementUtility,
} from "@/hooks/reactquery/movingSettlement";
import { formatNumber } from "@/lib/format";

const UTILITY_ROWS: Array<{
  utility: SettlementUtility;
  label: string;
  chargeKey: "waterCharge" | "elecCharge" | "gasCharge";
  paidDateKey: "elecPaidDate" | "gasPaidDate" | null;
}> = [
  { utility: "water", label: "수도", chargeKey: "waterCharge", paidDateKey: null },
  { utility: "elec", label: "전기", chargeKey: "elecCharge", paidDateKey: "elecPaidDate" },
  { utility: "gas", label: "가스", chargeKey: "gasCharge", paidDateKey: "gasPaidDate" },
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
 * 단가 반영 ON 인 유틸의 금액을 **그 달 검침의 실효 요금**으로 잡는다(0169).
 *
 * `meter.charge` = `coalesce(manual_charge, calc_charge)` 이고 `calc_charge` 자체가
 * `usage x unit_price - 할인` 이다. 여기서 단가를 다시 곱하면 수도 할인(water_discounts)과
 * 담당자 수동 보정(manual_charge)이 빠져 /staff/utilities 의 그 달 요금과 어긋난다.
 * 그 달 검침이 없어 charge 가 null 이면 제외하고 수동 입력을 지킨다.
 *
 * SettlementForm 이 이 결과를 draft 로 되돌려 넣어 표시값·소계·요약바·저장값의 출처를 하나로 유지한다.
 */
export function reflectedUtilityCharges(
  meters: MeterSummary[],
  settings: SettlementSettings,
): Partial<Record<"waterCharge" | "elecCharge" | "gasCharge", number>> {
  const byUtility = new Map(meters.map((meter) => [meter.utility, meter]));
  const next: Partial<Record<"waterCharge" | "elecCharge" | "gasCharge", number>> = {};

  for (const row of UTILITY_ROWS) {
    if (!reflectsUnitPrice(row.utility, settings)) continue;
    const meter = byUtility.get(row.utility);
    if (!meter || meter.charge === null) continue;
    next[row.chargeKey] = meter.charge;
  }
  return next;
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
  const byUtility = new Map(meters.map((meter) => [meter.utility, meter]));
  const reflected = reflectedUtilityCharges(meters, settings);
  // 소계는 계산값을 즉시 반영한다(draft 되돌려넣기의 한 프레임 지연을 타지 않도록).
  const utilityTotal = UTILITY_ROWS.reduce(
    (total, row) => total + (reflected[row.chargeKey] ?? value[row.chargeKey] ?? 0),
    0,
  );

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
        {UTILITY_ROWS.map((row) => {
          const meter = byUtility.get(row.utility);
          const usage = meter?.usage ?? 0;
          const rawCharge = value[row.chargeKey];
          const charge = rawCharge ?? 0;
          // 정본은 단가가 입력이고 금액은 단가 x 량 계산값이다. 저장 필드는 금액(charge)이므로
          // 단가는 charge/량 으로 되짚어 보여주고, 편집하면 charge 를 다시 계산해 넣는다.
          // 량이 0이면 단가로 금액을 만들 수 없어 입력을 막고 저장된 금액을 그대로 지킨다.
          const unitPrice = usage > 0 && rawCharge !== null ? Math.round(rawCharge / usage) : null;
          // 단가 반영 ON: 단가는 검침값(읽기전용)이고 금액은 단가 x 량 계산값이다.
          const reflectedCharge = reflected[row.chargeKey];
          const isReflected = reflectedCharge !== undefined;
          const shownUnitPrice = isReflected ? (meter?.unitPrice ?? null) : unitPrice;
          const shownCharge = isReflected ? reflectedCharge : charge;
          return (
            <div key={row.utility} className="col-span-8 grid h-[42px] grid-cols-subgrid items-center">
              <span className="py-[4px] pr-[4px] text-left text-[12.5px] font-bold text-t1">{row.label}</span>
              <div className="p-[4px]">
                <span className="flex h-[34px] w-full items-center justify-end rounded-[9px] border border-[#dee3e8] px-[8px] text-right text-[12.5px] font-semibold text-t1">
                  {formatNumber(meter?.previousReading ?? null, { nullText: "-" })}
                </span>
              </div>
              <div className="p-[4px]">
                <span className="flex h-[34px] w-full items-center justify-end rounded-[9px] border border-[#dee3e8] px-[8px] text-right text-[12.5px] font-semibold text-t1">
                  {formatNumber(meter?.currentReading ?? null, { nullText: "-" })}
                </span>
              </div>
              <div className="p-[4px]">
                {isReflected ? (
                  <span
                    aria-label={`${row.label} 단가`}
                    className="flex h-[34px] w-full items-center justify-end rounded-[9px] border border-line2 bg-[#f7f9fa] px-[8px] text-right text-[12.5px] font-semibold text-t2"
                  >
                    {formatNumber(shownUnitPrice, { nullText: "-" })}
                  </span>
                ) : (
                  <Input
                    unstyled
                    aria-label={`${row.label} 단가`}
                    type="number"
                    min={0}
                    readOnly={usage === 0}
                    value={shownUnitPrice ?? ""}
                    onChange={(event) => {
                      if (usage === 0) return;
                      const next = numericValue(event.target.value);
                      onChange({
                        ...value,
                        [row.chargeKey]: next === null ? null : next * usage,
                      });
                    }}
                    className="h-[34px] w-full rounded-[9px] border border-[#dee3e8] px-[8px] text-right text-[12.5px] font-semibold text-t1 outline-none focus:border-teal"
                  />
                )}
              </div>
              <div className="p-[4px]">
                <span className="flex h-[34px] items-center justify-end text-right text-[12.5px] font-bold text-t1">
                  {formatNumber(usage)}
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
