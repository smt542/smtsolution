"use client";

import { useState } from "react";
import { CalendarIcon, ChevronDownIcon } from "@/components/icons";
import { useSettlementList } from "@/hooks/reactquery/movingSettlement";

function initialMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string): { from: string; to: string } {
  const [year, value] = month.split("-").map(Number);
  const lastDay = new Date(year, value, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function SettlementHistory({
  buildingId,
  selectedUnitId = null,
  onSelectUnit = () => undefined,
}: {
  buildingId: number | null;
  selectedUnitId?: number | null;
  onSelectUnit?: (unitId: number) => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const range = monthRange(month);
  const query = useSettlementList(buildingId, range.from, range.to);
  const rows = query.data ?? [];

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="shrink-0 px-[18px] pb-[9px] pt-[15px]">
        <div className="flex h-[20px] items-center gap-[10px]">
          <h2 className="text-[15px] font-extrabold text-t1">이사정산 이력 조회</h2>
          <span className="ml-auto rounded-[8px] bg-teal-t px-[8px] py-[3px] text-[12px] font-bold text-teal-d">
            총 {rows.length}건
          </span>
        </div>
        <label className="relative mt-[9px] flex h-[34px] items-center rounded-[9px] border border-line bg-white px-[10px]">
          <CalendarIcon className="size-[15px] shrink-0 text-t3" />
          <input
            aria-label="이사정산 이력 월"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="min-w-0 flex-1 appearance-none bg-transparent px-[7px] text-[13px] font-bold text-t1 outline-none"
          />
          <ChevronDownIcon className="size-[14px] shrink-0 text-t3" />
        </label>
      </div>
      <div className="grid h-[37px] shrink-0 grid-cols-[32px_44px_54px_84px_1fr] border-y border-line bg-[#fbfcfd] text-[12px] font-bold text-t3">
        <span className="px-[8px] py-[11px]">No</span>
        <span className="px-[8px] py-[11px]">코드</span>
        <span className="px-[8px] py-[11px]">호수</span>
        <span className="px-[8px] py-[11px]">건물명</span>
        <span className="px-[8px] py-[11px]">상태</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {buildingId === null && (
          <p className="px-[18px] py-[14px] text-[12.5px] leading-[20px] text-t4">
            건물을 선택하면
            <br />
            이사정산 이력이 표시돼요
          </p>
        )}
        {buildingId !== null && query.isLoading && (
          <p className="px-[18px] py-[14px] text-[12.5px] text-t4">
            이력을 불러오는 중입니다.
          </p>
        )}
        {buildingId !== null && query.error && (
          <p className="px-[18px] py-[14px] text-[12.5px] text-red">
            이사정산 이력을 불러오지 못했습니다.
          </p>
        )}
        {buildingId !== null && !query.isLoading && !query.error && rows.length === 0 && (
          <p className="px-[18px] py-[14px] text-[12.5px] text-t4">
            선택한 달의 이사정산 이력이 없습니다.
          </p>
        )}
        {rows.map((row, index) => (
          <button
            key={row.settlementId}
            type="button"
            onClick={() => onSelectUnit(row.unitId)}
            className={`grid min-h-[41px] w-full grid-cols-[32px_44px_54px_84px_1fr] border-b border-line2 text-left text-[12.5px] text-t1 hover:bg-teal-t ${selectedUnitId === row.unitId ? "bg-teal-t" : ""}`}
          >
            <span className="px-[8px] py-[12px]">{index + 1}</span>
            <span className="px-[8px] py-[12px]">{String(row.unitId).padStart(3, "0")}</span>
            <span className="truncate px-[8px] py-[12px]">{row.unitNo}</span>
            <span className="truncate px-[8px] py-[12px] font-bold">{row.tenantName ?? "공실"}</span>
            <span className="truncate px-[8px] py-[12px]">{row.status === "completed" ? "퇴실완료" : row.status === "mid_moveout" ? "중도퇴실" : "작성중"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
