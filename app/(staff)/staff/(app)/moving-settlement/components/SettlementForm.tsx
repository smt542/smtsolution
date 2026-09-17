"use client";

import { useEffect, type RefObject } from "react";
import { useManagementFeeRows } from "@/hooks/reactquery/movingSettlement/feeItemCharges";
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
  buildingTypeId = null,
  unitId = null,
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
  buildingTypeId?: number | null;
  unitId?: number | null;
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
  // 관리비 소계는 관리비 항목(fee_items)x당월 부과액에서 계산된다. 섹션 표시값과
  // 하단 요약바/미수금/저장값이 어긋나지 않도록 계산 결과를 draft 에 되돌려 넣어
  // 숫자 출처를 하나로 유지한다. 정본 헤더의 "정산액(일할 자동)" 동작이다.
  const { subtotal: managementTotal } = useManagementFeeRows(
    buildingTypeId,
    unitId,
    value.moveOutDate,
  );
  useEffect(() => {
    if ((value.mgmtFeeProrated ?? 0) === managementTotal) return;
    onChange({ ...value, mgmtFeeProrated: managementTotal });
    // value/onChange 를 의존성에 넣으면 매 렌더 재실행되므로 계산값만 추적한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managementTotal]);

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
            buildingTypeId={buildingTypeId}
            unitId={unitId}
            moveOutDate={value.moveOutDate}
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
