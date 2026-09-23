"use client";

import { useMemo } from "react";
import type { BillingColumn, BillingUnitRow } from "@/lib/billing/pivot";
import { BillingTableRow } from "./BillingTableRow";
import {
  chunkTrios,
  EMPTY_UTILITY_ROWS,
  type BillingChargeDraft,
  type BillingNoteDraft,
  type UtilityRowSet,
} from "./billingTableModel";

export type { BillingChargeDraft, BillingNoteDraft, UtilityRowSet } from "./billingTableModel";

interface BillingTableProps {
  units: BillingUnitRow[];
  columns: BillingColumn[];
  period: string;
  editing?: boolean;
  /** 수도·전기·가스 공과금 행. page.tsx의 useUtilityRows 결과를 그대로 전달. */
  utilities?: UtilityRowSet;
  chargeDrafts?: Record<number, Record<number, BillingChargeDraft>>;
  noteDrafts?: Record<number, BillingNoteDraft>;
  onChargeChange: (unitId: number, feeItemId: number, patch: { charged?: boolean; amount?: number }) => void;
  onRowClick: (unitId: number) => void;
  onNoteChange: (unitId: number, patch: Partial<BillingNoteDraft>) => void;
}

const EMPTY_CHARGE_DRAFTS: Record<number, Record<number, BillingChargeDraft>> = {};
const EMPTY_NOTE_DRAFTS: Record<number, BillingNoteDraft> = {};

const HEAD_TH = "border-b border-line bg-[#FBFCFD] px-[8px] py-[11px] text-left text-[12px] font-bold leading-[normal] text-t3 whitespace-nowrap align-middle";

export function BillingTable({
  units,
  columns,
  period,
  editing = true,
  utilities = EMPTY_UTILITY_ROWS,
  chargeDrafts = EMPTY_CHARGE_DRAFTS,
  noteDrafts = EMPTY_NOTE_DRAFTS,
  onChargeChange,
  onRowClick,
  onNoteChange,
}: BillingTableProps) {
  const trios = useMemo(() => chunkTrios(columns), [columns]);

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-separate border-spacing-0 whitespace-nowrap text-[13.5px] [&_tbody_tr:last-child_td]:border-b-0">
        <thead>
          <tr>
            {/* 호수 — 56px sticky left:0 */}
            <th className={`sticky left-0 top-0 z-[4] w-[56px] min-w-[56px] max-w-[56px] ${HEAD_TH}`}>호수</th>
            {/* 총 관리비 — 92px sticky left:56px (2줄) */}
            <th className={`sticky left-[56px] top-0 z-[4] w-[92px] min-w-[92px] max-w-[92px] shadow-[1px_0_0_var(--color-line)] ${HEAD_TH}`}>
              총 관리비<br />건물 관리비<br />고정 관리비
            </th>
            {/* 성명 / 평수·룸타입 / 입주일 */}
            <th className={`sticky top-0 z-[3] min-w-[92px] ${HEAD_TH}`}>성명<br />평수/룸타입<br />입주일</th>
            {/* 수도 / 전기 / 가스 금액 */}
            <th className={`sticky top-0 z-[3] min-w-[78px] ${HEAD_TH}`}>수도금액<br />전기금액<br />가스금액</th>
            {/* 항목 TRIOS */}
            {trios.map((group, groupIndex) => (
              <th key={group[0]?.feeItemId ?? `trio-${groupIndex}`} className={`sticky top-0 z-[3] min-w-[104px] ${HEAD_TH}`}>
                {group.map((column) => (
                  <div key={column.feeItemId} className="text-[12px] font-bold leading-[1.4] text-t3 whitespace-nowrap">
                    {column.name}
                    {column.dailyProration && <span className="ml-[3px] rounded bg-blue-t px-[3px] text-[9px] text-blue-d">일할</span>}
                  </div>
                ))}
                {Array.from({ length: 3 - group.length }).map((_, i) => (
                  <div key={`pad-${i}`} className="text-[12px] leading-[1.4]">&nbsp;</div>
                ))}
              </th>
            ))}
            {/* 참조 / 공지 / 처리일자 */}
            <th className={`sticky top-0 z-[3] min-w-[150px] ${HEAD_TH}`}>부과시 참조사항</th>
            <th className={`sticky top-0 z-[3] min-w-[150px] ${HEAD_TH}`}>부과시 공지사항</th>
            <th className={`sticky top-0 z-[3] min-w-[96px] ${HEAD_TH}`}>처리일자</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <BillingTableRow
              key={unit.unitId}
              unit={unit}
              columns={columns}
              trios={trios}
              period={period}
              editing={editing}
              utilities={utilities}
              chargeDrafts={chargeDrafts[unit.unitId]}
              noteDraft={noteDrafts[unit.unitId]}
              onChargeChange={onChargeChange}
              onRowClick={onRowClick}
              onNoteChange={onNoteChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
