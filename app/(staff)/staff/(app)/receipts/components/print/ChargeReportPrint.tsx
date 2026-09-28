"use client";

import { Fragment } from "react";
import { PrintSheet } from "@/components/common/PrintSheet";
import type { ChargeReportModel } from "../chargeReport/buildChargeReport";
import type { MonthlyReportModel } from "../monthly/monthlyChargeData";

const PRINT_CSS = `
@page { size: A4 landscape; margin: 10mm; }
#rcAmtPrint * { box-sizing: border-box; }
/* 정본 body 규칙 그대로(정본은 print-color-adjust 없음 — PrintSheet 래퍼가 정본 페이지 상속값 exact를 준다).
   display:flex·min-height는 래퍼의 display:block!important에 눌려 정본처럼 block으로 렌더된다
   → 총계 표(.ac-foot)가 쪽 맨 아래가 아니라 본표 바로 아래에 붙는다(사용자 결정: 정본 렌더 그대로). */
#rcAmtPrint { margin: 0; color: #000; display: flex; flex-direction: column; min-height: calc(210mm - 20mm); }
#rcAmtPrint h1 { text-align: center; font-size: 14pt; font-weight: 700; margin: 0 0 5mm; }
#rcAmtPrint .ac-foot { margin-top: auto; padding-top: 5mm; }
#rcAmtPrint .ac-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2mm 6mm;
  font-size: 8pt;
  margin-bottom: 4mm;
  justify-content: center;
}
#rcAmtPrint .ac-meta span { white-space: nowrap; }
#rcAmtPrint table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
#rcAmtPrint th, #rcAmtPrint td {
  border: 1px solid #000;
  padding: 1mm 1.4mm;
  white-space: nowrap;
}
#rcAmtPrint thead th { background: #CFE0F5; text-align: center; font-weight: 700; }
#rcAmtPrint thead { display: table-header-group; }
#rcAmtPrint td.c { text-align: center; }
#rcAmtPrint td.r { text-align: right; }
#rcAmtPrint tr.tot > td { background: #DDE9F7; font-weight: 700; }
#rcAmtPrint tr { page-break-inside: avoid; }
`;

type PrintLinesProps = { lines: Array<string | null | undefined> };

function PrintLines({ lines }: PrintLinesProps) {
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 ? <br /> : null}
          {line ?? ""}
        </Fragment>
      ))}
    </>
  );
}

function HeaderCell({ lines }: PrintLinesProps) {
  return (
    <th>
      <PrintLines lines={lines.filter((line): line is string => Boolean(line))} />
    </th>
  );
}

function nz(value: number | null | undefined): string {
  return value ? value.toLocaleString("ko-KR") : "";
}

function monthlyAmount(text: string | undefined): string {
  return text && text !== "0" ? text : "";
}

function monthlyRate(text: string | undefined): string {
  return text?.replace(/^수납>>\s*/, "") ?? "";
}

function linesFromMonthlyCell(cell: MonthlyReportModel["rows"][number]["cells"][number]) {
  return [0, 1, 2].map((index) => monthlyAmount(cell[index]?.text));
}

function chargeFeeLines(
  column: ChargeReportModel["feeItemColumns"][number],
  amounts: Record<number, number>,
) {
  return column.map((item) => nz(amounts[item.feeItemId]));
}

