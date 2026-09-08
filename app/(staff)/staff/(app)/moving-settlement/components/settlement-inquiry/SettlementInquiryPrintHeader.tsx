import type { SettlementInquiryType } from "@/hooks/reactquery/movingSettlement";

const TYPE_LABELS: Record<SettlementInquiryType, string> = {
  water: "수도",
  electric: "전기",
  gas: "가스",
  all: "전체",
};

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return `${year}년 ${Number(value)}월`;
}

interface SettlementInquiryPrintHeaderProps {
  type: SettlementInquiryType;
  companyName: string;
  fromMonth: string;
  toMonth: string;
}

export function SettlementInquiryPrintHeader({
  type,
  companyName,
  fromMonth,
  toMonth,
}: SettlementInquiryPrintHeaderProps) {
  return (
    <div className="relative z-10 hidden pb-5 text-black print:block" data-testid="settlement-inquiry-print-header">
      <div className="pointer-events-none fixed inset-0 -z-10 hidden rotate-[-28deg] items-center justify-center text-7xl font-black text-slate-100 print:flex">
        {companyName}
      </div>
      <header className="border-b-2 border-black pb-4 text-center">
        <p className="text-xs font-bold tracking-[0.2em]">MOVING SETTLEMENT INQUIRY</p>
        <h1 className="mt-1 text-2xl font-black">{TYPE_LABELS[type]} 이사조회</h1>
        <p className="mt-2 text-sm font-bold">
          {monthLabel(fromMonth)} ~ {monthLabel(toMonth)} · {companyName}
        </p>
      </header>
    </div>
  );
}
