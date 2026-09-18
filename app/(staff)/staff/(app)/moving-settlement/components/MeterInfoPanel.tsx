import { useUnitMeterHistory } from "@/hooks/reactquery/movingSettlement/meterHistory";
import { formatNumber } from "@/lib/format";

function meterCellClass(index: number): string {
  if (index === 0) return "py-[8px] pl-[18px] pr-[7px] text-left";
  if (index === 1) return "px-[7px] py-[8px] text-left";
  if (index === 11) return "py-[8px] pl-[7px] pr-[18px] text-left";
  return "px-[7px] py-[8px] text-right";
}

export function MeterInfoPanel({
  unitId,
  selected = true,
}: {
  unitId: number | null;
  selected?: boolean;
}) {
  const { data: rows = [], isLoading } = useUnitMeterHistory(
    selected ? unitId : null,
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
        <h2 className="text-[15px] font-extrabold leading-[18px] text-t1">검침정보</h2>
      </div>
      {!selected ? (
        // 원본 `.ms-mt-e{padding:14px 18px;font-size:12.5px;font-weight:500;line-height:1.6}`
        <p className="px-[18px] py-[14px] text-[12.5px] font-medium leading-[1.6] text-t4">
          건물과 호실을 선택하면
          <br />
          검침정보가 표시돼요
        </p>
      ) : isLoading ? (
        <p className="px-[18px] py-[14px] text-[12.5px] font-medium leading-[1.6] text-t4">
          검침정보를 불러오고 있어요
        </p>
      ) : rows.length === 0 ? (
        <p className="px-[18px] py-[14px] text-[12.5px] font-medium leading-[1.6] text-t4">
          검침 이력이 없어요
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="min-w-[564px]">
            <div className="grid h-[29.5px] grid-cols-[54.484px_28.75px_46.531px_46.531px_28.75px_46.531px_46.531px_28.75px_46.531px_46.531px_53.906px_90.063px] border-b border-line bg-[#fbfcfd] text-[11px] font-bold leading-[13px] text-t3">
              {[
                "년", "월", "수.전", "수.금", "량", "전.전", "전.금", "량", "가.전", "가.금", "당월계", "수납일",
              ].map((label, index) => (
                <span key={`${label}-${index}`} className={meterCellClass(index)}>{label}</span>
              ))}
            </div>
            {rows.map((row) => (
              <div
                key={row.period}
                className="grid h-[33px] grid-cols-[54.484px_28.75px_46.531px_46.531px_28.75px_46.531px_46.531px_28.75px_46.531px_46.531px_53.906px_90.063px] border-b border-line2 text-[11.5px] leading-[15px] text-t1"
              >
                <span className={meterCellClass(0)}>{row.year}</span>
                <span className={meterCellClass(1)}>{String(row.month).padStart(2, "0")}</span>
                <span className={meterCellClass(2)}>{formatNumber(row.waterPrev, { nullText: "-" })}</span>
                <span className={meterCellClass(3)}>{formatNumber(row.waterCurr, { nullText: "-" })}</span>
                <span className={meterCellClass(4)}>{formatNumber(row.waterUsage, { nullText: "-" })}</span>
                <span className={meterCellClass(5)}>{formatNumber(row.elecPrev, { nullText: "-" })}</span>
                <span className={meterCellClass(6)}>{formatNumber(row.elecCurr, { nullText: "-" })}</span>
                <span className={meterCellClass(7)}>{formatNumber(row.elecUsage, { nullText: "-" })}</span>
                <span className={meterCellClass(8)}>{formatNumber(row.gasPrev, { nullText: "-" })}</span>
                <span className={meterCellClass(9)}>{formatNumber(row.gasCurr, { nullText: "-" })}</span>
                <span className={meterCellClass(10)}>{formatNumber(row.monthTotal, { nullText: "-" })}</span>
                <span className={meterCellClass(11)}>{row.paidAt?.replaceAll("-", ".") ?? "-"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
