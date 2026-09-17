"use client";

import { useState } from "react";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CalendarIcon, ChevronDownIcon } from "@/components/icons";
import { useSettlementInquiry } from "@/hooks/reactquery/movingSettlement";

export function SettlementHistory({
  selectedBuildingId = null,
  selectedUnitId = null,
  onSelect = () => undefined,
}: {
  selectedBuildingId?: number | null;
  selectedUnitId?: number | null;
  onSelect?: (buildingId: number, unitId: number) => void;
}) {
  const [date, setDate] = useState("");
  const query = useSettlementInquiry({
    type: "all",
    from: date,
    to: date,
    sort: "date",
    pageSize: 100,
  });
  const rows = date ? (query.data?.rows ?? []) : [];
  const isSettlementHistoryRefreshing = query.isFetching && !query.isLoading;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="shrink-0 px-[18px] pt-[15px]">
        <div className="flex h-[18px] items-center gap-[10px]">
          <h2 className="text-[15px] font-extrabold leading-[18px] text-t1">이사정산 이력 조회</h2>
          {date !== "" && (
            <span className="ml-auto rounded-[7px] bg-blue-t px-[8px] py-[3px] text-[11.5px] font-extrabold text-blue-d">
              총 {rows.length}건
            </span>
          )}
          {date !== "" && isSettlementHistoryRefreshing ? (
            <span role="status" aria-label="이사정산 이력 갱신 중" className="text-[11.5px] font-bold text-t3">갱신 중…</span>
          ) : null}
        </div>
        <div className="mt-[9px]">
          <DpDatePicker
            ariaLabel="이사정산 이력 날짜"
            value={date}
            onChange={setDate}
            placeholder="날짜 선택"
            className="w-full"
            triggerClassName="flex h-[34px] w-full cursor-pointer items-center gap-[7px] rounded-[9px] border border-line bg-white px-[10px] text-[13px] font-bold text-t1 outline-none [&>span]:min-w-0 [&>span]:flex-1 [&>span]:text-left"
            triggerOpenClassName="!border-teal ring-[3px] ring-teal-t"
            startAdornment={<CalendarIcon className="size-[15px] shrink-0 text-t3" aria-hidden="true" />}
            endAdornment={<ChevronDownIcon className="size-[14px] shrink-0 text-t3" aria-hidden="true" />}
          />
        </div>
      </div>
      <div className="mt-[12px] grid h-[37px] shrink-0 grid-cols-[32px_44px_54px_84px_1fr] border-y border-line bg-[#fbfcfd] text-[12px] font-bold text-t3">
        <span className="py-[11px] pl-[16px] pr-[8px] text-right">No</span>
        <span className="px-[8px] py-[11px]">코드</span>
        <span className="px-[8px] py-[11px]">호수</span>
        <span className="px-[8px] py-[11px]">건물명</span>
        <span className="py-[11px] pl-[8px] pr-[16px]">주소</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {date === "" && (
          <p className="px-[18px] py-[14px] text-[12.5px] font-medium leading-[1.6] text-t4">
            날짜를 선택하면
            <br />
            해당일 이사정산 이력이 표시돼요
          </p>
        )}
        {date !== "" && query.isLoading && (
          <p role="status" aria-label="이사정산 이력 불러오는 중" className="px-[18px] py-[14px] text-[12.5px] text-t4">
            이력을 불러오고 있어요
          </p>
        )}
        {date !== "" && query.error && (
          <p role="alert" className="px-[18px] py-[14px] text-[12.5px] text-red">
            이사정산 이력을 불러오지 못했어요
          </p>
        )}
        {date !== "" && !query.isLoading && !query.error && rows.length === 0 && (
          <p className="px-[12px] py-[26px] text-center text-[12.5px] leading-[1.6] text-t4">
            이 날짜에 작성된 이사정산이 없어요
          </p>
        )}
        {rows.map((row, index) => {
          const on =
            selectedBuildingId === row.buildingId && selectedUnitId === row.unitId;
          return (
            <button
              key={row.settlementId}
              type="button"
              onClick={() => onSelect(row.buildingId, row.unitId)}
              className={`grid min-h-[41px] w-full grid-cols-[32px_44px_54px_84px_1fr] border-b border-line2 text-left text-[13.5px] text-t1 hover:bg-[#fbfcfd] ${on ? "bg-blue-t2" : ""}`}
            >
              <span className="py-[12px] pl-[16px] pr-[8px] text-right tabular-nums">
                {index + 1}
              </span>
              <span className="truncate px-[8px] py-[12px] tabular-nums">{row.buildingCode}</span>
              <span className="truncate px-[8px] py-[12px]">{row.unitNo}</span>
              <span className="truncate px-[8px] py-[12px] font-medium">{row.buildingName}</span>
              <span className="truncate py-[12px] pl-[8px] pr-[16px]">
                {row.buildingAddress ?? "-"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
