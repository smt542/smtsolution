import type { BillDocument } from "@/lib/billing/billDoc";
import { QRCode } from "./QRCode";

export interface BillPreviewProps {
  docs: BillDocument[];
  issueType: "giro" | "a4";
  companyName?: string;
}

export function BillPreview({ docs, issueType, companyName }: BillPreviewProps) {
  return (
    <div className="bill-print space-y-6">
      {docs.map((doc) => (
        <article
          key={doc.unitId}
          className={`bill-page border border-line p-6 ${
            issueType === "giro" ? "bill-giro" : "bill-a4"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              {companyName && <p className="text-xs text-t3">{companyName}</p>}
              <h2 className="text-base font-bold text-t1">{doc.title} 관리비 고지서</h2>
              <p className="text-xs text-t3">
                호실 {doc.unitNo} · 부과월 {doc.period.slice(0, 7)}
                {doc.dueDate ? ` · 납기일 ${doc.dueDate}` : ""}
              </p>
            </div>
            <QRCode value={doc.qrValue} />
          </div>

          <table className="mt-4 w-full text-sm" aria-label={`${doc.unitNo} 고지 내역`}>
            <tbody>
              {doc.lines.map((line) => (
                <tr key={line.name} className="border-b border-line/60">
                  <td className="py-1">{line.name}</td>
                  <td className="py-1 text-right tabular-nums">
                    {line.amount.toLocaleString("ko-KR")}
                  </td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-1">합계</td>
                <td className="py-1 text-right tabular-nums">
                  {doc.total.toLocaleString("ko-KR")}
                </td>
              </tr>
            </tbody>
          </table>

          {doc.accounts.length > 0 && (
            <p className="mt-3 text-xs text-t2">
              입금계좌: {doc.accounts
                .map((account) => `${account.bank} ${account.acct} (${account.holder})`)
                .join(" · ")}
            </p>
          )}

          {doc.showCutoff && (
            <p className="mt-2 text-xs font-bold text-danger">
              미납 시 단전·단수 예고 대상입니다.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
