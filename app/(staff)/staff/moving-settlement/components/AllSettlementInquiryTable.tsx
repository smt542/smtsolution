import { Fragment } from "react";
import { formatDate, formatNumber } from "@/lib/format";
import type { SettlementInquiryRow } from "@/hooks/reactquery/movingSettlement";
import { SettlementDateField } from "./SettlementDateField";
import {
  displayNumericInput,
  groupSettlementRows,
  locationLabel,
  parseNumericInput,
  type EditableInquiryField,
  type SettlementInquiryEdits,
} from "./settlementInquiryTypes";

interface AllSettlementInquiryTableProps {
  rows: SettlementInquiryRow[];
  total: number;
  edits: SettlementInquiryEdits;
  onEdit: (
    row: SettlementInquiryRow,
    field: EditableInquiryField,
    value: string,
  ) => void;
}

const TEXT_CELL = "h-[55px] border-b border-line2 px-[16px] text-[13px] font-medium text-t1";
const NUMBER_CELL = `${TEXT_CELL} text-right tabular-nums`;
const HEADER_CELL = "sticky top-0 z-20 h-[37px] border-b border-line bg-[#f9fafb] px-[16px] text-left text-[12px] font-bold text-t3";
const NUMBER_HEADER_CELL = `${HEADER_CELL} text-right`;

function sum(
  rows: SettlementInquiryRow[],
  value: (row: SettlementInquiryRow) => number | null,
): number {
  return rows.reduce((total, row) => total + (value(row) ?? 0), 0);
}

function displayNumber(value: number | null): string {
  return formatNumber(value, { nullText: "" });
}

function cleaningValue(
  row: SettlementInquiryRow,
  edits: SettlementInquiryEdits,
): number | null {
  const edited = edits[row.settlementId]?.cleaningCost;
  return edited === undefined ? row.cleaningCost : parseNumericInput(edited);
}

