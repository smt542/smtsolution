import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CalendarIcon } from "@/components/icons";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import type { MeterSummary, SettlementUtility } from "@/hooks/reactquery/movingSettlement";
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

export function UtilitySettlementSection({
  value,
  meters,
  onChange,
}: {
  value: MovingSettlementValues;
  meters: MeterSummary[];
  onChange: (next: MovingSettlementValues) => void;
}) {
  const byUtility = new Map(meters.map((meter) => [meter.utility, meter]));
  const utilityTotal = UTILITY_ROWS.reduce(
    (total, row) => total + (value[row.chargeKey] ?? 0),
    0,
  );

  return (
    <section className="rounded-[14px] border border-[#dce1e7] bg-white px-[16px] pb-[16px] pt-[15px]">
      <div className="flex items-center pb-px">
        <h3 className="text-[14px] font-extrabold text-t1">공과금 정산</h3>
      </div>
      <div className="mt-[10px] overflow-x-auto">
        <div className="grid min-w-[900px] grid-cols-[86.609fr_127.641fr_132.188fr_109.406fr_77.484fr_154.984fr_237.047fr_200.641fr]">
          <div className="col-span-8 grid h-[21px] grid-cols-subgrid text-[11.5px] font-bold text-t2">
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
          const charge = value[row.chargeKey] ?? 0;
          const unitPrice = usage > 0 ? Math.round(charge / usage) : 0;
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
                <span className="flex h-[34px] w-full items-center justify-end rounded-[9px] border border-[#dee3e8] px-[8px] text-right text-[12.5px] font-semibold text-t1">
                  {formatNumber(unitPrice)}
                </span>
              </div>
              <div className="p-[4px]">
                <span className="flex h-[34px] items-center justify-end text-right text-[12.5px] font-bold text-t1">
                  {formatNumber(usage)}
                </span>
              </div>
              <div className="p-[4px]">
                <input
                  aria-label={`${row.label} 요금`}
                  type="number"
                  min={0}
                  value={value[row.chargeKey] ?? ""}
                  onChange={(event) => onChange({ ...value, [row.chargeKey]: numericValue(event.target.value) })}
                  className="h-[34px] w-full rounded-[9px] border border-[#dee3e8] px-[8px] text-right text-[12.5px] font-bold text-t1 outline-none focus:border-teal"
                />
              </div>
              <div className="p-[4px]">
                <input
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
      <div className="mt-[6px] flex items-baseline justify-center border-t border-line pt-[11px]">
        <span className="text-[14px] font-medium text-t1">① 공과금 소계</span>
        <strong className="ml-[10px] text-[17px] font-extrabold tracking-[-0.17px] text-teal-d">{formatNumber(utilityTotal)}</strong>
        <span className="ml-[3px] text-[12px] font-bold text-teal-d opacity-[0.62]">원</span>
      </div>
    </section>
  );
}
