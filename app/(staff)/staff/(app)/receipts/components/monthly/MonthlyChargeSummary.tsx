import { formatNumber, type MonthlySummary } from "./monthlyChargeData";

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <i className="text-[11.5px] font-medium not-italic text-t3">{label}</i>
      <b className="num text-[12px] font-medium tabular-nums text-t1">{value}</b>
    </span>
  );
}

export function MonthlyChargeSummary({
  title,
  summary,
}: {
  title: string;
  summary: MonthlySummary;
}) {
  // 정본 .ac-head의 제목·조건·KPI 배치를 그대로 유지한다.
  return (
    <div className="shrink-0 border-b border-line bg-white px-[16px] pb-[13px] pt-[15px]">
      <p className="mb-[10px] text-center text-[15px] font-bold tracking-[-0.02em] text-t1">
        {title}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-[18px]">
        <span className="inline-flex items-center gap-[6px] border-r border-line pr-[12px] text-[12px] font-medium text-t1">
          <i className="text-[11.5px] font-medium not-italic text-t3">기준월</i>
          {summary.periodRange}
          <i className="ml-[6px] text-[11.5px] font-medium not-italic text-t3">수납일</i>
          {summary.paymentDate}
        </span>
        <SummaryField label="총당월수납액" value={formatNumber(summary.totalCurrentPaid)} />
        <SummaryField label="총연체료" value={formatNumber(summary.totalLateFee)} />
        <SummaryField label="총수수료" value={formatNumber(summary.totalFee)} />
        <SummaryField label="총수납액" value={formatNumber(summary.totalPaid)} />
      </div>
    </div>
  );
}
