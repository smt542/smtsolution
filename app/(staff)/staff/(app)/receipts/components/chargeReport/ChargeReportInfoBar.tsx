import { formatNumber } from "@/lib/format";

interface ChargeReportInfoBarProps {
  buildingName: string;
  rangeLabel: string; // 기준월 범위 '2026.01 ~ 2026.08'
  paymentDayLabel: string; // 수납일 '전체' 또는 날짜 범위
  totalPaid: number; // 총당월수납액
  totalLateFee: number; // 총연체료
  totalFee: number; // 총수수료
  totalNetPaid: number; // 총수납액(실수납)
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <i className="text-[11.5px] font-medium not-italic text-t3">{label}</i>
      <b className="text-[12px] font-medium tabular-nums text-t1">{value}</b>
    </span>
  );
}

export function ChargeReportInfoBar({
  buildingName,
  rangeLabel,
  paymentDayLabel,
  totalPaid,
  totalLateFee,
  totalFee,
  totalNetPaid,
}: ChargeReportInfoBarProps) {
  // 정본 `.ac-head`의 제목·조건·KPI 배치를 그대로 유지한다.
  return (
    <div className="shrink-0 border-b border-line bg-white px-[16px] pb-[13px] pt-[15px]">
      <p className="mb-[10px] text-center text-[15px] font-bold tracking-[-0.02em] text-t1">
        [ {buildingName || "건물"} 부과금액 및 수납자료 ]
      </p>
      <div className="flex flex-wrap items-center justify-center gap-[18px]">
        <span className="inline-flex items-center gap-[6px] border-r border-line pr-[12px] text-[12px] font-medium text-t1">
          <i className="text-[11.5px] font-medium not-italic text-t3">기준월</i>
          {rangeLabel}
          <i className="ml-[6px] text-[11.5px] font-medium not-italic text-t3">수납일</i>
          {paymentDayLabel}
        </span>
        <InfoItem
          label="총당월수납액"
          value={formatNumber(totalPaid, { nullText: "-" })}
        />
        <InfoItem label="총연체료" value={formatNumber(totalLateFee, { nullText: "-" })} />
        <InfoItem label="총수수료" value={formatNumber(totalFee, { nullText: "-" })} />
        <InfoItem label="총수납액" value={formatNumber(totalNetPaid, { nullText: "-" })} />
      </div>
    </div>
  );
}
