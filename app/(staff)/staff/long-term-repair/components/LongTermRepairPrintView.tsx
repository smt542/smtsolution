export interface LongTermRepairPrintRow {
  key: string;
  entryDate: string;
  entryNo: string;
  fundNote: string;
  deposit: number;
  withdrawal: number;
  balance: number;
}

interface LongTermRepairPrintViewProps {
  buildingName: string;
  companyName: string;
  startMonth: string;
  endMonth: string;
  rows: LongTermRepairPrintRow[];
}

function formatMoney(value: number) {
  return value.toLocaleString("ko-KR");
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${year}년 ${Number(month)}월`;
}

export function LongTermRepairPrintView({
  buildingName,
  companyName,
  startMonth,
  endMonth,
  rows,
}: LongTermRepairPrintViewProps) {
  const depositTotal = rows.reduce((sum, row) => sum + row.deposit, 0);
  const withdrawalTotal = rows.reduce((sum, row) => sum + row.withdrawal, 0);
  const currentBalance = rows.at(-1)?.balance ?? 0;

  return (
    <article className="relative mx-auto hidden min-h-[270mm] w-[190mm] overflow-hidden bg-white p-[10mm] text-black print:block" data-testid="long-term-repair-print">
      <div className="pointer-events-none absolute inset-0 flex rotate-[-28deg] items-center justify-center text-6xl font-black text-slate-100">
        {companyName}
      </div>
      <div className="relative">
        <header className="border-b-2 border-black pb-4 text-center">
          <p className="text-xs font-bold tracking-[0.2em]">LONG-TERM REPAIR FUND LEDGER</p>
          <h1 className="mt-1 text-2xl font-black">장기수선비 적립금 원장</h1>
          <p className="mt-2 text-sm font-bold">
            {buildingName} · {monthLabel(startMonth)} ~ {monthLabel(endMonth)}
          </p>
        </header>

        <table className="mt-6 w-full table-fixed border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="w-[17%] border border-black p-2">일자</th>
              <th className="w-[10%] border border-black p-2">번호</th>
              <th className="w-[27%] border border-black p-2">적립금내용</th>
              <th className="w-[15%] border border-black p-2 text-right">입금액</th>
              <th className="w-[15%] border border-black p-2 text-right">출금액</th>
              <th className="w-[16%] border border-black p-2 text-right">차인잔액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="border border-black p-2 text-center">{row.entryDate}</td>
                <td className="border border-black p-2 text-center">{row.entryNo || "-"}</td>
                <td className="border border-black p-2">{row.fundNote}</td>
                <td className="border border-black p-2 text-right tabular-nums">{row.deposit ? formatMoney(row.deposit) : "-"}</td>
                <td className="border border-black p-2 text-right tabular-nums">{row.withdrawal ? formatMoney(row.withdrawal) : "-"}</td>
                <td className={`border border-black p-2 text-right font-bold tabular-nums ${row.balance < 0 ? "text-red-700" : ""}`}>
                  {formatMoney(row.balance)}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-black">
              <td colSpan={3} className="border border-black p-2 text-right">합계 &gt;&gt; 현잔액</td>
              <td className="border border-black p-2 text-right tabular-nums">{formatMoney(depositTotal)}</td>
              <td className="border border-black p-2 text-right tabular-nums">{formatMoney(withdrawalTotal)}</td>
              <td className={`border border-black p-2 text-right tabular-nums ${currentBalance < 0 ? "text-red-700" : ""}`}>
                {formatMoney(currentBalance)}
              </td>
            </tr>
          </tbody>
        </table>

        <footer className="mt-6 flex justify-between border-t border-black pt-3 text-[10px]">
          <span>출력 회사 · <strong>{companyName}</strong></span>
          <span>입금 합계 {formatMoney(depositTotal)} · 출금 합계 {formatMoney(withdrawalTotal)}</span>
        </footer>
      </div>
    </article>
  );
}
