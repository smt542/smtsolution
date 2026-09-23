import type { BillDocument } from "@/hooks/reactquery/bill";
import type { Building } from "@/hooks/reactquery/buildings";
import type { FeeItem } from "@/hooks/reactquery/feeItems";
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { compareUnitNo, unitLabel } from "./cardSheet";

/** 부과내역서 한 쪽의 세대 수(정본 STMT_ROWS). */
export const STATEMENT_UNITS_PER_PAGE = 14;
/** 정본 SG는 6열 고정 — 항목이 적어도 6열 폭을 유지한다(D4). */
export const STATEMENT_MIN_GROUPS = 6;

export interface StatementCell {
  amount: string;
  flag: "Y" | "N" | "";
}
export interface StatementUnitLine {
  key: string;
  unitNo: string;
  /** rows[행 0~2][열 g] */
  rows: StatementCell[][];
  /** [전기, 수도] */
  previous: [string, string];
  current: [string, string];
}
export interface StatementSheetPage {
  key: string;
  building: Building;
  /** 열마다 항목 이름 3개(빈 슬롯은 ""). */
  groups: string[][];
  units: StatementUnitLine[];
  pageIndex: number;
  pageCount: number;
}

const reading = (value: number | null | undefined) => (value == null ? "" : String(value));

/** 세대별 첫 번째 검침 행(D6). */
function firstRowByUnit(rows: UtilityUnitRow[]): Map<number, UtilityUnitRow> {
  const map = new Map<number, UtilityUnitRow>();
  for (const row of rows) if (!map.has(row.unitId)) map.set(row.unitId, row);
  return map;
}

/** 건물 1곳의 부과내역서 쪽들(확정 세대만, 쪽당 14세대, 확정이 없으면 0쪽 — D3). */
export function buildStatementSheetPages(
  building: Building,
  documents: BillDocument[],
  feeItems: FeeItem[],
  elecRows: UtilityUnitRow[],
  waterRows: UtilityUnitRow[],
): StatementSheetPage[] {
  if (documents.length === 0) return [];
  // 건물 유형 항목(설정 순서). 설정에서 지워졌지만 스냅샷에 남은 항목은 뒤에 붙인다.
  const ordered = [...feeItems]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((item) => ({ id: item.id, name: item.name }));
  const known = new Set(ordered.map((item) => item.id));
  for (const doc of documents) {
    for (const item of doc.items) {
      if (known.has(item.feeItemId)) continue;
      known.add(item.feeItemId);
      ordered.push({ id: item.feeItemId, name: item.name });
    }
  }
  const groupCount = Math.max(STATEMENT_MIN_GROUPS, Math.ceil(ordered.length / 3));
  const slots = Array.from({ length: groupCount * 3 }, (_, index) => ordered[index] ?? null);
  const groups = Array.from({ length: groupCount }, (_, group) =>
    [0, 1, 2].map((row) => slots[group * 3 + row]?.name ?? ""),
  );
  const elec = firstRowByUnit(elecRows);
  const water = firstRowByUnit(waterRows);
  const units = [...documents]
    .sort((a, b) => compareUnitNo(a.unitNo, b.unitNo))
    .map((doc): StatementUnitLine => {
      const byItem = new Map(doc.items.map((item) => [item.feeItemId, item]));
      const rows = [0, 1, 2].map((row) =>
        Array.from({ length: groupCount }, (_, group): StatementCell => {
          const slot = slots[group * 3 + row];
          if (!slot) return { amount: "", flag: "" };
          const item = byItem.get(slot.id);
          // D5: 확정 스냅샷에 있으면 부과(Y), 건물 항목인데 없으면 미부과(N).
          if (!item || !item.charged) return { amount: "", flag: "N" };
          return { amount: item.amount ? formatNumber(item.amount, { nullText: "" }) : "", flag: "Y" };
        }),
      );
      const e = elec.get(doc.unitId);
      const w = water.get(doc.unitId);
      return {
        key: String(doc.unitId),
        unitNo: unitLabel(doc.unitNo),
        rows,
        previous: [reading(e?.previousReading), reading(w?.previousReading)],
        current: [reading(e?.currentReading), reading(w?.currentReading)],
      };
    });
  const chunks: StatementUnitLine[][] = [];
  for (let index = 0; index < units.length; index += STATEMENT_UNITS_PER_PAGE) {
    chunks.push(units.slice(index, index + STATEMENT_UNITS_PER_PAGE));
  }
  return chunks.map((chunk, index) => ({
    key: `statement-${building.id}-${index}`,
    building,
    groups,
    units: chunk,
    pageIndex: index,
    pageCount: chunks.length,
  }));
}
