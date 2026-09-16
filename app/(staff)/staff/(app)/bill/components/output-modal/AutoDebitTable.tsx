"use client";

import type { BillTarget } from "@/hooks/reactquery/bill";
import type { BillBuilding } from "../../types";
import { SmallSelect } from "./OutputModalPrimitives";

interface AutoDebitRow {
  building: BillBuilding;
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

const pad = (value: number, length: number) => String(value).padStart(length, "0");
const displayUnitNo = (unitNo: string) => (unitNo.endsWith("호") ? unitNo : `${unitNo}호`);

// CMS(자동이체) 세대 출력 한 행의 표시값. 화면 표와 인쇄 표가 같은 규칙을 쓰도록 단일 소스로 둔다.
export interface AutoDebitCells {
  billType: string;
  memberNo: string;
  contractNo: string;
  memberName: string;
  billMonth: string;
  agreedDay: string;
  paymentDate: string;
  product: string;
  baseAmount: string;
  quantity: string;
  memberGroup: string;
}

export function deriveAutoDebitCells(building: BillBuilding, target: BillTarget, year: number, month: number): AutoDebitCells {
  const memberNo = target.payerNo || pad(target.unitId, 8);
  const name = target.payerName || target.tenantName;
  const lastDay = new Date(year, month, 0).getDate();
  const paymentDate = target.dueDate ? target.dueDate.replaceAll("-", "") : `${year}${pad(month, 2)}${pad(lastDay, 2)}`;
  const agreedDay = target.dueDate ? String(Number(target.dueDate.slice(-2))) : String(lastDay);
  return {
    billType: "정기청구",
    memberNo,
    contractNo: memberNo.slice(-6),
    memberName: name ? `${name} (${displayUnitNo(target.unitNo)})` : displayUnitNo(target.unitNo),
    billMonth: `${year}${pad(month, 2)}`,
    agreedDay,
    paymentDate,
    product: "기본상품",
    baseAmount: target.totalAmount.toLocaleString("ko-KR"),
    quantity: "1",
    memberGroup: building.name,
  };
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
        <div className={`grid h-[24px] min-w-[1017px] ${columns} sticky top-0 z-10 items-center border-b border-[#dfe3e7] bg-[#f8f9fa] text-[9.5px] font-bold text-[#6b7684] [&>span]:h-full [&>span]:truncate [&>span]:border-r [&>span]:border-[#e3e7ea] [&>span]:pt-[6px] [&>span]:pl-[8px]`}>
          <span aria-hidden="true" className="!pl-0" /><span>청구타입</span><span>회원번호</span><span>계약번호</span><span>회원명</span><span>청구월</span><span>약정일</span><span>결제일(결제시작일)</span><span>상품</span><span>기본금액</span><span>수량</span><span>회원구분</span>
        </div>
        {visibleRows.map(({ building, target }, index) => {
          const cells = deriveAutoDebitCells(building, target, year, month);
          return (
            <div key={`${building.id}-${target.unitId}`} className={`grid h-[24px] min-w-[1017px] ${columns} items-center border-b border-[#e8ebee] text-[9px] text-[#4e5968] hover:bg-[#f8fbfb] [&>span]:h-full [&>span]:truncate [&>span]:border-r [&>span]:border-[#eef0f2] [&>span]:pt-[6px] [&>span]:pl-[8px]`}>
              <span className="!pl-0 text-center text-[#8b95a1]">{index + 1}</span>
              <span>{cells.billType}</span>
              <span className="num">{cells.memberNo}</span>
              <span className="num">{cells.contractNo}</span>
              <span className="font-semibold text-[#333d4b]">{cells.memberName}</span>
              <span className="num">{cells.billMonth}</span>
              <span className="num">{cells.agreedDay}</span>
              <span className="num">{cells.paymentDate}</span>
              <span>{cells.product}</span>
              <span className="num">{cells.baseAmount}</span>
              <span className="num">{cells.quantity}</span>
              <span>{cells.memberGroup}</span>
            </div>
          );
        })}
        {visibleRows.length === 0 && <p className="py-16 text-center text-[12px] text-[#8b95a1]">선택한 월에 자동이체 자료가 없습니다.</p>}
      </div>
    </main>
  );
}
