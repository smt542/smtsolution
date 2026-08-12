// lib/export/xlsx.ts
import ExcelJS from "exceljs";

export interface XlsxColumn {
  header: string;
  key: string;
  width?: number;
}

export async function rowsToXlsxBuffer(
  columns: XlsxColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  for (const row of rows) ws.addRow(row);
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
