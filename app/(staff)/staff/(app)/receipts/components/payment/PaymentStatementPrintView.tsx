import type { Building } from "@/hooks/reactquery/buildings";
import type { UtilityType } from "@/hooks/reactquery/utilities";
import { formatNumber, formatWon } from "@/lib/format";

export interface PaymentStatementUtility {
  amount: number | null;
  previousReading: number | null;
  currentReading: number | null;
  usage: number | null;
  unitPrice: number | null;
}

export interface PaymentStatementRow {
  key: string;
  period: string;
  unitNo: string;
  dong: string | null;
  tenantName: string | null;
  paymentDates: string[];
  charged: number | null;
  lateFee: number;
  paid: number;
  unpaid: number | null;
  utilities: Record<UtilityType, PaymentStatementUtility>;
}

interface PaymentStatementPrintViewProps {
  building: Building;
  companyName: string;
  startPeriod: string;
  endPeriod: string;
  scopeLabel: string;
  utilityTypes: UtilityType[];
  rows: PaymentStatementRow[];
}

const UTILITY_LABEL: Record<UtilityType, string> = {
  electricity: "전기",
  water: "수도",
  gas: "가스",
};

function formatMoney(value: number | null) {
  return formatNumber(value, { nullText: "-" });
}

function formatReading(value: number | null) {
  return formatNumber(value, { nullText: "-", fractionDigits: 3 });
}

function periodLabel(period: string) {
  return `${period.slice(0, 4)}-${period.slice(5, 7)}`;
}

function unitLabel(row: PaymentStatementRow) {
  return `${row.dong ? `${row.dong} ` : ""}${row.unitNo}`;
}

function chunkRows(rows: PaymentStatementRow[], size = 6) {
  if (rows.length === 0) return [[]] as PaymentStatementRow[][];
  return Array.from(
    { length: Math.ceil(rows.length / size) },
    (_, index) => rows.slice(index * size, (index + 1) * size),
  );
}