function ChargeReportTable({ model }: { model: ChargeReportModel }) {
  return (
    <table>
      <thead>
        <tr>
          <HeaderCell lines={["년 월"]} />
          <HeaderCell lines={["당 월 분", "수 수 료"]} />
          <HeaderCell lines={["당월수납액", "연 체 료", "실수납액"]} />
          {model.feeItemColumns.map((column, index) => (
            <HeaderCell
              key={`fee-${index}`}
              lines={column.map((item) => item.name)}
            />
          ))}
        </tr>
      </thead>
      <tbody>
        {model.months.map((month) => (
          <tr key={month.period}>
            <td className="c">{month.periodLabel}</td>
            <td className="r">
              <PrintLines
                lines={[
                  nz(month.charged),
                  month.rate === null ? "" : `${month.rate.toFixed(1)} %`,
                  ...(month.fee !== 0 ? [nz(month.fee)] : []),
                ]}
              />
            </td>
            <td className="r">
              <PrintLines lines={[nz(month.paid), nz(month.lateFee), nz(month.netPaid)]} />
            </td>
            {model.feeItemColumns.map((column, index) => (
              <td className="r" key={`fee-${index}`}>
                <PrintLines lines={chargeFeeLines(column, month.feeItemAmounts)} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChargeReportTotal({ model }: { model: ChargeReportModel }) {
  const { totals } = model;
  return (
    <div className="ac-foot">
      <table>
        <tbody>
          <tr className="tot">
            <td className="c">총 계</td>
            <td className="r">
              <PrintLines
                lines={
                  totals.fee !== 0
                    ? [nz(totals.charged), "", nz(totals.fee)]
                    : [nz(totals.charged)]
                }
              />
            </td>
            <td className="r">
              <PrintLines lines={[nz(totals.paid), nz(totals.lateFee), nz(totals.netPaid)]} />
            </td>
            {model.feeItemColumns.map((column, index) => (
              <td className="r" key={`fee-${index}`}>
                <PrintLines lines={chargeFeeLines(column, totals.feeItemAmounts)} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MonthlyChargeReportTable({ model }: { model: MonthlyReportModel }) {
  return (
    <table>
      <thead>
        <tr>
          {model.columns.map((column) => (
            <HeaderCell key={column.key} lines={column.header} />
          ))}
        </tr>
      </thead>
      <tbody>
        {model.rows.map((row) => {
          const [period, current, paid, unpaid, ...feeColumns] = row.cells;
          const fee = monthlyAmount(current?.[2]?.text);
          return (
            <tr key={row.key}>
              <td className="c">
                <PrintLines lines={[period?.[0]?.text, period?.[1]?.text]} />
              </td>
              <td className="r">
                <PrintLines
                  lines={[
                    monthlyAmount(current?.[0]?.text),
                    monthlyRate(current?.[1]?.text),
                    ...(fee ? [fee] : []),
                  ]}
                />
              </td>
              <td className="r">
                <PrintLines lines={linesFromMonthlyCell(paid ?? [])} />
              </td>
              <td className="r">
                <PrintLines lines={linesFromMonthlyCell(unpaid ?? [])} />
              </td>
              {feeColumns.map((column, index) => (
                <td className="r" key={`fee-${index}`}>
                  <PrintLines lines={column.map((line) => monthlyAmount(line.text))} />
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function totalHouseholds(model: MonthlyReportModel): number {
  return model.rows.reduce(
    (total, row) => total + Number.parseInt(row.cells[0]?.[1]?.text ?? "0", 10),
    0,
  );
}

function MonthlyChargeReportTotal({ model }: { model: MonthlyReportModel }) {
  const [period, current, paid, unpaid, ...feeColumns] = model.total.cells;
  const fee = monthlyAmount(current?.[2]?.text);
  return (
    <div className="ac-foot">
      <table>
        <tbody>
          <tr className="tot">
            <td className="c">
              <PrintLines lines={[period?.[0]?.text, String(totalHouseholds(model))]} />
            </td>
            <td className="r">
              <PrintLines
                lines={fee ? [monthlyAmount(current?.[0]?.text), "", fee] : [monthlyAmount(current?.[0]?.text)]}
              />
            </td>
            <td className="r">
              <PrintLines lines={linesFromMonthlyCell(paid ?? [])} />
            </td>
            <td className="r">
              <PrintLines lines={linesFromMonthlyCell(unpaid ?? [])} />
            </td>
            {feeColumns.map((column, index) => (
              <td className="r" key={`fee-${index}`}>
                <PrintLines lines={column.map((line) => monthlyAmount(line.text))} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ChargeReportPrint({
  variant,
  model,
  buildingName,
  rangeLabel,
  paymentDayLabel,
  onDone,
}: {
  variant: "building" | "monthly";
  model: ChargeReportModel | MonthlyReportModel;
  buildingName: string;
  rangeLabel: string;
  paymentDayLabel: string;
  onDone: () => void;
}) {
  const isBuilding = variant === "building";
  const chargeModel = isBuilding ? (model as ChargeReportModel) : null;
  const monthlyModel = isBuilding ? null : (model as MonthlyReportModel);
  const summary = isBuilding
    ? {
        totalCurrentPaid: chargeModel?.totals.paid ?? 0,
        totalLateFee: chargeModel?.totals.lateFee ?? 0,
        totalFee: chargeModel?.totals.fee ?? 0,
        totalPaid: chargeModel?.totals.netPaid ?? 0,
      }
    : monthlyModel?.summary;

  return (
    <PrintSheet id="rcAmtPrint" css={PRINT_CSS} onDone={onDone}>
      <h1>
        [{" "}
        {isBuilding ? `${buildingName} 부과금액` : "월별 총 부과금액"} 및 수납자료 ]
      </h1>
      <div className="ac-meta">
        <span>기준월 : {rangeLabel}</span>
        <span>수납일 : {paymentDayLabel}</span>
        <span>총당월수납액 : {nz(summary?.totalCurrentPaid)}</span>
        <span>총연체료 : {nz(summary?.totalLateFee)}</span>
        <span>총수수료 : {nz(summary?.totalFee)}</span>
        <span>총수납액 : {nz(summary?.totalPaid)}</span>
      </div>
      {isBuilding && chargeModel ? (
        <>
          <ChargeReportTable model={chargeModel} />
          <ChargeReportTotal model={chargeModel} />
        </>
      ) : monthlyModel ? (
        <>
          <MonthlyChargeReportTable model={monthlyModel} />
          <MonthlyChargeReportTotal model={monthlyModel} />
        </>
      ) : null}
    </PrintSheet>
  );
}
