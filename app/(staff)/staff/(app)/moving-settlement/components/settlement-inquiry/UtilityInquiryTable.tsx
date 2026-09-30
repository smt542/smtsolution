import type {
  SettlementInquiryRow,
  UpdateSettlementInquiryRow,
} from "@/hooks/reactquery/movingSettlement";
import { formatDate, formatNumber } from "@/lib/format";
import { SettlementDateField } from "../SettlementDateField";
import { locationLabel, unitNoLabel } from "../settlementInquiryTypes";
import type { SettlementInquiryTableProps } from "./SettlementInquiryTable";
import {
  getUtilityInquiryColumns,
  getUtilityInquiryFieldMapping,
  type UtilityInquiryType,
} from "./utilityInquiryColumns";

type UtilityInquiryTableProps = Omit<SettlementInquiryTableProps, "type"> & {
  type: UtilityInquiryType;
};

// 정본 `#msTbl tfoot td` — 배경은 tfoot 이 칠하고, 위 선은 칸마다 1px 테두리로 긋는다.
const FOOT_CELL = "border-t border-line";

function formatNumberCell(value: number | null | undefined): string {
  return value == null ? "" : formatNumber(value);
}

function formatDateCell(value: string | null | undefined): string {
  return value ? formatDate(value) : "";
}

function sumColumn(
  rows: SettlementInquiryRow[],
  field: keyof SettlementInquiryRow,
): number {
  return rows.reduce((sum, row) => {
    const value = row[field];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

export function UtilityInquiryTable({
  type,
  rows,
  total = rows.length,
  edits,
  onEdit,
}: UtilityInquiryTableProps) {
  const columns = getUtilityInquiryColumns(type);
  const fields = getUtilityInquiryFieldMapping(type);

  return (
    <div className="h-full overflow-auto bg-white settlement-inquiry-scroll">
      {/* h-full: 행이 적어도 합계 행이 목록 하단에 붙게 표를 스크롤 영역 높이로 늘린다.
          남는 높이는 tbody 끝의 빈 행이 가져가고, 행이 넘치면 합계 행은 sticky 로 하단에 남는다. */}
      <table className="h-full w-[1632px] min-w-[1632px] table-fixed border-separate border-spacing-0 text-[13.5px] text-t1">
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-[#FBFCFD] text-[11.5px] font-medium text-t3">
          <tr className="h-[36.5px]">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`border-b border-line px-4 font-medium ${column.align === "right" ? "text-right" : "text-left"}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const edit = edits[row.settlementId];
            const paidDate = edit
              ? edit[fields.paidDate]
              : row[fields.paidDate];
            return (
              <tr key={row.settlementId} className="h-[55px] hover:bg-row-hover">
                {columns.map((column) => {
                  const className = `border-b border-line2 px-4 ${column.align === "right" ? "text-right" : "text-left"}`;
                  switch (column.key) {
                    case "no":
                      return <td key={column.key} className={`${className} num`}>{index + 1}</td>;
                    case "location":
                      return (
                        <td key={column.key} className={`${className} truncate`} title={row.buildingAddress ?? undefined}>
                          {locationLabel(row.buildingAddress, row.dong)}
                        </td>
                      );
                    case "buildingName":
                      return <td key={column.key} className={className}>{row.buildingName}</td>;
                    case "buildingAddress":
                      return (
                        <td key={column.key} className={`${className} truncate`} title={row.buildingAddress ?? undefined}>
                          {row.buildingAddress ?? ""}
                        </td>
                      );
                    case "unitNo":
                      return <td key={column.key} className={`${className} font-medium`}>{unitNoLabel(row.unitNo)}</td>;
                    case "moveOutDate":
                      return <td key={column.key} className={className}>{formatDateCell(row.moveOutDate)}</td>;
                    case "meterNo":
                      return <td key={column.key} className={className}>{row.meterNo ?? ""}</td>;
                    case "customerNo":
                      return <td key={column.key} className={className}>{row.customerNo ?? ""}</td>;
                    case "previousReading":
                      return <td key={column.key} className={`${className} num`}>{formatNumberCell(row[fields.previousReading])}</td>;
                    case "currentReading":
                      return <td key={column.key} className={`${className} num`}>{formatNumberCell(row[fields.currentReading])}</td>;
                    case "usage":
                      return <td key={column.key} className={`${className} num`}>{formatNumberCell(row[fields.usage])}</td>;
                    case "charge":
                      return <td key={column.key} className={`${className} num font-medium`}>{formatNumberCell(row[fields.charge])}</td>;
                    case "paidDate":
                      return (
                        <td key={column.key} className={className}>
                          <SettlementDateField
                            ariaLabel={`${row.buildingName} ${row.unitNo} ${columns[columns.length - 1].label}`}
                            value={paidDate ?? ""}
                            onChange={(value) =>
                              onEdit(row, {
                                [fields.paidDate]: value || null,
                              } as Partial<UpdateSettlementInquiryRow>)
                            }
                          />
                        </td>
                      );
                  }
                })}
              </tr>
            );
          })}
          <tr aria-hidden="true">
            <td colSpan={columns.length} className="border-0 p-0" />
          </tr>
        </tbody>
        <tfoot className="sticky bottom-0 z-10 bg-[#FBFCFD] font-bold">
          <tr className="h-[40.5px]">
            {/* NO 칸(48.7px)만으로는 `합계 N건`이 줄바꿈돼 행 높이가 41px를 넘는다.
                정본도 텍스트가 소재지 칸까지 걸쳐 있어 2칸을 합친다. */}
            <td colSpan={2} className={`${FOOT_CELL} whitespace-nowrap px-4`}>
              합계 {formatNumber(total)}건
            </td>
            <td colSpan={columns.length - 5} className={FOOT_CELL} />
            <td className={`${FOOT_CELL} px-4 text-right num`}>
              {formatNumber(sumColumn(rows, fields.usage))}
            </td>
            <td className={`${FOOT_CELL} px-4 text-right num`}>
              {formatNumber(sumColumn(rows, fields.charge))}
            </td>
            <td className={FOOT_CELL} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

