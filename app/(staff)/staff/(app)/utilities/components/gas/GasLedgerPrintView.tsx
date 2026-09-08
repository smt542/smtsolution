import { Fragment } from "react";
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";

export interface GasLedgerBuilding {
  id: number;
  code?: string | null;
  name: string;
  address?: string | null;
  entrancePassword?: string | null;
  contactPhone?: string | null;
  cleaningMemo?: string | null;
  gasCustomerNumberCount?: number;
}

export interface GasLedgerDocument {
  building: GasLedgerBuilding;
  electricityRows: UtilityUnitRow[];
  waterRows: UtilityUnitRow[];
  gasRows: UtilityUnitRow[];
}

interface MergedLedgerRow {
  unitId: number;
  unitNo: string;
  base: UtilityUnitRow;
  electricity?: UtilityUnitRow;
  water?: UtilityUnitRow;
  gas?: UtilityUnitRow;
}

interface LedgerPage {
  building: GasLedgerBuilding;
  electricityRows: UtilityUnitRow[];
  waterRows: UtilityUnitRow[];
  gasRows: UtilityUnitRow[];
  rows: MergedLedgerRow[];
  pageIndex: number;
  pageCount: number;
}

const ROWS_PER_PAGE = 12;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const GROUP_COLUMNS = [31.889, 31.889, 21.525, 31.889, 31.889];
const GAS_COLUMNS = [33.484, 33.484, 25.511, 31.889, 31.889];

function mergeRows(document: GasLedgerDocument): MergedLedgerRow[] {
  const merged = new Map<number, MergedLedgerRow>();
  const add = (rows: UtilityUnitRow[], utility: "electricity" | "water" | "gas") => {
    rows.forEach((row) => {
      const current = merged.get(row.unitId) ?? {
        unitId: row.unitId,
        unitNo: row.unitNo,
        base: row,
      };
      current[utility] = row;
      merged.set(row.unitId, current);
    });
  };
  add(document.electricityRows, "electricity");
  add(document.waterRows, "water");
  add(document.gasRows, "gas");
  return Array.from(merged.values()).sort((a, b) => (
    a.unitNo.localeCompare(b.unitNo, "ko-KR", { numeric: true })
  ));
}

function createPages(documents: GasLedgerDocument[]): LedgerPage[] {
  return documents.flatMap((document) => {
    const rows = mergeRows(document);
    const chunks = rows.length === 0
      ? [[]]
      : Array.from({ length: Math.ceil(rows.length / ROWS_PER_PAGE) }, (_, index) => (
          rows.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE)
        ));
    return chunks.map((pageRows, pageIndex) => ({
      ...document,
      rows: pageRows,
      pageIndex,
      pageCount: chunks.length,
    }));
  });
}

