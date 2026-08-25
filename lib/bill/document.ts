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

// ===== 팩스 문서 서버 데이터 계약 (load_fax_document RPC → 렌더러) =====
/** load_fax_document RPC가 반환하는 원시 행(스네이크 케이스). */
export interface FaxDocumentRow {
  bill_issue_id: number;
  org_id: number;
  company_name: string | null;
  building: { id: number; name: string; address: string | null };
  unit_id: number;
  unit_no: string;
  dong: string | null;
  period: string;
  tenant_name: string | null;
  payer_name: string | null;
  payer_no: string | null;
  bill_name_display: BillNameDisplay;
  phone: string | null;
  fax_number: string | null;
  auto_debit: boolean;
  amount: number;
  items: BillItem[] | null;
  unit_notice: string | null;
  customer_notice: string | null;
  due_date: string | null;
  mgmt_bank1: string | null; mgmt_acct1: string | null; mgmt_holder1: string | null; mgmt_print1: boolean;
  mgmt_bank2: string | null; mgmt_acct2: string | null; mgmt_holder2: string | null; mgmt_print2: boolean;
}

/** 팩스 PDF 렌더러가 사용하는 정규화된 문서 데이터. GiroPrintView와 동일한 핵심 값을 담는다. */
export interface FaxDocumentData {
  billIssueId: number;
  orgId: number;
  companyName: string;
  building: { id: number; name: string; address: string | null };
  unitId: number;
  unitNo: string;
  dong: string | null;
  period: string;
  householdName: string;
  phone: string | null;
  faxNumber: string | null;
  autoDebit: boolean;
  amount: number;
  items: BillItem[];
  accounts: PrintableAccount[];
  customerNotice: string | null;
  unitNotice: string | null;
  dueDate: string | null;
  qrPayload: string;
}

/** 서버 원시 행을 렌더러 계약으로 변환한다. 금액/계좌/이름은 서버 값만 사용한다(클라이언트 불신뢰). */
export function buildFaxDocument(row: FaxDocumentRow): FaxDocumentData {
  const items = (row.items ?? []).filter((item) => item.charged);
  const accounts = printableAccounts({
    mgmtBank1: row.mgmt_bank1, mgmtAcct1: row.mgmt_acct1, mgmtHolder1: row.mgmt_holder1, mgmtPrint1: row.mgmt_print1,
    mgmtBank2: row.mgmt_bank2, mgmtAcct2: row.mgmt_acct2, mgmtHolder2: row.mgmt_holder2, mgmtPrint2: row.mgmt_print2,
  });
  return {
    billIssueId: row.bill_issue_id,
    orgId: row.org_id,
    companyName: row.company_name?.trim() || PROGRAM_COMPANY_NAME,
    building: row.building,
    unitId: row.unit_id,
    unitNo: row.unit_no,
    dong: row.dong,
    period: row.period,
    householdName: unitLabel(row.bill_name_display, row.unit_no, row.tenant_name, row.payer_name, row.payer_no),
    phone: row.phone,
    faxNumber: row.fax_number,
    autoDebit: row.auto_debit,
    amount: giroDocumentAmount({ totalAmount: row.amount, items }),
    items,
    accounts,
    customerNotice: row.customer_notice,
    unitNotice: row.unit_notice,
    dueDate: row.due_date,
    qrPayload: buildOutputQrPayload("giro", row.unit_id, row.period),
  };
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
