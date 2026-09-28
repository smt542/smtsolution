export interface ParsedSheet { headers: string[]; rows: string[][]; }
export interface ColumnMapping { customerNo: number | null; name: number | null; amount: number | null; paidAt: number | null; }
export interface Deposit { customerNo: string; name: string; amount: number; paidAt: string | null; rowIndex: number; }

export type DepositFileErrorCode = "unsupported-xls" | "read-failed";

export class DepositFileError extends Error {
  public readonly code: DepositFileErrorCode;

  constructor(
    code: DepositFileErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.code = code;
    this.name = "DepositFileError";
  }
}

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

function parseDelimitedLine(line: string, delimiter: "\t" | ","): string[] {
  const cells: string[] = [];
  let cellValue = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cellValue += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      cells.push(cellValue.trim());
      cellValue = "";
    } else {
      cellValue += character;
    }
  }
  cells.push(cellValue.trim());
  return cells;
}

function parseDelimitedText(text: string): ParsedSheet {
  const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const [headers = [], ...rows] = lines.map((line) => parseDelimitedLine(line, delimiter));
  return { headers, rows };
}

async function decodeDepositText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch (error) {
    try {
      return new TextDecoder("euc-kr").decode(bytes).replace(/^\uFEFF/, "");
    } catch (decodeError) {
      throw new DepositFileError(
        "read-failed",
        "입금내역 파일을 읽지 못했어요",
        { cause: decodeError instanceof Error ? decodeError : error },
      );
    }
  }
}

/** 은행·지로 업로드가 공유하는 파일 판독 진입점. */
export async function parseDepositFile(file: File): Promise<ParsedSheet> {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (extension === ".xls") {
    throw new DepositFileError(
      "unsupported-xls",
      "xls 파일은 xlsx로 저장한 뒤 첨부해 주세요",
    );
  }

  try {
    const buffer = await file.arrayBuffer();
    if (extension === ".xlsx") return parseBankWorkbook(buffer);
    if (extension === ".csv" || extension === ".txt") {
      return parseDelimitedText(await decodeDepositText(buffer));
    }
  } catch (error) {
    if (error instanceof DepositFileError) throw error;
    throw new DepositFileError(
      "read-failed",
      "입금내역 파일을 읽지 못했어요",
      { cause: error },
    );
  }

  throw new DepositFileError("read-failed", "지원하지 않는 입금내역 파일 형식이에요");
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
