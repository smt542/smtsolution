import type { MeterSummary } from "@/hooks/reactquery/movingSettlement";
import { formatNumber } from "@/lib/format";

function value(meter: MeterSummary | undefined, key: "previousReading" | "currentReading" | "usage") {
  return formatNumber(meter?.[key] ?? null, { nullText: "-" });
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
        <p className="px-[18px] py-[14px] text-[12.5px] leading-[20px] text-t4">
          건물과 호실을 선택하면
          <br />
          검침정보가 표시돼요
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <span className="sr-only">수도</span>
          <span className="sr-only">전기</span>
          <span className="sr-only">가스</span>
          <div className="grid h-[33px] min-w-[560px] grid-cols-[44px_32px_repeat(9,46px)_72px] border-b border-line bg-[#fbfcfd] text-center text-[11px] font-bold text-t3">
            {[
              "년", "월", "수.전", "수.금", "량", "전.전", "전.금", "량", "가.전", "가.금", "량", "수납일",
            ].map((label, index) => (
              <span key={`${label}-${index}`} className="py-[9px]">{label}</span>
            ))}
          </div>
          <div className="grid h-[33px] min-w-[560px] grid-cols-[44px_32px_repeat(9,46px)_72px] border-b border-line2 text-center text-[11.5px] text-t1">
            <span className="py-[9px]">{today.getFullYear()}</span>
            <span className="py-[9px]">{String(today.getMonth() + 1).padStart(2, "0")}</span>
            <span className="py-[9px]">{value(byUtility.get("water"), "previousReading")}</span>
            <span className="py-[9px]">{value(byUtility.get("water"), "currentReading")}</span>
            <span className="py-[9px]">{value(byUtility.get("water"), "usage")}</span>
            <span className="py-[9px]">{value(byUtility.get("elec"), "previousReading")}</span>
            <span className="py-[9px]">{value(byUtility.get("elec"), "currentReading")}</span>
            <span className="py-[9px]">{value(byUtility.get("elec"), "usage")}</span>
            <span className="py-[9px]">{value(byUtility.get("gas"), "previousReading")}</span>
            <span className="py-[9px]">{value(byUtility.get("gas"), "currentReading")}</span>
            <span className="py-[9px]">{value(byUtility.get("gas"), "usage")}</span>
            <span className="py-[9px]">-</span>
          </div>
        </div>
      )}
    </section>
  );
}
