import { formatNumber } from "@/lib/format";

interface ChargeReportInfoBarProps {
  rangeLabel: string; // 기준월 범위 '2026.01 ~ 2026.08'
  paymentDayLabel: string; // 수납일 '전체' 또는 날짜 범위
  totalPaid: number; // 총당월수납액
  totalLateFee: number; // 총연체료
  totalFee: number; // 총수수료
  totalNetPaid: number; // 총수납액(실수납)
}

function InfoItem({
  label,
  value,
  bordered = false,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div className={`flex items-center gap-[6px] ${bordered ? "border-r border-line pr-[18px]" : ""}`}>
      <span className="text-[11.5px] font-medium text-t3">{label}</span>
      <span className="text-[12px] font-medium tabular-nums text-t1">{value}</span>
    </div>
  );
}

export function ChargeReportInfoBar({
  rangeLabel,
  paymentDayLabel,
  totalPaid,
  totalLateFee,
  totalFee,
  totalNetPaid,
}: ChargeReportInfoBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-[18px] gap-y-[6px] pt-[7px]">
      <InfoItem label="기준월" value={rangeLabel} />
      <InfoItem label="수납일" value={paymentDayLabel} bordered />
      <InfoItem label="총당월수납액" value={formatNumber(totalPaid, { nullText: "-" })} />
      <InfoItem label="총연체료" value={formatNumber(totalLateFee, { nullText: "-" })} />
      <InfoItem label="총수수료" value={formatNumber(totalFee, { nullText: "-" })} />
      <InfoItem label="총수납액" value={formatNumber(totalNetPaid, { nullText: "-" })} />
    </div>
  );
}
