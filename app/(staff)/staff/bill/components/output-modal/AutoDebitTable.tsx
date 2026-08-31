"use client";

import type { Building } from "@/hooks/reactquery/buildings";
import type { BillTarget } from "@/hooks/reactquery/bill";
import { SmallSelect } from "./OutputModalPrimitives";

interface AutoDebitRow {
  building: Building;
  target: BillTarget;
}

interface AutoDebitTableProps {
  year: number;
  month: number;
  years: number[];
  months: number[];
  group: number;
  rows: AutoDebitRow[];
  onYearChange: (value: number) => void;
  onMonthChange: (value: number) => void;
  onGroupChange: (value: number) => void;
}

function paymentDate(target: BillTarget) {
  if (!target.dueDate) return "-";
  return target.dueDate.replaceAll("-", ".");
}

export function AutoDebitTable({ year, month, years, months, group, rows, onYearChange, onMonthChange, onGroupChange }: AutoDebitTableProps) {
  const visibleRows = rows.filter((row, index) => group === 0 || index % 5 === group - 1);
  const columns = "grid-cols-[33px_78px_104px_83px_124px_83px_62px_141px_78px_76px_49px_106px]";

  return (
    <main className="min-h-0 flex-1 overflow-hidden bg-white">
      <div className="flex h-[59px] items-center gap-[6px] border-b border-[#e8ebee] px-[16px]">
        <SmallSelect ariaLabel="출력 연도" value={String(year)} onChange={(event) => onYearChange(Number(event.target.value))} className="w-[88px]">
          {years.map((value) => <option key={value} value={value}>{value}년</option>)}
        </SmallSelect>
        <SmallSelect ariaLabel="월분" value={String(month)} onChange={(event) => onMonthChange(Number(event.target.value))} className="w-[74px]">
          {months.map((value) => <option key={value} value={value}>{value}월분</option>)}
        </SmallSelect>
        <div className="ml-[4px] flex h-[32px] items-center rounded-[9px] border border-[#e8ebee] bg-[#f8f9fa] p-[2px]">
          <button type="button" onClick={() => onGroupChange(0)} className={`h-[26px] rounded-[7px] px-[10px] text-[10.5px] font-bold ${group === 0 ? "bg-white text-[#14a497] shadow-sm" : "text-[#6b7684]"}`}>부과 그룹 전체</button>
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" onClick={() => onGroupChange(value)} className={`size-[26px] rounded-[7px] text-[10.5px] font-bold ${group === value ? "bg-white text-[#14a497] shadow-sm" : "text-[#6b7684]"}`}>{value}</button>
          ))}
        </div>
      </div>
      <div className="h-[471px] overflow-auto">
        <div className={`grid h-[24px] min-w-[1017px] ${columns} sticky top-0 z-10 items-center border-b border-[#dfe3e7] bg-[#f8f9fa] text-[9.5px] font-bold text-[#6b7684] [&>span]:h-full [&>span]:border-r [&>span]:border-[#e3e7ea] [&>span]:pt-[6px]`}>
          <span className="text-center">#</span><span>청구타입</span><span>회원번호</span><span>계약번호</span><span>회원명</span><span>청구월</span><span>약정일</span><span>결제일</span><span>상품</span><span className="text-right">기본금액</span><span className="text-center">수량</span><span className="pl-2">회원구분</span>
        </div>
        {visibleRows.map(({ building, target }, index) => (
          <div key={`${building.id}-${target.unitId}`} className={`grid h-[24px] min-w-[1017px] ${columns} items-center border-b border-[#e8ebee] text-[9px] text-[#4e5968] hover:bg-[#f8fbfb] [&>span]:h-full [&>span]:border-r [&>span]:border-[#eef0f2] [&>span]:pt-[6px]`}>
            <span className="text-center text-[#8b95a1]">{index + 1}</span>
            <span>자동이체</span>
            <span className="num truncate">{target.payerNo || String(target.unitId).padStart(8, "0")}</span>
            <span className="num truncate">{building.code}-{target.unitNo}</span>
            <span className="truncate font-semibold text-[#333d4b]">{target.payerName || target.tenantName || "-"}</span>
            <span className="num">{year}.{String(month).padStart(2, "0")}</span>
            <span className="text-center">말일</span>
            <span className="num truncate">{paymentDate(target)}</span>
            <span>관리비</span>
            <span className="num text-right">{target.totalAmount.toLocaleString("ko-KR")}</span>
            <span className="text-center">1</span>
            <span className="truncate pl-2">{target.autoDebit ? "자동이체" : "일반"}</span>
          </div>
        ))}
        {visibleRows.length === 0 && <p className="py-16 text-center text-[12px] text-[#8b95a1]">선택한 월에 자동이체 자료가 없습니다.</p>}
      </div>
    </main>
  );
}
