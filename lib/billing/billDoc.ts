import type { SetupConfig } from "@/hooks/reactquery/setupConfig/apis";
import type { BillingColumn, BillingUnitRow } from "./pivot";
import { unitTotal } from "./total";

export interface BillDocOptions {
  labelMode: "code" | "name";
  dueDate?: string;
  showCutoff?: boolean;
}

export interface BillLine {
  name: string;
  amount: number;
}

export interface BillAccount {
  bank: string;
  acct: string;
  holder: string;
}

export interface BillDocument {
  unitId: number;
  title: string;
  unitNo: string;
  tenantName: string | null;
  period: string;
  dueDate: string | null;
  lines: BillLine[];
  total: number;
  accounts: BillAccount[];
  showCutoff: boolean;
  qrValue: string;
}

function printableAccounts(config: SetupConfig | null): BillAccount[] {
  if (!config) return [];

  const accounts: BillAccount[] = [];
  if (config.mgmtPrint1 && config.mgmtBank1 && config.mgmtAcct1) {
    accounts.push({
      bank: config.mgmtBank1,
      acct: config.mgmtAcct1,
      holder: config.mgmtHolder1 ?? "",
    });
  }
  if (config.mgmtPrint2 && config.mgmtBank2 && config.mgmtAcct2) {
    accounts.push({
      bank: config.mgmtBank2,
      acct: config.mgmtAcct2,
      holder: config.mgmtHolder2 ?? "",
    });
  }
  return accounts;
}

export function buildBillDocument(
  unit: BillingUnitRow,
  columns: BillingColumn[],
  config: SetupConfig | null,
  period: string,
  options: BillDocOptions,
): BillDocument {
  const activeColumns = columns.filter(
    (column) => unit.charges[column.feeItemId]?.charged === true,
  );
  const lines = activeColumns.map((column) => ({
    name: column.name,
    amount: unit.charges[column.feeItemId]!.amount,
  }));
  const computedTotal = unitTotal(
    activeColumns.map((column) => ({
      charged: true,
      amount: unit.charges[column.feeItemId]!.amount,
      dailyProration: column.dailyProration,
      rounding: column.rounding,
    })),
    unit.moveInDate,
    period,
  );

  return {
    unitId: unit.unitId,
    title:
      options.labelMode === "code" ? unit.unitNo : (unit.tenantName?.trim() || unit.unitNo),
    unitNo: unit.unitNo,
    tenantName: unit.tenantName,
    period,
    dueDate: options.dueDate ?? null,
    lines,
    total: unit.totalAmount ?? computedTotal,
    accounts: printableAccounts(config),
    showCutoff: options.showCutoff ?? false,
    qrValue: `bill:${unit.unitId}:${period}`,
  };
}