export function PaymentStatementPrintView({
  building,
  companyName,
  startPeriod,
  endPeriod,
  scopeLabel,
  utilityTypes,
  rows,
}: PaymentStatementPrintViewProps) {
  const pages = chunkRows(rows);
  const chargedTotal = rows.reduce((sum, row) => sum + (row.charged ?? 0), 0);
  const lateFeeTotal = rows.reduce((sum, row) => sum + row.lateFee, 0);
  const paidTotal = rows.reduce((sum, row) => sum + row.paid, 0);
  const unpaidTotal = rows.reduce((sum, row) => sum + (row.unpaid ?? 0), 0);

  return (
    <div className="space-y-5 text-black print:space-y-0" data-testid="payment-statement-print-view">
      {pages.map((pageRows, pageIndex) => {
        const isLastPage = pageIndex === pages.length - 1;
        return (
          <article
            key={`${pageIndex}-${pageRows[0]?.key ?? "empty"}`}
            className="relative mx-auto min-h-[190mm] w-[277mm] overflow-hidden bg-white p-[10mm] shadow-sm print:break-after-page print:shadow-none last:print:break-after-auto"
          >
            <div className="pointer-events-none absolute inset-0 flex rotate-[-28deg] items-center justify-center text-7xl font-black text-slate-100">
              {companyName}
            </div>
            <div className="relative">
              <header className="flex items-end justify-between border-b-2 border-black pb-3">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.2em]">PAYMENT STATEMENT</p>
                  <h1 className="mt-1 text-2xl font-black">수납명세서</h1>
                  <p className="mt-1 text-xs font-bold">
                    {building.name} · {scopeLabel}
                  </p>
                </div>
                <div className="text-right text-[10px]">
                  <p>조회기간 · {periodLabel(startPeriod)} ~ {periodLabel(endPeriod)}</p>
                  <p className="mt-1">{pageIndex + 1} / {pages.length} 페이지</p>
                </div>
              </header>

              {pageRows.length === 0 ? (
                <div className="mt-8 border border-dashed border-slate-400 p-12 text-center text-sm text-slate-500">
                  검색 결과가 없습니다.
                </div>
              ) : (
                <table className="mt-4 w-full border-collapse text-[9px]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-black p-1.5">년월</th>
                      <th className="border border-black p-1.5">세대</th>
                      <th className="border border-black p-1.5">세대주</th>
                      <th className="border border-black p-1.5">수납일</th>
                      <th className="border border-black p-1.5 text-right">당월계</th>
                      <th className="border border-black p-1.5 text-right">연체료</th>
                      <th className="border border-black p-1.5 text-right">수납액</th>
                      <th className="border border-black p-1.5 text-right">미납액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <PaymentStatementTableRows
                        key={row.key}
                        row={row}
                        utilityTypes={utilityTypes}
                      />
                    ))}
                  </tbody>
                </table>
              )}

              {isLastPage && rows.length > 0 && (
                <div className="mt-4 grid grid-cols-4 border-y-2 border-black text-[11px]">
                  <Total label="당월계 합계" value={chargedTotal} />
                  <Total label="연체료 합계" value={lateFeeTotal} />
                  <Total label="수납액 합계" value={paidTotal} />
                  <Total label="미납액 합계" value={unpaidTotal} />
                </div>
              )}

              <footer className="mt-4 flex justify-between border-t border-black pt-2 text-[9px]">
                <span>{building.address ?? "주소 미등록"}</span>
                <strong>{companyName}</strong>
              </footer>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PaymentStatementTableRows({
  row,
  utilityTypes,
}: {
  row: PaymentStatementRow;
  utilityTypes: UtilityType[];
}) {
  return (
    <>
      <tr>
        <td className="border border-black p-1.5 text-center">{periodLabel(row.period)}</td>
        <td className="border border-black p-1.5 font-bold">{unitLabel(row)}</td>
        <td className="border border-black p-1.5">{row.tenantName ?? "-"}</td>
        <td className="border border-black p-1.5 text-center">
          {row.paymentDates.length > 0 ? row.paymentDates.join(", ") : "-"}
        </td>
        <td className="border border-black p-1.5 text-right tabular-nums">{formatMoney(row.charged)}</td>
        <td className="border border-black p-1.5 text-right tabular-nums">{formatMoney(row.lateFee)}</td>
        <td className="border border-black p-1.5 text-right font-bold tabular-nums">{formatMoney(row.paid)}</td>
        <td className="border border-black p-1.5 text-right tabular-nums">{formatMoney(row.unpaid)}</td>
      </tr>
      {utilityTypes.length > 0 && (
        <tr>
          <td colSpan={8} className="border border-black bg-slate-50 px-2 py-1">
            <table className="w-full table-fixed text-[8px]">
              <thead>
                <tr className="text-slate-600">
                  <th className="text-left">공과금</th>
                  <th className="text-right">금액</th>
                  <th className="text-right">전월지침</th>
                  <th className="text-right">금월지침</th>
                  <th className="text-right">사용량</th>
                  <th className="text-right">단가</th>
                </tr>
              </thead>
              <tbody>
                {utilityTypes.map((type) => {
                  const utility = row.utilities[type];
                  return (
                    <tr key={type}>
                      <td className="font-bold">{UTILITY_LABEL[type]}</td>
                      <td className="text-right tabular-nums">{formatMoney(utility.amount)}</td>
                      <td className="text-right tabular-nums">{formatReading(utility.previousReading)}</td>
                      <td className="text-right tabular-nums">{formatReading(utility.currentReading)}</td>
                      <td className="text-right tabular-nums">{formatReading(utility.usage)}</td>
                      <td className="text-right tabular-nums">{formatMoney(utility.unitPrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-r border-black px-3 py-2 last:border-r-0">
      <span className="font-bold">{label}</span>
      <strong className="tabular-nums">{formatWon(value)}</strong>
    </div>
  );
}
