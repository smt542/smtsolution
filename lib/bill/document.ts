// lib/bill/document.ts
export const BILL_QR_PLACEHOLDER_BASE = "https://bill.example.com/apply";
export const PROGRAM_COMPANY_NAME = "관리비서";

export function unitLabel(mode: "code" | "name", unitNo: string, tenantName: string | null): string {
  if (mode === "name" && tenantName && tenantName.trim()) return tenantName;
  return unitNo;
}

export function buildQrPayload(unitId: number, period: string, base?: string | null): string {
  const b = base && base.trim() ? base : BILL_QR_PLACEHOLDER_BASE;
  return `${b}?unit=${unitId}&period=${period}`;
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
