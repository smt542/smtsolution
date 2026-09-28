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

// 힌트 순서가 우선순위다(머리글이 정확히 같은 힌트를 앞에서부터 찾는다).
// 업로드 양식(public/templates/bank-deposit-upload-form.xlsx)은 순번·고객번호·거래일시·출금금액·
// 입금금액·거래후잔액·거래내용·거래기록사항·거래점·거래메모이고, 입금자 이름은 은행 거래내역처럼 거래내용에 찍힌다.
const HEADER_HINTS: Record<keyof ColumnMapping, string[]> = {
  customerNo: ["고객번호", "회원번호", "수용가", "고객"],
  name: ["입금자", "입금자명", "성명", "이름", "예금주", "보낸분", "거래내용", "적요"],
  amount: ["입금금액", "입금액", "금액", "입금", "amount"],
  paidAt: ["입금일", "거래일시", "거래일", "일자", "date"],
};
// 부분 일치로 찾을 때 건너뛸 머리글 — 금액 힌트 '금액'이 앞쪽의 출금·잔액 칸에 걸리지 않게.
const EXCLUDE_HINTS: Partial<Record<keyof ColumnMapping, string[]>> = {
  amount: ["출금", "잔액", "찾으신"],
};

export function guessColumns(headers: string[]): ColumnMapping {
  const normalizedHeaders = headers.map((h) => h.replace(/\s/g, ""));
  const find = (key: keyof ColumnMapping) => {
    const hints = HEADER_HINTS[key];
    const exclude = EXCLUDE_HINTS[key] ?? [];
    for (const hint of hints) {
      const exact = normalizedHeaders.indexOf(hint);
      if (exact >= 0) return exact;
    }
    const i = normalizedHeaders.findIndex(
      (h) => !exclude.some((x) => h.includes(x)) && hints.some((k) => h.includes(k)),
    );
    return i >= 0 ? i : null;
  };
  return {
    customerNo: find("customerNo"),
    name: find("name"),
    amount: find("amount"),
    paidAt: find("paidAt"),
  };
}

// 은행 거래일시(`2026/07/08 06:51:49`)·점 표기(`2026.07.08`)는 날짜만 `YYYY-MM-DD`로 맞춘다
// (이미 반영된 입금과의 중복 비교가 `YYYY-MM-DD` 문자열이다). 모양이 다른 값은 그대로 둔다.
const normalizePaidAt = (raw: string) => {
  const m = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : raw;
};

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
    out.push({ customerNo, name, amount, paidAt: paidAtRaw ? normalizePaidAt(paidAtRaw) : null, rowIndex });
  });
  return out;
}
