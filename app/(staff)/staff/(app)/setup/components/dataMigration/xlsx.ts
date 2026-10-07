// 데이터 이관 엑셀(.xlsx) 양식 생성 · 읽기.
//
// 양식은 허용 값이 정해진 열(enm — 업체 구분처럼 협력업체 분류에서 온 값 포함)에 엑셀 드롭다운
// (데이터 유효성 검사, 목록 밖 값 입력 차단)을 건다. 목록은 숨김 시트 「목록」에 두어 길이 제한이 없다.
// 모든 칸을 텍스트 서식으로 두어 010 전화번호·001 건물 코드의 앞자리 0이 사라지지 않게 한다.
// exceljs는 무거워 버튼을 누를 때만 불러온다(dynamic import).
import type { Workbook, Worksheet } from "exceljs";
import type { EntitySchema } from "./schemas";

const DATA_SHEET = "양식";
const LIST_SHEET = "목록";
/** 드롭다운·텍스트 서식을 미리 걸어 둘 데이터 행 수. */
const PREPARED_ROWS = 2000;

type RangeValidations = {
  dataValidations: { add(range: string, validation: Record<string, unknown>): void };
};

async function newWorkbook(): Promise<Workbook> {
  const ExcelJS = (await import("exceljs")).default;
  return new ExcelJS.Workbook();
}

function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** 열 이름 행 + 데이터 행을 쓰고, 열거 열에 드롭다운을 건다. extraHeaders는 끝에 붙는 안내 열(예: 오류 사유). */
function fillSheet(
  wb: Workbook,
  schema: EntitySchema,
  rows: string[][],
  extraHeaders: string[] = [],
): Worksheet {
  const ws = wb.addWorksheet(DATA_SHEET, { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = schema.cols.map((c) => c.k).concat(extraHeaders);
  ws.columns = headers.map((h, i) => ({
    header: h,
    key: `c${i}`,
    width: Math.min(Math.max(h.length * 2 + 4, 12), 40),
    style: { numFmt: "@" },
  }));
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };
  schema.cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.req ? "FFFFE7C2" : "FFEFF2F5" } };
    if (c.enm) cell.note = `목록에서 골라 주세요: ${c.enm.join(", ")}`;
    else if (c.date) cell.note = "YYYY-MM-DD 형식";
    else if (c.ym) cell.note = "YYYY-MM 형식";
  });
  rows.forEach((r) => ws.addRow(r));

  const enumCols = schema.cols
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.enm && c.enm.length > 0);
  if (enumCols.length > 0) {
    const list = wb.addWorksheet(LIST_SHEET, { state: "veryHidden" });
    enumCols.forEach(({ c, i }, listIndex) => {
      const listCol = columnLetter(listIndex);
      c.enm!.forEach((value, r) => {
        list.getCell(`${listCol}${r + 1}`).value = value;
      });
      const formula = `'${LIST_SHEET}'!$${listCol}$1:$${listCol}$${c.enm!.length}`;
      const target = columnLetter(i);
      const lastRow = Math.max(PREPARED_ROWS, rows.length + 1);
      // 셀마다가 아니라 열 범위 하나로 건다(파일 크기·생성 시간). exceljs 타입 선언에는 없지만 런타임 API다.
      (ws as unknown as RangeValidations).dataValidations.add(`${target}2:${target}${lastRow}`, {
        type: "list",
        allowBlank: !c.req,
        formulae: [formula],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "목록에 없는 값",
        error: `${c.k}은(는) 목록에 있는 값만 입력할 수 있어요.`,
      });
    });
  }
  return ws;
}

async function download(wb: Workbook, name: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.xlsx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 300);
}

/** 양식(열 이름 + 예시 2행) 내려받기. */
export async function downloadTemplateXlsx(schema: EntitySchema): Promise<void> {
  const wb = await newWorkbook();
  const examples = [0, 1].map((n) => schema.cols.map((c) => (c.ex && c.ex[n]) || ""));
  fillSheet(wb, schema, examples);
  await download(wb, schema.file);
}

/** 오류 행(원래 값 + 오류 사유) 내려받기. 같은 드롭다운이 걸려 있어 고친 뒤 그대로 다시 올릴 수 있다. */
export async function downloadErrorXlsx(schema: EntitySchema, rows: string[][]): Promise<void> {
  const wb = await newWorkbook();
  fillSheet(wb, schema, rows, ["오류 사유"]);
  await download(wb, `${schema.file}_오류`);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cellText(value: any): string {
  if (value == null) return "";
  if (value instanceof Date) {
    // 엑셀 날짜는 UTC 자정 기준으로 들어온다.
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((t: { text: string }) => t.text).join("");
    if ("text" in value) return String(value.text ?? "");
    if ("result" in value) return cellText(value.result);
    return "";
  }
  return String(value);
}

/** 첫 번째(「양식」) 시트를 문자열 2차원 배열로 읽는다. parseCSV와 같은 모양(빈 행 제외). */
export async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const wb = await newWorkbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet(DATA_SHEET) ?? wb.worksheets.find((sheet) => sheet.state === "visible");
  if (!ws) return [];
  const width = ws.getRow(1).cellCount;
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let i = 1; i <= width; i += 1) cells.push(cellText(row.getCell(i).value).trim());
    if (cells.some((c) => c !== "")) rows.push(cells);
  });
  return rows;
}
