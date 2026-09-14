import { formatNumber } from "@/lib/format";

interface ChargeReportInfoBarProps {
  rangeLabel: string; // 기준월 범위 '2026.01 ~ 2026.08'
  paymentDayLabel: string; // 수납일 '전체' 또는 날짜 범위
  totalPaid: number; // 총당월수납액
  totalLateFee: number; // 총연체료
  totalFee: number; // 총수수료
  totalNetPaid: number; // 총수납액(실수납)
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-[7px]">
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
    <div className="flex items-center justify-center gap-[18px] pt-[10px]">
      {/* 기준월 + 수납일을 하나의 그룹으로 묶어 border-r 구분 (피그마 15:11271) */}
      <div className="flex items-center gap-[7px] border-r border-line pr-[12px]">
        <span className="text-[11.5px] font-medium text-t3">기준월</span>
        <span className="text-[12px] font-medium tabular-nums text-t1">{rangeLabel}</span>
        <span className="pl-[6px] text-[11.5px] font-medium text-t3">수납일</span>
        <span className="text-[12px] font-medium tabular-nums text-t1">{paymentDayLabel}</span>
      </div>
      <InfoItem label="총당월수납액" value={formatNumber(totalPaid, { nullText: "-" })} />
      <InfoItem label="총연체료" value={formatNumber(totalLateFee, { nullText: "-" })} />
      <InfoItem label="총수수료" value={formatNumber(totalFee, { nullText: "-" })} />
      <InfoItem label="총수납액" value={formatNumber(totalNetPaid, { nullText: "-" })} />
    </div>
  );
}
