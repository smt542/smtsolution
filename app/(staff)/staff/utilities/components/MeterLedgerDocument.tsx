import type { Building } from "@/hooks/reactquery/buildings";
import type { UtilityType, UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";

interface MeterLedgerDocumentProps {
  building: Building;
  period: string;
  rows: UtilityUnitRow[];
  utilityType?: UtilityType;
}

const ROWS_PER_PAGE = 12;
const UTILITY_GROUPS: { type: UtilityType; label: string }[] = [
  { type: "electricity", label: "전기검침" },
  { type: "water", label: "수도검침" },
  { type: "gas", label: "가스검침" },
];

function chunkRows(rows: UtilityUnitRow[]): (UtilityUnitRow | null)[][] {
  const chunks = rows.length === 0
    ? [[]]
    : Array.from(
        { length: Math.ceil(rows.length / ROWS_PER_PAGE) },
        (_, index) => rows.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE),
      );

  return chunks.map((chunk) => [
    ...chunk,
    ...Array.from({ length: ROWS_PER_PAGE - chunk.length }, () => null),
  ]);
}

function ledgerValue(value: number | null | undefined): string {
  return value === null || value === undefined
    ? ""
    : formatNumber(value, { fractionDigits: 3 });
}

function readingCells(row: UtilityUnitRow | null, active: boolean): string[] {
  if (!row || !active) return ["", "", "", "", ""];
  const usage = row.usage ?? (
    row.currentReading !== null && row.previousReading !== null
      ? row.currentReading - row.previousReading
      : null
  );
  return [
    ledgerValue(row.previousReading),
    ledgerValue(row.currentReading),
    ledgerValue(usage),
    "",
    "",
  ];
}

function rowMemo(row: UtilityUnitRow | null): string {
  if (!row) return "";
  if (row.occupancyStatus === "vacant" || row.occupancyId === null) return "공실";
  if (row.discountAmount !== null && row.discountAmount > 0) {
    const discountLabel = row.discountType === "recipient"
      ? "수급자"
      : row.discountType === "multichild"
        ? "다자녀"
        : "할인";
    return `${discountLabel} ${formatNumber(row.discountAmount)}원`;
  }
  if (row.meterNumber === null) return "계량기 없음";
  return row.note ?? "";
}

