import type { MeterSummary } from "@/hooks/reactquery/movingSettlement";
import { formatNumber } from "@/lib/format";

function value(meter: MeterSummary | undefined, key: "previousReading" | "currentReading" | "usage") {
  return formatNumber(meter?.[key] ?? null, { nullText: "-" });
}

function meterCellClass(index: number): string {
  if (index === 0) return "py-[8px] pl-[18px] pr-[7px] text-left";
  if (index === 1) return "px-[7px] py-[8px] text-left";
  if (index === 11) return "py-[8px] pl-[7px] pr-[18px] text-left";
  return "px-[7px] py-[8px] text-right";
}

export function MeterInfoPanel({
  meters,
  selected = true,
}: {
  meters: MeterSummary[];
  selected?: boolean;
}) {
  const byUtility = new Map(meters.map((meter) => [meter.utility, meter]));
  const today = new Date();

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
        <h2 className="text-[15px] font-extrabold text-t1">검침정보</h2>
      </div>
      {!selected ? (
        // 원본 `.ms-mt-e{padding:14px 18px;font-size:12.5px;font-weight:500;line-height:1.6}`
        <p className="px-[18px] py-[14px] text-[12.5px] font-medium leading-[1.6] text-t4">
          건물과 호실을 선택하면
          <br />
          검침정보가 표시돼요
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="min-w-[564px]">
            <div className="grid h-[29.5px] grid-cols-[54.484px_28.75px_46.531px_46.531px_28.75px_46.531px_46.531px_28.75px_46.531px_46.531px_53.906px_90.063px] border-b border-line bg-[#fbfcfd] text-[11px] font-bold text-t3">
              {[
                "년", "월", "수.전", "수.금", "량", "전.전", "전.금", "량", "가.전", "가.금", "당월계", "수납일",
              ].map((label, index) => (
                <span key={`${label}-${index}`} className={meterCellClass(index)}>{label}</span>
              ))}
            </div>
            <div className="grid h-[33px] grid-cols-[54.484px_28.75px_46.531px_46.531px_28.75px_46.531px_46.531px_28.75px_46.531px_46.531px_53.906px_90.063px] border-b border-line2 text-[11.5px] text-t1">
              <span className={meterCellClass(0)}>{today.getFullYear()}</span>
              <span className={meterCellClass(1)}>{String(today.getMonth() + 1).padStart(2, "0")}</span>
              <span className={meterCellClass(2)}>{value(byUtility.get("water"), "previousReading")}</span>
              <span className={meterCellClass(3)}>{value(byUtility.get("water"), "currentReading")}</span>
              <span className={meterCellClass(4)}>{value(byUtility.get("water"), "usage")}</span>
              <span className={meterCellClass(5)}>{value(byUtility.get("elec"), "previousReading")}</span>
              <span className={meterCellClass(6)}>{value(byUtility.get("elec"), "currentReading")}</span>
              <span className={meterCellClass(7)}>{value(byUtility.get("elec"), "usage")}</span>
              <span className={meterCellClass(8)}>{value(byUtility.get("gas"), "previousReading")}</span>
              <span className={meterCellClass(9)}>{value(byUtility.get("gas"), "currentReading")}</span>
              <span className={meterCellClass(10)}>-</span>
              <span className={meterCellClass(11)}>-</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
