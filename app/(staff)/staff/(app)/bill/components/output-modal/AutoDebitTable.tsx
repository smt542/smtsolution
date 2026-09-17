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

// Figma 열 너비(1020px 기준 px)를 비율로 옮겨, 세로 스크롤바가 생겨도 가로 스크롤 없이 모달 폭을 채운다.
const COLUMNS =
  "grid-cols-[minmax(0,28fr)_minmax(0,81fr)_minmax(0,107fr)_minmax(0,86fr)_minmax(0,129fr)_minmax(0,86fr)_minmax(0,65fr)_minmax(0,147fr)_minmax(0,81fr)_minmax(0,78fr)_minmax(0,51fr)_minmax(0,81fr)]";
// 셀 높이 24px = leading + border. 좌측 첫 칸에만 border-l을 둬 표 바깥선을 만든다.
const CELL =
  "[&>span]:block [&>span]:truncate [&>span]:border-b [&>span]:border-r [&>span]:border-[#e5e8eb] [&>span]:px-[7px] [&>span:first-child]:border-l";
const GROUP_BUTTON = "rounded-[7px] px-[11px] py-[5px] text-[12px] font-bold leading-[15px]";
const GROUPS = [
  { value: 0, label: "부과 그룹 전체" },
  ...[1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) })),
];

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

  return (
    <main className="min-h-0 flex-1 overflow-hidden bg-white">
      <div className="flex h-[60px] items-center gap-[8px] border-b border-[#f1f3f5] px-[16px]">
        <SmallSelect ariaLabel="출력 연도" value={String(year)} onChange={(event) => onYearChange(Number(event.target.value))} className="w-[88px]">
          {years.map((value) => <option key={value} value={value}>{value}년</option>)}
        </SmallSelect>
        <SmallSelect ariaLabel="월분" value={String(month)} onChange={(event) => onMonthChange(Number(event.target.value))} className="w-[74px]">
          {months.map((value) => <option key={value} value={value}>{value}월분</option>)}
        </SmallSelect>
        <div className="flex h-[33px] items-center gap-[2px] rounded-[9px] border border-[#e8ebee] bg-white p-[3px]">
          {GROUPS.map(({ value, label }) => (
            <button key={value} type="button" onClick={() => onGroupChange(value)} className={`${GROUP_BUTTON} ${group === value ? "bg-[#f2f4f6] text-[#191f28]" : "text-[#8b95a1]"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="h-[470px] overflow-auto">
        <div className={`sticky top-0 z-10 grid h-[24px] ${COLUMNS} ${CELL} bg-[#f2f4f6] text-[10.5px] font-bold text-[#4e5968] [&>span]:border-t [&>span]:leading-[22px]`}>
          <span aria-hidden="true" className="bg-[#f7f9fa]" /><span>청구타입</span><span>회원번호</span><span>계약번호</span><span>회원명</span><span>청구월</span><span>약정일</span><span>결제일(결제시작일)</span><span>상품</span><span>기본금액</span><span>수량</span><span>회원구분</span>
        </div>
        {visibleRows.map(({ building, target }, index) => {
          const cells = deriveAutoDebitCells(building, target, year, month);
          return (
            <div key={`${building.id}-${target.unitId}`} className={`grid h-[24px] ${COLUMNS} ${CELL} text-[11px] font-medium text-[#191f28] hover:bg-[#f8fbfb] [&>span]:leading-[23px]`}>
              <span className="bg-[#f7f9fa] text-center text-[10px] font-bold text-[#b0b8c1]">{index + 1}</span>
              <span>{cells.billType}</span>
              <span className="num">{cells.memberNo}</span>
              <span className="num">{cells.contractNo}</span>
              <span>{cells.memberName}</span>
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