export function MeterLedgerDocument({
  building,
  period,
  rows,
  utilityType = "electricity",
}: MeterLedgerDocumentProps) {
  const year = period.slice(0, 4);
  const month = period.slice(5, 7);
  const pages = chunkRows(rows);
  const customerNumber = rows.find((row) => row.customerNumber)?.customerNumber ?? "미등록";
  const totalUsage = rows.reduce((total, row) => total + (row.usage ?? 0), 0);

  return (
    <div data-meter-ledger-document-set className="space-y-[13px] text-black print:space-y-0">
      {pages.map((pageRows, pageIndex) => {
        const isLastPage = pageIndex === pages.length - 1;
        return (
          <article
            key={`${building.id}:${pageIndex}`}
            data-meter-ledger-document
            className="box-border flex h-[895px] w-[633px] flex-col overflow-hidden rounded-[3px] border border-[#e8ebee] bg-white px-[31px] py-[32px] font-sans text-black shadow-sm print:h-[297mm] print:w-[210mm] print:rounded-none print:border-0 print:px-[10mm] print:py-[10mm] print:shadow-none"
          >
            <h1 className="pb-[11px] text-center text-[14px] font-extrabold tracking-[0.06em]">
              [ {year} 년 {month} 월분 검침대장 ]
            </h1>

            <table className="w-full table-fixed border-collapse text-[8px] leading-none">
              <tbody>
                <tr className="h-[19px]">
                  <th className="w-[59px] border border-black bg-[#f5f6f7] px-1 text-center">주소/빌라명</th>
                  <td className="border border-black px-1.5" colSpan={2}>{building.address ?? "주소 미등록"}</td>
                  <td className="border border-black px-1.5 font-bold" colSpan={2}>{building.name}</td>
                  <th className="w-[59px] border border-black bg-[#f5f6f7] px-1 text-center">키번호</th>
                  <td className="border border-black px-1.5" colSpan={2}>{building.entrancePassword ?? "-"}</td>
                </tr>
                <tr className="h-[19px]">
                  <th className="border border-black bg-[#f5f6f7] px-1 text-center">수도정보</th>
                  <td className="border border-black px-1.5" colSpan={4}>고객번호 {customerNumber}</td>
                  <th className="border border-black bg-[#f5f6f7] px-1 text-center">전기정보</th>
                  <td className="border border-black px-1.5" colSpan={2}>공동모</td>
                </tr>
                <tr className="h-[19px]">
                  <th className="border border-black bg-[#f5f6f7] px-1 text-center">청소정보</th>
                  <td className="border border-black px-1.5" colSpan={3}>일 □ 월 □ 화 □ 수 □ 목 ■ 금 ■ 토 □</td>
                  <th className="border border-black bg-[#f5f6f7] px-1 text-center">전화번호</th>
                  <td className="border border-black px-1.5" colSpan={3}>{building.ownerPhone ?? "-"}</td>
                </tr>
              </tbody>
            </table>

            <table className="mt-[6px] w-full table-fixed border-collapse text-[8px] leading-none">
              <thead>
                <tr className="h-4 bg-[#f5f6f7]">
                  <th rowSpan={2} className="w-[35px] border border-black">호수</th>
                  {UTILITY_GROUPS.map((group) => (
                    <th key={group.type} colSpan={5} className="border border-black">{group.label}</th>
                  ))}
                  <th rowSpan={2} className="w-[29px] border border-black">NO</th>
                  <th rowSpan={2} className="w-[52px] border border-black">미납액</th>
                </tr>
                <tr className="h-4 bg-[#f5f6f7]">
                  {UTILITY_GROUPS.flatMap((group) => ["전월", "금월", "량", "전량", "평균"].map((label) => (
                    <th key={`${group.type}:${label}`} className="border border-black font-semibold">{label}</th>
                  )))}
                </tr>
              </thead>
              {pageRows.map((row, index) => {
                const rowNumber = pageIndex * ROWS_PER_PAGE + index + 1;
                return (
                  <tbody key={row?.unitId ?? `empty:${pageIndex}:${index}`}>
                    <tr className="h-4">
                      <td rowSpan={2} className="border border-black px-1 text-center font-bold">
                        {row?.unitNo.replace(/호$/, "") ?? ""}
                      </td>
                      {UTILITY_GROUPS.flatMap((group) => readingCells(row, group.type === utilityType).map((value, cellIndex) => (
                        <td
                          key={`${group.type}:${cellIndex}`}
                          data-testid={row ? `ledger-${group.type}-${row.unitId}-${cellIndex}` : undefined}
                          className="num border border-black px-0.5 text-right"
                        >
                          {value}
                        </td>
                      )))}
                      <td rowSpan={2} className="border border-black px-1 text-right">{row ? rowNumber : ""}</td>
                      <td rowSpan={2} className="border border-black" />
                    </tr>
                    <tr className="h-[15px]">
                      <td colSpan={15} className="border border-black px-1 text-center text-[7.5px] text-[#333]">
                        {rowMemo(row)}
                      </td>
                    </tr>
                  </tbody>
                );
              })}
            </table>

            {isLastPage && (
              <div className="grid h-[18px] grid-cols-3 border-x border-b border-black text-[8px]">
                {UTILITY_GROUPS.map((group) => (
                  <div key={group.type} className="grid grid-cols-2 border-r border-black last:border-r-0">
                    <span className="grid place-items-center bg-[#f5f6f7] font-bold">{group.label.replace("검침", "소계")}</span>
                    <strong className="grid place-items-center text-right">
                      {group.type === utilityType ? ledgerValue(totalUsage) : ""}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-auto pt-3 text-center text-[8px] text-[#888]">
              {building.name} · {pageIndex + 1} / {pages.length}
            </p>
          </article>
        );
      })}
    </div>
  );
}
