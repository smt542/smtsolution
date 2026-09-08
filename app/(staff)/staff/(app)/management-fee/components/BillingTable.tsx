"use client";

import type { BillingColumn, BillingUnitRow } from "@/lib/billing/pivot";
import { BillingTableRow } from "./BillingTableRow";
import { groupBillingColumns, type BillingChargeDraft, type BillingNoteDraft } from "./billingTableModel";

export type { BillingChargeDraft, BillingNoteDraft } from "./billingTableModel";

interface BillingTableProps {
  units: BillingUnitRow[];
  columns: BillingColumn[];
  period: string;
  editing?: boolean;
  chargeDrafts?: Record<number, Record<number, BillingChargeDraft>>;
  noteDrafts?: Record<number, BillingNoteDraft>;
  onChargeChange: (unitId: number, feeItemId: number, patch: { charged?: boolean; amount?: number }) => void;
  onRowClick: (unitId: number) => void;
  onNoteClick: (unitId: number) => void;
}

const EMPTY_CHARGE_DRAFTS: Record<number, Record<number, BillingChargeDraft>> = {};
const EMPTY_NOTE_DRAFTS: Record<number, BillingNoteDraft> = {};

export function BillingTable({ units, columns, period, editing = true, chargeDrafts = EMPTY_CHARGE_DRAFTS, noteDrafts = EMPTY_NOTE_DRAFTS, onChargeChange, onRowClick, onNoteClick }: BillingTableProps) {
  const groups = groupBillingColumns(columns);
  const orderedColumns = groups.flatMap((group) => group.columns);
  return (
    <div className="h-full overflow-auto">
      <table className="min-w-max border-separate border-spacing-0">
        <thead className="sticky top-0 z-10 bg-[#fbfcfd] text-[11px] font-bold text-t3">
          <tr className="h-[29px]">
            <th rowSpan={2} className="sticky left-0 z-20 w-[68px] border-b border-r border-line bg-[#fbfcfd]">호수</th>
            <th rowSpan={2} className="w-[95px] border-b border-r border-line bg-[#fbfcfd]">총 관리비</th>
            <th rowSpan={2} className="w-[150px] border-b border-r border-line bg-[#fbfcfd]">성명 / 평수 / 룸타입 / 입주일</th>
            {groups.map((group) => <th key={group.label} colSpan={group.columns.length} className="border-b border-r border-line bg-[#fbfcfd] text-t2">{group.label}</th>)}
            <th rowSpan={2} className="w-[116px] border-b border-r border-line bg-[#fbfcfd]">부과시 참조사항</th>
            <th rowSpan={2} className="w-[116px] border-b border-r border-line bg-[#fbfcfd]">부과시 공지사항</th>
            <th rowSpan={2} className="w-[92px] border-b border-line bg-[#fbfcfd]">처리일자</th>
          </tr>
          <tr className="h-[34px]">
            {orderedColumns.map((column) => (
              <th key={column.feeItemId} className="min-w-[100px] border-b border-r border-line bg-[#fbfcfd] px-[7px]">
                {column.name}{column.dailyProration && <span className="ml-[3px] rounded bg-blue-t px-[3px] text-[9px] text-blue-d">일할</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <BillingTableRow key={unit.unitId} unit={unit} columns={orderedColumns} period={period} editing={editing} chargeDrafts={chargeDrafts[unit.unitId]} noteDraft={noteDrafts[unit.unitId]} onChargeChange={onChargeChange} onRowClick={onRowClick} onNoteClick={onNoteClick} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
