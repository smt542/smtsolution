import type { Building } from "@/hooks/reactquery/buildings";
import type { PaymentRow, UnitPayment } from "@/hooks/reactquery/payments";
import { KIND_LABEL, METHOD_LABEL } from "../constants";

interface PaymentReceiptPrintViewProps {
  building: Building;
  companyName: string;
  row: PaymentRow;
  payment: UnitPayment;
  period: string;
  lateFee: number;
  receiverName: string | null;
}

function formatMoney(value: number | null) {
  return value === null ? "-" : `${value.toLocaleString("ko-KR")}원`;
}

function periodLabel(period: string) {
  return `${period.slice(0, 4)}년 ${Number(period.slice(5, 7))}월`;
}

function unitLabel(row: PaymentRow) {
  return `${row.dong ? `${row.dong} ` : ""}${row.unitNo}`;
}

export function PaymentReceiptPrintView({
  building,
  companyName,
  row,
  payment,
  period,
  lateFee,
  receiverName,
}: PaymentReceiptPrintViewProps) {
  const fields = [
    ["건물", building.name],
    ["호실", unitLabel(row)],
    ["세대주", row.tenantName ?? "-"],
    ["부과년월", periodLabel(period)],
    ["당월계", formatMoney(row.charged)],
    ["연체료", formatMoney(lateFee)],
    ["수납액", formatMoney(payment.amount)],
    ["수납일자", payment.paidAt],
    ["수납방법 / 은행", METHOD_LABEL[payment.method]],
    ["수납구분", KIND_LABEL[payment.kind]],
    ["수납자", receiverName ?? "-"],
  ] as const;

  return (
    <article
      className="relative mx-auto min-h-[277mm] w-[190mm] overflow-hidden bg-white p-[14mm] text-black shadow-sm print:shadow-none"
      data-testid="payment-receipt-print-view"
    >
      <div className="pointer-events-none absolute inset-0 flex rotate-[-30deg] items-center justify-center text-6xl font-black text-slate-100">
        {companyName}
      </div>
      <div className="relative">
        <header className="border-b-2 border-black pb-5 text-center">
          <p className="text-xs font-bold tracking-[0.24em]">PAYMENT RECEIPT</p>
          <h1 className="mt-2 text-3xl font-black">관리비 수납 영수증</h1>
          <p className="mt-2 text-xs text-slate-600">영수증 번호 · PAY-{payment.id}</p>
        </header>

        <dl className="mt-8 grid grid-cols-2 border-x border-t border-black text-sm">
          {fields.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[105px_1fr] border-b border-black odd:border-r">
              <dt className="bg-slate-100 p-3 font-bold">{label}</dt>
              <dd className="p-3 text-right font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 border-y-2 border-black px-5 py-5 text-right">
          <span className="mr-6 text-base font-bold">영수증 합계</span>
          <strong className="text-3xl font-black tabular-nums">
            {formatMoney(payment.amount)}
          </strong>
        </div>

        {payment.memo && (
          <div className="mt-6 border border-slate-400 p-4 text-sm">
            <strong>비고</strong>
            <p className="mt-2 whitespace-pre-wrap text-slate-700">{payment.memo}</p>
          </div>
        )}

        <p className="mt-10 text-center text-sm leading-7">
          위 금액을 관리비로 정히 수납하였습니다.
        </p>

        <footer className="mt-12 flex items-end justify-between border-t border-black pt-4 text-xs">
          <div>
            <p className="font-bold">{building.name}</p>
            <p className="mt-1 text-slate-600">{building.address ?? "주소 미등록"}</p>
          </div>
          <div className="text-right">
            <p>발행 회사</p>
            <strong className="mt-1 block text-base">{companyName}</strong>
          </div>
        </footer>
      </div>
    </article>
  );
}
