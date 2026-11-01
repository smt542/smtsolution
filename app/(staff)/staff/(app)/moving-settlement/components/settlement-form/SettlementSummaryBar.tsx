import { formatNumber } from "@/lib/format";
import { SubtotalInput } from "./SubtotalInput";

function SummaryItem({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "red" | "teal" }) {
  const color = tone === "red" ? "text-red" : tone === "teal" ? "text-teal-d" : "text-t1";
  return (
    <div className="mr-[14px] flex h-[16px] items-baseline gap-[6px] whitespace-nowrap border-r border-line pr-[14px]">
      <span className="text-[11.5px] font-bold leading-[14px] text-t3">{label}</span>
      <strong className={`text-[14px] font-extrabold leading-[17px] ${color}`}>{formatNumber(value)}</strong>
    </div>
  );
}

export function SettlementSummaryBar({
  utilityTotal,
  managementTotal,
  otherTotal,
  cleaningTotal = 0,
  receivedAmount,
  total,
  billingUnpaid,
  unpaidOverride = null,
  onUnpaidOverrideChange = () => undefined,
}: {
  utilityTotal: number;
  managementTotal: number;
  otherTotal: number;
  cleaningTotal?: number;
  receivedAmount: number;
  /** 정산요금 = 수납 차감 전 ①+②+③미납+④청소비·기타(settlement_amount 정의, 0266). */
  total: number;
  /** 확정 부과분 미납(0171) = 정본 `미납 소계` 자동값. total 에는 override 반영값이 이미 포함돼 있다. */
  billingUnpaid: number;
  /** 미납 소계 직접 수정값(extra.subtotalOverride.unpaid, QA #49). null = billingUnpaid(자동). */
  unpaidOverride?: number | null;
  onUnpaidOverrideChange?: (amount: number | null) => void;
}) {
  // 정본 msCalc `due = (공과금+관리비+기타+미납 소계) − 수납액` — 완료 전 미수금 경고와 같은 숫자.
  const outstanding = total - receivedAmount;

  return (
    <div className="flex h-[50px] shrink-0 items-center border-t border-[#dce1e7] bg-[#f7f9fa] px-[18px]">
      <SummaryItem label="① 공과금" value={utilityTotal} />
      <SummaryItem label="② 관리비" value={managementTotal} />
      <SummaryItem label="③ 기타" value={otherTotal} />
      <SummaryItem label="청소" value={cleaningTotal} />
      {/* QA #49: 미납 소계 직접 수정. 비우면 자동(납기 경과 미납, 퇴실월 제외). */}
      <div className="mr-[14px] flex h-[16px] items-baseline gap-[6px] whitespace-nowrap border-r border-line pr-[14px]">
        <span className="text-[11.5px] font-bold leading-[14px] text-t3">미납 소계</span>
        <SubtotalInput
          label="미납 소계"
          autoValue={billingUnpaid}
          override={unpaidOverride}
          onOverrideChange={onUnpaidOverrideChange}
          className="h-[17px] w-[84px] border-0 border-b border-transparent bg-transparent p-0 text-right text-[14px] font-extrabold leading-[17px] text-red outline-none [appearance:textfield] focus:border-teal [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
      <SummaryItem label="수납액" value={receivedAmount} tone="teal" />
      <div className="ml-auto flex items-baseline gap-[7px] whitespace-nowrap">
        <span className="text-[12px] font-bold leading-[15px] text-t2">미수금</span>
        <strong className="text-[19px] font-extrabold leading-[23px] tracking-[-0.38px] text-t1">{formatNumber(outstanding)}</strong>
      </div>
    </div>
  );
}
