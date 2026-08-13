"use client";
import type { BillDocument } from "@/hooks/reactquery/bill";
import { unitLabel, buildQrPayload, billDocumentTotal, PROGRAM_COMPANY_NAME, type PrintableAccount } from "@/lib/bill/document";
import { QrCode } from "./QrCode";

export interface BillPrintViewProps {
  buildingName: string;
  period: string;                 // 'YYYY-MM-01'
  unitLabelMode: "code" | "name";
  dueDate: string | null;
  accounts: PrintableAccount[];
  customerNotice: string | null;
  documents: BillDocument[];
  qrBase?: string | null;
}

export function BillPrintView({ buildingName, period, unitLabelMode, dueDate, accounts, customerNotice, documents, qrBase }: BillPrintViewProps) {
  const ym = `${period.slice(0, 4)}년 ${period.slice(5, 7)}월`;
  return (
    <div className="hidden print:block" data-testid="bill-print">
      {documents.map((d) => {
        const items = d.items.filter((i) => i.charged);
        const total = d.totalAmount || billDocumentTotal(d.items);
        return (
          <div key={d.unitId} className="break-after-page p-6 text-black">
            <div className="flex items-start justify-between">
              <h1 className="text-xl font-bold">{buildingName} {ym} 관리비 고지서</h1>
              <QrCode value={buildQrPayload(d.unitId, period, qrBase)} />
            </div>
            <div className="mt-2 text-sm">
              세대: {unitLabel(unitLabelMode, d.unitNo, d.tenantName)}
              {d.autoDebit && <span className="ml-2 font-bold">[자동이체]</span>}
            </div>
            <table className="mt-4 w-full text-sm">
              <tbody>
                {items.map((i) => (
                  <tr key={i.feeItemId}><td>{i.name}</td><td className="text-right">{i.amount.toLocaleString()}원</td></tr>
                ))}
                <tr className="border-t font-bold"><td>합계</td><td className="text-right">{total.toLocaleString()}원</td></tr>
              </tbody>
            </table>
            <div className="mt-3 text-sm">납기일: {dueDate ?? "-"}</div>
            {accounts.length > 0 && (
              <div className="mt-3 text-sm">
                {accounts.map((a, idx) => (<div key={idx}>입금계좌: {a.bank} {a.acct} ({a.holder})</div>))}
              </div>
            )}
            {customerNotice && <div className="mt-3 whitespace-pre-wrap text-xs">{customerNotice}</div>}
            {d.unitNotice && <div className="mt-1 whitespace-pre-wrap text-xs">{d.unitNotice}</div>}
            <div className="mt-6 text-right text-[10px] text-gray-500">{PROGRAM_COMPANY_NAME}</div>
          </div>
        );
      })}
    </div>
  );
}
