// lib/bill/document.ts
export const BILL_QR_PLACEHOLDER_BASE = "https://bill.example.com/apply";
export const PROGRAM_COMPANY_NAME = "관리비서";

export type BillNameDisplay = "none" | "name" | "code";

export function unitLabel(
  mode: BillNameDisplay,
  unitNo: string,
  tenantName: string | null,
  payerName: string | null = null,
  payerNo: string | null = null,
): string {
  if (mode === "none") return "";
  if (mode === "code") return payerNo?.trim() || unitNo;
  return payerName?.trim() || tenantName?.trim() || unitNo;
}

export function buildQrPayload(unitId: number, period: string, base?: string | null): string {
  const b = base && base.trim() ? base : BILL_QR_PLACEHOLDER_BASE;
  return `${b}?unit=${unitId}&period=${period}`;
}

export function buildOutputQrPayload(
  kind: "giro" | "adjustment",
  referenceId: number,
  period: string,
  base?: string | null,
): string {
  const b = base && base.trim() ? base : BILL_QR_PLACEHOLDER_BASE;
  return `${b}?document=${kind}&ref=${referenceId}&period=${period}`;
}

export interface PrintableAccount { bank: string; acct: string; holder: string; }
export interface AccountConfig {
  mgmtBank1?: string | null; mgmtAcct1?: string | null; mgmtHolder1?: string | null; mgmtPrint1?: boolean;
  mgmtBank2?: string | null; mgmtAcct2?: string | null; mgmtHolder2?: string | null; mgmtPrint2?: boolean;
}
export function printableAccounts(config: AccountConfig | null | undefined): PrintableAccount[] {
  if (!config) return [];
  const out: PrintableAccount[] = [];
  if (config.mgmtPrint1 && (config.mgmtBank1 || config.mgmtAcct1))
    out.push({ bank: config.mgmtBank1 ?? "", acct: config.mgmtAcct1 ?? "", holder: config.mgmtHolder1 ?? "" });
  if (config.mgmtPrint2 && (config.mgmtBank2 || config.mgmtAcct2))
    out.push({ bank: config.mgmtBank2 ?? "", acct: config.mgmtAcct2 ?? "", holder: config.mgmtHolder2 ?? "" });
  return out;
}

export interface BillItem { feeItemId: number; name: string; charged: boolean; amount: number; }
export function billDocumentTotal(items: BillItem[]): number {
  return items.reduce((s, i) => (i.charged ? s + i.amount : s), 0);
}

export interface BillAmountSource {
  totalAmount: number;
  items: BillItem[];
}

/** Confirmed billing total is authoritative; item summing is only a malformed-data fallback. */
export function giroDocumentAmount(document: BillAmountSource): number {
  return Number.isFinite(document.totalAmount)
    ? document.totalAmount
    : billDocumentTotal(document.items);
}

export function formatBillAmount(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export interface AdjustmentSource extends BillAmountSource {
  unitId: number;
  unitNo: string;
  dong: string | null;
  tenantName: string | null;
  autoDebit: boolean;
}

export interface AdjustmentLine {
  feeItemId: number;
  name: string;
  previousAmount: number;
  currentAmount: number;
  delta: number;
}

export interface UnitAdjustment {
  unitId: number;
  unitNo: string;
  dong: string | null;
  tenantName: string | null;
  autoDebit: boolean;
  previousTotal: number;
  currentTotal: number;
  totalDelta: number;
  lines: AdjustmentLine[];
}

function chargedItems(source: AdjustmentSource | undefined): Map<number, BillItem> {
  return new Map(
    (source?.items ?? [])
      .filter((item) => item.charged)
      .map((item) => [item.feeItemId, item]),
  );
}

/** Builds a stable per-unit, per-item current-vs-previous confirmed billing diff. */
export function buildAdjustmentRows(
  current: AdjustmentSource[],
  previous: AdjustmentSource[],
): UnitAdjustment[] {
  const currentByUnit = new Map(current.map((document) => [document.unitId, document]));
  const previousByUnit = new Map(previous.map((document) => [document.unitId, document]));
  const unitIds = [...new Set([...currentByUnit.keys(), ...previousByUnit.keys()])];

  return unitIds.map((unitId) => {
    const currentDocument = currentByUnit.get(unitId);
    const previousDocument = previousByUnit.get(unitId);
    const reference = currentDocument ?? previousDocument;
    if (!reference) throw new Error("adjustment document reference is missing");

    const currentItems = chargedItems(currentDocument);
    const previousItems = chargedItems(previousDocument);
    const itemIds = [...new Set([...currentItems.keys(), ...previousItems.keys()])];
    const lines = itemIds.map((feeItemId) => {
      const currentItem = currentItems.get(feeItemId);
      const previousItem = previousItems.get(feeItemId);
      const currentAmount = currentItem?.amount ?? 0;
      const previousAmount = previousItem?.amount ?? 0;
      return {
        feeItemId,
        name: currentItem?.name ?? previousItem?.name ?? "관리비 항목",
        previousAmount,
        currentAmount,
        delta: currentAmount - previousAmount,
      };
    });
    const currentTotal = currentDocument ? giroDocumentAmount(currentDocument) : 0;
    const previousTotal = previousDocument ? giroDocumentAmount(previousDocument) : 0;

    return {
      unitId,
      unitNo: reference.unitNo,
      dong: reference.dong,
      tenantName: reference.tenantName,
      autoDebit: currentDocument?.autoDebit ?? previousDocument?.autoDebit ?? false,
      previousTotal,
      currentTotal,
      totalDelta: currentTotal - previousTotal,
      lines,
    };
  }).sort((a, b) => a.unitNo.localeCompare(b.unitNo, "ko-KR", { numeric: true }));
}
