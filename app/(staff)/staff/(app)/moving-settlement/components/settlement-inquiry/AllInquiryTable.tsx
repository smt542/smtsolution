import { Fragment } from "react";
import type {
  UpdateSettlementInquiryRow,
  SettlementInquiryRow,
} from "@/hooks/reactquery/movingSettlement";
import { formatNumber, formatDate } from "@/lib/format";
import { SettlementInquiryDateField } from "./SettlementInquiryDateField";
import type { SettlementInquiryTableProps } from "./SettlementInquiryTable";

const widths = [
  48.6875, 88, 110, 57.4375, 105.203125, 105.203125,
  71.765625, 71.765625, 48.59375, 79.984375, 148,
  71.765625, 71.765625, 48.59375, 88.8125, 148,
  101.453125, 78, 128, 67.890625,
];

function sum(rows: SettlementInquiryRow[], key: "elecCharge" | "gasCharge" | "mgmtFeeProrated" | "cleaningCost", edits: Record<number, UpdateSettlementInquiryRow>) {
  return rows.reduce((total, row) => {
    const edit = edits[row.settlementId];
    const value = key === "cleaningCost" && edit ? edit.cleaningCost : row[key];
    return total + (value ?? 0);
  }, 0);
}

export function AllInquiryTable({ rows, total = rows.length, edits, onEdit }: SettlementInquiryTableProps) {
  const groups = Array.from(rows.reduce((map, row) => {
    const key = String(row.buildingId);
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
    return map;
  }, new Map<string, SettlementInquiryRow[]>()));
  let rowNumber = 0;

  return (
    <div className="h-full overflow-auto bg-white settlement-inquiry-scroll print:h-auto print:overflow-visible">
      <table className="w-[1738.921875px] table-fixed border-separate border-spacing-0 text-[13.5px] text-t1">
        <colgroup>{widths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
        <thead className="sticky top-0 z-10 bg-[#FBFCFD] text-[11.5px] font-medium text-t3">
          <tr className="h-[36.5px]">
            {['NO', '소재지', '건물명', '호실', '해약일자', '입주일', '전기검침', '전기이주', '량', '금액', '입금일자', '가스검침', '가스이주', '량', '금액', '입금일자', '당월계', '입력검사', '청소비용', '상태'].map((label, index) => (
              <th key={`${label}-${index}`} className={`border-b border-line px-4 font-medium ${[0, 8, 9, 13, 14, 16, 18].includes(index) ? 'text-right' : 'text-left'}`}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(([buildingId, groupRows]) => (
            <Fragment key={buildingId}>
              {groupRows.map((row) => {
                rowNumber += 1;
                const edit = edits[row.settlementId];
                const cleaningCost = edit ? edit.cleaningCost : row.cleaningCost;
                return (
                  <tr key={row.settlementId} className="h-[55px] hover:bg-[#FBFCFD]">
                    <td className="border-b border-line2 px-4 text-right num">{rowNumber}</td>
                    <td className="border-b border-line2 px-4">{row.buildingAddress || '-'}</td>
                    <td className="border-b border-line2 px-4">{row.buildingName}</td>
                    <td className="border-b border-line2 px-4">{row.unitNo}</td>
                    <td className="border-b border-line2 px-4 num">{formatDate(row.moveOutDate, { nullText: '-' })}</td>
                    <td className="border-b border-line2 px-4 num">{formatDate(row.moveInDate, { nullText: '-' })}</td>
                    <td className="border-b border-line2 px-4 text-right num">{formatNumber(row.elecPreviousReading, { nullText: '-' })}</td>
                    <td className="border-b border-line2 px-4 text-right num">{formatNumber(row.elecCurrentReading, { nullText: '-' })}</td>
                    <td className="border-b border-line2 px-4 text-right num">{formatNumber(row.elecUsage, { nullText: '-' })}</td>
                    <td className="border-b border-line2 px-4 text-right num">{formatNumber(row.elecCharge, { nullText: '-' })}</td>
                    <td className="border-b border-line2 px-4">
                      <SettlementInquiryDateField ariaLabel={`${row.buildingName} ${row.unitNo} 전기 입금일자`} value={edit ? edit.elecPaidDate : row.elecPaidDate} onChange={(value) => onEdit(row, { elecPaidDate: value })} />
                    </td>
                    <td className="border-b border-line2 px-4 text-right num">{formatNumber(row.gasPreviousReading, { nullText: '-' })}</td>
                    <td className="border-b border-line2 px-4 text-right num">{formatNumber(row.gasCurrentReading, { nullText: '-' })}</td>
                    <td className="border-b border-line2 px-4 text-right num">{formatNumber(row.gasUsage, { nullText: '-' })}</td>
                    <td className="border-b border-line2 px-4 text-right num">{formatNumber(row.gasCharge, { nullText: '-' })}</td>
                    <td className="border-b border-line2 px-4">
                      <SettlementInquiryDateField ariaLabel={`${row.buildingName} ${row.unitNo} 가스 입금일자`} value={edit ? edit.gasPaidDate : row.gasPaidDate} onChange={(value) => onEdit(row, { gasPaidDate: value })} />
                    </td>
                    <td className="border-b border-line2 px-4 text-right font-medium num">{formatNumber(row.mgmtFeeProrated, { nullText: '-' })}</td>
                    <td className="border-b border-line2 px-4">{row.checkedByName ?? '-'}</td>
                    <td className="border-b border-line2 px-4">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`${row.buildingName} ${row.unitNo} 청소비용`}
                        value={cleaningCost === null ? "" : formatNumber(cleaningCost)}
                        onChange={(event) => {
                          const digits = event.target.value.replace(/[^0-9]/g, "");
                          onEdit(row, { cleaningCost: digits === "" ? null : Number(digits) });
                        }}
                        className="h-[30px] w-[96px] rounded-[8px] border border-line bg-white px-[9px] text-right text-[12.5px] font-medium text-t1 outline-none focus:border-blue"
                      />
                    </td>
                    <td className="border-b border-line2 px-4">
                      <span className={`inline-flex h-[21px] items-center rounded-[6px] px-[8px] text-[11.5px] font-bold ${row.status === 'completed' ? 'bg-[#E2F5F1] text-[#0E8677]' : 'bg-red-t text-red'}`}>{row.status === 'completed' ? '완결' : '미결'}</span>
                    </td>
                  </tr>
                );
              })}
              <tr className="h-[41px] bg-[#FCFDFE] font-bold">
                <td className="border-b border-line2" />
                <td className="border-b border-line2 px-4">{groupRows[0].buildingAddress || '-'}</td>
                <td className="border-b border-line2 px-4">{groupRows[0].buildingName}</td>
                <td colSpan={6} className="border-b border-line2" />
                <td className="border-b border-line2 px-4 text-right num">{formatNumber(sum(groupRows, 'elecCharge', edits))}</td>
                <td colSpan={4} className="border-b border-line2" />
                <td className="border-b border-line2 px-4 text-right num">{formatNumber(sum(groupRows, 'gasCharge', edits))}</td>
                <td className="border-b border-line2" />
                <td className="border-b border-line2 px-4 text-right num">{formatNumber(sum(groupRows, 'mgmtFeeProrated', edits))}</td>
                <td colSpan={3} className="border-b border-line2" />
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 z-10 bg-white font-extrabold shadow-[0_-1px_0_#E8EBEE]">
          <tr className="h-[41px]">
            <td colSpan={9} className="px-4">합계 {formatNumber(total)}건</td>
            <td className="px-4 text-right num">{formatNumber(sum(rows, 'elecCharge', edits))}</td>
            <td colSpan={4} />
            <td className="px-4 text-right num">{formatNumber(sum(rows, 'gasCharge', edits))}</td>
            <td />
            <td className="px-4 text-right num">{formatNumber(sum(rows, 'mgmtFeeProrated', edits))}</td>
            <td />
            <td className="px-4 text-right num">{formatNumber(sum(rows, 'cleaningCost', edits))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

