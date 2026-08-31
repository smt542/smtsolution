import type { BillDocument } from "@/hooks/reactquery/bill";

export interface StatementRow {
  unitId: number;
  unitNo: string;
  tenantName: string | null;
  cells: number[];
  total: number;
}

export interface ChargeStatement {
  feeItemIds: number[];
  feeNames: string[];
  rows: StatementRow[];
  totals: number[];
  grandTotal: number;
}

/** 확정 부과 문서들을 세대(행)×관리비 항목(열) 부과내역서 표로 정규화한다. */
export function buildChargeStatement(documents: BillDocument[]): ChargeStatement {
  const order: number[] = [];
  const names = new Map<number, string>();
  for (const doc of documents) {
    for (const item of doc.items) {
      if (!item.charged) continue;
      if (!names.has(item.feeItemId)) {
        names.set(item.feeItemId, item.name);
        order.push(item.feeItemId);
      }
    }
  }
  const rows = documents
    .map((doc) => {
      const byId = new Map(
        doc.items.filter((item) => item.charged).map((item) => [item.feeItemId, item.amount]),
      );
      const cells = order.map((id) => byId.get(id) ?? 0);
      const summed = cells.reduce((sum, value) => sum + value, 0);
      return {
        unitId: doc.unitId,
        unitNo: doc.unitNo,
        tenantName: doc.tenantName,
        cells,
        total: Number.isFinite(doc.totalAmount) && doc.totalAmount ? doc.totalAmount : summed,
      };
    })
    .sort((a, b) => a.unitNo.localeCompare(b.unitNo, "ko-KR", { numeric: true }));
  const totals = order.map((_, index) => rows.reduce((sum, row) => sum + row.cells[index], 0));
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  return { feeItemIds: order, feeNames: order.map((id) => names.get(id) ?? "관리비"), rows, totals, grandTotal };
}

/** 배열을 size 단위 페이지로 자른다(빈 배열이면 페이지 0개). */
export function paginate<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}