function formatReading(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

function meterValues(row?: UtilityUnitRow): string[] {
  if (!row) return ["", "", "", "", ""];
  return [
    formatReading(row.previousReading),
    formatReading(row.currentReading),
    formatReading(row.usage),
    "",
    "",
  ];
}

function subtotal(rows: UtilityUnitRow[]): string {
  const value = rows.reduce((sum, row) => sum + (row.usage ?? 0), 0);
  return value === 0 ? "" : formatReading(value);
}

function customerInfo(rows: UtilityUnitRow[]): string {
  const numbers = Array.from(new Set(rows.flatMap((row) => (
    row.customerNumber ? [row.customerNumber] : []
  ))));
  return numbers.length === 0 ? "" : `고객번호 ${numbers.join(" · ")}`;
}

function rowNote(row: MergedLedgerRow): string {
  const source = row.gas ?? row.water ?? row.electricity ?? row.base;
  if (source.occupancyStatus === "vacant" || source.occupancyId === null) return "공실";
  if (source.note) return source.note;
  if (!source.discountType) return "";
  const amount = source.discountAmount ? ` ${source.discountAmount.toLocaleString("ko-KR")}원` : "";
  return `${source.discountType}${amount}`;
}

function periodTitle(period: string): string {
  return `[ ${period.slice(0, 4)} 년 ${period.slice(5, 7)} 월분 검침대장 ]`;
}

export function GasLedgerPrintView({
  documents,
  period,
}: {
  documents: GasLedgerDocument[];
  period: string;
}) {
  const pages = createPages(documents);

  return (
    <div
      className="flex w-[633px] flex-col gap-[12.756px] text-[#111] print:gap-0"
      data-gas-ledger-print
      data-testid="gas-ledger-print"
    >
      {pages.map((page, globalPageIndex) => {
        const isLastPage = globalPageIndex === pages.length - 1;
        return (
          <article
            key={`${page.building.id}:${page.pageIndex}`}
            className={`box-border flex h-[895.288px] w-[633px] shrink-0 flex-col overflow-hidden rounded-[3.189px] border-[0.797px] border-[#e8ebee] bg-white px-[30.295px] py-[31.889px] ${isLastPage ? "print:break-after-auto" : "print:break-after-page"}`}
          >
            <header className="flex h-[27.106px] shrink-0 items-start justify-center pb-[11.161px]">
              <h1 className="text-center text-[13.553px] font-extrabold leading-none tracking-[0.8132px]">
                {periodTitle(period)}
              </h1>
            </header>

            <div className="mb-[6.378px] h-[58.198px] shrink-0 overflow-hidden border-[0.797px] border-[#111] text-[8.77px] leading-none">
              <div className="grid h-[19.133px] grid-cols-[58.995px_minmax(0,1fr)_minmax(0,1fr)_58.995px_125.962px] border-b-[0.797px] border-[#111]">
                <strong className="flex items-center justify-center border-r-[0.797px] border-[#111] bg-[#f5f6f7]">주소/빌라명</strong>
                <span className="flex min-w-0 items-center truncate border-r-[0.797px] border-[#111] px-[6.378px]">{page.building.address ?? ""}</span>
                <strong className="flex min-w-0 items-center truncate border-r-[0.797px] border-[#111] px-[6.378px]">{page.building.name}</strong>
                <strong className="flex items-center justify-center border-r-[0.797px] border-[#111] bg-[#f5f6f7]">키번호</strong>
                <span className="flex min-w-0 items-center truncate px-[6.378px]">{page.building.entrancePassword ?? ""}</span>
              </div>
              <div className="grid h-[19.133px] grid-cols-[58.995px_minmax(0,1fr)_58.995px_125.962px] border-b-[0.797px] border-[#111]">
                <strong className="flex items-center justify-center border-r-[0.797px] border-[#111] bg-[#f5f6f7]">수도정보</strong>
                <span className="flex min-w-0 items-center truncate border-r-[0.797px] border-[#111] px-[6.378px]">{customerInfo(page.waterRows)}</span>
                <strong className="flex items-center justify-center border-r-[0.797px] border-[#111] bg-[#f5f6f7]">전기정보</strong>
                <span className="flex min-w-0 items-center truncate px-[6.378px]">{customerInfo(page.electricityRows)}</span>
              </div>
              <div className="grid h-[18.336px] grid-cols-[58.995px_188.146px_58.995px_minmax(0,1fr)]">
                <strong className="flex items-center justify-center border-r-[0.797px] border-[#111] bg-[#f5f6f7]">청소정보</strong>
                <span className="flex items-center gap-[7.175px] border-r-[0.797px] border-[#111] px-[6.378px]">
                  {WEEKDAYS.map((day) => (
                    <span key={day} className="flex items-center gap-[2.392px] font-semibold">
                      {day}
                      <i className={`size-[8.77px] border-[0.797px] border-[#111] ${page.building.cleaningMemo?.includes(day) ? "bg-[#111]" : "bg-white"}`} />
                    </span>
                  ))}
                </span>
                <strong className="flex items-center justify-center border-r-[0.797px] border-[#111] bg-[#f5f6f7]">전화번호</strong>
                <span className="flex min-w-0 items-center truncate px-[6.378px]">{page.building.contactPhone ?? ""}</span>
              </div>
            </div>

            <table className="w-[570.816px] table-fixed border-collapse text-center text-[8.371px] leading-none">
              <colgroup>
                <col style={{ width: 35.078 }} />
                {GROUP_COLUMNS.map((width, index) => <col key={`electricity:${index}`} style={{ width }} />)}
                {GROUP_COLUMNS.map((width, index) => <col key={`water:${index}`} style={{ width }} />)}
                {GAS_COLUMNS.map((width, index) => <col key={`gas:${index}`} style={{ width }} />)}
                <col style={{ width: 28.7 }} />
                <col style={{ width: 51.82 }} />
              </colgroup>
              <thead className="font-bold">
                <tr className="h-[15.945px] bg-[#f5f6f7]">
                  <th rowSpan={2} className="border-[0.797px] border-[#111]">호수</th>
                  <th colSpan={5} className="border-[0.797px] border-[#111]">전기검침</th>
                  <th colSpan={5} className="border-[0.797px] border-[#111]">수도검침</th>
                  <th colSpan={5} className="border-[0.797px] border-[#111]">가스검침</th>
                  <th rowSpan={2} className="border-[0.797px] border-[#111]">NO</th>
                  <th rowSpan={2} className="border-[0.797px] border-[#111]">미납액</th>
                </tr>
                <tr className="h-[15.945px] bg-[#f5f6f7]">
                  {["전월", "금월", "량", "전량", "평균"].map((label) => <th key={`e:${label}`} className="border-[0.797px] border-[#111]">{label}</th>)}
                  {["전월", "금월", "량", "전량", "평균"].map((label) => <th key={`w:${label}`} className="border-[0.797px] border-[#111]">{label}</th>)}
                  {["전월", "금월", "량", "전량", "평균"].map((label) => <th key={`g:${label}`} className="border-[0.797px] border-[#111]">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row, rowIndex) => (
                  <Fragment key={row.unitId}>
                    <tr className="h-[15.945px]">
                      <th rowSpan={2} className="border-[0.797px] border-[#111] font-bold">{row.unitNo.replace(/호$/, "")}</th>
                      {meterValues(row.electricity).map((value, index) => <td key={`e:${index}`} className="border-[0.797px] border-[#111] pr-[3.986px] text-right tabular-nums">{value}</td>)}
                      {meterValues(row.water).map((value, index) => <td key={`w:${index}`} className="border-[0.797px] border-[#111] pr-[3.986px] text-right tabular-nums">{value}</td>)}
                      {meterValues(row.gas).map((value, index) => <td key={`g:${index}`} className="border-[0.797px] border-[#111] pr-[3.986px] text-right tabular-nums">{value}</td>)}
                      <td rowSpan={2} className="border-[0.797px] border-[#111] pr-[3.986px] text-right tabular-nums">{page.pageIndex * ROWS_PER_PAGE + rowIndex + 1}</td>
                      <td rowSpan={2} className="border-[0.797px] border-[#111] text-right tabular-nums" />
                    </tr>
                    <tr className="h-[15.147px]">
                      <td colSpan={15} className="border-[0.797px] border-[#111] text-center text-[7.972px] text-[#333]">{rowNote(row)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>

            <div className="grid h-[17.539px] shrink-0 grid-cols-3 border-x-[0.797px] border-b-[0.797px] border-[#111] text-[8.371px] leading-none">
              {[
                ["전기소계", subtotal(page.electricityRows)],
                ["수도소계", subtotal(page.waterRows)],
                ["가스소계", subtotal(page.gasRows)],
              ].map(([label, value], index) => (
                <div key={label} className={`grid grid-cols-2 ${index < 2 ? "border-r-[0.797px] border-[#111]" : ""}`}>
                  <strong className="flex items-center justify-center border-r-[0.797px] border-[#111] bg-[#f5f6f7]">{label}</strong>
                  <strong className="flex items-center justify-end px-[4.783px] tabular-nums">{value}</strong>
                </div>
              ))}
            </div>

            <footer className="flex min-h-0 flex-1 items-end justify-center pt-[11.161px] text-[8.371px] leading-none text-[#888]">
              {page.building.name} · {page.pageIndex + 1} / {page.pageCount}
            </footer>
          </article>
        );
      })}
    </div>
  );
}
