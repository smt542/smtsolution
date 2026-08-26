export interface ParsedSheet { headers: string[]; rows: string[][]; }
export interface ColumnMapping { customerNo: number | null; name: number | null; amount: number | null; paidAt: number | null; }
export interface Deposit { customerNo: string; name: string; amount: number; paidAt: string | null; rowIndex: number; }

const cell = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "object" && "text" in (v as Record<string, unknown>)) return String((v as { text: unknown }).text ?? "");
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

export async function parseBankWorkbook(buffer: ArrayBuffer): Promise<ParsedSheet> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };
  const matrix: string[][] = [];
  ws.eachRow((row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    matrix.push(values.map(cell));
  });
  const [headers = [], ...rows] = matrix;
  return { headers, rows };
}

const HEADER_HINTS: Record<keyof ColumnMapping, string[]> = {
  customerNo: ["고객번호", "회원번호", "수용가", "고객"],
  name: ["입금자", "성명", "이름", "예금주", "보낸분"],
  amount: ["금액", "입금액", "입금", "amount"],
  paidAt: ["입금일", "거래일", "일자", "date"],
};

export function guessColumns(headers: string[]): ColumnMapping {
  const find = (hints: string[]) => {
    const normalizedHeaders = headers.map((h) => h.replace(/\s/g, ""));
    const exact = normalizedHeaders.findIndex((h) => hints.includes(h));
    const i = exact >= 0
      ? exact
      : normalizedHeaders.findIndex((h) => hints.some((k) => h.includes(k)));
    return i >= 0 ? i : null;
  };
  return {
    customerNo: find(HEADER_HINTS.customerNo),
    name: find(HEADER_HINTS.name),
    amount: find(HEADER_HINTS.amount),
    paidAt: find(HEADER_HINTS.paidAt),
  };
}

export function parseAmount(raw: string): number {
  const neg = /^\s*\(.*\)\s*$/.test(raw);
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return neg ? -Math.round(n) : Math.round(n);
}

const at = (row: string[], i: number | null) => (i == null ? "" : (row[i] ?? "").trim());

export function toDeposits(rows: string[][], mapping: ColumnMapping): Deposit[] {
  const out: Deposit[] = [];
  rows.forEach((row, rowIndex) => {
    const customerNo = at(row, mapping.customerNo);
    const name = at(row, mapping.name);
    const amount = parseAmount(at(row, mapping.amount));
    const paidAtRaw = at(row, mapping.paidAt);
    if (!customerNo && !name && amount === 0) return; // 빈행
    out.push({ customerNo, name, amount, paidAt: paidAtRaw || null, rowIndex });
  });
  return out;
}
