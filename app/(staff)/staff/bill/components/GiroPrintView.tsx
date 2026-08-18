import type { BillDocument, BillTarget } from "@/hooks/reactquery/bill";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  buildOutputQrPayload,
  formatBillAmount,
  giroDocumentAmount,
  unitLabel,
  type PrintableAccount,
} from "@/lib/bill/document";
import { QrCode } from "./QrCode";

export interface GiroOutputDocument {
  building: Building;
  document: BillDocument;
  target: BillTarget;
  dueDate: string | null;
}

export interface GiroStampOptions {
  reissue: boolean;
  waterCutoffUnitIds: number[];
  autoDebit: boolean;
}

interface GiroPrintViewProps {
  companyName: string;
  period: string;
  documents: GiroOutputDocument[];
  accounts: PrintableAccount[];
  customerNotice: string | null;
  stamps: GiroStampOptions;
}

function periodLabel(period: string) {
  return `${period.slice(0, 4)}년 ${Number(period.slice(5, 7))}월분`;
}

export function GiroPrintView({
  companyName,
  period,
  documents,
  accounts,
  customerNotice,
  stamps,
}: GiroPrintViewProps) {
  return (
    <div className="space-y-5 text-black" data-testid="giro-print-view">
      {documents.map(({ building, document, target, dueDate }) => {
        const amount = giroDocumentAmount(document);
        const householdName = unitLabel(
          target.billNameDisplay,
          document.unitNo,
          target.tenantName,
          target.payerName,
          target.payerNo,
        );
        const nameDisplayLabel = {
          none: "이름 미출력",
          name: "이름 출력",
          code: "코드번호 출력",
        }[target.billNameDisplay];
        return (
          <article
            key={`${building.id}-${document.unitId}`}
            className="relative mx-auto min-h-[176mm] w-[190mm] overflow-hidden border border-slate-500 bg-white p-[8mm] shadow-sm print:min-h-[270mm] print:w-[190mm] print:break-after-page print:border-0 print:shadow-none"
          >
            <div className="pointer-events-none absolute inset-0 flex rotate-[-28deg] items-center justify-center text-6xl font-black text-slate-100">
              {companyName}
            </div>

            <div className="relative">
              <header className="flex items-start justify-between border-b-2 border-black pb-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.22em]">GIRO MANAGEMENT BILL</p>
                  <h1 className="mt-1 text-2xl font-black">지로 관리비 고지서</h1>
                  <p className="mt-1 text-sm font-bold">{building.name} · {periodLabel(period)}</p>
                  <p className="mt-1 text-xs text-slate-600">{building.address ?? "주소 미등록"}</p>
                </div>
                <div className="text-center">
                  <QrCode value={buildOutputQrPayload("giro", document.unitId, period)} size={78} />
                  <p className="mt-1 text-[9px]">고지서 확인 QR</p>
                </div>
              </header>

              <div className="mt-4 grid grid-cols-[1fr_1fr] border-y border-black text-sm">
                <dl className="grid grid-cols-[72px_1fr] border-r border-black">
                  <dt className="border-b border-r border-slate-400 bg-slate-100 p-2 font-bold">호수</dt>
                  <dd className="border-b border-slate-400 p-2 font-black">{document.dong ? `${document.dong} ` : ""}{document.unitNo}호</dd>
                  <dt className="border-r border-slate-400 bg-slate-100 p-2 font-bold">세대주</dt>
                  <dd className="p-2" data-testid={`giro-household-name-${document.unitId}`}>{householdName}</dd>
                </dl>
                <dl className="grid grid-cols-[72px_1fr]">
                  <dt className="border-b border-r border-slate-400 bg-slate-100 p-2 font-bold">핸드폰</dt>
                  <dd className="border-b border-slate-400 p-2">{target.phone || "-"}</dd>
                  <dt className="border-r border-slate-400 bg-slate-100 p-2 font-bold">이체</dt>
                  <dd className="p-2 font-bold">{document.autoDebit ? "자동이체" : "일반납부"}</dd>
                </dl>
              </div>

              <div className="relative mt-5 rounded-sm border-2 border-black p-5 text-center">
                <p className="text-xs font-bold tracking-[0.3em] text-slate-600">당월 납부 금액</p>
                <p className="mt-2 text-4xl font-black tabular-nums">{formatBillAmount(amount)}</p>
                {document.autoDebit && (
                  <p className="mt-2 inline-flex rounded-full border border-black px-3 py-1 text-xs font-black">
                    자동이체 신청 세대
                  </p>
                )}
                <div className="absolute -right-2 -top-3 flex gap-2">
                  {stamps.reissue && <span className="rotate-[-7deg] border-2 border-red-600 px-2 py-1 text-sm font-black text-red-600">재발행</span>}
                  {stamps.waterCutoffUnitIds.includes(document.unitId) && <span className="rotate-[5deg] border-2 border-blue-700 px-2 py-1 text-sm font-black text-blue-700">단수</span>}
                  {stamps.autoDebit && document.autoDebit && <span className="rotate-[-4deg] border-2 border-emerald-700 px-2 py-1 text-sm font-black text-emerald-700">자동이체</span>}
                </div>
              </div>

              <table className="mt-5 w-full border-collapse text-xs">
                <thead>
                  <tr className="border-y border-black bg-slate-100">
                    <th className="p-2 text-left">부과 항목</th>
                    <th className="p-2 text-right">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {document.items.filter((item) => item.charged).map((item) => (
                    <tr key={item.feeItemId} className="border-b border-slate-300">
                      <td className="p-2">{item.name}</td>
                      <td className="p-2 text-right tabular-nums">{formatBillAmount(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-dashed border-slate-500 pt-4 text-xs">
                <div>
                  <p className="font-black">납부 계좌</p>
                  {accounts.length === 0 ? <p className="mt-1 text-slate-500">등록된 출력 계좌 없음</p> : accounts.map((account, index) => (
                    <p key={`${account.bank}-${index}`} className="mt-1">{account.bank} {account.acct} ({account.holder})</p>
                  ))}
                </div>
                <div>
                  <p className="font-black">납기일</p>
                  <p className="mt-1">{dueDate ?? "________________"}</p>
                </div>
              </div>
              {(customerNotice || document.unitNotice) && (
                <div className="mt-4 whitespace-pre-wrap rounded border border-slate-300 p-3 text-[10px] leading-4">
                  {[customerNotice, document.unitNotice].filter(Boolean).join("\n")}
                </div>
              )}
              <footer className="mt-5 flex justify-between border-t border-black pt-3 text-[10px]">
                <span>발행 회사 · <strong>{companyName}</strong></span>
                <span>{nameDisplayLabel}</span>
              </footer>
            </div>
          </article>
        );
      })}
    </div>
  );
}
