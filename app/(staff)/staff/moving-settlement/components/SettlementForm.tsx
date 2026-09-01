import type { RefObject } from "react";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import type { ChecklistItem, MeterSummary } from "@/hooks/reactquery/movingSettlement";
import { calculateSettlementAmount } from "@/hooks/reactquery/movingSettlement";
import { ManagementFeeSection } from "./settlement-form/ManagementFeeSection";
import { SettlementBasicSection } from "./settlement-form/SettlementBasicSection";
import { SettlementExtrasSection } from "./settlement-form/SettlementExtrasSection";
import { SettlementSummaryBar } from "./settlement-form/SettlementSummaryBar";
import { UtilitySettlementSection } from "./settlement-form/UtilitySettlementSection";

export type SettlementDraft = MovingSettlementValues;
const EMPTY_INPUT_REF: RefObject<HTMLInputElement | null> = { current: null };

export function calculateProratedMgmtFee(
  monthly: number | null,
  moveOutDate: string,
): number {
  if (monthly === null || moveOutDate === "") return 0;

  const [year, month, day] = moveOutDate.split("-").map(Number);
  if (!year || !month || !day) return 0;

  return Math.round((monthly * day) / 30);
}

export function SettlementForm({
  buildingName = "선택 세대",
  unitNo = "",
  contactPhone = "",
  value,
  onChange,
  meters = [],
  checklist = [],
  checked = {},
  onChecklistChange = () => undefined,
  receivedAmount = 0,
  onReceivedAmountChange = () => undefined,
  finalPaidDate = "",
  onFinalPaidDateChange = () => undefined,
  paymentInputRef = EMPTY_INPUT_REF,
}: {
  buildingName?: string;
  unitNo?: string;
  contactPhone?: string;
  value: SettlementDraft;
  onChange: (next: SettlementDraft) => void;
  meters?: MeterSummary[];
  checklist?: ChecklistItem[];
  checked?: Record<number, boolean>;
  onChecklistChange?: (id: number, checked: boolean) => void;
  receivedAmount?: number;
  onReceivedAmountChange?: (amount: number) => void;
  finalPaidDate?: string;
  onFinalPaidDateChange?: (date: string) => void;
  paymentInputRef?: RefObject<HTMLInputElement | null>;
}) {
  const set = <K extends keyof SettlementDraft>(
    key: K,
    next: SettlementDraft[K],
  ) => onChange({ ...value, [key]: next });
  const amount = calculateSettlementAmount(value);

  const setMoveOutDate = (moveOutDate: string) =>
    onChange({
      ...value,
      moveOutDate,
      mgmtFeeProrated: calculateProratedMgmtFee(
        value.mgmtFeeMonthly,
        moveOutDate,
      ),
    });

  const setMonthly = (mgmtFeeMonthly: number | null) =>
    onChange({
      ...value,
      mgmtFeeMonthly,
      mgmtFeeProrated: calculateProratedMgmtFee(
        mgmtFeeMonthly,
        value.moveOutDate,
      ),
    });

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
        <h2 className="text-[15px] font-extrabold text-t1">
          {buildingName} {unitNo}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-[18px] pb-[20px] pt-[16px]">
        <div className="flex min-w-[760px] flex-col gap-[10px]">
          <SettlementBasicSection
            moveOutDate={value.moveOutDate}
            onMoveOutDateChange={setMoveOutDate}
          />
          <UtilitySettlementSection value={value} meters={meters} onChange={onChange} />
          <ManagementFeeSection
            monthly={value.mgmtFeeMonthly}
            prorated={value.mgmtFeeProrated}
            contactPhone={contactPhone}
            onMonthlyChange={setMonthly}
            onProratedChange={(next) => set("mgmtFeeProrated", next)}
          />
          <SettlementExtrasSection
            value={value}
            onChange={onChange}
            checklist={checklist}
            checked={checked}
            onChecklistChange={onChecklistChange}
            receivedAmount={receivedAmount}
            onReceivedAmountChange={onReceivedAmountChange}
            finalPaidDate={finalPaidDate}
            onFinalPaidDateChange={onFinalPaidDateChange}
            paymentInputRef={paymentInputRef}
          />
        </div>
      </div>

      <SettlementSummaryBar
        utilityTotal={(value.waterCharge ?? 0) + (value.elecCharge ?? 0) + (value.gasCharge ?? 0)}
        managementTotal={value.mgmtFeeProrated ?? 0}
        otherTotal={value.repairAmount ?? 0}
        receivedAmount={receivedAmount}
        total={amount}
      />
    </section>
  );
}
