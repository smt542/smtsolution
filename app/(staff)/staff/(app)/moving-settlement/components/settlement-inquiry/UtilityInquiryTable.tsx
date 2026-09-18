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
      <table className="w-[1632px] min-w-[1632px] table-fixed border-separate border-spacing-0 text-[13.5px] text-t1">
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
              <tr key={row.settlementId} className="h-[55px] hover:bg-[#FBFCFD]">
                <td className="border-b border-line2 px-4 text-right num">{index + 1}</td>
                {/* 정본 셀은 모두 한 줄이다. 소재지에 동 이름이 없어 주소가 통째로
                    들어오는 건물이 있어 고정 폭에서 두 줄로 접힌다 — 전체 이사조회와
                    같이 잘라내고 전체 값은 title 로 남긴다. */}
                <td
                  className="truncate border-b border-line2 px-4"
                  title={row.buildingAddress ?? undefined}
                >
                  {locationLabel(row.buildingAddress, row.dong)}
                </td>
                <td className="border-b border-line2 px-4">{row.buildingName}</td>
                <td
                  className="truncate border-b border-line2 px-4"
                  title={row.buildingAddress ?? undefined}
                >
                  {row.buildingAddress ?? ""}
                </td>
                <td className="border-b border-line2 px-4">{unitNoLabel(row.unitNo)}</td>
                <td className="border-b border-line2 px-4">
                  {formatDateCell(row.moveOutDate)}
                </td>
                <td className="border-b border-line2 px-4">{row.meterNo ?? ""}</td>
                <td className="border-b border-line2 px-4">{row.customerNo ?? ""}</td>
                <td className="border-b border-line2 px-4 text-right num">
                  {formatNumberCell(row[fields.previousReading])}
                </td>
                <td className="border-b border-line2 px-4 text-right num">
                  {formatNumberCell(row[fields.currentReading])}
                </td>
                <td className="border-b border-line2 px-4 text-right num">
                  {formatNumberCell(row[fields.usage])}
                </td>
                <td className="border-b border-line2 px-4 text-right num">
                  {formatNumberCell(row[fields.charge])}
                </td>
                <td className="border-b border-line2 px-4">
                  <SettlementDateField
                    ariaLabel={`${row.buildingName} ${row.unitNo} ${columns[12].label}`}
                    value={paidDate ?? ""}
                    onChange={(value) =>
                      onEdit(row, {
                        [fields.paidDate]: value || null,
                      } as Partial<UpdateSettlementInquiryRow>)
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="sticky bottom-0 z-10 bg-white font-extrabold shadow-[0_-1px_0_#E8EBEE]">
          <tr className="h-[41px]">
            {/* NO 칸(48.7px)만으로는 `합계 N건`이 줄바꿈돼 행 높이가 41px를 넘는다.
                정본도 텍스트가 소재지 칸까지 걸쳐 있어 2칸을 합친다. */}
            <td colSpan={2} className="whitespace-nowrap px-4">
              합계 {formatNumber(total)}건
            </td>
            <td colSpan={8} />
            <td className="px-4 text-right num">
              {formatNumber(sumColumn(rows, fields.usage))}
            </td>
            <td className="px-4 text-right num">
              {formatNumber(sumColumn(rows, fields.charge))}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

