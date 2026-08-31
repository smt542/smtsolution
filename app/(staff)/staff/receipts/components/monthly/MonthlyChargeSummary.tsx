import { formatNumber, type MonthlySummary } from "./monthlyChargeData";

// 상단 요약 바: 중앙 제목 + 요약 필드들(라벨 t3 / 값 t1). 값은 실데이터 총계.

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-[7px]">
      <span className="text-[11.5px] font-medium text-t3">{label}</span>
      <span className="num text-[12px] font-medium text-t1">{value}</span>
    </div>
  );
}

export function MonthlyChargeSummary({
  title,
  summary,
}: {
  title: string;
  summary: MonthlySummary;
}) {
  return (
    <div className="flex h-[70px] w-full shrink-0 flex-col items-start justify-center border-b border-line bg-surface px-[16px]">
      <p className="w-full text-center text-[15px] font-bold tracking-[-0.3px] text-t1">{title}</p>
      <div className="flex w-full flex-wrap items-center justify-center gap-[18px] pt-[7px]">
        <div className="flex items-center gap-[7px] border-r border-line pr-[12px]">
          <span className="text-[11.5px] font-medium text-t3">기준월</span>
          <span className="num text-[12px] font-medium text-t1">{summary.periodRange}</span>
          <span className="pl-[6px] text-[11.5px] font-medium text-t3">수납일</span>
          <span className="text-[12px] font-medium text-t1">{summary.paymentDate}</span>
        </div>
        <SummaryField label="총당월수납액" value={formatNumber(summary.totalCurrentPaid)} />
        <SummaryField label="총연체료" value={formatNumber(summary.totalLateFee)} />
        <SummaryField label="총수수료" value={formatNumber(summary.totalFee)} />
        <SummaryField label="총수납액" value={formatNumber(summary.totalPaid)} />
      </div>
    </div>
  );
}