export function AllSettlementInquiryTable({
  rows,
  total,
  edits,
  onEdit,
}: AllSettlementInquiryTableProps) {
  const groups = groupSettlementRows(rows);
  const rowNumbers = new Map(
    rows.map((row, index) => [row.settlementId, index + 1]),
  );
  const totalElectric = sum(rows, (row) => row.elecCharge);
  const totalGas = sum(rows, (row) => row.gasCharge);
  const totalMonthly = sum(rows, (row) => row.mgmtFeeProrated);
  const totalCleaning = rows.reduce(
    (amount, row) => amount + (cleaningValue(row, edits) ?? 0),
    0,
  );

  return (
    <div className="moving-inquiry-scroll min-h-0 flex-1 overflow-auto bg-white">
      <table className="moving-inquiry-table w-[1739px] min-w-[1739px] table-fixed border-collapse">
        <caption className="sr-only">
          전기·가스 검침, 입금일과 청소비를 포함한 전체 이사조회 결과
        </caption>
        <colgroup>
          {[
            49, 88, 110, 57, 105, 105, 72, 72, 49, 80,
            148, 72, 72, 49, 89, 148, 101, 78, 128, 68,
          ].map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className={NUMBER_HEADER_CELL}>NO</th>
            <th className={HEADER_CELL}>소재지</th>
            <th className={HEADER_CELL}>건물명</th>
            <th className={HEADER_CELL}>호실</th>
            <th className={HEADER_CELL}>해약일자</th>
            <th className={HEADER_CELL}>입주일</th>
            <th className={NUMBER_HEADER_CELL}>전기검침</th>
            <th className={NUMBER_HEADER_CELL}>전기이주</th>
            <th className={NUMBER_HEADER_CELL}>량</th>
            <th className={NUMBER_HEADER_CELL}>금액</th>
            <th className={HEADER_CELL}>입금일자</th>
            <th className={NUMBER_HEADER_CELL}>가스검침</th>
            <th className={NUMBER_HEADER_CELL}>가스이주</th>
            <th className={NUMBER_HEADER_CELL}>량</th>
            <th className={NUMBER_HEADER_CELL}>금액</th>
            <th className={HEADER_CELL}>입금일자</th>
            <th className={NUMBER_HEADER_CELL}>당월계</th>
            <th className={HEADER_CELL}>입력검사</th>
            <th className={NUMBER_HEADER_CELL}>청소비용</th>
            <th className={HEADER_CELL}>상태</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const groupElectric = sum(group.rows, (row) => row.elecCharge);
            const groupGas = sum(group.rows, (row) => row.gasCharge);
            const groupMonthly = sum(group.rows, (row) => row.mgmtFeeProrated);
            const groupCleaning = group.rows.reduce(
              (amount, row) => amount + (cleaningValue(row, edits) ?? 0),
              0,
            );

            return (
              <Fragment key={group.key}>
                {group.rows.map((row) => {
                  const edit = edits[row.settlementId];
                  const elecPaidDate = edit?.elecPaidDate ?? row.elecPaidDate ?? "";
                  const gasPaidDate = edit?.gasPaidDate ?? row.gasPaidDate ?? "";
                  const cleaning = edit?.cleaningCost ?? (
                    row.cleaningCost === null ? "" : String(row.cleaningCost)
                  );
                  const rowLabel = `${row.buildingName} ${row.unitNo}`;

                  return (
                    <tr key={row.settlementId} className="bg-white hover:bg-[#fbfcfd]">
                      <td className={NUMBER_CELL}>{rowNumbers.get(row.settlementId)}</td>
                      <td className={`${TEXT_CELL} truncate`} title={row.buildingAddress ?? undefined}>
                        {locationLabel(row.buildingAddress, row.dong)}
                      </td>
                      <td className={`${TEXT_CELL} font-semibold`}>{row.buildingName}</td>
                      <td className={TEXT_CELL}>{row.unitNo}</td>
                      <td className={`${TEXT_CELL} tabular-nums`}>
                        {formatDate(row.moveOutDate, { nullText: "" })}
                      </td>
                      <td className={`${TEXT_CELL} tabular-nums`}>
                        {formatDate(row.moveInDate, { nullText: "" })}
                      </td>
                      <td className={NUMBER_CELL}>{displayNumber(row.elecPreviousReading)}</td>
                      <td className={NUMBER_CELL}>{displayNumber(row.elecCurrentReading)}</td>
                      <td className={NUMBER_CELL}>{displayNumber(row.elecUsage)}</td>
                      <td className={NUMBER_CELL}>{displayNumber(row.elecCharge)}</td>
                      <td className={`${TEXT_CELL} py-[12px]`}>
                        <SettlementDateField
                          ariaLabel={`${rowLabel} 전기 입금일자`}
                          value={elecPaidDate}
                          onChange={(value) => onEdit(row, "elecPaidDate", value)}
                        />
                      </td>
                      <td className={NUMBER_CELL}>{displayNumber(row.gasPreviousReading)}</td>
                      <td className={NUMBER_CELL}>{displayNumber(row.gasCurrentReading)}</td>
                      <td className={NUMBER_CELL}>{displayNumber(row.gasUsage)}</td>
                      <td className={NUMBER_CELL}>{displayNumber(row.gasCharge)}</td>
                      <td className={`${TEXT_CELL} py-[12px]`}>
                        <SettlementDateField
                          ariaLabel={`${rowLabel} 가스 입금일자`}
                          value={gasPaidDate}
                          onChange={(value) => onEdit(row, "gasPaidDate", value)}
                        />
                      </td>
                      <td className={`${NUMBER_CELL} font-semibold`}>
                        {displayNumber(row.mgmtFeeProrated)}
                      </td>
                      <td className={TEXT_CELL}>{row.checkedByName ?? ""}</td>
                      <td className={`${TEXT_CELL} py-[12px]`}>
                        <input
                          aria-label={`${rowLabel} 청소비용`}
                          inputMode="numeric"
                          value={displayNumericInput(cleaning)}
                          onChange={(event) =>
                            onEdit(row, "cleaningCost", event.target.value)
                          }
                          className="h-[30px] w-[96px] rounded-[8px] border border-line bg-white px-[9px] text-right text-[12.5px] font-medium tabular-nums text-t1 outline-none focus:border-blue"
                        />
                      </td>
                      <td className={TEXT_CELL}>
                        <span
                          className={`inline-flex h-[21px] items-center rounded-[6px] px-[8px] text-[11.5px] font-bold ${
                            row.status === "completed"
                              ? "bg-[#e2f5f1] text-[#0e8677]"
                              : "bg-bg text-t3"
                          }`}
                        >
                          {row.status === "completed" ? "완결" : "미결"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="h-[41px] bg-[#fbfcfd] font-bold text-t1">
                  <td className="border-b border-line2" />
                  <td className="border-b border-line2 px-[16px] text-[12.5px]">{group.address}</td>
                  <td className="border-b border-line2 px-[16px] text-[12.5px]">{group.buildingName}</td>
                  <td className="border-b border-line2" colSpan={6} />
                  <td className="border-b border-line2 px-[16px] text-right text-[13px] tabular-nums">{displayNumber(groupElectric)}</td>
                  <td className="border-b border-line2" />
                  <td className="border-b border-line2" colSpan={3} />
                  <td className="border-b border-line2 px-[16px] text-right text-[13px] tabular-nums">{displayNumber(groupGas)}</td>
                  <td className="border-b border-line2" />
                  <td className="border-b border-line2 px-[16px] text-right text-[13px] tabular-nums">{displayNumber(groupMonthly)}</td>
                  <td className="border-b border-line2" />
                  <td className="border-b border-line2 px-[16px] text-right text-[13px] tabular-nums">{displayNumber(groupCleaning)}</td>
                  <td className="border-b border-line2" />
                </tr>
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="sticky bottom-0 z-30 h-[41px] bg-white font-extrabold text-t1 shadow-[0_-1px_0_#e8ebee]">
            <td colSpan={9} className="px-[16px] text-[13px]">합계 {formatNumber(total)}건</td>
            <td className="px-[16px] text-right text-[13px] tabular-nums">{displayNumber(totalElectric)}</td>
            <td />
            <td colSpan={3} />
            <td className="px-[16px] text-right text-[13px] tabular-nums">{displayNumber(totalGas)}</td>
            <td />
            <td className="px-[16px] text-right text-[13px] tabular-nums">{displayNumber(totalMonthly)}</td>
            <td />
            <td className={`px-[16px] text-right text-[13px] tabular-nums ${totalCleaning < 0 ? "text-red" : ""}`}>
              {displayNumber(totalCleaning)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
